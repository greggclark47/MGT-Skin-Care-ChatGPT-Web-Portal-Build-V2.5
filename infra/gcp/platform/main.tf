locals {
  prefix = "team47-${var.environment}"
  labels = merge(var.labels, { environment = var.environment })
  # The baseline API bindings are always present. Stripe remains opt-in: its
  # two API-only secrets are mounted only through the feature-scoped map.
  api_secret_environment = merge(var.api_secret_environment, var.stripe_api_secret_environment)
  secret_ids = setunion(
    toset([for binding in values(local.api_secret_environment) : binding.secret_id]),
    toset([for binding in values(var.worker_secret_environment) : binding.secret_id]),
    var.additional_secret_ids,
  )
  worker_environment = merge({
    NODE_ENV              = "production"
    DEMO_MODE             = "false"
    PROCESS_ROLE          = "worker"
    WORKER_RUN_ONCE       = "true"
    DATABASE_CA_CERT_PATH = "/app/infra/portal/supabase-prod-ca-2021.crt"
  }, var.worker_environment, var.deploy_application ? {
    OPERATIONS_ALERT_WEBHOOK_URL = "${google_cloud_run_v2_service.alert_receiver[0].uri}/events"
  } : {})
  api_environment = merge({
    NODE_ENV              = "production"
    DEMO_MODE             = "false"
    HOST                  = "0.0.0.0"
    PORT                  = "3100"
    PROCESS_ROLE          = "api"
    PUBLIC_ORIGIN         = "https://${var.domain}"
    PORTAL_DOMAIN         = var.domain
    DATABASE_CA_CERT_PATH = "/app/infra/portal/supabase-prod-ca-2021.crt"
  }, var.api_environment)
  subscriptions_enabled       = lookup(local.api_environment, "SUBSCRIPTIONS_ENABLED", "false") == "true"
  commercial_stripe_enabled   = lookup(local.api_environment, "STRIPE_USAGE_BILLING_ENABLED", "false") == "true" || lookup(local.api_environment, "STRIPE_B2B_INVOICING_ENABLED", "false") == "true"
  api_secret_names            = toset(keys(local.api_secret_environment))
  worker_secret_names         = toset(keys(var.worker_secret_environment))
}

# Keep the Supabase database/identity path and the Stripe webhook path aligned
# with the API process that owns both. These checks run during planning, before
# Cloud Run can receive a partial environment. They validate only variable
# names and Secret Manager references, never secret values.
resource "terraform_data" "runtime_secret_contract" {
  input = {
    subscriptions_enabled     = local.subscriptions_enabled
    commercial_stripe_enabled = local.commercial_stripe_enabled
    api_secret_names          = sort(tolist(local.api_secret_names))
    worker_secret_names       = sort(tolist(local.worker_secret_names))
  }

  lifecycle {
    precondition {
      condition     = contains(local.api_secret_names, "DATABASE_URL") && contains(local.api_secret_names, "SUPABASE_ANON_KEY") && contains(local.worker_secret_names, "DATABASE_URL") && contains(local.worker_secret_names, "SUPABASE_SERVICE_ROLE_KEY")
      error_message = "The Supabase runtime path requires DATABASE_URL for API and worker, SUPABASE_ANON_KEY for API, and SUPABASE_SERVICE_ROLE_KEY for worker."
    }
    precondition {
      condition     = !local.subscriptions_enabled || (contains(local.api_secret_names, "STRIPE_SECRET_KEY") && contains(local.api_secret_names, "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET"))
      error_message = "Enabled subscriptions require STRIPE_SECRET_KEY and STRIPE_SUBSCRIPTION_WEBHOOK_SECRET in stripe_api_secret_environment."
    }
    precondition {
      condition     = !local.commercial_stripe_enabled || contains(local.api_secret_names, "STRIPE_SECRET_KEY")
      error_message = "Enabled Stripe usage billing or B2B invoicing requires STRIPE_SECRET_KEY in stripe_api_secret_environment."
    }
    precondition {
      condition     = local.subscriptions_enabled || local.commercial_stripe_enabled || !contains(local.api_secret_names, "STRIPE_SECRET_KEY") && !contains(local.api_secret_names, "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET")
      error_message = "Do not mount Stripe secrets while every Stripe feature is disabled."
    }
    precondition {
      condition     = local.subscriptions_enabled || !contains(local.api_secret_names, "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET")
      error_message = "Do not mount STRIPE_SUBSCRIPTION_WEBHOOK_SECRET when subscriptions are disabled."
    }
  }
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_service" "required" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "certificatemanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "sts.googleapis.com",
  ])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "platform" {
  location               = var.region
  repository_id          = "${local.prefix}-platform"
  description            = "Immutable Team 47 Studio application images"
  format                 = "DOCKER"
  labels                 = local.labels
  cleanup_policy_dry_run = true
  depends_on             = [google_project_service.required]
}

resource "google_service_account" "web" {
  account_id   = substr("${local.prefix}-web", 0, 30)
  display_name = "Team 47 Studio ${var.environment} web"
}

resource "google_service_account" "api" {
  account_id   = substr("${local.prefix}-api", 0, 30)
  display_name = "Team 47 Studio ${var.environment} API"
}

resource "google_service_account" "worker" {
  account_id   = substr("${local.prefix}-worker", 0, 30)
  display_name = "Team 47 Studio ${var.environment} scheduled worker"
}

resource "google_service_account" "alert_receiver" {
  account_id   = substr("${local.prefix}-alerts", 0, 30)
  display_name = "Team 47 Studio ${var.environment} operations alert receiver"
}

resource "google_service_account" "scheduler" {
  account_id   = substr("${local.prefix}-scheduler", 0, 30)
  display_name = "Team 47 Studio ${var.environment} scheduler"
}

resource "google_service_account" "backup" {
  account_id   = substr("${local.prefix}-backup", 0, 30)
  display_name = "Team 47 Studio ${var.environment} backup writer"
}

resource "google_secret_manager_secret" "runtime" {
  for_each  = local.secret_ids
  secret_id = each.value
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "api" {
  for_each  = local.api_secret_environment
  secret_id = google_secret_manager_secret.runtime[each.value.secret_id].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

resource "google_secret_manager_secret_iam_member" "worker" {
  for_each  = var.worker_secret_environment
  secret_id = google_secret_manager_secret.runtime[each.value.secret_id].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_secret_manager_secret_iam_member" "alert_receiver" {
  secret_id = google_secret_manager_secret.runtime[var.worker_secret_environment["OPERATIONS_ALERT_WEBHOOK_TOKEN"].secret_id].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.alert_receiver.email}"
}

resource "google_storage_bucket" "media" {
  name                        = "${var.project_id}-${local.prefix}-media"
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  labels                      = local.labels
  versioning {
    enabled = true
  }
  lifecycle_rule {
    condition {
      age = var.media_object_age_days
    }
    action {
      type = "Delete"
    }
  }
  lifecycle_rule {
    condition {
      num_newer_versions = 3
    }
    action {
      type = "Delete"
    }
  }
  depends_on = [google_project_service.required]
}

resource "google_storage_bucket" "backups" {
  name                        = "${var.project_id}-${local.prefix}-backups"
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  labels                      = local.labels
  versioning {
    enabled = true
  }
  retention_policy {
    retention_period = var.backup_retention_seconds
    is_locked        = false
  }
  lifecycle_rule {
    condition {
      age = var.backup_object_age_days
    }
    action {
      type = "Delete"
    }
  }
  depends_on = [google_project_service.required]
}

resource "google_storage_bucket_iam_member" "api_media" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_storage_bucket_iam_member" "backup_writer" {
  bucket = google_storage_bucket.backups.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.backup.email}"
}

resource "google_cloud_run_v2_service" "web" {
  count                = var.deploy_application ? 1 : 0
  name                 = "${local.prefix}-web"
  location             = var.region
  deletion_protection  = var.environment == "production"
  ingress              = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  default_uri_disabled = true
  launch_stage         = "BETA"
  labels               = local.labels
  template {
    service_account = google_service_account.web.email
    timeout         = "60s"
    scaling {
      min_instance_count = var.web_min_instances
      max_instance_count = var.max_instances
    }
    containers {
      image = var.web_image
      ports {
        container_port = 3000
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "NEXT_PUBLIC_SITE_URL"
        value = "https://${var.domain}"
      }
      resources {
        limits            = { cpu = "1", memory = "512Mi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      startup_probe {
        failure_threshold = 12
        period_seconds    = 5
        timeout_seconds   = 3
        http_get {
          path = "/"
          port = 3000
        }
      }
      liveness_probe {
        period_seconds  = 30
        timeout_seconds = 3
        http_get {
          path = "/"
          port = 3000
        }
      }
    }
  }
  lifecycle {
    precondition {
      condition     = can(regex("-docker\\.pkg\\.dev/.+@sha256:[0-9a-f]{64}$", var.web_image))
      error_message = "web_image must be an immutable Artifact Registry digest."
    }
  }
  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "api" {
  count                = var.deploy_application ? 1 : 0
  name                 = "${local.prefix}-api"
  location             = var.region
  deletion_protection  = var.environment == "production"
  ingress              = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  default_uri_disabled = true
  launch_stage         = "BETA"
  labels               = local.labels
  template {
    service_account                  = google_service_account.api.email
    timeout                          = "60s"
    max_instance_request_concurrency = 40
    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.max_instances
    }
    containers {
      image = var.api_image
      ports {
        container_port = 3100
      }
      dynamic "env" {
        for_each = local.api_environment
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = local.api_secret_environment
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = env.value.version
            }
          }
        }
      }
      resources {
        limits            = { cpu = "2", memory = "1Gi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      startup_probe {
        failure_threshold = 12
        period_seconds    = 5
        timeout_seconds   = 3
        http_get {
          path = "/healthz"
          port = 3100
        }
      }
      liveness_probe {
        period_seconds  = 30
        timeout_seconds = 3
        http_get {
          path = "/healthz"
          port = 3100
        }
      }
    }
  }
  lifecycle {
    precondition {
      condition     = can(regex("-docker\\.pkg\\.dev/.+@sha256:[0-9a-f]{64}$", var.api_image))
      error_message = "api_image must be an immutable Artifact Registry digest."
    }
  }
  depends_on = [google_secret_manager_secret_iam_member.api]
}

resource "google_cloud_run_v2_service_iam_member" "web_public_through_lb" {
  count    = var.deploy_application ? 1 : 0
  name     = google_cloud_run_v2_service.web[0].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "api_public_through_lb" {
  count    = var.deploy_application ? 1 : 0
  name     = google_cloud_run_v2_service.api[0].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service" "alert_receiver" {
  count                = var.deploy_application ? 1 : 0
  name                 = "${local.prefix}-alerts"
  location             = var.region
  deletion_protection  = var.environment == "production"
  ingress              = "INGRESS_TRAFFIC_ALL"
  default_uri_disabled = false
  labels               = local.labels
  template {
    service_account                  = google_service_account.alert_receiver.email
    timeout                          = "30s"
    max_instance_request_concurrency = 20
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }
    containers {
      image   = var.api_image
      command = ["node"]
      args    = ["/app/apps/api/dist/portal/operations-alert-receiver.js"]
      ports {
        container_port = 8080
      }
      env {
        name  = "OPERATIONS_ALERT_KEY_ID"
        value = "primary"
      }
      env {
        name  = "OPERATIONS_ALERT_MAX_AGE_SECONDS"
        value = "300"
      }
      env {
        name = "OPERATIONS_ALERT_WEBHOOK_TOKEN"
        value_source {
          secret_key_ref {
            secret  = var.worker_secret_environment["OPERATIONS_ALERT_WEBHOOK_TOKEN"].secret_id
            version = var.worker_secret_environment["OPERATIONS_ALERT_WEBHOOK_TOKEN"].version
          }
        }
      }
      resources {
        limits            = { cpu = "1", memory = "256Mi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      startup_probe {
        failure_threshold = 12
        period_seconds    = 5
        timeout_seconds   = 3
        http_get {
          path = "/healthz"
          port = 8080
        }
      }
      liveness_probe {
        period_seconds  = 30
        timeout_seconds = 3
        http_get {
          path = "/healthz"
          port = 8080
        }
      }
    }
  }
  lifecycle {
    precondition {
      condition     = can(regex("-docker\\.pkg\\.dev/.+@sha256:[0-9a-f]{64}$", var.api_image))
      error_message = "api_image must be an immutable Artifact Registry digest."
    }
  }
  depends_on = [google_secret_manager_secret_iam_member.alert_receiver]
}

resource "google_cloud_run_v2_service_iam_member" "alert_receiver_public" {
  count    = var.deploy_application ? 1 : 0
  name     = google_cloud_run_v2_service.alert_receiver[0].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_job" "worker" {
  count               = var.deploy_application ? 1 : 0
  name                = "${local.prefix}-worker"
  location            = var.region
  deletion_protection = var.environment == "production"
  labels              = local.labels
  template {
    parallelism = 1
    task_count  = 1
    template {
      service_account = google_service_account.worker.email
      max_retries     = 1
      timeout         = "900s"
      containers {
        image   = var.api_image
        command = ["sh", "-c"]
        args    = ["node /app/infra/portal/preflight.mjs && exec node dist/portal/worker.js"]
        dynamic "env" {
          for_each = local.worker_environment
          content {
            name  = env.key
            value = env.value
          }
        }
        dynamic "env" {
          for_each = var.worker_secret_environment
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = env.value.secret_id
                version = env.value.version
              }
            }
          }
        }
        resources {
          limits = { cpu = "1", memory = "1Gi" }
        }
      }
    }
  }
  lifecycle {
    precondition {
      condition     = can(regex("-docker\\.pkg\\.dev/.+@sha256:[0-9a-f]{64}$", var.api_image))
      error_message = "api_image must be an immutable Artifact Registry digest."
    }
  }
  depends_on = [google_secret_manager_secret_iam_member.worker, google_cloud_run_v2_service_iam_member.alert_receiver_public]
}

resource "google_cloud_run_v2_job_iam_member" "scheduler" {
  count    = var.deploy_application ? 1 : 0
  name     = google_cloud_run_v2_job.worker[0].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

resource "google_cloud_scheduler_job" "worker" {
  count            = var.deploy_application ? 1 : 0
  name             = "${local.prefix}-worker"
  description      = "Runs one fenced Team 47 Studio operations sweep"
  region           = var.region
  schedule         = var.worker_schedule
  time_zone        = var.worker_time_zone
  attempt_deadline = "320s"
  retry_config {
    retry_count          = 2
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
    max_doublings        = 3
  }
  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.worker[0].name}:run"
    oauth_token {
      service_account_email = google_service_account.scheduler.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
  depends_on = [google_cloud_run_v2_job_iam_member.scheduler]
}

resource "google_compute_security_policy" "edge" {
  count       = var.deploy_application ? 1 : 0
  name        = "${local.prefix}-edge"
  description = "Origin protection behind Cloudflare; managed WAF rules begin in preview."
  type        = "CLOUD_ARMOR"
  rule {
    action      = "deny(403)"
    priority    = 1000
    preview     = var.cloud_armor_preview
    description = "SQL injection signatures"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('sqli-v33-stable')"
      }
    }
  }
  rule {
    action      = "throttle"
    priority    = 1020
    preview     = var.cloud_armor_preview
    description = "Per-client API and webhook abuse protection"
    match {
      expr {
        expression = "request.path.matches('/api/.*') || request.path.matches('/webhooks/.*')"
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "XFF_IP"
      rate_limit_threshold {
        count        = var.edge_api_requests_per_minute
        interval_sec = 60
      }
    }
  }
  rule {
    action      = "deny(403)"
    priority    = 1010
    preview     = var.cloud_armor_preview
    description = "Cross-site scripting signatures"
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('xss-v33-stable')"
      }
    }
  }
  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow after reviewed rules"
  }
}

resource "google_compute_region_network_endpoint_group" "web" {
  count                 = var.deploy_application ? 1 : 0
  name                  = "${local.prefix}-web"
  region                = var.region
  network_endpoint_type = "SERVERLESS"
  cloud_run {
    service = google_cloud_run_v2_service.web[0].name
  }
}

resource "google_compute_region_network_endpoint_group" "api" {
  count                 = var.deploy_application ? 1 : 0
  name                  = "${local.prefix}-api"
  region                = var.region
  network_endpoint_type = "SERVERLESS"
  cloud_run {
    service = google_cloud_run_v2_service.api[0].name
  }
}

resource "google_compute_backend_service" "web" {
  count                 = var.deploy_application ? 1 : 0
  name                  = "${local.prefix}-web"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  enable_cdn            = true
  security_policy       = google_compute_security_policy.edge[0].id
  backend {
    group = google_compute_region_network_endpoint_group.web[0].id
  }
  log_config {
    enable      = true
    sample_rate = 0.5
  }
}

resource "google_compute_backend_service" "api" {
  count                 = var.deploy_application ? 1 : 0
  name                  = "${local.prefix}-api"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 60
  enable_cdn            = false
  security_policy       = google_compute_security_policy.edge[0].id
  backend {
    group = google_compute_region_network_endpoint_group.api[0].id
  }
  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

resource "google_compute_url_map" "https" {
  count = var.deploy_application ? 1 : 0
  name  = "${local.prefix}-https"
  default_url_redirect {
    host_redirect          = var.domain
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
  host_rule {
    hosts        = [var.domain]
    path_matcher = "portal"
  }
  host_rule {
    hosts        = ["www.${var.domain}"]
    path_matcher = "www-redirect"
  }
  path_matcher {
    name            = "portal"
    default_service = google_compute_backend_service.web[0].id
    path_rule {
      paths   = ["/api/*", "/healthz", "/readyz", "/webhooks/*"]
      service = google_compute_backend_service.api[0].id
    }
  }
  path_matcher {
    name = "www-redirect"
    default_url_redirect {
      host_redirect          = var.domain
      https_redirect         = true
      redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
      strip_query            = false
    }
  }
}

resource "google_compute_url_map" "http_redirect" {
  count = var.deploy_application ? 1 : 0
  name  = "${local.prefix}-http-redirect"
  default_url_redirect {
    host_redirect          = var.domain
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_managed_ssl_certificate" "portal" {
  count = var.deploy_application ? 1 : 0
  name  = "${local.prefix}-portal"
  managed {
    domains = [var.domain, "www.${var.domain}"]
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_ssl_policy" "modern" {
  count           = var.deploy_application ? 1 : 0
  name            = "${local.prefix}-modern"
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
}

resource "google_compute_target_https_proxy" "portal" {
  count            = var.deploy_application ? 1 : 0
  name             = "${local.prefix}-https"
  url_map          = google_compute_url_map.https[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.portal[0].id]
  ssl_policy       = google_compute_ssl_policy.modern[0].id
}

resource "google_compute_target_http_proxy" "redirect" {
  count   = var.deploy_application ? 1 : 0
  name    = "${local.prefix}-http"
  url_map = google_compute_url_map.http_redirect[0].id
}

resource "google_compute_global_address" "portal" {
  count = var.deploy_application ? 1 : 0
  name  = "${local.prefix}-portal"
}

resource "google_compute_global_forwarding_rule" "https" {
  count                 = var.deploy_application ? 1 : 0
  name                  = "${local.prefix}-https"
  ip_address            = google_compute_global_address.portal[0].address
  port_range            = "443"
  target                = google_compute_target_https_proxy.portal[0].id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_compute_global_forwarding_rule" "http" {
  count                 = var.deploy_application ? 1 : 0
  name                  = "${local.prefix}-http"
  ip_address            = google_compute_global_address.portal[0].address
  port_range            = "80"
  target                = google_compute_target_http_proxy.redirect[0].id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_iam_workload_identity_pool" "github" {
  count                     = var.github_repository == "" ? 0 : 1
  workload_identity_pool_id = substr("${local.prefix}-github", 0, 32)
  display_name              = "Team 47 Studio ${var.environment} GitHub"
  depends_on                = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count                              = var.github_repository == "" ? 0 : 1
  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub Actions"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  attribute_condition = "assertion.repository == '${var.github_repository}'"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github" {
  count        = var.github_repository == "" ? 0 : 1
  account_id   = substr("${local.prefix}-github", 0, 30)
  display_name = "Team 47 Studio ${var.environment} GitHub deployer"
}

resource "google_service_account_iam_member" "github_oidc" {
  count              = var.github_repository == "" ? 0 : 1
  service_account_id = google_service_account.github[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repository}"
}

resource "google_project_iam_member" "github_artifact_writer" {
  count   = var.github_repository == "" ? 0 : 1
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github[0].email}"
}

resource "google_project_iam_member" "github_run_admin" {
  count   = var.github_repository == "" ? 0 : 1
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github[0].email}"
}

resource "google_service_account_iam_member" "github_use_api" {
  count              = var.github_repository == "" ? 0 : 1
  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github[0].email}"
}

resource "google_service_account_iam_member" "github_use_web" {
  count              = var.github_repository == "" ? 0 : 1
  service_account_id = google_service_account.web.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github[0].email}"
}

resource "google_service_account_iam_member" "github_use_worker" {
  count              = var.github_repository == "" ? 0 : 1
  service_account_id = google_service_account.worker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github[0].email}"
}

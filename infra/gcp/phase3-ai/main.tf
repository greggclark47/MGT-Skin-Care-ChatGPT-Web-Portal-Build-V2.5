locals {
  prefix                = "team47-${var.environment}-ai"
  hosted_openai_enabled = var.openai_model != ""
  subnet_cidr           = "10.47.0.0/20"
  ollama_internal_url   = "http://${google_compute_instance.ollama.network_interface[0].network_ip}:11434"
}

resource "google_project_service" "required" {
  for_each = toset([
    "apigateway.googleapis.com",
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicecontrol.googleapis.com",
    "servicemanagement.googleapis.com",
    "servicenetworking.googleapis.com",
  ])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_compute_network" "ai" {
  name                    = "${local.prefix}-network"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.required]
}

resource "google_compute_subnetwork" "ai" {
  name                     = "${local.prefix}-subnet"
  region                   = var.region
  network                  = google_compute_network.ai.id
  ip_cidr_range            = local.subnet_cidr
  private_ip_google_access = true
}

resource "google_compute_router" "ai" {
  name    = "${local.prefix}-router"
  region  = var.region
  network = google_compute_network.ai.id
}

resource "google_compute_router_nat" "ai" {
  name                               = "${local.prefix}-nat"
  router                             = google_compute_router.ai.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

resource "google_compute_firewall" "ollama_from_broker" {
  name        = "${local.prefix}-ollama-from-broker"
  network     = google_compute_network.ai.name
  direction   = "INGRESS"
  priority    = 1000
  source_tags = ["${local.prefix}-broker"]
  target_tags = ["${local.prefix}-ollama"]
  allow {
    protocol = "tcp"
    ports    = ["11434"]
  }
}

resource "google_service_account" "ollama" {
  account_id   = substr(replace("${local.prefix}-ollama", "_", "-"), 0, 30)
  display_name = "Team 47 ${var.environment} Ollama VM"
}

resource "google_service_account" "broker" {
  account_id   = substr(replace("${local.prefix}-broker", "_", "-"), 0, 30)
  display_name = "Team 47 ${var.environment} AI broker"
}

resource "google_service_account" "gateway" {
  account_id   = substr(replace("${local.prefix}-gateway", "_", "-"), 0, 30)
  display_name = "Team 47 ${var.environment} API Gateway"
}

resource "google_compute_disk" "models" {
  name                      = "${local.prefix}-models"
  type                      = "pd-balanced"
  zone                      = var.zone
  size                      = var.model_disk_size_gb
  physical_block_size_bytes = 4096
}

resource "google_compute_instance" "ollama" {
  name                      = "${local.prefix}-ollama"
  zone                      = var.zone
  machine_type              = var.gpu_machine_type
  allow_stopping_for_update = true
  can_ip_forward            = false
  tags                      = ["${local.prefix}-ollama"]

  boot_disk {
    initialize_params {
      image = var.gpu_source_image
      size  = 50
      type  = "pd-balanced"
    }
  }

  attached_disk {
    source      = google_compute_disk.models.id
    device_name = "ollama-models"
    mode        = "READ_WRITE"
  }

  guest_accelerator {
    type  = var.gpu_type
    count = var.gpu_count
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "TERMINATE"
    provisioning_model  = "STANDARD"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.ai.id
  }

  service_account {
    email  = google_service_account.ollama.email
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  metadata = {
    enable-oslogin = "TRUE"
  }

  metadata_startup_script = templatefile("${path.module}/startup-ollama.sh.tftpl", {
    deepseek_model = var.deepseek_model
    qwen_model     = var.qwen_model
    openclaw_model = var.openclaw_model
    ollama_image   = var.ollama_image
  })

  lifecycle {
    precondition {
      condition     = !can(regex(":latest$", var.deepseek_model)) && !can(regex(":latest$", var.qwen_model)) && !can(regex(":latest$", var.openclaw_model))
      error_message = "Production model tags must not use :latest."
    }
  }
}

resource "google_secret_manager_secret" "openai" {
  secret_id = var.openai_secret_id
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "broker_openai" {
  secret_id = google_secret_manager_secret.openai.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.broker.email}"
}

resource "google_cloud_run_v2_service" "broker" {
  name                = "${local.prefix}-broker"
  location            = var.region
  deletion_protection = var.environment == "production"
  # API Gateway invokes the authenticated run.app endpoint. No allUsers binding is
  # created; direct anonymous traffic is denied by Cloud Run IAM.
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.broker.email
    timeout         = "60s"
    scaling {
      min_instance_count = var.environment == "production" ? 1 : 0
      max_instance_count = 10
    }
    vpc_access {
      network_interfaces {
        network    = google_compute_network.ai.name
        subnetwork = google_compute_subnetwork.ai.name
        tags       = ["${local.prefix}-broker"]
      }
      egress = "PRIVATE_RANGES_ONLY"
    }
    containers {
      image = var.ai_broker_image
      resources {
        limits = { cpu = "1", memory = "1Gi" }
      }
      env {
        name  = "OLLAMA_BASE_URL"
        value = local.ollama_internal_url
      }
      env {
        name  = "OLLAMA_DEEPSEEK_MODEL"
        value = var.deepseek_model
      }
      env {
        name  = "OLLAMA_QWEN_MODEL"
        value = var.qwen_model
      }
      env {
        name  = "OLLAMA_OPENCLAW_MODEL"
        value = var.openclaw_model
      }
      env {
        name  = "HOSTED_OPENAI_ENABLED"
        value = tostring(local.hosted_openai_enabled)
      }
      env {
        name  = "OPENAI_MODEL"
        value = var.openai_model
      }
      dynamic "env" {
        for_each = local.hosted_openai_enabled ? [1] : []
        content {
          name = "OPENAI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.openai.secret_id
              version = "latest"
            }
          }
        }
      }
      startup_probe {
        failure_threshold     = 12
        period_seconds       = 5
        timeout_seconds      = 3
        http_get {
          path = "/healthz"
        }
      }
      liveness_probe {
        period_seconds  = 30
        timeout_seconds = 3
        http_get {
          path = "/healthz"
        }
      }
    }
  }
  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service_iam_member" "gateway_invoker" {
  name     = google_cloud_run_v2_service.broker.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.gateway.email}"
}

resource "google_api_gateway_api" "ai" {
  provider = google-beta
  api_id   = "${var.api_gateway_id}-${var.environment}"
  project  = var.project_id
}

resource "google_api_gateway_api_config" "ai" {
  provider             = google-beta
  api                  = google_api_gateway_api.ai.api_id
  api_config_id_prefix = "config-"
  project              = var.project_id
  gateway_config {
    backend_config { google_service_account = google_service_account.gateway.email }
  }
  openapi_documents {
    document {
      path = "openapi.yaml"
      contents = base64encode(templatefile("${path.module}/openapi.yaml.tftpl", {
        broker_url          = google_cloud_run_v2_service.broker.uri
        client_jwt_issuer   = var.client_jwt_issuer
        client_jwks_uri     = var.client_jwks_uri
        client_jwt_audience = var.client_jwt_audience
      }))
    }
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "google_api_gateway_gateway" "ai" {
  provider   = google-beta
  api_config = google_api_gateway_api_config.ai.id
  gateway_id = "${var.api_gateway_id}-${var.environment}"
  region     = var.region
  project    = var.project_id
}

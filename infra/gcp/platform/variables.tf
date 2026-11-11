variable "project_id" {
  description = "Approved Google Cloud project ID for this isolated environment."
  type        = string
}

variable "region" {
  description = "Google Cloud region selected near the Supabase database and primary users."
  type        = string
  default     = "us-east1"
}

variable "environment" {
  description = "Deployment boundary. Staging and production use separate projects."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "domain" {
  description = "Canonical portal hostname."
  type        = string
  default     = "team47studio.com"
  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.domain))
    error_message = "domain must be a canonical lowercase DNS hostname."
  }
}

variable "deploy_application" {
  description = "Second-stage switch. Leave false until secret versions and immutable images exist."
  type        = bool
  default     = false
}

variable "api_image" {
  description = "Immutable Artifact Registry API image reference."
  type        = string
  default     = ""
}

variable "web_image" {
  description = "Immutable Artifact Registry web image reference."
  type        = string
  default     = ""
}

variable "api_environment" {
  description = "Reviewed non-secret API runtime configuration. Values are never used for credentials."
  type        = map(string)
  default     = {}
}

variable "worker_environment" {
  description = "Reviewed non-secret scheduled-worker runtime configuration."
  type        = map(string)
  default     = {}
}

variable "api_secret_environment" {
  description = "Always-required API environment variable to pinned Secret Manager secret ID/version mapping. Secret values are added outside Terraform."
  type = map(object({
    secret_id = string
    version   = string
  }))
  default = {
    "DATABASE_URL"      = { secret_id = "team47-database-url", version = "1" }
    "MGT_EDGE_TOKEN"    = { secret_id = "team47-edge-token", version = "1" }
    "SUPABASE_ANON_KEY" = { secret_id = "team47-supabase-anon-key", version = "1" }
  }
  validation {
    condition = alltrue([
      for binding in values(var.api_secret_environment) :
      can(regex("^[a-z][a-z0-9_-]{0,254}$", binding.secret_id)) && can(regex("^[1-9][0-9]*$", binding.version))
    ])
    error_message = "API secrets must use valid secret IDs and explicit positive numeric versions."
  }
}

variable "stripe_api_secret_environment" {
  description = "Optional Stripe API-only secret bindings. Add the API key for enabled Stripe features and the webhook signing secret only for enabled subscriptions. Secret values are added outside Terraform."
  type = map(object({
    secret_id = string
    version   = string
  }))
  default = {}
  validation {
    condition = alltrue([
      for name, binding in var.stripe_api_secret_environment :
      contains(["STRIPE_SECRET_KEY", "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET"], name)
      && can(regex("^[a-z][a-z0-9_-]{0,254}$", binding.secret_id))
      && can(regex("^[1-9][0-9]*$", binding.version))
    ])
    error_message = "Stripe API bindings may contain only STRIPE_SECRET_KEY and STRIPE_SUBSCRIPTION_WEBHOOK_SECRET with explicit positive numeric Secret Manager versions."
  }
}

variable "worker_secret_environment" {
  description = "Worker environment variable to pinned Secret Manager secret ID/version mapping."
  type = map(object({
    secret_id = string
    version   = string
  }))
  default = {
    "DATABASE_URL"                   = { secret_id = "team47-database-url", version = "1" }
    "OPERATIONS_ALERT_WEBHOOK_TOKEN" = { secret_id = "team47-operations-alert-token", version = "1" }
    "SUPABASE_SERVICE_ROLE_KEY"      = { secret_id = "team47-supabase-service-role-key", version = "1" }
  }
  validation {
    condition = alltrue([
      for binding in values(var.worker_secret_environment) :
      can(regex("^[a-z][a-z0-9_-]{0,254}$", binding.secret_id)) && can(regex("^[1-9][0-9]*$", binding.version))
    ])
    error_message = "Worker secrets must use valid secret IDs and explicit positive numeric versions."
  }
}

variable "additional_secret_ids" {
  description = "Optional secret containers needed before a feature is activated."
  type        = set(string)
  default = [
    "team47-backup-attestation-secret",
    "team47-notification-webhook-token",
    "team47-ollama-cloud-api-key",
    "team47-openai-api-key",
    "team47-stripe-secret-key",
    "team47-stripe-webhook-secret",
  ]
}

variable "web_min_instances" {
  type    = number
  default = 0
}

variable "api_min_instances" {
  type    = number
  default = 0
}

variable "max_instances" {
  type    = number
  default = 20
  validation {
    condition     = var.max_instances >= 1 && var.max_instances <= 100
    error_message = "max_instances must be between 1 and 100."
  }
}

variable "worker_schedule" {
  description = "Cloud Scheduler cron expression for one bounded operational sweep."
  type        = string
  default     = "*/5 * * * *"
}

variable "worker_time_zone" {
  type    = string
  default = "Etc/UTC"
}

variable "media_object_age_days" {
  type    = number
  default = 730
}

variable "backup_object_age_days" {
  type    = number
  default = 2555
}

variable "backup_retention_seconds" {
  type    = number
  default = 2592000
}

variable "cloud_armor_preview" {
  description = "Observe managed WAF matches before enforcement. Set false only after staging tuning."
  type        = bool
  default     = true
}

variable "edge_api_requests_per_minute" {
  description = "Cloud Armor per-client API/webhook abuse threshold. It is not a billing or entitlement quota."
  type        = number
  default     = 600
  validation {
    condition     = var.edge_api_requests_per_minute >= 60 && var.edge_api_requests_per_minute <= 10000 && floor(var.edge_api_requests_per_minute) == var.edge_api_requests_per_minute
    error_message = "edge_api_requests_per_minute must be a whole number between 60 and 10000."
  }
}

variable "monitoring_enabled" {
  description = "Creates public HTTPS uptime monitoring and an alert policy after DNS and TLS are ready."
  type        = bool
  default     = false
}

variable "monitoring_notification_email" {
  description = "Approved operations mailbox for Google Cloud alerts. Required when monitoring_enabled is true."
  type        = string
  default     = ""
  validation {
    condition     = var.monitoring_notification_email == "" || can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.monitoring_notification_email))
    error_message = "monitoring_notification_email must be empty or a valid email address."
  }
}

variable "incident_runbook_url" {
  description = "HTTPS incident-response runbook linked from alerts."
  type        = string
  default     = "https://team47studio.com/operations/runbook"
  validation {
    condition     = can(regex("^https://", var.incident_runbook_url))
    error_message = "incident_runbook_url must use HTTPS."
  }
}

variable "billing_account_id" {
  description = "Optional billing account ID used only to create a project-scoped budget."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Optional whole-dollar monthly project budget. Zero leaves budget creation disabled."
  type        = number
  default     = 0
  validation {
    condition     = var.monthly_budget_usd == 0 || (var.monthly_budget_usd >= 25 && floor(var.monthly_budget_usd) == var.monthly_budget_usd)
    error_message = "monthly_budget_usd must be zero or a whole-dollar amount of at least 25."
  }
}

variable "github_repository" {
  description = "GitHub owner/repository allowed to exchange OIDC tokens. Empty leaves CI identity disabled."
  type        = string
  default     = ""
}

variable "labels" {
  type = map(string)
  default = {
    application = "team47studio"
    managed_by  = "terraform"
  }
}

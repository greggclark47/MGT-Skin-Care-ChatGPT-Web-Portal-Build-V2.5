output "artifact_registry_repository" {
  value = google_artifact_registry_repository.platform.name
}

output "artifact_registry_hostname" {
  value = "${var.region}-docker.pkg.dev"
}

output "media_bucket" {
  value = google_storage_bucket.media.name
}

output "backup_bucket" {
  value = google_storage_bucket.backups.name
}

output "secret_ids" {
  value       = sort(tolist(local.secret_ids))
  description = "Containers only. Secret values are never managed by this module."
}

output "load_balancer_ipv4" {
  value = var.deploy_application ? google_compute_global_address.portal[0].address : null
}

output "portal_url" {
  value = var.deploy_application ? "https://${var.domain}" : null
}

output "web_service_name" {
  value = var.deploy_application ? google_cloud_run_v2_service.web[0].name : null
}

output "api_service_name" {
  value = var.deploy_application ? google_cloud_run_v2_service.api[0].name : null
}

output "worker_job_name" {
  value = var.deploy_application ? google_cloud_run_v2_job.worker[0].name : null
}

output "operations_alert_receiver_url" {
  value = var.deploy_application ? "${google_cloud_run_v2_service.alert_receiver[0].uri}/events" : null
}

output "uptime_check_id" {
  value = local.monitoring_active ? google_monitoring_uptime_check_config.portal[0].uptime_check_id : null
}

output "billing_budget_name" {
  value = local.budget_active ? google_billing_budget.project[0].name : null
}

output "github_workload_identity_provider" {
  value = var.github_repository == "" ? null : google_iam_workload_identity_pool_provider.github[0].name
}

output "github_service_account" {
  value = var.github_repository == "" ? null : google_service_account.github[0].email
}

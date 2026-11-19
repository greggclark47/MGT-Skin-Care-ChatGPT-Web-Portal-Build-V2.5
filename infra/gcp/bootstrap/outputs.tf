output "state_bucket" {
  value       = google_storage_bucket.terraform_state.name
  description = "Use as the GCS backend bucket for this environment."
}

output "platform_state_prefix" {
  value = "team47studio/${var.environment}/platform"
}

output "bootstrap_state_prefix" {
  value = "team47studio/${var.environment}/bootstrap"
}

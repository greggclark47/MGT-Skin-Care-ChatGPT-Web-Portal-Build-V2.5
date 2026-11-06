output "ollama_private_ip" {
  value       = google_compute_instance.ollama.network_interface[0].network_ip
  description = "Private Ollama address. Port 11434 is not exposed publicly."
}

output "broker_service_uri" {
  value       = google_cloud_run_v2_service.broker.uri
  description = "IAM-protected Cloud Run broker URI."
}

output "api_gateway_hostname" {
  value       = google_api_gateway_gateway.ai.default_hostname
  description = "Gateway hostname. Do not publish until application authentication and rate limits are approved."
}

output "openai_secret_id" {
  value       = google_secret_manager_secret.openai.secret_id
  description = "Secret container only; Terraform never creates or reads a secret value."
}

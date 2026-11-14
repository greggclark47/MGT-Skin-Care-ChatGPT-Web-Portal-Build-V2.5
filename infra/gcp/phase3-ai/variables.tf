variable "project_id" {
  description = "Approved Team 47 Studio Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Approved deployment region, selected with the database and customer residency review."
  type        = string
}

variable "zone" {
  description = "GPU-capable zone in the approved region with confirmed quota."
  type        = string
}

variable "environment" {
  description = "Deployment boundary."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "ai_broker_image" {
  description = "Immutable Artifact Registry image reference for services/ai-broker."
  type        = string
  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.ai_broker_image))
    error_message = "ai_broker_image must use an immutable sha256 digest."
  }
}

variable "gpu_machine_type" {
  type        = string
  description = "Machine type approved after benchmark and quota review."
  default     = "g2-standard-8"
}

variable "gpu_type" {
  type        = string
  description = "Google Compute Engine accelerator type available in the selected zone."
  default     = "nvidia-l4"
}

variable "gpu_count" {
  type        = number
  default     = 1
  validation {
    condition     = var.gpu_count >= 1 && var.gpu_count <= 8
    error_message = "gpu_count must be between 1 and 8."
  }
}

variable "gpu_source_image" {
  description = "Reviewed GPU-enabled Compute Engine source image or image-family URI. No mutable default is supplied."
  type        = string
}

variable "ollama_image" {
  description = "Approved immutable Ollama GPU container image."
  type        = string
  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.ollama_image))
    error_message = "ollama_image must use an immutable sha256 digest."
  }
}

variable "model_disk_size_gb" {
  type        = number
  default     = 250
  validation {
    condition     = var.model_disk_size_gb >= 100
    error_message = "Model disk must be at least 100 GB."
  }
}

variable "deepseek_model" {
  type    = string
  default = "deepseek-r1:8b"
}

variable "qwen_model" {
  type    = string
  default = "qwen3.5:4b"
}

variable "openclaw_model" {
  description = "Approved custom Ollama model tag. Empty leaves OpenClaw disabled."
  type        = string
  default     = ""
}

variable "openai_model" {
  description = "Approved and evaluated OpenAI Responses API model ID. Empty keeps hosted fallback disabled."
  type        = string
  default     = ""
}

variable "ollama_cloud_enabled" {
  description = "Enables the metered Ollama Cloud fallback after owner subscription and hosted-processing approval."
  type        = bool
  default     = false
}

variable "ollama_cloud_model" {
  description = "Approved Ollama Cloud model ID."
  type        = string
  default     = "deepseek-v4.1-flash"
  validation {
    condition     = var.ollama_cloud_model == "deepseek-v4.1-flash"
    error_message = "Only the reviewed deepseek-v4.1-flash route is currently approved."
  }
}

variable "ollama_cloud_secret_id" {
  description = "Secret Manager secret ID containing the Ollama Cloud API key."
  type        = string
  default     = "team47-ollama-cloud-api-key"
}

variable "openai_secret_id" {
  description = "Secret Manager secret ID containing the OpenAI project service-account key."
  type        = string
  default     = "team47-openai-api-key"
}

variable "api_gateway_id" {
  type    = string
  default = "team47-ai"
}

variable "client_jwt_issuer" {
  description = "Approved Supabase or service-token issuer for callers of API Gateway."
  type        = string
}

variable "client_jwks_uri" {
  description = "HTTPS JWKS endpoint for the approved client token issuer."
  type        = string
}

variable "client_jwt_audience" {
  description = "Required audience claim for AI broker client tokens."
  type        = string
}

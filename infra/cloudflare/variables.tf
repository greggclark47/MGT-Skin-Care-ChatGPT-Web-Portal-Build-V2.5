variable "zone_id" {
  description = "Cloudflare zone ID for team47studio.com."
  type        = string
  sensitive   = true
}

variable "domain" {
  type    = string
  default = "team47studio.com"
}

variable "origin_ipv4" {
  description = "Global IPv4 address output by infra/gcp/platform."
  type        = string
  validation {
    condition     = can(cidrnetmask("${var.origin_ipv4}/32"))
    error_message = "origin_ipv4 must be a valid IPv4 address."
  }
}

variable "proxy_enabled" {
  description = "Keep false until the Google-managed origin certificate is ACTIVE, then change to true."
  type        = bool
  default     = false
}

variable "record_comment" {
  type    = string
  default = "Team 47 Studio Google Cloud production load balancer; Terraform managed"
}

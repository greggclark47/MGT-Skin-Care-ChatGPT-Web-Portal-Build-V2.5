variable "project_id" {
  description = "Approved staging or production Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Bucket location approved for the environment."
  type        = string
  default     = "us-east1"
}

variable "environment" {
  description = "State isolation boundary."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "state_admin_members" {
  description = "Explicit IAM principals allowed to read and write Terraform state objects."
  type        = set(string)
  default     = []
  validation {
    condition = alltrue([
      for member in var.state_admin_members :
      can(regex("^(user|group|serviceAccount):[^@\\s]+@[^@\\s]+$", member))
    ])
    error_message = "State administrators must be explicit user, group, or serviceAccount IAM principals."
  }
}

variable "labels" {
  type = map(string)
  default = {
    application = "team47studio"
    managed_by  = "terraform"
    purpose     = "terraform-state"
  }
}

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

# Authenticate with the CLOUDFLARE_API_TOKEN environment variable. Never place
# the token in tfvars, GitHub variables, a command line, or a Google Drive file.
provider "cloudflare" {}

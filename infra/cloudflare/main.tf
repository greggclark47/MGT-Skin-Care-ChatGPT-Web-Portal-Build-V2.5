resource "cloudflare_dns_record" "apex" {
  zone_id = var.zone_id
  name    = var.domain
  type    = "A"
  content = var.origin_ipv4
  proxied = var.proxy_enabled
  ttl     = var.proxy_enabled ? 1 : 300
  comment = var.record_comment
}

resource "cloudflare_dns_record" "www" {
  zone_id = var.zone_id
  name    = "www.${var.domain}"
  type    = "A"
  content = var.origin_ipv4
  proxied = var.proxy_enabled
  ttl     = var.proxy_enabled ? 1 : 300
  comment = "Canonical redirect to ${var.domain}; Terraform managed"
}

resource "cloudflare_zone_dnssec" "primary" {
  zone_id = var.zone_id
}

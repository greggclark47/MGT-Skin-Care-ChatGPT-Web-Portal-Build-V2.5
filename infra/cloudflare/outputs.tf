output "apex_record_id" {
  value = cloudflare_dns_record.apex.id
}

output "www_record_id" {
  value = cloudflare_dns_record.www.id
}

output "proxy_enabled" {
  value = var.proxy_enabled
}

output "dnssec_status" {
  value = cloudflare_zone_dnssec.primary.status
}

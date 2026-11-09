locals {
  monitoring_active = var.deploy_application && var.monitoring_enabled
  monitoring_notification_channels = local.monitoring_active && var.monitoring_notification_email != "" ? [
    google_monitoring_notification_channel.operations_email[0].name
  ] : []
  budget_active = var.billing_account_id != "" && var.monthly_budget_usd > 0
}

resource "google_monitoring_notification_channel" "operations_email" {
  count        = local.monitoring_active && var.monitoring_notification_email != "" ? 1 : 0
  display_name = "Team 47 Studio ${var.environment} operations"
  description  = "Production platform alerts managed by Terraform"
  type         = "email"
  enabled      = true
  force_delete = false
  labels = {
    email_address = var.monitoring_notification_email
  }
  user_labels = local.labels
  depends_on  = [google_project_service.required]
}

resource "google_monitoring_uptime_check_config" "portal" {
  count              = local.monitoring_active ? 1 : 0
  display_name       = "Team 47 Studio ${var.environment} portal readiness"
  checker_type       = "STATIC_IP_CHECKERS"
  period             = "60s"
  timeout            = "10s"
  selected_regions   = ["USA"]
  log_check_failures = true
  user_labels        = local.labels

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.domain
    }
  }

  http_check {
    path           = "/readyz"
    port           = 443
    request_method = "GET"
    use_ssl        = true
    validate_ssl   = true
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  lifecycle {
    precondition {
      condition     = var.monitoring_notification_email != ""
      error_message = "monitoring_notification_email is required before monitoring is enabled."
    }
  }

  depends_on = [
    google_compute_global_forwarding_rule.https,
    google_compute_managed_ssl_certificate.portal,
  ]
}

resource "google_monitoring_alert_policy" "portal_unavailable" {
  count                 = local.monitoring_active ? 1 : 0
  display_name          = "Team 47 Studio ${var.environment} portal unavailable"
  combiner              = "OR"
  enabled               = true
  severity              = "CRITICAL"
  notification_channels = local.monitoring_notification_channels
  user_labels           = local.labels

  conditions {
    display_name = "Readiness check below 80 percent"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.portal[0].uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 0.8
      duration        = "180s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_FRACTION_TRUE"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["metric.label.check_id"]
      }
      trigger {
        count = 1
      }
    }
  }

  alert_strategy {
    auto_close           = "1800s"
    notification_prompts = ["OPENED", "CLOSED"]
  }

  documentation {
    mime_type = "text/markdown"
    subject   = "Team 47 Studio ${var.environment} readiness failure"
    content   = "The public readiness endpoint has been below the approved threshold for three minutes. Follow the incident runbook: ${var.incident_runbook_url}"
  }

  depends_on = [google_monitoring_notification_channel.operations_email]
}

resource "google_billing_budget" "project" {
  count           = local.budget_active ? 1 : 0
  billing_account = var.billing_account_id
  display_name    = "Team 47 Studio ${var.environment} monthly project budget"

  budget_filter {
    projects        = ["projects/${data.google_project.current.number}"]
    calendar_period = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 0.8
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    disable_default_iam_recipients   = false
    enable_project_level_recipients  = true
    monitoring_notification_channels = local.monitoring_notification_channels
  }

  lifecycle {
    precondition {
      condition     = can(regex("^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$", var.billing_account_id))
      error_message = "billing_account_id must use the six-six-six uppercase billing account format."
    }
  }

  depends_on = [google_project_service.required]
}

# Monitoring of one environment (monitoring design): the two alarms and the
# health check, which exist only when "alarms" is on (production; test only
# for the hours an alarm is being proved); the saved searches; the dashboard.

variable "prefix" {
  description = "The environment's name prefix: vd-test or vd-prod."
  type        = string
}

variable "environment" {
  type = string
}

variable "alarms" {
  description = "Whether the error-rate alarm, the health alarm and the health check exist."
  type        = bool
}

variable "alarm_topic_arn" {
  description = "The notification topic the setup made; every alarm sends through it."
  type        = string
}

variable "site_name" {
  type = string
}

variable "server_function_name" {
  type = string
}

variable "migrate_function_name" {
  type = string
}

variable "api_id" {
  type = string
}

variable "database_identifier" {
  type = string
}

variable "log_group_names" {
  type = object({ server = string, api_access = string, access_gate = string })
}

data "aws_region" "current" {}

locals {
  region    = data.aws_region.current.region
  namespace = "VirtuosoDrive"
  searches  = "CloudWatch, Logs Insights, saved searches, folder ${var.prefix}"

  custom = { for name in ["Requests", "ServerFailures", "Duration", "ColdStarts"] :
    name => [local.namespace, name, "environment", var.environment]
  }
  function_metric = { for name in ["Errors", "Throttles", "ConcurrentExecutions"] :
    name => [
      ["AWS/Lambda", name, "FunctionName", var.server_function_name],
      ["AWS/Lambda", name, "FunctionName", var.migrate_function_name],
    ]
  }
  database_metric = { for name in ["CPUUtilization", "CPUCreditBalance", "DatabaseConnections", "FreeStorageSpace", "FreeableMemory"] :
    name => ["AWS/RDS", name, "DBInstanceIdentifier", var.database_identifier]
  }
  api_metric = { for name in ["4xx", "5xx", "Latency"] :
    name => ["AWS/ApiGateway", name, "ApiId", var.api_id]
  }
}

# --- The health check from outside, and its alarm ---

resource "aws_route53_health_check" "site" {
  count             = var.alarms ? 1 : 0
  type              = "HTTPS"
  fqdn              = var.site_name
  port              = 443
  resource_path     = "/v1/health"
  request_interval  = 30
  failure_threshold = 3
  measure_latency   = false

  tags = { Name = "${var.prefix}-health" }
}

resource "aws_cloudwatch_metric_alarm" "health" {
  count             = var.alarms ? 1 : 0
  alarm_name        = "${var.prefix}-health"
  alarm_description = "Virtuoso Drive, ${var.environment}: the site failed its health check from outside twice in a row, so it is down or its database is not answering. Open first: ${local.searches}, \"server failures in the last hour\"."

  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  dimensions          = { HealthCheckId = aws_route53_health_check.site[0].id }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  alarm_actions = [var.alarm_topic_arn]
  ok_actions    = [var.alarm_topic_arn]
}

# --- The error rate ---

resource "aws_cloudwatch_metric_alarm" "error_rate" {
  count             = var.alarms ? 1 : 0
  alarm_name        = "${var.prefix}-error-rate"
  alarm_description = "Virtuoso Drive, ${var.environment}: more than 5% of at least 20 requests in 5 minutes were answered with a server failure (health checks not counted), so the site is failing for people. Open first: ${local.searches}, \"server failures in the last hour\"."

  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  # A period with no requests counts as fine, so a quiet night raises nothing.
  treat_missing_data = "notBreaching"

  metric_query {
    id          = "breach"
    label       = "1 when at least 20 requests and more than 5% of them failed"
    expression  = "IF(requests >= 20 AND failures / requests > 0.05, 1, 0)"
    return_data = true
  }

  metric_query {
    id = "requests"
    metric {
      namespace   = local.namespace
      metric_name = "Requests"
      dimensions  = { environment = var.environment }
      stat        = "Sum"
      period      = 300
    }
  }

  metric_query {
    id = "failures"
    metric {
      namespace   = local.namespace
      metric_name = "ServerFailures"
      dimensions  = { environment = var.environment }
      stat        = "Sum"
      period      = 300
    }
  }

  alarm_actions = [var.alarm_topic_arn]
  ok_actions    = [var.alarm_topic_arn]
}

# --- Saved searches ---

resource "aws_cloudwatch_query_definition" "by_request" {
  name            = "${var.prefix}/by request identifier"
  log_group_names = [var.log_group_names.server, var.log_group_names.access_gate]
  query_string    = <<-EOT
    fields @timestamp, requestId, operation, outcome, code, durationMs, version, error.message
    | filter requestId = "PUT-THE-REQUEST-IDENTIFIER-HERE"
    | sort @timestamp asc
  EOT
}

resource "aws_cloudwatch_query_definition" "server_failures" {
  name            = "${var.prefix}/server failures in the last hour"
  log_group_names = [var.log_group_names.server]
  query_string    = <<-EOT
    fields @timestamp, requestId, operation, outcome, durationMs, version, error.name, error.message
    | filter outcome >= 500
    | sort @timestamp desc
    | limit 200
  EOT
}

resource "aws_cloudwatch_query_definition" "slowest" {
  name            = "${var.prefix}/the twenty slowest requests today"
  log_group_names = [var.log_group_names.server]
  query_string    = <<-EOT
    fields @timestamp, requestId, operation, outcome, durationMs, coldStart, version
    | filter ispresent(durationMs)
    | sort durationMs desc
    | limit 20
  EOT
}

resource "aws_cloudwatch_query_definition" "refusals" {
  name            = "${var.prefix}/access refusals in the last day"
  log_group_names = [var.log_group_names.server, var.log_group_names.access_gate, var.log_group_names.api_access]
  query_string    = <<-EOT
    fields @timestamp, operation, outcome, path, requestId, status, route
    | filter operation = "access refused" or status = "429"
    | sort @timestamp desc
    | limit 500
  EOT
}

# Added with Unit U3 (observability design O24): how browsing is doing, read
# from the server's request entries. No measurement series and no alarm is
# added; a search is charged only by the log it reads, when a person runs it.

resource "aws_cloudwatch_query_definition" "folder_outcomes" {
  name            = "${var.prefix}/folder requests by outcome"
  log_group_names = [var.log_group_names.server]
  query_string    = <<-EOT
    filter operation = "getFolder"
    | stats count(*) as requests by folderOutcome
    | sort folderOutcome asc
  EOT
}

resource "aws_cloudwatch_query_definition" "slow_folders" {
  name            = "${var.prefix}/folder requests slower than 1 second today"
  log_group_names = [var.log_group_names.server]
  query_string    = <<-EOT
    fields @timestamp, folderId, rows, answerBytes, durationMs, requestId
    | filter operation = "getFolder" and durationMs > 1000
    | sort durationMs desc
    | limit 50
  EOT
}

locals {
  # Views drawn from the log by a search, not from a measurement series. The
  # search runs when a person opens or refreshes the dashboard: a dashboard's
  # definition has no setting that makes it refresh by itself, and none is
  # added.
  log_views = [
    {
      type = "log", x = 0, y = 18, width = 24, height = 6
      properties = {
        title  = "Folder requests by outcome over time"
        region = local.region
        # Shown as a table: one line for each outcome in each five minutes.
        # The search is of the plainest form the service
        # documents (a count grouped by a field and by a period of time), and
        # a table shows the result of any search. Whether the service would
        # also draw this search as one line per outcome has not been seen, so
        # that is not relied on.
        view  = "table"
        query = <<-EOT
          SOURCE '${var.log_group_names.server}'
          | filter operation = "getFolder"
          | stats count(*) by folderOutcome, bin(5m)
        EOT
      }
    },
  ]
}

# --- The one screen ---

resource "aws_cloudwatch_dashboard" "this" {
  dashboard_name = var.prefix
  dashboard_body = jsonencode({
    widgets = concat(
      [
        {
          type = "metric", x = 0, y = 0, width = 8, height = 6
          properties = {
            title   = "Use: requests and server failures"
            region  = local.region
            stat    = "Sum"
            period  = 60
            metrics = [local.custom.Requests, local.custom.ServerFailures]
          }
        },
        {
          type = "metric", x = 8, y = 0, width = 8, height = 6
          properties = {
            title  = "Use: error rate (%)"
            region = local.region
            period = 300
            metrics = [
              [{ expression = "100 * failures / requests", label = "Error rate", id = "rate" }],
              concat(local.custom.Requests, [{ id = "requests", stat = "Sum", visible = false }]),
              concat(local.custom.ServerFailures, [{ id = "failures", stat = "Sum", visible = false }]),
            ]
          }
        },
        {
          type = "metric", x = 16, y = 0, width = 8, height = 6
          properties = {
            title  = "Speed: duration (ms), middle and 95th of 100; cold starts"
            region = local.region
            period = 60
            metrics = [
              concat(local.custom.Duration, [{ stat = "p50", label = "middle" }]),
              concat(local.custom.Duration, [{ stat = "p95", label = "95th of 100" }]),
              concat(local.custom.ColdStarts, [{ stat = "Sum", yAxis = "right" }]),
            ]
          }
        },
        {
          type = "metric", x = 0, y = 6, width = 8, height = 6
          properties = {
            title  = "Entry point: 4xx (429s at the request limit appear here), 5xx, latency"
            region = local.region
            period = 60
            metrics = [
              concat(local.api_metric["4xx"], [{ stat = "Sum" }]),
              concat(local.api_metric["5xx"], [{ stat = "Sum" }]),
              concat(local.api_metric.Latency, [{ stat = "p95", yAxis = "right" }]),
            ]
          }
        },
        {
          type = "metric", x = 8, y = 6, width = 8, height = 6
          properties = {
            title   = "Functions: errors, throttles, concurrent copies"
            region  = local.region
            stat    = "Maximum"
            period  = 60
            metrics = concat(local.function_metric.Errors, local.function_metric.Throttles, local.function_metric.ConcurrentExecutions)
          }
        },
        {
          type = "metric", x = 16, y = 6, width = 8, height = 6
          properties = {
            title   = "Database: CPU, credit balance, connections"
            region  = local.region
            stat    = "Average"
            period  = 60
            metrics = [local.database_metric.CPUUtilization, local.database_metric.CPUCreditBalance, local.database_metric.DatabaseConnections]
          }
        },
        {
          type = "metric", x = 0, y = 12, width = 8, height = 6
          properties = {
            title   = "Database: free storage and freeable memory"
            region  = local.region
            stat    = "Minimum"
            period  = 300
            metrics = [local.database_metric.FreeStorageSpace, local.database_metric.FreeableMemory]
          }
        },
      ],
      var.alarms ? [
        {
          type = "metric", x = 8, y = 12, width = 8, height = 6
          properties = {
            title  = "Health: check status and percentage healthy"
            region = "us-east-1"
            period = 60
            metrics = [
              ["AWS/Route53", "HealthCheckStatus", "HealthCheckId", aws_route53_health_check.site[0].id, { stat = "Minimum" }],
              ["AWS/Route53", "HealthCheckPercentageHealthy", "HealthCheckId", aws_route53_health_check.site[0].id, { stat = "Average", yAxis = "right" }],
            ]
          }
        },
      ] : [],
      var.environment == "production" ? [
        {
          type = "text", x = 16, y = 12, width = 8, height = 6
          properties = {
            markdown = "## Money\nThe month's spending against the ceiling is on the budget **vd-monthly**: [open AWS Budgets](https://console.aws.amazon.com/billing/home#/budgets). It is a link, not a chart: spending is not available as an ordinary measurement without extra cost."
          }
        },
      ] : [],
      local.log_views,
    )
  })
}

output "folder_search_names" {
  description = "The saved searches added for browsing (Unit U3)."
  value = [
    aws_cloudwatch_query_definition.folder_outcomes.name,
    aws_cloudwatch_query_definition.slow_folders.name,
  ]
}

output "log_view_titles" {
  description = "The dashboard's views that are drawn from the log by a search."
  value       = [for view in local.log_views : view.properties.title]
}

output "alarm_names" {
  value = concat(
    aws_cloudwatch_metric_alarm.health[*].alarm_name,
    aws_cloudwatch_metric_alarm.error_rate[*].alarm_name,
  )
}

output "health_check_count" {
  value = length(aws_route53_health_check.site)
}

output "names" {
  value = concat(
    [aws_cloudwatch_dashboard.this.dashboard_name],
    aws_cloudwatch_metric_alarm.health[*].alarm_name,
    aws_cloudwatch_metric_alarm.error_rate[*].alarm_name,
    [for tags in aws_route53_health_check.site[*].tags : tags.Name],
    [
      aws_cloudwatch_query_definition.folder_outcomes.name,
      aws_cloudwatch_query_definition.slow_folders.name,
    ],
  )
}

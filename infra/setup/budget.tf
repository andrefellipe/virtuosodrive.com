# Order 1: the notification topic. Order 2: the budget.
#
# The budget alarm must exist before anything else (project rule). Strictly,
# the topic is created a moment before it, because the budget needs somewhere
# to send; the topic costs nothing and can incur no charge by itself.
#
# The maintainer's email address is not here and not in Terraform's state:
# setup.sh subscribes it to the topic directly, so only the notification
# service holds it.

resource "aws_sns_topic" "alarms" {
  # checkov:skip=CKV_AWS_26: AWS Budgets and CloudWatch alarms cannot publish to a topic encrypted with the service's own key; the alternative is a key managed by the maintainer, which has a fixed monthly cost (security design S9). The messages name an alarm and hold no personal data.
  name = "vd-alarms"
}

resource "aws_sns_topic_policy" "alarms" {
  arn = aws_sns_topic.alarms.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "BudgetsMayPublish"
        Effect    = "Allow"
        Principal = { Service = "budgets.amazonaws.com" }
        Action    = "sns:Publish"
        Resource  = aws_sns_topic.alarms.arn
        Condition = {
          StringEquals = { "aws:SourceAccount" = local.account_id }
        }
      },
      {
        Sid       = "AlarmsOfThisAccountMayPublish"
        Effect    = "Allow"
        Principal = { Service = "cloudwatch.amazonaws.com" }
        Action    = "sns:Publish"
        Resource  = aws_sns_topic.alarms.arn
        Condition = {
          StringEquals = { "aws:SourceAccount" = local.account_id }
        }
      },
      # The pipeline's two identities are in this account, and their own
      # policy allows sns:Publish; they need no statement here. Keeping them
      # out lets this policy be created with the topic, before the identities
      # exist.
    ]
  })
}

locals {
  # AWS Budgets writes a tag filter as "user:<tag key>$<tag value>". The
  # dollar sign is put in by format() because "$" followed by "{" in a
  # Terraform string is an escape, not a dollar sign and a variable.
  budget_tag_filter = format("user:project$%s", var.project)
}

resource "aws_budgets_budget" "monthly" {
  # The topic must already accept messages from Budgets when the budget's
  # notifications are created.
  depends_on = [aws_sns_topic_policy.alarms]

  name         = "vd-monthly"
  budget_type  = "COST"
  limit_amount = format("%.2f", var.monthly_ceiling_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Only this project's tagged resources are counted (the maintainer's answer
  # Q1 at the code plan). The tag must be switched on for cost reporting,
  # which setup.sh does; AWS can take up to a day to start counting by it.
  cost_filter {
    name   = "TagKeyValue"
    values = [local.budget_tag_filter]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.alarms.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.alarms.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_sns_topic_arns = [aws_sns_topic.alarms.arn]
  }
}

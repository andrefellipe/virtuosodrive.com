output "alarm_topic_arn" {
  description = "The notification topic every alarm sends through."
  value       = aws_sns_topic.alarms.arn
}

output "budget_name" {
  description = "The budget whose alarm must exist before anything else."
  value       = aws_budgets_budget.monthly.name
}

output "budget_tag_filter" {
  description = "The tag filter the budget counts by, exactly as it is sent to AWS."
  value       = local.budget_tag_filter
}

output "state_bucket" {
  description = "The bucket holding Terraform's state."
  value       = aws_s3_bucket.state.bucket
}

output "deploy_role_arns" {
  description = "The two pipeline identities, stored as GitHub repository variables by github-settings.sh."
  value       = { for name, role in aws_iam_role.deploy : name => role.arn }
}

output "region" {
  description = "The Region everything is built in."
  value       = var.region
}

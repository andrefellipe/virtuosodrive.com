# What the pipeline's deploy steps need to know about the environment.

output "site_url" {
  value = "https://${var.site_name}"
}

output "prefix" {
  value = local.prefix
}

output "server_function_name" {
  value = module.server.server_function_name
}

output "migrate_function_name" {
  value = module.server.migrate_function_name
}

output "releases_bucket" {
  value = module.server.releases_bucket
}

output "pages_bucket" {
  value = module.edge.pages_bucket
}

output "access_password_parameter" {
  description = "The name of the parameter holding the access password. The value itself is never an output."
  value       = aws_ssm_parameter.access_password.name
}

output "distribution_domain_name" {
  value = module.edge.distribution_domain_name
}

output "certificate_validation_records" {
  description = "The records to add by hand where the zone lives, when manage_dns is off."
  value       = module.edge.certificate_validation_records
}

output "alarm_names" {
  value = module.monitoring.alarm_names
}

output "health_check_count" {
  value = module.monitoring.health_check_count
}

output "resource_names" {
  description = "Every name this configuration gives a resource, for the test that each carries the environment's prefix."
  value = concat(
    [aws_ssm_parameter.access_password.name, aws_secretsmanager_secret.origin.name],
    module.network.names,
    module.database.names,
    module.server.names,
    module.edge.names,
    module.monitoring.names,
  )
}

output "log_group_names" {
  description = "Every log group of the environment; each begins with the environment's log prefix or a service's own fixed prefix followed by the environment's."
  value = [
    module.server.log_group_names.server,
    module.server.log_group_names.migrate,
    module.server.log_group_names.api_access,
    module.edge.access_gate_log_group,
  ]
}

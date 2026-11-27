data "aws_caller_identity" "current" {}

locals {
  short      = var.environment == "production" ? "prod" : "test"
  prefix     = "vd-${local.short}"
  log_prefix = "/vd/${local.short}"
  account_id = data.aws_caller_identity.current.account_id
  # Both were made by the one-time setup and are referred to by name.
  alarm_topic_arn          = "arn:aws:sns:${var.region}:${local.account_id}:${var.alarm_topic_name}"
  permissions_boundary_arn = "arn:aws:iam::${local.account_id}:policy/${local.prefix}-boundary"
}

# --- Secrets generated here: never chosen, never in the repository ---------
#
# Each data source gives a new value at every plan. The resource that stores
# the value ignores later ones, so the secret is the one generated when it
# was created; changing its version marker replaces it with a new one.

data "aws_secretsmanager_random_password" "access" {
  password_length     = 32
  exclude_punctuation = true
}

resource "terraform_data" "access_password_version" {
  input = var.access_password_version
}

# The access password. Read by the maintainer, once per device, and by the
# pipeline's tests. Outside the VPC, so nothing needs an endpoint to read it.
resource "aws_ssm_parameter" "access_password" {
  # checkov:skip=CKV_AWS_337: Encrypted with the service's own key; keys managed by the maintainer have a fixed monthly cost (security design S9).
  name        = "${local.prefix}-access-password"
  description = "The access password of the ${var.environment} environment"
  type        = "SecureString"
  value       = data.aws_secretsmanager_random_password.access.random_password

  lifecycle {
    ignore_changes       = [value]
    replace_triggered_by = [terraform_data.access_password_version]
  }
}

data "aws_secretsmanager_random_password" "origin" {
  password_length     = 48
  exclude_punctuation = true
}

resource "terraform_data" "origin_secret_version" {
  input = var.origin_secret_version
}

# The secret the edge adds to prove a request came through it.
resource "aws_secretsmanager_secret" "origin" {
  # checkov:skip=CKV_AWS_149: Encrypted with the service's own key; keys managed by the maintainer have a fixed monthly cost (security design S9).
  # checkov:skip=CKV2_AWS_57: Replaced by changing "origin_secret_version", which updates the secret and the edge in one apply; an automatic rotation could not update the edge.
  name                    = "${local.prefix}-origin-secret"
  description             = "The secret the edge of ${var.environment} adds to requests it forwards to the server"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "origin" {
  secret_id     = aws_secretsmanager_secret.origin.id
  secret_string = data.aws_secretsmanager_random_password.origin.random_password

  lifecycle {
    ignore_changes       = [secret_string]
    replace_triggered_by = [terraform_data.origin_secret_version]
  }
}

# --- The environment's parts -------------------------------------------------

module "network" {
  source     = "../modules/network"
  prefix     = local.prefix
  cidr_block = var.vpc_cidr_block
}

module "database" {
  source              = "../modules/database"
  prefix              = local.prefix
  subnet_ids          = module.network.subnet_ids
  security_group_id   = module.network.security_group_ids.database
  deletion_protection = var.deletion_protection
  restored_copy_time  = var.restored_copy_time
  use_restored_copy   = var.use_restored_copy
}

module "server" {
  source      = "../modules/server"
  prefix      = local.prefix
  environment = var.environment
  log_prefix  = local.log_prefix
  subnet_ids  = module.network.subnet_ids
  security_group_ids = {
    server  = module.network.security_group_ids.server
    migrate = module.network.security_group_ids.migrate
  }
  # The address and port are those of the database in use: the first one's,
  # or the restored copy's while use_restored_copy is on.
  database = {
    address              = module.database.address
    port                 = module.database.port
    name                 = module.database.database_name
    sign_in_resource_ids = module.database.sign_in_resource_ids
    master_secret_arn    = module.database.master_secret_arn
    master_secret_name   = module.database.master_secret_name
  }
  origin_secret = {
    arn  = aws_secretsmanager_secret.origin.arn
    name = aws_secretsmanager_secret.origin.name
  }
  permissions_boundary_arn = local.permissions_boundary_arn
  placeholder_package      = var.placeholder_package
  server_concurrency       = var.server_concurrency
  throttle                 = var.throttle
  forced_failure           = var.forced_failure
}

module "edge" {
  source              = "../modules/edge"
  prefix              = local.prefix
  environment         = var.environment
  site_name           = var.site_name
  hosted_zone_name    = var.hosted_zone_name
  manage_dns          = var.manage_dns
  api_domain_name     = module.server.api_domain_name
  origin_secret_value = aws_secretsmanager_secret_version.origin.secret_string
  # Only the one-way scramble of the password is placed at the edge.
  access_password_sha256 = nonsensitive(sha256(aws_ssm_parameter.access_password.value))
  access_gate_enabled    = var.access_gate_enabled
  access_gate_file       = var.access_gate_file
}

module "monitoring" {
  source                = "../modules/monitoring"
  prefix                = local.prefix
  environment           = var.environment
  alarms                = var.alarms
  alarm_topic_arn       = local.alarm_topic_arn
  site_name             = var.site_name
  server_function_name  = module.server.server_function_name
  migrate_function_name = module.server.migrate_function_name
  api_id                = module.server.api_id
  database_identifier   = module.database.identifier
  log_group_names = {
    server      = module.server.log_group_names.server
    api_access  = module.server.log_group_names.api_access
    access_gate = module.edge.access_gate_log_group
  }
}

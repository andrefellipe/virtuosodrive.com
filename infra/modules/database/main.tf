# The database of one environment: Amazon RDS for PostgreSQL, private,
# encrypted, with TLS required and sign-in by AWS identity. The server and the
# change runner have no database password; the master password exists only to
# create their two users in a new environment, and is used by nothing else.

variable "prefix" {
  description = "The environment's name prefix: vd-test or vd-prod."
  type        = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "deletion_protection" {
  description = "On in production: must be turned off by one merged pull request before a second can remove the database."
  type        = bool
}

variable "engine_major_version" {
  description = "PostgreSQL's major version. Minor versions are applied automatically in the weekly window."
  type        = string
  default     = "18"
}

locals {
  database_name   = "virtuoso"
  master_username = "vdmaster"
  log_group_name  = "/aws/rds/instance/${var.prefix}-db/postgresql"
}

resource "aws_db_subnet_group" "this" {
  name        = "${var.prefix}-db"
  description = "The private subnets of ${var.prefix}"
  subnet_ids  = var.subnet_ids
}

locals {
  parameter_group_name_prefix = "${var.prefix}-postgres${var.engine_major_version}-"
}

# The name begins with fixed text and ends in a generated suffix. When the
# group has to be replaced, the new one is created before the old one is
# removed, so the two exist together for a moment and cannot share a name.
resource "aws_db_parameter_group" "this" {
  name_prefix = local.parameter_group_name_prefix
  family      = "postgres${var.engine_major_version}"
  description = "Connections must use TLS; statements slower than one second and connections are logged"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  # PostgreSQL 18 made this setting a list of what to log about each new
  # connection, where it used to be on or off. "all" logs every stage, which
  # is what "1" meant before.
  parameter {
    name  = "log_connections"
    value = "all"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# The master password is generated, never chosen and never in the repository.
# The data source gives a new value at every plan; the two resources that use
# it ignore later values, so the password is the one generated at creation.
data "aws_secretsmanager_random_password" "master" {
  password_length     = 32
  exclude_punctuation = true
}

resource "aws_secretsmanager_secret" "master" {
  # checkov:skip=CKV_AWS_149: Encrypted with the service's own key; keys managed by the maintainer have a fixed monthly cost (security design S9).
  # checkov:skip=CKV2_AWS_57: The master password is used once, to create the two database users of a new environment; nothing signs in with it afterwards, so rotating it would add a function and cost for no gain.
  name                    = "${var.prefix}-db-master"
  description             = "The database's master sign-in. Read only by the change runner, only in a new environment."
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "master" {
  secret_id = aws_secretsmanager_secret.master.id
  secret_string = jsonencode({
    username = local.master_username
    password = data.aws_secretsmanager_random_password.master.random_password
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Declared here so that the database's log is kept 30 days, not forever.
resource "aws_cloudwatch_log_group" "postgresql" {
  # checkov:skip=CKV_AWS_158: Encrypted by the service; keys managed by the maintainer have a fixed monthly cost (security design S9).
  # checkov:skip=CKV_AWS_338: Logs are kept 30 days by requirement (FR12.5), not a year.
  name              = local.log_group_name
  retention_in_days = 30
}

resource "aws_db_instance" "this" {
  # checkov:skip=CKV_AWS_157: One Availability Zone by decision: 99% a month allows about 7 hours of failure, and a standby doubles the largest fixed cost (reliability design R7).
  # checkov:skip=CKV_AWS_118: Enhanced monitoring needs another role and adds log charges; the built-in measurements are on the dashboard (monitoring design).
  # checkov:skip=CKV_AWS_353: Performance Insights is not needed for one read by key; reconsidered when a later Unit adds real queries.
  # checkov:skip=CKV_AWS_293: Deletion protection is a variable: on in production, off in test, where the restore rehearsal removes a copy.
  # checkov:skip=CKV_AWS_354: Performance Insights is off (see above), so it has no key.
  # checkov:skip=CKV2_AWS_60: Backups are copied to the same Region only; one Region by decision (technology decisions T1).
  identifier     = "${var.prefix}-db"
  engine         = "postgres"
  engine_version = var.engine_major_version
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = local.database_name
  username = local.master_username
  password = data.aws_secretsmanager_random_password.master.random_password
  port     = 5432

  iam_database_authentication_enabled = true
  parameter_group_name                = aws_db_parameter_group.this.name
  db_subnet_group_name                = aws_db_subnet_group.this.name
  vpc_security_group_ids              = [var.security_group_id]
  publicly_accessible                 = false
  multi_az                            = false
  ca_cert_identifier                  = "rds-ca-rsa2048-g1"

  backup_retention_period    = 7
  backup_window              = "06:00-06:30"
  maintenance_window         = "sun:07:00-sun:08:00"
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true
  apply_immediately          = false

  enabled_cloudwatch_logs_exports = ["postgresql"]

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.prefix}-db-final"

  depends_on = [aws_cloudwatch_log_group.postgresql]

  lifecycle {
    # Terraform refuses to destroy the database (reliability design R6).
    prevent_destroy = true
    ignore_changes  = [password, engine_version]
  }
}

output "address" {
  value = aws_db_instance.this.address
}

output "port" {
  value = aws_db_instance.this.port
}

output "database_name" {
  value = local.database_name
}

output "identifier" {
  value = aws_db_instance.this.identifier
}

output "resource_id" {
  description = "The identifier sign-in by AWS identity is granted on."
  value       = aws_db_instance.this.resource_id
}

output "master_secret_arn" {
  value = aws_secretsmanager_secret.master.arn
}

output "master_secret_name" {
  value = aws_secretsmanager_secret.master.name
}

output "parameters" {
  description = "The settings group's settings, as name to value, so that a test can read them."
  value       = { for parameter in aws_db_parameter_group.this.parameter : parameter.name => parameter.value }
}

output "parameter_group_name_prefix" {
  description = "The fixed beginning of the settings group's name. The rest is generated, so a test checks the name by this."
  value       = aws_db_parameter_group.this.name_prefix
}

# The settings group is not listed: the end of its name is generated and not
# known until it exists. Its name is checked by parameter_group_name_prefix.
output "names" {
  value = [
    aws_db_instance.this.identifier,
    aws_db_subnet_group.this.name,
    aws_secretsmanager_secret.master.name,
  ]
}

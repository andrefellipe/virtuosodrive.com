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

variable "restored_copy_time" {
  description = "When set to a moment (RFC 3339), a second database exists beside the first, restored from the first to that moment. Null: no copy. The environment refuses it in production."
  type        = string
  default     = null
}

variable "use_restored_copy" {
  description = "Whether the address this module gives out is the restored copy's. Allowed only while the copy exists."
  type        = bool
  default     = false

  validation {
    condition     = !var.use_restored_copy || var.restored_copy_time != null
    error_message = "The restored copy can be used only while it exists: set restored_copy_time as well."
  }
}

locals {
  database_name   = "virtuoso"
  master_username = "vdmaster"
  log_group_name  = "/aws/rds/instance/${var.prefix}-db/postgresql"

  restored_identifier     = "${var.prefix}-db-restored"
  restored_log_group_name = "/aws/rds/instance/${local.restored_identifier}/postgresql"
  restored_count          = var.restored_copy_time == null ? 0 : 1
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
#
# Changing the group's description or its family replaces the group; changing
# a setting does not. A replaced group takes effect only at the database's
# next restart: until then the database reports it as waiting for a reboot
# and keeps running with the settings it started with.
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
# The data source gives a new value at every plan. Only the stored secret
# takes that value, once, when it is first written, and it ignores every
# later one. The database does not read the data source: it takes its
# password from the stored secret, so the two cannot differ, whichever run
# creates which.
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

locals {
  # The password as the secret holds it: the one value the database is given.
  master_password = jsondecode(aws_secretsmanager_secret_version.master.secret_string).password
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
  password = local.master_password
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
    # The password is not ignored: if the database's ever differs from the
    # secret's, the next run sets it to the secret's, in place.
    ignore_changes = [engine_version]
  }
}

# --- The restored copy: exists only while "restored_copy_time" is set ---------
#
# A restore never changes the database it reads from: it makes a second one
# beside it. Nothing here refers to the first database except to read its
# identifier, so setting or clearing the two switches can add, change or
# remove only the copy and its log group.
#
# The copy holds the first database's contents as they were at the moment
# named, and with them its users: "app" and "migrator" sign in to it by AWS
# identity as they do to the first, and the master sign-in in the stored
# secret is the copy's too. Size, name of the database and engine version are
# not written here, because a restore takes them from the source.
#
# Changing the moment replaces the copy. Leaving it unchanged changes nothing.

# Declared, like the first database's, so that the copy's log is kept 30 days
# and is removed with the copy.
resource "aws_cloudwatch_log_group" "restored_postgresql" {
  # checkov:skip=CKV_AWS_158: As for the first database's log group.
  # checkov:skip=CKV_AWS_338: As for the first database's log group.
  count             = local.restored_count
  name              = local.restored_log_group_name
  retention_in_days = 30
}

resource "aws_db_instance" "restored" {
  # checkov:skip=CKV_AWS_157: One Availability Zone, as the database it is restored from (reliability design R7).
  # checkov:skip=CKV_AWS_118: As the database it is restored from: no enhanced monitoring.
  # checkov:skip=CKV_AWS_353: As the database it is restored from: no Performance Insights.
  # checkov:skip=CKV_AWS_354: Performance Insights is off, so it has no key.
  # checkov:skip=CKV_AWS_293: A copy made to rehearse or perform a restore, in the test environment only (the environment refuses it in production). It is removed by clearing one variable, which deletion protection would refuse.
  # checkov:skip=CKV2_AWS_60: As the database it is restored from: one Region by decision (technology decisions T1).
  count = local.restored_count

  identifier     = local.restored_identifier
  engine         = aws_db_instance.this.engine
  instance_class = aws_db_instance.this.instance_class

  restore_to_point_in_time {
    source_db_instance_identifier = aws_db_instance.this.identifier
    restore_time                  = var.restored_copy_time
  }

  storage_type      = "gp3"
  storage_encrypted = true

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

  # Unlike the first database: the copy must be removable in one step, by
  # clearing the variable, and leaves no snapshot and no backups behind.
  deletion_protection      = false
  skip_final_snapshot      = true
  delete_automated_backups = true

  depends_on = [aws_cloudwatch_log_group.restored_postgresql]
}

locals {
  # The database the server and the change runner are pointed at.
  in_use = var.use_restored_copy ? one(aws_db_instance.restored) : aws_db_instance.this
}

output "address" {
  description = "The address of the database in use: the first one's, or the restored copy's while use_restored_copy is on."
  value       = local.in_use.address
}

output "port" {
  value = local.in_use.port
}

output "original_address" {
  description = "The first database's address, whichever is in use."
  value       = aws_db_instance.this.address
}

output "database_name" {
  value = local.database_name
}

output "identifier" {
  value = aws_db_instance.this.identifier
}

output "resource_id" {
  description = "The identifier sign-in by AWS identity is granted on, for the first database."
  value       = aws_db_instance.this.resource_id
}

output "sign_in_resource_ids" {
  description = "The identifiers sign-in by AWS identity is granted on: the first database's, and the restored copy's while it exists. The copy's is included from the run that creates it, one run before anything is pointed at it, so the permission is in place by then."
  value       = concat([aws_db_instance.this.resource_id], aws_db_instance.restored[*].resource_id)
}

output "restored_copy" {
  description = "What a test needs to read about the restored copy; null when there is none."
  value = one([for copy in aws_db_instance.restored : {
    identifier                          = copy.identifier
    source_db_instance_identifier       = one(copy.restore_to_point_in_time).source_db_instance_identifier
    restore_time                        = one(copy.restore_to_point_in_time).restore_time
    address                             = copy.address
    storage_encrypted                   = copy.storage_encrypted
    iam_database_authentication_enabled = copy.iam_database_authentication_enabled
    publicly_accessible                 = copy.publicly_accessible
    deletion_protection                 = copy.deletion_protection
    skip_final_snapshot                 = copy.skip_final_snapshot
    parameter_group_name                = copy.parameter_group_name
    db_subnet_group_name                = copy.db_subnet_group_name
  }])
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
  value = concat(
    [
      aws_db_instance.this.identifier,
      aws_db_subnet_group.this.name,
      aws_secretsmanager_secret.master.name,
    ],
    aws_db_instance.restored[*].identifier,
  )
}

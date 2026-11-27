# The server side of one environment: the server function behind its alias
# "live", the database change runner, the HTTP API in front of the server,
# their roles and log groups, and the bucket of Release packages.
#
# Terraform never decides which version of the code is live (reliability
# design R3). It creates the functions with a placeholder that answers 503 and
# from then on leaves their code, and the version the alias points at, to the
# pipeline's deploy steps.

variable "prefix" {
  description = "The environment's name prefix: vd-test or vd-prod."
  type        = string
}

variable "environment" {
  description = "test or production."
  type        = string
}

variable "log_prefix" {
  description = "The start of the environment's log group names: /vd/test or /vd/prod."
  type        = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_ids" {
  type = object({ server = string, migrate = string })
}

variable "database" {
  type = object({
    address = string
    port    = number
    name    = string
    # Every database the two functions may sign in to by AWS identity: the
    # one in use, and a restored copy while one exists.
    sign_in_resource_ids = list(string)
    master_secret_arn    = string
    master_secret_name   = string
  })
}

variable "origin_secret" {
  type = object({ arn = string, name = string })
}

variable "permissions_boundary_arn" {
  description = "The environment's outer limit; every role the pipeline creates must carry it."
  type        = string
}

variable "placeholder_package" {
  description = "The zip file holding the placeholder code new functions are created with."
  type        = string
}

variable "server_concurrency" {
  description = "The most copies of the server running at once. A negative value leaves the cap off."
  type        = number
}

variable "throttle" {
  description = "Requests a second to the server, sustained and burst."
  type        = object({ rate = number, burst = number })
}

variable "forced_failure" {
  description = "Enables the operation that fails on purpose, to prove the error-rate alarm. Never in production."
  type        = bool
}

variable "failing_change" {
  description = "Makes the change runner fail on purpose after the real pending changes, to rehearse a failing deployment. Never in production."
  type        = bool
  default     = false
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  region     = data.aws_region.current.region
  account_id = data.aws_caller_identity.current.account_id
  database_user = {
    server  = "app"
    migrate = "migrator"
  }
  # What each role may sign in to: its own database user, on each database
  # listed. Sign-in by AWS identity is granted per database, so a restored
  # copy needs its own line while it exists.
  sign_in_arns = {
    for role, user in local.database_user : role => [
      for resource_id in var.database.sign_in_resource_ids :
      "arn:aws:rds-db:${local.region}:${local.account_id}:dbuser:${resource_id}/${user}"
    ]
  }
  # One database is written as text and several as a list, which a
  # conditional cannot return directly because the two differ in type; hence
  # the round trip through JSON. Written this way, the policy of an
  # environment without a copy is the same, to the character, as before the
  # copy could exist, so adding the switch changes nothing in production.
  sign_in_resource = {
    for role, arns in local.sign_in_arns : role =>
    jsondecode(length(arns) == 1 ? jsonencode(arns[0]) : jsonencode(arns))
  }
  # A function in a VPC must manage its own network interfaces. These EC2
  # actions accept no narrower resource than "*".
  network_interface_statement = {
    Sid    = "NetworkInterfacesOfAFunctionInAVpc"
    Effect = "Allow"
    Action = [
      "ec2:CreateNetworkInterface", "ec2:DescribeNetworkInterfaces", "ec2:DeleteNetworkInterface",
      "ec2:AssignPrivateIpAddresses", "ec2:UnassignPrivateIpAddresses", "ec2:DescribeSubnets",
    ]
    Resource = "*"
  }
  lambda_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# --- Log groups: declared, so that none is created implicitly and kept forever ---

resource "aws_cloudwatch_log_group" "server" {
  # checkov:skip=CKV_AWS_158: Encrypted by the service; keys managed by the maintainer have a fixed monthly cost (security design S9).
  # checkov:skip=CKV_AWS_338: Logs are kept 30 days by requirement (FR12.5), not a year.
  name              = "${var.log_prefix}/server"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "migrate" {
  # checkov:skip=CKV_AWS_158: As for the server's group.
  # checkov:skip=CKV_AWS_338: As for the server's group.
  name              = "${var.log_prefix}/db-migrate"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "api_access" {
  # checkov:skip=CKV_AWS_158: As for the server's group.
  # checkov:skip=CKV_AWS_338: As for the server's group.
  name              = "${var.log_prefix}/api-access"
  retention_in_days = 30
}

# --- Roles: least privilege, each carrying the environment's outer limit ---

resource "aws_iam_role" "server" {
  name                 = "${var.prefix}-server-role"
  description          = "The server function of ${var.environment}"
  assume_role_policy   = local.lambda_trust
  permissions_boundary = var.permissions_boundary_arn
}

resource "aws_iam_role_policy" "server" {
  # checkov:skip=CKV_AWS_355: The one statement on "*" is for the network interfaces of a function in a VPC, which accept no narrower resource.
  # checkov:skip=CKV_AWS_290: As above.
  name = "${var.prefix}-server"
  role = aws_iam_role.server.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "WriteItsOwnLog"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.server.arn}:*"
      },
      {
        Sid      = "ReadTheEdgeSecret"
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = var.origin_secret.arn
      },
      {
        Sid      = "SignInToTheDatabaseAsApp"
        Effect   = "Allow"
        Action   = "rds-db:connect"
        Resource = local.sign_in_resource.server
      },
      local.network_interface_statement,
    ]
  })
}

resource "aws_iam_role" "migrate" {
  name                 = "${var.prefix}-migrate-role"
  description          = "The database change runner of ${var.environment}"
  assume_role_policy   = local.lambda_trust
  permissions_boundary = var.permissions_boundary_arn
}

resource "aws_iam_role_policy" "migrate" {
  # checkov:skip=CKV_AWS_355: The one statement on "*" is for the network interfaces of a function in a VPC, which accept no narrower resource.
  # checkov:skip=CKV_AWS_290: As above.
  name = "${var.prefix}-migrate"
  role = aws_iam_role.migrate.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "WriteItsOwnLog"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.migrate.arn}:*"
      },
      {
        Sid      = "ReadTheMasterSignInForANewEnvironment"
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = var.database.master_secret_arn
      },
      {
        Sid      = "SignInToTheDatabaseAsMigrator"
        Effect   = "Allow"
        Action   = "rds-db:connect"
        Resource = local.sign_in_resource.migrate
      },
      local.network_interface_statement,
    ]
  })
}

# --- The bucket of Release packages ---

resource "aws_s3_bucket" "releases" {
  # checkov:skip=CKV_AWS_18: Access logging would need another bucket and adds cost; only the pipeline's identity writes here, and its runs are GitHub's record.
  # checkov:skip=CKV_AWS_144: One Region by decision (technology decisions T1); packages are rebuilt from the repository.
  # checkov:skip=CKV_AWS_145: Encrypted with the service's own keys; keys managed by the maintainer have a fixed monthly cost (security design S9).
  # checkov:skip=CKV_AWS_21: Packages are named by their Release's version and never overwritten, so versioning would keep nothing more.
  # checkov:skip=CKV2_AWS_62: Nothing reacts to a stored package; no notification is needed.
  # checkov:skip=CKV2_AWS_61: Old packages are removed by the pipeline, which keeps the ten most recent Releases and never the running or the previous one; an age-based rule could remove those.
  bucket = "${var.prefix}-releases-${local.account_id}"
}

resource "aws_s3_bucket_public_access_block" "releases" {
  bucket                  = aws_s3_bucket.releases.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "releases" {
  bucket = aws_s3_bucket.releases.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_policy" "releases" {
  bucket     = aws_s3_bucket.releases.id
  depends_on = [aws_s3_bucket_public_access_block.releases]
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "TlsOnly"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.releases.arn, "${aws_s3_bucket.releases.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

# --- The server function ---

resource "aws_lambda_function" "server" {
  # checkov:skip=CKV_AWS_116: The function is called synchronously by the HTTP API; a failed request is answered to the caller, so there is nothing to queue.
  # checkov:skip=CKV_AWS_173: Its environment variables hold no secrets, only names and addresses; they are encrypted by the service.
  # checkov:skip=CKV_AWS_272: Code signing would need a signing profile and a signing step; the package is built by the pipeline from the merged commit and stored in a bucket only the pipeline's identity can write.
  # checkov:skip=CKV_AWS_50: Tracing is off by design (observability design O8): the request identifier links the page, the entry point and the server.
  function_name = "${var.prefix}-server"
  description   = "The operations of Virtuoso Drive (${var.environment})"
  role          = aws_iam_role.server.arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "src/index.handler"
  memory_size   = 512
  timeout       = 8
  publish       = true

  filename = var.placeholder_package

  reserved_concurrent_executions = var.server_concurrency

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_ids.server]
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.server.name
  }

  # Non-secret settings only. Secret values are read from Secrets Manager.
  environment {
    variables = {
      VD_ENVIRONMENT    = var.environment
      DB_HOST           = var.database.address
      DB_PORT           = tostring(var.database.port)
      DB_NAME           = var.database.name
      DB_USER           = local.database_user.server
      ORIGIN_SECRET_ID  = var.origin_secret.name
      VD_FORCED_FAILURE = var.forced_failure ? "on" : "off"
    }
  }

  depends_on = [aws_iam_role_policy.server]

  lifecycle {
    # The pipeline's deploy steps replace the code; Terraform leaves it alone.
    ignore_changes = [filename, source_code_hash, s3_bucket, s3_key, s3_object_version]
  }
}

# The name the entry point calls. Only the pipeline moves it.
resource "aws_lambda_alias" "live" {
  name             = "live"
  description      = "The version of the server that is running. Moved only by the pipeline's deploy and go-back steps."
  function_name    = aws_lambda_function.server.function_name
  function_version = aws_lambda_function.server.version

  lifecycle {
    ignore_changes = [function_version, routing_config]
  }
}

# --- The database change runner ---

resource "aws_lambda_function" "migrate" {
  # checkov:skip=CKV_AWS_116: The pipeline calls the runner and waits for its answer; a failure fails the Deployment, so there is nothing to queue.
  # checkov:skip=CKV_AWS_173: Its environment variables hold no secrets, only names and addresses; they are encrypted by the service.
  # checkov:skip=CKV_AWS_272: As for the server function.
  # checkov:skip=CKV_AWS_50: Tracing is off by design (observability design O8).
  function_name = "${var.prefix}-db-migrate"
  description   = "Applies pending database changes (${var.environment}). Called only by the pipeline."
  role          = aws_iam_role.migrate.arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "src/index.handler"
  memory_size   = 512
  timeout       = 300

  filename = var.placeholder_package

  # Two runs never overlap.
  reserved_concurrent_executions = var.server_concurrency < 0 ? -1 : 1

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_ids.migrate]
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.migrate.name
  }

  # The rehearsal's switch is a setting only while it is on. Off, the
  # function's settings are exactly what they were before the switch existed,
  # so adding it changes nothing in production; the change runner reads a
  # missing setting as off.
  environment {
    variables = merge(
      {
        VD_ENVIRONMENT      = var.environment
        DB_HOST             = var.database.address
        DB_PORT             = tostring(var.database.port)
        DB_NAME             = var.database.name
        DB_MASTER_SECRET_ID = var.database.master_secret_name
      },
      var.failing_change ? { VD_FAILING_CHANGE = "on" } : {},
    )
  }

  depends_on = [aws_iam_role_policy.migrate]

  lifecycle {
    ignore_changes = [filename, source_code_hash, s3_bucket, s3_key, s3_object_version]
  }
}

# --- The HTTP API: the server's entry point ---

resource "aws_apigatewayv2_api" "this" {
  name          = "${var.prefix}-api"
  description   = "The entry point of the server (${var.environment}). Reached through the edge; useless without the origin secret."
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "server" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_alias.live.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 9000
}

# The two operations, and a catch-all so that the server answers notFound itself.
resource "aws_apigatewayv2_route" "this" {
  # checkov:skip=CKV_AWS_309: No authoriser in this Unit: its operations are public reads behind the access gate, and the server refuses any request without the edge's secret (security design S2). Sign-in arrives with Unit U2.
  for_each  = toset(["GET /v1/health", "GET /v1/site-information", "$default"])
  api_id    = aws_apigatewayv2_api.this.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.server.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = var.throttle.rate
    throttling_burst_limit = var.throttle.burst
  }

  # One line per request reaching the entry point, including those refused at
  # the request limit. No query strings, no headers.
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      time           = "$context.requestTime"
      entryRequestId = "$context.requestId"
      route          = "$context.routeKey"
      status         = "$context.status"
      latencyMs      = "$context.responseLatency"
    })
  }
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowTheHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.server.function_name
  qualifier     = aws_lambda_alias.live.name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

output "api_id" {
  value = aws_apigatewayv2_api.this.id
}

output "api_domain_name" {
  description = "The entry point's own address, used by the edge as an origin."
  value       = replace(aws_apigatewayv2_api.this.api_endpoint, "https://", "")
}

output "server_function_name" {
  value = aws_lambda_function.server.function_name
}

output "migrate_function_name" {
  value = aws_lambda_function.migrate.function_name
}

output "releases_bucket" {
  value = aws_s3_bucket.releases.bucket
}

output "database_hosts" {
  description = "The database address each function is given, so that a test can read it."
  value = {
    server  = aws_lambda_function.server.environment[0].variables.DB_HOST
    migrate = aws_lambda_function.migrate.environment[0].variables.DB_HOST
  }
}

output "migrate_settings" {
  description = "The names of the change runner's settings (its environment variables), and whether the rehearsal's switch is among them and on, so that a test can read them."
  value = {
    names          = sort(keys(aws_lambda_function.migrate.environment[0].variables))
    failing_change = lookup(aws_lambda_function.migrate.environment[0].variables, "VD_FAILING_CHANGE", null)
  }
}

output "role_policies" {
  description = "The text of each function's policy, so that a test can compare it with what it must be."
  value = {
    server  = aws_iam_role_policy.server.policy
    migrate = aws_iam_role_policy.migrate.policy
  }
}

output "database_sign_in" {
  description = "What each role's policy names for sign-in to the database by AWS identity, so that a test can read it: text for one database, a list for several."
  value       = local.sign_in_resource
}

output "log_group_names" {
  value = {
    server     = aws_cloudwatch_log_group.server.name
    migrate    = aws_cloudwatch_log_group.migrate.name
    api_access = aws_cloudwatch_log_group.api_access.name
  }
}

output "names" {
  value = [
    aws_iam_role.server.name,
    aws_iam_role.migrate.name,
    aws_lambda_function.server.function_name,
    aws_lambda_function.migrate.function_name,
    aws_apigatewayv2_api.this.name,
    aws_s3_bucket.releases.bucket,
  ]
}

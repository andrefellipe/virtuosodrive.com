# The private network of one environment: a VPC with two private subnets in
# two Availability Zones, no internet gateway, no NAT gateway and no public
# addresses; and one interface endpoint through which the functions reach
# Secrets Manager.

variable "prefix" {
  description = "The environment's name prefix: vd-test or vd-prod."
  type        = string
}

variable "cidr_block" {
  description = "The VPC's address range."
  type        = string
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "this" {
  # checkov:skip=CKV2_AWS_11: Flow logs would add log charges to a network that has no route to the internet; the server's and the entry point's own logs record every request.
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.prefix}-vpc" }
}

# The default security group is left with no rules, so nothing can use it by accident.
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  tags = { Name = "${var.prefix}-default-unused" }
}

resource "aws_subnet" "private" {
  count                   = 2
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr_block, 4, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false

  tags = { Name = "${var.prefix}-private-${count.index + 1}" }
}

# A route table with only the local route: no way out of the network.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id

  tags = { Name = "${var.prefix}-private" }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Security groups. Rules are separate resources so that groups can refer to each other.

resource "aws_security_group" "database" {
  name        = "${var.prefix}-db"
  description = "The database: accepts PostgreSQL only from the server and the change runner"
  vpc_id      = aws_vpc.this.id

  tags = { Name = "${var.prefix}-db" }
}

resource "aws_security_group" "server" {
  name        = "${var.prefix}-server"
  description = "The server function: no inbound; outbound only to the database and the secrets endpoint"
  vpc_id      = aws_vpc.this.id

  tags = { Name = "${var.prefix}-server" }
}

resource "aws_security_group" "migrate" {
  name        = "${var.prefix}-migrate"
  description = "The change runner: no inbound; outbound only to the database and the secrets endpoint"
  vpc_id      = aws_vpc.this.id

  tags = { Name = "${var.prefix}-migrate" }
}

resource "aws_security_group" "endpoint" {
  name        = "${var.prefix}-endpoint"
  description = "The secrets endpoint: accepts HTTPS only from the server and the change runner"
  vpc_id      = aws_vpc.this.id

  tags = { Name = "${var.prefix}-endpoint" }
}

locals {
  callers = {
    server  = aws_security_group.server.id
    migrate = aws_security_group.migrate.id
  }
}

resource "aws_vpc_security_group_ingress_rule" "database" {
  for_each                     = local.callers
  security_group_id            = aws_security_group.database.id
  description                  = "PostgreSQL from ${each.key}"
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "to_database" {
  for_each                     = local.callers
  security_group_id            = each.value
  description                  = "PostgreSQL to the database"
  referenced_security_group_id = aws_security_group.database.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "endpoint" {
  for_each                     = local.callers
  security_group_id            = aws_security_group.endpoint.id
  description                  = "HTTPS from ${each.key}"
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
}

resource "aws_vpc_security_group_egress_rule" "to_endpoint" {
  for_each                     = local.callers
  security_group_id            = each.value
  description                  = "HTTPS to the secrets endpoint"
  referenced_security_group_id = aws_security_group.endpoint.id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
}

# The private connection point to Secrets Manager, in one subnet.
resource "aws_vpc_endpoint" "secrets" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private[0].id]
  security_group_ids  = [aws_security_group.endpoint.id]
  private_dns_enabled = true

  # Only this environment's secrets can be read through it.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource  = "arn:aws:secretsmanager:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:secret:${var.prefix}-*"
    }]
  })

  tags = { Name = "${var.prefix}-secrets" }
}

output "vpc_id" {
  value = aws_vpc.this.id
}

output "subnet_ids" {
  value = aws_subnet.private[*].id
}

output "security_group_ids" {
  value = {
    database = aws_security_group.database.id
    server   = aws_security_group.server.id
    migrate  = aws_security_group.migrate.id
    endpoint = aws_security_group.endpoint.id
  }
}

output "names" {
  description = "The names this module gave, for the test that every name carries the environment's prefix."
  value = concat(
    [aws_vpc.this.tags.Name, aws_route_table.private.tags.Name, aws_vpc_endpoint.secrets.tags.Name],
    aws_subnet.private[*].tags.Name,
    [aws_security_group.database.name, aws_security_group.server.name, aws_security_group.migrate.name, aws_security_group.endpoint.name],
  )
}

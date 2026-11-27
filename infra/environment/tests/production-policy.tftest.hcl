# The switches added for the rehearsals (a restored copy, a failing change)
# must change nothing in production. This file holds the full text of the two
# functions' policies as production has them, and compares what the
# configuration now produces with it, to the character. It also shows that
# adding a copy in test does not replace the first database.
#
# Checked with a stand-in for AWS: no account is touched. The stand-in gives
# the resources the policies name made-up addresses, so that the policies'
# text is known while planning.

mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "000000000000"
    }
  }
  mock_data "aws_region" {
    defaults = {
      region = "us-east-1"
    }
  }
}

override_resource {
  target          = module.database.aws_db_instance.this
  override_during = plan
  values = {
    address     = "first.database.example.com"
    resource_id = "db-FIRSTDATABASE"
  }
}

override_resource {
  target          = module.database.aws_db_instance.restored
  override_during = plan
  values = {
    address     = "restored.database.example.com"
    resource_id = "db-RESTOREDCOPY"
    port        = 5432
  }
}

override_resource {
  target          = module.server.aws_cloudwatch_log_group.server
  override_during = plan
  values = {
    arn = "arn:aws:logs:us-east-1:000000000000:log-group:SERVER-LOG"
  }
}

override_resource {
  target          = module.server.aws_cloudwatch_log_group.migrate
  override_during = plan
  values = {
    arn = "arn:aws:logs:us-east-1:000000000000:log-group:MIGRATE-LOG"
  }
}

override_resource {
  target          = aws_secretsmanager_secret.origin
  override_during = plan
  values = {
    arn = "arn:aws:secretsmanager:us-east-1:000000000000:secret:ORIGIN-SECRET"
  }
}

override_resource {
  target          = module.database.aws_secretsmanager_secret.master
  override_during = plan
  values = {
    arn = "arn:aws:secretsmanager:us-east-1:000000000000:secret:MASTER-SECRET"
  }
}

variables {
  placeholder_package = "tests/fixtures/placeholder.zip"
  access_gate_file    = "tests/fixtures/access-gate.txt"
}

run "productions_policies_are_what_they_were" {
  command = plan

  variables {
    environment         = "production"
    site_name           = "virtuoso.andrefellipelabs.com"
    vpc_cidr_block      = "10.30.0.0/24"
    alarms              = true
    deletion_protection = true
    server_concurrency  = 20
    throttle            = { rate = 50, burst = 100 }
  }

  # Sign-in to the one database is named as text, not as a list of one.
  assert {
    condition     = module.server.database_sign_in.server == "arn:aws:rds-db:us-east-1:000000000000:dbuser:db-FIRSTDATABASE/app" && module.server.database_sign_in.migrate == "arn:aws:rds-db:us-east-1:000000000000:dbuser:db-FIRSTDATABASE/migrator"
    error_message = "In production each function may sign in to the first database only, and the policy names it as text."
  }

  assert {
    condition = module.server.role_policies.server == jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Sid      = "WriteItsOwnLog"
          Effect   = "Allow"
          Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
          Resource = "arn:aws:logs:us-east-1:000000000000:log-group:SERVER-LOG:*"
        },
        {
          Sid      = "ReadTheEdgeSecret"
          Effect   = "Allow"
          Action   = "secretsmanager:GetSecretValue"
          Resource = "arn:aws:secretsmanager:us-east-1:000000000000:secret:ORIGIN-SECRET"
        },
        {
          Sid      = "SignInToTheDatabaseAsApp"
          Effect   = "Allow"
          Action   = "rds-db:connect"
          Resource = "arn:aws:rds-db:us-east-1:000000000000:dbuser:db-FIRSTDATABASE/app"
        },
        {
          Sid    = "NetworkInterfacesOfAFunctionInAVpc"
          Effect = "Allow"
          Action = [
            "ec2:CreateNetworkInterface", "ec2:DescribeNetworkInterfaces", "ec2:DeleteNetworkInterface",
            "ec2:AssignPrivateIpAddresses", "ec2:UnassignPrivateIpAddresses", "ec2:DescribeSubnets",
          ]
          Resource = "*"
        },
      ]
    })
    error_message = "The text of the server's policy in production is not what it was before the rehearsals' switches existed."
  }

  assert {
    condition = module.server.role_policies.migrate == jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Sid      = "WriteItsOwnLog"
          Effect   = "Allow"
          Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
          Resource = "arn:aws:logs:us-east-1:000000000000:log-group:MIGRATE-LOG:*"
        },
        {
          Sid      = "ReadTheMasterSignInForANewEnvironment"
          Effect   = "Allow"
          Action   = "secretsmanager:GetSecretValue"
          Resource = "arn:aws:secretsmanager:us-east-1:000000000000:secret:MASTER-SECRET"
        },
        {
          Sid      = "SignInToTheDatabaseAsMigrator"
          Effect   = "Allow"
          Action   = "rds-db:connect"
          Resource = "arn:aws:rds-db:us-east-1:000000000000:dbuser:db-FIRSTDATABASE/migrator"
        },
        {
          Sid    = "NetworkInterfacesOfAFunctionInAVpc"
          Effect = "Allow"
          Action = [
            "ec2:CreateNetworkInterface", "ec2:DescribeNetworkInterfaces", "ec2:DeleteNetworkInterface",
            "ec2:AssignPrivateIpAddresses", "ec2:UnassignPrivateIpAddresses", "ec2:DescribeSubnets",
          ]
          Resource = "*"
        },
      ]
    })
    error_message = "The text of the change runner's policy in production is not what it was before the rehearsals' switches existed."
  }

  assert {
    condition     = module.database.restored_copy == null && module.server.database_hosts.server == "first.database.example.com" && module.server.database_hosts.migrate == "first.database.example.com"
    error_message = "Production has no copy, and both functions are given the first database's address."
  }
}

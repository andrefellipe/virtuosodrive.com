# Every resource that has a name is named for its environment. Checked from
# the plan alone, with a stand-in for AWS: no account is touched.

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

variables {
  placeholder_package = "tests/fixtures/placeholder.zip"
  access_gate_file    = "tests/fixtures/access-gate.txt"
}

run "test_names_carry_the_test_prefix" {
  command = plan

  variables {
    environment         = "test"
    site_name           = "test.virtuoso.andrefellipelabs.com"
    vpc_cidr_block      = "10.20.0.0/24"
    alarms              = true
    deletion_protection = false
    server_concurrency  = 5
    throttle            = { rate = 10, burst = 20 }
  }

  assert {
    condition     = length(output.resource_names) > 25
    error_message = "Fewer names than expected were collected; the check would prove little."
  }

  assert {
    condition     = alltrue([for name in output.resource_names : startswith(name, "vd-test")])
    error_message = "A resource of the test environment is not named vd-test...: ${join(", ", [for name in output.resource_names : name if !startswith(name, "vd-test")])}"
  }

  assert {
    condition     = alltrue([for name in output.log_group_names : startswith(name, "/vd/test/") || startswith(name, "/aws/cloudfront/function/vd-test-")])
    error_message = "A log group of the test environment is not named for it."
  }

  assert {
    condition     = output.prefix == "vd-test"
    error_message = "The test environment's prefix must be vd-test."
  }

  assert {
    condition     = join(",", module.network.subnet_availability_zones) == "us-east-1a,us-east-1b"
    error_message = "The two private subnets must be in us-east-1a and us-east-1b, in that order, and nowhere else."
  }

  assert {
    condition     = module.database.parameters["log_connections"] == "all"
    error_message = "The database's settings group must give log_connections the value all: PostgreSQL 18 takes a list of what to log, and AWS refuses 1."
  }

  assert {
    condition     = module.database.parameter_group_name_prefix == "vd-test-postgres18-"
    error_message = "The settings group's name must begin vd-test-postgres18- and end in a generated suffix, so that a replacement can be created before the old group is removed."
  }
}

run "production_names_carry_the_production_prefix" {
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

  assert {
    condition     = alltrue([for name in output.resource_names : startswith(name, "vd-prod")])
    error_message = "A resource of production is not named vd-prod...: ${join(", ", [for name in output.resource_names : name if !startswith(name, "vd-prod")])}"
  }

  assert {
    condition     = alltrue([for name in output.resource_names : !strcontains(name, "test")])
    error_message = "A resource of production carries the test environment's name."
  }

  assert {
    condition     = alltrue([for name in output.log_group_names : startswith(name, "/vd/prod/") || startswith(name, "/aws/cloudfront/function/vd-prod-")])
    error_message = "A log group of production is not named for it."
  }

  assert {
    condition     = module.database.parameter_group_name_prefix == "vd-prod-postgres18-"
    error_message = "The settings group's name in production must begin vd-prod-postgres18-."
  }
}

run "the_failing_operation_is_refused_in_production" {
  command = plan

  variables {
    environment         = "production"
    site_name           = "virtuoso.andrefellipelabs.com"
    vpc_cidr_block      = "10.30.0.0/24"
    alarms              = true
    forced_failure      = true
    deletion_protection = true
    server_concurrency  = 20
    throttle            = { rate = 50, burst = 100 }
  }

  expect_failures = [var.forced_failure]
}

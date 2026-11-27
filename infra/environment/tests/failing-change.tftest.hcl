# The switch for rehearsing a failing deployment (docs/operations.md,
# procedure 9): "failing_change" makes the change runner fail on purpose. Off
# by default, refused in production, and a setting of the change runner only
# while it is on. Checked from the plan alone, with a stand-in for AWS: no
# account is touched.

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
  environment         = "test"
  site_name           = "test.virtuoso.andrefellipelabs.com"
  vpc_cidr_block      = "10.20.0.0/24"
  alarms              = false
  deletion_protection = false
  server_concurrency  = 5
  throttle            = { rate = 10, burst = 20 }
  placeholder_package = "tests/fixtures/placeholder.zip"
  access_gate_file    = "tests/fixtures/access-gate.txt"
}

run "off_by_default_the_change_runner_is_given_no_such_setting" {
  command = plan

  assert {
    condition     = module.server.migrate_settings.failing_change == null
    error_message = "With the switch off, the change runner must not be given the setting at all."
  }

  # Exactly the settings the change runner had before the switch existed.
  assert {
    condition     = join(",", module.server.migrate_settings.names) == "DB_HOST,DB_MASTER_SECRET_ID,DB_NAME,DB_PORT,VD_ENVIRONMENT"
    error_message = "With the switch off, the change runner's settings must be the five it had before the switch existed."
  }
}

run "on_in_test_the_change_runner_is_told" {
  command = plan

  variables {
    failing_change = true
  }

  assert {
    condition     = module.server.migrate_settings.failing_change == "on"
    error_message = "With the switch on, the change runner must be given VD_FAILING_CHANGE with the value on."
  }

  assert {
    condition     = join(",", module.server.migrate_settings.names) == "DB_HOST,DB_MASTER_SECRET_ID,DB_NAME,DB_PORT,VD_ENVIRONMENT,VD_FAILING_CHANGE"
    error_message = "With the switch on, the change runner's settings must be its usual five and the switch, and nothing else."
  }
}

run "production_refuses_the_failing_change" {
  command = plan

  variables {
    environment         = "production"
    site_name           = "virtuoso.andrefellipelabs.com"
    vpc_cidr_block      = "10.30.0.0/24"
    alarms              = true
    deletion_protection = true
    server_concurrency  = 20
    throttle            = { rate = 50, burst = 100 }
    failing_change      = true
  }

  expect_failures = [var.failing_change]
}

run "production_as_it_is_has_no_such_setting" {
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
    condition     = join(",", module.server.migrate_settings.names) == "DB_HOST,DB_MASTER_SECRET_ID,DB_NAME,DB_PORT,VD_ENVIRONMENT"
    error_message = "Production's change runner must keep exactly the five settings it has: adding the switch must change nothing there."
  }
}

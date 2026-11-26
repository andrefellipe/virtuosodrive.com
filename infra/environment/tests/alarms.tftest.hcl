# The alarms and the health check exist only when the "alarms" variable is
# on. Checked from the plan alone, with a stand-in for AWS: no account is
# touched.

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
  deletion_protection = false
  server_concurrency  = 5
  throttle            = { rate = 10, burst = 20 }
  placeholder_package = "tests/fixtures/placeholder.zip"
  access_gate_file    = "tests/fixtures/access-gate.txt"
}

run "alarms_off_means_no_alarm_and_no_health_check" {
  command = plan

  variables {
    alarms = false
  }

  assert {
    condition     = length(output.alarm_names) == 0
    error_message = "With alarms off, no alarm may exist."
  }

  assert {
    condition     = output.health_check_count == 0
    error_message = "With alarms off, the health check may not exist (it has a monthly cost)."
  }
}

run "alarms_on_means_both_alarms_and_the_health_check" {
  command = plan

  variables {
    alarms = true
  }

  assert {
    condition     = toset(output.alarm_names) == toset(["vd-test-health", "vd-test-error-rate"])
    error_message = "With alarms on, exactly the health alarm and the error-rate alarm must exist."
  }

  assert {
    condition     = output.health_check_count == 1
    error_message = "With alarms on, the health check must exist."
  }

  assert {
    condition     = module.monitoring.names != null && alltrue([for name in output.alarm_names : startswith(name, "vd-test-")])
    error_message = "The alarms must be named for their environment."
  }
}

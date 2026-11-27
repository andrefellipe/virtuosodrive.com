# The two switches for restoring the database (docs/operations.md, procedure
# 4): "restored_copy_time" makes a copy beside the first database, and
# "use_restored_copy" points the server and the change runner at it. Both are
# off by default and refused in production. Checked from the plan alone, with
# a stand-in for AWS: no account is touched.

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

# AWS gives a database its address and its identifier for sign-in only when
# it exists. The stand-in gives each database made-up ones while planning, so
# that the runs below can tell the two apart.
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

run "both_switches_off_changes_nothing" {
  command = plan

  assert {
    condition     = module.database.restored_copy == null
    error_message = "With no moment to restore to, no copy may exist."
  }

  assert {
    condition     = module.server.database_hosts.server == "first.database.example.com" && module.server.database_hosts.migrate == "first.database.example.com"
    error_message = "With both switches off, the server and the change runner must be given the first database's address."
  }

  # Text, not a list: the policy of an environment without a copy is the
  # same, to the character, as before the switches existed.
  assert {
    condition     = module.server.database_sign_in.server == "arn:aws:rds-db:us-east-1:000000000000:dbuser:db-FIRSTDATABASE/app"
    error_message = "With no copy, the server may sign in to the first database only, as the user app, and the policy names it as text."
  }

  assert {
    condition     = module.server.database_sign_in.migrate == "arn:aws:rds-db:us-east-1:000000000000:dbuser:db-FIRSTDATABASE/migrator"
    error_message = "With no copy, the change runner may sign in to the first database only, as the user migrator, and the policy names it as text."
  }

  assert {
    condition     = !contains(output.resource_names, "vd-test-db-restored")
    error_message = "With no moment to restore to, nothing may be named for a copy."
  }
}

run "a_moment_makes_the_copy_and_points_nothing_at_it" {
  command = plan

  variables {
    restored_copy_time = "2026-11-27T03:00:00Z"
  }

  assert {
    condition     = module.database.restored_copy.identifier == "vd-test-db-restored"
    error_message = "The copy must be named vd-test-db-restored: under the environment's prefix, and not the first database's name."
  }

  assert {
    condition     = module.database.restored_copy.source_db_instance_identifier == "vd-test-db" && module.database.identifier == "vd-test-db"
    error_message = "The copy must be restored from the environment's first database."
  }

  assert {
    condition     = module.database.restored_copy.restore_time == "2026-11-27T03:00:00Z"
    error_message = "The copy must be restored to the moment given."
  }

  assert {
    condition     = module.database.restored_copy.storage_encrypted && module.database.restored_copy.iam_database_authentication_enabled && !module.database.restored_copy.publicly_accessible
    error_message = "The copy must be encrypted, private, and signed in to by AWS identity, as the first database is."
  }

  assert {
    condition     = !module.database.restored_copy.deletion_protection && module.database.restored_copy.skip_final_snapshot
    error_message = "The copy must be removable in one step: no deletion protection and no final snapshot."
  }

  # The pipeline's test job is stopped by GitHub after 60 minutes; the wait
  # for the restore must end by itself before that, with room left for
  # the rest of the deployment when a restore succeeds at the last moment.
  assert {
    condition     = module.database.restored_copy.create_timeout == "40m" && module.database.restored_copy.delete_timeout == "30m"
    error_message = "Terraform must give up waiting for the restore after 40 minutes and for the removal after 30, so that a slow one fails inside the job's 60 minutes with Terraform's record intact, and a healthy one (34 minutes when measured) is not cut short."
  }

  assert {
    condition     = module.server.database_hosts.server == "first.database.example.com" && module.server.database_hosts.migrate == "first.database.example.com"
    error_message = "Making the copy must not point anything at it: the server and the change runner stay on the first database."
  }

  # Granted one run before anything is pointed at the copy.
  assert {
    condition = module.server.database_sign_in.server == [
      "arn:aws:rds-db:us-east-1:000000000000:dbuser:db-FIRSTDATABASE/app",
      "arn:aws:rds-db:us-east-1:000000000000:dbuser:db-RESTOREDCOPY/app",
    ]
    error_message = "While the copy exists, the server must be allowed to sign in to both databases as the user app, and to nothing else."
  }

  assert {
    condition = module.server.database_sign_in.migrate == [
      "arn:aws:rds-db:us-east-1:000000000000:dbuser:db-FIRSTDATABASE/migrator",
      "arn:aws:rds-db:us-east-1:000000000000:dbuser:db-RESTOREDCOPY/migrator",
    ]
    error_message = "While the copy exists, the change runner must be allowed to sign in to both databases as the user migrator, and to nothing else."
  }

  assert {
    condition     = contains(output.resource_names, "vd-test-db-restored") && alltrue([for name in output.resource_names : startswith(name, "vd-test")])
    error_message = "The copy's name must be among the environment's names, and every name must still carry the environment's prefix."
  }
}

run "both_switches_on_points_the_server_and_the_change_runner_at_the_copy" {
  command = plan

  variables {
    restored_copy_time = "2026-11-27T03:00:00Z"
    use_restored_copy  = true
  }

  assert {
    condition     = module.server.database_hosts.server == "restored.database.example.com"
    error_message = "With use_restored_copy on, the server must be given the copy's address."
  }

  assert {
    condition     = module.server.database_hosts.migrate == "restored.database.example.com"
    error_message = "With use_restored_copy on, the change runner must be given the copy's address."
  }

  assert {
    condition     = module.database.original_address == "first.database.example.com" && module.database.identifier == "vd-test-db"
    error_message = "The first database must still be there, under its own name, while the copy is in use."
  }

  assert {
    condition     = length(module.server.database_sign_in.server) == 2 && length(module.server.database_sign_in.migrate) == 2
    error_message = "While the copy is in use, both functions must still be allowed to sign in to both databases, so that switching back needs no new permission."
  }
}

run "production_refuses_a_copy" {
  command = plan

  variables {
    environment         = "production"
    site_name           = "virtuoso.andrefellipelabs.com"
    vpc_cidr_block      = "10.30.0.0/24"
    alarms              = true
    deletion_protection = true
    server_concurrency  = 20
    throttle            = { rate = 50, burst = 100 }
    restored_copy_time  = "2026-11-27T03:00:00Z"
  }

  expect_failures = [var.restored_copy_time]
}

# With a moment set as well, production stops at the moment (the run above)
# and Terraform does not go on to judge this switch, so this run leaves the
# moment out. The switch is then refused on both of its conditions at once,
# and this run cannot tell which: it shows that production cannot be pointed
# at a copy, not that the condition naming production is the one that
# refused. No setting of production reaches that condition alone.
run "production_refuses_to_use_a_copy" {
  command = plan

  variables {
    environment         = "production"
    site_name           = "virtuoso.andrefellipelabs.com"
    vpc_cidr_block      = "10.30.0.0/24"
    alarms              = true
    deletion_protection = true
    server_concurrency  = 20
    throttle            = { rate = 50, burst = 100 }
    use_restored_copy   = true
  }

  expect_failures = [var.use_restored_copy]
}

run "using_a_copy_that_does_not_exist_is_refused" {
  command = plan

  variables {
    use_restored_copy = true
  }

  expect_failures = [var.use_restored_copy]
}

run "a_moment_not_written_in_utc_is_refused" {
  command = plan

  variables {
    restored_copy_time = "2026-11-27 03:00"
  }

  expect_failures = [var.restored_copy_time]
}

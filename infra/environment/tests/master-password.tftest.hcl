# The database's master password is the one in the stored secret, whichever
# run creates which. In the test environment the secret was written by one
# run of the pipeline and the database created by the next, and the source
# that generates the password gave each run a different value.
#
# These runs apply the database module by itself with a stand-in for AWS: no
# account is touched, and every password below is a placeholder.

mock_provider "aws" {}

variables {
  prefix              = "vd-test"
  subnet_ids          = ["subnet-00000000000000001", "subnet-00000000000000002"]
  security_group_id   = "sg-00000000000000001"
  deletion_protection = false
}

run "a_first_run_writes_only_the_secret" {
  command = apply

  module {
    source = "../modules/database"
  }

  # Only the secret is created, as when the pipeline's first run stopped
  # before it reached the database.
  plan_options {
    target = [aws_secretsmanager_secret_version.master]
  }

  override_data {
    target = data.aws_secretsmanager_random_password.master
    values = {
      random_password = "placeholder-generated-in-the-first-run"
    }
  }

  assert {
    condition     = nonsensitive(jsondecode(aws_secretsmanager_secret_version.master.secret_string).password) == "placeholder-generated-in-the-first-run"
    error_message = "The secret must hold the password generated when it was first written."
  }
}

run "a_later_run_creates_the_database_with_the_secrets_password" {
  command = apply

  module {
    source = "../modules/database"
  }

  override_data {
    target = data.aws_secretsmanager_random_password.master
    values = {
      random_password = "placeholder-generated-in-the-second-run"
    }
  }

  assert {
    condition     = nonsensitive(jsondecode(aws_secretsmanager_secret_version.master.secret_string).password) == "placeholder-generated-in-the-first-run"
    error_message = "The secret must keep its first password when a later run generates another."
  }

  assert {
    condition     = nonsensitive(aws_db_instance.this.password) == nonsensitive(jsondecode(aws_secretsmanager_secret_version.master.secret_string).password)
    error_message = "The database's master password must be the one in the stored secret, not the one generated in the run that created the database."
  }
}

run "a_third_run_changes_neither" {
  command = apply

  module {
    source = "../modules/database"
  }

  override_data {
    target = data.aws_secretsmanager_random_password.master
    values = {
      random_password = "placeholder-generated-in-the-third-run"
    }
  }

  assert {
    condition     = nonsensitive(aws_db_instance.this.password) == "placeholder-generated-in-the-first-run"
    error_message = "The database's master password must stay the one in the stored secret."
  }

  assert {
    condition     = nonsensitive(jsondecode(aws_secretsmanager_secret_version.master.secret_string).password) == "placeholder-generated-in-the-first-run"
    error_message = "The secret must keep its first password."
  }
}

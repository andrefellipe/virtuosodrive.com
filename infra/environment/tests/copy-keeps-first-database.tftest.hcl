# Making a restored copy, and removing it, must leave the first database in
# place. These runs apply the database module by itself, one after another,
# with a stand-in for AWS: no account is touched.
#
# What this shows: the first database is the same one after each run. Had a
# run tried to replace it, Terraform would have refused the run, because the
# first database is protected against removal, and the identifier the
# stand-in gave it would differ. What it cannot show: that the first database
# has no change in place. Terraform's tests cannot read which resources a
# plan would change. That part rests on reading the module: nothing in the
# first database's definition refers to the copy or to its two switches.

mock_provider "aws" {}

variables {
  prefix              = "vd-test"
  subnet_ids          = ["subnet-00000000000000001", "subnet-00000000000000002"]
  security_group_id   = "sg-00000000000000001"
  deletion_protection = false
}

run "the_first_database_alone" {
  command = apply

  module {
    source = "../modules/database"
  }

  assert {
    condition     = aws_db_instance.this.identifier == "vd-test-db" && output.restored_copy == null
    error_message = "With no moment to restore to, only the first database exists."
  }
}

run "a_copy_is_added_beside_it" {
  command = apply

  module {
    source = "../modules/database"
  }

  variables {
    restored_copy_time = "2026-11-27T03:00:00Z"
  }

  assert {
    condition     = aws_db_instance.this.id == run.the_first_database_alone.first_database_id
    error_message = "Adding the copy must not replace the first database."
  }

  assert {
    condition     = output.restored_copy.identifier == "vd-test-db-restored" && output.address == aws_db_instance.this.address
    error_message = "The copy exists beside the first database, and the address given out is still the first database's."
  }
}

run "the_copy_is_removed_again" {
  command = apply

  module {
    source = "../modules/database"
  }

  assert {
    condition     = aws_db_instance.this.id == run.the_first_database_alone.first_database_id && output.restored_copy == null
    error_message = "Removing the copy must leave the first database in place, and no copy."
  }
}

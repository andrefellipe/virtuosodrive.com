# The test environment. No secrets here.
environment    = "test"
site_name      = "test.virtuoso.andrefellipelabs.com"
vpc_cidr_block = "10.20.0.0/24"

# Alarms and the health check exist in test only while an alarm is being
# proved: one pull request turns these two on, a second turns them off.
#
# 2026-11-27: both were on for the rehearsal of the alarms, and are off again
# (docs/records/alarm-proofs.md).
alarms         = false
forced_failure = false
# 2026-11-27: was on for the rehearsal of a failing deployment, and is off
# again (docs/records/failing-deployment.md).
failing_change = false

deletion_protection = false

# 2026-11-27: the rehearsal of restoring the database (docs/operations.md,
# procedure 4), second attempt. A copy of the test database as it was at this
# moment exists beside the first while this line is here.
restored_copy_time = "2026-11-27T19:30:00Z"

# 2026-11-27: the same rehearsal, steps 4 to 8. While this is true, the server
# and the change runner in test use the copy, not the first database.
use_restored_copy = true

# Replaced on 2026-11-26: the first password page wrote what was typed into the address, and so into one browser's history.
access_password_version = 2

# Lower than production: test shares the account's budget and has only the
# maintainer and the pipeline as callers (scalability design C2).
server_concurrency = 5
throttle = {
  rate  = 10
  burst = 20
}

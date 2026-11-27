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

# Replaced on 2026-11-26: the first password page wrote what was typed into the address, and so into one browser's history.
access_password_version = 2

# Lower than production: test shares the account's budget and has only the
# maintainer and the pipeline as callers (scalability design C2).
server_concurrency = 5
throttle = {
  rate  = 10
  burst = 20
}

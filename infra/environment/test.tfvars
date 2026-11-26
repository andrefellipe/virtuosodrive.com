# The test environment. No secrets here.
environment    = "test"
site_name      = "test.virtuoso.andrefellipelabs.com"
vpc_cidr_block = "10.20.0.0/24"

# Alarms and the health check exist in test only while an alarm is being
# proved: one pull request turns these two on, a second turns them off.
alarms         = false
forced_failure = false

deletion_protection = false

# Lower than production: test shares the account's budget and has only the
# maintainer and the pipeline as callers (scalability design C2).
server_concurrency = 5
throttle = {
  rate  = 10
  burst = 20
}

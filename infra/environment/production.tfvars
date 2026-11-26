# Production. No secrets here.
environment    = "production"
site_name      = "virtuoso.andrefellipelabs.com"
vpc_cidr_block = "10.30.0.0/24"

alarms = true

deletion_protection = true

server_concurrency = 20
throttle = {
  rate  = 50
  burst = 100
}

variable "environment" {
  description = "test or production."
  type        = string

  validation {
    condition     = contains(["test", "production"], var.environment)
    error_message = "The environment is test or production."
  }
}

variable "region" {
  description = "The one Region everything is built in."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "The value of the tag \"project\". The budget counts only resources carrying it."
  type        = string
  default     = "virtuoso-drive"
}

variable "unit" {
  description = "The value of the tag \"unit\": the Unit that added the resources."
  type        = string
  default     = "u1-thin-slice"
}

variable "site_name" {
  description = "The environment's public name."
  type        = string
}

variable "hosted_zone_name" {
  description = "The existing Route 53 zone the name lives in. Not created or deleted here."
  type        = string
  default     = "andrefellipelabs.com"
}

variable "manage_dns" {
  description = "Whether the zone is in this AWS account, so that Terraform adds the records."
  type        = bool
  default     = true
}

variable "vpc_cidr_block" {
  description = "The private network's address range."
  type        = string
}

variable "alarms" {
  description = "Whether the error-rate alarm, the health alarm and the health check exist. On in production; on in test only while an alarm is being proved."
  type        = bool
}

variable "forced_failure" {
  description = "Enables the operation that fails on purpose, to prove the error-rate alarm. Test only."
  type        = bool
  default     = false

  validation {
    condition     = !(var.forced_failure && var.environment == "production")
    error_message = "The deliberately failing operation is never enabled in production."
  }
}

variable "access_gate_enabled" {
  description = "The access gate's on/off flag. Production's is switched off at the switch (Unit U9)."
  type        = bool
  default     = true
}

variable "access_password_version" {
  description = "Change this marker to replace the access password: a new one is generated and every device is asked again."
  type        = number
  default     = 1
}

variable "origin_secret_version" {
  description = "Change this marker to replace the secret the edge adds for the server."
  type        = number
  default     = 1
}

variable "deletion_protection" {
  description = "Protection of the database against deletion. On in production."
  type        = bool
}

variable "server_concurrency" {
  description = "The most copies of the server running at once. Set to -1 to leave the cap off, if the account's limit does not yet allow reserving."
  type        = number
}

variable "throttle" {
  description = "Requests a second to the server, sustained and burst."
  type        = object({ rate = number, burst = number })
}

variable "alarm_topic_name" {
  description = "The notification topic the setup made."
  type        = string
  default     = "vd-alarms"
}

variable "placeholder_package" {
  description = "The zip file holding the placeholder code new functions are created with (built by the pipeline)."
  type        = string
  default     = "../../dist/placeholder.zip"
}

variable "access_gate_file" {
  description = "The built access gate (built by the pipeline)."
  type        = string
  default     = "../../dist/edge/access-gate.js"
}

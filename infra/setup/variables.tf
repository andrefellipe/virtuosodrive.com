variable "region" {
  description = "The one Region everything is built in."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "The value of the tag \"project\" on every resource. The budget counts only resources carrying it."
  type        = string
  default     = "virtuoso-drive"
}

variable "github_repository" {
  description = "The GitHub repository whose workflows may take the pipeline identities, as owner/name."
  type        = string
  default     = "andrefellipe/virtuosodrive.com"
}

variable "integration_branch" {
  description = "The branch whose workflows may take the test identity."
  type        = string
  default     = "aws-migration"
}

variable "monthly_ceiling_usd" {
  description = "The monthly cost ceiling. Emails go out at 80% and 100% of it, and when the forecast passes it."
  type        = number
  default     = 60
}

variable "hosted_zone_name" {
  description = "The existing Route 53 zone the site's names live in. Not created or deleted by this work."
  type        = string
  default     = "andrefellipelabs.com"
}

variable "site_names" {
  description = "The name each environment may manage records for."
  type        = map(string)
  default = {
    test       = "test.virtuoso.andrefellipelabs.com"
    production = "virtuoso.andrefellipelabs.com"
  }
}

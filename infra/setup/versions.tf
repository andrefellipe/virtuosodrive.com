# The one-time setup: what must exist in the account before the pipeline can
# build anything. Run once by the maintainer with their own sign-in, through
# setup.sh in this folder. Run again, it changes nothing.
#
# Its state starts on the maintainer's machine and is moved into the state
# bucket as the setup's last act; setup.sh then writes backend.tf here.

terraform {
  required_version = "1.17.1"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.74.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project     = var.project
      environment = "account"
      unit        = "u1-thin-slice"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id   = data.aws_caller_identity.current.account_id
  state_bucket = "vd-terraform-state-${local.account_id}"
  environments = {
    test = {
      prefix = "vd-test"
      other  = "vd-prod"
      # A workflow of this repository running on the integration branch.
      subject = "repo:${var.github_repository}:ref:refs/heads/${var.integration_branch}"
    }
    production = {
      prefix = "vd-prod"
      other  = "vd-test"
      # A job of this repository running in the GitHub environment "production",
      # which starts only after the maintainer approves.
      subject = "repo:${var.github_repository}:environment:production"
    }
  }
}

# One environment of Virtuoso Drive. Applied twice by the pipeline, with
# test.tfvars and with production.tfvars; the two environments are identical
# in shape. State is in the bucket the setup made, one key per environment;
# the pipeline passes the bucket and the key when it initialises.

terraform {
  required_version = "1.17.1"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.74.0"
    }
  }

  backend "s3" {}
}

provider "aws" {
  region = var.region

  # Every resource carries these three tags. "environment" is also what
  # confines each pipeline identity to its own environment where a resource
  # has no name of its own.
  default_tags {
    tags = {
      project     = var.project
      environment = var.environment
      unit        = var.unit
    }
  }
}

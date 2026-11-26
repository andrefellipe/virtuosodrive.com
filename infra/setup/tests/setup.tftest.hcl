# The one-time setup, checked from the plan alone with a stand-in for AWS:
# no account is touched.

mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "000000000000"
    }
  }

  # Identifiers of the right shape, for the run that applies against the
  # stand-in.
  mock_resource "aws_sns_topic" {
    defaults = {
      arn = "arn:aws:sns:us-east-1:000000000000:vd-alarms"
    }
  }
  mock_resource "aws_iam_policy" {
    defaults = {
      arn = "arn:aws:iam::000000000000:policy/vd-example-boundary"
    }
  }
  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::000000000000:role/vd-example-deploy"
    }
  }
  mock_resource "aws_iam_openid_connect_provider" {
    defaults = {
      arn = "arn:aws:iam::000000000000:oidc-provider/token.actions.githubusercontent.com"
    }
  }
  mock_resource "aws_s3_bucket" {
    defaults = {
      arn = "arn:aws:s3:::vd-terraform-state-000000000000"
    }
  }
}

run "the_budget_counts_by_the_project_tag" {
  command = plan

  assert {
    condition     = output.budget_tag_filter == join("", ["user:project", "$", "virtuoso-drive"])
    error_message = "The budget's tag filter must be the tag key, a dollar sign and the tag value, with nothing left unfilled."
  }

  assert {
    condition     = !strcontains(output.budget_tag_filter, "{")
    error_message = "The budget's tag filter still holds an unfilled variable."
  }

  assert {
    condition     = one(aws_budgets_budget.monthly.cost_filter).values == tolist([output.budget_tag_filter])
    error_message = "The budget must use the checked tag filter."
  }
}

run "the_outer_limits_do_not_refuse_the_alarm_topic" {
  command = plan

  # The alarm topic is tagged for the account. A limit that denied that tag
  # would refuse the pipeline's own failure notice.
  assert {
    condition = alltrue([
      for name, document in local.boundary_documents :
      [
        for statement in jsondecode(document).Statement : statement.Condition.StringEquals["aws:ResourceTag/environment"]
        if statement.Sid == "OtherEnvironmentByTag"
      ] == [name == "test" ? "production" : "test"]
    ])
    error_message = "Each outer limit must deny by tag exactly the other environment, and not what is tagged for the account."
  }

  assert {
    condition     = alltrue([for document in values(local.boundary_documents) : length(document) <= 6144])
    error_message = "An outer limit is longer than IAM accepts for one policy."
  }
}

run "the_topic_accepts_budgets_before_the_identities_exist" {
  # Applied against the stand-in, because the policy's text is known only
  # once the topic has an identifier. Nothing is created anywhere.
  command = apply

  assert {
    condition     = !strcontains(aws_sns_topic_policy.alarms.policy, "-deploy")
    error_message = "The topic's policy must not name the pipeline's identities, which are made after the budget."
  }

  assert {
    condition     = strcontains(aws_sns_topic_policy.alarms.policy, "budgets.amazonaws.com")
    error_message = "The topic's policy must let AWS Budgets publish."
  }
}

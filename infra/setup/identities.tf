# Order 3 to 5: what lets the pipeline sign in without long-lived keys.
#
# Two identities, one per environment. Each can be taken only by this
# repository's workflows (test: on the integration branch; production: in the
# GitHub environment "production", after the maintainer's approval), for one
# hour at most. Each has an outer limit (a permissions boundary) that it
# cannot widen: its own environment's resources only, nothing of the other
# environment, and nothing the setup made (security design S3).

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

locals {
  arn      = "arn:aws"
  iam      = "arn:aws:iam::${local.account_id}"
  boundary = { for name, env in local.environments : name => "${local.iam}:policy/${env.prefix}-boundary" }

  # The actions on its own roles that the pipeline needs to create the
  # server's and the change runner's identities.
  role_actions = [
    "iam:AttachRolePolicy", "iam:CreateRole", "iam:DeleteRole", "iam:DeleteRolePolicy",
    "iam:DetachRolePolicy", "iam:GetRole", "iam:GetRolePolicy", "iam:ListAttachedRolePolicies",
    "iam:ListInstanceProfilesForRole", "iam:ListRolePolicies", "iam:PassRole",
    "iam:PutRolePermissionsBoundary", "iam:PutRolePolicy", "iam:TagRole", "iam:UntagRole",
    "iam:UpdateAssumeRolePolicy", "iam:UpdateRole",
  ]

  boundary_documents = {
    for name, env in local.environments : name => jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Sid    = "Services"
          Effect = "Allow"
          Action = [
            "acm:*", "apigateway:*", "cloudfront:*", "cloudwatch:*", "lambda:*", "logs:*", "rds:*",
            "rds-db:connect", "route53:*", "s3:*", "secretsmanager:*", "ssm:*", "sns:Publish",
            "sns:GetTopicAttributes", "sns:ListTagsForResource", "sts:GetCallerIdentity",
            "ec2:Describe*", "ec2:*Vpc*", "ec2:*Subnet*", "ec2:*SecurityGroup*", "ec2:*RouteTable*",
            "ec2:*NetworkInterface*", "ec2:*NetworkAcl*", "ec2:*Tags", "ec2:*PrefixList*",
            "ec2:*PrivateIpAddresses",
            "iam:ListPolicies", "iam:GetPolicy", "iam:GetPolicyVersion",
          ]
          Resource = "*"
        },
        {
          Sid      = "OwnRoles"
          Effect   = "Allow"
          Action   = local.role_actions
          Resource = "${local.iam}:role/${env.prefix}-*"
        },
        {
          Sid       = "ServiceLinkedRoles"
          Effect    = "Allow"
          Action    = "iam:CreateServiceLinkedRole"
          Resource  = "${local.iam}:role/aws-service-role/*"
          Condition = { StringLike = { "iam:AWSServiceName" = ["rds.amazonaws.com", "ops.apigateway.amazonaws.com"] } }
        },
        {
          Sid    = "OtherEnvironmentByName"
          Effect = "Deny"
          Action = "*"
          Resource = [
            "${local.iam}:role/${env.other}-*",
            "${local.iam}:policy/${env.other}-*",
            "arn:aws:lambda:*:*:function:${env.other}-*",
            "arn:aws:s3:::${env.other}-*",
            "arn:aws:logs:*:*:log-group:/${replace(env.other, "-", "/")}/*",
            "arn:aws:logs:*:*:log-group:/aws/*/${env.other}-*",
            "arn:aws:secretsmanager:*:*:secret:${env.other}-*",
            "arn:aws:ssm:*:*:parameter/${env.other}-*",
            "arn:aws:rds:*:*:*:${env.other}-*",
            "arn:aws:cloudwatch:*:*:alarm:${env.other}-*",
            "arn:aws:cloudwatch::*:dashboard/${env.other}",
          ]
        },
        {
          # Only the other environment's tag is denied here. What the setup
          # made is tagged "account" and is protected by name below and by
          # the short list of allowed actions above: denying that tag too
          # would refuse the pipeline's own failure notice to the alarm topic.
          Sid       = "OtherEnvironmentByTag"
          Effect    = "Deny"
          Action    = "*"
          Resource  = "*"
          Condition = { StringEquals = { "aws:ResourceTag/environment" = name == "test" ? "production" : "test" } }
        },
        {
          Sid       = "NothingCreatedForAnotherEnvironment"
          Effect    = "Deny"
          Action    = "*"
          Resource  = "*"
          Condition = { StringEquals = { "aws:RequestTag/environment" = [name == "test" ? "production" : "test", "account"] } }
        },
        {
          Sid    = "WhatTheSetupMade"
          Effect = "Deny"
          Action = "*"
          Resource = [
            "${local.iam}:role/vd-*-deploy",
            "${local.iam}:policy/vd-*-boundary",
            "${local.iam}:oidc-provider/*",
            "arn:aws:s3:::${local.state_bucket}/setup/*",
            "arn:aws:s3:::${local.state_bucket}/${name == "test" ? "production" : "test"}/*",
          ]
        },
        {
          Sid       = "StateBucketSettings"
          Effect    = "Deny"
          NotAction = ["s3:ListBucket", "s3:GetBucketLocation", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
          Resource  = ["arn:aws:s3:::${local.state_bucket}", "arn:aws:s3:::${local.state_bucket}/*"]
        },
        {
          Sid       = "RolesMustCarryThisLimit"
          Effect    = "Deny"
          Action    = ["iam:CreateRole", "iam:PutRolePermissionsBoundary", "iam:PutRolePolicy", "iam:AttachRolePolicy"]
          Resource  = "*"
          Condition = { StringNotEquals = { "iam:PermissionsBoundary" = local.boundary[name] } }
        },
        {
          Sid      = "LimitNeverRemoved"
          Effect   = "Deny"
          Action   = "iam:DeleteRolePermissionsBoundary"
          Resource = "*"
        },
        {
          Sid    = "LogEntriesAreNotRead"
          Effect = "Deny"
          Action = [
            "logs:GetLogEvents", "logs:FilterLogEvents", "logs:StartQuery", "logs:GetQueryResults",
            "logs:StartLiveTail", "logs:GetLogRecord", "logs:Unmask",
          ]
          Resource = "*"
        },
        {
          Sid       = "OnlyOwnNamesInTheZone"
          Effect    = "Deny"
          Action    = "route53:ChangeResourceRecordSets"
          Resource  = "*"
          Condition = { "ForAnyValue:StringNotLike" = { "route53:ChangeResourceRecordSetsNormalizedRecordNames" = [var.site_names[name], "_*.${var.site_names[name]}"] } }
        },
        {
          Sid      = "TheZoneItselfIsNotTouched"
          Effect   = "Deny"
          Action   = ["route53:CreateHostedZone", "route53:DeleteHostedZone", "route53:UpdateHostedZoneComment", "route53domains:*"]
          Resource = "*"
        },
      ]
    })
  }
}

# Order 4: the two outer limits.
resource "aws_iam_policy" "boundary" {
  # checkov:skip=CKV_AWS_355: The limit names services, not resources, because several kinds of resource an environment needs have no name of their own; the other environment and everything the setup made are then denied by name and by tag (infrastructure specification, "How each identity is confined").
  # checkov:skip=CKV_AWS_290: As above: write access is confined by the Deny statements, which win over any Allow.
  # checkov:skip=CKV_AWS_289: As above; roles the pipeline creates must carry this same limit, so it cannot make itself a stronger identity.
  # checkov:skip=CKV_AWS_288: As above; reading log entries is denied, and secrets of the other environment are denied by name.
  # checkov:skip=CKV_AWS_287: As above.
  # checkov:skip=CKV_AWS_286: Privilege escalation is closed by "RolesMustCarryThisLimit", "LimitNeverRemoved" and by PassRole being allowed only on the environment's own roles.
  # checkov:skip=CKV2_AWS_40: The limit is not full IAM access: role actions only, on the environment's own roles only.
  for_each    = local.environments
  name        = "${each.value.prefix}-boundary"
  description = "The outer limit of the ${each.key} environment's pipeline identity and of every role it creates."
  policy      = local.boundary_documents[each.key]

  lifecycle {
    precondition {
      condition     = length(local.boundary_documents[each.key]) <= 6144
      error_message = "The ${each.key} limit is longer than IAM accepts for one policy (6,144 characters)."
    }
  }
}

# Order 5: the two identities.
resource "aws_iam_role" "deploy" {
  for_each             = local.environments
  name                 = "${each.value.prefix}-deploy"
  description          = "Taken by this repository's pipeline to build and deploy the ${each.key} environment."
  max_session_duration = 3600
  permissions_boundary = aws_iam_policy.boundary[each.key].arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = each.value.subject
        }
      }
    }]
  })
}

# The identity is allowed exactly what its limit allows: the limit is the policy.
resource "aws_iam_role_policy_attachment" "deploy" {
  for_each   = local.environments
  role       = aws_iam_role.deploy[each.key].name
  policy_arn = aws_iam_policy.boundary[each.key].arn
}

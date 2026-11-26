# Order 6: the bucket that holds Terraform's state, one key per configuration:
# setup/, test/ and production/. Values Terraform generates (the access
# password, the edge's secret, the database's master password) are recorded in
# its state, so the state is protected as a secret (security design S4).

resource "aws_s3_bucket" "state" {
  # checkov:skip=CKV_AWS_18: Access logging would need a second bucket and adds cost; who read or wrote the state is in the pipeline's own record and in CloudTrail's event history.
  # checkov:skip=CKV_AWS_144: One Region by decision (technology decisions T1); earlier versions are kept 90 days instead.
  # checkov:skip=CKV_AWS_145: Encrypted with the service's own keys; keys managed by the maintainer have a fixed monthly cost (security design S9).
  # checkov:skip=CKV2_AWS_62: Nothing reacts to changes of the state; no notification is needed.
  bucket = local.state_bucket

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket     = aws_s3_bucket.state.id
  depends_on = [aws_s3_bucket_versioning.state]

  rule {
    id     = "keep-earlier-versions-90-days"
    status = "Enabled"
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket     = aws_s3_bucket.state.id
  depends_on = [aws_s3_bucket_public_access_block.state]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [{
        Sid       = "TlsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      }],
      # Each pipeline identity reaches only its own environment's key.
      [for name, env in local.environments : {
        Sid       = "Only${title(name)}KeyFor${title(name)}Identity"
        Effect    = "Deny"
        Principal = { AWS = aws_iam_role.deploy[name].arn }
        Action    = "s3:*"
        NotResource = [
          aws_s3_bucket.state.arn,
          "${aws_s3_bucket.state.arn}/${name}/*",
        ]
      }],
    )
  })
}

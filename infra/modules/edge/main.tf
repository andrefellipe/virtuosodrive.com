# The edge of one environment: the one public address. A CloudFront
# distribution in front of two origins (the private bucket of page files, and
# the HTTP API for paths under /v1), with the access gate on every request,
# the certificate, and the name's records.

variable "prefix" {
  description = "The environment's name prefix: vd-test or vd-prod."
  type        = string
}

variable "environment" {
  type = string
}

variable "site_name" {
  description = "The environment's public name, for example test.virtuoso.andrefellipelabs.com."
  type        = string
}

variable "hosted_zone_name" {
  description = "The existing Route 53 zone the name lives in. Not managed here."
  type        = string
}

variable "manage_dns" {
  description = "Whether the zone is in this account, so that Terraform adds the records. If not, the maintainer adds them where the zone lives."
  type        = bool
}

variable "api_domain_name" {
  description = "The HTTP API's own address."
  type        = string
}

variable "origin_secret_value" {
  description = "The secret the edge adds to every request it forwards to the server."
  type        = string
  sensitive   = true
}

variable "access_password_sha256" {
  description = "SHA-256 of the environment's access password, in hexadecimal. The gate never holds the password itself."
  type        = string
}

variable "access_gate_enabled" {
  description = "The access gate's on/off flag. Production's is switched off at the switch (Unit U9); test's stays on."
  type        = bool
}

variable "access_gate_file" {
  description = "The built access gate (dist/edge/access-gate.js)."
  type        = string
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  # What the browser is told, with the page (security design S5): everything
  # from the site's own address only, and no framing by other sites.
  content_security_policy = join("; ", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ])
}

# --- The bucket of page files ---

resource "aws_s3_bucket" "pages" {
  # checkov:skip=CKV_AWS_18: Access logging would need another bucket and adds cost; the bucket is read only by the distribution and written only by the pipeline.
  # checkov:skip=CKV_AWS_144: One Region by decision (technology decisions T1); the page's files are rebuilt from the repository.
  # checkov:skip=CKV_AWS_145: Encrypted with the service's own keys; keys managed by the maintainer have a fixed monthly cost, and the files are public once the site is open (security design S9).
  # checkov:skip=CKV2_AWS_62: Nothing reacts to an uploaded page file; no notification is needed.
  bucket = "${var.prefix}-pages-${local.account_id}"
}

resource "aws_s3_bucket_public_access_block" "pages" {
  bucket                  = aws_s3_bucket.pages.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "pages" {
  bucket = aws_s3_bucket.pages.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "pages" {
  bucket = aws_s3_bucket.pages.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "pages" {
  bucket = aws_s3_bucket.pages.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Which Releases' folders are kept is the pipeline's decision (the ten most
# recent, never the running or the previous one). This rule only clears what
# those removals and replaced entry documents leave behind.
resource "aws_s3_bucket_lifecycle_configuration" "pages" {
  bucket     = aws_s3_bucket.pages.id
  depends_on = [aws_s3_bucket_versioning.pages]

  rule {
    id     = "clear-earlier-versions"
    status = "Enabled"
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    expiration {
      expired_object_delete_marker = true
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_cloudfront_origin_access_control" "pages" {
  name                              = "${var.prefix}-pages"
  description                       = "Lets the distribution, and nothing else, read the page files"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "pages" {
  bucket     = aws_s3_bucket.pages.id
  depends_on = [aws_s3_bucket_public_access_block.pages]
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "OnlyThisDistributionReads"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.pages.arn}/*"
        Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.this.arn } }
      },
      {
        Sid       = "TlsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.pages.arn, "${aws_s3_bucket.pages.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })
}

# --- The certificate and the name ---

data "aws_route53_zone" "this" {
  count = var.manage_dns ? 1 : 0
  name  = var.hosted_zone_name
}

resource "aws_acm_certificate" "this" {
  # checkov:skip=CKV2_AWS_71: The certificate is for one name, not a wildcard; the check does not apply to it.
  domain_name       = var.site_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  # The certificate is for one name, so there is one record; keyed by the
  # name, which is known before anything is created.
  for_each = var.manage_dns ? toset([var.site_name]) : toset([])

  zone_id         = data.aws_route53_zone.this[0].zone_id
  name            = one([for option in aws_acm_certificate.this.domain_validation_options : option.resource_record_name if option.domain_name == each.key])
  type            = one([for option in aws_acm_certificate.this.domain_validation_options : option.resource_record_type if option.domain_name == each.key])
  records         = [one([for option in aws_acm_certificate.this.domain_validation_options : option.resource_record_value if option.domain_name == each.key])]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = var.manage_dns ? [for record in aws_route53_record.validation : record.fqdn] : null
}

# --- The access gate ---

# Where the service writes the gate's "access refused" lines. Declared so
# that they are kept 30 days like every other log.
resource "aws_cloudwatch_log_group" "access_gate" {
  # checkov:skip=CKV_AWS_158: Encrypted by the service; keys managed by the maintainer have a fixed monthly cost (security design S9).
  # checkov:skip=CKV_AWS_338: Logs are kept 30 days by requirement (FR12.5), not a year.
  name              = "/aws/cloudfront/function/${var.prefix}-access-gate"
  retention_in_days = 30
}

resource "aws_cloudfront_function" "access_gate" {
  name    = "${var.prefix}-access-gate"
  comment = "Access password check and page paths (${var.environment})"
  runtime = "cloudfront-js-2.0"
  publish = true

  # The built file holds two placeholders; the SHA-256 of the access
  # password and the on/off flag are placed here.
  code = replace(
    replace(file(var.access_gate_file), "__VD_ACCESS_HASH__", var.access_password_sha256),
    "__VD_GATE_ENABLED__", var.access_gate_enabled ? "true" : "false",
  )

  depends_on = [aws_cloudwatch_log_group.access_gate]
}

# --- What requests are forwarded and what is stored ---

# Page files: stored as each file's own Cache-Control says (fingerprinted
# files for a year; the entry document never), compressed by the edge.
resource "aws_cloudfront_cache_policy" "pages" {
  name        = "${var.prefix}-pages"
  comment     = "Honours each file's own Cache-Control, down to never"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# Server answers are never stored.
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# To the server: query strings forwarded, cookies not forwarded, and exactly
# these five request headers. The last two were added with Unit U3: without
# If-None-Match the server never sees the version a page holds and can never
# answer "unchanged"; without X-Accept-Gzip it never learns that a caller can
# read a compressed answer. Neither carries a credential. Nothing is kept at
# the edge for /v1, so listing them changes what the server is told and
# nothing else. A test asserts the list, so that a later edit cannot drop one
# unnoticed.
#
# X-Accept-Gzip is a header of the project's own, which the page and the
# pipeline's checks send with the value 1. The standard header for this,
# Accept-Encoding, is not in the list and must not be put there: AWS refuses
# it in this kind of rule. On 2026-11-28 the first deployment of Unit U3 to
# test stopped at this resource with "The parameter Headers contains
# Accept-Encoding that is not allowed", and nothing was put in place. The
# server does not read Accept-Encoding.
resource "aws_cloudfront_origin_request_policy" "server" {
  name    = "${var.prefix}-server"
  comment = "Query strings, the request identifier, the version held and whether gzip is accepted; no cookies"

  cookies_config {
    cookie_behavior = "none"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["X-Request-Id", "Accept", "Content-Type", "If-None-Match", "X-Accept-Gzip"]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

resource "aws_cloudfront_response_headers_policy" "pages" {
  # checkov:skip=CKV_AWS_259: The header covers this site and every name beneath it for a year; only "preload" is off. Preload asks browsers to build the rule in for the whole registered domain, which holds other sites of the maintainer's and is not this project's to commit.
  name    = "${var.prefix}-pages"
  comment = "What the browser is told with the page (security design S5)"

  security_headers_config {
    content_security_policy {
      content_security_policy = local.content_security_policy
      override                = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = false
      override                   = true
    }
    content_type_options {
      override = true
    }
    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
  }
}

resource "aws_cloudfront_response_headers_policy" "server" {
  # checkov:skip=CKV_AWS_259: The header covers this site and every name beneath it for a year; only "preload" is off. Preload asks browsers to build the rule in for the whole registered domain, which holds other sites of the maintainer's and is not this project's to commit.
  name    = "${var.prefix}-server"
  comment = "Server answers: transport security added; the server sets no-store and nosniff itself"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = false
      override                   = true
    }
    content_type_options {
      override = true
    }
  }
}

# --- The distribution ---

resource "aws_cloudfront_distribution" "this" {
  # checkov:skip=CKV_AWS_68: No web application firewall: it has a fixed monthly cost the ceiling does not allow; the server's request limit and the budget alarm are the defence (scalability design C2).
  # checkov:skip=CKV2_AWS_47: As above: no web application firewall, so no rule group in one.
  # checkov:skip=CKV_AWS_86: The edge's standard access log would need another bucket and holds visitors' network addresses; refusals are logged by the gate and requests by the entry point and the server.
  # checkov:skip=CKV_AWS_310: One origin of each kind by design: one Region, no standby (reliability design R7).
  # checkov:skip=CKV_AWS_374: The site is not restricted by country.
  # checkov:skip=CKV2_AWS_32: Both behaviours carry a response headers policy; the check does not follow the references.
  enabled             = true
  comment             = "Virtuoso Drive (${var.environment})"
  aliases             = [var.site_name]
  default_root_object = "index.html"
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_All"
  wait_for_deployment = true

  origin {
    origin_id                = "pages"
    domain_name              = aws_s3_bucket.pages.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.pages.id
  }

  origin {
    origin_id   = "server"
    domain_name = var.api_domain_name

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 10
    }

    # Proves to the server that a request came through the edge.
    custom_header {
      name  = "x-origin-verify"
      value = var.origin_secret_value
    }
  }

  default_cache_behavior {
    target_origin_id           = "pages"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.pages.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.pages.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.access_gate.arn
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/v1/*"
    target_origin_id           = "server"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.server.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.server.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.access_gate.arn
    }
  }

  # No custom error responses: they would apply to the whole distribution and
  # replace the server's own failure answers under /v1.

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.this.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_route53_record" "site" {
  for_each = var.manage_dns ? toset(["A", "AAAA"]) : toset([])

  zone_id = data.aws_route53_zone.this[0].zone_id
  name    = var.site_name
  type    = each.value

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

output "distribution_id" {
  value = aws_cloudfront_distribution.this.id
}

output "distribution_domain_name" {
  value = aws_cloudfront_distribution.this.domain_name
}

output "pages_bucket" {
  value = aws_s3_bucket.pages.bucket
}

output "access_gate_log_group" {
  value = aws_cloudwatch_log_group.access_gate.name
}

output "certificate_validation_records" {
  description = "The records to add where the zone lives, when the zone is not in this account."
  value = [for option in aws_acm_certificate.this.domain_validation_options : {
    name  = option.resource_record_name
    type  = option.resource_record_type
    value = option.resource_record_value
  }]
}

output "server_request_headers" {
  description = "The request headers the edge passes to the server, for the test that they are exactly the five intended."
  value       = one(one(aws_cloudfront_origin_request_policy.server.headers_config).headers).items
}

output "server_request_cookies" {
  description = "Whether the edge passes cookies to the server: none."
  value       = one(aws_cloudfront_origin_request_policy.server.cookies_config).cookie_behavior
}

output "names" {
  value = [
    aws_s3_bucket.pages.bucket,
    aws_cloudfront_origin_access_control.pages.name,
    aws_cloudfront_function.access_gate.name,
    aws_cloudfront_cache_policy.pages.name,
    aws_cloudfront_origin_request_policy.server.name,
    aws_cloudfront_response_headers_policy.pages.name,
    aws_cloudfront_response_headers_policy.server.name,
  ]
}

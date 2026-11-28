# What Unit U3 changes and adds in an environment. Checked from the plan
# alone, with a stand-in for AWS: no account is touched.
#
#   - The edge passes exactly five request headers to the server, and no
#     cookie (infrastructure specification, "The one change").
#   - The two saved searches for browsing, and the dashboard's view drawn
#     from the log, exist under the environment's prefix (monitoring design).

mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "000000000000"
    }
  }
  mock_data "aws_region" {
    defaults = {
      region = "us-east-1"
    }
  }
}

variables {
  placeholder_package = "tests/fixtures/placeholder.zip"
  access_gate_file    = "tests/fixtures/access-gate.txt"
}

run "the_edge_passes_exactly_five_headers_to_the_server" {
  command = plan

  variables {
    environment         = "test"
    site_name           = "test.virtuoso.andrefellipelabs.com"
    vpc_cidr_block      = "10.20.0.0/24"
    alarms              = false
    deletion_protection = false
    server_concurrency  = 5
    throttle            = { rate = 10, burst = 20 }
  }

  assert {
    condition     = length(module.edge.server_request_headers) == 5
    error_message = "The edge must pass exactly five request headers to the server, and passes ${length(module.edge.server_request_headers)}."
  }

  assert {
    condition     = module.edge.server_request_headers == toset(["X-Request-Id", "Accept", "Content-Type", "If-None-Match", "Accept-Encoding"])
    error_message = "The edge must pass X-Request-Id, Accept, Content-Type, If-None-Match and Accept-Encoding to the server, and nothing else. It passes: ${join(", ", module.edge.server_request_headers)}"
  }

  assert {
    condition     = module.edge.server_request_cookies == "none"
    error_message = "The edge must pass no cookie to the server."
  }
}

run "the_searches_and_the_view_for_browsing_exist_under_the_test_prefix" {
  command = plan

  variables {
    environment         = "test"
    site_name           = "test.virtuoso.andrefellipelabs.com"
    vpc_cidr_block      = "10.20.0.0/24"
    alarms              = false
    deletion_protection = false
    server_concurrency  = 5
    throttle            = { rate = 10, burst = 20 }
  }

  assert {
    condition = module.monitoring.folder_search_names == [
      "vd-test/folder requests by outcome",
      "vd-test/folder requests slower than 1 second today",
    ]
    error_message = "The two saved searches for browsing must exist under vd-test/. Found: ${join(", ", module.monitoring.folder_search_names)}"
  }

  assert {
    condition     = alltrue([for name in module.monitoring.folder_search_names : contains(output.resource_names, name)])
    error_message = "The saved searches for browsing must be among the names checked for the environment's prefix."
  }

  assert {
    condition     = contains(module.monitoring.log_view_titles, "Folder requests by outcome over time")
    error_message = "The dashboard must have the view \"Folder requests by outcome over time\", drawn from the log."
  }
}

run "the_searches_for_browsing_exist_under_the_production_prefix" {
  command = plan

  variables {
    environment         = "production"
    site_name           = "virtuoso.andrefellipelabs.com"
    vpc_cidr_block      = "10.30.0.0/24"
    alarms              = true
    deletion_protection = true
    server_concurrency  = 20
    throttle            = { rate = 50, burst = 100 }
  }

  assert {
    condition = module.monitoring.folder_search_names == [
      "vd-prod/folder requests by outcome",
      "vd-prod/folder requests slower than 1 second today",
    ]
    error_message = "The two saved searches for browsing must exist under vd-prod/. Found: ${join(", ", module.monitoring.folder_search_names)}"
  }

  assert {
    condition     = length(module.edge.server_request_headers) == 5
    error_message = "Production's edge must pass exactly five request headers to the server."
  }
}

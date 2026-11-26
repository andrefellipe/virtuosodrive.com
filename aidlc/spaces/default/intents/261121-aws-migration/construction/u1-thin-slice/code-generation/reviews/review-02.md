## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-26T00:35:39Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | infra/setup/budget.tf:64 | The budget's cost filter is written `"user:project$${var.project}"`. In Terraform, `$${` is the escape for a literal `${`, so the value sent to AWS is the text `user:project${var.project}`, not `user:project$virtuoso-drive`. I confirmed this by planning a one-line configuration in a scratch folder: it printed `user:project${var.project}`. AWS will either refuse the budget (the setup then stops at step 2) or accept a filter that matches no resource. In that case the budget counts nothing and neither the 80% nor the 100% email ever fires. That defeats the one control the project says must exist before anything else. `terraform validate` and `fmt` cannot see it. | Build the value without the escape trap, for example `format("user:project$%s", var.project)`. Add a `terraform test` or plan check in `infra/setup` that asserts the exact filter string. | Resolved (reviewer) |
| R-02 | Major | infra/setup/setup.sh:52-61 and 105-110 | The re-run logic uses "the state bucket exists" to mean "the setup's state is already in the bucket". The first full apply (line 74) creates the bucket, the roles and the policies while the state is still local. If that apply fails after the bucket exists (an IAM condition or a policy size limit is rejected; `docs/operations.md` itself says to expect this), the maintainer is told to run again. The re-run finds the bucket, writes `backend.tf` and runs `terraform init -input=false` against the new backend while a local `terraform.tfstate` already holds the created resources. Init then stops, or it demands a state migration that the script never offers. The maintainer is stuck, or tempted to `-reconfigure` and lose track of resources that were already made. | Decide between "state in bucket" and "state local" by looking for the local `terraform.tfstate` and for the object `setup/terraform.tfstate` in the bucket, not by the bucket alone. When a local state exists, run `init -migrate-state -force-copy` before anything else. Test both re-run paths with a stubbed `aws` and `terraform`. | Resolved (reviewer) |
| R-03 | Major | infra/setup/identities.tf:83 (with infra/setup/versions.tf:22-28 and .github/workflows/deliver.yml:201-208, go-back.yml:132-139) | Every resource of the setup carries the tag `environment = "account"` through `default_tags`. That includes the alarm topic. The boundary of each pipeline identity has a Deny on all actions for any resource tagged `environment` equal to the other environment or to `account` (`OtherEnvironmentByTag`). A Deny beats the Allow on `sns:Publish` (identities.tf:40) and beats the topic policy statement `PipelineMayReportAFailedDeployment` (budget.tf:41-47). SNS topics support tag conditions. So the "tell the maintainer that the production deployment failed" step and the "going back failed" step will get AccessDenied, and the maintainer is never told. | Give the topic a tag the boundary does not deny (override its tags, or use a different tag value for the shared setup resources that the pipeline must reach). Or exempt the topic by ARN in the tag Deny. Add a check that every resource the pipeline is allowed to touch is not matched by a tag Deny. | Resolved (reviewer) |
| R-04 | Major | infra/setup/budget.tf:16-50 and infra/setup/setup.sh:63-67 | The first step applies only the topic and the budget (`-target`). The topic policy that lets Budgets publish is a separate resource and is not in that targeted apply. It cannot be: it names the two deploy roles, so targeting it would pull in the OIDC provider, the boundaries and the roles, which breaks the "budget first" order. AWS Budgets checks that it can publish to a notification topic when the notification is created. If it does, the first run fails at step 2 for a reason the script reports as "the budget alarm could not be created". If it does not, the topic is silently unusable until step 3. | Make the policy that grants Budgets and CloudWatch publish rights independent of the roles. Put the pipeline's publish permission in the roles' own policy (the roles already carry `sns:Publish`), so the topic policy can sit in the first targeted apply. Otherwise record, with a real run, that Budgets accepts the topic without the policy. | Resolved (reviewer) |
| R-05 | Minor | infra/setup/identities.tf:41 and infra/modules/server/main.tf:89-91 | The server and runner role policies allow `ec2:AssignPrivateIpAddresses` and `ec2:UnassignPrivateIpAddresses`. The boundary's EC2 patterns (`*Vpc*`, `*Subnet*`, `*NetworkInterface*` and others) do not match them, so they are silently cut off. Lambda usually runs without them, but the policy and its boundary disagree, and the Terraform tests cannot show it. | Either add the two actions to the boundary or drop them from the role policies, so the written policy equals the effective one. | Resolved (reviewer) |
| R-06 | Minor | infra/environment/test.tfvars:15 and infra/environment/production.tfvars (server_concurrency); infra/setup/setup.sh | The defaults reserve 5 (test) and 20 (production) copies, plus 1 for the runner. A new account with the low default concurrency limit refuses any reservation, and the first deployment then fails after the database has been created (about ten minutes lost). `docs/operations.md` explains the fix after the fact, but nothing in the setup checks the limit. | Have `setup.sh` read the account's Lambda concurrency quota and print a warning (or the exact `-1` setting) before the first merge. | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/code-generation/traceability.json (AC9.4.3, NFR10.7) | Both are marked OK with `.github/workflows/checks.yml` as the target. `code-summary.md` deviation 12 says half of this check is not built (the in-reach end-to-end tests are not run against the new server) and that NFR10.7 is only partly met. An OK target here overstates what the file carries. | Mark NFR10.7 and AC9.4.3 as partial or deferred, with the missing half named. | Resolved (reviewer) |
| R-08 | Minor | infra/setup/variables.tf:16,34-43; .github/workflows/go-back.yml:35; infra/environment/production.tfvars, test.tfvars; docs/operations.md | The maintainer's GitHub handle and the personal domain are committed as defaults and in text. The project rule says the maintainer's name must not appear, and the repository check covers only email-shaped text. The site names are also written in `go-back.yml` as well as in the tfvars, so the two can drift apart. | Confirm with the maintainer that the handle and domain may stay (the repository URL is public anyway). If so, record that decision. Read the site name in go-back from one place (a repository variable or the Terraform output). | Unresolved |
| R-09 | Minor | infra/setup/setup.sh, steps 1 and 2 (targeted apply) | The setup's targeted first apply is covered only by a mock-provider test. Whether AWS Budgets accepts the topic and the tag filter in one real run is untested. Terraform warns on `-target`, but nothing here is wrong. | At the first real run, record that the budget was created and that the filter matches after the tag is activated. | New |

> R-01 Reviewer note: `infra/setup/budget.tf` now builds the filter with `format("user:project$%s", var.project)`. The new `terraform test` asserts the exact string `user:project$virtuoso-drive` and that no `{` remains; it passes.

> R-02 Reviewer note: `setup.sh` now decides by the local `terraform.tfstate` and by the object `setup/terraform.tfstate` in the bucket. Local state only: init locally, carry on, then migrate at step 7. State in the bucket only: init against the backend. Both: stop with a clear message. Bucket without any state: stop. All four paths read correctly. They were not run with a stubbed `aws` and `terraform`, which was only a suggested test.

> R-03 Reviewer note: The tag Deny now covers only the other environment, so the "account"-tagged alarm topic is no longer refused. A test asserts the exact deny value for each boundary. The create-time Deny on request tag "account" does not touch the pipeline's own publish calls.

> R-04 Reviewer note: The topic policy no longer names the deploy roles, and it sits in the first targeted apply with the topic and the budget. A test applied against a mock asserts it holds no `-deploy` and does allow Budgets. A real run against AWS is still not available.

> R-05 Reviewer note: `ec2:*PrivateIpAddresses` is now in the boundary, so the role policies and the boundary agree.

> R-06 Reviewer note: `setup.sh` reads the account's Lambda concurrency limit and warns, with the exact `-1` workaround, when it is below 127. Reading failures are noted, not fatal.

> R-07 Reviewer note: NFR10.7 is now `Deferred`. AC9.4.3 is still `OK` with `checks.yml` as target. The unbuilt half is named in a NOTE in the workflow and in the code summary, so this is a small remaining overstatement and not blocking.

> R-08 Reviewer note: The handle default and the personal domain are still committed. The site URL is still written separately in `go-back.yml` line 35 and in the tfvars. The maintainer's confirmation is not recorded.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `terraform -chdir=infra/setup test` | PASS: 3 passed, 0 failed | Confirms the tag filter string, the tag-deny shape, the 6,144-character limit and the topic policy's independence from the roles. |
| `terraform fmt -check -recursive infra` | PASS (no output) | Formatting is clean. |
| `bash -n infra/setup/setup.sh` | PASS (no output) | The script parses. |

### What I could not check

- I did not run `npx vitest run ... --coverage`, `npm run check`, `terraform -chdir=infra/environment test` or `terraform validate`. The changes since the first pass touch the setup, the workflow and the records, not the application code.
- No real AWS run exists, so the Budgets and topic behaviour and the setup's re-run paths are reasoned from the code, not observed.

### Summary

All Critical and Major findings from the first pass are fixed in the files as they stand, and the new Terraform tests pass. Only Minor items remain (R-08, the AC9.4.3 target, and the need for a first real run), so a developer can build and run from this.

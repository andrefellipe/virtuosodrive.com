## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-27T14:12:56Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | infra/modules/database/main.tf > aws_db_instance.restored timeouts (create = "40m") and docs/operations.md > procedure 4 "When the restore takes too long" | The 40-minute limit is shown to be safe only for a restore that fails. A restore that finishes at minute 35 to 40 ends at about minute 40 to 46 of the job, and the rest of the deploy (change runner up to 5.5 minutes, switch, smoke check, end-to-end tests) then runs into the job's 60-minute stop. That stop can fall in the middle of the switch step, which restores the old alias only on an error, not on a cancel. Only the test environment is affected, and only while a copy is being made. | Lower the create limit (about 25 to 30 minutes leaves room for the rest of the deploy), or state in the procedure that a restore finishing after about minute 35 may end the run mid-deploy and say how to check which version is live. | New |
| R-02 | Minor | infra/modules/database/main.tf > output restored_copy, `create_timeout = copy.timeouts.create` and `delete_timeout` | The two new values are read without `try()`, although the neighbouring two values are guarded so that a plan never fails on this output. If a copy ever exists in state without a timeouts object, every plan, and so every deployment, fails on an output that only tests read. No copy exists today, so no live plan is affected. | Wrap both new values in `try(..., null)` like the other two. | New |
| R-03 | Minor | .github/workflows/checks.yml > "Compatibility with every version in reach", the `while read -r RELEASE SHA _ ... done < in-reach.txt` loop | The loop reads its list from standard input, and `git worktree add`, `npm ci` and `npx vitest` run inside it. Any of them reading standard input would swallow the second Release's line, and the check would then pass without testing that Release (production plus the previous one will be the normal case). This is not new, but this step was rewritten and says it must prove something for every Release. | Run the commands inside the loop with `< /dev/null`, or read the list with `mapfile` or a separate file descriptor. | New |
| R-04 | Minor | .github/workflows/checks.yml > same step, `npx vitest run server` | The old step also ran each Release's `db-migrate` tests. Those broke on every added file, which is why they were dropped, but they also pinned what the first change grants and constrains (the app user may only read, the single-row check). A pull request that widened those grants would no longer be caught against the Release in reach, if the Release's server tests do not assert them. The current tree's own `migrations.integration.test.ts` still pins them, so the loss is only against the old Release. | Accept it and say so in docs/examples.md, or confirm that the server's tests assert the app user's privileges. | New |
| R-05 | Minor | .github/workflows/go-back.yml > "Take the environment's identity", and compare.yml > "Take the environment's identity" (`role-to-assume`) | In `inputs.environment == 'production' && (secrets.AWS_ROLE_PRODUCTION \|\| vars.AWS_ROLE_PRODUCTION) \|\| (secrets.AWS_ROLE_TEST \|\| vars.AWS_ROLE_TEST)`, an empty production value falls through to the test role. Precedence is right and this is how the old expression behaved. The test identity is denied on production, so the result is a loud failure and not damage, but the message would be misleading. | Optional: fail with a clear message when the environment is production and both values are empty. | New |
| R-06 | Minor | infra/setup/github-settings.sh > the four `... \| gh secret set` lines | With `set -euo pipefail`, a failing `terraform output` or Python step stops the script before the variables are deleted, which is right. It is not shown what `gh secret set` does with empty standard input, so a failure could leave an empty secret. The workflows would then use the variable (empty secret is false), so nothing breaks, but the script would also not have removed the variables. | Capture each value in a variable, stop if it is empty, then pass it with `printf '%s'`. | New |
| R-07 | Minor | docs/operations.md > procedure 4, the `curl --cookie "vd_access=$(aws ssm get-parameter ...)"` command | The password stays out of the terminal and out of shell history, as the text says. It is, however, an argument of the `curl` process for its lifetime, visible to other users of the same machine through the process list. The `/v1/site-information` path was not checked against the edge's routing. | Add `--cookie @-` or a header read from standard input, or note the limit. Confirm the path the first time the step is run. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `terraform -chdir=infra/environment test` | 23 passed, 0 failed (includes the three new files) | The off-by-default switch, the production refusal, the production policy literal and the copy-keeps-first-database run pass. The literal matches the policies in `git show 1db1c19:infra/modules/server/main.tf` (statements, order and resources, with `local.network_interface_statement` unchanged in this diff). |
| `npx vitest run db-migrate scripts` | 9 files, 72 tests passed (real PostgreSQL through Docker) | The five failing-change tests are real: test 1 fails if the failing change were recorded or a real change rolled back, test 2 shows nothing else changes, test 3 shows the `DELETE` path, test 4 shows the next run succeeds. |
| `git ls-tree -r` of 719b6a2, 1db1c19, d615fed, e25df3d and c5b5c33 | Each has `server/` and `db-migrate/src/testing/postgres.ts` | The new guard in the compatibility step cannot wrongly fail on any Release deployed so far. |
| Search for 12-digit numbers in the diff and the new files | None (only the `000000000000` stand-in in tests) | No account number is committed. |

### Summary

I found no critical or major issue. The failing change cannot run in production or with the switch off: Terraform refuses it, the environment variable exists only while it is on, the change runner refuses it in production, and the rehearsal file sits outside the folder the run scans. The `DELETE` is parameterised and touches only the rehearsal file's own name, and a throwing change runner ends as `notPutInPlace` and leaves the live version and alias untouched. The masking step is placed straight after every identity step, and the `secrets.X \|\| vars.X` fallback covers the gap before the maintainer re-runs the setup script. What remains are small hardening points, listed above.

**What cannot be known until it runs**

- Whether AWS words the refusals for Lambda `TagResource` and IAM `UpdateAssumeRolePolicy` with "explicit deny". `infra/setup/identities.tf` denies both by explicit Deny statements (rule "OtherEnvironmentByName", resource `lambda:function:vd-prod-*`, and rule "WhatTheSetupMade", resource `role/vd-*-deploy`). Those statements sit in both the boundary and the identity-attached copy, so the usual text should match. If it does not, `prove-identity-limits` fails loudly with "refused, but NOT by an explicit deny", and it runs only by hand.
- That every job's log shows `***` for the account number after the maintainer re-runs the setup script. Until then the identity step prints the role name from the variable (documented), and old runs keep their logs.
- Whether `gh` accepts the piped values exactly as intended (finding on `github-settings.sh`).
- The restore time of the database copy, and so how the 40-minute limit behaves in practice.
- That the `restored_copy` output and the `address` and `port` outputs behave the same against real AWS as against the stand-in. Both live environments' plans show no change under the defaults in the tests that ran.

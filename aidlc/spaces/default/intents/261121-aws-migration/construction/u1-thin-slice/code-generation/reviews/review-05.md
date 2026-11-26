## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-26T23:16:37Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | infra/modules/database/main.tf:144 | The repair of the existing test database depends on one RDS behaviour that nothing here proves: that a master password change is applied soon after the provider's modify call returns. AWS documents it as applied asynchronously and as soon as possible, with no wait for the maintenance window, so the multi-day stall you asked about is not expected. There is a short gap, though, while the instance reports "resetting-master-credentials", and the provider's own wait can return before the instance has left "available". In the deploy action the change runner is called only after a few S3 copies, an SSM read, a Lambda code update and a wait for the new version to be active, so the gap is very likely already closed by then. If it is not, the first sign-in as master fails with the same message as before. | No change needed to merge. Keep the sentence in `code-summary.md` that a second run of the workflow settles it. After the run, check read-only that the instance shows no pending password change. Optionally, later, let the change runner retry the master sign-in a few times over about a minute when it is refused. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/code-generation/code-generation-plan.md:5 | The Summary says "the existing 189 unit and integration tests and 8 Terraform tests run again". The code summary's table says 8 runs in total, 5 existing and 3 new, and the test run shows 8 passed with the new file included. So "8 existing" overstates by 3. | Change the Summary to "the existing 5 Terraform runs" or "8 in all, 3 of them new". | New |

### What I checked and found sound

**1. Will the next run repair the test environment.** Yes, by reading, not by running.
- The secret version ignores changes to `secret_string`, so the secret keeps its first value. The new password expression reads that stored value, which differs from the instance's recorded password. The plan should therefore show one in-place change to `password`, printed as a sensitive value.
- The secret is not touched: it has no new input and its string is ignored.
- `password` is not a replacement trigger on `aws_db_instance`, so `prevent_destroy` is not in play. `ignore_changes` still lists only `engine_version`.
- `apply_immediately = false` should not hold a password change back to the maintenance window. AWS documents the master password change as applied asynchronously, as soon as possible.
- On a brand-new environment, such as the first production deploy, the password is unknown at plan time and known after the secret version is created. Terraform's dependency order handles that, so production creation is not harmed.

**2. Order in the same run.** The deploy action runs Terraform apply, then S3 copies and an SSM read, then (skipped on a first deployment) the smoke check, then the runner's code update, a wait for the version to be active, and the invoke. Dozens of seconds sit between the apply and the sign-in. A race is unlikely, and a re-run of the workflow cures it, because the runner is idempotent.

**3. After the password works.**
- **Sign-in flow.** The runner tries `migrator` by IAM token. The failure you saw, "password authentication failed for user vdmaster", proves that step ran. Generating an RDS IAM token is a local request signature (`@aws-sdk/rds-signer`) and needs no network call. It then reads the master secret through the Secrets Manager interface endpoint, which has private DNS on and a policy covering `vd-test-*` secrets. That is the only AWS call the runner makes.
- **Logging.** Lambda logs leave through the Lambda service, not the VPC, so a missing CloudWatch Logs or STS endpoint is not a problem. This holds as long as the runner reaches nothing else in AWS.
- **Creating the users.** `create-users.sql` runs in one transaction. `CREATE ROLE` and `GRANT rds_iam` by the RDS master are the documented route. On PostgreSQL 15 and later the `public` schema belongs to `pg_database_owner`, and the master owns the database, so `REVOKE CREATE ... FROM PUBLIC` and the grants to `migrator` should work. The `app` and `migrator` check stops on a half-made state instead of repairing it.
- **Migrations.** `0001` is plain DDL and a grant, and runs as the schema owner. node-pg-migrate's own table and advisory lock live in `public`, where `migrator` has CREATE.
- **Timing.** The connection limit is 10 s. The Lambda timeout is 300 s, and the CLI read timeout of 330 s covers it.
- **TLS.** Full verification with the bundled regional CA matches `ca_cert_identifier = "rds-ca-rsa2048-g1"`. The test fixture confirms the bundle is packaged in the build.
- **Server on first call.** It builds an IAM token locally and reads one secret (the origin secret) through the same Secrets Manager endpoint. The endpoint sits in one subnet, but interface endpoints answer across availability zones. I found nothing there that is unreachable without a NAT.

**4. The new Terraform test.** It reproduces the fault:
- Run 1 writes only the secret, using a targeted apply and a first generated value.
- Run 2 creates the instance with a different generated value and asserts that the instance's password equals the secret's.
- Run 3 asserts nothing moves.
- With the old wiring the instance would carry the second run's placeholder, so the assertions in runs 2 and 3 would fail. That agrees with the developer's report of 1 passed and 2 failed.
- I ran `terraform -chdir=infra/environment test`: 8 passed, with the expected targeted-apply warning only.
- `checks.yml` runs `init -backend=false` for `infra/environment` before `terraform test`, so the pull request check will pass.
- On a fresh clone the existing `naming` and `alarms` tests already need the same init, so the new file adds no new setup step. It is a mock run, so it adds little time.
- Limit, already stated in the summary: the test cannot reproduce the existing environment's already-diverged state.

**5. The three corrections.**
- **Gate header.** The gate's 401 response and its test both carry `max-age=31536000; includeSubDomains`, matching the edge module's headers policy. I found no other assertion of the old string.
- **Parameter-group comment.** It is true. A changed description or family forces a new group, while a changed setting does not. A swapped group takes effect at the next reboot.
- **PostgreSQL 18 line.** Removing it from "Not verified" is justified, because the instance and the parameter group were both created.

**6. Secrets hygiene.** No new output was added, and the existing secret outputs carry only the name and ARN. `secret_string` and the decoded password stay sensitive. The test's `nonsensitive()` calls are limited to placeholder values. The access password and the edge secret already read their stored values: the access-password hash comes from the SSM parameter and the origin secret from its secret version. They have no copy of this bug.

**7. Accuracy of the new `code-summary.md` section.** It is accurate. It states what is unproved: the in-place correction of the existing database and the timing before the runner signs in. It also states the targeted-apply warning and the need for init.

### What I could not check

- Real RDS behaviour: whether the provider's wait covers "resetting-master-credentials", and whether PostgreSQL 18 on RDS accepts every statement in `create-users.sql`. I judged these from AWS documentation and the code. I made no AWS calls and ran no `plan` or `apply`.
- The `terraform plan` output against the real test state. This needs the remote backend, which was out of bounds.
- Checkov and the end-to-end tests, which I did not run.

### Summary

The wiring fix is sound: the database now takes its master password from the stored secret, so the two cannot differ. The next pipeline run should correct the test database in place. The new test reproduces the original fault, and the three corrections are accurate. The only open points are the unproved timing of the password change, at worst cured by re-running the workflow, and one overstated test count in the plan's Summary.

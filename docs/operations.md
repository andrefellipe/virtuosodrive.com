# Operating Virtuoso Drive on AWS

The procedures a person performs. Everything else is done by the pipeline.
Each procedure here is rehearsed once before Unit U1 is complete; the records
of those rehearsals are in `docs/records/`.

The old site under `app/` is not part of any of this. It stays live on
Firebase, unchanged, until the AWS version is accepted.

## The parts, in one paragraph

A visitor reaches one address per environment (`virtuoso.andrefellipelabs.com`
for production, `test.virtuoso.andrefellipelabs.com` for test). Amazon
CloudFront answers it. A small function at the edge, the access gate, asks for
the environment's access password unless the request is the health check.
Paths under `/v1` go to the server (an AWS Lambda function behind an HTTP
API), which reads a PostgreSQL database on Amazon RDS; every other path is a
page file from a private Amazon S3 bucket. GitHub Actions builds, checks and
deploys all of it; Terraform, in `infra/`, defines every AWS resource.

## Working on the code

| To do this                                                      | Run this, at the repository's root                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Install (Node.js 24 and Docker are needed)                      | `npm ci`                                                                                 |
| Everything a pull request checks, except the GitHub-side checks | `npm run check`                                                                          |
| Unit and integration tests only                                 | `npx vitest run server db-migrate web edge scripts`                                      |
| Unit tests only, without Docker                                 | `npx vitest run server db-migrate web edge scripts --exclude '**/*.integration.test.ts'` |
| Terraform's own tests (no AWS account is touched)               | `terraform -chdir=infra/environment test`                                                |
| End-to-end tests against a deployed environment                 | `npm run e2e`, with the four `VD_...` variables named in `e2e/playwright.config.ts`      |

Changes reach the branch `aws-migration` only through a pull request whose
checks passed, merged by squash on GitHub. The pull request's title or
description must name its Unit (for example `U1`).

## 1. Run the one-time setup

Done once per AWS account, by the maintainer, with their own sign-in. It makes
the budget alarm first, then what lets the pipeline sign in, then the bucket
for Terraform's state. Run again, it changes nothing that already exists.

Before you start:

- You are signed in to the AWS account on the command line, with rights to
  create budgets, IAM roles and S3 buckets. Creating a budget by script may
  need access to billing information to have been switched on for the account
  by its root user, in the console; if the setup stops at the budget, that is
  the first thing to check.
- You are signed in to GitHub with `gh auth login`, as an administrator of the
  repository.
- The Route 53 zone `andrefellipelabs.com` is in this AWS account. If it is in
  another account, set `manage_dns = false` in both files under
  `infra/environment/*.tfvars` by a pull request, and add the records the
  first deployment prints (`certificate_validation_records`, and an alias for
  each site name) where the zone lives.

Steps:

1. `infra/setup/setup.sh`. It asks for the address alarm emails should go to.
   The address is stored in the notification subscription only: not in the
   repository, not in Terraform's state.
2. Open the confirmation message you receive and confirm the subscription.
   Until you do, alarms fire and nobody is told.
3. `infra/setup/github-settings.sh`. It stores the pipeline's two identities
   as repository variables, makes `aws-migration` the default branch, creates
   the `production` environment with you as required reviewer, and protects
   the branch. If GitHub's plan for the repository does not allow a required
   reviewer or branch protection, the script stops and says so.
4. Merge the first pull request. The pipeline builds both environments.

What can go wrong:

- **The budget could not be created.** The setup stops and creates nothing
  else. Fix the cause and run it again.
- **The tag `project` could not be switched on for cost reporting.** AWS lists
  a tag only some hours after a resource first carries it. Run `setup.sh`
  again after the first deployment. Until then the budget, which counts only
  resources tagged `project = virtuoso-drive`, shows nothing.
- **A permission is refused during the first deployment.** The conditions
  that confine each pipeline identity at the edge and in DNS could not be
  verified before the first run. The failing step names the action AWS
  refused; correct `infra/setup/identities.tf` by a pull request and run
  `setup.sh` again.
- **Reserving copies of the server is refused** (a new account's limit on
  simultaneous function copies can be too low). Set `server_concurrency = -1`
  in the environment's `.tfvars` file by a pull request, ask AWS for a higher
  limit, and set it back once granted. Until then the request limit of the
  HTTP API is the only ceiling.

## 2. Approve a production deployment

1. A merged pull request starts the workflow `deliver`. It builds the Release,
   deploys it to test, and runs the smoke check, the end-to-end tests and the
   100-call measurement there.
2. When those pass, the run waits at the job `Production`. GitHub emails you.
3. Read the test stage's Terraform plan in the run. Production's plan can only
   be made after you approve, with production's identity.
4. Approve. The run shows production's plan, waits two minutes, then applies
   exactly that plan. **The two minutes are your chance to cancel the run** if
   the plan differs from test's in kind and not just in names.
5. The run then applies database changes, switches the server and the page,
   and runs the smoke check. Its summary says how the Deployment ended:
   `succeeded`, `notPutInPlace` (production runs what it ran before) or
   `inPlaceButFailing` (the new Release is running and its check failed).

Only the newest verified Release can be approved: when a later Release passes
in test, an earlier run still waiting is cancelled.

## 3. Go back to the previous version

Works the same in test and in production. Nothing is rebuilt; Terraform and
the database are not touched.

1. On GitHub: Actions, `go-back`, "Run workflow", choose the environment.
2. For production, approve the run.
3. The run moves the server back to the previous Release, puts that Release's
   entry document back, and runs the smoke check expecting that version.
4. Its summary says how it ended. If there is no previous Release (only one
   has ever been put in place), it says so and does nothing.

Going back a second time returns to the Release you left.

What going back does not undo: database changes and infrastructure changes
made by the Release you left. Database changes only ever add, so the previous
version keeps working with them. If an infrastructure change is itself the
fault, the remedy is a new pull request that reverses it.

## 4. Restore the database

Amazon RDS keeps a daily backup for 7 days and can restore to any moment
within them. A restore always creates a new database beside the old one.

1. In a pull request, add a second database to the environment's Terraform,
   restored from the moment you need (`restore_to_point_in_time` on a copy of
   the resource in `infra/modules/database`), with a different identifier.
2. Merge it. When the deployment succeeds, the copy exists.
3. In a second pull request, point the server and the change runner at the
   copy (`DB_HOST` comes from the database module's output `address`).
4. Merge it and see the page answer.
5. When the copy is confirmed good, a further pull request removes the old
   database: first turning off its deletion protection, then, in another,
   removing it. Terraform refuses to destroy a database in one step.

The rehearsal in the test environment follows steps 1 to 4, then switches back
and removes the copy; record the time each step took.

## 5. Read, use and replace the access password

Each environment has its own access password, generated by the deployment and
stored in AWS. Nobody chooses it and it is written nowhere in the repository.

**Read it.** In your own terminal, signed in to the AWS account:

`aws ssm get-parameter --name vd-test-access-password --with-decryption --query Parameter.Value --output text`

(`vd-prod-access-password` for production.) Do not paste it anywhere it would
be kept, and do not put it in an address.

**Use it.** Open the site, type the password into the password page and press
Continue. It is typed once per device: the browser remembers it for 30 days
in the cookie `vd_access`, then asks again. A wrong password shows the
password page again, with no message. The page needs JavaScript; without it,
pressing Continue sends nothing of what was typed and does not let you in.

**Replace it.** Whenever it may have been seen by someone it was not given to:

1. In a pull request, add one to `access_password_version` in the
   environment's file under `infra/environment/` (add the line if it is not
   there; the default is 1).
2. Merge it. The deployment generates a new password, stores it, and redeploys
   the access gate with its new SHA-256 in the same run. Every device is asked
   again, and the old password no longer works anywhere.
3. Read the new password with the command above.

The test environment's was replaced this way on 2026-11-26
(`access_password_version = 2`): the first password page wrote what was typed
into the address, and so into the history of the browser it was typed in.
Clearing that entry from the browser's history is worth doing, though the old
password no longer opens anything.

To replace the secret the edge adds for the server, do the same with
`origin_secret_version`. Running copies of the server read the new value
themselves within a minute.

## 6. Read the logs for a request

When the page cannot reach the server it shows a request identifier. With it:

1. Open CloudWatch, Logs Insights, saved queries, folder `vd-prod` (or
   `vd-test`).
2. Open "by request identifier", put the identifier in place of
   `PUT-THE-REQUEST-IDENTIFIER-HERE`, choose the time range, run.
3. The entry shows the operation, the outcome, the duration, the version and,
   for a server failure, the internal reason.

The other saved searches: "server failures in the last hour", "the twenty
slowest requests today", "access refusals in the last day". Entries are kept
30 days. No entry holds an email address, a password or a request's body.

The dashboard `vd-prod` (or `vd-test`) is the first screen to open when
something seems wrong.

## 7. What to do when an alarm emails

Every alarm emails once when it starts and once when it clears.

| Email                                        | What it means                                                                                    | What to do                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vd-prod-health`                             | Production failed its health check from outside twice in a row: the site or its database is down | Open the dashboard `vd-prod`. If a deployment just finished, go back (procedure 3). Otherwise run "server failures in the last hour" and look at the database's widgets: CPU, credit balance, connections, free storage.           |
| `vd-prod-error-rate`                         | More than 5% of at least 20 requests in 5 minutes were server failures                           | Run "server failures in the last hour". If they began with a deployment, go back (procedure 3). The reason in each entry says what failed.                                                                                         |
| "production: deployment failed"              | The pipeline's production job failed                                                             | Open the run named in the email. Its summary says whether production runs what it ran before (`notPutInPlace`) or the new Release, failing (`inPlaceButFailing`). For the second, decide whether to go back.                       |
| Budget at 80% (US$48)                        | The month's spending on this project's tagged resources reached US$48                            | Open AWS Budgets and Cost Explorer, grouped by the tag `environment` and by service. An ordinary month sits near US$47 to US$50, so this email is expected most months; look for a line that grew.                                 |
| Budget at 100% (US$60), or forecast above it | The ceiling is reached or will be                                                                | Find the line that grew. If it is requests or data transfer, a flood is the likely cause: the request limits are in `infra/environment/*.tfvars`. The test environment's alarms and health check should be off (`alarms = false`). |

Failures the alarms cannot report: a failed run in the test environment, and a
production run that fails before it has its AWS identity. For those, GitHub's
own email about a failed workflow run is what tells you.

## 8. Prove the alarms

Done once, in the test environment, and recorded in
`docs/records/alarm-proofs.md`.

1. In a pull request, set `alarms = true` and `forced_failure = true` in
   `infra/environment/test.tfvars`. Merge it.
2. **Error rate.** Holding the test access password as the `vd_access` cookie,
   ask for `https://test.virtuoso.andrefellipelabs.com/v1/forced-failure` at
   least 20 times within 5 minutes. Each answers 500. The email arrives within
   about 10 minutes; a second arrives when the rate clears.
3. **Health.** Stop the test database for a few minutes (RDS, `vd-test-db`,
   "Stop temporarily"), wait for the email, start it again, wait for the
   second email.
4. In a second pull request, set both back to `false`. Merge it. The alarms
   and the health check no longer exist in test, and the address
   `/v1/forced-failure` answers `notFound` again. It always answers `notFound`
   in production: Terraform refuses `forced_failure = true` there, and so does
   the server.

## Things that happen by themselves

Nothing renews or rotates by hand. The certificate renews itself; backups,
log expiry after 30 days and the removal of Releases older than the ten most
recent are automatic. The workflow `compare` runs weekly for test and reports
anything in AWS that differs from the repository; for production, start it by
hand.

## After the first month

Compare each line of the cost estimate in the infrastructure specification
with the bill, add a short record of the comparison under `docs/records/`, and
correct the estimate.

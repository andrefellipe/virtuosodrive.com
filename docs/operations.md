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
3. `infra/setup/github-settings.sh`. It stores the pipeline's two identities,
   the state bucket's name and the alarm topic's name as repository secrets,
   makes `aws-migration` the default branch, creates the `production`
   environment with you as required reviewer, and protects the branch. If
   GitHub's plan for the repository does not allow a required reviewer or
   branch protection, the script stops and says so.

   Before it changes anything on GitHub, the script checks that you are
   signed in to GitHub and to AWS, and reads from Terraform every value it
   is going to store. If the AWS sign-in is missing or has expired, or any
   value cannot be read or is empty, it stops, says which, and has stored
   nothing: sign in again and run it again. (Run with an expired AWS sign-in
   on 2026-11-27, the earlier script stored one secret with an empty value.
   The pipeline kept working, because the workflows then still read the
   variable of the same name, and a second run put it right.)

4. Merge the first pull request. The pipeline builds both environments.

**Once, after the change that made those four names secrets is merged**
(Unit U1, Step 21): run `infra/setup/github-settings.sh` again, signed in to
GitHub and to AWS as for the setup. Do it
before the next run of the pipeline if you can. It stores the four names as
secrets and then removes the four variables that held them
(`AWS_ROLE_TEST`, `AWS_ROLE_PRODUCTION`, `TF_STATE_BUCKET`,
`ALARM_TOPIC_ARN`). `AWS_REGION` stays a variable. Nothing breaks if a run
starts before you have done it: for this one release each workflow reads the
secret first and the variable if there is no secret. Until you have run it,
the step that takes the identity still prints the role's full name, account
number included; everything after that step is already masked. Check
afterwards on GitHub, Settings, "Secrets and variables", Actions: four
secrets, and one variable.

## The AWS account's number in workflow logs

The repository is public, and so are its workflow logs. The account's number
is not a credential, but it is kept out of them:

- The four names that contain it are secrets, so GitHub prints `***` in
  their place.
- In every job that takes an AWS identity, the step straight after reads the
  account's number and tells GitHub to mask it for the rest of the job.
  Terraform's plan, bucket names and AWS's error messages then show `***`
  where the number would be.

What this does not cover:

- **Logs of runs made before this.** They still show the number, in the step
  that takes the identity and in Terraform's plans. Removing them is your
  decision; it also removes the record of those runs (the record of
  Deployments, which the pipeline reads, is kept elsewhere and is not
  affected). In the repository's folder, to remove one run and its logs:
  `gh run delete <run id>`. To list the runs of one workflow with their
  identifiers:
  `gh run list --workflow deliver.yml --limit 100 --json databaseId,createdAt,conclusion`.
  The workflows that have taken an identity are `deliver`, `go-back`,
  `compare` and `prove-identity-limits`. On the website: Actions, open the
  run, the menu at the top right, "Delete all logs" (keeps the run, removes
  its logs) or, from the list of runs, the run's menu, "Delete workflow
  run". Settings, Actions, General, "Artifact and log retention" shortens
  how long logs are kept from now on; it does not remove existing ones
  sooner.
- **Files a run uploads.** Masking applies to logs, not to uploaded files.
  The two the pipeline uploads (the built Release, and the end-to-end tests'
  report when they fail) are made without the account's number.
- **A run with debug logging switched on**, or a step added later that
  prints the number in another form (encoded, or split across lines). Keep
  new steps to plain output.

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
   100-call measurement there. The measurement starts at most 8 calls a
   second, to stay under the test environment's own request limit of 10 a
   second, so it takes about 15 seconds. If it reports calls answered 429,
   something else was calling the test site at the same time, or the limit
   was lowered: it is not a fault of the server.
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

Two switches in `infra/environment/test.tfvars` do it, each by a pull request.
Neither touches the first database: it keeps running, with its data, the
whole time.

- `restored_copy_time`: a moment, written in UTC as `2026-11-27T03:00:00Z`.
  While it is set, a second database, `vd-test-db-restored`, exists beside
  the first, restored from the first to that moment. Both functions are
  allowed to sign in to it from the run that creates it.
- `use_restored_copy`: while `true`, the server and the change runner are
  pointed at the copy. Terraform refuses it unless `restored_copy_time` is
  set.

**Make a copy.**

1. Choose the moment. It must lie inside what the backups cover, which this
   prints (the latest moment is usually about five minutes ago):

   `aws rds describe-db-instance-automated-backups --db-instance-identifier vd-test-db --query 'DBInstanceAutomatedBackups[0].RestoreWindow'`

2. In a pull request, add `restored_copy_time = "<the moment>"` to
   `test.tfvars`. Merge it.
3. The deployment creates the copy. Expect this run to take much longer than
   usual. Nothing is pointed at the copy yet, and the site answers from the
   first database throughout.

   Terraform waits at most 40 minutes for the copy, so that a slow one ends
   the run cleanly inside the job's 60 minutes, and one that finishes at the
   last moment still leaves the rest of the deployment 18 minutes. If it
   gives up, see "When the restore takes too long" below.

   Measured on 2026-11-27 in test: the copy was ready 34 minutes after the
   run began creating it. AWS restored it in 14 minutes. It then took the
   copy's first backup, which took 18 more, because the copy is given the
   first database's 7 days of backups; Terraform waits for that as well. A
   first attempt with a limit of 30 minutes failed during that backup
   (`docs/records/restore.md`). A setting in `infra/` cannot switch the
   copy's backups off at the restore: the AWS provider in use does not pass
   it on.

**Point the site at it.**

4. In a second pull request, add `use_restored_copy = true`. Merge it.
5. The deployment gives both functions the copy's address, runs the database
   changes against the copy, and puts a new version of the server in place.
   The site keeps answering from the first database until that switch, a few
   seconds at the end of the run.

   The first sign-in to a copy is slow. A database that has never been
   signed in to by AWS identity takes a long time over its first check of
   one: 19 seconds when measured on 2026-11-27, where a sign-in to the first
   database usually takes under half a second. The change runner waits for
   it: it gives a sign-in 30 seconds, and if a try fails for any reason
   other than the database refusing the sign-in, it writes one line to its
   log and tries once more. The server is not as patient: opening a
   connection may take 2 of the 3 seconds it gives the database in a
   request, so its own first call to the copy may fail. It did on
   2026-11-27: the first health check answered 503 after 2.3 seconds, and
   the deployment's smoke check after the infrastructure change, which
   tries five times, passed at its second attempt. A person's call in those
   seconds would probably have failed: the page does not try again after
   the answer site information gives when the database fails. That is
   inferred from the code and the log; it was not tried in a browser, and
   how long the window lasted is not known.

**Confirm.**

6. Open the site. The page lists the top folder: that means the server read
   the copy.
7. Which database the running server is given:

   `aws lambda get-function-configuration --function-name vd-test-server --qualifier live --query 'Environment.Variables.DB_HOST' --output text`

   The copy's address begins `vd-test-db-restored.`.

8. `/v1/site-information` answers the same `installedAt` as before, because
   the copy holds the same row. The server answers only with the access
   cookie. This command reads the password from AWS and hands it to `curl`
   on standard input, as a header:

   `aws ssm get-parameter --name vd-test-access-password --with-decryption --query Parameter.Value --output text | sed 's/^/Cookie: vd_access=/' | curl -sS --header @- https://test.virtuoso.andrefellipelabs.com/v1/site-information`

   Written this way the password is not shown in the terminal, is not kept
   in the shell's history, and is not an argument of any program: it
   travels only between the three programs, so it does not appear in the
   machine's list of running commands, where other users of the machine
   could read it. (`--header @-` makes `curl` read its extra headers from
   standard input, one a line. Do not rewrite the command with
   `--cookie "vd_access=..."` or `--header "Cookie: ..."`: either puts the
   password on `curl`'s command line for as long as it runs.)

   Run it before step 4 as well, and compare the two answers.

   If the answer is the password page and not JSON, the AWS sign-in on
   your machine has probably expired. `aws` then prints its error and
   hands nothing on, `curl` calls the site with no cookie, and the site
   answers as it does to anyone without one. Sign in to AWS again and
   repeat the command.

**Go back, and remove the copy.**

9. A pull request sets `use_restored_copy = false` (or removes the line).
   Merged, the site answers from the first database again. Confirm it with
   the command of step 7: the address no longer begins
   `vd-test-db-restored.`.
10. Only then, a further pull request removes `restored_copy_time`. Merged,
    the copy, its backups and its log are deleted. It leaves no snapshot.
    Terraform waits at most 30 minutes for the removal.

**Steps 9 and 10 must be two pull requests. Nothing refuses doing both in
one, and doing so takes the site down.** Terraform checks only that
`use_restored_copy` is not on without a copy; it cannot know which database
the running server was given. Each version of the server keeps the database
address it was published with, and the running version changes only at the
deployment's switch step, near the end of the run. In a single pull request
the order would be: Terraform removes the copy at once; the server that is
still running was published with the copy's address and can no longer reach
a database; the deployment's first smoke check, which tests the running
version straight after Terraform, fails; the run stops there, before the
switch, and ends as `notPutInPlace`. The site then answers 503 from health
and 500 from site information until someone acts.

If that has happened:

- Go back in test (procedure 3). The previous Release is the one from before
  the site was pointed at the copy, and its version of the server has the
  first database's address. Then start the failed `deliver` run's failed
  jobs again ("Re-run failed jobs"): the smoke check now passes and the run
  goes on to publish a version on the first database.
- If more than one Release was deployed while the copy was in use, the
  previous Release points at the copy too and going back does not help.
  Then put `restored_copy_time` back by a pull request, with
  `use_restored_copy` still off: the copy is restored under the same name,
  which should give it the same address, the running server reaches it
  again, and the same run goes on to publish a version on the first
  database. Remove the copy in a later pull request.

**Changing the moment.** Changing `restored_copy_time` to another moment
replaces the copy: Terraform removes it and restores a new one in the same
run. Do not do that in one step. While the site is pointed at the copy it
takes the site down for the length of a restore, 34 minutes when measured;
and even when nothing is pointed at it, the removal and the restore
together may wait up to 70 minutes, which is longer than the job's 60. Change the moment as steps 9 and 10, then
steps 1 to 3 with the new moment.

**When the restore takes too long.** If AWS has not finished after 40
minutes, Terraform stops waiting and the run fails, with the Deployment
recorded as `notPutInPlace`. This happened on 2026-11-27, when the limit
was 30 minutes and the copy's first backup, not the restore, outlasted it. The site is not
affected: nothing was pointed at the copy. What is left: the copy, which AWS
goes on creating (and, once restored, backing up); Terraform's
record, which holds the copy marked as incomplete and is not locked; and
whatever else that run changed, which was the copy's log group and each
function's permission to sign in to it. To recover:

1. Wait until this prints `available`:

   `aws rds describe-db-instances --db-instance-identifier vd-test-db-restored --query 'DBInstances[0].DBInstanceStatus' --output text`

2. Remove `restored_copy_time` by a pull request. Terraform deletes the
   incomplete copy.
3. Start again from step 1.

Starting the failed run again would also work in the end, but Terraform
would delete the copy and restore it once more in one run, which is the
slow case above.

The limit exists because of what the alternative leaves. A run that GitHub
stops at 60 minutes while Terraform is still waiting leaves Terraform's lock
in the state bucket, so that the next run stops with "state locked", and may
leave the copy out of Terraform's record. If you ever see that: the lock is
released with `terraform force-unlock` and the identifier the failed run
prints, from `infra/environment` after `terraform init` with the backend
settings the workflow uses; then follow the three steps above. If Terraform
then reports that the copy already exists, it must be brought into
Terraform's record (`terraform import`) or deleted, and deleting a database
by hand, even this copy, is your decision to make, not a step of this
procedure.

**When the run that points the site at the copy fails at the database
changes.** This happened on 2026-11-27 (`docs/records/restore.md`). The
change runner then gave a sign-in 10 seconds and tried once; the copy took
19 seconds over its first check of an AWS identity, so the change runner
gave up while the copy was still signing it in. The network, the
permissions and the copy were in order. The Deployment was recorded as
`notPutInPlace` and the site went on answering from the first database with
the Release it had: the database changes come before the switch, so a
failure there leaves the running version alone. Both functions' settings
named the copy from then on, but the running version of the server keeps
the address it was published with.

What was done about it: the change runner now gives each try 30 seconds and
tries a second time, as step 5 says. If it happens again all the same, the
change runner's log says why each try failed: in CloudWatch, the log group
`/vd/test/db-migrate`, or `aws logs tail /vd/test/db-migrate --since 1h`. A
timeout on both tries means the copy took over 30 seconds twice: start the
failed run's failed jobs again ("Re-run failed jobs"), since a copy that has
been signed in to once answers quickly afterwards. A refused sign-in is not
a slow copy and is not helped by trying again; read the message, which says
what the change runner found.

**What the switches do not do.**

- They do not make the copy the environment's lasting database. The copy has
  no deletion protection, leaves no final snapshot, and is deleted the moment
  `restored_copy_time` is removed or changed. The dashboard and Terraform's
  own protection against removal stay with the first database. Keeping a
  copy for good is a piece of work of its own: a pull request that makes the
  copy the database Terraform protects (moving it in Terraform's record,
  with deletion protection and a final snapshot), points the dashboard at
  it, and only then, in further pull requests, turns off the first
  database's deletion protection and removes it. Terraform refuses to
  destroy the first database in one step.
- They do not carry anything across. What was written to the first database
  after the moment restored to is not in the copy, and what is written to
  the copy while it is in use is lost when you go back. Database changes a
  deployment applies while the copy is in use are applied to the copy only;
  the first deployment after going back applies them to the first database.
- They do not work in production. Terraform refuses both there, so that
  production is never pointed at another database by a two-line change.
  Restoring production means lifting that refusal in a pull request of its
  own, read and approved for what it is.
- They change what going back (procedure 3) returns to. Each version of the
  server keeps the database address it was published with. While the copy is
  in use, going back returns to the first database. After step 9, going back
  returns to the copy. After step 10 the previous Release is step 9's, which
  uses the first database, so going back is safe again; that is the other
  reason steps 9 and 10 are separate. Never remove the copy while the
  previous Release is one that was published while the copy was in use.

The rehearsal in the test environment follows steps 1 to 10; record the time
each step took in `docs/records/restore.md`.

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

**A folder's answer is compressed only for a caller that asks with the
header `X-Accept-Gzip: 1`.** The page sends it with every request for a
folder, and so do the pipeline's gates, the smoke check and the end-to-end
tests. A caller that does not send it, with exactly that value, gets the
same answer uncompressed: a request made by hand with `curl` comes back
plain unless you add `--header "X-Accept-Gzip: 1" --compressed`. The header
is the project's own because the standard one, `Accept-Encoding`, cannot be
used: the server sits behind the edge, the edge passes on only the request
headers its rule lists, and AWS refuses `Accept-Encoding` in that rule (the
first deployment of Unit U3 failed on it on 2026-11-28, and nothing was put
in place). The server does not read `Accept-Encoding` at all. In the log, a
folder entry's `answerBytes` is the size as sent, so the same folder shows
two sizes, one for each kind of caller.

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
   least 20 times within 5 minutes. Each answers 500. The alarm is raised
   within a few minutes of the last failing request, and the email follows;
   a second arrives when the rate clears. (On 2026-11-27 the alarm was
   raised one to two minutes after the last failing request. When the
   emails arrived was not written down.)
3. **Health.** Stop the test database for a few minutes (RDS, `vd-test-db`,
   "Stop temporarily"), wait for the email, start it again, wait for the
   second email.
4. In a second pull request, set both back to `false`. Merge it. The alarms
   and the health check no longer exist in test, and the address
   `/v1/forced-failure` answers `notFound` again. It always answers `notFound`
   in production: Terraform refuses `forced_failure = true` there, and so does
   the server.

**The limits of the pipeline's test identity** are proved the same day, with
no pull request: on GitHub, Actions, `prove-identity-limits`, "Run workflow",
on the branch `aws-migration`. The run takes the test identity and tries
three things it must not be able to do: tag a production resource, change the
budget's notification, and change who may take its own identity. Each attempt
is written so that it would change nothing of substance even if it were
allowed. The run prints, for each, `refused`, `NOT refused`,
`refused, but NOT by an explicit deny` or `could not tell`, and fails unless
all three were refused. For the first and the third attempt, `refused` means
AWS answered that an explicit deny stopped it, which is what the identity's
outer limit is made of; a refusal that only reflects a missing permission
does not prove the limit and fails the run. For the budget, the identity has
no permission at all, and any refusal counts. The run prints no account
number and nothing AWS answered beyond the kind of error.

## 9. Rehearse a deployment that fails

Done once, in the test environment, and recorded in
`docs/records/failing-deployment.md`. It shows that when the database
changes fail, the new version is not put in place and the site keeps
running what it ran.

The switch is `failing_change` in `infra/environment/test.tfvars`, off by
default. While it is `true`, the change runner applies the real pending
database changes as usual and then one more, kept apart in
`db-migrate/rehearsal/`, whose only statement fails at once and changes
nothing. That change is never recorded as applied. Terraform refuses the
switch in production, and so does the change runner itself.

1. Note the version the test environment runs: the `version` in the answer
   of `/v1/site-information`. The page does not show it. The command is in
   step 8 of "Restore the database" above.
2. In a pull request, add `failing_change = true` to `test.tfvars`. Merge
   it.
3. The `deliver` run applies Terraform (the only change is one setting of
   the change runner), passes the smoke check of the running version, and
   fails at "Database changes" with the message "Rehearsal: this database
   change fails on purpose and changes nothing". The steps after it do not
   run. Its summary reads `notPutInPlace`. The jobs for the end-to-end tests
   and for production do not start. GitHub emails you about the failed run;
   no alarm email is sent, because only production's job sends one.
4. Ask `/v1/site-information` again, with the same command. Its `version`
   is the same as in step 1: take the version from that answer, not from
   the page. Then open the test site: the page lists the top folder.
5. In a second pull request, set `failing_change = false` (or remove the
   line). Merge it. The run succeeds and applies no database change.

What to know before using it at another time:

- **Real pending changes are applied first and stay applied.** Each
  database change is committed by itself, so a failure in a later one does
  not undo an earlier one; that is how a real failure behaves, and the
  rehearsal keeps it. In the rehearsal above nothing is pending. If a pull
  request with a real database change is merged while the switch is on,
  that change reaches the test database, the Release that needs it does
  not, and the next successful deployment finds it already applied. This is
  safe because database changes only add, but do not leave the switch on.
- **Every deployment to test fails while the switch is on,** and so nothing
  can reach production. Turn it off with the next pull request.
- The failing change is part of every Release's package, production's
  included, because the same package goes to both. It runs only when the
  change runner's setting `VD_FAILING_CHANGE` is `on`; Terraform never
  gives production that setting, and a change runner told it is in
  production refuses to start with it.

## Things that happen by themselves

Nothing renews or rotates by hand. The certificate renews itself; backups,
log expiry after 30 days and the removal of Releases older than the ten most
recent are automatic. The workflow `compare` runs weekly for test and reports
anything in AWS that differs from the repository; for production, start it by
hand.

**Sample content in the test environment.** Every deployment to test loads
prepared folders and files into "All", so that the end-to-end tests and a
person looking at the test site have something to browse: the sample
loader. It is the change runner started a second time by the pipeline, after
the database changes and before the new server and page are put in place.
There is nothing to do by hand. It makes nothing twice: an entry already
there is found again and left as it is, so it can run at any time. It never
runs in production, by the pipeline's own condition and by its own refusal;
production's "All" stays empty until the migration. If it fails, the
deployment stops as "not put in place" and the test site keeps running what
it ran; the run's log shows the loader's summary, with the key of the sample
entry it stopped at and the kind of failure (never a file's or folder's
name). The sample entries are in `db-migrate/src/samples/sample-set.json`.
The sample files have no contents until downloading is built.

## After the first month

Compare each line of the cost estimate in the infrastructure specification
with the bill, add a short record of the comparison under `docs/records/`, and
correct the estimate.

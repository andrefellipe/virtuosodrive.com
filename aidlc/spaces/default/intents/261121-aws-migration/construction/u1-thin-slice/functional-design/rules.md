# Rules: U1, the thin slice

The rules the thin slice must obey. Groups: BR1 the page and its server call;
BR2 keeping the environments private; BR3 the path from a change to
production; BR4 building the environment from the repository; BR5 hearing
about problems; BR6 going back; BR7 housekeeping.

Sources: stories US9.1 to US9.4 and their criteria
(`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`),
requirements FR12.1 to FR12.7 and the quality requirements named per rule
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the Unit's definition
(`aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`),
and the answers Q1 to Q4 in `functional-design-questions.md`.

```yaml
rules:
  - id: BR1.1
    statement: The site-information call answers with the installed time, the running version and the environment, and only if the database read succeeded.
    category: constraint
    applies_to: SiteStatus
    trigger: A request for site information
    logic: IF the SiteInformation record is read THEN answer with installedAt, version and environment. IF the read fails, takes longer than 3 seconds, or finds no record THEN answer with a Problem, code serverError.
    violation: A Problem with status 500; the reason is logged, not returned.
    source: FR12.2, contract C1

  - id: BR1.2
    statement: The page says the server and database answered only when they just did.
    category: constraint
    applies_to: the page
    trigger: The page opens or is reloaded
    logic: IF the site-information call succeeds THEN show the success line, the version and the environment. IF it fails or does not answer within 10 seconds, after two further tries, THEN show that the server could not be reached and offer to try again. Never show an earlier success.
    violation: The failure view; nothing from a previous visit is shown.
    source: contract C1 (timeouts and retries), Q1

  - id: BR1.3
    statement: The health check says ok only when the server and its database are answering, and says nothing else.
    category: constraint
    applies_to: HealthReport
    trigger: A health check request
    logic: IF the database answers a trivial read within 3 seconds THEN answer ok. OTHERWISE answer with a Problem, status 503, code serverError. This is the one place where code serverError goes with a status other than 500; contract C1 fixes 503 for the health check and lists no other code for it.
    violation: Status 503.
    source: contract C1, FR12.6

  - id: BR1.4
    statement: Every answer carries a request identifier.
    category: validation
    applies_to: every operation
    trigger: Any request
    logic: IF the caller sent an identifier of 1 to 64 letters, digits or hyphens THEN use it. OTHERWISE ignore what was sent and generate one. Return it with the answer and write it in the log entry.
    violation: A malformed identifier is replaced, never rejected and never logged as sent.
    source: contract C1, NFR3

  - id: BR1.5
    statement: Every failure is a Problem, and a Problem reveals nothing internal.
    category: constraint
    applies_to: Problem
    trigger: Any failed request
    logic: IF the address is not an operation THEN code notFound, status 404. IF the request is malformed THEN code invalidInput, status 400. IF anything unexpected fails THEN code serverError, status 500 (503 for the health check alone, BR1.3). This rule covers failures answered by the server's own operations; a refusal for want of the access password happens before them and is covered by BR2.1 and BR2.4. In every case the detail holds no internal name, address, query or stack trace.
    violation: A test that finds internal text in a failure answer fails the pull request.
    source: contract C1, NFR3

  - id: BR2.1
    statement: Until the switch, nothing but the health check can be reached without the environment's access password.
    category: authorization
    applies_to: the page and every operation except the health check
    trigger: Any request
    logic: IF the request carries proof of the environment's access password THEN let it through. IF it does not THEN refuse it and ask for the password. The health check is always let through. A refusal is not a Problem; its shape is that of the mechanism that asks for the password, and it says nothing about the site. Every refusal is recorded (BR5.1).
    violation: The request is refused, with status 401, before it reaches the page or the server's operations.
    source: delivery planning Q6 and Q7, Q2

  - id: BR2.2
    statement: The access password is a secret, different in each environment.
    category: constraint
    applies_to: the access password
    trigger: Setup and every deployment
    logic: The password is generated, not chosen; it is held where secrets are held; it is never in the repository, the page's files, a log entry or a pipeline's printed output. The pipeline reads it to run its tests.
    violation: A secret found in the repository or in the page's files fails the pull request.
    source: project rules (no secrets in source, config or the frontend bundle), Q2

  - id: BR2.3
    statement: Once given on a device, the access password is not asked for again on that device for 30 days.
    category: policy
    applies_to: the access password
    trigger: A correct password is given
    logic: IF the password was correct THEN remember that on the device for 30 days. The way it is remembered must not use the place where later Units carry a signed-in session (contract C1), so that the two never collide.
    violation: None; a forgotten device is asked again.
    source: Q2, contract C1 (session)

  - id: BR2.4
    statement: Repeated wrong access passwords are slowed down.
    category: policy
    applies_to: the access password
    trigger: A wrong password is given
    logic: IF 10 wrong passwords arrive from one network address within 5 minutes THEN refuse further attempts from it for 5 minutes. Like every access refusal, this is not a Problem and carries no code.
    violation: Status 429.
    source: designer's choice; a shared password on a public address invites guessing

  - id: BR2.5
    statement: The access password is removed from production at the switch and stays on the test environment.
    category: policy
    applies_to: the access password
    trigger: The switch (U9)
    logic: Removing it is a change made through the pipeline like any other. This Unit provides the means to turn it on or off per environment; U9 uses it.
    violation: Not applicable.
    source: delivery planning Q6, Q7

  - id: BR3.1
    statement: A pull request cannot be merged while any check fails.
    category: constraint
    applies_to: every pull request to the integration branch
    trigger: A pull request is opened or updated
    logic: IF lint, the type check, any unit or integration test, the check of the infrastructure definitions, or the audit of dependencies fails THEN merging is refused.
    violation: The merge is blocked.
    source: FR12.1, NFR12

  - id: BR3.2
    statement: A pull request cannot be merged when less than 80% of the lines of all new code are covered by tests.
    category: calculation
    applies_to: every pull request to the integration branch
    trigger: The tests have run on a pull request
    logic: Coverage is one figure over all new code in the repository as it would be after the merge; the old application's code and generated files are not counted. IF the figure is below 80% THEN merging is refused.
    violation: The merge is blocked.
    source: FR12.1, NFR12, Q4

  - id: BR3.3
    statement: Changes reach the integration branch only through a pull request merged on GitHub.
    category: authorization
    applies_to: the integration branch
    trigger: Any attempt to change the integration branch
    logic: IF the change is not a merged pull request whose checks passed THEN it is refused. This applies to the maintainer too.
    violation: The push is refused.
    source: FR12.1, delivery planning Q3

  - id: BR3.4
    statement: A merge is deployed to the test environment and the end-to-end tests run against it.
    category: constraint
    applies_to: Release
    trigger: A pull request is merged
    logic: The merged change is built once into a Release; that Release is deployed to the test environment; the end-to-end tests then run against the test environment. Releases pass through this one at a time, in the order they were merged. Waiting for the maintainer's approval does not hold later Releases back.
    violation: A Release that could not be deployed to test is blocked.
    source: FR12.4

  - id: BR3.5
    statement: A Release whose end-to-end tests failed cannot reach production.
    category: constraint
    applies_to: Release
    trigger: The end-to-end tests finish
    logic: IF any end-to-end test fails THEN the Release is blocked; production is unchanged and cannot be given this Release. Only a new Release, from a new merged change, can go on.
    violation: Production deployment is unavailable for that Release.
    source: FR12.4

  - id: BR3.6
    statement: Production receives a Release only after its end-to-end tests passed and the maintainer approved it.
    category: authorization
    applies_to: Release
    trigger: The end-to-end tests pass
    logic: IF the tests passed THEN wait for the maintainer. IF the maintainer approves THEN deploy that same Release, unchanged, to production. IF the maintainer does not approve THEN production stays as it is. Only the newest verified Release can be approved; when a later Release is verified, an earlier one still waiting is superseded and can no longer be approved. Production deployments happen one at a time.
    violation: No deployment.
    source: FR12.4

  - id: BR3.7
    statement: A production deployment is finished only when a smoke check passes against production.
    category: constraint
    applies_to: Release
    trigger: A Release has been deployed to production
    logic: The smoke check, holding the access password, asks production for its health and its site information. IF both answer and the version is the Release's THEN the Deployment has succeeded. IF the Release was put in place and the check fails THEN the Deployment is in place but failing, and the maintainer is told; putting the previous version back is the maintainer's decision (BR6.1). IF applying a change to the database structure or putting the Release in place fails first THEN the Deployment did not put it in place, production runs what it ran before, and the maintainer is told. The same check, with the same three outcomes, ends every Deployment to the test environment.
    violation: The deployment is reported as failed.
    source: team practices (Deployment), delivery plan

  - id: BR4.1
    statement: The budget alarm exists before anything else is created.
    category: constraint
    applies_to: the one-time setup
    trigger: The setup is run in an account
    logic: The setup's first act is to create the budget alarm. IF the alarm cannot be created or confirmed THEN the setup stops and creates nothing at all. Only once the alarm is confirmed does it create its one other thing (BR4.2). Running the setup again changes nothing that already exists.
    violation: Setup stops with a message saying the alarm is missing.
    source: FR12.3, project rule

  - id: BR4.2
    statement: From an account holding only what the setup made, the pipeline builds a complete working environment with no step by hand.
    category: constraint
    applies_to: both environments
    trigger: The pipeline runs
    logic: Everything an environment needs is defined in the repository and created by the pipeline. The one-time setup makes only the budget alarm and what lets the pipeline sign in; both are also defined in the repository. This departs from the wording of FR12.2 and AC9.2.2, which have the pipeline start from an account holding nothing but the budget alarm. The pipeline cannot create its own means of signing in, so the starting point here is the budget alarm plus that one thing. The departure was put to the maintainer in the delivery plan (Bolt 1, "Done when") and approved there.
    violation: A step that needs a person, other than running the one-time setup, is a defect.
    source: FR12.2, NFR15, delivery plan (Bolt 1)

  - id: BR4.3
    statement: The maintainer is emailed when the month's spending reaches 80% and again at 100% of US$50.
    category: policy
    applies_to: the budget alarm
    trigger: Spending crosses a threshold
    logic: IF actual spending for the calendar month reaches US$40 THEN send one email. IF it reaches US$50 THEN send another. The address is given when the setup is run and is not written in the repository.
    violation: Not applicable.
    source: FR12.3, FR12.6

  - id: BR4.4
    statement: Nothing exists in the account that the repository does not define.
    category: constraint
    applies_to: both environments
    trigger: A comparison is asked for, and on every deployment
    logic: Comparing what runs with what the repository defines reports no difference. The domain's existing name records, which predate this work, are the one stated exception.
    violation: A difference is reported to the maintainer.
    source: FR12.2, NFR15, project rule (nothing by hand in the console)

  - id: BR5.1
    statement: Every request to the server is logged and can be found for 30 days.
    category: constraint
    applies_to: RequestLogEntry
    trigger: Any request, successful or not, including refused ones
    logic: Write one entry with the time, request identifier, operation, outcome and duration, and the account if any. A request refused for want of the access password never reaches the server, so the server cannot log it; what refuses it records an entry of the same shape, with the operation given as "access refused", kept with the others. Keep entries 30 days, then remove them.
    violation: A request with no entry is a defect; a test checks one exists.
    source: FR12.5

  - id: BR5.2
    statement: The maintainer is emailed when more than 5% of requests fail on the server over 5 minutes.
    category: policy
    applies_to: production
    trigger: The end of each 5-minute period
    logic: IF, of the requests in the period, more than 5% were answered with a server failure (status 500 or above) THEN send one email. Health check requests are not counted.
    violation: Not applicable.
    source: FR12.6

  - id: BR5.3
    statement: The maintainer is emailed when production fails its health check twice in a row.
    category: policy
    applies_to: production
    trigger: A health check from outside the system fails
    logic: Health is checked from outside every minute. IF two checks in a row fail or do not answer THEN send one email, and no more until health has returned.
    violation: Not applicable.
    source: FR12.6, NFR10

  - id: BR5.4
    statement: No log entry ever contains an email address or a secret.
    category: constraint
    applies_to: RequestLogEntry
    trigger: Any log entry is written
    logic: Entries are built from named fields only; request bodies, credentials and the access password are never written. Before an entry is written, anything in its text fields that has the shape of an email address is replaced with a fixed marker.
    violation: A test that finds an email address in the logs fails the pull request.
    source: FR12.5, NFR5

  - id: BR6.1
    statement: The previous version can be put back through the pipeline.
    category: constraint
    applies_to: Release
    trigger: The maintainer asks for the previous version in an environment
    logic: The pipeline starts a Deployment, direction back, of the environment's previous Release, unchanged, then runs the smoke check. Nothing is rebuilt and the database is not touched. This works the same in the test environment and in production, and whatever state either Release is in.
    violation: If the smoke check fails, the Deployment is in place but failing; the maintainer is told and the environment is left as it is.
    source: FR12.7

  - id: BR6.2
    statement: Going back is rehearsed once in the test environment and the rehearsal is recorded.
    category: policy
    applies_to: the test environment
    trigger: This Unit's completion
    logic: A record kept in the repository states the date, the two versions, and that the site worked after going back.
    violation: The Unit is not done without the record.
    source: FR12.7

  - id: BR6.3
    statement: A change to the structure of the database must leave the previous version of the site working.
    category: constraint
    applies_to: every change to the database structure
    trigger: A pull request contains such a change
    logic: Changes to the structure only add; nothing the previous version reads or writes is removed or renamed in the same release. A change that cannot be made that way is split over two releases. The pull request's checks run the previous Release's tests against the new structure; IF they fail THEN merging is refused. Changes to the structure are applied by the pipeline before the new version starts, and are never undone when going back.
    violation: The merge is blocked.
    source: FR12.7, team practices (Deployment), Q3

  - id: BR7.1
    statement: Installed dependencies are never committed.
    category: constraint
    applies_to: the repository
    trigger: A pull request
    logic: IF a pull request adds files under a folder of installed dependencies THEN it is refused. This Unit removes the folder the old code committed.
    violation: The merge is blocked.
    source: project rule, unit-of-work.md (U1 notes)

  - id: BR7.2
    statement: The working examples this Unit leaves are the pattern later Units copy.
    category: policy
    applies_to: the repository
    trigger: This Unit's completion
    logic: The Unit leaves one server operation with its test, one database access with its integration test against a real database, one end-to-end test, and one infrastructure definition.
    violation: The Unit is not done without them.
    source: team practices (Walking Skeleton)
```

## Summary

| Rule | In one line | Kind |
|------|-------------|------|
| BR1.1 | Site information answers only if the database read worked | constraint |
| BR1.2 | The page never shows a stale success | constraint |
| BR1.3 | Health says ok only when server and database answer | constraint |
| BR1.4 | Every answer carries a request identifier | validation |
| BR1.5 | Every failure has one shape and reveals nothing internal | constraint |
| BR2.1 | Only the health check is reachable without the access password | authorization |
| BR2.2 | The access password is a secret, one per environment | constraint |
| BR2.3 | Asked once per device per 30 days; never collides with sign-in | policy |
| BR2.4 | Wrong passwords are slowed down | policy |
| BR2.5 | Removed from production at the switch | policy |
| BR3.1 | A failing check blocks the merge | constraint |
| BR3.2 | Under 80% coverage of all new code blocks the merge | calculation |
| BR3.3 | Only merged pull requests change the integration branch | authorization |
| BR3.4 | A merge is deployed to test and tested end to end | constraint |
| BR3.5 | Failed end-to-end tests block production | constraint |
| BR3.6 | Production needs passed tests and the maintainer's approval | authorization |
| BR3.7 | A production deployment needs a passing smoke check | constraint |
| BR4.1 | The budget alarm comes first | constraint |
| BR4.2 | The pipeline builds everything else, with no hand step | constraint |
| BR4.3 | Emails at US$40 and US$50 in a month | policy |
| BR4.4 | Nothing exists that the repository does not define | constraint |
| BR5.1 | Every request is logged, kept 30 days | constraint |
| BR5.2 | Email when over 5% of requests fail in 5 minutes | policy |
| BR5.3 | Email when production fails health twice running | policy |
| BR5.4 | No email address or secret in any log | constraint |
| BR6.1 | The previous version can be put back | constraint |
| BR6.2 | Going back is rehearsed once and recorded | policy |
| BR6.3 | Database changes keep the previous version working | constraint |
| BR7.1 | Installed dependencies are never committed | constraint |
| BR7.2 | The slice leaves the examples later Units copy | policy |

# The examples later Units copy

Unit U1 carries no product feature. What it leaves is one working example of
each kind of thing a later Unit adds. No file under `app/` is a pattern to
copy: the old code shows what the application does, not how new code looks.

| To add                               | Copy                                                                                                                                   | And its test                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A server operation                   | `server/src/operations/site-information.ts`, then list it in `server/src/operations/index.ts` and describe it in `server/openapi.yaml` | `server/src/app.integration.test.ts` (through the server, against a real PostgreSQL) |
| A database access                    | `server/src/db/site-information.ts`                                                                                                    | `server/src/db/database.integration.test.ts`                                         |
| A change to the database's structure | `db-migrate/migrations/0001_site-information.sql` (the next file is `0002_...`)                                                        | `db-migrate/src/migrations.integration.test.ts`                                      |
| A call from the page to the server   | `web/src/api/site-information.ts`, which uses the one shared function in `web/src/api/call-server.ts`                                  | `web/src/api/call-server.test.ts`                                                    |
| A part of the page                   | `web/src/status/SiteStatus.tsx`                                                                                                        | `web/src/status/SiteStatus.test.tsx`                                                 |
| An end-to-end test                   | `e2e/tests/thin-slice.spec.ts`                                                                                                         | It is the test                                                                       |
| AWS resources                        | A module under `infra/modules/`, for example `infra/modules/monitoring/main.tf`, used from `infra/environment/main.tf`                 | `infra/environment/tests/naming.tftest.hcl`, and the Checkov run in the pull request |

## The rules each example shows

**An operation**

- It is declared once, with its name, method, path and the shape of its
  query, and added to the one list. It does not log, catch its own unexpected
  failures, or build a Problem: the request steps in `server/src/http/` do
  that for every operation, in one order.
- Its query shape is strict: unknown parameters are refused.
- For a failure it recognises, it throws `OperationFailure` with a code; the
  internal reason goes to the log entry and never into the answer.
- A test checks that `server/openapi.yaml` and the declared list agree. Keep
  the file in its plain block style, which that test reads.

**A database access**

- One function per statement, in `server/src/db/`, called through
  `database.run(...)`, which gives it the kept connection and the 3-second
  deadline.
- Statements use `$1` placeholders with the values passed separately. The
  linter refuses SQL built from template text or by joining text.
- Its test runs against PostgreSQL in a container
  (`db-migrate/src/testing/postgres.ts`). The database is never replaced by a
  stand-in; the linter refuses that too.

**A change to the database's structure**

- It only adds. Nothing an earlier version in reach reads or writes is removed
  or renamed in the same Release; to remove or rename, take two Releases.
- It grants the user `app` exactly what the running site needs on what it
  creates.
- It is never undone when going back, so it carries no way back, and says in a
  comment how a later change would remove what it added.

**AWS services in tests**

- They are replaced at the SDK's boundary: the code that needs one takes it as
  a parameter (see `server/src/app.ts`), and tests pass in a fake.

**AWS resources**

- Every name starts with the environment's prefix (`vd-test-` or `vd-prod-`);
  module outputs named `names` feed the test that checks it. Every resource
  carries the tags `project`, `environment` and `unit`; set `unit` for the
  Unit that adds the resources.
- Every log group is declared, with 30 days' retention.
- A Checkov finding is fixed, or excepted in a `checkov:skip` comment inside
  the resource, with its reason.
- Infrastructure changes add, like database changes: they are applied while
  the previous version of the code is still running.

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

## What Unit U3 adds: the patterns U4 to U8 copy

U3 is the first Unit with a product feature. Its three patterns sit on top of
U1's examples; where the two differ, the later Units follow U3's.

| To add                                                         | Copy                                                                                                                                 | And its test                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| An operation with a value in its path, headers or its own log  | The folder operation, `server/src/operations/folder.ts`                                                                              | `server/src/operations/folder.integration.test.ts` (through the server), `folder.test.ts` (when the database fails) |
| Anything that reads folders or files                           | `server/src/drive/folder-reading.ts` and `file-reading.ts`; never a statement of your own on `items`                                 | `server/src/drive/folder-reading.integration.test.ts`                                                               |
| Anything that changes a folder's list                          | The change step, `server/src/drive/change-step.ts`, called as `db-migrate/src/samples/loader.ts` calls it                            | `server/src/drive/change-step.integration.test.ts`                                                                  |
| A name a person typed                                          | `server/src/drive/names.ts` to normalise and validate; `checkName` and `lowestFreeName` in the change step to ask whether it is free | `server/src/drive/names.test.ts`, and the shared table `server/src/drive/testing/name-cases.ts`                     |
| Logic of the page that decides something                       | The selection function, `web/src/folder/selection.ts`: a pure function, with no part of it in a component                            | `web/src/folder/selection.test.ts`, one case per row of the design's table                                          |
| A screen of the page                                           | `web/src/folder/FolderScreen.tsx`, with its parts beside it                                                                          | `web/src/folder/FolderScreen.test.tsx`                                                                              |
| A rule the database holds                                      | `db-migrate/migrations/0002_items.sql`: a named constraint, no trigger                                                               | `db-migrate/src/items-table.integration.test.ts`, one direct write per rule                                         |
| An end-to-end test of a journey                                | `e2e/tests/browsing.spec.ts`, with the shared `e2e/tests/folders.ts`                                                                 | It is the test                                                                                                      |
| A check of the deployed test environment that blocks a Release | A gate in `scripts/src/gates.ts`, run from `deliver`                                                                                 | `scripts/src/browsing-checks.test.ts`, against a stand-in environment                                               |

**The folder operation** shows what U3 added to an operation's declaration:

- A path may hold a named part in braces, as in `/v1/folders/{folderId}`.
  The operation declares the shape of the path's values (`params`); the
  request steps check them before the operation runs. An operation whose
  answer must not teach what its identifiers look like declares that a
  failed check is "not found" (`invalidParams`); otherwise it is
  `invalidInput`, as for every other input.
- It names the request headers it reads (`headers`) and is handed no other.
- It may name response headers, answer with no body, and hand back JSON it
  has already written out and perhaps compressed (`server/src/http/body.ts`
  decides when compressing is worth it, and only for a caller that sent the
  header `X-Accept-Gzip: 1`; why not the standard header is told in
  `docs/operations.md`, section 6).
- It declares the fields it adds to its log entry, with their types
  (`logFields`), and adds them with `log(...)` or with its answer. A field
  that was not declared is dropped. No name of a file or folder, and nothing
  a caller sent that failed its check, is ever logged.
- A failure it states on purpose is answered as `{ problem: "notFound" }`,
  made by one function that takes no argument, so that nothing can vary the
  answer. A database error's own message is never passed on to the log: it
  can quote a name (`server/src/drive/store-errors.ts`).
- A known way to fail has a name in the log's `fault` field
  (`server/src/log/fault.ts`).

**The change step** is the one way to change a folder's list, and it is
binding on U6, U7 and U8:

- One transaction: lock the folder's row, check it is still visible, check
  the name or take the lowest free one, take the next position, write, raise
  the folder's version. A later Unit adds its change as another function in
  `change-step.ts`, with the same steps in the same order; none compares
  names, takes a position or raises a version anywhere else.
- Whether two names are the same is decided by the database alone. The code
  passes the text as a parameter and the database folds it; no code folds
  case.
- A refusal is an answer (`notFound`, a name code, `nameAlreadyUsed`) for
  the caller to turn into its own. `FolderBusyError` and `StoreRefusedError`
  are faults, reported as `serverError`.
- A later Unit that must lock two folders takes them in the order of their
  identifiers.
- In U3 the server's database user can only read `items`, and no operation
  reaches the change step. The Unit that adds the first change route gives
  that user the right to write, together with the check of who is asking.

**The selection function** shows how the page keeps logic out of components:

- `select(rows, selection, input)` answers the new selection and, sometimes,
  an effect for the screen to carry out. The components turn clicks, keys
  and taps into inputs and show the result; they decide nothing.
- Selection, anchor and focus are held by item identifier, never by place.
- The screen's state is one value; the list is in exactly one of its five
  states; each opening of a folder carries a number, and an answer for an
  earlier number is dropped.

**The character lists of the name rules** come from one data file,
`server/src/drive/name-characters.json`. Run
`node scripts/src/name-characters.ts` after changing it; the repository
checks fail when what is generated from it is out of date.

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
- It is one new file in `db-migrate/migrations/`, numbered after the last. No
  test names the files or counts them: the tests of the change runner read
  the folder (`db-migrate/src/testing/changes.ts`). Add assertions about what
  your change creates; do not add its name to a list.
- The pull request's check "Compatibility with every version in reach" runs
  the tests under `server/` of the Release running in production, and of the
  one going back would restore, against your SQL files. That check relies on
  two things staying true, in every Release: the server's tests live under
  `server/`, and they get their database from
  `db-migrate/src/testing/postgres.ts`, which applies the folder
  `db-migrate/migrations`. If the check fails on your pull request, your
  change breaks something the running version reads: add in this Release,
  and remove or rename in a later one.
- `db-migrate/rehearsal/` is not a place for changes. It holds the one change
  that fails on purpose (`docs/operations.md`, procedure 9).

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

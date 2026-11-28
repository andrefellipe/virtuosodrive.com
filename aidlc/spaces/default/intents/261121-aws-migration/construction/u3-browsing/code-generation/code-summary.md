# Code Summary: U3, browsing and selecting

What was built from the approved code plan
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/code-generation/code-generation-plan.md`),
on the branch `u3-browsing`, on 2026-11-27. All seventeen steps are done.
Nothing was deployed, committed or pushed, and no library was added.

The local checks pass. What only a deployment can show is written and has
not been run: the 19 end-to-end tests, the four gates against a real
environment, and the new steps of the pipeline. No browser was available on
this machine, so the page was never seen in one.

## Results of the checks

Run on 2026-11-27, after the last change of the repair that followed the
first review (see "Corrected after the first review"). The three commands
for `infra/setup` were run before that repair, which changed nothing there.

| Command | Result |
|---------|--------|
| `npm run check`, on the unchanged tree, before anything was edited | Passed: 28 test files, 223 tests; 91.78% of lines; page 75,323 bytes compressed |
| `npm run check`, at the end | Passed, exit 0: formatting clean; lint clean; type check clean; 56 test files, 760 tests, all passed; build succeeded; "Repository checks passed (902 files)" |
| Coverage, from that run | 93.79% of lines (1966 of 2096) against the floor of 80%; statements 93.65%, branches 91.87%, functions 93.06%. One figure over U1's and U3's code together; the threshold in `vitest.config.ts` was not touched |
| The page's size, from that run | 93,859 bytes compressed, against the limit of 307,200 |
| `terraform -chdir=infra/setup fmt -check -recursive` | Exit 0 |
| `terraform -chdir=infra/environment fmt -check -recursive` | Exit 0 |
| `terraform -chdir=infra/setup validate` | "Success! The configuration is valid." |
| `terraform -chdir=infra/environment validate` | "Success! The configuration is valid." |
| `terraform -chdir=infra/setup test` | "Success! 3 passed, 0 failed." |
| `terraform -chdir=infra/environment test` | "Success! 26 passed, 0 failed." Three of the 26 runs are new (`tests/browsing.tftest.hcl`) |

Not run here: Checkov, the dependency audit and the secrets scan (they run
in the pull request's checks); `npx playwright test` (it needs the deployed
test environment, and no browser is installed on this machine).

### Tests, by kind

537 tests are new: 760 at the end against 223 before. The plan estimated
about 230; the difference is tables run row by row (the name cases, the
listed icons, the refused identifiers and versions).

| Kind | New | Where |
|------|-----|-------|
| Unit | 381 | `server/src/drive` (97), `server/src/http` and `server/src/log` (37), `server/src/operations` (12 in `folder.test.ts`, 2 added to `index.test.ts`), `server/src/openapi.test.ts` (1 added), `db-migrate/src` (29), `scripts/src` (60), `web/src` (143) |
| Integration, against PostgreSQL 18.1 in a container | 152 | The `items` table (63), the change step and the name operations (41), reading folders and files (13), transactions on the server's access (8) and on the change runner's connection (4), the folder operation through the function's entry point (16), the sample loader (7) |
| Large integration (4,000 items) | 4 | `server/src/drive/folder-reading.large.integration.test.ts`, `server/src/operations/folder.large.integration.test.ts` |
| Terraform | 3 runs | `infra/environment/tests/browsing.tftest.hcl` |
| End-to-end, written and not run | 11 tests in 2 new files, in three engines at two widths | `e2e/tests/browsing.spec.ts` (8), `e2e/tests/selecting.spec.ts` (3); and of U1's 8, 6 changed and 2 only given a tag |

The quick command of the test instructions leaves the large tests out
because it leaves every `*.integration.test.ts` out; `npm run check` runs
them. No setting was needed for that.

## What was built, step by step

### Step 1: structure and configuration

- `server/src/drive/name-characters.json`: the one list of white-space characters (25) and invisible formatting characters (170), with the Unicode version it was taken from.
- `scripts/src/name-characters.ts`: generates from it the server's patterns (`server/src/drive/name-patterns.generated.ts`) and the text of the database's five checks on a name (`db-migrate/generated/items-name-checks.sql`), and puts those checks into the change file between two marker lines. `--check` fails when anything is out of date; the repository checks run the same comparison.
- The change runner imports the Drive module from the server's package; the build bundles it, with the sample set, into the change runner's package. Seen in the built file. The server's built package holds no statement that writes to `items`.

### Step 2: test runner

The unit-scoped command of the test instructions ran as the project stood,
before any test of this Unit existed: 24 files, 185 tests, passed.
Testcontainers started `postgres:18.1`. Nothing in `vitest.config.ts` was
changed.

### Steps 3 and 4: the `items` table

- `db-migrate/migrations/0002_items.sql`: one table for folders and files, every rule a named constraint or index, no trigger; the top folder "All" inserted with the table; `app` granted the right to read and no other.
- Tests in `db-migrate/src/items-table.integration.test.ts`, each breaking one rule by a direct write and expecting a refusal that names it: the fifteen name cases; every listed character; the rights of `app`; the change file applied to a database that has only U1's change, and applied again.
- `db-migrate/src/testing/items.ts`: direct writes for tests, shared with the server's tests.

### Steps 5 and 6: names, identifiers, the version tag

`server/src/drive/identifiers.ts`, `names.ts`, `version-tag.ts`: pure
functions, no database, no case folding. The name cases are one table
(`server/src/drive/testing/name-cases.ts`) used by the module's tests and by
the database's.

### Steps 7 and 8: data access

- `server/src/db/database.ts` (change 6): `transaction(...)`, under the same deadline; on any failure the transaction is rolled back where the connection still answers and the connection is discarded.
- `server/src/drive/walk.ts`, `folder-reading.ts`, `file-reading.ts`, `change-step.ts`, `store-errors.ts`. Two fixed statements answer a folder, "the walk" and "everything"; both open with the same recursive part, word for word. The change step is one transaction: lock, walk, name, position, write, raise the version.
- Tests cover every point Step 8 lists, including twenty additions at once, a held folder, twenty readers of a held folder, a change landing between the two statements, and the 65-level chain.

### Steps 9 and 10: the request steps and the folder operation

- Changes 1 to 5 in `server/src/http/operation.ts`, `request-steps.ts`, `problem.ts` and `server/src/log/entry.ts`; new `server/src/http/body.ts` (when compressing is worth it) and `server/src/log/fault.ts` (the four named faults).
- `server/src/operations/folder.ts`: `GET /v1/folders/{folderId}`. `server/openapi.yaml` and its test (change 9).
- U1's own tests of the request steps, the log entry and the application pass unchanged.

### Steps 11 and 12: the sample loader

- `db-migrate/src/mode.ts`, `client-transactions.ts`, `samples/sample-set.json` (570 items), `samples/sample-set.ts`, `samples/loader.ts`; `db-migrate/src/index.ts` takes the pipeline's instruction.
- Loading twice gives the same table as once; an interrupted load, repaired and run again, gives the same table as a clean one; production is refused before any connection.

### Steps 13 and 14: the page

- `web/src/api/call-server.ts` (change 7) and `web/src/api/folder.ts`.
- `web/src/folder/`: `address.ts`, `selection.ts`, `formatting.ts`, `icons.ts`, `FolderScreen.tsx`, `FileList.tsx`, `Breadcrumb.tsx`, `ActionBar.tsx`, `StatusLine.tsx`.
- Sixteen icons copied unchanged from `app/public/images/icons/` into `web/src/assets/icons/`, and one new `check.svg`. Nothing under `app/` was changed.
- `web/src/styles.css` carries the list, breadcrumb and action row, with changes 1, 3, 4, 6 and 7. `web/src/App.tsx` shows the folder screen; U1's status component and its tests stay.

### Step 15: infrastructure, pipeline, end-to-end tests

- `infra/modules/edge/main.tf`: the server's origin request policy passes five headers (change 8). `infra/modules/monitoring/main.tf`: two saved searches and one dashboard view drawn from the log.
- `.github/actions/deploy/action.yml`: the step "Sample content", only when the environment is `test`; the smoke check of the new version is told the Release has browsing.
- `scripts/src/smoke-check.ts`, `gates.ts`, `cli.ts` (`gate unchanged|compressed|speed|not-stored`), `repository-rules.ts` (the check of the deploy action's step), `earlier-release-tests.ts`.
- `.github/workflows/deliver.yml`: four gate steps, and the second half of the compatibility check. `.github/workflows/checks.yml`: one sentence of its note.
- `e2e/tests/browsing.spec.ts`, `selecting.spec.ts`, `folders.ts`; `e2e/tests/thin-slice.spec.ts` changed as listed below.

### Step 16: documentation and traceability

`docs/operations.md` (the sample loader, under "Things that happen by
themselves"), `docs/examples.md` (the patterns U4 to U8 copy), empty dated
rows in the four records, and this file with `source-manifest.json` and
`traceability.json`.

### Step 17: corrections from review 13 of U1's records

| Correction | Done |
|------------|------|
| `docs/records/restore.md`: "would have been shown an error" is an inference, and which smoke check | Reworded: inferred from the code and the log, not tried in a browser; the smoke check after the infrastructure change |
| `docs/operations.md`, procedure 4, step 5: the same | Reworded the same way |
| `docs/operations.md`: "arrives within about 10 minutes" | Removed; it now gives the one measured figure and says the arrival times were not written down |
| `docs/records/alarm-proofs.md`: the first `prove-identity-limits` run | A paragraph says its log is public and from before Step 21 |
| `docs/records/restore.md` no longer says the removal's result is owed | **Nothing to change.** The record already carries the removal's result (pull request 32's row), and no sentence in it says that result is owed |

## U1's tests that were changed

No test of U1's was removed. These were changed, each because what it
asserted is no longer so. All but one assert as strictly as before. The one
is the end-to-end test of the could-not-load view, which asserts less: two
things it used to assert are gone, and it now sets the focus by hand. It is
in the table below and under "For the maintainer to decide".

| File | Test | Change, and why |
|------|------|-----------------|
| `server/src/operations/index.test.ts` | "holds the health check and site information, and nothing else" | The list now holds the folder read as well; the test spells out all three |
| | "has a different name and address for every operation, all under /v1/ in kebab-case" | The pattern also allows a named part in braces; fixed parts must still be kebab-case |
| | "never adds the deliberately failing operation in production, even if asked" | The expected list gained `getFolder` |
| `web/src/status/SiteStatus.test.tsx` | "shows the site's name and logo around the status" | The App shows the folder screen; the test asserts that, and that the status view is no longer on the page |
| `e2e/tests/thin-slice.spec.ts` | "the page shows the answered view with the version and the environment" | The page no longer shows them; the test opens the page and asks the server for both |
| | "a person without the access cookie types the password..." | One line: the page a person gets into is the folder list |
| | "a wrong password shows the password page again..." | One line: asserts that neither Release's page is shown |
| | "the could-not-reach view appears when the server is blocked, and Try again works by keyboard" | Re-pointed at the list: three tries, then "Try again" by keyboard. No longer asserted: the request identifier shown to the visitor, and the focus moved to "Try again" by itself. The list's design asks for neither |
| | "each view of the page, and the password page, pass the accessibility scan" | Scans the page as it opens and the password page; the list's five views are scanned in `browsing.spec.ts` |
| | "the page contacts no address but the site's own" | Also opens the sample folder "One of each kind", so that the icons are covered |

Three of U1's end-to-end tests, and one new one, carry the tag
`@later-server` (see "The second half of the compatibility check"). For two
of U1's three, "without the access cookie the page and site information are
refused..." and "the entry document is never stored...", the tag is the only
change.

One text of U1's changed: the `detail` of the `notFound` Problem, from
"There is no such operation." to "There is nothing at this address.", because
a folder that is not found gets the same Problem and the answers must not
differ. No test read the old text.

## Where the code differs from the plan or the designs

1. **`name_key` is compared by code points.** The column is given the collation `pg_c_utf8` as well as being derived with it. With the database's default collation, the unique index on it took about 12 milliseconds for each name of 255 four-byte characters: filling the 4,000-item test folder took 100 seconds, and takes 0.07 now. The design names `pg_c_utf8` for the derivation only. What two names are "the same" is unchanged.
2. **Two rules more than the plan lists** in the table: an item is not its own parent; and the one item without a parent is a folder named "All" that is never deleted, which holds in the structure what `entities.md` says of the top folder.
3. **The lists are from Unicode 18.0**, as Node.js 24 carries it. PostgreSQL 18.1's own tables are Unicode 16.0. The checks list the characters themselves, so the difference changes nothing they refuse.
4. **`content_id` and the two account columns are of the type `uuid`.** The designs give no type. Neither stored contents (U4) nor accounts (U2) is designed yet.
5. **A deleted sample folder is created with what it holds in one change step.** The change step takes `contents` for a new folder. The reliability design asks for "created and marked deleted in that same transaction", and nothing can be added to a folder once it is hidden.
6. **The log's field for the time taken is `durationMs`**, U1's name; the designs say `duration`. The saved searches read `durationMs`.
7. **`Server-Timing` and `Vary` are sent only with a full answer**, so that the four not-found answers stay equal byte for byte.
8. **The focus ring is `#0454a0` for every control.** U1's `#f5a623` has a contrast of 2.03 to 1 on white, under the 3 to 1 that NFR6.23 asks for. U1's button ring changed with it. The contrasts are recorded in `web/src/styles.css`.
9. **The list is a native table with the role `grid`**, and every part's role written out. Rows that expose "selected" belong to a grid, and below 768 pixels the rows are laid out as blocks. A one-off scan inside jsdom found no violation in any of the five views; that is not the pipeline's scan in real browsers.
10. **A tap is told from a click by when a finger last touched the list**, within 800 milliseconds, not only by the kind of pointer the click reports.
11. **End-to-end "hidden items" cannot open the deleted sample folder's address**: nothing the site answers reveals its identifier. The test opens an identifier that belongs to nothing. That the two answers are identical is proved at the server (`server/src/operations/folder.integration.test.ts`).
12. **The touch journey is skipped in Firefox.** Whether Firefox's emulated tap behaves as a finger's does could not be tried here.
13. **One tag was added to Playwright tests** (`@later-server`), which the designs do not mention; see below.
14. **The page's title is the folder's name alone** ("All" for the top), as the design says; while no folder is shown it is "Virtuoso Drive".

## The second half of the compatibility check

Built as far as it can be built honestly, in `deliver`, after the gates.

- **What it does.** It checks out the Release running in production beside the new one and runs that Release's own end-to-end tests against the test environment, which now runs the new server. A failure blocks the Release.
- **What it covers.** The earlier Release's tests of the server's operations and of the access gate: for U1's Release, three of its eight end-to-end tests ("a wrong password...", "without the access cookie...", "the entry document is never stored..."). From this Release on, the tests that carry the tag `@later-server`.
- **What it does not cover.** The earlier Release's tests of what its own page shows. The test environment serves the new page, so those tests cannot pass, and they are not run. That an earlier page works against the new server is therefore still not tested anywhere.
- **Smallest alternative for the missing part, for the maintainer to decide.** Each Release's entry document is kept in the test environment at `/r/<version>/index.html`. The earlier Release's page tests could be run against that address, if the tests opened the page through one helper that takes the entry document's address. U1's tests do not, so this can start only with a later Release.

## Written and not run

| What | Why | First run |
|------|-----|-----------|
| The 19 end-to-end tests (11 new, 6 of U1's changed, 2 of U1's only given a tag), 114 with the six projects | They need the deployed test environment with its sample content, and no browser is installed here. They type-check, lint, and Playwright lists them | The pipeline, after U3's first deployment |
| The four gates against a real environment | The same. Each is unit-tested against a stand-in environment (30 tests) | The same |
| The step "Sample content" of the deploy action, and the smoke check's folder request | They run only in the pipeline | The same |
| The second half of the compatibility check in `deliver` | The same; its choice of tests is unit-tested | The same |
| The change to the edge's header rule, and the saved searches and dashboard view | Terraform validates and plans them against a stand-in; nothing was applied | The same |

## Not verified

- **That the version header and a compressed answer pass through the edge and the entry point** in both directions. The two gates exist for this.
- **That AWS accepts `Accept-Encoding` in the edge's rule.** If it refuses, Terraform fails in test before anything else changes. *Settled on 2026-11-28: AWS refused it, and Terraform failed in test before anything else changed. Step 18 replaced the header; see "The server is told by a header of our own that a caller accepts gzip (Step 18)". What is still not verified is that AWS accepts `If-None-Match` and `X-Accept-Gzip` in the same rule.*
- **How the page looks and behaves in a browser**: the layout at 320 pixels, the 44-pixel sizes, the colours, the focus ring, touch.
- **The dashboard's log view in AWS.** Its search is now a count grouped by outcome and by five minutes, shown as a table. Neither the search nor the view has been run against AWS; and whether the service would draw it as one line per outcome, as the monitoring design pictures it, has not been seen and is not relied on.
- **Case in letters newer than the database's tables** (the reviewer's residue). The character lists are from Unicode 18.0; PostgreSQL 18.1 folds case by its own tables, which are Unicode 16.0. A pair of letters that was given upper and lower case only in Unicode 17 or 18 is not folded by the database, so two names that differ only in the case of such a letter would count as two names, not one. No test covers this, and none can make the database fold what its tables do not hold; it ends when the database's tables catch up.
- **Speeds.** None was measured. The rows are in `docs/records/measured-speeds.md`.
- **That the 2 seconds the server allows for opening a connection suffice for a first folder request after a quiet period.** The plan leaves that question to a proposal of its own.

## For the maintainer to decide

1. **The rehearsal "a deployment whose sample loading fails" cannot be done as designed.** It needs a failing sample entry to be merged, and the pull request's checks refuse one twice: the test of the sample set, and the test that loads it into a real database. U1 met the same wall and built a switch. `docs/records/failing-deployment.md` says so.
2. **The page half of the compatibility check** is missing; an alternative is described above.
3. **The types of `content_id` and the account columns** (`uuid`) bind U4 and U2.
4. **Sample names are partly Portuguese, partly English** ("1º Período", "Twenty items"). The end-to-end tests find folders by these names.
5. **What a person is given when the list cannot be loaded, compared with U1's page.** U1's end-to-end test of this view was re-pointed at the list (`e2e/tests/thin-slice.spec.ts`, "the could-not-load view appears when the server is blocked, and Try again works by keyboard") and now asserts less. It no longer asserts that the request identifier is shown to the visitor, nor that the focus moves to "Try again" by itself; and the test now puts the focus on "Try again" by hand before it presses Enter. The designs of U3's list ask for neither, so the page was built without them and the test follows the page. What that means for a person on the page:
   - **Kept:** after three tries the page says "The list could not be loaded." and offers "Try again", which works with a mouse, by touch, and by keyboard once it has the focus.
   - **Gained:** the breadcrumb stays and its steps are links that work on their own, so a person can move to another folder without trying again.
   - **Lost, the request identifier.** U1's page showed "Request identifier: ..." under the message. The list shows none. A person who reports "the list could not be loaded" can no longer quote the one value that finds their request in the log (`docs/operations.md`, procedure 6); the maintainer has to search by time instead.
   - **Lost, the focus on "Try again".** On U1's page the keyboard was put on "Try again" when the failure appeared, so Enter tried again at once and a screen reader landed on the control. On the list the focus stays where it was; a keyboard user must move to "Try again" with Tab. The failure is also not said in the polite status line, which says nothing in this state.
   - **To decide:** whether the list's could-not-load view should show the request identifier, move the focus to "Try again", or both, as U1's page did. Either is a small change to `web/src/folder/FileList.tsx` and `FolderScreen.tsx` with its tests, and would let the end-to-end test assert again what it used to. Nothing was changed for this in the repair.

## Corrected after the first review

The first review of this Unit's code (NOT-READY: one Major, three Minor) was
answered by one repair on 2026-11-27. Only these four points were touched.

1. **Major: a transaction given up at its deadline could keep part of its work.** Found by the reviewer in `Database.transaction` (`server/src/db/database.ts`). When the deadline passed, the caller was answered with a failure, but the work was still running on the same connection. The rollback was queued behind the statement in flight, and any statement the work sent afterwards was queued behind the rollback, so it ran outside the transaction and was kept on its own. A change step could have lost its insert to the rollback while its version rise was kept, or the reverse.
   - **Changed:** from the moment a transaction is given up, because its deadline passed or its work failed, the connection handed to the work refuses every further statement by throwing `TransactionAbandonedError`. The mark is set before the rollback is sent; a statement sent after the deadline is refused even before that; and the commit is not sent for work that ends after its transaction was given up.
   - **New tests** in `server/src/db/transaction.integration.test.ts`, against PostgreSQL: "refuses every statement the work still sends after the deadline has passed, so that neither its earlier write nor its later one is kept" (the work writes a file, pauses past the deadline, then tries a second write and a version rise; asserted: the caller gets the deadline's failure, the work is refused at its next statement with `TransactionAbandonedError`, the folder holds neither file, and its version is unchanged), and "refuses a statement sent on a transaction whose work has already failed". The earlier deadline test, whose work ends with a pause, is kept.
   - **Seen without the change:** with the refusal switched off for one run, both new tests failed, at the assertion that the late statement is refused (the late statement had been sent to the connection and ended with it). That run stopped there, so whether the late write was kept in that run was not looked at.
   - **`db-migrate/src/client-transactions.ts`, checked as asked.** It has no deadline: it waits for the work to end before it sends the commit or the rollback, so it cannot give up on work that is still running, and the fault above could not arise from the change step, whose statements run one after another. The weaker form of the same shape was there all the same: work that failed, or ended, while a branch it had not waited for was still to send a statement, would have had that statement kept on its own. The same guard was added, and a new file `db-migrate/src/client-transactions.integration.test.ts` (4 tests) covers the two ordinary outcomes and a statement sent after a failure and after a commit.
2. **Minor: the dashboard view's search.** It counted each outcome with a comparison inside `sum()`, which was not verified to be accepted. It is now `filter operation = "getFolder" | stats count(*) by folderOutcome, bin(5m)`, shown as a table (`infra/modules/monitoring/main.tf`). The view's title is unchanged and Terraform's tests pass. A table, not a chart, is a step back from the monitoring design's "count over time for each of the four outcomes"; see "Not verified".
3. **Minor: the could-not-load end-to-end test.** Not changed, as asked. It is now listed under "For the maintainer to decide", point 5, with what a person gets and loses.
4. **Minor: this summary contradicted itself** about U1's changed tests. The sentence under "U1's tests that were changed" now says that one of them asserts less.

The reviewer's residue on the character lists is under "Not verified".

## The server is told by a header of our own that a caller accepts gzip (Step 18)

Built on 2026-11-28, on the branch `u3-compression-header`, started from
`aws-migration` after Steps 1 to 17 were merged. Nothing was deployed,
committed or pushed, and no library was added. Sections above this one
describe the code as it was before this step; where they name
`Accept-Encoding` as what the server reads, this section corrects them.

**The failed deployment.** The first deployment of this Unit to the test
environment (run 46099600748) stopped at the infrastructure step. AWS
refused the edge's rule for the headers passed to the server: "The parameter
Headers contains Accept-Encoding that is not allowed". Nothing was put in
place. This was the third item of "Not verified", and it ended as that item
said it would.

**What was changed.**

- *The header.* A caller says it can read gzip with `X-Accept-Gzip: 1`.
  Present with exactly that value, it can; absent or with any other value,
  it cannot. The other two conditions of performance design P22 are as they
  were: the answer is over 1 kilobyte, and the compressed form as handed
  over is the smaller. The server no longer reads `Accept-Encoding`.
- *Server.* `server/src/http/body.ts` holds the header's name and value and
  the check (`acceptsGzip` is now an exact comparison; the parsing of a list
  of encodings and weights is gone). `server/src/operations/folder.ts`
  declares `x-accept-gzip` in place of `accept-encoding`, and a full answer
  says `Vary: X-Accept-Gzip`. `Vary` and `Server-Timing` are still on the
  200 only; the code of the four "not found" answers was not touched.
  `server/openapi.yaml` describes the request header and the `Vary` header.
- *Edge.* `infra/modules/edge/main.tf`: the rule passes exactly
  `X-Request-Id`, `Accept`, `Content-Type`, `If-None-Match` and
  `X-Accept-Gzip`; a comment says why the standard header is not there.
- *Page.* `web/src/api/folder.ts` sends the header with every request for a
  folder, on every attempt. For that, `readFromServer` in
  `web/src/api/call-server.ts` takes headers of the call's own, which cannot
  replace the ones it sets itself. No other call sends it, and nothing else
  in the page changed. The call is to the page's own address, so the extra
  header causes no preflight request; the comment beside it says so.
- *Checks of a deployed environment.* In `scripts/src/gates.ts` every
  request for a folder sends the header, as the page does. The gate
  "compressed" now makes two requests for the 500-item folder: one with the
  header, one without. The smoke check's request for the top folder
  (`scripts/src/smoke-check.ts`) and the end-to-end tests that ask the
  server for a folder themselves (`e2e/tests/browsing.spec.ts`, with the
  constant in `e2e/tests/folders.ts`) send it too. A comment in
  `.github/workflows/deliver.yml` was corrected; no step changed.
- *Documents.* `docs/operations.md`, section 6, has the paragraph on the
  header and why the standard one could not be used; step 6 of the restore
  procedure now reads "the page lists the top folder"; in procedure 9 the
  version is taken from `/v1/site-information`. `docs/examples.md` points to
  it. `docs/records/measured-speeds.md` has the NFR9.2 measurement of
  2026-11-28 and the note that the target was met once in three
  observations.

**How the gate tells compressed from plain.** The runtime's `fetch` unpacks
a gzip answer by itself, so the bytes the gate reads are the same either
way. The gate asserts on what the answer says of how it travelled, which
`fetch` leaves as it came: the `Content-Encoding` response header must be
`gzip` for the request with the header and absent (or `identity`) for the
request without. When both answers also carry a `Content-Length`, the
compressed one must be the smaller, and the two sizes are printed; when
they do not, the gate says the sizes were not compared and does not fail
for that. Both answers must unpack to the 500 items with the right first
name. The request without the header also sends `Accept-Encoding: identity`
to the edge, so that nothing on the way has cause to compress its answer;
that header does not reach the server.

**Where `Accept-Encoding` still appears, and why.** None of these is an
input to the server.

| Where | Why |
|-------|-----|
| `infra/modules/edge/main.tf`, `enable_accept_encoding_gzip` and `enable_accept_encoding_brotli` | U1's rule for keeping the page's files at the edge: the edge's own compression of those files. Not about `/v1` |
| `infra/modules/edge/main.tf`, the comment on the server's rule; `infra/environment/tests/browsing.tftest.hcl`, a comment and one assertion | They say that the header must not be listed, and the assertion fails if it is |
| `scripts/src/gates.ts`, the plain request of the gate "compressed" (`identity`), and its test in `scripts/src/browsing-checks.test.ts` | Sent to the edge, as above |
| `server/src/http/request-steps.answers.test.ts`; `server/src/operations/folder.integration.test.ts`; `server/src/operations/folder.large.integration.test.ts` | Tests that send it to the server on purpose, to show that it is not handed to the operation and changes nothing |
| Comments in `server/src/http/body.ts`, `server/src/operations/folder.ts`, `scripts/src/gates.ts`; the paragraph in `docs/operations.md` | The reason for the header of our own |
| The designs and reviews under this Unit's record, the plan, the audit | Not edited; see below |

**What is tested.** 18 tests are new, 778 against 760, and the existing
ones that sent `Accept-Encoding` to the server send the new header.

| File | New or changed tests |
|------|----------------------|
| `server/src/http/body.test.ts` | Header present with `1`; absent; ten other values, one test each (empty, `0`, `true`, `yes`, `gzip`, a list of encodings, `1` with a space, `1,1`, `1.0`, `01`); the header's name and value |
| `server/src/operations/folder.integration.test.ts` | 500 items with the header (compressed, unpacks to the plain answer) and without (plain), both with `Vary: X-Accept-Gzip`; new: 500 items stay plain for a caller that sends only `Accept-Encoding`, or the header with `0`, `true`, empty or `gzip`; a small answer stays plain with the header |
| `server/src/operations/folder.large.integration.test.ts` | 4,000 items without the header (and with `Accept-Encoding: gzip`, which changes nothing) and with it, each under 5.5 megabytes |
| `server/src/http/request-steps.answers.test.ts`, `server/src/operations/folder.test.ts` | The declared headers are `if-none-match` and `x-accept-gzip`; an undeclared `accept-encoding` is not handed over |
| `web/src/api/folder.test.ts` | The header is sent with and without a version held; new: on every attempt of a retried request; new: not by another read, and a call's own headers cannot replace `Accept` or the request identifier |
| `scripts/src/browsing-checks.test.ts` | The gate "compressed": passes with gzip for the first request and plain for the second; fails when the first is not compressed; new: fails when the second is compressed; new: sizes reported, and a failure when the compressed one is not smaller; fails on a wrong list in either; new: fails when either request is not answered 200. New: every gate sends the header with every folder request but the one plain request. New: the smoke check sends it to the folder and to nothing else |
| `infra/environment/tests/browsing.tftest.hcl` | The rule lists exactly the five headers; a new assertion that `Accept-Encoding` is not among them |

**Results, 2026-11-28.**

| Command | Result |
|---------|--------|
| `npm run check` | Passed, exit 0: formatting, lint and type check clean; 56 test files, 778 tests, all passed; 93.9% of lines against the floor of 80% (statements 93.75%, branches 92.04%, functions 93.05%); page 93,900 bytes compressed against 307,200; "Repository checks passed (906 files)" |
| `terraform -chdir=infra/setup fmt -check -recursive` | Exit 0 |
| `terraform -chdir=infra/environment fmt -check -recursive` | Exit 0 |
| `terraform -chdir=infra/setup validate` | "Success! The configuration is valid." |
| `terraform -chdir=infra/environment validate` | "Success! The configuration is valid." |
| `terraform -chdir=infra/setup test` | "Success! 3 passed, 0 failed." |
| `terraform -chdir=infra/environment test` | "Success! 26 passed, 0 failed." |

No threshold was touched. The end-to-end tests were not run: they need the
deployed test environment.

**What only a deployment proves.**

- That AWS accepts `If-None-Match` in the same rule. The failed deployment
  named only `Accept-Encoding`; whether that was the only header it would
  refuse is not known. That it accepts a header of our own there is
  expected and equally unseen.
- That `X-Accept-Gzip` reaches the server through the edge and the entry
  point, and that a compressed answer and the version header come back out
  through both. The gates "compressed" and "unchanged" are what shows it.
- Whether the answers carry a `Content-Length` through the edge. If they do
  not, the gate "compressed" rests on `Content-Encoding` alone.

**The designs name `Accept-Encoding` and are to be read with this
correction.** They were not edited: `logical-components.md` (change 8),
the performance design (P22), the security design (S21),
`infrastructure-specification.md` and `cicd-pipeline.md`. Wherever they say
the edge passes `Accept-Encoding` or the server reads it, read
`X-Accept-Gzip` with the value `1`. S21's point stands: the header carries
no credential.

**Different from Step 18 as written.**

- Procedure 9 of `docs/operations.md`: step 1 was changed as well as step
  4, because step 4 compares with the version noted in step 1, and the page
  shows no version.
- The Terraform test has one assertion more than asked: that
  `Accept-Encoding` is not in the list.
- The gate also compares the two sizes when both are declared.
- `source-manifest.json` is unchanged: no file was added, and every file
  this step changed was already among its 117 paths.
- The diary (`memory.md`) was not written to in this step.

## Housekeeping

- The plan's seventeen boxes are ticked; nothing else in the plan file was changed.
- No file of `aidlc-state.md`, the audit, the memory or U1's record was edited.
- Two files were written through the shell and not the file tools: one early edit of `scripts/src/name-characters.ts`, and the sixteen icons, copied with `cp`. One stray report folder left by a command of mine (`.vitest/`) was removed.
- The diary is in `memory.md` beside this file.

# Code Plan: U3, browsing and selecting

## Summary

- Builds: the folder list anyone can read (one table `items`, one route `GET /v1/folders/{folderId}`, the folder screen with breadcrumb, selection by mouse, keyboard and touch), the name rules later Units call, and sample content loaded in the test environment only
- Touches: `db-migrate/` (one change file, the sample loader), `server/src/drive/` (new) and nine named changes to U1's shared code in `server/src/http`, `server/src/log`, `server/src/db`, `web/src`, `infra/modules/edge` and `infra/modules/monitoring`; `web/src/folder/` (new); `scripts/`, `e2e/`, the deploy action, `docs/`
- Tests: about 230 new: 120 unit, 75 integration against a real PostgreSQL, 9 end-to-end journeys (three engines, two widths), 2 Terraform assertions, and 4 gates in the pipeline

## What this plan is built from

- The Unit's behaviour, rules and records: `aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`, `rules.md`, `entities.md`
- Where each part lives and what changes in U1's code: `aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-design/logical-components.md`
- Its quality design, beside that file: `security-design.md` (S20 to S32), `performance-design.md` (P20 to P29), `reliability-design.md` (R20 to R28), `scalability-design.md` (C20 to C25), `observability-design.md` (O20 to O25)
- Its infrastructure and pipeline: `aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/infrastructure-design/infrastructure-specification.md`, `cicd-pipeline.md`, `monitoring-design.md`
- Its quality requirements, with the table "Name cases": `aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-requirements/security-requirements.md` and the files beside it; `tech-stack-decisions.md` (T21 to T31)
- Contracts C1, C3 and C9: `aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`
- The Unit and its stories US1.1, US1.2, US1.3, US2.1: `aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`
- Requirements FR1 and FR2: `aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`
- What U1 left to copy: `docs/examples.md`, and U1's code as it is on `aws-migration`

Where a design document and `logical-components.md` differ, the latter
holds, as it says itself: case is compared one character with one
character; an answer is refused at 5.5 megabytes of what is handed to the
platform; an answer is compressed only when that is the smaller form to
send.

## Settled before this plan, by the maintainer

| Point the designs left for this plan | Answer | Effect here |
|--------------------------------------|--------|-------------|
| May U3 be merged before U1 is deployed and seen working? | No, and it no longer arises: U1 was approved on 2026-11-27 after its rehearsals, and is deployed to both environments | The precondition of `cicd-pipeline.md` holds |
| The existing icons, whose origin is not recorded (finding TD-08) | They are the maintainer's own or free to use | Step 13 copies them into the page |
| The second half of the compatibility check (the earlier Release's end-to-end tests against the new server) | Build it in U3 | Step 15 |

## What this plan does not do

- **It deploys nothing.** Everything reaches AWS through the pull request and the pipeline. The rehearsals this Unit owes (a deployment whose sample loading fails; going back with U3 deployed) are done by the conductor after the first deployment, as U1's were.
- **Nothing in U3 changes a folder or a file through the site.** The server's database user can only read `items`. The actions on the page say "This is not available yet."
- **It does not change the server's limits for the database.** On 2026-11-27 U1's rehearsals showed that the 2 seconds the server allows for opening a connection are shorter than a first sign-in after a quiet period. That is owed a measurement and a proposal of its own, and is not folded into this Unit.
- **It leaves the old site alone.** The icons are copied from `app/public/images/icons/`; nothing under `app/` changes.
- **One test of the design is not written here:** content changed through the site between two requests (security design S28). `cicd-pipeline.md` moves it to U6, the first Unit that can change content; U3 tests the same behaviour at the server against a real database, and the "not stored" gate covers the path end to end.

## Layout

| Folder | U3 adds |
|--------|---------|
| `db-migrate/migrations/` | `0002_items.sql` |
| `db-migrate/src/` | The sample loader (a second mode of the change runner) and the sample set |
| `server/src/drive/` | The Drive module: identifiers, names, folder reading, file reading, the change step, the version tag |
| `server/src/operations/` | The folder operation |
| `server/src/http/`, `server/src/log/`, `server/src/db/` | Changes 1 to 6 of `logical-components.md` |
| `web/src/folder/` | The folder screen, list, breadcrumb, action bar, status line, selection, address, formatting |
| `web/src/api/` | Change 7, and the folder call |
| `web/src/assets/icons/` | The icons, and one new check mark |
| `infra/modules/edge/`, `infra/modules/monitoring/` | Change 8; two saved searches and one dashboard view |
| `scripts/src/` | The smoke check's folder request; the four gates; the generator of the character lists |
| `e2e/tests/` | Nine journeys |
| `.github/` | The sample-content step in the deploy action; the checks named in Step 15 |

## Changes to files that were already here

U1's files are changed only as `logical-components.md` lists under "Changes
to what U1 built" (nine changes), plus the pipeline files named in Step 15
and the documents in Steps 16 and 17. U1's two operations, its page and its
tests keep working; no test of U1's is removed or weakened. Files that were
in the project before this work began are not changed: the icons are read,
not edited.

## Steps

Each step names the stories it serves. Tests follow the code of each layer,
as the Testing Contract below requires. One departure from the contract's
usual order, because the architecture requires it: the pure rules of names
and identifiers (Steps 5 and 6) come before data access (Steps 7 and 8),
since the change step calls them.

- [x] **Step 1: Structure and configuration.** (US1.1) The change runner's package may import the Drive module from the server's package, so that there is one copy of the code (`logical-components.md`); the build of the change runner bundles it with the sample set. One data file in the repository lists the white-space characters and the invisible formatting characters, taken from Unicode's own tables at the version current when this is built, with that version recorded in it; a script in `scripts/` generates from it both the server's patterns and the text of the database's checks, and a repository check fails when the generated files are out of date (security design S23). The quick local test command leaves out files named `*.large.integration.test.ts`; `npm run check` includes them (`cicd-pipeline.md`). No library is added (T21).
- [x] **Step 2: Test runner.** (US1.1) Verify that the unit-scoped command in `unit-test-instructions.md` runs as the project stands, before any test of this Unit exists, and that Testcontainers starts PostgreSQL 18. Nothing in `vitest.config.ts` is loosened; the 80% floor stays one figure over U1's and U3's code together (NFR12.23).
- [x] **Step 3: Data model, implement.** (US1.1, US1.2) `db-migrate/migrations/0002_items.sql` creates one table, `items`, for folders and files (entities, decision 1; T24), with every rule declared in the table's structure and no trigger (T27), each rule with a name of its own that the code can read back (reliability design R21). Column names are fixed here:
  - `id`: uuid, primary key, generated by `gen_random_uuid()` (Folder.folderId, File.fileId; rule BR2.1; S22, T25). Unique across folders and files because it is one column.
  - `kind`: `folder` or `file`, by a check (Row.kind). The pair (`id`, `kind`) is declared unique so that a parent can be referred to as "this item, which is a folder" (`logical-components.md`, the `items` table).
  - `parent_id`: uuid, empty only for the top folder (Folder.parentFolderId, File.folderId); a unique index allows at most one row without a parent (rule BR2.3).
  - `parent_kind`: generated, always `folder`, never written; (`parent_id`, `parent_kind`) is a foreign key to (`id`, `kind`), which holds "the parent exists and is a folder" (entities: every folder has a parent that exists; a file belongs to exactly one folder).
  - `name`: text, with the five checks verified in `logical-components.md`: composed form; 1 to 255 code points; not "." or ".."; no "/", control character or listed invisible formatting character; no listed white-space character at either end (rules BR2.4, BR2.5; S23). The checks' text is generated in Step 1.
  - `name_key`: generated by the database from `name` with `casefold`, naming the `pg_c_utf8` rules explicitly; never written by code. Unique within a parent among rows whose own `deleted_at` is empty (rule BR2.6; T26).
  - `position`: whole number, empty only for the top folder, unique within a parent, deleted rows included (Folder.position, File.position; rule BR2.2). This index, (`parent_id`, `position`), is also what a folder's list is read through (scalability design C20).
  - `version`: whole number, present for folders with default 1, absent for files (Folder.version; rule BR2.9).
  - `size` (present and not negative for files, absent for folders), `content_type`, `content_id` (may be empty until U4: rule BR2.8, answer Q2), `deleted_reason` (`deleted` or `replaced`, present exactly when a file's `deleted_at` is): the File's own attributes, absent for folders by checks.
  - `created_at` (default now), `last_changed_at`, `last_changed_by_account_id`, `deleted_at`, `deleted_by_account_id`, `brought_over` (default false): as the entities list them; nothing in U3 fills the account columns (entities, decision 4).
  - `source_key`: text, unique when present (Folder.sourceKey, File.sourceKey; entities, decision 5; rule BR2.10).
  - The same file inserts the top folder, named "All", with no parent and version 1, in the same transaction as the table (rule BR2.3; R24), and grants the user `app` the right to read `items` and no other right (S25). `migrator` owns the table.
- [x] **Step 4: Data model, tests.** (US1.1) Integration tests against PostgreSQL in a container, one per rule, each trying to break it with a direct write and expecting a refusal that names that rule (R22; NFR12.21): a second item with no parent; a parent that does not exist; a parent that is a file; a repeated position in one folder; a repeated name key among items not deleted, and the same name accepted on a deleted item; a repeated source key; each of the five name checks; a file without a size; a folder with one; a deletion reason without a deletion mark. The fifteen "Name cases" as direct writes, each refused or accepted as the table lists (S23). Every listed character run through the database's checks (S23). `app` can read `items` and cannot insert, update or delete (S25). The change file applies to a database that has only U1's change, and applying again changes nothing.
- [x] **Step 5: Names, identifiers and the version tag, implement.** (US1.1, US1.2) In `server/src/drive/`, as pure functions with no database: `identifiers` says whether a text is `root` or exactly the 36-character lower-case form the database generates (S20; rule BR1.10); `names` normalises (rule BR2.4), validates in the fixed order with the codes `nameEmpty`, `nameTooLong`, `nameHasForbiddenCharacter` (rule BR2.5), splits a base from an extension and builds the next numbered name, shortening the base and never the extension (rule BR2.7), using the patterns generated in Step 1; `version-tag` makes the quoted version from the folder's identifier and version number, and reads one back within the limits of S21 (128 characters at most, a leading weak marker removed, a list of several treated as none, another folder's version treated as none). Nothing here folds case: sameness is the database's alone (T26).
- [x] **Step 6: Names, identifiers and the version tag, tests.** Unit tests: the identifier's accepted and refused forms, upper case and over-long included; the fifteen "Name cases" through the name module; every listed character through the module's patterns, so that module and database are shown to agree (S23); the order in which failures are reported; the extension rule with "exam.pdf", "notes.tar.gz", "2019.1", "v1.2" and ".profile"; a numbered name at the 255-character limit; the version tag's round trip and each way it is refused.
- [x] **Step 7: Data access, implement.** (US1.1, US1.2) In `server/src/db/database.ts`, one more method that runs a piece of work as a transaction under the same deadline, rolling back where the connection still answers and discarding the connection on any failure (change 6; R21). In `server/src/drive/`: `folder-reading`, with the two fixed statements of P20, "the walk" and "everything", the walk limited to 64 levels (S26), the statement itself stating "not deleted" (S24), and one function that names each field it puts in an answer (S24; rules BR1.3 to BR1.7); `file-reading`, `getVisibleFile` (rule BR1.11); `change-step`, the one transaction of R21 (lock the folder's row with a bounded wait, walk, check the name or find the lowest free one by asking the database for the key of the text passed as a parameter, take the next position, write, raise the version), with `checkName` and `lowestFreeName` usable on their own as advice (design W5; rules BR2.6, BR2.7, BR2.11, BR2.12); and one function that turns a database error into what may be logged, its code and the name of the rule, never its message (O23). Every statement is a fixed text with numbered parameters (S30).
- [x] **Step 8: Data access, tests.** Integration tests against PostgreSQL in a container, each creating its own content (NFR12.24): a folder is answered with its path and its visible items in order; `root` and the top folder's identifier give the same answer; a folder that is unknown, deleted, or inside a deleted folder is not found, and so is a file inside a deleted folder that carries no mark of its own (rule BR1.11); the number of statements for a small shallow folder and a large deep one, with and without a version (P20); a change that lands between the walk and the full statement gives an answer whose version matches its list (R20); a walk of more than 64 levels is the fault `pathTooDeep` (S26); a change step made to fail after its write leaves the folder and its version untouched; twenty additions to one folder at once get twenty different positions and raise the version by twenty (R21); a held folder makes a second change wait and then report `folderBusy`; twenty readers of a folder held by a change all get the earlier list (C24); a duplicate name refused by the database is reported as `nameAlreadyUsed` and any other refusal as `storeRefused` with the rule's name; each statement with a name containing a quote and a fragment of a statement (S30); the transaction method leaves no transaction open on a connection used again. In a file named `*.large.integration.test.ts`: 4,000 items with 255-character names of four-byte characters are read (C21).
- [x] **Step 9: Request steps and the folder operation, implement.** (US1.1, US1.2, US1.3) Changes 1 to 5 and 9 of `logical-components.md`, each keeping U1's two operations as they are: a path may hold named parts, whose values are handed to the operation (`server/src/http/operation.ts`); an operation is given only the request headers it declares; a failed check of path values may be declared "not found", the default staying `invalidInput`; an operation may name response headers, answer with no body, and hand back a compressed body, which the steps pass on in the encoded form the platform requires; the steps build the response exactly as it will be handed over, measure it, and at over 5.5 megabytes answer a small server error with the fault `answerTooLarge` (C21); the log entry accepts fields an operation declares, checked by type and scrubbed like the rest, and gains `fault` (`server/src/log/entry.ts`; O20, O22). The operation `getFolder` in `server/src/operations/`: recognises the identifier (S20), checks visibility before comparing versions (S27), answers "unchanged" with status 304 and no content (rule BR1.8), compresses with the platform's own gzip only when the caller accepts it, the answer is over 1 kilobyte and the encoded compressed form is the smaller (P22), marks every answer not to be stored (S28), reports its own duration in `Server-Timing` (`cicd-pipeline.md`), makes "not found" through one function that takes no argument (S24), never looks at a session (S32), and adds the fields of O20 to its entry with no name and no malformed identifier in them. `server/openapi.yaml` gains the operation (contract C3).
- [x] **Step 10: Request steps and the folder operation, tests.** Unit tests of the changed steps: a path with a named part matches and one without does not; an undeclared header never reaches an operation; the two answers to a failed check; a response with headers, with no body, and compressed; the size limit refused with the right entry (C21); the entry for each folder outcome with its exact fields (O20); a database error whose message holds a name leaves no name in the entry (O23); 404 and 304 are not counted as server failures (O21); the three conditions for compressing (P22). Integration tests through the function's entry point against PostgreSQL: a full answer has exactly the listed fields for a folder that also holds deleted items (S24); the four not-found answers are equal byte for byte apart from the request identifier, with and without a version sent (S24); "unchanged" for the current version and "not found" for the current version of a folder whose grandparent was deleted meanwhile (S27); a folder changed between two requests shows the change at the second (S28, at the server); every answer carries the instruction not to store it; the 500-item answer is 150 kilobytes or less before compression (P22); the 4,000-item answer is handed over under 5.5 megabytes with and without compression accepted (`*.large.integration.test.ts`; C21). The test that every operation is a GET still passes (S25), and the test comparing the OpenAPI file with the operations understands named path parts (change 9).
- [x] **Step 11: The sample loader, implement.** (US1.1, US1.2) In `db-migrate/src/`: the entry point treats a missing input, an empty one and one naming no mode as "apply database changes", and only an input naming the load-samples mode loads samples (`cicd-pipeline.md`). The loader reads the environment's name and refuses in production before opening a connection (S31; rule BR2.10); processes the sample set in a fixed order, parents before children; finds each entry by its `source_key` ("sample:" and the entry's path) and, if there is none, creates it through the change step, one transaction per entry; creates and marks deleted, in one transaction, the entries that must be deleted (R25; design W6); and writes one summary line of structured text with created, found and filled, and for a failure the entry's key and the kind of failure (O23; `monitoring-design.md`). The sample set is a data file beside it (T29) covering what the design's W6 lists, and for the tests of P28 a 255-character name and a path twelve deep: at most 1,000 items, none with contents (C22).
- [x] **Step 12: The sample loader, tests.** Unit tests: the three inputs that mean "apply database changes" and the one that means "load samples"; the refusal in production, with no connection opened; the sample set is valid by the name rules and holds every case W6 lists. Integration tests against PostgreSQL: loading twice gives the same table as loading once; with the fifth entry made to fail, load, repair and load again gives the same table as a clean load (R25); the deleted sample file and folder are hidden, and so is the unmarked file inside the deleted folder; U1's own tests of the change runner still pass.
- [x] **Step 13: The page, implement.** (US1.1, US1.2, US1.3, US2.1) In `web/src/api/call-server.ts`, change 7: the caller may pass the version it holds; "unchanged" is a third outcome, never retried and never a failure; a success returns the version with the content (P23). In `web/src/folder/`: `address` reads and writes the folder with the browser's own history functions, `/` for "All" and `/folders/<identifier>` otherwise, and replaces the top folder's own identifier with the plain address (T22; rule BR3.1; R28); `selection`, a pure function from (rows, selection, input) to a new selection with its anchor and focus, covering every row of the table in the design's W4 and the refresh rule (T23; rules BR4.1 to BR4.9); `formatting`, the size text and the choice of icon with its text alternative (rules BR3.2, BR3.3); the folder screen, holding the five states of the list as one value, running the design's W2 to W4, numbering its requests so that a late answer for a folder already left is dropped (R23), and refreshing when the page becomes visible again (W3); the list as a native table with one Tab stop and a roving focus, each row its own component keyed by identifier, a tick box on touch devices and below 768 pixels, a check mark on selected rows (P24, P27; rules BR4.5 to BR4.7); the breadcrumb, collapsing below 768 pixels (rule BR3.9); the action bar following the selection, each action saying "This is not available yet." (rules BR4.4, BR4.10); one polite status line with "Clear" (rule BR4.7). Names reach the page as text only (rule BR3.4; S29). `data-testid` on every control. The icons are copied from `app/public/images/icons/` into `web/src/assets/icons/` and imported as fingerprinted files, with one new check mark in the same style (T30; P25). The styles for the list, breadcrumb and action row are carried into `web/src/styles.css` with the accepted changes 1, 3, 4, 6 and 7 (answer Q3; P29), the minimum sizes of 44 by 44 pixels, and movement only when reduced motion is not asked for (P27). `web/src/App.tsx` shows the folder screen; U1's status component stays in the code with its tests, shown no longer.
- [x] **Step 14: The page, tests.** Unit tests: the selection function from the design's table, one case per row and per rule, with and without an anchor (NFR12.20), and the refresh rule with a list that changes between two answers (rule BR4.8); the address, including the top folder's identifier replaced; size text at each boundary and "0 B"; the icon for each row of the design's table, video and `application/octet-stream` included. With React Testing Library: each of the five states; the breadcrumb, whole and collapsed; the actions for nothing, one file, one folder and several items; a row named `<b>x</b>` shown as text (S29); keyboard selection with no pointer; "unchanged" keeps what is shown; a failed refresh keeps what is shown; a late answer is dropped; focus moves to the list when the focused action disappears; 4,000 rows are shown and all selected (P24). `call-server`'s three outcomes, and that U1's cases still pass.
- [x] **Step 15: Infrastructure, pipeline and end-to-end tests.** (US1.1, US1.2, US1.3, US2.1) In `infra/modules/edge/main.tf`, the server's origin request policy also passes `If-None-Match` and `Accept-Encoding` (change 8); Terraform's test asserts that it lists exactly the five headers. In `infra/modules/monitoring/`, two saved searches per environment, "folder requests by outcome" and "folder requests slower than 1 second today", and one dashboard view drawn from the log, not set to refresh by itself (`monitoring-design.md`; O24); a Terraform assertion that they exist under the environment's prefix. In `.github/actions/deploy/action.yml`, the step "sample content" between the database changes and the switch, run only when the environment input is `test`, calling the same published version of the change runner with the load-samples instruction and the same no-retry setting (stage 4a); the smoke check after the switch is told the Release has browsing and then also asks for the top folder; the smoke check before the switch and in `go-back` stays U1's. In `scripts/`, that option of the smoke check, and the four gates of stage 7: unchanged through the whole path, compressed through the whole path, folder speed (100 requests at 5 a second, the 95th of the `Server-Timing` figures at most 500 milliseconds, a refused request failing the gate as its own fault), and not stored; unit tests of each against stand-in servers, the smoke check with and without the folder route. A repository check that the deploy action's sample-content step exists and has its condition (S31). The second half of the compatibility check, as the maintainer decided: in `deliver`, after a deployment to test, the end-to-end tests of the Release running in production are run against the test environment, and a failure blocks the Release as the other gates do; if the earlier Release's tests cannot be run that way, the developer says so and proposes the smallest alternative, and the check is not dropped. In `e2e/tests/`, the nine journeys of `cicd-pipeline.md`, in three engines at two widths, finding sample folders by name from "All": browse; the views of the list with the accessibility scan in each; select with a mouse; with the keyboard only; by touch at 320 pixels; names as text; hidden items; no session; no outside address, now opening a folder. U1's end-to-end tests are changed only where the page they open no longer shows the status component, and each such change is named in the code summary.
- [x] **Step 16: Documentation and traceability.** (US1.1) `docs/operations.md` gains a paragraph on what the sample loader is and that it runs by itself (R27). `docs/examples.md` points at the folder operation, the change step and the selection function as the patterns U4 to U8 copy. `docs/records/measured-speeds.md`, `failing-deployment.md`, `going-back.md` and `alarm-proofs.md` gain empty, dated rows for what this Unit owes (`cicd-pipeline.md`, "Rehearsals and records owed"; O25). `code-summary.md`, `source-manifest.json` and `traceability.json` in this Unit's record.
- [x] **Step 17: Five corrections left by the last review of U1's records.** Text only, from review 13 of U1: in `docs/records/restore.md` and `docs/operations.md` (procedure 4, step 5), that a person would have been shown an error is said as an inference, not tried in a browser, and "the smoke check" that passed at its second attempt is named as the one after the infrastructure change; in `docs/operations.md`, the alarm rehearsal no longer says the email "arrives within about 10 minutes"; in `docs/records/alarm-proofs.md`, the first `prove-identity-limits` run is noted as having a public log from before Step 21; and `docs/records/restore.md` no longer says the removal's result is owed. U1's own record files are not edited by this Unit.

## Story to step

| Story | Steps |
|-------|-------|
| US1.1 See what is in a folder | 1, 2, 3, 4, 5, 7, 9, 11, 13, 15, 16 |
| US1.2 Move through folders | 3, 5, 7, 9, 11, 13, 15 |
| US1.3 Know what the list is doing | 9, 13, 14, 15 |
| US2.1 Select rows | 13, 14, 15 |

## Open points the maintainer should know before approving

1. **Nine changes to U1's shared code.** They are listed in `logical-components.md` and are the largest risk of this plan: working, reviewed code is changed. U1's tests stay and must pass unchanged.
2. **Two things only a deployment proves:** that the version header and a compressed answer pass through the edge and the entry point in both directions. They are gates in the pipeline. If either fails in test, production cannot receive the Release and the remedy comes back for a decision.
3. **Whether AWS accepts `Accept-Encoding` in the edge's rule** rests on its documentation. If it refuses, Terraform fails in test before anything else changes.
4. **The page stops showing U1's status view.** The site's first screen becomes the folder list; in production it is an empty "All" until the migration (answer Q4).
5. **The second half of the compatibility check may not be buildable as planned,** because the earlier Release's end-to-end tests expect the earlier page. Step 15 says what happens then.
6. **Size.** This is a large plan: roughly 60 new files and about 230 tests.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "We implement each testable layer of a piece, then write and run that layer's tests before the piece is merged.",
  "scope": "feature",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Methodology evidence**: The owner's interview answer (Q4): tests are written after the code for each layer, before the piece is merged. The repository has no tests and no earlier habit to follow.\n- **Ordering**: We implement each testable layer of a piece, then write and run that layer's tests before the piece is merged.\n- Coverage floor: a merge is refused when fewer than 80% of lines are covered\n  by tests. The pipeline checks this on the pull request.\n- Tests are part of every piece. A piece without its tests is not done.\n- Tooling: Vitest for unit and integration tests, Testcontainers for\n  integration tests against a real PostgreSQL, Playwright for end-to-end tests.\n- Unit tests cover every module with logic. Integration tests cover every SQL\n  statement and every API route. End-to-end tests cover the key journeys:\n  browse, upload, download, rename, delete, sign-in, and a rejected anonymous\n  write.\n- We mock AWS calls at the SDK boundary. Integration tests run against a real\n  PostgreSQL.\n- Security checks (dependency audit and a scan of the infrastructure code) run\n  in the pipeline.\n- A scripted migration check, kept in the repository, compares file and folder\n  counts and sizes with the source export.\n- Test files sit next to the source they test and use `describe` and `it`.\n- Performance tests are not part of the first release."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Meet an 80% line-coverage floor.",
      "Run the selected tests in CI before merge."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:bec9af1dda099b4d18c908f452547a1aa0eb0b46adfef5fb37191e41fb9de48a",
  "contract_sha256": "sha256:b048b7114eba63b8a98f6999d1ba2033d751b991c173adf5e2c15fa4396df602"
}
```

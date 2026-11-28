## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-28T01:55:49Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | `server/src/db/database.ts`, `Database.transaction` (the `catch` block after `withTimeout(wholeTransaction(), ...)`) | When the deadline passes mid-transaction, `withTimeout` rejects but the work keeps running on the same connection. The `ROLLBACK` is queued behind the statement in flight, and any statement the work issues after that point is queued behind the `ROLLBACK`, so it runs in autocommit and is committed on its own. Example: the change step's `INSERT` is rolled back, then its `RAISE_VERSION` commits alone, or an inner item is written with no version raise. A folder's list can then change with no new version, and a page holding the old version would be told "unchanged". The doc comment says "No transaction is ever left open", which is true, but the guarantee the change step relies on ("any failure rolls everything back: nothing was changed") is not. No route reaches this in U3 (only the loader, on its own connection with no deadline), so nothing wrong is live. U6, U7 and U8 are meant to copy it. The test "gives up when the deadline passes" ends its work with a sleep, so it cannot show this. | Make the connection handed to the work refuse every query once the transaction is abandoned (an `abandoned` flag set before the `ROLLBACK` is sent; `query` throws the deadline error when it is set). Add an integration test whose work issues a second write after the deadline has passed and asserts that neither write is visible afterwards. | New |
| R-02 | Minor | `infra/modules/monitoring/main.tf`, `local.log_views`, the dashboard's "Folder requests by outcome over time" query | The query uses `sum(folderOutcome = "answered")` and three more of the same form. Whether Logs Insights accepts a comparison inside `sum()` was not checked (the developer lists "draws four lines" as not verified). The `terraform test` only checks that the view exists. If it is refused, the dashboard shows an error in that view. | Use a form that is certain, for example `stats count(*) as requests by folderOutcome, bin(5m)`, or run the query once against the test environment's log before the Release is called done. | New |
| R-03 | Minor | `e2e/tests/thin-slice.spec.ts`, the test "the could-not-load view appears when the server is blocked, and Try again works by keyboard" | U1's test asserted that the request identifier is shown and that focus moves to "Try again" by itself. Both assertions were dropped, and `retryButton(page).focus()` was added, so the test now provides the focus the old one proved the page provides. The designs ask for neither, so this is a conscious loss of U1 behaviour (focus management after a failure) and not a fault. | The maintainer decides. If the failed view should still move focus, restore the assertion and the behaviour. Otherwise record the decision in `docs/examples.md` or the design. | New |
| R-04 | Minor | `code-summary.md`, "U1's tests that were changed", and `server/src/http/problem.ts` | The summary says "none asserts less strictly than before". The could-not-load test does assert less (see the row above), and the summary says so itself in the same table. | Reword the sentence so it does not claim all of them assert as strictly. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm run check` | Exit 0 on the first run. 55 test files, 754 tests passed. Coverage: 93.61% statements, 91.84% branches, 93.04% functions, 93.75% lines (floor 80%). Page 93,859 bytes compressed (budget 307,200). Access gate 6,377 bytes (limit 10,240). "Repository checks passed (900 files)." | Matches the code summary. The 900 files against the summary's 898 comes from files present now and not when the summary was written; it is not a fault. |
| `terraform -chdir=infra/setup fmt -check -recursive` | Exit 0 | Pass |
| `terraform -chdir=infra/environment fmt -check -recursive` | Exit 0 | Pass |
| `terraform -chdir=infra/setup validate` | "Success! The configuration is valid." | Pass |
| `terraform -chdir=infra/environment validate` | "Success! The configuration is valid." | Pass |
| `terraform -chdir=infra/setup test` | 3 passed, 0 failed | Pass |
| `terraform -chdir=infra/environment test` | 26 passed, 0 failed | Pass; includes the three new `browsing.tftest.hcl` runs |

### Other checks

**Plan and designs**

- The `items` table (`0002_items.sql`) holds every rule as a named constraint or index, with no trigger. `app` gets `SELECT` only. The top folder is inserted with the table.
- Change step: lock (`FOR UPDATE`, `lock_timeout` set transaction-local through `set_config(..., true)`, wait cut to the deadline less 500 ms), walk again, name, position (max plus 1, deleted items included), write, raise version. The order is as designed. A refusal after the first write is thrown as `RefusedAfterWriting`, so the rollback is complete. A duplicate-name refusal from the database becomes `nameAlreadyUsed`. Other store refusals become `StoreRefusedError`, without the database's message. The only fault is the one in the first finding.
- The walk is capped at 64 levels. A walk that has not reached the top throws `PathTooDeepError` (a named fault), never "not found". The two statements share the same recursive part, word for word, and a test compares them.
- Visible first, then compare (S27) is in `getFolderView`. The not-found answers all come from one `notFound()` or from the declared `invalidParams`. The Problem's `detail` is the same for an unknown address. `Server-Timing`, `Vary` and the `ETag` are sent only with a 200 or 304, so the four answers are equal.
- The answer's size is measured on `JSON.stringify(response)`, which is what is handed over, against 5.5 MB. The compression rule measures the base64 form against the plain one.
- `selection.ts` follows the W4 table and BR4.1 to BR4.8 row by row (anchor rules, Ctrl-A, Escape, tap on a name, Delete, refresh keeping rows by identifier, focus to the row at the same place or the last one). Stale answers are dropped by the `opening` counter in `FolderScreen.tsx`.
- Security: the identifier is checked before any statement and a malformed one is never logged. Every statement is fixed text with parameters (no template literal passed to `query`). No `innerHTML` anywhere in `web/src` or `server/src`. The title is set through `document.title`. The only statements that write to `items` under `server/src` are in `change-step.ts`, and the only non-test importer of that file is the loader in `db-migrate`, so no operation reaches them. Operation-added log fields are limited to declared ones, with declared types, and cannot replace the entry's own.
- Tests: no `vi.mock` or `vi.fn` in any new integration test; those tests start a real PostgreSQL. The table tests break one rule at a time by a direct write and assert the constraint's name. No always-true assertion was found by search.
- Pipeline: the "Sample content" step has exactly the condition `inputs.environment == 'test'`, sits between "Database changes" and "Switch", and calls the same published runner version (the `runner-version` output is set by the step with `id: database`). The runner refuses production itself, and `repository-rules.ts` fails the checks if the step loses its condition. The smoke check after the infrastructure change is unchanged. `VD_HAS_BROWSING` is set only on the check of the new version. In production the first Release's smoke check asks for `/v1/folders/root`, which exists from the database change. The four gates are what `cicd-pipeline.md` says, and each ends with a plain pass or fail. The compatibility step reads `deployment-record.ts running` as `release sha lambdaVersion`, and the job checks out with `fetch-depth: 0`, so the earlier commit is reachable. I found no wrong input, missing permission or step that expects sample content before it is loaded.
- Infrastructure: exactly five headers in the origin request policy, with a test of the list, and no cookies. Two saved searches and one dashboard view added, names under `${var.prefix}`. Nothing else in the modules changed.
- Project rules: no library added, no plain JavaScript file added, nothing changed under `app/`, TypeScript files only. No account number, person's name or email address was found in any new or changed file outside `aidlc/`. The site's domain and the repository's owner name appear in U1's committed documents and in the new test and documents. They are public already and are not new exposure.
- Record: `source-manifest.json` lists 116 paths, and they equal the changed and new files outside `aidlc/` and `.DS_Store` files, with none missing and none extra. `code-summary.md` is truthful about what was not run (end-to-end tests, gates, pipeline steps, edge change, speeds, browser). I did not re-derive the ten requirements the conductor added to `traceability.json`; the entries I read name files that exist.

**The developer's departures: my judgement**

- `name_key` with the collation `pg_c_utf8`: sound. Equality under both collations is code point equality (neither is non-deterministic), so what counts as the same name is unchanged. The only thing that changes is the order of `name_key` itself, which nothing reads for display (order is by `position`).
- Two rules more (not its own parent; the top folder is "All" and never deleted): sound, and they hold in structure what `entities.md` says.
- `uuid` for `content_id` and the two account columns: the maintainer's to decide, as the developer says. It is a reasonable type, and it binds U4 and U2 to it.
- Unicode 18.0 lists against PostgreSQL 18.1's 16.0 tables: sound for the refused-character checks (they list the code points). The one residual: a pair of letters that is cased only in Unicode 17 or 18 is not folded by the database, so it counts as two names. This is rare and should be written in the design.
- `contents` for a new folder, so a deleted sample folder is created in one transaction: sound, and it gives the reliability design's "created and marked deleted in the same transaction". It runs in the same step through the same checks.
- `Server-Timing` and `Vary` with a 200 only: sound, and needed for the four not-found answers to be equal.
- Focus ring colour changed for U1's button too: sound (2.03 to 1 contrast was under NFR6.23).
- Native table with `role="grid"`: sound; not verified in a browser.
- `notFound` Problem's `detail` changed for every operation: sound and necessary. No test read the old text.
- Second half of the compatibility check partial: sound as built and honestly described. The page half is still missing; the maintainer decides between the developer's alternative and accepting the gap.
- End-to-end "hidden items" cannot open the deleted folder's address; touch journey skipped in Firefox: acceptable. The server-side equality of the two answers is proved at the server.
- No switch for "sample loading fails": the maintainer's to decide. The reasoning (a failing sample would be refused twice by the checks) holds.
- `durationMs` instead of `duration`: sound (U1's name), and the saved searches use it.

**Not checked**

I did not run the end-to-end tests, and could not run the gates, the new pipeline steps, Checkov, the dependency audit or the secrets scan. I did not check whether CloudFront accepts `Accept-Encoding` in an origin request policy beside "CachingDisabled", whether a 304 and a gzip body pass through the edge and the function's entry point, how the page looks in a browser, or the speeds. I did not read the full text of every test or of `styles.css`. I did not open `traceability.json` against each requirement.

### Summary

The code follows the plan and designs closely; every check and Terraform command passes; the table, the change step, the read path, the selection function and the pipeline fences read as sound. One shared piece is wrong for its stated purpose: `Database.transaction` can let a statement commit on its own after the deadline has rolled the transaction back, which would break "nothing was changed" for the change step in U6 to U8. It is a small fix with one test, and no route in U3 reaches it. Nothing else blocks.

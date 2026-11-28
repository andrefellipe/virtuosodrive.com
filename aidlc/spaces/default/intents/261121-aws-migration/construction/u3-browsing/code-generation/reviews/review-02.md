## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-28T02:04:39Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | `server/src/db/database.ts`, `Database.transaction` (the `catch` block after `withTimeout(wholeTransaction(), ...)`) | When the deadline passes mid-transaction, `withTimeout` rejects but the work keeps running on the same connection. The `ROLLBACK` is queued behind the statement in flight, and any statement the work issues after that point is queued behind the `ROLLBACK`, so it runs in autocommit and is committed on its own. Example: the change step's `INSERT` is rolled back, then its `RAISE_VERSION` commits alone, or an inner item is written with no version raise. A folder's list can then change with no new version, and a page holding the old version would be told "unchanged". The doc comment says "No transaction is ever left open", which is true, but the guarantee the change step relies on ("any failure rolls everything back: nothing was changed") is not. No route reaches this in U3 (only the loader, on its own connection with no deadline), so nothing wrong is live. U6, U7 and U8 are meant to copy it. The test "gives up when the deadline passes" ends its work with a sleep, so it cannot show this. | Make the connection handed to the work refuse every query once the transaction is abandoned (an `abandoned` flag set before the `ROLLBACK` is sent; `query` throws the deadline error when it is set). Add an integration test whose work issues a second write after the deadline has passed and asserts that neither write is visible afterwards. | Resolved (reviewer) |
| R-02 | Minor | `infra/modules/monitoring/main.tf`, `local.log_views`, the dashboard's "Folder requests by outcome over time" query | The query uses `sum(folderOutcome = "answered")` and three more of the same form. Whether Logs Insights accepts a comparison inside `sum()` was not checked (the developer lists "draws four lines" as not verified). The `terraform test` only checks that the view exists. If it is refused, the dashboard shows an error in that view. | Use a form that is certain, for example `stats count(*) as requests by folderOutcome, bin(5m)`, or run the query once against the test environment's log before the Release is called done. | Resolved (reviewer) |
| R-03 | Minor | `e2e/tests/thin-slice.spec.ts`, the test "the could-not-load view appears when the server is blocked, and Try again works by keyboard" | U1's test asserted that the request identifier is shown and that focus moves to "Try again" by itself. Both assertions were dropped, and `retryButton(page).focus()` was added, so the test now provides the focus the old one proved the page provides. The designs ask for neither, so this is a conscious loss of U1 behaviour (focus management after a failure) and not a fault. | The maintainer decides. If the failed view should still move focus, restore the assertion and the behaviour. Otherwise record the decision in `docs/examples.md` or the design. | Unresolved |
| R-04 | Minor | `code-summary.md`, "U1's tests that were changed", and `server/src/http/problem.ts` | The summary says "none asserts less strictly than before". The could-not-load test does assert less (see the row above), and the summary says so itself in the same table. | Reword the sentence so it does not claim all of them assert as strictly. | Resolved (reviewer) |
| R-05 | Minor | `server/src/db/database.ts`, `Database.transaction`, `wholeTransaction` (the `COMMIT` line) and the `catch` block | The deadline can pass while `COMMIT` is already in flight. The `COMMIT` is sent and may be kept, yet the caller is told `DeadlineExceededError`, and the doc comment and design R21 say "nothing was changed". A route copying this in U6 to U8 that retries on that error would find its own item already there and answer a name clash. Nothing in U3 reaches this. | Say in the doc comment that a deadline error after `COMMIT` was sent leaves the outcome unknown. U6 to U8 should answer such an error as "unknown" and not as "nothing changed". | New |
| R-06 | Minor | `server/src/drive/change-step.ts`, `addItem` | `TransactionAbandonedError` is not mapped to any outcome. It can reach the caller if the timer lags the deadline's own clock by a few milliseconds (`withTimeout` has not yet fired). It then arrives instead of `DeadlineExceededError`, and `addItem` rethrows it as an unknown failure. No U3 route calls `addItem`. | When the first change route is written, map both errors to the same "database too slow" answer. Alternatively, have `addItem` convert `TransactionAbandonedError` to `DeadlineExceededError` now. | New |

> R-01 Reviewer note: The guard in `Database.transaction` is sound. The flag is set in the `catch` before the `ROLLBACK` is sent, and `refuseIfAbandoned` also checks `deadline.expired()`, so the gap before the flag is set is covered. A statement already in flight is queued ahead of the `ROLLBACK`, so it is inside the transaction and rolled back. `COMMIT` is refused for work that ends after the deadline. A discarded connection ends the transaction. A new transaction opens its own connection with its own flag. The new test fails on a stray write, since it asserts that no rows exist and that the version is unchanged. The same guard in `client-transactions.ts` is correct. The remaining COMMIT-in-flight window is a new Minor below.

> R-02 Reviewer note: `filter operation = "getFolder" \| stats count(*) by folderOutcome, bin(5m)` is a plain, valid Logs Insights search. The fields `operation` and `folderOutcome` are logged by `server/src/operations/folder.ts`. `view = "table"` is valid for a log widget. The chart-to-table step is disclosed and is a Minor departure from `monitoring-design.md` ("a count over time"). It does not block.

> R-03 Reviewer note: A decision for the maintainer. It is properly put to them under "For the maintainer to decide", point 5, with what is gained and lost. The e2e test still supplies the focus by hand. It is not a fault.

> R-04 Reviewer note: The summary sentence now says that one test asserts less. It no longer claims all assert as strictly.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm run check` | The first run failed only on "container ports to be bound" in `folder-reading.large.integration.test.ts`. Everything else passed: typecheck clean, 55 of 56 files, 758 passed and 2 skipped. I re-ran that file on its own and it passed (2 tests). | Environmental failure, passed on re-run. I did not repeat the whole check, so the coverage line and the build step were not seen on a clean full run by me. |
| `terraform fmt -check -recursive` (environment) | exit 0 | Clean |
| `terraform validate` (environment) | Success, configuration valid | Clean |
| `terraform test` (environment) | 26 passed, 0 failed | Clean. Only that the view exists is tested, not that the query runs. |

### Other checks

- The new R-01 test is valid. It asserts the final state (no rows, version 1), not only that the late statement was refused. Without the guard, the late `ADD_FILE` would be queued behind the `ROLLBACK`. The developer saw only the refusal assertion fail without the guard, not a kept write. I could not run the unguarded variant to see the stray write. This is a limit of the evidence, not a flaw in the guard.
- A `ROLLBACK` that exceeds its 500 ms limit leads to `discard()`. The server then aborts the transaction when the in-flight statement finishes and the connection is gone. This is covered by the earlier deadline test.
- I did not do a full second sweep of the nine U1 changes. `operation.ts` looks coherent: a named part never matches an empty part, and the headers and log fields are declared. I saw no fault in the parts I read. I did not read the deploy action, `deliver.yml` or `0002_items.sql` in this pass.

### Summary

The first review's Major is repaired correctly in both transaction implementations and is tested against a real database. R-02 and R-04 are fixed, and R-03 is an open maintainer decision at Minor. Two new Minor notes concern future callers (the ambiguous outcome of a deadline during `COMMIT`, and the unmapped `TransactionAbandonedError`). Neither blocks.

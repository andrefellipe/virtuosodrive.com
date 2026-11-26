<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-25T10:00:00Z — several AWS behaviours the design relies on (what a small edge function can do, the trust conditions for GitHub's tokens, a new account's limit on function copies) are marked "to confirm" and not verified against documentation here; Infrastructure Design must check them.
- 2026-11-25T10:00:00Z — the list of requirement numbers generated for this step omits the observability and test requirements (NFR5.4 to NFR5.9, NFR10.8 to NFR10.13, NFR11.8, NFR11.9, NFR12.x, NFR13.2); they are designed in the documents but have no row in the cross-reference file.
- 2026-11-25T10:00:00Z — how the server gets its secret values from a network with no internet route is left to Infrastructure Design with three conditions; one option departs from the letter of NFR15.4.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

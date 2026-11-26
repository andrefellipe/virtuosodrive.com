<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-25T01:40:00Z — the scan found 23 defects against the five in `vision.md`; which are in scope is a requirements decision, and several are marked as inferences that need confirming against the live system.
- 2026-11-25T01:40:00Z — live data is likely to hold orphan files, orphan records and shared folder nodes (derived from code, not observed); a read-only export would confirm before migration design.
- 2026-11-25T01:40:00Z — the developer worked alone (no architect link), so scan and synthesis have the same author; no second reading of the nine documents took place.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

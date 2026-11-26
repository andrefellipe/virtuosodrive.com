<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-25T04:10:00Z — cut Units by what a person can do, across building blocks, so each is demonstrable; the cost is that Drive is extended by four Units and the Folder/File shape set in U3 is depended on by five.
- 2026-11-25T04:10:00Z — placed accounts (U2) before the actions it protects; US3.5 and US3.3 therefore cannot be fully closed with their Unit, stated in the story map instead of naming several Units per row.
- 2026-11-25T04:10:00Z — gave the switch its own Unit (U9, packaging) to answer the design review's finding that it had no owner.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-25T04:10:00Z — 33 review points approved as open across four stages now ride into Construction; the Unit-specific ones are listed in each Unit's notes.
- 2026-11-25T04:10:00Z — U8's independence from U2, U5, U6 and U7 rests on the import path being designed as the domain-design review asked; if import must go through accounts or the record, U8 gains edges.
- 2026-11-25T04:10:00Z — deployment was not asked: taken as one application from the unmarked "Modular monolith" line of technical-environment.md.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

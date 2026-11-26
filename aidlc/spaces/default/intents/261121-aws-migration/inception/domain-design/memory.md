<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-25T03:40:00Z — kept maintainer functions inside the blocks that own the data instead of a seventh block; a separate one would reach into three others.
- 2026-11-25T03:40:00Z — Drive records each change through Activity inside the same operation, accepting tighter coupling so that no change can lack a record.
- 2026-11-25T03:40:00Z — upload registers the file only after its content is stored, accepting brief unlisted content over ever listing a file that cannot be downloaded.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-25T03:40:00Z — built-in account screens (the person's choice) put passwords through the site's own pages and narrow the choice of sign-in service; flagged in ADR-006 for infrastructure design.
- 2026-11-25T03:40:00Z — discarding the content of abandoned uploads is the only removal of stored bytes; functional design must fix its boundary against "nothing is ever removed".
- 2026-11-25T03:40:00Z — migrating through the site's own rules is slower than a bulk load; the rehearsal must show it fits a 4-hour read-only period.
- 2026-11-25T03:40:00Z — stories US9.1 to US9.4 map to no component and are deferred to pipeline and infrastructure stages.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

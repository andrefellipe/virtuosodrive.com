<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-25T04:45:00Z — the person left the live-update mechanism to me; chose polling every 3 seconds as the simpler option for a solo learner that still meets 5 seconds; recorded as chosen on their instruction.
- 2026-11-25T04:45:00Z — read "1 GB" as 1 GiB and "a day" as a UTC day; both flagged as my readings.
- 2026-11-25T04:45:00Z — the dependency count is 17 direct edges; I said 16 to the person at the units gate, which was a miscount.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-25T04:45:00Z — settled ten points that the domain-design and units reviews left open, because contracts cannot be written around them (quota reservation, in-process import, name rules in U3, account removal, changedBy withheld by the server, link lifetime, upload expiry, folder version, delete preview, restore semantics). Each is flagged in the document as a proposal.
- 2026-11-25T04:45:00Z — with polling chosen, Activity no longer "announces"; the folder version kept by Drive does that. This departs from components.md and is stated.
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

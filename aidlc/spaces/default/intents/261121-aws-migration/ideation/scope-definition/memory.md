<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-21T18:05:00Z — placed the content export and rehearsal (B-03) ahead of features despite "foundation first"; it is the largest unknown and the live source is publicly writable, so an early safe copy outweighs strict ordering.
- 2026-11-21T18:05:00Z — everything is must-have, so MoSCoW gives no ranking; ordered by dependency and risk instead and said so in the backlog rather than inventing should/could items.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-21T18:05:00Z — Q2 + Q8 (any signed-in user may write; anyone may sign up) only partly closes the public-write problem; asked a follow-up, the person chose open sign-up knowingly; recorded as an accepted risk with the dependency on a change record and content restore.
- 2026-11-21T18:05:00Z — live list as must-have (Q4) was not costed at feasibility; its effect on the US$50 ceiling needs checking at design.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

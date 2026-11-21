<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-21T18:20:00Z — the look is kept, so only what is new or changes behaviour was asked about (sign-in, duplicates, delete, changed-by); the existing layout was taken from `app/public/index.html` rather than asked.
- 2026-11-21T18:20:00Z — sign-in and account-creation steps are left unsketched; they depend on choices made at design and belong to refined mockups.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-21T18:20:00Z — "changed by" visible to anyone conflicted with keeping personal data minimal; follow-up Q7 settled it as display name, signed-in visitors only.
- 2026-11-21T18:20:00Z — "do the same for the other files" in the duplicate dialog is my suggestion, not an answer; flagged as such in the wireframes.
- 2026-11-21T18:20:00Z — how the old site becomes read-only at the switch while staying untouched is unresolved; noted in the user flow for design.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

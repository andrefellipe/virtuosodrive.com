<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
- 2026-11-25T02:45:00Z — used the stage's questions for the three major review points left open on the requirements, since a story cannot be written without taking a side on each.
- 2026-11-25T02:45:00Z — with email confirmation required, a brand-new account's action cannot continue by itself (the file selection does not survive leaving for the email); wrote that the person returns to the folder and chooses the action again, and flagged it as a departure from FR4.4.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-25T02:45:00Z — US3.4 (password reset), the password rule and the failed sign-in pause have no requirement IDs; requirements.md was approved before they were decided.
- 2026-11-25T02:45:00Z — three figures are my defaults (10-character password, 5 attempts then 15 minutes, 24-hour links); marked in the stories for confirmation.
- 2026-11-25T02:45:00Z — the lead worked alone: no designer, developer or quality engineer looked at the stories before the review.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

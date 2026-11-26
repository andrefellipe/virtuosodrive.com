<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-25T09:00:00Z — the person chose Terraform over the planning document's CDK and React over no framework. Terraform brought three follow-ups (licence, state, scanner) and a third item for the one-time setup; the functional design still says two.
- 2026-11-25T09:00:00Z — database service deferred to Infrastructure Design by the person's choice; NFR9.2 (5 seconds after idle) is the requirement a pausing database must be weighed against.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-25T09:00:00Z — Bootstrap as a bundled dependency and the AWS provider's MPL 2.0 licence were not put to the person; both flagged as open points needing approval at the code plan.
- 2026-11-25T09:00:00Z — observability details come from FR12.5/FR12.6 but carry NFR5/NFR10/NFR11 numbers, because the stage requires every detail to inherit an inception NFR number.
- 2026-11-25T09:00:00Z — speed targets, usage assumptions, rate limits and the 15-minute going-back figure are the designer's; only the speed targets were shown in the summary.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

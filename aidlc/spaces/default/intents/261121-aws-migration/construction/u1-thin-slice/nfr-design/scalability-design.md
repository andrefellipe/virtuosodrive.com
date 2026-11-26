# Scalability and Cost Design: U1, the thin slice

How the system handles its expected use and, more to the point here, how it
is kept from costing more than about US$50 a month. The parts named are
described in `logical-components.md` beside this file.

Sources: the scalability requirements
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/nfr-requirements/scalability-requirements.md`),
with `security-requirements.md`, `performance-requirements.md`,
`reliability-requirements.md`, `observability-requirements.md` and
`tech-stack-decisions.md` beside it; the slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`);
contract C1 and the polling decision
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`);
and the answers in `nfr-design-questions.md`.

## C1. Shape

- **The server keeps nothing between requests** except its one database connection and the values it read at start. Any copy can serve any request. More load means more copies, started by the platform; less means fewer, down to none.
- **The database is the one part that does not grow by itself.** It is sized once, at Infrastructure Design, for the expected use.
- **The page's files** are served by the edge from stores near visitors; they place no load on the server.

## C2. Ceilings (NFR11.3, NFR11.4, NFR11.5)

| Limit | Production | Test | Where it is set |
|-------|------------|------|-----------------|
| Requests a second to the server, sustained | 50 | 10 | Server entry point |
| Burst | 100 | 20 | Server entry point |
| Copies of the server running at once | 20 | 5 | The function's own cap |
| Copies of the change runner at once | 1 | 1 | The function's own cap |
| Database connections that can be asked for | 21 | 6 | Follows from the two rows above |

- A request beyond the limit is answered by the entry point with status 429 before it reaches the server. That answer is the entry point's own and is not a Problem. The page's shared call function treats a 429 on a read as worth another try (performance design, P5).
- The lower figures for test are this design's; the requirement (NFR11.3) gives one pair of figures, 50 and 100, which are kept for production. Test is lower because it shares the account's budget and has only the maintainer and the pipeline as callers.
- The database chosen must allow at least 25 connections in production and 10 in test, leaving room for the maintainer's own.
- 50 a second is five times the assumed peak of 10 a second once the list asks every 3 seconds.
- **What is not limited.** Requests for the page's files are answered by the edge and are not counted against these limits. Limiting them needs a paid protective service, which is not included. A flood of such requests costs data transfer; the budget alarm and its forecast are the defence. The maintainer confirmed this limit of the design.
- **New-account limits.** A new AWS account may allow fewer simultaneous function copies in total than the caps above ask to reserve. To confirm at Infrastructure Design; if so, the caps are lowered to fit until a higher limit is granted.

## C3. What the estimate must contain (NFR11.1, NFR11.2, NFR11.6, NFR11.10)

The estimate is produced at Infrastructure Design with current prices. This
design fixes its structure so that nothing is left out.

| Line | Per environment or once | Kind of cost |
|------|-------------------------|--------------|
| Database, including storage | Per environment | Fixed, the largest |
| Database backups beyond what is included | Per environment | By size |
| How the server reaches the secrets service from the private network | Per environment | Fixed if a private connection point is used; nothing if not (security design, S4) |
| Secrets held | Per environment | Fixed, small, per secret |
| Server and change runner | Per environment | By use |
| Store of Release packages, ten kept | Per environment | By size, tiny |
| Server entry point | Per environment | By use |
| Edge, including the edge check | Per environment | By use |
| Page files store | Per environment | By size, tiny |
| Logs: taking in, keeping 30 days, searching | Per environment | By size |
| Measurements, alarms, the one screen | Per environment and once | Fixed, small |
| Health monitor | Production only | Fixed, small |
| Name records for the site | Once | Fixed, small |
| Certificate | Once | None expected |
| Terraform's state | Once | By size, tiny |
| Notification channel and budget alarm | Once | None expected |
| The safe copy kept from the migration until acceptance | Once, temporary | By size |
| Pipeline minutes on GitHub | Once | None if within the plan's allowance; to confirm |

Rules for the estimate:

- It is computed at the expected use (scalability requirements) and again at five times that.
- Any line with a fixed cost above US$15 a month is named to the maintainer.
- The test environment's database is the smallest that works, and where the chosen service can pause or stop when idle, it does so in test.
- If the total exceeds US$50, the options put to the maintainer are, in this order: a smaller or pausing database; no private connection point; one environment's database shared by schema; a higher ceiling.

## C4. Keeping test cheap (NFR11.6)

- Lower limits and caps (C2).
- No alarms that email, and no health monitor, except for the few hours in which the alarms are being proved: a switch in the Terraform definitions adds the health monitor and emailing to test, by a pull request, and a second pull request removes them (observability design, O5). The estimate counts that as a one-off of a few cents.
- Logs kept 30 days as in production (the requirement covers both), but with far less traffic.
- The end-to-end tests and the 100-call measurement are the only regular load.

## C5. After the first month (NFR11.7)

A short record is added to the repository comparing each line of the estimate
with the bill, by the maintainer with the agent's help, and the estimate is
corrected. This is a reminder the Unit leaves behind, not something it can
complete itself.

## C6. Growth in later Units

| What | Effect on this design |
|------|-----------------------|
| The list asking every 3 seconds (U5) | Within C2's limits at the assumed use; measured there |
| File contents (U4, U7, U8) | A new store and data transfer; the largest variable cost, estimated in those Units |
| Accounts (U2) | A sign-in service with its own price by number of people |

## Open points

1. **The assumed use is a guess** (30 people at once). The first month's figures correct it.
2. **Page files are not rate-limited** (C2).
3. **The total is not yet known.** This document makes the estimate complete; it does not make it fit.

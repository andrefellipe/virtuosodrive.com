# Decision Log: Ideation phase

Every decision made in the first phase, in order, with where it is recorded.
All were made by the maintainer. Paths are under
`aidlc/spaces/default/intents/261121-aws-migration/ideation/`.

## Intent capture

Recorded in `intent-capture/intent-capture-questions.md`; reflected in
`intent-capture/intent-statement.md` and `intent-capture/stakeholder-map.md`.

| # | Decision | Answer |
|---|----------|--------|
| D-01 | The problem | All three together: Google Cloud dependency, public write access, no tests or pipeline |
| D-02 | Who it is for | Student readers, contributors, the maintainer |
| D-03 | Success measures | All six, with the targets in `vision.md` |
| D-04 | Trigger | A learning and demonstration goal |
| D-05 | Other stakeholders | None |
| D-06 | Who decides scope and priority | The maintainer alone |
| D-07 | Reporting | None; the AI-DLC record is enough |
| D-08 | Left out of the first version | Search, tags, previews; folder rename and download; sharing, comments, ratings; mobile app; Firebase decommissioning |
| D-09 | Open assumptions | Accepted as assumptions |
| D-10 | Stage approval | Approved with five review points open |

## Market research

| # | Decision | Answer |
|---|----------|--------|
| D-11 | Whether to run it | Skipped: non-commercial tool, and the trigger rules out buying |

## Feasibility

Recorded in `feasibility/feasibility-questions.md`; reflected in
`feasibility/feasibility-assessment.md`, `feasibility/constraint-register.md`
and `feasibility/raid-log.md`.

| # | Decision | Answer |
|---|----------|--------|
| D-12 | Statements in `technical-environment.md` | All correct: one developer; AWS only; PostgreSQL; one dedicated account with a budget alarm; existing site untouched; nothing automated today |
| D-13 | Access to the existing system | Owner access, confirmed recently |
| D-14 | Amount of content | Large: thousands of files or more than 1 GB |
| D-15 | AWS account | Dedicated account exists, administrator access |
| D-16 | Monthly cost ceiling | About US$50 |
| D-17 | Deadline | None |
| D-18 | Data-protection rules | No formal obligation identified; keep personal data to the minimum |
| D-19 | Where data is kept | No rule; lowest price over closeness to users |
| D-20 | Stage approval | Approved |

## Scope definition

Recorded in `scope-definition/scope-definition-questions.md`; reflected in
`scope-definition/scope-document.md` and `scope-definition/intent-backlog.md`.

| # | Decision | Answer |
|---|----------|--------|
| D-21 | Must-have capabilities | All eight |
| D-22 | Who may change content | Any signed-in user |
| D-23 | Reading without sign-in | Yes, browsing and downloading stay open |
| D-24 | Live-updating list | Must-have, as today |
| D-25 | Look and language | Unchanged |
| D-26 | Read-only period at the switch | A few hours is acceptable |
| D-27 | Order of work | Foundation first |
| D-28 | Who can get an account | Anyone can sign up |
| D-29 | Stage approval | Approved |

## Team formation

| # | Decision | Answer |
|---|----------|--------|
| D-30 | Whether to run it | Skipped: one-person project |

## Rough mockups

Recorded in `rough-mockups/rough-mockups-questions.md`; reflected in
`rough-mockups/wireframes.md` and `rough-mockups/user-flow.md`.

| # | Decision | Answer |
|---|----------|--------|
| D-31 | Actions for a signed-out visitor | All visible; those that change content ask for sign-in |
| D-32 | Where sign-in sits | Top right corner |
| D-33 | Devices and accessibility | Phone and laptop, WCAG 2.1 AA |
| D-34 | Duplicate name on upload | Ask each time: replace, keep both, skip |
| D-35 | Delete | Always confirmed, naming what goes |
| D-36 | "Changed by" | A column in the list |
| D-37 | What "changed by" shows | A display name, to signed-in visitors only |
| D-38 | Stage approval | Approved with six review points open |

## Approval and handoff

Recorded in `approval-handoff/approval-handoff-questions.md`; reflected in
`approval-handoff/initiative-brief.md`.

| # | Decision | Answer |
|---|----------|--------|
| D-39 | Open risks | All five accepted as they stand |
| D-40 | Open review points | All eleven carried into the next phase |
| D-41 | Go or no-go | Go |

## Decisions deliberately not made in this phase

Left for the stages that need them: the Region; how the database is run; the
shape of the server side; the frontend approach; the infrastructure tooling;
the repository layout; file size and type limits; whether deletion is
permanent; the web address; handling of a person's data on request.

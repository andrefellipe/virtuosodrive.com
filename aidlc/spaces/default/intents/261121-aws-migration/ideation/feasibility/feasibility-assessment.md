# Feasibility Assessment: Virtuoso Drive migration

Based on the approved intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`)
and the answers in `feasibility-questions.md` (Q1 to Q8). Market research was
not run for this work, so there is no competitive analysis, market trends
report or build-versus-buy assessment to draw on.

## Verdict

**Feasible, with no blocker identified.** The things that most often stop a
migration before it starts are all in place: access to the source system, a
destination account, a budget, and no deadline pressure. The remaining
uncertainty is about size and effort, not about whether it can be done.

| Area | Finding | Confidence | Basis |
|------|---------|------------|-------|
| Access to the source | Owner access to the Firebase project is confirmed and recent | High | Q2 |
| Destination | A dedicated AWS account exists with administrator access | High | Q4 |
| Budget | Up to about US$50 a month; enough for a managed PostgreSQL database alongside the rest, to be confirmed by a cost estimate at design time | Medium | Q5 |
| Time | No deadline, so quality and learning take priority over speed | High | Q6 |
| Skills | One developer who knows JavaScript and Node.js and is learning AWS and AI-DLC; achievable if choices stay mainstream and well documented | Medium | Q1 |
| Content to move | Large: thousands of files or more than 1 GB; the exact figure is unmeasured | Medium | Q3 |
| Outside rules | No formal data-protection obligation identified and no rule on where data is kept | Medium | Q7, Q8 |

## How each success metric looks

The intent statement adopts six success metrics. Each is assessed here for
whether it can realistically be met.

| Metric (from the intent statement) | Achievable? | What it depends on |
|------------------------------------|-------------|--------------------|
| Zero runtime dependencies on Google Cloud | Yes | Every part of the system moving; nothing can be left behind |
| No data change without sign-in | Yes | Deciding who may sign in and who counts as a contributor, which is still open |
| Automated tests on every change | Yes | Starting from nothing: there are no tests, linter or pipeline today (Q1) |
| Infrastructure 100% defined as code | Yes | Discipline from the first resource; nothing created by hand in the account |
| 100% of files and folders preserved | Yes, with care | A rehearsal and a count-and-size check, because the volume is large (Q3) |
| 100% of source changes traceable to an approved AI-DLC Unit | Yes | Keeping to the workflow for every change |

## Where the uncertainty is

- **Content volume is the largest unknown.** "Large" is an estimate (Q3). Until an export is measured, the time a full copy takes, and therefore the length of any read-only window at cut-over, is a hypothesis.
- **Effort is hard to predict for one person learning the platform.** This is acceptable because there is no deadline (Q6) and the trigger is a learning and demonstration goal (intent statement), but it is the main reason the work could stall.
- **Running cost is an estimate until design.** The ceiling (Q5) leaves room, and the stated preference for lowest price over closeness to users (Q8) helps, but no figure has been calculated yet.
- **Data-protection obligations are assumed light, not verified.** The answer is that no formal obligation has been identified (Q7). This is not legal advice: the Brazilian data-protection law may apply to any system that holds email addresses of people in Brazil whether or not anyone has identified it as an obligation. Treating personal data with minimum collection and a way to delete it keeps the system safe either way.

## What keeps the risk low

- The existing site stays live and untouched until cut-over is accepted, so going back at any point means carrying on with what exists today (Q1).
- The migration only reads from the existing system (Q1).
- There is one decision-maker and no outside approval to wait for (intent statement, stakeholder map).

## Carried forward, still open

The assumptions accepted in the intent statement remain assumptions here: the
ten open questions in `vision.md`, who counts as a contributor, the unverified
"today" figures, and the list of features the first version must include.
Nothing in this assessment settles them.

## Recommendation

Proceed. Measure the real content volume early, and produce the cost estimate
before any commitment to a particular way of running the database.

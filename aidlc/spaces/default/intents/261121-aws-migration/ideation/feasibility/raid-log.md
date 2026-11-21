# RAID Log: Virtuoso Drive migration

Risks, assumptions, issues and dependencies for the work described in the
approved intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`).
Answers referred to as Q1 to Q8 are in `feasibility-questions.md`. The owner of
every item is the maintainer, who is the only decision-maker.

## Risks

| ID | Risk | Likelihood | Impact | Response |
|----|------|------------|--------|----------|
| R-01 | Content is lost, renamed or corrupted during migration; the volume is large (Q3) | Medium | High | Rehearse the migration; check file and folder counts and sizes against the source; leave the source intact and read-only for the migration |
| R-02 | The copy takes longer than expected because the real volume is unmeasured (Q3), stretching any read-only window at cut-over | Medium | Medium | Measure the volume from an export early; time the rehearsal |
| R-03 | Monthly cost exceeds the ceiling of about US$50 (Q5) | Medium | Medium | Cost estimate before committing to a way of running the database; budget alarm before the first resource; prefer what costs nothing while idle |
| R-04 | The work stalls: one person, learning the platform, with no deadline to force progress (Q1, Q6) | Medium | Medium | Small pieces of work, each deployable and checked on its own |
| R-05 | A data-protection law applies even though no obligation has been identified (Q7); hypothesis, not legal advice | Low | Medium | Collect the minimum personal data; be able to delete a person's data on request; revisit if an obligation is identified |
| R-06 | Requiring sign-in puts off casual readers | Medium | Medium | Decide whether reading stays anonymous (open question, carried from the intent statement) |
| R-07 | Resources are created in the AWS account outside what was planned | Low | Medium | Dedicated account (Q4); everything through infrastructure defined as code; budget alarm |
| R-08 | Contributors' needs are misjudged because nobody besides the maintainer is consulted (intent statement, stakeholder map) | Low | Low | Accepted by the maintainer; keep today's upload and organise flow as the reference |
| R-09 | Choosing the lowest-price location over closeness (Q8) makes the system feel slower for users in Brazil | Low | Low | Accepted by the maintainer; check responsiveness when the first version is deployed |

## Assumptions

| ID | Assumption | If wrong | To be checked |
|----|------------|----------|---------------|
| A-01 | "Large" (Q3) means a volume that one person can copy and verify in a reasonable rehearsal | The migration approach and cut-over window need rethinking | By measuring an export |
| A-02 | About US$50 a month (Q5) is enough for the whole system including a managed PostgreSQL database | Either the ceiling or the way the database is run has to change | By a cost estimate at design time |
| A-03 | Owner access to the Firebase project (Q2) is sufficient to export both the folder data and the file contents | A further permission has to be granted before the rehearsal | At the first export |
| A-04 | The ten open questions in `vision.md` are answered in later stages, as accepted in the intent statement | Requirements cannot be completed | At scope definition and requirements |
| A-05 | The "today" figures beside the success metrics are correct, as accepted in the intent statement | Baselines are restated; targets are unaffected | When the existing code is analysed |
| A-06 | The features the first version must include are those listed in `vision.md`, as accepted in the intent statement | Scope changes | At scope definition |

## Issues

| ID | Issue | Effect | Action |
|----|-------|--------|--------|
| I-01 | The existing system lets anyone change or delete content (intent statement, problem statement) | Content could be damaged at any time before or during the migration | Take a full export early and keep it as a safe copy |
| I-02 | There are no tests, no linter and no pipeline today (Q1) | There is no automated way to tell whether the new system behaves like the old one | The existing behaviour is documented before it is rebuilt |

## Dependencies

| ID | Dependency | Status | Source |
|----|------------|--------|--------|
| D-01 | Owner access to the Firebase project `virtuoso-drive` | In place, confirmed recently | Q2 |
| D-02 | A dedicated AWS account with administrator access | In place | Q4 |
| D-03 | A budget alarm in that account before any resource is created | To do | Q1 |
| D-04 | The maintainer's time; there is no one else | Available, no deadline | Q1, Q6 |
| D-05 | The existing Firebase site remaining available until cut-over is accepted | In place | Q1 |

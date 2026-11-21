# Constraint Register: Virtuoso Drive migration

Constraints are limits the work must stay inside. Each traces to the approved
intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`)
or to a confirmed answer in `feasibility-questions.md`.

## Technical

| ID | Constraint | Source | Negotiable? |
|----|------------|--------|-------------|
| C-01 | After cut-over the system runs on AWS only, with no Google Cloud or Firebase dependency at runtime | Q1; intent statement (success metric) | No |
| C-02 | PostgreSQL is the system of record for the folder tree and file metadata | Q1 | No |
| C-03 | The existing Firebase site and its data stay live and unchanged during the work; the new system never writes to it, and migration only reads | Q1 | No |
| C-04 | Everything runs in one dedicated AWS account, with a budget alarm in place before any resource is created | Q1, Q4 | No |
| C-05 | All existing files and folders must arrive intact: 100% preserved | Intent statement (success metric) | No |
| C-06 | Nothing may change data without sign-in | Intent statement (success metric) | No |
| C-07 | All infrastructure is defined as code; nothing is created by hand | Intent statement (success metric) | No |
| C-08 | Automated tests run on every change, starting from none today | Intent statement (success metric); Q1 | No |
| C-09 | The content to move is large (thousands of files or more than 1 GB), so the copy must work at that size and be checkable | Q3 | Fact, not a choice |

## Organisational

| ID | Constraint | Source | Negotiable? |
|----|------------|--------|-------------|
| C-10 | One person builds and operates the system, so operating effort must stay low | Q1 | No |
| C-11 | That person is learning AWS and AI-DLC, so mainstream, well-documented choices are preferred over clever ones | Q1 | Preference |
| C-12 | Running cost stays at or under about US$50 a month | Q5 | Yes, by the maintainer |
| C-13 | Where closeness to users and price pull apart, the lowest price wins | Q8 | Yes, by the maintainer |
| C-14 | Every source change must be traceable to an approved AI-DLC Unit | Intent statement (success metric) | No |
| C-15 | There is no deadline; the work is not to be rushed at the cost of quality | Q6 | Not applicable |
| C-16 | The maintainer alone decides scope and priority; nobody else is consulted or reported to | Intent statement; stakeholder map | Not applicable |

## Regulatory

| ID | Constraint | Source | Negotiable? |
|----|------------|--------|-------------|
| C-17 | No formal data-protection obligation has been identified; good practice applies: keep personal data to the minimum | Q7 | Revisit if an obligation is identified |
| C-18 | There is no rule that data must stay in Brazil | Q8 | Revisit if a rule is identified |

## Scope boundary carried from the intent statement

These are not constraints on how the work is done but limits on what it
includes. The first version leaves out: search, tags and previews; folder
rename and folder download; sharing links, comments and ratings; a native
mobile app; and decommissioning the Firebase project.

## Not yet constraints

The following could become constraints once answered, and are still open
(carried as assumptions from the intent statement): who may change content and
whether reading stays anonymous; whether a read-only window at cut-over is
acceptable; file size and type limits; whether deletion is permanent.

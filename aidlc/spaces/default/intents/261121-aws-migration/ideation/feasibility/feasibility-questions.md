# Feasibility & Constraints: Questions

These questions establish whether the migration can be done with what you have
(access, accounts, budget, time) and which outside rules apply. They follow
from the approved intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`).

## Q1. What your documents already answer

`aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md` already
answers these. Confirm them once instead of answering each.

- Who builds and runs it, and with what skills? One developer, with JavaScript and Node.js experience, learning AWS and AI-DLC. (`technical-environment.md`: "One developer. JavaScript and Node.js experience. Learning AWS and AI-DLC")
- Which cloud after cut-over? AWS only, with no Google Cloud or Firebase dependency at runtime. (`technical-environment.md`: "AWS only. No Google Cloud or Firebase dependency at runtime after cut-over")
- Which data store is the system of record? PostgreSQL, for the folder tree and file metadata. (`technical-environment.md`: "Primary store: PostgreSQL for the folder tree and file metadata")
- How is the AWS account organised? A single dedicated account for this project, with a budget alarm before any resource is created. (`technical-environment.md`: "Single dedicated account for this project, with a budget alarm before any resource is created")
- What happens to the existing system during the work? The Firebase site stays live and unchanged, nothing writes to it from the new system, and going back means continuing to use it. (`technical-environment.md`: "the Firebase site stays live and unchanged while the AWS version is built and tested. Nothing writes to Firebase from the new system")
- Is anything automated today? No tests, no linter configuration and no pipeline. (`technical-environment.md`: "none. No tests, no linter configuration, no pipeline")

A. All correct
B. Some need changing (say which and how)
X. Other (please specify)

[Answer]: A

## Q2. [Maintainer] Can you still get into the Firebase project to export its data?

The migration reads folders and files from the Firebase project
`virtuoso-drive`. Without owner access there is nothing to migrate from, so
this is the first thing that could stop the work.

A. Yes, I have owner access and have confirmed it recently
B. I believe so, but I have not checked since the project was built
C. No, access is lost or uncertain and would need to be recovered
D. Not yet known
X. Other (please specify)

[Answer]: A

## Q3. [Maintainer] Roughly how much content is in the live system today?

The amount decides how the content is copied and how long a read-only window
at cut-over would be.

A. Little or none worth keeping (test data, or fewer than about 100 files)
B. A modest amount (hundreds of files, up to about 1 GB)
C. A large amount (thousands of files, or more than 1 GB)
D. Not yet known; it has to be measured from an export
X. Other (please specify)

[Answer]: C

## Q4. [Maintainer] Is the AWS account for this project ready?

`technical-environment.md` says the work uses one dedicated account. This asks
whether it exists and whether you can administer it.

A. Yes, a dedicated account exists and I have administrator access
B. I have an AWS account, but it is shared with other things
C. No account exists yet; creating it is part of getting started
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q5. [Maintainer] What is the monthly cost ceiling?

`vision.md` leaves the figure open. The ceiling rules options in or out at
design time, in particular for the database, which is usually the largest
fixed cost of a small system.

A. Close to nothing while idle: about US$5 a month or less
B. Up to about US$20 a month
C. Up to about US$50 a month
D. Not yet defined
X. Other (please specify)

[Answer]: C

## Q6. [Maintainer] Is there a deadline?

A. No deadline; it is done when it is done properly
B. A soft target of a few weeks
C. A fixed date (please give it under Other)
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q7. [Product owner] Which data-protection rules apply once people sign in?

With sign-in the system holds personal data, at least email addresses.
`technical-environment.md` assumes the Brazilian data-protection law (LGPD)
applies and marks that as unconfirmed.

A. LGPD applies and is to be treated as a requirement
B. LGPD applies, and the university also has rules of its own that must be followed
C. No formal obligation has been identified; follow good practice and keep personal data to the minimum
D. Not yet known
X. Other (please specify)

[Answer]: C

## Q8. [Product owner] Must the data stay in Brazil?

The users are in Brazil. A rule that data must stay in the country would fix
where the system runs; without one, the choice between closeness and price is
left to design.

A. Yes, the data must stay in Brazil
B. No rule; closeness to the users matters more than price
C. No rule; the lowest price matters more than closeness
D. Not yet decided
X. Other (please specify)

[Answer]: C

## Consolidated Summary Confirmation

- Documents (Q1): all correct. One developer with JavaScript and Node.js experience, learning AWS and AI-DLC; AWS only after cut-over; PostgreSQL as the system of record; one dedicated AWS account with a budget alarm before any resource is created; the Firebase site stays live and untouched during the work; no tests, linter or pipeline today.
- Firebase access (Q2): you have owner access and confirmed it recently.
- Content volume (Q3): large. Thousands of files, or more than 1 GB.
- AWS account (Q4): a dedicated account exists and you have administrator access.
- Cost ceiling (Q5): up to about US$50 a month.
- Deadline (Q6): none.
- Data-protection rules (Q7): no formal obligation identified; follow good practice and keep personal data to the minimum.
- Data location (Q8): no rule that data must stay in Brazil; the lowest price matters more than closeness to the users.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

# User Stories: Plan and Questions

## Story plan

- **Personas.** Four, drawn from the groups you confirmed in the intent statement: the reader (never signs in), the contributor (signs in to add and organise), the maintainer on the site (deals with misuse and mistakes), and the maintainer as operator (migrates, switches over, runs it).
- **Format.** "As a ..., I want ..., so that ...", each with acceptance criteria written as Given / When / Then, including what happens when things go wrong. Each story can be built and tested on its own.
- **Breakdown.** By journey, following the requirement groups FR1 to FR12 of `aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`: one story per thing a person sets out to do, so about 25 to 30 stories.
- **Priority.** Every story is Must Have, because every capability was confirmed as must-have. Stories that come only from an assumption are marked so.
- **Not turned into stories.** Quality requirements that are not a journey (encryption, cost, coverage, traceability) stay as requirements for the stages that own them.

Three points from the review of the requirements have to be decided before the
sign-in and migration stories can be written honestly. You approved the
requirements with these accepted as open; a story has to take one side.

## Q1. [Product owner] Must a new account confirm its email address before it can change content?

I added email confirmation to the requirements as a default (FR4.2), and it
contradicts the sign-up flow you approved in the sketches, where a new person
signs up and the action they chose carries on (FR4.4). Without confirmation,
anyone can sign up with an address that is not theirs, and the record of who
changed what may name nobody reachable.

A. No confirmation: a new account can change content straight away, as in the approved flow
B. Confirmation required: after signing up, the person must open a link sent by email; they then return to the same folder and continue
C. Not yet decided
X. Other (please specify)

[Answer]: B

## Q2. [Product owner] Which account basics are in the first version?

The requirements say how to create an account and sign in, but not what
happens when someone forgets their password, what a password must look like,
or what happens after repeated wrong passwords. Without the first, a
locked-out contributor can only ask you.

A. All three: reset a forgotten password by email; a minimum password length; a pause after repeated failed sign-ins
B. Only resetting a forgotten password by email
C. None in the first version
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q3. [Maintainer] At migration, what happens when two files with the same name end up in one folder?

Folders with the same name in the same place share one set of contents today,
and the migration brings them over as one folder (FR10.5). If that folder then
holds two files with the same name, the new system's rule that names are
unique in a folder (FR6.2) cannot hold for both.

A. Keep both: the second gets a numbered name such as "exam (1).pdf", and the report notes it
B. Keep the first and list the others in the report as not brought over
C. Not yet decided
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Plan: four personas (reader, contributor, maintainer on the site, maintainer as operator); about 25 to 30 stories, one per journey, following the requirement groups; every story Must Have; acceptance criteria as Given / When / Then.
- Email confirmation (Q1): required. After signing up the person opens a link sent by email, then returns to the same folder and continues.
- Account basics (Q2): all three. Reset a forgotten password by email; a minimum password length; a pause after repeated failed sign-ins.
- Same-named files after a folder merge at migration (Q3): keep both; the second gets a numbered name, and the report notes it.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

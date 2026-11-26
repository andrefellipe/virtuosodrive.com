# Delivery Planning: Questions

This step puts the nine Units in a build order and says what each build must
show before the next starts. It draws on the Units
(`aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`,
`unit-of-work-dependency.md`, `unit-of-work-story-map.md`), the contracts
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the building blocks
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`),
the screens
(`aidlc/spaces/default/intents/261121-aws-migration/inception/refined-mockups/mockups.md`),
the stories and requirements, and the team practices
(`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`).

Already settled, and not asked:

- **The thin end-to-end slice is built first** (team practices), which is U1.
- **One Unit at a time** (team practices), so nothing is built in parallel.
- **One Unit per Bolt.** A Bolt is one build pass over a piece of the work, ending in something that runs. You chose nine Units so that each can be shown working, so each is its own Bolt.
- **No deadline** (feasibility), so nothing is ranked by urgency, and no scoring formula is needed for nine items whose order is mostly fixed by what needs what.

## Q1. [Maintainer] After the thin slice, what comes first: the migration, or the rest of the site?

The dependencies leave one real choice. The migration tool (U8) needs only
browsing (U3) and downloading (U4), so it can be built third in line, or left
until the whole site is done. It is the largest piece and the one with the
most unknowns: how much content there is, what state it is in, and whether the
final copy fits in the 4-hour read-only period. Building it early means
learning those things early, and gives a safe copy of the old content while
the old site can still be damaged by anyone. Building it late means a complete
site is ready sooner, and the migration is written against rules that have
stopped changing.

A. Migration early: thin slice, browsing, downloading, migration tool, then accounts, record of changes, organising, uploading, and the switch
B. Site first: thin slice, accounts, browsing, downloading, record of changes, organising, uploading, then the migration tool and the switch
C. Decide for me, and explain the choice so I can change it at approval
X. Other (please specify)

[Answer]: A

## Q2. [Maintainer] What worries you most about this build?

The answer decides what each Bolt is asked to prove first, and where extra
care goes.

A. Losing or damaging content in the migration
B. The monthly bill going over about US$50
C. Sign-in and open sign-up being unsafe or misused
D. The work stalling before it is finished
X. Other (please specify)

[Answer]: D

## Q3. [Developer] How does a finished Unit get merged?

Left open since Practices Discovery. Your rule is that every piece goes
through a pull request on GitHub whose checks must pass. By default, a
finished Unit would instead be merged on your machine. Until U1 exists there
are no checks to pass, so U1 is a special case either way.

A. Every Unit, U1 included, is pushed as a branch and merged through a pull request that you merge on GitHub. For U1 the checks it creates run on its own pull request
B. U1 is merged on your machine, because the checks do not exist yet; every Unit after it goes through a pull request
C. Decide this inside U1's own design, when the pipeline is chosen
X. Other (please specify)

[Answer]: A

## Q4. [Developer] When is the check that proves each finished Unit chosen?

After each Unit is built, one command is run to prove it works before you
approve it, and the same command is used for every Unit. It has to run every
kind of test your practices require and the coverage check. The repository has
no tests and no such command today; U1 is the Unit that creates one.

A. Choose it at the first checkpoint, once U1 has created a real command to choose
B. Fix it now as `npm run verify`, a name U1 must then create and make run lint, type check, unit and integration tests with coverage, and the end-to-end tests
C. Not yet decided
X. Other (please specify)

[Answer]: A

## Q5. [Maintainer] What tells us a Bolt is dragging and should be stopped and looked at?

Asked after the independent review of the plan, which found that "three times
its estimate" cannot be checked because the estimates are only S, M, L and XL.

A. A time box set after Bolt 1 shows how long a Bolt takes; a Bolt past its limit is stopped and split
B. A count of review rounds: a Bolt is stopped when a document or its code has been sent back three times
C. No fixed trigger: the maintainer judges it at each approval; the plan only names what could be cut
X. Other (please specify)

[Answer]: C

## Q6. [Maintainer] What does the production address hold between Bolt 1 and the switch?

Asked after the independent review of the plan. Without a decision, a
half-built site with open sign-up and sample content would be public at
`virtuoso.andrefellipelabs.com` for the whole build.

A. Private until the switch: deployed but reachable only by the maintainer until Bolt 9; its data is emptied before the final copy
B. Public but unadvertised, with sign-up closed to others until the switch; data emptied before the final copy
C. A temporary address until Bolt 9, when the final address is pointed at it; data emptied before the final copy
X. Other (please specify)

[Answer]: A

## Q7. [Maintainer] Is the test environment private too?

Asked after the second independent review. From Bolt 4 the test environment
holds the real migrated content, and from Bolt 5 real sign-up email addresses.

A. Both private: the test environment is reachable only by the maintainer and the pipeline, the same way as production
B. Test environment public: anyone with its address can reach it
X. Other (please specify)

[Answer]: A

## Q8. [Maintainer] What is the "safe copy" after Bolt 4?

Asked after the second independent review, which found that the plan kept only
a database export and a list of files, with the file contents in a test
environment that was to be emptied.

A. Separate durable copy: Bolt 4 also puts the export and all file contents in private storage outside both environments, kept until the new site is accepted
B. Keep the rehearsal copy in the test environment until the switch
C. No copy; drop the claim that the content is safe after Bolt 4
X. Other (please specify)

[Answer]: A

## Q9. [Maintainer] Before the final copy at the switch, production is "emptied". What does that remove?

A. Content only: folders, files, deleted items and the record of changes; accounts are kept
B. Everything, accounts included; the maintainer's account is made again as part of the switch
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Order (Q1): migration early. Thin slice (U1), browsing (U3), downloading (U4), migration tool (U8), then accounts (U2), record of changes (U5), organising (U6), uploading (U7), and the switch (U9).
- Biggest worry (Q2): the work stalling before it is finished. Each Bolt is therefore kept to one Unit, ends in something you can see working, and the plan names what to cut or pause if a Bolt drags.
- Stalling (Q5): no fixed trigger. The maintainer judges at each approval whether a Bolt is dragging.
- Production before the switch (Q6): private, reachable only by the maintainer until Bolt 9, and emptied before the final copy.
- Test environment (Q7): private too, reachable only by the maintainer and the pipeline.
- Safe copy (Q8): Bolt 4 puts the export and all file contents in private storage outside both environments, kept until the new site is accepted.
- "Emptied" (Q9): content only; accounts are kept.
- Merging (Q3): every Unit, U1 included, is pushed as a branch and merged through a pull request that you merge on GitHub; the checks U1 creates run on its own pull request.
- The check for each finished Unit (Q4): chosen at the first checkpoint, once U1 has created a real command.
- Settled earlier: one Unit per Bolt; one Bolt at a time; the thin slice first; no deadline.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

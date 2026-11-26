# Why This Order: Virtuoso Drive on AWS

The reasoning behind the order of the nine **Bolts** in `bolt-plan.md` (a Bolt
is one build pass over a piece of the work, ending in something that runs).
It rests on which Unit needs which
(`aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work-dependency.md`,
with `unit-of-work.md` and `unit-of-work-story-map.md`), the contracts
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the building blocks
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`),
the screens
(`aidlc/spaces/default/intents/261121-aws-migration/inception/refined-mockups/mockups.md`),
the requirements and stories
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`,
`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`),
the team practices
(`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`)
and the maintainer's answers Q1 to Q9 in `delivery-planning-questions.md`.

## The approach

Two rules, in this order:

1. **Walking skeleton first.** A walking skeleton is a minimal version that runs the whole way through, built before any feature to prove the pieces connect (Cockburn). The team practices require it, and it is the only Unit that needs nothing.
2. **Then risk first**: the piece with the most unknowns as early as its needs allow (Boehm's spiral model: settle the largest uncertainties before building on them). The maintainer chose this by putting the migration early (Q1).

No scoring formula was used. A formula such as WSJF (weighted shortest job
first: value and urgency divided by size) ranks many items of comparable
freedom. Here there are nine items, eight of them constrained by what they
need, no deadline to give urgency, and every capability declared must-have, so
a score would be arithmetic on guesses. The one real choice was put to the
maintainer in words.

## What the dependencies leave open

U1 is first and U9 is last in any order. Between them:

- U3 and U2 can each follow U1.
- U4 needs U3. U8 needs U3 and U4.
- U5 needs U2 and U3. U6 needs U5. U7 needs U4 and U6.

So the choices are only where U2 goes relative to U3 and U4, and where U8
goes. The chosen order is U1, U3, U4, U8, U2, U5, U6, U7, U9.

**This rests on the 17 listed dependencies, and one is in doubt.** The
contracts review found that browsing (U3), as the contracts are written, uses
accounts (U2) to return "changed by" and uses stored contents (U4), with
neither dependency listed. The chosen order is valid only if Bolt 2 leaves
"changed by" to U6 and uses sample records that need no stored contents. That
is settled first in Bolt 2's design. If browsing is instead made to depend on
accounts, the order becomes U1, U2, U3, U4, U8, U5, U6, U7, U9, and the
migration is learned from one Bolt later. The stored-contents half has no
reordering to fall back on, since U4 itself needs U3: the remedy there is to
build U3 and U4 as one Bolt or to move the stored-content record to U3.

## Why browsing and downloading before accounts (U3, U4 before U2)

- They are what U8 needs, and U8 is wanted early.
- After them the new site can do everything a reader does today. Readers are the largest group of users, and this is the two smallest Units after the skeleton. Nobody but the maintainer can reach it yet: both environments are private until the switch (Q6, Q7).
- They need no sign-in service, which is the least settled technical choice. Putting U2 fifth gives that choice time, and Bolt 1's experience, behind it.
- The cost: for three Bolts nothing can be changed through the site and no account exists. That is harmless because the old site remains in use throughout.

## Why the migration fourth (U8)

**For.** It holds the three largest unknowns of the work: how much content,
in what state, and whether the final copy fits a 4-hour read-only period. Each
could change the plan: the size affects cost and the copy time; the state
decides how much the report will ask of the maintainer; a copy that does not
fit forces a longer read-only period or a different way of migrating. Learning
this at Bolt 4 leaves five Bolts in which to adapt. Learning it at Bolt 8
leaves one. It also yields an early safe copy of content that anyone can still
damage on the old site: by the maintainer's choice (Q8), Bolt 4 puts the
database export and every file's contents in private storage outside both
environments, kept until the new site is accepted. The rehearsal copy in the
test environment is not that safe copy and may be emptied.

**Against, and what is done about it.**

- *The rules it migrates under may still change.* The migration applies the name rules and the record shapes. By Bolt 4 both exist and are tested (they belong to U3 under the contracts), but U6 and U7 could still expose a need to change them. If they do, the migration is run again; it is designed to be repeatable, and the final run happens at Bolt 9 in any case.
- *It is the largest Unit, placed early, and the maintainer's main worry is stalling* (Q2). This is the real tension in the order. It is accepted because a stall here is informative: if the migration cannot be made to work, nothing after it matters. And the Bolt has a natural halfway house: an export taken and measured is already most of the knowledge, even before the tool is finished.
- *The content migrated at Bolt 4 will be stale by Bolt 9.* Yes. Bolt 4's run is a rehearsal into the test environment. The real copy is Bolt 9.

**The alternative, site first,** was offered and not chosen. It would give a
complete site sooner and a migration written once against settled rules, at
the price of discovering the content's size and state last.

## Why accounts, then the record, then organising, then uploading (U2, U5, U6, U7)

This part is fixed by what needs what, with one judgement inside it.

- U5 before U6 is required: every change must be recorded in the same operation, so the record must exist first.
- U6 before U7 is required: replacing a file turns the earlier one into a deleted item, which is U6's behaviour.
- The judgement is that accounts come before the actions they protect. The alternative, actions first and protection last, would leave change operations unprotected, with only the environments' privacy between them and any visitor, and would be the old system's fault rebuilt. The cost is that two stories (US3.3 and US3.5) are only fully satisfied at Bolt 8.

## Risks, and which Bolt answers each

| Risk | Likelihood | Impact | Answered at | How |
|------|------------|--------|-------------|-----|
| The work stalls (the maintainer's main worry, Q2) | Medium | High | Every Bolt | One Unit per Bolt; each ends in something the maintainer can see; a whole reader's journey after Bolt 3 and a safe copy after Bolt 4; the maintainer judges at each approval whether a Bolt is dragging, with no fixed trigger (Q5), and splits it if so |
| The order breaks because browsing turns out to need accounts | Medium | Medium | Bolt 2, first step | Build browsing without "changed by" and on sample records; otherwise accounts move up to second |
| The platform cannot be run within about US$50 a month | Medium | High | Bolt 1 | Cost estimate before committing; budget alarm first |
| Rehearsing the migration costs more than expected: the content is already known to be large (thousands of files or more than 1 GB), it is stored three times more (the safe copy, test and production), and Google may charge for reading it out | Medium | Medium | Bolt 4 | Measure the export before copying; estimate storage and transfer cost before the rehearsal; empty the rehearsal copy in the test environment when it has served; the safe copy stays until acceptance (Q8) |
| A half-built site, real content or sign-up addresses are exposed during the build | Low | Medium | Bolt 1 | Both environments are private (Q6, Q7); production's content is emptied before the final copy, accounts kept (Q9) |
| Keeping the environments private blocks the pipeline's smoke check or demos on a phone | Medium | Medium | Bolt 1 | The restriction must admit the pipeline and the maintainer's phone on any network; it is a done-criterion of Bolt 1 |
| Content is lost or damaged in migration | Medium | High | Bolt 4, again at 9 | Rehearsal, report, check, repeatable runs, source untouched |
| The final copy does not fit 4 hours | Medium | Medium | Bolt 4 | Measured in rehearsal |
| The shape of folders and files proves wrong after five Units build on it | Low | High | Bolt 2 | Fixed carefully in its design; tested by Bolt 4 against real content early |
| Built-in sign-in screens prove hard or unsafe | Medium | Medium | Bolt 5 | Treated as security-sensitive; the choice of sign-in service made with it in mind |
| Asking every 3 seconds costs too much | Low | Medium | Bolt 6 | Measured; can become a pushed message without touching other Units |
| Large uploads fail on phones | Medium | Medium | Bolt 8 | Tried on a real phone; sending in parts if needed |
| The documents the Units are built from contradict each other | High | Medium | Each Bolt's first step | See below |
| Approving what is not fully understood | Medium | Medium | Bolt 1 | Small in function, large in learning, so every kind of step is seen once early |

## The risk carried in from planning

Sixty review points were approved as open across the planning steps: eleven
before this phase and forty-nine within it. Twenty-two are rated major. The later
documents also replace wording in the earlier ones, so the requirements,
stories, building blocks and Units are not fully consistent with the
contracts.

This is the most likely source of rework in the build. Three things limit it:

- **A rule of precedence.** Where documents differ, the later one wins: contracts, then Units, then the building blocks, then the screens, then stories and requirements.
- **Each Bolt starts by settling its own.** The points that bind a Unit are listed in `bolt-plan.md` and in the Unit's notes. They are the first thing its detailed design does.
- **The ten from the contracts review come first of all**, because they describe faults that would be built into every Unit using that contract. Five are major: browsing needing things it has no access to; sessions lapsing on public pages; the folder's version ignoring who is asking; upload reservations held too long; and name uniqueness when two things happen at once. Each is assigned to the Bolt where it bites: Bolt 2, Bolt 5, Bolt 6, Bolt 8 and Bolt 7.

What this does not do is make the earlier documents right. A reader who opens
`requirements.md` alone will find statements that no longer hold.

## What would change this order

- **Bolt 1 shows the budget cannot be met.** Stop and decide before Bolt 2: one environment, a different way of running the database, or a higher ceiling.
- **Bolt 4 shows the copy cannot fit 4 hours.** Revisit the read-only period with the maintainer, or migrate by a faster route, before Bolt 9 is designed.
- **Bolt 4 shows the content is small or clean.** Nothing changes, but Bolt 9 becomes simpler.
- **Bolt 2's design finds that browsing needs accounts.** Accounts move up to second, as described above.
- **The maintainer judges that a Bolt is dragging** (Q5; there is no fixed trigger). Split the Unit as `unit-of-work-story-map.md` suggests, or move the items `bolt-plan.md` names out of Bolt 1.
- **The build phase offers Units in a different sequence.** The sequence followed there comes from the dependency list, which allows this order without forcing it. The maintainer names the Unit to take.

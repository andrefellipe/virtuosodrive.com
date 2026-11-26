# Team Allocation: Virtuoso Drive on AWS

Who builds each **Bolt** (one build pass over a piece of the work, ending in
something that runs). The nine Bolts and their order are in `bolt-plan.md`
beside this file; the Units they build are defined in
`aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`
(with `unit-of-work-dependency.md` and `unit-of-work-story-map.md`), from the
building blocks in
`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`
and the contracts in
`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`.

## The team

There is one person: the maintainer, who is the developer, the owner and the
only decision-maker (requirements and stories:
`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`,
`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`).
Team formation was skipped for that reason. There is no **mob** (a group
building one thing together at one keyboard) to compose, and no board of teams
to coordinate.

The specialist work in each Bolt is done by AI-DLC's agents under the
maintainer's approval, as the team practices set out
(`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`).

## Who does what in every Bolt

| Step of a Bolt | Done by | Decided by |
|----------------|---------|------------|
| Detailed design of the Unit | Architect agent | Maintainer approves |
| Quality requirements and their design | Architect agent | Maintainer approves |
| Infrastructure for the Unit | Platform agent | Maintainer approves |
| Plan for the code | Developer agent | Maintainer approves the plan before any code is written |
| Code and its tests | Developer agent | Maintainer reviews the pull request and merges it |
| Review of each of the above | Reviewer agents | Maintainer weighs the findings |
| The check after the merge, in the test environment | Run automatically | A failure is fixed by a follow-up pull request |
| Deploy to production, then its smoke check | Pipeline | Maintainer approves the deploy |
| Approval of the Unit, last | - | Maintainer |
| Screen-reader, zoom and contrast checks on the screens (`aidlc/spaces/default/intents/261121-aws-migration/inception/refined-mockups/mockups.md`) | Maintainer by hand | Maintainer |

## Allocation

| Bolt | Unit | Built by | Needs from the maintainer beyond approvals |
|------|------|----------|--------------------------------------------|
| 1 | U1 thin slice | Developer agent, platform agent | Access to the AWS account; running the one-time setup script (budget alarm, then the link between GitHub and AWS); the Route 53 zone for `andrefellipelabs.com`; branch protection on `aws-migration`; the choices listed for this Bolt in `bolt-plan.md` |
| 2 | U3 browsing | Developer agent | A decision on the seven proposed changes to the look; the hand checks for accessibility |
| 3 | U4 downloading | Developer agent | Trying it on a real phone |
| 4 | U8 migration tool | Developer agent | Read access to the Firebase project; running the export, the safe copy of every file into private storage, and the rehearsal; reading the report and deciding on what was not brought over |
| 5 | U2 accounts | Developer agent, platform agent | A real email address to test with; an address or page where people can reach the maintainer; being made the first maintainer |
| 6 | U5 record of changes | Developer agent | Two browsers side by side |
| 7 | U6 organising | Developer agent | Confirming the wording of the delete and restore messages |
| 8 | U7 uploading | Developer agent | Trying large files on a phone connection |
| 9 | U9 the switch | Developer agent | Choosing the day; telling students beforehand if wanted; changing the Firebase rules; opening production to everyone; accepting the result; deciding when the safe copy is removed |

Until the switch, both environments are private: only the maintainer and the
pipeline can reach them. Every hand check in this table is therefore done by
the maintainer, in the test environment unless production is named.

## Load

One person approves everything. Per Bolt that is four design documents
(detailed design, quality requirements, their design, infrastructure), one
plan for the code, one pull request, the build-and-test results, the pipeline
checks, one Unit approval and one production approval: about ten decisions a
Bolt, about ninety over the build. This is an estimate; some steps may not
apply to every Unit. The steps that follow the build (the deployment pipeline,
the environments, monitoring and the rest) add their own approvals and are not
counted here; most of their substance is built in Bolt 1. That number, more
than the agents' speed, sets the pace.

Two consequences worth stating:

- **The maintainer is the only reviewer who knows the students.** The agents review each other's work for consistency; whether a screen or a message suits the people who use the site is something only the maintainer can judge.
- **Nobody covers for the maintainer.** If the maintainer is away, the work waits. Nothing in the plan depends on a date, so waiting costs nothing but time; the one exception is Bolt 9, which should not be started unless it can be finished in the same sitting.

## Skills

| Needed | Held by the maintainer | Covered by |
|--------|------------------------|------------|
| JavaScript and Node.js | Yes | - |
| TypeScript | Assumed close to JavaScript; not confirmed | Agents write it; the maintainer reads and reviews |
| AWS | Learning | Bolt 1 is where most of it is learned; mainstream choices are preferred for that reason |
| PostgreSQL | Not stated | Agents write the queries and migrations; the maintainer reviews |
| Accessibility testing with a screen reader | Not stated | The hand checks are listed step by step in the accessibility checklist |
| Knowing the students and the content | Yes, alone | Nobody else |

The gaps are met by the agents doing the work and the maintainer reviewing it.
The risk in that arrangement is approving what is not fully understood. The
plan's answer is the order: Bolt 1 is deliberately small in function and large
in learning, so that by Bolt 2 the maintainer has seen every kind of step
once.

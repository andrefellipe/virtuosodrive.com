# Initiative Brief: Virtuoso Drive migration

One page that gathers what the first phase decided. Each section names the
document it comes from, all under
`aidlc/spaces/default/intents/261121-aws-migration/ideation/`.

## Intent and problem

From `intent-capture/intent-statement.md` and `intent-capture/stakeholder-map.md`.

Virtuoso Drive is a shared drive of study material for electrical engineering
students. It has three problems treated as one: it depends on Google Cloud,
anyone on the internet can change or delete its content, and with no tests,
pipeline or infrastructure definition every change is manual and risky.

The work is for student readers, contributors, and the maintainer. It is
triggered by a learning and demonstration goal: a real migration with AWS and
AI-DLC that can be proven afterwards from the repository. The maintainer is
the only stakeholder consulted and decides scope and priority alone; nobody is
reported to.

Success is six measures: zero runtime dependencies on Google Cloud; no data
change without sign-in; automated tests on every change; infrastructure 100%
defined as code; 100% of files and folders preserved; 100% of source changes
traceable to an approved AI-DLC Unit.

## Market validation

Not carried out. Market research did not apply: this is a non-commercial
student tool, and the trigger rules out buying a replacement. There is no
competitive analysis to summarise.

## Feasibility and risk

From `feasibility/feasibility-assessment.md`, `feasibility/constraint-register.md`
and `feasibility/raid-log.md`.

**Feasible, with no blocker identified.** Owner access to the existing system
is confirmed, a dedicated AWS account exists, the budget is about US$50 a
month, and there is no deadline. Eighteen constraints are recorded; the ones
that shape everything are: AWS only after the move, PostgreSQL as the system
of record, the existing site untouched until the switch is accepted, one
person building and running it, and lowest price preferred over closeness to
users.

The largest unknown is the real amount of content, described as large and not
yet measured.

## Scope boundary

From `scope-definition/scope-document.md` and `scope-definition/intent-backlog.md`.

**In, all must-have:** browse; download; upload with safe handling of
duplicate names; organise (create folder, rename file, delete file and
folder); sign-in and permissions; verified migration of all content; delivery
and operations; fixes for the five known defects. The list keeps updating by
itself as today, and the look and text stay unchanged.

**Access:** everyone can browse and download; any signed-in user can change
content; anyone can sign up. Who made each change is recorded.

**Out:** search, tags and previews; folder rename and folder download; sharing
links, comments and ratings; a native mobile app; decommissioning the Firebase
project; any redesign or translation.

**Order:** ten backlog items (B-01 to B-10), foundation first, with the
content export and timed rehearsal early. A read-only period of a few hours is
acceptable at the switch.

## Concept visuals

From `rough-mockups/wireframes.md` and `rough-mockups/user-flow.md`.

One screen, as today, with four additions: a sign-in control at the top right;
a prompt to sign in when a signed-out visitor chooses an action that changes
content; a choice of replace, keep both or skip when an uploaded name already
exists; and a "changed by" column showing a display name to signed-in visitors
only. Delete is always confirmed. Phone and laptop, to the WCAG 2.1 AA
accessibility standard.

## Team plan

Team formation did not apply: one person builds and operates the system, with
AI-DLC's agents doing the specialist work at each stage under that person's
approval. There is no team assessment to summarise.

## Risks accepted at handoff

Accepted by the maintainer as they stand (approval-handoff Q1):

| Risk | Where it is recorded |
|------|----------------------|
| Anyone can sign up and then change or delete content | Scope document, "Risks this scope accepts" |
| Everything is must-have, so there is no smaller fallback | Scope document |
| The live-updating list was not costed against the budget | Scope document |
| Whether the final copy fits in a few hours is unproven | Scope document, "Cut-over" |
| Data-protection duties are assumed light, not verified | RAID log, R-05 |

## Carried into the next phase

The maintainer chose to carry all eleven open review points forward
(approval-handoff Q2). The next phase must settle each.

From the review of the intent statement:

1. What the first version must deliver was not stated in the intent statement. Now answered by the scope document; requirements must reflect it.
2. Who signs in and how, so that "no data change without sign-in" can be tested. Partly answered by the scope document's access rules.
3. Contributors are not consulted about the upload and organise flow.
4. The "today" figures beside the success measures are unverified, and "tests on every change" has no threshold.
5. The stakeholder map says "repository owner" where only "owner and maintainer" was confirmed.

From the review of the screen sketches:

6. **Major.** What "changed by" shows for content that existed before the move, for an account that no longer exists, and after a rename or replace.
7. **Major.** How people on the old site learn it is read-only during the switch, given that the old site must stay untouched.
8. "Do the same for the other files" and the numbered "keep both" name were proposals, not answers; what happens when the numbered name also exists.
9. Which comes first for a signed-out visitor with nothing selected: the sign-in prompt or "select a file first".
10. How rows are selected by touch on a phone; where the "list may be out of date" note appears.
11. Contrast is unmeasured and may force colour changes, an exception to "the look stays as it is".

Also still open from the intent statement and scope document: file size and
type limits; whether deletion is permanent; whether the web address stays the
same; what happens to a person's data on request; the Region; and the real
content volume.

## Recommendation

**Go** (approval-handoff Q3). The intent, feasibility, scope and sketches are
consistent with each other, the phase check found no contradiction, and the
maintainer has accepted the open risks. The next phase starts by documenting
the existing system.

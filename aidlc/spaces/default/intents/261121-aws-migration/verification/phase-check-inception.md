# Phase Check: Inception to Construction

**Verdict: PASS, with reservations.** Every requirement and story is linked
onward with no gap, no orphan and no invalid target, which is what this check
tests. It does not test whether the linked documents are right, and sixty
review points remain open; they are summarised at the end.

Paths are under
`aidlc/spaces/default/intents/261121-aws-migration/inception/`.

## What was checked

| File | Links | Rows | OK | Deferred | Gap | Orphan | Invalid target |
|------|-------|------|----|----------|-----|--------|----------------|
| `user-stories/traceability.json` | Requirements to stories | 90 | 79 | 11 | 0 | 0 | 0 |
| `domain-design/traceability.json` | Stories to building blocks | 31 | 27 | 4 | 0 | 0 | 0 |
| `units-generation/traceability.json` | Stories to Units | 31 | 31 | 0 | 0 | 0 | 0 |

No upstream identifier is missing from any file.

## Requirements to stories

- 75 functional sub-requirements: all linked to a story.
- 15 quality requirements: 4 linked to a story (NFR2, NFR5, NFR12, NFR15); 11 deferred to a named later step, 8 to the quality-requirements step of each Unit and 3 (accessibility, devices, unchanged look) to the refined screens, which have since addressed them.

## Stories to building blocks

- 27 of 31 stories linked to one of the six building blocks.
- 4 deferred (US9.1 to US9.4, delivery and operations): they are not software building blocks. They are since assigned to Unit U1.

## Stories to Units

- 31 of 31 stories assigned, each to exactly one Unit; all nine Units have stories.

## Chain, end to end

| From | To | Coverage |
|------|-----|----------|
| Requirements (90) | Stories | 100% linked or deferred to a named step |
| Stories (31) | Building blocks | 87% linked, 13% deferred and later assigned to U1 |
| Stories (31) | Units | 100% |
| Units (9) | Bolts in `delivery-planning/bolt-plan.md` | 100%, one Unit per Bolt |
| Dependencies between Units (17) | Contracts | All 17 have a contract. The reverse does not hold: the contracts review found two needs with no listed dependency (browsing's use of accounts for "changed by", and of stored contents). See reservation 5 |

## Reservations

These do not fail the check, because the check counts links. They are recorded
so that the pass is not read as more than it is.

1. **Three links say "covered" where a review found the coverage partial.**
   - FR10.3 to US8.2: the story has no criterion for names the new rules cannot accept or for items outside the folder tree.
   - FR4.4 to US3.3: the story departs from the requirement for brand-new accounts.
   - US8.4 to MigrationTool in the building-block file: the migration tool is defined as never changing the old system, and the switch must. The Units file assigns it correctly to U9.
2. **Requirements added after `requirements.md` was approved have no identifier** and so appear in no file: password reset, the password rule, the pause after failed sign-ins, the order of migrated items, and keeping both same-named files at migration. They are in the stories and are delivered by U2 and U8. `unit-of-work.md` lists four of these; this list has five, and the difference has not been reconciled. "No upstream identifier is missing" above is true only of the identifiers that exist.
3. **Two story criteria cannot be met as written** (AC3.3.1, AC5.2.5) since the screens were decided.
4. **Open review points: 60**, of which 22 major.
5. **Two needs between Units have no listed dependency** (contracts review): browsing (U3) using accounts (U2) for "changed by", and using stored contents (U4). The build order in `delivery-planning/bolt-plan.md` is valid only if Bolt 2 is built without them; that is settled first in Bolt 2's design, and the plan names the order that applies otherwise.

| Step | Open points | Major |
|------|-------------|-------|
| Intent capture | 5 | 1 |
| Rough mockups | 6 | 2 |
| Requirements | 7 | 3 |
| User stories | 9 | 3 |
| Refined mockups | 8 | 2 |
| Domain design | 9 | 4 |
| Units | 6 | 2 |
| Contracts | 10 | 5 |

Several were settled by a later step without the earlier document being
corrected, so the documents disagree in places. The rule adopted is that the
later document wins. `delivery-planning/bolt-plan.md` assigns each remaining
point to the Bolt whose Unit it binds, to be settled at the start of that
Bolt's detailed design.

## Approval

- [ ] Reviewed by the maintainer at the Delivery Planning gate

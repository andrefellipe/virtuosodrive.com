# Phase Check: Ideation to Inception

Checks that the documents of the first phase agree with each other before the
next phase builds on them. Paths are under
`aidlc/spaces/default/intents/261121-aws-migration/ideation/`.

## Result

**Consistent. No contradiction found. Three warnings.**

## Intent to scope

| Intent statement | Scope document | Result |
|------------------|----------------|--------|
| Problem: depends on Google Cloud | Capabilities 6 and 7; constraint C-01 | Covered |
| Problem: anyone can change or delete content | Capability 5 and the access rules | Covered in part: see warning 1 |
| Problem: no tests, pipeline or infrastructure definition | Capability 7 | Covered |
| Readers find and download | Capabilities 1 and 2, open without sign-in | Covered |
| Contributors upload and organise | Capabilities 3, 4 and 5 | Covered |
| Maintainer runs it cheaply and safely | Capability 7; constraints C-10, C-12 | Covered |
| Five exclusions | The same five under "Out of Scope" | Identical |

## Success measures to scope

| Measure | Where the scope provides for it | Result |
|---------|---------------------------------|--------|
| Zero runtime dependencies on Google Cloud | Capabilities 6 and 7; B-10 | Covered |
| No data change without sign-in | Capability 5; B-06 | Covered |
| Automated tests on every change | Capability 7; B-01 | Covered; no threshold set (warning 2) |
| Infrastructure 100% defined as code | Capability 7; B-01 | Covered |
| 100% of files and folders preserved | Capability 6; B-03, B-10 | Covered |
| 100% of changes traceable to an AI-DLC Unit | Constraint C-14 | Covered by way of working, not by a backlog item |

## Scope to backlog

| Capability | Backlog items | Result |
|------------|---------------|--------|
| Browse | B-04 | Covered |
| Download | B-05 | Covered |
| Upload | B-07 | Covered |
| Organise | B-08 | Covered |
| Sign-in and permissions | B-06 | Covered |
| Content migration | B-03, B-10 | Covered |
| Delivery and operations | B-01, B-02 | Covered |
| Five defect fixes | B-04, B-07, B-08 | All five placed |
| Live list | B-09 | Covered |

Coverage: 8 of 8 capabilities and 5 of 5 defects have a backlog item. No
backlog item lacks a capability behind it.

## Scope items against feasibility

| Scope item | Feasibility backing | Result |
|------------|---------------------|--------|
| Capabilities 1 to 4 | Existing behaviour; no feasibility concern raised | Backed |
| Sign-in and permissions | Assessed as achievable | Backed |
| Content migration | Access and account confirmed; volume unmeasured | Backed, with the largest unknown |
| Delivery and operations | Assessed as achievable from nothing | Backed |
| Live list as must-have | Not assessed: decided after feasibility | Not backed (warning 3) |
| Cost within about US$50 a month | Estimate deferred to design | Assumption A-02 |

## Sketches against scope

| Scope | Wireframes and user flows | Result |
|-------|---------------------------|--------|
| Open reading, signed-in changes | Screens 1 to 3; Flows 1 and 2 | Consistent |
| Safe duplicate handling | Screen 4; Flow 3 | Consistent |
| Folder delete completes | Screen 5; Flow 4 | Consistent |
| Live list | Screen 2; Flow 5 | Consistent |
| Look unchanged | Stated; additions listed | Consistent, with a possible contrast exception |
| Nothing out of scope sketched | Checked | Consistent |

## Warnings

1. **Public write access is reduced, not closed.** Anyone can sign up and then change content. This was chosen knowingly and accepted at handoff; the protection depends on the record of who changed what.
2. **"Tests on every change" has no threshold** and the "today" figures are unverified. Carried forward for requirements.
3. **The live list was made must-have after feasibility was assessed.** Its cost is unknown until design.

## Approval

- [x] Reviewed by the maintainer at the Approval & Handoff gate

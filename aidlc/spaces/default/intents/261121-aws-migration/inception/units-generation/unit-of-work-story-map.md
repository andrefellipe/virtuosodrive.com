# Story Map: which Unit delivers which story

Every story in
`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`
is assigned to the Unit that delivers it. The Units are defined in
`unit-of-work.md`, from the building blocks in
`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`
(decisions in `decisions.md` beside it) and the requirements in
`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`.

## Map

| Story | Unit | Directory |
|-------|------|-----------|
| US1.1 | U3 | u3-browsing |
| US1.2 | U3 | u3-browsing |
| US1.3 | U3 | u3-browsing |
| US2.1 | U3 | u3-browsing |
| US2.2 | U4 | u4-downloading |
| US2.3 | U4 | u4-downloading |
| US3.1 | U2 | u2-accounts |
| US3.2 | U2 | u2-accounts |
| US3.3 | U2 | u2-accounts |
| US3.4 | U2 | u2-accounts |
| US3.5 | U2 | u2-accounts |
| US4.1 | U7 | u7-uploading |
| US4.2 | U7 | u7-uploading |
| US4.3 | U7 | u7-uploading |
| US5.1 | U6 | u6-organising |
| US5.2 | U6 | u6-organising |
| US5.3 | U6 | u6-organising |
| US6.1 | U5 | u5-change-record |
| US6.2 | U6 | u6-organising |
| US7.1 | U2 | u2-accounts |
| US7.2 | U5 | u5-change-record |
| US7.3 | U6 | u6-organising |
| US7.4 | U2 | u2-accounts |
| US8.1 | U8 | u8-migration-tool |
| US8.2 | U8 | u8-migration-tool |
| US8.3 | U8 | u8-migration-tool |
| US8.4 | U9 | u9-switch |
| US9.1 | U1 | u1-thin-slice |
| US9.2 | U1 | u1-thin-slice |
| US9.3 | U1 | u1-thin-slice |
| US9.4 | U1 | u1-thin-slice |

## Stories that reach into other Units

Each story has one Unit that delivers it and proves all its criteria. Three
stories also place an obligation on later Units, which is stated here rather
than by naming several Units on one row:

| Story | Delivered by | What later Units must also do |
|-------|--------------|-------------------------------|
| US3.5 Changes are refused without a valid account | U2, which provides the check and proves it on its own operations | U5, U6, U7 and U8 each apply the check to every operation they add and include a test that an unsigned request is refused. The criteria name upload, create folder, rename, delete and restore, which do not exist when U2 is built; U2 proves the mechanism, and the story is fully satisfied only when U6 and U7 are done |
| US3.3 Be asked to sign in only when it is needed | U2, which provides the prompt and the carrying-on | U6 and U7 connect their actions to it. As with US3.5, the criteria mention actions that arrive later |
| US6.1 See other people's changes as they happen | U5, which provides the live update | U6 and U7 hand each change to it |

For US3.5 and US3.3 this means the story cannot be closed when its Unit is
closed. That is a real consequence of building accounts before the actions
they protect; the alternative, building accounts last, would leave every
change open to anyone until the end.

## Order within each Unit

A suggested order of work inside a Unit, from what the others in it need
first. It is not an order between Units.

| Unit | Stories, in order |
|------|-------------------|
| U1 | US9.2 (environment from the repository, budget alarm first), US9.1 (checks and deployment), US9.3 (logs and alarms), US9.4 (going back) |
| U2 | US3.1 (create and confirm), US3.2 (sign in and out), US3.5 (the check), US3.3 (asked when needed), US3.4 (reset), US7.1 (disable), US7.4 (remove) |
| U3 | US1.1 (see a folder), US1.2 (move through folders), US1.3 (loading, empty, error), US2.1 (select) |
| U4 | US2.2 (download), US2.3 (open) |
| U5 | US7.2 (the record), US6.1 (live updates) |
| U6 | US5.1 (create folder), US5.2 (rename), US5.3 (delete), US7.3 (deleted items and restore), US6.2 (changed by) |
| U7 | US4.3 (limits), US4.1 (upload), US4.2 (name already there) |
| U8 | US8.1 (rehearsal), US8.2 (bring over and report), US8.3 (the check) |
| U9 | US8.4 |

## Coverage

- **Stories assigned:** 31 of 31. None unassigned, none assigned to two Units.
- **Units with stories:** 9 of 9.

| Unit | Stories | Count |
|------|---------|-------|
| U1 | US9.1, US9.2, US9.3, US9.4 | 4 |
| U2 | US3.1, US3.2, US3.3, US3.4, US3.5, US7.1, US7.4 | 7 |
| U3 | US1.1, US1.2, US1.3, US2.1 | 4 |
| U4 | US2.2, US2.3 | 2 |
| U5 | US6.1, US7.2 | 2 |
| U6 | US5.1, US5.2, US5.3, US6.2, US7.3 | 5 |
| U7 | US4.1, US4.2, US4.3 | 3 |
| U8 | US8.1, US8.2, US8.3 | 3 |
| U9 | US8.4 | 1 |

U2 carries the most stories. If its design shows it to be too large, the
natural split is the maintainer's account functions (US7.1, US7.4) into a
Unit of their own.

## Quality requirements

The fifteen quality requirements are not stories and are not mapped here. Each
Unit takes up the ones that apply to it in its own quality-requirements step.
Those that belong mainly to one Unit: no Google dependency at runtime, cost,
backups and operability to U1; personal data to U2; accessibility, devices and
the unchanged look to U3; speed of listing to U3.

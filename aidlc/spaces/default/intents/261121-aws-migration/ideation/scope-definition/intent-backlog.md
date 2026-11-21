# Intent Backlog: Virtuoso Drive migration

The pieces of work that together make the first version, in the order they are
approached. Built on the approved intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`),
the feasibility assessment
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/feasibility/feasibility-assessment.md`)
and the constraint register
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/feasibility/constraint-register.md`).
Answers referred to as Q1 to Q8 are in `scope-definition-questions.md`.

## How it is prioritised

The method is MoSCoW (must, should, could, won't). Every item below is a
**must**, because all eight capabilities were confirmed as must-have (Q1).
Priority therefore says nothing here; **order** does. The order is foundation
first (Q7), then by what each item depends on, then by risk.

These are early groupings, not final units of work. The later design stages
may split or merge them.

## Backlog

| ID | Item | What it delivers | Depends on | Why here in the order |
|----|------|------------------|------------|-----------------------|
| B-01 | Delivery foundation | An empty system that is built, tested and delivered automatically, with all its infrastructure defined as code and a budget alarm in place first | Nothing | Foundation first (Q7); every later item is delivered through it |
| B-02 | Running it safely | Logs, alarms and a rehearsed way to go back | B-01 | Part of the foundation; needed before anything real is exposed |
| B-03 | Content export and rehearsal | A safe copy of all existing content, its real volume measured, and a timed trial migration | B-01 | Highest risk and largest unknown in the feasibility assessment; the existing system can be damaged by anyone meanwhile |
| B-04 | Browse | Folder list, breadcrumb, icons and sizes on the new platform, open to everyone; names shown safely; correct icon for video; range selection working on long lists | B-01, B-03 | First thing a student sees; needs migrated content to show |
| B-05 | Download | One or several files, open to everyone | B-04 | Completes the reader's journey |
| B-06 | Sign-in and accounts | Anyone can sign up; only signed-in users can change content; who made each change is recorded | B-01 | Must exist before any change to content is possible |
| B-07 | Upload | One or several files with progress; a duplicate name never overwrites a stored file | B-04, B-06 | First change to content; needs sign-in |
| B-08 | Organise | Create folder, rename file, delete file and folder; deleting a folder always completes and leaves nothing behind | B-04, B-06 | Remaining changes to content |
| B-09 | Live list | The open folder updates by itself when someone else changes it | B-07, B-08 | Needs changes to exist before they can be shown live |
| B-10 | Final migration and switch | The final verified copy inside a read-only period of a few hours, the switch to the new version, and the old site left intact | All of the above | Last by nature |

## Where each scope item lands

| Capability (scope document) | Backlog items |
|-----------------------------|---------------|
| Browse | B-04 |
| Download | B-05 |
| Upload | B-07 |
| Organise | B-08 |
| Sign-in and permissions | B-06 |
| Content migration | B-03, B-10 |
| Delivery and operations | B-01, B-02 |
| Defect fixes | B-04 (script in names, video icon, range selection), B-07 (overwrite on duplicate), B-08 (folder delete) |
| Live list (behaviour kept) | B-09 |
| Current look and text (behaviour kept) | B-04 to B-09 |

## Where each known defect lands

| Defect | Fixed in |
|--------|----------|
| A crafted name runs script in other visitors' browsers | B-04 |
| A duplicate upload overwrites the stored file | B-07 |
| Deleting an empty folder never completes; deleting a full one leaves files behind | B-08 |
| Video files show the audio icon | B-04 |
| Shift-click range selection fails on lists over ten rows | B-04 |

## Order at a glance

```
B-01 --> B-02
  |
  +----> B-03 --> B-04 --> B-05
  |                 |
  +----> B-06 ------+--> B-07 --+
                    |           +--> B-09 --> B-10
                    +--> B-08 --+
```

<!-- Text fallback: B-01 comes first. B-02, B-03 and B-06 follow it. B-04 needs B-03; B-05 needs B-04. B-07 and B-08 need both B-04 and B-06. B-09 needs B-07 and B-08. B-10 comes last, after everything. -->

## Notes for later stages

- **B-03 early** is a deliberate exception to pure foundation-first: it is the feasibility assessment's largest unknown, and an early safe copy protects against the existing system being damaged while the work goes on (issue I-01 in the RAID log).
- **B-06 carries the accepted risk** recorded in the scope document: open sign-up with write access. The record of who changed what belongs to this item.
- **B-10** depends on the rehearsal in B-03 showing that the final copy fits in a few hours (Q6).
- The limits from the constraint register apply to every item, in particular one person operating it (C-10) and about US$50 a month (C-12).

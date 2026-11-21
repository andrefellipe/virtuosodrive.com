# Scope Document: Virtuoso Drive migration

Built on the approved intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`),
the feasibility assessment
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/feasibility/feasibility-assessment.md`)
and the constraint register
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/feasibility/constraint-register.md`).
Answers referred to as Q1 to Q8 are in `scope-definition-questions.md`.

## Objective

Students can do on the new platform everything they can do today, all existing
content is preserved, and nobody changes content without being signed in.

## In Scope

All eight capabilities are must-have for the first version (Q1). None is
optional, so there is no smaller version to fall back on; what can flex is the
order, not the content.

| # | Capability | What it covers | Source |
|---|------------|----------------|--------|
| 1 | Browse | Folder list, breadcrumb, file type icons, sizes | Q1 |
| 2 | Download | One or several files | Q1 |
| 3 | Upload | One or several files, with progress, and duplicate names handled safely | Q1 |
| 4 | Organise | Create folder, rename file, delete file and folder | Q1 |
| 5 | Sign-in and permissions | See "Access rules" below | Q1, Q2, Q3, Q8 |
| 6 | Content migration | Every existing folder and file carried over and verified | Q1 |
| 7 | Delivery and operations | Pipeline, infrastructure as code, logs, alarms, rollback | Q1 |
| 8 | Defect fixes | The five known defects | Q1 |

### Access rules

| Action | Who may do it | Source |
|--------|---------------|--------|
| Browse and download | Everyone, without signing in | Q3 |
| Upload, rename, delete, create folder | Any signed-in user | Q2 |
| Get an account | Anyone, by signing up for themselves | Q8 |

Knowing who made each change is accepted as protection enough (Q8). This means
the first version must record who made each change; without that record the
accepted protection does not exist.

### Behaviour that must be kept

- The open folder updates by itself when someone else changes it, as today (Q4).
- The current look, logo, icons and interface text stay as they are (Q5).

### The five known defects to fix

These come from the list in `vision.md`, confirmed in scope by Q1.

- File and folder names are shown in a way that lets a crafted name run script in other visitors' browsers.
- Uploading a file whose name already exists shows an error but overwrites the stored file anyway.
- Deleting an empty folder never completes, and deleting a folder with content can leave stored files behind.
- Video files show the audio icon.
- Shift-click range selection can select nothing once a list has more than ten rows.

## Out of Scope

Confirmed in the intent statement and not reopened here.

| Left out | Note |
|----------|------|
| Search, tags and previews | New capability |
| Folder rename and folder download | Never existed |
| Sharing links, comments and ratings | New capability |
| A native mobile app | Not part of this work |
| Decommissioning the Firebase project | Only after the new version is accepted |

Also outside this scope, by the answers above: any redesign of the interface
and any translation of its text (Q5); approval of contributors by the
maintainer or restriction to university accounts (Q2, Q8).

## Cut-over

A read-only period of a few hours is acceptable when the new version takes
over (Q6). The feasibility assessment records the content volume as large and
unmeasured, so whether the final copy fits in a few hours is a hypothesis
until a rehearsal has been timed. If it does not fit, this answer has to be
revisited.

## Approach

Foundation first (Q7): the means of delivering and running the system come
before any feature, so that every later piece is delivered the same way. This
matches the constraint that all infrastructure is defined as code and that
tests run on every change (constraints C-07 and C-08 in the constraint
register).

## Value Stream

How each capability turns into an outcome for the people the intent statement
names.

| Who | Capability | Outcome for them | Success metric it serves |
|-----|------------|------------------|--------------------------|
| Student readers | Browse, download, open reading | Find and download material as today, with no new barrier | Files and folders preserved: 100% |
| Contributors | Sign-in, upload, organise, defect fixes | Add and organise material without damaging what is there | No data change without sign-in |
| Everyone | Live list | See other people's changes without reloading, as today | (keeps today's behaviour) |
| Maintainer | Delivery and operations | Change and run the system safely and cheaply | Tests on every change; infrastructure 100% as code |
| Maintainer | Content migration | Nothing is lost in the move | Files and folders preserved: 100% |
| Maintainer | The whole | A platform with no remaining tie to the old one | Zero runtime dependencies on Google Cloud; changes traceable to AI-DLC Units |

<!-- Text fallback: readers get browse and download with open reading; contributors get sign-in, upload, organise and defect fixes; everyone keeps the live list; the maintainer gets delivery and operations, content migration, and a platform with no tie to the old one. -->

## Risks this scope accepts

- **Open sign-up with write access.** Anyone can create an account and then change or delete content (Q2, Q8). The intent statement names "anyone on the internet can change or delete its content" as a problem; this scope reduces it to "anyone willing to sign up, by name". The maintainer chose this knowingly. It leans on the record of who changed what, and on being able to restore content, neither of which is yet specified.
- **Everything is must-have.** With no optional items there is no slack in content; a stall (risk R-04 in the RAID log) delays the whole first version, not a part of it.
- **Live list as a must-have** adds a capability that the feasibility assessment did not cost. Its effect on the cost ceiling of about US$50 a month (constraint C-12) is unknown until design.

## Still Open

Carried from the intent statement and not settled by this stage: maximum file
size and allowed file types; whether deletion is permanent or has a recycle
period; whether the web address stays the same; what happens to a person's
data on request. These are questions for requirements.

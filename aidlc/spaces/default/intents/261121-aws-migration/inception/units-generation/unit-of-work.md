# Units of Work: Virtuoso Drive on AWS

The work is divided into nine Units. Each is designed, built, tested and
approved on its own, and each ends with something a person can be shown
working. They are cut from the six building blocks in
`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`
under the decisions in `decisions.md` beside it, to deliver the requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`)
and stories
(`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`).

This document says what each Unit is. Which Unit needs which is in
`unit-of-work-dependency.md`; which story each Unit delivers is in
`unit-of-work-story-map.md`. The order in which they are built is decided at
Delivery Planning, except that the first is fixed by the team's practice of
building a thin end-to-end slice first.

## How the Units were cut

- **By what a person can do when the Unit is finished**, not by building block. A Unit usually takes a slice through several blocks: the screen in WebClient, the rules in Drive or Accounts, and the data behind them. This keeps every Unit demonstrable (the maintainer's choice of nine Units, units generation answer Q1).
- **The building blocks stay as boundaries inside the code.** A Unit adds to a block; it does not own it. Drive, for example, is started by U3 and extended by U6, U7 and U8.
- **One deployment.** All Units are parts of one application deployed together by the pipeline. No Unit is deployed on its own, so "Deployment model" below is `shared` for all but the two that are not part of the running site.
- **Kinds.** A `service` Unit carries the full set of design documents in the build phase. U9 is `packaging`: a procedure with a few scripts and one static page, with no business logic of its own.

## The Units

| Unit ID | Directory | Name | Kind | Deployment model | Complexity |
|---------|-----------|------|------|------------------|------------|
| U1 | u1-thin-slice | Thin slice, pipeline and operations | service | shared | L |
| U2 | u2-accounts | Accounts and sign-in | service | shared | L |
| U3 | u3-browsing | Browsing and selecting | service | shared | M |
| U4 | u4-downloading | Downloading and opening | service | shared | S |
| U5 | u5-change-record | Record of changes and live updates | service | shared | M |
| U6 | u6-organising | Organising, deleted items and restore | service | shared | L |
| U7 | u7-uploading | Uploading | service | shared | L |
| U8 | u8-migration-tool | Migration tool | service | standalone | XL |
| U9 | u9-switch | The switch | packaging | standalone | M |

Complexity is relative: S is days of careful work, XL is the largest and
least certain. These are estimates by one architect with no measurement behind
them.

---

### U1: Thin slice, pipeline and operations (`u1-thin-slice`)

**What it is.** The smallest thing that runs the whole way through: the
pipeline, the infrastructure defined as code, and one trivial page that makes
one call to the server, which makes one read from the database. It carries no
product feature.

**Delivers.** A budget alarm before anything else; two environments; a
pull-request check (lint, type check, tests, coverage, infrastructure checks);
automatic deployment to the test environment; end-to-end tests there;
production after approval; logs, alarms and a health check; the previous
version put back once as a rehearsal; the working examples later Units copy (a
route with its test, a database access with its integration test, an
infrastructure definition).

**Building blocks touched.** The empty shells of WebClient and the server
side; none of the six blocks' real behaviour.

**Boundaries.** No accounts, no folders, no files. The page may say only that
the database answered.

**Notes and constraints.**
- This is the walking skeleton the team practices require; the maintainer checks the deployed slice before any other Unit starts.
- It is the largest set of open decisions: Region, how PostgreSQL is run, the shape of the server side, the frontend approach, the pipeline product, the repository layout. They are made in this Unit's own design steps.
- It must settle how a pull request and a locally merged Unit fit together, and what the 80% coverage figure is measured over (both left open at Practices Discovery).
- Whether two environments fit under about US$50 a month is confirmed here.
- Removes the committed `node_modules` folder and the unused dependency from the old code, as the planning document asks of the first Unit.

### U2: Accounts and sign-in (`u2-accounts`)

**What it is.** Everything about who a person is: sign up, confirm an email
address, sign in and out, reset a password, and the check every later Unit
uses to refuse a change without a valid account. Also the maintainer's
Accounts section.

**Delivers.** The account control at the top right; the sign-in, sign-up,
check-your-email and reset screens built into the site; the reminder after
confirming; the pause after wrong passwords; disable, enable and remove an
account.

**Building blocks touched.** Accounts (all of it); WebClient (account screens,
the Maintainer screen's frame and its Accounts section).

**Boundaries.** It provides the check; it does not protect operations that do
not exist yet. Each later Unit applies the check to its own operations and
proves it with its own tests.

**Notes and constraints.**
- The account screens are security-sensitive (decision ADR-006): passwords are typed into this site's pages.
- Open from the design review: removing an account must also remove the identity held by the sign-in service and end its sessions and pending links.
- Open from earlier reviews: how the maintainer is reached; what an unconfirmed account sees when it signs in; what happens if a maintainer disables or removes themselves.
- The sign-in service must support screens built into the site; that narrows the choice made in this Unit's infrastructure step.

### U3: Browsing and selecting (`u3-browsing`)

**What it is.** The list as students know it, on the new platform, open to
everyone: folders, files, breadcrumb, icons, sizes, selection.

**Delivers.** The folder and file records with their own identities; listing a
folder oldest first; opening folders and going back up; the loading, empty and
could-not-load views; selection by mouse, keyboard and touch; the actions that
appear with a selection; names shown as text; the phone layout; the
accessibility changes to the look.

**Building blocks touched.** Drive (folders and files, read side); WebClient
(list, breadcrumb, selection, action bar).

**Boundaries.** Read only. Nothing can be changed and nothing downloaded yet;
the actions that would do so are present but lead nowhere until their Units
arrive. It is shown working with prepared sample content.

**Notes and constraints.**
- Sets the shape of Folder and File for every later Unit, including the position that keeps "oldest first" and the marks for deleted and brought-over items.
- Carries most of the seven proposed changes to the look; the maintainer has not yet accepted or refused them.

### U4: Downloading and opening (`u4-downloading`)

**What it is.** Getting file contents out: download one or several files, open
a file in a new tab, with no account.

**Delivers.** Stored contents under keys unrelated to names; a short-lived
link for a visible file; refusal for a deleted one; the messages for a folder
in the selection and for a file that is no longer there.

**Building blocks touched.** FileTransfer (stored contents, download);
WebClient (Download, open).

**Boundaries.** No upload. Shown working with prepared sample files.

**Notes and constraints.**
- Open from the design review: how long a download link lasts, and whether a link given just before a delete may still work until it expires.

### U5: Record of changes and live updates (`u5-change-record`)

**What it is.** The permanent record of who changed what, the maintainer's
view of it, and the mechanism that tells everyone looking at a folder that it
changed.

**Delivers.** Recording a change handed over by another block; the Changes
section with its two filters, showing email addresses to the maintainer; the
live update of an open folder within 5 seconds; the out-of-date note when the
connection drops.

**Building blocks touched.** Activity (all of it); WebClient (live updates,
status line, Changes section).

**Boundaries.** It records and announces; it makes no change itself. It is
shown working by handing it changes directly, since the Units that make real
changes come after it.

**Notes and constraints.**
- How live updates travel is the main design choice of this Unit, and the one whose cost against the budget was never estimated.
- Open from the design review: announcements must not carry display names to people who are not signed in.
- The record is kept indefinitely (domain design answer Q2).

### U6: Organising, deleted items and restore (`u6-organising`)

**What it is.** Changing the tree: create a folder, rename a file, delete
files and folders, and for the maintainer, see deleted items and restore them.

**Delivers.** The name rules; the name dialog; delete with its confirmation
and counts; deletes as a mark, never a removal; the Deleted items section and
restore; the "changed by" column.

**Building blocks touched.** Drive (change side, deleted state, restore);
WebClient (dialogs, "changed by", Deleted items section).

**Boundaries.** Changes to folders and to existing files only. Adding files is
U7.

**Notes and constraints.**
- Every change goes through the account check from U2 and is recorded through U5 in the same operation (decision ADR-005).
- Open from the design review: Drive must supply the count of items inside a folder for the confirmation, and restore must tell items deleted with their folder from items deleted on their own.
- Open from the design review: "changed by" names must be withheld by the server from people who are not signed in, not merely hidden by the page.
- The space figure on the Deleted items screen is a proposal the maintainer has not confirmed.

### U7: Uploading (`u7-uploading`)

**What it is.** Getting file contents in: upload one or several files with
progress, within the limits, and with a choice when the name already exists.

**Delivers.** The 1 GB limit per file and 5 GB per account per day; sending
content straight to storage with a short-lived permission; a file listed only
once its content is completely stored; replace, keep both or skip, with "do
the same for the others"; a replaced file kept among deleted items; failure
lines per file.

**Building blocks touched.** FileTransfer (upload, limits); Drive (registering
a file, name clashes); WebClient (progress, duplicate choice).

**Boundaries.** Needs deletes to exist (U6), because Replace turns the earlier
file into a deleted item.

**Notes and constraints.**
- Open from the design review, and important: the daily limit as designed can be beaten by starting several uploads at once. This Unit's design must reserve space when an upload starts.
- Open from the design review: who discards the content of abandoned uploads, and after how long.
- Open from the screen review: the file chooser may not open by itself after sign-in on Safari and iPhones; a fallback is needed.

### U8: Migration tool (`u8-migration-tool`)

**What it is.** The tool the operator runs to bring the old content over,
account for all of it, and prove the result. Not part of the running site.

**Delivers.** Reading an export of the old database and the old files without
changing them; a rehearsal that reports counts, bytes and duration; bringing
over every clean item in its place and order; the report of everything else;
the check that compares the result with the export; safe re-runs.

**Building blocks touched.** MigrationTool (all of it); Drive and FileTransfer
(import operations).

**Boundaries.** Reads Firebase; never writes to it. Stops at a verified copy
in the new system; making the old site read-only and switching over is U9.

**Notes and constraints.**
- The largest and least certain Unit: the amount and state of the live content are unknown until an export is examined.
- Open from the design review, and important: the import path is not yet defined. Its design must say how the tool is recognised without an ordinary account, that the upload limits do not apply to it, that imported items write no change record, and how the import operations are closed after the switch.
- The only place Firebase libraries are allowed.
- An early export, kept as a safe copy, is worth taking as soon as this Unit can read one, because the old system can be damaged by anyone meanwhile.

### U9: The switch (`u9-switch`)

**What it is.** The procedure, scripts and one page that move people from the
old site to the new one: make the old site read-only, run the final copy and
its check, serve the new site at its address, and afterwards replace the old
page with a notice.

**Delivers.** A written, rehearsed procedure with its way back; the change of
the Firebase access rules to read-only and its reversal; the new address
`virtuoso.andrefellipelabs.com`; the notice page for the old address.

**Building blocks touched.** None of the six. It uses U8's tool and the
finished site.

**Boundaries.** This is the one Unit that changes anything on Firebase, and
only two things: the access rules for the read-only period, and the old page
once the switch is accepted.

**Notes and constraints.**
- It exists as its own Unit because the design review found that the switch had no owner: the migration tool is defined as never changing the old system.
- The read-only period is at most 4 hours; whether the final copy fits is known only from U8's rehearsal.
- The project rule against changing the live Firebase site holds "while the AWS version is being built and tested"; this Unit acts only after that, at the switch.
- Decommissioning the Firebase project is out of scope and stays out.

## What is not a Unit

- **The record of this work and its traceability** (requirement NFR13) is how the Units are carried out, not something one of them builds.
- **Requirements with no story yet** (reset password, password rule, sign-in pause, the migrated order of items) were added at the stories and are delivered by U2 and U8; they still have no requirement identifiers.

## Open points carried into the build phase

Thirty-three review points were approved as open across the last four steps.
The ones that bind a particular Unit are listed in that Unit's notes above.
Three bind every Unit:

- `requirements.md` and `stories.md` still carry earlier wording that later answers replaced (which actions show with no selection; the journey after confirming an email address; that the maintainer sees email addresses). Where they disagree, the later document wins: refined mockups, then domain design.
- Two story criteria cannot be met as written and need rewording before tests are written from them: AC3.3.1 and AC5.2.5.
- The maintainer has not yet accepted or refused the seven proposed changes to the look.

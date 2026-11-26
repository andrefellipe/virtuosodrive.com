# Requirements: Virtuoso Drive on AWS

## How to read this document

Every requirement has a permanent ID (`FR` for what the system does, `NFR`
for how well it does it) and a source. Sources are abbreviated:

| Abbreviation | Document |
|--------------|----------|
| Intent | `aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md` |
| Scope | `aidlc/spaces/default/intents/261121-aws-migration/ideation/scope-definition/scope-document.md` |
| Sketches | `aidlc/spaces/default/intents/261121-aws-migration/ideation/rough-mockups/wireframes.md` and `user-flow.md` (answers Q1 to Q7 of that stage) |
| Feasibility | `aidlc/spaces/default/intents/261121-aws-migration/ideation/feasibility/constraint-register.md` (constraints C-01 to C-18) |
| Practices | `aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md` |
| Code | `aidlc/spaces/default/codekb/virtuosodrive.com/business-overview.md`, `architecture.md`, `code-structure.md` and `code-quality-assessment.md` (defect ids `DEF-`, security ids `SEC-`) |
| RQ1 to RQ10 | Answers in `requirements-analysis-questions.md` beside this file |
| Assumption A-n | A default set here, listed under Assumptions, that the maintainer can correct |

All functional requirements are must-have, because every capability was
confirmed as must-have (Scope). Where a requirement rests on an assumption
rather than a decision, it says so.

## Intent analysis

The maintainer wants a real, provable migration: the same shared drive of study
material, running entirely on AWS with PostgreSQL as its system of record, with
nothing lost, with content no longer changeable by anonymous visitors, and
with tests, a pipeline and infrastructure defined as code so that it can be
changed safely by one person (Intent). The trigger is a learning and
demonstration goal, so being able to show afterwards that it was done properly
matters as much as the result.

Three things follow from that and shape the requirements:

- **Students must not notice a loss.** What works today keeps working, looks
  the same, and reading needs no account (Scope).
- **The existing behaviour is the reference, but not its faults.** The code
  analysis found 23 defects against the five originally listed (Code). This
  document states the correct behaviour for each capability; a defect in the
  old code is in scope when it contradicts a requirement here, and the
  requirement names it.
- **Open sign-up is the accepted risk.** Anyone can sign up and change content
  (Scope). The requirements therefore add what makes that risk bearable:
  a record of every change, deletes that hide rather than destroy, upload
  limits, and a maintainer who can disable accounts and restore content.

Request type: migration with modernisation. Scope: system-wide. Complexity:
standard for the product, high for the data migration because the state of the
live data is unknown.

## Functional requirements

### FR1 Browse

Anyone can look through the folders and see what is in them, without an
account. Source: Scope; Code (business-overview capability 1).

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR1.1 | Opening the site shows the contents of the top folder, named "All", with no sign-in | A visitor with no account sees the list of "All" | Scope |
| FR1.2 | Each row shows an icon for its kind, its name, and for a file its size in bytes, kB, MB or GB; a folder shows no size; a file of zero bytes shows "0 B" | Rows match the stored kind, name and size | Code; DEF-23 |
| FR1.3 | Opening a folder shows its contents, and a breadcrumb shows the path from "All" to the open folder; choosing any step of the breadcrumb opens that folder | Navigation down and back up works at any depth | Scope |
| FR1.4 | Rows appear in the order the items were created, oldest first, the same for every visitor | Two visitors see the same order; it does not change on reload | Code |
| FR1.5 | The icon reflects the file's content type; video files show the video icon | A video file shows the video icon | Scope; DEF-18 |
| FR1.6 | Names are always shown as plain text, whatever characters they contain | A name containing markup is displayed literally and nothing in it runs | Scope; SEC-03 |
| FR1.7 | The list has distinct views for loading, an empty folder ("This folder is empty."), and a failure to load ("The list could not be loaded." with a way to try again) | Each of the three views appears in its situation | Sketches |
| FR1.8 | Items marked as deleted are not shown and cannot be opened or downloaded from the site | A deleted item is absent from every list and its address no longer serves it | RQ2 |

### FR2 Select

A visitor picks the rows an action applies to. Source: Code (capability 3);
Sketches.

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR2.1 | Choosing a row selects it and deselects the others | One row is selected | Code |
| FR2.2 | Choosing a row with Ctrl held (Command on macOS) adds it to or removes it from the selection | Works with both keys | Code; DEF-21 |
| FR2.3 | Choosing a row with Shift held selects every row between it and the last chosen row, for any number of rows | A range across rows 2 to 15 selects 14 rows | Scope; DEF-16 |
| FR2.4 | The actions offered always match the current selection: Rename applies to exactly one file; Download and Delete to one or more items | No action is offered that would fail for the current selection | Code; DEF-17 |
| FR2.5 | The selection is shown by more than colour, and survives an update of the list | Selected rows stay selected after another person's change appears | Sketches; DEF-17 |
| FR2.6 | Rows can be selected, singly and several at once, with the keyboard alone and by touch on a phone | Every selection possible with a mouse is possible both ways | Sketches (Q3); review point 10 |

### FR3 Download

Anyone can download files, without an account. Source: Scope; Code
(capability 5).

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR3.1 | Download saves every selected file under the name shown in the list, with no sign-in | The saved files have the listed names and the stored content | Scope |
| FR3.2 | Opening a file from the list (double-click, or Enter on a selected file) opens it in a new tab | The file opens | Code |
| FR3.3 | If a folder is among the selection, a message says folders cannot be downloaded, and the selected files still download | Files download; the message names the reason | Scope (folder download is out); DEF-19 |
| FR3.4 | If a selected file is no longer available, a message names that file and the others still download | Other files download; the message names the file | Sketches |

### FR4 Sign-in and accounts

Changing content needs an account; anyone can get one. Source: Scope (access
rules); Sketches (Q1, Q2).

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR4.1 | Anyone can create an account by giving an email address, a password and a display name | A new person can sign up unaided | Scope; Sketches (Q7) |
| FR4.2 | An account can change content only after its email address has been confirmed | An unconfirmed account's changes are refused with a message saying why | Assumption A-1 |
| FR4.3 | A control at the top right shows "Sign in" when signed out, and the person's display name with "Sign out" when signed in | The control reflects the state on every screen size | Sketches (Q2) |
| FR4.4 | When a signed-out visitor chooses Upload, New Folder, Rename or Delete, they are asked to sign in or create an account; afterwards they are back in the same folder with the same selection and the action continues; Cancel changes nothing | The action completes after sign-in without being chosen again | Sketches (Q1) |
| FR4.5 | Every operation that changes content is refused by the server unless it comes from a signed-in, confirmed, enabled account, whatever the page shows | A change sent without a valid identity is rejected and nothing changes | Intent (success measure); Scope |
| FR4.6 | A disabled account cannot sign in and cannot change content; a session already open stops being able to change content within 15 minutes of the account being disabled | Changes from a disabled account are refused within that time | RQ3; Assumption A-2 |
| FR4.7 | If a session ends while a person is working, they are asked to sign in again and return to where they were with nothing lost | The interrupted action completes after signing in again | Sketches |

### FR5 Upload

A signed-in person adds files to a folder. Source: Scope; Sketches (Q4); Code
(capability 4).

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR5.1 | A signed-in person can upload one or several files into the open folder; each file is placed in the folder that was open when the upload started, even if they open another folder meanwhile | A file started in folder A appears in A after navigating to B | Scope; DEF-03 |
| FR5.2 | While uploading, a progress bar and an estimate of the time left reflect the whole selection, and each file that fails is listed with the reason | Progress reaches 100% only when every file has finished or failed | Scope; DEF-05; DEF-22 |
| FR5.3 | A file larger than 1 GB is refused before any of it is sent, with a message giving the limit; any file type is accepted | A file of 1 GB is accepted; one byte more is refused | RQ1 |
| FR5.4 | An account can upload at most 5 GB in a day; a file that would exceed it is refused with a message saying so and when uploading is possible again | The first file past 5 GB is refused; uploading works again the next day | RQ10; Assumption A-3 |
| FR5.5 | When an uploaded file's name already exists in the folder, the person chooses for that file: Replace, Keep both, or Skip; closing the choice without choosing means Skip | Nothing stored is replaced unless Replace is chosen | Sketches (Q4); DEF-01 |
| FR5.6 | Keep both stores the new file under the same name with the lowest free number added before the extension, such as "exam (1).pdf", then "exam (2).pdf" | No two visible items in the folder share a name afterwards | Sketches (Q4); review point 8; Assumption A-4 |
| FR5.7 | Replace makes the new file take the name; the earlier file is treated as deleted (FR6.6), so its content is kept and can be restored | After Replace the list shows one file with the new content; the old one is among the deleted items | RQ2; Assumption A-5 |
| FR5.8 | Each file succeeds or fails on its own: one refused or failed file does not affect the others, and no file is ever stored without appearing in the list or listed without its content | After any mix of successes and failures, every listed file can be downloaded and nothing unlisted remains | Scope; DEF-02 |
| FR5.9 | A file appears in the list only when it is completely stored; an upload interrupted by leaving the page leaves nothing visible | No partly uploaded file is ever listed | Sketches |

### FR6 Organise

A signed-in person creates folders, renames files and deletes items. Source:
Scope; Sketches (Q5); Code (capabilities 6 to 8).

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR6.1 | A signed-in person can create a folder in the open folder by giving it a name | The folder appears, empty | Scope |
| FR6.2 | A name (of a folder, or of a file when renamed) must be 1 to 255 characters after removing spaces at both ends, must not contain "/" or control characters, and must not equal the name of another visible item in the same folder, ignoring upper and lower case; a refused name gets a message saying which rule it broke, and what was typed is kept | Each rule refuses the matching name; "2019.1" and names with accents are accepted | DEF-10; DEF-11; DEF-12; DEF-15; Assumption A-6 |
| FR6.3 | A signed-in person can rename one selected file; the extension is kept; the new name is the one shown, downloaded and checked for duplicates from then on, and the old name becomes free | After a rename, download gives the new name and a new file may take the old one | Scope; DEF-04; DEF-13; DEF-14 |
| FR6.4 | Rename with a folder selected, or with more than one item selected, is refused with a message saying that one file can be renamed at a time | The message appears and nothing changes | Scope (folder rename is out) |
| FR6.5 | Delete always asks for confirmation first, naming the item, or for several items their number, and for a folder how many files and folders are inside | Nothing is deleted without confirming; Cancel changes nothing | Sketches (Q5) |
| FR6.6 | Deleting an item marks it as deleted: it disappears from the site for everyone, its content stays stored, and its name becomes free in that folder; deleting a folder does the same to everything inside it | Deleted items are absent from the site and present in storage | RQ2 |
| FR6.7 | A delete always finishes, including for an empty folder; for each item it either completes entirely or changes nothing, and any item that could not be deleted is named with the reason | Deleting an empty folder succeeds; a failure never leaves a folder half deleted | Scope; DEF-06; DEF-07; DEF-08; DEF-09 |

### FR7 Live list

The open folder keeps itself up to date, as today. Source: Scope (behaviour
kept); Sketches.

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR7.1 | When anyone adds, renames, deletes or restores something in a folder, everyone who has that folder open sees the change without reloading, within 5 seconds | A change made in one browser appears in another within 5 seconds | Scope; Assumption A-7 |
| FR7.2 | Only changes in the open folder itself cause an update; changes deeper down or elsewhere do not redraw the list | A change in a sub-folder does not disturb the parent's list | DEF-20 |
| FR7.3 | An update does not move the keyboard focus, clear what is being typed, or change the selection, except that an item that no longer exists leaves the selection and the person is told | Typing a folder name survives another person's upload | Sketches; DEF-17 |
| FR7.4 | If the connection is lost, a note says the list may be out of date and offers a refresh; updates resume by themselves when the connection returns | The note appears when offline and clears when back | Sketches; review point 10 |

### FR8 Record of changes

Who changed what is recorded, because that record is the protection that open
sign-up relies on. Source: Scope (access rules); Sketches (Q6, Q7).

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR8.1 | Every upload, replace, folder creation, rename, delete and restore is recorded with the account that did it, the item, and the date and time; the record cannot be changed from the site | Each operation produces exactly one entry | Scope; `technical-environment.md` (audit logging) |
| FR8.2 | Signed-in visitors see a "Changed by" column showing the display name of the account that last changed each item; visitors who are not signed in do not see the column; an email address is never shown | The column is absent when signed out and holds display names when signed in | Sketches (Q6, Q7) |
| FR8.3 | "Changed by" shows a dash for content brought over from the old system and not changed since, and "Deleted account" where the account no longer exists | Both cases display as stated | RQ4; review point 6 |
| FR8.4 | Rename, replace and restore update "Changed by" to the account that did it | The column changes after each of the three | Review point 6; Assumption A-8 |

### FR9 Maintainer functions

The maintainer can deal with misuse and mistakes from the site. These are new
functions that the scope did not list; their origin is the answers RQ3, RQ5
and RQ9, given because open sign-up had no remedy for misuse.

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR9.1 | One or more accounts are marked as maintainer; this is set outside the site, and no one can make themselves a maintainer from the site | A normal account cannot reach any maintainer function | RQ3; Assumption A-9 |
| FR9.2 | A maintainer can disable an account and enable it again | A disabled account behaves as in FR4.6 | RQ3 |
| FR9.3 | A maintainer can see the record of changes (FR8.1), newest first, and narrow it to one account or one item | The entries shown match the operations performed | RQ3 |
| FR9.4 | A maintainer can see deleted items and restore one; it returns to the folder it was in, under its name, or with the lowest free number added if that name is now taken; an item whose folder is itself deleted can be restored only after the folder is | A restored file is visible and downloadable again | RQ9; Assumption A-10 |
| FR9.5 | A maintainer can remove an account when its owner asks: the email address and display name are erased, the person's files and folders stay, and their past changes show "Deleted account" | After removal no stored data identifies the person | RQ5 |
| FR9.6 | The site offers no way to remove an item permanently; that is done only by the maintainer directly in AWS | No site function destroys stored content | RQ2 |

### FR10 Content migration

Everything worth keeping is carried over from the old system, provably.
Source: Intent (success measure); Scope; RQ8; Code (likely state of the live
data).

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR10.1 | The migration only reads from the old system; it changes and deletes nothing there | The old system's data is identical before and after a run | Scope; Feasibility C-03 |
| FR10.2 | Every item that has both a record and stored content is brought over with its folder position, name, content, size and content type unchanged | For each such item, the copy's name, size and content checksum equal the source's | RQ8; Intent |
| FR10.3 | Everything else found in the old system is listed in a report with its reason: content with no record, a record with no content, a record whose content differs from what it describes, a name that cannot be kept, and anything written outside the folder tree | The number of source items equals migrated plus reported | RQ8 |
| FR10.4 | An item listed under a folder other than the one its stored location names is brought over into the folder where it is listed today, and noted in the report | Such items appear where visitors see them today | Code (DEF-03); Assumption A-11 |
| FR10.5 | Folders in the same parent that share a name, and so share one set of contents today, are brought over as one folder, and noted in the report | One folder exists; the report names the merged ones | Code (DEF-11); Assumption A-11 |
| FR10.6 | A scripted check, kept in the repository, compares the counts and total sizes of folders and files with the source export and fails if they differ beyond what the report accounts for | The check passes on the final run | Intent (success measure); Practices |
| FR10.7 | A rehearsal is run before the final migration and records how many items and bytes there are and how long the copy takes | The figures are recorded and the final copy is planned from them | Feasibility (largest unknown); Scope (cut-over) |
| FR10.8 | The migration can be run again without creating duplicates | A second run over the same source adds nothing | Corner checklist (jobs that run twice) |

### FR11 The switch

Moving from the old site to the new one without losing changes. Source: Scope
(cut-over); RQ6; RQ7.

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR11.1 | Until the switch, the old site and its data are not changed in any way | No deployment to or rule change in the Firebase project before the switch | Scope; project rule |
| FR11.2 | For the final copy, the Firebase access rules are changed to read-only and nothing else on Firebase is changed; the read-only period lasts no more than 4 hours | Changes on the old site are refused during the copy; the period is at most 4 hours | RQ7; Scope ("a few hours"); Assumption A-12 |
| FR11.3 | If the final copy fails its check (FR10.6), the old access rules are put back and the old site carries on as before | The old site is writable again and the switch is retried later | Sketches (flow 6) |
| FR11.4 | The new version is served at `virtuoso.andrefellipelabs.com` | The site answers at that address over HTTPS | RQ6 |
| FR11.5 | Once the maintainer accepts the switch, the old page is replaced by a short notice that links to the new address, and the old data is left in place | The old address shows the notice | RQ7; review point 7 |

### FR12 Delivery and operations

The system can be changed and run safely by one person. Source: Scope
(capability 7); Practices; Intent (success measures).

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| FR12.1 | Every change goes through a pull request on which lint, type check, unit and integration tests and the infrastructure checks run, and it cannot merge while any fails | A failing check blocks the merge | Practices; Intent |
| FR12.2 | All infrastructure is defined as code in the repository; the pipeline can build a complete environment in an AWS account that holds nothing but the budget alarm | A fresh environment is created by the pipeline alone | Intent (success measure); project rule |
| FR12.3 | A budget alarm exists before any other resource, warning at 80% and at 100% of US$50 a month | The alarm is the first resource created | Project rule; Feasibility C-12 |
| FR12.4 | There is a test environment and production; a merge deploys to the test environment, the end-to-end tests run against it, and production deploys only after they pass and the maintainer approves | Production never receives a version whose end-to-end tests failed | Practices |
| FR12.5 | Every server request and every error is logged with the time, the operation, the outcome and the account if any, and kept for 30 days | A given request can be found in the logs | Scope; Assumption A-13 |
| FR12.6 | The maintainer is notified by email when the server-side error rate exceeds 5% of requests over 5 minutes, when the production site fails its health check twice in a row, and when the budget alarm fires | Each condition produces a notification in a test | Scope; Assumption A-13 |
| FR12.7 | The previous version can be put back through the pipeline, and this has been done once in the test environment before the switch | The rehearsal is recorded | Scope; Practices |

## Non-functional requirements

| ID | Requirement | Pass when | Source |
|----|-------------|-----------|--------|
| NFR1 | No dependency on Google Cloud or Firebase at runtime | The build contains no Firebase SDK, and using the running site produces no request to a Google endpoint | Intent (success measure); project rule |
| NFR2 | Authorisation is enforced on the server for every operation that changes content | An automated test for each such operation shows it rejected without a valid identity | Intent (success measure) |
| NFR3 | Every input is validated on the server, and user-supplied text is never treated as markup or as part of a query | Tests with markup and query fragments in names leave the system unaffected | Project rules; SEC-03; SEC-06 |
| NFR4 | Stored data is encrypted at rest and all traffic uses TLS 1.2 or later | Configuration checks in the pipeline confirm both | Project rule |
| NFR5 | The only personal data held are the email address and the display name; the email address is never shown to another user and never written to logs | A search of logs and pages finds no email address | Feasibility C-17; Sketches (Q7) |
| NFR6 | The site meets WCAG 2.1 level AA | An automated accessibility scan of every screen reports no violation, and each key journey is completed with the keyboard alone | Sketches (Q3) |
| NFR7 | The site works on a phone from 320 pixels wide and on a laptop, in the current and previous versions of Chrome, Firefox, Safari and Edge | The key journeys pass on each | Sketches (Q3); Assumption A-14 |
| NFR8 | The look is unchanged: the existing logo, icons, layout and interface text are kept, with only the additions listed in the Sketches; a colour may change only where needed to meet NFR6 | A comparison with the current page shows no other difference | Scope; review point 11 |
| NFR9 | A folder of up to 500 items is listed within 2 seconds of being opened on an ordinary broadband connection | Measured once, by hand, against the test environment before the switch | Assumption A-15 |
| NFR10 | The production site is available 99% of each calendar month, measured by its health check | The monthly figure is at least 99% | Assumption A-15 |
| NFR11 | Running both environments costs no more than US$50 a month at the expected usage | A cost estimate at design shows it, and the first full month's bill confirms it | Feasibility C-12 |
| NFR12 | Automated tests run on every change, and at least 80% of the lines of the new code are covered by them; the code of the old application is not counted | The pipeline reports at least 80% and refuses a merge below it | Practices; Intent; review point 4; Assumption A-16 |
| NFR13 | Every source change is traceable to an approved AI-DLC Unit | `aidlc attest resolve` over the migration range reports no drifted, unattested, unverifiable or indeterminate path | Intent (success measure) |
| NFR14 | The database is backed up automatically every day, backups are kept for 7 days, and a restore has been carried out once in the test environment | The restore is recorded | Corner checklist (storage); Assumption A-17 |
| NFR15 | The system needs no routine manual work to keep running, and every change to it goes through the pipeline | No resource in the account was created or changed by hand | Feasibility C-10; project rule |

## Constraints

The constraint register (Feasibility, C-01 to C-18) applies in full. The
project's own rules, affirmed at Practices Discovery and kept in
`aidlc/spaces/default/memory/project.md`, apply in full. Those that bear most
on these requirements:

- AWS only at runtime, and PostgreSQL as the system of record for folders and file metadata.
- The browser never talks to the database and never holds cloud credentials or long-lived keys.
- No sign-in through an outside provider that would bring back a Google dependency; accounts are email and password.
- One person builds and operates it; about US$50 a month; lowest price preferred over closeness to users.
- Tests are written after the code for each layer and before merge; pieces merge into `aws-migration` through pull requests (Practices).
- The first piece of work is a thin end-to-end slice with no product feature (Practices); it satisfies none of FR1 to FR11 by itself and parts of FR12.

## Assumptions

Defaults set here so that every requirement is testable. Each can be changed
by the maintainer at the approval of this document; none was asked.

| ID | Assumption | Why this default |
|----|------------|------------------|
| A-1 | An email address must be confirmed before an account can change content | Without it an account is anonymous in practice, and the record of changes would name nobody reachable |
| A-2 | A disabled account loses the ability to change content within 15 minutes | Immediate would be ideal; 15 minutes is a common upper bound for an open session and is testable |
| A-3 | "A day" for the 5 GB limit is a calendar day in UTC | One clock, simple to explain and test |
| A-4 | Keep both uses the lowest free number, so an existing "exam (1).pdf" leads to "exam (2).pdf" | Answers the review's question about a clash |
| A-5 | Replace keeps the earlier file as a deleted item rather than destroying it | Consistent with the decision that the site never destroys content |
| A-6 | Names: 1 to 255 characters, no "/" or control characters, unique among visible items of a folder ignoring case; folders and files share the same set of names | Removes the old system's collisions and unopenable folders while accepting every ordinary name, including dots and accents |
| A-7 | "By itself" means within 5 seconds | Makes the live list testable; today's behaviour is near-immediate |
| A-8 | "Changed by" names whoever last changed the item, including by rename, replace or restore | The simplest rule that is always true |
| A-9 | The maintainer role is granted outside the site | Avoids building role management for one person |
| A-10 | A restored item returns to its original folder; a name clash is resolved with a number; a deleted parent must be restored first | Keeps restore predictable and never overwrites |
| A-11 | Misfiled items go where they are listed today; same-named sibling folders become one folder | Preserves what visitors currently see |
| A-12 | "A few hours" of read-only means at most 4 | Gives the rehearsal a figure to be measured against; to be revisited if the rehearsal shows it cannot be met |
| A-13 | Logs are kept 30 days; notification thresholds as in FR12.6 | Modest defaults for a small system; adjustable without redesign |
| A-14 | Current and previous versions of the four main browsers | The usual support window |
| A-15 | List within 2 seconds for 500 items; 99% monthly availability | Modest targets suited to a student tool run by one person on a small budget; performance is measured once by hand because performance tests are not part of the first release (Practices) |
| A-16 | The 80% coverage figure counts new code only | The old application has no tests and is being replaced; counting it would make the figure unreachable until its removal |
| A-17 | Daily backups kept 7 days | A common minimum; the stored files themselves are never destroyed by the site |
| A-18 | The interface stays in English, as today | Scope says the interface text is unchanged |
| A-19 | Malware scanning of uploads is not part of the first version | Not requested; noted as a risk given any file type is accepted |

## Out of scope

Confirmed in the Intent and Scope and not reopened: search, tags and previews;
folder rename and folder download; sharing links, comments and ratings; a
native mobile app; decommissioning the Firebase project; any redesign or
translation of the interface.

Also outside the first version, by the answers to this stage:

- Permanent removal of content from the site (RQ2), and restore by anyone other than a maintainer (RQ9).
- Self-service removal of an account (RQ5).
- Restrictions on file type (RQ1).
- A ceiling on the size of the whole drive (RQ10).
- Sorting or paging of the list; the order stays as today.
- Moving files or folders between folders, which does not exist today.

## How the carried-forward review points are settled

The maintainer asked for all eleven open review points to be carried into this
phase.

| # | Point | Settled by |
|---|-------|------------|
| 1 | What the first version must deliver was not stated | FR1 to FR12 |
| 2 | Who signs in and how, so that "no change without sign-in" can be tested | FR4, NFR2 |
| 3 | Contributors are not consulted | Not settled: remains an accepted risk |
| 4 | "Today" figures unverified; tests have no threshold | Code analysis confirms no tests and three Google services; NFR12 sets 80% |
| 5 | "Repository owner" in the stakeholder map | Wording only; the map is not changed here. Open |
| 6 | What "changed by" shows with no one to name, and after rename or replace | FR8.3, FR8.4 |
| 7 | How people on the old site learn it is read-only | FR11.2, FR11.5. During the read-only hours the old page itself says nothing; see Open questions |
| 8 | "Do the same for the others" and the numbered name | FR5.6 settles the name; the "do the same" option is an Open question |
| 9 | Sign-in prompt or "select a file first" | Open question |
| 10 | Selecting by touch; the out-of-date note | FR2.6, FR7.4 |
| 11 | Contrast may force colour changes | NFR8 allows that one exception |

## Open questions

For later stages or for the maintainer; none blocks design from starting.

1. **Screens for the maintainer functions.** FR9 needs places to see accounts, the record of changes and deleted items. None was sketched. To be designed.
2. **"Do the same for the other files"** in the duplicate-name choice was a proposal in the sketches, never confirmed. Include it or not?
3. **Order of checks for a signed-out visitor with nothing selected** who chooses Rename or Delete: sign-in first, or "select a file first"? Proposed: the selection message first, since it needs no account.
4. **What people see on the old site during the read-only hours.** Their change simply fails, with whatever message the old page gives. Is an announcement beforehand enough?
5. **The real state and amount of the live content** is unknown until an export is examined (FR10.7). The 4-hour limit (FR11.2) and the report categories (FR10.3) may need adjusting then.
6. **Whether the deployed Firebase rules match those in the repository** was not checked.
7. **Region, the way the database is run, and whether two environments fit under US$50** are design decisions (NFR11).
8. **Hidden deleted content grows without limit.** Nothing removes it except the maintainer by hand in AWS (FR9.6). A reminder or a report of how much is held may be wanted.
9. **Data-protection duties** are still assumed light (Feasibility C-17). FR9.5 and NFR5 cover the essentials; whether a notice to users is needed at sign-up is not settled.
10. **Contributors' view of the upload and organise flow** has not been sought (review point 3).

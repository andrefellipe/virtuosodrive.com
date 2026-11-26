# User Stories: Virtuoso Drive on AWS

Stories for the four personas in `personas.md`, written from the requirements
in
`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`.
The existing behaviour they preserve is described in
`aidlc/spaces/default/codekb/virtuosodrive.com/business-overview.md` and
`component-inventory.md`; the way they are tested follows
`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`.

## How to read this document

- Each story has an ID (`US`), the requirements it covers, and acceptance criteria (`AC`) written as Given / When / Then.
- **Every story is Must Have**, because every capability was confirmed as must-have. Priority therefore does not rank them; the order of building is decided at delivery planning.
- Each story can be built and tested on its own. Where one needs something to exist first (an account, a file), the criteria say so in their "Given" line; that is test set-up, not a dependency on another story being finished.
- "Answers Q1 to Q3" are in `user-stories-questions.md` beside this file.

## What these stories add to the requirements

Three answers given at this stage go beyond the approved requirements. Their
origin is the review of the requirements, which the maintainer then decided:

| Addition | Origin | Stories |
|----------|--------|---------|
| Email confirmation is required, and the sign-up journey is stated end to end. This settles the contradiction between FR4.2 and FR4.4: for a brand-new account the action does not continue by itself; the person lands back in the same folder after confirming | Answer Q1 | US3.1, US3.3 |
| Reset of a forgotten password by email; a minimum password length; a pause after repeated failed sign-ins | Answer Q2 | US3.1, US3.2, US3.4 |
| Two same-named files in a merged folder are both kept, the second with a numbered name | Answer Q3 | US8.2 |

Three figures in the criteria are defaults of mine, not answers: a password of
at least 10 characters, a 15-minute pause after 5 wrong passwords in a row,
and confirmation and reset links that work for 24 hours. Each is marked
"(default)" where it appears.

One further criterion comes from the same review and was not asked: migrated
items keep the order they are shown in today (US8.2), because the requirement
that lists appear in creation order (FR1.4) cannot hold otherwise.

---

## US1 Browsing

### US1.1 See what is in a folder

As a **reader**, I want to see the files and folders of the drive without an
account, so that I can find study material as easily as today.

Covers: FR1.1, FR1.2, FR1.4, FR1.5, FR1.6, FR1.8.

- **AC1.1.1** Given I have no account, when I open the site, then I see the contents of the folder "All".
- **AC1.1.2** Given a folder holds files and folders, when I look at it, then each row shows an icon for its kind and its name, each file shows its size in bytes, kB, MB or GB, a folder shows no size, and an empty file shows "0 B".
- **AC1.1.3** Given a folder holds a video file, when I look at it, then the row shows the video icon.
- **AC1.1.4** Given items were created in a certain order, when anyone opens the folder, then the rows appear oldest first, and in the same order after a reload.
- **AC1.1.5** Given an item's name contains markup such as `<b>x</b>` or a script tag, when I look at the folder, then the name is shown exactly as written and nothing in it runs.
- **AC1.1.6** Given an item has been deleted, when I look at its folder or use its former address, then it is not listed and cannot be opened or downloaded.

### US1.2 Move through folders

As a **reader**, I want to open folders and go back up, so that I can reach
material however deep it is filed.

Covers: FR1.3.

- **AC1.2.1** Given I am in a folder that contains a folder, when I open it, then I see its contents and the breadcrumb shows the path from "All" to it.
- **AC1.2.2** Given I am several folders deep, when I choose any step of the breadcrumb, then that folder opens.
- **AC1.2.3** Given a folder is named with dots, accents or spaces, such as "2019.1" or "1º Período", when I open it, then it opens like any other.

### US1.3 Know what the list is doing

As a **reader**, I want to be told when a list is loading, empty or could not
be loaded, so that I am never left looking at a blank screen.

Covers: FR1.7.

- **AC1.3.1** Given a folder's contents are being fetched, when I open it, then I see placeholder rows until they arrive.
- **AC1.3.2** Given a folder has nothing in it, when I open it, then I see "This folder is empty."
- **AC1.3.3** Given the contents cannot be fetched, when I open the folder, then I see "The list could not be loaded." and a way to try again, and the breadcrumb still works.

---

## US2 Selecting and downloading

### US2.1 Select rows

As a **reader**, I want to select one or several rows, so that an action
applies to exactly the items I mean.

Covers: FR2.1, FR2.2, FR2.3, FR2.4, FR2.5, FR2.6.

- **AC2.1.1** Given a list, when I choose a row, then it alone is selected, and the selection is shown by more than colour.
- **AC2.1.2** Given a row is selected, when I choose another with Ctrl held, or Command on macOS, then both are selected; choosing a selected row the same way deselects it.
- **AC2.1.3** Given a list of 20 rows with row 2 chosen, when I choose row 15 with Shift held, then rows 2 to 15 are selected.
- **AC2.1.4** Given a selection, when I look at the actions, then Rename is available only for exactly one file, and Download and Delete for one or more items.
- **AC2.1.5** Given I use only the keyboard, or only touch on a phone, when I select one row and then several, then I can make every selection that is possible with a mouse.
- **AC2.1.6** Given rows are selected, when another person's change updates the list, then my selection stays as it was.

### US2.2 Download files

As a **reader**, I want to download one or several files without an account,
so that I can study offline.

Covers: FR3.1, FR3.3, FR3.4.

- **AC2.2.1** Given I have no account and one file is selected, when I choose Download, then the file is saved under the name shown, with the stored content.
- **AC2.2.2** Given several files are selected, when I choose Download, then each is saved under its own name.
- **AC2.2.3** Given a folder and two files are selected, when I choose Download, then the two files are saved and a message says folders cannot be downloaded.
- **AC2.2.4** Given a selected file was deleted by someone else a moment ago, when I choose Download, then the other files are saved and a message names the file that is no longer available.
- **AC2.2.5** Given a file has been renamed, when I download it, then it is saved under its new name.

### US2.3 Open a file

As a **reader**, I want to open a file straight from the list, so that I can
look at it without saving it first.

Covers: FR3.2.

- **AC2.3.1** Given a file in the list, when I double-click it, then it opens in a new tab.
- **AC2.3.2** Given a file is selected with the keyboard, when I press Enter, then it opens in a new tab.
- **AC2.3.3** Given the file is no longer available, when I try to open it, then a message says so and the list stays as it is.

---

## US3 Accounts and sign-in

### US3.1 Create an account

As a **contributor**, I want to create an account myself, so that I can add
and organise material without asking anyone.

Covers: FR4.1, FR4.2. Adds: answers Q1 and Q2.

- **AC3.1.1** Given I have no account, when I give an email address, a password and a display name, then an account is created and I am told to open the link sent to that address.
- **AC3.1.2** Given I enter a password shorter than 10 characters (default), when I try to create the account, then it is refused with a message stating the minimum, and what I typed in the other fields is kept.
- **AC3.1.3** Given I enter an email address that already has an account, when I try to create the account, then no second account is created and the response does not reveal whether the address is registered.
- **AC3.1.4** Given I created an account and have not opened the link, when I try to upload, create a folder, rename or delete, then it is refused with a message saying my email address must be confirmed first, and offering to send the link again.
- **AC3.1.5** Given I open the link within 24 hours (default) in the same browser, when the page opens, then my address is confirmed, I am signed in, and I am in the folder I was in when I signed up.
- **AC3.1.6** Given the link is older than 24 hours (default), when I open it, then I am told it has expired and can ask for a new one.

### US3.2 Sign in and out

As a **contributor**, I want to sign in and out from the top right of the
screen, so that I always know whether I can change content.

Covers: FR4.3. Adds: answer Q2.

- **AC3.2.1** Given I am signed out, when I look at the top right on a phone or a laptop, then I see "Sign in".
- **AC3.2.2** Given I sign in with my email address and password, when it succeeds, then the top right shows my display name and "Sign out", and I am in the same folder as before.
- **AC3.2.3** Given I give a wrong password, when I try to sign in, then I am told the email address or password is wrong, without saying which.
- **AC3.2.4** Given 5 wrong passwords in a row for one account (default), when a sixth attempt is made within 15 minutes (default), then it is refused whatever the password, with a message saying when to try again.
- **AC3.2.5** Given I am signed in, when I choose "Sign out", then the top right shows "Sign in" again and I can still browse and download.

### US3.3 Be asked to sign in only when it is needed

As a **contributor**, I want to be asked to sign in at the moment I try to
change something, so that browsing stays free of interruptions and I do not
lose my place.

Covers: FR4.4, FR4.7. Adds: answer Q1.

- **AC3.3.1** Given I am signed out, when I look at the actions, then Upload, New Folder, Download, Rename and Delete are all visible.
- **AC3.3.2** Given I am signed out and have a confirmed account, when I choose Upload, New Folder, Rename or Delete and then sign in, then I am in the same folder with the same selection and the action I chose carries on without my choosing it again.
- **AC3.3.3** Given I am asked to sign in, when I choose Cancel, then I am back at the list and nothing has changed.
- **AC3.3.4** Given I am signed out and have no account, when I choose a change action and create an account, then I am told to confirm my email address, and after confirming I am in the same folder, where I choose the action again.
- **AC3.3.5** Given my session ends while I am typing a folder name, when I sign in again, then the name I typed is still there and the folder is created.

### US3.4 Reset a forgotten password

As a **contributor**, I want to set a new password when I have forgotten
mine, so that I am not locked out and do not need the maintainer's help.

Adds: answer Q2. No requirement ID yet.

- **AC3.4.1** Given I have an account, when I ask for a password reset with my email address, then a link is sent to that address.
- **AC3.4.2** Given I ask for a reset with an address that has no account, when I submit it, then I see the same message as for a registered address and nothing is sent.
- **AC3.4.3** Given I open the link within 24 hours (default), when I set a password of at least 10 characters (default), then I can sign in with the new password and the old one no longer works.
- **AC3.4.4** Given the link has been used once or is older than 24 hours (default), when I open it, then it is refused and I can ask for a new one.

### US3.5 Changes are refused without a valid account

As a **maintainer**, I want every change to be refused unless it comes from a
signed-in, confirmed, enabled account, so that the public write access of the
old system is really closed.

Covers: FR4.5, NFR2.

- **AC3.5.1** Given a request to upload, create a folder, rename, delete or restore is sent directly to the server with no identity, when it arrives, then it is rejected and nothing changes.
- **AC3.5.2** Given the same requests are sent with an expired or forged identity, when they arrive, then they are rejected and nothing changes.
- **AC3.5.3** Given the same requests are sent from an unconfirmed or a disabled account, when they arrive, then they are rejected and nothing changes.
- **AC3.5.4** Given a request for a maintainer function is sent from an ordinary account, when it arrives, then it is rejected.

---

## US4 Uploading

### US4.1 Upload files

As a **contributor**, I want to upload one or several files into a folder, so
that other students can use them.

Covers: FR5.1, FR5.2, FR5.8, FR5.9.

- **AC4.1.1** Given I am signed in and in a folder, when I upload one file, then it appears in that folder's list once it is completely stored, with its name, size and kind.
- **AC4.1.2** Given I upload five files, when the upload runs, then one progress bar and one time estimate reflect all five, and reach the end only when every file has finished or failed.
- **AC4.1.3** Given I start an upload in folder A and open folder B while it runs, when it finishes, then the files are in A and not in B.
- **AC4.1.4** Given one of five files fails, when the upload ends, then the other four are in the list and downloadable, and the failed one is named with the reason.
- **AC4.1.5** Given I leave the page halfway through an upload, when anyone looks at the folder, then no partly uploaded file is listed, and files that had finished are.
- **AC4.1.6** Given any upload has ended, however it ended, when the folder is checked, then every listed file can be downloaded and no stored file is missing from the list.

### US4.2 Decide what happens when the name is already there

As a **contributor**, I want to choose what happens when a file I upload has
the same name as one in the folder, so that I never replace someone's file by
accident.

Covers: FR5.5, FR5.6, FR5.7.

- **AC4.2.1** Given the folder holds "exam.pdf", when I upload a file named "exam.pdf" or "EXAM.PDF", then I am asked to choose Replace, Keep both or Skip for that file, and nothing has been replaced.
- **AC4.2.2** Given I choose Skip, or close the choice without choosing, when the upload ends, then the folder is unchanged.
- **AC4.2.3** Given I choose Keep both, when the upload ends, then the folder holds "exam.pdf" with its old content and "exam (1).pdf" with mine.
- **AC4.2.4** Given the folder already holds "exam.pdf" and "exam (1).pdf", when I choose Keep both, then my file is stored as "exam (2).pdf".
- **AC4.2.5** Given I choose Replace, when the upload ends, then the list shows one "exam.pdf" with my content, and the earlier file is among the deleted items the maintainer can restore.

### US4.3 Be told the limits before wasting time

As a **contributor**, I want to be told at once when a file is too large or I
have reached my daily limit, so that I do not wait for an upload that will be
refused.

Covers: FR5.3, FR5.4.

- **AC4.3.1** Given a file of exactly 1 GB, when I upload it, then it is accepted.
- **AC4.3.2** Given a file one byte larger than 1 GB, when I choose it for upload, then it is refused before any of it is sent, with a message giving the limit, and the other chosen files still upload.
- **AC4.3.3** Given I have uploaded 4.5 GB today, when I choose a 600 MB file, then it is refused with a message saying I have reached the daily limit and when I can upload again.
- **AC4.3.4** Given I reached the limit yesterday, when I upload today, then it works.
- **AC4.3.5** Given a file of any type, when I upload it within the limits, then it is accepted.

---

## US5 Organising

### US5.1 Create a folder

As a **contributor**, I want to create a folder with a name of my choosing, so
that material can be filed where students expect it.

Covers: FR6.1, FR6.2.

- **AC5.1.1** Given I am signed in and in a folder, when I create a folder named "2019.1", then it appears there, empty, and can be opened.
- **AC5.1.2** Given I enter a name that is empty or only spaces, when I confirm, then it is refused with a message saying a name is needed.
- **AC5.1.3** Given the folder already holds an item named "Provas", when I create a folder named "provas", then it is refused with a message saying the name is already used, and what I typed is kept.
- **AC5.1.4** Given I enter a name containing "/" or longer than 255 characters, when I confirm, then it is refused with a message naming the rule.
- **AC5.1.5** Given I enter a name with spaces at both ends, when the folder is created, then its name has no spaces at the ends.

### US5.2 Rename a file

As a **contributor**, I want to rename a file, so that a wrong or unclear name
can be fixed.

Covers: FR6.2, FR6.3, FR6.4.

- **AC5.2.1** Given one file "lista.pdf" is selected, when I rename it to "lista 1", then it is listed as "lista 1.pdf", and downloading it saves "lista 1.pdf".
- **AC5.2.2** Given a file with no extension, named "LEIAME", when I rename it to "LEIA", then it is listed as "LEIA".
- **AC5.2.3** Given I renamed "lista.pdf" to "lista 1.pdf", when anyone uploads a new "lista.pdf", then it is accepted with no duplicate-name question.
- **AC5.2.4** Given another item in the folder is named "lista 2.pdf", when I rename a file to "Lista 2", then it is refused with a message saying the name is already used.
- **AC5.2.5** Given a folder, or more than one item, is selected, when I choose Rename, then a message says one file can be renamed at a time and nothing changes.

### US5.3 Delete items

As a **contributor**, I want to delete files and folders after confirming, so
that material that should not be there disappears from the site.

Covers: FR6.5, FR6.6, FR6.7.

- **AC5.3.1** Given one file is selected, when I choose Delete, then I am asked to confirm with the file's name shown, and nothing is deleted until I confirm.
- **AC5.3.2** Given a folder holding 12 files and 2 folders is selected, when I choose Delete, then the confirmation says it contains 12 files and 2 folders.
- **AC5.3.3** Given I confirm, when the delete finishes, then the items and everything inside them are gone from the site for everyone, and their content is still stored.
- **AC5.3.4** Given an empty folder, when I delete it, then the delete finishes and the folder is gone.
- **AC5.3.5** Given I choose Cancel, when the confirmation closes, then nothing has changed.
- **AC5.3.6** Given three items are selected and one cannot be deleted, when the delete ends, then the other two are gone, the third is unchanged, and a message names it with the reason.
- **AC5.3.7** Given I deleted "exam.pdf", when anyone uploads or creates an item named "exam.pdf" in that folder, then it is accepted.

---

## US6 Staying up to date

### US6.1 See other people's changes as they happen

As a **reader**, I want the open folder to update by itself when someone
changes it, so that I see what is there now without reloading, as today.

Covers: FR7.1, FR7.2, FR7.3, FR7.4.

- **AC6.1.1** Given two people have the same folder open, when one uploads, renames, deletes or restores an item, then the other sees the change within 5 seconds without reloading.
- **AC6.1.2** Given I have a folder open, when someone changes something in one of its sub-folders, then my list is not redrawn.
- **AC6.1.3** Given I am typing a folder name, when another person's change arrives, then what I typed, my keyboard position and my selection are unchanged.
- **AC6.1.4** Given a row I selected is deleted by someone else, when the change arrives, then the row leaves my selection and I am told.
- **AC6.1.5** Given my connection drops, when I look at the list, then a note says it may be out of date and offers a refresh; when the connection returns, the note clears and updates resume by themselves.

### US6.2 See who last changed an item

As a **contributor**, I want to see who last changed each item, so that I know
whom to ask about it.

Covers: FR8.2, FR8.3, FR8.4, NFR5.

- **AC6.2.1** Given I am signed in, when I look at a list, then a "Changed by" column shows a display name for each item changed on the new system.
- **AC6.2.2** Given I am not signed in, when I look at the same list, then there is no "Changed by" column.
- **AC6.2.3** Given an item was brought over from the old system and not changed since, when I look at it signed in, then "Changed by" shows a dash.
- **AC6.2.4** Given the account that last changed an item has been removed, when I look at it signed in, then "Changed by" shows "Deleted account".
- **AC6.2.5** Given an item uploaded by one person is renamed, replaced or restored by another, when I look at it, then "Changed by" shows the second person.
- **AC6.2.6** Given any page or response of the site, when I look for another person's email address, then I do not find one.

---

## US7 Maintaining the site

### US7.1 Stop an account that misbehaves

As a **maintainer**, I want to disable an account and enable it again, so that
I can stop misuse without closing sign-up for everyone.

Covers: FR9.1, FR9.2, FR4.6.

- **AC7.1.1** Given I am signed in as maintainer, when I disable an account, then it can no longer sign in.
- **AC7.1.2** Given a disabled account still has an open session, when it tries to change content more than 15 minutes after being disabled, then the change is refused.
- **AC7.1.3** Given a disabled account, when I enable it, then it can sign in and change content again.
- **AC7.1.4** Given an ordinary account, when it looks for or calls any maintainer function, then none is offered and every call is refused.
- **AC7.1.5** Given any account, when it uses the site, then nothing on the site lets it make itself a maintainer.

### US7.2 See who changed what

As a **maintainer**, I want to look through the record of changes, so that I
can find out what happened to an item and who did it.

Covers: FR8.1, FR9.3.

- **AC7.2.1** Given people have uploaded, replaced, created folders, renamed, deleted and restored, when I open the record, then there is exactly one entry for each, with the account, the item and the date and time, newest first.
- **AC7.2.2** Given the record, when I narrow it to one account, then I see only that account's entries.
- **AC7.2.3** Given the record, when I narrow it to one item, then I see only that item's entries.
- **AC7.2.4** Given any account, maintainer included, when it uses the site, then no function changes or removes an entry.

### US7.3 Bring back something that was deleted

As a **maintainer**, I want to see deleted items and restore them, so that a
mistaken or hostile delete can be undone.

Covers: FR9.4, FR9.6.

- **AC7.3.1** Given items have been deleted, when I open the deleted items, then I see each with its name, the folder it was in, who deleted it and when.
- **AC7.3.2** Given a deleted file whose folder still exists, when I restore it, then it is back in that folder under its name, visible and downloadable by everyone.
- **AC7.3.3** Given the name has been taken since, when I restore the file, then it returns with the lowest free number added, such as "exam (1).pdf".
- **AC7.3.4** Given a deleted file whose folder is also deleted, when I try to restore the file, then I am told to restore the folder first.
- **AC7.3.5** Given a deleted folder, when I restore it, then everything that was deleted with it returns too.
- **AC7.3.6** Given any account, maintainer included, when it uses the site, then no function removes stored content permanently.

### US7.4 Remove someone's account when they ask

As a **maintainer**, I want to remove an account at its owner's request, so
that the site no longer holds their details.

Covers: FR9.5, NFR5.

- **AC7.4.1** Given a person asks for their account to be removed, when I remove it, then they can no longer sign in, and their email address and display name are no longer held in the live system.
- **AC7.4.2** Given the removed account had uploaded files and created folders, when anyone looks, then those items are still there.
- **AC7.4.3** Given the removed account had changed items, when a signed-in person looks at them or I look at the record of changes, then "Deleted account" appears in place of the name.
- **AC7.4.4** Given an account has been removed, when the same email address is used to sign up, then a new, separate account is created.

Note: backups and logs still hold the details until they age out (7 and 30
days in the requirements). The first criterion is deliberately limited to the
live system for that reason.

---

## US8 Migrating and switching over

### US8.1 Rehearse the migration

As an **operator**, I want to run the migration as a rehearsal that changes
nothing in the old system, so that I know how much there is and how long the
real one will take.

Covers: FR10.1, FR10.7, FR10.8.

- **AC8.1.1** Given the old system is live, when I run a rehearsal, then its data and files are identical before and after.
- **AC8.1.2** Given a rehearsal has run, when I read its output, then it states the number of folders and files, the total bytes, and how long the copy took.
- **AC8.1.3** Given a rehearsal has completed, when I run it again over the same source, then no item is duplicated in the destination.
- **AC8.1.4** Given a run is interrupted halfway, when I run it again, then it completes and the result is the same as an uninterrupted run.

### US8.2 Bring the content over and account for all of it

As an **operator**, I want every file and folder that is in a clean state
brought over unchanged, and everything else listed for me, so that nothing is
lost or silently dropped.

Covers: FR10.2, FR10.3, FR10.4, FR10.5. Adds: answer Q3; order of items.

- **AC8.2.1** Given an item has both a record and stored content, when the migration runs, then it exists in the new system in the same folder, with the same name, size, kind and content checksum.
- **AC8.2.2** Given the items of a folder are shown in a certain order on the old site, when the migration has run, then the new site lists them in that order.
- **AC8.2.3** Given the old system holds content with no record, a record with no content, or a record whose content does not match its stated size, when the migration runs, then each is listed in the report with its reason and is not brought over.
- **AC8.2.4** Given an item is listed under a folder other than the one its stored location names, when the migration runs, then it is brought into the folder where it is listed today, and the report notes it.
- **AC8.2.5** Given two folders with the same name in the same parent share one set of contents, when the migration runs, then one folder exists with those contents, and the report names the merged folders.
- **AC8.2.6** Given a merged folder would hold two files with the same name, when the migration runs, then both are kept, the second with a numbered name such as "exam (1).pdf", and the report notes the renaming.
- **AC8.2.7** Given a name contains markup, when the migration runs, then the item is brought over with its name unchanged, to be shown as text.
- **AC8.2.8** Given the migration has run, when I read the report, then every item of the source appears exactly once as migrated, migrated with a note, merged, or not migrated with a reason.

### US8.3 Prove that nothing was lost

As an **operator**, I want a check I can run that compares the new system with
the export of the old one, so that I can show the migration preserved the
content.

Covers: FR10.6.

- **AC8.3.1** Given a migration has run, when I run the check from the repository, then it compares the numbers and total sizes of folders and files with the source export, taking the report into account.
- **AC8.3.2** Given everything is accounted for, when the check runs, then it passes and prints the figures it compared.
- **AC8.3.3** Given one file is missing or has a different size in the new system and is not in the report, when the check runs, then it fails and names the item.

### US8.4 Switch from the old site to the new one

As an **operator**, I want to switch over inside a short read-only period, so
that no change a student makes is lost and there is always a way back.

Covers: FR11.1, FR11.2, FR11.3, FR11.4, FR11.5.

- **AC8.4.1** Given the switch has not started, when the Firebase project is inspected, then nothing has been deployed to it or changed in its rules since the work began.
- **AC8.4.2** Given the final copy starts, when the Firebase access rules are changed to read-only, then a change attempted on the old site is refused, reading still works, and nothing else on Firebase has been changed.
- **AC8.4.3** Given the final copy and its check pass, when the new site is opened at `virtuoso.andrefellipelabs.com` over HTTPS, then it shows the migrated content.
- **AC8.4.4** Given the final copy fails its check, when the old access rules are put back, then the old site accepts changes again and the new site is not announced.
- **AC8.4.5** Given the read-only period has begun, when 4 hours have passed, then either the switch is complete or the old rules have been put back.
- **AC8.4.6** Given I have accepted the switch, when someone opens the old address, then they see a short notice with a link to the new address, and the old data is still in place.

---

## US9 Delivering and operating

### US9.1 Change the system safely

As an **operator**, I want every change checked automatically before it merges
and before it reaches production, so that a mistake is caught by a test and
not by a student.

Covers: FR12.1, FR12.4, NFR12.

- **AC9.1.1** Given a pull request, when lint, type check, a unit or integration test, or an infrastructure check fails, then it cannot be merged.
- **AC9.1.2** Given a pull request whose tests cover less than 80% of the lines of the new code, when the checks run, then it cannot be merged.
- **AC9.1.3** Given a pull request is merged, when the pipeline runs, then the change is deployed to the test environment and the end-to-end tests run against it.
- **AC9.1.4** Given the end-to-end tests fail, when I look at the pipeline, then production has not been changed and cannot be until they pass.
- **AC9.1.5** Given the end-to-end tests pass, when I have not approved, then production has not been changed; when I approve, then it is deployed.

### US9.2 Rebuild everything from the repository

As an **operator**, I want the whole environment defined in the repository,
with a budget alarm before anything else, so that I can recreate it and never
be surprised by the bill.

Covers: FR12.2, FR12.3, NFR15.

- **AC9.2.1** Given an AWS account that holds nothing, when the first deployment step runs, then the budget alarm is created before any other resource.
- **AC9.2.2** Given an account holding only the budget alarm, when the pipeline runs, then a complete working environment exists without any step done by hand.
- **AC9.2.3** Given spending reaches 80% and then 100% of US$50 in a month, when each threshold is crossed, then I receive an email.
- **AC9.2.4** Given the running environment, when it is compared with what the repository defines, then nothing exists that the repository does not define.

### US9.3 Hear about problems

As an **operator**, I want to be told when the site is failing, and to be able
to find out what happened, so that I can fix it before students give up.

Covers: FR12.5, FR12.6.

- **AC9.3.1** Given any request to the server, when I search the logs within 30 days, then I find it with its time, operation, outcome and account if any.
- **AC9.3.2** Given more than 5% of requests fail on the server over 5 minutes, when the period ends, then I receive an email.
- **AC9.3.3** Given the production site fails its health check twice in a row, when the second failure happens, then I receive an email.
- **AC9.3.4** Given any log entry, when I look for an email address in it, then there is none.

### US9.4 Go back to the previous version

As an **operator**, I want to put the previous version back through the
pipeline, so that a bad release can be undone quickly and in a way I have
already practised.

Covers: FR12.7.

- **AC9.4.1** Given a version is deployed in the test environment, when I ask the pipeline for the previous version, then the previous version is running and the site works.
- **AC9.4.2** Given the switch has not yet happened, when I look at the project's records, then one such return to a previous version in the test environment is recorded.
- **AC9.4.3** Given a release included a change to the database structure, when I go back, then the site works with the data as it is, by the documented way back or roll-forward for that change.

---

## Requirements not turned into stories

These are qualities of the system, not journeys. They stay as requirements and
are taken up by the stage named.

| Requirement | Why no story | Taken up at |
|-------------|--------------|-------------|
| NFR1 No Google dependency at runtime | A property of the build and of running traffic; partly visible in AC8.4.3 | NFR Requirements |
| NFR3 Input validation | Appears in the criteria of US1.1, US5.1 and US5.2; the full rule belongs to design | NFR Requirements |
| NFR4 Encryption | Configuration | NFR Requirements |
| NFR6 Accessibility to WCAG 2.1 AA | Applies to every screen; keyboard and touch criteria are in US2.1 and US2.3 | Refined Mockups |
| NFR7 Devices and browsers | Applies to every story | Refined Mockups |
| NFR8 Look unchanged | Applies to every screen | Refined Mockups |
| NFR9 Speed of listing | Measured once by hand | NFR Requirements |
| NFR10 Availability | Measured over a month | NFR Requirements |
| NFR11 Cost | Estimated at design | NFR Requirements |
| NFR13 Traceability to AI-DLC Units | A property of how the work is done | NFR Requirements |
| NFR14 Backups | Operational setting | NFR Requirements |

## Dependencies between stories

Each story is testable alone, but they cannot be built in any order.

- US9.1 and US9.2 come first: they are the means by which everything else is delivered, and the first piece of work is a thin end-to-end slice with no product feature (team practices).
- US1 needs content to show, so in practice it follows a first run of US8.2 or test data.
- US4, US5, US6.2 and US7 need accounts (US3.1, US3.2, US3.5).
- US7.3 needs deletes (US5.3). US6.1 needs changes to show (US4, US5).
- US8.4 comes last.

## Notes on the stories as a set

- **Independent:** each story has its own value and its own criteria; set-up is stated in "Given".
- **Small:** the largest are US8.2 and US4.1. US8.2 could be split by kind of unclean content once an export shows which kinds really occur.
- **Testable:** every criterion names an observable result. The figures marked "(default)" need the maintainer's confirmation.
- **Not yet covered by a screen sketch:** the account screens (US3.1, US3.2, US3.4) and the maintainer screens (US7.1 to US7.4).

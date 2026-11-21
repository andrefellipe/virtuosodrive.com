# User Flows: Virtuoso Drive on the new platform

The journeys people take through the one screen sketched in `wireframes.md`.
Built on the approved intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`),
scope document
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/scope-definition/scope-document.md`)
and intent backlog
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/scope-definition/intent-backlog.md`).
Answers referred to as Q1 to Q7 are in `rough-mockups-questions.md`.

The people are the three groups the intent statement names: student readers,
contributors, and the maintainer. The maintainer uses the same screen as a
contributor; no separate screen for the maintainer is in scope.

## Overview

```
                 +-----------------+
                 | Open the site   |
                 +--------+--------+
                          |
                          v
                 +-----------------+
                 | List of a folder|<-----------------+
                 +--------+--------+                  |
                          |                           |
        +-----------------+-----------------+         |
        |                 |                 |         |
        v                 v                 v         |
+---------------+ +---------------+ +---------------+ |
| Open a folder | | Download      | | Change content| |
| or breadcrumb | | (anyone)      | | (needs        | |
| (anyone)      | |               | |  sign-in)     | |
+-------+-------+ +-------+-------+ +-------+-------+ |
        |                 |                 |         |
        |                 |                 v         |
        |                 |         +---------------+ |
        |                 |         | Signed in?    | |
        |                 |         +---+-------+---+ |
        |                 |          no |       | yes |
        |                 |             v       |     |
        |                 |    +-------------+  |     |
        |                 |    | Sign in or  |  |     |
        |                 |    | create an   |  |     |
        |                 |    | account     |  |     |
        |                 |    +------+------+  |     |
        |                 |           |         |     |
        |                 |           v         v     |
        |                 |         +---------------+ |
        |                 |         | Upload, new   | |
        |                 |         | folder, rename| |
        |                 |         | or delete     | |
        |                 |         +-------+-------+ |
        |                 |                 |         |
        +-----------------+-----------------+---------+
```

<!-- Text fallback: a person opens the site and sees the list of a folder. From there they can open a folder or use the breadcrumb, download, or change content. The first two are open to anyone and lead back to the list. Changing content checks whether the person is signed in; if not, they sign in or create an account first. Then they upload, create a folder, rename or delete, and return to the list. -->

## Flow 1: Find and download material

```
Flow: Find and download
Persona: Student reader (not signed in)
Trigger: Opens the site, on a phone or a laptop
Steps:
  1. List of "All" -> chooses a folder -> list of that folder
  2. List -> chooses a deeper folder, or a breadcrumb step -> that list
  3. List -> selects one or several files -> rows marked as selected
  4. List -> chooses Download -> the files are saved by the browser
Success outcome: the files are on the person's device; the list is unchanged
Error paths:
  - the list cannot be loaded -> "The list could not be loaded" -> Try again
  - nothing selected when choosing Download -> a short message saying
    to select a file first -> selects, then tries again
  - a selected file can no longer be found (deleted meanwhile) -> a
    message naming that file -> the other files still download
```

No account is needed at any step (scope document, "Access rules"). Serves
backlog items B-04 and B-05.

## Flow 2: Sign in or create an account

```
Flow: Sign in on demand
Persona: Contributor (not yet signed in)
Trigger: Chooses Upload, New Folder, Rename or Delete; or chooses
         Sign in at the top right
Steps:
  1. "Sign in to change content" -> chooses Sign in, or Create an
     account -> signs in, or signs up and picks a display name
  2. Signed in -> returned to the same folder and selection -> the
     action first chosen carries on
Success outcome: the person's display name and Sign out are shown at the
  top right; the "changed by" column appears
Error paths:
  - chooses Cancel -> back to the list, nothing changed
  - sign-in fails or is abandoned -> back to the list, not signed in,
    with a message saying so
  - signed out while working (session ended) -> asked to sign in again
    -> returned to where they were, with nothing lost
```

Anyone may create an account (scope document). The display name chosen here
is what "changed by" shows; the email address is never shown (Q7). Serves B-06.

## Flow 3: Upload files

```
Flow: Upload
Persona: Contributor (signed in)
Trigger: Chooses Upload
Steps:
  1. List -> chooses one or several files -> progress bar with time left
  2. For each file whose name already exists -> "already exists in
     this folder" -> chooses Replace, Keep both or Skip
  3. Upload finishes -> the new files appear in the list
Success outcome: the files are in the folder, each marked as changed by
  this person; nothing was replaced unless Replace was chosen
Error paths:
  - one file fails (connection lost, not allowed) -> a line naming that
    file and why -> the other files continue
  - the dialog for a duplicate is closed without choosing -> treated
    as Skip
  - the person leaves the page mid-upload -> files already finished
    stay; no half-uploaded file ever appears in the list
```

This is where the overwrite defect is fixed (Q4). Limits on file size and
type are still open (scope document, "Still Open"); when they are set, a file
that breaks them is refused in step 1 with the reason. Serves B-07.

## Flow 4: Organise

```
Flow: Create a folder
Persona: Contributor (signed in)
Trigger: Chooses New Folder
Steps:
  1. List -> types a name -> the folder appears in the list
Success outcome: an empty folder with that name exists
Error paths:
  - the name is empty or already used in this folder -> a message beside
    the name field saying so -> corrects the name; what was typed stays

Flow: Rename a file
Persona: Contributor (signed in)
Trigger: Selects one file and chooses Rename
Steps:
  1. List -> types the new name -> the row shows the new name
Success outcome: the file has the new name; its content is unchanged
Error paths:
  - the name is empty or already used -> message beside the field ->
    corrects it
  - more than one row, or a folder, selected -> a short message saying
    that one file can be renamed at a time

Flow: Delete
Persona: Contributor (signed in)
Trigger: Selects one or several items and chooses Delete
Steps:
  1. List -> confirmation naming what will be deleted, with counts for
     folders -> chooses Delete
  2. The rows show as "deleting" -> they disappear when it is done
Success outcome: the items are gone and nothing of them is left behind
Error paths:
  - chooses Cancel -> nothing is deleted
  - part of a folder cannot be deleted -> a message saying what remains
    -> the folder stays, showing what is left, and can be tried again
```

Folder rename is out of scope, so Rename applies to files only (scope
document, "Out of Scope"). Delete is where the folder-delete defect is fixed
(Q5). Serves B-08.

## Flow 5: Someone else changes the folder

```
Flow: Live list
Persona: Anyone with a folder open
Trigger: Another person uploads, renames or deletes in the same folder
Steps:
  1. List -> the change appears by itself -> the list shows it
Success outcome: the list matches what is stored, without reloading
Error paths:
  - the connection is lost -> a note that the list may be out of date,
    with a way to refresh -> updates resume by themselves when possible
  - an item the person had selected was deleted by someone else -> it
    leaves the selection, and the person is told
```

Kept from today's behaviour (scope document, "Behaviour that must be kept").
The person's own selection, typing and keyboard position are not disturbed by
an update. Serves B-09.

## Flow 6: The switch to the new version

```
Flow: Read-only period
Persona: Anyone, during the few hours of the switch
Trigger: The maintainer starts the final copy
Steps:
  1. Old site -> browsing and downloading work as usual -> actions that
     change content are refused, with a message saying why and for
     how long
  2. Switch done -> the same address, or a notice of the new one ->
     the new version, with all content in place
Success outcome: nobody loses a change, because none could be made
Error paths:
  - the final copy does not check out -> the old site returns to normal
    and the switch is tried again another day
```

A read-only period of a few hours is acceptable (scope document, "Cut-over").
Whether the address stays the same is still open. How the old site is made
read-only without changing it is a question for design, since the old site
must stay untouched; this flow states what people experience, not how it is
done. Serves B-10.

## What every flow has in common

- Reading never needs an account; changing always does.
- After any interruption (sign-in, an error, a lost connection) the person is back in the same folder with the same selection.
- Every error says what happened and what to do next, in plain words.
- Everything can be done from the keyboard and is announced to screen readers (Q3).

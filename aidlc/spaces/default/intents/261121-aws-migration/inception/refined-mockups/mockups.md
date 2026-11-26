# Mockups: Virtuoso Drive on AWS

Detailed screens for every story in
`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`,
refined from the rough sketches
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/rough-mockups/wireframes.md`
and `user-flow.md`) and checked against the requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`).
How each element behaves is in `interaction-spec.md`; which existing styles it
uses is in `design-system-mapping.md`; the accessibility checks are in
`accessibility-checklist.md`. Answers referred to as Q1 to Q7 are in
`refined-mockups-questions.md`. The end-to-end journeys these screens must
support are the ones the team practices list
(`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`).

The screens are drawn as plain boxes. They fix what is on each screen, in what
order, and with what words; the look itself is the existing one and is not
redrawn. Names in the examples are written without accents; real names keep
theirs.

## What changed from the rough sketches

| Rough sketch | Now | Why |
|--------------|-----|-----|
| All five actions always visible | Upload and New Folder always; Download, Rename and Delete appear with a selection, as today | The rough sketch described today's page wrongly; corrected and decided again (Q1) |
| "Sign in to change content" dialog with three buttons | A sign-in form in the site's own look, with links to create an account and reset a password | Sign-in screens are built into the site (Q3) |
| Sign-in and account creation not drawn | Screens 3 to 7 | Stories US3.1 to US3.4 |
| No maintainer screens | Screens 12 to 14 | Stories US7.1 to US7.4; a separate screen (Q2) |
| "Do the same for the others" as a proposal | Confirmed and drawn | Q4 |
| "Changed by" always filled in | A dash and "Deleted account" shown | Requirement FR8.3 |

## Screen list

| # | Screen | Stories |
|---|--------|---------|
| 1 | List, signed out | US1.1, US1.2, US2.1, US2.2, US2.3, US3.3 |
| 2 | List, signed in | US4.1, US5.1 to US5.3, US6.1, US6.2 |
| 3 | Sign in | US3.2, US3.3 |
| 4 | Create an account | US3.1 |
| 5 | Check your email | US3.1 |
| 6 | Back after confirming | US3.1, US3.3 |
| 7 | Reset a password | US3.4 |
| 8 | Name for a new folder, or a rename | US5.1, US5.2 |
| 9 | The name already exists | US4.2 |
| 10 | Confirm delete | US5.3 |
| 11 | Uploading | US4.1, US4.3 |
| 12 | Maintainer: Accounts | US7.1, US7.4 |
| 13 | Maintainer: Changes | US7.2 |
| 14 | Maintainer: Deleted items | US7.3 |
| 15 | Phone layout | All |
| 16 | Old site after the switch | US8.4 |

Stories US3.5, US8.1 to US8.3 and US9.1 to US9.4 have no screen: they are
about what the server refuses, the migration, and the pipeline.

---

## Screen 1: List, signed out

```
+----------------------------------------------------------+
|                         [Logo]                 [Sign in] |
+----------------------------------------------------------+
| All > 1o Periodo > Calculo                               |
+----------------------------------------------------------+
| [Upload] [New Folder]                                    |
+----------------------------------------------------------+
|   Name                                        Size       |
|   (folder) Provas                                        |
|   (pdf)    Lista 1.pdf                        240 kB     |
|   (video)  Aula 3.mp4                         88 MB      |
+----------------------------------------------------------+
| Footer                                                   |
+----------------------------------------------------------+
```

<!-- Text fallback: header with the logo centred and a Sign in button at the top right; breadcrumb; an action row with Upload and New Folder only; a table with Name and Size holding one folder and two files; footer. -->

With one file selected, the action row becomes:

```
+----------------------------------------------------------+
| [Upload] [New Folder] [Download] [Rename] [Delete]       |
+----------------------------------------------------------+
|   Name                                        Size       |
|   (folder) Provas                                        |
| > (pdf)    Lista 1.pdf                        240 kB     |
|   (video)  Aula 3.mp4                         88 MB      |
+----------------------------------------------------------+
```

<!-- Text fallback: the same list with the row Lista 1.pdf marked as selected, and the action row now showing Upload, New Folder, Download, Rename and Delete. -->

- Actions by selection: none selected shows Upload, New Folder. One file: all five. One folder, or several items: Upload, New Folder, Download, Delete. This is today's behaviour (Q1).
- Signed out, Download works at once. Upload, New Folder, Rename and Delete open Screen 3 first.
- The selected row is marked by the `>` sign here; on the real screen by the existing highlight colour plus a check mark at the start of the row, so that colour is not the only sign.
- The first column heading is empty today; it becomes a visually hidden "Kind" heading so the table reads correctly aloud.
- A folder row shows no size. A file of zero bytes shows "0 B".
- Double-click, or Enter on a selected row, opens a folder in place and a file in a new tab.

## Screen 2: List, signed in

```
+----------------------------------------------------------+
|                         [Logo]         Maria  [Sign out] |
+----------------------------------------------------------+
| All > 1o Periodo > Calculo                               |
+----------------------------------------------------------+
| [Upload] [New Folder] [Download] [Rename] [Delete]       |
+----------------------------------------------------------+
|   Name                          Size       Changed by    |
|   (folder) Provas                          -             |
| > (pdf)    Lista 1.pdf          240 kB     Maria         |
|   (video)  Aula 3.mp4           88 MB      Deleted       |
|                                            account       |
+----------------------------------------------------------+
| Footer                                                   |
+----------------------------------------------------------+
```

<!-- Text fallback: the list with the display name Maria and a Sign out button at the top right, and a third column Changed by. The folder Provas shows a dash, Lista 1.pdf shows Maria, and Aula 3.mp4 shows Deleted account. -->

- "Changed by" shows a display name; a dash for content brought over from the old system and not changed since; "Deleted account" where the account was removed. The dash is read aloud as "not recorded".
- A maintainer sees one more link, "Maintainer", to the left of their name. Nobody else sees it.
- When someone else changes this folder, the list updates within 5 seconds. A line above the list, read aloud politely, says what changed, for example "Aula 4.mp4 was added." Focus, selection and typing are not disturbed.
- If the connection drops, the same line reads "This list may be out of date." with a "Refresh" button, and clears when updates resume.

## Screen 3: Sign in

Opens over the list when "Sign in" is chosen, or when a signed-out visitor
chooses Upload, New Folder, Rename or Delete.

```
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | Sign in                                        |    |
|    |                                                |    |
|    | Browsing and downloading need no account.      |    |
|    |                                                |    |
|    | Email address                                  |    |
|    | [                                            ] |    |
|    | Password                                       |    |
|    | [                                            ] |    |
|    |                                                |    |
|    | [Sign in]  [Cancel]                            |    |
|    |                                                |    |
|    | Create an account  -  Forgot your password?    |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog titled Sign in, with a line saying browsing and downloading need no account, fields for email address and password, buttons Sign in and Cancel, and two links: Create an account, and Forgot your password. -->

- Wrong details: "The email address or password is not right." above the fields, without saying which. What was typed in the email field is kept.
- After 5 wrong passwords in a row for an account, further attempts within 15 minutes show "Too many attempts. Try again at 14:35, or reset your password." (Q7).
- A disabled account sees "This account has been disabled. Contact the maintainer."
- On success the dialog closes, the person is in the same folder with the same selection, and the action they had chosen carries on.
- Cancel, or Escape, closes the dialog and changes nothing.

## Screen 4: Create an account

```
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | Create an account                              |    |
|    |                                                |    |
|    | Email address                                  |    |
|    | [                                            ] |    |
|    | We send a link to confirm it. Other people     |    |
|    | never see it.                                  |    |
|    | Display name                                   |    |
|    | [                                            ] |    |
|    | Shown beside what you change.                  |    |
|    | Password                                       |    |
|    | [                                            ] |    |
|    | At least 10 characters.                        |    |
|    |                                                |    |
|    | [Create account]  [Cancel]                     |    |
|    |                                                |    |
|    | Already have an account? Sign in               |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog titled Create an account, with fields for email address (with a note that a confirmation link is sent and other people never see it), display name (shown beside what you change), and password (at least 10 characters); buttons Create account and Cancel; a link back to Sign in. -->

- Each field's hint is shown before typing, not only after an error.
- An error is shown under its own field in words: "Enter an email address.", "Enter a display name.", "Use at least 10 characters." Everything typed is kept.
- If the address already has an account, the next screen is the same as for a new one, so the form never reveals who is registered.
- One sentence under the form says what is kept: "We keep your email address and display name. Ask the maintainer to remove your account at any time." Whether more is needed is an open point (requirements, open question 9).

## Screen 5: Check your email

```
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | Check your email                               |    |
|    |                                                |    |
|    | We sent a link to maria@example.com.           |    |
|    | Open it to finish. It works for 24 hours.      |    |
|    |                                                |    |
|    | [Send it again]  [Close]                       |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog titled Check your email, saying a link was sent to the address given, that opening it finishes the sign-up and that it works for 24 hours, with buttons Send it again and Close. -->

- Until the link is opened, a change action shows: "Confirm your email address first. We sent a link to maria@example.com." with "Send it again".
- The person's own address is shown to them here; it is never shown to anyone else.

## Screen 6: Back after confirming

The link opens the site in the folder the person was in, signed in.

```
+----------------------------------------------------------+
|                         [Logo]         Maria  [Sign out] |
+----------------------------------------------------------+
| Your account is ready. You were about to upload:         |
| choose Upload to continue.                           [x] |
+----------------------------------------------------------+
| All > 1o Periodo > Calculo                               |
+----------------------------------------------------------+
| [Upload] [New Folder]                                    |
+----------------------------------------------------------+
```

<!-- Text fallback: the list, signed in as Maria, with a line under the header saying the account is ready and that the person was about to upload and should choose Upload to continue, with a close button. -->

- The line names the action they had chosen: upload, create a folder, rename or delete (Q5). If they had chosen none, it reads "Your account is ready."
- If the link is opened in another browser or on another device, the address is confirmed and the Sign in screen opens with "Your email address is confirmed. Sign in to continue."; after signing in they are at "All", since that browser does not know where they were.
- An expired link shows "This link has expired." with "Send a new one".

## Screen 7: Reset a password

Two steps. First, from "Forgot your password?":

```
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | Reset your password                            |    |
|    |                                                |    |
|    | Email address                                  |    |
|    | [                                            ] |    |
|    |                                                |    |
|    | [Send the link]  [Cancel]                      |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog titled Reset your password with one field, email address, and buttons Send the link and Cancel. -->

Then, from the link in the email:

```
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | Choose a new password                          |    |
|    |                                                |    |
|    | New password                                   |    |
|    | [                                            ] |    |
|    | At least 10 characters.                        |    |
|    |                                                |    |
|    | [Save and sign in]                             |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog titled Choose a new password with one field, new password, a hint that it needs at least 10 characters, and a button Save and sign in. -->

- After "Send the link" the message is always "If that address has an account, we sent it a link. It works for 24 hours."
- A reset works while sign-in is paused for too many attempts, and ends the pause.
- A used or expired link shows "This link no longer works." with "Send a new one".

## Screen 8: Name for a new folder, or a rename

Replaces the browser's own prompt box used today, so that errors can be shown
beside the field and read aloud.

```
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | New folder                                     |    |
|    |                                                |    |
|    | Name                                           |    |
|    | [Provas 2026                                 ] |    |
|    |                                                |    |
|    | [Create]  [Cancel]                             |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog titled New folder with one field, Name, and buttons Create and Cancel. -->

- For a rename the title is "Rename", the field holds the current name without its extension, the extension is shown after the field as fixed text, and the button reads "Rename".
- Errors, under the field: "Enter a name."; "A name cannot contain /."; "Use 255 characters or fewer."; "\"Provas\" is already used in this folder." What was typed stays.
- Rename with a folder or several items selected never reaches this screen: Rename is not offered for that selection (Screen 1).

## Screen 9: The name already exists

```
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | "Lista 1.pdf" already exists in this folder    |    |
|    |                                                |    |
|    | [Replace]  [Keep both]  [Skip]                 |    |
|    |                                                |    |
|    | [ ] Do the same for the other 3 files          |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog saying a file with this name already exists in the folder, with buttons Replace, Keep both and Skip, and a checkbox to do the same for the other three files. -->

- Shown once per file whose name is already used, ignoring upper and lower case.
- The checkbox appears only when other files in the same upload have the same problem, and names how many (Q4). Ticked, the chosen answer applies to them all.
- Focus starts on Skip. Escape, or closing the dialog, means Skip for this file only.
- Under the buttons, small text explains: "Replace keeps the old file among deleted items. Keep both saves yours as Lista 1 (1).pdf."

## Screen 10: Confirm delete

```
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | Delete the folder "Provas"?                    |    |
|    |                                                |    |
|    | It contains 12 files and 2 folders.            |    |
|    | They will all disappear from the site.         |    |
|    |                                                |    |
|    | [Delete]  [Cancel]                             |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog asking whether to delete the folder Provas, saying it contains 12 files and 2 folders that will all disappear from the site, with buttons Delete and Cancel. -->

- One file: "Delete \"Lista 1.pdf\"?" Several items: "Delete 3 files and 1 folder?"
- The wording says "disappear from the site", not "permanently", because deleted items are kept and the maintainer can bring them back.
- Focus starts on Cancel. Escape cancels.
- If an item cannot be deleted, the others are, and a line above the list names it: "\"Aula 3.mp4\" could not be deleted. Try again."

## Screen 11: Uploading

```
+----------------------------------------------------------+
| [Upload] [New Folder]                                    |
+----------------------------------------------------------+
| Sending 5 files... about 2 minutes left                  |
| [==============================                        ] |
| "Notas.zip" was not sent: it is larger than 1 GB.        |
+----------------------------------------------------------+
|   Name                          Size       Changed by    |
+----------------------------------------------------------+
```

<!-- Text fallback: above the list, a line saying five files are being sent with about two minutes left, a progress bar, and a line saying one named file was not sent because it is larger than 1 GB. -->

- One bar and one estimate for the whole selection, as today but correct for several files.
- A file over 1 GB, or one that would pass the daily 5 GB, is refused before sending: "... was not sent: it is larger than 1 GB." or "... was not sent: you have reached today's limit of 5 GB. You can upload again tomorrow."
- Failure lines stay until dismissed. Progress is announced at a quarter, half, three quarters and done, not continuously.
- The upload continues if the person opens another folder; the bar stays visible and the files land in the folder where the upload started.

## Screen 12: Maintainer, Accounts

Reached by the "Maintainer" link. A separate screen with three sections.

```
+----------------------------------------------------------+
|                         [Logo]         Andre  [Sign out] |
+----------------------------------------------------------+
| < Back to the drive                                      |
+----------------------------------------------------------+
| [Accounts]   Changes   Deleted items                     |
+----------------------------------------------------------+
| Display name    Email address          Status            |
| Maria           maria@example.com      Active  [Disable] |
| Maria           m.souza@example.com    Active  [Disable] |
| Joao            joao@example.com       Disabled [Enable] |
|                                                          |
| Remove an account: select it, then [Remove account]      |
+----------------------------------------------------------+
```

<!-- Text fallback: the maintainer screen with a link back to the drive and three sections, Accounts selected. A table lists display name, email address and status for three accounts, two of them with the same display name, each with a Disable or Enable button, and a Remove account action below. -->

- Only a maintainer sees email addresses, and only here and in Changes (Q6). Two accounts with the same display name are told apart by them.
- Disable asks "Disable Maria (maria@example.com)? They will not be able to sign in or change anything." Enable needs no confirmation.
- Remove account asks "Remove this account? The email address and display name are erased. Their files and folders stay." and cannot be undone.
- Unconfirmed accounts show the status "Not confirmed".

## Screen 13: Maintainer, Changes

```
+----------------------------------------------------------+
| Accounts   [Changes]   Deleted items                     |
+----------------------------------------------------------+
| Account: [All accounts      v]   Item: [              ]  |
+----------------------------------------------------------+
| When              Who      What      Item                |
| 25 Nov 14:02      Maria    Deleted   Provas (folder,     |
|                                      12 files, 2 folders)|
| 25 Nov 13:40      Joao     Renamed   Lista.pdf to        |
|                                      Lista 1.pdf         |
| 25 Nov 13:12      Maria    Uploaded  Aula 3.mp4          |
+----------------------------------------------------------+
```

<!-- Text fallback: the Changes section, with a selector to narrow to one account and a field to narrow to one item, above a table listing date and time, who, what was done and the item, newest first. -->

- One line for each thing a person did. Deleting or restoring a folder is one line that states how much was inside; its contents are not listed line by line.
- "What" is one of: Uploaded, Replaced, Created folder, Renamed, Deleted, Restored.
- Nothing here can be edited or removed. Times are in the viewer's local time.
- The list is read in pages of 50, newest first.

## Screen 14: Maintainer, Deleted items

```
+----------------------------------------------------------+
| Accounts   Changes   [Deleted items]                     |
+----------------------------------------------------------+
| Name           Was in             Deleted by   When      |
| Provas         All > Calculo      Maria        25 Nov    |
|   (folder, 12 files, 2 folders)                [Restore] |
| Lista 1.pdf    All > Calculo      Joao         24 Nov    |
|   (replaced by a newer file)                   [Restore] |
+----------------------------------------------------------+
| Deleted items take up 3.2 GB. They are removed for good  |
| only in AWS.                                             |
+----------------------------------------------------------+
```

<!-- Text fallback: the Deleted items section, a table listing each deleted item with the folder it was in, who deleted it and when, a note on its second line, and a Restore button; below, a line saying how much space deleted items take and that they are removed for good only in AWS. -->

- Restore puts the item back where it was. If the name is taken, the message says "Restored as Lista 1 (1).pdf."
- If the folder it was in is itself deleted, Restore is replaced by "Restore \"Calculo\" first."
- The last line shows how much space the hidden items take, since nothing on the site ever removes them. This figure is a proposal of mine (requirements, open question 8), not a decision.
- There is no button to remove an item for good.

## Screen 15: Phone layout

```
+------------------------------+
| [Logo]             [Sign in] |
+------------------------------+
| All > ... > Calculo          |
+------------------------------+
| [Upload]      [New Folder]   |
| [Download]    [Delete]       |
+------------------------------+
| [x] (folder) Provas          |
| [x] (pdf)    Lista 1.pdf     |
|              240 kB          |
| [ ] (video)  Aula 3.mp4      |
|              88 MB           |
+------------------------------+
| Footer                       |
+------------------------------+
```

<!-- Text fallback: on a phone the logo and Sign in share the top line; the breadcrumb shortens its middle steps; the actions wrap two to a line; each row starts with a tick box and stacks the name above its size; two rows are ticked, so Download and Delete are shown. -->

- Below 768 pixels wide: actions wrap two to a line; each row stacks the name over the size and, when signed in, "changed by".
- Each row starts with a tick box, shown on touch screens, so several rows can be selected by tapping. Tapping the name of a folder opens it; tapping a file's name selects it; a second tap opens it. This is new: today's page has no way to select several rows by touch.
- Dialogs fill the width of the screen with the same content and order.
- The maintainer tables become stacked cards, one per row, with the same fields.

## Screen 16: Old site after the switch

The only page that replaces the old one, and only once the switch is accepted.

```
+----------------------------------------------------------+
|                         [Logo]                           |
+----------------------------------------------------------+
| Virtuoso Drive has moved.                                |
|                                                          |
| Go to virtuoso.andrefellipelabs.com                      |
|                                                          |
| Everything that was here is there.                       |
+----------------------------------------------------------+
```

<!-- Text fallback: a page with the logo, a line saying Virtuoso Drive has moved, a link to the new address, and a line saying everything that was here is there. -->

- During the read-only hours before this, the old page is unchanged: a change simply fails with the old page's own behaviour. Nothing is drawn for that, because the old page must not be altered until the switch is accepted.

## States every list has

| State | What is shown |
|-------|---------------|
| Loading | Three placeholder rows; announced once as "Loading" |
| Empty folder | "This folder is empty." and, when signed in, "Upload files or create a folder." |
| Could not load | "The list could not be loaded." and "Try again"; the breadcrumb still works |
| Out of date | "This list may be out of date." and "Refresh" |
| Very long name | The name wraps onto further lines; the row grows; nothing is cut off |
| Many rows | All rows are listed, as today; a folder of 500 items stays usable |

## Still open on these screens

- Whether the note about kept personal details on Screen 4 is enough.
- The space figure on Screen 14 is a proposal.
- The exact wording of every message is a first draft for the maintainer to adjust; the interface language stays English.
- Contrast and focus visibility of the existing colours are assessed in `design-system-mapping.md`; two small changes to the look are proposed there.

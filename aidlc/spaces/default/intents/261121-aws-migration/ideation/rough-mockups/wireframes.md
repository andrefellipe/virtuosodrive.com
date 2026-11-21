# Wireframes: Virtuoso Drive on the new platform

Rough sketches of the one screen and its states. The look, logo, icons and
interface text stay as they are today (scope document, "Behaviour that must be
kept"); these sketches show structure and what is new, not visual design.

Built on the approved intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`),
scope document
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/scope-definition/scope-document.md`)
and intent backlog
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/scope-definition/intent-backlog.md`).
Answers referred to as Q1 to Q7 are in `rough-mockups-questions.md`. File and
folder names in the sketches are examples written without accents; real names
keep theirs.

## What changes on the screen

| Element | Today | First version | Source |
|---------|-------|---------------|--------|
| Sign-in control | None | Top right corner | Q2 |
| The five actions | Always visible, all work for anyone | Always visible; four of them ask for sign-in first | Q1 |
| "Changed by" column | None | Shown to signed-in visitors only, holding a display name | Q6, Q7 |
| Duplicate name on upload | Error, then overwrites anyway | A choice: replace, keep both, or skip | Q4 |
| Delete | (behaviour kept; confirmation made explicit) | Always confirmed, naming what goes | Q5 |
| Everything else | Logo, breadcrumb, progress bar, table, footer | Unchanged | Scope document |

## Information outline

One screen, no navigation between pages.

- Header: logo, sign-in control
- Breadcrumb: path from "All" to the open folder
- Actions: Upload, New Folder, Download, Rename, Delete
- Upload progress (only while uploading)
- List: one row per folder or file, with icon, name, size, and for signed-in visitors "changed by"
- Footer

## Screen 1: the list, not signed in

Serves backlog items B-04 (browse) and B-05 (download).

```
+----------------------------------------------------------+
|                         [Logo]                 [Sign in] |
+----------------------------------------------------------+
| All > 1o Periodo > Calculo                               |
+----------------------------------------------------------+
| [Upload] [New Folder] [Download] [Rename] [Delete]       |
+----------------------------------------------------------+
|   Name                                        Size       |
|   (folder) Provas                             -          |
| > (pdf)    Lista 1.pdf                        240 KB     |
|   (video)  Aula 3.mp4                         88 MB      |
+----------------------------------------------------------+
| Footer                                                   |
+----------------------------------------------------------+
```

<!-- Text fallback: a header with the logo in the centre and a Sign in button at the top right; a breadcrumb; a row of five actions; a table with Name and Size columns holding one folder and two files, one of them marked as selected; a footer. -->

- The row marked `>` is selected. Selection is shown by more than colour.
- All five actions are visible. Download works at once. Upload, New Folder, Rename and Delete lead to Screen 3 (Q1).
- A video file shows the video icon (defect fixed in B-04).
- Accessibility: one h1 (the site name, on the logo); landmarks header, nav (breadcrumb), main (actions and list), footer; keyboard entry is a "skip to list" link, then Sign in.

## Screen 2: the list, signed in

Serves B-06 (sign-in), B-07 (upload), B-08 (organise), B-09 (live list).

```
+----------------------------------------------------------+
|                         [Logo]         Maria  [Sign out] |
+----------------------------------------------------------+
| All > 1o Periodo > Calculo                               |
+----------------------------------------------------------+
| [Upload] [New Folder] [Download] [Rename] [Delete]       |
+----------------------------------------------------------+
|   Name                          Size       Changed by    |
|   (folder) Provas               -          Joao          |
| > (pdf)    Lista 1.pdf          240 KB     Maria         |
|   (video)  Aula 3.mp4           88 MB      Joao          |
+----------------------------------------------------------+
| Footer                                                   |
+----------------------------------------------------------+
```

<!-- Text fallback: the same screen as Screen 1, with the person's display name and a Sign out button at the top right, and a third column, Changed by, holding display names. -->

- The top right shows the person's display name and "Sign out" (Q2).
- "Changed by" holds a display name, never an email address, and appears only for signed-in visitors (Q6, Q7).
- When someone else changes this folder, the list updates by itself (scope document). The update is announced to screen readers without moving the keyboard focus or losing the current selection.
- Accessibility: same headings and landmarks as Screen 1; the table has column headers; keyboard entry is unchanged.

## Screen 3: asked to sign in

Shown when a visitor who is not signed in chooses Upload, New Folder, Rename
or Delete (Q1).

```
+----------------------------------------------------------+
|                         [Logo]                 [Sign in] |
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | Sign in to change content                      |    |
|    |                                                |    |
|    | Browsing and downloading need no account.      |    |
|    | Uploading, renaming and deleting do.           |    |
|    |                                                |    |
|    | [Sign in]  [Create an account]  [Cancel]       |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog over the list titled "Sign in to change content", explaining that browsing and downloading need no account while uploading, renaming and deleting do, with three buttons: Sign in, Create an account, Cancel. -->

- "Create an account" is offered to anyone (scope document, "Access rules").
- After signing in, the person returns to the same folder with the same selection, and the action they chose carries on. Nothing they did is lost.
- Cancel returns to the list unchanged.
- The steps of signing in and creating an account themselves (what is asked for, how a display name is chosen) are not sketched here; they are for the refined mockups.
- Accessibility: the dialog title is an h2; focus moves into the dialog and stays there until it closes, then returns to the action that opened it; Escape cancels.

## Screen 4: a file with that name already exists

Shown during upload, once per file whose name is already in the folder (Q4).
Serves B-07 and fixes the overwrite defect.

```
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | "Lista 1.pdf" already exists in this folder    |    |
|    |                                                |    |
|    | [Replace]  [Keep both]  [Skip]                 |    |
|    |                                                |    |
|    | ( ) Do the same for the other 3 files          |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog saying that a file with this name already exists in the folder, with three buttons, Replace, Keep both and Skip, and an option to do the same for the remaining files that have the same problem. -->

- Nothing stored is replaced unless the person chooses Replace. Closing the dialog any other way counts as Skip.
- Keep both gives the new file a numbered name, such as "Lista 1 (1).pdf".
- "Do the same for the others" appears only when several files in the same upload have this problem. It was not asked about; it is a suggestion to avoid one dialog per file.
- Accessibility: title is an h2; focus starts on Skip, the choice that changes nothing; Escape means Skip.

## Screen 5: confirm delete

Shown every time, for one item or many (Q5). Serves B-08.

```
+----------------------------------------------------------+
|    +------------------------------------------------+    |
|    | Delete the folder "Provas"?                    |    |
|    |                                                |    |
|    | It contains 12 files and 2 folders.            |    |
|    | They will all be deleted.                      |    |
|    |                                                |    |
|    | [Delete]  [Cancel]                             |    |
|    +------------------------------------------------+    |
+----------------------------------------------------------+
```

<!-- Text fallback: a dialog asking whether to delete the folder named Provas, stating that it contains 12 files and 2 folders which will all be deleted, with Delete and Cancel buttons. -->

- For a single file the dialog names the file. For several items it gives the number of files and folders.
- Whether a deleted item can be brought back is still open (scope document, "Still Open"). Until that is decided, the wording does not promise either way.
- Deleting a folder always finishes and leaves nothing behind (defect fixed in B-08); the list shows the folder as "deleting" until it is done.
- Accessibility: title is an h2; focus starts on Cancel; Escape cancels.

## Other states of the list

| State | What the list area shows | Accessibility note |
|-------|--------------------------|--------------------|
| Loading | Placeholder rows where the list will be | Announced as "loading" once, not repeatedly |
| Empty folder | "This folder is empty." and, for signed-in visitors, "Upload files or create a folder." | The message is text, not an image |
| Could not load | "The list could not be loaded." with a "Try again" button; the breadcrumb still works | The message is announced; focus stays where it was |
| Uploading | The existing progress bar with time left, above the list; one line per file that fails, saying why | Progress is announced at intervals, not on every change |
| Signed out mid-action | Screen 3, then back to the same folder and selection | Nothing typed or selected is lost |
| Very long name | The name wraps or is shortened with the full name available; the row never breaks the layout | The full name is what a screen reader reads |
| Many rows | Range selection with Shift works for any number of rows (defect fixed in B-04) | Range selection also works from the keyboard |

Names are always shown as plain text, whatever characters they contain, so a
crafted name cannot do anything in another visitor's browser (defect fixed in
B-04).

## Phone layout

```
+------------------------------+
| [Logo]             [Sign in] |
+------------------------------+
| All > ... > Calculo          |
+------------------------------+
| [Upload]      [New Folder]   |
| [Download]    [Rename]       |
| [Delete]                     |
+------------------------------+
| (folder) Provas              |
|          -                   |
| (pdf)    Lista 1.pdf         |
|          240 KB              |
+------------------------------+
| Footer                       |
+------------------------------+
```

<!-- Text fallback: on a phone the logo and Sign in share the top line; the breadcrumb shortens its middle; the five actions wrap onto three lines; each list row stacks the name above its size; the footer is last. -->

- Same content and order as the laptop screen; nothing is removed (Q3).
- Each action is large enough to tap comfortably.
- For signed-in visitors, "changed by" joins the second line of each row beside the size.
- Accessibility: same headings, landmarks and keyboard order as the laptop screen.

## Accessibility across all screens

The target is WCAG 2.1 AA (Q3). In practice, for this screen:

- Every action can be reached and used with the keyboard alone, in the order: skip link, sign-in, breadcrumb, actions, list.
- The actions are real buttons with text labels; icons alone never carry meaning.
- Selection, errors and progress are never shown by colour alone.
- Text and controls meet the contrast needed to be read. The current colours have not been measured; if any fall short, adjusting them is the one permitted change to the look.

## Not sketched here

- The sign-in and account creation steps themselves.
- Anything outside scope: search, previews, folder rename, folder download, sharing.

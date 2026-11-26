# Accessibility Checklist: Virtuoso Drive on AWS

The target is WCAG 2.1 level AA (requirement NFR6 in
`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`).
This checklist turns that into things that can be checked on the screens in
`mockups.md`, which refine
`aidlc/spaces/default/intents/261121-aws-migration/ideation/rough-mockups/wireframes.md`
and `user-flow.md`, for the stories in
`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`.
How it is tested follows the team practices
(`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`):
an automated scan in the end-to-end tests, plus the hand checks listed at the
end.

Each line is unchecked because nothing is built yet. A line is checked when
the built screen passes it.

## Where today's page stands

From the code analysis (finding TD-11) and the existing files:

| Problem today | Fixed by |
|---------------|----------|
| Rows and actions cannot be reached or used with the keyboard | FileList and ActionBar in `interaction-spec.md` |
| Icons have no text alternative | Text alternatives on every icon |
| Actions are links that go nowhere | Real buttons |
| Selection is shown by colour only | Check mark added |
| The browser's own prompt boxes cannot show an error beside a field | Dialogs with labelled fields |
| Changes to the list are not announced | Status line |
| Text selection is switched off page-wide | Switched back on |
| Several rows cannot be selected by touch | Tick boxes |

## Perceivable

- [ ] Every icon has a text alternative ("Folder", "PDF file", "Video file"); icons beside a visible label are hidden from assistive technology.
- [ ] The logo has the alternative text "Virtuoso Drive".
- [ ] Body text has a contrast of at least 4.5 : 1; controls and focus rings at least 3 : 1 (see the table in `design-system-mapping.md`).
- [ ] No information is given by colour alone: selection has a check mark; errors have words; an account's status is text.
- [ ] The page reflows to 320 pixels wide with no sideways scrolling, and works zoomed to 200% and with text spacing increased.
- [ ] Content is readable in portrait and landscape.
- [ ] The table has column headers, including a hidden "Kind" heading; "changed by" dashes are read as "not recorded".
- [ ] Each screen has one level 1 heading ("Virtuoso Drive"); dialog titles are level 2; no level is skipped.
- [ ] Landmarks: header, navigation (breadcrumb), main, footer.
- [ ] Nothing flashes; motion is limited to the progress bar and placeholders and stops when reduced motion is requested.
- [ ] Form fields that collect an email address or a password declare their purpose, so browsers and password managers can fill them.

## Operable

- [ ] Everything can be done with the keyboard alone: browse, select one and several rows, download, open, sign in, create an account, reset a password, upload, create a folder, rename, delete, and every maintainer function.
- [ ] A "Skip to the list" link is the first thing reached with Tab.
- [ ] Tab order: skip link, account control, breadcrumb, actions, list, footer.
- [ ] Focus is always visible, with a ring of at least 2 pixels.
- [ ] No keyboard trap: every dialog closes with Escape.
- [ ] Dialogs keep focus inside while open and return it to the control that opened them.
- [ ] The list is one Tab stop; arrow keys move within it; the keys in `interaction-spec.md` (FileList, selection rules) all work.
- [ ] Shortcuts use modifier keys or act only when the list has focus, so a single letter never triggers an action.
- [ ] Touch targets are at least 44 by 44 pixels with 8 pixels between them.
- [ ] Every action that works by double-click also works by a single action (Enter, or a second tap).
- [ ] No action depends on a time limit, except the links sent by email (24 hours), which can be sent again.
- [ ] A session that ends does not lose work: the person signs in again and carries on.
- [ ] The page has the title "Virtuoso Drive"; the maintainer screen "Maintainer - Virtuoso Drive".
- [ ] Link and button texts make sense on their own; row buttons on the maintainer screen name their target.

## Understandable

- [ ] The page declares its language as English.
- [ ] Every field has a visible label above it; a placeholder is never the only label.
- [ ] Hints (such as "At least 10 characters.") are shown before typing and tied to their field.
- [ ] Errors are in words, beside the field, tied to it, and say how to fix it; the field is marked invalid.
- [ ] After a failed submit, focus goes to the first field with an error, and everything typed is kept.
- [ ] Deleting, disabling and removing an account ask for confirmation naming what is affected; the safe choice has the starting focus.
- [ ] Nothing changes context unexpectedly: focusing or typing in a field never submits or navigates.
- [ ] Updates from other people never move focus or change the selection.
- [ ] The same thing has the same name and place everywhere (the account control, Cancel, the status line).
- [ ] Sign-in does not require solving a puzzle or remembering anything other than the password; pasting and password managers work.

## Robust

- [ ] Native elements are used wherever one exists: buttons, links, tables, form fields, checkboxes.
- [ ] Where roles are added (dialog, tabs, progress bar, status), names and states are exposed correctly.
- [ ] Status messages are announced without moving focus: selection count, changes by others, upload progress at quarters, outcomes of actions, errors.
- [ ] The markup is valid and ids are unique.

## Per screen

| Screen | Heading | Starting focus | Must be announced |
|--------|---------|----------------|-------------------|
| 1, 2 List | h1 "Virtuoso Drive" | Skip link, then as the person left it | Folder opened with its item count; selection count; changes by others |
| 3 Sign in | h2 "Sign in" | Email address | Errors; the pause after too many attempts |
| 4 Create an account | h2 "Create an account" | Email address | Field errors |
| 5 Check your email | h2 "Check your email" | "Close" | The message |
| 6 Back after confirming | h1 | The reminder line | The reminder |
| 7 Reset a password | h2 | The field | The outcome |
| 8 Name | h2 "New folder" or "Rename" | The name field, text selected for a rename | Field errors |
| 9 Name already exists | h2 with the file name | "Skip" | The question, and how many files remain |
| 10 Confirm delete | h2 with what is deleted | "Cancel" | The question and the counts |
| 11 Uploading | none | Unchanged | Start, quarters, end, each failure |
| 12 to 14 Maintainer | h1, with the section as h2 | The selected tab | Outcome of each action |
| 16 Old site notice | h1 "Virtuoso Drive has moved." | The link | none |

## How this is checked

| Check | When | By |
|-------|------|----|
| Automated scan of every screen and dialog, with no violation | In the end-to-end tests, on every change | Pipeline |
| Each key journey completed with the keyboard alone: browse, upload, download, rename, delete, sign-in | In the end-to-end tests | Pipeline |
| Each key journey with a screen reader (VoiceOver on macOS and on a phone) | Once before the switch, and after any change to a screen | Maintainer |
| Zoom to 200% and width of 320 pixels | Once before the switch | Maintainer |
| Contrast of every colour pair with a checker | When the screens are built | Maintainer |

An automated scan finds only part of the problems, which is why the hand
checks are listed. They are the maintainer's to do; no one else is available
to do them.

## Not assessed

- The accessibility of the files students upload. The site cannot make a scanned PDF readable.
- The old site's notice page is assessed; the old site itself is not changed and not assessed.

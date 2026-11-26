# Interaction Specification: Virtuoso Drive on AWS

How each part of the screens in `mockups.md` behaves. It refines the journeys
in
`aidlc/spaces/default/intents/261121-aws-migration/ideation/rough-mockups/user-flow.md`
and the sketches in `wireframes.md` beside it, and serves the stories
(`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`)
and requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`).
Naming follows the team's code style
(`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`):
PascalCase for components, camelCase for their inputs. The usage examples show
shape only; which frontend approach is used is decided at design.

## Rules that apply everywhere

- **Reading never needs an account.** No dialog appears until a person chooses something that changes content.
- **Nothing is lost by an interruption.** After signing in, an error, or a lost connection, the person is in the same folder with the same selection, and anything typed is still there.
- **Errors say what happened and what to do**, in words, beside the thing they concern.
- **Dialogs** take the keyboard focus when they open, keep it until they close, close on Escape with the safe outcome (Cancel or Skip), and return focus to the control that opened them. One dialog at a time; none opens another.
- **Destructive or irreversible choices never have the starting focus.**
- **Updates from other people** never move focus, change the selection or clear typing.
- **Text from users** (names, display names) is always shown as text.
- **Motion** is limited to the progress bar and placeholder rows, and is switched off when the person's device asks for reduced motion.
- **Breakpoint:** below 768 pixels wide is the phone layout; from 768 up is the laptop layout.

---

## AccountControl

| Field | Value |
|---|---|
| Component | AccountControl |
| Description | Shows whether the person is signed in, and lets them sign in or out |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| signedOut | Button "Sign in" | No session |
| signedIn | Display name and button "Sign out" | Session present |
| maintainer | As signedIn, with a "Maintainer" link before the name | Session of a maintainer account |
| loading | Neutral placeholder of the same width | Session being checked on first load |
| focus | Visible focus ring on the button or link | Keyboard focus |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| session | object | no | — | Display name and whether the account is a maintainer; absent when signed out |
| onSignIn | function | yes | — | Opens SignInDialog |
| onSignOut | function | yes | — | Ends the session and stays in the same folder |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | Shares the top line with the logo; a long display name is shortened with the full name available to assistive technology |
| tablet (768–1024px) | As desktop |
| desktop (>1024px) | Top right of the header, logo centred |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | Native button and link inside the header landmark |
| Keyboard interaction | Tab to focus, Enter or Space to activate |
| Label / aria-label | Visible text; the display name is preceded by hidden text "Signed in as" |
| Contrast ratio | WCAG AA (4.5:1 text, 3:1 UI components) |
| Screen reader | Signing in or out is announced once: "Signed in as Maria." / "Signed out." |
| Focus management | After sign-out, focus stays on the control |

### Usage Example

```
<AccountControl session={session} onSignIn={openSignIn} onSignOut={signOut} />
```

---

## ActionBar

| Field | Value |
|---|---|
| Component | ActionBar |
| Description | The row of actions; which ones are shown depends on the selection |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | Upload, New Folder | Nothing selected |
| oneFile | Upload, New Folder, Download, Rename, Delete | Exactly one file selected |
| other | Upload, New Folder, Download, Delete | One folder, or several items, selected |
| uploading | As above; UploadProgress is shown beneath | An upload is running |
| disabled | Upload and New Folder shown but inactive, with the reason as text | Account not confirmed |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| selection | object | yes | — | The selected items, with their kinds |
| signedIn | boolean | yes | — | When false, Upload, New Folder, Rename and Delete open SignInDialog first and then carry on |
| onAction | function | yes | — | Called with the action name |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | Actions wrap two to a line; each at least 44 by 44 pixels |
| tablet (768–1024px) | One line |
| desktop (>1024px) | One line, as today |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | A toolbar of native buttons; today's links with `href="#"` are replaced by buttons |
| Keyboard interaction | Tab to reach; Enter or Space to activate; Delete key on the list also triggers Delete |
| Label / aria-label | Visible text beside each icon; icons are decorative |
| Contrast ratio | WCAG AA (4.5:1 text, 3:1 UI components) |
| Screen reader | When actions appear or disappear with the selection, nothing is announced; the selection announcement (FileList) says what is selected |
| Focus management | If the focused action disappears because the selection changed, focus moves to the list |

### Usage Example

```
<ActionBar selection={selection} signedIn={isSignedIn} onAction={runAction} />
```

---

## FileList

| Field | Value |
|---|---|
| Component | FileList |
| Description | The table of folders and files in the open folder, with selection |
| Category | display |

### States

| State | Description | Trigger |
|---|---|---|
| loading | Three placeholder rows | Contents being fetched |
| empty | "This folder is empty." | No visible items |
| error | "The list could not be loaded." with "Try again" | Fetch failed |
| populated | One row per item, oldest first | Contents received |
| stale | A note "This list may be out of date." with "Refresh" above the rows | Connection lost |
| rowSelected | Highlight colour and a check mark at the start of the row | Selection |
| rowPending | Row shown dimmed with the text "deleting" | Delete in progress |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| items | object | yes | — | Items with id, kind, name, size, content type and, when signed in, who last changed them |
| selection | object | yes | — | Ids of selected items |
| showChangedBy | boolean | yes | false | True for signed-in visitors only |
| onSelect | function | yes | — | Called with the new selection |
| onOpen | function | yes | — | Opens a folder in place, a file in a new tab |

### Selection rules

| Input | Result |
|---|---|
| Click, or Space on the focused row | Selects that row only |
| Ctrl-click or Command-click, or Ctrl-Space | Adds or removes that row |
| Shift-click, or Shift with the arrow keys | Selects the range from the last chosen row, compared as numbers |
| Arrow up and down | Move focus between rows |
| Ctrl-A or Command-A | Selects all rows |
| Escape | Clears the selection |
| Double-click, or Enter | Opens the row |
| Tap on a row's tick box (touch) | Adds or removes that row |
| Tap on a folder's name (touch) | Opens it |
| Tap on a file's name (touch) | Selects it; a second tap opens it |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | Each row stacks the name over the size and "changed by"; a tick box starts each row |
| tablet (768–1024px) | Table with columns; tick boxes on touch devices |
| desktop (>1024px) | Table with columns: kind, name, size, and "changed by" when signed in |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | A native table with column headers; rows are selectable and expose their selected state |
| Keyboard interaction | One Tab stop for the list; arrows move within it; keys as in the selection rules |
| Label / aria-label | The table is labelled with the open folder's name; the kind column has a hidden heading "Kind"; each icon has a text alternative such as "Folder" or "PDF file" |
| Contrast ratio | WCAG AA (4.5:1 text, 3:1 UI components); selection is never shown by colour alone |
| Screen reader | A polite status line announces: "3 items selected."; "Aula 4.mp4 was added."; "Lista 1.pdf, which you had selected, was deleted." A dash under "changed by" is read as "not recorded" |
| Focus management | An update keeps focus on the same item; if that item is gone, focus moves to the next row |

### Usage Example

```
<FileList items={items} selection={selection} showChangedBy={isSignedIn}
          onSelect={setSelection} onOpen={open} />
```

---

## Breadcrumb

| Field | Value |
|---|---|
| Component | Breadcrumb |
| Description | The path from "All" to the open folder; each earlier step opens that folder |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | Steps as links; the last as plain text marked as the current page | Any folder |
| long | Middle steps collapsed to "..." which opens the hidden steps | Path wider than the screen |
| focus | Visible focus ring on a step | Keyboard focus |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| path | object | yes | — | Folders from "All" to the open one, each with id and name |
| onNavigate | function | yes | — | Opens the chosen folder |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | Shows "All", "...", and the last two steps |
| tablet (768–1024px) | Collapses only when too wide |
| desktop (>1024px) | Full path, as today |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | Navigation landmark labelled "Breadcrumb", an ordered list inside, as today |
| Keyboard interaction | Tab between steps, Enter to open |
| Label / aria-label | Step names as text; the current step marked as the current page |
| Contrast ratio | WCAG AA (4.5:1 text, 3:1 UI components) |
| Screen reader | Opening a folder announces "Folder Calculo, 12 items." |
| Focus management | After opening a folder from the breadcrumb, focus moves to the list |

### Usage Example

```
<Breadcrumb path={path} onNavigate={openFolder} />
```

---

## Dialog

| Field | Value |
|---|---|
| Component | Dialog |
| Description | The one frame used for every dialog: sign-in, account, name, duplicate, delete, maintainer confirmations |
| Category | layout |

### States

| State | Description | Trigger |
|---|---|---|
| open | Shown over the page; the page behind is inert and does not scroll | Opened by an action |
| busy | Buttons inactive and the main button reads, for example, "Signing in..." | Waiting for the server |
| error | A message at the top of the dialog or under a field | The server or a rule refused |
| closed | Not shown | Completed, cancelled, or Escape |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| title | string | yes | — | The dialog's heading |
| initialFocus | string | no | first field | Which control has focus on opening; the safe choice for confirmations |
| onClose | function | yes | — | Called on Cancel, Escape, or completion |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | Full width, anchored to the top so the on-screen keyboard does not cover the fields |
| tablet (768–1024px) | Centred, fixed width |
| desktop (>1024px) | Centred, fixed width |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | Dialog, labelled by its title; a confirmation that needs an answer is an alert dialog |
| Keyboard interaction | Tab and Shift-Tab cycle inside; Escape closes with the safe outcome |
| Label / aria-label | The title is a level 2 heading |
| Contrast ratio | WCAG AA (4.5:1 text, 3:1 UI components) |
| Screen reader | The title and any opening message are read when it opens; an error is announced when it appears |
| Focus management | Focus moves in on opening and returns to the control that opened it on closing |

### Usage Example

```
<Dialog title="Delete the folder Provas?" initialFocus="cancel" onClose={close}>
  ...
</Dialog>
```

---

## AccountForms

| Field | Value |
|---|---|
| Component | AccountForms |
| Description | The forms inside Dialog for signing in, creating an account, and resetting a password |
| Category | input |

### States

| State | Description | Trigger |
|---|---|---|
| signIn | Email address, password | "Sign in", or a change action while signed out |
| createAccount | Email address, display name, password | "Create an account" |
| checkEmail | Message naming the address, "Send it again" | Account created |
| resetRequest | Email address | "Forgot your password?" |
| resetChoose | New password | Reset link opened |
| fieldError | Message under the field, field marked invalid | A rule failed when leaving the field or submitting |
| formError | Message above the fields | Wrong details, too many attempts, disabled account |
| paused | Sign-in refused with the time it can be tried again | 5 wrong passwords in a row within 15 minutes |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| mode | string | yes | signIn | Which form is shown |
| pendingAction | string | no | — | The action the person chose before signing in; carried on after sign-in, or named in the reminder after confirming |
| onDone | function | yes | — | Called when signed in |

### Rules

| Field | Rule | Message |
|---|---|---|
| Email address | Required; shaped like an address | "Enter an email address." |
| Display name | Required; 1 to 50 characters after trimming | "Enter a display name." |
| Password (new) | At least 10 characters | "Use at least 10 characters." |
| Sign-in | Wrong address or password | "The email address or password is not right." |
| Sign-in | Paused | "Too many attempts. Try again at 14:35, or reset your password." |
| Sign-in | Disabled account | "This account has been disabled. Contact the maintainer." |
| Reset request | Any address | "If that address has an account, we sent it a link. It works for 24 hours." |

The count of wrong passwords starts again after a successful sign-in or a
password reset. The 15 minutes run from the fifth wrong password. The display
name limit of 50 characters is a default of mine.

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | One column; fields full width; the right keyboard for each field (email, password) |
| tablet (768–1024px) | One column |
| desktop (>1024px) | One column |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | Native form, inputs and buttons |
| Keyboard interaction | Tab through fields; Enter submits |
| Label / aria-label | A visible label above every field; hints tied to their field; never a placeholder as the only label |
| Contrast ratio | WCAG AA (4.5:1 text, 3:1 UI components) |
| Screen reader | Errors are tied to their field and announced; the field is marked invalid |
| Focus management | On a failed submit, focus moves to the first field with an error; password fields allow pasting and password managers |

### Usage Example

```
<AccountForms mode="signIn" pendingAction="upload" onDone={resume} />
```

---

## UploadProgress and DuplicateChoice

| Field | Value |
|---|---|
| Component | UploadProgress, with DuplicateChoice |
| Description | Shows the progress of an upload and its failures; asks what to do when a name already exists |
| Category | feedback |

### States

| State | Description | Trigger |
|---|---|---|
| hidden | Not shown | No upload running and no failure to show |
| sending | "Sending 5 files... about 2 minutes left" and one bar | Upload running |
| asking | DuplicateChoice dialog for one file; the other files keep sending | A name already exists |
| failedLines | One line per file not sent, with the reason, until dismissed | Refused or failed |
| done | "5 files sent." for 5 seconds, then hidden | All finished |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| files | object | yes | — | The files of this upload with their state and bytes sent |
| targetFolder | object | yes | — | The folder open when the upload started; fixed for the whole upload |
| onChoice | function | yes | — | Called with replace, keepBoth or skip, and whether it applies to the rest |

### Rules

- Size and daily-limit checks happen before any byte is sent.
- The estimate is computed over all files of the upload, from one start time.
- DuplicateChoice: focus starts on Skip; Escape means Skip for that file; the "do the same" box appears only when more files have the same problem.
- Leaving the page while sending asks the browser's standard "leave site?" question.

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | Full width under the actions; failure lines wrap |
| tablet (768–1024px) | As desktop |
| desktop (>1024px) | Between the actions and the list, as today |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | A progress bar with its value; failure lines in a status region |
| Keyboard interaction | Failure lines can be dismissed with a button |
| Label / aria-label | The bar is labelled "Upload progress" |
| Contrast ratio | WCAG AA (4.5:1 text, 3:1 UI components); the bar is thicker than today's 2 pixels |
| Screen reader | Announced at start, 25%, 50%, 75% and the end; each failure once |
| Focus management | Starting an upload does not move focus; DuplicateChoice follows Dialog |

### Usage Example

```
<UploadProgress files={uploadFiles} targetFolder={startFolder} onChoice={resolveDuplicate} />
```

---

## MaintainerScreen

| Field | Value |
|---|---|
| Component | MaintainerScreen |
| Description | A separate screen for maintainers with three sections: Accounts, Changes, Deleted items |
| Category | layout |

### States

| State | Description | Trigger |
|---|---|---|
| accounts | Table of accounts with status and actions | Default section |
| changes | The record of changes, newest first, with two filters | "Changes" |
| deletedItems | Deleted items with Restore | "Deleted items" |
| loading, empty, error | As FileList, with wording for the section | Per section |
| forbidden | "This page is for maintainers." and a link back | Opened by a non-maintainer |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| section | string | yes | accounts | Which section is shown; reflected in the address so it can be reloaded |
| onBack | function | yes | — | Returns to the folder the maintainer came from |

### Rules

- Email addresses appear only here, and only for maintainers.
- Disable and Remove account ask for confirmation naming the display name and the email address; Enable and Restore do not.
- Restore reports the outcome in a status line, including a new name if one was needed.
- Nothing in Changes can be edited.

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | Sections as three stacked buttons; each table row becomes a card |
| tablet (768–1024px) | Tabs and tables |
| desktop (>1024px) | Tabs and tables |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | Tabs with their panels; native tables with headers |
| Keyboard interaction | Arrow keys between tabs, Tab into the panel; buttons with Enter or Space |
| Label / aria-label | Each row's buttons name their target: "Disable Maria, maria@example.com" |
| Contrast ratio | WCAG AA (4.5:1 text, 3:1 UI components); status is text, not colour |
| Screen reader | Outcomes announced: "Maria disabled."; "Restored as Lista 1 (1).pdf." |
| Focus management | After an action on a row, focus stays on that row; after Remove account, on the next row |

### Usage Example

```
<MaintainerScreen section="deletedItems" onBack={returnToDrive} />
```

---

## Journeys end to end

The rough flows 1 to 6 still hold. What the refined screens change in them:

| Journey | Steps |
|---------|-------|
| First upload by a new person | List, choose Upload, Sign in dialog, "Create an account", fill the form, "Check your email", open the link, back in the same folder with the reminder, choose Upload again, upload |
| Upload by someone with an account | List, choose Upload, Sign in dialog, sign in, the file chooser opens without choosing Upload again |
| Forgotten password | Sign in dialog, "Forgot your password?", enter the address, open the link, choose a new password, signed in |
| Delete by mistake, put right | Contributor deletes; maintainer opens Maintainer, Deleted items, Restore; the item is back for everyone within 5 seconds |
| Misuse | Maintainer opens Changes, narrows to the account, opens Accounts, Disable; then restores what was deleted |

One limit of the browser shapes the second journey: a file chooser can only be
opened as the direct result of a click. After signing in, the dialog's "Sign
in" click is that click, so the chooser can open. After confirming by email
there is no such click, which is why the first journey asks the person to
choose Upload again.

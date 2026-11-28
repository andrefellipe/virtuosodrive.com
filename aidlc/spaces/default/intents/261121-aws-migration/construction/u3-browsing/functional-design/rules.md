# Rules: U3, browsing and selecting

The rules browsing must obey. Groups: BR1 what the server answers for a
folder or a file; BR2 the records and the name rules that later Units rely on; BR3 what
the page shows; BR4 selection and the actions.

Sources: stories US1.1 to US1.3 and US2.1 with their criteria
(`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`),
requirements FR1, FR2 and the quality requirements named per rule
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contracts C1, C3 and C9
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the interaction specification
(`aidlc/spaces/default/intents/261121-aws-migration/inception/refined-mockups/interaction-spec.md`),
and the answers Q1 to Q4 in `functional-design-questions.md`.

```yaml
rules:
  - id: BR1.1
    statement: Anyone may read a folder; no account or session is asked for.
    category: authorization
    applies_to: FolderView
    trigger: A request for a folder
    logic: IF the request reaches the server THEN answer it whether or not it carries a session. A session, if present, changes nothing in U3.
    violation: None; there is no refusal for lack of an account.
    source: FR1.1, contract C1 (who may call)

  - id: BR1.2
    statement: The identifier "root" always means the top folder, "All".
    category: constraint
    applies_to: FolderView
    trigger: A request for folder "root"
    logic: IF the folder asked for is "root" THEN answer with the top folder. The answer carries the top folder's real identifier, and asking by that identifier gives the same answer.
    violation: None.
    source: contract C3

  - id: BR1.3
    statement: A folder's answer lists only its visible items.
    category: constraint
    applies_to: FolderView, Row
    trigger: A request for a folder
    logic: IF an item of the folder has no deletedAt THEN list it. OTHERWISE leave it out. (The folder itself is visible, or BR1.4 would have refused.)
    violation: None; hidden items are simply absent.
    source: FR1.8, contract C9 (visibility)

  - id: BR1.4
    statement: A folder that is deleted, inside a deleted folder, or unknown answers "not found", and the three cannot be told apart.
    category: constraint
    applies_to: FolderView
    trigger: A request for a folder
    logic: IF the folder does not exist, OR has a deletedAt, OR any folder above it has one, THEN answer with a Problem, status 404, code notFound, with the same content in all three cases.
    violation: Status 404, code notFound.
    source: FR1.8, contract C3

  - id: BR1.5
    statement: Rows are in order of position, lowest first, the same for everyone and on every request.
    category: constraint
    applies_to: FolderView
    trigger: A request for a folder
    logic: Order the visible items by position. Positions within a folder are unique, so the order is total and repeatable.
    violation: None.
    source: FR1.4

  - id: BR1.6
    statement: The answer carries the path from "All" to the folder.
    category: calculation
    applies_to: FolderView
    trigger: A request for a folder
    logic: Follow parentFolderId from the folder up to the top folder; return the steps top first, each with its identifier and name, the folder itself last.
    violation: None.
    source: FR1.3, contract C3

  - id: BR1.7
    statement: A row carries the identifier, kind and name; a file's row also its size and, when recorded, its content type. Nothing else.
    category: constraint
    applies_to: Row
    trigger: A request for a folder
    logic: IF the item is a folder THEN no size and no content type. IF it is a file THEN its size in whole bytes, and its content type if one is recorded. No "changed by", no account identifier, no deletion mark, no position, no contentId.
    violation: None.
    source: FR1.2, contract C3, answer Q1

  - id: BR1.8
    statement: The answer names the folder's version, and a caller that already holds that version is told "unchanged" instead of being sent the list again.
    category: constraint
    applies_to: FolderView
    trigger: A request for a folder, with or without a version the caller holds
    logic: IF the caller sends a version equal to the folder's current one THEN answer "unchanged" (status 304) with no content. OTHERWISE answer with the list and the current version. A version that is malformed or belongs to another folder is treated as not held.
    violation: None.
    source: contract C3

  - id: BR1.9
    statement: The whole list is returned at once.
    category: constraint
    applies_to: FolderView
    trigger: A request for a folder
    logic: Return every visible item; there are no pages. A folder of 500 items must be answered and shown within 2 seconds.
    violation: None. A folder far larger than 500 items is an open point for the migration, not refused here.
    source: NFR9, contract C3

  - id: BR1.10
    statement: The folder identifier in a request is checked before it is used.
    category: validation
    applies_to: FolderView
    trigger: A request for a folder
    logic: IF the identifier is "root" or has the form of a generated identifier THEN look it up. OTHERWISE answer notFound without touching the database. No other input is read from the request except the version held and the request identifier.
    violation: Status 404, code notFound. An identifier of the wrong form is "a folder that does not exist", not a malformed request, so the answer reveals nothing about what identifiers look like.
    source: NFR3

  - id: BR1.11
    statement: A file is visible only when neither it nor any folder above it is deleted; a file that is not visible is "not found" to every Unit that asks.
    category: constraint
    applies_to: File
    trigger: Another Unit looks a file up (getVisibleFile), now or later for downloading
    logic: IF the file exists AND has no deletedAt AND its folder and every folder above that have none THEN return its name, size, content type and contentId. OTHERWISE answer notFound, the same whether the file never existed, was deleted, or sits inside a deleted folder. An identifier of the wrong form is notFound without a lookup, as in BR1.10.
    violation: notFound.
    source: FR1.8, contract C9 (visibility, getVisibleFile)

  - id: BR2.1
    statement: Folders and files are identified by generated identifiers that are never reused and never derived from a name.
    category: constraint
    applies_to: Folder, File
    trigger: An item is created
    logic: Generate a new identifier, unique across folders and files. Never accept one from a caller.
    violation: None; there is no path that takes an identifier from outside.
    source: contract C1 (identifiers), contract C9

  - id: BR2.2
    statement: An item's position is given once and never changes.
    category: constraint
    applies_to: Folder, File
    trigger: An item is created in a folder
    logic: Give it the next whole number after the highest position ever used in that folder, counting deleted items. Never renumber. (The migration supplies positions itself, under the same uniqueness.)
    violation: Two items of one folder with the same position are refused by the store.
    source: FR1.4, contract C9

  - id: BR2.3
    statement: There is exactly one top folder, named "All", from the first moment the site exists.
    category: constraint
    applies_to: Folder
    trigger: The database structure is created
    logic: Create the top folder with the structure itself, with no parent and version 1. Nothing can create a second folder without a parent.
    violation: Refused by the store.
    source: FR1.1

  - id: BR2.4
    statement: A name is normalised by putting it in one composed form and removing white space at both ends, and nothing else.
    category: validation
    applies_to: Folder, File
    trigger: A name is checked (checkName), and before any name is stored
    logic: First put the text into Unicode Normalization Form C, so that an accented letter typed as one character and the same letter sent as a letter plus a combining accent (as macOS often sends file names) become the same text. Then remove from the start and the end every character that Unicode classes as white space. Keep case, accents, dots and inner spaces exactly as given. The result is what is stored, shown and compared.
    violation: None; this step cannot fail.
    source: contract C9 (name rules), made exact here

  - id: BR2.5
    statement: A valid name has 1 to 255 characters after normalising, at least one visible character, no "/", no control or invisible formatting character, and is not "." or "..".
    category: validation
    applies_to: Folder, File
    trigger: A name is checked
    logic: A "character" is one Unicode code point of the normalised name. IF the normalised name is empty, or holds nothing but white space and invisible formatting characters, THEN nameEmpty. IF longer than 255 characters THEN nameTooLong. IF it contains "/", a control character (Unicode category Cc), or an invisible formatting character (category Cf, which includes zero-width and direction-changing characters), or is exactly "." or "..", THEN nameHasForbiddenCharacter. Checked in that order; the first that applies is reported.
    violation: The code named, for the caller to turn into its own answer.
    source: contract C9, NFR3

  - id: BR2.6
    statement: Among the visible items of one folder no two names are the same, ignoring upper and lower case; folders and files share one set of names.
    category: validation
    applies_to: Folder, File
    trigger: A name is checked for a folder
    logic: Two names are the same when their normalised forms (BR2.4) are equal after Unicode's default case folding, which depends on no language setting. IF a visible item of the folder, other than the one being renamed, has the same name in that sense THEN nameAlreadyUsed. Deleted items do not count. Accented and unaccented letters are different letters. The store holds the same rule, so two writers cannot both succeed (BR2.11).
    violation: Code nameAlreadyUsed.
    source: contract C9, made exact here

  - id: BR2.7
    statement: The lowest free numbered name for a taken name puts "(1)", "(2)" and so on before the extension.
    category: calculation
    applies_to: Folder, File
    trigger: A caller asks for a free name (lowestFreeName)
    logic: First normalise and validate the name as BR2.4 and BR2.5 do; an invalid name is refused with the same codes. IF the name is free THEN return it. OTHERWISE split it at its last dot into a base and an extension. What follows the last dot is an extension only when it is 1 to 10 letters or digits, at least one of them a letter, and the dot is not the first character; so "exam.pdf" and "notes.tar.gz" have one, and "2019.1", "v1.2" and ".profile" have none. Try base + " (1)" + extension, then " (2)", and so on, and return the first that BR2.6 finds free. IF adding the number would pass 255 characters THEN shorten the base by whole characters, never the extension.
    violation: nameEmpty, nameTooLong or nameHasForbiddenCharacter for an invalid name. For a valid name a free name always exists.
    source: contract C9

  - id: BR2.8
    statement: Until U4, a file may exist without stored contents; it is listed like any other.
    category: policy
    applies_to: File
    trigger: A file is listed, or looked up by another Unit (getVisibleFile)
    logic: List the file with its name, size and type. IF another Unit asks for a visible file THEN return it with an empty contentId, and that Unit must treat it as having nothing to download. This rule ends with U4, which fills the sample files' contents through the loader (BR2.10), requires a contentId from every operation that creates a file, and, when no file without contents remains in either environment, has the store refuse an empty one. No operation of U7 or U8 ever creates a file without contents, since both are built after U4.
    violation: None in U3.
    source: answer Q2, contract C9 (guarantee, suspended until U4)

  - id: BR2.9
    statement: Any change to what a folder's list shows raises that folder's version in the same operation.
    category: constraint
    applies_to: Folder
    trigger: An item of the folder is added, renamed, deleted or restored, or an item's "changed by" changes (by later Units, the migration, or the loading of sample content)
    logic: IF the change completes THEN the folder whose list changed has its version raised by one, together with the change or not at all. A change deeper down raises only the version of the folder it happens in. Filling a sample file's contents (BR2.10) changes nothing the list shows and raises no version.
    violation: A change that cannot raise the version does not happen.
    source: contract C9 (guarantees), contract C3

  - id: BR2.10
    statement: Prepared sample content exists in the test environment only, and loading it twice makes nothing twice.
    category: policy
    applies_to: Folder, File
    trigger: A deployment to an environment
    logic: IF the environment is test THEN for each sample entry, look for the item with that entry's sourceKey. IF there is none THEN create it. IF there is one THEN leave its name, place and marks alone; the single thing the loader may add to an existing sample file is a contentId where it has none, which U4's version of the loader does. IF the environment is production THEN nothing is loaded, and "All" is empty until the migration.
    violation: Loading samples is refused in production.
    source: answer Q4

  - id: BR2.11
    statement: Changes to one folder's list happen one at a time.
    category: constraint
    applies_to: Folder
    trigger: Any operation that adds, renames, deletes or restores an item of a folder (the sample loader in U3; U6, U7 and U8 later)
    logic: Each such operation is one step that holds the folder for itself from start to finish. Inside the step, in this order, it checks the name (BR2.5, BR2.6) or works out the lowest free name (BR2.7), takes the next position (BR2.2), writes the item, and raises the version (BR2.9). A second operation on the same folder waits for the first. So two uploads finishing together never get the same position, and an operation that asked for the lowest free name always gets one that is still free. Operations on different folders do not wait for each other. Reading a folder (BR1.1 to BR1.9) never waits.
    violation: IF the step cannot complete THEN nothing is changed. The store's own refusal of a duplicate name is reported as nameAlreadyUsed; any other refusal by the store is a fault, reported as serverError, never as a name problem.
    source: contract C9 (failure, guarantees), contract C12

  - id: BR2.12
    statement: A name can be checked only for a folder that is visible.
    category: validation
    applies_to: Folder
    trigger: checkName or lowestFreeName names a folder
    logic: IF the folder does not exist, is deleted, or is inside a deleted folder THEN answer notFound, before the name is looked at.
    violation: notFound, for the caller to turn into its own answer.
    source: contract C9 (visibility)

  - id: BR3.1
    statement: Opening the site shows "All"; opening a folder's address shows that folder; neither asks for sign-in.
    category: constraint
    applies_to: the page
    trigger: The page opens, or its address changes
    logic: IF the address names no folder THEN show "All". IF it names a folder THEN show that folder. The address changes when a folder is opened, so reload, back and forward, and a shared address all lead to the same folder. "All" has one address, the one that names no folder; the page never writes the top folder's own identifier into the address, and if it is opened with that identifier it replaces the address with the plain one.
    violation: IF the folder is not found THEN the not-found view of BR3.8.
    source: FR1.1, FR1.3

  - id: BR3.2
    statement: Each row shows an icon for its kind, chosen from the content type, with a text alternative.
    category: calculation
    applies_to: the page (FileList)
    trigger: A row is shown
    logic: A folder shows the folder icon. A file shows the icon for its content type from the table in functional-spec.md ("Icons"); video types show the video icon; an unknown or missing type shows the default icon. Every icon has a text alternative naming the kind.
    violation: None.
    source: FR1.2, FR1.5, NFR6

  - id: BR3.3
    statement: A file's size is shown in bytes, kB, MB or GB; a folder shows no size; an empty file shows "0 B".
    category: calculation
    applies_to: the page (FileList)
    trigger: A row is shown
    logic: IF folder THEN nothing. IF 0 THEN "0 B". IF under 1024 THEN the number and "bytes". IF under 1024 x 1024 THEN kB; under 1024 x 1024 x 1024 THEN MB; otherwise GB; each with two decimal places, as today.
    violation: None.
    source: FR1.2

  - id: BR3.4
    statement: Names are always shown as plain text.
    category: constraint
    applies_to: the page
    trigger: A name is shown anywhere (row, breadcrumb, page title, announcement)
    logic: Put the name into the page as text, never as markup, whatever characters it contains.
    violation: None; no path builds markup from a name.
    source: FR1.6, NFR3

  - id: BR3.5
    statement: While a folder's contents are being fetched for the first time, placeholder rows are shown.
    category: constraint
    applies_to: the page (FileList)
    trigger: A folder is opened
    logic: IF the folder has just been opened and no answer has arrived THEN show three placeholder rows, with the breadcrumb showing what is known of the path. A later refresh of a folder already on screen shows no placeholders.
    violation: None.
    source: FR1.7

  - id: BR3.6
    statement: A folder with no visible items says "This folder is empty."
    category: constraint
    applies_to: the page (FileList)
    trigger: An answer with no items arrives
    logic: Show the text in place of the rows.
    violation: None.
    source: FR1.7

  - id: BR3.7
    statement: When the contents cannot be fetched, the page says "The list could not be loaded.", offers to try again, and the breadcrumb still works.
    category: constraint
    applies_to: the page (FileList, Breadcrumb)
    trigger: The request fails or does not answer within 10 seconds, after two further tries
    logic: Show the text and a "Try again" control that repeats the request. Keep the breadcrumb usable with the steps already known. Never show an earlier list of another folder as if it were this one.
    violation: None.
    source: FR1.7, contract C1 (timeouts and retries)

  - id: BR3.8
    statement: A folder that is not found has its own view, and a way back to "All".
    category: constraint
    applies_to: the page
    trigger: The server answers notFound for the folder asked for
    logic: Show "This folder does not exist or was deleted." and a link to "All". Do not retry.
    violation: None.
    source: FR1.8

  - id: BR3.9
    statement: The breadcrumb shows the path from "All"; every step but the last opens its folder.
    category: constraint
    applies_to: the page (Breadcrumb)
    trigger: A folder's answer arrives
    logic: Show the steps of the path in order. The last is the open folder, as text marked as the current page. Choosing an earlier step opens that folder. Below 768 pixels show "All", "..." and the last two steps, with "..." revealing the rest.
    violation: None.
    source: FR1.3, NFR7

  - id: BR3.10
    statement: Opening a row opens a folder in place; opening a file does nothing yet.
    category: policy
    applies_to: the page (FileList)
    trigger: Double-click, Enter, or a tap on a name
    logic: IF the row is a folder THEN open it (BR3.1). IF it is a file THEN select it and say, in the status line, that opening files is not available yet. U4 replaces the second half.
    violation: None.
    source: the Unit's boundaries (read only; nothing downloaded yet)

  - id: BR4.1
    statement: Choosing a row selects it and deselects the others.
    category: constraint
    applies_to: Selection
    trigger: Click on a row with no key held
    logic: The selection becomes that row alone, and it becomes the anchor. By keyboard the same result is reached with Escape and then Space on the row (BR4.6).
    violation: None.
    source: FR2.1

  - id: BR4.2
    statement: Choosing a row with Ctrl held, or Command on macOS, adds it to the selection or removes it.
    category: constraint
    applies_to: Selection
    trigger: Ctrl-click or Command-click; Space on the focused row (BR4.6); a tap on a row's tick box
    logic: IF the row is selected THEN remove it. OTHERWISE add it. The row becomes the anchor either way. Both keys work with a click on every system.
    violation: None.
    source: FR2.2

  - id: BR4.3
    statement: Choosing a row with Shift held selects every row between it and the anchor, however many.
    category: calculation
    applies_to: Selection
    trigger: Shift-click; Shift with arrow up or down; Shift-Space on the focused row
    logic: The selection becomes every row from the anchor to the chosen row, both included, by their place in the list compared as numbers. The anchor does not move. IF there is no anchor THEN the anchor becomes the row that had the keyboard focus before this input, or the first row if no row had it. The same rule gives Ctrl-A its anchor.
    violation: None.
    source: FR2.3

  - id: BR4.4
    statement: The actions offered always match the selection.
    category: constraint
    applies_to: the page (ActionBar)
    trigger: The selection changes
    logic: IF nothing is selected THEN Upload and New Folder. IF exactly one file THEN also Download, Rename and Delete. IF one folder, or several items of any kind, THEN also Download and Delete, and not Rename.
    violation: None; an action that would not fit is not shown.
    source: FR2.4

  - id: BR4.5
    statement: A selected row is marked by a check mark as well as by colour, and says so to assistive technology.
    category: constraint
    applies_to: the page (FileList)
    trigger: A row is selected or deselected
    logic: Show the check mark at the start of the row and the highlight colour; expose the row's selected state; announce the count ("3 items selected.") in a polite status line.
    violation: None.
    source: FR2.5, NFR6, answer Q3 (change 1)

  - id: BR4.6
    statement: Every selection possible with a mouse is possible with the keyboard alone.
    category: constraint
    applies_to: the page (FileList)
    trigger: Keyboard input while the list has focus
    logic: The list is one Tab stop. Arrow up and down move the focus between rows without changing the selection. Space adds the focused row to the selection or removes it (BR4.2). Shift with the arrows, or Shift-Space, selects the range from the anchor (BR4.3). Ctrl-A or Command-A selects all rows. Escape clears the selection. Enter opens the focused row. The Delete key chooses the Delete action when something is selected. The focused row has a visible ring. No selection needs a key combination that an operating system keeps for itself; in particular Ctrl-Space and Command-Space, which macOS takes before the browser sees them, are not relied on. Any set of rows is reached by moving and pressing Space; exactly one row by Escape, then Space.
    violation: None.
    source: FR2.6, NFR6, answer Q3 (change 3). Departs from the interaction specification, which gave Space the meaning "select this row only" and Ctrl-Space the toggle; see functional-spec.md, "Departures".

  - id: BR4.7
    statement: Every selection possible with a mouse is possible by touch.
    category: constraint
    applies_to: the page (FileList)
    trigger: Touch input
    logic: On a touch device each row starts with a tick box of at least 44 by 44 pixels; tapping it toggles the row (BR4.2), so any set of rows can be built one by one, and a range is made by ticking its rows. A tap on a folder's name opens it. A tap on a file's name selects it alone (BR4.1); a second tap on the name of a file that is the only selected row opens it, which in U3 only says so (BR3.10). A tap elsewhere on a row acts as a click (BR4.1). Whenever anything is selected, the status line that says "3 items selected." carries a "Clear" control that empties the selection, for touch and for everyone else.
    violation: None.
    source: FR2.6, NFR7

  - id: BR4.8
    statement: A fresh answer for the open folder never changes the selection, the focus or the scroll position, except for rows that are gone.
    category: constraint
    applies_to: Selection
    trigger: A new answer for the folder already on screen replaces the rows
    logic: Selection, anchor and focus are held by item identifier, not by place. Rows still present stay selected. A selected row that is gone leaves the selection. IF the anchor is gone THEN there is no anchor. IF the focused row is gone THEN focus moves to the row now at its place, or the last row.
    violation: None.
    source: FR2.5, the interaction specification (updates from other people)

  - id: BR4.9
    statement: A selection belongs to one folder.
    category: constraint
    applies_to: Selection
    trigger: Another folder is opened, by a row, the breadcrumb, or the browser's back and forward
    logic: Start with an empty selection and no anchor; focus goes to the list.
    violation: None.
    source: FR2.1

  - id: BR4.10
    statement: In U3 the actions are shown but do nothing except say so.
    category: policy
    applies_to: the page (ActionBar)
    trigger: Any action is chosen
    logic: Show "This is not available yet." in the status line. Send nothing to the server, change nothing, and ask for no sign-in. Each later Unit replaces this for its own actions.
    violation: None.
    source: the Unit's boundaries
```

## Summary

| ID | Rule | Kind |
|----|------|------|
| BR1.1 | Anyone may read a folder | authorization |
| BR1.2 | "root" means the top folder | constraint |
| BR1.3 | Only visible items are listed | constraint |
| BR1.4 | Deleted, inside deleted, and unknown all answer "not found" | constraint |
| BR1.5 | Rows in order of position | constraint |
| BR1.6 | The answer carries the path from "All" | calculation |
| BR1.7 | What a row carries, and nothing else | constraint |
| BR1.8 | Version, and "unchanged" for a caller that holds it | constraint |
| BR1.9 | The whole list at once; 500 items within 2 seconds | constraint |
| BR1.10 | The folder identifier is checked before use | validation |
| BR1.11 | A file is visible only if nothing above it is deleted | constraint |
| BR2.1 | Generated identifiers, never reused | constraint |
| BR2.2 | Position given once, never changed | constraint |
| BR2.3 | Exactly one top folder, "All" | constraint |
| BR2.4 | Names are normalised: one composed form, white space trimmed | validation |
| BR2.5 | Valid names: 1 to 255 characters, something visible, no "/", control or invisible characters, not "." or ".." | validation |
| BR2.6 | Names unique per folder, ignoring case, across folders and files | validation |
| BR2.7 | Lowest free numbered name | calculation |
| BR2.8 | A file may lack contents until U4 | policy |
| BR2.9 | A change to a folder's list raises its version with it | constraint |
| BR2.10 | Sample content in the test environment only, loaded once | policy |
| BR2.11 | Changes to one folder's list happen one at a time | constraint |
| BR2.12 | A name is checked only for a visible folder | validation |
| BR3.1 | The address decides the folder; no sign-in | constraint |
| BR3.2 | Icon by kind and content type | calculation |
| BR3.3 | Size formatting | calculation |
| BR3.4 | Names as plain text | constraint |
| BR3.5 | Placeholder rows while loading | constraint |
| BR3.6 | "This folder is empty." | constraint |
| BR3.7 | "The list could not be loaded." with "Try again" | constraint |
| BR3.8 | A not-found view with a way back | constraint |
| BR3.9 | Breadcrumb | constraint |
| BR3.10 | Opening a folder works; opening a file waits for U4 | policy |
| BR4.1 | Choose one row | constraint |
| BR4.2 | Add or remove a row | constraint |
| BR4.3 | Select a range | calculation |
| BR4.4 | Actions match the selection | constraint |
| BR4.5 | Selection shown by more than colour | constraint |
| BR4.6 | Everything by keyboard | constraint |
| BR4.7 | Everything by touch | constraint |
| BR4.8 | A fresh answer keeps the selection | constraint |
| BR4.9 | A selection belongs to one folder | constraint |
| BR4.10 | Actions say "not available yet" | policy |

# Business Overview: Virtuoso Drive

Source: code at commit `533329e`. Statements marked **(inference)** were reasoned from the code and not observed running.

## Purpose

Virtuoso Drive is a shared file drive on the web for the electrical engineering students of one university. It holds homework resolutions, past exams and study material so students can find and download them (`README.md`; `app/public/index.html` lines 7-8). It is live at https://virtuoso-drive.web.app/ on Google's Firebase platform. The application code dates from June 2019 (eight commits, `1778414` to `de24f7c`) and has not changed since.

## Business Domain

| Concept | Meaning in the product | Where it lives |
|---|---|---|
| Drive | One shared tree of folders and files for everybody. There is a single drive, rooted at `All` | `VirtuosoController.js` line 5 |
| Folder | A named container inside another folder. The placeholder markup suggests folders by academic period ("1º Período") | `app/public/index.html` line 33 |
| File | An uploaded document with a name, a content type and a size | `VirtuosoController.js` lines 363-368 |
| Visitor | Anyone who opens the page. There are no accounts, roles or owners | No authentication code exists |

There is no notion of user, permission, ownership, history, version, quota, search or sharing link.

## Key Functionality

Everything happens on one screen: a logo, a breadcrumb, a toolbar and a table with icon, name and size.

| # | Capability | What the visitor does and sees | Limits that are part of today's behaviour |
|---|---|---|---|
| 1 | Browse | Opens the page on the folder `All`. Double-clicks a folder to enter it; clicks a breadcrumb entry to go back up. Rows appear in the order they were created, with an icon chosen from the content type and a size in bytes, kB, MB or GB | No sorting, search or paging. Folders are not listed before files |
| 2 | Live refresh | The open folder's list redraws by itself when anyone changes that folder or anything below it | Redraw clears the selection |
| 3 | Select | Click selects one row. Ctrl-click adds or removes a row. Shift-click selects a range. The toolbar shows Download, Rename and Delete for one selected row, and Download and Delete for several | Command-click on macOS is not handled |
| 4 | Upload | Chooses one or several files. A progress bar and a time estimate appear. Each file is stored in the open folder under its own name | A name already used in the folder is refused with an alert. No size or type limit |
| 5 | Download | Downloads every selected file under its displayed name. Double-clicking a file opens it in a new tab | Folders cannot be downloaded; an alert says so |
| 6 | Rename | Renames one selected file through a prompt. The extension is kept | Folders cannot be renamed; an alert says so. Only the displayed name changes |
| 7 | Delete | Deletes the selected files and folders after one confirmation. Deletion is permanent | No recycle bin, no undo |
| 8 | Create folder | Asks for a name through a prompt and creates the folder in the open folder | No check on the name |

The exact mechanics of each capability are in `architecture.md` (Interaction Diagrams) and `api-documentation.md`. Several of these capabilities do not behave as intended; the defects are listed once, with evidence, in `code-quality-assessment.md`.

## Users and Access

- One kind of user: an anonymous visitor. Reading, uploading, renaming and deleting are all open to anyone on the internet (`app/database.rules.json` lines 3-4, `app/storage.rules` lines 3-5).
- The interface text is English. The placeholder folder name and the author's context are Portuguese **(inference: the audience is Brazilian)**.

## Business Rules Found in the Code

| Rule | Evidence |
|---|---|
| A file name may not be uploaded twice into the same folder | `VirtuosoController.js` lines 534-547 (intended; see DEF-01 and DEF-04 for how it fails) |
| A rename keeps the file's extension | lines 419-424 |
| Rename applies to exactly one item; download and delete apply to one or more | lines 389-408 |
| Deletion needs one confirmation and is permanent | lines 441-443 |
| Deleting a folder deletes everything inside it | lines 245-300 |
| Folders cannot be renamed or downloaded | lines 430-435, 502-506 |

No other rule exists: no name rules, no size or type limits, no uniqueness of folder names, no ownership.

## What the Repository Does Not Tell

- What content is live today, how much, and in what state. Only code was read.
- Who the contributors are in practice, and how many people use the site.
- Whether the bundled logo, icons and font are licensed for reuse.

# Code Quality Assessment: Virtuoso Drive

Source: code at commit `533329e`. This file owns the lists of security weaknesses (`SEC-`), functional defects (`DEF-`) and structural debt (`TD-`); other files refer to them by id. Line numbers refer to `app/public/js/VirtuosoController.js` unless another file is named.

How to read the evidence: every finding was derived by reading the code. Nothing was run, and the live site and its data were not inspected. A finding marked **(inference)** also depends on platform behaviour that the code does not show (for example the database's rules for key names); those should be confirmed before they are relied on.

## Summary

| Area | Rating | Basis |
|---|---|---|
| Test presence | Poor | No tests, no test framework, no coverage configuration |
| Linting and formatting | Poor | No configuration of any tool |
| Continuous integration and delivery | Poor | No pipeline; deployment by hand |
| Documentation | Poor | Five-line `README.md`; no set-up, run or deploy notes; no code comments |
| Naming clarity | Fair | Descriptive method names; two misspellings (`donwloadFile` line 514, `porcent` line 594) |
| Function size | Poor | `startEvents` is 163 lines (349-512); `getFileIconView` 79; `startEventsTr` 81 |
| Error handling | Poor | Failures go to the console or are dropped; several promises can never settle |
| Duplication | Fair | Repeated resolve blocks in delete; the page duplicated as `views/index.ejs` |
| Dead code | Poor | The whole Express scaffold, one unused dependency, one unused icon |
| Security | Poor | No access control at all; stored script injection |

## Test Coverage

- Test directories: none. Test frameworks: none. Coverage configuration: none. `app/package.json` has no `test` script.
- Coverage is 0%. No behaviour is protected by a test, so the only behavioural reference for a rewrite is the code itself and the diagrams in `architecture.md`.
- Testability: the one class reads the DOM in its constructor, uses the global `firebase` object and native dialogs, and keeps state in the DOM. None of it can be exercised in isolation as written.

## Linting, Formatting and Static Checks

None configured: no ESLint, Prettier, EditorConfig, type checker or pre-commit hook. `app/.gitignore` lists `.eslintcache` only as part of a generic template.

## CI/CD

None: no `.github/` folder or other pipeline definition. The history shows eight application commits between 2019-06-02 and 2019-06-13, the last two being a manual deployment and a README change. One environment; no rollback procedure other than redeploying an earlier commit by hand **(inference)**.

## Documentation Quality

- `README.md`: name, two-sentence description, live address.
- No description of the data model, the Firebase project set-up, the rules, or how to deploy.
- In code: one comment, `// to do` (line 432). The scaffold files carry the generator's comments.

## Security Weaknesses

| Id | Finding | Evidence | Severity |
|---|---|---|---|
| SEC-01 | The database allows public read and write at the root. Anyone can read, change or erase all metadata, including nodes outside `All` | `app/database.rules.json` lines 3-4 | Critical |
| SEC-02 | Storage allows public read and write on every path. Anyone can download, overwrite, delete or add any file of any size | `app/storage.rules` lines 3-5 | Critical |
| SEC-03 | Stored cross-site scripting. Names read from the database are assigned to `innerHTML`: the row name (line 141), the active breadcrumb entry (line 713) and the breadcrumb link (line 718), where the name is also placed unescaped inside the `data-path` attribute. With SEC-01, anyone can plant a name that runs script in every visitor's browser | lines 141, 713, 718, 726 | Critical |
| SEC-04 | No authentication or authorisation exists. No authentication SDK is loaded | `app/public/index.html` lines 84-86 | Critical |
| SEC-05 | The Firebase project configuration is hard-coded in the client source. These values are public identifiers by design, but with SEC-01 and SEC-02 they are all that is needed for full access from any script | lines 232-240 | Medium |
| SEC-06 | No validation of file names, folder names, sizes or content types, in the client or in the rules; no upload limit | lines 357-385, 466-482; both rule files | High |
| SEC-07 | The three Firebase scripts are loaded from a CDN without integrity attributes; no content security policy or other security headers are configured | `app/public/index.html` lines 84-86; `app/firebase.json` | Medium |
| SEC-08 | Download URLs are obtained and used directly in the browser; such URLs are long-lived and usable by anyone who has one **(inference: platform behaviour)** | lines 162, 491 | Low while everything is public anyway |
| SEC-09 | Scaffold error page prints the stack trace when the environment is `development` | `app/app.js` line 34; `app/views/error.ejs` line 3 | Low (not deployed) |

## Functional Defects

### Upload

| Id | Finding | Evidence |
|---|---|---|
| DEF-01 | A duplicate upload overwrites the stored file while telling the user it failed. The duplicate check is an asynchronous read that the code does not wait for; `put` starts on the same object key regardless. The record keeps the old size and type | lines 534-547 (check), 549-551 (upload) |
| DEF-02 | One rejected file fails the whole selection. `Promise.all` rejects, so no record is written for any file, but the other uploads still finish in storage and become objects with no record | lines 359-379, 585 |
| DEF-03 | The file record is written to whichever folder is open when the upload finishes, not the folder the file was uploaded to. The same applies to removing a record at the end of a delete | line 363, line 451 (`getFirebaseRef()` with no argument) |
| DEF-04 | The duplicate check compares storage paths, not displayed names. After a rename the original name remains blocked for new uploads, and a new file may take the same displayed name as the renamed one | lines 538, 426 |
| DEF-05 | The progress bar and time estimate follow whichever file reported last; the start time is overwritten by each file of the selection | lines 553-560, 589-600 |

### Delete

| Id | Finding | Evidence |
|---|---|---|
| DEF-06 | Deleting an empty folder never completes. The folder task resolves only from inside the loop over children; with none, the promise never settles, the folder's record stays, and so do the records of everything else selected with it. Commit `5384298` names this issue; the code still has it | lines 253-292, 315-323, 445-454 |
| DEF-07 | Deleting a folder does not wait for its content. The task resolves when the first child finishes, and the folder's database node is removed immediately while storage deletions are still in flight. Any deletion that fails or is skipped leaves stored files with no record. Whether sub-folders are read before their parent node is removed depends on the order in which the SDK raises events **(inference; not run)** | lines 251-296 |
| DEF-08 | Inside a folder delete, stored objects are addressed by the record's displayed name instead of its stored path. A renamed file is not found: the object stays in storage and the folder task rejects | line 276 (compare line 327, which uses the path) |
| DEF-09 | A failed storage delete hangs the delete silently. The per-row promises have no rejection path, so one failure (for example a record whose object is already gone) means no record of the selection is removed, nothing is shown, and that record can never be deleted from the interface | lines 311-341 |

### Folders and names

| Id | Finding | Evidence |
|---|---|---|
| DEF-10 | Folder names are used as database path segments without any check. The database does not accept `.`, `#`, `$`, `[`, `]` or `/` in a key, so a folder named, for example, `2019.1` can be created (the name is only a value at that point) but opening it throws, and `currentFolder` keeps the bad name until the page is reloaded. A `/` in a name silently addresses a deeper path **(inference from the platform's key rules; not run)** | lines 157-158, 472-476, 639-641, 734 |
| DEF-11 | Two folders with the same name in one parent share one content node. Both rows open the same content; deleting one erases the content of both | lines 466-482 (no uniqueness check), 249, 294 |
| DEF-12 | A sub-folder named `type` or `path` makes its parent's content node look like a record to the list, the duplicate check and the delete **(inference)** | lines 258, 538, 685 |
| DEF-13 | Renaming a file that has no extension appends the whole old name: `lastIndexOf('.')` returns -1, the prompt default is empty and the "extension" is the entire name | lines 419-420 |
| DEF-14 | Rename changes the displayed name only; the stored object keeps its original name, and the extension cannot be changed. Known limit rather than a fault, but it is the cause of DEF-04 and DEF-08 | line 426 |
| DEF-15 | Folder names are not trimmed or checked for emptiness beyond "not an empty string"; a name of spaces is accepted | lines 468-470 |

### Selection, display and feedback

| Id | Finding | Evidence |
|---|---|---|
| DEF-16 | Shift-click range selection sorts the two row indexes as text (`sort()` without a comparator). When the text order differs from the numeric order, for example rows 9 and 10 or rows 2 and 10, nothing is selected | line 196 |
| DEF-17 | A live redraw discards the selection without raising `selectionchange`. The toolbar keeps offering Rename, Download and Delete; Rename then fails on an undefined row. This happens after every operation, including the visitor's own | lines 678, 414-415 |
| DEF-18 | Video content types show the audio icon; `images/icons/video.svg` exists and is never referenced | lines 68-74 |
| DEF-19 | The download error handler reports every failure as "You can't download a folder yet"; the XHR itself has no error handling, and the temporary object URL is never released | lines 493-506, 514-521 |
| DEF-20 | Records and child content nodes are siblings in one node, distinguished only by `type`. The folder listener therefore receives the entire subtree below the open folder; at `All` that is every record in the database, sent again on any change anywhere | lines 676-691 |
| DEF-21 | Multi-select tests `ctrlKey` only; Command-click on macOS replaces the selection | line 214 |
| DEF-22 | Failures are reported to the console only (open, upload, delete); database writes are not checked at all | lines 166-170, 374-379, 456-460; 363, 426, 451, 472 |
| DEF-23 | Minor: `audio/mp3` is not the type browsers usually report for MP3 files, so they get the default icon **(inference)**; `application/octet-stream` appears twice in one `switch`; toolbar links are `href="#"` and the handlers do not cancel the default action; a zero-byte file shows no size | lines 63, 106-108, 123; `app/public/index.html` lines 42-52 |

### Likely state of the live data

Not observed; derived from the defects above. A migration should be prepared to find: stored objects with no record (DEF-02, DEF-07, DEF-08), records whose object is missing or was replaced by different content (DEF-01, DEF-09), records in a folder other than the one their `path` names (DEF-03), folder records with no content node (empty folders) or undeletable ones (DEF-06), several folder records sharing one content node (DEF-11), records whose `name` differs from the last segment of `path` (DEF-14), names containing markup (SEC-03), and arbitrary content written by third parties (SEC-01, SEC-02).

## Technical Debt

| Id | Finding | Evidence |
|---|---|---|
| TD-01 | `app/node_modules/` is committed: 345 tracked files, although `app/.gitignore` line 47 ignores the folder | Git index |
| TD-02 | The Express scaffold is dead code: generator output with placeholder routes, not referenced by the hosting configuration. `views/index.ejs` is a byte-identical copy of `public/index.html`, and its route is shadowed by the static middleware | `app/app.js`, `app/bin/www`, `app/routes/`, `app/views/`; `app/firebase.json` line 6 |
| TD-03 | `formidable` is declared and never required | `app/package.json` line 13 |
| TD-04 | Dependencies date from 2018 and 2019; lockfile version 1; no Node.js version declared | `app/package.json`, `app/package-lock.json` line 4 |
| TD-05 | No tests, linter, type checking, pipeline or infrastructure definition | whole repository |
| TD-06 | One 741-line class combines view, state, navigation, data access and file transfer; state is kept in the DOM | `VirtuosoController.js` |
| TD-07 | All third-party browser code is fetched from four public CDN hosts at run time; jQuery, Popper and Bootstrap JS are loaded and not used | `app/public/index.html` lines 84-96 |
| TD-08 | A Helvetica font file, the logo and the icon set are bundled with no licence or origin recorded | `app/public/fonts/`, `app/public/images/` |
| TD-09 | Deployment tooling and the bucket's cross-origin configuration are not captured in the repository **(inference)** | no `firebase-tools` dependency; no CORS file |
| TD-10 | Leftovers: placeholder breadcrumb in the markup, replaced on load; `// to do` for folder rename; misspelt identifiers | `app/public/index.html` lines 31-34; lines 432, 514, 594 |
| TD-11 | Accessibility: icons without alternative text, rows and toolbar not reachable or operable by keyboard, text selection disabled page-wide **(inference from markup and styles)** | `app/public/index.html` lines 42-52; lines 46-116; `app/public/css/style.css` lines 3-6 |

## What Is Sound

- The behaviour is small and fully readable in one file; every user-visible rule can be traced to a line.
- The page shell and styles are simple and independent of the logic.
- Bootstrap, jQuery and Popper are loaded with integrity attributes.
- The repository holds the rules and hosting configuration that were deployed from it, so the intended platform set-up is reproducible.

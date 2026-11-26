# Developer Code Scan: virtuosodrive.com

Scan breadth: full repository (`./`). Commit: `533329e6026fec24eb198b2ec24f43ee153bed36`. The scan only read files; no test, build or program of the project was run. Statements marked **(inference)** were reasoned from the code or from documented platform behaviour and were not observed running.

## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - `README.md`
  - `app/package.json`
  - `app/firebase.json`
  - `app/.firebaserc`
  - `app/database.rules.json`
  - `app/storage.rules`
  - `app/.gitignore`
  - `app/app.js`
  - `app/bin/www`
  - `app/routes/index.js`
  - `app/routes/users.js`
  - `app/views/error.ejs`
  - `app/views/index.ejs` (byte-identical to `app/public/index.html`, confirmed with a diff)
  - `app/public/index.html`
  - `app/public/js/VirtuosoController.js` (all 741 lines)
  - `app/public/js/index.js`
  - `app/public/css/style.css`
  - `app/public/css/reset.css`
- **Skimmed only**:
  - `app/package-lock.json` (lockfile version and resolved package versions only)
  - `app/public/images/` (file names listed; the logo, favicon and 16 SVG icons were not opened)
  - `app/public/fonts/` (one file, `Helvetica.ttf`, name and size only)
  - `vision.md` (project planning document, read as background, not code)
- **Left out**:
  - `app/node_modules/` (dependency folder; committed to Git with 345 tracked files although `app/.gitignore` line 47 ignores it; contents not read)
  - `.git/`
  - AI-DLC's own install and workspace: `.claude/`, `aidlc/`, `aidlc.settings.json`, `aidlc.settings.local.json`, `.mcp.json` (every server in it is AI-DLC's), and the root `.gitignore` (the whole file is AI-DLC's marked section)

### Packages Found
- `app` (npm package `app` 0.0.0, private) — web application — JavaScript — the only package. It holds two unrelated things:
  - `app/public/` — static single-page client — browser JavaScript (ES2015 class, no modules, no build step), HTML, CSS — the product: a shared file drive that talks to Firebase directly from the browser.
  - `app/app.js`, `app/bin/www`, `app/routes/`, `app/views/` — Express generator scaffold — Node.js CommonJS, EJS — not deployed; Firebase Hosting serves only `app/public` (`app/firebase.json` line 6).
- Repository root — no package manifest. `README.md` (5 lines) and `vision.md`.

File classification:

| File | Category | Lines |
|---|---|---|
| `app/public/js/VirtuosoController.js` | Controller, service and data access in one class | 741 |
| `app/public/js/index.js` | Configuration (bootstrap, one statement) | 1 |
| `app/public/index.html` | Static/Asset (page shell) | 101 |
| `app/public/css/style.css`, `reset.css` | Static/Asset | 86, 48 |
| `app/public/images/`, `app/public/fonts/` | Static/Asset | n/a |
| `app/firebase.json`, `.firebaserc`, `database.rules.json`, `storage.rules` | Configuration (hosting and security rules) | 22, 5, 6, 7 |
| `app/app.js` | Configuration and middleware (scaffold) | 41 |
| `app/bin/www` | Configuration (scaffold server start) | 90 |
| `app/routes/index.js`, `users.js` | Controller/Handler (scaffold) | 8, 9 |
| `app/views/index.ejs`, `error.ejs` | Static/Asset (templates, scaffold) | 101, 3 |

There are no model, repository, migration or test files.

### Build System
- **Type**: none for the client (plain files served as they are). npm for the scaffold; the only script is `start` = `node ./bin/www` (`app/package.json` line 6). No `test`, `lint` or `build` script, no `engines` field.
- **Config Files**: `app/package.json`, `app/package-lock.json` (lockfileVersion 1), `app/firebase.json`, `app/.firebaserc`, `app/database.rules.json`, `app/storage.rules`.
- **Build Dependencies**:
  - `app/public/index.html` → `css/reset.css`, `css/style.css`, `js/VirtuosoController.js`, `js/index.js`, `images/` and seven CDN resources (see Frameworks & Libraries).
  - `app/public/js/index.js` → global class `VirtuosoController`.
  - `app/public/js/VirtuosoController.js` → global `firebase` (loaded by script tags), DOM element ids from `index.html`.
  - `app/public/css/style.css` → `fonts/Helvetica.ttf`.
  - `app/bin/www` → `app/app.js` → `app/routes/index.js`, `app/routes/users.js`, `app/views/`, `app/public/` (static).
  - Deployment: `app/firebase.json` → `database.rules.json`, `storage.rules`, `public/`. `firebase-tools` is not declared anywhere; deployment is by a globally installed CLI **(inference)**.

### APIs Discovered

The project exposes no API of its own in production. Its API surface is the set of calls the browser makes to Firebase, plus the unused scaffold routes.

**Firebase Realtime Database — called from `app/public/js/VirtuosoController.js` — 8 call sites**

All references go through `getFirebaseRef(path)` (lines 637-643), which returns `firebase.database().ref(path)` and defaults `path` to `currentFolder.join('/')`. `currentFolder` starts as `['All']` (line 5), so every path starts with `All`.

| # | Operation | Path | Payload or result | Lines |
|---|---|---|---|---|
| 1 | `on('value')` live listener | current folder path, e.g. `All/<folder>/<folder>` | Whole subtree of the folder. Every child whose value has a truthy `type` is rendered, in key order | 676-691 |
| 2 | `off('value')` | previously open folder path | Detaches the listener when another folder is opened | 647 |
| 3 | `once('value')` | current folder path | Duplicate check before upload: compares each child's `path` with `<folder path>/<file name>` | 531-547 |
| 4 | `push().set()` file record | current folder path at the time the upload finishes | `{name, type, path, size}` from the storage metadata (`name`, `contentType`, `fullPath`, `size`) | 363-368 |
| 5 | `push().set()` folder record | current folder path | `{name, type: 'folder', path: <parent folder path>}` | 472-476 |
| 6 | `child(key).set(file)` | `<current folder path>/<key>` | Whole file record with only `name` changed (rename) | 426 |
| 7 | `child(key).remove()` | `<current folder path>/<key>` | Removes a file or folder record after its content was removed | 451 |
| 8 | `on('value')`, `remove()`, `off('value')` | `<parent path>/<folder name>` | Reads a folder's subtree to delete its content, then removes the subtree | 249-295 |

Data model as written by the code:
- Root node `All`. A folder's content lives at the path made of the folder display names: `All/<name>/<name>/...`.
- At each folder path, entries are stored under generated push keys. File entry: `{name: string, type: <content type>, path: <storage full path>, size: number}`. Folder entry: `{name: string, type: 'folder', path: <parent folder path>}`.
- A folder's children are stored under a sibling key equal to the folder's display name. That node has no `type` of its own, which is how the list skips it (line 685). An empty folder therefore has a record in its parent and no node of its own **(inference: Realtime Database does not store empty nodes)**.
- There are no ids other than push keys, no timestamps, no owner, no checksum.

**Cloud Storage for Firebase — called from `app/public/js/VirtuosoController.js` — 6 call sites**

| # | Operation | Path | Lines |
|---|---|---|---|
| 1 | `ref(<folder path>).child(<file name>).put(file)` with `state_changed` progress | `All/<folders>/<original file name>` | 549-567 |
| 2 | `getMetadata()` after upload | same object | 569-577 |
| 3 | `ref(file.path).getDownloadURL()` then `window.open(url)` (double-click) | stored `path` | 162-170 |
| 4 | `ref(file.path).getDownloadURL()` then XHR GET as blob, saved under the display name | stored `path` | 488-506 |
| 5 | `ref(<current folder path>).child(<last segment of file.path>).delete()` (file delete) | derived from current folder | 32-38, 327-329 |
| 6 | `ref(<folder path>).child(<record display name>).delete()` (inside folder delete) | derived from display name | 276 |

Storage layout: bucket `virtuoso-drive.appspot.com` (line 237); object key = folder path + `/` + the file's original name at upload. Rename never changes the object key.

**Security rules**
- `app/database.rules.json` lines 3-4: `.read: true`, `.write: true` at the root.
- `app/storage.rules` lines 3-5: `allow read, write` on every path.
- No Firebase Authentication SDK is loaded (`app/public/index.html` lines 84-86 load app, database and storage only).

**Firebase Hosting — `app/firebase.json`**
- Serves `app/public`; ignores `firebase.json`, dotfiles and `node_modules`; rewrites every path to `/index.html` (lines 5-18). No headers, redirects or functions.
- Project alias `default` = `virtuoso-drive` (`app/.firebaserc` line 3).

**Express scaffold (not deployed) — `app/app.js`, `app/routes/` — 2 routes**
- `GET /` → renders `views/index.ejs` with `{title: 'Express'}` (`routes/index.js` lines 4-6). Shadowed in practice: `express.static` on `public/` is mounted first (`app.js` line 20) and `public/index.html` answers `/` **(inference from middleware order)**.
- `GET /users` → sends the text `respond with a resource` (`routes/users.js` lines 5-7).
- Any other path → 404 through `http-errors`, rendered by `views/error.ejs`; the stack is shown when `env` is `development` (`app.js` lines 26-39).
- Middleware chain: morgan `dev`, `express.json`, `express.urlencoded`, cookie-parser, static. Port from `PORT`, default 3000 (`bin/www` line 15). No authentication, no rate limiting.

### Frameworks & Libraries

Loaded by the browser from public CDNs (`app/public/index.html`):
- Firebase JS SDK — 6.1.0 — `firebase-app`, `firebase-database`, `firebase-storage`; no integrity attribute (lines 84-86)
- Bootstrap CSS — 4.3.1 — layout and table styling; with integrity (lines 12-13)
- Bootstrap JS — 4.3.1 — loaded with integrity (lines 94-96); no Bootstrap JavaScript component is used by the page **(inference: no `data-toggle` markup and no jQuery call in the controller)**
- jQuery slim — 3.3.1 — Bootstrap JS prerequisite only (lines 88-90)
- Popper.js — 1.14.7 — Bootstrap JS prerequisite only (lines 91-93)
- Eric Meyer CSS reset — 2.0 — vendored as `app/public/css/reset.css`

npm, scaffold only (`app/package.json` range → `app/package-lock.json` resolved):
- express — `~4.16.1` → 4.16.4 — HTTP server
- ejs — `~2.6.1` → 2.6.1 — view engine
- morgan — `~1.9.1` → 1.9.1 — request logging
- cookie-parser — `~1.4.4` → 1.4.4 — cookie parsing
- http-errors — `~1.6.3` → 1.6.3 — 404 creation
- debug — `~2.6.9` → 2.6.9 — start-up log line
- formidable — `^1.2.1` → 1.2.1 — not required by any source file

No devDependencies. No Node.js version is pinned.

### Test Coverage
- **Test Directories**: none
- **Test Frameworks**: none
- **Coverage Config**: absent (`app/.gitignore` mentions `coverage` and `.nyc_output` only as generic template lines)

### Code Quality Indicators
- **Linting**: none (no ESLint, Prettier or EditorConfig file)
- **CI/CD**: none (no `.github/`, no pipeline file). Deployment is manual; the last application commit is `7b55d6d` "deploying it to firebase" (2019-06-13)
- **Documentation**: `README.md` is a five-line description with the live address; no set-up, run or deploy instructions. The controller has no doc comments; method names are descriptive. The scaffold carries the generator's comments.
- **Quick assessment**: naming clarity fair (two misspellings: `donwloadFile` line 514, `porcent` line 594); function size poor (`startEvents` is 163 lines, lines 349-512); error handling poor; test presence poor; duplication fair; dead code poor (whole scaffold, unused icon, unused dependency).

### Technical Debt Signals

All line numbers refer to `app/public/js/VirtuosoController.js` unless another file is named.

Security:
- Public read and write on the whole database (`app/database.rules.json` lines 3-4) and on all stored files (`app/storage.rules` lines 3-5). Anyone can read, overwrite or delete everything, including nodes outside `All`.
- No sign-in at all; no authentication SDK is loaded (`app/public/index.html` lines 84-86).
- Stored cross-site scripting: file and folder names from the database are written with `innerHTML` (line 141 row name; line 713 active breadcrumb; line 718 breadcrumb link, where the name also lands inside the `data-path` attribute unescaped).
- Firebase web configuration hard-coded (lines 232-240). These are public identifiers by design, but with the open rules they are all an attacker needs.
- No validation of names, sizes or content types anywhere, and no upload limit (lines 357-385, 466-482).
- Firebase SDK scripts are loaded from a CDN without integrity attributes; no content security policy or other response headers in `app/firebase.json`.

Functional defects:
- Duplicate upload overwrites the stored file. The duplicate check (`once('value')`, lines 534-547) is asynchronous and is not awaited; `put` starts regardless (lines 549-551) on the same object key. The user sees "Upload failed" while the old content is replaced.
- One rejected file fails the whole batch: `Promise.all` (line 585) rejects, so no database record is written for any file of that selection (lines 359-379), while their uploads still complete in storage and become orphan objects.
- The file record is written to the folder that is open when the upload finishes, not the one it was uploaded to (line 363 calls `getFirebaseRef()` with no path). Navigating during an upload files the record in the wrong folder.
- The duplicate check compares the storage path, not the displayed name (line 538). After a rename (line 426 leaves `path` unchanged) the original name stays blocked and the new displayed name is not protected, so two rows can show the same name.
- Deleting an empty folder never completes: `removeFolderTask` resolves only from inside the loop over children (lines 253-292); with no children the promise never settles, so the folder record is never removed (line 451 is not reached) and every other item in the same delete selection is left with its record too. Commit `5384298` already names this issue.
- Deleting a folder with content does not wait for its content: the promise resolves after the first child finishes (lines 262, 278), and the database subtree is removed immediately (line 294) while storage deletions are still running. A failed or skipped storage delete leaves orphan objects. Whether nested sub-folders are read before the parent subtree is removed depends on SDK event timing **(inference; not run)**.
- Inside a folder delete, the storage object is addressed by the record's displayed name (line 276), not by its stored path. A renamed file inside a deleted folder is not found, the delete rejects, and the object stays.
- Rejections are not handled in `removeTask` (lines 315-337 have `then` without `catch` and never call `reject`): one failed storage delete, for example a record whose object is already gone, hangs the whole delete silently and that record can never be removed from the interface.
- Folder names become database path segments (lines 157, 249, 472-476, 641). Realtime Database keys cannot contain `.`, `#`, `$`, `[`, `]` or `/`; a folder named, for example, `2019.1` can be created but cannot be opened, and the failed open leaves `currentFolder` pointing at it until the page is reloaded **(inference from the platform's key rules; not run)**.
- Two folders with the same name in one parent share one content node; deleting one removes the content of both (no uniqueness check at lines 466-482).
- Shift-click range selection sorts the two row indexes as text (line 196, `sort()` with no comparator), so a range such as rows 9 to 10 selects nothing.
- The live re-render (line 678) discards the selection without raising `selectionchange`, so the toolbar keeps showing Rename, Download and Delete; Rename then throws on an undefined row (lines 414-415).
- Renaming a file without an extension appends the whole old name as the "extension" (lines 419-420, `lastIndexOf` returns -1).
- Rename changes the displayed name only; the storage object keeps its original name (line 426). The extension cannot be changed.
- Video files show the audio icon (line 74); `app/public/images/icons/video.svg` is never referenced.
- The download error handler reports every failure as "You can't download a folder yet" (lines 502-506); the XHR has no error handler (lines 493-500).
- The folder listener receives the whole subtree below the open folder; at `All` that is every record in the database, re-sent to the page on any change anywhere (line 676).
- Multi-select uses `ctrlKey` only (line 214); Command-click on macOS does not extend the selection.
- Upload progress shows whichever file reported last, and `startUploadTime` is overwritten per file (lines 553-560, 589-600).
- A sub-folder named `type` or `path` makes its parent's content node look like a record (lines 258, 538, 685) **(inference)**.
- Failures are written to the console only; the user gets no message (lines 166-170, 374-379, 456-460).
- Minor: `audio/mp3` is not the content type browsers report for MP3 (line 63) **(inference)**; `application/octet-stream` is listed twice (lines 106, 108); toolbar links are `href="#"` with no `preventDefault` (`app/public/index.html` lines 42-52); `// to do` marker for folder rename (line 432).

Structural debt:
- `app/node_modules/` is committed (345 tracked files) although ignored.
- The Express scaffold is dead code; `app/views/index.ejs` is a byte-identical copy of `app/public/index.html`.
- `formidable` is declared and never used.
- Dependencies date from 2018 and 2019; lockfile version 1; no Node.js version pinned.
- One 741-line class mixes rendering, selection state, data access and storage transfer; nothing is separable for testing.
- All third-party browser code comes from public CDNs at run time.
- `app/public/fonts/Helvetica.ttf` (318 kB) is a bundled commercial typeface; its licence is not recorded in the repository.
- No tests, no linter, no pipeline, no infrastructure definition beyond `firebase.json` and the two rules files.
- `app/public/index.html` lines 31-34 hold a placeholder breadcrumb that is replaced on load.

## Handoff Summary
- **Intent-relevant finding**: The whole product is one browser class, `app/public/js/VirtuosoController.js`, calling Firebase Realtime Database and Cloud Storage directly under rules that allow public read and write (`app/database.rules.json` lines 3-4, `app/storage.rules` lines 3-5). The stored model is a tree keyed by folder display names under the root `All`, with file records `{name, type, path, size}` and folder records `{name, type: 'folder', path}` under push keys (lines 363-368, 472-476); the stored `path` is the storage object key and is the only reliable link between a record and its file, because rename changes `name` only (line 426).
- **Risks / follow-up**:
  - The live data was not inspected. Because of the defects above, the migration should expect orphan storage objects with no record, records whose object is missing, records filed in the wrong folder, duplicate folder names sharing one content node, folder records with no content node, names containing HTML, and records whose `name` differs from the last segment of `path`.
  - Display name and storage name diverge after a rename; a migration must carry both and decide which one becomes the file name.
  - Folder identity today is the display name within the parent; the new model needs generated ids and a uniqueness rule, and the migration needs a rule for duplicates.
  - Live refresh is implemented by a database listener on the open folder (line 676); it is the only behaviour with no direct equivalent in a request-and-response API.
  - Download through XHR needs cross-origin access to be configured on the bucket; that configuration is not in the repository **(inference)**.
  - The content type stored in `type` comes from the storage metadata and drives the icon; whether it can be absent for files the browser could not type was not verified.
  - The Express scaffold has no production role and nothing in it needs to be preserved.

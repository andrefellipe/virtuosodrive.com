# Code Structure: Virtuoso Drive

Source: code at commit `533329e`. Statements marked **(inference)** were not observed running.

## Repository Layout

```
virtuosodrive.com/
├── README.md                     five-line description and live address
├── vision.md                     planning document for the AWS migration (not code)
└── app/                          the only package (npm name "app", version 0.0.0)
    ├── package.json              scaffold dependencies, one script: start
    ├── package-lock.json         lockfile version 1
    ├── .gitignore                Node and Firebase template
    ├── firebase.json             hosting, database rules and storage rules wiring
    ├── .firebaserc               project alias: default = virtuoso-drive
    ├── database.rules.json       Realtime Database rules
    ├── storage.rules             Cloud Storage rules
    ├── public/                   THE PRODUCT: what Firebase Hosting serves
    │   ├── index.html            page shell
    │   ├── css/reset.css         vendored CSS reset
    │   ├── css/style.css         application styles
    │   ├── js/VirtuosoController.js   all application logic
    │   ├── js/index.js           creates the controller
    │   ├── images/af.png         logo
    │   ├── images/icons/         favicon and 16 SVG icons
    │   └── fonts/Helvetica.ttf   bundled typeface
    ├── app.js                    Express scaffold: application set-up   (not deployed)
    ├── bin/www                   Express scaffold: HTTP server start    (not deployed)
    ├── routes/index.js           Express scaffold: GET /                (not deployed)
    ├── routes/users.js           Express scaffold: GET /users           (not deployed)
    ├── views/index.ejs           copy of public/index.html              (not deployed)
    ├── views/error.ejs           error page template                    (not deployed)
    └── node_modules/             committed dependency folder (see TD-01)
```

AI-DLC's own files (`.claude/`, `aidlc/`, `aidlc.settings*.json`, `.mcp.json`, the root `.gitignore`) are not part of the project's code and are not described here.

## File Classification

| File | Category | Lines | Role |
|---|---|---|---|
| `app/public/js/VirtuosoController.js` | Controller, service and data access combined | 741 | Everything the product does |
| `app/public/js/index.js` | Configuration (bootstrap) | 1 | `window.app = new VirtuosoController()` |
| `app/public/index.html` | Static/Asset | 101 | Markup, element ids, script and style loading |
| `app/public/css/style.css` | Static/Asset | 86 | Toolbar, progress bar, selection colour, font face |
| `app/public/css/reset.css` | Static/Asset (vendored) | 48 | Eric Meyer reset 2.0 |
| `app/public/images/`, `app/public/fonts/` | Static/Asset | n/a | Logo, favicon, icons, typeface |
| `app/firebase.json`, `app/.firebaserc` | Configuration | 22, 5 | Hosting and project selection |
| `app/database.rules.json`, `app/storage.rules` | Configuration (security rules) | 6, 7 | Access rules for both stores |
| `app/app.js` | Configuration and middleware (scaffold) | 41 | Express set-up |
| `app/bin/www` | Configuration (scaffold) | 90 | Server start |
| `app/routes/index.js`, `app/routes/users.js` | Controller/Handler (scaffold) | 8, 9 | Two generated routes |
| `app/views/index.ejs`, `app/views/error.ejs` | Static/Asset (scaffold) | 101, 3 | Templates |

There are no model, repository, service, utility, migration or test files.

## The Controller Class

`VirtuosoController` is a single ES2015 class in the global scope, with no imports and no exports. It depends on the global `firebase` object and on element ids in `index.html`.

### State

| Field | Set at | Meaning |
|---|---|---|
| `currentFolder` | line 5; changed at 157, 734 | Array of folder names from the root, starting `['All']`. Joined with `/` it is both the database path and the storage prefix |
| `lastFolder` | line 674 | Path whose listener is attached, so it can be detached |
| `startUploadTime` | line 553 | Start of the most recently started upload, for the time estimate |
| `onSelectionChange` | line 6 | One reusable `Event('selectionchange')` |
| `navEl`, `listFilesEl`, `inputFilesEl`, `trg*El`, `uploadProgressBarEl`, `progressBarFgEl`, `timeleftEl` | lines 8-18 | DOM elements looked up once |

The selection is not a field: it is the rows carrying the class `selected` (lines 26-30). Each row stores its record as JSON in `data-file` and its database key in `data-key` (lines 139-140).

### Methods

| Method | Lines | Responsibility | Kind |
|---|---|---|---|
| `constructor` | 3-24 | Look up elements, connect, wire events, open the root folder | Set-up |
| `connectFirebase` | 231-243 | `firebase.initializeApp` with the hard-coded project configuration | Configuration |
| `getFirebaseRef(path)` | 637-643 | Database reference for a path, default the current folder | Data access |
| `openFolder` | 645-653 | Detach old listener, clear selection, read, draw breadcrumb | Navigation |
| `readFiles` | 672-693 | Attach the live listener and redraw the table on each event | Data access and view |
| `renderNav` | 695-740 | Build the breadcrumb and its click handlers | View and navigation |
| `getFileView(file, key)` | 136-146 | Build one table row | View |
| `getFileIconView(file)` | 40-119 | Map a content type to an icon cell | View |
| `formatSize(size)` | 121-134 | Bytes to `bytes`, `kB`, `MB`, `GB` with two decimals; empty for no size | Utility |
| `startEventsTr(tr)` | 148-229 | Row double-click (open folder or file) and click (selection) | Interaction |
| `getSelection` | 26-30 | Selected rows | State |
| `clearSelection` | 655-670 | Deselect all and raise `selectionchange` | State |
| `startEvents` | 349-512 | Toolbar handlers: upload, selection change, rename, delete, new folder, download | Interaction and use cases |
| `uploadTask(files)` | 523-587 | Duplicate check, storage upload, metadata read, per file | Use case |
| `uploadProgress(event)` | 589-600 | Progress bar width and time-left text | View |
| `formatTimeToHuman(ms)` | 602-622 | "x minutes and y seconds left" | Utility |
| `showProgress(show)` | 624-628 | Show or hide the progress bar | View |
| `uploadComplete` | 630-635 | Hide the bar and clear the file input | View |
| `removeTask` | 302-347 | Delete storage content for every selected row | Use case |
| `removeFolderTask(ref, name)` | 245-300 | Recursive delete of a folder's content | Use case |
| `removeFile(ref, name)` | 32-38 | Delete one stored object | Data access |
| `donwloadFile(blob, fileName)` | 514-521 | Save a blob through a temporary link (name misspelt in the source) | Utility |

### DOM Contract

The controller requires these ids and classes in `app/public/index.html`: `#nav-breadcrumb` (line 29), `#upload-trigger` (42), `#files` (44, a hidden multiple file input), `#new-folder-trigger` (45), `#download-trigger` (47), `#rename-trigger` (49), `#delete-trigger` (51), `#upload-progress` with `.progress-fg` and `.timeleft` (56-61), and `#table-files tbody` (63-73). `style.css` hides Download, Rename and Delete and the progress bar by default (lines 22-25, 43-45) and colours `.selected` rows (lines 67-69).

## Code Patterns

| Pattern | Where | Note |
|---|---|---|
| Single controller object, created once on load | `js/index.js` | No modules, no dependency injection |
| DOM as state store | lines 139-140, 26-30 | Records round-trip through `JSON.stringify` and `JSON.parse` on row attributes |
| Custom DOM event to synchronise the toolbar | lines 6, 206, 226, 387-410, 478, 667 | `selectionchange` raised on the table body |
| Observer on remote data | lines 676-691 | The list is only ever drawn from a database event |
| Promise fan-out with `Promise.all` | lines 345, 585 | Used for upload and delete batches; failure handling is incomplete (DEF-02, DEF-09) |
| Recursion over the folder tree | lines 245-300 | Delete only |
| Template strings assigned to `innerHTML` | lines 141, 598, 713, 718, 726 | Source of SEC-03 |
| Native dialogs | lines 419, 433, 441, 468, 504, 540 | `prompt`, `alert`, `confirm` |
| Path building by joining names with `/` | lines 249, 315, 329, 475, 531-532, 549, 639, 674, 718, 734 | Same string serves as database path, storage prefix and breadcrumb address |

Conventions: four-space indentation, `let` and arrow functions in the client, `var` and callbacks in the scaffold, camelCase names, DOM element fields suffixed `El`, no comments other than one `// to do` (line 432).

## The Express Scaffold

Generated by the Express application generator (commit `9fdb381`) and left as generated, apart from `routes/index.js` rendering a copy of the product page. It is not referenced by `firebase.json` and plays no part in production. Its structure and routes are in `api-documentation.md`; its dependencies are in `dependencies.md`.

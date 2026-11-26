# Component Inventory: Virtuoso Drive

Source: code at commit `533329e`. Nine components: five in the repository's deployed client and configuration, three external Firebase services, and one undeployed scaffold. Method-level detail is in `code-structure.md`; call-level detail is in `api-documentation.md`; defect ids are defined in `code-quality-assessment.md`.

## Summary

| Component | Kind | Location | Deployed | Lines of code |
|---|---|---|---|---|
| Web Client Shell | Page markup and styles | `app/public/index.html`, `app/public/css/` | Yes | 235 |
| Bootstrap Script | Entry point | `app/public/js/index.js` | Yes | 1 |
| VirtuosoController | Application logic | `app/public/js/VirtuosoController.js` | Yes | 741 |
| Static Assets | Images and font | `app/public/images/`, `app/public/fonts/` | Yes | n/a |
| Firebase Configuration and Rules | Deployment and security configuration | `app/firebase.json`, `app/.firebaserc`, `app/database.rules.json`, `app/storage.rules` | Yes | 40 |
| Firebase Hosting | External service | Firebase project `virtuoso-drive` | n/a | n/a |
| Firebase Realtime Database | External service | Firebase project `virtuoso-drive` | n/a | n/a |
| Cloud Storage for Firebase | External service | Bucket `virtuoso-drive.appspot.com` | n/a | n/a |
| Express Scaffold | Unused server | `app/app.js`, `app/bin/www`, `app/routes/`, `app/views/`, `app/package.json` | No | 252 |

## Components

### Web Client Shell

- **Files**: `app/public/index.html` (101 lines), `app/public/css/style.css` (86), `app/public/css/reset.css` (48, vendored).
- **Responsibility**: The single screen: logo, breadcrumb container, toolbar with five actions, hidden file input, upload progress bar, file table, footer. Loads all third-party and application scripts in order.
- **Provides**: the element ids and classes the controller looks up (listed under DOM Contract in `code-structure.md`); default visibility of the toolbar buttons and progress bar; the selection colour; the `Helvetica` font face; text selection disabled on the whole page (`style.css` lines 3-6).
- **Depends on**: Static Assets; public CDNs for the Firebase SDK, Bootstrap, jQuery and Popper (`dependencies.md`); Bootstrap Script; VirtuosoController.
- **Notes**: interface language English; `lang="en"`; icons have no alternative text; rows and toolbar are not operable from the keyboard **(inference from the markup)**.

### Bootstrap Script

- **Files**: `app/public/js/index.js`.
- **Responsibility**: Creates the one controller instance and exposes it as `window.app`.
- **Depends on**: VirtuosoController being defined by the script tag before it (`index.html` lines 97-98).

### VirtuosoController

- **Files**: `app/public/js/VirtuosoController.js`.
- **Responsibility**: All behaviour of the product: connect to Firebase, navigate folders, draw the table and breadcrumb, manage selection and toolbar, upload with progress, download, open, rename, delete (recursive for folders), create folder.
- **Provides**: no interface to other code; it is driven by DOM events.
- **Depends on**: global `firebase` (Firebase JS SDK 6.1.0: app, database, storage); the DOM contract of Web Client Shell; Firebase Realtime Database; Cloud Storage for Firebase; browser features `prompt`, `alert`, `confirm`, `XMLHttpRequest`, `URL.createObjectURL`, `window.open`.
- **State held**: `currentFolder`, `lastFolder`, `startUploadTime`; selection kept in the DOM.
- **Notes**: holds the hard-coded Firebase project configuration (lines 232-240). Carries most of the defects in `code-quality-assessment.md`.

### Static Assets

- **Files**: `app/public/images/af.png` (logo), `app/public/images/icons/favicon.ico`, sixteen SVG icons in `app/public/images/icons/`, `app/public/fonts/Helvetica.ttf` (318 kB).
- **Responsibility**: Visual identity and file-type icons.
- **Icon use**: toolbar uses `upload`, `folder-plus`, `download`, `rename`, `trash`; the table uses `folder`, `txt`, `image`, `pdf`, `audio`, `word`, `excel`, `powerpoint`, `zip`, `default`. `video.svg` is present and never referenced (DEF-18).
- **Depends on**: nothing.
- **Notes**: the image and font files were listed, not opened. Licences are not recorded in the repository (TD-08).

### Firebase Configuration and Rules

- **Files**: `app/firebase.json`, `app/.firebaserc`, `app/database.rules.json`, `app/storage.rules`.
- **Responsibility**: Tell the Firebase command-line tool what to deploy: the public folder with a rewrite of every path to `/index.html`, the database rules and the storage rules.
- **Depends on**: the Firebase command-line tool, which is not declared in the repository **(inference: installed globally by the developer)**.
- **Notes**: both rule files allow public read and write (SEC-01, SEC-02). Full content is in `api-documentation.md`.

### Firebase Hosting

- **Kind**: external managed service.
- **Responsibility**: Serves the contents of `app/public` over HTTPS at https://virtuoso-drive.web.app/.
- **Used by**: visitors' browsers.
- **Configured by**: Firebase Configuration and Rules.

### Firebase Realtime Database

- **Kind**: external managed service, `https://virtuoso-drive.firebaseio.com`.
- **Responsibility**: System of record for the folder tree and file metadata; source of the live list updates.
- **Used by**: VirtuosoController, through nine operations (DB-1 to DB-9 in `api-documentation.md`).
- **Notes**: holds one tree rooted at `All`. Its content was not inspected.

### Cloud Storage for Firebase

- **Kind**: external managed service, bucket `virtuoso-drive.appspot.com`.
- **Responsibility**: Holds file contents, one object per uploaded file, keyed by folder path and original file name.
- **Used by**: VirtuosoController, through six operations (ST-1 to ST-6 in `api-documentation.md`); visitors' browsers fetch bytes through download URLs.
- **Notes**: its content was not inspected. Cross-origin configuration is not in the repository.

### Express Scaffold

- **Files**: `app/app.js` (41 lines), `app/bin/www` (90), `app/routes/index.js` (8), `app/routes/users.js` (9), `app/views/index.ejs` (101, byte-identical to `public/index.html`), `app/views/error.ejs` (3), with `app/package.json` and `app/package-lock.json` declaring its dependencies.
- **Responsibility**: None in production. Locally, `npm start` serves `app/public` on port 3000, which gives a way to open the page without Firebase Hosting **(inference: likely its only use)**.
- **Depends on**: express, ejs, morgan, cookie-parser, http-errors, debug (`dependencies.md`); the committed `app/node_modules/`.
- **Notes**: generator output with two placeholder routes; dead code (TD-02). `formidable` is declared and unused (TD-03).

## Component Dependencies

| From | To | Nature |
|---|---|---|
| Web Client Shell | Static Assets | `img`, `link` and `@font-face` references |
| Web Client Shell | Bootstrap Script, VirtuosoController | script tags, in that load order: controller first, then bootstrap |
| Bootstrap Script | VirtuosoController | constructs it |
| VirtuosoController | Web Client Shell | element ids and classes |
| VirtuosoController | Firebase Realtime Database | SDK calls over a persistent connection |
| VirtuosoController | Cloud Storage for Firebase | SDK calls and XHR over HTTPS |
| Firebase Hosting | Web Client Shell, Bootstrap Script, VirtuosoController, Static Assets | serves them |
| Firebase Configuration and Rules | Firebase Hosting, Firebase Realtime Database, Cloud Storage for Firebase | configures them at deploy time |
| Express Scaffold | Web Client Shell and the rest of `app/public` | serves the folder statically (local only) |

There are no circular dependencies between files. The controller and the page shell depend on each other by convention (ids), not by import.

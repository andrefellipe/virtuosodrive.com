# Technology Stack: Virtuoso Drive

Source: code at commit `533329e`. Versions are the ones written in the repository; nothing was installed or run. The full dependency lists, including transitive packages, are in `dependencies.md`.

## Languages

| Language | Dialect | Where | Notes |
|---|---|---|---|
| JavaScript (browser) | ES2015+: `class`, arrow functions, `let`, template strings, spread, default parameters, `Promise` | `app/public/js/` | Loaded by plain script tags. No modules, no transpiler, no bundler, no type checking |
| JavaScript (Node.js) | CommonJS, `var`, callbacks | `app/app.js`, `app/bin/www`, `app/routes/` | Scaffold only. No Node.js version declared |
| HTML5 | | `app/public/index.html` | |
| CSS3 | | `app/public/css/` | |
| EJS | 2.6.1 | `app/views/` | Scaffold only |
| JSON and Firebase rules language | | `app/firebase.json`, `app/database.rules.json`, `app/storage.rules` | |

## Client Runtime

| Technology | Version | Delivered by | Used for |
|---|---|---|---|
| Firebase JS SDK: `firebase-app` | 6.1.0 | `www.gstatic.com` script tag | Project initialisation |
| Firebase JS SDK: `firebase-database` | 6.1.0 | `www.gstatic.com` script tag | Folder tree, metadata, live updates |
| Firebase JS SDK: `firebase-storage` | 6.1.0 | `www.gstatic.com` script tag | Upload, download URL, metadata, delete |
| Bootstrap (CSS) | 4.3.1 | `stackpath.bootstrapcdn.com` | Grid, breadcrumb, table, utility classes |
| Bootstrap (JS) | 4.3.1 | `stackpath.bootstrapcdn.com` | Loaded; no component of it is used **(inference)** |
| jQuery slim | 3.3.1 | `code.jquery.com` | Loaded for Bootstrap JS only; not called by the application |
| Popper.js | 1.14.7 | `cdnjs.cloudflare.com` | Loaded for Bootstrap JS only |
| Eric Meyer CSS reset | 2.0 | vendored file | Style reset |

Browser features the client relies on: ES2015 classes, `Promise`, `XMLHttpRequest` with blob responses, `URL.createObjectURL`, the `download` attribute, `dataset`, `NodeList.forEach`, `prompt`, `confirm`, `alert`.

## Server-side (scaffold, not deployed)

| Technology | Declared | Locked | Purpose |
|---|---|---|---|
| Express | `~4.16.1` | 4.16.4 | HTTP framework |
| EJS | `~2.6.1` | 2.6.1 | View engine |
| morgan | `~1.9.1` | 1.9.1 | Request log |
| cookie-parser | `~1.4.4` | 1.4.4 | Cookies |
| http-errors | `~1.6.3` | 1.6.3 | 404 creation |
| debug | `~2.6.9` | 2.6.9 | Start-up log |
| formidable | `^1.2.1` | 1.2.1 | Unused |

## Platform and Infrastructure

| Concern | Technology | Evidence |
|---|---|---|
| Static hosting | Firebase Hosting, project `virtuoso-drive` | `app/firebase.json` lines 5-18, `app/.firebaserc` |
| Metadata store | Firebase Realtime Database | `VirtuosoController.js` line 235 |
| File store | Cloud Storage for Firebase, bucket `virtuoso-drive.appspot.com` | line 237 |
| Authentication | None | No authentication SDK loaded; open rules |
| Infrastructure definition | `firebase.json` and two rules files only | |
| Environments | One (production). No staging or local emulator configuration | |
| Deployment | By hand with the Firebase command-line tool **(inference; the tool is not declared in the repository)** | Commit `7b55d6d` |

## Build, Test and Delivery Tooling

| Concern | Technology |
|---|---|
| Package manager | npm, `package-lock.json` lockfile version 1 |
| Build | None |
| Tests | None |
| Lint and format | None |
| Type checking | None |
| Continuous integration and delivery | None |
| Monitoring and logging | None in the application (`console.error` only) |

## Age of the Stack

Every version above dates from 2018 or the first half of 2019. Firebase JS SDK 6.x is the older namespaced API; Bootstrap 4, jQuery 3.3, Popper 1 and Express 4.16 have all been superseded by later major or minor lines. Lockfile version 1 is the format of npm 5 and 6. Current support status of each was not looked up as part of this scan.

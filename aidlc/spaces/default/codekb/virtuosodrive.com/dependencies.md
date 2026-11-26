# Dependencies: Virtuoso Drive

Source: code at commit `533329e`. Nothing was installed or run; versions are read from `app/public/index.html`, `app/package.json` and `app/package-lock.json`. Vulnerability databases were not consulted.

## External Dependencies

### Run-time services (production)

| Service | Identifier | Used by | Coupling |
|---|---|---|---|
| Firebase Hosting | https://virtuoso-drive.web.app/ | Visitors | Serves the static files; rewrite of every path to `/index.html` |
| Firebase Realtime Database | `https://virtuoso-drive.firebaseio.com` | `VirtuosoController.js` | Nine operations; the data model is shaped by its path and key rules; live updates depend on its listeners |
| Cloud Storage for Firebase | `virtuoso-drive.appspot.com` | `VirtuosoController.js`, visitors' browsers | Six operations; download URLs; cross-origin configuration held outside the repository **(inference)** |

### Browser libraries loaded from public CDNs (production)

From `app/public/index.html`:

| Library | Version | Host | Integrity attribute | Line | Used by application code |
|---|---|---|---|---|---|
| Bootstrap CSS | 4.3.1 | stackpath.bootstrapcdn.com | Yes | 12-13 | Yes (classes in the markup and in `renderNav`) |
| firebase-app | 6.1.0 | www.gstatic.com | No | 84 | Yes |
| firebase-database | 6.1.0 | www.gstatic.com | No | 85 | Yes |
| firebase-storage | 6.1.0 | www.gstatic.com | No | 86 | Yes |
| jQuery slim | 3.3.1 | code.jquery.com | Yes | 88-90 | No |
| Popper.js | 1.14.7 | cdnjs.cloudflare.com | Yes | 91-93 | No |
| Bootstrap JS | 4.3.1 | stackpath.bootstrapcdn.com | Yes | 94-96 | No **(inference)** |

The page cannot work if `www.gstatic.com` is unreachable. It has four third-party hosts in its trust boundary.

### Vendored in the repository

| Item | File | Origin |
|---|---|---|
| CSS reset 2.0 | `app/public/css/reset.css` | meyerweb.com, public domain per its header |
| Helvetica typeface | `app/public/fonts/Helvetica.ttf` | Unknown; licence not recorded (TD-08) |
| Logo, favicon, SVG icons | `app/public/images/` | Unknown; licence not recorded |

### npm packages (Express scaffold only, not deployed)

Direct dependencies, `app/package.json` lines 8-16:

| Package | Range | Locked | Required by |
|---|---|---|---|
| express | `~4.16.1` | 4.16.4 | `app.js`, `routes/index.js`, `routes/users.js` |
| ejs | `~2.6.1` | 2.6.1 | view engine setting in `app.js` line 14 |
| morgan | `~1.9.1` | 1.9.1 | `app.js` line 5 |
| cookie-parser | `~1.4.4` | 1.4.4 | `app.js` line 4 |
| http-errors | `~1.6.3` | 1.6.3 | `app.js` line 1 |
| debug | `~2.6.9` | 2.6.9 | `bin/www` line 8 |
| formidable | `^1.2.1` | 1.2.1 | nothing (TD-03) |

No devDependencies, peerDependencies or optionalDependencies.

Transitive packages locked in `app/package-lock.json` (lockfile version 1; 54 top-level entries, the 7 above and these 47): accepts 1.3.7, array-flatten 1.1.1, basic-auth 2.0.1, body-parser 1.18.3, bytes 3.0.0, content-disposition 0.5.2, content-type 1.0.4, cookie 0.3.1, cookie-signature 1.0.6, depd 1.1.2, destroy 1.0.4, ee-first 1.1.1, encodeurl 1.0.2, escape-html 1.0.3, etag 1.8.1, finalhandler 1.1.1, forwarded 0.1.2, fresh 0.5.2, iconv-lite 0.4.23, inherits 2.0.3, ipaddr.js 1.9.0, media-typer 0.3.0, merge-descriptors 1.0.1, methods 1.1.2, mime 1.4.1, mime-db 1.40.0, mime-types 2.1.24, ms 2.0.0, negotiator 0.6.2, on-finished 2.3.0, on-headers 1.0.2, parseurl 1.3.3, path-to-regexp 0.1.7, proxy-addr 2.0.5, qs 6.5.2, range-parser 1.2.1, raw-body 2.3.3, safe-buffer 5.1.2, safer-buffer 2.1.2, send 0.16.2, serve-static 1.13.2, setprototypeof 1.1.0, statuses 1.4.0, type-is 1.6.18, unpipe 1.0.0, utils-merge 1.0.1, vary 1.1.2.

`app/node_modules/` is committed with 345 tracked files (TD-01). Its contents were not read; whether they match the lockfile was not verified.

### Developer tools assumed but not declared

| Tool | Why it is needed | Evidence |
|---|---|---|
| Firebase command-line tool | Deploys hosting and rules | `app/firebase.json`, `app/.firebaserc`; no package declares it |
| Node.js and npm | Only to run the scaffold | `app/package.json`; no version declared |

## Internal Dependencies

File-level adjacency (`file -> depends on`):

```
app/public/index.html            -> css/reset.css, css/style.css, images/af.png, images/icons/*.svg (5 toolbar icons),
                                    images/icons/favicon.ico, js/VirtuosoController.js, js/index.js, 7 CDN resources
app/public/css/style.css         -> fonts/Helvetica.ttf
app/public/js/index.js           -> global VirtuosoController
app/public/js/VirtuosoController.js -> global firebase; element ids of index.html; images/icons/*.svg (10 file-type icons)

app/firebase.json                -> database.rules.json, storage.rules, public/
app/.firebaserc                  -> (project alias only)

app/bin/www                      -> app/app.js, debug, http
app/app.js                       -> routes/index.js, routes/users.js, views/, public/, express, ejs, morgan,
                                    cookie-parser, http-errors, path
app/routes/index.js              -> express, views/index.ejs
app/routes/users.js              -> express
app/views/error.ejs              -> locals set in app.js
```

- The client and the scaffold share nothing except that the scaffold can serve the client's folder.
- No circular imports. The controller and `index.html` are coupled in both directions by element ids and script order.
- There is one package; there are no cross-package dependencies.

## Dependencies That Shape the Data

These couplings matter to anyone moving the data elsewhere:

| Coupling | Consequence |
|---|---|
| Database paths are built from folder display names | Names are subject to the database's key rules; folder identity equals name plus position (DEF-10, DEF-11) |
| Push keys are the only record identifiers | Ordering in the list is creation order; keys are meaningful only inside their folder node |
| The record's `path` equals the storage object key | It is the join key between the two stores and the only reliable one after a rename |
| `type` holds the content type reported by storage | Icons depend on it; the special value `folder` distinguishes folders |

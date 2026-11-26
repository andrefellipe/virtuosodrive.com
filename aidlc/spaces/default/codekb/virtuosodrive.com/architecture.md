# Architecture: Virtuoso Drive

Source: code at commit `533329e`. Line numbers refer to `app/public/js/VirtuosoController.js` unless another file is named. Statements marked **(inference)** were reasoned from the code or from documented platform behaviour and not observed running. Defect ids (`DEF-`, `SEC-`, `TD-`) are defined in `code-quality-assessment.md`.

## Architecture Analysis

### System Overview

Virtuoso Drive is a static single-page application. Firebase Hosting delivers one HTML page, two stylesheets, two scripts and some images. In the browser, one class (`VirtuosoController`) draws the screen and calls two Firebase services directly: Realtime Database for the folder tree and file metadata, and Cloud Storage for file contents. There is no server-side application code in production. The repository also contains an Express scaffold that is never deployed.

### Architectural Style

Two-tier, client plus backend-as-a-service. Evidence:

- `app/firebase.json` line 6 publishes only `app/public`, with no functions and no server rewrite target other than `/index.html` (lines 12-17).
- Every data and file operation is a Firebase SDK call made from the browser (`getFirebaseRef`, lines 637-643; `firebase.storage()`, lines 34, 162, 491, 549).
- All rules, validation and consistency between metadata and file contents are the browser's responsibility. The platform enforces nothing: both rule files allow everything.

Inside the client there are no layers. One class holds the view, the selection state, the navigation state, the data access and the file transfer.

### Component Relationships

```mermaid
flowchart LR
    Visitor["Visitor browser"]
    subgraph Client["Static client, app/public"]
        Shell["Web Client Shell: index.html and CSS"]
        Boot["Bootstrap Script: js/index.js"]
        Ctrl["VirtuosoController"]
        Assets["Static Assets: images and font"]
    end
    subgraph Firebase["Firebase project virtuoso-drive"]
        Hosting["Firebase Hosting"]
        RTDB["Firebase Realtime Database"]
        GCS["Cloud Storage for Firebase"]
    end
    CDN["Public CDNs: Firebase SDK, Bootstrap, jQuery, Popper"]
    Cfg["Firebase Configuration and Rules"]
    Scaffold["Express Scaffold, not deployed"]

    Visitor -->|"GET page and assets"| Hosting
    Hosting --> Shell
    Shell --> Assets
    Shell -->|"script tags"| CDN
    Shell --> Boot
    Boot -->|"new VirtuosoController"| Ctrl
    Ctrl -->|"listen, read, push, set, remove"| RTDB
    Ctrl -->|"put, getMetadata, getDownloadURL, delete"| GCS
    Visitor -->|"GET download URL"| GCS
    Cfg -.->|"deployed by hand"| Hosting
    Cfg -.->|"open rules"| RTDB
    Cfg -.->|"open rules"| GCS
    Scaffold -.->|"would serve the same public folder"| Shell
```

<!-- Text fallback: The visitor's browser loads the page and assets from Firebase Hosting. The page shell (index.html and CSS) pulls the Firebase SDK, Bootstrap, jQuery and Popper from public CDNs, loads the static images and font, and runs the bootstrap script js/index.js, which creates one VirtuosoController. The controller talks directly to Firebase Realtime Database (listen, read, push, set, remove) and to Cloud Storage for Firebase (put, getMetadata, getDownloadURL, delete); the browser also fetches file bytes from Cloud Storage through download URLs. The Firebase configuration and rules files are deployed by hand and give Hosting its settings and both data services open rules. The Express scaffold is not deployed; it would only serve the same public folder. -->

### Data Flow

- **Metadata** lives only in Realtime Database, as a tree under `All` keyed by folder display names. The record shapes are in `api-documentation.md`.
- **File contents** live only in Cloud Storage, at `<folder path>/<original file name>`.
- **The link** between the two is the `path` field of a file record. Nothing keeps the two stores consistent except the order of calls in the browser: upload writes storage first and the record second; delete removes storage first and the record second. A failure or a closed tab between the two steps leaves an orphan object or an orphan record.
- **Client state** is three fields: `currentFolder` (array of names, line 5), `lastFolder` (path of the attached listener, line 674) and `startUploadTime` (line 553). The selection is not held in a variable; it is the set of table rows with the CSS class `selected` (lines 26-30). Each row carries its record as JSON in `data-file` and its push key in `data-key` (lines 139-140).
- **Refresh** is push-based: the list is redrawn from scratch each time the database listener fires (lines 676-691). No operation updates the table itself.

### Key Design Decisions

| Decision found in the code | Implication for a redesign |
|---|---|
| The browser calls the data stores directly, with open rules | There is no place to authenticate, authorise, validate or audit. Every such control is new work |
| Folder content is addressed by the chain of folder display names | A folder has no identity apart from its name and position. Renaming or moving a folder would mean rewriting its subtree, which is why folder rename is not implemented (lines 430-435). Names restricted by the database's key rules break navigation (DEF-10). Duplicate names collide (DEF-11) |
| Records and child-folder content share one node | Entries under push keys and content nodes under folder names are siblings, told apart only by the presence of `type` (line 685). See DEF-12 and DEF-20 |
| Storage key equals folder path plus original file name | The storage key is fixed at upload. Rename changes metadata only (line 426), so name and key drift apart. A second upload of the same name lands on the same key (DEF-01) |
| List refresh by a `value` listener on the folder node | Simple and live, but each event carries the whole subtree below the open folder (DEF-20) and each redraw discards the selection (DEF-17) |
| Multi-step operations coordinated by promises in the browser | Upload and delete are not atomic and have several broken paths (DEF-01 to DEF-09) |
| Native `prompt`, `confirm` and `alert` for all dialogs | No form validation; behaviour is trivial to describe and to re-create |
| No build step; third-party code from CDNs | Nothing to compile today; no pinning beyond the version in the URL (TD-07) |

### Improvement Opportunities

These are observations from the existing code, not design decisions for the new system.

- Put an authorising service between the browser and the stores; close both rule files.
- Give folders and files generated identifiers and store names as plain attributes, with uniqueness enforced by the data store.
- Keep the storage key independent of the displayed name, and record size, content type and a checksum with it.
- Make upload and delete safe against partial failure (order of steps, clean-up of orphans).
- Render names as text, never as markup.
- Decide deliberately what replaces the live listener (see Live refresh below).
- Separate rendering, state and data access so each can be tested.

## Interaction Diagrams

Participants used below: **Visitor**, **Controller** (`VirtuosoController` in the browser), **RTDB** (Firebase Realtime Database), **Storage** (Cloud Storage for Firebase). The diagrams show the code as written, including the paths that are defects.

### Page load and browse

```mermaid
sequenceDiagram
    actor Visitor
    participant Controller
    participant RTDB
    Visitor->>Controller: open page
    Controller->>Controller: currentFolder = All, initializeApp
    Controller->>RTDB: on value at All
    RTDB-->>Controller: snapshot of the whole subtree
    Controller->>Controller: clear table, add a row per child that has a type
    Controller->>Controller: render breadcrumb
    Visitor->>Controller: double-click folder row
    Controller->>Controller: push folder name onto currentFolder
    Controller->>RTDB: off value at previous path
    Controller->>RTDB: on value at All/folder
    RTDB-->>Controller: snapshot
    Controller->>Controller: redraw table and breadcrumb
    Visitor->>Controller: click breadcrumb entry
    Controller->>Controller: currentFolder = split of the entry path
    Controller->>RTDB: off value, then on value at the entry path
```

<!-- Text fallback: On page load the controller sets the current folder to All, initialises Firebase and attaches a value listener at All. The database answers with the whole subtree; the controller empties the table and adds one row for every child that has a type field, then draws the breadcrumb. Double-clicking a folder row appends its name to the current folder, detaches the previous listener, attaches a new one at the deeper path and redraws. Clicking a breadcrumb entry sets the current folder from that entry's path and re-attaches the listener there. Evidence: constructor lines 3-24, openFolder 645-653, readFiles 672-693, renderNav 695-740, row double-click 150-174. -->

### Live refresh

```mermaid
sequenceDiagram
    participant Other as Another visitor
    participant RTDB
    participant Controller
    Other->>RTDB: any write at or below the open folder
    RTDB-->>Controller: value event with the full folder snapshot
    Controller->>Controller: table body emptied and rebuilt
    Note over Controller: Selection is lost and the toolbar is not updated (DEF-17)
```

<!-- Text fallback: When any visitor writes at or below the folder that is open in someone's browser, the database sends that browser a value event carrying the folder's full snapshot. The controller empties and rebuilds the table. The selection is lost and the toolbar is not updated. The visitor's own uploads, renames, deletions and new folders reach the screen by this same route; no operation edits the table directly. Evidence: lines 676-691. -->

### Upload

```mermaid
sequenceDiagram
    actor Visitor
    participant Controller
    participant RTDB
    participant Storage
    Visitor->>Controller: choose files
    Controller->>Controller: show progress bar
    loop each chosen file, all started together
        Controller->>RTDB: once value at current folder, duplicate check
        Controller->>Storage: put file at folder path plus file name
        Storage-->>Controller: state_changed progress events
        Controller->>Controller: update bar width and time left
        RTDB-->>Controller: folder snapshot
        alt a child record has the same path
            Controller->>Visitor: alert Upload failed
            Note over Controller,Storage: Promise rejected but the put continues and overwrites the object (DEF-01)
        end
        Storage-->>Controller: upload complete
        Controller->>Storage: getMetadata
        Storage-->>Controller: name, contentType, fullPath, size
    end
    alt every file resolved
        loop each file
            Controller->>RTDB: push and set name, type, path, size at the folder open now
        end
        Controller->>Controller: hide progress bar
    else any file rejected
        Controller->>Controller: hide progress bar, console.error
        Note over Controller,RTDB: No record is written for any file of the batch (DEF-02)
    end
```

<!-- Text fallback: The visitor chooses files; the progress bar appears. For every file at the same time, the controller asks the database for the current folder (duplicate check) and, without waiting for the answer, starts the upload to storage at folder path plus file name. Progress events update the bar and the time estimate. If the duplicate check finds a record with the same path, the visitor gets an "Upload failed" alert and the file's promise is rejected, but the upload carries on and overwrites the stored object. When an upload completes the controller reads the object's metadata. If every file succeeded, one record per file (name, type, path, size) is pushed into the folder that is open at that moment, and the bar is hidden. If any file was rejected, the bar is hidden, the error goes to the console and no record is written for any file of the batch. Evidence: lines 351-385, 523-587, 589-635. -->

### Download and open

```mermaid
sequenceDiagram
    actor Visitor
    participant Controller
    participant Storage
    Visitor->>Controller: click Download with rows selected
    loop each selected row
        Controller->>Storage: getDownloadURL for the record path
        alt URL returned
            Storage-->>Controller: download URL
            Controller->>Storage: XHR GET, response as blob
            Storage-->>Controller: file bytes
            Controller->>Visitor: save through a temporary link, named with the displayed name
        else any error, including a folder row
            Controller->>Visitor: alert You can't download a folder yet
        end
    end
    Visitor->>Controller: double-click file row
    Controller->>Storage: getDownloadURL for the record path
    Storage-->>Controller: download URL
    Controller->>Visitor: window.open of the URL
```

<!-- Text fallback: Download: for each selected row the controller asks storage for a download URL for the record's path. On success it fetches the bytes with an XHR as a blob and saves them through a temporary link whose download name is the displayed name. On any error, including when the row is a folder (its path is not an object), it shows "You can't download a folder yet. Choose only files." Open: double-clicking a file row asks for the download URL and opens it in a new window; an error goes to the console only. Evidence: lines 484-521 and 160-170. -->

### Rename

```mermaid
sequenceDiagram
    actor Visitor
    participant Controller
    participant RTDB
    Visitor->>Controller: click Rename with one row selected
    alt the row is a file
        Controller->>Visitor: prompt Rename file, default is the name without extension
        Visitor-->>Controller: new base name
        Controller->>Controller: name = new base name plus old extension
        Controller->>RTDB: set the whole record at folder path and key, path unchanged
        Note over RTDB: The stored object keeps its original name
    else the row is a folder
        Controller->>Visitor: alert Folders can't be renamed yet
    end
```

<!-- Text fallback: With exactly one row selected, Rename on a file prompts for a new base name (default: the current name without its extension), appends the old extension and writes the whole record back to the database at the same key with only the name changed. The path field and the stored object are untouched. Nothing happens if the prompt is cancelled or empty. Rename on a folder only shows "Folders can't be renamed yet. Sorry!". Evidence: lines 412-437. -->

### Delete

```mermaid
sequenceDiagram
    actor Visitor
    participant Controller
    participant Storage
    participant RTDB
    Visitor->>Controller: click Delete
    Controller->>Visitor: confirm permanent delete
    Visitor-->>Controller: OK
    loop each selected row, all started together
        alt file
            Controller->>Storage: delete object at current folder plus last segment of path
            Storage-->>Controller: done
        else folder
            Controller->>RTDB: on value at parent path plus folder name
            RTDB-->>Controller: snapshot of the folder content
            loop each child with a type
                alt child is a folder
                    Controller->>Controller: same steps again for the child folder
                else child is a file
                    Controller->>Storage: delete object at folder path plus displayed name
                end
            end
            Controller->>RTDB: remove the folder content node, without waiting
            Controller->>RTDB: off value
            Note over Controller: Resolves when the first child finishes and never for an empty folder (DEF-06, DEF-07)
        end
    end
    alt every row resolved
        loop each row
            Controller->>RTDB: remove record at the folder open now, by key
        end
    else any row never resolves
        Note over Controller,RTDB: No record is removed (DEF-09)
    end
```

<!-- Text fallback: After one confirmation, all selected rows are processed together. For a file, the stored object at current folder plus the last segment of the record's path is deleted. For a folder, the controller reads the folder's content node; for each child record it either repeats the same steps (child folder) or deletes the stored object addressed by folder path plus the child's displayed name (child file); straight after starting those, without waiting, it removes the folder's content node from the database and detaches the listener. A folder's step counts as finished when its first child finishes, and never finishes when the folder is empty. Only when every selected row has finished does the controller remove each row's record, by key, from the folder open at that moment; if any row never finishes or fails, no record is removed. Evidence: lines 439-464, 302-347, 245-300, 32-38. -->

### Create folder

```mermaid
sequenceDiagram
    actor Visitor
    participant Controller
    participant RTDB
    Visitor->>Controller: click New Folder
    Controller->>Visitor: prompt Name
    Visitor-->>Controller: name
    alt name is not empty
        Controller->>RTDB: push and set name, type folder, path = current folder path
        RTDB-->>Controller: value event, list redrawn with the new row
    end
```

<!-- Text fallback: New Folder prompts for a name. If the answer is not empty, a record with the name, type "folder" and the current folder path is pushed into the current folder. No content node is created; it comes into being when something is first written inside the folder. The list shows the new row when the listener fires. No check is made on the name. Evidence: lines 466-482. -->

### Selection and toolbar

```mermaid
flowchart TD
    Click["Click on a row"] --> Shift{"Shift held and a row already selected"}
    Shift -->|yes| Range["Add class selected to rows between the first selected row and the clicked row"]
    Shift -->|no| Ctrl{"Ctrl held"}
    Ctrl -->|no| Clear["Remove class selected from all rows"]
    Ctrl -->|yes| Toggle["Toggle class selected on the clicked row"]
    Clear --> Toggle
    Range --> Event["Dispatch selectionchange"]
    Toggle --> Event
    Event --> Count{"Number of selected rows"}
    Count -->|"0"| None["Hide Download, Rename, Delete"]
    Count -->|"1"| One["Show Download, Rename, Delete"]
    Count -->|"2 or more"| Many["Show Download and Delete, hide Rename"]
```

<!-- Text fallback: A click with Shift held, when some row is already selected, selects every row between the first selected row and the clicked row. Otherwise, unless Ctrl is held, all rows are deselected first, and then the clicked row's selected state is toggled. Either way a selectionchange event is raised on the table body. Its handler counts the selected rows: none hides Download, Rename and Delete; one shows all three; two or more shows Download and Delete and hides Rename. Upload and New Folder are always visible. Evidence: lines 176-228 and 387-410. -->

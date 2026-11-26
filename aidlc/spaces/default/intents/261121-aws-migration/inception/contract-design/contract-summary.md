# Contract Summary: Virtuoso Drive on AWS

The agreements across every boundary in the system: what is asked, what comes
back, and what happens when it goes wrong. They follow the nine Units and
their dependencies
(`aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`
and `unit-of-work-dependency.md`), the building blocks and their entities
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`),
and the requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`).
Answers referred to as Q1 to Q3 are in `contract-design-questions.md`.

## The two kinds of boundary here

All Units are parts of one application deployed together, so there are two
kinds of boundary, and they are specified differently:

- **Between the page and the server.** A real network boundary. Specified as one OpenAPI description, split below by the Unit that owns each part. Only this site's own pages use it (Q2).
- **Between Units inside the server.** Function calls within one program and tables in one database, not network calls. Specified as shared schemas: the operations one Unit offers another, and the records they both read.

There is no boundary to any outside consumer, and none between separately
deployed services.

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---------------|----------|-----------|-------|
| C1 | U1 thin slice | Every Unit; External: the site's own pages | REST conventions, error format, health check | U1 |
| C2 | U2 accounts | External: the site's own pages | REST (OpenAPI) | U2 |
| C3 | U3 browsing | External: the site's own pages | REST (OpenAPI) | U3 |
| C4 | U4 downloading | External: the site's own pages | REST (OpenAPI), then a short-lived link to storage | U4 |
| C5 | U5 change record | External: the site's own pages | REST (OpenAPI) | U5 |
| C6 | U6 organising | External: the site's own pages | REST (OpenAPI) | U6 |
| C7 | U7 uploading | External: the site's own pages | REST (OpenAPI), then a short-lived link to storage | U7 |
| C8 | U2 accounts | U5, U6, U7 | In-process operations (shared schema) | U2 |
| C9 | U3 browsing | U4, U5, U6, U7, U8 | Shared records and in-process operations (shared schema) | U3 |
| C10 | U4 downloading | U7, U8 | Shared records and in-process operations (shared schema) | U4 |
| C11 | U5 change record | U6, U7 | In-process operation (shared schema) | U5 |
| C12 | U6 organising | U7 | In-process operation (shared schema) | U6 |
| C13 | U8 migration tool | U9 the switch | Command line (exit codes and a report file) | U8 |

Thirteen contracts cover the seventeen dependencies between Units: U2 and U3
depend on U1 through C1; every other dependency is one of C8 to C13, and
U9's dependencies on U2, U5, U6 and U7 are on the finished site, not on any
operation.

The OpenAPI blocks below are parts of one description, shown per owning Unit.
Each refers to the shared pieces defined in C1 (`Problem`, the `session`
scheme) and to `Item` defined in C3; they are joined into one file when built.

## What these contracts settle from earlier reviews

Several points left open at the design steps are decided here, because a
contract cannot be written without them. Each is a proposal that takes effect
if this document is approved.

| Open point | Settled as | Where |
|------------|------------|-------|
| The daily upload limit could be beaten by parallel uploads | The declared size is reserved when an upload starts and released if it is abandoned, skipped or expires | C7 |
| The migration import path was undefined | Import is a set of in-process operations used only by the migration tool, which runs with the operator's own access to the database and storage. It is never reachable over the network, so there is nothing to close afterwards. No account is involved, the upload limits do not apply, and no change record is written | C9, C10, C13 |
| The name rules were placed in a Unit the migration tool does not depend on | The name rules are part of C9, owned by U3 | C9 |
| Removing an account left the sign-in service's copy | Removal deletes the identity in the sign-in service, ends its sessions and voids its pending links | C2, C8 |
| "Changed by" was hidden only by the page | The server omits `changedBy` entirely for a caller who is not signed in | C3 |
| A download link's lifetime was not given | 60 seconds; a link issued just before a delete may work until it expires | C4 |
| Who discards abandoned uploads, and when | U7, 24 hours after the upload started | C7 |
| What tells an open folder it changed | Each folder carries a version that rises with every change in it; the page asks every 3 seconds with the version it has | C3, C5, C9 |
| Count of items in a folder before deleting | A preview operation returns the counts | C6 |
| Restoring a folder brings back what was deleted with it, not earlier deletes | Items deleted on their own keep their own mark; items hidden by a deleted folder carry no mark of their own | C9 |

One consequence differs from the building-block design: with the page asking
for changes, nothing is pushed, so the "announcement" that Activity was to
make is simply the folder's version, which Drive keeps. U5 still owns the
record of changes and the page's side of the live update.

---

## C1: Conventions for the whole interface (U1)

Applies to C2 to C7. U1 establishes these with its one trivial route.

```yaml
openapi: 3.0.3
info:
  title: Virtuoso Drive API, conventions
  version: 1.0.0
servers:
  - url: https://virtuoso.andrefellipelabs.com/v1
paths:
  /health:
    get:
      summary: Says whether the server and its database are answering
      security: []
      responses:
        "200":
          description: Healthy
          content:
            application/json:
              schema:
                type: object
                required: [status]
                properties:
                  status: { type: string, enum: [ok] }
        "503":
          $ref: "#/components/responses/Problem"
components:
  securitySchemes:
    session:
      type: http
      scheme: bearer
      description: The session issued at sign-in. Absent for readers.
  parameters:
    RequestId:
      name: X-Request-Id
      in: header
      required: false
      schema: { type: string }
      description: Echoed in the response and written to the logs. Generated by the server when absent.
  responses:
    Problem:
      description: Any failure
      headers:
        X-Request-Id: { schema: { type: string } }
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/Problem"
  schemas:
    Problem:
      type: object
      required: [type, title, status, code]
      properties:
        type: { type: string, description: "A URI identifying the kind of problem" }
        title: { type: string, description: "Short text, not shown to users as is" }
        status: { type: integer }
        code:
          type: string
          description: The stable value the page switches on to choose its message
          enum:
            - invalidInput
            - notSignedIn
            - emailNotConfirmed
            - accountDisabled
            - notMaintainer
            - notFound
            - nameEmpty
            - nameTooLong
            - nameHasForbiddenCharacter
            - nameAlreadyUsed
            - fileTooLarge
            - dailyLimitReached
            - uploadIncomplete
            - uploadExpired
            - parentIsDeleted
            - signInWrong
            - signInPaused
            - linkExpired
            - tooManyRequests
            - serverError
        detail: { type: string }
        field: { type: string, description: "The input field at fault, when there is one" }
        retryAt: { type: string, format: date-time, description: "When to try again, for signInPaused and dailyLimitReached" }
```

Rules for every operation:

- **Who may call.** No session: read operations only. A session of a confirmed, enabled account: change operations. A maintainer's session: operations under `/maintainer`. The server decides; the page only mirrors it.
- **Status codes.** 400 `invalidInput` and the name codes; 401 `notSignedIn`; 403 `emailNotConfirmed`, `accountDisabled`, `notMaintainer`; 404 `notFound`; 409 `nameAlreadyUsed`, `parentIsDeleted`; 413 `fileTooLarge`; 429 `dailyLimitReached`, `signInPaused`, `tooManyRequests`; 500 `serverError`.
- **Identifiers** are opaque strings generated by the server. Names never appear in a path.
- **Times** are UTC in ISO 8601. **Sizes** are whole bytes.
- **Timeouts and retries.** The page gives up on a request after 10 seconds. It retries read operations up to twice with a growing pause; it never retries a change operation by itself, except those marked idempotent below.
- **Unknown fields** in a response are ignored by the page.
- **Text from users** is returned as plain strings and never contains markup the server intends to be interpreted.

---

## C2: Accounts (U2 to the page)

```yaml
openapi: 3.0.3
info: { title: Virtuoso Drive API, accounts, version: 1.0.0 }
paths:
  /accounts:
    post:
      summary: Create an account and send the confirmation link
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [emailAddress, password, displayName]
              properties:
                emailAddress: { type: string, format: email }
                password: { type: string, minLength: 10 }
                displayName: { type: string, minLength: 1, maxLength: 50 }
                returnFolderId: { type: string }
                pendingAction: { type: string, enum: [upload, newFolder, rename, delete] }
      responses:
        "202": { description: "Always, whether or not the address already had an account" }
        "400": { $ref: "#/components/responses/Problem" }
  /accounts/confirmation:
    post:
      summary: Confirm an email address with the token from the link, and sign in
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [token], properties: { token: { type: string } } }
      responses:
        "200":
          description: Confirmed
          content:
            application/json:
              schema:
                type: object
                required: [session, me]
                properties:
                  session: { $ref: "#/components/schemas/Session" }
                  me: { $ref: "#/components/schemas/Me" }
                  returnFolderId: { type: string }
                  pendingAction: { type: string, enum: [upload, newFolder, rename, delete] }
        "410": { $ref: "#/components/responses/Problem" }
  /accounts/confirmation-resend:
    post:
      summary: Send the confirmation link again
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [emailAddress], properties: { emailAddress: { type: string, format: email } } }
      responses:
        "202": { description: "Always" }
  /sessions:
    post:
      summary: Sign in
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [emailAddress, password]
              properties:
                emailAddress: { type: string, format: email }
                password: { type: string }
      responses:
        "200":
          description: Signed in
          content:
            application/json:
              schema:
                type: object
                required: [session, me]
                properties:
                  session: { $ref: "#/components/schemas/Session" }
                  me: { $ref: "#/components/schemas/Me" }
        "401": { $ref: "#/components/responses/Problem" }
        "403": { $ref: "#/components/responses/Problem" }
        "429": { $ref: "#/components/responses/Problem" }
  /sessions/current:
    delete:
      summary: Sign out
      security: [{ session: [] }]
      responses:
        "204": { description: "Signed out" }
  /me:
    get:
      summary: Who the session belongs to
      security: [{ session: [] }]
      responses:
        "200":
          description: The account
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Me" }
        "401": { $ref: "#/components/responses/Problem" }
  /password-resets:
    post:
      summary: Ask for a password-reset link
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [emailAddress], properties: { emailAddress: { type: string, format: email } } }
      responses:
        "202": { description: "Always, whether or not the address has an account" }
  /password-resets/completion:
    post:
      summary: Set a new password with the token from the link, and sign in
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [token, password]
              properties:
                token: { type: string }
                password: { type: string, minLength: 10 }
      responses:
        "200":
          description: Password changed
          content:
            application/json:
              schema:
                type: object
                required: [session, me]
                properties:
                  session: { $ref: "#/components/schemas/Session" }
                  me: { $ref: "#/components/schemas/Me" }
        "410": { $ref: "#/components/responses/Problem" }
  /maintainer/accounts:
    get:
      summary: List accounts, for a maintainer
      security: [{ session: [] }]
      parameters:
        - { name: cursor, in: query, schema: { type: string } }
      responses:
        "200":
          description: A page of accounts
          content:
            application/json:
              schema:
                type: object
                required: [accounts]
                properties:
                  accounts:
                    type: array
                    items: { $ref: "#/components/schemas/MaintainerAccount" }
                  nextCursor: { type: string }
        "403": { $ref: "#/components/responses/Problem" }
  /maintainer/accounts/{accountId}/status:
    put:
      summary: Disable or enable an account
      security: [{ session: [] }]
      parameters:
        - { name: accountId, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [status], properties: { status: { type: string, enum: [active, disabled] } } }
      responses:
        "200":
          description: The account after the change
          content:
            application/json:
              schema: { $ref: "#/components/schemas/MaintainerAccount" }
        "409": { $ref: "#/components/responses/Problem" }
  /maintainer/accounts/{accountId}:
    delete:
      summary: Remove an account and erase its details
      security: [{ session: [] }]
      parameters:
        - { name: accountId, in: path, required: true, schema: { type: string } }
      responses:
        "204": { description: "Removed" }
        "409": { $ref: "#/components/responses/Problem" }
components:
  schemas:
    Session:
      type: object
      required: [token, expiresAt]
      properties:
        token: { type: string }
        expiresAt: { type: string, format: date-time }
    Me:
      type: object
      required: [accountId, displayName, emailConfirmed, isMaintainer]
      properties:
        accountId: { type: string }
        displayName: { type: string }
        emailAddress: { type: string, format: email, description: "The caller's own address only" }
        emailConfirmed: { type: boolean }
        isMaintainer: { type: boolean }
    MaintainerAccount:
      type: object
      required: [accountId, displayName, emailAddress, status, emailConfirmed, isMaintainer]
      properties:
        accountId: { type: string }
        displayName: { type: string }
        emailAddress: { type: string, format: email }
        status: { type: string, enum: [active, disabled] }
        emailConfirmed: { type: boolean }
        isMaintainer: { type: boolean }
```

Behaviour the description cannot show:

- Sign-up, confirmation-resend and password-reset always answer 202, so they never reveal who has an account.
- Sign-in answers `signInWrong` for a wrong address or password alike; `signInPaused` with `retryAt` after 5 wrong passwords in a row, for 15 minutes from the fifth; `emailNotConfirmed` for a right password on an unconfirmed account, which may then ask for the link again; `accountDisabled` for a disabled one.
- A session lasts at most 15 minutes before it must be renewed, which is what bounds how long a disabled account keeps working. Renewal is silent while the account is enabled.
- A maintainer cannot disable or remove their own account, and the last maintainer cannot be removed: 409.
- Removal deletes the identity held by the sign-in service, ends the account's sessions and voids its pending links, then erases the email address and display name. It cannot be undone.
- Confirmation and reset tokens work once, for 24 hours: 410 `linkExpired` otherwise.

---

## C3: Browsing (U3 to the page)

```yaml
openapi: 3.0.3
info: { title: Virtuoso Drive API, browsing, version: 1.0.0 }
paths:
  /folders/{folderId}:
    get:
      summary: A folder, its path from the top, and its visible contents
      description: >
        Use the identifier `root` for the top folder, "All". Send the version
        last received in If-None-Match; the answer is 304 with no body when
        nothing in the folder has changed. The page asks every 3 seconds.
      security: [{}, { session: [] }]
      parameters:
        - { name: folderId, in: path, required: true, schema: { type: string } }
        - { name: If-None-Match, in: header, required: false, schema: { type: string } }
      responses:
        "200":
          description: The folder
          headers:
            ETag: { schema: { type: string }, description: "The folder's version" }
          content:
            application/json:
              schema: { $ref: "#/components/schemas/FolderView" }
        "304": { description: "Unchanged since the version sent" }
        "404": { $ref: "#/components/responses/Problem" }
components:
  schemas:
    FolderView:
      type: object
      required: [folderId, name, path, items]
      properties:
        folderId: { type: string }
        name: { type: string }
        path:
          type: array
          description: From "All" to this folder, in order
          items:
            type: object
            required: [folderId, name]
            properties:
              folderId: { type: string }
              name: { type: string }
        items:
          type: array
          description: Visible items only, oldest first
          items: { $ref: "#/components/schemas/Item" }
    Item:
      type: object
      required: [itemId, kind, name]
      properties:
        itemId: { type: string }
        kind: { type: string, enum: [folder, file] }
        name: { type: string }
        size: { type: integer, format: int64, minimum: 0, description: "Files only" }
        contentType: { type: string, description: "Files only; chooses the icon" }
        changedBy:
          description: Present only when the caller is signed in
          type: object
          required: [state]
          properties:
            state: { type: string, enum: [known, notRecorded, deletedAccount] }
            displayName: { type: string, description: "Only when state is known" }
```

- A deleted folder, or one inside a deleted folder, answers 404, the same as one that never existed.
- The version changes whenever a visible item of this folder is added, renamed, deleted or restored, or its "changed by" changes; it does not change for anything deeper down.
- The whole list is returned; there is no paging. A folder of 500 items must be answered within the time the requirements set.

---

## C4: Downloading (U4 to the page)

```yaml
openapi: 3.0.3
info: { title: Virtuoso Drive API, downloading, version: 1.0.0 }
paths:
  /files/{fileId}/download-link:
    post:
      summary: Get a short-lived link to a file's content
      security: [{}, { session: [] }]
      parameters:
        - { name: fileId, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [purpose]
              properties:
                purpose: { type: string, enum: [save, open], description: "save downloads under the file's name; open shows it in the browser" }
      responses:
        "200":
          description: The link
          content:
            application/json:
              schema:
                type: object
                required: [url, expiresAt]
                properties:
                  url: { type: string, format: uri }
                  expiresAt: { type: string, format: date-time }
        "404": { $ref: "#/components/responses/Problem" }
```

- The link works for 60 seconds, for that one file, for reading only. It is fetched straight from storage, not through the server.
- With `save`, the content arrives with the file's current name, so a renamed file is saved under its new name.
- A deleted file answers 404. A link issued before the delete may still work until its 60 seconds end; this is accepted.
- For several files the page asks for one link per file and reports each failure by name without stopping the others.
- Idempotent: the page may retry it.

---

## C5: Record of changes (U5 to the page)

The live update itself has no operation of its own: it is the page asking C3
with the version it holds.

```yaml
openapi: 3.0.3
info: { title: Virtuoso Drive API, record of changes, version: 1.0.0 }
paths:
  /maintainer/changes:
    get:
      summary: The record of changes, newest first, for a maintainer
      security: [{ session: [] }]
      parameters:
        - { name: accountId, in: query, schema: { type: string } }
        - { name: itemId, in: query, schema: { type: string } }
        - { name: cursor, in: query, schema: { type: string } }
      responses:
        "200":
          description: A page of 50 entries
          content:
            application/json:
              schema:
                type: object
                required: [changes]
                properties:
                  changes:
                    type: array
                    items: { $ref: "#/components/schemas/Change" }
                  nextCursor: { type: string }
        "403": { $ref: "#/components/responses/Problem" }
components:
  schemas:
    Change:
      type: object
      required: [changeId, occurredAt, action, itemId, itemKind, itemName, who]
      properties:
        changeId: { type: string }
        occurredAt: { type: string, format: date-time }
        action: { type: string, enum: [uploaded, replaced, createdFolder, renamed, deleted, restored] }
        itemId: { type: string }
        itemKind: { type: string, enum: [folder, file] }
        itemName: { type: string, description: "The name at the time" }
        previousName: { type: string, description: "For renamed" }
        containedFiles: { type: integer, description: "For a folder deleted or restored" }
        containedFolders: { type: integer, description: "For a folder deleted or restored" }
        who:
          type: object
          required: [state]
          properties:
            state: { type: string, enum: [known, deletedAccount] }
            accountId: { type: string }
            displayName: { type: string }
            emailAddress: { type: string, format: email }
```

- One entry per thing a person did. Deleting or restoring a folder is one entry with the counts of what was inside.
- `itemId` narrows by identity, so a renamed item is found under every name it has had.
- There is no operation to change or remove an entry.

---

## C6: Organising (U6 to the page)

```yaml
openapi: 3.0.3
info: { title: Virtuoso Drive API, organising, version: 1.0.0 }
paths:
  /folders/{folderId}/folders:
    post:
      summary: Create a folder inside a folder
      security: [{ session: [] }]
      parameters:
        - { name: folderId, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [name], properties: { name: { type: string } } }
      responses:
        "201":
          description: The new folder
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Item" }
        "400": { $ref: "#/components/responses/Problem" }
        "409": { $ref: "#/components/responses/Problem" }
  /files/{fileId}/name:
    put:
      summary: Rename a file, keeping its extension
      security: [{ session: [] }]
      parameters:
        - { name: fileId, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [baseName]
              properties:
                baseName: { type: string, description: "The new name without the extension; the server adds the existing extension" }
      responses:
        "200":
          description: The file after renaming
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Item" }
        "400": { $ref: "#/components/responses/Problem" }
        "409": { $ref: "#/components/responses/Problem" }
  /deletion-previews:
    post:
      summary: Say what deleting these items would remove from the site
      security: [{ session: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/ItemIds" }
      responses:
        "200":
          description: What the confirmation should say
          content:
            application/json:
              schema:
                type: object
                required: [selectedFiles, selectedFolders, containedFiles, containedFolders]
                properties:
                  selectedFiles: { type: integer }
                  selectedFolders: { type: integer }
                  containedFiles: { type: integer }
                  containedFolders: { type: integer }
  /deletions:
    post:
      summary: Delete items; each is deleted entirely or not at all
      security: [{ session: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/ItemIds" }
      responses:
        "200":
          description: The outcome for each item
          content:
            application/json:
              schema:
                type: object
                required: [results]
                properties:
                  results:
                    type: array
                    items:
                      type: object
                      required: [itemId, outcome]
                      properties:
                        itemId: { type: string }
                        outcome: { type: string, enum: [deleted, alreadyDeleted, failed] }
                        code: { type: string, description: "A Problem code, when failed" }
  /maintainer/deleted-items:
    get:
      summary: Deleted items, newest first, for a maintainer
      security: [{ session: [] }]
      parameters:
        - { name: cursor, in: query, schema: { type: string } }
      responses:
        "200":
          description: A page of 50 deleted items, and how much space all of them take
          content:
            application/json:
              schema:
                type: object
                required: [items, totalBytes]
                properties:
                  items:
                    type: array
                    items: { $ref: "#/components/schemas/DeletedItem" }
                  totalBytes: { type: integer, format: int64 }
                  nextCursor: { type: string }
  /maintainer/deleted-items/{itemId}/restoration:
    post:
      summary: Restore a deleted item to the folder it was in
      security: [{ session: [] }]
      parameters:
        - { name: itemId, in: path, required: true, schema: { type: string } }
      responses:
        "200":
          description: Restored; the name may have been numbered
          content:
            application/json:
              schema:
                type: object
                required: [item, renamed]
                properties:
                  item: { $ref: "#/components/schemas/Item" }
                  renamed: { type: boolean }
        "409": { $ref: "#/components/responses/Problem" }
components:
  schemas:
    ItemIds:
      type: object
      required: [itemIds]
      properties:
        itemIds: { type: array, minItems: 1, items: { type: string } }
    DeletedItem:
      type: object
      required: [itemId, kind, name, wasIn, deletedAt, reason]
      properties:
        itemId: { type: string }
        kind: { type: string, enum: [folder, file] }
        name: { type: string }
        wasIn:
          type: array
          items: { type: object, required: [folderId, name], properties: { folderId: { type: string }, name: { type: string } } }
        deletedAt: { type: string, format: date-time }
        reason: { type: string, enum: [deleted, replaced] }
        deletedBy:
          type: object
          required: [state]
          properties:
            state: { type: string, enum: [known, deletedAccount] }
            displayName: { type: string }
        containedFiles: { type: integer }
        containedFolders: { type: integer }
        parentIsDeleted: { type: boolean, description: "True when the folder it was in must be restored first" }
```

- Name rules are those of C9. `nameEmpty`, `nameTooLong` and `nameHasForbiddenCharacter` answer 400 with `field`; `nameAlreadyUsed` answers 409.
- Rename applies to files only; a folder identifier answers 404.
- Deletion is idempotent: deleting an already deleted item answers `alreadyDeleted`, so the page may safely repeat a request that timed out.
- Deleted items lists only what a person deleted or replaced directly. What was inside a deleted folder is shown as that folder's counts and comes back with it.
- Restoration answers 409 `parentIsDeleted` while the folder the item was in is deleted.
- There is no operation that removes anything for good.

---

## C7: Uploading (U7 to the page)

```yaml
openapi: 3.0.3
info: { title: Virtuoso Drive API, uploading, version: 1.0.0 }
paths:
  /uploads:
    post:
      summary: Start an upload of one file into a folder
      security: [{ session: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [folderId, fileName, size]
              properties:
                folderId: { type: string }
                fileName: { type: string }
                size: { type: integer, format: int64, minimum: 0, maximum: 1073741824 }
                contentType: { type: string }
      responses:
        "201":
          description: Where to send the content
          content:
            application/json:
              schema:
                type: object
                required: [uploadId, uploadUrl, expiresAt]
                properties:
                  uploadId: { type: string }
                  uploadUrl: { type: string, format: uri }
                  expiresAt: { type: string, format: date-time }
        "400": { $ref: "#/components/responses/Problem" }
        "404": { $ref: "#/components/responses/Problem" }
        "413": { $ref: "#/components/responses/Problem" }
        "429": { $ref: "#/components/responses/Problem" }
  /uploads/{uploadId}/completion:
    post:
      summary: Say the content has been sent, and list the file
      security: [{ session: [] }]
      parameters:
        - { name: uploadId, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                onNameClash: { type: string, enum: [replace, keepBoth, skip], description: "Omitted on the first attempt" }
      responses:
        "200":
          description: The file is listed, or was skipped
          content:
            application/json:
              schema:
                type: object
                required: [outcome]
                properties:
                  outcome: { type: string, enum: [listed, skipped] }
                  item: { $ref: "#/components/schemas/Item" }
                  replacedItemId: { type: string }
        "409":
          description: >
            Either the name is already used and no choice was sent
            (nameAlreadyUsed: ask the person and call again with onNameClash),
            or the content has not fully arrived (uploadIncomplete), or the
            folder was deleted meanwhile (parentIsDeleted).
          content:
            application/problem+json:
              schema: { $ref: "#/components/schemas/Problem" }
        "410": { $ref: "#/components/responses/Problem" }
  /uploads/{uploadId}:
    delete:
      summary: Abandon an upload
      security: [{ session: [] }]
      parameters:
        - { name: uploadId, in: path, required: true, schema: { type: string } }
      responses:
        "204": { description: "Abandoned; its content is discarded and its reserved size released" }
```

- **Limits are checked at the start, before any byte is sent.** A size over 1 GiB (1,073,741,824 bytes) answers 413 `fileTooLarge`. A size that would take the account past 5 GiB of uploads in the current UTC day answers 429 `dailyLimitReached` with `retryAt`.
- **The declared size is reserved at the start** and counts towards the day at once, so several uploads started together cannot pass the limit between them. The reservation is released if the upload is abandoned, skipped, or expires; a replaced or kept-both upload keeps counting.
- **1 GB is read as 1 GiB** here, the more generous of the two readings, so that a file a person's computer shows as "1 GB" is never refused. This is my choice; the requirement says only "1 GB".
- The content is sent straight to storage at `uploadUrl`, which accepts exactly the declared size for that one upload and works for 1 hour.
- Completion checks that the stored size equals the declared size before listing the file. The file is recorded in the folder named at the start, whatever folder the page shows by then.
- `keepBoth` lists the file under the lowest free numbered name; `replace` lists it under the name and turns the earlier file into a deleted item with reason `replaced`; `skip` discards the content.
- Completion is idempotent for a given `uploadId`: repeating it after success returns the same result.
- An upload not completed within 24 hours of its start expires: its content is discarded, its reservation released, and completion answers 410 `uploadExpired`.

---

## C8: Who is asking (U2 to U5, U6, U7)

In-process. The one place that turns a request into an account and says what
that account may do.

```yaml
contract: C8
kind: shared-schema
provider: U2
operations:
  identify:
    summary: Turn a request's session into a caller, or say why not
    input:
      sessionToken: { type: string, nullable: true }
    output:
      oneOf:
        - caller:
            accountId: string
            isMaintainer: boolean
        - anonymous: true
    errors: [notSignedIn]
    notes: An expired or forged token is notSignedIn, never anonymous.
  requireContributor:
    summary: The caller, only if signed in, confirmed and enabled
    input: { sessionToken: string }
    output: { accountId: string, isMaintainer: boolean }
    errors: [notSignedIn, emailNotConfirmed, accountDisabled]
  requireMaintainer:
    summary: The caller, only if a maintainer
    input: { sessionToken: string }
    output: { accountId: string }
    errors: [notSignedIn, accountDisabled, notMaintainer]
  displayNames:
    summary: Display names for a batch of accounts
    input: { accountIds: { type: array, items: string, maxItems: 500 } }
    output:
      type: map
      key: accountId
      value:
        state: { enum: [known, deletedAccount] }
        displayName: { type: string, nullable: true }
  accountsForMaintainer:
    summary: Display names and email addresses, for the maintainer screens only
    input: { accountIds: { type: array, items: string, maxItems: 500 } }
    output:
      type: map
      key: accountId
      value:
        state: { enum: [known, deletedAccount] }
        displayName: { type: string, nullable: true }
        emailAddress: { type: string, nullable: true }
    notes: The caller must already have passed requireMaintainer.
guarantees:
  - Every change operation in U5, U6 and U7 calls requireContributor or requireMaintainer first.
  - An account identifier that no longer exists resolves to deletedAccount, never to an error.
  - No operation other than accountsForMaintainer returns an email address.
failure: If U2 cannot decide, the calling operation fails with serverError; it never proceeds as if allowed.
```

---

## C9: Folders, files and names (U3 to U4, U5, U6, U7, U8)

In-process operations and the records behind them. This is the boundary with
the most consumers.

```yaml
contract: C9
kind: shared-schema
provider: U3
records:
  Folder:
    identifier: folderId
    fields:
      folderId: generated, never reused
      name: text
      parentFolderId: Folder, null only for the top folder
      position: number; items of a folder are listed by it, lowest first
      version: number; rises by one on every change to this folder's visible items
      createdAt: time
      lastChangedByAccountId: account identifier or null
      lastChangedAt: time or null
      deletedAt: time or null; set only on an item a person deleted directly
      deletedByAccountId: account identifier or null
      broughtOver: boolean
  File:
    identifier: fileId
    fields:
      fileId: generated, never reused
      name: text
      folderId: Folder
      position: number
      size: whole bytes
      contentType: text or null
      contentId: StoredContent (see C10); always set
      createdAt: time
      lastChangedByAccountId: account identifier or null
      lastChangedAt: time or null
      deletedAt: time or null
      deletedByAccountId: account identifier or null
      deletedReason: one of deleted, replaced, or null
      broughtOver: boolean
visibility:
  rule: An item is visible when it has no deletedAt and no folder above it has one.
  consequence: >
    Deleting a folder marks only the folder. Restoring it clears only that
    mark, so items inside that a person had deleted separately stay deleted.
nameRules:
  owner: U3
  normalise: Remove spaces at both ends.
  valid:
    - 1 to 255 characters after normalising
    - no "/" and no control characters
  unique: Among the visible items of one folder, compared ignoring upper and lower case; folders and files share one set of names.
  lowestFreeName: >
    For "exam.pdf" already taken, the first of "exam (1).pdf", "exam (2).pdf",
    ... that is free; the number goes before the extension, and a name with no
    extension gets it at the end.
operations:
  getFolderView:
    summary: A visible folder, its path and visible items, with its version
    input: { folderId: string }
    errors: [notFound]
  getVisibleFile:
    summary: A visible file's name, size, type and contentId
    input: { fileId: string }
    errors: [notFound]
  checkName:
    summary: Apply the name rules for a folder
    input: { folderId: string, name: string, ignoreItemId: { type: string, nullable: true } }
    output: { normalisedName: string }
    errors: [nameEmpty, nameTooLong, nameHasForbiddenCharacter, nameAlreadyUsed]
  lowestFreeName:
    input: { folderId: string, name: string }
    output: { name: string }
  importFolder:
    summary: Create a folder during migration, with its position, marked broughtOver
    caller: U8 only, in-process
    input: { parentFolderId: string, name: string, position: number, sourceKey: string }
    output: { folderId: string, created: boolean }
    notes: Repeating a sourceKey returns the folder already made. Applies the name rules. Writes no change record and names no account.
  importFile:
    summary: Create a file record during migration, for content already stored
    caller: U8 only, in-process
    input: { folderId: string, name: string, position: number, size: number, contentType: { type: string, nullable: true }, contentId: string, sourceKey: string }
    output: { fileId: string, created: boolean }
    notes: As importFolder.
guarantees:
  - A File always has a contentId that exists in C10.
  - Changing any record here raises the version of the folder whose list it changes, in the same operation.
  - importFolder and importFile are not reachable from any route of C2 to C7.
failure: An operation either completes or changes nothing.
```

U3 delivers the records, the visibility rule, the name rules and the read
operations. U6 adds the change operations on the same records (create,
rename, delete, restore) and U7 the registration of an uploaded file; neither
changes the shape. U8 adds the two import operations. A change to the shape of
Folder or File after U3 is a breaking change for five Units.

---

## C10: Stored contents (U4 to U7, U8)

```yaml
contract: C10
kind: shared-schema
provider: U4
records:
  StoredContent:
    identifier: contentId
    fields:
      contentId: generated, never reused
      storageKey: generated; unrelated to any name
      size: whole bytes
      contentType: text or null
      checksum: SHA-256 of the content
      storedAt: time
operations:
  linkToRead:
    summary: A 60-second link to read one content
    input: { contentId: string, fileName: string, purpose: { enum: [save, open] } }
    output: { url: string, expiresAt: time }
  reserveForUpload:
    summary: A place for a content of a declared size, and a link to write exactly that size
    caller: U7
    input: { size: number, contentType: { type: string, nullable: true } }
    output: { contentId: string, uploadUrl: string, expiresAt: time }
  confirmStored:
    summary: Check that the content has fully arrived and record its size and checksum
    caller: U7
    input: { contentId: string, expectedSize: number }
    output: { stored: boolean }
  discardUnlisted:
    summary: Remove a content that no File points to
    caller: U7
    input: { contentId: string }
    notes: Refuses if any File, visible or deleted, has this contentId.
  importContent:
    summary: Store a content read from the old system, during migration
    caller: U8 only, in-process
    input: { source: stream, size: number, contentType: { type: string, nullable: true }, sourceKey: string }
    output: { contentId: string, checksum: string, created: boolean }
    notes: No size limit and no daily limit. Repeating a sourceKey returns the content already stored.
guarantees:
  - A content that a File points to is never removed by any operation.
  - Storage is never readable or writable except through a link issued here.
failure: linkToRead for a missing content fails with notFound; the caller reports the file as no longer available.
```

For sample files before U7 exists, U4's tests create a StoredContent and a
File together through `importContent` and `importFile`'s underlying helpers;
U4 delivers the minimum of these needed for its own tests, and U8 completes
them.

---

## C11: Recording a change (U5 to U6, U7)

```yaml
contract: C11
kind: shared-schema
provider: U5
operations:
  recordChange:
    summary: Write one entry in the record of changes, inside the caller's own database transaction
    input:
      transaction: the caller's open transaction
      accountId: string
      action: { enum: [uploaded, replaced, createdFolder, renamed, deleted, restored] }
      itemId: string
      itemKind: { enum: [folder, file] }
      itemName: string
      folderId: string
      previousName: { type: string, nullable: true }
      containedFiles: { type: number, nullable: true }
      containedFolders: { type: number, nullable: true }
    output: { changeId: string }
guarantees:
  - The entry is written if and only if the caller's transaction commits.
  - One call per thing a person did; a folder delete or restore is one call with counts.
  - Entries are never updated or deleted by any operation.
failure: If the entry cannot be written, the caller's operation fails and nothing changes.
```

---

## C12: Listing an uploaded file (U6 to U7)

```yaml
contract: C12
kind: shared-schema
provider: U6
operations:
  registerFile:
    summary: Add a file to a folder for content that is fully stored
    input:
      accountId: string
      folderId: string
      name: string
      size: number
      contentType: { type: string, nullable: true }
      contentId: string
      onNameClash: { enum: [replace, keepBoth], nullable: true }
    output:
      fileId: string
      name: string
      replacedFileId: { type: string, nullable: true }
    errors: [nameEmpty, nameTooLong, nameHasForbiddenCharacter, nameAlreadyUsed, parentIsDeleted, notFound]
    notes: >
      With no onNameClash, a taken name fails with nameAlreadyUsed and changes
      nothing. With replace, the earlier file is marked deleted with reason
      replaced, in the same transaction. With keepBoth, the lowest free name
      is used. Records the change through C11 as uploaded or replaced.
guarantees:
  - After success exactly one visible file in the folder has the returned name.
  - The earlier file's content is untouched by replace.
failure: Completes entirely or changes nothing; U7 then keeps or discards the content according to the person's choice.
```

---

## C13: The final copy (U8 to U9)

The migration tool is run from a command line by the operator. U9's procedure
depends only on these commands and what they return.

```yaml
contract: C13
kind: command-line
provider: U8
access: >
  Runs with the operator's own access to the new database and storage and
  read-only access to the old system. It is not part of the deployed site and
  calls no route of C2 to C7.
commands:
  export:
    summary: Take a copy of the old database's records and a listing of the old files
    writes: an export folder on the operator's machine
    exit: { 0: complete, 1: could not read the old system }
  migrate:
    summary: Bring the contents of an export into the new system
    options:
      rehearsal: boolean; writes to the test environment
    writes: a report file, one entry per source item, and a summary of counts, bytes and duration
    exit: { 0: every source item accounted for, 2: stopped; safe to run again, 1: failed }
    rerun: Running again over the same export adds nothing and continues where it stopped.
  verify:
    summary: Compare the new system with the export, taking the report into account
    writes: the figures compared, and each item that differs
    exit: { 0: nothing unaccounted for, 3: at least one difference }
report:
  entry:
    sourceKey: the old system's own key for the item
    sourcePath: where it was listed
    outcome: one of migrated, migratedWithNote, merged, notMigrated
    reason: for notMigrated, one of contentWithoutRecord, recordWithoutContent, sizeMismatch, nameNotAcceptable, outsideFolderTree
    note: for migratedWithNote, one of filedWhereListed, renamedAfterMerge
    targetItemId: the folder or file it became
  rule: Every source item appears exactly once. Source items equal migrated plus migratedWithNote plus merged plus notMigrated.
guarantees:
  - No command writes to the old system.
  - verify exits 0 only if counts and total sizes match once merged and notMigrated entries are set aside.
```

U9's procedure is: make the old site read-only, `export`, `migrate`, `verify`;
on exit 0 switch the address, otherwise put the old rules back.

---

## Contract ownership rules

- **Each contract is owned by its provider Unit**, named in the table. The owner writes it into the repository when the Unit is built: the OpenAPI parts as one file checked in the pipeline, the in-process ones as TypeScript types and their tests.
- **The page and the server change together** (Q2), so the page-to-server contracts may change freely as long as both sides change in the same pull request. The path stays `/v1`; a `/v2` would be needed only if something outside the site ever used the interface.
- **A breaking change to an in-process contract** (removing or renaming an operation or field, or changing its meaning) needs the consumer Units' code and tests changed in the same pull request. Since one person works on one Unit at a time, "agreed" means: the change and every consumer's adjustment are reviewed together, and the build fails otherwise, because the types no longer fit.
- **Additive changes are safe.** New optional fields and new operations may be added by the owner at any time. Consumers ignore fields they do not know.
- **The Problem codes in C1 are a contract in themselves.** The page chooses its messages from them. A code is never reused with a new meaning.
- **C9's records are the most shared thing in the system.** Any change to Folder or File after U3 is treated as breaking.
- **Import operations belong to U8** even though they live in Drive and FileTransfer code. Nothing but the migration tool may call them, and no route exposes them.

## Open questions

| Contract | Question | Blocks |
|----------|----------|--------|
| C2 | Does sign-in go through this server (as written), or does the page talk to the sign-in service directly? As written, the server sees passwords in passing, which the maintainer's choice of built-in screens implies but which narrows the choice of sign-in service | U2 |
| C2 | How a session is kept in the browser (and renewed every 15 minutes) without holding anything long-lived there | U2 |
| C2 | How the first maintainer is made, given the role is granted outside the site | U2 |
| C3 | Whether asking every 3 seconds fits the cost ceiling with many pages open; no estimate has been made | U1, U5 |
| C3 | No paging: is a folder with thousands of migrated items possible? Known only after an export | U3, U8 |
| C7 | 1 GB read as 1 GiB, and "a day" as a UTC day, are my choices; the daily limit is likewise read as 5 GiB | U7 |
| C7 | Whether one write of up to 1 GiB over a phone connection is reliable enough, or the content must be sent in parts | U7 |
| C9 | Whether Folder and File are one table or two | U3 |
| C9 | The old system has no creation times; `position` for migrated items comes from the order of the old system's keys, which is assumed, not verified, to be the order shown today | U3, U8 |
| C10 | `checksum` for an uploaded file is computed after it arrives; whether the browser also sends one to detect corruption in transit | U7 |
| C13 | How the operator's access to the old system is granted and withdrawn | U8, U9 |
| C13 | Whether `migrate` at its real size fits the 4-hour read-only period | U8, U9 |
| All | `requirements.md`, `stories.md` and `components.md` still carry wording these contracts replace (Activity "announcing"; the daily limit counting only finished uploads; import "closed after the switch"). Where they differ, this document is the later one | every Unit |

# Logical Components: U3, browsing and selecting

Where browsing lives in the system U1 built, what U3 adds to each part, and
what it must change in parts U1 already built. The five design documents
beside this one say how each quality requirement is met; this one says
where. Mechanisms are numbered from 20 (P20, S20, C20, R20, O20) so that none
shares a number with U1's.

Sources: U3's quality requirements and technology decisions
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-requirements/security-requirements.md`,
`performance-requirements.md`, `scalability-requirements.md`,
`reliability-requirements.md`, `observability-requirements.md`,
`tech-stack-decisions.md`), U3's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`),
and contracts C1, C3 and C9
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`).

No question was put to the maintainer in this step. What this step decided
or changed is listed near the end for the maintainer to see.

## Verified in this step

Checked on 2026-11-26, on PostgreSQL 18.1 in a local container unless
stated. A local container is not Amazon RDS; every mechanism below names
what it needs explicitly and does not lean on a default that could differ.

| Point | Result |
|-------|--------|
| Sameness of names (cases 1 to 5 of "Name cases") | Folding case with the database's `casefold`, naming its built-in `pg_c_utf8` rules explicitly, on the composed form, gives all five. Plain lower-casing gets two further cases wrong (Greek final sigma, dotted capital I); the `pg_unicode_fast` rules make "straße" and "STRASSE" the same, which the table forbids |
| Sameness held by the structure | A stored derived column with a unique index limited to items not deleted refuses a duplicate differing only by case, and allows the same name on a deleted item |
| The other name cases (6 to 15) held by the structure | Five checks on the name column were written and run against all the cases: composed form; 1 to 255 characters; not "." or ".."; no "/", control character or listed invisible formatting character; no listed white-space character at either end. Every case gave the result the table requires, including a no-break space at the end and a formatting character from beyond the basic range |
| Random identifiers | The database's `gen_random_uuid` gives version-4 identifiers |
| One statement that walks to the top with a depth limit | Works |
| Whether Amazon RDS offers PostgreSQL 18 | Asked AWS (`describe-db-engine-versions`, us-east-1): 18.1 to 18.7, parameter family `postgres18`. This also settles the same point left open in U1's code summary |

"Listed" matters. The database's pattern matching has no way to say "every
character Unicode calls white space" or "every formatting character", so the
checks list them, from the Unicode version current when the Unit is built.
The server's name module uses the same lists, from one source file that
generates both, so the two cannot drift.

## What U3 adds, part by part

| Part (from U1) | What U3 adds | New AWS resource? |
|----------------|--------------|-------------------|
| Page | The folder screen: list, breadcrumb, action bar, status line; the selection logic; the address handling; the icons | No |
| Edge | **A change:** two more request headers are passed to the server for `/v1` (see "Changes to what U1 built") | No; a setting on an existing one |
| Edge check | Nothing. The folder route sits behind the access password like everything else | No |
| Server entry point | One route, `GET /v1/folders/{folderId}`. U1's catch-all route already sends it to the server | No |
| Server | The Drive module and one operation; changes to the shared request steps | No |
| Database | One table, `items`, with the top folder in it | No |
| Database change runner | One more change file; and a second mode, "load samples" (the sample loader) | No |
| Logs | New fields on the folder request's entry; two saved searches; one dashboard view drawn from the logs | No series, no alarm |

**The sample loader is a second mode of the change runner**, not a function
of its own. The change runner already signs in to the database as the user
that may write, already runs inside the network that reaches the database,
and is already started by the pipeline; a new function would need all three
set up again. The pipeline starts it a second time with the instruction
"load samples", in the test environment only.

## Changes to what U1 built

U1's shared parts were built for one page and two fixed calls. U3 is the
first Unit to need more of them. Each change below is to code or
definitions that U1 delivered; each keeps U1's two operations and its page
working unchanged, and U1's tests stay.

| # | Part (U1's file) | As U1 built it | What U3 changes | Needed by |
|---|------------------|----------------|-----------------|-----------|
| 1 | Finding the operation for a request (`server/src/http/operation.ts`) | A path matches only if it is exactly equal | A path may hold one or more named parts, as in `/v1/folders/{folderId}`; the values are handed to the operation | The folder route |
| 2 | What an operation is given (`operation.ts`, `request-steps.ts`) | The query only | Also the path's named values, and the request headers the operation declares it reads (here: the version held, and the encodings accepted). An operation sees no header it did not declare | S20, S21, P22 |
| 3 | What happens when an input fails its check (`request-steps.ts`) | Always `invalidInput`, status 400 | The operation may declare that a failed check of its path values is answered as "not found". The default stays `invalidInput` | S20, S24 |
| 4 | What an operation may answer (`operation.ts`, `request-steps.ts`) | A status and a body, always sent as JSON text | Also response headers the operation names; an answer with no body (for "unchanged"); and a body already compressed, which the steps pass on in the encoded form the platform requires | S21, S28, P22 |
| 5 | The log entry (`server/src/log/entry.ts`) | A closed set of fields; a failure has a code and an error | An operation may add fields from a set it declares, checked by type; and the entry gains a `fault` field for named faults. U1's scrubbing runs over the added fields too | O20, O22 |
| 6 | Database access (`server/src/db/database.ts`) | Single statements | One more method that runs a piece of work as a transaction. If the work fails or runs out of time the connection is discarded, as today, which also ends the transaction | R21 |
| 7 | The page's call function (`web/src/api/call-server.ts`) | Fixed request headers; any status that is not a success is a failure; returns the body only | The caller may pass the version it holds; "unchanged" is a third outcome beside success and failure, never retried and never a failure; a success also returns the version that came with it. It still tells the browser not to store answers | P23 |
| 8 | The edge's rule for what it passes to the server (`infra/modules/edge/main.tf`, the server's origin request policy) | Passes the request identifier, `Accept` and `Content-Type` | Also passes `If-None-Match` and `Accept-Encoding`. Without this the server never sees the version a caller holds, and never learns that it may compress | S21, P22 |
| 9 | The interface description (`server/openapi.yaml`) and the test that compares it with the operations | Two operations | The folder operation is added; the comparison must understand named path parts | Contract C3 |

Change 8 is to U1's Terraform and is applied to both environments by the
pipeline like any other. Nothing kept at the edge is affected, because the
edge keeps nothing for `/v1` (U1). Whether the edge passes the server's
`ETag` and `Content-Encoding` back to the browser untouched when it keeps
nothing is expected, and is proven by the end-to-end test of S21.

## Inside the server: the Drive module

Drive is the building block that owns folders and files
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`).
U3 starts it. It lives in one folder of the server's package, and nothing
outside it touches the `items` table.

| Piece | Responsibility | Used by |
|-------|----------------|---------|
| Identifiers | Says whether a text is `root` or a well-formed identifier (S20) | The folder operation; later every operation that takes an item |
| Names | Normalises and validates a name; splits base and extension; builds the next numbered name (S23; rules BR2.4, BR2.5, BR2.7) | The change step; U6, U7, U8 |
| Folder reading | The two statements that answer a folder (P20), and the mapping from rows to the answer's fields (S24) | The folder operation |
| File reading | `getVisibleFile` (rule BR1.11) | U4 |
| Change step | The one way to change a folder's list (R21) | The sample loader; U6, U7, U8 |
| Version tag | Makes and reads the version a caller holds (S21) | The folder operation |

The change runner's package uses the Drive module from the server's package
for its "load samples" mode; there is one copy of the code.

## Inside the page

| Piece | Responsibility |
|-------|----------------|
| Address | Reads the folder from the address and writes it, with the browser's history functions (T22) |
| Folder calls | Asks for a folder through the shared call function (change 7), holding the version it was given and sending it back (P23) |
| Selection | A pure function from (rows, selection, input) to a new selection; no part of it in a component (T23) |
| Formatting | Size text and icon choice |
| Folder screen | Holds the state of the list (the five states of the design), the rows, the selection; runs the design's workflows W2 to W4 |
| List, breadcrumb, action bar, status line | Display, and turning clicks, keys and taps into inputs for the selection function |

## The `items` table

One table for folders and files (T24). Column names are indicative; the code
step fixes them. Every rule is declared in the table's structure, with no
trigger (T27).

| Column | Holds | Rule held by the database |
|--------|-------|---------------------------|
| `id` | The identifier | Primary key; generated at random (S22) |
| `kind` | `folder` or `file` | One of the two. The pair (`id`, `kind`) is also declared unique, so that another row can refer to "this item, which is a folder" |
| `parent_id` | The folder it is in | Empty only for the top folder; at most one row may have none |
| `parent_kind` | Always the text `folder` | Derived, never written. The pair (`parent_id`, `parent_kind`) must match the (`id`, `kind`) of an existing row: that is how "the parent exists and is a folder" is held |
| `name` | The name | The five checks verified above: composed form; 1 to 255 characters; not "." or ".."; no forbidden character; no white space at either end |
| `name_key` | The name folded for comparison | Derived by the database from `name` with `casefold`, naming the `pg_c_utf8` rules explicitly; never written by code. Unique among the rows of one parent that are not deleted |
| `position` | Place in the parent's list | Unique within a parent, deleted rows included; empty only for the top folder |
| `version` | A folder's version | Present for folders, absent for files |
| `size`, `content_type`, `content_id`, `deleted_reason` | A file's own fields | Absent for folders; `size` present and not negative for files. `content_id` may be empty until U4 |
| `created_at`, `last_changed_at`, `last_changed_by_account_id`, `deleted_at`, `deleted_by_account_id`, `brought_over` | As in the entities | `deleted_reason` present exactly when a file's `deleted_at` is |
| `source_key` | Where a loaded item came from | Unique when present |

Each rule has a name of its own in the database, and the code tells
refusals apart by that name (R21).

"Not deleted" in the uniqueness of names means the row's own mark. Rows of
one folder all share the folders above them, so within one folder that is
the same as "visible". One consequence for U6, stated so it is not
rediscovered: restoring a deleted item whose name has since been taken by
another will be refused by this rule, and U6's design must say what restore
does then.

## Who may touch the table

| Database user | Rights on `items` in U3 | Why |
|---------------|-------------------------|-----|
| `app` (the server) | Read only, granted by the change file that creates the table | U3's server changes nothing. The database itself would refuse a write, whatever the code did (S25) |
| `migrator` (the change runner, in both its modes) | Owner | Creates the table and the top folder; loads samples |

U6 is the Unit that gives `app` the right to write.

## What breaks when a part fails

| Failure | Effect on browsing | Effect on the rest |
|---------|--------------------|--------------------|
| The database does not answer | The folder request fails within 3 seconds; the page shows "The list could not be loaded." | As U1: health fails, the alarm fires |
| The sample loader fails | The deployment stops before the new server and page are put in place (R24) | The environment keeps running what it ran |
| A folder's answer would be too large | That one folder fails with a logged reason (C21) | Nothing else |
| The page's script fails to load | Nothing is shown but the page's static shell | As U1 |

## Decided or changed in this step, for the maintainer to see

1. **"Ignoring upper and lower case" is exact, and narrower than the design's wording.** Rule BR2.6 says "Unicode's default case folding". The quality requirements fixed it as one character compared with one character, and this step confirmed the database does exactly that. The practical effect: "straße" and "STRASSE" are two different names. For Portuguese names there is no difference between the two readings. The design file is not edited; it is to be read with this meaning.
2. **Scalability requirement NFR11.21 is met with a different figure.** It says an answer over 5 megabytes is refused. This design refuses at 5.5 megabytes, measured on exactly what is handed to the platform (C21), because at 5 the requirement's own test of 4,000 long names (about 5.2 megabytes) would be refused, and the platform's limit is 6.
3. **Performance requirement NFR9.24 is met in a narrower form.** It says every folder answer is sent compressed. This design compresses an answer only when the caller accepts it, the answer is over 1 kilobyte, and the compressed form is the smaller one to send (P22). A tiny answer, or one made of names that do not compress, is sent as it is.
4. **U1's shared parts are changed** in nine places, listed above. They are changes to working, reviewed code and to both environments' edge settings.
5. **The sample loader runs inside the change runner**, which settles the question the requirements left for the infrastructure step.

Not decided here, though it came up: **what numbered name a folder gets.**
Rule BR2.7 would turn a folder named "report.pdf" into "report (1).pdf",
treating ".pdf" as an extension. Changing that needs a change to contract
C9's inputs, which is not this step's to make. Nothing in U3 asks for a
numbered name for a folder. It is put to the maintainer when the first Unit
that could do so is designed (U6 or U8), and rule BR2.7 stands until then.

## Open points

1. **That a compressed answer and the version header pass unchanged through the entry point and the edge** is designed for (change 8, P22, S21) but only the end-to-end tests in the test environment prove it.
2. **A folder that is renamed** would change the path shown inside every folder beneath it without changing their versions, so a page that keeps asking would keep an old breadcrumb. No Unit renames folders today (requirement FR2.4 gives Rename to files only). If one ever does, contract C3's version rule needs widening.
3. **The lists of white-space and formatting characters** are frozen at one Unicode version. A character added to Unicode later is not refused until the list is regenerated; that is a routine dependency update, with its tests.

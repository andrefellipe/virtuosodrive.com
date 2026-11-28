# Reliability Design: U3, browsing and selecting

How browsing behaves when something fails, how its data is kept whole, and
how it is deployed and put back.

Sources: `reliability-requirements.md` in
`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-requirements/`,
U3's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`),
and contracts C1, C3 and C9
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`).
U1's mechanisms R1 to R8 still apply: the 3-second limit on the database,
the deployment order, going back by moving one alias and one entry document,
compatible database changes. U3's are numbered from R20.

## R20. One answer, one moment

The full answer is produced by one statement (performance design P20), and a
database statement sees the data at one moment. The path, the list and the
version in an answer therefore always belong together. When a walk came
first and a change landed before the full statement, the answer carries what
the full statement read; the earlier walk's result is discarded.

Meets NFR10.24. The test starts a request, lets the walk finish, changes the
folder, lets the request finish, and checks that the version in the answer
matches its list.

## R21. The change step: one way to change a folder's list

The design's W7, made concrete. It is one database transaction:

1. Lock the folder's row. A second change to the same folder waits here.
2. Walk from the folder to the top; stop with "not found" if anything is deleted.
3. Check the name, or work out the lowest free one, against the items not deleted (security design S23).
4. Take the next position: one more than the highest in the folder, deleted items included.
5. Write the item.
6. Add one to the folder's version.
7. Commit. On any failure, roll back: nothing was changed.

- **Waiting for the folder.** The wait at step 1 is limited to 2 seconds or to what is left of the request's deadline less half a second, whichever is shorter, and the limit is set on the transaction itself so it cannot outlive it. A change that cannot get the folder in that time is refused by the database with its "could not obtain lock" code; the step reports that as its own outcome, "folder busy", which is a server error to the caller, a named fault in the log, and safe to try again because nothing was changed.
- **Telling refusals apart.** Because steps 3 and 4 run while the folder is held, two changes cannot take the same position or the same name. The unique indexes remain as the last defence. Every rule on the table has its own name in the database; when a write is refused, the step reads the name of the rule the database reports. The name-uniqueness rule becomes `nameAlreadyUsed`; any other is a fault (rule BR2.11). The database's message text is never read and never logged.
- **Locks.** Always on one folder only. No operation of U3 locks two, so none can block another for good. A later Unit that must lock two takes them in the order of their identifiers.
- **Transactions on U1's database access.** U1's access runs single statements on one kept connection. It gains one method that runs a piece of work as a transaction, under the same deadline (`logical-components.md`, change 6). If the work fails or the deadline passes, the transaction is rolled back where the connection still answers, and in every case the connection is discarded, as U1 already does on any failure; discarding a connection ends its transaction and releases its locks. No transaction is ever left open on a connection that is used again.
- **Who runs it in U3.** Only the sample loader, inside the change runner, on that function's own connection. The server's function never opens a transaction in U3.

Meets NFR10.26, NFR10.27. Tests: a step made to fail after its write leaves
the folder and its version untouched; twenty additions to one folder at once
all succeed with twenty different positions and the version raised by
twenty. Binding on U6, U7 and U8.

## R22. Rules the database holds

Listed in `logical-components.md` ("The `items` table"). Each has an
integration test that tries to break it with a direct write and expects a
refusal naming that rule: a second item with no parent; a parent that does
not exist; a parent that is a file; a repeated position in one folder; a
repeated name key among items not deleted; a repeated source key; each of
the five name checks; a file without a size; a folder with one.

Meets NFR10.25. Binding on U6, U7 and U8: none may drop or loosen one.

## R23. When the database or the server does not answer

| Failure | What happens | From |
|---------|--------------|------|
| The database does not answer a folder request | U1's deadline ends the request at 3 seconds with a server error; nothing partial is sent, because the answer is built only after the statement returns | U1's R1; NFR10.20 |
| The server does not answer the page | U1's shared call function gives up after 10 seconds and tries twice more; then the list goes to its "could not load" state with "Try again". The breadcrumb keeps the steps it already had, which are links that work on their own | U1's P5; NFR10.21 |
| A refresh of the folder on screen fails | The page keeps everything as it is and shows nothing new (the out-of-date note is U5's) | NFR10.22 |
| Two answers arrive out of order | Each request for a folder carries a number that rises with every folder opened; an answer whose number is not the latest is dropped | NFR10.23 |

The folder screen's five states and what moves between them are the
design's. They are held as one value, not as several flags that could
disagree.

## R24. Deploying U3

U1's order was: infrastructure, database changes, server, page. U3 puts the
sample loader between the database changes and the server:

1. Infrastructure.
2. Database changes: the new table and the top folder.
3. Sample loader, in the test environment only: the pipeline starts the change runner a second time, in its "load samples" mode. If it fails, the deployment stops here as "not put in place"; the server and the page running are still the previous ones (NFR10.30).
4. Server.
5. Page.

- **The database change only adds** a table. The version running before, which is U1's, does not read it and keeps working during and after step 2 (NFR10.28). The pull request's compatibility check runs U1's tests against the new structure.
- **The top folder is created by the change file itself**, in the same transaction as the table, so there is never a table without it. The same file gives the server's database user the right to read the table, and no other right.
- **The loader can be run again at any time** (R25).
- The rehearsal of a failing loader is done once in the test environment, with a sample entry made deliberately invalid on a branch, and recorded in `docs/records/failing-deployment.md` beside U1's.

## R25. The sample loader makes nothing twice

- Entries are processed in a fixed order, parents before children. For each, the loader looks for the item with the entry's source key. If there is none, it creates it through the change step (R21), one transaction per entry.
- An entry that is to be deleted is created and marked deleted in that same transaction, with the folder's version raised once more.
- Stopped half-way, it leaves a prefix of the entries, each complete. Run again, it finds those by their keys and continues.
- Its summary says how many it created, found, and (from U4) filled.

Meets NFR10.29. Tests: load twice and compare the table; make the fifth
entry fail, load, repair, load again, and compare with a clean load.

## R26. Going back

Going back moves the server's alias and the page's entry document to the
previous Release (U1's R4). It does not touch the database. After U3 is
deployed the previous Release is U1's, which ignores the `items` table. The
going-back rehearsal is repeated once in the test environment with U3
deployed, timed, and recorded (NFR15.20).

## R27. Backups, and nothing by hand

The table is in the one database, so U1's daily backups and restore to a
point in time cover it (NFR14.20). U3 adds no procedure for a person:
`docs/operations.md` gains only a paragraph saying what the sample loader is
and that it runs by itself (NFR15.21).

## R28. Addresses survive reload, back and forward

The page writes the folder into the address when a folder is opened, as a new
history entry, and reads it again when the browser moves through history. A
reload starts from the address. The edge already answers any path that is
not a file with the page's entry document (U1), so a folder's address loads
the page; the infrastructure step confirms that for the path U3 uses.

Meets NFR10.31.

## Open points

1. **The second half of the compatibility check** (earlier end-to-end tests against the new server) is put to the maintainer at this Unit's code plan. The half R24 relies on exists.
2. **The path the page uses for a folder's address** must be one the edge sends to the page and not to the server; confirmed at the infrastructure step.

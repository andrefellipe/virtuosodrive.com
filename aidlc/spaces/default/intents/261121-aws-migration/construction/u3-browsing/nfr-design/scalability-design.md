# Scalability and Cost Design: U3, browsing and selecting

How browsing copes with size and load, and how it stays inside the budget.

Sources: `scalability-requirements.md` and `performance-requirements.md` in
`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-requirements/`,
U3's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`),
and contract C3
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`).
U1's mechanisms C1 to C6 still apply: the entry point's limit of 50 requests
a second, the caps on running copies, one connection per copy. U3's are
numbered from C20.

## C20. The cost of a folder depends on that folder only

Three indexes, each of which also holds a rule (see `logical-components.md`):

| Index | Serves | Also holds |
|-------|--------|------------|
| The identifier | Each step of the walk towards the top | Identity |
| (parent, position) | Reading a folder's items already in order; finding the highest position used | Positions unique within a folder |
| (parent, name key), items not deleted | The name check | Names unique within a folder |

No statement U3 adds reads the table without going through one of them, so
the work for one folder is its depth plus its number of items, whatever the
table holds. This is recorded once, with a table of 50,000 items, by asking
the database how it carries out each statement and keeping its answer with
the measured speeds.

Meets NFR11.20.

## C21. An answer has a size limit that is checked, not hoped for

- **What the limit applies to.** The platform refuses a response over 6 megabytes, and what it measures is the whole response as the server hands it over: one piece of text holding the status, the headers and the body. Inside that text a plain body takes more room than its own size, because every quotation mark in it is written as two characters; a compressed body takes one third more than its compressed size, because of the encoding. So neither the answer's own size nor its compressed size is the right thing to measure.
- **What is measured.** The request steps build the response exactly as it will be handed over, and measure that. If it is over 5.5 megabytes they do not hand it over: the request fails as a server error with a small answer, and the entry says "too large" with the folder's identifier and the size (observability design O22). Because the measurement is of the very thing the platform will measure, nothing between 5.5 and 6 can slip through unlogged.
- **The smaller form is the one sent.** The server sends the compressed form only when it is the smaller of the two as handed over (performance design P22). Names made of characters that do not compress would otherwise be larger compressed than plain.
- **The arithmetic for the guarantee.** 4,000 items with the longest possible names: about 1,300 bytes a row, 5.2 megabytes as an answer. A row holds 12 quotation marks, so the plain form handed over is about 48 kilobytes larger: 5.25 megabytes, under 5.5. That holds even if nothing compresses and even if the caller accepts no compression. With ordinary names (about 200 bytes a row, 12 of them quotation marks) the plain form reaches 5.5 megabytes at about 26,000 items, and the compressed form far later.
- **Tests.** A folder of 4,000 items with 255-character names of four-byte characters is answered, with and without compression accepted, and the response handed over is under 5.5 megabytes; the page shows it. An answer built to pass the limit is refused with the right entry. The 4,000-item test is slow, so it runs in the pull request's checks but not in the quick local run.

Meets NFR11.21, with the refusal point at 5.5 megabytes of what is handed
to the platform where the requirement says 5 megabytes of the answer; the
reason is in `logical-components.md`, "Decided or changed", item 2.

## C22. No new cost

- No new AWS resource with a monthly charge. The table is in the existing database; the route is on the existing entry point; the sample loader is a mode of the existing change runner and is charged only for the seconds it runs during a deployment to the test environment.
- No new measurement series (observability design O21).
- The sample content is at most 1,000 items with no stored contents: a few hundred kilobytes in the database.

Meets NFR11.22, NFR11.24. The infrastructure step confirms the estimate has
no new line.

## C23. Connections

The folder operation uses the server's one kept connection through U1's
database access, with single statements and no transaction of its own. It
holds the connection only while a statement runs. The change step (which
holds a transaction) is used only by the loader, on the loader's own
connection.

Meets NFR11.23.

## C24. Readers never wait

Reading takes no lock. The change step locks one folder's row for its own
duration (reliability design R21); a reader of that folder meanwhile sees
the folder as it was before the change, complete, and is not held up. Twenty
readers at once are twenty short statements on up to twenty copies, each
with its own connection, under U1's caps.

Meets NFR11.25. The test holds a change open on a folder and makes twenty
folder requests; all answer with the earlier list.

## C25. What U3 hands U5 for the cost of asking

- The "unchanged" answer costs one short statement and returns no content (performance design P20).
- Every folder request's entry says which of the four outcomes it had (observability design O20), so the share of "unchanged" answers, and their number per hour, can be read from the logs once U5 exists.
- The page refreshes only when it becomes visible again (design W3). U3 itself adds no timer and so no standing cost.

Meets NFR11.26 as far as U3 can: the requirement itself binds U5, which must
bring the maintainer a monthly estimate before choosing its interval.

## Open points

1. **Quantities are guesses until the export** (U8). If a folder there would fail C21, the maintainer decides between paging (a contract change) and splitting the folder.

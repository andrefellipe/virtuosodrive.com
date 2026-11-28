# Performance and Experience Design: U3, browsing and selecting

How the speed, accessibility, device and look requirements are met.

Sources: `performance-requirements.md` and `scalability-requirements.md` in
`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-requirements/`,
U3's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`),
and contracts C1 and C3
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`).
U1's mechanisms P1 to P7 still apply; U3's are numbered from P20.

## P20. A folder is answered with one or two statements, whatever its size or depth

| Caller sends | Statements | What they do |
|--------------|------------|--------------|
| No version | 1 | "Everything": walks from the folder up to the top, and reads the folder's items that are not deleted, in order, in one statement |
| A version | 1, then 1 more only if the version is out of date | "The walk": from the folder up to the top, returning the path, the folder's version, and whether anything on the way is deleted. If the folder is hidden: not found. If the version matches: "unchanged". Otherwise: "everything" |

- The walk is one statement that follows parents inside the database, with a limit of 64 levels (S26). It does not grow with depth in number, only in work, and reads at most 64 rows by their identifiers.
- "Everything" reads the items through the index on (parent, position), which is already in the order wanted, so nothing is sorted.
- "Everything" contains the walk: it finds for itself whether the folder or anything above it is deleted, and answers not found if so. It does not rely on a walk made a moment earlier, so a folder hidden between the two statements is still answered correctly.
- Because "everything" is one statement, the list, the path and the version in an answer are from one moment (reliability design R20). The version in the answer is always the one "everything" read, never the one the earlier walk read.
- An "unchanged" answer runs the walk only: no item is read (NFR9.23), and visibility is still checked (S27).

Meets NFR9.22, NFR9.23. The test counts statements for a small shallow
folder and a large deep one in each of the two cases.

## P21. Where the 2 seconds go

For the 500-item folder, server warm, reader in Brazil:

| Part | Budget | Held by |
|------|--------|---------|
| Journey to the server and back, including the edge | 0.4 s | Not in our hands; U1's choice of Region |
| Entry point and server, outside the database | 0.1 s | U1's P1: small bundle, work done once per copy |
| Database: one statement over an index, 500 rows | 0.1 s | P20 |
| Building, compressing and sending about 100 kilobytes | 0.1 s | P22 |
| Receiving, parsing, and showing 500 rows | 0.5 s | P24 |
| Margin | 0.8 s | |

The server's part is 0.3 seconds against NFR9.21's 0.5. NFR9.20 is judged by
the maintainer's five timed opens from Brazil; NFR9.21 by 100 requests in the
pipeline, which fails the run above 500 milliseconds at the 95th.

## P22. The server compresses its own answers

- The edge does not compress answers it is told not to keep, and folder answers must not be kept (S28). The entry point does not compress either. So the server does, with gzip from the platform's built-in library (no new dependency).
- It can only do so when it knows the caller accepts gzip, which needs the edge to pass that request header on (`logical-components.md`, change 8), and when an operation may hand back a compressed body with its own headers (change 4).
- A compressed body cannot travel as text between the server and its platform; it is carried in an encoded form that is one third larger than the compressed bytes. So compressing is worth it only when the compressed form, encoded, is smaller than the plain one. The server builds the plain answer, and compresses when all three hold: the caller accepts gzip, the plain answer is over 1 kilobyte, and the encoded compressed form is smaller. Otherwise it sends the plain answer.
- A list of ordinary names compresses to a fraction of its size, so the 500-item answer travels as roughly 30 to 40 kilobytes including the encoding.
- The size check of C21 is made on whichever form is sent, measured as the platform receives it.

Meets NFR9.24 in a narrower form than it is written ("every folder answer
is sent compressed"): see `logical-components.md`, "Decided or changed",
item 3. An integration test measures the 500-item sample answer before
compression (150 kilobytes or less); unit tests cover the three conditions;
an end-to-end test asserts that the 500-item answer arrives compressed
through the whole path.

## P23. The page keeps the version and sends it back

- The page holds, in memory, the version that came with the folder on screen, and sends it with every refresh of that folder (design W3). It is not kept between page loads.
- The browser's own store is not involved: answers are marked not to be stored (S28), so the page handles "unchanged" itself and simply keeps what it shows.
- Requests go through U1's shared call function (P5 there): 10-second limit, two further tries for reads. That function is changed for this (`logical-components.md`, change 7): the caller may pass the version it holds, "unchanged" comes back as an outcome of its own and is never retried or treated as a failure, and a success returns the version with the content. As built by U1 it would have reported "unchanged" as a failure.

## P24. Showing and selecting many rows

- The list is an ordinary table with one row per item; nothing is drawn only when scrolled to. That keeps the table whole for screen readers, for the browser's own find-in-page, and for Ctrl-A, and it is fast enough at the sizes designed for.
- Each row is its own component, keyed by the item's identifier and told only whether it is selected and whether it is focused. When the selection changes, only the rows whose state changed are redrawn; a range of 500 redraws 500 small rows once.
- The selection is a set of identifiers, so asking "is this row selected" does not depend on how many are.
- A refresh replaces the list of rows; rows whose identifier and content are unchanged are not redrawn, and the scroll position is not touched (rule BR4.8).

Meets NFR9.25 (measured once by hand with a slowed processor). For the
guaranteed limit of 4,000 rows (C21) a page test shows them and selects them
all; it asserts correctness, not a time.

## P25. The bundle stays inside its budget

- U3 adds components and about a dozen small SVG icons, and no library (T21). The icons are imported as files with fingerprinted names, stored for a year like the rest (U1's P4), not embedded in the script.
- U1's check in the pull request (300 kilobytes compressed for the first load) is unchanged and still fails the build above it. The page was 75 kilobytes after U1.

Meets NFR9.26, NFR8.21.

## P26. After a quiet period

Nothing new. The folder operation is in the same function as U1's, opens the
same single connection, and loads no extra data when a copy starts. U1's
figure of 5 seconds applies and is measured the same way.

Meets NFR9.27.

## P27. Accessibility is built into the structure, then scanned

| Requirement | How |
|-------------|-----|
| NFR6.26 | A native table with column headings; the kind column's heading is hidden visually but present; each row exposes its selected state; each icon has a text alternative; the page's title is the folder's name |
| NFR6.21 | The table body is one Tab stop with a "roving" focus: one row is focusable at a time and the arrow keys move it. Keys are handled as the design's table says; none relies on a combination an operating system keeps |
| NFR6.22 | One polite status line above the list, always present in the page, whose text changes: folder opened, count selected, a selected row gone. Focus is never moved to it |
| NFR6.23 | The focus ring and the check mark use colours checked against both row backgrounds; the values are recorded with the styles |
| NFR6.24 | Tick boxes, actions, breadcrumb steps, "Try again" and "Clear" have a minimum size of 44 by 44 pixels set in the styles, on touch devices and below 768 pixels |
| NFR6.25 | The placeholder rows' movement is inside a rule that applies only when the device has not asked for reduced motion |
| NFR6.20 | The end-to-end tests run the scanner U1 introduced on each state of the list, with and without a selection, at both widths |

The not-found, could-not-load and empty states are reached in the end-to-end
tests by, respectively, an identifier that does not exist, blocking the
server's address in the browser, and the empty sample folder.

## P28. Devices and browsers

- One layout rule at 768 pixels switches between the table and the stacked rows; tick boxes are shown when the device's main pointer is coarse, whatever the width.
- Long names wrap inside their cell and never widen the page; the breadcrumb collapses as the design says. The sample set has a 255-character name and a path twelve deep for the test at 320 pixels.
- The end-to-end tests run in three engines at two widths, as U1's do, and one test uses touch input. Safari on a Mac and an iPhone, Edge, and one previous version of each are checked by hand at the demo and recorded.

Meets NFR7.20, NFR7.21, NFR7.22.

## P29. The look

The existing styles for the list, the breadcrumb and the action row are
carried into the page's own stylesheet, with the accepted changes. The
maintainer compares by eye at the demo (NFR8.20).

## Open points

1. **The 0.4 seconds for the journey is an estimate.** The hand measurement decides.
2. **Showing 4,000 rows without drawing only the visible ones** will be slow on a phone, though correct. If the export shows folders of that size, drawing only what is visible is the remedy, at a cost to find-in-page and screen readers; that would be decided then.

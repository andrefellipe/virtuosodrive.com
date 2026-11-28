# Security Requirements: U3, browsing and selecting

What browsing must do to stay safe. U3 is the first Unit that shows content
to visitors and the first that takes an identifier from an address, so it
sets the pattern for reading. It changes nothing through the site and holds
no personal data.

Sources: this Unit's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`,
`rules.md` and `entities.md` beside it), requirements NFR1 to NFR5
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contracts C1, C3 and C9
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
and the analysis of the old code
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`).

U1's security requirements still hold and are not repeated: the access
password in front of everything while the environments are private, TLS,
encryption at rest, the pipeline's identities, pinned dependencies, the
scans. In particular the folder route sits behind the same access password
as everything else while the environments are private; "anyone may read"
(rule BR1.1) means anyone who has got past it. U3's own requirements are
numbered from .20 (the numbering is explained in
`performance-requirements.md`). A requirement marked **Binding** must also be
met by the later Units it names; each of them repeats it in its own quality
requirements.

## Who may do what

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR2.20 | U3 adds exactly one operation to the server, and it only reads. No route added by U3 accepts a method other than GET | The existing test that lists the server's operations and fails on any other method | NFR2; rules BR1.1 |
| NFR2.21 | In U3 the name operations and the step that changes a folder's list (design W5, W7) cannot be reached from any route; only the sample loader calls them. **Binding on U6 and U7**: when they add change routes, every one reaches these operations only after the caller has been checked as contract C8 requires, and every write goes through the one step of W7 | A test lists U3's routes and finds only the folder read; review | NFR2; contract C9 (guarantees) |
| NFR2.22 | The sample loader can be started only by the pipeline, with the environment's own identity, and refuses to run in production by its own check as well as by not being wired there | Inspection of the definitions; a unit test of the refusal with the environment set to production | NFR2; rules BR2.10 |
| NFR2.23 | Reading needs no account now and will need none after the switch; nothing in U3 makes a read depend on a session. **Binding on U2**: adding accounts must not close browsing | An end-to-end test reads a folder with no session; the test stays in the suite for good | NFR2; FR1.1; rules BR1.1 |

## Input

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR3.20 | The folder identifier is accepted only as `root` or in the exact form of a generated identifier; anything else is answered "not found" without reaching the database | Unit tests with an empty value, markup, a path fragment (`../`), a query fragment, a value of 10,000 characters, and an identifier in the wrong letter case | NFR3; rules BR1.10 |
| NFR3.21 | The version a caller says it holds is read only if it is at most 128 characters and of the form the server issues; otherwise it is ignored and the full answer is sent. A version that comes back marked as "weak" by something on the way (compression can do that) is still recognised as the one issued | Unit tests with a malformed, an over-long and a foreign value, and with the issued value in its weak form. An end-to-end test asks twice for the same folder through the whole path and gets "unchanged" the second time | NFR3; rules BR1.8 |
| NFR3.22 | Every database statement U3 adds passes its values as parameters, including the one that walks from a folder up to "All" | The existing lint rule; integration tests of each statement with a name containing a quote and a query fragment | NFR3; project rule |
| NFR3.23 | A name is put into the page only as text: in rows, the breadcrumb, the page's title, announcements and text alternatives. No name is ever part of an address | The existing lint rule against React's escape hatch. An end-to-end test with three sample names that are valid under the name rules: `<b>x<b>`, `<script>alert(1)<script>` and `<img src=x onerror=alert(1)>`; it asserts each is shown exactly as written and that nothing runs. A name cannot contain "/", so the story's own example `<b>x</b>` cannot be stored; a unit test of the page gives the list that exact text as a row's name and asserts the same | NFR3; FR1.6; rules BR3.4 |
| NFR3.24 | The name rules have one definition, and what decides whether two names are the same is computed in one place, so the check and the stored uniqueness cannot disagree. **Binding on U6, U7 and U8**, which write names | The table "Name cases" below, run both through the name check and as direct writes to the store; every case must give the listed result in both | NFR3; rules BR2.4 to BR2.7 |
| NFR3.25 | The walk from a folder up to "All" stops after 64 levels and treats more as a fault, so that damaged data cannot make a request run for ever | Integration test with a chain of 65 folders | NFR3; reliability |

### Name cases

"Same" means the second name is refused as already used when the first is a
visible item of the folder. Case is compared one character to one character
(Unicode's simple case folding), which is the exact meaning this step gives
to "ignoring upper and lower case" in rule BR2.6; it does not depend on any
language setting.

| # | Input | Expected |
|---|-------|----------|
| 1 | "é" as one character, and "e" followed by a combining acute accent | The same name; stored as the one-character form |
| 2 | "Exam.pdf" and "exam.PDF" | The same name |
| 3 | "prova" and "próva" | Different names |
| 4 | "I" and "ı" (dotless i) | Different names |
| 5 | "straße" and "STRASSE" | Different names (one character is never compared with two) |
| 6 | " exam.pdf " with an ordinary space, a no-break space or an ideographic space at either end | Stored as "exam.pdf"; the same name as "exam.pdf" |
| 7 | "exam  1.pdf" with two inner spaces | Stored as written; different from "exam 1.pdf" |
| 8 | A name of nothing but spaces; a name of nothing but a zero-width space | Refused: nameEmpty |
| 9 | "a", a zero-width space, "b"; a name containing a right-to-left override | Refused: nameHasForbiddenCharacter |
| 10 | A name containing a tab or a line break inside it | Refused: nameHasForbiddenCharacter |
| 11 | "." and ".." | Refused: nameHasForbiddenCharacter |
| 12 | "a/b" | Refused: nameHasForbiddenCharacter |
| 13 | 255 characters, each an emoji | Accepted |
| 14 | 256 characters | Refused: nameTooLong |
| 15 | "...", ".profile", "2019.1" | Accepted |

## What an answer may reveal

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR3.26 | The answers for a folder that never existed, a deleted folder, a folder inside a deleted folder, and an identifier of the wrong form are identical in status, headers and content, apart from the request identifier; and they are the same whether or not the caller sent a version it holds | Integration test compares the four, each asked with no version and with a version | FR1.8; rules BR1.4, BR1.10 |
| NFR3.27 | A folder's answer contains nothing about hidden items: no count of them, no gap that reveals them, no deletion mark, no position, no account identifier, no `sourceKey`, no `contentId`. **Binding on every later Unit that adds to the answer**: a field is added only if the contract of that time names it, and the test's list of allowed fields is changed in the same pull request | Integration test asserts that an answer's fields are exactly those contract C3 names for this Unit, with deleted items present in the folder | FR1.8; rules BR1.7 |
| NFR3.28 | "Unchanged" is said only of a folder that is visible now. A caller that holds the current version of a folder which has since been deleted, or whose parent or any folder above has been deleted, is answered "not found", never "unchanged". (Deleting a folder raises its parent's version, not its own, so the version alone cannot tell.) **Binding on U5 and U6** | Integration test: read a folder three levels down and keep its version; mark its grandparent deleted; ask again with that version; the answer is "not found" | FR1.8; rules BR1.4, BR1.8; design W1 (step 3 comes before step 4) |
| NFR5.20 | No log entry contains a file's or folder's name: not for a folder request, not from the sample loader, and not when the database refuses a write. The database's own error text, which can quote a name, is never written as it comes; the entry carries the kind of refusal, the folder's identifier, and for the loader the sample entry's key | Unit tests of the log entry for a folder request, for a loader failure, and for a refused write whose database message contains a name | NFR5; U1's NFR5.2 |
| NFR2.24 | Identifiers cannot be guessed or walked: they are random, with at least 122 bits that an attacker cannot predict, and carry no order or time | Inspection that the database's random generator makes them and that no identifier is accepted from a caller; an integration test that 1,000 identifiers made in a row are all different and all of the random form | contract C1 (identifiers); rules BR2.1 |
| NFR2.25 | A folder's answer is not kept for reuse by anything between the server and the browser, so a deleted item disappears for every reader at their next request | The answer is marked not to be stored, asserted in an integration test and again end to end through the whole path; inspection of the definitions shows the content delivery network keeps no copy of the server's answers; an end-to-end test changes the sample folder between two requests and sees the change in the second | FR1.8; rules BR1.3 |

Identifiers that cannot be guessed are not what keeps content private; while
the environments are private the access password does that, and after the
switch reading is open to everyone by design. They are required so that a
deleted item's former address tells nobody anything, and so that the number
and order of items cannot be read off the identifiers.

## Carried from U1 unchanged

| ID | What | Why it needs nothing new |
|----|------|--------------------------|
| NFR1.20 | No Firebase or Google library; no request to an outside address when browsing | U3 adds no library and bundles its icons. Checked by the existing pull request search and the existing end-to-end check, which now also visits a folder |
| NFR4.20 | Encryption at rest and TLS | The new records live in the same encrypted database, reached over the same verified connection |
| NFR5.21 | No personal data | Names of files and folders are content, not personal data. The account fields on the records stay empty until U6 |

## Threats considered

| Threat | Answer |
|--------|--------|
| Markup or script in a name runs in a reader's browser (the old site's fault) | NFR3.23 |
| A crafted identifier reaches the database as part of a statement | NFR3.20, NFR3.22 |
| A deleted item is found by guessing or by a different answer | NFR3.26, NFR3.27, NFR2.24 |
| A page that keeps asking about a folder is told "unchanged" for ever after the folder was hidden | NFR3.28 |
| A copy of a list kept on the way still shows a deleted item | NFR2.25 |
| Two names that look the same are used to mislead (one "exam.pdf" replaced by another) | NFR3.24 |
| A very long or malformed header, or damaged data, ties up the server | NFR3.21, NFR3.25; the 3-second limit on the database from U1 |
| Someone downloads the whole tree by asking for every folder | Not prevented: after the switch the content is public by design. The entry point's overall limit (U1's NFR11.3) bounds the rate |
| The sample loader is used to plant content in production | NFR2.22 |
| A later Unit adds a change route that skips the name rules | NFR2.21; the store holds the uniqueness rule (rules BR2.6, BR2.11) |

## Open points

1. **Names in the page's address.** The address carries the folder's identifier only (NFR3.23), so a shared link shows no name. That is less readable than a name would be, and is the price of names that can change and contain anything.
2. **Old names that fail the name rules** are U8's to deal with (design open point 7). The rules here are not loosened for them.

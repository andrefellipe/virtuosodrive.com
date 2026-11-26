# Performance Design: U1, the thin slice

How the slice meets its speed targets and the qualities required of its page.
The parts named here are described in `logical-components.md` beside this
file.

Sources: the performance requirements
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/nfr-requirements/performance-requirements.md`),
with `security-requirements.md`, `scalability-requirements.md`,
`reliability-requirements.md`, `observability-requirements.md` and
`tech-stack-decisions.md` beside it; the slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`);
contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`);
and the answers in `nfr-design-questions.md`.

## P1. Where the time goes (NFR9.1)

The target is 1 second for 95 of 100 site-information calls once warm,
measured at the server. The students are in Brazil and the server in
`us-east-1`, so what a student experiences adds the journey there and back.

| Step | Budget, warm |
|------|--------------|
| Edge check and forwarding | 50 ms |
| Server entry point | 50 ms |
| Server: verify, validate, log | 50 ms |
| Database: one read by key | 50 ms |
| Margin | 800 ms |

The margin is deliberately wide: the slice does almost nothing, and the figure
recorded when it is measured is the baseline later Units are compared with.
The journey between Brazil and the Region is outside this budget and is
measured once from a real connection, alongside NFR9.3.

## P2. The first request after quiet (NFR9.2)

A function that has not run for a while starts a fresh copy, which must load
its code, read its secrets and open a database connection. The target is 5
seconds.

- **Small code.** The server is bundled into one file containing only what it uses: its own modules, `pg`, Zod, the logging library, and no AWS client it does not call.
- **arm64, Node.js 24** (technology decisions).
- **Work done once per copy, not per request:** reading configuration and secrets, and opening the database connection. The connection is opened on the first request that needs it and kept.
- **Not kept warm.** Paying to keep a copy always ready is not justified for a study site; the maintainer confirmed this.
- **The database's own waking time** is the unknown. If the service chosen at Infrastructure Design pauses when idle, its time to wake counts against these 5 seconds; a choice that cannot meet them goes to the maintainer with the price difference.

## P3. One database connection per copy (NFR9.1, with scalability NFR11.5)

Each running copy of the server holds at most one connection and reuses it
for every request it serves. A function copy serves one request at a time, so
one connection is always enough.

- **One deadline of 3 seconds per request for everything the database is asked** (rules BR1.1, BR1.3; NFR9.4): opening a connection if one is needed, and the statement, together. Within it, opening may take at most 2 seconds.
- A connection found broken before the statement is sent is discarded and opened again, once, inside the same 3 seconds. A statement that was sent is never sent a second time by the server.
- When the deadline passes, the request fails and the connection is discarded; the next request opens a new one.
- No connection pooler is placed in front of the database in this Unit: the cap on copies (scalability design) keeps the number of connections below the database's limit. A pooler has a fixed cost and is reconsidered only if measurements call for it.

## P4. The page's files (NFR9.3, NFR9.5, NFR9.6)

- **Budget.** At most 300 kilobytes compressed for everything the page loads at first. React and React DOM take roughly a sixth of that; the rest is headroom for sixteen screens. The built size is checked in the pull request and the check fails above the budget.
- **Styles.** Only the parts of Bootstrap's styles the screens use are included, not the whole stylesheet (subject to the approval of Bootstrap as a bundled dependency, still owed).
- **Names that change with content.** Every script, style and image is built under a name containing a fingerprint of its content, and served with an instruction to store it for a year and never ask again.
- **The entry document** (`index.html`) is served with an instruction never to store it, by browsers or by the edge. It is small, and it is what points at the current fingerprints.
- **Going back takes effect at once** for that reason: putting back the previous Release puts back its entry document, which points at its own files, which are still in the store.
- **Compression** is applied by the edge.

| What | Stored by browsers and the edge |
|------|-----------------------------------|
| Fingerprinted files | One year, immutable |
| Entry document | Never |
| Server answers | Never |
| The password page | Never |

## P5. The page's own patience (NFR9.7)

One shared function makes every call to the server:

- gives up after 10 seconds;
- for reads only, tries again after 1 second, and once more after 3 seconds;
- sends a fresh request identifier per attempt;
- treats an answer with status 503 or 429 as worth another try for a read, whether or not its body is a Problem (the entry point's refusal at the request limit is a 429 that is not one);
- treats a 401 that is not a Problem as "access needed" and reloads the page (security design, S1);
- treats every other Problem answer as final.

Later Units use the same function; change operations never retry.

## P6. The page itself (NFR6.1, NFR6.2, NFR7.1, NFR8.1)

- **Three views**, one component: checking, answered, could not reach. The status line is a live region so that a screen reader announces each change; "Try again" is a real button, focused when the could-not-reach view appears.
- **Accessibility scan** in the end-to-end test, in each of the three views and on the password page. The scanner is a library still to be approved.
- **Browsers.** The end-to-end test runs in Chromium, Firefox and WebKit at 320 and 1280 pixels wide. Edge and the previous versions are checked by hand once.
- **Look.** The existing logo, favicon and header styling are reused as they are. The password page uses the same header.
- **Without JavaScript**, the entry document itself carries the site's name and a sentence saying the site needs JavaScript.

## P7. Measuring

| Requirement | How | When |
|-------------|-----|------|
| NFR9.1 | 100 site-information calls in a row from the pipeline after the end-to-end tests; the server's own durations are read from its measurements and the 95th is recorded in the run | Every merge; fails the run above 1 second |
| NFR9.2 | One call after 30 minutes of quiet, by hand | Once, recorded |
| NFR9.3 | The browser's tools, throttled to a fast mobile connection | Once, recorded |
| NFR9.5 | Size check on the built files | Every pull request |
| NFR9.6 | The end-to-end test reads the headers | Every merge |

## Open points

1. **NFR9.1 measured from the pipeline** tells how fast the server is, not how fast it feels in Brazil. The one measurement from a real connection covers that, once.
2. **A paused database** could break NFR9.2; settled with the database choice.
3. **Bootstrap's size** depends on how much of it the sixteen screens need; the budget is checked from the first pull request so that growth is seen early.

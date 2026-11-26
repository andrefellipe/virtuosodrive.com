# Quality Design: Questions for U1, the thin slice

This step turns the slice's quality requirements into a design: how each one
is met with the technology chosen. Most of it follows from decisions already
made, so only two questions are left for you.

It draws on the quality requirements and technology decisions
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/nfr-requirements/security-requirements.md`,
with `performance-requirements.md`, `scalability-requirements.md`,
`reliability-requirements.md`, `observability-requirements.md` and
`tech-stack-decisions.md` beside it), the slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`)
and contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`).

## Q1. [Maintainer] How is the access password asked for?

You chose "one shared password, asked for by the browser". The browser's own
password box sends the password in the same place where, from Bolt 5,
signed-in sessions will travel (contract C1), so the two would collide: once
accounts exist, a signed-in request could not also carry the access password.

A. A small password page of the site's own: you type the password once, the device remembers it for 30 days, and it never touches the place sessions use. One more tiny page to build; it disappears from production at the switch
B. The browser's own password box now, replaced by option A in Bolt 5 when accounts arrive. Nothing extra to build now; the change lands in the middle of the accounts work
C. Decide for me, and explain the choice so I can change it at approval
X. Other (please specify)

[Answer]: A

## Q2. [Developer] Which tool applies changes to the database structure?

Left for this step by your planning document. Changes are plain SQL files
kept in the repository, applied in order by the pipeline, each recorded so it
is never applied twice. Any new tool needs your approval under the project
rule.

A. node-pg-migrate (MIT licence): an established tool for exactly this, built on the `pg` library already chosen; one new dependency
B. A small runner written for this project (about a hundred lines, with its own tests) on top of `pg`: no new dependency, but it is code you own and must trust
C. Flyway (Apache 2.0 licence): very widely used; needs Java in the pipeline and where the changes are applied
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Access password (Q1): a small password page of the site's own; the device remembers it for 30 days in a cookie, which never touches the place sessions use. This replaces "asked for by the browser".
- Database changes (Q2): node-pg-migrate (MIT), approved as a new library, applying plain SQL files.
- Not asked, chosen by the designer: the page and the server share one address, as contract C1 already says; calls to the server pass through the content delivery network, so the access password is checked in one place for both.
- Not asked, chosen by the designer: the check at the network's edge holds only a scrambled form of the password, never the password itself.
- Not asked, chosen by the designer: database changes are applied by a small function running next to the database, which the pipeline starts; the pipeline never connects to the database itself.
- Not asked, chosen by the designer: the server is not kept warm. The first request after a quiet period is slower, within the 5 seconds already agreed.
- Not asked, a limit stated plainly: the 50-requests-a-second limit protects the server. The page's static files have no such limit without a paid protective service, which is not included.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

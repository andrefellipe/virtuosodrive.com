# Pipeline Design: U3, browsing and selecting

What changes in the pipeline U1 built
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/infrastructure-design/cicd-pipeline.md`)
so that browsing is checked, deployed and verified. The four workflows
(`checks`, `deliver`, `go-back`, `compare`), their identities, the order of
a deployment and the way back all stay. U3 adds one step to a deployment,
some checks, and some verification.

It implements U3's reliability design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-design/reliability-design.md`,
R24 to R26) and security design (`security-design.md`, S21, S28, S31), with
`performance-design.md` (P21, P22), `scalability-design.md` (C21),
`observability-design.md` (O24, O25) and `logical-components.md` supplying
what is checked. What is tested comes from U3's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`)
and contract C3
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`);
the building blocks are in
`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`.

## Precondition: U1 is deployed first

**U3's pull request is not merged until U1 has been deployed to both
environments by its own pipeline and the maintainer has seen it working.**

The team's practice says so already: "The owner checks the deployed slice
and approves it before the second piece starts." On 2026-11-26 the
maintainer approved U1 on its local checks, having been told it had not been
deployed, and chose to carry on with the design of U3. That let design work
proceed; it is not taken here as leave to deploy U3 on top of an undeployed
U1. Whether U3's code may be written before U1 is deployed is put to the
maintainer at U3's code plan; merging before is ruled out by this document
whatever the answer.

The reasons are practical, not only the rule:

- U1's first deployment carries risks of its own that nothing has yet proven (the setup script, the identities' permissions, the edge function, the database's version). If U3 rode on the same first run, a failure could not be placed in U1 or in U3.
- This design describes U3's deployment as a change to a running system: one changed setting in Terraform's plan, a smoke check of what is running, a previous Release to go back to. None of that is true of a first deployment.
- The rehearsal "going back with U3 deployed" needs an earlier Release in the environment to go back to.

Everything below assumes the precondition holds.

## What a deployment does now

U1's order was infrastructure, database, server, page. U3 puts one step
between the database and the server. All the steps of a deployment are in
the shared deploy action (`.github/actions/deploy/action.yml`), which the
test job and the production job both call; so the new step goes there too.

| # | Stage | Change in U3 | If it fails |
|---|-------|--------------|-------------|
| 1 | Build | The change runner's package now also holds the Drive module and the sample set, because the sample loader is a mode of the change runner | Nothing changed |
| 2 | Infrastructure: plan, apply | For U3's own Release the plan shows the edge's rule for headers passed to the server changed in place, two new saved searches, and the dashboard changed | Not put in place |
| 3 | Smoke check of the running version | Unchanged, and it must stay exactly U1's check: at this moment the running server is still the previous Release, which has no folder route. It shows that the change at the edge did not break what is running | Not put in place |
| 4 | Database changes | The change runner applies the file that creates the `items` table and the top folder. The step now hands the number of the runner's published version to the next step | Not put in place |
| 4a | **Sample content (new)** | A step in the shared action that runs only when the action's environment input is `test`. It calls the same published version of the change runner a second time, with the instruction to load samples, and waits for its answer with the same no-retry setting as stage 4 | Not put in place: the server and page still running are the previous ones |
| 5 | Switch: server, then page | Unchanged | Put back, as U1 |
| 6 | Smoke check of the new version | The smoke check is told that this Release has browsing, and then also asks for the top folder and expects an answer of the right shape (in production an empty list, until the migration) | In place but failing; the Release is blocked |
| 7 | Verify (test only) | The end-to-end tests now include browsing and selecting; four gates, below | The Release is blocked; production cannot receive it |
| 8, 9 | Approval; production | Unchanged. Stage 4a is skipped by its condition | As U1 |

**The smoke check has two uses and must not confuse them.** One command
serves stage 3, stage 6 and `go-back`. Stages 3 and `go-back` check a
Release that may be older than U3 and has no folder route; asking it for a
folder would get "not found" and wrongly fail a deployment after its
infrastructure was already changed, or mark a successful going-back as
failing. So the folder request is made only when the caller says the
Release under check has browsing. Stage 6 says so. Stage 3 does not.
`go-back` does not for now; from the first Release after U3 it can, and
that is a one-line change made when U4 is deployed, when both the Release
gone back from and the one gone back to have browsing. Unit tests of the
smoke check cover both cases, against a stand-in server with and without
the route.

**Stage 4a is kept out of production in two ways** (security design S31):
the step's condition on the action's environment input, and the loader's
own refusal when its environment is production. If the first failed, the
second would stop a production deployment before the switch, not load
samples. Both are tested: a check in the pull request reads the action file
and fails if the step has no such condition; a unit test covers the
refusal.

**How the instruction is passed.** As the call's input, an object naming
the mode. The change runner's entry point takes no input today. It is
changed to treat a missing input, an empty one, and one that names no mode
all as "apply database changes", which is what it did in U1; only an input
naming the load-samples mode loads samples. So an older pipeline calling a
newer runner, or the reverse, applies database changes and nothing else.

## Gates added to stage 7

Each fails the run, and with it blocks production, exactly as U1's
end-to-end tests do.

| Gate | What it does | Why it is a gate |
|------|--------------|------------------|
| Unchanged through the whole path | Asks for a sample folder, then asks again with the version received, through the public address, and expects "unchanged" | Proves the edge passes the caller's version in and the version header out. Nothing short of a deployed environment can |
| Compressed through the whole path | Asks for the 500-item sample folder accepting gzip and expects a compressed answer that unpacks to the right list | Proves the edge passes the accepted encodings in, and that the entry point and the edge carry a compressed body out |
| Folder speed | 100 requests for the 500-item sample folder, paced at 5 a second; fails if the 95th of the 100 durations the server reports is over 500 milliseconds | Performance requirement NFR9.21 |
| Not stored | A folder answer arrives marked not to be stored, and the edge reports that it fetched it from the server and did not serve a kept copy, through the public address | Security design S28 |

The first two are also what tells the maintainer that the one
infrastructure change of this Unit works.

**How the folder-speed gate reads the server's own duration.** Requirement
NFR9.21 is "measured at the server". The pipeline cannot read the server's
log: its identity is denied reading log entries, by design (U1), and that
stays. So the folder operation reports the time it took in a response
header, the standard `Server-Timing`, and the gate reads that. It is one
more small use of the change that lets an operation name response headers
(`logical-components.md`, change 4). The figure covers the operation's
work up to the built answer; it shows nothing that the time a request takes
does not already show to any caller. A request refused by the entry point's
limit would not be a measurement, which is why the gate paces itself at 5 a
second against the test environment's limit of 10; a refused request fails
the gate as a fault of the gate, not as slowness.

## `checks`: the pull request

U1's steps all stay. What they now cover:

| Step | Added by U3 |
|------|-------------|
| Unit and integration tests with coverage | The Drive module, the selection function and the page's components; one integration test per database rule and per statement; the name cases through the check and as direct writes; the 4,000-item answer. The 80% floor is one figure over U1's and U3's code together |
| Compatibility | The first time this step has an earlier version to protect: U1's tests run against the database with the `items` table added |
| Build | The page's size limit of 300 kilobytes, now with the folder screen and icons in it |
| Terraform's own tests | One assertion more: the edge passes exactly the five headers to the server |
| Forbidden things | Unchanged |
| A check of the deploy action's file | The "sample content" step exists and runs only when the environment is `test` |

The slow 4,000-item test runs here on every pull request and is left out of
the quick local command developers run while working; the single
verification command chosen for each finished Unit (`npm run check` and the
Terraform tests) includes it.

## End-to-end tests added

Run in three engines at two widths against the test environment's sample
content, as U1's are.

| Journey | Covers |
|---------|--------|
| Browse | Open "All"; go three folders down; come back by the breadcrumb; reload; back and forward; the folders "2019.1" and "1º Período" |
| The views of the list | Loading, populated, empty, could not load (the server's address blocked in the browser), not found (an identifier that does not exist); the accessibility scan in each |
| Select with a mouse | One row, two rows apart, a range of fifteen; the actions that appear; "This is not available yet." |
| Select with the keyboard only | The same selections with no pointer |
| Select by touch | Tick boxes at 320 pixels wide; sizes of everything that can be tapped |
| Names as text | The three sample names that look like markup |
| Hidden items | The deleted sample file and folder are not listed; the address of the deleted folder shows the not-found view |
| No session | A folder is read with no session; this test stays for good |
| No outside address | U1's check that the page contacts no address but its own now also opens a folder, so that the icons are covered |

The tests find sample folders by walking from "All" by name, never by a
fixed identifier, because identifiers are generated in each environment.

**One test of the design is moved.** Security design S28 asks for an
end-to-end test in which content changes between two requests and the
second shows it. Nothing in U3 can change content through the site, and a
test-only way to change sample content in a deployed environment would be a
write path with no other purpose. The behaviour is tested in U3 at the
server, against a real database, by changing a folder between two requests.
The end-to-end version is written in U6, which is the first Unit that can
change content through the site. Until then the "not stored" gate above
stands in for it end to end: it shows that the edge fetched the answer from
the server and kept no copy, which is the only way a stale list could reach
a reader.

## Owed by later Units

Promises this Unit makes on behalf of later ones. The conductor of the work
reads this table when each named Unit's design begins, and that Unit's
design must take the item up or say why not.

| Owed by | What | From |
|---------|------|------|
| U6 | An end-to-end test: content is changed through the site between two requests for a folder, and the second request shows the change | Security design S28; security requirement NFR2.25 |
| U4 | Tell `go-back`'s smoke check that Releases have browsing, once both the Release gone back from and the one gone back to do | The smoke check, above |
| U5 | A monthly cost estimate for its asking interval, accepted by the maintainer, before its code plan | Scalability requirement NFR11.26 |
| U6 | What restoring an item does when its name has been taken meanwhile | `logical-components.md`, the `items` table |

## `go-back`, `compare`

Unchanged in what they do. Going back moves the server and the page to the
previous Release and leaves the database and the edge's settings as they
are; U1's Release works with both (reliability design R26). Its smoke check
is U1's, as explained above. The rehearsal is repeated once with U3
deployed and recorded.

## Reversing each change of this Unit

| Change | How it is reversed | Is reversal ever needed to restore service? |
|--------|--------------------|---------------------------------------------|
| The server and the page | `go-back`, within minutes, with no rebuild | Yes; this is the ordinary way back |
| The edge passing two more headers | A pull request that removes them from the definition, merged and deployed by the pipeline like any change. `go-back` does not touch Terraform | No. A Release that does not read the headers ignores them, so going back to U1's Release works with the headers still passed |
| The `items` table | Not reversed. Database changes only add (U1's rule); a table no Release reads is harmless. A later change may drop it once no Release in reach uses it | No |
| The sample content | Not removed by going back. It is in the test environment only and invisible to a Release without browsing | No |
| The saved searches and the dashboard view | A pull request removing them | No |

Security effect of the one infrastructure change, as the operation-phase
rules ask: two more request headers reach the server. Neither carries a
credential or a cookie. Each is read by the server only within the limits
of security design S21 (bounded length, one accepted form) and performance
design P22 (looked at only for the word "gzip"). Nothing that was refused
before is let through, and nothing is kept at the edge that was not kept
before.

## Rehearsals and records owed by this Unit

| What | When | Recorded in |
|------|------|-------------|
| A deployment whose sample loading fails stops before the switch | Once, in the test environment, from a branch with one sample entry made invalid | `docs/records/failing-deployment.md` |
| Going back with U3 deployed | Once, in the test environment | `docs/records/going-back.md` |
| The five timed opens of the 500-item folder from Brazil | Once, by the maintainer | `docs/records/measured-speeds.md` |
| The saved searches run once and compared with the run | After the first end-to-end run | `docs/records/alarm-proofs.md` |

## Secrets in the pipeline

Nothing new. The sample loader needs no secret beyond what the change
runner already has; the end-to-end tests still read the access password
from Parameter Store with the environment's identity.

## Open points

1. **U1 has not been deployed yet**, and this design requires that it is before U3 is merged (see "Precondition"). The maintainer has not yet been asked whether U3's code may be written meanwhile; that is the first question of U3's code plan.
2. **The second half of the compatibility check** (earlier end-to-end tests against the new server) is still not built. Whether to build it is put to the maintainer at this Unit's code plan.
3. **Whether CloudFront accepts `Accept-Encoding` in this kind of rule while it keeps nothing** rests on AWS's documentation, which says it may be listed "the same as any other header". If AWS refused it, Terraform's apply would fail at stage 2 in the test environment, before anything else changed, and the design of compression would come back for a decision.
4. **A branch that deliberately fails sample loading** deploys to the test environment only if it is merged, because the test identity trusts only the integration branch. The rehearsal is therefore a merged change followed by its correction, as U1's failing-deployment rehearsal is.

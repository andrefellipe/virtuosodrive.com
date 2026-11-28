# Reliability Requirements: U3, browsing and selecting

What browsing must do when things go wrong, and how its data is kept whole
(NFR10, NFR14, NFR15).

Sources: this Unit's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`,
`rules.md` and `entities.md` beside it), requirements NFR10, NFR14 and NFR15
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contracts C1, C3 and C9
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
and the analysis of the old code
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`).

U1's reliability requirements still hold: 99% availability of production's
health check, the 3-second limit on the database, backups for 7 days, going
back within 15 minutes, compatible database changes. U3's own are numbered
from .20.

## When something fails

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR10.20 | When the database does not answer, a folder request is answered with a failure within 3 seconds, and nothing partial is sent | Integration test that stops the database during a folder request | NFR10; U1's NFR10.4; design W1 |
| NFR10.21 | When the server does not answer, the page shows "The list could not be loaded." within 40 seconds at most, offers "Try again", and the breadcrumb still works with the steps already known | End-to-end test with the server blocked | NFR10; rules BR3.7; contract C1 |
| NFR10.22 | A failed refresh of a folder already on screen leaves the rows, the selection and the focus as they were | Unit test of the page with a refresh that fails | NFR10; design W3 |
| NFR10.23 | An answer that arrives for a folder the reader has already left is discarded and never shown as the current folder's | Unit test with two answers arriving in the wrong order | NFR10; design W2 |
| NFR10.24 | The list and the version in one answer are from the same moment: no answer pairs an old list with a new version, or the reverse | Integration test that changes a folder between the steps of a request | NFR10; design W1; rules BR1.8 |

## Keeping the data whole

Five later Units write to these records. The rules that must never be broken
are held by the database itself, so that a fault in any one Unit cannot
leave them broken. NFR10.25 to NFR10.27 are **binding on U6, U7 and U8**:
none of them may loosen a constraint, and each of their writes goes through
the one step that NFR10.26 and NFR10.27 describe.

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR10.25 | The database refuses: a second folder without a parent; a folder or file whose parent does not exist; two items of one parent with the same position; two visible items of one parent whose names are the same under the name rules; two items with the same `sourceKey`; a name that is empty or over 255 characters | One integration test per refusal | NFR10; rules BR2.2, BR2.3, BR2.6; entities |
| NFR10.26 | A change to a folder's list, with its version rise, either completes entirely or changes nothing | Integration test that fails the step half-way | NFR10; rules BR2.9, BR2.11; contract C9 (failure) |
| NFR10.27 | Two changes to the same folder at the same moment both succeed, one after the other, with different positions and a version raised twice | Integration test with 20 additions to one folder at once | NFR10; rules BR2.11 |
| NFR14.20 | The new records are covered by the same daily backups and the same restore to a point in time as the rest of the database | They are in the same database; inspection | NFR14 |

## Deploying and going back

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR10.28 | The database change that adds the records only adds: the version of the site running before it (U1's) keeps working against the changed database | The pull request's compatibility check runs U1's tests against the new structure | NFR10; U1's NFR15.10 |
| NFR10.29 | Loading the sample content twice leaves exactly what loading it once leaves. Loading it after an interrupted load completes what was missing | Integration test: load, load again, compare; load with a failure half-way, load again, compare | NFR10; rules BR2.10 |
| NFR10.30 | If loading the sample content fails, the deployment stops before the new server and page are put in place, and the environment keeps running what it ran | Inspection of the pipeline's order; rehearsed once in the test environment with a deliberately broken sample entry, and recorded | NFR10; U1's NFR10.6 |
| NFR15.20 | Going back to the previous version after U3 is deployed needs no change to the database: the earlier version ignores the new records | The going-back rehearsal is repeated once with U3 deployed, and recorded | NFR15; U1's NFR15.8 |
| NFR15.21 | Nothing in U3 needs doing by hand: the records, the top folder and the sample content are all created by the pipeline | Inspection; `docs/operations.md` gains no new hand procedure | NFR15 |

## What the page must not lose

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR10.31 | Reload, back and forward always lead to the folder the address names; the browser's back from a folder returns to the folder before it | End-to-end test | FR1.3; rules BR3.1 |

## Open points

1. **The compatibility check is half built** (U1's code summary): it runs earlier tests against new database changes, which is the half NFR10.28 needs. The other half, earlier end-to-end tests against the new server, was deferred to this Unit's code step when U1 was approved. U3 is the first Unit with an earlier version to protect, so it must be decided there: build it, or accept that half.
2. **NFR10.30 places the sample loader between the database changes and the switch to the new server.** Where exactly it runs is fixed at the infrastructure step.

# Observability Requirements: U3, browsing and selecting

What must be recorded and measured so that the maintainer can see how
browsing is doing and find out what happened when it fails.

Sources: this Unit's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`,
`rules.md` beside it), requirements NFR5 and NFR10
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contracts C1 and C3
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
and the analysis of the old code
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`).

U1 set the standards: one structured log entry per request with a request
identifier, 30 days' retention, the measurements Requests, ServerFailures,
Duration and ColdStarts, the error-rate and health alarms, one dashboard per
environment, four saved searches. All of it applies to the folder request
without change. U3's own requirements are numbered from .20.

## Logs

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR5.22 | The entry for a folder request names the operation, the folder's identifier, the outcome (answered, unchanged, not found, failed), the number of rows returned, and the duration. It contains no name of a file or folder | Unit test of the entry for each outcome | NFR5; U1's NFR5.4; security NFR5.20 |
| NFR5.23 | A folder request refused for a malformed identifier is logged as "not found" with the reason "malformed", and the value sent is not written | Unit test with markup as the identifier | NFR5; U1's NFR3.2; rules BR1.10 |
| NFR5.24 | Each run of the sample loader writes one summary: how many items it created, how many it found already there, how many it filled, and for a failure the sample entry's key and the kind of failure. No name and no raw database message is written (security NFR5.20) | Integration test reads the summary; the deployment's output shows it | NFR5; rules BR2.10 |
| NFR5.25 | A walk towards "All" that hits the 64-level limit, an answer refused as too large (scalability NFR11.21), or any refusal by the database that is not a duplicate name, is logged as a fault with the folder's identifier and the kind of fault, so that damaged or outsized data is noticed | Unit test of each | NFR5; security NFR3.25; rules BR2.11 |

## Measurements

U3 adds no new measurement series. A series is charged for by the month, and
U3 must add no monthly cost (scalability requirement NFR11.22). What U3 needs
to see is carried as fields of the log entry (NFR5.22) and read with saved
searches; the folder request is still counted in U1's existing series
(Requests, ServerFailures, Duration) like any other request.

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR10.32 | Folder requests can be counted by outcome (answered, unchanged, not found, failed) for any period within the 30 days the logs are kept, from the log entries alone. "Unchanged" is its own outcome, so that the load U5's re-asking adds can be seen apart from readers opening folders | A saved search gives the four counts for the end-to-end run, and they match what the run did | NFR10; scalability NFR11.26 |
| NFR10.33 | The number of rows returned is in the log entry of every answered request, so that an unexpectedly large folder can be found before it becomes slow | Unit test of the entry; the saved search of NFR5.26 shows 500 for the sample folder | NFR10; NFR9 |
| NFR10.34 | "Not found" and "unchanged" answers do not count as failures in the error rate; only server faults do | Unit test: neither adds anything to ServerFailures | NFR10; U1's NFR10.11 |

## Alarms, dashboard, saved searches

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR10.35 | No new alarm. A failing folder request is a server failure and is covered by the existing error-rate alarm | Inspection; the existing alarm proof covers it | NFR10 |
| NFR10.36 | The dashboard gains one view, drawn from the log entries and not from a new series: folder requests over time by outcome | The view exists in both environments and shows the end-to-end run | NFR10; U1's NFR10.10 |
| NFR5.26 | Two saved searches are added: "folder requests by outcome" (NFR10.32) and "folder requests slower than 1 second today", listing the folder identifier, rows returned and duration | Each exists and has been run once | NFR5; U1's NFR5.8 |

## Measured once, by hand, and recorded

Kept with U1's measurements in `docs/records/measured-speeds.md`: the time to
show the 500-item folder (performance NFR9.20); the server's time for it over
100 requests (NFR9.21); the page's time to show and to range-select 500 rows
(NFR9.25).

## What is not recorded

- Which reader opened which folder. Readers have no account, and the network address is not written to the server's log entries (U1).
- What a reader selected. Selection never leaves the page.

## Open points

1. **Searching logs is charged by the amount of log read**, not by the month. The dashboard view and the saved searches read at most 30 days of a small log. The infrastructure step confirms the dashboard view does not refresh by itself often enough to matter; if it would, the view is dropped and the saved search remains.

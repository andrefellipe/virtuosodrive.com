# Monitoring Design: U3, browsing and selecting

What is added to U1's monitoring
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/infrastructure-design/monitoring-design.md`)
so that the maintainer can see how browsing is doing. It turns U3's
observability design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-design/observability-design.md`,
mechanisms O20 to O25) into resources, with `scalability-design.md` (C21,
C22, C25), `security-design.md` (S29) and `logical-components.md` beside it.
The log fields it reads are those of the folder operation in U3's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`).

Everything U1 set up stays: one log group per part with 30 days' retention,
four measurement series, the health and error-rate alarms in production, one
dashboard per environment, four saved searches. U3 adds no series and no
alarm.

## Service level indicators

| Indicator | Where it comes from | Target | New? |
|-----------|---------------------|--------|------|
| Availability of production | U1's health check, once a minute from outside | 99% a month, counted from the switch | No |
| Server failures | U1's ServerFailures against Requests | Alarm when at least 20 requests in 5 minutes and over 5% fail | No. Folder requests count in both like any request; "not found" and "unchanged" are not failures |
| Speed of a folder request | The `duration` field of entries whose operation is `getFolder` | 95 of 100 within 500 milliseconds for the 500-item folder, checked by the pipeline on every merge (see `cicd-pipeline.md`) | New, read from the log; no alarm |

There is no alarm on the speed of folder requests. A slow folder is a
nuisance, not an outage, and with tens of users a threshold would fire on
one unlucky request. The pipeline's measurement guards against a
regression, and the saved search below finds slow folders.

## Logs

No new log group. The folder request's entry goes to the server's existing
group with the added fields of observability design O20; the sample
loader's summary goes to the change runner's existing group.

| Group | New content | Retention |
|-------|-------------|-----------|
| The server's | Folder request entries: `operation`, `folderId`, `folderOutcome`, `notFoundReason`, `rows`, `answerBytes`, `versionSent`, and `fault` when there is one | 30 days, unchanged |
| The change runner's | One summary per run of the sample loader: created, found, filled; for a failure the sample entry's key and the kind of failure | 30 days, unchanged |

No entry holds a file's or folder's name, and the database's own error text
is never written (security design S29, observability design O23).

## Saved searches

Two are added per environment, defined in Terraform beside U1's four and
named in the same way.

| Name | Reads | Shows |
|------|-------|-------|
| `<prefix>/folder requests by outcome` | The server's group, entries whose operation is `getFolder` | The number of entries for each `folderOutcome` in the period chosen |
| `<prefix>/folder requests slower than 1 second today` | The same | `folderId`, `rows`, `answerBytes`, `duration`, slowest first, at most 50 |

The first is what U5 will use to see how much of the load is pages asking
"has anything changed" (scalability design C25).

## Dashboard

U1's dashboard for each environment gains one view, "Folder requests by
outcome", a count over time for each of the four outcomes. It is drawn from
the log entries by a search, not from a measurement series, so it adds
nothing charged by the month. It runs its search when the dashboard is
opened or refreshed by a person; the dashboard is not set to refresh by
itself.

## Alarms

None added. The folder operation's failures are server failures and raise
U1's error-rate alarm in production. The named faults of observability
design O22 (`pathTooDeep`, `answerTooLarge`, `folderBusy`, `storeRefused`)
are found with U1's "server failures in the last hour" search, whose result
now shows the `fault` field.

## Cost

Saved searches and the dashboard view cost nothing to keep. Running a search
is charged by the amount of log read, at U1's price list about US$0.005 a
gigabyte; this site's server log is megabytes a month. No line is added to
the cost estimate.

## Proving it works

After the first end-to-end run in the test environment, each saved search is
run once and its result compared with what the run did: the counts by
outcome must include at least one of each of "answered", "unchanged" and
"not found", because the tests make each kind of request. The check and its
result are recorded in `docs/records/alarm-proofs.md` beside U1's.

## Open points

1. **Text log format in the change runner.** U1 set that function's log to plain text. The loader's summary is written as one line of structured text so that it can still be searched; changing the group's format is not needed.

# Observability Design: U3, browsing and selecting

What browsing writes down, and how the maintainer reads it.

Sources: `observability-requirements.md` and `security-requirements.md` in
`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-requirements/`,
U3's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`),
and contracts C1 and C3
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`).
U1's mechanisms O1 to O8 still apply: one structured entry per request, the
request identifier, 30 days, the four measurement series, two alarms, one
dashboard, four saved searches. U3's are numbered from O20.

## O20. The folder request's entry

U1's request log writes one entry per request with the time, request
identifier, operation, outcome, duration and version. As U1 built it, the
entry is a closed set of fields and an operation cannot add to it. U3
changes that (`logical-components.md`, change 5): an operation declares the
fields it may add, with their types, and the entry carries them; U1's
scrubbing runs over them like the rest. The folder operation declares and
adds these:

| Field | Value |
|-------|-------|
| `operation` | `getFolder` |
| `folderId` | The folder's identifier as stored; `root` is logged as the top folder's identifier. Absent when the identifier sent was malformed |
| `folderOutcome` | `answered`, `unchanged`, `notFound` or `failed` |
| `notFoundReason` | Only with `notFound`: `malformed`, or `absentOrHidden`. Never which of unknown, deleted, or inside a deleted folder: the log is not a way round the rule that they look the same from outside, and the maintainer who needs to know can look at the folder by its identifier |
| `rows` | Number of rows returned; only with `answered` |
| `answerBytes` | Size of what was sent; only with `answered` |
| `versionSent` | Whether the caller sent a version it held: yes or no |

No name is written, and the identifier text of a malformed request is not
written.

Meets NFR5.22, NFR5.23, NFR10.33. Unit tests build the entry for each
outcome and assert its exact fields.

## O21. Counts come from the log, not from new series

- U3 creates no measurement series. The folder request is counted by U1's existing series like every request: Requests, ServerFailures, Duration.
- U1's rule for ServerFailures is "the answer's status is 500 or above". "Not found" is 404 and "unchanged" is 304, so neither counts as a failure; a unit test asserts it for both.
- Counts by outcome are read from the entries with a saved search (O24).

Meets NFR10.32, NFR10.34, NFR10.35 (no new alarm: a failing folder request
raises ServerFailures and so the existing error-rate alarm).

## O22. Faults are named

U1's entry records a failure with a code and an error; it has no field
that says which known fault it was. U3 adds one, `fault` (change 5), and
four values for it, each written with the folder's identifier:

| Fault | When |
|-------|------|
| `pathTooDeep` | The walk reached 64 levels without reaching the top (security design S26) |
| `answerTooLarge` | The response would pass the size limit (scalability design C21); the entry also carries the size |
| `folderBusy` | A change could not get its folder within the wait allowed (reliability design R21) |
| `storeRefused` | The database refused a write for a reason other than a duplicate name; the entry carries the database's error code and the name of the rule it reported, never its message |

The last two can arise only in the change step, which in U3 only the sample
loader runs.

Meets NFR5.25.

## O23. What the loader and refused writes may log

The database's error messages can quote the value that broke a rule, which
here is a name. One function turns a database error into what may be logged:
its code and the name of the rule, nothing else. The change step and the
loader log only through it.

The loader writes one summary entry per run: environment, how many entries
it created, found already there, and filled; and for a failure the sample
entry's key and the kind of failure. The same summary is printed in the
deployment's output.

Meets NFR5.24, NFR5.20. A unit test passes a database error whose message
contains a name and asserts that the entry does not.

## O24. Saved searches and the dashboard

Defined with the rest of the monitoring, per environment:

| Name | Shows |
|------|-------|
| Folder requests by outcome | The four counts for the period chosen |
| Folder requests slower than 1 second today | Folder identifier, rows, size and duration, slowest first |

The dashboard gains one view, "Folder requests by outcome over time", drawn
from the same entries. It is a view over the logs, not a series; it reads
the log only when the dashboard is open.

Meets NFR5.26, NFR10.36. Each is run once after the first end-to-end run and
its result checked against what the run did.

## O25. Measured once and recorded

`docs/records/measured-speeds.md` gains: the five timed opens of the
500-item folder from Brazil (NFR9.20); the 95th of 100 server durations
(NFR9.21, also printed by the pipeline on every merge); the page's time to
show and range-select 500 rows on a slowed processor (NFR9.25); and the
database's own account of how it carries out each statement on a table of
50,000 items (NFR11.20).

## Open points

1. **Searching logs is charged by how much log is read.** At this site's volume that is cents. The infrastructure step confirms the dashboard view does not refresh itself in the background.

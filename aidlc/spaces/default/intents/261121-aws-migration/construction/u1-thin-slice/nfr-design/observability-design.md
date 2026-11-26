# Observability Design: U1, the thin slice

How the system records what it does, measures itself, and tells the
maintainer when something is wrong. The parts named are described in
`logical-components.md` beside this file.

Sources: the observability requirements
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/nfr-requirements/observability-requirements.md`),
with `security-requirements.md`, `performance-requirements.md`,
`scalability-requirements.md`, `reliability-requirements.md` and
`tech-stack-decisions.md` beside it; the slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`);
contract C1's request identifier
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`);
and the answers in `nfr-design-questions.md`.

## O1. One entry per request (NFR5.4, NFR5.5; security NFR5.2)

The server's shared request steps (security design, S6) end by writing one
entry. Operations do not write entries of their own for the request; they may
add fields to it.

| Field | Example | Notes |
|-------|---------|-------|
| `time` | `2026-12-01T14:03:22.118Z` | UTC |
| `level` | `info` or `error` | `error` when the outcome is 500 or above |
| `requestId` | `7f3c...` | Contract C1 |
| `operation` | `getSiteInformation` | The operation's name, never the address with its query |
| `outcome` | `200` | The status answered |
| `code` | `serverError` | The Problem code, when the answer is a Problem |
| `durationMs` | `41` | |
| `version` | `a1b2c3d` | The Release |
| `environment` | `production` | |
| `account` | absent | Filled by later Units, with the account's identifier |
| `coldStart` | `true` | Whether this copy had just started |
| `error` | `{ name, message, stack }` | Only on a server failure |

- Written as one line of JSON by the logging library (Powertools for AWS Lambda).
- **Nothing else is logged about a request:** not headers, not bodies, not query values.
- **The last defence against an email address in a log:** a single function through which every entry passes replaces anything with the shape of an email address, in any text field, with `[email removed]`. Its test includes addresses inside error messages and stack traces.
- A failure before the steps run (the platform stops the copy, or it cannot start) is recorded by the platform's own entry, which carries the platform's request identifier; the server entry point's access record links it to the visitor's request.

## O2. Refusals that never reach the server (NFR5.6)

| Refused by | Recorded as |
|------------|-------------|
| The edge check (no or wrong access password) | One line from the edge check: time, `operation: "access refused"`, outcome 401, path without query, the edge's request identifier |
| The server's check of the edge's secret | The server's normal entry, with `operation: "access refused"`, outcome 403 |
| The server entry point's request limit | The entry point's access record, outcome 429 |

The requirement (NFR5.6) asks for "the same fields" as the server's entries.
The edge check cannot supply three of them: it has no duration to report, it
does not know the Release's version, and it sees the edge's request
identifier, not one the page sent. Its lines carry the fields in the table
and no others; this is a stated departure from the requirement's wording.

The edge check's lines are kept 30 days like the rest. They may be written in
a different Region from the others if the edge service requires it (to
confirm); the saved searches cover both places.

## O3. Keeping and finding (NFR5.7, NFR5.8, NFR5.9)

- Every log group is created by Terraform with 30 days' retention. A group created implicitly by a service would keep entries forever, so the pull request's Checkov run and a test both fail on a function without its own declared group.
- **Saved searches**, defined in Terraform so they exist in both environments:
  - by request identifier;
  - server failures in the last hour;
  - the twenty slowest requests today;
  - access refusals in the last day.
- **The pipeline's record** (who merged, what ran, who approved production and when) is GitHub's own, kept at least 90 days by its retention setting.

## O4. Measurements (NFR10.8, NFR10.9)

| Figure | From | Granularity |
|--------|------|-------------|
| Requests | The server's entry (one per request) | A minute |
| Server failures (outcome 500 or above) | The same | A minute |
| Duration: middle and 95th of 100 | The same | A minute |
| Requests refused at the limit | The server entry point | A minute |
| Fresh starts | The server's entry (`coldStart`) | A minute |
| Health check result | The health monitor | A minute |
| Database load and connections | The database service | A minute |
| Month's spending | AWS billing | A day |

The first three are written by the server as measurements inside its log line
(the logging library's companion for measurements), tagged with the
environment and with whether the operation is the health check, so that
health checks can be left out of the error rate. No separate measuring agent
runs.

## O5. Alarms (NFR10.11, NFR10.12, NFR10.13, NFR11.8, NFR11.9)

| Alarm | Rule | Environment | Made by |
|-------|------|-------------|---------|
| Error rate | Over one 5-minute period: requests, health checks excluded, at least 20, and failures divided by requests above 5% | Production | Pipeline |
| Health | The outside health check failed in two consecutive minutes | Production | Pipeline |
| Failed deployment | The pipeline's production job ended in failure | Production | The pipeline's own final step, which publishes to the notification channel |
| Budget, actual | Month's spending reaches US$40; reaches US$50 | Account | Setup |
| Budget, forecast | Forecast for the month passes US$50 | Account | Setup |

- Every alarm sends through the one notification channel the setup made; the pipeline refers to the channel by name.
- An alarm emails when it starts and when it clears. A period with no requests counts as "fine", not as "unknown", so quiet nights neither raise nor hold an alarm.
- **Proving them.** Each of the first two is defined by one shared Terraform module used for both environments, with emailing, and the health monitor the health alarm needs, switched on only in production. To prove an alarm, both are switched on in test by a pull request, the condition is forced (a deliberately failing operation enabled only in test for the purpose; the database stopped for two minutes), the email is seen, and a second pull request switches it off. The failing operation exists only in the test environment's configuration and answers 404 in production.
- **Text of each email** names the environment, the alarm in plain words, and the saved search to open first.

## O6. The one screen (NFR10.10)

One dashboard per environment, defined in Terraform: requests and failures;
durations; fresh starts; refusals at the limit; health; database load and
connections. Production's also shows the month's spending against US$50. It
is the first thing the procedures document tells the maintainer to open.

## O7. Availability figure (reliability NFR10.1)

The share of the health monitor's checks that succeeded in a calendar month.
The dashboard shows the current month's; the maintainer notes it monthly.

## O8. Following a request end to end

The visitor's request identifier is sent by the page, accepted or replaced by
the server (rules BR1.4), returned in the answer, and written in the entry.
The page shows it, small, in the could-not-reach view, so that a student can
quote it. Tracing across services is not switched on: with one server and one
database it would add cost and nothing the identifier does not give.

## Open points

1. **Where the edge check's lines are written**, and at what cost, is to confirm at Infrastructure Design.
2. **The deliberately failing operation** used to prove the error-rate alarm is extra code that exists only for that purpose. It is small, off in production, and tested to be off there.
3. **"Failed deployment" depends on the pipeline's last step running.** If GitHub itself stops mid-run, no email is sent; the maintainer would see it in GitHub.
4. **Health checks excluded from the error rate** means a site where only the health check fails raises the health alarm alone, which is the intent.

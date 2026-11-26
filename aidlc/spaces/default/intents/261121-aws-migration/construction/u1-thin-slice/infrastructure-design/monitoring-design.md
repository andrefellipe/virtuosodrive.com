# Monitoring Design: U1, the thin slice

The AWS resources that implement
`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/nfr-design/observability-design.md`,
on the parts listed in `logical-components.md` beside it and specified in
`infrastructure-specification.md` beside this file. The other designs
(`security-design.md`, `performance-design.md`, `scalability-design.md`,
`reliability-design.md`), the slice's behaviour
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`),
the building blocks
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`)
and contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`)
set what must be watched.

Everything here is defined in Terraform, in one module used by both
environments. One variable differs between them: `alarms`, on in production
and off in test. When it is off, the alarms and the health check do not exist
at all; it is turned on in test only for the hours an alarm is being proved.

## Metrics & KPIs

Custom measurements are written by the server inside its log line (CloudWatch
embedded metric format, through Powertools), in the namespace `VirtuosoDrive`
with the single dimension `environment`. Health check requests write their
log entry but no measurements, which is how they are left out of the error
rate without a second dimension. At most ten custom measurements exist across
both environments, to stay within what CloudWatch does not charge for.

| Metric | Source | Threshold | Why it matters |
|--------|--------|-----------|----------------|
| `Requests` (count, health checks excluded) | Server, custom | None by itself | Denominator of the error rate; shows use |
| `ServerFailures` (count of outcomes 500 and above, health checks excluded) | Server, custom | With `Requests`: above 5% over 5 minutes when `Requests` is at least 20 | The site is failing for people |
| `Duration` (milliseconds, health checks excluded) | Server, custom | 95th of 100 at most 1,000 ms, checked by the pipeline's 100-call measurement | The baseline every later Unit is compared with |
| `ColdStarts` (count) | Server, custom | None | Explains slow first requests |
| `HealthCheckStatus` | Route 53 health check | Below 1 for two consecutive minutes | The site is down |
| `HealthCheckPercentageHealthy` | Route 53 health check | Monthly average at least 99% | The availability figure |
| HTTP API `4xx`, `5xx`, `Count`, `Latency` | API Gateway, built in | None; shown on the dashboard | 429s at the request limit appear here and nowhere else |
| Lambda `Errors`, `Throttles`, `ConcurrentExecutions`, `Duration` for both functions | Lambda, built in | None; shown | A function stopped by its time limit never writes its own entry |
| RDS `CPUUtilization`, `DatabaseConnections`, `FreeStorageSpace`, `CPUCreditBalance`, `FreeableMemory` | RDS, built in | None in this Unit; shown | The instance is small and burstable; a falling credit balance is the first sign it is too small |
| Month-to-date spending | AWS Budgets | US$48, US$60, forecast above US$60 | The ceiling |

Four custom measurements per environment makes eight; two are left for later
Units before a charge begins.

## Alerts

All go to the SNS topic `vd-alarms`, which emails the maintainer. Each sends
once when it starts and once when it clears. Missing data counts as healthy,
so a quiet night raises nothing.

| Alert | Condition | Severity | Routes to |
|-------|-----------|----------|-----------|
| `vd-prod-error-rate` | Metric math over one 5-minute period: `Requests` at least 20 and `ServerFailures / Requests` above 0.05 | High | `vd-alarms` |
| `vd-prod-health` | `HealthCheckStatus` minimum below 1 in 2 consecutive 1-minute periods | Critical | `vd-alarms` |
| `vd-prod-deploy-failed` | The pipeline's production job ended in failure; its final step publishes a message | High | `vd-alarms`, directly from the pipeline |
| Budget at 80% actual | US$48 in the calendar month | Medium | `vd-alarms` |
| Budget at 100% actual | US$60 | High | `vd-alarms` |
| Budget at 100% forecast | Forecast for the month above US$60 | Medium | `vd-alarms` |

The first two do not exist in test in ordinary running. To prove them, one
pull request turns `alarms` on for test and enables the deliberately failing
operation there; the conditions are forced; the emails are seen; a second
pull request turns both off (observability design O5). The record of the
proof is kept in the repository.

**Failures the alarms above cannot report.** A failed run in the test
environment, and a production run that fails before it has obtained its AWS
identity, cannot publish to the topic. For those the maintainer relies on
GitHub's own email about a failed workflow run, which is on by default for
the person whose merge or approval started it.

Each email's text names the environment, says what is wrong in plain words,
and names the saved search to open first.

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|-----|------------|--------------------|
| Share of Route 53 health checks of production that succeeded | At least 99% | Calendar month, counted from the switch |
| 95th of 100 server durations for site information, warm | At most 1 second | Each merge (100 calls by the pipeline) |
| First site-information call after 30 minutes of quiet | At most 5 seconds | Measured once by hand |
| Month's AWS spending | At most US$60 | Calendar month |

The error-rate alarm fires at 5% failures over 5 minutes, far tighter than a
99% monthly availability target would need, so it warns well before the
target is at risk.

## Logs & Tracing

| Log group | Written by | Kept | Contents |
|-----------|-----------|------|----------|
| `/vd/<env>/server` | The server | 30 days | One JSON entry per request (observability design O1) |
| `/vd/<env>/db-migrate` | The change runner | 30 days | What each run applied |
| `/vd/<env>/api-access` | The HTTP API | 30 days | One line per request reaching the entry point, including those refused at the request limit: time, the entry point's request identifier, route, status, latency. No query strings, no headers |
| The access gate's group | The CloudFront Function | 30 days | "access refused" lines. Its name and Region are fixed by the service; unverified, see open point 1 |

- Every group is declared in Terraform with its retention, encryption by the service, and no subscription. A function is given its group's name explicitly so that it cannot create an undeclared one.
- Read access: the maintainer's own sign-in. No pipeline identity and no function can read entries (security design S10).
- **Saved searches** (CloudWatch Logs Insights query definitions, per environment): by request identifier; server failures in the last hour; the twenty slowest requests today; access refusals in the last day.
- **Tracing** is off (observability design O8). The request identifier links the page, the entry point's line and the server's entry.

### Dashboard

One per environment, `vd-<env>`, defined in Terraform. Two dashboards are
within what CloudWatch does not charge for.

| Row | Widgets |
|-----|---------|
| Use | Requests; server failures; error rate |
| Speed | Duration, middle and 95th of 100; cold starts |
| Entry point | 4xx, 5xx, latency |
| Health | Health check status and percentage healthy (production) |
| Database | CPU, credit balance, connections, free storage, freeable memory |
| Functions | Errors, throttles, concurrent copies |
| Money (production's only) | A text widget linking to the budget; spending is not available as an ordinary measurement without extra cost |

## Open points

1. **The access gate's log lines**: where the service writes them, whether their retention can be set from Terraform, and their price are unverified. If their retention cannot be set to 30 days, the requirement that refusals be findable for 30 days is met only as far as the service allows, and that is reported to the maintainer.
2. **Month-to-date spending on the dashboard** is a link, not a chart.
3. **CloudWatch's free allowance** (ten custom measurements, ten alarms, three dashboards, 5 GB of logs) is taken from memory of its published terms and is unverified; the estimate does not depend on it by more than about US$3 a month.

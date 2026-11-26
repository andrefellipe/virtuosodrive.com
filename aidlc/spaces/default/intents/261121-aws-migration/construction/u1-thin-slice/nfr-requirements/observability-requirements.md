# Observability Requirements: U1, the thin slice

What is recorded, what is measured, and what wakes the maintainer. One person
runs this system, so the aim is few alarms that each mean something, and logs
good enough to answer "what happened?" afterwards.

Sources: the slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`,
`rules.md` beside it: BR5.1 to BR5.4), requirements FR12.5 and FR12.6 and
quality requirements NFR5, NFR10 and NFR11
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contract C1's request identifier
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the old code's stack, which has no logging at all
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`), and the
answers in `nfr-requirements-questions.md`.

The requirements behind this document are mostly functional ones (FR12.5,
FR12.6). Each detail below carries the number of the quality requirement it
serves and names the functional one it comes from.

## Logs

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR5.4 | Every request the server receives writes exactly one entry, as structured data with named fields: time, request identifier, operation, outcome, duration, the version of the server, and the account if any | Integration test reads the entry written for a request | FR12.5; rules BR5.1 |
| NFR5.5 | A server failure writes, in the same entry or one linked by the request identifier, the internal reason and where it arose | Unit test forces a failure | FR12.5 |
| NFR5.6 | Requests refused for want of the access password are recorded with the same fields, the operation given as "access refused" | End-to-end test, then a search of the logs | FR12.5; rules BR5.1 |
| NFR5.7 | Entries are kept 30 days in both environments, then removed automatically | Inspection of the definitions; Checkov | FR12.5 |
| NFR5.8 | A request can be found from its identifier within a minute, by a search the maintainer can run without writing a query from scratch: saved searches for "by request identifier", "failures in the last hour" and "slowest requests today" | The saved searches exist and each has been run once | FR12.5 ("a given request can be found") |
| NFR5.9 | The pipeline's own runs are kept by GitHub for at least 90 days: who merged, what ran, what was approved for production and when | GitHub's retention setting | NFR13; rules BR3.6 |

What may never be in a log entry is in `security-requirements.md` (NFR5.2).

## Measurements

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR10.8 | For production and for the test environment: the number of requests, the number of server failures, and how long requests take (middle, and 95 of 100), each minute | The figures are visible after an end-to-end run | FR12.6; NFR10 |
| NFR10.9 | Production's health check is asked from outside the system every minute, and the result kept as a figure from which the monthly availability is read | The figure exists; NFR10.1 is computed from it | NFR10; rules BR5.3 |
| NFR10.10 | One screen shows, for each environment: requests, failures, response times, the health check, the database's load and connections, and the month's spending so far | The maintainer opens it at the demo | NFR10; designer's choice |

## Emails to the maintainer

| ID | Sent when | Environment | Checked by | From |
|----|-----------|-------------|-----------|------|
| NFR10.11 | In 5 minutes, at least 20 requests reached the server and more than 5% of them were server failures. Health checks and access refusals are not counted | Production | Forced once in the test environment with the alarm temporarily pointed there; recorded | FR12.6 as amended by answer Q8; rules BR5.2 |
| NFR10.12 | The health check failed twice in a row; one email, and one more when health returns | Production | Forced once in the test environment; recorded | FR12.6; rules BR5.3 |
| NFR11.8 | The month's spending reached US$40, and again at US$50 | The account | The alarm exists before anything else; the 80% threshold cannot be forced, so it is checked by inspection | FR12.3, FR12.6; rules BR4.1, BR4.3 |
| NFR11.9 | The month's spending is forecast to pass US$50 before the month ends | The account | Inspection | NFR11; designer's addition, so that the warning comes before the money is spent |
| NFR10.13 | A production deployment ended with its smoke check failing, or failed before the version was in place | Production | Seen in the rehearsal of a failing deployment | rules BR3.7 |

Rules for every alarm:

- An alarm sends one email when it starts and one when it clears, not one a minute.
- The test environment sends no emails except when an alarm is being proved.
- The address is the one given at setup; the maintainer must confirm the subscription once, and an unconfirmed subscription is itself reported by the setup.

## The amendment to FR12.6

FR12.6 says "when the server-side error rate exceeds 5% of requests over 5
minutes". By the maintainer's answer Q8, NFR10.11 adds "and at least 20
requests arrived". This departs from the requirement as written and from rule
BR5.2 of the slice's design, which was written before the answer. Where they
differ, this document is the later one and holds. What it gives up: fewer than
20 requests in 5 minutes, all failing, sends no error-rate email. The health
check (NFR10.12) still catches a site that is down.

## Tracing

Following one request across several services is not required in this Unit:
there is one server and one database, and the request identifier in every
entry is enough. It may be switched on later at no change to the code if the
logging library chosen supports it.

## Open points

1. **Alarms are proved in the test environment**, not in production, to avoid forcing failures there. That the production alarms are defined identically is checked by inspection.
2. **Rule BR5.2 in the design** still reads as the unamended requirement; it is superseded by NFR10.11 as explained above.
3. **NFR10.10's screen** costs little or nothing at this scale; its cost is included in the estimate at Infrastructure Design.

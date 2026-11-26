# Record: the alarms, proved in the test environment

Template written 2026-11-25. Not yet performed. Fill it in when the proofs are
done (observability design O5; procedure 8 in `docs/operations.md`), and add
it through a pull request. Do not paste an email's addresses here; the time it
arrived is enough.

| What                                                      | Record |
| --------------------------------------------------------- | ------ |
| Date                                                      |        |
| Pull request that turned `alarms` and `forced_failure` on |        |
| Pull request that turned them off again                   |        |

## Error rate

| What                                                          | Record |
| ------------------------------------------------------------- | ------ |
| Requests made to the deliberately failing operation, and when |        |
| Time the alarm email arrived                                  |        |
| Time the cleared email arrived                                |        |
| The email named the environment and the saved search (yes/no) |        |
| No email with fewer than 20 requests in the period (checked?) |        |

## Health

| What                                | Record |
| ----------------------------------- | ------ |
| Time the test database was stopped  |        |
| Time the alarm email arrived        |        |
| Time the database was started again |        |
| Time the cleared email arrived      |        |

## Budget

| What                                                       | Record |
| ---------------------------------------------------------- | ------ |
| The email subscription is confirmed (yes/no)               |        |
| The tag `project` is active for cost reporting (date seen) |        |
| First month in which the budget showed a figure            |        |

## The checks of the pipeline's identities (security design S3)

Each attempt must be refused.

| Attempt                                              | Refused (yes/no), and how it was tried |
| ---------------------------------------------------- | -------------------------------------- |
| From the test identity, change a production resource |                                        |
| From the test identity, change the budget alarm      |                                        |
| From the test identity, change a trust definition    |                                        |
| From a pull request's checks, take either identity   |                                        |

## Notes

What was unexpected, and what was changed because of it.

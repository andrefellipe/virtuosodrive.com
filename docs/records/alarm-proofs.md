# Record: the alarms, proved in the test environment

Template written 2026-11-25. Performed 2026-11-27 (observability design O5;
procedure 8 in `docs/operations.md`). Times are UTC. No email's addresses are
written here; the times are enough.

| What                                                      | Record          |
| --------------------------------------------------------- | --------------- |
| Date                                                      | 2026-11-27      |
| Pull request that turned `alarms` and `forced_failure` on | Pull request 20 |
| Pull request that turned them off again                   | Pull request 24 |

## Error rate

| What                                                          | Record                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Requests made to the deliberately failing operation, and when | 25, all failing, within one 5-minute period, shortly before 05:18                |
| Time the alarm email arrived                                  | 05:18                                                                            |
| Time the cleared email arrived                                | 05:22                                                                            |
| The email named the environment and the saved search (yes/no) | Not written down on the day. Owed: to be read from the email the maintainer kept |
| No email with fewer than 20 requests in the period (checked?) | Yes. 10 failing requests in a period with no other traffic raised no alarm       |

## Health

| What                                | Record |
| ----------------------------------- | ------ |
| Time the test database was stopped  | 05:39  |
| Time the alarm email arrived        | 05:43  |
| Time the database was started again | 12:23  |
| Time the cleared email arrived      | 12:30  |

The database was meant to be stopped for a few minutes. It stayed stopped
for almost seven hours because the maintainer's connection dropped before it
was started again. The alarm stayed raised throughout and cleared seven
minutes after the start.

## Budget

| What                                                       | Record                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| The email subscription is confirmed (yes/no)               | Yes: the alarm emails above arrived through the same topic                           |
| The tag `project` is active for cost reporting (date seen) | Owed. Not looked at during the rehearsals                                            |
| First month in which the budget showed a figure            | Owed. The first full month is December 2026; to be read in the first days of January |

## The checks of the pipeline's identities (security design S3)

Each attempt must be refused.

| Attempt                                              | Refused (yes/no), and how it was tried                                                                                                                                                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| From the test identity, change a production resource | Yes, twice. The workflow `prove-identity-limits` tried to tag a production resource. First run: https://github.com/andrefellipe/virtuosodrive.com/actions/runs/45944037448 . Second run, 22:32: https://github.com/andrefellipe/virtuosodrive.com/actions/runs/46077278579 |
| From the test identity, change the budget alarm      | Yes, in both runs: it tried to set the budget's notification to the value it already has                                                                                                                                                                                   |
| From the test identity, change a trust definition    | Yes, in both runs: it tried to change the trust definition of its own role. In the first run the identity could not even read that definition                                                                                                                              |
| From a pull request's checks, take either identity   | Yes. Pull request 26, opened for this and closed without merging, asked for each identity from its checks; AWS answered both with "Not authorized to perform sts:AssumeRoleWithWebIdentity": https://github.com/andrefellipe/virtuosodrive.com/actions/runs/46042916178    |

The second run of `prove-identity-limits` used the stricter reading added
after the first: for the production resource and the trust definition,
"refused" is printed only when AWS answers with an explicit deny. All three
attempts were printed as "refused".

## Notes

What was unexpected, and what was changed because of it.

- **An alarm nobody had asked for, at 05:10.** The pipeline's own 100
  measurement calls fell in the same 5-minute period as 10 deliberately
  failing requests, which made more than 20 requests with a failure rate
  over the threshold. The alarm was right by its own rule. Nothing was
  changed; the "fewer than 20" check was repeated in a period with no other
  traffic, and raised nothing.
- **The health alarm takes about four minutes to raise and seven to clear**
  (05:39 to 05:43, and 12:23 to 12:30, the second including the database's
  own start).
- **Not proved here:** the failed-deployment email, which only production's
  job sends, and the budget's own email.

# Record: a deployment that fails safely, rehearsed in the test environment

Template written 2026-11-25, changed 2026-11-27. Not yet performed. Fill it
in when the rehearsal is done (reliability design R8; procedure 9 in
`docs/operations.md`), and add it through a pull request.

The rehearsal: a pull request sets `failing_change = true` in
`infra/environment/test.tfvars` and is merged; the change runner then fails
on purpose, after any real pending database changes; the Deployment to test
must end as `notPutInPlace`; the test environment must still run the earlier
version; a second pull request sets the switch back to `false`. The
failed-deployment email is sent only by production's job, so this rehearsal
does not show it; note here how the failure was reported.

The first plan was a pull request adding a failing SQL file to
`db-migrate/migrations/`. Such a pull request cannot pass its checks, because
every integration test applies all the files there and expects them to
succeed, so the rehearsal uses a switch.

| What                                                             | Record |
| ---------------------------------------------------------------- | ------ |
| Date of the rehearsal                                            |        |
| Pull request that turned the switch on                           |        |
| Link to the `deliver` run                                        |        |
| Step the run failed at (expected: "Database changes")            |        |
| Outcome the run recorded (expected: `notPutInPlace`)             |        |
| Version the test environment ran before                          |        |
| Version the test environment ran afterwards (expected: the same) |        |
| The page still answered afterwards (yes/no)                      |        |
| How the failure was reported, and when it was seen               |        |
| Pull request that turned the switch off                          |        |
| The next Deployment succeeded (yes/no)                           |        |

## Notes

What was unexpected, and what was changed because of it.

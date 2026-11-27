# Record: a deployment that fails safely, rehearsed in the test environment

Template written 2026-11-25, changed 2026-11-27. Performed 2026-11-27
(reliability design R8; procedure 9 in `docs/operations.md`).

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

| What                                                             | Record                                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date of the rehearsal                                            | 2026-11-27                                                                                                                                                   |
| Pull request that turned the switch on                           | Pull request 23                                                                                                                                              |
| Link to the `deliver` run                                        | https://github.com/andrefellipe/virtuosodrive.com/actions/runs/46033316601                                                                                   |
| Step the run failed at (expected: "Database changes")            | The database changes, inside "Deploy to test". The change runner's error: "Rehearsal: this database change fails on purpose and changes nothing"             |
| Outcome the run recorded (expected: `notPutInPlace`)             | `notPutInPlace`, at 16:26:15 UTC                                                                                                                             |
| Version the test environment ran before                          | `a525fc6`                                                                                                                                                    |
| Version the test environment ran afterwards (expected: the same) | `a525fc6`                                                                                                                                                    |
| The page still answered afterwards (yes/no)                      | Yes: the site answered 200 after the run                                                                                                                     |
| How the failure was reported, and when it was seen               | By the run itself, shown as failed on GitHub, and by the recorded outcome. It was seen at once, because the run was being watched. No email: test sends none |
| Pull request that turned the switch off                          | Pull request 24                                                                                                                                              |
| The next Deployment succeeded (yes/no)                           | Yes: Release `b8fcbeb`, succeeded at 16:40:34 UTC                                                                                                            |

## Notes

What was unexpected, and what was changed because of it.

- The change runner's log shows that releasing its lock failed after the
  deliberate failure, because the failed change had ended the transaction.
  The lock is held by the session and was released when the change runner
  disconnected; the next run took it without waiting. Nothing was changed.
- A failed Deployment in test is reported only on GitHub. Nobody is emailed,
  so an unwatched failure in test is seen only when someone looks.

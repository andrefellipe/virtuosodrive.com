# Record: a deployment that fails safely, rehearsed in the test environment

Template written 2026-11-25. Not yet performed. Fill it in when the rehearsal
is done (reliability design R8), and add it through a pull request.

The rehearsal: a pull request with a deliberately failing database change is
merged; the Deployment to test must end as `notPutInPlace`; the test
environment must still run the earlier version; a second pull request removes
the change. To see the failed-deployment email, which only production's job
sends, note here how it was exercised.

| What                                                             | Record |
| ---------------------------------------------------------------- | ------ |
| Date of the rehearsal                                            |        |
| Pull request with the failing change                             |        |
| Link to the `deliver` run                                        |        |
| Outcome the run recorded (expected: `notPutInPlace`)             |        |
| Version the test environment ran before                          |        |
| Version the test environment ran afterwards (expected: the same) |        |
| The page still answered afterwards (yes/no)                      |        |
| How the failure was reported, and when it was seen               |        |
| Pull request that removed the failing change                     |        |
| The next Deployment succeeded (yes/no)                           |        |

## Notes

What was unexpected, and what was changed because of it.

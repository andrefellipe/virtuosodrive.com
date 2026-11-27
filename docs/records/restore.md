# Record: restoring the database, rehearsed in the test environment

Template written 2026-11-25. Begun on 2026-11-27 and not yet finished: the
copy was not made at the first attempt and was made at the second, and the
first run that pointed test at it failed (the three sections below). Fill
the two tables in when the rehearsal is done (reliability design R6;
procedure 4 in `docs/operations.md`), and add it through a pull request.

| Step                                           | Pull request or run | Time taken | Result |
| ---------------------------------------------- | ------------------- | ---------- | ------ |
| Restore yesterday's backup to a new database   |                     |            |        |
| Point the test server at the restored database |                     |            |        |
| See the slice's page answer                    |                     |            |        |
| Switch back to the original database           |                     |            |        |
| Remove the restored copy                       |                     |            |        |

| What                                          | Record |
| --------------------------------------------- | ------ |
| Date of the rehearsal                         |        |
| Moment restored to                            |        |
| `installedAt` shown before and after (equal?) |        |
| Total time                                    |        |

## First attempt, 2026-11-27: the copy was not made in time

Pull request 25 set `restored_copy_time = "2026-11-27T16:30:00Z"` in
`infra/environment/test.tfvars`. Its `deliver` run, 46042786560, failed in
the test environment's job at the step "Deploy to test". Times are UTC.

| Time     | What happened                                                                                                                                        | Read from     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 17:33:34 | The run began                                                                                                                                        | The run       |
| 17:34:39 | Terraform began creating the copy, `vd-test-db-restored`                                                                                             | The run's log |
| 17:48:21 | "Restored from DB instance vd-test-db to 2026-11-27 16:30:00.0"                                                                                      | AWS's events  |
| 17:48:41 | "DB instance restarted"                                                                                                                              | AWS's events  |
| 17:50:22 | "Backing up DB instance"                                                                                                                             | AWS's events  |
| 18:04:42 | Terraform's error: timeout while waiting for state to become available (last state: backing-up, timeout: 30m0s)                                      | The run's log |
| 18:04:43 | The step failed. The end-to-end tests, the measurement and the step that marks the Release verified were skipped, and production's job did not start | The run       |

| What                                        | Record                                                         |
| ------------------------------------------- | -------------------------------------------------------------- |
| Moment restored to                          | 2026-11-27T16:30:00Z                                           |
| Time AWS took to restore                    | 14 minutes (17:34:39 to 17:48:21)                              |
| Time the first backup had run when given up | 14 minutes (17:50:22 to 18:04:42), not finished                |
| What the site did                           | Kept answering from the first database, with Release `b8fcbeb` |
| What was pointed at the copy                | Nothing                                                        |
| What was left                               | The copy, in AWS; Terraform's record of it, marked incomplete  |

The restore itself was well inside the limit. What outlasted it was the
copy's first backup: AWS gives a restored copy the backup setting of the
database it was restored from, 7 days here, and takes a first backup before
it reports the copy available, which is what Terraform waits for.

The incomplete copy is removed by the pull request that takes
`restored_copy_time` out of `test.tfvars` again, as "When the restore takes
too long" in procedure 4 says.

## Second attempt, 2026-11-27: the copy was made

Pull request 27 raised the limit to 40 minutes and removed the incomplete
copy. Pull request 28 set `restored_copy_time = "2026-11-27T19:30:00Z"`
again; its `deliver` run succeeded. Times are UTC.

| Time     | What happened                              |
| -------- | ------------------------------------------ |
| 20:18:28 | The test environment's job began           |
| 20:32:37 | AWS reported the copy restored to 19:30:00 |
| 20:34:51 | The copy's first backup began              |
| 20:52:30 | The first backup ended                     |
| 20:54:04 | Terraform finished                         |
| 20:56:50 | The job succeeded                          |

| What                              | Record                                             |
| --------------------------------- | -------------------------------------------------- |
| Moment restored to                | 2026-11-27T19:30:00Z                               |
| Time the first backup took        | 17.7 minutes (20:34:51 to 20:52:30)                |
| From the job's start to Terraform | 35.6 minutes (20:18:28 to 20:54:04)                |
| The whole job                     | 38.4 minutes (20:18:28 to 20:56:50)                |
| What was pointed at the copy      | Nothing; the site answered from the first database |

## First run pointing test at the copy, 2026-11-27: the change runner gave up

Pull request 29 set `use_restored_copy = true`. Its `deliver` run, of 21:50
UTC, gave both functions the copy's address and started the change runner,
which failed to sign in. Times are UTC.

| Time     | What happened                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| 21:52:21 | The copy received the change runner's connection                                                               |
| 21:52:31 | The change runner gave up, at its limit of 10 seconds                                                          |
| 21:52:41 | The copy completed the sign-in as `migrator`; its own log: `authentication=19180.947 ms`, that is 19.2 seconds |

| What                         | Record                                                          |
| ---------------------------- | --------------------------------------------------------------- |
| Outcome of the Deployment    | `notPutInPlace`                                                 |
| What the site did            | Kept answering from the first database, with the Release it had |
| What was pointed at the copy | Nothing that was running                                        |
| What was in order            | The network, the permissions and the copy                       |

The copy spent those 19.2 seconds on its check of the AWS identity. The
first database shows the same in small: a sign-in there takes 0.2 to 0.5
seconds, and the first after a quiet period took between 1.3 and 4.1 seconds
in the six hours measured. A database that has never been signed in to by
AWS identity is the extreme case, and a restored copy is always one.

## Notes

What was unexpected, and what was changed because of it.

- 2026-11-27. The 30-minute limit was set from AWS's usual time for a
  restore and did not count the first backup. AWS's events show that backup
  finished at 18:08:00, 17.6 minutes after it began: the copy was available
  33.5 minutes after Terraform began creating it.
- 2026-11-27. Giving the copy no backups of its own was the fix first
  planned. It cannot be done by a setting in `infra/` with the AWS provider
  in use (6.74.0): for a restore to a moment, the provider does not pass the
  backup setting to AWS, although AWS's own interface accepts one.
- 2026-11-27. The fix made: the limit is 40 minutes, as it was before it was
  shortened to 30. That is 6.5 minutes over the one measurement there is. If
  a restore overruns it, the job's own 60 minutes are raised together with
  it.
- 2026-11-27. The second attempt fitted the 40 minutes: Terraform finished
  35.6 minutes after the job began.
- 2026-11-27. The change runner's limit of 10 seconds for a sign-in, with
  one try, was shorter than a copy's first sign-in by AWS identity (19.2
  seconds). The fix made: each try has 30 seconds, and a try that fails for
  any reason other than a refused sign-in is followed by one more, with a
  new sign-in token. The 30 seconds and the second try are proved by unit
  tests, not yet by a run against AWS: the copy has now been signed in to
  once, so the next run's sign-in is expected to be quick.

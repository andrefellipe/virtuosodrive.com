# Record: restoring the database, rehearsed in the test environment

Template written 2026-11-25. First attempted on 2026-11-27: the copy was not
made (see "First attempt" below), so the rehearsal is not yet performed.
Fill the two tables in when it is done (reliability design R6; procedure 4
in `docs/operations.md`), and add it through a pull request.

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

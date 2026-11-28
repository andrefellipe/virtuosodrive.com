# Record: restoring the database, rehearsed in the test environment

Template written 2026-11-25. Performed 2026-11-27 (reliability design R6;
procedure 4 in `docs/operations.md`). Times are UTC. The two tables give the
steps that worked; two steps failed at their first try, and the three
sections after the tables tell each as it happened.

| Step                                           | Pull request or run                                                                                           | Time taken                                           | Result                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restore to a moment, as a new database         | Pull request 28 (second attempt; the first was pull request 25)                                               | 38.4 minutes for the job; the copy took 35.6 of them | The copy `vd-test-db-restored` existed beside `vd-test-db`; nothing pointed at it                                                                                                                                                                                                                                                                                                        |
| Point the test server at the restored database | Pull request 30's run (second try; the first was pull request 29's run, which set the switch and then failed) | 4.7 minutes for the job (22:23:11 to 22:27:51)       | Succeeded at 22:27, but the server's first call to the copy failed: its health check answered 503 after 2.3 seconds at 22:24:10 (the database did not sign it in inside the server's 2 seconds for opening a connection), and the smoke check passed at its second attempt, at 22:24:19. The change runner had signed in to the copy in 3.5 seconds; the server's later sign-in took 0.5 |
| See the slice's page answer                    | The same run's smoke check and end-to-end tests, and one call by hand afterwards                              | Inside the same job                                  | The smoke check passed at its second attempt (the row above); the end-to-end tests and the measurement passed against the copy. `/v1/site-information` answered the same `installedAt`. The page was not opened in a browser by a person                                                                                                                                                 |
| Switch back to the original database           | Pull request 31                                                                                               | 3.7 minutes for the job (22:32:27 to 22:36:10)       | Succeeded. The running server was given the first database's address again, and `/v1/site-information` answered the same `installedAt`                                                                                                                                                                                                                                                   |
| Remove the restored copy                       | Pull request 32, which carried this record                                                                    | 5.3 minutes for the job (22:43:53 to 22:49:08)       | Succeeded. AWS's events: the copy shut down at 22:44:30 and was deleted at 22:45:53. Only `vd-test-db` remained, and `/v1/site-information` answered the same `installedAt`. Added to this record afterwards, because the record was merged by the run that removed the copy                                                                                                             |

| What                                          | Record                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date of the rehearsal                         | 2026-11-27                                                                                                                                                                                                                                                                                                |
| Moment restored to                            | 2026-11-27T19:30:00Z (the first attempt: 16:30:00Z)                                                                                                                                                                                                                                                       |
| `installedAt` shown before and after (equal?) | Equal: `2026-11-26T23:26:12.374Z` from the first database before, from the copy, and from the first database after                                                                                                                                                                                        |
| Total time                                    | Of the two jobs that worked, from starting the copy to the site answering from it: 43 minutes (38.4 and 4.7). Not in that figure: each run's build job (about half a minute), and the time to write and merge the two pull requests. By the clock, with two failures and their fixes: from 17:33 to 22:36 |

What the 43 minutes mean, and what they do not. With the database damaged,
and the two faults found here already fixed, the site would answer from a
restored copy about 43 minutes of pipeline time after the first pull request
was merged, plus the time to write and merge two pull requests. Four things
make that figure optimistic:

- The test database is almost empty. A database with real data may take
  longer to restore and to back up.
- The run that worked signed in to a copy that had already been signed in to
  once, by the run that failed. On a copy never signed in to, the change
  runner's first sign-in took 19.2 seconds; its new 30 seconds and second
  try are proved by unit tests only, not by a run against AWS.
- The server's first call to the copy failed (503 after 2.3 seconds), and
  the smoke check after the infrastructure change passed only at its second
  attempt. A person opening the site in those seconds would probably have
  been shown an error. That is inferred from the code and the log, and was
  not tried in a browser: the 503 was the health check's answer; site
  information answers a database failure with a 500, which the page does
  not try again; and how long the window lasted is not known (the next
  attempt of the smoke check came about 10 seconds later).
- Nobody opened the page in a browser while it answered from the copy.

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
first database shows the same in small: a sign-in there usually takes 0.2
to 0.5 seconds, and the first after a quiet period took between 1.1 and 4.1
seconds in the hours looked at. It also shows it large: at 12:25:58, just
after that database was started again, 14 sign-ins took between 10.3 and
44.9 seconds. So a database just started, or never signed in to by AWS
identity, is slow at its first sign-ins, and a restored copy is always
both.

## Notes

What was unexpected, and what was changed because of it.

- 2026-11-27. The 30-minute limit was set from AWS's usual time for a
  restore and did not count the first backup. AWS's events show that backup
  finished at 18:08:00, 17.6 minutes after it began: the copy was available
  33.4 minutes after Terraform began creating it (17:34:39 to 18:08:00).
- 2026-11-27. Giving the copy no backups of its own was the fix first
  planned. It cannot be done by a setting in `infra/` with the AWS provider
  in use (6.74.0): for a restore to a moment, the provider does not pass the
  backup setting to AWS, although AWS's own interface accepts one.
- 2026-11-27. The fix made: the limit is 40 minutes, as it was before it was
  shortened to 30. That is 6.6 minutes over that measurement. If
  a restore overruns it, the job's own 60 minutes are raised together with
  it.
- 2026-11-27. The second attempt fitted the 40 minutes: Terraform finished
  35.6 minutes after the job began.
- 2026-11-27. The change runner's limit of 10 seconds for a sign-in, with
  one try, was shorter than a copy's first sign-in by AWS identity (19.2
  seconds). The fix made: each try has 30 seconds, and a try that fails for
  any reason other than a refused sign-in is followed by one more, with a
  new sign-in token. The 30 seconds and the second try are proved by unit
  tests, not by a run against AWS: the copy had been signed in to once by
  then, and the next run's sign-in took 3.5 seconds.
- 2026-11-27. The server is less patient than the change runner, and it
  showed: its first call to the copy answered 503 after 2.3 seconds, because
  opening a connection may take 2 seconds of the 3 it allows a request. The
  smoke check's second attempt passed. Nothing was changed for this; it is
  the same question as the first call after a quiet period
  (`docs/records/measured-speeds.md`), and it is owed an answer.

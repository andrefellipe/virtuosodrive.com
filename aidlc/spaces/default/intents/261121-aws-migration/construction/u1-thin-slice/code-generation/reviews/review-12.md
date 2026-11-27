## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-27T23:06:58Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| - | - | - | No findings | No action required | Resolved |

### Validation Tool Results

All read-only. Each command returned a result.

- `git diff 071be29 origin/aws-migration` over the seven changed files: matches the list in the brief.
- `gh pr view` for 20, 21, 23–32. Merge times and states: all match the records. Pull request 26 is closed and was not merged. Merge commits: 23 is `cafe72c`, 24 is `b8fcbeb`, 28 is `ee3ba94`, 32 is `1a54241`.
- `gh run view --json jobs` and `--log` for runs 45932874039, 46031409749, 46033316601, 46042786560, 46062673242, 46072880508, 46076278441, 46077210125, 46078331080, 45944037448, 46077278579, 46042916178. Results are under "Other checks".
- `gh api repos/.../deployments`: dates and Releases for `releases-test` match the records. Examples: `a525fc6` at 16:13:01, `cafe72c` at 16:26:15, `b8fcbeb` at 16:40:34.
- `aws cloudwatch describe-alarm-history` for `vd-test-error-rate` and `vd-test-health`: the history still exists (the alarms were deleted but their history was kept). Details are in "Other checks".
- `aws cloudtrail lookup-events`: StopDBInstance at 05:39:02 UTC, StartDBInstance at 12:23:02 UTC.
- `aws rds describe-events` for `vd-test-db` and `vd-test-db-restored`: the restore, backup and deletion times match `restore.md`. `describe-db-instances` now lists only `vd-prod-db` and `vd-test-db`.
- `aws logs filter-log-events` on `/vd/test/server` (05:00–05:30, 18:00–18:30, 22:24) and on `/aws/rds/instance/vd-test-db/postgresql` (12:00–18:10 and around 18:05).
- Private-data search of the added lines under `docs`, `infra` and the unit's folder (12-digit numbers, email addresses, `arn:aws`, personal names): no match.
- `git diff 1db1c19 origin/aws-migration -- infra/environment/test.tfvars`: only comments and `failing_change = false` added.

### Other checks

**1. Are the records true?**

*Confirmed:*

- Pull request numbers and Release versions in all four records.
- The runs and their links: the `deliver` run for pull request 23 (46033316601) failed in "Deploy to test" and produced the quoted error and `OUTCOME="notPutInPlace"` at 16:26:15.
- Measurements: 265 / 126 / 278 ms, 0 failed (run 45932874039, Release `1db1c19`), and 36 / 28 / 52 ms, 0 failed (run 46031409749, Release `a525fc6`). That run's overall result is "cancelled" because its production job was cancelled by a later push; the test job succeeded.
- The `restore.md` times: the 17:33 to 18:04 attempt, the AWS events at 17:48:21, 17:48:41, 17:50:22, 18:08:00, and the second attempt's 20:32:37, 20:34:51, 20:52:30. The job times 20:18:28 to 20:56:50 and the 21:50, 22:23:11 to 22:27:51 and 22:32:27 to 22:36:10 jobs.
- `alarm-proofs.md`:
  - Server log, minute counts: 10 `forceFailure` 500s at 05:09 together with about 150 `getSiteInformation` calls, which fits the 05:10 alarm. There were 14 + 11 = 25 failures at 05:16–05:17, which fits the 05:18 alarm. There were 10 failures at 05:26 with no alarm, which is "fewer than 20" with nothing else.
  - Alarm history converted to UTC: error rate ALARM 05:10:24, OK 05:14:24, ALARM 05:18:24, OK 05:22:24; health ALARM 05:43:09, OK 12:30:09.
  - Stop 05:39:02 and start 12:23:02, "almost seven hours" and "seven minutes".
  - The `prove-identity-limits` runs of 05:08 and 22:32: all three attempts printed "refused" both times.
  - Pull request 26's run: both identities answered "Not authorized to perform sts:AssumeRoleWithWebIdentity".
- The 500 at 18:05:45 UTC on `getSiteInformation` after 2303 ms, `coldStart: true`, "timeout expired". The database's log shows the connection received at 18:05:45 and authenticated at 18:05:49, `authentication=4053.9 ms`. The next four site-information calls answered 200 (18:06:10 to 18:06:14).
- The arithmetic in `restore.md`: 38.4 (38m22s), 35.6 (35m36s), 4.7 (4m40s), 3.7 (3m43s), 17.7 (17m39s), 43.1 = 43. The first attempt's 14 min restore (13.7) and 14 min backup (14m20s), and the 30-minute timeout at 18:04:39.

*Not checked:*

- `installedAt` values and the by-hand calls ("200 after the run", "same installedAt"): the site needs the access password and I did not use it.
- The copy's sign-in times (19.2 s, 3.5 s, 0.5 s): the copy's log group is deleted with the instance. The pull request 29 run does show the change runner's "timeout expired" at about 21:52:31.
- Email arrival times, the 05:18 "email" and so on. "Version ran afterwards `a525fc6`" (only deployment records exist). The maintainer's machine build figure. The Deployment status API returned nothing for the ones I tried.
- Going-back figures (34 s, 24 s): not in this diff and not re-run.

**2. Do the records claim more than was shown?** See findings 1, 2, 5, 7, 9, 12. In `failing-deployment.md` the "yes" rows match what can be checked (run, outcome and time). The "page still answered" row rests on a by-hand call that I could not re-check.

**3. Consistency.**

- The records agree with each other on all pull request numbers, Releases and times, except 33.5 against 33.4 (finding 6) and the operations text (finding 4).
- `operations.md` procedure 4 line 252 predicted the failed first server call that `restore.md` leaves out. Procedure 9's email line disagrees with `failing-deployment.md` (finding 9). The code-summary table row for the restore ("Done to the point of removing the copy") is stale after the removal (finding 12).
- The summary's "2 seconds" is not in the records; they say 3 (finding 2).

**4. What Step 19 asked for and is not done.** The records admit these: the first call after 30 minutes, the throttled first load, ten calls from Brazil, Edge and previous browsers, the server's `Duration`, the cost tag, the budget's first figure, the email's contents, and the result of removing the copy. Not admitted in the summary's owed list: the failed-deployment email and the budget's own email (admitted in `alarm-proofs.md`), the page opened from the copy by a person (admitted in `restore.md`), and the email arrival times themselves (finding 7). Ticking the box is defensible only with the line added in finding 12.

**5. `test.tfvars`.** It is back to ordinary settings. Compared with `1db1c19`: `alarms = false`, `forced_failure = false`, `deletion_protection = false` and `access_password_version = 2` are unchanged, and only comments and `failing_change = false` are added. The two restore switches are gone. Mentions of the copy that remain are `docs/operations.md` procedure 4, which describes how to make one, and the records. No document says a copy exists. The copy is gone in AWS.

**6. Nothing private.** Clean in every changed file, with one qualification: the linked first `prove-identity-limits` run shows the account number in its public log (finding 10).

### Summary

The records are mostly true. I confirmed nearly every time, number and link I could reach, including the alarm and RDS times that were unverified. The two things that must be fixed first are that the server's own failed first call to the copy is left out (503 after 2.3 s, smoke passed on attempt 2), and that the 500 at 18:05 is blamed on the 3-second limit when the 2-second connection limit fired. NOT-READY holds until those two are corrected. The rest are Minor wording and consistency points, and the Step 19 box needs its owed list kept next to it.

## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-27T19:09:22Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | docs/operations.md > procedure 4, "When the restore takes too long" (first sentence) | The recovery section still says "If AWS has not finished after 30 minutes, Terraform stops waiting". The create limit is now 40 minutes (main.tf, the test, and step 3 of the same procedure). An operator reading this would conclude a run that failed at minute 40 is not this case. The summary asked for no leftover "30 minutes" for the create limit; this one is left. | Change "30" to "40" in that sentence. Re-read the whole procedure once more for any other create-limit figure. | New |
| R-02 | Major | infra/modules/database/main.tf > comment above `timeouts` ("Changing the moment replaces the copy ... together may wait up to 60 minutes") and docs/operations.md > "Changing the moment" | With create 40m and delete 30m, a replacement (removal then restore in one run) can wait up to 70 minutes, which is past the job's 60-minute stop. The comment states 60, and it was true only for the earlier 30m+30m. The reason for the two-pull-request rule is therefore stronger than stated, and the figure is wrong. The danger it describes (GitHub stopping the job mid-apply, leaving the lock) now applies without needing the worst case. The 40m figure itself is sound. | Correct the figure to "up to 70 minutes, more than the job's 60" in the comment, and make sure the procedure's wording ("may outlast the job") stays consistent with it. | New |
| R-03 | Minor | docs/operations.md > "Changing the moment" ("10 to 25 minutes or more") | The restore-time range is the one the measurement just contradicted: the copy took 34 minutes including the first backup. | Say "about 35 minutes" or cite the measurement given in step 3. | New |
| R-04 | Minor | infra/environment/tests/restored-copy.tftest.hcl > comment above the timeout assertion | The comment says the wait "must end by itself well before" the 60 minutes. With 40m the margin is about 18 minutes, which the code comment calls the worst-case-tight margin. "Well before" is stronger than the figures support. | Reword to "inside the job's 60 minutes, with room left for the rest of the deployment". | New |
| R-05 | Minor | infra/modules/database/main.tf > comment on timeouts (arithmetic) | The 40-minute arithmetic is coherent against `deliver.yml` (test job `timeout-minutes: 60`, role duration 3600). The Terraform step began about 36 seconds into the job, so a give-up lands near minute 41 and a restore ready at minute 39 leaves about 21 minutes for a remainder of 4 to 12. That is under both the 60-minute job stop and the one-hour sign-in. The "worst 12" figure is the developer's estimate and is not backed by a measurement in the artifacts. The margin over the one measurement (33.5) is 6.5 minutes, from a single sample. | Optional: record that the 12-minute figure is an estimate, and that a second rehearsal measurement should confirm 40. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| terraform -chdir=infra/environment test | PASS, 23 passed, 0 failed | The 40m/30m assertion holds against the module. |
| terraform fmt -check -recursive infra | PASS | No formatting changes needed. |

### Other checks

- The provider claim (6.74.0 does not send `backup_retention_period` for a restore to a moment) is internally coherent in the comment, the summary and the record, and the conclusion follows from it: writing 0 would not stop the first backup and would show a permanent diff. Leaving 7, matching AWS's inherited value, is the right choice. I did not verify the provider source myself.
- Next run (copy tainted, `restored_copy_time` removed): `restored_count` becomes 0, so Terraform destroys the copy, its log group and the `sign_in_resource_ids` entry, and nothing in the first database changes. The destroy order is sound: the copy depends on the log group, so the instance goes first. `delete_automated_backups = true`, `skip_final_snapshot = true` and `deletion_protection = false` mean no setting blocks the destroy, and the 30m delete limit is ample for an `available` copy. The sign-in permission change on the server function is applied in the same run.
- `restore.md` is consistent with the code and the conductor's facts (times, 14 minutes, 17.6 minutes, 33.5 minutes). Its own "30m0s" is the failed run's actual error text and is correct.

### Summary

The 40-minute limit is right and safe against the job's 60 minutes and the one-hour sign-in. The module is correct for the destroy-only next run. Two statements still say the wrong thing: the recovery section's "30 minutes" and the "up to 60 minutes" for a replacement, which is now 70. Both are one-line corrections to make before merge.

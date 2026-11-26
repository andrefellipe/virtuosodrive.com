# Reliability Requirements: U1, the thin slice

How dependable the system must be, how it fails, and how it is recovered.
The slice sets these up for every Unit after it.

Sources: the slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`,
`rules.md` beside it), requirements NFR10, NFR14 and NFR15
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the old code's stack
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`), and the
answers in `nfr-requirements-questions.md`.

## Targets

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR10.1 | Production's health check succeeds for at least 99% of the checks made in each calendar month (one check a minute, so at most about 7 hours of failure a month) | The monthly figure, read from the health monitor | NFR10 |
| NFR10.2 | The figure counts from the switch. Before it, production is private and the figure is recorded but not judged | A note with the first figures | NFR10; delivery plan |
| NFR10.3 | There is no availability target for the test environment | Not applicable | NFR10 names production only |

99% a month is a modest target, chosen at the requirements step for a study
site run by one person. It allows a single Region and no standby.

## How it fails

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR10.4 | When the database does not answer, the server answers each request with a failure within 3 seconds; it does not hang, and it does not need restarting when the database returns | Integration test that stops and restarts the database | NFR10; rules BR1.1, BR1.3 |
| NFR10.5 | When the server does not answer, the page says so within 40 seconds at most (three tries of up to 10 seconds, with pauses of 1 and 3 seconds between them) and offers to try again | End-to-end test with the server blocked | NFR10; rules BR1.2 |
| NFR10.6 | A deployment that fails before the new version is in place leaves the environment running the version it ran | Rehearsed once in the test environment with a deliberately failing change; recorded | NFR10; rules BR3.7 |
| NFR10.7 | The page's files and the server are replaced so that a visitor never receives a page that calls a server version it does not match: the server keeps answering the previous page's calls during and after a deployment | The rule that changes stay compatible with the previous version, applied to the server's operations as to the database; checked by running the previous version's end-to-end tests against the new server in the pull request when an operation changes | NFR10; rules BR6.3 |

## Going back and recovery

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR15.8 | The previous version can be put back in either environment within 15 minutes of the maintainer asking, through the pipeline, with no rebuild | The rehearsal in the test environment, timed and recorded | NFR15; rules BR6.1, BR6.2 |
| NFR15.9 | A change to the database's structure is applied by the pipeline, once, in order, and its application is recorded in the database; a change already applied is never applied again; two deployments cannot apply changes at the same time | Integration test that runs the changes twice; inspection of the locking | NFR15; rules BR6.3 |
| NFR15.10 | The pull request's checks run the previous version's tests against the new database structure whenever the structure changes | The pull request's checks | NFR15; rules BR6.3; answer to functional design Q3 |
| NFR14.1 | The database is backed up automatically every day in both environments and backups are kept 7 days | Inspection of the definitions; Checkov | NFR14 |
| NFR14.2 | The database can be restored to any moment in the last 7 days | The capability is switched on; inspection | NFR14; designer's choice where the chosen service offers it at no extra cost |
| NFR14.3 | A restore has been carried out once in the test environment: the database restored to a new copy, the site pointed at it, the slice's page seen working. It is recorded with the time it took | A record in the repository | NFR14 |
| NFR14.4 | Deleting the database in production needs a deliberate change in two places (a protection switch, then the deletion); it cannot happen as a side effect of an ordinary deployment | Inspection of the definitions; a test deployment that tries is refused | NFR14; designer's choice |
| NFR14.5 | Terraform's state can be recovered: its bucket keeps earlier versions for 90 days | Inspection of the setup's definitions | NFR14; answer Q10 |

How much may be lost and how long recovery may take, stated plainly:

- **Data lost at worst:** what changed since the last moment a restore can reach; with NFR14.2, a few minutes; without it, up to a day.
- **Time to recover the database:** not promised. NFR14.3 measures it once so that the figure is known.
- **A whole-Region failure:** the site is down until the Region returns. No second Region is required.

## No routine work

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR15.11 | Nothing needs doing by hand to keep the system running from week to week: certificates renew themselves, backups run themselves, logs expire themselves | Inspection; the first month's experience | NFR15 |
| NFR15.12 | What does need a person is written down in one place in the repository: running the setup, approving production, going back, restoring, replacing the access password | The document exists and each procedure has been done once | NFR15; phase rule (deployment procedures include rollback steps) |

## Open points

1. **NFR14.2 depends on the database service** chosen at Infrastructure Design; if it costs extra there, it goes to the maintainer.
2. **NFR10.7 for the page and the server** extends the database rule the maintainer chose (compatible changes only) to the server's operations. It was not asked separately.
3. **15 minutes in NFR15.8** is the designer's figure; the rehearsal will show whether it is realistic.

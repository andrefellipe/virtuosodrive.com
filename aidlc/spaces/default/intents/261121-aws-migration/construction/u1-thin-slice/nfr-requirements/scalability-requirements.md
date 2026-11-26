# Scalability and Cost Requirements: U1, the thin slice

How much use the system is sized for, and what it may cost. For this project
the binding limit is not load but money: about US$50 a month for two
environments. Scale requirements here are therefore mostly ceilings.

Sources: the slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`,
`rules.md` beside it), requirement NFR11
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contract C1 and the polling decision of contract C3
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the old code's stack
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`), and the
answers in `nfr-requirements-questions.md`.

## Expected use

No measurement of the old site's use exists. These are the designer's
assumptions for sizing, to be corrected by the first month's figures.

| What | Assumed | Basis |
|------|---------|-------|
| People using the site at the same moment | Up to 30 | A class of students around an exam |
| Requests a second at that moment, once the list asks every 3 seconds (from U5) | About 10 | 30 pages asking every 3 seconds |
| Requests a month | Under 1 million | Mostly quiet, with short busy periods |
| In this Unit | The maintainer and the pipeline only | Both environments are private |

## Requirements

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR11.1 | A written cost estimate for both environments at the expected use, with an allowance for the safe copy the migration will keep, totals at most US$50 a month, or the maintainer has decided what gives | Produced at Infrastructure Design with current prices; reviewed by the maintainer | NFR11; delivery plan (Bolt 1) |
| NFR11.10 | The estimate has a line for every part these requirements call for, in each environment, including the ones easy to overlook: the database and its backups; how the server reaches the database and the secrets service without a NAT gateway (the planning document rules one out unless justified); the secrets themselves; the check for the access password; the health monitor; logs and the saved searches; the measurements, alarms and the one screen; the content delivery network, storage and the name; Terraform's state; and the pipeline's minutes. A part with no line is a defect in the estimate | The estimate, compared against this list | NFR11 |
| NFR11.2 | The total is bound by NFR11.1. In addition, nothing in either environment has a fixed monthly cost above US$15 by itself without being named in the estimate and accepted by the maintainer | The estimate lists every fixed cost | NFR11; designer's choice, to make the largest costs visible |
| NFR11.3 | The entry point refuses requests beyond 50 a second, and beyond a burst of 100, across all callers, so that neither a mistake nor an attack can run up the bill or exhaust the database | A test sends a burst above the limit against the test environment and sees refusals | NFR11; security threat "cost attack" |
| NFR11.4 | The number of copies of the server that can run at once is capped at 20 in production and 5 in the test environment | Inspection of the definitions | NFR11 |
| NFR11.5 | The server never opens more database connections than the database allows: at most one per running copy, reused between requests, and the cap in NFR11.4 is below the database's connection limit | Integration test of connection reuse; the two figures compared at Infrastructure Design | NFR11; reliability |
| NFR11.6 | The test environment costs no more than the production environment, and where a part can be smaller or switched off when idle in test, it is | The estimate shows the two side by side | NFR11 |
| NFR11.7 | The first full month's bill is compared with the estimate, and the comparison is recorded | A record in the repository | NFR11 ("the first full month's bill confirms it") |

## Growth

| What grows | In this Unit | Later |
|------------|--------------|-------|
| Database | One record | Folders, files, accounts and the record of changes; small |
| File contents | None | Over 1 GB at migration, growing with uploads; the main storage cost |
| Logs | A few entries a day | Proportional to requests; removed after 30 days |
| Terraform's state versions | One per deployment | Old versions removed after 90 days |

## Not required

- No second Region, no standby copy of the database, and no automatic growth beyond the caps above. The planning documents ask for none.
- No load test in the first release (team practices: performance tests are not part of it). NFR11.3 is a limit check, not a load test.

## Open points

1. **The assumed use is a guess.** If the real figures are much higher, the caps in NFR11.3 and NFR11.4 and the estimate are revisited.
2. **Whether two environments fit under US$50** is still unproven; NFR11.1 is where it is settled, at Infrastructure Design. The database service is the deciding cost.
3. **Asking every 3 seconds** (decided at the contracts step) multiplies requests; its cost is measured in U5, but NFR11.3's limit is sized to allow it.

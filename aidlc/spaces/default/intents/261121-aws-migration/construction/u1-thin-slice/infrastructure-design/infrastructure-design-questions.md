# Infrastructure Design: Questions for U1, the thin slice

This step turns the slice's design into named AWS resources and a cost
estimate against the ceiling of about US$50 a month. It draws on the quality
design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/nfr-design/logical-components.md`,
with `security-design.md`, `performance-design.md`, `scalability-design.md`,
`reliability-design.md` and `observability-design.md` beside it), the slice's
design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`),
the building blocks
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`)
and contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`).

Prices are AWS's published list prices for `us-east-1`, read on 2026-11-25
from the public price lists dated 2026-11-24. They exclude tax, any free
allowance and any credits a new account may have. A month is taken as 730
hours.

## Q1. [Maintainer] Which PostgreSQL service, and how many?

You left this for this step, to decide with prices. The database is the
largest fixed cost.

| Option | Database cost a month | Whole system, roughly | Notes |
|--------|-----------------------|------------------------|-------|
| A. Amazon RDS for PostgreSQL, smallest instance (db.t4g.micro, 20 GB), one in each environment, always on | US$14 each, US$28 | US$33 to US$38 | Predictable. Leaves about US$12 to US$17 under the ceiling for file storage and transfer in later Units |
| B. One such instance shared by both environments, as two separate databases | US$14 | US$19 to US$24 | Cheapest. Tests share a machine with production: a heavy test run can slow the real site, and the two environments are no longer fully separate |
| C. Amazon Aurora PostgreSQL Serverless | At least US$44 for production alone | Over US$50 | It saves money only by pausing when idle. Production cannot pause: the health check asks the database every minute, as the contract requires. Not viable under the ceiling |

A. RDS for PostgreSQL, one small instance in each environment
B. One RDS instance shared by both environments
C. Aurora PostgreSQL Serverless, accepting a cost above the ceiling
X. Other (please specify)

[Answer]: A

## Q2. [Developer] How does the server get its secret values?

The server sits in a private network with no route to the internet, next to
the database. Your requirement says secrets are "read by the server when it
starts" from the secrets service. From that network, reaching the secrets
service needs a private connection point.

| Option | Cost a month | Notes |
|--------|--------------|-------|
| A. Hand the values to the server when it is deployed, encrypted in its configuration; and let the server sign in to the database with its own AWS identity, so no database password exists for it at all | US$0 | Departs from the wording of the requirement ("read when it starts"). The values are still never in the repository or the pipeline's output, and replacing one is still a pipeline run with no code change |
| B. A private connection point to the secrets service in each environment | US$7.30 each, US$14.60 | Meets the requirement as written. With option A of Q1 it brings the total to about US$48 to US$53: at or over the ceiling before any file is stored |

A. Hand the values over at deployment; database sign-in by the server's own identity
B. Private connection points to the secrets service
X. Other (please specify)

[Answer]: B

## Q3. [Maintainer] The two choices together reach the ceiling. What gives?

Follow-up to Q1 and Q2. With one database per environment and a private
connection point in each, the estimate at list prices is:

| Line | A month |
|------|---------|
| Two databases (instance and 20 GB each) | US$27.96 |
| Two private connection points | US$14.60 |
| Secrets held | US$1.60 |
| Health monitor | US$1.50 to US$2.75 |
| Alarms | US$0.30 |
| Everything charged by use (server, entry point, logs, edge, storage) at the expected use | US$1.50 to US$3.00 |
| **Total** | **US$47.50 to US$50.20** |

At five times the expected use the total is about US$56 to US$62. File
storage and the migration's safe copy, in later Units, add cents to a few
dollars. The budget alarm emails at US$40 and US$50, so as things stand it
would email every month.

A. Accept it and raise the ceiling to US$60 a month; the budget alarm moves to US$48 and US$60. Changes requirements FR12.3 and NFR11
B. Keep the private connection point in production only; the test environment is handed its values at deployment. About US$40 to US$43. The two environments then differ in one respect
C. Change Q2 to handing the values over at deployment in both environments. About US$33 to US$36
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Database (Q1): Amazon RDS for PostgreSQL, db.t4g.micro with 20 GB, one in each environment, always on.
- Secrets (Q2): a private connection point to the secrets service in each environment; the server reads its secrets when it starts, as the requirement says.
- Ceiling (Q3): raised to US$60 a month; the budget alarm emails at US$48 and US$60. This changes requirements FR12.3 and NFR11. The estimate is US$47.50 to US$50.20 at the expected use.
- Not asked, chosen by the designer: a private network across two of the Region's sites, with no route to the internet and no public addresses; the one connection point sits in one site.
- Not asked, chosen by the designer: the server and the change runner sign in to the database with their own AWS identities, so neither has a database password. The database's master password is kept by RDS in the secrets service and used once, to create those two sign-ins.
- Not asked, chosen by the designer: the access password is kept in the free parameter store, since only you and the pipeline read it; the secret the edge adds for the server is kept in the secrets service.
- Not asked, chosen by the designer: the check at the edge is a CloudFront Function; the health monitor is an Amazon Route 53 health check; at most ten custom measurements are kept, to stay within what is free.
- Not verified: where the edge function's log lines are written, and the size limit of the password page it answers with. Both are checked when the code is planned.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

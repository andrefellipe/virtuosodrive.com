# Infrastructure Specification: U1, the thin slice

The AWS resources the thin slice needs, how they are arranged, and what they
cost. It gives each part in
`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/nfr-design/logical-components.md`
a concrete resource, under the designs beside that file (`security-design.md`,
`performance-design.md`, `scalability-design.md`, `reliability-design.md`,
`observability-design.md`), for the behaviour in
`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`
and contract C1 of
`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`.
The slice touches only the empty shells of the building blocks in
`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`.
The maintainer's answers Q1 to Q3 are in `infrastructure-design-questions.md`.
Monitoring is in `monitoring-design.md` and the pipeline in `cicd-pipeline.md`.

This is a design. The Terraform files themselves are written at the code step.

**What was checked against documentation on 2026-11-25** (AWS and GitHub
pages): a CloudFront Function can compute SHA-256, read cookies and add
request headers; the form of the identity claims in GitHub's tokens for a
branch and for an environment; RDS for PostgreSQL supports sign-in by AWS
identity with tokens valid 15 minutes; Lambda's default limit is 1,000
simultaneous copies and new accounts start lower. **What was not:** marked
"unverified" where it appears.

## Deployment

| Facet | Choice | Rationale |
|-------|--------|-----------|
| Region | `us-east-1` only | Maintainer's choice (technology decisions T1); also where a certificate for CloudFront must be issued |
| Compute model | Serverless: two AWS Lambda functions per environment (server, database change runner), Node.js 24, arm64 | Technology decisions T2; nothing to pay when idle |
| Entry | One Amazon CloudFront distribution per environment in front of two origins: a private Amazon S3 bucket (page files) and an Amazon API Gateway HTTP API (paths under `/v1`) | One address for page and server (contract C1); the access password is checked once, at the edge |
| Network | One VPC per environment, two private subnets in two Availability Zones, no internet gateway, no NAT gateway, no public addresses. One interface endpoint for Secrets Manager, in one subnet | The database must be private; the planning document rules out NAT; the maintainer chose a private connection point for secrets (Q2) |
| Storage | Amazon RDS for PostgreSQL for data; S3 for page files, Release packages and Terraform state | Project rule (PostgreSQL); Q1 |
| Environments | `test` and `production`, in one AWS account, identical in shape. Every resource that has a name is named `vd-test-...` or `vd-prod-...`, and every resource carries the tag `environment` | Team practices. Names and tags together are what confine each pipeline identity: see "How each identity is confined" below |
| Infrastructure as code | Terraform, three root configurations: `setup` (run once by the maintainer), and one applied twice, with a variables file each, for `test` and `production`. State in S3, one key per configuration, with S3's native locking | Technology decisions T4, T5; one definition for both environments keeps them alike |
| What Terraform does not manage | Which numbered version the server's alias points at; the contents of the page files bucket | Reliability design R3: only the pipeline's deploy steps move the live version. The alias is defined with its version ignored after creation |
| Sizing | Server 512 MB, 8-second limit; change runner 512 MB, 5-minute limit; database db.t4g.micro (2 vCPU, 1 GB), 20 GB gp3 | The slice's load is tiny; these are the smallest sensible sizes. 512 MB shortens the first request after quiet |
| Concurrency | Server: at most 20 copies in production, 5 in test. Change runner: 1 | Scalability design C2. Reserving copies requires the account's limit to allow it: see open point 2 |
| Tags | Every resource: `project`, `environment`, `unit` | Cost can be read per environment |

## Infrastructure Services

Per environment unless marked "account".

| Service | Role | Configuration | Notes |
|---------|------|---------------|-------|
| Amazon CloudFront distribution | CDN, single public address | Alternate name `virtuoso.andrefellipelabs.com` (production) and `test.virtuoso.andrefellipelabs.com` (test); TLS 1.2 minimum; HTTP redirected to HTTPS; HTTP/2 and HTTP/3; compression on. Default behaviour to S3 through origin access control. Behaviour `/v1/*` to the HTTP API: caching disabled, all methods the API uses, query strings forwarded, cookies not forwarded. A response headers policy sets the headers of security design S5. No custom error responses: they would apply to the whole distribution and replace the server's own failure answers under `/v1` | The test name is the designer's choice; a name under the same zone needs no new zone |
| CloudFront Function `access-gate` | Access password check; page paths | Runs on every viewer request, both behaviours. Logic per security design S1. On the default behaviour only, after the check, a request for a path that names no file (no extension) is given the entry document, so that the page's own addresses work when opened directly; `/v1` requests are never rewritten. Holds the SHA-256 of the access password, and an on/off flag, both placed by Terraform. Written in TypeScript, compiled to the JavaScript the service requires | Verified: SHA-256, cookies, headers. Unverified: the size limit of the password page it answers with, and where its log lines are written |
| Origin secret header | Proves a request came through the edge | The distribution adds `x-origin-verify: <secret>` to requests it sends to the HTTP API (an origin custom header, set by Terraform from the secret). The server refuses requests without it (security design S2) | The secret is in Secrets Manager. Rotating it is one Terraform apply that updates the secret and the distribution. Running copies of the server hold the old value, so on a mismatch the server reads the secret again (at most once a minute) and compares once more before refusing; a rotation therefore causes no refusals beyond the moment of the change |
| Amazon S3 bucket `pages` | Page files | Private; Block Public Access on; SSE-S3 encryption; versioning on; read only by the distribution. One folder per Release plus the entry document at the root; folders of Releases older than the ten most recent expire | Filled by the pipeline's deploy step |
| Amazon S3 bucket `releases` | Release packages | Private; encrypted; the server's and the runner's packages named by version; ten kept | |
| Amazon API Gateway HTTP API | Server entry point | One `$default` stage; one integration to the server's alias `live`; routes `GET /v1/health`, `GET /v1/site-information` and a catch-all to the same integration so the server answers `notFound` itself. Throttle: 50 a second with burst 100 in production, 10 and 20 in test. Access logging to its own log group | No authoriser in this Unit. Its own public address stays reachable but useless without the origin secret |
| AWS Lambda function `server` | The operations | Published versions; alias `live`; in the VPC's two subnets; environment variables for non-secret settings only (environment name, database address, names of secrets). Reads the origin secret from Secrets Manager at start, through the endpoint. Signs in to the database as user `app` with a token made from its own identity | One database connection per copy, kept (performance design P3) |
| AWS Lambda function `db-migrate` | Database change runner | In the VPC; invoked only by the environment's pipeline identity; signs in as user `migrator`; applies node-pg-migrate's pending files inside its package. Not behind an alias: the pipeline updates its code to the Release's package just before starting it. Every run begins by trying to sign in as `migrator`; only if that user does not exist yet (a new environment) does it read the master password from Secrets Manager, create the users `app` and `migrator`, and carry on. No separate step or person is needed for a new environment | The master password is used by nothing else |
| Amazon RDS for PostgreSQL | Database | db.t4g.micro; single Availability Zone; 20 GB gp3, storage autoscaling off; the newest major version RDS offers when built, pinned; minor versions applied automatically in a weekly window; encrypted; no public access; connections must use TLS (`rds.force_ssl`); sign-in by AWS identity enabled; master password generated by Terraform and stored in Secrets Manager as `vd-<env>-db-master` (not RDS's own managed secret, whose fixed name could not carry the environment's prefix); automated backups daily, kept 7 days, with restore to a point in time; deletion protection on in production, and Terraform refuses to destroy it | Q1. Roughly 100 connections available; 21 are the most the server and runner can ask for |
| Security groups | Network isolation | `db`: accepts PostgreSQL only from `server` and `migrate`. `server`, `migrate`: no inbound; outbound only to `db` and to the endpoint. `endpoint`: accepts HTTPS only from `server` and `migrate` | |
| VPC interface endpoint, Secrets Manager | Private connection point | One subnet; private DNS on; an endpoint policy allowing only this environment's secrets | Q2. US$7.30 a month each |
| AWS Secrets Manager | Secrets the server and runner read | `vd-<env>-origin-secret` and `vd-<env>-db-master`, both generated by Terraform | US$0.40 a month each |
| AWS Systems Manager Parameter Store | Secrets only people and the pipeline read | `access-password`, SecureString, generated by Terraform | Free. Outside the VPC nothing needs an endpoint to read it |
| IAM roles | Least privilege | `server-role`, `migrate-role`, each carrying the environment's permissions boundary, per security design S3 | Created by the pipeline; names start with the environment prefix |
| AWS Certificate Manager certificate | TLS | One per environment name, in `us-east-1`, validated by a DNS record | Renews by itself |
| Amazon Route 53 records | DNS | An alias record for each environment's name to its distribution; the certificate's validation record | The zone already exists and is not managed here. See open point 1 |
| Amazon Route 53 health check | Health monitor, production only | HTTPS to `/v1/health` on the production name, every 30 seconds (the service's standard interval, which satisfies "every minute"); failure after 3 failed checks | Can be switched on for test by a variable, to prove the alarm |
| Amazon CloudWatch | Logs, measurements, alarms, dashboard | See `monitoring-design.md` | |

## How each identity is confined

The quality design says each pipeline identity can change only its own
environment. Names alone cannot do that, because several kinds of resource
have no name of their own. The mechanism per kind:

| Kind of resource | Confined by | Confidence |
|------------------|-------------|------------|
| IAM roles, Lambda functions, S3 buckets, log groups, secrets, parameters, the RDS instance, the state key | The name prefix `vd-test-` or `vd-prod-` in the permissions | Established practice |
| VPC, subnets, security groups, the endpoint | The tag `environment`: creation only with the identity's own tag value, changes only to resources carrying it | Established practice for these services |
| HTTP API, certificate | The same tag conditions | Supported by these services as far as the designer knows; unverified |
| CloudFront distribution, its function and policies | The same tag conditions where the service honours them | Unverified. If it does not, both identities can change either distribution |
| Route 53 records | Both identities may change records in the one zone, each only for its own names (`virtuoso...` for production, `test.virtuoso...` for test), using the service's condition on record names | Unverified |
| Anything the setup made | Denied to both identities by their outer limits | Established practice |

**What this means.** For the resources that hold data or run code (database,
secrets, functions, buckets, state, roles), confinement is by name and is
solid. For the edge and DNS it rests on conditions that are verified when the
setup is written; any kind for which no condition works is reported to the
maintainer as a gap, with the plain alternative: one AWS account per
environment, which gives full separation at no AWS charge but doubles the
setup and the budget alarms. The maintainer has not been asked to choose that.

## Account-wide resources (the `setup` configuration)

Made once by the maintainer running the setup with their own sign-in, in this
order. Run again, it changes nothing.

| Order | Resource | Configuration |
|-------|----------|---------------|
| 1 | Amazon SNS topic `vd-alarms` and email subscription | The address is typed when the setup runs; it is stored in the subscription only. The topic's policy lets AWS Budgets and CloudWatch alarms of this account publish to it, and each pipeline identity publish a deployment failure; nothing else. The setup reports if the subscription is still unconfirmed |
| 2 | AWS Budgets cost budget | US$60 a month (Q3). Notifications to the topic at 80% actual (US$48), 100% actual (US$60), and 100% forecast |
| 3 | IAM OpenID Connect provider for GitHub | |
| 4 | Two permissions boundaries, `vd-test-boundary` and `vd-prod-boundary` | Per security design S3 |
| 5 | Two roles, `vd-test-deploy` and `vd-prod-deploy` | Trust: the repository and, respectively, the branch `aws-migration` and the environment `production`, as the token's subject; one-hour sessions |
| 6 | S3 bucket for Terraform state | Private; encrypted; versioned, earlier versions kept 90 days; native locking; bucket policy giving each role only its own key |
| 7 | The setup's own state moved into that bucket | By the setup's script; the local copy is removed |

Items 1 and 2 come first so that the budget alarm exists before anything
else (project rule). Strictly, the topic is created a moment before the
budget, because the budget needs somewhere to send. The alternative, a budget
that emails directly, would put the address in the budget's definition and in
Terraform's state, against the rule that only the notification service holds
it. The topic costs nothing and can incur no charge by itself; this ordering
is a stated, minimal departure from "the budget alarm first".

GitHub's own settings are applied by a script in the same folder using the
maintainer's GitHub sign-in: branch protection on `aws-migration`; the
`production` environment with the maintainer as required reviewer and
restricted to that branch; the two role identifiers as repository variables;
and **`aws-migration` made the repository's default branch**. The last is
needed because GitHub runs scheduled and manually started workflows only from
the default branch, and the going-back workflow is manually started
(`cicd-pipeline.md`). It changes nothing on `master`, which stays as the
record of the Firebase site; it does change which branch GitHub shows first.
This setting needs the maintainer's agreement and is asked at the code plan.

## Shared Infrastructure

Only one Unit exists so far. These are what later Units will share, stated
now so that ownership is clear.

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|-----------------|------------|----------------|-----------------|
| Everything in "Account-wide resources" | U1 | All | Changed only by the maintainer running the setup; no pipeline identity can change it |
| The distribution, the access gate, the HTTP API, the VPC, the database instance, the pipeline | U1 | U2 to U8 add routes, tables, buckets and permissions | Through pull requests to the same Terraform configuration; each Unit's additions are named for the Unit by tag |
| The server function | U1 | U2 to U7 add operations | One application, modules inside (technology decisions T2) |

## Cost estimate

List prices for `us-east-1` from AWS's public price lists dated 2026-11-24,
read on 2026-11-25. Excluding tax, free allowances and credits. A month is 730
hours. The ceiling is US$60 a month (Q3).

| Line | Unit price | Test | Production | A month |
|------|------------|------|------------|---------|
| RDS db.t4g.micro, single-AZ | US$0.016 an hour | 11.68 | 11.68 | 23.36 |
| RDS storage, 20 GB gp3 | US$0.115 a GB-month | 2.30 | 2.30 | 4.60 |
| RDS backups | Free up to the database's size | 0 | 0 | 0 |
| Interface endpoint | US$0.01 an hour, plus US$0.01 a GB | 7.30 | 7.30 | 14.60 |
| Secrets Manager, 2 secrets each | US$0.40 a secret | 0.80 | 0.80 | 1.60 |
| Route 53 health check with HTTPS | US$0.50 basic plus US$1.00 for HTTPS, if the target counts as an AWS endpoint; US$0.75 plus US$2.00 if not | 0 | 1.50 to 2.75 | 1.50 to 2.75 |
| CloudWatch alarms (three in production; none in test except for the hours an alarm is being proved) | US$0.10 each | 0 | 0.30 | 0.30 |
| **Fixed subtotal** | | **22.08** | **23.88 to 25.13** | **45.96 to 47.21** |
| HTTP API | US$1.00 a million requests | | | 0.20 to 1.00 |
| Lambda | US$0.20 a million requests; US$0.0000133 a GB-second | | | 0.10 to 0.40 |
| CloudWatch Logs | US$0.50 a GB taken in; US$0.03 a GB-month kept; US$0.005 a GB searched | | | 0.30 to 0.80 |
| CloudFront, the access gate, S3, Parameter Store, SNS, Budgets, ACM, custom measurements (ten or fewer) | Within always-free allowances at this scale, or cents | | | 0 to 0.50 |
| Data leaving AWS | Within the free allowance at this scale | | | 0 to 0.30 |
| **By-use subtotal at the expected use** (up to 1 million requests a month) | | | | **0.60 to 3.00** |
| **Total at the expected use** | | | | **US$46.60 to US$50.20** |
| Total at five times the expected use | | | | about US$50 to US$62 |

Not in the table, and why:

- **The Route 53 hosted zone** (US$0.50 a month) already exists and is already paid for.
- **File contents and the migration's safe copy** arrive with later Units: about US$0.023 a GB-month in S3, so 10 GB kept twice is under US$0.50.
- **GitHub Actions minutes**: free for a public repository; for a private one, within the plan's monthly allowance or not is unverified.
- **Free allowances and new-account credits** would lower the bill in the first months; the estimate ignores them so that it holds afterwards.

Reading of the figure: about US$46 of the US$47 to US$50 is fixed and does
not depend on use. The margin under US$60 is about US$10 to US$13, which is
what later Units have for sign-in, file storage and transfer. The budget alarm
at US$48 will be close to firing in an ordinary month.

## Open points

1. **Where the Route 53 zone lives.** If `andrefellipelabs.com` is hosted in this AWS account, Terraform adds the records. If it is in another account, the three records (two names, the validations) must be added there by the maintainer, which is a step by hand that the "nothing by hand" rule does not allow without the maintainer's say-so. Asked at the code plan.
2. **The account's limit on simultaneous function copies.** New accounts start below 1,000, by an amount AWS does not publish, and reserving copies for a function requires leaving 100 unreserved. If the limit is too low to reserve 20 and 5, the caps are left off, the HTTP API's request limit is the only ceiling, and a limit increase is requested. Checked when the setup first runs.
3. **Whether the budget can be created by the setup with no console step.** Creating a budget through the API may require access to billing information to have been switched on for the account by its root user, which is done in the console. Unverified. If so, that one switch is an exception the maintainer must accept before the setup runs.
4. **Unverified details of the access gate**: the size limit of the page it answers with (the password page is kept to a few kilobytes), and where its log lines go and at what price.
5. **The health check's price** depends on whether Route 53 treats a CloudFront address under a custom name as an AWS endpoint; the estimate carries both figures.
6. **`test.virtuoso.andrefellipelabs.com`** as the test environment's name was not asked.
7. **The estimate leaves about US$10 a month** for everything later Units add. A sign-in service with a monthly charge per person would use it quickly; that is weighed in U2.

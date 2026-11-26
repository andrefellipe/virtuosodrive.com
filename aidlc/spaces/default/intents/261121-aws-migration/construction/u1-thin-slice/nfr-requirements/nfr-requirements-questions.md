# Quality Requirements and Technology Choices: Questions for U1, the thin slice

This step sets the measurable qualities of the thin slice (speed, security,
reliability, what is watched) and makes the technology choices your planning
document left open. Because the slice is the first Unit, most of these choices
hold for every Unit after it.

It draws on the slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`
and `rules.md`), the requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the analysis of the old code
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`) and your
technical environment document
(`aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md`),
whose seven open decisions are asked here except live updates, which you
settled at the contracts step (asking every 3 seconds).

Already settled, and not asked: TypeScript with `strict`; Node.js 24;
PostgreSQL; the AWS SDK v3; Vitest, Testcontainers and Playwright; ESLint and
Prettier; Zod for input validation; no secrets in source; encryption at rest
and TLS 1.2 or later; the US$50 monthly ceiling; 99% availability a month;
logs kept 30 days; daily backups kept 7 days.

## Q1. [Developer] Which AWS Region?

At feasibility you said there is no rule on where data is kept, and that
lowest price matters more than closeness. Your users are in Brazil.

A. `us-east-1` (N. Virginia): lowest prices and every service available; pages and files reach Brazil somewhat slower, softened by the content delivery network
B. `sa-east-1` (São Paulo): closest to the users; noticeably higher prices, which makes the US$50 ceiling harder with two environments
X. Other (please specify)

[Answer]: A

## Q2. [Developer] What shape does the server side take?

Your document asks for serverless first and lists these.

A. Amazon API Gateway (HTTP API) in front of AWS Lambda functions: the mainstream, well-documented shape; costs nothing when idle
B. AWS Lambda Web Functions, without API Gateway: newer (October 2026) and in a limited set of Regions; fewer parts, less written about it
C. Containers (Amazon ECS): a server that is always on; a fixed monthly cost and more to operate
X. Other (please specify)

[Answer]: A

## Q3. [Developer] How is the page built?

The interface is one table and a toolbar, plus the account and maintainer
screens.

A. Framework-free TypeScript with Vite: least to learn and to keep up to date, smallest download; you write the screen updates yourself, with care never to put user text into HTML
B. React with Vite: more to learn and update; screen updates and safe handling of user text come built in, which helps as screens multiply (16 are designed)
X. Other (please specify)

[Answer]: B

## Q4. [Developer] Which tool defines the infrastructure as code?

A. AWS CDK v2 in TypeScript: the same language as the application; proposed in your document
B. Terraform: its own language; widely used beyond AWS
X. Other (please specify)

[Answer]: B

## Q5. [Developer] Which pipeline product?

The rule is a pull request on GitHub whose checks must pass, deployment
without long-lived keys, and your approval before production.

A. GitHub Actions: checks appear on the pull request natively; signs in to AWS with short-lived credentials; production approval through a protected environment
B. AWS CodePipeline with CodeBuild: everything inside AWS; reporting checks back to the pull request needs extra wiring; a small monthly cost
X. Other (please specify)

[Answer]: A

## Q6. [Developer] Where does the new code live in the repository?

The old site is deployed by hand from `app/public`, and must stay unchanged
until the switch.

A. Beside the old code: new top-level folders for the page, the server, the infrastructure and the tools; `app/` is left alone, apart from removing its committed `node_modules`, and is removed after the switch
B. In place: the new code replaces what is in `app/` now; the old site could then be redeployed only from the `master` branch
X. Other (please specify)

[Answer]: A

## Q7. [Developer] When is the PostgreSQL service chosen?

Your document says to choose between Aurora PostgreSQL (serverless) and RDS
for PostgreSQL "with a cost estimate at Infrastructure Design". It is the
largest single cost and decides whether two environments fit under US$50.

A. At Infrastructure Design, two steps from now, with real prices for each option side by side; here only "PostgreSQL, current major version" is fixed
B. Now, as RDS for PostgreSQL on the smallest instance: predictable, always on
C. Now, as Aurora PostgreSQL serverless: can pause when idle, slower first request after a pause
X. Other (please specify)

[Answer]: A

## Q8. [Maintainer] Should the error-rate email need a minimum number of requests?

The requirement sends an email when more than 5% of requests fail in 5
minutes. With a handful of visitors, a single failed request is more than 5%,
so one hiccup at a quiet hour would email you.

A. Yes: only when at least 20 requests arrived in the 5 minutes and more than 5% failed. Changes the requirement slightly
B. No: keep it as written; an email for any failure at quiet hours is acceptable
C. Yes, with a second rule: also email when 3 or more requests fail in 5 minutes whatever the total
X. Other (please specify)

[Answer]: A

## Q9. [Developer] Terraform itself, or OpenTofu?

Follow-up to Q4. Since 2023 Terraform is published under the Business Source
License, which is not among the licences your planning document allows without
approval (MIT, Apache 2.0, BSD, ISC). It is free to use for a project like
this one; the licence restricts offering Terraform itself as a competing
service. OpenTofu is the community continuation under the MPL 2.0 licence, and
reads the same files.

A. Terraform, with its licence approved here as an exception
B. OpenTofu, with the MPL 2.0 licence approved here
X. Other (please specify)

[Answer]: A

## Q10. [Developer] Where is the infrastructure tool's state kept?

Follow-up to Q4. Unlike CDK, Terraform keeps a record of what it created (its
"state"), and that record must exist before the pipeline's first run. It can
contain sensitive values.

A. In a private, encrypted, versioned storage bucket in your AWS account, created by the one-time setup. The setup then makes three things, in this order: the budget alarm, the link that lets the pipeline sign in, and this bucket
B. In HashiCorp's hosted service (HCP Terraform): nothing more for the setup to make, but an outside service holds the record and its sign-in
X. Other (please specify)

[Answer]: A

## Q11. [Developer] Which tool scans the infrastructure definitions for security problems?

Follow-up to Q4. Your planning document named cdk-nag, which works only with
CDK. Your practices require a scan of the infrastructure code in the pipeline.

A. Checkov (Apache 2.0 licence): widely used for Terraform; a Python tool run in the pipeline
B. Trivy (Apache 2.0 licence): one tool that scans both the infrastructure definitions and the dependencies
C. Decide for me, and explain the choice so I can change it at approval
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Region (Q1): `us-east-1`.
- Server side (Q2): Amazon API Gateway (HTTP API) with AWS Lambda.
- Page (Q3): React with Vite. React and React DOM (MIT licence) are thereby approved as new libraries.
- Infrastructure as code (Q4, Q9): Terraform, with its Business Source License approved as an exception. Its files are written in Terraform's own language, an accepted exception to "new code is TypeScript".
- Terraform's state (Q10): a private, encrypted, versioned bucket made by the one-time setup, which now makes three things in order: the budget alarm, the pipeline's sign-in link, and this bucket.
- Security scan of the infrastructure (Q11): Checkov (Apache 2.0), approved as a new tool.
- Pipeline (Q5): GitHub Actions.
- Repository (Q6): new code beside the old; `app/` is left alone apart from removing its committed `node_modules`.
- PostgreSQL service (Q7): chosen at Infrastructure Design with real prices; here only "PostgreSQL, current major version".
- Error-rate email (Q8): only when at least 20 requests arrived in 5 minutes and more than 5% failed. This amends FR12.6.
- Not asked, chosen by the designer: speed targets for the slice. The site-information call answers within 1 second for 95 of 100 requests once warm, and within 5 seconds after a period of no use; the page is usable within 3 seconds on a phone connection.
- Not asked, taken from your planning document: Powertools for AWS Lambda for logs and measurements; `pg` for database access; Zod for input validation.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

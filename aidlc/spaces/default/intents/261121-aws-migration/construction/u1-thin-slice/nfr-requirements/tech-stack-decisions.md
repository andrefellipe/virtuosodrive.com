# Technology Decisions: U1, the thin slice

The technology the system is built with, and why. The slice is the first
Unit, so these choices hold for every Unit after it unless a later Unit's own
decisions say otherwise. Nine were the maintainer's to make and are marked
with the answer that made them; the rest follow from the planning documents.

Sources: the maintainer's technical environment document
(`aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md`), the
analysis of the old code
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`), the
slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`,
`rules.md` beside it), requirements NFR1, NFR11, NFR12, NFR13 and NFR15
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the project and team rules, and answers Q1 to Q11 in
`nfr-requirements-questions.md`.

Exact version numbers are not fixed here. Each tool is taken at its current
stable version when the Unit is built and pinned exactly from then on
(security requirement NFR15.6).

## Decided

| # | Area | Decision | Decided by |
|---|------|----------|------------|
| T1 | Region | `us-east-1` (N. Virginia), one Region | Answer Q1 |
| T2 | Server side | Amazon API Gateway (HTTP API) in front of AWS Lambda, Node.js 24 on arm64, as one application with clear modules inside | Answer Q2; planning document |
| T3 | Page | React with Vite, in TypeScript, built to static files served from Amazon S3 through Amazon CloudFront | Answer Q3; planning document |
| T4 | Infrastructure as code | Terraform, with the AWS provider | Answers Q4, Q9 |
| T5 | Terraform's state | A private, encrypted, versioned S3 bucket with locking, made by the one-time setup | Answer Q10 |
| T6 | Infrastructure security scan | Checkov | Answer Q11 |
| T7 | Pipeline | GitHub Actions, signing in to AWS through OpenID Connect; production through a protected environment that needs the maintainer's approval | Answer Q5 |
| T8 | Repository layout | New top-level folders beside the old `app/`; one workspace of packages | Answer Q6 |
| T9 | Database | PostgreSQL, current major version. Which AWS service runs it is decided at Infrastructure Design with prices | Answer Q7; project rule |
| T10 | Language | TypeScript with `strict` on, for the page, the server, the tests and the tools. No new plain JavaScript | Project and team rules |
| T11 | Database access | `pg` with parameterised statements; versioned SQL changes kept in the repository. The tool that applies them is chosen at the next step (quality design) | Planning document; project rule |
| T12 | Input validation | Zod, on every value taken from a request | Planning document; project rule |
| T13 | Logs and measurements | Powertools for AWS Lambda (TypeScript) | Planning document |
| T14 | AWS calls | AWS SDK for JavaScript v3, only the clients used | Project rule |
| T15 | Tests | Vitest for unit and integration tests; Testcontainers for a real PostgreSQL in integration tests; Playwright for end-to-end tests | Team practices |
| T16 | Lint and format | ESLint with typescript-eslint; Prettier with its defaults | Team practices |
| T17 | Secrets | AWS Secrets Manager | Planning document; project rule |
| T18 | Logs, measurements, alarms | Amazon CloudWatch; alarm emails through Amazon SNS; the budget alarm through AWS Budgets. The once-a-minute health monitor from outside (observability requirement NFR10.9) is an AWS-managed check; which one is chosen at Infrastructure Design by price | Planning document |
| T20 | Check for the access password | A part placed where requests enter, chosen at Infrastructure Design under security requirement NFR2.5: no fixed monthly cost, in front of both the page's files and the server's operations | This step; functional design answer Q2 |
| T19 | Name and certificate | The existing Amazon Route 53 zone; a certificate from AWS Certificate Manager | Requirements answer |

## Why, and what was turned down

### T1. `us-east-1`

- **Why.** The maintainer put lowest price before closeness and has no rule on where data is kept (feasibility). This Region has the lowest prices and every service the plan might use. A certificate for a site served through CloudFront must be issued in this Region in any case, so using it for everything avoids working across two.
- **Turned down.** `sa-east-1` (São Paulo): closer to the students, but noticeably dearer, with the US$50 ceiling already tight.
- **Cost of the choice.** Requests to the server travel from Brazil to the United States and back. The page's files are served from nearby by CloudFront; the calls are not. The speed targets in `performance-requirements.md` are set with that in mind.
- **Reversible?** With effort: everything is defined in code, but the data would have to be moved.

### T2. API Gateway with Lambda

- **Why.** Costs nothing when idle, which suits a site that is quiet most of the time; the best-documented shape, which suits a maintainer learning AWS.
- **Turned down.** Lambda Web Functions: new in October 2026 and in few Regions; less written about it. Containers: an always-on cost and more to operate.
- **Cost of the choice.** The first request after a quiet period is slower (performance requirement NFR9.2). Many copies of the server can run at once, each wanting a database connection (scalability requirement NFR11.5).
- **One application.** All operations live in one deployed application with modules inside, not one function per operation, so that the building blocks stay as boundaries in the code and a Release is one thing (rules BR3.4).

### T3. React with Vite

- **Why.** The maintainer's choice. Sixteen screens are designed; React escapes text by default, which removes by construction the fault the old site had (user text treated as markup).
- **Turned down.** Framework-free TypeScript: less to learn and a smaller download, but screen updates and safe text handling are written by hand.
- **Approved with it.** React and React DOM (MIT licence). Nothing already listed does this job.
- **Constraints.** No runtime CDN; everything bundled and pinned. The look stays the existing one (performance requirement NFR8.1), so Bootstrap's styles are bundled as a pinned dependency, not loaded from a public address as today. The old page's jQuery and Popper are not carried over; any interactive Bootstrap part that needs them is rebuilt in React when a later Unit needs it.
- **Reversible?** Costly once screens exist. This is the moment to be sure.

### T4. Terraform

- **Why.** The maintainer's choice, over the planning document's proposal of AWS CDK.
- **Turned down.** AWS CDK v2 in TypeScript: the same language as the application, and the tool the planning document and its checks (`cdk synth`, cdk-nag) assumed. OpenTofu: the same files under an open licence (answer Q9).
- **What the choice changes.**
  - Infrastructure definitions are written in Terraform's own language, not TypeScript. This is an accepted exception to "new code is TypeScript"; it does not breach "no new plain JavaScript".
  - Terraform's licence (Business Source License 1.1) is outside the planning document's allowed list; the maintainer approved it as an exception (Q9).
  - The pull request's infrastructure checks become Terraform's own format check and validation, and Checkov (T6), in place of `cdk synth` and cdk-nag. None of these needs access to AWS. Terraform's plan against a real environment needs the state, so it runs only after the merge, under that environment's identity, before anything is applied (security requirement NFR15.2).
  - Terraform does not package the server's code or the page's files; the pipeline builds both and Terraform is handed the results.
  - Terraform keeps state (T5), which CDK does not, and that adds a third thing to the one-time setup.
- **The planning document** (`technical-environment.md`) still names CDK and cdk-nag. It is the maintainer's document and is not edited here; where it and this document differ, this one records the later decision.

### T5. State in an S3 bucket made by the setup

- **Why.** The record stays in the maintainer's own account, encrypted and versioned, with no outside service.
- **Turned down.** HashiCorp's hosted service: one more account and sign-in outside AWS.
- **What it changes.** The one-time setup now makes three things, in this order: the budget alarm with its notification channel, what lets the pipeline sign in (two identities and their outer limit, security requirements NFR15.1 and NFR15.13), and this bucket. The slice's design (rules BR4.1, BR4.2) was written when it made two; the maintainer confirmed three in this step's summary. The setup's own definitions are in the repository too. Its state starts on the maintainer's machine and is moved into the bucket as the setup's last act (NFR15.5).

### T6. Checkov

- **Why.** The maintainer's choice. It reads Terraform directly and covers the checks cdk-nag would have made (encryption, public access, over-broad permissions).
- **Turned down.** Trivy: one tool for infrastructure and dependencies.
- **Approved with it.** Checkov (Apache 2.0). It is a Python tool run only in the pipeline; it is not part of the application.
- **Dependencies** are audited separately by the package manager's own audit (security requirement NFR15.7).

### T7. GitHub Actions

- **Why.** The checks appear on the pull request, which is where the team's rule needs them; short-lived AWS credentials through OpenID Connect; approval before production through a protected environment.
- **Turned down.** AWS CodePipeline with CodeBuild: extra wiring to report to the pull request, and a monthly cost.
- **To confirm at the pipeline step.** That the repository's GitHub plan allows branch protection and protected environments (carried from the delivery plan). If it does not, the production approval and the merge block need another mechanism.

### T8. Beside the old code

- **Why.** The old site is deployed by hand from `app/public` and must not change before the switch (project rule).
- **Turned down.** Replacing `app/` in place.
- **Layout, in outline.** A folder each for the page, the server, the infrastructure definitions, the one-time setup, the end-to-end tests, and the examples later Units copy; the exact names are fixed at the code plan. `app/` is touched once, to remove its committed `node_modules` (rules BR7.1), and coverage and lint ignore it (NFR12.2).

### T9. PostgreSQL, service chosen later

- **Why later.** It is the largest fixed cost and decides whether two environments fit under US$50; the maintainer chose to decide with prices side by side (Q7).
- **What is fixed now.** PostgreSQL, a current major version, reached by the server over an encrypted connection with `pg`; integrity enforced in the database (foreign keys, unique names within a folder), which rules out a "PostgreSQL-compatible" service that lacks them.

## Test and traceability requirements

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR12.1 | Lint, type check, unit tests and integration tests run on every pull request; end-to-end tests run against the test environment after every merge | The pull request's checks and the pipeline | NFR12; rules BR3.1, BR3.4 |
| NFR12.2 | Line coverage of unit and integration tests together is one figure over all new TypeScript in the repository; the old `app/` folder, generated files, configuration files and the tests themselves are not counted; below 80% the pull request cannot merge | The coverage threshold in the test runner's configuration, enforced in the pull request | NFR12; functional design answer Q4; rules BR3.2 |
| NFR12.3 | Integration tests use a real PostgreSQL, started for the test run; no test replaces the database with a stand-in. AWS services are replaced at the SDK's boundary | Review of the tests; a lint rule against the database stand-in pattern | NFR12; project rule; team practices |
| NFR12.4 | One command runs everything a pull request runs (lint, type check, unit and integration tests with coverage); a second runs the end-to-end tests against a named environment. The first is the candidate for the check that proves each finished Unit | The commands exist and are documented | NFR12; delivery plan (the check is chosen at the first checkpoint) |
| NFR13.2 | `aidlc attest resolve` over the range of this Unit's changes reports nothing drifted, unattested, unverifiable or indeterminate | Run at the Unit's checkpoint | NFR13 |

Terraform's files are not TypeScript and are outside the coverage figure;
their checks are the format check, validation, the plan, and Checkov.

## New libraries and tools approved in this step

The project rule asks for the maintainer's approval before adding anything
not already listed, with its purpose, licence, and whether something listed
could do the job.

| Item | For | Licence | Could something listed do it? | Approved |
|------|-----|---------|-------------------------------|----------|
| React, React DOM | Building the page | MIT | No; the alternative was no framework | Q3 |
| Terraform, AWS provider | Infrastructure as code | BUSL 1.1 (Terraform); MPL 2.0 (provider) | AWS CDK was listed and was not chosen | Q4, Q9 |
| Checkov | Scanning infrastructure definitions | Apache 2.0 | cdk-nag was listed and works only with CDK | Q11 |
| Bootstrap, as a bundled dependency | Keeping the existing look | MIT | It is what the old site uses, loaded from a public address | Not asked: see open point 1 |

Still to be approved, each named with its licence and put to the maintainer
before it is added (at the next step for the first, at the code plan for the
rest): the tool that applies database changes; Vite's plugin for React; the
lint plugin for React that security requirement NFR3.4 relies on; the
accessibility scanner that performance requirement NFR6.1 relies on; the
secret scanner that NFR15.4 relies on; React's testing helpers; and Bootstrap
as a bundled dependency. A requirement that relies on one of these cannot be
met until it is approved; if one is refused, the requirement's check is
redesigned, not dropped.

## Open points

1. **Bootstrap as a bundled dependency** was not put to the maintainer. It follows from "the look is unchanged" and "no runtime CDNs", but under the project rule it needs approval before it is added. It is asked at this Unit's code plan.
2. **The AWS provider's licence (MPL 2.0)** is also outside the allowed list and was not named in question Q9, which asked about Terraform itself. It comes with the choice of Terraform; stated here so that the approval is given knowingly.
3. **The planning document names CDK and cdk-nag** and is now out of date on that point. Updating it is the maintainer's to do or to ask for.
4. **The one-time setup now makes three things**, where the slice's design says two. The design is the earlier document; this one holds.
5. **Whether GitHub's plan allows branch protection and protected environments** on this repository is unverified.

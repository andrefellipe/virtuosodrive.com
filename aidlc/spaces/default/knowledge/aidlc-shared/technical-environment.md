# Virtuoso Drive: Technical Environment

> Save as `aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md`
> before the first `/aidlc` run. AI-DLC does not create the `aidlc-shared/`
> folder, so create it yourself.
> Draft written from a review of this repository at commit `de24f7c` (2019-06-13).
> Lines marked **[confirm]** or **[decide]** are yours to settle. The list of
> open decisions is at the end.

## Project Technical Summary

- **Project name**: Virtuoso Drive
- **Project type**: Existing codebase. Replatform from Firebase (Google Cloud) to AWS
- **Runtime environment**: Cloud
- **Cloud provider**: AWS only. No Google Cloud or Firebase dependency at runtime after cut-over
- **Deployment model**: Serverless first
- **Team size and key skills**: One developer. JavaScript and Node.js experience. Learning AWS and AI-DLC, so prefer mainstream, well-documented choices over clever ones

## Programming Languages

### Required

| Language | Version | Purpose | Reason |
|----------|---------|---------|--------|
| TypeScript | Current stable, `strict` on | Frontend, API, infrastructure code, migration tooling | One language across the stack; the existing code is JavaScript |
| SQL (PostgreSQL dialect) | As offered by the chosen service | Schema migrations and queries | PostgreSQL is the required data store |

Runtime: Node.js 24 LTS (AWS Lambda `nodejs24.x`, supported there until April 2028).

### Existing, and the direction for each

| Language | Where | Direction |
|----------|-------|-----------|
| JavaScript (ES2015 classes, no build step) | `app/public/js/` | Migrate to TypeScript modules |
| JavaScript (CommonJS) | `app/app.js`, `app/bin/www`, `app/routes/` | Remove. Not used in production |
| EJS | `app/views/` | Remove. `index.ejs` duplicates `public/index.html` |

### Prohibited

| Language | Reason |
|----------|--------|
| New plain JavaScript source files | Types are part of the modernisation. Tool config files are the exception |

## Frameworks and Libraries

### Required

| Framework or library | Area | Reason |
|----------------------|------|--------|
| AWS SDK for JavaScript v3 (modular clients) | All AWS calls | v2 is out of support |
| AWS CDK v2 in TypeScript **[confirm]** | Infrastructure as code | Same language as the application; checked with `cdk synth` |
| `pg` (node-postgres), parameterised queries | Database access | Standard PostgreSQL driver |
| Versioned SQL migrations kept in the repository | Schema changes | Reviewable and repeatable. The tool is chosen at NFR Design |
| Zod | Validation of every API input | No unvalidated external input |
| Powertools for AWS Lambda (TypeScript) | Structured logs, metrics, tracing | AWS-maintained standard |
| Vitest | Unit and integration tests | One runner for frontend and backend |
| Playwright | End-to-end tests of the key journeys | Tests what the student actually does |
| ESLint with typescript-eslint, and Prettier | Lint and format | Enforced in the pipeline |

### Preferred when the need arises

| Library | Purpose | Use when |
|---------|---------|----------|
| Testcontainers (PostgreSQL) | Integration tests against a real database | Any code that runs SQL |
| cdk-nag | Security checks on the synthesised infrastructure | Every stack |

### Prohibited

| Library or practice | Reason | Use instead |
|---------------------|--------|-------------|
| Firebase SDKs in the application | Removing them is the purpose of this work | AWS SDK v3 behind the API. Allowed only in the one-off, read-only migration tooling |
| AWS SDK for JavaScript v2 | Out of support | AWS SDK v3 |
| SQL built by string concatenation | Injection risk | Parameterised queries |
| `innerHTML` with user-supplied text | Source of today's stored cross-site scripting | `textContent`, or a framework that escapes by default |
| Committed `node_modules/` | Hides dependency drift, bloats the repository | Lockfile plus a clean install in the pipeline |
| Scripts loaded from public CDNs at runtime | Supply-chain exposure, no pinning | Bundled, pinned dependencies |
| Cloud credentials or long-lived keys in the browser | They are public the moment they ship | Short-lived tokens and pre-signed URLs issued by the API |

### Getting a new library approved

The maintainer approves it at a gate. The request states what it is for, its
licence, and whether something already listed could do the job.

## Cloud Environment

- **Provider**: AWS
- **Account structure**: Single dedicated account for this project, with a budget alarm before any resource is created
- **Regions**: **[decide]** `sa-east-1` (São Paulo, closest to the users, higher prices) or `us-east-1` (lowest prices, widest service coverage). One Region, no disaster-recovery Region

### Allowed services

| Service | Approved use | Constraints |
|---------|--------------|-------------|
| Amazon S3 | File contents; built frontend assets | Block Public Access on; encryption on; versioning on the content bucket; browsers reach it only through short-lived pre-signed URLs or CloudFront |
| Amazon CloudFront | HTTPS delivery of the frontend | Origin access control to S3; TLS 1.2 or later |
| AWS Lambda | API handlers; migration and maintenance jobs | Node.js 24, arm64; nothing long-running |
| Amazon API Gateway (HTTP API) | Public entry point for the API | Token authoriser on every mutating route |
| Amazon Aurora PostgreSQL (serverless) or Amazon RDS for PostgreSQL **[decide]** | System of record for folders and file metadata | Encrypted; automated backups; no shared password in code; choose with a cost estimate at Infrastructure Design |
| Amazon Cognito | Sign-in | Managed login; no passwords handled by application code |
| AWS Secrets Manager, Systems Manager Parameter Store | Secrets and configuration | Never in source or in the frontend bundle |
| Amazon CloudWatch, AWS X-Ray | Logs, metrics, alarms, dashboards, traces | Log retention set explicitly |
| AWS IAM, including OIDC federation for the pipeline | Access control | Least privilege; no long-lived access keys in the pipeline |
| AWS CloudFormation through CDK | All provisioning | Nothing created by hand in the console |
| AWS Budgets | Cost guardrail | Alarm at the agreed monthly ceiling |

### Permitted with justification

| Service | When it may be used |
|---------|---------------------|
| Amazon Aurora DSQL | Only if the design needs no trigger, stored procedure or extension, and "PostgreSQL-compatible" is accepted as meeting the PostgreSQL requirement. Check its current list of unsupported features first |
| AWS Lambda Web Functions | If available in the chosen Region and it removes the need for API Gateway. Launched October 2026 in a limited set of Regions |
| Amazon ECS (Express Mode, Fargate) | Only if a requirement needs a long-running server |
| AWS AppSync Events or API Gateway WebSocket APIs | Only if live list updates are confirmed as a requirement |
| AWS DataSync | One-off copy of file contents from Google Cloud Storage to S3 |

### Disallowed services

| Service | Reason | Use instead |
|---------|--------|-------------|
| Any Google Cloud or Firebase service at runtime | Removing them is the purpose of this work | The AWS services above |
| AWS App Runner | Closed to new customers since 30 April 2026 | Lambda, or ECS Express Mode |
| Amazon EC2 instances managed by hand | Operational burden for one person | Lambda and managed services |
| Amazon DynamoDB as the system of record | The requirement is PostgreSQL | PostgreSQL |
| NAT gateways, unless justified at Infrastructure Design | Fixed monthly cost out of proportion to this application | A design that needs none, or VPC endpoints |

## Architecture and Patterns

| Pattern | When to use | When not to use |
|---------|-------------|-----------------|
| Static single-page frontend plus JSON API | Default | n/a |
| Serverless first | Default for compute | Long-running or connection-heavy work |
| Modular monolith (one API, clear modules) | This application | Splitting into separately deployed services |

The browser never talks to the database, and never holds cloud credentials
beyond short-lived tokens and pre-signed URLs.

### API standards

- **Style**: REST over HTTPS, JSON
- **Versioning**: URL path (`/v1/...`)
- **Documentation**: OpenAPI 3.x, kept in the repository and checked in the pipeline
- **Naming**: kebab-case paths, camelCase JSON fields
- **Errors**: Problem Details (`application/problem+json`)

### Data

- **Primary store**: PostgreSQL for the folder tree and file metadata
- **File contents**: S3 only. The database stores the object key, size, content type and checksum
- **Identity of records**: stable generated IDs. Today a folder's children are keyed by the folder's display name, and renaming a folder is not implemented
- **Integrity**: enforced in the database: foreign keys for parent folders, unique name within a folder, not-null where required
- **Schema changes**: versioned migrations, applied by the pipeline, each with a tested way back or a documented roll-forward

### Messaging

- **Synchronous**: HTTPS from the frontend to the API
- **Asynchronous**: none in the first release

### Frontend

- **Framework**: **[decide]** React with Vite, or framework-free TypeScript with Vite. The interface is one table and a toolbar
- **Styling**: keep the current Bootstrap look unless a redesign is chosen **[confirm]**
- **Build**: bundled, pinned dependencies, no runtime CDNs

## Security

### Sign-in and access

- **Authentication**: Amazon Cognito user pool with managed login, OIDC tokens
- **Authorisation model**: role-based: reader, contributor, administrator **[confirm against vision open question 1]**
- **Tokens and sessions**: short-lived access tokens validated at the API on every mutating route

### Data protection

- **At rest**: encryption on for S3 and the database
- **In transit**: TLS 1.2 or later everywhere
- **Personal data**: the sign-in identifier (email) only. LGPD is assumed to apply **[confirm]**

### Secrets

- **Storage**: Secrets Manager, or IAM database authentication where the service supports it
- **Never**: secrets in source code, in config files, or in the frontend bundle
- **Legacy note**: the Firebase web configuration is hard-coded in `app/public/js/VirtuosoController.js`. It leaves with the Firebase SDK

### Compliance

- **Frameworks**: the current OWASP Top 10 for the application and API, and the security pillar of the AWS Well-Architected Framework for the infrastructure. The per-category mapping is produced at NFR Requirements
- **Audit logging**: who created, renamed or deleted which file or folder, and when
- **Scanning**: dependency audit and cdk-nag in the pipeline
- **Licences**: MIT, Apache 2.0, BSD and ISC allowed. GPL and AGPL need approval

### Weaknesses in the existing system that the new one must not have

- Public read and write on the database and on file storage (`app/database.rules.json`, `app/storage.rules`)
- User-supplied names rendered as HTML (`VirtuosoController.js`, lines 141, 713 and 718)
- No server-side validation of names, sizes or types, and no upload limit

## Testing

| Test type | Required | Target | Tooling |
|-----------|----------|--------|---------|
| Unit | Yes | Every module with logic | Vitest |
| Integration | Yes | Every SQL statement and every API route, against a real PostgreSQL | Vitest with Testcontainers |
| End-to-end | For key journeys | Browse, upload, download, rename, delete, sign-in, rejected anonymous write | Playwright |
| Security | Yes | Dependencies and infrastructure | Dependency audit, cdk-nag |
| Migration verification | Yes | File and folder counts and sizes equal the source export | Scripted check, kept in the repository |
| Performance | Not in the first release | n/a | n/a |

- **Mocking**: mock AWS service calls at the SDK boundary. Never mock the database in integration tests
- **Test location**: next to the source
- **Naming**: `describe` and `it`

### Pipeline gates

| Pipeline step | Checks that must pass | On failure |
|---------------|-----------------------|------------|
| Pull request | Lint, type check, unit and integration tests, `cdk synth`, cdk-nag | Block the merge |
| Before deploy | End-to-end tests against the deployed test environment | Block the deploy |

## Example Code

No file in the existing codebase is a pattern to copy.
`app/public/js/VirtuosoController.js` is the behavioural reference: it defines
what the application does, not how new code should look.

The first Unit establishes working examples under `examples/` (an API route
with its test, a database repository with its integration test, an
infrastructure construct). This document is then updated to point to them, and
every later Unit follows them.

## Existing Technical Inventory

- **Languages and frameworks, with versions**: browser JavaScript with no build step; Firebase JS SDK 6.1.0 (app, database, storage), Bootstrap 4.3.1, jQuery 3.3.1 slim and Popper 1.14.7, all loaded from public CDNs. In the unused server scaffold: Express 4.16.4, EJS 2.6.1, morgan 1.9.1, cookie-parser 1.4.4, http-errors 1.6.3, debug 2.6.9, formidable 1.2.1. npm lockfile version 1. No Node.js version pinned
- **Infrastructure and deployment**: Firebase project `virtuoso-drive`: Hosting serving `app/public` with a rewrite of every path to `index.html`, Realtime Database, and Cloud Storage bucket `virtuoso-drive.appspot.com`. Deployed by hand with the Firebase CLI. One environment
- **Data model today**: Realtime Database tree rooted at `All`. Each folder path holds entries under generated keys: files as `{name, type (content type), path (storage path), size}`, folders as `{name, type: "folder", path (parent path)}`. A folder's children live under the folder's display name. File contents are stored at `<folder path>/<file name>`
- **Test coverage today**: none. No tests, no linter configuration, no pipeline
- **Known technical debt**: `app/node_modules/` is committed (345 files) although `.gitignore` lists it; the Express scaffold is dead code; `formidable` is unused; dependencies date from 2018 and 2019; the defects listed in `vision.md`

### Keep

| Technology or asset | Reason to keep |
|---------------------|----------------|
| The feature set and the single-screen flow | It is the product |
| Logo, favicon and SVG icon set (`app/public/images/`) | Still fit for purpose |
| Bootstrap look **[confirm]** | Familiar to the users |
| Git history | The baseline for comparison and for provenance |

### Migrate

| Today | Target | Priority | Approach |
|-------|--------|----------|----------|
| Firebase Hosting | S3 and CloudFront | High | Build with the pipeline; switch the public address last |
| Firebase Realtime Database | PostgreSQL | High | Export to JSON, transform to the relational model with generated IDs, load, verify counts |
| Cloud Storage for Firebase | Amazon S3 | High | Bulk copy, then verify sizes and checksums against the metadata |
| Browser calls to database and storage | Browser to API to PostgreSQL and S3 | High | New API; uploads and downloads through pre-signed URLs |
| No sign-in, public rules | Cognito and server-side authorisation | High | New capability |
| Realtime listeners | **[decide]** refresh after each action, polling, or a WebSocket channel | Medium | Depends on vision open question 3 |
| JavaScript with script tags | TypeScript modules with a bundler | Medium | Rewrite the one controller as typed modules with tests |
| Manual `firebase deploy` | Pipeline with OIDC and infrastructure as code | High | Built before the first feature Unit so every Unit deploys through it |

### Remove

| Item | Reason | When |
|------|--------|------|
| `app/node_modules/` from Git | Should never be committed | First construction Unit |
| `formidable` dependency | Unused | First construction Unit |
| Express scaffold: `app/app.js`, `app/bin/www`, `app/routes/`, `app/views/` | Not used in production | When the new application replaces it |
| Firebase SDK and configuration, `firebase.json`, `.firebaserc`, `database.rules.json`, `storage.rules` | No Google Cloud dependency after cut-over | After cut-over is accepted |

### While old and new coexist

- **Two systems side by side**: the Firebase site stays live and unchanged while the AWS version is built and tested. Nothing writes to Firebase from the new system
- **Data**: one-way migration. A rehearsal run first, then a final run inside a short read-only window at cut-over
- **Rollback**: until the AWS version is accepted, rollback is simply continuing to use the Firebase site
- **Schema changes**: versioned migrations from the first table onward, including the load of migrated data
- **Decommissioning Firebase**: a separate, later piece of work

## Open Technical Decisions

Each of these should be asked and recorded at a gate, not assumed:

1. AWS Region: `sa-east-1` or `us-east-1`
2. PostgreSQL service: Aurora PostgreSQL serverless, RDS for PostgreSQL, or Aurora DSQL
3. Compute shape for the API: API Gateway with Lambda, Lambda Web Functions, or containers
4. Frontend: React with Vite, or framework-free TypeScript
5. Infrastructure as code: CDK (proposed) or Terraform
6. Live updates: none, polling, or WebSocket
7. Repository layout: replace `app/` in place, or build beside it and remove the legacy at cut-over

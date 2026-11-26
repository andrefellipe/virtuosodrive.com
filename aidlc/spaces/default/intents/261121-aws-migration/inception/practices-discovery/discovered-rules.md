# Discovered Rules: Virtuoso Drive

> Hard constraints the owner has stated in writing, and nothing else: the
> Prohibited and Disallowed tables and the explicit "never" statements of
> `aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md`, and
> the statements confirmed in decision D-12. Lines the owner marked [confirm]
> or [decide] are left out, and so are the practices in `team-practices.md`.
> The source of each rule is listed in `evidence.md`.

## Mandated

- ALWAYS use PostgreSQL as the system of record for folders and file metadata.
- ALWAYS validate every API input before it is used.
- ALWAYS have the budget alarm in place before any other AWS resource is created.
- ALWAYS get the maintainer's approval at a gate before adding a library that is not already listed, stating what it is for, its licence, and whether something already listed could do the job.
- ALWAYS keep encryption at rest on for S3 and the database, and use TLS 1.2 or later in transit.

## Forbidden

- NEVER add new plain JavaScript source files; tool configuration files are the exception.
- NEVER depend on any Google Cloud or Firebase service at runtime in the AWS version.
- NEVER write to Firebase from the new system, or change the live Firebase site while the AWS version is being built and tested.
- NEVER use the AWS SDK for JavaScript v2.
- NEVER build SQL by string concatenation.
- NEVER assign user-supplied text to `innerHTML`.
- NEVER commit `node_modules/`.
- NEVER load scripts from public CDNs at runtime.
- NEVER put cloud credentials or long-lived keys in the browser.
- NEVER let the browser talk to the database directly.
- NEVER put secrets in source code, in config files, or in the frontend bundle.
- NEVER use long-lived access keys in the pipeline.
- NEVER create AWS resources by hand in the console.
- NEVER mock the database in integration tests.
- NEVER use AWS App Runner.
- NEVER use Amazon EC2 instances managed by hand.

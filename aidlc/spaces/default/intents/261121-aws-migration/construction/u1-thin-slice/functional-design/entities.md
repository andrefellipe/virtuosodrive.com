# Entities: U1, the thin slice

The things the thin slice knows about. Only one of them is kept in the
database; the others are answers, log entries, or facts about a deployment.
None is a product entity: folders, files and accounts arrive with later Units.

Sources: the Unit's definition
(`aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`),
contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
requirements FR12.5 and NFR5
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
and the answers Q1 to Q4 in `functional-design-questions.md`.

```yaml
entities:
  - name: SiteInformation
    description: >
      The single record the slice reads from the database. It is created by
      the first change to the database structure, so reading it proves that
      such changes are applied and that the database answers.
    stored_in: database
    attributes:
      - name: id
        type: identifier
        required: true
        unique: true
        constraints: Exactly one record exists; its identifier is fixed.
      - name: installedAt
        type: timestamp (UTC)
        required: true
        constraints: Set once, when the record is created; never changed.
    constraints:
      - There is exactly one SiteInformation record per environment.
      - The record is never changed or removed by the running site.
    relationships: []

  - name: Release
    description: >
      One version of the whole system, built from one merged change, and
      where it currently stands on its way to production.
    stored_in: the pipeline's own record; not in the database
    attributes:
      - name: version
        type: text
        required: true
        unique: true
        constraints: Identifies the merged change the release was built from.
      - name: state
        type: enumeration
        required: true
        allowed_values:
          - built
          - verifying
          - verified
          - blocked
          - approved
          - superseded
        constraints: Says how far the Release has come towards being allowed into production. Where it is running is not held here; it follows from Deployments.
      - name: builtAt
        type: timestamp (UTC)
        required: true
    constraints:
      - A Release is built once and never rebuilt; the same build is what every environment receives.
      - Only the newest verified Release can be approved.
    relationships:
      - to: Deployment
        cardinality: one-to-many
        direction: a Release is put in place by Deployments

  - name: Deployment
    description: >
      One attempt to put one Release in place in one environment, going
      forward or going back. The history of Deployments in an environment
      says which Release is running there and which ran before it.
    stored_in: the pipeline's own record; not in the database
    attributes:
      - name: environment
        type: enumeration
        required: true
        allowed_values: [test, production]
      - name: release
        type: text
        required: true
        references: Release.version
      - name: direction
        type: enumeration
        required: true
        allowed_values: [forward, back]
      - name: startedAt
        type: timestamp (UTC)
        required: true
      - name: outcome
        type: enumeration
        required: true
        allowed_values:
          - inProgress
          - succeeded
          - notPutInPlace
          - inPlaceButFailing
        constraints: >
          succeeded: the Release is in place and its check passed.
          notPutInPlace: it failed before the Release replaced what was
          running, so the environment runs what it ran before.
          inPlaceButFailing: the Release replaced what was running and its
          check then failed.
    constraints:
      - At most one Deployment is inProgress in an environment at a time.
      - The running Release of an environment is the Release of its latest Deployment whose outcome is succeeded or inPlaceButFailing. There is exactly one once the first Deployment has put a Release in place.
      - The previous Release of an environment is the Release that was running there immediately before the running one. It is kept available so it can be put back.
    relationships:
      - to: Release
        cardinality: many-to-one
        direction: a Deployment puts one Release in place

  - name: SiteStatus
    description: >
      The answer to the slice's one server call. Not stored: assembled from
      the SiteInformation record and from what the running Release knows
      about itself.
    stored_in: nowhere (an answer)
    attributes:
      - name: installedAt
        type: timestamp (UTC)
        required: true
        references: SiteInformation.installedAt
      - name: version
        type: text
        required: true
        references: Release.version
      - name: environment
        type: enumeration
        required: true
        allowed_values: [test, production]
    constraints:
      - Exists only if the database read succeeded.
    relationships:
      - to: SiteInformation
        cardinality: one-to-one
        direction: SiteStatus reads SiteInformation
      - to: Release
        cardinality: many-to-one
        direction: SiteStatus names the running Release

  - name: HealthReport
    description: The answer to the health check (contract C1).
    stored_in: nowhere (an answer)
    attributes:
      - name: status
        type: enumeration
        required: true
        allowed_values: [ok]
    constraints:
      - Carries nothing else. A failure is a Problem, not a HealthReport.
    relationships: []

  - name: Problem
    description: The one shape every failure answer takes (contract C1).
    stored_in: nowhere (an answer)
    attributes:
      - name: type
        type: text
        required: true
      - name: title
        type: text
        required: true
      - name: status
        type: whole number
        required: true
      - name: code
        type: enumeration
        required: true
        allowed_values: [invalidInput, notFound, tooManyRequests, serverError]
        constraints: The slice uses only these four of the codes contract C1 lists.
      - name: detail
        type: text
        required: false
        constraints: Never contains internal names, addresses, queries or stack traces.
    constraints: []
    relationships: []

  - name: RequestLogEntry
    description: >
      One entry written for every request the server receives (FR12.5). A
      request refused for want of the access password never reaches the
      server; it is recorded by an entry of the same shape, with the
      operation given as "access refused".
    stored_in: the log store; kept 30 days
    attributes:
      - name: time
        type: timestamp (UTC)
        required: true
      - name: requestId
        type: text
        required: true
      - name: operation
        type: text
        required: true
        constraints: The name of the operation, never the full address with its query.
      - name: outcome
        type: whole number
        required: true
        constraints: The status the server answered with.
      - name: durationMs
        type: whole number
        required: true
        min: 0
      - name: account
        type: identifier
        required: false
        constraints: Always absent in this Unit. When later Units fill it, it is the account's identifier, never an email address.
      - name: error
        type: text
        required: false
        constraints: Present only when the outcome is a server failure; the internal reason, for the maintainer.
    constraints:
      - No attribute ever holds an email address, a password or the access password.
    relationships: []
```

## Summary

| Entity | Kept where | Why the slice needs it |
|--------|------------|------------------------|
| SiteInformation | Database, one record | Something real to read, created by the first change to the database structure |
| Release | The pipeline's record | What "version" means on the page, and how far a version has come towards production |
| Deployment | The pipeline's record | Which Release runs in each environment, and what "the previous version" means when going back |
| SiteStatus | Not kept | What the page shows |
| HealthReport | Not kept | What monitoring asks for |
| Problem | Not kept | The shape of every failure, set here for all later Units |
| RequestLogEntry | Logs, 30 days | How the maintainer finds out what happened |

The access password that keeps each environment private is deliberately not an
entity: it is a secret held outside the database and outside the repository,
and its rules are in `rules.md` (BR2.1 to BR2.5).

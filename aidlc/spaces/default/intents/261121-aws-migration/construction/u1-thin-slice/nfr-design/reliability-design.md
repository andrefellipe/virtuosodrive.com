# Reliability Design: U1, the thin slice

How the system fails safely, how a version is put in place and put back, and
how data is recovered. The parts named are described in
`logical-components.md` beside this file.

Sources: the reliability requirements
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/nfr-requirements/reliability-requirements.md`),
with `security-requirements.md`, `performance-requirements.md`,
`scalability-requirements.md`, `observability-requirements.md` and
`tech-stack-decisions.md` beside it; the slice's design, whose workflows W3
and W5 this document gives a mechanism to
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`);
contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`);
and the answers in `nfr-design-questions.md`.

## R1. Failing fast and recovering alone (NFR10.4, NFR10.5)

| Where | Limit | On reaching it |
|-------|-------|----------------|
| Everything the server asks of the database for one request: opening a connection if needed (at most 2 seconds of it) and the statement | 3 seconds in total | The request fails with `serverError`; the connection is discarded; the next request opens a new one |
| The server as a whole, per request | 8 seconds | The platform stops it; the entry point answers with a failure |
| The page waiting for the server | 10 seconds, three tries, 1 and 3 seconds apart | The could-not-reach view, within 40 seconds |

- Each limit is shorter than the one outside it, so the innermost failure is the one reported.
- The server never sends a statement twice. If it finds its connection broken before sending, it opens a new one once, inside the same 3 seconds (performance design, P3). Retrying a failed request is the page's job, for reads only.
- No circuit breaker: with one dependency and copies that live briefly, a breaker would have nothing to remember. The short limits do its work.
- Nothing needs restarting when the database returns: a copy with a broken connection opens a new one on its next request.

## R2. What a Release is made of (NFR10.6, NFR15.8)

A Release is built once and kept, so that the same thing is deployed to both
environments and can be put back without rebuilding.

| Part | Kept as |
|------|---------|
| The server's code and the change runner's code | One package each, named by the version, in a store the pipeline's identities can read |
| The page's files | A folder named by the version in the page files store |
| The database changes it carries | SQL files inside the change runner's package |
| The infrastructure definitions | The repository at that commit |

At least the ten most recent Releases are kept in each environment (packages,
page folders and the function's numbered versions); older ones are removed
automatically, never the running or the previous one.

## R3. Putting a Release in place (NFR10.6, NFR10.7, NFR15.9)

The same sequence in test and in production. Each step must succeed before
the next.

1. **Infrastructure.** Terraform's plan is shown, then applied. **Terraform never decides which version of the code is live.** It defines the functions, the name the entry point calls, and everything around them, and is told to leave alone which numbered version that name points at and what the page's entry document contains; those are moved only by steps 3 and 4. So this step cannot put new code in front of visitors. Infrastructure changes follow the same rule as database changes (R5): they add, and never remove or alter what the running version depends on.
2. **Database changes.** The pipeline starts the change runner and waits. The runner takes a lock in the database so that two cannot run at once, applies the files not yet recorded as applied, in order, each in one transaction, and records each (node-pg-migrate). It reports what it applied.
3. **Server.** The new code is published as a new numbered version of the function, and the name the entry point calls is moved to it.
4. **Page.** The Release's folder is uploaded, then the entry document is replaced last, so a visitor never gets an entry document pointing at files not yet there.
5. **Smoke check.** With the access password: health answers ok; site information answers with this Release's version; the page loads and shows that version.

| Fails at | Outcome of the Deployment | The environment is left |
|----------|---------------------------|-------------------------|
| 1, the smoke check after 1, or 2 | Not put in place | Running the version it ran, with the old database structure, or with a structure the old version still works with (R5) |
| 3 or 4 | Not put in place, after the pipeline moves the server's name back and restores the previous entry document | Running the version it ran |
| 5 | In place but failing | Running the new version; the maintainer decides whether to go back |

A database change that fails part-way leaves no half-applied change, because
each file is one transaction. Files applied before the failing one stay
applied; R5 makes that safe.

**New code never runs against an old structure**, because step 2 completes
before step 3. **Old code does run against a new structure**, between steps 2
and 3 and after going back; R5 is what makes that safe.

**The very first deployment** has no version to keep running. Terraform
creates the functions with a placeholder that answers every request with
status 503; steps 2 to 4 then put the first Release in place.

## R4. Going back (NFR15.8)

1. The maintainer starts the "go back" workflow for an environment. In production it needs the same approval as a deployment.
2. The pipeline finds the previous Release from its record of Deployments.
3. The server's name is moved back to that Release's numbered version; that Release's entry document is put back. Nothing is rebuilt. The database and the infrastructure definitions are not touched.
4. The smoke check runs, expecting the previous version.

This takes minutes, well inside the 15 the requirement allows, and it is
rehearsed once in the test environment and timed (rules BR6.2).

**What going back does not undo.** Infrastructure changes and database changes
made by the Release being left. R5 is what makes that acceptable. If an
infrastructure change itself is the fault, the remedy is a new pull request
that reverses it.

## R5. Changes that keep the previous version working (NFR10.7, NFR15.10)

The maintainer chose compatible changes only. The rule, for the database and,
by extension, for the server's operations:

- **Add, do not alter.** New tables, new columns that are optional or have a default, new operations, new optional fields.
- **Never:** remove or rename something an earlier version still in reach uses, or tighten a rule its data could break.
- **To remove or rename, take two steps:** first stop using it; then remove it only when no version "in reach" uses it any more.
- **In reach** means: the Release running in production, production's previous Release (the one going back would restore), and every Release merged since. Production may be several Releases behind the branch, so this is more than "the one before".

**The check in the pull request**, on every pull request that touches the
server, the page, or a database file:

- the integration tests of each version in reach are run against a database with the new changes applied; and
- the page's end-to-end tests of each version in reach are run against the new server, started locally.

Which versions are in reach is read from GitHub's own record of deployments,
which needs no AWS access. In practice this is usually two or three versions.
If any fails, the pull request cannot be merged. For the very first Release
there is nothing in reach and the check says so in its output.

**What the check cannot see**, stated so that it is not over-trusted:

- A change in behaviour that no earlier test exercises. The check is as good as the earlier versions' tests.
- An infrastructure change that breaks the running version: it is applied in step 1 while the old code is live, and a pull request cannot try it against a real environment. The rule "infrastructure only adds" is kept by review and by reading the plan; the smoke check is run after step 1 as well as at the end, so that a breakage is caught before the database is touched and the Deployment ends as not put in place. Going back does not undo an infrastructure change; a new pull request does.

## R6. Backups and restore (NFR14.1 to NFR14.5)

- **Daily automatic backups kept 7 days**, in both environments, by the database service.
- **Restore to a moment** within those 7 days, where the chosen service includes it.
- **Protection against deletion** in production: a switch on the database that must be turned off by one merged pull request before a second can remove it. Terraform is also told to refuse to destroy it.
- **The restore rehearsal**, once, in the test environment: restore yesterday's backup to a new database; point the test server at it by a pull request; see the slice's page answer; switch back; remove the copy. The time each step took is recorded in the repository.
- **Terraform's state** keeps earlier versions for 90 days, so a damaged state can be rolled back.
- **The page's files and the server's packages** need no backup: they are rebuilt from the repository.

## R7. Availability (NFR10.1 to NFR10.3, NFR15.11)

- One Region; the database in whatever arrangement the chosen service offers at the lowest price. No standby. 99% a month allows about 7 hours of failure.
- The server, entry point and edge are run by AWS across several of its sites with no arrangement needed.
- Availability is read from the health monitor's figures (observability design) from the switch onwards.
- Nothing renews or rotates by hand: the certificate renews itself; backups, log expiry and old-Release removal are automatic.

## R8. The procedures a person performs (NFR15.12)

One document in the repository, written in this Unit and each procedure done
once before the Unit is complete:

| Procedure | Rehearsed by |
|-----------|--------------|
| Run the one-time setup | Doing it |
| Approve a production deployment | The first one |
| Go back to the previous version | The rehearsal in test |
| See a deployment fail safely | Once in test: a pull request with a deliberately failing database change is merged; the Deployment ends as not put in place; the test environment is seen still running the earlier version; the failed-deployment email is seen (with emailing switched on in test for the purpose); a second pull request removes the change. Recorded |
| Restore the database | The rehearsal in test |
| Replace the access password | Once in test |
| Read the logs for a request | Once |
| What to do when each alarm emails | Written; the alarms are proved once in test |

## Open points

1. **Telling Terraform to leave the live version alone** (R3, step 1) relies on a feature of the tool that lets a definition ignore later changes to one of its settings. To confirm at Infrastructure Design for the function's name and for the entry document.
2. **A Deployment that fails at step 2 after some files applied** leaves the database ahead of the running version. R5 makes this safe by rule; nothing detects a violation of R5 that the pull request's check missed.
3. **The compatibility check is as good as earlier versions' tests** and cannot try infrastructure changes (R5).
4. **Running several versions' tests on every pull request** lengthens the checks. If it becomes a burden, the list in reach is the place to look, not the rule.

# Security Requirements: U1, the thin slice

What the thin slice must do to be safe, each requirement with a way to check
it. The slice holds no personal data and has no operation that changes
content, so much of this is about the foundations every later Unit stands on:
secrets, the pipeline's access to AWS, encryption, input handling, and what
the logs may hold.

Sources: the slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`,
`rules.md` beside it), the quality requirements NFR1 to NFR5, NFR13 and NFR15
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the weaknesses found in the old code
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`), the
project rules, and the answers Q1 to Q11 in `nfr-requirements-questions.md`.

Each requirement carries the number of the requirement it details: NFR4.2 is
the second detail of NFR4.

## Who may reach what

There are no accounts in this Unit. Three kinds of caller exist:

| Caller | May reach | How it is recognised |
|--------|-----------|----------------------|
| Anyone | The health check only | Nothing needed |
| The maintainer, and the pipeline's tests | The page and the site-information call | The environment's access password (rules BR2.1 to BR2.5) |
| The pipeline | The AWS account, to deploy | Short-lived credentials issued for one run of one workflow |

## Requirements

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR1.1 | The page's built files and the server's code contain no Firebase or Google Cloud library | A check in the pull request searches the dependency list and the built files and fails if one is found | NFR1 |
| NFR1.2 | Opening the page in either environment makes no request to any Google address | The end-to-end test records every request the page makes and fails on a Google address | NFR1 |
| NFR1.3 | The page loads no script, style or font from an address other than its own | The same end-to-end test fails on any other address; a content security policy sent with the page forbids it | NFR1; project rule (no public CDNs at runtime) |
| NFR2.1 | This Unit has no operation that changes content; its two operations only read | A test lists the server's operations and fails if any accepts a method other than GET | NFR2 |
| NFR2.2 | While an environment is private, every request but the health check is refused without its access password; refusal happens before the page's files are served and before any of the server's operations runs | An end-to-end test without the password is refused with status 401 for the page and for site information, and gets 200 from the health check | NFR2; rules BR2.1 |
| NFR2.3 | Guessing the access password is made infeasible by its length (NFR2.4) and by the entry point's overall limit on requests (scalability requirement NFR11.3), not by counting wrong attempts per network address. Rule BR2.4 of the design asked for such counting; it is withdrawn here, because in the chosen stack it needs either a paid protective service or a store consulted on every request, and a 32-character random secret does not need it | Arithmetic recorded with the requirement: at the 50 requests a second NFR11.3 allows, trying one millionth of the possible passwords would take longer than the age of the universe | rules BR2.4 (withdrawn); designer's decision, for the maintainer to accept |
| NFR2.4 | The access password is at least 32 random characters from letters and digits, generated, different per environment, and replaceable through the pipeline without changing code | Inspection of how it is generated; a rehearsed replacement in the test environment | rules BR2.2 |
| NFR2.5 | The check for the access password is made where requests enter (in front of the page's files and in front of the server's operations), compares in a way that does not reveal how much of a guess was right, and adds no fixed monthly cost. Which part does it is decided at Infrastructure Design under those three conditions | Inspection at Infrastructure Design; the end-to-end test of NFR2.2 | rules BR2.1; NFR11 |
| NFR3.1 | Every value the server takes from a request (path, query, headers it reads) is checked against a declared shape before use; anything else is refused with `invalidInput` | Unit tests for each operation with missing, extra, over-long and wrongly typed values | NFR3; project rule |
| NFR3.2 | A request identifier sent by a caller is used only if it is 1 to 64 letters, digits or hyphens; otherwise it is replaced and never written to the logs as sent | Unit test with markup, a line break and a 10,000-character value | NFR3; rules BR1.4 |
| NFR3.3 | Every database statement passes its values as parameters; none is built by joining text | Lint rule or review check in the pull request; the integration test of the one read | NFR3; project rule |
| NFR3.4 | The page never writes text from the server into the document as markup | The page's framework escapes text by default; a lint rule forbids the one escape hatch (`dangerouslySetInnerHTML`) | NFR3; project rule (no `innerHTML` with user text) |
| NFR3.5 | A failure answer contains no internal name, address, query or stack trace | Unit test forces a database failure and inspects the answer | NFR3; rules BR1.5 |
| NFR4.1 | Everything stored is encrypted at rest: the database, its backups, every storage bucket (including the one holding Terraform's state), the logs, and the secrets | Checkov fails the pull request on any unencrypted store | NFR4; project rule |
| NFR4.2 | Every connection uses TLS 1.2 or later: visitor to the site, the site to the server, the server to the database, the pipeline to AWS. Plain HTTP is redirected to HTTPS | Checkov on the definitions; an end-to-end check that a TLS 1.1 connection is refused and that HTTP redirects | NFR4; project rule |
| NFR4.3 | The server's connection to the database verifies the database's certificate | Integration test fails to connect when verification is given a wrong authority | NFR4 |
| NFR5.1 | This Unit stores no personal data. The one address it handles, the maintainer's address for alarm emails, is given when the setup is run. The setup creates the notification channel and subscribes the address to it; the address is then held only by the notification service. The pipeline's alarms name the channel, never the address, so the address appears in no file of the repository, no pipeline variable and no Terraform state the pipeline writes | A check in the pull request searches the repository for the shape of an email address outside an allow-list of example addresses | NFR5; rules BR4.3 |
| NFR5.2 | No log entry contains an email address, a password, the access password, a credential or a request body | Unit test of the logger with each of these in its input; an end-to-end check searches the test environment's logs after a run | NFR5; rules BR5.4 |
| NFR5.3 | Logs are readable only by the maintainer's AWS identity and by the alarms that count them | Inspection of the access definitions; Checkov | NFR5 |
| NFR13.1 | Every change to the integration branch arrives by a pull request that names the Unit it belongs to | Branch protection refuses direct pushes; a check fails a pull request whose description names no Unit | NFR13; rules BR3.3 |
| NFR15.1 | The pipeline signs in to AWS with credentials that last at most one hour; no long-lived key exists anywhere. There are exactly two identities it can take, and a pull request can take neither: (a) the test identity, issued only to a workflow of this repository running on the integration branch after a merge; (b) the production identity, issued only to a job of this repository running in GitHub's protected "production" environment, which starts only after the maintainer's approval | Inspection of the two trust definitions, which name the repository and, respectively, the branch and the environment; a search of the repository's and GitHub's stored secrets finds no AWS key; a pull request run that asks for either identity is refused by AWS | NFR15; project rule (no long-lived keys in the pipeline) |
| NFR15.2 | A pull request's checks run with no AWS identity at all. They read no secret and no Terraform state: lint, type check, tests, Terraform's format check and validation, and Checkov need none. Terraform's plan against a real environment, which needs the state, runs only after the merge, under the identity of the environment it plans for | Inspection of the workflow; the pull request run of NFR15.1 | NFR15; the threat "a pull request that changes the pipeline itself" |
| NFR15.13 | Each identity can change only its own environment. The test identity cannot read or change anything of production, including production's state and secrets; the production identity likewise for test. Neither can change what the one-time setup made: the budget alarm, the notification channel, the two trust definitions, and the state bucket's own settings. Both carry an outer limit, set by the setup, that they cannot widen even by creating new roles | Inspection of the definitions; three attempted changes from the test identity (to a production resource, to the budget alarm, to a trust definition) are each refused by AWS, once, recorded | NFR15; project rule (budget alarm in place before anything else, and so it must stay) |
| NFR15.3 | The server's own permissions allow only what it uses: reading its database secret, connecting to its database, writing its logs | Checkov; inspection for wildcards | NFR15 |
| NFR15.4 | Secrets (the database's password, the access password) are held in the secrets service, read by the server when it starts, never placed in the repository, in Terraform's variables files, in the page's files or in the pipeline's printed output | A secret scanner in the pull request; inspection of the pipeline's output after a run | NFR15; project rule; rules BR2.2 |
| NFR15.5 | Terraform's state is held in a private bucket with versioning, encryption and a lock against two runs at once. Each environment's state is kept apart, readable only by that environment's identity and by the maintainer; the setup's own state is readable only by the maintainer. The setup begins with its state on the maintainer's machine, creates the bucket, and moves its state into the bucket as its last act, by its own script, then removes the copy on the machine; run again, it finds its state there. What the setup makes carries no secret value, so the state held briefly on the machine contains none | Checkov on the setup's definitions; a second simultaneous run is refused; the test identity's attempt to read production's state is refused | NFR15; answer Q10 |
| NFR15.6 | Third-party code is pinned: a lockfile for dependencies, exact versions for Terraform and its providers, and GitHub Actions referenced by commit, not by a movable tag | A check in the pull request | NFR15; project rule |
| NFR15.7 | Known vulnerabilities fail the pull request: a dependency audit at severity high or above, and Checkov on the infrastructure definitions with no unexplained exception | The pull request's checks | NFR15; rules BR3.1 |

## Threats considered

| Threat | In this Unit | Answer |
|--------|--------------|--------|
| Someone guesses or finds the access password | Possible: it is one shared secret on a public address | NFR2.3 to NFR2.5, NFR15.4; nothing behind it is sensitive in this Unit |
| A leaked pipeline credential | The largest risk: the pipeline can change the account | NFR15.1: nothing long-lived exists to leak. NFR15.13: even a misused identity is confined to one environment and cannot touch the budget alarm or its own limits |
| A malicious or compromised dependency or action | Possible. One that runs after a merge runs with the test identity | NFR15.6, NFR15.7; NFR15.13 confines the damage to the test environment; production needs the maintainer's approval |
| A pull request that changes the pipeline itself to gain access | Possible, from anyone who can open a pull request | NFR15.2: a pull request has no AWS identity, reads no secret and no state, whatever its workflow is edited to do |
| Injection through a request | Only through headers and the path | NFR3.1 to NFR3.3 |
| Script injection in the page | No user text exists yet | NFR3.4, NFR1.3 set the pattern |
| Reading Terraform's state | It can contain secrets | NFR15.5; and NFR15.4 keeps secret values out of it where the tool allows |
| Denial of service or a cost attack on a public address | Possible | Rate limits at the entry point (see `scalability-requirements.md`, NFR11.3); the budget alarm |
| Information in failure answers and logs | Possible | NFR3.5, NFR5.2 |

## The OWASP Top 10, as it applies to the slice

| Category | Applies here | Covered by |
|----------|--------------|-----------|
| Broken access control | Private environments; pipeline identities | NFR2.2, NFR2.5, NFR15.1, NFR15.2, NFR15.3, NFR15.13 |
| Cryptographic failures | Storage and connections | NFR4.1 to NFR4.3 |
| Injection | Request values; database statements; page output | NFR3.1 to NFR3.4 |
| Insecure design | The foundations themselves | The threats table above |
| Security misconfiguration | Infrastructure definitions | NFR15.7 (Checkov), NFR1.3 |
| Vulnerable and outdated components | Dependencies | NFR15.6, NFR15.7 |
| Identification and authentication failures | The access password only; accounts arrive in U2 | NFR2.3, NFR2.4, NFR2.5 |
| Software and data integrity failures | The pipeline and what it deploys | NFR13.1, NFR15.1, NFR15.6; one Release built once and deployed unchanged (rules BR3.6) |
| Security logging and monitoring failures | Logs and alarms | NFR5.2; `observability-requirements.md` |
| Server-side request forgery | The server makes no request to an address a caller supplies | Not applicable in this Unit |

## Not in this Unit

- Sign-in, sessions, and authorisation of changes to content (NFR2 proper): U2 and the Units after it.
- A notice to users about personal data: open since the requirements step; it becomes relevant with U2.

## Open points

1. **How the access password is carried** without colliding with the session contract C1 defines, and which part checks it, are for this Unit's infrastructure design (functional specification, open point 1), under NFR2.5's three conditions. NFR2.2 to NFR2.4 hold whichever way it is done.
2. **Withdrawing rule BR2.4** (slowing repeated wrong passwords per network address) reverses a designer's choice in the slice's design, to stay inside the budget. The design document still carries the rule; this document is the later one. The maintainer has not been asked; it is raised at the Unit's approval.
3. **A pull request sees no plan of what would change in AWS.** That is the price of NFR15.2: the plan appears only after the merge, before it is applied to the test environment. A reviewer of a pull request reads the Terraform change itself.
4. **Where requirements are filed.** Every detail must carry the number of one of the fifteen quality requirements. The pipeline's access to AWS, secrets and dependencies have no closer home than NFR15 ("every change goes through the pipeline"), and so are filed there.
5. **Whether Terraform's state can be kept free of secret values** depends on how the database's password is created; to settle at infrastructure design.

# Infrastructure Specification: U3, browsing and selecting

What browsing needs from AWS. Almost nothing is new: U3 runs on what U1
built
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/infrastructure-design/infrastructure-specification.md`).
This document states the one setting that changes, what was checked to be
sure the rest holds, and that the cost estimate does not move.

Sources: U3's quality design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-design/logical-components.md`,
`security-design.md`, `performance-design.md`, `scalability-design.md`,
`reliability-design.md`, `observability-design.md`), the building blocks
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`),
U3's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`),
and contracts C1 and C3
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`).

No question was put to the maintainer in this step: nothing here costs
money or adds a resource.

## Summary

| Question | Answer |
|----------|--------|
| New AWS resources | Two per environment, neither charged by the month: two saved searches. The existing dashboard gains a view |
| Changed AWS resources | One per environment: the rule for which request headers the edge passes to the server |
| New identities or permissions | None |
| Change to the cost estimate | None |
| New hand steps | None |

## Checked before writing this

U3's quality design left several points "to confirm at the infrastructure
step". Each was checked against U1's Terraform and code as they are in the
repository, or against AWS's documentation, on 2026-11-26.

| Point | Checked against | Finding |
|-------|-----------------|---------|
| Does the edge send a folder's page address to the page? | U1's access gate (`edge/src/gate.ts`) | Yes. Any path that is not under `/v1` and whose last part has no dot is rewritten to the page's entry document. `/folders/<identifier>` has no dot. So the page's address for a folder is `/folders/<identifier>`, and "All" is `/` |
| Does the edge keep anything it gets from the server? | U1's edge module: the `/v1/*` behaviour | No. It uses AWS's "caching disabled" policy |
| Which request headers reach the server? | The same module: the server's origin request policy | Only the request identifier, `Accept` and `Content-Type`. `If-None-Match` and `Accept-Encoding` are dropped. This is the change U3 makes (below) |
| May those two headers be added while caching is disabled? | AWS's CloudFront documentation (cache policy and custom origin pages) | Yes. With compression caching off, `Accept-Encoding` "is treated the same as any other header" and may be listed in an origin request policy. `If-None-Match` may be listed too. Conditional requests are not supported when cookies are forwarded; U1 forwards none |
| Does the edge compress the server's answers itself? | The same documentation | Not relied on. The behaviour has compression switched on, but the documentation ties the edge's own compression to a cache policy that this behaviour does not use. The server compresses (performance design P22). If the server's answer already says it is compressed, the edge passes it on and does not compress again |
| Does the edge alter the version header on the way out? | The same documentation | Only when the edge itself compresses an answer: it then marks the version as weak. The server accepts the weak form (security design S21), so either way works |
| Does the server's entry point need a new route? | U1's server module | No. It has a catch-all route to the server, which was built so the server answers "not found" itself. `GET /v1/folders/{folderId}` arrives through it |
| Can the entry point carry a compressed answer? | U1's server module: the integration uses payload format 2.0 | Yes; that format carries a binary body in encoded form with a flag saying so |
| Does the change runner know which environment it is in? | U1's server module | Yes: it is given the environment's name, which the sample loader's own refusal in production needs (security design S31) |
| Can the pipeline start the change runner a second time, for the samples? | U1's deploy action and identities | Yes. It already has permission to call that function and waits for its answer |
| Does Amazon RDS offer PostgreSQL 18, with what the name rules need? | Asked AWS; a local PostgreSQL 18.1 | Yes (recorded in `logical-components.md`, "Verified in this step") |

Not checkable without a deployed environment, and therefore gates in the
pipeline (see `cicd-pipeline.md`): that the version header and a compressed
answer really pass through the edge and the entry point in both directions.

## The one change: what the edge passes to the server

| | |
|---|---|
| Resource | The CloudFront origin request policy for the server, one per environment (`vd-test-server`, `vd-prod-server`), defined in U1's edge module |
| As U1 built it | Passes the request identifier, `Accept`, `Content-Type`; all query strings; no cookies |
| With U3 | Also passes `If-None-Match` and `Accept-Encoding`. Nothing else changes |
| Why | Without the first, the server never sees the version a page holds, and can never answer "unchanged". Without the second, it never learns that it may compress |
| How it is applied | By the pipeline's ordinary Terraform step. Terraform changes the policy in place; the distribution is not replaced. CloudFront takes some minutes to spread a change to all its locations |
| Effect on what is running | None. U1's two calls send neither header's value to any use. During the minutes of spreading, some locations pass the headers and some do not; the server treats a missing header as "holds no version" and "accepts no compression", which is always correct, only slower |
| Security | No cookie is passed, as before. The two headers carry nothing secret. The server reads each only within the limits of security design S21 |
| Way back | Going back to U1's Release does not undo this, and does not need to, because U1's server ignores both headers. To remove the two headers: a pull request that takes them out of the definition, deployed by the pipeline (`cicd-pipeline.md`, "Reversing each change of this Unit") |
| Precondition | U1 deployed in both environments first (`cicd-pipeline.md`, "Precondition"). The policy this row changes exists only once U1 has been deployed |

Terraform's test for the environment gains an assertion that the policy
lists exactly these five headers, so that a later edit cannot drop one
unnoticed.

## What stays exactly as U1 built it

| Part | Why nothing changes |
|------|---------------------|
| The distribution, its certificate, its name records | One address, as before |
| The access gate | The folder route is under `/v1`; a folder's page address is rewritten to the entry document by the existing rule |
| The server's entry point (HTTP API) | The catch-all route; the same request limit of 50 a second with a burst of 100 (10 and 20 in test) |
| The server function | Same size (512 MB), same 8-second limit, same network, same role. The function's own permissions do not change: in U3 it only reads, with the database user it already has |
| The change runner function | Same function, same role, same 5-minute limit, still at most one run at a time. It gains a second mode in its code, not in its definition |
| The database | Same instance. The new table arrives by a change file, not by Terraform. Storage: the table and its indexes at 50,000 items are tens of megabytes, against 20 gigabytes |
| Secrets and parameters | None added |
| The network | No new path. The change runner already reaches the database and the secrets service |
| The pipeline's identities and their outer limits | Nothing new to permit: the saved searches and the dashboard are kinds of resource the identities already manage, with names inside their own prefix |
| The budget and its alarm | Unchanged |

## Database users

Granted by the change file that creates the table, not by Terraform:

| User | Signs in from | On the new table |
|------|---------------|------------------|
| `app` | The server function, with a 15-minute token from its own role | Read only |
| `migrator` | The change runner function, the same way | Owner |

No new database user, and no new permission to sign in as either.

## Cost

| Line | Change | Why |
|------|--------|-----|
| Database | None | Same instance; storage far inside what is paid for |
| Server function and entry point | A few cents at most | More requests than U1's one call, at tens of users. A folder request runs a little longer than U1's; at 512 MB that is thousandths of a cent each |
| Change runner | Under a cent a month | One extra run of a few seconds per deployment to test |
| Edge | None | The policy is not charged for |
| Logs | Negligible | A few more fields per entry |
| Saved searches and the dashboard view | Cents at most | A search is charged by the amount of log it reads, when someone runs it or opens the dashboard; the log is small and kept 30 days |
| Measurement series, alarms | None | U3 adds none |

The estimate stays at US$46.60 to US$50.20 a month for both environments,
against the ceiling of US$60. The warning about the cost of a page that
keeps asking belongs to U5 (scalability requirement NFR11.26), not to this
Unit: U3's page asks only when a folder is opened or the page becomes
visible again.

## Open points

1. **The two pass-through gates** (the version header, the compressed answer) are proven only by the first deployment to the test environment. If either fails there, production cannot receive the Release, and the remedy is decided then: the likeliest is a different header rule at the edge.
2. **Whether CloudFront rewrites the `Accept-Encoding` value** before passing it on is not stated for this case. The server only looks for "gzip" in it, which holds either way.
3. **AWS's "caching disabled" policy is AWS's to change.** U1 chose it; if AWS altered it, the folder answers' own instruction not to store them (security design S28) still stands.

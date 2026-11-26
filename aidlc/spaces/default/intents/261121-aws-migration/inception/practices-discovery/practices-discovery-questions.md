# Practices Discovery: Questions

The repository shows how the project has worked so far: one branch, changes
made by hand, no tests, no pipeline. That says little about how you want to
work from here, so these questions ask. Code style is not asked: your
`technical-environment.md` already names strict TypeScript, ESLint and
Prettier enforced in the pipeline; Prettier's default settings are assumed
unless you say otherwise.

## Q1. [Developer] Which branch should finished pieces of work be merged into?

The repository has `master`, which holds exactly what is deployed to Firebase
today and is tagged `pre-aidlc-baseline`, and `aws-migration`, where all the
migration work is. There is no `main`.

A. `aws-migration`, with one merge into `master` when the AWS version is accepted
B. `master`: merge `aws-migration` into it now and work there
C. Create `main` and use that
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q2. [Developer] Should each piece go through a pull request on GitHub before it is merged?

Your `technical-environment.md` lists checks that "block the merge" on a pull
request, but the history so far has no pull requests. A check can only block a
merge if the merge goes through a pull request.

A. Yes, every piece goes through a pull request, and the checks must pass before it merges
B. No, merge on my machine; the checks run when the branch is pushed and I fix what fails
C. Pull requests only for the larger or riskier pieces
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q3. [Developer] Build a thin end-to-end slice first?

A walking skeleton is a minimal version that runs the whole way through, built
first to prove the pieces connect before the real features go in. Here it
would be the pipeline and infrastructure plus one trivial page, one server
call and one database read, deployed to AWS.

A. Yes, build that slice first
B. No: the first piece is the pipeline and infrastructure only, and the first working path arrives with the first feature
C. Not yet decided
X. Other (please specify)

[Answer]: A

## Q4. [Developer] When should tests be written?

There are no tests today and nothing in the project says when they should be
written.

A. After the code for each layer, before the piece is merged
B. Before the code: test first
C. A mix: tests first for the security rules (for example "a change without sign-in is rejected") and for the migration check, after the code for everything else
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q5. [Developer] Should a merge be refused when too little of the code is covered by tests?

One of your success measures is "automated tests run on every change". A
minimum share of lines covered by tests makes that checkable; 80% is the usual
default for work of this kind.

A. Yes, at least 80% of lines
B. Yes, with a different number (please give it under Other)
C. No fixed number; require the test types instead (unit, integration, key journeys)
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q6. [Maintainer] After a change passes its checks in a test environment, how does it reach production?

The first two options mean running two environments on AWS, a test one and the
production one, which has to fit the cost ceiling of about US$50 a month
(feasibility Q5). Whether it fits depends on how the database is run, which is
not decided yet.

A. It waits for me to approve it by hand
B. It goes to production automatically
C. One AWS environment only until the switch from Firebase; a second is added later
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Branch (Q1): finished work merges into `aws-migration`; one merge into `master` when the AWS version is accepted.
- Pull requests (Q2): every piece goes through a pull request, and the checks must pass before it merges.
- Thin slice first (Q3): yes. The pipeline and infrastructure plus one trivial page, one server call and one database read, deployed to AWS, before any feature.
- When tests are written (Q4): after the code for each layer, before the piece is merged.
- Coverage (Q5): a merge is refused below 80% of lines covered by tests.
- Reaching production (Q6): two environments; production waits for your approval by hand.
- Code style (not asked): strict TypeScript, ESLint and Prettier with its default settings, enforced in the pipeline, as your `technical-environment.md` says.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

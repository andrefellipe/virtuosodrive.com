# Units Generation: Questions

This step divides the work into pieces that are each designed, built, tested
and approved on their own. It takes the six building blocks
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`),
the decisions behind them (`decisions.md` beside it), the requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`)
and the stories
(`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`).

Already settled, and not asked:

- **One deployment.** The site and its server side are deployed together, as one application with clear internal parts (`technical-environment.md`: "Modular monolith (one API, clear modules)"). The six building blocks stay separate inside it.
- **One piece at a time**, each through a pull request (team practices).
- **The first piece is the thin end-to-end slice** with no product feature (team practices).
- The order of the remaining pieces is decided at Delivery Planning, not here. This step only says which piece needs which.

One thing is yours to decide.

## Q1. [Developer] How many pieces should the work be divided into?

Each piece goes through five steps in the build phase (its detailed design,
its quality requirements and their design, its infrastructure, and its code),
and you approve each. More pieces means smaller, safer steps and more
approvals; fewer means larger steps and fewer approvals. Pieces are cut by
what a person can do when the piece is finished, not by building block, so
each can be shown working.

A. Nine pieces: the thin slice with pipeline and operations; accounts; browsing; downloading; the record of changes with live updates; organising (folders, rename, delete, restore); uploading; the migration tool; the switch. Roughly 45 approvals in the build phase
B. Five pieces: the thin slice with pipeline and operations; accounts; reading (browse, select, download); changing (upload, organise, record of changes, live updates, restore); migration and the switch. Roughly 25 approvals in the build phase
C. Decide for me, and explain the choice so I can change it at approval
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Pieces (Q1): nine. The thin slice with pipeline and operations; accounts; browsing; downloading; the record of changes with live updates; organising (folders, rename, delete, restore); uploading; the migration tool; the switch.
- Deployment (settled earlier): one application; the six building blocks stay separate inside it.
- Working rhythm (settled earlier): one piece at a time, through a pull request; the thin slice first; the order of the rest is decided at Delivery Planning.
- Which piece needs which: accounts, browsing and the record of changes need the thin slice; the record of changes also needs accounts and browsing; downloading needs browsing; organising needs accounts, browsing and the record of changes; uploading needs downloading and organising; the migration tool needs browsing and downloading; the switch needs everything.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

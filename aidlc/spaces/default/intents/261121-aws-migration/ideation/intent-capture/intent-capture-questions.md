# Intent Capture & Framing: Questions

These questions confirm what this work is for before anything is written down
as agreed. `vision.md` was read as background to shape the options, but nothing
in it counts as decided until you confirm it here.

## Sources

- [desc] Initial description: "Read ./vision.md and carry out the migration it describes"
- [scope] Workflow-selected scope: `feature`.

## Q1. [Product owner] Which problem is this work solving?

`vision.md` names three problems with today's Virtuoso Drive. The answer sets
what the intent statement calls the problem, and so what "done" has to fix.

A. All three together: it depends on Google Cloud, anyone on the internet can change or delete its content, and with no tests, pipeline or infrastructure definition every change is manual and risky
B. Mainly the platform: it must leave Google Cloud and run on AWS with PostgreSQL; security and modernisation are secondary
C. Mainly safety: public write access and the known defects are the real problem; the move to AWS is the occasion to fix them
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Who is this work for?

`vision.md` lists three kinds of user and marks "Contributor" as unconfirmed.
The answer decides whose needs the requirements are written around.

A. Three groups: student readers (find and download material), contributors (students or monitors who upload and organise), and the maintainer (runs it cheaply and safely)
B. Two groups: student readers and the maintainer; there is no separate contributor group, the maintainer adds the material
C. Students as one group (any student may read and contribute) plus the maintainer
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] What does success look like, in measurable terms?

`vision.md` proposes six metrics: zero runtime dependencies on Google Cloud; no
data-changing operation without sign-in; automated tests on every change;
infrastructure 100% defined as code; 100% of files and folders preserved after
migration; and 100% of source changes traceable to an approved AI-DLC Unit.

A. All six metrics, with the targets as written in `vision.md`
B. The five about the system itself; traceability to AI-DLC Units is a working practice, not a success metric
C. Only the three outcome metrics: zero Google Cloud dependencies, no change without sign-in, 100% of content preserved
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] Why is this happening now?

`vision.md` says what must change but not what set it off. The trigger shapes
how trade-offs are made later (for example speed against learning value).

A. A decision or requirement to leave Google Cloud and run on AWS with PostgreSQL
B. The security exposure: the content can be changed or deleted by anyone and that can no longer be left as it is
C. A learning and demonstration goal: carrying out a real migration with AWS and AI-DLC, provable from the repository
D. Not identified
X. Other (please specify)

[Answer]: C

## Q5. [Product owner] Besides you, who has a stake in this work?

The stakeholder map lists only people you confirm. Students are users in any
case; this asks who else must be consulted, informed or satisfied.

A. Nobody else: I am the owner and maintainer; students are users but are not consulted during the work
B. Student representatives or monitors who add material, and who should be consulted about how uploading and organising works
C. University or department staff (for example a professor or coordinator) who must be informed or must agree
D. Not identified
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] Who decides scope and priority?

This is recorded so later stages know whose approval settles a trade-off.

A. I decide alone
B. I decide, after hearing the students or monitors who use it
C. Someone else has the final say (please name the role under Other)
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q7. [Product owner] Does anyone need to be kept informed, and how often?

A. No reporting: the AI-DLC record committed to the repository is the only record needed
B. Students are told once, when the new version replaces the old one (and about any read-only window)
C. A regular update to someone during the work (please say to whom and how often under Other)
D. Not applicable
X. Other (please specify)

[Answer]: A

## Q8. [Product owner] What does this first version leave out?

The work runs as a `feature`, which is already chosen. This asks only what the
first version should not do. `vision.md` lists as out: search, tags and
previews; folder rename and folder download (marked unconfirmed); sharing
links, comments and ratings; a native mobile app; and decommissioning the
Firebase project.

A. Everything on that list is out of the first version
B. That list, except folder rename and folder download, which should be in the first version
C. That list, and decommissioning Firebase is the only item that needs a later piece of work; the others are not planned at all
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Problem (Q1): all three together. Virtuoso Drive depends on Google Cloud, anyone on the internet can change or delete its content, and with no tests, pipeline or infrastructure definition every change is manual and risky.
- Who it is for (Q2): three groups. Student readers who find and download material, contributors (students or monitors) who upload and organise, and the maintainer who runs it cheaply and safely.
- Success (Q3): all six metrics with the targets in `vision.md`. Zero runtime dependencies on Google Cloud; no data-changing operation without sign-in; automated tests on every change; infrastructure 100% defined as code; 100% of files and folders preserved after migration; 100% of source changes traceable to an approved AI-DLC Unit.
- Why now (Q4): a learning and demonstration goal. Carrying out a real migration with AWS and AI-DLC, provable from the repository.
- Other stakeholders (Q5): nobody else. You are the owner and maintainer; students are users but are not consulted during the work.
- Who decides scope and priority (Q6): you decide alone.
- Reporting (Q7): none. The AI-DLC record committed to the repository is the only record needed.
- Left out of the first version (Q8): search, tags and previews; folder rename and folder download; sharing links, comments and ratings; a native mobile app; and decommissioning the Firebase project.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

## Assumption Confirmation

The two documents carry these assumptions and open questions. They are kept
labelled as assumptions, not facts.

- The ten open questions listed at the end of `vision.md` are not answered by this stage and are left for the stages that need them. [assumption]
- Who counts as a contributor, and how someone becomes one, is not settled; the group itself is confirmed. [assumption]
- The "today" figures beside each metric in `vision.md` were not asked about here and are treated as the starting point until checked against the code. [assumption]
- The features the first version must include, as listed in `vision.md`, were not asked about here; only what it leaves out was confirmed. [assumption]
- Whether students are told when the new version replaces the old one was offered as an option and not chosen; if a read-only window is later agreed, this may need revisiting. [assumption]

A. Accept assumptions
B. Convert to follow-up questions

[Answer]: A. Accept assumptions

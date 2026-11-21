# Intent Statement: Virtuoso Drive migration

The request is to carry out the migration described in `vision.md`. [desc]

## Problem Statement

Virtuoso Drive has three problems that this work treats as one. [Q1]

- It depends on Google Cloud. [Q1]
- Anyone on the internet can change or delete its content. [Q1]
- It has no tests, no pipeline and no infrastructure definition, so every change is manual and risky. [Q1]

None of the three is secondary to the others: the work is not only a change of platform and not only a safety fix. [Q1]

## Target Customer

| Who | What they need from this work | Source |
|-----|-------------------------------|--------|
| Student readers | To find and download material | [Q2] |
| Contributors (students or monitors) | To upload and organise material | [Q2] |
| Maintainer | To run the system cheaply and safely | [Q2] |

## Success Metrics

All six metrics are adopted, with the targets written in `vision.md`. [Q3]

| Metric | Target | Source |
|--------|--------|--------|
| Runtime dependencies on Google Cloud | Zero | [Q3] |
| Operations that change data without sign-in | None | [Q3] |
| Automated tests | Run on every change | [Q3] |
| Infrastructure defined as code | 100% | [Q3] |
| Files and folders preserved after migration | 100% | [Q3] |
| Source changes traceable to an approved AI-DLC Unit | 100% | [Q3] |

## Initiative Trigger

The trigger is a learning and demonstration goal: carrying out a real migration with AWS and AI-DLC, in a way that can be proven afterwards from the repository. [Q4]

No external requirement to leave Google Cloud and no security incident was named as the trigger. [Q4]

## Initial Scope Signal

- Workflow-selected scope: `feature`. [scope]
- User-confirmed product boundary: the first version leaves out search, tags and previews. [Q8]
- User-confirmed product boundary: the first version leaves out folder rename and folder download. [Q8]
- User-confirmed product boundary: the first version leaves out sharing links, comments and ratings. [Q8]
- User-confirmed product boundary: the first version leaves out a native mobile app. [Q8]
- User-confirmed product boundary: the first version leaves out decommissioning the Firebase project. [Q8]

## Assumptions & Open Questions

- The ten open questions listed at the end of `vision.md` are not answered by this stage and are left for the stages that need them. [assumption]
- Who counts as a contributor, and how someone becomes one, is not settled; the group itself is confirmed. [assumption]
- The "today" figures beside each metric in `vision.md` were not asked about here and are treated as the starting point until checked against the code. [assumption]
- The features the first version must include, as listed in `vision.md`, were not asked about here; only what it leaves out was confirmed. [assumption]

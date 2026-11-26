# Domain Design: Questions

This step names the building blocks of the new system: the pieces of software
to be written, what each is responsible for, and which information each owns.
It does not choose AWS services or how the pieces are deployed; those come
later. Most of it follows from the requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`)
and stories
(`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`).
Today everything is one class in the browser
(`aidlc/spaces/default/codekb/virtuosodrive.com/component-inventory.md`), so
there are no existing boundaries to keep. Two things are yours to decide.

## Q1. [Developer] How finely should the system be divided into building blocks?

Both options below are sound. Finer blocks are easier to test and reason about
one at a time, but there are more boundaries to learn and keep tidy. Coarser
blocks are quicker to get started with, but the largest one grows to hold most
of the logic. You are building this alone while learning the platform, and the
system is small.

A. Six blocks: the web client; accounts (sign-up, sign-in, who is a maintainer); the drive (folders, files, names, deleted items); file transfer (sending and fetching file contents, size and daily limits); activity (the record of changes and live updates); and the migration tool
B. Four blocks: the web client; accounts; the drive, which also handles file transfer and activity; and the migration tool
C. Decide for me, and explain the choice so I can change it at approval
X. Other (please specify)

[Answer]: A

## Q2. [Maintainer] How long is the record of who changed what kept?

The record of changes is the protection that open sign-up relies on, and the
review of the requirements noted that nothing says how long it is kept. It
holds no email addresses, only which account did what to which item and when,
and it is small.

A. Indefinitely
B. One year
C. 90 days
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Building blocks (Q1): six. The web client; accounts (sign-up, sign-in, who is a maintainer); the drive (folders, files, names, deleted items); file transfer (sending and fetching file contents, size and daily limits); activity (the record of changes and live updates); and the migration tool.
- Record of changes (Q2): kept indefinitely.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

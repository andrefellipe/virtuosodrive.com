# Bolt Plan: Virtuoso Drive on AWS

The order in which the work is built, and what each build must show. A
**Bolt** is one build pass over a piece of the work, ending in something that
runs. Here each Bolt builds exactly one **Unit of Work** (one of the nine
pieces the work was divided into), so there are nine Bolts.

Sources: the Units and what each needs
(`aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`,
`unit-of-work-dependency.md`, `unit-of-work-story-map.md`); the contracts
between them
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`);
the building blocks
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`);
the screens
(`aidlc/spaces/default/intents/261121-aws-migration/inception/refined-mockups/mockups.md`);
the stories and requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`,
`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`);
and the team practices
(`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`).
Answers referred to as Q1 to Q9 are in `delivery-planning-questions.md`. The
reasons for the order are in `risk-and-sequencing-rationale.md`.

## The order

| Bolt | Unit | Name | Size | Needs |
|------|------|------|------|-------|
| 1 | U1 | Thin slice, pipeline and operations | L | nothing |
| 2 | U3 | Browsing and selecting | M | U1 |
| 3 | U4 | Downloading and opening | S | U3 |
| 4 | U8 | Migration tool | XL | U3, U4 |
| 5 | U2 | Accounts and sign-in | L | U1 |
| 6 | U5 | Record of changes and live updates | M | U2, U3 |
| 7 | U6 | Organising, deleted items and restore | L | U2, U3, U5 |
| 8 | U7 | Uploading | L | U4, U6 |
| 9 | U9 | The switch | M | U2, U5, U6, U7, U8 |

Every Bolt comes after everything it needs according to the 17 listed
dependencies. It is one of several orders they allow; the maintainer chose to
have the migration early (Q1).

**The order holds on one condition.** The contracts review found that browsing
(U3), as the contracts are written, also leans on accounts (U2, for "changed
by") and on stored contents (U4), and neither dependency is listed. The order
above is valid only if Bolt 2 is built so that:

- browsing returns no "changed by"; U6 adds it in Bolt 7, as `unit-of-work.md` already says; and
- browsing uses sample records that do not need U4's stored contents.

Settling this is the first act of Bolt 2's detailed design. If it is settled
the other way, by making browsing depend on accounts, the order becomes U1,
U2, U3, U4, U8, U5, U6, U7, U9: accounts move up to second, and the migration
is fifth instead of fourth.

The second half has no reordering to fall back on, because downloading (U4)
itself needs browsing (U3). If sample records cannot be made without stored
contents, the remedy is to build U3 and U4 together as one Bolt, or to change
the contract so the stored-content record belongs to U3. Either needs the
maintainer's decision in Bolt 2's design.

**A caution about this order.** In the build phase, the sequence of Units is
taken from the dependency list in `unit-of-work-dependency.md`, not from this
table. That list allows this order but does not force it. If the build phase
offers a different Unit from the one this plan names next, the maintainer can
say which Unit to take; this plan is the reference for that.

## How every Bolt runs

- **One at a time** (team practices). A Bolt is finished before the next starts.
- **Its own steps.** Each Bolt takes its Unit through detailed design, quality requirements and their design, infrastructure, code, build and test, and its pipeline checks, with the maintainer approving each.
- **Tests after the code for each layer, before merging** (team practices), with at least 80% of lines covered. What the 80% is measured over is settled in Bolt 1.
- **Merged through a pull request** that the maintainer merges on GitHub once its checks pass, U1 included (Q3). Each Bolt lands as one commit on `aws-migration`. The merge happens on GitHub only; no Unit is merged on the maintainer's machine.
- **Deployed to the test environment** on merge; production only after the end-to-end tests pass there and the maintainer approves.
- **Both environments are private** (Q6, Q7). From Bolt 1 to Bolt 9 production is reachable only by the maintainer and the pipeline; the test environment stays that way for good. Wherever a Bolt below says something can be opened, browsed or downloaded, it means by the maintainer, in the test environment unless production is named. Nobody else can reach the new site until the switch.
- **In this order:** the pull request's checks (lint, types, unit and integration tests, coverage); merge and deploy to the test environment; the one check that proves the Unit, which includes the end-to-end tests against the test environment; the maintainer's approval of the production deploy; production, with a smoke check against it that must pass before the deploy counts as finished (team practices); and last, the maintainer's approval of the Unit, so that it rests on everything in the Bolt's "Done when" list, production included. If the check or the smoke check fails after the merge, the fix is a follow-up pull request, and the Unit is not approved until it passes.
- **Proved by one check.** After each Bolt, one command is run to prove the Unit works. It is chosen at the first checkpoint, once U1 has created it (Q4), and must run every kind of test the practices require plus the coverage check.
- **Open points first.** Sixty review points were approved as open on the way here. Each Bolt begins its detailed design by settling the ones that bind its Unit, listed under "Open points to settle first" below and in full in the Unit's notes in `unit-of-work.md`.

---

## Bolt 1: U1, thin slice, pipeline and operations

**Walking skeleton: yes.** A walking skeleton is a minimal version that runs
the whole way through, built first to prove the pieces connect before any
feature goes in. The maintainer checks it running and approves it before Bolt
2 starts.

**What it proves out.** The pipeline from pull request to production; AWS
sign-in from the pipeline without long-lived keys; infrastructure created
from code; the page, the server and PostgreSQL talking to each other; logs and
alarms arriving.

**Done when**
- A pull request is blocked by a failing lint, type check, test, coverage or infrastructure check.
- Starting from an AWS account holding nothing but the existing Route 53 zone, a one-time setup script kept in the repository, run once by the maintainer, creates the budget alarm first and then the link that lets the pipeline sign in to AWS. The script is TypeScript or shell, never plain JavaScript, and is safe to run twice. Nothing is made in the console. The pipeline creates everything else.
- Both environments refuse a visitor who is not the maintainer, and admit the pipeline and the maintainer's phone on any network.
- After a production deploy, a smoke check passes against private production.
- A merge deploys to the test environment; the end-to-end test runs there; production deploys only after it passes and the maintainer approves.
- `virtuoso.andrefellipelabs.com` serves, to the maintainer only (Q6), one page that shows a value read from the database through the server.
- A request can be found in the logs; a forced error produces an email; a forced health-check failure produces an email.
- The previous version has been put back once in the test environment.
- A cost estimate for both environments, with an allowance for the safe copy that Bolt 4 will keep until acceptance, exists and is at or under US$50 a month, or the maintainer has decided what gives.
- The check command exists and has been chosen by the maintainer.
- `node_modules` is no longer committed.

**What shipping it tells us.** Whether one person can stand up and operate
this platform within the budget, and how long a Bolt really takes. Every later
estimate rests on this one.

**Demo.** Open the address on a phone; show the value from the database; open
a pull request with a deliberate fault and watch it be blocked; fix it, merge,
approve production, reload the page.

**The check.** By the maintainer's choice (Q4) the command is chosen at the
first checkpoint, not now. The candidate is one command that runs lint, the
type check, unit and integration tests with coverage, and then the end-to-end
test against the test environment.

**If this Bolt drags.** It is more than a minimal slice. Two items can move
to Bolt 2 without weakening what the slice proves: putting the previous
version back once, and the email on a forced error. If they move, they are
added to Bolt 2's "Done when" list at that moment, with the maintainer's
agreement. Removing `node_modules` does not move: the project rules forbid it
being committed. The budget alarm, the cost estimate, the pipeline and both
environments stay.

**Open points to settle first.** How both environments are kept private
before accounts exist, in a way that admits the pipeline and a phone away from
home; whether the Route 53 zone is in this AWS account or another; whether a
budget alarm can be created by script in a new account without first switching
something on in the console (not verified; if it cannot, that one step is an
exception the maintainer must accept); Region; how PostgreSQL is run; the shape of
the server side; the frontend approach; the pipeline product; the repository
layout; what the 80% is measured over; branch protection on `aws-migration`.

## Bolt 2: U3, browsing and selecting

**Done when**
- With no account and no sign-in, the top folder can be seen, open folders, and go back by the breadcrumb, on a phone and a laptop.
- Rows show the right icon, name and size; a video shows the video icon; a name containing markup is shown as text.
- Loading, empty and could-not-load each have their own view.
- One row, several rows and a range can be selected by mouse, keyboard and touch; Download, Rename and Delete appear only with a fitting selection.
- An automated accessibility scan of the screen reports nothing, and browsing works by keyboard alone.
- The name rules exist and are tested, including the lowest free numbered name.

**What shipping it tells us.** Whether the shape chosen for folders and files
holds up, since five later Units build on it, and whether the look survives
the accessibility changes.

**Demo.** Browse prepared sample content on a phone; select a range of fifteen
rows; open a folder named "2019.1".

**Open points to settle first.** Before anything else, the condition the
order rests on (see "The order holds on one condition"): that "changed by" is
left to U6 and that sample files exist without stored contents; which Unit
owns registering a file and the operations the migration uses to bring items
in (the contracts name U3, U4, U6, U7 and U8 inconsistently); one table or two for folders and files; the maintainer's
answer on the seven proposed changes to the look.

## Bolt 3: U4, downloading and opening

**Done when**
- With no account and no sign-in, one or several selected files can be downloaded under their listed names, and open a file in a new tab.
- A folder in the selection produces a message and the files still download.
- A link works for 60 seconds and only for its file; storage cannot be read any other way.
- A file of a type that could run script is downloaded, never shown in the browser.

**What shipping it tells us.** Whether short-lived links work on phones and in
every supported browser. With Bolt 2, the new site can do everything a reader does
today, though only the maintainer can reach it.

**Demo.** Select three sample files on a phone and download them; open a PDF;
try to open an HTML file and see it download instead.

**Open points to settle first.** Which file types may be shown in the browser;
the stored-content record that Bolt 2 left as a stand-in.

## Bolt 4: U8, migration tool

**Done when**
- An export of the old database and a copy of every old file's contents have been taken and put in private, encrypted storage outside both environments, created from code like everything else. This is the safe copy (Q8). It is kept until the maintainer accepts the new site, and its file count and total bytes match the listing of the old files.
- A rehearsal into the test environment has run to the end and reported the number of folders and files, the total bytes and the duration.
- Every source item appears exactly once in the report, as brought over, brought over with a note, merged, or not brought over with a reason.
- The check passes on the rehearsal, and fails when one file is removed by hand.
- Running the rehearsal twice adds nothing; an interrupted run finishes when run again.
- The tool made no write to the old system: it uses read-only access, and its record of what it did shows only reads. (Others can still change the old site, so "unchanged" cannot be promised.)
- The migrated content can be browsed and downloaded in the test environment through Bolts 2 and 3.

**What shipping it tells us.** The three largest unknowns of the whole work:
how much content there is, what state it is really in, and whether the final
copy fits the 4-hour read-only period. If it does not fit, the read-only
period or the way of migrating must change, and this is the moment to find
out.

**Demo.** Show the report's totals; browse the real migrated content in the
test environment; open a file that existed on the old site.

**Open points to settle first.** How the tool is given access to the old
system and the new one; which Unit owns the operations it uses to bring items
in, if Bolt 2 left that open; what the safe copy costs to keep; where the mapping from old keys to new items lives;
whether the order of the old system's keys really is the order shown today;
what happens to a name the new rules cannot accept.

## Bolt 5: U2, accounts and sign-in

**Done when**
- A new person can sign up, confirm by email, and come back signed in to the folder they were in. The reminder line names an action, and actions arrive in Bolts 7 and 8, so it is checked then.
- Sign-in, sign-out, the pause after five wrong passwords, and password reset all work.
- A request to an account operation that needs sign-in is refused with no session, an expired one, an unconfirmed account or a disabled account. The same refusal for changes to content is checked in Bolts 7 and 8, when those operations exist.
- A tab left open for an hour still browses and downloads.
- The maintainer can list, disable, enable and remove accounts; removal also removes the sign-in service's copy.
- No page, response or log shows an email address to anyone but its owner and the maintainer.

**What shipping it tells us.** Whether building the sign-in screens into the
site, the maintainer's choice, is workable with the sign-in service chosen,
and what it costs in effort.

**Demo.** Sign up with a real address on a phone; confirm; sign out; fail to
sign in five times; reset the password; as maintainer, disable the account.

**Open points to settle first.** Whether sign-in goes through the server; how
a session is kept and renewed; how the first maintainer is made; how the
maintainer is reached; sign-in attempts counted per address whether or not it
exists.

## Bolt 6: U5, record of changes and live updates

**Done when**
- A change handed to the record produces exactly one entry, and none if the change fails.
- The maintainer's Changes section lists entries newest first, narrows by account and by item, and shows email addresses beside display names.
- The record is refused to anyone who is not the maintainer.
- A folder open in two browsers updates in both within 5 seconds of a change handed directly to the record (the site has no change actions until Bolt 7), without disturbing selection, focus or typing.
- Signing in or out refreshes the list at once.
- Losing the connection shows the out-of-date note; it clears on return.

**What shipping it tells us.** What asking every 3 seconds costs with several
pages open, and whether it needs to become a pushed message.

**Demo.** Two browsers side by side; inject a change; watch the second update;
pull the network cable.

**Open points to settle first.** How the folder's version takes account of who
is asking; the cost of asking every 3 seconds.

## Bolt 7: U6, organising, deleted items and restore

**Done when**
- A signed-in person can create a folder, rename a file and delete items, each recorded.
- Each of those is refused with no session, an expired one, an unconfirmed account or a disabled account.
- Choosing one of them while signed out leads to sign-in and back to the same folder, with the reminder line naming the action.
- Deleting asks first, with counts for a folder; an empty folder deletes; deleted items vanish from the site and remain in storage.
- Two people creating the same name at once end with one item and one refusal.
- The maintainer can see deleted items and restore one, including a folder with its contents and an item whose name has been taken.
- "Changed by" appears for signed-in visitors only, and the server sends nothing of it to others.

**What shipping it tells us.** Whether deletes that hide and never destroy
behave as the maintainer intends in practice, including how fast hidden
content grows.

**Demo.** Create, rename, delete a folder of files; restore it as maintainer;
show the record of all four.

**Open points to settle first.** How name uniqueness holds when two things
happen at once; restore's exact rule for what comes back with a folder.

## Bolt 8: U7, uploading

**Done when**
- A signed-in person can upload several files with one progress bar and see them listed only when complete.
- Uploading is refused with no session, an expired one, an unconfirmed account or a disabled account; choosing Upload while signed out leads to sign-in and back to the same folder, with the reminder line.
- A file over the size limit, and one over the daily limit, are refused before sending; several uploads started together cannot pass the daily limit between them.
- An upload abandoned by closing the tab stops counting against the day within an hour.
- A name that exists offers replace, keep both and skip, with "do the same for the others"; a replaced file is among the deleted items.
- One failing file does not affect the others; nothing is ever stored without being listed or listed without being stored.

**What shipping it tells us.** Whether sending up to 1 GB straight to storage
is reliable on phones. With this Bolt the site is complete.

**Demo.** Upload five files including a duplicate and one too large, on a
phone; close the tab mid-upload; try again.

**Open points to settle first.** When a reservation is released; whether large
files must be sent in parts; the file chooser after sign-in on Safari and
iPhones.

## Bolt 9: U9, the switch

**Done when**
- The procedure is written with its way back, and has been walked through once against the test environment.
- The steps were taken in this order: walk-through against the test environment; production's content emptied; old site made read-only; final copy and its check; test accounts removed; production opened; notice placed on the old address. The 4-hour limit covers the time the old site is read-only until production is opened.
- Production's accounts have been listed, and every account made for testing during the build has been removed, from the sign-in service too, before production is opened. Only the maintainer's account remains.
- Production's content has been emptied before the final copy: folders, files, deleted items and the record of changes. Accounts are kept (Q9).
- The old site has been made read-only, the final copy has run and its check has passed, all within 4 hours.
- Production has been opened to everyone, with sign-up working for any email address. The test environment stays private.
- The new site is live at its address with all content, and the maintainer has accepted it. The safe copy from Bolt 4 may then be removed, by the maintainer's decision.
- The old address shows the notice with the link.
- Using the new site produces no request to any Google address.
- `aidlc attest resolve` over the migration range reports nothing drifted, unattested, unverifiable or indeterminate.

**What shipping it tells us.** Whether the six success measures in the intent
are met. This is the Bolt that ends the work.

**Demo.** The site in use by a student.

**Open points to settle first.** What people see on the old site during the
read-only hours; the wording of the notice.

---

## Where the stories land

| Bolt | Unit | Stories |
|------|------|---------|
| 1 | U1 | US9.1, US9.2, US9.3, US9.4 |
| 2 | U3 | US1.1, US1.2, US1.3, US2.1 |
| 3 | U4 | US2.2, US2.3 |
| 4 | U8 | US8.1, US8.2, US8.3 |
| 5 | U2 | US3.1, US3.2, US3.3, US3.4, US3.5, US7.1, US7.4 |
| 6 | U5 | US6.1, US7.2 |
| 7 | U6 | US5.1, US5.2, US5.3, US6.2, US7.3 |
| 8 | U7 | US4.1, US4.2, US4.3 |
| 9 | U9 | US8.4 |

US3.3 and US3.5, delivered in Bolt 5, are fully satisfied only after Bolt 8,
because they name actions that arrive in Bolts 7 and 8. US6.1, delivered in
Bolt 6, is likewise complete only after Bolt 8: it requires every change to be
handed to the record, and the changes are built in Bolts 7 and 8.

## If a Bolt drags

The maintainer's main worry is the work stalling (Q2). There is no fixed
trigger for stopping a Bolt: the maintainer judges at each approval whether it
is dragging (Q5). The sizes S to XL are one architect's estimates with no
measurement behind them, so nothing is measured against them. What the plan
provides:

- **After Bolt 3 there is something to show**: the reader's whole journey on the new platform, on sample content, visible to the maintainer only.
- **After Bolt 4 the content is safe**: the database export and every file's contents sit in private storage outside both environments, whatever happens next (Q8).
- **A way to make a dragging Bolt smaller.** The usual remedy is to split its Unit; `unit-of-work-story-map.md` names the natural split for the largest (the maintainer's account functions out of U2), and Bolt 1 lists what it can hand to Bolt 2.

What may be cut if it comes to that, in this order, each needing the
maintainer's decision because all were declared must-have: "do the same for
the others" in the duplicate choice; the space figure on the deleted-items
screen; live updates, replaced by a refresh button.

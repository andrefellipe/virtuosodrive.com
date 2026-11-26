# Requirements Analysis: Questions

Most of what the requirements need is already decided: the intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`),
the scope document
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/scope-definition/scope-document.md`),
the screen sketches, the team practices
(`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`)
and the analysis of the existing code
(`aidlc/spaces/default/codekb/virtuosodrive.com/`). These questions cover what
is still open and only you can decide. Ordinary corners (name rules, error
messages, what an empty folder shows) are settled in the requirements as
defaults you can correct, not asked here.

## Q1. [Product owner] What may be uploaded?

Today there is no limit on size or type (the code analysis lists this as a
security weakness). With open sign-up, a limit is the main protection against
the storage being filled or misused, and it bears directly on the monthly
cost.

A. Up to 100 MB per file, any type
B. Up to 1 GB per file, any type
C. Up to 100 MB per file, and only documents, images, audio, video and archives; programs and scripts are refused
D. Not yet decided
X. Other (please specify)

[Answer]: B

## Q2. [Product owner] Is a delete permanent?

Today it is permanent. In the new version any signed-in user can delete, and
anyone can sign up, so one careless or hostile person could remove a lot. A
recycle period means deleted items can be brought back for a while; it also
means deleted files keep costing storage until the period ends.

A. Permanent, as today
B. Deleted items are kept for 30 days and only the maintainer can bring them back
C. Deleted items are kept for 30 days and any signed-in user can bring them back
D. Not yet decided
X. Other (please specify)

[Answer]: X. Mark as deleted and keep it away from the user facing the site, but keep it stored behind the scenes. Only the maintainer can exclude permanently going directly through AWS.

## Q3. [Product owner] What can the maintainer do that other signed-in users cannot?

The scope gives every signed-in user the same rights. With open sign-up there
is, so far, no way to stop an account that misbehaves.

A. The maintainer can disable an account and can see the history of who changed what; nothing else is special
B. As A, and only the maintainer can delete folders; other users delete files only
C. Nothing in the first version; the maintainer is an ordinary user
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] What does "changed by" show when there is no one to name?

Raised by the review of the screen sketches as a major point. Every file and
folder brought over from the old system has no recorded author, so on day one
almost every row is in this case. The same question arises for an account that
no longer exists.

A. A dash for content brought over from the old system; "Deleted account" for an account that no longer exists
B. "Before the move" for content brought over; "Deleted account" for an account that no longer exists
C. The cell is left empty in both cases
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] Can a person remove their own account and details?

With sign-in the system holds an email address and a display name for each
account. This decides what happens when someone wants them gone.

A. Yes, a person can delete their own account; their files and folders stay, and their name on past changes becomes "Deleted account"
B. Only by asking the maintainer, who removes the account with the same effect
C. Not in the first version
D. Not yet decided
X. Other (please specify)

[Answer]: B

## Q6. [Maintainer] What is the web address of the new version?

The current address, `virtuoso-drive.web.app`, belongs to Firebase Hosting and
cannot point at AWS. The new version therefore has a different address
whatever is chosen.

A. A domain I own (please give it under Other if it is not `virtuosodrive.com`)
B. The address AWS assigns at first; a domain of my own is added later
C. Not yet decided
X. Other (please specify)

[Answer]: X. virtuoso.andrefellipelabs.com I already own andrefellipelabs.com o Amazon Route53.

## Q7. [Maintainer] What happens on the old site at the switch?

Raised by the review of the screen sketches as a major point. The old site
must stay untouched while the new one is built and tested. At the switch,
though, something has to stop people changing content there during the final
copy, and afterwards they need to find the new address. Both are changes to
the Firebase project, made once, at the switch.

A. For the final copy, change only the Firebase access rules so the old site becomes read-only; once the switch is accepted, replace the old page with a short notice that links to the new address
B. Change only the access rules to read-only and leave the old page as it is; tell students the new address some other way
C. Change nothing on Firebase at all; announce a date beforehand and accept that any change made on the old site after the final copy starts is not carried over
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q8. [Maintainer] What should the migration do with content that is not in a clean state?

The code analysis expects the live data to contain files with no record,
records with no file, records filed under the wrong folder, and folders with
the same name that share one set of contents. This is derived from the code,
not observed, and the real extent is unknown until an export is examined.

A. Bring over every item that has both a record and a file; list everything else in a report for me to decide on; delete nothing from the old system
B. As A, and also bring files that have no record into a folder named "Recovered files"
C. Stop the migration if anything inconsistent is found, and decide case by case before trying again
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q9. [Product owner] Can a deleted item be brought back, and by whom?

Follow-up to Q2. You said deleted items are marked as deleted, hidden from the
site and kept in storage, and that only the maintainer removes them
permanently, directly in AWS. That leaves open whether a hidden item can be
made visible again, which is the main reason to keep it.

A. Not through the site: if something must come back, the maintainer restores it directly in AWS
B. The maintainer can restore deleted items from the site
C. Any signed-in user can restore deleted items from the site
D. Not yet decided
X. Other (please specify)

[Answer]: B

## Q10. [Maintainer] Is there a ceiling on how much can be uploaded in total?

Follow-up to Q1 and Q2. With files up to 1 GB, open sign-up, and deleted files
kept in storage, one account could add many gigabytes and deleting them would
not reduce the bill. The cost ceiling is about US$50 a month (feasibility Q5).
A budget alarm tells you after the fact; a limit stops it happening.

A. Each account may upload at most 5 GB a day
B. Uploads are refused once the whole drive, including hidden deleted items, reaches a set size (please give it under Other; for example 100 GB)
C. No limit in the first version; the budget alarm and the ability to disable an account are enough
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Uploads (Q1): up to 1 GB per file, any type.
- Upload ceiling (Q10): each account may upload at most 5 GB a day.
- Delete (Q2): items are marked as deleted and hidden from the site, but stay in storage. Only the maintainer removes them permanently, directly in AWS.
- Restore (Q9): the maintainer can restore deleted items from the site.
- Maintainer (Q3): can disable an account and see the history of who changed what; otherwise an ordinary user.
- "Changed by" with no one to name (Q4): a dash for content brought over from the old system; "Deleted account" for an account that no longer exists.
- Removing an account (Q5): by asking the maintainer; the person's files and folders stay, and their name on past changes becomes "Deleted account".
- Web address (Q6): `virtuoso.andrefellipelabs.com`; you already own `andrefellipelabs.com` on Amazon Route 53.
- Old site at the switch (Q7): only the Firebase access rules change, to read-only, for the final copy; once the switch is accepted, the old page is replaced by a notice linking to the new address.
- Unclean content (Q8): bring over every item that has both a record and a file; list everything else in a report for you; delete nothing from the old system.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

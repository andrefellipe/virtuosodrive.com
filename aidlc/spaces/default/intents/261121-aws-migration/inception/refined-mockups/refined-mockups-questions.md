# Refined Mockups: Questions

The detailed screens are drawn from the rough sketches
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/rough-mockups/wireframes.md`
and `user-flow.md`), the stories
(`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`)
and the requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`).
Already decided and not asked again: the look stays as it is; phone and laptop;
WCAG 2.1 AA; sign-in at the top right; the duplicate-name choice; delete always
confirmed; "changed by" as a column for signed-in visitors.

These questions cover the screens that do not exist yet (accounts and the
maintainer functions) and the points the reviews of the stories and
requirements left open.

## Q1. [Designer] Which actions are shown when nothing is selected?

A correction first. In the rough sketches I wrote that today all five actions
are always visible. That was wrong: in the existing page only Upload and New
Folder are always shown, and Download, Rename and Delete appear once something
is selected (`app/public/css/style.css`, lines 43 to 45). Your earlier answer,
that signed-out visitors see all the actions and are asked to sign in on use,
was given on my wrong description, so I am asking again with the right one.

A. As today: Upload and New Folder are always shown; Download, Rename and Delete appear when the selection allows them. Signed-out visitors see the same and are asked to sign in on use
B. All five are always shown; the ones that do not apply to the current selection are greyed out
C. Not yet decided
X. Other (please specify)

[Answer]: A

## Q2. [Designer] Where do the maintainer functions live?

Disabling accounts, the record of changes and deleted items (stories US7.1 to
US7.4) need a place. Nothing was sketched for them.

A. A "Maintainer" link at the top right, shown only to maintainers, opening a separate screen with three sections: Accounts, Changes, Deleted items
B. Inside the main screen: a "Show deleted" switch on the list, and the other two behind a menu on the maintainer's name
C. Not yet decided
X. Other (please specify)

[Answer]: A

## Q3. [Designer] Whose screens are sign-up, sign-in and password reset?

Your `technical-environment.md` plans for the sign-in service's own hosted
pages ("Managed login; no passwords handled by application code"). Those pages
are less to build and keep passwords away from this site's code, but they are
separate pages with their own look, and what they can say and ask for is
limited. Screens built into this site match its look exactly and can keep the
person on the list, but mean more to build and test.

A. The sign-in service's hosted pages: the person leaves the list, signs in or signs up there, and comes back to the same folder
B. Screens built into this site, in its own look, shown over the list
C. Leave this to the design stages; draw the screens in a way that works for either
X. Other (please specify)

[Answer]: B

## Q4. [Designer] Does the duplicate-name choice offer "do the same for the other files"?

When several uploaded files have names that already exist, the choice
(replace, keep both, skip) is asked once per file. In the rough sketches I
proposed an option to apply one answer to all of them; it was never confirmed.

A. Yes, offer it when more than one file in the upload has a name that already exists
B. No, ask for each file
C. Not yet decided
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] After a new person confirms their email address, what do they come back to?

Raised by the review of the stories. You chose that confirmation is required
and that the person "returns to the same folder and continues". I wrote the
stories so that they choose the action again, because a selection of files to
upload cannot survive leaving the page for an email. That reading was never
put to you.

A. They are back in the same folder, signed in, and choose the action again
B. As A, and a line reminds them what they were doing, such as "Your account is ready. You were about to upload: choose Upload to continue."
C. Not yet decided
X. Other (please specify)

[Answer]: B

## Q6. [Product owner] How does the maintainer tell accounts apart?

Raised by the review of the stories. Email addresses are never shown to other
users (NFR5), and two accounts can have the same display name, so a display
name alone does not identify an account to disable.

A. The maintainer, and only the maintainer, sees each account's email address beside its display name
B. Nobody sees email addresses; each account has a short number shown beside its display name on the maintainer's screens
C. Not yet decided
X. Other (please specify)

[Answer]: A

## Q7. [Product owner] Are the account figures I assumed acceptable?

Four figures in the stories are my defaults, not your decisions: a password of
at least 10 characters; after 5 wrong passwords in a row, sign-in for that
account pauses for 15 minutes; links for confirming an address and resetting a
password work for 24 hours. The review of the stories noted that the pause can
be used by anyone to lock a known address out for 15 minutes; a password reset
would still work during the pause.

A. Yes, all four as they are
B. Yes, except: no pause after wrong passwords
C. I want different figures (please give them under Other)
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Actions (Q1): as today. Upload and New Folder are always shown; Download, Rename and Delete appear when the selection allows them. Signed-out visitors see the same and are asked to sign in on use.
- Maintainer functions (Q2): a "Maintainer" link at the top right, shown only to maintainers, opening a separate screen with three sections: Accounts, Changes, Deleted items.
- Sign-up, sign-in and password reset (Q3): screens built into this site, in its own look, shown over the list. This differs from the hosted pages planned in `technical-environment.md`, and means passwords pass through this site's own pages.
- Duplicate names (Q4): "do the same for the other files" is offered when more than one file in the upload has a name that already exists.
- After confirming an email address (Q5): the person is back in the same folder, signed in, with a line reminding them what they were about to do; they choose the action again.
- Telling accounts apart (Q6): the maintainer, and only the maintainer, sees each account's email address beside its display name.
- Account figures (Q7): a password of at least 10 characters; a 15-minute pause after 5 wrong passwords in a row; confirmation and reset links that work for 24 hours.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

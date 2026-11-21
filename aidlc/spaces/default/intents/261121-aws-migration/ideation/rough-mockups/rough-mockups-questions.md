# Rough Mockups: Questions

The current look, logo, icons and interface text stay as they are (scope
document, "Behaviour that must be kept"), so the existing single screen is the
starting point and is not asked about: logo, breadcrumb, a row of five actions
(Upload, New Folder, Download, Rename, Delete), an upload progress bar, and a
table of name and size. These questions cover only what is new or changes
behaviour: sign-in, and the defects being fixed. They build on the approved
intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`),
scope document and intent backlog
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/scope-definition/`).

## Q1. [Designer] What does a visitor who is not signed in see of the actions that change content?

Browsing and downloading stay open to everyone; Upload, New Folder, Rename and
Delete need sign-in (scope document, "Access rules"). Today all five actions
are always visible.

A. All five actions stay visible; choosing one that needs sign-in asks the visitor to sign in first
B. Only Download is shown until the visitor signs in; the other four appear after sign-in
C. All five stay visible, with the four that need sign-in greyed out and a short "Sign in to change content" hint
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q2. [Designer] Where does sign-in sit on the screen?

Sign-in is the only new element on a screen that otherwise stays the same.

A. Top right corner of the page: "Sign in" when signed out, the person's name and "Sign out" when signed in
B. As a sixth item in the row of actions
C. In the footer
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q3. [Designer] Which devices, and how accessible?

`vision.md` says students use a phone or a laptop. The existing page has no
stated accessibility target.

A. Phone and laptop, with every function usable by keyboard and readable by a screen reader (the common standard known as WCAG 2.1 AA)
B. Phone and laptop, with no formal accessibility target beyond what the page does today
C. Laptop first; phone only needs to browse and download
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] What happens when someone uploads a file whose name already exists in the folder?

Today this shows an error and overwrites the stored file anyway, which is one
of the five defects in scope. "Handled safely" needs a rule.

A. Ask the person each time: replace the existing file, keep both, or skip
B. Always keep both: the new file gets a numbered name, such as "exam (1).pdf"
C. Refuse the upload of that file and say why; nothing is replaced
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] How is a delete confirmed?

Any signed-in user can delete, and anyone can sign up (scope document), so a
mistaken or careless delete is more likely than a malicious one is prevented.

A. Always confirm, naming what will be deleted (for a folder, how many files and folders are inside)
B. Confirm only when a folder or more than one item is being deleted
C. No confirmation
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] Is "who changed this" shown on the screen?

The scope document says the first version must record who made each change.
This asks whether students see that, or only the maintainer can look it up.

A. Not shown; it is kept on record for the maintainer only
B. Shown in the list, as an extra column beside name and size
C. Shown only on request, for one selected item
D. Not yet decided
X. Other (please specify)

[Answer]: B

## Q7. [Product owner] What exactly does the "changed by" column show, and to whom?

Follow-up to Q6. The list is open to everyone without sign-in (scope
document), so a "changed by" column shows something about a signed-in person
to any visitor on the internet. Earlier you chose to keep personal data to the
minimum (feasibility Q7). What the column holds decides whether the two fit
together.

A. A display name the person chooses when signing up; never the email address
B. The person's email address
C. A display name, and only signed-in visitors see the column
D. Not yet decided
X. Other (please specify)

[Answer]: C

## Consolidated Summary Confirmation

- Signed-out view (Q1): all five actions stay visible; choosing one that needs sign-in asks the visitor to sign in first.
- Sign-in placement (Q2): top right corner. "Sign in" when signed out; the person's name and "Sign out" when signed in.
- Devices and accessibility (Q3): phone and laptop, with every function usable by keyboard and readable by a screen reader (WCAG 2.1 AA).
- Duplicate upload name (Q4): ask each time. Replace the existing file, keep both, or skip.
- Delete (Q5): always confirm, naming what will be deleted; for a folder, how many files and folders are inside.
- Who changed it (Q6, Q7): an extra "changed by" column beside name and size, showing a display name (never the email), and only to signed-in visitors.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

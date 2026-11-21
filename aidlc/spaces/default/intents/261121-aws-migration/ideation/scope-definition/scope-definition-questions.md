# Scope Definition: Questions

These questions fix what the first version includes and in what order it is
approached. They build on the approved intent statement
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/intent-capture/intent-statement.md`),
the feasibility assessment and the constraint register
(`aidlc/spaces/default/intents/261121-aws-migration/ideation/feasibility/`).
What the first version leaves out is already confirmed and is not asked again.
There is no deadline (feasibility Q6), so no question asks about dates.

## Q1. [Product owner] Which capabilities must the first version include?

The intent statement confirmed only what is left out; the review of it noted
that what is in was never confirmed. `vision.md` lists eight capabilities:
browse (folder list, breadcrumb, icons, sizes); download one or several files;
upload one or several files with progress and safe handling of duplicate
names; organise (create folder, rename file, delete file and folder); sign-in
and permissions; migration of all existing content, verified; delivery and
operations (pipeline, infrastructure as code, logs, alarms, rollback); and
fixes for the five known defects.

A. All eight are must-have
B. All eight are in, but only the two safety defects (names that run script in other visitors' browsers; a duplicate upload overwriting the stored file) are must-have; the other three defect fixes are nice-to-have
C. All eight are in, but logs and alarms are nice-to-have; the pipeline, infrastructure as code and rollback stay must-have
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Who may upload, rename and delete?

The intent statement confirms a contributor group but leaves open who belongs
to it. This decides what "permissions" means in the first version.

A. Any signed-in user
B. Only contributors the maintainer has approved
C. Only people signing in with a university account
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] Can people browse and download without signing in?

The risk log notes that requiring sign-in may put off casual readers (risk
R-06 in `raid-log.md`). Today nobody signs in.

A. Yes, browsing and downloading stay open to everyone; sign-in is only for changing content
B. No, sign-in is required for everything
C. Browsing stays open; downloading requires sign-in
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] Must the list update by itself when someone else changes a folder?

Today the open folder refreshes live when another visitor changes it. Keeping
that is extra work; dropping it changes what students see today.

A. No: refreshing after your own action, and on reload, is enough
B. Nice-to-have: include it only if it comes cheaply
C. Must-have: the first version behaves as today
D. Not yet decided
X. Other (please specify)

[Answer]: C

## Q5. [Product owner] Does the look or the language of the interface change?

A. Neither: keep the current look, logo, icons and interface text
B. Keep the look; add Portuguese to the interface text
C. Redesign the interface as part of this work
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q6. [Maintainer] Is a read-only period acceptable when the new version takes over?

The content is large (feasibility Q3), so the final copy takes time. If people
could still change content during it, changes could be lost.

A. Yes, a few hours of read-only is fine
B. Yes, up to a day is fine
C. No, the switch must happen without any interruption
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Q7. [Maintainer] In what order should the work be approached?

With one person and no deadline, the order decides what is learned first and
where surprises show up.

A. Risk first: prove the riskiest parts early (the content migration rehearsal and sign-in), then the rest
B. Value first: get a student browsing and downloading on AWS as early as possible, then add the rest
C. Foundation first: the pipeline and infrastructure before any feature, so every later piece is deployed through it
D. No preference
X. Other (please specify)

[Answer]: C

## Q8. [Product owner] Who can get an account?

Follow-up to Q2. You chose that any signed-in user may upload, rename and
delete. The intent statement names as a problem that anyone on the internet
can change or delete content. If anyone can also create an account for
themselves, any stranger is one sign-up away from changing content, and the
only gain over today is that each change carries a name. Who can get an
account decides whether that problem is actually closed.

A. Anyone can sign up for themselves; knowing who made each change is protection enough
B. Only people the maintainer invites or creates an account for
C. Anyone can sign up, but only with a university email address
D. Not yet decided
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Must-haves (Q1): all eight capabilities. Browse; download; upload with progress and safe duplicate names; organise (create folder, rename file, delete file and folder); sign-in and permissions; verified migration of all content; delivery and operations (pipeline, infrastructure as code, logs, alarms, rollback); fixes for the five known defects.
- Who may change content (Q2): any signed-in user.
- Reading (Q3): browsing and downloading stay open to everyone; sign-in is only for changing content.
- Live list (Q4): must-have. The open folder updates by itself when someone else changes it, as today.
- Look and language (Q5): unchanged. Current look, logo, icons and interface text stay.
- Cut-over (Q6): a read-only period of a few hours is acceptable.
- Order of work (Q7): foundation first. Pipeline and infrastructure before any feature.
- Accounts (Q8): anyone can sign up for themselves; knowing who made each change is accepted as protection enough.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

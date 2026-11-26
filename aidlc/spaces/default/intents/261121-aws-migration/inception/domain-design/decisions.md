# Architecture Decisions: Domain Design

The significant choices behind `components.md`, each with what forced it, what
was chosen, what it costs, and what was turned down. Requirement and story
identifiers refer to
`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`
and
`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`;
defect identifiers (`DEF-`, `SEC-`) to the code analysis under
`aidlc/spaces/default/codekb/virtuosodrive.com/` (`architecture.md`,
`component-inventory.md`, `code-quality-assessment.md`).

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | Six building blocks | Accepted |
| ADR-002 | Folders and files have their own identity; a name is an attribute | Proposed |
| ADR-003 | A delete is a state of the item, not its removal | Accepted |
| ADR-004 | File contents are kept apart from file records | Proposed |
| ADR-005 | Every change is recorded as part of the operation that makes it | Proposed |
| ADR-006 | Every server-side block checks who is asking, through Accounts | Proposed |
| ADR-007 | Email addresses live in one block only | Proposed |
| ADR-008 | Migration goes through the same rules as the site | Proposed |

"Accepted" marks a decision the maintainer made by answering a question.
"Proposed" marks a decision made here that takes effect if this design is
approved.

---

## ADR-001: Six building blocks

### Status: Accepted

### Context

The existing system is one class in the browser. The new one needs a server
side, sign-in, a record of changes and a migration. One person builds it while
learning the platform, so every boundary is something more to understand, but
each boundary is also where a test can be written (team practices: unit tests
for every module with logic, integration tests for every route).

### Decision

Six blocks: WebClient, Accounts, Drive, FileTransfer, Activity, MigrationTool.
The maintainer chose this over four (domain design answer Q1).

### Consequences

- Each block has one kind of rule and can be tested alone: name rules in Drive without any bytes; limits in FileTransfer without any folder logic.
- The old defects that came from mixing names with stored keys (DEF-01, DEF-04, DEF-08, DEF-14) cannot recur, because the two live in different blocks.
- More boundaries to define at Contract Design, and an upload now crosses two blocks.
- Six blocks say nothing about six deployments. They may all run together; that is decided at Units Generation.
- Security: the two blocks that guard something (Accounts for identity, Activity for the record) are small and separate, so they are easier to review.

### Alternatives Rejected

- **Four blocks**, with Drive also doing file transfer and activity. Quicker to start; rejected by the maintainer's choice, and it would have put the permanent record and the byte handling inside the largest block.
- **One block for the whole server side.** Simplest of all, and closest to today. Rejected because it gives no place to test "refused without a valid account" or "no file without content" in isolation.

---

## ADR-002: Folders and files have their own identity; a name is an attribute

### Status: Proposed

### Context

Today a folder's contents are addressed by the chain of folder names. That is
why folders cannot be renamed, why a name with certain characters cannot be
opened (DEF-10), why two folders with one name share their contents (DEF-11),
and why a sub-folder named "type" confuses the list (DEF-12).

### Decision

Every folder and file gets a generated identifier. Its name, its parent and
its position in the list are attributes. Names are unique among the visible
items of a folder, ignoring case, and folders and files share one set of names
(requirements FR6.2).

### Consequences

- Any ordinary name works, including "2019.1".
- Renaming changes one attribute and nothing else. Folder rename, out of scope now, becomes cheap later.
- Addresses in the browser carry identifiers, not names, so a link to a folder survives a rename.
- A position attribute is needed to keep "oldest first" for migrated items, whose creation times are not known.
- Security: names are never used to build an address or a query, which removes a class of injection problems.

### Alternatives Rejected

- **Keep addressing by path of names**, with stricter name rules. Rejected: it keeps every defect above and only hides some.
- **One entity for both folders and files.** Not rejected, deferred: functional design fixes the schema. Listed separately here because files have content and folders have children.

---

## ADR-003: A delete is a state of the item, not its removal

### Status: Accepted

### Context

The maintainer decided that deleted items disappear from the site but stay
stored, that only the maintainer restores them, and that nothing is removed
for good except by the maintainer directly in AWS (requirements answers RQ2
and RQ9). Any signed-in person can delete, and anyone can sign up.

### Decision

Deleting marks the item with when and by whom. Deleted items are left out of
every list and cannot be downloaded. Deleting a folder marks the folder; what
is inside is hidden because its folder is. Restore clears the mark. Replacing
a file marks the earlier file as deleted with the reason "replaced".

### Consequences

- A hostile or mistaken delete can always be undone.
- A delete touches no stored content, so it cannot fail halfway or hang (DEF-06 to DEF-09).
- Hidden content grows without limit and keeps costing storage. Nothing in the site reduces it. This is the maintainer's accepted trade-off; the deleted-items screen shows how much is held.
- The rule "names unique among visible items" means a deleted item's name can be reused, and a restore may have to number the name.
- Security and privacy: content a person wanted gone still exists. For a file containing personal data, only the maintainer can truly remove it. This should be said to users.

### Alternatives Rejected

- **Permanent delete, as today.** Rejected by the maintainer.
- **A recycle period after which items are removed automatically.** Offered and not chosen; it would bound the cost but could destroy evidence of misuse.

---

## ADR-004: File contents are kept apart from file records

### Status: Proposed

### Context

Today a file's stored location is its folder path plus its original name. A
second upload of the same name lands on the same location and overwrites
(DEF-01); a rename leaves name and location out of step (DEF-14); a failed
selection leaves stored files with no record (DEF-02).

### Decision

FileTransfer owns stored contents under generated keys unrelated to names.
Drive's file record holds only a content identifier. An upload has two steps:
the content is stored completely and checked, and only then is the file
registered with Drive. If registration does not happen, the content is
discarded.

### Consequences

- A file is never listed without its content, and two files never share content by accident.
- Rename, move and delete never touch stored bytes.
- Between the two steps there can briefly be content with no file. That is the safe direction: invisible and discarded. The opposite, a listed file with no content, cannot happen.
- Discarding the content of an abandoned upload is the one place the system removes stored bytes. It never applies to a registered file, so it does not contradict ADR-003; functional design must make that boundary exact.
- Security: the browser sends and fetches content with a short-lived permission for one object, never a credential, as the project rules require. Size and daily limits are enforced before the permission is given.

### Alternatives Rejected

- **Register the file first, then store the content.** Rejected: a failed upload would leave a listed file that cannot be downloaded.
- **Send content through the server side.** Simpler to reason about; rejected because files up to 1 GB do not suit short-lived server processes, and it would cost more.
- **Keep name-based storage keys.** Rejected: it is the cause of the defects above.

---

## ADR-005: Every change is recorded as part of the operation that makes it

### Status: Proposed

### Context

The record of who changed what is the protection that open sign-up relies on
(scope document; requirements FR8.1). The maintainer keeps it indefinitely
(domain design answer Q2). A record that can miss a change is worth little.

### Decision

Drive hands each change to Activity within the same operation: the change and
its record succeed or fail together. Announcing the change to people watching
the folder follows from the record and may lag or be lost without harm, since
a refresh shows the truth.

### Consequences

- There is exactly one record entry per change, and no change without one.
- Drive depends on Activity being available to accept a record. If they share one database this costs nothing; if they are ever separated it must be revisited.
- Activity never calls Drive, so there is no cycle.
- The record names items by identity and also keeps the name at the time, so it stays readable after renames and deletes.
- Security: no function of the site edits or removes entries. Protecting the record from someone with direct access to the database is a matter for the infrastructure stages.

### Alternatives Rejected

- **Activity listens for events from Drive.** Looser coupling; rejected because an event can be lost, and then a change has no record.
- **Drive keeps the record itself.** Fewer blocks; rejected with the four-block option (ADR-001).

---

## ADR-006: Every server-side block checks who is asking, through Accounts

### Status: Proposed

### Context

Today anyone can change anything (SEC-01, SEC-02, SEC-04). The success measure
is that every operation that changes data is rejected without sign-in,
whatever the page shows (requirements FR4.5, NFR2). The maintainer chose
account screens built into the site (refined mockups answer Q3), where the
planning document expected the sign-in service's own hosted pages.

### Decision

Accounts is the single place that says who a request comes from and whether
that account is confirmed, enabled and a maintainer. Drive, FileTransfer and
Activity each ask it before doing anything that changes content or reveals
maintainer information. WebClient hides what a person may not do, but that is
for convenience only. Passwords are kept by a sign-in service, not by Accounts
itself.

### Consequences

- "Refused without a valid account" is one rule in one place, tested once per operation.
- Disabling an account takes effect everywhere at once, within the 15 minutes an open session may last.
- Every change operation costs one check.
- Built-in account screens mean passwords are typed into this site's own pages and pass through its code on the way to the sign-in service. That is a larger surface to get right than hosted pages: the forms, their error messages, the pause after wrong passwords and the reset flow all become this project's responsibility. The design and build stages must treat those screens as security-sensitive.
- The sign-in service must allow sign-up, sign-in and reset to be driven from the site's own screens; that narrows the choice at infrastructure design.

### Alternatives Rejected

- **Check once at the edge only.** Rejected: a block reachable by another route would be unprotected, which is today's situation in miniature.
- **Hosted sign-in pages.** Safer and less to build; turned down by the maintainer for the sake of the site's look and keeping people on the list.
- **Accounts stores passwords itself.** Rejected: the planning document rules it out, and nothing is gained.

---

## ADR-007: Email addresses live in one block only

### Status: Proposed

### Context

The only personal data held are an email address and a display name, and an
email address is never shown to another user (requirements NFR5). The
maintainer alone sees them, to tell accounts apart (refined mockups answer
Q6). An account can be removed on request with its details erased
(requirements FR9.5).

### Decision

Only Accounts holds email addresses and display names. Every other block holds
an account identifier. Names are looked up when shown. Removing an account
erases the two details in Accounts and leaves the identifiers elsewhere
pointing at nothing, which the site shows as "Deleted account".

### Consequences

- Erasing a person's details is one operation in one place; nothing else has to be searched.
- The record of changes and "changed by" survive the removal without naming anyone.
- Showing names costs a lookup, done in batches for a list.
- Logs must carry the identifier, never the address.
- Privacy: backups and logs still hold the details until they age out; "erased" is true of the live system at once and of the rest after the retention periods. This limit was raised in review and stands.

### Alternatives Rejected

- **Copy the display name onto each item and record entry.** Faster to show; rejected because removal would have to find and blank every copy, and one missed copy is a privacy fault.
- **Show a short number instead of an email address to the maintainer.** Offered; the maintainer chose to see addresses.

---

## ADR-008: Migration goes through the same rules as the site

### Status: Proposed

### Context

The old data is expected to be untidy: content without records, records
without content, misfiled records, same-named folders sharing contents
(code analysis, "Likely state of the live data"). The requirements say what
happens to each case (FR10.2 to FR10.5; stories answer Q3). The success
measure is 100% of files and folders preserved, with a check that proves it.

### Decision

MigrationTool decides what to do with each source item and then creates
folders and files through Drive and FileTransfer, using import operations that
apply the same name and consistency rules as the site and additionally let it
set the order of items and mark them as brought over. It never writes to the
database or to storage directly. It keeps one entry per source item, keyed by
the source's own key, which is also what makes a second run add nothing.

### Consequences

- Migrated content cannot be in a state the site's own rules forbid, so the site never has to cope with "old-style" data.
- The import operations are extra surface on Drive and FileTransfer that only the operator may use. They must be closed to everyone else, or removed after the switch.
- Slower than a bulk load. With the content described as large, the rehearsal (FR10.7) must show that the final copy fits the read-only period; if it does not, this decision is the first to revisit.
- The tool is the one place Firebase libraries are allowed, read only.
- Security: the tool needs read access to the old project and write access to the new one. Those permissions should exist only for the migration.

### Alternatives Rejected

- **Load the database and storage directly.** Faster; rejected because it duplicates the rules in a second place and risks data the site cannot handle.
- **Clean the old data in place first.** Rejected: the old system must not be changed.

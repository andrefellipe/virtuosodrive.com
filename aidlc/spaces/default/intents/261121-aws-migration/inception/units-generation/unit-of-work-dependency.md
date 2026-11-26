# Unit Dependencies: Virtuoso Drive on AWS

Which Unit needs which. A Unit depends on every Unit whose code its own code
or tests need in order to build or pass. The Units are defined in
`unit-of-work.md`, from the building blocks in
`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`
and the decisions in `decisions.md` beside it, for the requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`)
and stories
(`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`).

This document describes what can follow what. It does not say what to build
first; that is decided at Delivery Planning.

## Edges

```yaml
units:
  - name: u1-thin-slice
    kind: service
    depends_on: []
  - name: u2-accounts
    kind: service
    depends_on: [u1-thin-slice]
  - name: u3-browsing
    kind: service
    depends_on: [u1-thin-slice]
  - name: u4-downloading
    kind: service
    depends_on: [u3-browsing]
  - name: u5-change-record
    kind: service
    depends_on: [u2-accounts, u3-browsing]
  - name: u6-organising
    kind: service
    depends_on: [u2-accounts, u3-browsing, u5-change-record]
  - name: u7-uploading
    kind: service
    depends_on: [u4-downloading, u6-organising]
  - name: u8-migration-tool
    kind: service
    depends_on: [u3-browsing, u4-downloading]
  - name: u9-switch
    kind: packaging
    depends_on: [u2-accounts, u5-change-record, u6-organising, u7-uploading, u8-migration-tool]
```

## The same as a picture

```
                  +----------------+
                  | U1 thin slice  |
                  +---+--------+---+
                      |        |
             +--------+        +--------+
             v                          v
     +---------------+          +---------------+
     | U2 accounts   |          | U3 browsing   |
     +---+-------+---+          +--+----+----+--+
         |       |                 |    |    |
         |       +------+   +------+    |    +---------+
         |              v   v           |              v
         |       +---------------+      |      +----------------+
         |       | U5 change     |      |      | U4 downloading |
         |       |    record     |      |      +---+--------+---+
         |       +---+-------+---+      |          |        |
         |           |       |          |          |        |
         +------+    |       |    +-----+          |        |
                v    v       |    v                |        |
            +----------------+------+              |        |
            | U6 organising         |              |        |
            +-----------+-----------+              |        |
                        |                          |        |
                        +-----------+  +-----------+        |
                                    v  v                    v
                          +---------------+        +----------------+
                          | U7 uploading  |        | U8 migration   |
                          +-------+-------+        |    tool        |
                                  |                +--------+-------+
                                  |                         |
                                  +-----------+  +----------+
                                              v  v
                                      +----------------+
                                      | U9 the switch  |
                                      +----------------+
```

<!-- Text fallback: U1 has no dependency. U2 and U3 each depend on U1. U4 depends on U3. U5 depends on U2 and U3. U6 depends on U2, U3 and U5. U7 depends on U4 and U6. U8 depends on U3 and U4. U9 depends on U2, U5, U6, U7 and U8. The picture omits the direct lines from U2 and U5 to U9 and from U3 to U8 for legibility; the edge block above is complete. There is no cycle. -->

## Why each edge exists

| Unit | Depends on | Because |
|------|------------|---------|
| U2 accounts | U1 | It is deployed and tested through the pipeline and uses the server, database and page shell that U1 establishes |
| U3 browsing | U1 | The same |
| U4 downloading | U3 | A download is of a file that Drive lists; FileTransfer asks Drive for the file's content and name |
| U5 change record | U2 | Reading the record is for maintainers only, and entries are resolved to account names |
| U5 change record | U3 | An entry refers to a folder or file, and a live update is applied to a list that U3 draws |
| U6 organising | U2 | Every change is refused without a valid account |
| U6 organising | U3 | It changes the folders and files that U3 defines and lists |
| U6 organising | U5 | Every change is recorded and announced in the same operation; a change with no record must not be possible |
| U7 uploading | U4 | Upload adds to the stored contents that U4 defines, and an uploaded file must be downloadable to be verified |
| U7 uploading | U6 | Replace turns the earlier file into a deleted item, which is U6's behaviour; and through U6 it needs accounts and the record |
| U8 migration tool | U3 | It creates folders and file records through Drive |
| U8 migration tool | U4 | It stores file contents through FileTransfer |
| U9 the switch | U8 | It runs the final copy and its check |
| U9 the switch | U2, U5, U6, U7 | The new site must be complete before people are sent to it |

Edges that follow from others are not repeated in the block: U7 needs U2, U3
and U5 through U6; U8 needs U1 through U3.

U8 does not depend on U2, U5, U6 or U7. The migration brings content in
without an ordinary account, writes no change record, and does not use the
upload path. That independence is intended (decision ADR-008), and it depends
on the import path being designed as the design review asked.

## The first Unit

U1 is the only Unit with no dependency, so it is first in every possible
order. It is the integrated slice the team practices require: it runs end to
end on its own (a page, a server call, a database read, deployed by the
pipeline to AWS) before any other Unit exists, and it contains nothing that
waits on a later Unit.

## What can proceed independently

These sets have no dependency between their members:

- **After U1:** U2 and U3.
- **After U3:** U4 alongside U2.
- **After U2 and U3:** U5 alongside U4.
- **After U3 and U4:** U8 alongside U2, U5, U6 and U7. The migration tool needs none of the account, record, organising or uploading work.
- **After U5:** U6 alongside U4 and U8.

The team works on one Unit at a time, so these are freedoms of ordering, not
plans to work in parallel. The most useful one is the last but one: U8, the
largest and least certain Unit, can start as soon as U3 and U4 are done,
without waiting for the rest of the site.

## Where Units meet

All Units are parts of one application with one database, so they meet inside
the code at the boundaries of the building blocks, not across a network. The
exact operations are fixed at Contract Design.

| Meeting point | Between | What crosses |
|---------------|---------|--------------|
| Who is asking | U2 and each of U5, U6, U7 | A request's account, and whether it is confirmed, enabled and a maintainer |
| Names for display | U2 and each of U5, U6 | Account identifiers in, display names out; email addresses out only for a maintainer |
| Folder and file records | U3 and each of U4, U5, U6, U7, U8 | The shape of Folder and File, including position, deleted marks and the brought-over mark |
| A file's content | U4 and U7, U8 | The stored-content record and its key |
| Recording a change | U5 and each of U6, U7 | One entry per change, written in the same operation |
| Announcing a change | U5 and the list drawn by U3 | Which folder changed and how; no display names |
| Registering a stored file | U7 and U6 | Name-clash outcome; marking the replaced file as deleted |
| Import | U8 and each of U3, U4 | Folders, file records and contents, with their order, bypassing account, limits and record |
| The final copy | U9 and U8 | A run of the tool and its check |
| The pipeline and environments | U1 and every Unit | How a Unit is checked, deployed and observed |

The shape of Folder and File is the meeting point with the most Units on it.
A change to it after U3 touches five other Units, which is a reason to fix it
carefully in U3's design.

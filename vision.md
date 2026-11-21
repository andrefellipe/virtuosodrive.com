# Virtuoso Drive on AWS: Vision

> Draft written from a review of this repository at commit `de24f7c` (2019-06-13).
> Lines marked **[confirm]** are assumptions. Check them, and answer or delete the
> open questions you can, before the first `/aidlc` run.

## Executive Summary

Virtuoso Drive is a web file-sharing system for the electrical engineering
students of a university: a shared drive of homework resolutions, past exams and
study material, organised in folders by academic period. Today it runs on
Google's Firebase platform with no sign-in, no automated tests and no deployment
pipeline. This piece of work moves it to AWS, replaces its data store with
PostgreSQL, and modernises the code, security and delivery so it can be run and
extended safely. The expected outcome is the same student-facing capability,
running entirely on AWS, with every change traceable through the AI-DLC record.

## Business Context

### Problem Statement

The application was built in June 2019 and has not changed since. It depends on
Google Cloud, anyone on the internet can change or delete its content, and it
has no tests, pipeline or infrastructure definition, so any change is manual and
risky.

### Business Drivers

- The application must leave Google Cloud and run on AWS.
- The data store must become PostgreSQL. A managed service is acceptable.
- The application should be modernised as far as is practical in this work.
- The work must be carried out with AWS AI-DLC, and that must be provable
  afterwards from the repository.

### Target Users and Stakeholders

| User type | Description | Primary need |
|-----------|-------------|--------------|
| Student (reader) | Electrical engineering student | Find and download material quickly, on a phone or laptop |
| Contributor **[confirm]** | Student or monitor who adds material | Upload and organise files without breaking what is there |
| Maintainer | The repository owner | Operate the system cheaply, safely, and with little effort |

### Business Constraints

- AWS only at runtime after cut-over. No Google Cloud or Firebase dependency.
- PostgreSQL is the system of record for folders and file metadata.
- Built and operated by one person **[confirm]**, so low running cost and low
  operational effort outweigh raw scale.
- Monthly cost ceiling while idle: **[confirm figure]**.

### Success Metrics

| Metric | Today | Target | How it is measured |
|--------|-------|--------|--------------------|
| Runtime dependencies on Google Cloud | 3 (Hosting, Realtime Database, Cloud Storage) | 0 | No Firebase SDK in the build; no requests to Google endpoints from the running app |
| Operations that change data without sign-in | All of them | None | Automated test: every mutating call without a valid identity is rejected |
| Automated tests run on every change | 0 | Unit, integration and key journeys | Pipeline history |
| Infrastructure defined as code | 0% | 100% | Environment rebuilt from an empty account by the pipeline |
| Content preserved after migration | n/a | 100% of files and folders | File and folder counts and sizes match the source export |
| Source changes traceable to an approved AI-DLC Unit | n/a | 100% | `aidlc attest resolve` over the migration range reports no drifted, unattested, unverifiable or indeterminate paths |

## Current State

- A single-page browser application: one controller class of about 740 lines
  (`app/public/js/VirtuosoController.js`) that calls Firebase directly from the
  browser. There is no application backend in production.
- Folder and file metadata are held in Firebase Realtime Database as a tree
  keyed by folder name. File contents are held in Cloud Storage for Firebase.
  The page is served by Firebase Hosting at https://virtuoso-drive.web.app/.
- The repository also holds an Express scaffold (`app/app.js`, `app/routes/`,
  `app/views/`) that the hosting configuration does not run.
- What a visitor can do today: browse folders with a breadcrumb, create a
  folder, upload one or several files with a progress bar, select one or many
  rows, download files, rename a file, and delete files and folders. The list
  refreshes live when someone else changes the open folder.
- Nobody signs in. The database and storage rules in the repository allow
  public read and write.

Known defects, from reading the code:

- File and folder names are inserted into the page as HTML, so a crafted name
  runs script in other visitors' browsers.
- Uploading a file whose name already exists in the folder shows an error but
  the stored file is overwritten anyway.
- Deleting an empty folder never completes, and deleting a folder with content
  can leave stored files behind.
- Video files show the audio icon.
- Shift-click range selection can select nothing once a list has more than ten
  rows.

Known limits, also from the code: renaming a file changes its displayed name
only, and folders cannot be renamed or downloaded.

## What Is Changing

1. Hosting moves from Firebase to AWS, for every runtime component.
2. Metadata moves from Firebase Realtime Database to PostgreSQL.
3. File contents move from Cloud Storage for Firebase to AWS object storage.
4. The browser stops talking to the data stores directly. A server-side API
   validates and authorises every request.
5. Sign-in and permissions are introduced, and public write access is closed.
6. The code gains types, automated tests, a delivery pipeline, infrastructure
   as code and monitoring.
7. The known defects above are fixed.

## First Release Scope

### Objective

Students can do on AWS everything they can do today, existing content is
preserved, and nobody can change content without being signed in and allowed to.

### Features In Scope

| Feature | Description | Why it cannot wait |
|---------|-------------|--------------------|
| Browse | Folder list, breadcrumb, file type icons, sizes | Core journey |
| Download | One or several files | Core journey |
| Upload | One or several files with progress, duplicate names handled safely | Core journey |
| Organise | Create folder, rename file, delete file and folder | Exists today |
| Sign-in and permissions | Only permitted users change content | Closes the public write access |
| Content migration | Every existing folder and file carried over, verified | Nothing may be lost |
| Delivery and operations | Pipeline, infrastructure as code, logs, alarms, rollback | Required to run it safely |
| Defect fixes | The five known defects | They affect safety or correctness |

### Features Out of Scope

| Feature | Why it can wait | Target phase |
|---------|-----------------|--------------|
| Search, tags, previews | New capability, not part of the move | Later |
| Folder rename and folder download **[confirm]** | Never existed | Later |
| Sharing links, comments, ratings | New capability | Later |
| Native mobile app | Responsive web is enough | Not planned |
| Decommissioning the Firebase project | Only after the AWS version is accepted | Separate piece of work |

### Definition of Done

- [ ] Every in-scope feature built, tested, and deployed to AWS by the pipeline
- [ ] Migrated content verified against the source export
- [ ] No Google Cloud dependency at runtime
- [ ] Rollback rehearsed: the Firebase site still works until cut-over is accepted
- [ ] The AI-DLC record is complete and committed, and the provenance check in
      Success Metrics passes

## What Must Not Change

- The purpose and the core journeys: browse, download, upload, organise.
- Existing content: folder structure, file names, file contents.
- The live Firebase site and its data stay untouched and running until cut-over
  is explicitly approved. Migration only reads from Firebase.
- The Git history of this repository. The legacy code stays reachable at the
  tagged baseline.
- The logo and icon set **[confirm]**.

## Risks and Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Content lost or renamed during migration | Medium | High | Rehearsal run, count and size verification, source left read-only and intact |
| Monthly AWS cost higher than expected | Medium | Medium | Scale-to-zero services, cost estimate at design time, budget alarm |
| Sign-in puts off casual readers | Medium | Medium | Decide whether reading stays anonymous (open question 1) |
| Agents create AWS resources outside the plan | Low | Medium | Dedicated account or role with least privilege, everything through infrastructure as code |
| One-person project stalls mid-way | Medium | Medium | Small Units, each one deployable and verified on its own |

### External Dependencies

- Access to the Firebase project `virtuoso-drive` to export data: owner, **[confirm access still works]**
- An AWS account for this project: owner, **[confirm exists]**

### Open Questions

- [ ] 1. Who may upload, rename and delete: any signed-in user, approved
      contributors only, or university accounts only? May anonymous visitors
      still browse and download?
- [ ] 2. Is there live content in Firebase worth migrating, and roughly how
      much (files, GB)? Is a short read-only window at cut-over acceptable?
- [ ] 3. Must the list keep updating live when someone else changes a folder,
      or is refresh after each action enough?
- [ ] 4. Which AWS Region: São Paulo, closest to the users, or a cheaper US
      Region?
- [ ] 5. What is the monthly cost ceiling, and must the system cost close to
      nothing while idle?
- [ ] 6. Keep the current address, or move to a new or custom domain?
- [ ] 7. Keep the current look, or redesign the interface? Add Portuguese to
      the interface text?
- [ ] 8. Maximum file size, allowed file types, and is malware scanning needed?
- [ ] 9. Is deletion permanent, as today, or should there be a recycle period?
- [ ] 10. Once people sign in the system holds personal data (at least email
      addresses). Which obligations apply, for example LGPD?

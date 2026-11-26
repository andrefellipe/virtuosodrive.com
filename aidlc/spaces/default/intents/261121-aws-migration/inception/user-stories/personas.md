# Personas: Virtuoso Drive

Four people use or run the system. They come from the groups confirmed in the
intent statement and from what the existing application does
(`aidlc/spaces/default/codekb/virtuosodrive.com/business-overview.md`). The
requirements they serve are in
`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`.

**A caution on all four:** nobody besides the maintainer was consulted, by the
maintainer's own choice. The goals and frustrations below are read from the
documents and from the existing code, not from talking to students. Treat them
as the best available description, not as research.

## Reader

| | |
|---|---|
| Role | An electrical engineering student who comes to find study material |
| Signs in | Never. Reading needs no account |
| Goals | Find the right folder quickly; download one or several files; open a file to look at it |
| Frustrations today | Shift-click selection fails on longer lists; video files look like audio; the list can show a name that runs someone else's script |
| Context | A phone or a laptop, often in a hurry before a class or an exam |
| Uses it | Often, in short visits |
| Comfort with technology | High |

What matters most to the reader is that nothing gets in the way: no account,
no new steps, the same screen as today.

## Contributor

| | |
|---|---|
| Role | A student or monitor who adds material and keeps folders tidy |
| Signs in | Yes, to upload, create a folder, rename or delete. Anyone can sign up |
| Goals | Upload a batch of files without losing any; put them in the right folder; fix a wrong name; remove what should not be there |
| Frustrations today | A second upload of the same name silently replaces the stored file while reporting an error; deleting an empty folder never finishes; a failed delete says nothing |
| Context | Usually a laptop, sometimes with large files such as recorded classes |
| Uses it | Occasionally, in longer sessions |
| Comfort with technology | High |

A contributor is also a reader. What changes for them is that they now need an
account, and that their display name appears beside what they change.

## Maintainer

| | |
|---|---|
| Role | The owner of the site, acting on the site itself |
| Signs in | Yes, with an account marked as maintainer |
| Goals | Stop an account that misbehaves; see who changed what; bring back something deleted by mistake or on purpose; remove someone's account when they ask |
| Frustrations today | There is no way to do any of this: there are no accounts and a delete is final |
| Context | A laptop, when something has gone wrong or someone has asked for help |
| Uses it | Rarely |
| Comfort with technology | High |

The maintainer exists because sign-up is open to anyone. Every maintainer
function is a remedy for something an ordinary account might do.

## Operator

| | |
|---|---|
| Role | The same person as the maintainer, acting on the system from outside the site: migrating the content, switching over, changing and running the system |
| Signs in | Not to the site; works through the repository, the pipeline and AWS |
| Goals | Move every file and folder without loss and be able to prove it; switch from the old site without losing anyone's changes; change the system safely; hear about problems before students do; stay under about US$50 a month |
| Frustrations today | Every change is made by hand with no tests; nothing describes the infrastructure; there is no warning when something breaks |
| Context | Works alone, is learning AWS, and has no deadline |
| Uses it | During the migration, then at each change |
| Comfort with technology | High; new to AWS |

## How they relate

- A contributor can do everything a reader can. A maintainer can do everything a contributor can.
- The maintainer and the operator are one person in two roles. They are kept apart because the first works through the site and the second does not, and the stories for each are tested differently.

## Priority

When two personas' needs pull apart, the order is: reader, contributor,
maintainer, operator. The reader comes first because the stated objective is
that students can do everything they can do today; the operator comes last
because operating effort is a means, not the product. In practice the open
sign-up decision already favoured readers and contributors over the
maintainer's ease.

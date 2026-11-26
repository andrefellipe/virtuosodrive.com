# User Stories Assessment

## Decision

**Execute.** User stories are needed for this work.

## Rationale

The work is user-facing from end to end: students browse and download,
contributors sign in, upload and organise, and the maintainer gains functions
that did not exist before. The requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`)
state what must be true; stories state it from the point of view of the person
doing it, with acceptance criteria that the end-to-end tests named in the team
practices
(`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`)
can be written from.

## Factors considered

| Factor | Finding |
|--------|---------|
| Project type | Migration with modernisation of an existing application (`aidlc/spaces/default/codekb/virtuosodrive.com/business-overview.md`) |
| User-facing scope | Eight existing capabilities kept, plus sign-in, a record of changes, and maintainer functions |
| Personas | Four distinct people: a reader who never signs in, a contributor, the maintainer using the site, and the maintainer operating and migrating it |
| Complexity signals | Rules with several outcomes (duplicate names, deletes that hide, restore, quotas); a data migration over content in an unknown state |
| Existing structure | One controller class does everything today (`aidlc/spaces/default/codekb/virtuosodrive.com/component-inventory.md`), so the existing components give no story boundaries; stories follow user journeys instead |

## Where stories add the most value

- **Sign-up and sign-in**, where the review of the requirements found a contradiction and three missing basics. Stories force the journey to be stated end to end.
- **Upload and delete**, where most of the old defects were, and where "what the person sees when it goes wrong" matters most.
- **Maintainer functions**, which are new and have no screens sketched.
- **Migration and the switch**, written as stories for the maintainer so that "done" is something the maintainer can check.

## Outcome

Thirty-one stories in nine groups were written for four personas
(`stories.md`, `personas.md`). Three decisions taken while planning them
(email confirmation required; password reset, password length and a pause
after failed sign-ins; both same-named files kept at migration) are recorded
in `user-stories-questions.md` and listed at the top of `stories.md`.

## What stories do not cover

Quality requirements that are not a person's journey (encryption, cost, test
coverage, traceability) are not turned into stories. They stay as requirements
and are taken up by the later stages that own them.

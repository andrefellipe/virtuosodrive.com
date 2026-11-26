# External Dependencies: Virtuoso Drive on AWS

Things outside the work that a **Bolt** waits on (a Bolt is one build pass
over a piece of the work, ending in something that runs). The Bolts are in
`bolt-plan.md` beside this file; the Units they build are in
`aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`
(with `unit-of-work-dependency.md` and `unit-of-work-story-map.md`).

No other team, supplier or approver is involved: the maintainer is the only
person and the only decision-maker (requirements and stories,
`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`,
`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`).
Everything below is therefore either an account the maintainer holds or a
service's own waiting time.

The maintainer was not asked for this list at this step; it is assembled from
earlier answers and from what the building blocks and contracts need
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`,
`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`).
Items marked "to confirm" are things I believe to be needed and have not
verified.

## Map

| # | Dependency | Owner | Status | Lead time | Blocks | If it slips |
|---|------------|-------|--------|-----------|--------|-------------|
| D1 | A dedicated AWS account with administrator access | Maintainer | In place (feasibility answer) | None | Bolt 1 | Nothing can start |
| D2 | A budget alarm in that account before anything else | Maintainer, through Bolt 1 | To do, as Bolt 1's first act, by a one-time setup script kept in the repository and run once by the maintainer; nothing is made in the console | Minutes | Bolt 1 | Project rule: nothing else is created without it |
| D3 | The domain `andrefellipelabs.com` in Amazon Route 53, for `virtuoso.andrefellipelabs.com` | Maintainer | In place (requirements answer) | A certificate for the name takes minutes to hours to issue (estimate, to confirm). To confirm in Bolt 1: depending on how the site is served, the certificate may have to be issued in a specific Region (N. Virginia) whatever Region the rest runs in To confirm in Bolt 1: whether the zone is in the dedicated AWS account or another one, which changes how the name and its certificate are set up | Bolt 1, Bolt 9 | The slice is shown on a temporary address until it is ready |
| D4 | A link between GitHub and the AWS account so the pipeline can deploy without long-lived keys | Maintainer | To do, by the same one-time setup script as D2 | An hour of setup (estimate) | Bolt 1 | The pipeline cannot deploy |
| D5 | Branch protection on `aws-migration`, so a failing check really blocks a merge | Maintainer | Not checked | Minutes; to confirm that the repository's GitHub plan allows it on this repository | Bolt 1 | The pull-request rule is a habit, not a guard |
| D6 | The repository on GitHub, and GitHub's automated checks if that is the pipeline chosen | Maintainer | In place; the pipeline product is undecided | None | Bolt 1 | An AWS-native pipeline instead |
| D7 | Owner access to the Firebase project `virtuoso-drive`, to read its database and files | Maintainer | Confirmed recently (feasibility answer) | None | Bolt 4, Bolt 9 | No migration is possible; the largest single dependency of the work |
| D8 | The old site staying up and unchanged until the switch | Google, and anyone on the internet | Up; anyone can change or delete its content | Not in our hands | Bolt 4, Bolt 9 | Content damaged before Bolt 4 is lost for good; after Bolt 4 the export and every file's contents are in private storage outside both environments (Q8) |
| D9 | A way to send email from the system to anyone (confirmation and reset links). Alarm emails to the maintainer do not depend on this: they go through a notification service that only asks the maintainer to confirm a subscription | Maintainer, through AWS | To do | To confirm: a new AWS account can usually send only to verified addresses until a request to lift that limit is approved, which can take a day or more | Bolt 5 with the maintainer's own verified address; Bolt 9 for mail to anyone | Sign-up cannot be opened to others until it is lifted; ask for it during Bolt 1 |
| D10 | A sign-in service that allows sign-up, sign-in and reset from the site's own screens | Maintainer, through AWS | To choose in Bolt 5 | None once chosen | Bolt 5 | The choice of built-in screens would have to be revisited |
| D11 | A real phone and the supported browsers, for hand checks | Maintainer | Assumed | None | Bolts 1, 2, 3, 5, 8 | Problems on phones found by students instead |
| D12 | A screen reader for the accessibility hand checks | Maintainer | VoiceOver is part of macOS and iOS | None | Every Bolt with a screen: 2, 3, 5, 6, 7, 8 | The accessibility target is only partly verified |
| D13 | Licences or origin of the bundled font, logo and icons | Maintainer | Not recorded in the repository | Unknown | Bolt 2 | Replace the font with a system font; the look changes slightly |
| D14 | Permission to change the Firebase access rules and replace the old page | Maintainer | Has owner access | None | Bolt 9 | No switch |
| D15 | A day on which students can do without changing content for up to 4 hours | Maintainer | To choose | Maintainer's choice | Bolt 9 | Switch on another day |
| D16 | The limits a new AWS account starts with (how much of each service it may use) | AWS | Not checked | To confirm in Bolt 1: raising a limit is a request that can take days | Bolt 1; Bolt 4 if the content is very large | Ask early; the slice itself is small enough that this is unlikely to bite |
| D17 | What Google charges for reading the content out of Firebase | Google | Not checked | None | Bolt 4, Bolt 9 | Estimate from the measured export before copying; the content is known to be large (feasibility answer) |

## By Bolt

| Bolt | Waits on |
|------|----------|
| 1 U1 thin slice | D1, D2, D3, D4, D5, D6, D11, D16 |
| 2 U3 browsing | D11, D12, D13 |
| 3 U4 downloading | D11, D12 |
| 4 U8 migration tool | D7, D8, D16, D17 |
| 5 U2 accounts | D9, D10, D11, D12 |
| 6 U5 record of changes | D12 |
| 7 U6 organising | D12 |
| 8 U7 uploading | D11, D12 |
| 9 U9 the switch | D3, D7, D8, D9, D14, D15, D17 |

## The three that matter

- **D8, the old site staying intact.** It is the only dependency that can cause permanent loss and the only one nobody controls. It is the strongest reason the migration tool is built fourth and not eighth: until then there is no copy.
- **D9, sending email to anyone.** The one item with a waiting time that is not the maintainer's own. Asking for it during Bolt 1 costs nothing. Bolt 5 can be tested with the maintainer's own verified address; the limit must be lifted before Bolt 9 opens sign-up to everyone. To confirm when Bolt 1's infrastructure is designed.
- **D7, access to Firebase.** Confirmed, but it is worth taking the first export as soon as Bolt 4 can read one, in case access is ever lost.

## Not dependencies

- **Nobody's approval** is needed but the maintainer's.
- **No other system** calls this one or is called by it, apart from the services above.
- **The team practices**
  (`aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/team-practices.md`)
  and the screens
  (`aidlc/spaces/default/intents/261121-aws-migration/inception/refined-mockups/mockups.md`)
  add no outside dependency.

# Functional Design: Questions for U1, the thin slice

This step says what the thin slice does, in plain terms and without naming
any technology: what its one page shows, what its one server call answers,
who may reach it, and the rules the pipeline enforces. Which AWS services, which
Region, which pipeline product and how the repository is laid out are chosen
in the next three steps of this Unit, not here.

It draws on the Unit's definition
(`aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`),
its stories US9.1 to US9.4
(`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`),
requirements FR12.1 to FR12.7
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`)
and the delivery plan
(`aidlc/spaces/default/intents/261121-aws-migration/inception/delivery-planning/bolt-plan.md`).

Already settled, and not asked:

- The health check answers "ok" when the server and its database are answering, and a failure otherwise (contract C1).
- Every request carries an identifier that is echoed back and written to the logs; failures use the agreed problem format (contract C1).
- Both environments are private until the switch, and must admit the pipeline and your phone on any network (delivery plan, Q6 and Q7).
- The budget alarm comes first, warning at 80% and 100% of US$50 a month (FR12.3).

## Q1. [Maintainer] What does the one page show?

The slice carries no product feature; the page only has to prove that the
page, the server and the database are connected. What it shows also decides
how easy the demos are: a visible version makes "put the previous version
back" something you can see.

A. The site's name and logo, one line saying the server and database answered, and beneath it the version and which environment this is (test or production)
B. Only one line saying the server and database answered
C. The real list screen's frame (header, empty list) with a status line, as a head start on Bolt 2
X. Other (please specify)

[Answer]: A

## Q2. [Maintainer] How do you get into the private environments before accounts exist?

Accounts arrive in Bolt 5, so until then "private" cannot mean signing in to
the site. Whatever is chosen also has to let the pipeline's tests in, and
leave the health check reachable by the monitoring that watches it.

A. One shared password, asked for by the browser the first time you open the site on a device. Works on any device and network. The pipeline holds the same secret. Removed from production at the switch
B. Only listed network addresses are let in. Nothing to type, but your phone away from home would be refused, and the list needs upkeep
C. Decide for me, and explain the choice so I can change it at approval
X. Other (please specify)

[Answer]: A

## Q3. [Developer] When a release changed the structure of the database, how does going back work?

Your practice asks each change to the database structure for "a tested way
back or a documented roll-forward". The slice sets the default that later
Units follow.

A. Compatible changes only: a change to the database structure must leave the previous version of the site working, so going back never touches the database. A change that cannot be made that way is split over two releases. The pipeline tests the previous version against the new structure
B. Every change to the database structure ships with its own undo, and the undo is tested in the pipeline
C. Decided change by change, with no default
X. Other (please specify)

[Answer]: A

## Q4. [Developer] What is the 80% test coverage measured over?

Open since Practices Discovery. The requirement says "the lines of the new
code", and excludes the old application.

A. All new code in the repository, as one figure: a pull request is refused if the total falls below 80%. Simple, but a well-tested codebase can absorb one poorly tested change
B. The lines each pull request adds or changes: every change must itself be 80% covered. Stricter, and harder to satisfy for small changes
C. Both: the total and each pull request's own lines must be at least 80%
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- The page (Q1): the site's name and logo, one line saying the server and database answered, and the version and environment.
- Getting in (Q2): one shared password per environment, asked for by the browser; the pipeline holds the same secret; removed from production at the switch.
- Going back (Q3): compatible database changes only, so going back never touches the database; the pipeline tests the previous version against the new structure.
- Coverage (Q4): at least 80% of all new code as one figure; the old application is not counted.
- Not asked, chosen by the designer: the one database read is a single "site information" record created by the first database change (it proves that database changes are applied, not only that the database is reachable).
- Not asked, chosen by the designer: the health check is reachable without the password, and says nothing but "ok" or a failure.
- Not asked, chosen by the designer: the address that alarm emails go to is given when the one-time setup is run and is never written in the repository.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

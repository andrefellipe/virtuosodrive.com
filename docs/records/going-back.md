# Record: going back, rehearsed in the test environment

Template written 2026-11-25. Performed 2026-11-27 (rules BR6.2; procedure 3
in `docs/operations.md`). Times are UTC.

| What                                                      | Record                                                                                                                                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date of the rehearsal                                     | 2026-11-27                                                                                                                                                                                                             |
| Environment                                               | test                                                                                                                                                                                                                   |
| Release that was running (version)                        | `1db1c19`                                                                                                                                                                                                              |
| Release gone back to (version)                            | `d615fed`                                                                                                                                                                                                              |
| Link to the `go-back` run                                 | https://github.com/andrefellipe/virtuosodrive.com/actions/runs/45940475089                                                                                                                                             |
| Outcome the run recorded                                  | success                                                                                                                                                                                                                |
| Time from starting the workflow to the passed smoke check | 34 seconds: the run started at 04:31:50 and finished at 04:32:24, its smoke check passed                                                                                                                               |
| The page showed the earlier version afterwards (yes/no)   | Not looked at. The server's answer was checked: `/v1/site-information` answered version `d615fed`. The page itself was not opened in a browser                                                                         |
| The site worked after going back (yes/no)                 | Yes, as far as the run's smoke check and the server's answer show; the page was not opened in a browser                                                                                                                |
| Going back a second time returned to the Release left     | Yes. Second run: https://github.com/andrefellipe/virtuosodrive.com/actions/runs/45940574459 , started at 04:32:49 and finished at 04:33:13 (24 seconds), after which `/v1/site-information` answered version `1db1c19` |

Target: within 15 minutes. Met: 34 seconds.

## Notes

Nothing unexpected, and no code was changed for this rehearsal.

Not done: nobody opened the page in a browser between the two runs, so that
the page showed the earlier version is known only from the server's answer.

## Going back with Unit U3 deployed

Rows added on 2026-11-27, with the code of Unit U3. Not yet performed: it
needs a Release with Unit U3 running in the test environment, and the
Release before it to go back to (reliability design R26; requirement
NFR15.20).

Going back moves the server and the page to the previous Release and leaves
the database and the edge's settings as they are. The previous Release does
not read the `items` table and ignores the two request headers the edge now
passes. `go-back`'s smoke check does not ask for a folder: the Release gone
back to has no folder route.

| What                                                                              | Record |
| --------------------------------------------------------------------------------- | ------ |
| Date of the rehearsal                                                             |        |
| Environment                                                                       | test   |
| Release that was running, with Unit U3 (version)                                  |        |
| Release gone back to (version)                                                    |        |
| Link to the `go-back` run                                                         |        |
| Outcome the run recorded                                                          |        |
| Time from starting the workflow to the passed smoke check (target: 15 minutes)    |        |
| The site worked after going back, with the `items` table and the samples in place |        |
| The page showed the earlier Release's page afterwards (looked at in a browser?)   |        |
| Going back a second time returned to the Release with Unit U3, and it browsed     |        |

# Record: the measured speeds

Template written 2026-11-25. Not yet measured in full: three rows were filled
on 2026-11-27 and the others are marked as owed, with who measures each
(performance design P7). Rows are added through a pull request. These
figures are the baseline every later Unit is compared with.

| Requirement | What is measured                                                                           | Target             | Measured                                                | Date       | How                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR9.1      | 95th of 100 site-information calls, warm (the pipeline's measurement, taken at the caller) | at most 1 second   | 265 ms (middle 126 ms, slowest 278 ms, 0 of 100 failed) | 2026-11-27 | The pipeline's measurement in the test environment for Release `1db1c19`: https://github.com/andrefellipe/virtuosodrive.com/actions/runs/45932874039 |
| NFR9.1      | The same measurement, paced at 8 calls a second (Step 22)                                  | at most 1 second   | 36 ms (middle 28 ms, slowest 52 ms, 0 of 100 failed)    | 2026-11-27 | The pipeline's measurement in the test environment for Release `a525fc6`: https://github.com/andrefellipe/virtuosodrive.com/actions/runs/46031409749 |
| NFR9.1      | The server's own `Duration`, 95th of 100, read from the dashboard for the same minutes     | at most 1 second   | Owed                                                    |            | Not read during the rehearsals                                                                                                                       |
| NFR9.2      | First site-information call after 30 minutes of quiet                                      | at most 5 seconds  | Owed; one observation, see the notes                    |            | To be measured by one call after 30 minutes with no traffic in test                                                                                  |
| NFR9.3      | The page's first load, browser tools throttled to a fast mobile connection                 | as the requirement | Owed                                                    |            | By the maintainer, in a browser                                                                                                                      |
| NFR9.1      | Site information from a real connection in Brazil, 10 calls                                | recorded only      | Owed                                                    |            | By the maintainer, from a connection in Brazil                                                                                                       |
| NFR9.5      | The page's files, compressed (printed by the build)                                        | at most 300 KB     | 75,321 bytes (about 74 KB)                              | 2026-11-27 | `npm run build` on the maintainer's machine, from the page's source as it is in Release `1db1c19`; the build prints the figure                       |

Also checked once by hand: the page in Edge and in the previous version of
each browser.

| Browser and version                             | Looked right (yes/no) | Date |
| ----------------------------------------------- | --------------------- | ---- |
| Owed: Edge, and each browser's previous version |                       |      |

## Notes

What was unexpected, and what was changed because of it.

- **2026-11-27, the two warm figures differ by a factor of seven** (265 ms
  and 36 ms at the 95th). Both were taken from GitHub's runners against the
  same environment, hours apart. Why they differ was not looked into; the
  path between the runner and the edge is the likely cause. The server's
  own `Duration` row, still owed, is the figure that does not depend on the
  caller.
- **2026-11-27, 18:05 UTC, one call after about an hour of quiet answered
  500 after 2.3 seconds.** It was a single call made by hand, not the
  measurement of the NFR9.2 row. The server's log gives the cause: its
  sign-in to the database did not finish inside the 3 seconds the server
  allows for everything it asks of the database in one request. The
  database's own log shows that sign-in took 4.1 seconds; sign-ins there
  usually take 0.2 to 0.5 seconds, and the first after a quiet period took
  between 1.3 and 4.1 seconds in the six hours looked at. The next four
  calls answered 200. Nothing was changed: the NFR9.2 row is to be measured
  first, and the figures brought to the maintainer before any change to the
  server's limit is proposed. The page tries again by itself only after a
  429 or a 503, so a person opening the site at that moment would have been
  shown the could-not-reach view with its "Try again" button. The same
  slowness, much larger, failed a deployment the same day
  (`docs/records/restore.md`).

- **2026-11-27, the measurement tripped the test environment's request
  limit.** The deployment of pull request 21 put Release `9a4fc16` in place
  in test and passed the smoke check and the end-to-end tests; the
  measurement then failed with 9 of 100 calls failed. The API's access log
  showed those 9 answered 429 by the test environment's own limit (10
  requests a second sustained, 20 in a burst). The measurement sent its calls
  one after another with no pause: at the 126 to 212 ms a call took in
  earlier runs that stayed under 10 a second by chance, and in this run a
  call took 29 ms, about 34 a second. The fault was the measurement's, not
  the server's or the limit's. Changed (Unit U1, Step 22): the measurement
  now starts a call no sooner than 125 ms after the previous one started (8
  a second), warm-up calls included; each call's time is still taken from
  its own start, so the pause is not in the figures; a 429 still counts as a
  failure and is reported as such. Neither environment's limit was changed.
  The row above was measured before this change, unpaced; pacing does not
  change what a single call's time means.

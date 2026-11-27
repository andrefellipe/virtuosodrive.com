# Record: the measured speeds

Template written 2026-11-25. Not yet measured in full: two rows were filled on
2026-11-27 and the others are still owed. Fill it in after the first
deployment (performance design P7), and add it through a pull request. These
figures are the baseline every later Unit is compared with.

| Requirement | What is measured                                                                           | Target             | Measured                                                | Date       | How                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR9.1      | 95th of 100 site-information calls, warm (the pipeline's measurement, taken at the caller) | at most 1 second   | 265 ms (middle 126 ms, slowest 278 ms, 0 of 100 failed) | 2026-11-27 | The pipeline's measurement in the test environment for Release `1db1c19`: https://github.com/andrefellipe/virtuosodrive.com/actions/runs/45932874039 |
| NFR9.1      | The server's own `Duration`, 95th of 100, read from the dashboard for the same minutes     | at most 1 second   |                                                         |            |                                                                                                                                                      |
| NFR9.2      | First site-information call after 30 minutes of quiet                                      | at most 5 seconds  |                                                         |            |                                                                                                                                                      |
| NFR9.3      | The page's first load, browser tools throttled to a fast mobile connection                 | as the requirement |                                                         |            |                                                                                                                                                      |
| NFR9.1      | Site information from a real connection in Brazil, 10 calls                                | recorded only      |                                                         |            |                                                                                                                                                      |
| NFR9.5      | The page's files, compressed (printed by the build)                                        | at most 300 KB     | 75,321 bytes (about 74 KB)                              | 2026-11-27 | `npm run build` on the maintainer's machine, from the page's source as it is in Release `1db1c19`; the build prints the figure                       |

Also checked once by hand: the page in Edge and in the previous version of
each browser.

| Browser and version | Looked right (yes/no) | Date |
| ------------------- | --------------------- | ---- |
|                     |                       |      |

## Notes

What was unexpected, and what was changed because of it.

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

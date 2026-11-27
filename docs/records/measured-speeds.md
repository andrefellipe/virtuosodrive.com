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

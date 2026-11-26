# Record: the measured speeds

Template written 2026-11-25. Not yet measured. Fill it in after the first
deployment (performance design P7), and add it through a pull request. These
figures are the baseline every later Unit is compared with.

| Requirement | What is measured                                                                           | Target             | Measured | Date | How |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------ | -------- | ---- | --- |
| NFR9.1      | 95th of 100 site-information calls, warm (the pipeline's measurement, taken at the caller) | at most 1 second   |          |      |     |
| NFR9.1      | The server's own `Duration`, 95th of 100, read from the dashboard for the same minutes     | at most 1 second   |          |      |     |
| NFR9.2      | First site-information call after 30 minutes of quiet                                      | at most 5 seconds  |          |      |     |
| NFR9.3      | The page's first load, browser tools throttled to a fast mobile connection                 | as the requirement |          |      |     |
| NFR9.1      | Site information from a real connection in Brazil, 10 calls                                | recorded only      |          |      |     |
| NFR9.5      | The page's files, compressed (printed by the build)                                        | at most 300 KB     |          |      |     |

Also checked once by hand: the page in Edge and in the previous version of
each browser.

| Browser and version | Looked right (yes/no) | Date |
| ------------------- | --------------------- | ---- |
|                     |                       |      |

## Notes

What was unexpected, and what was changed because of it.

# Performance and Experience Requirements: U3, browsing and selecting

How fast browsing must be, and what it must be like to use: speed (NFR9),
accessibility (NFR6), devices and browsers (NFR7), and the look (NFR8).

Sources: this Unit's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`,
`rules.md` beside it), requirements NFR6 to NFR9
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contracts C1 and C3
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
and the analysis of the old code
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`).

**Numbering.** U1's requirements keep their numbers and still hold. Each
Unit takes its own block of twenty sub-numbers under each heading: U1 has .1
to .19, U3 has .20 to .39, and the Unit built after U3 starts at .40, and so
on in build order. No number means two things.

## Speed

Requirement NFR9 gives one figure: a folder of up to 500 items is listed
within 2 seconds of being opened, on ordinary broadband. It is split here so
that each part can be checked where it arises. The server is in the United
States and the readers in Brazil (U1's decision T1), which takes roughly 0.3
seconds of the 2 for the journey there and back.

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR9.20 | A folder of 500 items is on screen, with every row usable, within 2 seconds of being opened, once the server is warm | The maintainer opens the 500-item sample folder in the test environment five times, from their own broadband connection in Brazil, timing each with the browser's tools. Passes when the middle one of the five is 2 seconds or less. The five figures are recorded. Fails otherwise, and open point 1 applies | NFR9; rules BR1.9 |
| NFR9.21 | The server answers a request for a folder of 500 items within 500 milliseconds, measured at the server, for 95 of 100 requests | 100 requests in a row for the 500-item sample folder in the end-to-end stage. Passes when the 95th of the 100 durations the server reports is 500 milliseconds or less; the pipeline fails otherwise. The figure is recorded | NFR9; split of NFR9.20 |
| NFR9.22 | The number of database statements needed to answer a folder request is fixed: it does not grow with the number of items, nor with how deep the folder is | An integration test counts the statements for a folder of 1 item at depth 1 and of 500 items at depth 6 and finds the same number | NFR9; rules BR1.3 to BR1.6 |
| NFR9.23 | An "unchanged" answer reads no items. It still reads the folder and the folders above it, because "unchanged" may be said only of a folder that is still visible (security requirement NFR3.28) | The same integration test: fewer statements than a full answer, and none that reads the items | rules BR1.8; U5 will ask every few seconds |
| NFR9.24 | The answer for the 500-item sample folder, whose names are of ordinary length (40 characters on average), is no more than 150 kilobytes before compression, and every folder answer is sent compressed. Longer names make a larger answer, which is allowed; the limit that applies to any folder is in scalability requirement NFR11.21 | Integration test on the size of that folder's answer; an end-to-end assertion that the answer arrives compressed | NFR9; contract C3 (no paging) |
| NFR9.25 | The page shows 500 rows, and updates the selection of a range across all of them, without a pause a person would notice: each within 200 milliseconds on a mid-range phone | Measured once by hand with the browser's tools set to a slowed processor, and recorded | NFR9; rules BR4.3 |
| NFR9.26 | The page's files, compressed, still total no more than 300 kilobytes with the list, the breadcrumb, the action bar and the icons added | The existing check on the built files in the pull request (U1's NFR9.5) | NFR9 |
| NFR9.27 | After a quiet period, the first folder request answers within 5 seconds | Carried from U1's NFR9.2: one request after 30 minutes of quiet, by hand, recorded | NFR9 |

Opening a folder shows placeholder rows at once (rules BR3.5), so the reader
is never looking at nothing; the figures above are for the real rows.

"Once the server is warm" is this document's reading of NFR9, which does not
say. The first request after a quiet period is slower by the platform's
nature and has its own figure (NFR9.27), as U1 set for its one call.

The end-to-end tests also fail if the 500-item folder takes more than 4
seconds to appear. That test runs from the pipeline, close to the server, so
it guards against a gross regression only; it says nothing about NFR9.20,
which is judged by the hand measurement from Brazil.

Performance tests as a suite are not part of the first release (team
practices). These are single measurements, recorded in the repository.

## Accessibility

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR6.20 | An automated accessibility scan reports no violation at WCAG 2.1 level AA for the list in each of its views (loading, populated, empty, could not load, not found), with nothing selected and with several rows selected, at 320 and at 1280 pixels wide | The end-to-end test runs the scan in each | NFR6 |
| NFR6.21 | Browsing is completed with the keyboard alone: open "All", move into a folder three levels down, come back by the breadcrumb, select two rows that are not next to each other, select a range, clear the selection | One end-to-end test that uses no pointer; it runs on macOS-style and Windows-style key handling | NFR6; rules BR4.6; AC2.1.5 |
| NFR6.22 | What changes on screen is told to a screen reader without moving the focus: the folder opened and its number of items; the number of rows selected; a selected row that has gone | The end-to-end test reads the polite status line after each; one check by hand with a screen reader | NFR6; rules BR4.5, BR4.8 |
| NFR6.23 | The keyboard focus is always visible, on rows, breadcrumb steps, actions and "Try again"; the check mark and the focus ring each have a contrast of at least 3 to 1 against what is behind them, on a selected and on an unselected row | The scan, and a contrast check recorded with the colours used | NFR6; answer Q3 (changes 1 and 3) |
| NFR6.24 | Everything that can be tapped on a touch device is at least 44 by 44 pixels: tick boxes, actions, breadcrumb steps, "Try again", "Clear" | An end-to-end test measures them at 320 pixels wide | NFR6; rules BR4.7 |
| NFR6.25 | The placeholder rows do not move when the device asks for reduced motion | End-to-end test with that setting on | NFR6; interaction specification |
| NFR6.26 | The list is a table with headings, each row exposes whether it is selected, each icon has a text alternative, and the page's title names the open folder | The scan, and assertions in the end-to-end test | NFR6; rules BR3.2, BR4.5 |

## Devices and browsers

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR7.20 | Browsing and selecting work from 320 pixels wide to a laptop, in Chrome, Firefox, Safari and Edge, current and previous versions | The end-to-end tests run in the Chromium, Firefox and WebKit engines at 320 and 1280 pixels. WebKit stands in for Safari and Chromium for Edge; they are close, not identical, so Safari on a Mac and on an iPhone, Edge, and one previous version of each are also checked by hand once, at the demo, and recorded | NFR7 |
| NFR7.21 | Selection by touch works on a phone: a tick box per row, a tap on a folder's name opens it | An end-to-end test with touch input at 320 pixels wide; once by hand on a real phone, at the demo | NFR7; rules BR4.7 |
| NFR7.22 | At 320 pixels wide nothing is cut off and the page does not scroll sideways, with a name of 255 characters and a path twelve folders deep | End-to-end test with those sample items | NFR7; rules BR3.9 |

## The look

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR8.20 | The list, breadcrumb and action row look as they do today, except for the accepted changes that fall in this Unit (1, 3, 4, 6 and 7) and the two icon corrections named in the design | Comparison by eye with the current site, by the maintainer at the demo | NFR8; answer Q3 |
| NFR8.21 | The icons are the existing files, served with the page; none is fetched from another address | The existing end-to-end check that no outside address is contacted | NFR8; NFR1 |

## What is not required here

- No target for folders above 500 items. They are answered whole (contract C3) and will be slower. Whether such a folder exists is known after the export (U8).
- No target for how quickly another person's change appears; that is U5's (FR7.1).

## Open points

1. **The 2 seconds includes a journey to the United States and back.** If the single measurement fails, the remedies are a larger server setting or a Region nearer the readers, both with a cost; that would be the maintainer's decision.
2. **NFR9.21's 500 milliseconds is this design's split**, not a figure from the requirements. It leaves about 1.2 seconds for the network and the page.

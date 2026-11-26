# Performance and Page Requirements: U1, the thin slice

How fast the thin slice must be, and the qualities its one page must have.
The slice does almost no work, so these targets are less about the slice than
about setting a baseline: if one database read cannot meet them, the real
screens will not.

Sources: the slice's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`,
`rules.md` beside it), requirements NFR6 to NFR9
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
the timeouts in contract C1
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
the old code's stack
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`), and the
answers in `nfr-requirements-questions.md`.

The speed targets were chosen by the designer and confirmed by the maintainer
in the summary; no earlier document set them.

## Speed

NFR9 as written concerns listing a folder of 500 items, which this Unit does
not have. Its details here set the baseline that listing will be built on.

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR9.1 | Once the server is warm, the site-information call answers within 1 second for 95 of 100 requests, measured at the server | 100 requests in a row against the test environment in the end-to-end stage; the figure is recorded | NFR9; summary |
| NFR9.2 | After a period of no use, the first site-information call answers within 5 seconds | One request after at least 30 minutes of quiet, measured by hand once and recorded | NFR9; summary |
| NFR9.3 | The page is usable (name, logo and the status line showing its result) within 3 seconds of opening it on a phone connection, once the server is warm | Measured with the browser's throttling set to a fast mobile connection, once, and recorded | NFR9; summary |
| NFR9.4 | The health check answers within 3 seconds or is treated as failed | Unit test with a delayed database | rules BR1.3 |
| NFR9.5 | The page's files, compressed, total no more than 300 kilobytes | A check on the built files in the pull request | NFR9; designer's choice, to keep NFR9.3 achievable as screens are added |
| NFR9.6 | The page's files are stored by browsers and by the content delivery network for a long time under names that change with their contents; the page's entry document is never stored | Inspection of the response headers in the end-to-end test | NFR9; rules BR6.1 (going back must take effect at once) |

If the database service chosen at Infrastructure Design pauses when idle,
NFR9.2 is the requirement it must be weighed against: a pause that makes the
first request slower than 5 seconds needs the maintainer's agreement.

## Limits the page keeps

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR9.7 | The page gives up on a call after 10 seconds and tries a read up to twice more, pausing 1 second before the second try and 3 seconds before the third | Unit test with a server that does not answer | contract C1; rules BR1.2 |

## The page itself

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR6.1 | An automated accessibility scan of the page, in its checking, success and could-not-reach views, reports no violation at WCAG 2.1 level AA | The end-to-end test runs the scan in each view | NFR6 |
| NFR6.2 | The status line's change (checking, answered, could not reach) is announced to a screen reader, and "Try again" is reachable and usable by keyboard | The end-to-end test checks the live region and operates the control by keyboard; one check by hand with a screen reader | NFR6 |
| NFR7.1 | The page works from 320 pixels wide to a laptop, in the current and previous versions of Chrome, Firefox, Safari and Edge | The end-to-end test runs in Chromium, Firefox and WebKit at 320 and 1280 pixels wide; Edge and the previous versions are checked by hand once | NFR7 |
| NFR8.1 | The page uses the existing logo and favicon and the existing header's look; it adds nothing to the look but the status, version and environment lines | Comparison by eye with the current site's header, by the maintainer at the demo | NFR8 |

## Open points

1. **Edge and previous browser versions** are checked by hand, not automatically; an automated check would need a paid service or more pipeline time.
2. **NFR9.2 and NFR9.3 are measured once by hand**, like NFR9 itself. They are not watched continuously.

# Scalability and Cost Requirements: U3, browsing and selecting

How much browsing must cope with, and what it may cost (NFR11).

Sources: this Unit's design
(`aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/functional-design/functional-spec.md`,
`rules.md` beside it), requirements NFR9 and NFR11
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`),
contracts C3 and C9
(`aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`),
and the analysis of the old code
(`aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md`).

U1's limits still hold: at most 50 requests a second at the entry point, at
most 20 copies of the server in production and 5 in test, and one database
connection per copy. U3's own requirements are numbered from .20.

**The ceiling is US$60 a month.** Requirement NFR11 and the team's practices
say US$50. The maintainer raised it to US$60 at U1's infrastructure step
(answer Q3 there), when the estimate for two environments came to between
US$46.60 and US$50.20. The later decision holds; the two earlier documents
were not edited.

## What is expected

The old site is used by tens of students. How many folders and files it
holds is not known until the export (U8). These are the working assumptions;
each is checked again when the export is read.

| Quantity | Assumed | Designed and tested for | Guaranteed to work, slower | Beyond that |
|----------|---------|-------------------------|----------------------------|-------------|
| Items in one folder | Tens | 500 | 4,000 | Depends on the length of the names; see NFR11.21 |
| Items in total | A few thousand | 50,000 | No fixed limit | |
| Depth of folders | Up to 6 | 12 | 64 | Treated as damaged data |
| Readers at the same moment | Under 10 | 30 | The entry point's limit | Refused by the entry point |

## How large one answer can be

The whole list is one answer (contract C3). The server's platform refuses an
answer larger than 6 megabytes. One row is its identifier, kind, name, size
and content type:

| Kind of row | Size of the row in the answer |
|-------------|-------------------------------|
| Typical: a name of about 40 characters | About 200 bytes |
| Worst: a name of 255 characters, each needing four bytes | About 1,300 bytes |

So 500 typical rows are about 100 kilobytes, and 500 worst rows about 650.
Six megabytes hold about 30,000 typical rows, or about 4,500 worst ones.

## Requirements

| ID | Requirement | Checked by | From |
|----|-------------|-----------|------|
| NFR11.20 | The cost of answering a folder depends on what is in that folder and how deep it is, never on how many items the site holds in total | Inspection of how the database finds a folder's items and its parents, recorded once with a database of 50,000 items; the statement count of performance requirement NFR9.22 | NFR11; NFR9 |
| NFR11.21 | A folder of up to 4,000 items is answered whole and shown, whatever its names. The server measures each answer before sending it; one that would pass 5 megabytes is not sent, the request fails as a server fault, and the log entry names the folder and says "too large". No folder fails in a way the logs do not explain | Integration test with 4,000 items whose names are 255 four-byte characters: the answer is sent and is under 6 megabytes. Unit test of the refusal with an answer built to pass 5 megabytes. A page test that 4,000 rows are shown | NFR11; contract C3 (no paging) |
| NFR11.22 | U3 creates no new AWS resource that is charged by the month, and no new measurement series (see `observability-requirements.md`: its counts are fields in the log, not series). The cost estimate of both environments is unchanged by it | The infrastructure step shows no new line; if it would add one, the maintainer is asked first | NFR11; U1's NFR11.1 |
| NFR11.23 | Browsing opens no more database connections than U1 allowed: one per running copy, reused | The existing integration test of connection reuse, with folder requests | NFR11; U1's NFR11.5 |
| NFR11.24 | The sample content is small: at most 1,000 items in total and no stored contents in U3, so that loading it adds seconds, not minutes, to a deployment and nothing measurable to the bill | The loader's summary in the deployment's output | NFR11; rules BR2.10 |
| NFR11.25 | Many readers opening the same folder do not slow each other: reading never waits for a change, and no reader holds anything another needs | Integration test: 20 folder requests at once while a change to that folder is held open; all answer | NFR11; rules BR2.11 |
| NFR11.26 | **Binding on U5.** Before U5 builds the re-asking that contract C3 describes, its own design states what that asking costs a month at 5, 30 and 100 readers, using the figures below, and the maintainer accepts the interval and the cost. U3 hands U5 the means to keep it low: an "unchanged" answer that reads no items, and a log field that tells those answers apart | U5's cost estimate exists and is accepted before its code plan | NFR11 |

## The figures behind NFR11.26

Contract C3 has the page ask every 3 seconds. Thirty readers on the page
around the clock would make 10 requests a second: inside the entry point's
limit of 50, but about 26 million requests in a month. Every request passes
three charged services, because the server's calls go through the same
content delivery network as the page (U1's design):

| Charged for | Rate (U1's price list, us-east-1) | For 26 million requests |
|-------------|-----------------------------------|-------------------------|
| The entry point (HTTP API) | US$1.00 a million | About US$26 |
| The server (Lambda), requests | US$0.20 a million | About US$5 |
| The server (Lambda), running time | By duration and memory; an "unchanged" answer is short | A few dollars |
| The content delivery network (CloudFront), requests | About US$1.00 a million from North American locations; more from South American ones, which is where the readers are | US$26 or more |

That is US$60 or more a month for the asking alone, against a ceiling of
US$60 for everything. Real use is far below 30 readers around the clock, but
the cost grows with readers and with time spent on the page, not with
changes. The CloudFront rate was not in U1's price list and is quoted from
memory of the public price; U5 must look it up.

## Open points

1. **A folder beyond about 4,000 items with long names, or about 30,000 with ordinary ones, cannot be listed** without paging, which contract C3 rules out. If the export shows one, the contract changes or the folder is split during migration; either is the maintainer's decision at U8. Until then such a folder fails with a logged reason (NFR11.21), it does not fail silently.
2. **The assumed quantities are guesses** until the export.

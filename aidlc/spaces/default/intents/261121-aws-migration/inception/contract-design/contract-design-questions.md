# Contract Design: Questions

This step fixes the agreements across boundaries: what the page asks the
server for and what it gets back, and what the pieces of the server side ask
of each other. It builds on the nine Units
(`aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`
and `unit-of-work-dependency.md`), the building blocks
(`aidlc/spaces/default/intents/261121-aws-migration/inception/domain-design/components.md`)
and the requirements
(`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`).

## Q1. What your documents already answer

`aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md` already
sets the style of the interface between the page and the server. Confirm these
once instead of answering each.

- What style is the interface? REST over HTTPS, exchanging JSON. (`technical-environment.md`: "Style: REST over HTTPS, JSON")
- How are versions told apart? By the path, starting at `/v1/`. (`technical-environment.md`: "Versioning: URL path (`/v1/...`)")
- How is it documented? As an OpenAPI 3 description kept in the repository and checked in the pipeline. (`technical-environment.md`: "Documentation: OpenAPI 3.x, kept in the repository and checked in the pipeline")
- How are things named? Paths in kebab-case, JSON fields in camelCase. (`technical-environment.md`: "Naming: kebab-case paths, camelCase JSON fields")
- How are errors reported? In the Problem Details format. (`technical-environment.md`: "Errors: Problem Details (`application/problem+json`)")
- How do file contents travel? Straight between the browser and storage through short-lived links issued by the server, never through the server itself. (`technical-environment.md`: "uploads and downloads through pre-signed URLs")

A. All correct
B. Some need changing (say which and how)
X. Other (please specify)

[Answer]: A

## Q2. [Developer] Who is the interface for?

This decides how careful the project must be about changing it later. If only
this site's own pages use it, the page and the server always change together
and nothing outside can break. If others may build on it, every change has to
stay compatible with programs you do not control.

A. Only this site's own pages. It is not offered to anyone else, and may change whenever the page changes with it
B. Also open to others (for example a student writing a script to download a whole folder); changes must stay compatible
C. Not yet decided
X. Other (please specify)

[Answer]: A

## Q3. [Developer] How does the open folder learn that someone changed it?

The list must update by itself within 5 seconds (requirement FR7.1). There are
two ways to do it, and your `technical-environment.md` leaves the choice open.
Asking repeatedly is simple to build, test and reason about, and every open
page costs one small request every few seconds. A pushed message arrives at
once and costs nothing while nothing changes, but needs a standing connection,
which is more to build and learn and has more ways to fail.

A. The page asks every 3 seconds whether the open folder has changed, and fetches the list only when it has
B. The server pushes a message over a standing connection as soon as something changes
C. Decide for me, and explain the choice so I can change it at approval
X. Other (please specify)

[Answer]: C. Left to the architect, who chose A: the page asks every 3 seconds. It meets the 5-second requirement with margin, is the simpler thing for one person to build, test and debug, and needs no standing connection; a pushed message can replace it later without changing the rest.

## Consolidated Summary Confirmation

- Interface style (Q1): as in `technical-environment.md`. REST over HTTPS with JSON; versions by path from `/v1/`; described in OpenAPI 3 in the repository; kebab-case paths and camelCase fields; errors as Problem Details; file contents travel straight between the browser and storage through short-lived links.
- Audience (Q2): only this site's own pages. The interface is not offered to anyone else and may change whenever the page changes with it.
- Live list (Q3): left to me, and I chose that the page asks every 3 seconds whether the open folder has changed, and fetches the list only when it has.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

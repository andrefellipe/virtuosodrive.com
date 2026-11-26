# Design System Mapping: Virtuoso Drive on AWS

The look stays as it is (requirement NFR8 in
`aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`).
This document records what "as it is" consists of, and which existing style
each new element in `mockups.md` uses, so that nothing new is invented where
something existing will do. It refines the sketches in
`aidlc/spaces/default/intents/261121-aws-migration/ideation/rough-mockups/wireframes.md`
and the journeys in `user-flow.md` beside it, for the stories in
`aidlc/spaces/default/intents/261121-aws-migration/inception/user-stories/stories.md`.

## The existing design system

There is no documented design system. The look comes from two things, read
from `app/public/index.html` and `app/public/css/style.css`:

- **Bootstrap 4.3.1**, loaded today from a public CDN. Under the project's rules it must be bundled with the site instead; the look does not change.
- **A small stylesheet** of the site's own, 87 lines.

### Values in use today

| Token | Value | Where |
|-------|-------|-------|
| Text and links | `#000` on `#FFF`, links not underlined | `style.css` lines 9 to 16 |
| Selected row | background `#99F0FA` | line 68 |
| Progress bar | `#0454A0` on `#DDD`, 2 pixels high | lines 27 to 36 |
| Dividers | `#CCC`, 1 pixel, dashed under the actions and solid under the table head | lines 38 to 41, 63 to 65 |
| Breadcrumb | Bootstrap's, with a white background | lines 18 to 20 |
| Font | "Helvetica", from a bundled file | lines 1 to 2, 84 to 87 |
| Icons | SVG files, 40 by 40 pixels, beside action labels and in rows | `app/public/images/icons/` |
| Layout | Bootstrap `container`, actions in a `row` of `col-md` | `index.html` |
| Text selection | Switched off for the whole page | lines 3 to 6 |

## Mapping of every element

| Element in the mockups | Existing style to use | New? |
|------------------------|-----------------------|------|
| Header with logo | Existing centred logo block | No |
| Sign in / Sign out control | Bootstrap small outline button, placed top right of the header block | New element, existing style |
| Display name | Body text | New element, existing style |
| Breadcrumb | Existing | No |
| Action row | Existing `action-button` layout and icons; the links become buttons that look the same | Same look, different element |
| List | Existing borderless table | No |
| "Changed by" column | Same table cell style as Size | New column, existing style |
| Selected row | Existing `#99F0FA`, plus a check mark icon in the first cell | Existing, one addition |
| Row tick box (touch) | Bootstrap custom checkbox | New element, existing style |
| Status line above the list | Bootstrap small muted text | New element, existing style |
| Failure and warning lines | Bootstrap `alert` in its light variants, with a text prefix such as "Not sent:" | New element, existing style |
| Dialogs | Bootstrap modal | New element, existing style; replaces the browser's own prompt, confirm and alert boxes |
| Form fields, labels, hints, errors | Bootstrap form group, with `invalid-feedback` for errors | New element, existing style |
| Buttons in dialogs | Bootstrap buttons: primary for the main action, secondary for Cancel, danger for Delete, Disable and Remove account | New element, existing style |
| Progress bar | Existing colours, 8 pixels high | Existing, one change |
| Placeholder rows | Table rows with a `#DDD` block | New element, existing colour |
| Maintainer tabs | Bootstrap nav tabs | New element, existing style |
| Maintainer tables | Same borderless table | New element, existing style |
| Notice page on the old site | Logo block and body text | New page, existing style |

New icons needed, in the style of the existing set: a check mark for selected
rows. The existing `video.svg`, never used today, is used for video files.
The licence and origin of the existing icons, logo and font are not recorded
in the repository (finding TD-08 of the code analysis); this needs the
maintainer's attention before the font file is bundled again.

## Contrast of the existing colours

Calculated by hand from the values above, using the WCAG formula. They should
be confirmed with a contrast checker when the screens are built.

| Pair | Ratio | Needed | Result |
|------|-------|--------|--------|
| Black text on white | 21 : 1 | 4.5 : 1 | Passes |
| Black text on the selected row `#99F0FA` | about 16 : 1 | 4.5 : 1 | Passes |
| Selected row `#99F0FA` against white | about 1.3 : 1 | 3 : 1 if it were the only sign of selection | Fails alone; passes with the added check mark |
| Progress bar `#0454A0` on `#DDD` | about 5.6 : 1 | 3 : 1 | Passes |
| Breadcrumb current step, Bootstrap grey `#6C757D` on white | about 4.7 : 1 | 4.5 : 1 | Passes, narrowly |
| Dividers `#CCC` on white | about 1.6 : 1 | None; decorative | Not applicable |
| Bootstrap primary button, white on `#007BFF` | about 4.0 : 1 | 4.5 : 1 | Fails |
| Bootstrap danger button, white on `#DC3545` | about 4.5 : 1 | 4.5 : 1 | Borderline |

The last two concern buttons that do not exist on today's page, so darkening
them changes nothing a student sees now. Proposed: use the site's own blue
`#0454A0` (white text on it is about 7.9 : 1) for primary buttons, and a
darker red for danger buttons.

## Changes to the look, all for accessibility

NFR8 allows a colour to change only where accessibility requires it. These
are every departure from today's look, for the maintainer to accept or refuse:

| # | Change | Why | Visible to today's users? |
|---|--------|-----|---------------------------|
| 1 | A check mark at the start of each selected row | Selection must not rest on colour alone, and the highlight has too little contrast with white to do so | Slightly |
| 2 | The progress bar is 8 pixels high instead of 2 | A 2-pixel bar is hard to see | Slightly |
| 3 | A visible focus ring on every control and row | Keyboard users must see where they are; today rows cannot be focused at all | Only when using the keyboard |
| 4 | Text on the page can be selected again | Today selection is switched off page-wide, which stops people copying a file name; it also interferes with some assistive tools | No |
| 5 | Dialogs in the site's style replace the browser's own boxes | The browser's boxes cannot show an error beside a field | Yes: New Folder, Rename and Delete look different |
| 6 | Action links become buttons with the same appearance | Links that go nowhere are announced wrongly | No |
| 7 | Primary buttons use `#0454A0` | Bootstrap's default blue fails contrast with white text | No: these buttons are new |

Changes 1, 2 and 5 are the ones a returning student would notice.

## Responsive behaviour

| Width | Layout |
|-------|--------|
| Below 768 pixels | Phone: header on one line; breadcrumb shortened; actions two to a line; list rows stacked; tick boxes; dialogs full width; maintainer tables as cards |
| 768 pixels and above | Laptop: as today, with the additions |

768 pixels is Bootstrap's `md` breakpoint, which the existing action row
already uses. The smallest supported width is 320 pixels. No sideways
scrolling at any width, and the page works zoomed to 200%.

## Not part of the design system

- The sign-in service's own hosted pages are not used; the account screens are built here (answer Q3 in `refined-mockups-questions.md`). The planning document `technical-environment.md` expected hosted pages, so this is a change for the design stages to take in.
- jQuery, Popper and Bootstrap's scripts are loaded today and not used. Whether Bootstrap's scripts are needed for the dialogs, or the dialogs are built without them, is a design decision.

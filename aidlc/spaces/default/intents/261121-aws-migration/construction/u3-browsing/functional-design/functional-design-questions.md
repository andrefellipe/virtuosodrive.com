# Functional Design Questions: U3, browsing and selecting

Four decisions are needed before U3 is designed. The first two are the
condition the build order rests on
(`aidlc/spaces/default/intents/261121-aws-migration/inception/delivery-planning/bolt-plan.md`,
"The order holds on one condition"). The third has been open since the
refined mockups. Everything else is settled by the stories, the requirements
and contracts C3 and C9, or is a design decision recorded in the design
itself.

To answer here instead of in chat, write the letter after `[Answer]:`.

## Q1: "Changed by" in the list

Contract C3 lets each row carry who last changed the item, shown to signed-in
visitors. That needs accounts (U2), which your build order places after U3.
`unit-of-work.md` already gives "changed by" to U6.

- A. Leave it to U6 (Recommended). U3's list carries no "changed by". The records keep an empty place for it, so nothing has to be reshaped later. Your build order stands.
- B. Add it in U3. Browsing then depends on accounts, and the order becomes U1, U2, U3, U4, U8, U5, U6, U7, U9: the migration moves from fourth to fifth.
- X. Other (please specify)

[Answer]: A

## Q2: Sample files before downloading exists

Contract C9 says a file always points at stored contents, and stored contents
belong to U4, which comes after U3. U3 is shown working with prepared sample
content.

- A. Sample files without contents until U4 (Recommended). In U3 a file may have no stored contents; such a file is listed but cannot be downloaded. U4 adds stored contents, gives the samples real ones, and from then on every file must have them. The delivery plan already expects this ("the stored-content record that Bolt 2 left as a stand-in").
- B. Build U3 and U4 together as one piece of work. No stand-in, but a larger first feature and a later first demo.
- C. Move the stored-content record into U3. Changes contract C10's owner; U4 then only adds the download links.
- X. Other (please specify)

[Answer]: A

## Q3: The seven changes to the look

`aidlc/spaces/default/intents/261121-aws-migration/inception/refined-mockups/design-system-mapping.md`
proposes seven departures from today's look, all for accessibility: (1) a
check mark on selected rows; (2) a taller progress bar; (3) a visible focus
ring; (4) text can be selected again; (5) dialogs in the site's style replace
the browser's boxes; (6) action links become buttons that look the same; (7)
a darker blue for primary buttons. A returning student would notice 1, 2 and
5. U3 builds 1, 3, 4, 6 and 7; change 2 belongs to uploading (U7) and change
5 to organising (U6).

- A. Accept all seven (Recommended). The accessibility requirement (WCAG 2.1 AA) cannot be met without 1, 3, 6 and 7, and later Units will not have to ask again.
- B. Accept the five that U3 builds (1, 3, 4, 6, 7) and decide 2 and 5 when uploading and organising are designed.
- X. Other (please specify)

[Answer]: A

## Q4: Where the sample content lives

U3 has nothing real to show until the migration (U8). You decided earlier
that production is emptied of content before the migration.

- A. Test environment only (Recommended). The pipeline loads the sample folders and files into the test environment. Production shows an empty "All" until the migration, and its smoke check expects exactly that.
- B. Both environments. Production also shows the samples, and they are removed when production is emptied before the migration.
- X. Other (please specify)

[Answer]: A

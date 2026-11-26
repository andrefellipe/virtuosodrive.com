-- Up Migration

-- The one record the thin slice reads (entities: SiteInformation).
-- Reading it proves that database changes are applied and that the database answers.
-- "id" is constrained to the value 1, so exactly one row can exist.
CREATE TABLE site_information (
  id smallint PRIMARY KEY CONSTRAINT site_information_single_row CHECK (id = 1),
  installed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_information (id) VALUES (1);

-- The running site only reads this record; it never changes or removes it.
GRANT SELECT ON site_information TO app;

-- Way back: none is run. Database changes only add (rules BR6.3) and are never
-- undone when going back; the previous version of the site does not read this
-- table and keeps working with it present. To remove it, a later change drops
-- it once no version in reach reads it (roll-forward).

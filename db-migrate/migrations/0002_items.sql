-- Up Migration

-- Folders and files, in one table with a kind (entities: Folder, File;
-- decision T24). Every rule is held by the table's own structure, with no
-- trigger (T27), and every rule has a name of its own: when the database
-- refuses a write, the code reads that name and never the message
-- (reliability design R21).
--
-- Two columns are derived by the database and never written:
--   parent_kind  always 'folder', so that the pair (parent_id, parent_kind)
--                can only refer to an item that exists AND is a folder;
--   name_key     the name folded for comparison, one character with one
--                character, by the built-in "pg_c_utf8" rules named
--                explicitly, so that no setting of the server changes it.
--                The column is also compared and ordered by those rules
--                (plain code points), not by the server's language setting:
--                with that setting, the index on it took about 12
--                milliseconds for each name of 255 four-byte characters.
CREATE TABLE items (
  id uuid DEFAULT gen_random_uuid() CONSTRAINT items_pkey PRIMARY KEY,
  kind text NOT NULL,
  parent_id uuid,
  parent_kind text GENERATED ALWAYS AS ('folder') STORED,
  name text NOT NULL,
  name_key text COLLATE "pg_c_utf8" GENERATED ALWAYS AS (casefold(name COLLATE "pg_c_utf8")) STORED,
  position integer,
  version integer DEFAULT 1,
  size bigint,
  content_type text,
  content_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_changed_at timestamptz,
  last_changed_by_account_id uuid,
  deleted_at timestamptz,
  deleted_by_account_id uuid,
  deleted_reason text,
  brought_over boolean NOT NULL DEFAULT false,
  source_key text,

  CONSTRAINT items_kind_known CHECK (kind IN ('folder', 'file')),
  -- So that another row can refer to "this item, which is a folder".
  CONSTRAINT items_id_kind_unique UNIQUE (id, kind),
  -- The parent exists and is a folder.
  CONSTRAINT items_parent_is_a_folder FOREIGN KEY (parent_id, parent_kind) REFERENCES items (id, kind),
  CONSTRAINT items_not_its_own_parent CHECK (parent_id <> id),
  -- The one item without a parent is a folder, is named "All", and is never deleted.
  CONSTRAINT items_top_folder_stays CHECK (
    parent_id IS NOT NULL OR (kind = 'folder' AND name = 'All' AND deleted_at IS NULL)
  ),

  -- BEGIN generated name checks (scripts/src/name-characters.ts)
  -- Lists taken from Unicode 18.0. Do not edit: see the script.
  CONSTRAINT items_name_composed CHECK (name IS NFC NORMALIZED),
  CONSTRAINT items_name_length CHECK (char_length(name) BETWEEN 1 AND 255),
  CONSTRAINT items_name_not_dots CHECK (name NOT IN ('.', '..')),
  CONSTRAINT items_name_no_forbidden_character CHECK (name !~ '[/\u0001-\u001F\u007F-\u009F\u00AD\u0600-\u0605\u061C\u06DD\u070F\u0890-\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB\U000110BD\U000110CD\U00013430-\U0001343F\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0001\U000E0020-\U000E007F]'),
  CONSTRAINT items_name_no_white_space_at_ends CHECK (name !~ '^[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000]' AND name !~ '[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000]$'),
  -- END generated name checks

  -- A place in the parent's list, given once; only the top folder has none.
  CONSTRAINT items_position_present CHECK (
    (parent_id IS NULL AND position IS NULL)
    OR (parent_id IS NOT NULL AND position IS NOT NULL AND position >= 1)
  ),
  -- Unique within a parent, deleted items included. This index is also how a
  -- folder's list is read, already in order (scalability design C20).
  CONSTRAINT items_position_unique_in_folder UNIQUE (parent_id, position),

  CONSTRAINT items_version_for_folders_only CHECK (
    (kind = 'folder' AND version IS NOT NULL AND version >= 1)
    OR (kind = 'file' AND version IS NULL)
  ),
  CONSTRAINT items_size_for_files_only CHECK (
    (kind = 'file' AND size IS NOT NULL AND size >= 0)
    OR (kind = 'folder' AND size IS NULL)
  ),
  CONSTRAINT items_file_fields_for_files_only CHECK (
    kind = 'file' OR (content_type IS NULL AND content_id IS NULL AND deleted_reason IS NULL)
  ),
  CONSTRAINT items_deleted_reason_known CHECK (deleted_reason IN ('deleted', 'replaced')),
  -- A file has a reason exactly when it has a deletion mark.
  CONSTRAINT items_deleted_reason_with_deletion CHECK (
    kind = 'folder' OR ((deleted_at IS NULL) = (deleted_reason IS NULL))
  ),
  -- Where a loaded item came from; unique when present.
  CONSTRAINT items_source_key_unique UNIQUE (source_key)
);

-- At most one item has no parent (rules BR2.3).
CREATE UNIQUE INDEX items_one_top_folder ON items ((parent_id IS NULL)) WHERE parent_id IS NULL;

-- Among the items of one folder that are not deleted, no two names are the
-- same (rules BR2.6). Also what the name check reads through.
CREATE UNIQUE INDEX items_name_unique_in_folder ON items (parent_id, name_key) WHERE deleted_at IS NULL;

-- The top folder exists from the first moment the table does: same
-- transaction (reliability design R24). Its version starts at 1.
INSERT INTO items (kind, name) VALUES ('folder', 'All');

-- The running site only reads (security design S25). The Unit that adds the
-- first change route gives it the right to write, not this one.
GRANT SELECT ON items TO app;

-- Way back: none is run. Database changes only add (U1's rules BR6.3); a
-- Release that does not read this table keeps working with it present. To
-- remove it, a later change drops it once no Release in reach reads it.

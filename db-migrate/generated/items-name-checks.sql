  -- BEGIN generated name checks (scripts/src/name-characters.ts)
  -- Lists taken from Unicode 18.0. Do not edit: see the script.
  CONSTRAINT items_name_composed CHECK (name IS NFC NORMALIZED),
  CONSTRAINT items_name_length CHECK (char_length(name) BETWEEN 1 AND 255),
  CONSTRAINT items_name_not_dots CHECK (name NOT IN ('.', '..')),
  CONSTRAINT items_name_no_forbidden_character CHECK (name !~ '[/\u0001-\u001F\u007F-\u009F\u00AD\u0600-\u0605\u061C\u06DD\u070F\u0890-\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB\U000110BD\U000110CD\U00013430-\U0001343F\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0001\U000E0020-\U000E007F]'),
  CONSTRAINT items_name_no_white_space_at_ends CHECK (name !~ '^[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000]' AND name !~ '[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u3000]$'),
  -- END generated name checks

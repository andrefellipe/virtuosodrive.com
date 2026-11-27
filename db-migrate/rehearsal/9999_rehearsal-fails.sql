-- Up Migration

-- NOT a database change of the site. This file is outside migrations/ on
-- purpose and is applied only when the test environment's switch
-- "failing_change" is on, to rehearse a deployment that fails at the database
-- changes (docs/operations.md, procedure 9). Its one statement fails at once
-- and changes nothing, so it is never recorded as applied.
DO $rehearsal$
BEGIN
  RAISE EXCEPTION 'Rehearsal: this database change fails on purpose and changes nothing';
END
$rehearsal$;

-- Creates the two database users of an environment. Run once, by the change
-- runner, with the master sign-in, only when signing in as "migrator" shows
-- that the users do not exist yet (a new environment).
--
-- Both sign in by AWS identity (the role "rds_iam" is provided by Amazon RDS);
-- neither has a password.
--
--   migrator  owns the structure: it creates and changes tables.
--   app       reads and writes rows, as far as each database change grants;
--             it cannot change the structure.
--
-- This file is not a database change: it sits in a sub-folder, which the
-- tool that applies changes does not read.

CREATE ROLE migrator WITH LOGIN;
CREATE ROLE app WITH LOGIN;

GRANT rds_iam TO migrator;
GRANT rds_iam TO app;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO migrator;
GRANT USAGE ON SCHEMA public TO app;

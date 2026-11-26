import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import { applyMigrations } from "../apply-migrations.ts";
import { CREATE_USERS_FILE, MIGRATIONS_DIR } from "../paths.ts";

/**
 * A real PostgreSQL in a container for integration tests. The database is
 * never replaced by a stand-in. It runs with TLS on, using a certificate made
 * inside the container for the test, so the server's certificate check is
 * exercised as it is against Amazon RDS.
 */

/** Pinned to the major version the environments run. */
export const POSTGRES_IMAGE = "postgres:18.1";
const DATABASE_NAME = "virtuoso";
const MASTER_USER = "postgres";
const CERT_FILE = "/tmp/vd-server.crt";
const KEY_FILE = "/tmp/vd-server.key";

const MAKE_CERTIFICATE = [
  "openssl req -new -x509 -days 2 -nodes",
  "-subj /CN=localhost",
  "-addext subjectAltName=DNS:localhost,IP:127.0.0.1",
  `-keyout ${KEY_FILE} -out ${CERT_FILE}`,
].join(" ");

const TLS_FLAGS = `-c ssl=on -c ssl_cert_file=${CERT_FILE} -c ssl_key_file=${KEY_FILE}`;

// PostgreSQL is not the container's first process: when a test stops it (an
// outage), the container and its port stay, so the same address works again
// once it is started.
const START_WITH_TLS = [
  `${MAKE_CERTIFICATE} 2>/dev/null`,
  `chown postgres:postgres ${KEY_FILE} ${CERT_FILE}`,
  `chmod 600 ${KEY_FILE}`,
  `(docker-entrypoint.sh postgres ${TLS_FLAGS}; sleep infinity)`,
].join(" && ");

export type DatabaseUser = "app" | "migrator" | "master";

export interface TestDatabaseOptions {
  /** Create the users "app" and "migrator". Default: true. */
  createUsers?: boolean;
  /** Apply the Unit's SQL files as "migrator". Default: true. */
  migrate?: boolean;
}

export interface TestDatabase {
  host: string;
  port: number;
  database: string;
  /** The certificate the database presents; trust this to connect. */
  caCertificate: string;
  /** A certificate unrelated to the database, for "wrong authority" tests. */
  unrelatedCaCertificate: string;
  passwords: Record<DatabaseUser, string>;
  /** Opens a connection as the given user. The caller ends it. */
  connect(user: DatabaseUser): Promise<Client>;
  /** Stops the database without removing it, as an outage would. */
  pause(): Promise<void>;
  /** Starts it again after pause(). The port stays the same. */
  resume(): Promise<void>;
  /** Stops and removes the container. */
  stop(): Promise<void>;
}

function randomSecret(): string {
  return randomBytes(18).toString("hex");
}

function userName(user: DatabaseUser): string {
  return user === "master" ? MASTER_USER : user;
}

async function readFromContainer(
  container: StartedPostgreSqlContainer,
  command: string[],
): Promise<string> {
  const result = await container.exec(command);
  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed in the database container (${command[0]}): ${result.output}`,
    );
  }
  return result.output;
}

/**
 * Gives a user a password for the test. Amazon RDS has no passwords for these
 * users (they sign in by AWS identity); the container cannot check AWS
 * identities, so the test's "sign-in token" is a password. The statement is
 * assembled by PostgreSQL's own format() with %I and %L, never by joining text
 * here.
 */
export async function giveTestPassword(
  master: Client,
  user: string,
  password: string,
): Promise<void> {
  // A user that does not exist yet is left alone: nothing to give a password to.
  const built = await master.query<{ statement: string }>(
    "SELECT format('ALTER ROLE %I PASSWORD %L', rolname, $2::text) AS statement FROM pg_roles WHERE rolname = $1",
    [user, password],
  );
  const statement = built.rows[0]?.statement;
  if (statement !== undefined) {
    await master.query(statement);
  }
}

export async function startPostgres(
  options: TestDatabaseOptions = {},
): Promise<TestDatabase> {
  const createUsers = options.createUsers ?? true;
  const migrate = options.migrate ?? true;
  const passwords: Record<DatabaseUser, string> = {
    master: randomSecret(),
    app: randomSecret(),
    migrator: randomSecret(),
  };

  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase(DATABASE_NAME)
    .withUsername(MASTER_USER)
    .withPassword(passwords.master)
    .withEntrypoint(["sh", "-c", START_WITH_TLS])
    .withCommand([])
    .start();

  const caCertificate = await readFromContainer(container, ["cat", CERT_FILE]);
  const unrelatedCaCertificate = await readFromContainer(container, [
    "sh",
    "-c",
    "openssl req -new -x509 -days 2 -nodes -subj /CN=unrelated -keyout /dev/null 2>/dev/null",
  ]);

  const database: TestDatabase = {
    host: container.getHost(),
    port: container.getPort(),
    database: DATABASE_NAME,
    caCertificate,
    unrelatedCaCertificate,
    passwords,
    async connect(user) {
      const client = new Client({
        host: database.host,
        port: database.port,
        database: DATABASE_NAME,
        user: userName(user),
        password: passwords[user],
        ssl: { ca: caCertificate, rejectUnauthorized: true },
      });
      await client.connect();
      return client;
    },
    async pause() {
      await readFromContainer(container, [
        "gosu",
        "postgres",
        "pg_ctl",
        "stop",
        "-m",
        "immediate",
        "-w",
      ]);
    },
    async resume() {
      await readFromContainer(container, [
        "gosu",
        "postgres",
        "sh",
        "-c",
        `pg_ctl start -w -l /tmp/vd-postgres.log -o "${TLS_FLAGS}"`,
      ]);
    },
    async stop() {
      await container.stop({ timeout: 0 });
    },
  };

  if (createUsers) {
    const master = await database.connect("master");
    try {
      // Amazon RDS provides this role; a plain PostgreSQL does not have it.
      await master.query("CREATE ROLE rds_iam NOLOGIN");
      await master.query(await readFile(CREATE_USERS_FILE, "utf8"));
      await giveTestPassword(master, "app", passwords.app);
      await giveTestPassword(master, "migrator", passwords.migrator);
    } finally {
      await master.end();
    }
  }

  if (createUsers && migrate) {
    const migrator = await database.connect("migrator");
    try {
      await applyMigrations(migrator, MIGRATIONS_DIR, () => undefined);
    } finally {
      await migrator.end();
    }
  }

  return database;
}

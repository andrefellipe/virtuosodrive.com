import { isSignInRefusal } from "./decide.ts";

/**
 * The change runner's sign-in to the database, patient enough for a database
 * that is slow to check an AWS identity.
 *
 * Measured on 2026-11-27: a restored copy that had never been signed in to
 * by AWS identity spent 19.2 seconds on that check, and the first sign-in to
 * the first database after a quiet period took 1.3 to 4.1 seconds. The limit
 * used to be 10 seconds, with one try.
 *
 * One try is everything from fresh credentials to an open connection. A try
 * that fails for any reason but a refusal is followed by exactly one more. A
 * refusal (the database answered, and said no) is passed on at once: it is
 * what tells the runner that this may be a new environment without users,
 * and waiting would not change the answer.
 *
 * This file knows nothing of the database driver or of AWS; what it needs is
 * passed in, so that it is tested without a database or a network.
 */

/**
 * How long one try may take to open its connection. Two tries are a little
 * over 60 seconds at worst; the function's own limit is 300.
 */
export const SIGN_IN_TRY_LIMIT_MS = 30_000;

export interface Credentials {
  user: string;
  password: string;
}

/** A connection that has been made but not yet opened. */
export interface OpeningConnection {
  connect(): Promise<unknown>;
  end(): Promise<void>;
}

export interface SignInOptions<Connection extends OpeningConnection> {
  /** Who is signing in, for the log line only. */
  who: string;
  /** Asked once per try, so that each try has a fresh sign-in token. */
  getCredentials(): Promise<Credentials>;
  /** Makes a connection, not yet opened, limited to SIGN_IN_TRY_LIMIT_MS. */
  createConnection(credentials: Credentials): Connection;
  log(message: string): void;
}

type Attempt<Connection> =
  { connection: Connection } | { error: unknown; password?: string };

async function attempt<Connection extends OpeningConnection>(
  options: SignInOptions<Connection>,
): Promise<Attempt<Connection>> {
  let credentials: Credentials;
  try {
    credentials = await options.getCredentials();
  } catch (error) {
    return { error };
  }
  const connection = options.createConnection(credentials);
  try {
    await connection.connect();
    return { connection };
  } catch (error) {
    // The abandoned connection is closed; a failure to close it must not
    // hide why the sign-in failed.
    await connection.end().catch(() => undefined);
    return { error, password: credentials.password };
  }
}

/** Why a try failed, for the log, with the try's password taken out of it. */
function reasonFor(failed: { error: unknown; password?: string }): string {
  const message =
    failed.error instanceof Error ? failed.error.message : "unknown error";
  if (failed.password === undefined || failed.password === "") {
    return message;
  }
  return message.split(failed.password).join("[removed]");
}

/**
 * Signs in: one try, and one more if the first failed for any reason other
 * than the database refusing the sign-in. Throws the refusal, or the second
 * try's error, unchanged.
 */
export async function signIn<Connection extends OpeningConnection>(
  options: SignInOptions<Connection>,
): Promise<Connection> {
  const first = await attempt(options);
  if ("connection" in first) {
    return first.connection;
  }
  if (isSignInRefusal(first.error)) {
    throw first.error;
  }
  options.log(
    `The first try to sign in to the database as ${options.who} failed (${reasonFor(first)}). Trying once more, with new credentials.`,
  );
  const second = await attempt(options);
  if ("connection" in second) {
    return second.connection;
  }
  throw second.error;
}

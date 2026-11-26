import { Client } from "pg";
import {
  CONNECT_LIMIT_MS,
  DATABASE_DEADLINE_MS,
  startDeadline,
  withTimeout,
} from "./deadline.ts";
import type { Deadline } from "./deadline.ts";

export interface DatabaseSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  /** The certificate authority the database's certificate must chain to (PEM). */
  caCertificate: string;
}

/** Makes the sign-in token for a new connection. On AWS: from the function's own identity. */
export type TokenProvider = () => Promise<string>;

/** What an operation's database access may do: parameterised statements only. */
export interface Queryable {
  query<Row extends object>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
}

export interface DatabaseOptions {
  deadlineMs?: number;
  connectLimitMs?: number;
  now?: () => number;
}

/**
 * The server's database access: one connection per running copy, opened on
 * first need and kept; a single deadline for everything asked of the database
 * in one request; one reopen if the connection is found broken before a
 * statement is sent. A statement that was sent is never sent a second time.
 */
export class Database {
  private client: Client | undefined;
  private broken = false;
  private opened = 0;
  private readonly deadlineMs: number;
  private readonly connectLimitMs: number;
  private readonly now: () => number;
  private readonly settings: DatabaseSettings;
  private readonly tokenProvider: TokenProvider;

  constructor(
    settings: DatabaseSettings,
    tokenProvider: TokenProvider,
    options: DatabaseOptions = {},
  ) {
    this.settings = settings;
    this.tokenProvider = tokenProvider;
    this.deadlineMs = options.deadlineMs ?? DATABASE_DEADLINE_MS;
    this.connectLimitMs = options.connectLimitMs ?? CONNECT_LIMIT_MS;
    this.now = options.now ?? Date.now;
  }

  /** How many connections this copy has opened so far. */
  get connectionsOpened(): number {
    return this.opened;
  }

  /** Whether the kept connection is known to be unusable. */
  get connectionBroken(): boolean {
    return this.broken;
  }

  /**
   * Runs the work against the kept connection, inside one deadline. On any
   * failure the connection is discarded, so the next request opens a new one.
   */
  async run<T>(work: (connection: Queryable) => Promise<T>): Promise<T> {
    const deadline = startDeadline(
      this.deadlineMs,
      this.now,
      this.connectLimitMs,
    );
    try {
      const client = await this.usableClient(deadline);
      return await withTimeout(
        work(client),
        deadline.remainingMs(),
        "The database request",
      );
    } catch (error) {
      this.discard();
      throw error;
    }
  }

  /** Ends the kept connection, if any. */
  async close(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    this.broken = false;
    if (client !== undefined) {
      await client.end().catch(() => undefined);
    }
  }

  private async usableClient(deadline: Deadline): Promise<Client> {
    if (this.client !== undefined && !this.broken) {
      return this.client;
    }
    // No connection yet, or the kept one was found broken before anything was
    // sent on it: open a new one, once, inside the same deadline.
    this.discard();
    return this.open(deadline);
  }

  private async open(deadline: Deadline): Promise<Client> {
    const password = await withTimeout(
      this.tokenProvider(),
      deadline.connectBudgetMs(),
      "Making the database sign-in token",
    );
    const connectBudgetMs = deadline.connectBudgetMs();
    const client = new Client({
      host: this.settings.host,
      port: this.settings.port,
      database: this.settings.database,
      user: this.settings.user,
      password,
      ssl: {
        ca: this.settings.caCertificate,
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
      },
      connectionTimeoutMillis: Math.max(1, connectBudgetMs),
      application_name: "virtuoso-drive-server",
    });
    // Without a listener, an error on an idle connection would stop the process.
    const markBroken = (): void => {
      if (this.client === client) {
        this.broken = true;
      }
    };
    client.on("error", markBroken);
    client.on("end", markBroken);

    try {
      await withTimeout(
        client.connect(),
        connectBudgetMs,
        "Opening the database connection",
      );
    } catch (error) {
      client.end().catch(() => undefined);
      throw error;
    }
    this.client = client;
    this.broken = false;
    this.opened += 1;
    return client;
  }

  private discard(): void {
    const client = this.client;
    this.client = undefined;
    this.broken = false;
    if (client !== undefined) {
      // Not awaited: a dead connection may never answer the goodbye.
      client.end().catch(() => undefined);
    }
  }
}

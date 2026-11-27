import { describe, expect, it, vi } from "vitest";
import { SIGN_IN_TRY_LIMIT_MS, signIn } from "./sign-in.ts";
import type { Credentials, OpeningConnection } from "./sign-in.ts";

/** What the database driver throws when a connection is not open in time. */
function timeoutError(): Error {
  return new Error("timeout expired");
}

/** PostgreSQL's refusal of a sign-in, as the driver passes it on. */
function refusal(code: "28000" | "28P01"): Error & { code: string } {
  return Object.assign(new Error("PAM authentication failed"), { code });
}

interface FakeConnection extends OpeningConnection {
  credentials: Credentials;
  connect: ReturnType<typeof vi.fn<() => Promise<void>>>;
  end: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

/**
 * A stand-in for everything the sign-in is given. Each try's connection
 * answers with the next outcome: `undefined` opens, an error fails.
 */
function setUp(outcomes: (Error | undefined)[]) {
  const connections: FakeConnection[] = [];
  const lines: string[] = [];
  let tokensMade = 0;
  const getCredentials = vi.fn((): Promise<Credentials> => {
    tokensMade += 1;
    return Promise.resolve({
      user: "migrator",
      password: `example-token-${tokensMade}`,
    });
  });
  const createConnection = (credentials: Credentials): FakeConnection => {
    const outcome = outcomes[connections.length];
    const connection: FakeConnection = {
      credentials,
      connect: vi.fn(() =>
        outcome === undefined ? Promise.resolve() : Promise.reject(outcome),
      ),
      end: vi.fn(() => Promise.resolve()),
    };
    connections.push(connection);
    return connection;
  };
  return {
    connections,
    lines,
    getCredentials,
    options: {
      who: '"migrator"',
      getCredentials,
      createConnection,
      log: (message: string) => {
        lines.push(message);
      },
    },
  };
}

describe("signIn", () => {
  it("gives each try 30 seconds", () => {
    expect(SIGN_IN_TRY_LIMIT_MS).toBe(30_000);
  });

  it("returns the first try's connection and makes no second try", async () => {
    const fake = setUp([undefined]);

    const connection = await signIn(fake.options);

    expect(connection).toBe(fake.connections[0]);
    expect(fake.connections).toHaveLength(1);
    expect(fake.getCredentials).toHaveBeenCalledTimes(1);
    expect(connection.end).not.toHaveBeenCalled();
    expect(fake.lines).toEqual([]);
  });

  it("tries once more after a timeout, returns that connection and logs one line", async () => {
    const fake = setUp([timeoutError(), undefined]);

    const connection = await signIn(fake.options);

    expect(connection).toBe(fake.connections[1]);
    expect(fake.connections).toHaveLength(2);
    expect(connection.end).not.toHaveBeenCalled();
    expect(fake.lines).toHaveLength(1);
    expect(fake.lines[0]).toContain('as "migrator" failed');
    expect(fake.lines[0]).toContain("timeout expired");
    expect(fake.lines[0]).toContain("Trying once more");
  });

  it("asks for a new token for each try and closes the connection it abandons", async () => {
    const fake = setUp([timeoutError(), undefined]);

    await signIn(fake.options);

    expect(fake.getCredentials).toHaveBeenCalledTimes(2);
    expect(fake.connections[0]?.credentials.password).toBe("example-token-1");
    expect(fake.connections[1]?.credentials.password).toBe("example-token-2");
    expect(fake.connections[0]?.end).toHaveBeenCalledTimes(1);
  });

  it("throws the second error after two timeouts, with both connections closed and no third try", async () => {
    const second = timeoutError();
    const fake = setUp([timeoutError(), second, undefined]);

    await expect(signIn(fake.options)).rejects.toBe(second);

    expect(fake.connections).toHaveLength(2);
    expect(fake.connections[0]?.end).toHaveBeenCalledTimes(1);
    expect(fake.connections[1]?.end).toHaveBeenCalledTimes(1);
    expect(fake.lines).toHaveLength(1);
  });

  it.each(["28000", "28P01"] as const)(
    "throws a refusal (%s) at once, with no second try and no log line",
    async (code) => {
      const refused = refusal(code);
      const fake = setUp([refused, undefined]);

      await expect(signIn(fake.options)).rejects.toBe(refused);

      expect(fake.connections).toHaveLength(1);
      expect(fake.getCredentials).toHaveBeenCalledTimes(1);
      expect(fake.connections[0]?.end).toHaveBeenCalledTimes(1);
      expect(fake.lines).toEqual([]);
    },
  );

  it("passes on a refusal met at the second try, unchanged", async () => {
    const refused = refusal("28000");
    const fake = setUp([timeoutError(), refused]);

    await expect(signIn(fake.options)).rejects.toBe(refused);

    expect(fake.connections).toHaveLength(2);
  });

  it("tries once more when the token itself could not be made", async () => {
    const fake = setUp([undefined]);
    fake.getCredentials.mockRejectedValueOnce(
      new Error("Could not load credentials"),
    );

    const connection = await signIn(fake.options);

    expect(connection).toBe(fake.connections[0]);
    expect(fake.getCredentials).toHaveBeenCalledTimes(2);
    expect(fake.lines).toHaveLength(1);
    expect(fake.lines[0]).toContain("Could not load credentials");
  });

  it("never writes the token into the log line, even when the error repeats it", async () => {
    const fake = setUp([
      new Error('sign-in with "example-token-1" was cut off'),
      undefined,
    ]);

    await signIn(fake.options);

    expect(fake.lines).toHaveLength(1);
    expect(fake.lines[0]).not.toContain("example-token");
    expect(fake.lines[0]).toContain("[removed]");
  });

  it("reports why the sign-in failed even when closing the abandoned connection fails too", async () => {
    const second = timeoutError();
    const fake = setUp([timeoutError(), second]);
    const createConnection = (credentials: Credentials): FakeConnection => {
      const connection = fake.options.createConnection(credentials);
      connection.end.mockRejectedValue(new Error("already closed"));
      return connection;
    };

    await expect(signIn({ ...fake.options, createConnection })).rejects.toBe(
      second,
    );
  });

  it("logs something plain when what was thrown is not an error", async () => {
    const fake = setUp([undefined]);
    fake.getCredentials.mockRejectedValueOnce("not an error");

    await signIn(fake.options);

    expect(fake.lines[0]).toContain("unknown error");
  });
});

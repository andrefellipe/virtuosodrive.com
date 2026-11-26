import { describe, expect, it } from "vitest";
import { rdsTokenProvider } from "./rds-token.ts";

// Stand-in credentials, in the documented example format; they sign nothing real.
const exampleCredentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

describe("rdsTokenProvider", () => {
  it("makes a token for the given database address and user without any network call", async () => {
    const provider = rdsTokenProvider({
      host: "db.example.com",
      port: 5432,
      user: "app",
      region: "us-east-1",
      credentials: exampleCredentials,
    });

    const token = await provider();

    expect(token.startsWith("db.example.com:5432/?")).toBe(true);
    expect(token).toContain("Action=connect");
    expect(token).toContain("DBUser=app");
    expect(token).toContain("X-Amz-Signature=");
    expect(token).toContain("X-Amz-Expires=900");
  });

  it("makes a different signature for a different user", async () => {
    const settings = {
      host: "db.example.com",
      port: 5432,
      region: "us-east-1",
      credentials: exampleCredentials,
    };
    const signature = (token: string): string | null =>
      new URL(`https://${token}`).searchParams.get("X-Amz-Signature");

    const appToken = await rdsTokenProvider({ ...settings, user: "app" })();
    const migratorToken = await rdsTokenProvider({
      ...settings,
      user: "migrator",
    })();

    expect(signature(appToken)).not.toBeNull();
    expect(signature(appToken)).not.toBe(signature(migratorToken));
  });

  it("fails when no identity can be found", async () => {
    const provider = rdsTokenProvider({
      host: "db.example.com",
      port: 5432,
      user: "app",
      region: "us-east-1",
      credentials: () => Promise.reject(new Error("no identity available")),
    });

    await expect(provider()).rejects.toThrow("no identity available");
  });
});

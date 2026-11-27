import { describe, expect, it } from "vitest";
import { loadConfig, parseMasterSecret } from "./config.ts";
import { decideUserCreation, isSignInRefusal } from "./decide.ts";

describe("isSignInRefusal", () => {
  it("recognises PostgreSQL's refusals of a sign-in", () => {
    expect(isSignInRefusal({ code: "28000" })).toBe(true);
    expect(isSignInRefusal({ code: "28P01" })).toBe(true);
  });

  it("does not take an unreachable database, a timeout or a certificate failure for a missing user", () => {
    expect(isSignInRefusal({ code: "ECONNREFUSED" })).toBe(false);
    expect(isSignInRefusal({ code: "57P03" })).toBe(false);
    expect(isSignInRefusal({ code: "SELF_SIGNED_CERT_IN_CHAIN" })).toBe(false);
    expect(isSignInRefusal(new Error("timeout expired"))).toBe(false);
  });

  it("does not take something that is not an error with a code for a refusal", () => {
    expect(isSignInRefusal(undefined)).toBe(false);
    expect(isSignInRefusal(null)).toBe(false);
    expect(isSignInRefusal("28P01")).toBe(false);
    expect(isSignInRefusal({ code: 28000 })).toBe(false);
  });
});

describe("decideUserCreation", () => {
  it("creates the users when the master sign-in confirms neither exists", () => {
    expect(decideUserCreation({ migrator: false, app: false })).toEqual({
      action: "create",
    });
  });

  it("stops, creating nothing, when migrator exists but could not sign in", () => {
    const decision = decideUserCreation({ migrator: true, app: true });

    expect(decision.action).toBe("stop");
    expect(decision).toMatchObject({
      reason: expect.stringContaining("Nothing was created"),
    });
  });

  it("stops, naming which user is missing, when only one of the two exists", () => {
    expect(decideUserCreation({ migrator: true, app: false })).toMatchObject({
      action: "stop",
      reason: expect.stringMatching(/"migrator" exists but "app" does not/),
    });
    expect(decideUserCreation({ migrator: false, app: true })).toMatchObject({
      action: "stop",
      reason: expect.stringMatching(/"app" exists but "migrator" does not/),
    });
  });
});

describe("the change runner's settings", () => {
  const complete = {
    VD_ENVIRONMENT: "production",
    DB_HOST: "db.example.com",
    DB_NAME: "virtuoso",
    DB_MASTER_SECRET_ID: "vd-prod-db-master",
    AWS_REGION: "us-east-1",
  };

  it("reads the settings, with the usual port by default", () => {
    expect(loadConfig(complete)).toEqual({
      environment: "production",
      region: "us-east-1",
      database: { host: "db.example.com", port: 5432, name: "virtuoso" },
      masterSecretId: "vd-prod-db-master",
      failingChange: false,
    });
  });

  it("turns the failing change on only when asked, in the test environment", () => {
    const test = { ...complete, VD_ENVIRONMENT: "test" };

    expect(loadConfig(test).failingChange).toBe(false);
    expect(
      loadConfig({ ...test, VD_FAILING_CHANGE: "off" }).failingChange,
    ).toBe(false);
    expect(loadConfig({ ...test, VD_FAILING_CHANGE: "on" }).failingChange).toBe(
      true,
    );
  });

  it("refuses the failing change in production", () => {
    expect(() => loadConfig({ ...complete, VD_FAILING_CHANGE: "on" })).toThrow(
      "VD_FAILING_CHANGE must never be on in production",
    );
    expect(
      loadConfig({ ...complete, VD_FAILING_CHANGE: "off" }).failingChange,
    ).toBe(false);
  });

  it("refuses a value for the failing change that is neither on nor off", () => {
    expect(() =>
      loadConfig({
        ...complete,
        VD_ENVIRONMENT: "test",
        VD_FAILING_CHANGE: "true",
      }),
    ).toThrow(/VD_FAILING_CHANGE/);
  });

  it("names the settings that are missing", () => {
    expect(() => loadConfig({ ...complete, DB_HOST: undefined })).toThrow(
      /DB_HOST/,
    );
  });

  it("reads the master sign-in from the secret's text", () => {
    expect(
      parseMasterSecret('{"username":"vdmaster","password":"example-only"}'),
    ).toEqual({ username: "vdmaster", password: "example-only" });
  });

  it("refuses a malformed master secret without echoing what it held", () => {
    expect(() => parseMasterSecret("example-only-not-json")).toThrow(
      "The database master secret is not valid JSON",
    );
    expect(() => parseMasterSecret('{"password":"example-only"}')).toThrow(
      /must hold "username" and "password"/,
    );
    expect(() => parseMasterSecret('{"password":"example-only"}')).not.toThrow(
      /example-only/,
    );
  });
});

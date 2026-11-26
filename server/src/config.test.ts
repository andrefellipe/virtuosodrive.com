import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { secretReader } from "./aws/secrets.ts";
import { loadConfig, readDatabaseCa, readReleaseVersion } from "./config.ts";

const complete = {
  VD_ENVIRONMENT: "test",
  DB_HOST: "db.example.com",
  DB_NAME: "virtuoso",
  DB_USER: "app",
  ORIGIN_SECRET_ID: "vd-test-origin-secret",
  AWS_REGION: "us-east-1",
};

describe("loadConfig", () => {
  it("reads the settings, with the usual database port and the failing operation off by default", () => {
    expect(loadConfig(complete, "a1b2c3d")).toEqual({
      environment: "test",
      version: "a1b2c3d",
      region: "us-east-1",
      database: {
        host: "db.example.com",
        port: 5432,
        name: "virtuoso",
        user: "app",
      },
      originSecretId: "vd-test-origin-secret",
      forcedFailure: false,
    });
  });

  it("names every setting that is missing or malformed, without echoing values", () => {
    const attempt = (): unknown =>
      loadConfig(
        {
          ...complete,
          VD_ENVIRONMENT: "staging",
          DB_HOST: undefined,
          DB_PORT: "seventy",
        },
        "a1b2c3d",
      );

    expect(attempt).toThrow(/VD_ENVIRONMENT/);
    expect(attempt).toThrow(/DB_HOST/);
    expect(attempt).toThrow(/DB_PORT/);
    expect(attempt).not.toThrow(/staging|seventy/);
  });

  it("lets the test environment enable the failing operation and refuses it in production", () => {
    expect(
      loadConfig({ ...complete, VD_FORCED_FAILURE: "on" }, "a1b2c3d")
        .forcedFailure,
    ).toBe(true);
    expect(() =>
      loadConfig(
        { ...complete, VD_ENVIRONMENT: "production", VD_FORCED_FAILURE: "on" },
        "a1b2c3d",
      ),
    ).toThrow(/never be on in production/);
  });
});

describe("files read once per running copy", () => {
  it("calls the version development when the code is not a built Release", () => {
    expect(readReleaseVersion()).toBe("development");
  });

  it("refuses a release file that does not hold a version", () => {
    const notARelease = fileURLToPath(
      new URL("../tsconfig.json", import.meta.url),
    );
    expect(() => readReleaseVersion(notARelease)).toThrow();
  });

  it("reads the certificate authorities Amazon RDS publishes", () => {
    const authorities = readDatabaseCa();
    expect(authorities.match(/BEGIN CERTIFICATE/g)?.length).toBeGreaterThan(0);
  });
});

describe("secretReader", () => {
  it("asks for the named secret and answers with its text", async () => {
    const asked: (string | undefined)[] = [];
    const read = secretReader(
      {
        send: (command) => {
          asked.push(command.input.SecretId);
          return Promise.resolve({ SecretString: "the-value" });
        },
      },
      "vd-test-origin-secret",
    );

    await expect(read()).resolves.toBe("the-value");
    expect(asked).toEqual(["vd-test-origin-secret"]);
  });

  it("fails when the secret has no text, or cannot be read", async () => {
    await expect(
      secretReader({ send: () => Promise.resolve({}) }, "id")(),
    ).rejects.toThrow(/no text value/);
    await expect(
      secretReader(
        { send: () => Promise.reject(new Error("AccessDenied")) },
        "id",
      )(),
    ).rejects.toThrow("AccessDenied");
  });
});

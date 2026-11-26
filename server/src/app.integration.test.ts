import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startPostgres } from "../../db-migrate/src/testing/postgres.ts";
import type { TestDatabase } from "../../db-migrate/src/testing/postgres.ts";
import { createApp } from "./app.ts";
import type { App } from "./app.ts";
import { secretReader } from "./aws/secrets.ts";
import type { ServerConfig } from "./config.ts";
import { httpEvent } from "./http/testing/events.ts";
import type { RequestLogEntry } from "./log/entry.ts";
import type { RequestMeasurement } from "./log/measurements.ts";

const EDGE_SECRET = "edge-secret-for-tests";
const FROM_EDGE = { "x-origin-verify": EDGE_SECRET };

// The operations, asked through the server as the function's entry point
// assembles it, against a real PostgreSQL. AWS is replaced at the SDK's
// boundary: a fake Secrets Manager client and a fake sign-in token maker.
describe("operations through the server", () => {
  let postgres: TestDatabase;
  let entries: RequestLogEntry[];
  let measurements: RequestMeasurement[];
  const apps: App[] = [];

  function startApp(overrides: Partial<ServerConfig> = {}): App {
    entries = [];
    measurements = [];
    const app = createApp({
      config: {
        environment: "test",
        version: "a1b2c3d",
        region: "us-east-1",
        database: {
          host: postgres.host,
          port: postgres.port,
          name: postgres.database,
          user: "app",
        },
        originSecretId: "vd-test-origin-secret",
        forcedFailure: false,
        ...overrides,
      },
      databaseCa: postgres.caCertificate,
      databaseToken: () => Promise.resolve(postgres.passwords.app),
      readOriginSecret: secretReader(
        { send: () => Promise.resolve({ SecretString: EDGE_SECRET }) },
        "vd-test-origin-secret",
      ),
      log: { write: (entry) => entries.push(entry) },
      measurements: { record: (measurement) => measurements.push(measurement) },
    });
    apps.push(app);
    return app;
  }

  beforeAll(async () => {
    postgres = await startPostgres();
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  afterAll(async () => {
    await postgres?.stop();
  });

  it("health answers ok and carries the request identifier", async () => {
    const app = startApp();

    const response = await app.handle(
      httpEvent({
        path: "/v1/health",
        headers: { ...FROM_EDGE, "x-request-id": "monitor-1" },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ status: "ok" });
    expect(response.headers?.["x-request-id"]).toBe("monitor-1");
    expect(response.headers?.["content-type"]).toBe("application/json");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ operation: "getHealth", outcome: 200 });
    expect(measurements).toEqual([]);
  });

  it("site information answers with the installed time, the version and the environment", async () => {
    const app = startApp();
    const master = await postgres.connect("master");
    let installedAt: Date | undefined;
    try {
      const row = await master.query<{ installed_at: Date }>(
        "SELECT installed_at FROM site_information WHERE id = $1",
        [1],
      );
      installedAt = row.rows[0]?.installed_at;
    } finally {
      await master.end();
    }

    const response = await app.handle(
      httpEvent({
        path: "/v1/site-information",
        headers: { ...FROM_EDGE, "x-request-id": "page-7f3c" },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({
      installedAt: installedAt?.toISOString(),
      version: "a1b2c3d",
      environment: "test",
    });
    expect(response.headers?.["x-request-id"]).toBe("page-7f3c");
    expect(response.headers?.["cache-control"]).toBe("no-store");
    expect(entries).toEqual([
      expect.objectContaining({
        requestId: "page-7f3c",
        operation: "getSiteInformation",
        outcome: 200,
        version: "a1b2c3d",
        environment: "test",
        coldStart: true,
      }),
    ]);
    expect(measurements).toHaveLength(1);
  });

  it("site information answers 500 as a Problem when the record is missing", async () => {
    const app = startApp();
    const master = await postgres.connect("master");
    try {
      await master.query("BEGIN");
      const kept = await master.query<{ installed_at: Date }>(
        "DELETE FROM site_information WHERE id = $1 RETURNING installed_at",
        [1],
      );
      await master.query("COMMIT");
      try {
        const response = await app.handle(
          httpEvent({
            path: "/v1/site-information",
            headers: { ...FROM_EDGE, "x-request-id": "page-missing" },
          }),
        );

        expect(response.statusCode).toBe(500);
        expect(response.headers?.["content-type"]).toBe(
          "application/problem+json",
        );
        expect(response.headers?.["x-request-id"]).toBe("page-missing");
        expect(JSON.parse(response.body as string)).toMatchObject({
          status: 500,
          code: "serverError",
        });
        expect(response.body).not.toContain("site_information");
        expect(entries[0]).toMatchObject({
          level: "error",
          outcome: 500,
          code: "serverError",
        });
        expect(entries[0]?.error?.message).toContain("record is missing");
      } finally {
        await master.query(
          "INSERT INTO site_information (id, installed_at) VALUES ($1, $2)",
          [1, kept.rows[0]?.installed_at],
        );
      }
    } finally {
      await master.end();
    }
  });

  it("refuses a request that did not come through the edge, and unknown query parameters", async () => {
    const app = startApp();

    const aroundTheEdge = await app.handle(
      httpEvent({ path: "/v1/site-information" }),
    );
    const withQuery = await app.handle(
      httpEvent({
        path: "/v1/site-information",
        headers: FROM_EDGE,
        query: { verbose: "1" },
      }),
    );

    expect(aroundTheEdge.statusCode).toBe(403);
    expect(aroundTheEdge.body).toBeUndefined();
    expect(withQuery.statusCode).toBe(400);
    expect(JSON.parse(withQuery.body as string)).toMatchObject({
      code: "invalidInput",
    });
    expect(entries.map((entry) => entry.operation)).toEqual([
      "access refused",
      "getSiteInformation",
    ]);
  });

  it("answers notFound for the deliberately failing operation unless the environment enables it", async () => {
    const off = startApp();
    const whenOff = await off.handle(
      httpEvent({ path: "/v1/forced-failure", headers: FROM_EDGE }),
    );
    expect(whenOff.statusCode).toBe(404);

    const on = startApp({ forcedFailure: true });
    const whenOn = await on.handle(
      httpEvent({ path: "/v1/forced-failure", headers: FROM_EDGE }),
    );
    expect(whenOn.statusCode).toBe(500);
    expect(JSON.parse(whenOn.body as string)).toMatchObject({
      code: "serverError",
    });
    expect(measurements).toEqual([expect.objectContaining({ outcome: 500 })]);

    const production = startApp({
      forcedFailure: true,
      environment: "production",
    });
    const inProduction = await production.handle(
      httpEvent({ path: "/v1/forced-failure", headers: FROM_EDGE }),
    );
    expect(inProduction.statusCode).toBe(404);
  });

  it("writes one log entry for every request, whatever its outcome", async () => {
    const app = startApp();

    await app.handle(httpEvent({ path: "/v1/health", headers: FROM_EDGE }));
    await app.handle(
      httpEvent({ path: "/v1/site-information", headers: FROM_EDGE }),
    );
    await app.handle(httpEvent({ path: "/v1/nowhere", headers: FROM_EDGE }));
    await app.handle(httpEvent({ path: "/v1/health" }));

    expect(entries.map((entry) => [entry.operation, entry.outcome])).toEqual([
      ["getHealth", 200],
      ["getSiteInformation", 200],
      ["unknown", 404],
      ["access refused", 403],
    ]);
    expect(new Set(entries.map((entry) => entry.requestId)).size).toBe(4);
  });

  it("health answers 503 and site information 500, both as Problems with the request identifier, while the database is stopped; both recover by themselves", async () => {
    const app = startApp();
    await app.handle(httpEvent({ path: "/v1/health", headers: FROM_EDGE }));

    await postgres.pause();
    let health;
    let siteInformation;
    try {
      const startedAt = Date.now();
      health = await app.handle(
        httpEvent({
          path: "/v1/health",
          headers: { ...FROM_EDGE, "x-request-id": "monitor-down" },
        }),
      );
      siteInformation = await app.handle(
        httpEvent({
          path: "/v1/site-information",
          headers: { ...FROM_EDGE, "x-request-id": "page-down" },
        }),
      );
      expect(Date.now() - startedAt).toBeLessThan(6_200);
    } finally {
      await postgres.resume();
    }

    expect(health.statusCode).toBe(503);
    expect(health.headers?.["content-type"]).toBe("application/problem+json");
    expect(health.headers?.["x-request-id"]).toBe("monitor-down");
    expect(JSON.parse(health.body as string)).toMatchObject({
      status: 503,
      code: "serverError",
    });
    expect(siteInformation.statusCode).toBe(500);
    expect(siteInformation.headers?.["x-request-id"]).toBe("page-down");
    expect(JSON.parse(siteInformation.body as string)).toMatchObject({
      status: 500,
      code: "serverError",
    });
    for (const body of [health.body, siteInformation.body]) {
      expect(body).not.toMatch(/ECONN|127\.0\.0\.1|localhost|SELECT|stack/);
    }

    const healthAgain = await app.handle(
      httpEvent({ path: "/v1/health", headers: FROM_EDGE }),
    );
    const siteAgain = await app.handle(
      httpEvent({ path: "/v1/site-information", headers: FROM_EDGE }),
    );
    expect(healthAgain.statusCode).toBe(200);
    expect(siteAgain.statusCode).toBe(200);
  });

  it("answers serverError when the sign-in token is refused by the database", async () => {
    entries = [];
    measurements = [];
    const app = createApp({
      config: {
        environment: "test",
        version: "a1b2c3d",
        region: "us-east-1",
        database: {
          host: postgres.host,
          port: postgres.port,
          name: postgres.database,
          user: "app",
        },
        originSecretId: "vd-test-origin-secret",
        forcedFailure: false,
      },
      databaseCa: postgres.caCertificate,
      databaseToken: () => Promise.resolve("an-expired-token"),
      readOriginSecret: () => Promise.resolve(EDGE_SECRET),
      log: { write: (entry) => entries.push(entry) },
      measurements: { record: (measurement) => measurements.push(measurement) },
    });
    apps.push(app);

    const response = await app.handle(
      httpEvent({ path: "/v1/site-information", headers: FROM_EDGE }),
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("password");
    expect(entries[0]?.error?.message).toContain("authentication failed");
  });
});

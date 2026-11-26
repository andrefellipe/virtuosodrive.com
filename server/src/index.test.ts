import { describe, expect, it, vi } from "vitest";
import { httpEvent } from "./http/testing/events.ts";
import { handler } from "./index.ts";
import { handler as placeholder } from "./placeholder.ts";

describe("the function's entry point", () => {
  it("answers serverError as a Problem, and says why on standard error, when the copy cannot start", async () => {
    vi.stubEnv("VD_ENVIRONMENT", "");
    vi.stubEnv("DB_HOST", "");
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const response = await handler(httpEvent({ path: "/v1/health" }));

    expect(response.statusCode).toBe(500);
    expect(response.headers?.["content-type"]).toBe("application/problem+json");
    expect(JSON.parse(response.body as string)).toMatchObject({
      status: 500,
      code: "serverError",
    });
    expect(response.body).not.toContain("VD_ENVIRONMENT");
    expect(String(stderr.mock.calls[0]?.[0])).toContain("VD_ENVIRONMENT");
  });
});

describe("the placeholder a new environment starts with", () => {
  it("answers every request with 503 as a Problem that is never stored", async () => {
    const response = await placeholder();

    expect(response.statusCode).toBe(503);
    expect(response.headers).toMatchObject({
      "content-type": "application/problem+json",
      "cache-control": "no-store",
    });
    expect(JSON.parse(response.body as string)).toMatchObject({
      status: 503,
      code: "serverError",
    });
  });
});

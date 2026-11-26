import { describe, expect, it } from "vitest";
import { resolveRequestId } from "./request-id.ts";

describe("resolveRequestId", () => {
  it("uses an identifier of letters, digits and hyphens", () => {
    expect(resolveRequestId("7f3c-AB12", () => "generated")).toBe("7f3c-AB12");
    expect(resolveRequestId("a", () => "generated")).toBe("a");
    expect(resolveRequestId("x".repeat(64), () => "generated")).toBe(
      "x".repeat(64),
    );
  });

  it("makes one when none was sent", () => {
    expect(resolveRequestId(undefined, () => "generated")).toBe("generated");
  });

  it("replaces an identifier that is empty, too long or has other characters", () => {
    for (const malformed of [
      "",
      "x".repeat(65),
      "has space",
      "semi;colon",
      "new\nline",
      "someone@example.com",
      "émile",
    ]) {
      expect(resolveRequestId(malformed, () => "generated")).toBe("generated");
    }
  });

  it("makes identifiers that are themselves well formed and differ each time", () => {
    const first = resolveRequestId(undefined);
    const second = resolveRequestId(undefined);

    expect(first).toMatch(/^[A-Za-z0-9-]{1,64}$/);
    expect(first).not.toBe(second);
    expect(resolveRequestId(first, () => "generated")).toBe(first);
  });
});

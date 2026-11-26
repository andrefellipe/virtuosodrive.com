import { describe, expect, it } from "vitest";
import { EMAIL_REMOVED, removeEmailAddresses, scrub } from "./scrub.ts";

describe("removeEmailAddresses", () => {
  it("replaces an email address with the fixed marker", () => {
    expect(removeEmailAddresses("student@example.com")).toBe(EMAIL_REMOVED);
    expect(EMAIL_REMOVED).toBe("[email removed]");
  });

  it("replaces every address in a text and keeps the rest", () => {
    expect(
      removeEmailAddresses(
        "duplicate key (email)=(first.last+tag@mail.example.com) and b_c@example.org.",
      ),
    ).toBe("duplicate key (email)=([email removed]) and [email removed].");
  });

  it("leaves text without an address unchanged", () => {
    for (const text of [
      "connect ECONNREFUSED 10.0.1.17:5432",
      "user@localhost",
      "@mention and a@ and @b.com",
      "",
    ]) {
      expect(removeEmailAddresses(text)).toBe(text);
    }
  });
});

describe("scrub", () => {
  it("removes addresses from every text field, at any depth, including error messages and stack traces", () => {
    const entry = {
      requestId: "abc",
      outcome: 500,
      coldStart: false,
      error: {
        name: "Error",
        message: "no account for teacher@example.com",
        stack:
          "Error: no account for teacher@example.com\n    at find (/var/task/index.mjs:10:5)",
        related: ["x@example.com", { deep: "y@example.com" }],
      },
    };

    const scrubbed = scrub(entry);

    expect(JSON.stringify(scrubbed)).not.toContain("@example.com");
    expect(scrubbed.error.message).toBe("no account for [email removed]");
    expect(scrubbed.error.stack).toContain(
      "at find (/var/task/index.mjs:10:5)",
    );
    expect(scrubbed.error.related).toEqual([
      "[email removed]",
      { deep: "[email removed]" },
    ]);
  });

  it("keeps numbers, booleans and nulls as they are and does not change the original", () => {
    const original = {
      outcome: 200,
      coldStart: true,
      account: null,
      note: "a@example.com",
    };

    const scrubbed = scrub(original);

    expect(scrubbed).toEqual({
      outcome: 200,
      coldStart: true,
      account: null,
      note: "[email removed]",
    });
    expect(original.note).toBe("a@example.com");
  });
});

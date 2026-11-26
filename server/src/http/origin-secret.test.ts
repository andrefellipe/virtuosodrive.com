import { describe, expect, it } from "vitest";
import { OriginSecretVerifier, REREAD_INTERVAL_MS } from "./origin-secret.ts";

function setUp(initial: string) {
  const state = { secret: initial, reads: 0, now: 0, failNextRead: false };
  const verifier = new OriginSecretVerifier(
    () => {
      state.reads += 1;
      if (state.failNextRead) {
        state.failNextRead = false;
        return Promise.reject(new Error("secrets endpoint unreachable"));
      }
      return Promise.resolve(state.secret);
    },
    () => state.now,
  );
  return { verifier, state };
}

describe("OriginSecretVerifier", () => {
  it("allows the right secret and reads it once per running copy", async () => {
    const { verifier, state } = setUp("first-secret");

    expect(await verifier.check("first-secret")).toEqual({ allowed: true });
    expect(await verifier.check("first-secret")).toEqual({ allowed: true });
    expect(state.reads).toBe(1);
  });

  it("refuses a missing or empty header without reading anything", async () => {
    const { verifier, state } = setUp("first-secret");

    expect(await verifier.check(undefined)).toEqual({ allowed: false });
    expect(await verifier.check("")).toEqual({ allowed: false });
    expect(state.reads).toBe(0);
  });

  it("refuses a wrong secret, and one that only shares a prefix or length", async () => {
    const { verifier } = setUp("first-secret");

    expect((await verifier.check("a-guess")).allowed).toBe(false);
    expect((await verifier.check("first-secre")).allowed).toBe(false);
    expect((await verifier.check("first-secreT")).allowed).toBe(false);
  });

  it("reads the secret again on a mismatch, so a replaced secret is accepted without a restart", async () => {
    const { verifier, state } = setUp("first-secret");
    await verifier.check("first-secret");

    state.secret = "second-secret";
    state.now = REREAD_INTERVAL_MS;

    expect(await verifier.check("second-secret")).toEqual({ allowed: true });
    expect(state.reads).toBe(2);
    expect((await verifier.check("first-secret")).allowed).toBe(false);
  });

  it("reads again at most once a minute, however many wrong secrets arrive", async () => {
    const { verifier, state } = setUp("first-secret");
    await verifier.check("first-secret");

    state.now = REREAD_INTERVAL_MS - 1;
    await verifier.check("a-guess");
    expect(state.reads).toBe(1);

    state.now = REREAD_INTERVAL_MS;
    await verifier.check("a-guess");
    await verifier.check("another-guess");
    await verifier.check("a-third-guess");
    expect(state.reads).toBe(2);
  });

  it("refuses and reports the reason when reading again fails, and keeps the value it held", async () => {
    const { verifier, state } = setUp("first-secret");
    await verifier.check("first-secret");

    state.now = REREAD_INTERVAL_MS;
    state.failNextRead = true;
    const refused = await verifier.check("a-guess");

    expect(refused.allowed).toBe(false);
    expect(refused.rereadError).toBeInstanceOf(Error);
    expect(await verifier.check("first-secret")).toEqual({ allowed: true });
  });

  it("fails, and does not allow, when the first read fails or the secret is empty", async () => {
    const failing = setUp("first-secret");
    failing.state.failNextRead = true;
    await expect(failing.verifier.check("first-secret")).rejects.toThrow(
      "secrets endpoint unreachable",
    );

    const empty = setUp("");
    await expect(empty.verifier.check("anything")).rejects.toThrow(/empty/);
  });
});

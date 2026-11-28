import { randomBytes } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  acceptsGzip,
  COMPRESS_ABOVE_BYTES,
  encodedHandedOverBytes,
  plainHandedOverBytes,
  prepareJson,
} from "./body.ts";

/** JSON that compresses well: many rows that differ little. */
const ORDINARY = JSON.stringify(
  Array.from({ length: 200 }, (_unused, index) => ({
    itemId: `item-${index}`,
    kind: "file",
    name: `Lecture notes ${index}.pdf`,
  })),
);
/** JSON text that does not compress: random letters and digits. */
const INCOMPRESSIBLE = JSON.stringify({
  name: randomBytes(3_000).toString("base64url"),
});

describe("preparing an answer's body (performance design P22)", () => {
  it("compresses when the caller accepts gzip, the answer is over 1 kilobyte and the compressed form is the smaller to hand over", () => {
    const { prepared, sentBytes } = prepareJson(ORDINARY, "gzip, deflate, br");

    if (prepared.encoding !== "gzip") {
      throw new Error("Expected a compressed body");
    }
    expect(gunzipSync(prepared.bytes).toString("utf8")).toBe(ORDINARY);
    expect(sentBytes).toBe(prepared.bytes.length);
    expect(encodedHandedOverBytes(sentBytes)).toBeLessThan(
      plainHandedOverBytes(ORDINARY),
    );
  });

  it("sends the answer as it is when the caller does not accept gzip", () => {
    for (const header of [
      undefined,
      "",
      "identity",
      "br, deflate",
      "gzip;q=0",
    ]) {
      expect(prepareJson(ORDINARY, header)).toEqual({
        prepared: { encoding: "identity", text: ORDINARY },
        sentBytes: Buffer.byteLength(ORDINARY),
      });
    }
  });

  it("sends an answer of 1 kilobyte or less as it is", () => {
    const atTheLimit = JSON.stringify({
      name: "a".repeat(COMPRESS_ABOVE_BYTES - 11),
    });
    const justOver = JSON.stringify({
      name: "a".repeat(COMPRESS_ABOVE_BYTES - 10),
    });

    expect(COMPRESS_ABOVE_BYTES).toBe(1_024);
    expect(Buffer.byteLength(atTheLimit)).toBe(COMPRESS_ABOVE_BYTES);
    expect(prepareJson(atTheLimit, "gzip").prepared.encoding).toBe("identity");
    expect(prepareJson(justOver, "gzip").prepared.encoding).toBe("gzip");
  });

  it("sends the answer as it is when the encoded compressed form would be the larger", () => {
    const { prepared, sentBytes } = prepareJson(INCOMPRESSIBLE, "gzip");

    expect(prepared).toEqual({ encoding: "identity", text: INCOMPRESSIBLE });
    expect(sentBytes).toBe(Buffer.byteLength(INCOMPRESSIBLE));
  });

  it("measures both forms as they are handed over: quotation marks doubled, compressed bytes a third larger", () => {
    // 2 for the surrounding quotes, and each inner quote or backslash twice.
    expect(plainHandedOverBytes('{"a":"b"}')).toBe(2 + 9 + 4);
    expect(plainHandedOverBytes("\\")).toBe(4);
    expect(encodedHandedOverBytes(3)).toBe(4 + 2);
    expect(encodedHandedOverBytes(4)).toBe(8 + 2);
    expect(encodedHandedOverBytes(3_000)).toBe(4_000 + 2);
  });

  it("reads only whether the header names gzip with a weight above zero", () => {
    expect(acceptsGzip("gzip")).toBe(true);
    expect(acceptsGzip("GZIP")).toBe(true);
    expect(acceptsGzip("br;q=1.0, gzip;q=0.8, *;q=0.1")).toBe(true);
    expect(acceptsGzip("deflate,gzip ; q=0.5")).toBe(true);
    expect(acceptsGzip("gzip;q=0")).toBe(false);
    expect(acceptsGzip("gzip;q=0.0")).toBe(false);
    expect(acceptsGzip("x-gzip2, notgzip")).toBe(false);
    expect(acceptsGzip("*")).toBe(false);
    expect(acceptsGzip(undefined)).toBe(false);
  });
});

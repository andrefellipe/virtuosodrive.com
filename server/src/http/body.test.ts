import { randomBytes } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  ACCEPT_GZIP_HEADER,
  ACCEPT_GZIP_HEADER_NAME,
  ACCEPT_GZIP_VALUE,
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
  it("compresses when the caller sent X-Accept-Gzip with the value 1, the answer is over 1 kilobyte and the compressed form is the smaller to hand over", () => {
    const { prepared, sentBytes } = prepareJson(ORDINARY, "1");

    if (prepared.encoding !== "gzip") {
      throw new Error("Expected a compressed body");
    }
    expect(gunzipSync(prepared.bytes).toString("utf8")).toBe(ORDINARY);
    expect(sentBytes).toBe(prepared.bytes.length);
    expect(encodedHandedOverBytes(sentBytes)).toBeLessThan(
      plainHandedOverBytes(ORDINARY),
    );
  });

  it("sends the answer as it is when the header is absent", () => {
    expect(prepareJson(ORDINARY, undefined)).toEqual({
      prepared: { encoding: "identity", text: ORDINARY },
      sentBytes: Buffer.byteLength(ORDINARY),
    });
  });

  it.each([
    ["empty", ""],
    ["0", "0"],
    ["true", "true"],
    ["yes", "yes"],
    ["gzip, as the standard header would say it", "gzip"],
    ["a list of encodings", "gzip, deflate, br"],
    ["1 with a space after it", "1 "],
    ["1 twice, as two headers of the name are handed over", "1,1"],
    ["1.0", "1.0"],
    ["01", "01"],
  ])(
    "sends the answer as it is when the header has another value: %s",
    (_what, value) => {
      expect(prepareJson(ORDINARY, value)).toEqual({
        prepared: { encoding: "identity", text: ORDINARY },
        sentBytes: Buffer.byteLength(ORDINARY),
      });
      expect(acceptsGzip(value)).toBe(false);
    },
  );

  it("sends an answer of 1 kilobyte or less as it is", () => {
    const atTheLimit = JSON.stringify({
      name: "a".repeat(COMPRESS_ABOVE_BYTES - 11),
    });
    const justOver = JSON.stringify({
      name: "a".repeat(COMPRESS_ABOVE_BYTES - 10),
    });

    expect(COMPRESS_ABOVE_BYTES).toBe(1_024);
    expect(Buffer.byteLength(atTheLimit)).toBe(COMPRESS_ABOVE_BYTES);
    expect(prepareJson(atTheLimit, "1").prepared.encoding).toBe("identity");
    expect(prepareJson(justOver, "1").prepared.encoding).toBe("gzip");
  });

  it("sends the answer as it is when the encoded compressed form would be the larger", () => {
    const { prepared, sentBytes } = prepareJson(INCOMPRESSIBLE, "1");

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

  it("takes the header X-Accept-Gzip, present with exactly the value 1, as the caller accepting gzip, and nothing else", () => {
    expect(ACCEPT_GZIP_HEADER).toBe("x-accept-gzip");
    expect(ACCEPT_GZIP_HEADER_NAME.toLowerCase()).toBe(ACCEPT_GZIP_HEADER);
    expect(ACCEPT_GZIP_VALUE).toBe("1");
    expect(acceptsGzip("1")).toBe(true);
    expect(acceptsGzip(undefined)).toBe(false);
  });
});

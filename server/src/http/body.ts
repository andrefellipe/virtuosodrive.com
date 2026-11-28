import { gzipSync } from "node:zlib";
import type { PreparedBody } from "./operation.ts";

/**
 * Whether an answer is worth compressing (performance design P22).
 *
 * The edge does not compress answers it is told not to keep, and the entry
 * point does not compress at all, so the server does, with the platform's
 * own gzip. A compressed body cannot travel as text between the server and
 * its platform: it is carried in base64, one third larger than the
 * compressed bytes. A plain body grows too, because every quotation mark and
 * backslash in it is written as two characters. So the two forms are
 * compared as they are handed over, and the smaller one is sent.
 */

/** A plain answer of this size or less is sent as it is. */
export const COMPRESS_ABOVE_BYTES = 1_024;

/**
 * Whether the caller accepts gzip: the header names it, and not with a
 * weight of zero. Nothing else in the header is looked at.
 */
export function acceptsGzip(acceptEncoding: string | undefined): boolean {
  if (acceptEncoding === undefined) {
    return false;
  }
  return acceptEncoding.split(",").some((entry) => {
    const [coding, ...parameters] = entry.split(";").map((part) => part.trim());
    if (coding?.toLowerCase() !== "gzip") {
      return false;
    }
    const weight = parameters.find((parameter) => /^q\s*=/i.test(parameter));
    return weight === undefined || Number(weight.split("=")[1]) > 0;
  });
}

/** The size of a plain body inside the response handed to the platform. */
export function plainHandedOverBytes(text: string): number {
  return Buffer.byteLength(JSON.stringify(text));
}

/** The size of a compressed body inside the response handed to the platform: base64, in quotes. */
export function encodedHandedOverBytes(compressedBytes: number): number {
  return Math.ceil(compressedBytes / 3) * 4 + 2;
}

export interface PreparedJson {
  prepared: PreparedBody;
  /** The size of the body as the caller receives it. */
  sentBytes: number;
}

/**
 * Prepares JSON text for sending: compressed when all three hold, the caller
 * accepts gzip, the plain text is over 1 kilobyte, and the compressed form as
 * handed over is the smaller; otherwise as it is.
 */
export function prepareJson(
  text: string,
  acceptEncoding: string | undefined,
): PreparedJson {
  const plainBytes = Buffer.byteLength(text);
  const plain: PreparedJson = {
    prepared: { encoding: "identity", text },
    sentBytes: plainBytes,
  };
  if (!acceptsGzip(acceptEncoding) || plainBytes <= COMPRESS_ABOVE_BYTES) {
    return plain;
  }
  const bytes = gzipSync(text);
  if (encodedHandedOverBytes(bytes.length) >= plainHandedOverBytes(text)) {
    return plain;
  }
  return { prepared: { encoding: "gzip", bytes }, sentBytes: bytes.length };
}

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
 * The request header by which a caller says it can read a gzip answer, in
 * the lower case the entry point hands headers over in, and the one value
 * that says so.
 *
 * It is a header of the project's own, and not the standard
 * "Accept-Encoding", because the edge cannot be made to pass the standard
 * one to the server: AWS refuses it in the rule that lists the headers
 * passed on while nothing is kept at the edge ("The parameter Headers
 * contains Accept-Encoding that is not allowed", 2026-11-28). The server
 * does not read "Accept-Encoding" at all. The page and the pipeline's checks
 * send this header; a caller that does not, such as a person with a plain
 * command-line client, gets the plain answer.
 */
export const ACCEPT_GZIP_HEADER = "x-accept-gzip";
export const ACCEPT_GZIP_VALUE = "1";

/** The header's name as it is written in a `Vary` header and in documents. */
export const ACCEPT_GZIP_HEADER_NAME = "X-Accept-Gzip";

/**
 * Whether the caller says it accepts gzip: the header is there with exactly
 * the value "1". Absent, or with any other value, it does not.
 */
export function acceptsGzip(acceptGzip: string | undefined): boolean {
  return acceptGzip === ACCEPT_GZIP_VALUE;
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
 * handed over is the smaller; otherwise as it is. `acceptGzip` is the value
 * of the caller's X-Accept-Gzip header, as it came.
 */
export function prepareJson(
  text: string,
  acceptGzip: string | undefined,
): PreparedJson {
  const plainBytes = Buffer.byteLength(text);
  const plain: PreparedJson = {
    prepared: { encoding: "identity", text },
    sentBytes: plainBytes,
  };
  if (!acceptsGzip(acceptGzip) || plainBytes <= COMPRESS_ABOVE_BYTES) {
    return plain;
  }
  const bytes = gzipSync(text);
  if (encodedHandedOverBytes(bytes.length) >= plainHandedOverBytes(text)) {
    return plain;
  }
  return { prepared: { encoding: "gzip", bytes }, sentBytes: bytes.length };
}

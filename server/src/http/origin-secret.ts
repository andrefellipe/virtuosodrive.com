import { createHash, timingSafeEqual } from "node:crypto";

/** The header the edge adds to every request it forwards (security design S2). */
export const ORIGIN_SECRET_HEADER = "x-origin-verify";

/** After a mismatch the secret is read again at most this often. */
export const REREAD_INTERVAL_MS = 60_000;

/** Reads the current secret from where secrets are held. */
export type SecretReader = () => Promise<string>;

export interface OriginCheck {
  allowed: boolean;
  /** Set when reading the secret again failed; for the log entry. */
  rereadError?: unknown;
}

function equalInConstantTime(left: string, right: string): boolean {
  // Hashing first makes both sides the same length, which timingSafeEqual needs.
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

/**
 * Checks that a request came through the edge. The secret is read once per
 * running copy and kept. When it is replaced, running copies still hold the
 * old value; so on a mismatch the secret is read again (at most once a
 * minute) and compared once more before refusing.
 */
export class OriginSecretVerifier {
  private held: string | undefined;
  private lastReadAt = Number.NEGATIVE_INFINITY;
  private readonly read: SecretReader;
  private readonly now: () => number;

  constructor(read: SecretReader, now: () => number = Date.now) {
    this.read = read;
    this.now = now;
  }

  async check(presented: string | undefined): Promise<OriginCheck> {
    if (presented === undefined || presented === "") {
      return { allowed: false };
    }
    if (this.held === undefined) {
      // A failure here is not caught: a copy that cannot read its secret
      // cannot tell who is asking, and the request fails as a server error.
      await this.load();
    }
    if (equalInConstantTime(presented, this.held as string)) {
      return { allowed: true };
    }
    if (this.now() - this.lastReadAt < REREAD_INTERVAL_MS) {
      return { allowed: false };
    }
    try {
      await this.load();
    } catch (error) {
      // The value held is still the best known; refuse, and say why in the log.
      this.lastReadAt = this.now();
      return { allowed: false, rereadError: error };
    }
    return { allowed: equalInConstantTime(presented, this.held as string) };
  }

  private async load(): Promise<void> {
    const value = await this.read();
    if (value === "") {
      throw new Error("The origin secret is empty");
    }
    this.held = value;
    this.lastReadAt = this.now();
  }
}

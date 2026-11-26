/**
 * The change runner's decision whether to create the database users. Users
 * are created only when signing in as "migrator" is refused AND the master
 * sign-in confirms that neither user exists (a new environment). Anything
 * else is left alone and reported.
 */

/** PostgreSQL's codes for "this sign-in is not accepted". */
const SIGN_IN_REFUSED = new Set(["28000", "28P01"]);

/** Whether an error from connecting means the sign-in itself was refused. */
export function isSignInRefusal(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  const code = (error as { code: unknown }).code;
  return typeof code === "string" && SIGN_IN_REFUSED.has(code);
}

export interface ExistingUsers {
  migrator: boolean;
  app: boolean;
}

export type UserDecision =
  { action: "create" } | { action: "stop"; reason: string };

/** What to do once "migrator" could not sign in and the master sign-in has looked. */
export function decideUserCreation(existing: ExistingUsers): UserDecision {
  if (!existing.migrator && !existing.app) {
    return { action: "create" };
  }
  if (existing.migrator && existing.app) {
    return {
      action: "stop",
      reason:
        'The user "migrator" exists but could not sign in. Nothing was created or changed; check its sign-in by AWS identity.',
    };
  }
  const present = existing.migrator ? "migrator" : "app";
  const missing = existing.migrator ? "app" : "migrator";
  return {
    action: "stop",
    reason: `The user "${present}" exists but "${missing}" does not. Nothing was created or changed; the users must be put right by hand.`,
  };
}

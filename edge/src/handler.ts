import { handleRequest, refusal } from "./gate.ts";
import type {
  EdgeEvent,
  EdgeRequest,
  EdgeResponse,
  GateSettings,
} from "./gate.ts";

/**
 * The edge function's entry. The build compiles this file to the JavaScript
 * the edge requires and adds the global "handler" the service calls.
 *
 * The two values below are placeholders in the built file. Terraform fills
 * in the SHA-256 of the environment's access password and the on/off flag
 * when it deploys the function. An unfilled placeholder can never be
 * matched, so a function deployed without its values lets through nothing
 * but the health check.
 */
const settings: GateSettings = {
  enabled: "__VD_GATE_ENABLED__",
  accessHash: "__VD_ACCESS_HASH__",
};

/** The part of the edge runtime's "crypto" module the gate uses. */
export interface EdgeCrypto {
  createHash(algorithm: "sha256"): {
    update(text: string): { digest(encoding: "hex"): string };
  };
}

export function createHandler(
  crypto: EdgeCrypto,
): (event: EdgeEvent) => EdgeRequest | EdgeResponse {
  return function (event: EdgeEvent): EdgeRequest | EdgeResponse {
    try {
      return handleRequest(event, settings, {
        sha256Hex: function (text: string): string {
          return crypto.createHash("sha256").update(text).digest("hex");
        },
        log: function (line: string): void {
          console.log(line);
        },
        now: function (): Date {
          return new Date();
        },
      });
    } catch (error) {
      // Refuse when in doubt.
      console.log(
        JSON.stringify({
          level: "error",
          operation: "access refused",
          outcome: 401,
          error: String(error),
        }),
      );
      return refusal();
    }
  };
}

import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import type { SecretReader } from "../http/origin-secret.ts";

/** The one call the server makes to Secrets Manager; tests pass in a fake. */
export interface SecretsClient {
  send(command: GetSecretValueCommand): Promise<{ SecretString?: string }>;
}

/** Reads one secret's current text value. */
export function secretReader(
  client: SecretsClient,
  secretId: string,
): SecretReader {
  return async () => {
    const answer = await client.send(
      new GetSecretValueCommand({ SecretId: secretId }),
    );
    if (answer.SecretString === undefined || answer.SecretString === "") {
      throw new Error("The secret has no text value");
    }
    return answer.SecretString;
  };
}

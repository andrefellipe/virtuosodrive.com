import type { BrowserContext } from "@playwright/test";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is not set. The end-to-end tests need a deployed environment.`,
    );
  }
  return value;
}

export const baseUrl = (): string => required("VD_BASE_URL");
export const expectedEnvironment = (): string => required("VD_ENVIRONMENT");
export const expectedVersion = (): string | undefined =>
  process.env.VD_EXPECTED_VERSION === ""
    ? undefined
    : process.env.VD_EXPECTED_VERSION;

export const SITE_INFORMATION = "**/v1/site-information";

/** Gives the browser the access password, as a device that was given it has it. */
export async function giveAccess(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: "vd_access",
      value: required("VD_ACCESS_PASSWORD"),
      url: baseUrl(),
      secure: true,
      sameSite: "Strict",
    },
  ]);
}

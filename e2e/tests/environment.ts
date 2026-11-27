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

/** The environment's access password, for the tests that type it as a person would. */
export const accessPassword = (): string => required("VD_ACCESS_PASSWORD");

export const SITE_INFORMATION = "**/v1/site-information";

/** The cookie the password page stores what was typed in. */
export const ACCESS_COOKIE = "vd_access";

/** Where the access gate answers the password page's script and style. */
export const PASSWORD_PAGE_SCRIPT = "/access-password.js";
export const PASSWORD_PAGE_STYLE = "/access-password.css";

/** Gives the browser the access password, as a device that was given it has it. */
export async function giveAccess(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: ACCESS_COOKIE,
      value: accessPassword(),
      url: baseUrl(),
      secure: true,
      sameSite: "Strict",
    },
  ]);
}

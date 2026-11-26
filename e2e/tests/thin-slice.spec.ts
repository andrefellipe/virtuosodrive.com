import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  baseUrl,
  expectedEnvironment,
  expectedVersion,
  giveAccess,
  SITE_INFORMATION,
} from "./environment.ts";

/**
 * The thin slice, end to end, against a deployed environment. This file is
 * the working example later Units copy for an end-to-end test: elements are
 * found by data-testid or by role, the access password is given as a cookie,
 * and the server is blocked with page.route() to reach the failure views.
 */

const statusLine = (page: Page) => page.getByTestId("site-status-line");
const retryButton = (page: Page) =>
  page.getByTestId("site-status-retry-button");

async function expectNoAccessibilityViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([]);
}

test.describe("the thin slice", () => {
  test("the page shows the answered view with the version and the environment", async ({
    page,
    context,
  }) => {
    await giveAccess(context);

    await page.goto("/");

    await expect(page).toHaveTitle("Virtuoso Drive");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Virtuoso Drive",
    );
    await expect(statusLine(page)).toHaveText(
      "The server and database answered.",
    );
    await expect(page.getByTestId("site-status-environment")).toHaveText(
      expectedEnvironment(),
    );
    const version = page.getByTestId("site-status-version");
    await expect(version).not.toBeEmpty();
    const expected = expectedVersion();
    if (expected !== undefined) {
      await expect(version).toHaveText(expected);
    }
    await expect(retryButton(page)).toHaveCount(0);
  });

  test("the could-not-reach view appears when the server is blocked, and Try again works by keyboard", async ({
    page,
    context,
  }) => {
    await giveAccess(context);
    let attempts = 0;
    await page.route(SITE_INFORMATION, (route) => {
      attempts += 1;
      return route.abort("connectionfailed");
    });

    await page.goto("/");
    await expect(statusLine(page)).toHaveText("Checking the server…");

    // Three tries, 1 and 3 seconds apart, before the page gives up.
    await expect(statusLine(page)).toHaveText(
      "The server could not be reached.",
      { timeout: 30_000 },
    );
    expect(attempts).toBe(3);
    await expect(retryButton(page)).toBeFocused();
    await expect(page.getByTestId("site-status-request-id")).toContainText(
      /Request identifier: [A-Za-z0-9-]{1,64}$/,
    );
    await expect(page.getByTestId("site-status-version")).toHaveCount(0);

    await page.unroute(SITE_INFORMATION);
    await page.keyboard.press("Enter");

    await expect(statusLine(page)).toHaveText(
      "The server and database answered.",
    );
    await expect(retryButton(page)).toHaveCount(0);
  });

  test("each view of the page, and the password page, pass the accessibility scan", async ({
    page,
    context,
    browser,
  }) => {
    await giveAccess(context);

    // Checking: the server's answer is held back.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(SITE_INFORMATION, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/");
    await expect(statusLine(page)).toHaveText("Checking the server…");
    await expectNoAccessibilityViolations(page);

    // Answered.
    release();
    await expect(statusLine(page)).toHaveText(
      "The server and database answered.",
    );
    await expectNoAccessibilityViolations(page);

    // Could not reach.
    await page.unroute(SITE_INFORMATION);
    await page.route(SITE_INFORMATION, (route) =>
      route.abort("connectionfailed"),
    );
    await page.reload();
    await expect(retryButton(page)).toBeVisible({ timeout: 30_000 });
    await expectNoAccessibilityViolations(page);

    // The password page: a device that has not been given the password.
    const stranger = await browser.newContext();
    try {
      const passwordPage = await stranger.newPage();
      const response = await passwordPage.goto(baseUrl());
      expect(response?.status()).toBe(401);
      await expect(
        passwordPage.getByTestId("access-password-input"),
      ).toBeVisible();
      await expectNoAccessibilityViolations(passwordPage);
    } finally {
      await stranger.close();
    }
  });

  test("the page contacts no address but the site's own", async ({
    page,
    context,
  }) => {
    await giveAccess(context);
    const site = new URL(baseUrl()).origin;
    const contacted: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol !== "data:" && url.protocol !== "blob:") {
        contacted.push(url.origin);
      }
    });

    await page.goto("/");
    await expect(statusLine(page)).toHaveText(
      "The server and database answered.",
    );
    await page.waitForLoadState("networkidle");

    expect(contacted.length).toBeGreaterThan(2);
    expect([...new Set(contacted)]).toEqual([site]);
  });

  test("without the access cookie the page and site information are refused, and health answers", async ({
    playwright,
  }) => {
    const stranger = await playwright.request.newContext({
      baseURL: baseUrl(),
    });
    try {
      const page = await stranger.get("/");
      const siteInformation = await stranger.get("/v1/site-information");
      const withWrongCookie = await stranger.get("/v1/site-information", {
        headers: { Cookie: "vd_access=NotThePassword" },
      });
      const health = await stranger.get("/v1/health");

      expect(page.status()).toBe(401);
      expect(await page.text()).toContain("Access password");
      expect(page.headers()["cache-control"]).toBe("no-store");
      expect(siteInformation.status()).toBe(401);
      expect(siteInformation.headers()["content-type"]).not.toContain(
        "application/problem+json",
      );
      expect(await siteInformation.text()).not.toContain("installedAt");
      expect(withWrongCookie.status()).toBe(401);
      expect(health.status()).toBe(200);
      expect(await health.json()).toEqual({ status: "ok" });
    } finally {
      await stranger.dispose();
    }
  });

  test("the entry document is never stored and fingerprinted files are stored for a year", async ({
    page,
    context,
  }) => {
    await giveAccess(context);

    const entry = await page.goto("/");
    expect(entry?.status()).toBe(200);
    expect(entry?.headers()["cache-control"]).toBe("no-store");

    // A page address that names no file is given the same entry document.
    const deepLink = await context.request.get("/folders/example");
    expect(deepLink.status()).toBe(200);
    expect(deepLink.headers()["cache-control"]).toBe("no-store");

    const html = await entry?.text();
    const fingerprinted = [
      ...(html ?? "").matchAll(/(?:src|href)="(\/r\/[^"]+\/assets\/[^"]+)"/g),
    ].map((match) => match[1] as string);
    expect(fingerprinted.length).toBeGreaterThanOrEqual(2);
    for (const path of fingerprinted) {
      expect(path).toMatch(/-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/);
      const file = await context.request.get(path);
      expect(file.status()).toBe(200);
      const cacheControl = file.headers()["cache-control"] ?? "";
      expect(cacheControl).toContain("max-age=31536000");
      expect(cacheControl).toContain("immutable");
    }

    const serverAnswer = await context.request.get("/v1/site-information");
    expect(serverAnswer.headers()["cache-control"]).toBe("no-store");
    expect(serverAnswer.headers()["x-request-id"]).toMatch(
      /^[A-Za-z0-9-]{1,64}$/,
    );
  });
});

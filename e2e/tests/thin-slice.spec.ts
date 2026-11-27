import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page, Response } from "@playwright/test";
import {
  ACCESS_COOKIE,
  accessPassword,
  baseUrl,
  expectedEnvironment,
  expectedVersion,
  giveAccess,
  PASSWORD_PAGE_SCRIPT,
  PASSWORD_PAGE_STYLE,
  SITE_INFORMATION,
} from "./environment.ts";

/**
 * The thin slice, end to end, against a deployed environment. This file is
 * the working example later Units copy for an end-to-end test: elements are
 * found by data-testid or by role, the access password is given as a cookie
 * (except in the two tests that type it into the password page, as a person
 * does), and the server is blocked with page.route() to reach the failure
 * views.
 */

const statusLine = (page: Page) => page.getByTestId("site-status-line");
const retryButton = (page: Page) =>
  page.getByTestId("site-status-retry-button");
const passwordInput = (page: Page) => page.getByTestId("access-password-input");
const passwordSubmit = (page: Page) =>
  page.getByTestId("access-password-submit");

async function expectAnsweredView(page: Page): Promise<void> {
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
}

/**
 * Collects, from before the page first opens and across every reload, what
 * the browser reports when its security policy blocks something: the
 * "securitypolicyviolation" events, the console's messages about the policy,
 * and errors thrown in the page. A blocked script or style shows up here.
 */
async function watchForBlockedContent(page: Page): Promise<string[]> {
  const reported: string[] = [];
  await page.exposeFunction("vdReportBlocked", (what: string) => {
    reported.push(`blocked by the security policy: ${what}`);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (
        window as unknown as { vdReportBlocked?: (what: string) => void }
      ).vdReportBlocked;
      if (report !== undefined) {
        report(`${event.effectiveDirective} ${event.blockedURI}`);
      }
    });
  });
  page.on("console", (message) => {
    // A 401 answer is itself a console error in some engines; only what the
    // console says about the security policy counts here.
    if (/content[ -]security[ -]policy/i.test(message.text())) {
      reported.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    reported.push(`error in the page: ${error.message}`);
  });
  return reported;
}

/** The page's next answer to a request for a document, such as a reload. */
function nextDocument(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().isNavigationRequest() &&
      response.request().frame() === page.mainFrame(),
  );
}

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

    await expectAnsweredView(page);
  });

  test("a person without the access cookie types the password into the password page and gets in", async ({
    page,
    context,
  }) => {
    const blocked = await watchForBlockedContent(page);

    const refused = await page.goto("/");
    expect(refused?.status()).toBe(401);
    await expect(passwordInput(page)).toBeVisible();
    await expect(page.getByLabel("Access password")).toBeVisible();

    await passwordInput(page).fill(accessPassword());
    await passwordSubmit(page).click();

    await expectAnsweredView(page);
    // What was typed is nowhere in the address.
    expect(new URL(page.url()).search).toBe("");
    expect(page.url()).not.toContain(accessPassword());
    // Neither the password page's script and style nor the page's own were blocked.
    expect(blocked).toEqual([]);
    const cookie = (await context.cookies()).find(
      (candidate) => candidate.name === ACCESS_COOKIE,
    );
    expect(cookie).toBeDefined();
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe("Strict");
    expect(cookie?.path).toBe("/");
  });

  test("a wrong password shows the password page again, with nothing in the address", async ({
    page,
  }) => {
    const blocked = await watchForBlockedContent(page);
    // Made up, and of the shape a password has; not a password of any environment.
    const wrongPassword = "NotThePassword0Placeholder0Only0";

    // Opened with a query, as the earlier password page left the address.
    const refused = await page.goto("/?access-password=left-by-an-earlier-try");
    expect(refused?.status()).toBe(401);

    const again = nextDocument(page);
    await passwordInput(page).fill(wrongPassword);
    await passwordSubmit(page).click();

    expect((await again).status()).toBe(401);
    await expect(passwordInput(page)).toBeVisible();
    await expect(passwordInput(page)).toHaveValue("");
    await expect(statusLine(page)).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
    expect(page.url()).not.toContain(wrongPassword);
    expect(blocked).toEqual([]);
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
      await expect(passwordInput(passwordPage)).toBeVisible();
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

  test("without the access cookie the page and site information are refused, and health and the password page's two files answer", async ({
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

      // The password page has no script or style inside it, and refers to
      // two files the gate answers to anyone. They hold nothing secret.
      const html = await page.text();
      expect(html).toContain(`src="${PASSWORD_PAGE_SCRIPT}"`);
      expect(html).toContain(`href="${PASSWORD_PAGE_STYLE}"`);
      expect(html).not.toMatch(/<style\b|<script\b[^>]*>[^<]/);
      const fingerprint = createHash("sha256")
        .update(accessPassword())
        .digest("hex");
      const files = [
        [PASSWORD_PAGE_SCRIPT, "text/javascript; charset=utf-8"],
        [PASSWORD_PAGE_STYLE, "text/css; charset=utf-8"],
      ] as const;
      for (const [path, contentType] of files) {
        const file = await stranger.get(path);
        expect(file.status()).toBe(200);
        expect(file.headers()["content-type"]).toBe(contentType);
        expect(file.headers()["cache-control"]).toBe("no-store");
        const text = await file.text();
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toContain(accessPassword());
        expect(text).not.toContain(fingerprint);
      }
      expect(html).not.toContain(accessPassword());
      expect(html).not.toContain(fingerprint);
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

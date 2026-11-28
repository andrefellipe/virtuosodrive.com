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
} from "./environment.ts";

/** The server's folder route, which the page asks as it opens. */
const FOLDERS = "**/v1/folders/**";

/**
 * The thin slice, end to end, against a deployed environment. This file is
 * the working example later Units copy for an end-to-end test: elements are
 * found by data-testid or by role, the access password is given as a cookie
 * (except in the two tests that type it into the password page, as a person
 * does), and the server is blocked with page.route() to reach the failure
 * views.
 *
 * Changed by Unit U3, and only where the page no longer shows the thin
 * slice's status view: the page's first screen is now the folder list. What
 * each test proves about the pipeline, the access gate and the server is as
 * it was. Each change is marked "U3:" where it is made.
 *
 * Three tests here ask the environment directly and do not depend on what
 * the page shows. They carry the tag "@later-server": after a later Release
 * is deployed to test, the pipeline runs these tests of the Release in
 * production against it (scripts/src/earlier-release-tests.ts).
 */

// U3: the status view's line is no longer on the page; the folder list is.
const folderList = (page: Page) => page.getByTestId("file-list");
const folderScreen = (page: Page) => page.getByTestId("folder-screen");
const retryButton = (page: Page) => page.getByTestId("file-list-retry");
const passwordInput = (page: Page) => page.getByTestId("access-password-input");
const passwordSubmit = (page: Page) =>
  page.getByTestId("access-password-submit");

// U3: was "the answered view", with the version and the environment read
// from the status view. The page now shows "All"; the version and the
// environment are asked of the server directly, in the first test.
async function expectPageShown(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Virtuoso Drive",
  );
  await expect(folderList(page)).toHaveAttribute(
    "data-state",
    /^(populated|empty)$/,
  );
  await expect(page).toHaveTitle("All");
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
  // U3: was "the page shows the answered view with the version and the
  // environment". The page no longer shows them; the server still answers
  // with them, and that the right Release runs is still proved here.
  test("the page shows the folder list, and the server answers with the version and the environment", async ({
    page,
    context,
  }) => {
    await giveAccess(context);

    await page.goto("/");

    await expectPageShown(page);
    const answer = await context.request.get("/v1/site-information");
    expect(answer.status()).toBe(200);
    const status = (await answer.json()) as {
      version: string;
      environment: string;
    };
    expect(status.environment).toBe(expectedEnvironment());
    expect(status.version).not.toBe("");
    const expected = expectedVersion();
    if (expected !== undefined) {
      expect(status.version).toBe(expected);
    }
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

    // U3: the page a person gets into is the folder list.
    await expectPageShown(page);
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

  test(
    "a wrong password shows the password page again, with nothing in the address",
    {
      tag: "@later-server",
    },
    async ({ page }) => {
      const blocked = await watchForBlockedContent(page);
      // Made up, and of the shape a password has; not a password of any environment.
      const wrongPassword = "NotThePassword0Placeholder0Only0";

      // Opened with a query, as the earlier password page left the address.
      const refused = await page.goto(
        "/?access-password=left-by-an-earlier-try",
      );
      expect(refused?.status()).toBe(401);

      const again = nextDocument(page);
      await passwordInput(page).fill(wrongPassword);
      await passwordSubmit(page).click();

      expect((await again).status()).toBe(401);
      await expect(passwordInput(page)).toBeVisible();
      await expect(passwordInput(page)).toHaveValue("");
      // U3: nothing of the page itself is shown, whichever Release's page it is.
      await expect(page.getByTestId("site-status-line")).toHaveCount(0);
      await expect(folderScreen(page)).toHaveCount(0);
      expect(new URL(page.url()).search).toBe("");
      expect(page.url()).not.toContain(wrongPassword);
      expect(blocked).toEqual([]);
    },
  );

  // U3: was "the could-not-reach view appears when the server is blocked, and
  // Try again works by keyboard", on the status view. The same is proved of
  // what the page shows now: the page's call to the server gives up after
  // three tries, and "Try again" works by keyboard. Two things the status
  // view had and the list has not are no longer asserted: the request
  // identifier shown to the visitor, and the focus moved to "Try again" by
  // itself (the list's design asks for neither).
  test("the could-not-load view appears when the server is blocked, and Try again works by keyboard", async ({
    page,
    context,
  }) => {
    await giveAccess(context);
    let attempts = 0;
    await page.route(FOLDERS, (route) => {
      attempts += 1;
      return route.abort("connectionfailed");
    });

    await page.goto("/");
    await expect(folderList(page)).toHaveAttribute("data-state", "loading");

    // Three tries, 1 and 3 seconds apart, before the page gives up.
    await expect(page.getByTestId("file-list-failed")).toContainText(
      "The list could not be loaded.",
      { timeout: 30_000 },
    );
    expect(attempts).toBe(3);
    await expect(page.getByTestId("file-row")).toHaveCount(0);

    await page.unroute(FOLDERS);
    await retryButton(page).focus();
    await page.keyboard.press("Enter");

    await expectPageShown(page);
  });

  // U3: was "each view of the page, and the password page, pass the
  // accessibility scan", over the three views of the status view. The views
  // of the folder list are scanned one by one in browsing.spec.ts; here the
  // page as it opens, and the password page, as before.
  test("the page as it opens, and the password page, pass the accessibility scan", async ({
    page,
    context,
    browser,
  }) => {
    await giveAccess(context);

    await page.goto("/");
    await expectPageShown(page);
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
    await expectPageShown(page);
    await page.waitForLoadState("networkidle");

    // U3: the check now also opens a folder, so that the icons of every kind
    // of row are fetched and covered. In an environment without sample
    // content ("All" is empty in production until the migration) there is
    // no folder to open, and the page as it opens is what is checked.
    const sample = page
      .getByTestId("file-row")
      .filter({ hasText: "One of each kind" });
    if ((await sample.count()) > 0) {
      await sample.dblclick();
      await expect(page.getByTestId("breadcrumb-current")).toHaveText(
        "One of each kind",
      );
      await expect(page.getByTestId("file-row").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      // The folder's own request, and an icon for each kind of row.
      expect(contacted.length).toBeGreaterThan(10);
    }

    expect(contacted.length).toBeGreaterThan(2);
    expect([...new Set(contacted)]).toEqual([site]);
  });

  test(
    "without the access cookie the page and site information are refused, and health and the password page's two files answer",
    {
      tag: "@later-server",
    },
    async ({ playwright }) => {
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
    },
  );

  test(
    "the entry document is never stored and fingerprinted files are stored for a year",
    {
      tag: "@later-server",
    },
    async ({ page, context }) => {
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
    },
  );
});

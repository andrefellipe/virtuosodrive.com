import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { baseUrl, giveAccess } from "./environment.ts";
import {
  breadcrumb,
  expectListShown,
  expectNoAccessibilityViolations,
  FOLDER_ROUTE,
  list,
  openAll,
  openFolder,
  openPath,
  row,
  rowNames,
  rows,
  SAMPLES,
  statusLine,
} from "./folders.ts";

/**
 * Browsing, end to end, against the test environment's sample content
 * (stories US1.1, US1.2, US1.3). Written with Unit U3 and first run by the
 * pipeline after its first deployment. Sample folders are found by walking
 * from "All" by name.
 */

/** Of the form of a generated identifier, and belonging to nothing. */
const NO_SUCH_FOLDER = "00000000-0000-4000-8000-000000000000";

const steps = (page: Page) => breadcrumb(page).getByRole("listitem");

test.describe("browsing", () => {
  test.beforeEach(async ({ context }) => {
    await giveAccess(context);
  });

  test('browse: open "All", go four folders down, come back by the breadcrumb, reload, back and forward', async ({
    page,
  }) => {
    await openAll(page);
    await expect(page).toHaveTitle("All");
    await expect(row(page, SAMPLES.fourDeep[0])).toBeVisible();
    await expect(statusLine(page)).toHaveText(/^Folder All, \d+ items?\.$/);

    // Down: "1º Período", then a folder whose name looks like a number with
    // an extension, "2019.1".
    for (const name of SAMPLES.fourDeep) {
      await openFolder(page, name);
      await expect(page).toHaveTitle(name);
      await expect(page).toHaveURL(/\/folders\/[0-9a-f-]{36}$/);
    }
    // A name never appears in an address.
    expect(decodeURIComponent(page.url())).not.toContain("Provas");
    expect(await rowNames(page)).toEqual([...SAMPLES.filesFourDeep]);
    // The whole path is shown at 1280; below 768 it is collapsed.
    const narrow = (page.viewportSize()?.width ?? 1280) < 768;
    if (narrow) {
      await expect(steps(page)).toHaveText([
        "All",
        "...",
        SAMPLES.fourDeep[2],
        SAMPLES.fourDeep[3],
      ]);
      await page.getByTestId("breadcrumb-more").click();
    }
    await expect(steps(page)).toHaveText(["All", ...SAMPLES.fourDeep]);
    const deepest = page.url();

    // A reload shows the same folder, from its address alone.
    await page.reload();
    await expectListShown(page);
    await expect(page.getByTestId("breadcrumb-current")).toHaveText(
      SAMPLES.fourDeep[3],
    );
    expect(await rowNames(page)).toEqual([...SAMPLES.filesFourDeep]);
    expect(page.url()).toBe(deepest);

    // Back by the breadcrumb: two steps up, to "Cálculo I".
    if (narrow) {
      await page.getByTestId("breadcrumb-more").click();
    }
    await breadcrumb(page)
      .getByRole("link", { name: SAMPLES.fourDeep[1], exact: true })
      .click();
    await expect(page.getByTestId("breadcrumb-current")).toHaveText(
      SAMPLES.fourDeep[1],
    );
    await expectListShown(page);
    await expect(row(page, SAMPLES.fourDeep[2])).toBeVisible();
    await expect(list(page)).toBeFocused();

    // The browser's back returns to the deepest folder; forward comes back.
    await page.goBack();
    await expect(page.getByTestId("breadcrumb-current")).toHaveText(
      SAMPLES.fourDeep[3],
    );
    expect(page.url()).toBe(deepest);
    await page.goForward();
    await expect(page.getByTestId("breadcrumb-current")).toHaveText(
      SAMPLES.fourDeep[1],
    );

    // And "All" by the breadcrumb has the plain address.
    await breadcrumb(page)
      .getByRole("link", { name: "All", exact: true })
      .click();
    await expect(steps(page)).toHaveText(["All"]);
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("the views of the list: loading, populated, empty, could not load and not found, each passing the accessibility scan", async ({
    page,
  }) => {
    // Loading: the server's answer is held back.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(FOLDER_ROUTE, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/");
    await expect(list(page)).toHaveAttribute("data-state", "loading");
    await expect(page.getByTestId("file-row-placeholder")).toHaveCount(3);
    await expect(steps(page)).toHaveText(["All"]);
    await expectNoAccessibilityViolations(page);

    // Populated, with and without a selection.
    release();
    await page.unroute(FOLDER_ROUTE);
    await expect(list(page)).toHaveAttribute("data-state", "populated");
    await expect(page.getByTestId("file-row-placeholder")).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
    await row(page, SAMPLES.twenty).click();
    await row(page, SAMPLES.empty).click({ modifiers: ["ControlOrMeta"] });
    await expect(statusLine(page)).toHaveText("2 items selected.");
    await expectNoAccessibilityViolations(page);

    // One of each kind: every icon has its text alternative.
    await openFolder(page, SAMPLES.kinds);
    const alternatives = await page
      .getByTestId("file-row-icon")
      .evaluateAll((icons) => icons.map((icon) => icon.getAttribute("alt")));
    for (const kind of [
      "Folder",
      "Text file",
      "Image",
      "PDF file",
      "Audio file",
      "Video file",
      "Word document",
      "Excel spreadsheet",
      "PowerPoint presentation",
      "Compressed file",
      "File",
    ]) {
      expect(alternatives).toContain(kind);
    }
    await expect(
      row(page, "empty.txt").getByTestId("file-row-size"),
    ).toHaveText("0 B");
    await expect(
      row(page, "lecture.mp4").getByTestId("file-row-icon"),
    ).toHaveAttribute("data-icon", "video");
    await expect(
      row(page, "unknown.bin").getByTestId("file-row-icon"),
    ).toHaveAttribute("data-icon", "default");
    // Every icon really loaded, from the site's own address.
    const broken = await page
      .getByTestId("file-row-icon")
      .evaluateAll(
        (icons) =>
          icons.filter((icon) => (icon as HTMLImageElement).naturalWidth === 0)
            .length,
      );
    expect(broken).toBe(0);
    await expectNoAccessibilityViolations(page);

    // Empty.
    await openAll(page);
    await openFolder(page, SAMPLES.empty);
    await expect(list(page)).toHaveAttribute("data-state", "empty");
    await expect(page.getByTestId("file-list-empty")).toHaveText(
      "This folder is empty.",
    );
    await expectNoAccessibilityViolations(page);

    // Could not load: the server's address is blocked in the browser. The
    // page tries three times, 1 and 3 seconds apart, before it gives up.
    let attempts = 0;
    await page.route(FOLDER_ROUTE, (route) => {
      attempts += 1;
      return route.abort("connectionfailed");
    });
    await page.reload();
    await expect(page.getByTestId("file-list-failed")).toContainText(
      "The list could not be loaded.",
      { timeout: 30_000 },
    );
    expect(attempts).toBe(3);
    // The breadcrumb still works: its steps are links with real addresses.
    await expect(breadcrumb(page).getByRole("listitem").first()).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.unroute(FOLDER_ROUTE);
    await page.getByTestId("file-list-retry").click();
    await expect(list(page)).toHaveAttribute("data-state", "empty");

    // Not found: an identifier that does not exist. No retry.
    let asked = 0;
    await page.route(FOLDER_ROUTE, (route) => {
      asked += 1;
      return route.continue();
    });
    await page.goto(`/folders/${NO_SUCH_FOLDER}`);
    await expect(page.getByTestId("file-list-not-found")).toContainText(
      "This folder does not exist or was deleted.",
    );
    expect(asked).toBe(1);
    await expectNoAccessibilityViolations(page);
    await page.getByTestId("file-list-open-top").click();
    await expectListShown(page);
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("the placeholder rows move only when the device has not asked for reduced motion", async ({
    page,
  }) => {
    const animation = () =>
      page
        .getByTestId("file-row-placeholder")
        .first()
        .locator(".placeholder-block")
        .first()
        .evaluate((block) => getComputedStyle(block).animationName);
    // The request is held and never answered, so the placeholders stay.
    await page.route(FOLDER_ROUTE, () => undefined);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByTestId("file-row-placeholder")).toHaveCount(3);
    expect(await animation()).toBe("none");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    expect(await animation()).toBe("placeholder-pulse");
  });

  test("the 500-item folder is listed whole, in order", async ({ page }) => {
    await openPath(page, [SAMPLES.fiveHundred]);

    await expect(rows(page)).toHaveCount(500);
    const names = await rowNames(page);
    expect(names[0]).toBe("Lecture notes 001.pdf");
    expect(names[499]).toBe("Lecture notes 500.pdf");
    await expect(statusLine(page)).toHaveText(
      `Folder ${SAMPLES.fiveHundred}, 500 items.`,
    );
  });

  test("names as text: the three sample names that look like markup are shown exactly as written, and nothing runs", async ({
    page,
  }) => {
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await openPath(page, [SAMPLES.names]);

    const names = await rowNames(page);
    for (const name of SAMPLES.markupNames) {
      expect(names).toContain(name);
      await expect(row(page, name)).toHaveCount(1);
    }
    // No element was made from a name.
    await expect(list(page).locator("b, script, img[src='x']")).toHaveCount(0);

    // The folder named like an image tag opens; its name is in the title,
    // the breadcrumb and the announcement, as text.
    const imageName = SAMPLES.markupNames[2];
    await openFolder(page, imageName);
    await expect(page).toHaveTitle(imageName);
    await expect(statusLine(page)).toHaveText(`Folder ${imageName}, 0 items.`);
    await expect(page.locator("img[src='x']")).toHaveCount(0);
    // An address carries the identifier only.
    expect(decodeURIComponent(page.url())).not.toContain("onerror");

    expect(dialogs).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("long names and a deep path never widen the page", async ({ page }) => {
    await openPath(page, [SAMPLES.names]);
    const widthOf = () =>
      page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        window: document.documentElement.clientWidth,
      }));

    // The 255-character name wraps inside its cell.
    const longest = (await rowNames(page)).find((name) => name.length === 255);
    expect(longest).toBeDefined();
    let width = await widthOf();
    expect(width.page).toBeLessThanOrEqual(width.window);

    // Twelve folders down.
    await openAll(page);
    for (let level = 1; level <= 12; level += 1) {
      await openFolder(page, `Level ${level} of twelve`);
    }
    width = await widthOf();
    expect(width.page).toBeLessThanOrEqual(width.window);
    await expect(row(page, "At the bottom.txt")).toBeVisible();
  });

  test("hidden items: the deleted sample file and folder are not listed, and an address that names no visible folder shows the not-found view", async ({
    page,
  }) => {
    await openPath(page, [SAMPLES.deletedThings]);

    expect(await rowNames(page)).toEqual([SAMPLES.stillHere]);
    await expect(row(page, SAMPLES.deletedFile)).toHaveCount(0);
    await expect(row(page, SAMPLES.deletedFolder)).toHaveCount(0);
    await expect(statusLine(page)).toHaveText(
      `Folder ${SAMPLES.deletedThings}, 1 item.`,
    );
    // Nothing in the answer tells of what is hidden.
    const answer = await page.request.get(
      `/v1/folders/${new URL(page.url()).pathname.split("/").at(-1)}`,
    );
    expect(await answer.text()).not.toMatch(/Deleted f|deleted|position/);

    await page.goto(`/folders/${NO_SUCH_FOLDER}`);
    await expect(page.getByTestId("file-list-not-found")).toBeVisible();
  });

  test(
    "no session: a folder is read with no session, and every answer is marked not to be stored",
    { tag: "@later-server" },
    async ({ playwright, context }) => {
      // The access password is what lets a device in while the environments
      // are private. It is no session: there is no sign-in in this Unit, and
      // reading must never come to need one (binding on Unit U2).
      const cookies = await context.cookies(baseUrl());
      const reader = await playwright.request.newContext({
        baseURL: baseUrl(),
        extraHTTPHeaders: {
          Cookie: cookies
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join("; "),
        },
      });
      try {
        const top = await reader.get("/v1/folders/root");
        expect(top.status()).toBe(200);
        expect(top.headers()["cache-control"]).toBe("no-store");
        const body = (await top.json()) as {
          folderId: string;
          name: string;
          path: unknown[];
          items: unknown[];
        };
        expect(body.name).toBe("All");
        expect(body.path).toHaveLength(1);
        expect(Array.isArray(body.items)).toBe(true);

        // Asked again with the version received: unchanged, and not stored.
        const version = top.headers().etag;
        expect(version).toBeTruthy();
        const again = await reader.get("/v1/folders/root", {
          headers: { "If-None-Match": version ?? "" },
        });
        expect(again.status()).toBe(304);
        expect(again.headers()["cache-control"]).toBe("no-store");

        // Not found, for an unknown and for a malformed identifier alike.
        const unknown = await reader.get(`/v1/folders/${NO_SUCH_FOLDER}`);
        const malformed = await reader.get("/v1/folders/not-an-identifier");
        expect(unknown.status()).toBe(404);
        expect(malformed.status()).toBe(404);
        expect(await malformed.json()).toEqual(await unknown.json());
        expect(unknown.headers()["cache-control"]).toBe("no-store");
      } finally {
        await reader.dispose();
      }
    },
  );
});

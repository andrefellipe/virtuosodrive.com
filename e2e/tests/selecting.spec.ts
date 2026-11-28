import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { giveAccess } from "./environment.ts";
import {
  actions,
  expectListShown,
  expectNoAccessibilityViolations,
  list,
  NOT_AVAILABLE_YET,
  openAll,
  openPath,
  row,
  rowNames,
  rows,
  SAMPLES,
  selectedNames,
  selectedRows,
  statusLine,
} from "./folders.ts";

/**
 * Selecting rows, end to end, against the test environment's sample content
 * (story US2.1): with a mouse, with the keyboard alone, and by touch. The
 * rows are those of the sample folder "Twenty items": "Exercise 01.pdf" to
 * "Exercise 20.pdf".
 */

const exercise = (number: number): string =>
  `Exercise ${String(number).padStart(2, "0")}.pdf`;
const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_unused, index) =>
    exercise(from + index),
  );

const BASIC = ["Upload", "New Folder"];
const FOR_ONE_FILE = [...BASIC, "Download", "Rename", "Delete"];
const FOR_SEVERAL = [...BASIC, "Download", "Delete"];

/** Presses a key as many times as asked. */
async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let pressed = 0; pressed < times; pressed += 1) {
    await page.keyboard.press(key);
  }
}

test.describe("selecting", () => {
  test.beforeEach(async ({ context }) => {
    await giveAccess(context);
  });

  test("select with a mouse: one row, two rows apart, a range of fifteen; the actions follow; an action says it is not available yet", async ({
    page,
  }) => {
    await openPath(page, [SAMPLES.twenty]);
    await expect(rows(page)).toHaveCount(20);
    expect(await actions(page)).toEqual(BASIC);

    // One row.
    await row(page, exercise(3)).click();
    expect(await selectedNames(page)).toEqual([exercise(3)]);
    await expect(statusLine(page)).toHaveText("1 item selected.");
    expect(await actions(page)).toEqual(FOR_ONE_FILE);
    // Shown by a mark as well as by colour, and said to assistive technology.
    await expect(row(page, exercise(3))).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const mark = row(page, exercise(3)).locator(
      '[data-testid="file-row-check"]:visible, [data-testid="file-row-tick"]:visible',
    );
    await expect(mark).toHaveCount(1);

    // Two rows apart: Ctrl or Command adds a row.
    await row(page, exercise(7)).click({ modifiers: ["ControlOrMeta"] });
    expect(await selectedNames(page)).toEqual([exercise(3), exercise(7)]);
    await expect(statusLine(page)).toHaveText("2 items selected.");
    expect(await actions(page)).toEqual(FOR_SEVERAL);
    // And removes it again.
    await row(page, exercise(3)).click({ modifiers: ["ControlOrMeta"] });
    expect(await selectedNames(page)).toEqual([exercise(7)]);

    // A range of fifteen: click one end, Shift-click the other.
    await row(page, exercise(2)).click();
    await row(page, exercise(16)).click({ modifiers: ["Shift"] });
    expect(await selectedNames(page)).toEqual(range(2, 16));
    await expect(statusLine(page)).toHaveText("15 items selected.");
    await expectNoAccessibilityViolations(page);

    // An action only says that it is not available yet; nothing is sent.
    let changeRequests = 0;
    page.on("request", (request) => {
      if (request.method() !== "GET") {
        changeRequests += 1;
      }
    });
    await page.getByTestId("action-delete").click();
    await expect(statusLine(page)).toHaveText(NOT_AVAILABLE_YET);
    await page.getByTestId("action-upload").click();
    await expect(statusLine(page)).toHaveText(NOT_AVAILABLE_YET);
    expect(await selectedNames(page)).toEqual(range(2, 16));
    await expect(rows(page)).toHaveCount(20);
    expect(changeRequests).toBe(0);

    // "Clear" empties the selection.
    await page.getByTestId("status-line-clear").click();
    await expect(selectedRows(page)).toHaveCount(0);
    expect(await actions(page)).toEqual(BASIC);

    // A folder alone: Download and Delete, not Rename.
    await openAll(page);
    await row(page, SAMPLES.empty).click();
    expect(await actions(page)).toEqual(FOR_SEVERAL);
  });

  test("browse and select with the keyboard only: three folders down, back by the breadcrumb, then the same selections, with no pointer", async ({
    page,
  }) => {
    /** Down to the folder of this name, wherever it is in the list, and Enter. */
    const openByKeyboard = async (name: string): Promise<void> => {
      // The list has the keyboard once a folder is shown.
      await expect(list(page)).toBeFocused();
      const place = (await rowNames(page)).indexOf(name);
      expect(place).toBeGreaterThanOrEqual(0);
      await press(page, "ArrowDown", place + 1);
      await expect(row(page, name)).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("breadcrumb-current")).toHaveText(name);
      await expectListShown(page);
    };

    await openAll(page);
    // Three folders down.
    for (const name of SAMPLES.fourDeep.slice(0, 3)) {
      await openByKeyboard(name);
    }
    // Back to "All" by the breadcrumb. The step is given the keyboard
    // directly and not by Tab, because one of the three engines skips links
    // when Tab is pressed unless its user has asked otherwise; Enter opens it.
    await page
      .getByTestId("breadcrumb")
      .getByRole("link", { name: "All", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("breadcrumb-current")).toHaveText("All");
    await expectListShown(page);

    await openByKeyboard(SAMPLES.twenty);
    await expect(list(page)).toBeFocused();

    // One row: move to it and press Space. The arrows alone select nothing.
    await press(page, "ArrowDown", 3);
    await expect(row(page, exercise(3))).toBeFocused();
    await expect(selectedRows(page)).toHaveCount(0);
    await page.keyboard.press("Space");
    expect(await selectedNames(page)).toEqual([exercise(3)]);
    expect(await actions(page)).toEqual(FOR_ONE_FILE);

    // Two rows apart: move on and press Space again.
    await press(page, "ArrowDown", 4);
    await page.keyboard.press("Space");
    expect(await selectedNames(page)).toEqual([exercise(3), exercise(7)]);
    await expect(statusLine(page)).toHaveText("2 items selected.");
    expect(await actions(page)).toEqual(FOR_SEVERAL);

    // Exactly one row: Escape, then Space.
    await page.keyboard.press("Escape");
    await expect(selectedRows(page)).toHaveCount(0);
    await press(page, "ArrowUp", 5);
    await page.keyboard.press("Space");
    expect(await selectedNames(page)).toEqual([exercise(2)]);

    // A range of fifteen: Shift with the arrow, fourteen times.
    await press(page, "Shift+ArrowDown", 14);
    expect(await selectedNames(page)).toEqual(range(2, 16));
    await expect(statusLine(page)).toHaveText("15 items selected.");
    await expect(row(page, exercise(16))).toBeFocused();
    await expectNoAccessibilityViolations(page);

    // Everything, and nothing.
    await page.keyboard.press("ControlOrMeta+a");
    await expect(selectedRows(page)).toHaveCount(20);
    // The Delete key chooses the Delete action, which says it is not available yet.
    await page.keyboard.press("Delete");
    await expect(statusLine(page)).toHaveText(NOT_AVAILABLE_YET);
    await expect(selectedRows(page)).toHaveCount(20);
    await page.keyboard.press("Escape");
    await expect(selectedRows(page)).toHaveCount(0);

    // The list is one Tab stop: of its twenty rows, one can be reached by
    // Tab, the row the keyboard is on. (That Tab then moves between the
    // page's controls is the browser's own; it is not pressed here, because
    // one of the three engines skips buttons by default.)
    await expect(
      list(page).locator('[data-testid="file-row"][tabindex="0"]'),
    ).toHaveCount(1);
    await expect(row(page, exercise(16))).toHaveAttribute("tabindex", "0");
  });

  test.describe("by touch", () => {
    test.use({ hasTouch: true });

    test("select by touch at 320 pixels: tick boxes, a tap on a name, Clear; everything that can be tapped is at least 44 by 44 pixels", async ({
      page,
      browserName,
    }) => {
      test.skip(
        (page.viewportSize()?.width ?? 0) !== 320,
        "The touch journey is the one at 320 pixels wide",
      );
      test.skip(
        browserName === "firefox",
        "Run in the two engines that phones use. Whether Firefox's emulated tap behaves as a finger's does has not been verified, so it is not relied on here",
      );

      await openAll(page);
      // A tap on a folder's name opens it.
      await row(page, SAMPLES.twenty).getByTestId("file-row-name").tap();
      await expect(page.getByTestId("breadcrumb-current")).toHaveText(
        SAMPLES.twenty,
      );
      await expectListShown(page);

      // Any set of rows, built one by one with the tick boxes.
      const tick = (number: number) =>
        row(page, exercise(number)).getByTestId("file-row-tick");
      await tick(2).tap();
      await tick(5).tap();
      await tick(9).tap();
      expect(await selectedNames(page)).toEqual([
        exercise(2),
        exercise(5),
        exercise(9),
      ]);
      await expect(tick(5)).toBeChecked();
      await expect(statusLine(page)).toHaveText("3 items selected.");
      expect(await actions(page)).toEqual(FOR_SEVERAL);
      await tick(5).tap();
      expect(await selectedNames(page)).toEqual([exercise(2), exercise(9)]);

      // Everything that can be tapped is at least 44 by 44 pixels.
      const tappable = [
        tick(2),
        ...(await page.getByTestId("action-bar").getByRole("button").all()),
        page.getByTestId("status-line-clear"),
        ...(await page.getByTestId("breadcrumb-step").all()),
      ];
      for (const control of tappable) {
        const box = await control.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      // Two actions to a line.
      const upload = await page.getByTestId("action-upload").boundingBox();
      const newFolder = await page
        .getByTestId("action-newFolder")
        .boundingBox();
      const download = await page.getByTestId("action-download").boundingBox();
      expect(upload?.y).toBe(newFolder?.y);
      expect(download?.y ?? 0).toBeGreaterThan(upload?.y ?? 0);
      await expectNoAccessibilityViolations(page);

      // "Clear" stands in for the Escape key a phone has not.
      await page.getByTestId("status-line-clear").tap();
      await expect(selectedRows(page)).toHaveCount(0);

      // A tap on a file's name selects it alone; a second says opening is
      // not available yet; a tap elsewhere on a row selects that row.
      await row(page, exercise(4)).getByTestId("file-row-name").tap();
      expect(await selectedNames(page)).toEqual([exercise(4)]);
      await row(page, exercise(4)).getByTestId("file-row-name").tap();
      await expect(statusLine(page)).toHaveText(
        "Opening files is not available yet.",
      );
      await row(page, exercise(6)).getByTestId("file-row-size").tap();
      expect(await selectedNames(page)).toEqual([exercise(6)]);

      // Nothing is wider than the screen.
      const width = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        window: document.documentElement.clientWidth,
      }));
      expect(width.page).toBeLessThanOrEqual(width.window);
    });
  });
});

import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/**
 * What the end-to-end tests of browsing and selecting share. They run
 * against the test environment's sample content
 * (db-migrate/src/samples/sample-set.json) and name here every sample entry
 * they use. A sample folder is always found by walking from "All" by name,
 * never by an identifier: identifiers are generated in each environment.
 */

/** The sample entries the tests use, by the names they have in the sample set. */
export const SAMPLES = {
  /** All / 1º Período / Cálculo I / 2019.1 / Provas: four folders down. */
  fourDeep: ["1º Período", "Cálculo I", "2019.1", "Provas"],
  filesFourDeep: ["P1.pdf", "P1 - gabarito.pdf"],
  twenty: "Twenty items",
  fiveHundred: "Five hundred items",
  empty: "Empty folder",
  kinds: "One of each kind",
  names: "Names",
  markupNames: [
    "<b>x<b>",
    "<script>alert(1)<script>",
    "<img src=x onerror=alert(1)>",
  ],
  deletedThings: "Deleted things",
  stillHere: "Still here.txt",
  deletedFile: "Deleted file.txt",
  deletedFolder: "Deleted folder",
} as const;

/** The server's folder route, for the tests that hold it back or block it. */
export const FOLDER_ROUTE = "**/v1/folders/**";

/**
 * What the page sends with every request for a folder: it tells the server
 * that a gzip answer can be read. A test that asks the server for a folder
 * itself, without the page, sends it too.
 */
export const ACCEPTS_GZIP = { "X-Accept-Gzip": "1" } as const;

export const NOT_AVAILABLE_YET = "This is not available yet.";

export const list = (page: Page): Locator => page.getByTestId("file-list");
export const rows = (page: Page): Locator => page.getByTestId("file-row");
export const statusLine = (page: Page): Locator =>
  page.getByTestId("status-line");
export const breadcrumb = (page: Page): Locator =>
  page.getByTestId("breadcrumb");
export const actionBar = (page: Page): Locator =>
  page.getByTestId("action-bar");

/** The row whose name is exactly this. */
export function row(page: Page, name: string): Locator {
  return rows(page).filter({
    has: page.getByTestId("file-row-name").getByText(name, { exact: true }),
  });
}

export const selectedRows = (page: Page): Locator =>
  page.locator('[data-testid="file-row"][aria-selected="true"]');

/** The names of the rows on screen, in order. */
export function rowNames(page: Page): Promise<string[]> {
  return page.getByTestId("file-row-name").allTextContents();
}

export function selectedNames(page: Page): Promise<string[]> {
  return selectedRows(page).getByTestId("file-row-name").allTextContents();
}

/** The actions offered now, by their visible text. */
export async function actions(page: Page): Promise<string[]> {
  const texts = await actionBar(page).getByRole("button").allTextContents();
  return texts.map((text) => text.trim());
}

/** Waits until the list shows a folder's rows, or says that it is empty. */
export async function expectListShown(page: Page): Promise<void> {
  await expect(list(page)).toHaveAttribute("data-state", /^(populated|empty)$/);
}

/** Opens "All" and waits for its list. */
export async function openAll(page: Page): Promise<void> {
  await page.goto("/");
  await expectListShown(page);
  await expect(breadcrumb(page).getByRole("listitem")).toHaveText(["All"]);
}

/** Opens the folder of this name from the list on screen, as a person with a mouse does. */
export async function openFolder(page: Page, name: string): Promise<void> {
  await row(page, name).dblclick();
  await expect(page.getByTestId("breadcrumb-current")).toHaveText(name);
  await expectListShown(page);
}

/** From "All", goes down through the folders of these names. */
export async function openPath(page: Page, names: readonly string[]) {
  await openAll(page);
  for (const name of names) {
    await openFolder(page, name);
  }
}

export async function expectNoAccessibilityViolations(
  page: Page,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([]);
}

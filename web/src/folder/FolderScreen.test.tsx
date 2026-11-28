// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadResult } from "../api/call-server.ts";
import type { FolderAnswer, FolderRow } from "../api/folder.ts";
import {
  FolderScreen,
  NOT_AVAILABLE_YET,
  OPENING_NOT_AVAILABLE_YET,
} from "./FolderScreen.tsx";

type Result = ReadResult<FolderAnswer>;

const TOP = "00000000-0000-4000-8000-00000000000a";
const CALCULUS = "00000000-0000-4000-8000-00000000000b";
const EXAMS = "00000000-0000-4000-8000-00000000000c";

const folderRow = (itemId: string, name: string): FolderRow => ({
  itemId,
  kind: "folder",
  name,
});
const fileRow = (itemId: string, name: string, size = 1_536): FolderRow => ({
  itemId,
  kind: "file",
  name,
  size,
  contentType: "application/pdf",
});

const TOP_ROWS: FolderRow[] = [
  folderRow(CALCULUS, "Calculus"),
  fileRow("file-1", "one.pdf"),
  fileRow("file-2", "two.pdf", 0),
  fileRow("file-3", "three.pdf", 5_767_168),
  folderRow("folder-2", "Physics"),
];

function answered(
  folderId: string,
  name: string,
  items: FolderRow[],
  path: { folderId: string; name: string }[] = [{ folderId: TOP, name: "All" }],
  version = '"v1"',
): Result {
  return {
    kind: "answered",
    requestId: "page-1",
    version,
    data: {
      folderId,
      name,
      path: folderId === TOP ? path : [...path, { folderId, name }],
      items,
    },
  };
}

const TOP_ANSWER = answered(TOP, "All", TOP_ROWS);
const NOT_FOUND: Result = {
  kind: "failed",
  requestId: "page-2",
  problemCode: "notFound",
};
const FAILED: Result = { kind: "failed", requestId: "page-3" };

/** A stand-in for the call to the server whose answers the test hands out one by one. */
function controlledRead() {
  const waiting: ((result: Result) => void)[] = [];
  const calls: { folderId: string; heldVersion: string | undefined }[] = [];
  return {
    read: (folderId: string, heldVersion?: string) => {
      calls.push({ folderId, heldVersion });
      return new Promise<Result>((resolve) => waiting.push(resolve));
    },
    /** Answers the oldest call still waiting, or the one at the given place. */
    answer: async (result: Result, place = 0) => {
      const [resolve] = waiting.splice(place, 1);
      if (resolve === undefined) {
        throw new Error("No call to the server is waiting for an answer");
      }
      await act(async () => {
        resolve(result);
        await Promise.resolve();
      });
    },
    calls,
    pending: () => waiting.length,
  };
}

async function openTop(result: Result = TOP_ANSWER) {
  const server = controlledRead();
  render(<FolderScreen read={server.read} />);
  await server.answer(result);
  return server;
}

const list = () => screen.getByTestId("file-list");
const rows = () => screen.queryAllByTestId("file-row");
const names = () =>
  screen.queryAllByTestId("file-row-name").map((cell) => cell.textContent);
const selectedNames = () =>
  rows()
    .filter((row) => row.getAttribute("aria-selected") === "true")
    .map((row) => within(row).getByTestId("file-row-name").textContent);
const status = () => screen.getByTestId("status-line").textContent;
const actions = () =>
  within(screen.getByTestId("action-bar"))
    .getAllByRole("button")
    .map((button) => button.textContent);
const steps = () =>
  within(screen.getByTestId("breadcrumb"))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
const row = (name: string): HTMLElement => {
  const found = rows().find(
    (candidate) =>
      within(candidate).getByTestId("file-row-name").textContent === name,
  );
  if (found === undefined) {
    throw new Error(`No row named "${name}" is shown`);
  }
  return found;
};
const press = (key: string, more: object = {}) =>
  fireEvent.keyDown(document.activeElement ?? list(), { key, ...more });

function becomeVisible() {
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function narrowScreen(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe("the folder screen", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    document.title = "Virtuoso Drive";
  });

  afterEach(() => {
    cleanup();
  });

  describe("the five states of the list", () => {
    it("loading: three placeholder rows, and the breadcrumb showing what is known", () => {
      const server = controlledRead();
      render(<FolderScreen read={server.read} />);

      expect(list().dataset.state).toBe("loading");
      expect(screen.getAllByTestId("file-row-placeholder")).toHaveLength(3);
      expect(rows()).toHaveLength(0);
      expect(steps()).toEqual(["All"]);
      expect(server.calls).toEqual([
        { folderId: "root", heldVersion: undefined },
      ]);
      expect(status()).toBe("");
    });

    it("populated: one row per item in the order given, with icon, name and size; the title, the announcement and the focus", async () => {
      await openTop();

      expect(list().dataset.state).toBe("populated");
      expect(names()).toEqual([
        "Calculus",
        "one.pdf",
        "two.pdf",
        "three.pdf",
        "Physics",
      ]);
      expect(
        screen.getAllByTestId("file-row-size").map((cell) => cell.textContent),
      ).toEqual(["", "1.50 kB", "0 B", "5.50 MB", ""]);
      expect(
        screen
          .getAllByTestId("file-row-icon")
          .map((icon) => icon.getAttribute("alt")),
      ).toEqual(["Folder", "PDF file", "PDF file", "PDF file", "Folder"]);
      expect(screen.queryAllByTestId("file-row-placeholder")).toHaveLength(0);
      expect(document.title).toBe("All");
      expect(status()).toBe("Folder All, 5 items.");
      expect(document.activeElement).toBe(list());
      // A native table with column headings, labelled with the folder's name.
      const table = screen.getByRole("grid", { name: "All" });
      expect(table.tagName).toBe("TABLE");
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((heading) => heading.textContent),
      ).toEqual(["Selected", "Kind", "Name", "Size"]);
    });

    it('empty: "This folder is empty." in place of the rows', async () => {
      await openTop(answered(TOP, "All", []));

      expect(list().dataset.state).toBe("empty");
      expect(screen.getByTestId("file-list-empty").textContent).toBe(
        "This folder is empty.",
      );
      expect(rows()).toHaveLength(0);
      expect(status()).toBe("Folder All, 0 items.");
    });

    it('failed: "The list could not be loaded." with Try again, which asks again; the breadcrumb still works', async () => {
      const server = await openTop(FAILED);

      expect(list().dataset.state).toBe("failed");
      expect(screen.getByTestId("file-list-failed").textContent).toContain(
        "The list could not be loaded.",
      );
      expect(steps()).toEqual(["All"]);
      expect(document.body.textContent).not.toContain("page-3");

      fireEvent.click(screen.getByTestId("file-list-retry"));

      expect(list().dataset.state).toBe("loading");
      expect(server.calls).toHaveLength(2);
      await server.answer(TOP_ANSWER);
      expect(names()).toHaveLength(5);
    });

    it('not found: its own view, with a link to "All", and no further try', async () => {
      window.history.replaceState(null, "", `/folders/${EXAMS}`);
      const server = await openTop(NOT_FOUND);

      expect(server.calls).toEqual([
        { folderId: EXAMS, heldVersion: undefined },
      ]);
      expect(list().dataset.state).toBe("notFound");
      expect(screen.getByTestId("file-list-not-found").textContent).toContain(
        "This folder does not exist or was deleted.",
      );
      expect(server.pending()).toBe(0);

      fireEvent.click(screen.getByTestId("file-list-open-top"));

      expect(window.location.pathname).toBe("/");
      expect(server.calls.at(-1)).toEqual({
        folderId: "root",
        heldVersion: undefined,
      });
    });

    it("stays on loading while the page reloads to ask for the access password", async () => {
      await openTop({ kind: "accessNeeded" });

      expect(list().dataset.state).toBe("loading");
    });
  });

  describe("names are text (security design S29)", () => {
    it("shows a row named <b>x</b> exactly as written, in the row, the title and the announcement", async () => {
      const markup = "<b>x</b>";
      const server = await openTop(
        answered(TOP, "All", [
          folderRow(CALCULUS, markup),
          fileRow("file-1", "<img src=x onerror=alert(1)>"),
        ]),
      );

      expect(names()).toEqual([markup, "<img src=x onerror=alert(1)>"]);
      expect(list().querySelector("b")).toBeNull();
      expect(list().querySelectorAll("img[src='x']")).toHaveLength(0);
      expect(
        within(row(markup)).getByRole("checkbox").getAttribute("aria-label"),
      ).toBe(`Select ${markup}`);

      fireEvent.doubleClick(row(markup));
      await server.answer(answered(CALCULUS, markup, []));

      expect(document.title).toBe(markup);
      expect(status()).toBe(`Folder ${markup}, 0 items.`);
      expect(steps()).toEqual(["All", markup]);
      expect(screen.getByTestId("folder-screen").querySelector("b")).toBeNull();
      // An address carries the identifier, never the name.
      expect(window.location.pathname).toBe(`/folders/${CALCULUS}`);
    });
  });

  describe("moving through folders", () => {
    it("opens a folder from its row: a new address, an empty selection, the known steps at once, then the answer", async () => {
      const server = await openTop();
      fireEvent.click(row("one.pdf"));
      expect(selectedNames()).toEqual(["one.pdf"]);

      fireEvent.doubleClick(row("Calculus"));

      expect(window.location.pathname).toBe(`/folders/${CALCULUS}`);
      expect(list().dataset.state).toBe("loading");
      expect(steps()).toEqual(["All", "Calculus"]);
      expect(server.calls.at(-1)).toEqual({
        folderId: CALCULUS,
        heldVersion: undefined,
      });

      await server.answer(
        answered(CALCULUS, "Calculus", [folderRow(EXAMS, "Exams")]),
      );

      expect(names()).toEqual(["Exams"]);
      expect(selectedNames()).toEqual([]);
      expect(document.title).toBe("Calculus");
      expect(status()).toBe("Folder Calculus, 1 item.");
      expect(document.activeElement).toBe(list());
    });

    it("opens an earlier step of the breadcrumb; the last step is text marked as the current page", async () => {
      window.history.replaceState(null, "", `/folders/${EXAMS}`);
      const server = await openTop(
        answered(
          EXAMS,
          "Exams",
          [],
          [
            { folderId: TOP, name: "All" },
            { folderId: CALCULUS, name: "Calculus" },
          ],
        ),
      );
      expect(steps()).toEqual(["All", "Calculus", "Exams"]);
      const current = screen.getByTestId("breadcrumb-current");
      expect(current.textContent).toBe("Exams");
      expect(current.getAttribute("aria-current")).toBe("page");
      const links = screen.getAllByTestId("breadcrumb-step");
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "/",
        `/folders/${CALCULUS}`,
      ]);

      fireEvent.click(links[1] as HTMLElement);

      expect(window.location.pathname).toBe(`/folders/${CALCULUS}`);
      expect(steps()).toEqual(["All", "Calculus"]);
      expect(server.calls.at(-1)?.folderId).toBe(CALCULUS);

      fireEvent.click(
        screen.getAllByTestId("breadcrumb-step")[0] as HTMLElement,
      );

      // "All" has one address, the plain one, and is asked for as root.
      expect(window.location.pathname).toBe("/");
      expect(server.calls.at(-1)?.folderId).toBe("root");
    });

    it("leaves a click on a breadcrumb step with a modifier key to the browser", async () => {
      window.history.replaceState(null, "", `/folders/${CALCULUS}`);
      const server = await openTop(answered(CALCULUS, "Calculus", []));

      fireEvent.click(screen.getByTestId("breadcrumb-step"), { ctrlKey: true });

      expect(window.location.pathname).toBe(`/folders/${CALCULUS}`);
      expect(server.calls).toHaveLength(1);
    });

    it("follows the browser's back and forward, showing the steps known for each entry", async () => {
      const server = await openTop();
      fireEvent.doubleClick(row("Calculus"));
      await server.answer(answered(CALCULUS, "Calculus", []));

      window.history.replaceState(null, "", "/");
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      });

      expect(list().dataset.state).toBe("loading");
      expect(steps()).toEqual(["All"]);
      expect(server.calls.at(-1)?.folderId).toBe("root");
      await server.answer(TOP_ANSWER);
      expect(names()).toHaveLength(5);
    });

    it("replaces the top folder's own identifier in the address with the plain address", async () => {
      window.history.replaceState(null, "", `/folders/${TOP}`);
      const before = window.history.length;

      const server = await openTop();

      expect(server.calls[0]?.folderId).toBe(TOP);
      expect(window.location.pathname).toBe("/");
      expect(window.history.length).toBe(before);
    });

    it("drops an answer that arrives for a folder the visitor has already left", async () => {
      const server = await openTop();
      fireEvent.doubleClick(row("Calculus"));
      // Before Calculus answers, the visitor goes on to "All" by the breadcrumb.
      fireEvent.click(screen.getByTestId("breadcrumb-step"));
      expect(server.pending()).toBe(2);

      // The later request is answered first, then the earlier one arrives late.
      await server.answer(answered(TOP, "All", [fileRow("f", "only.pdf")]), 1);
      await server.answer(
        answered(CALCULUS, "Calculus", [fileRow("late", "late.pdf")]),
      );

      expect(names()).toEqual(["only.pdf"]);
      expect(steps()).toEqual(["All"]);
      expect(document.title).toBe("All");
      expect(window.location.pathname).toBe("/");
    });
  });

  describe("the breadcrumb below 768 pixels", () => {
    const deep = (count: number) =>
      Array.from({ length: count }, (_unused, index) => ({
        folderId:
          index === 0 ? TOP : `00000000-0000-4000-8000-0000000000${index + 10}`,
        name: index === 0 ? "All" : `Level ${index}`,
      }));

    it('shows "All", "..." and the last two steps, and "..." reveals the rest', async () => {
      narrowScreen(true);
      window.history.replaceState(null, "", `/folders/${EXAMS}`);
      await openTop(answered(EXAMS, "Exams", [], deep(6)));

      expect(steps()).toEqual(["All", "...", "Level 5", "Exams"]);
      const more = screen.getByTestId("breadcrumb-more");
      expect(more.getAttribute("aria-label")).toBe("Show the whole path");

      fireEvent.click(more);

      expect(steps()).toEqual([
        "All",
        "Level 1",
        "Level 2",
        "Level 3",
        "Level 4",
        "Level 5",
        "Exams",
      ]);
      expect(screen.queryByTestId("breadcrumb-more")).toBeNull();
    });

    it("shows a short path whole, and every path whole on a wide screen", async () => {
      narrowScreen(true);
      window.history.replaceState(null, "", `/folders/${EXAMS}`);
      await openTop(answered(EXAMS, "Exams", [], deep(3)));
      expect(steps()).toEqual(["All", "Level 1", "Level 2", "Exams"]);
      cleanup();

      narrowScreen(false);
      await openTop(answered(EXAMS, "Exams", [], deep(6)));
      expect(steps()).toHaveLength(7);
      expect(screen.queryByTestId("breadcrumb-more")).toBeNull();
    });
  });

  describe("selecting with a mouse", () => {
    it("selects one row by a click, adds and removes by Ctrl or Command, and a range by Shift", async () => {
      await openTop();

      fireEvent.click(row("one.pdf"));
      expect(selectedNames()).toEqual(["one.pdf"]);
      expect(status()).toBe("1 item selected.");

      fireEvent.click(row("Physics"), { ctrlKey: true });
      expect(selectedNames()).toEqual(["one.pdf", "Physics"]);
      expect(status()).toBe("2 items selected.");

      fireEvent.click(row("one.pdf"), { metaKey: true });
      expect(selectedNames()).toEqual(["Physics"]);

      fireEvent.click(row("Calculus"), { shiftKey: true });
      // From the anchor, which the Command-click moved to "one.pdf".
      expect(selectedNames()).toEqual(["Calculus", "one.pdf"]);

      fireEvent.click(row("three.pdf"));
      expect(selectedNames()).toEqual(["three.pdf"]);
    });

    it("marks a selected row by a check mark and by its selected state, not by colour alone", async () => {
      await openTop();

      fireEvent.click(row("two.pdf"));

      const selected = row("two.pdf");
      expect(selected.getAttribute("aria-selected")).toBe("true");
      expect(selected.className).toContain("selected");
      expect(
        within(selected).getByTestId("file-row-check").getAttribute("alt"),
      ).toBe("Selected");
      expect(within(row("one.pdf")).queryByTestId("file-row-check")).toBeNull();
      expect(row("one.pdf").getAttribute("aria-selected")).toBe("false");
    });

    it("says that opening a file is not available yet, and selects it", async () => {
      const server = await openTop();

      fireEvent.doubleClick(row("two.pdf"));

      expect(status()).toBe(OPENING_NOT_AVAILABLE_YET);
      expect(selectedNames()).toEqual(["two.pdf"]);
      expect(server.calls).toHaveLength(1);
      expect(window.location.pathname).toBe("/");
    });

    it("empties the selection with the Clear control, which is there only while something is selected, and moves the keyboard to the list", async () => {
      await openTop();
      expect(screen.queryByTestId("status-line-clear")).toBeNull();
      fireEvent.click(row("one.pdf"));
      fireEvent.click(row("two.pdf"), { ctrlKey: true });

      const clear = screen.getByTestId("status-line-clear");
      clear.focus();
      fireEvent.click(clear);

      expect(selectedNames()).toEqual([]);
      expect(status()).toBe("Nothing is selected.");
      expect(screen.queryByTestId("status-line-clear")).toBeNull();
      expect(list().contains(document.activeElement)).toBe(true);
    });
  });

  describe("selecting with the keyboard only (rules BR4.6)", () => {
    it("is one Tab stop: only one row can be reached by Tab, the first until a row has the focus", async () => {
      await openTop();
      const tabStops = () =>
        rows().filter((candidate) => candidate.tabIndex === 0);

      expect(tabStops()).toEqual([row("Calculus")]);

      press("ArrowDown");
      press("ArrowDown");

      expect(tabStops()).toEqual([row("one.pdf")]);
      expect(document.activeElement).toBe(row("one.pdf"));
      for (const tick of screen.getAllByTestId("file-row-tick")) {
        expect(tick.tabIndex).toBe(-1);
      }
    });

    it("builds every selection with no pointer: one row, two rows apart, a range, all, none", async () => {
      await openTop();

      // The arrows move the focus and select nothing.
      press("ArrowDown");
      press("ArrowDown");
      expect(document.activeElement).toBe(row("one.pdf"));
      expect(selectedNames()).toEqual([]);

      // Space adds the focused row; two rows apart by moving and Space again.
      press(" ");
      press("ArrowDown");
      press("ArrowDown");
      press(" ");
      expect(selectedNames()).toEqual(["one.pdf", "three.pdf"]);
      expect(status()).toBe("2 items selected.");

      // Space again removes it.
      press(" ");
      expect(selectedNames()).toEqual(["one.pdf"]);

      // A range with Shift and the arrows, from the anchor.
      press("ArrowUp", { shiftKey: true });
      press("ArrowUp", { shiftKey: true });
      expect(selectedNames()).toEqual(["one.pdf", "two.pdf", "three.pdf"]);

      // Everything, with Ctrl-A or Command-A.
      press("a", { ctrlKey: true });
      expect(selectedNames()).toHaveLength(5);
      press("Escape");
      expect(selectedNames()).toEqual([]);
      press("A", { metaKey: true });
      expect(selectedNames()).toHaveLength(5);

      // Exactly one row: Escape, then Space.
      press("Escape");
      press(" ");
      expect(selectedNames()).toEqual(["one.pdf"]);
    });

    it("opens the focused folder with Enter, and chooses Delete with the Delete key when something is selected", async () => {
      const server = await openTop();

      press("Delete");
      expect(status()).toBe("Folder All, 5 items.");

      press("ArrowDown");
      press("ArrowDown");
      press(" ");
      press("Delete");
      expect(status()).toBe(NOT_AVAILABLE_YET);
      expect(selectedNames()).toEqual(["one.pdf"]);
      expect(server.calls).toHaveLength(1);

      press("ArrowUp");
      press("Enter");
      expect(server.calls.at(-1)?.folderId).toBe(CALCULUS);
      expect(window.location.pathname).toBe(`/folders/${CALCULUS}`);
    });

    it("does not act on a key combination a system keeps, nor on other keys", async () => {
      await openTop();
      press("ArrowDown");

      // Ctrl-Space and Command-Space are not relied on, and not acted on.
      expect(press(" ", { ctrlKey: true })).toBe(true);
      expect(press(" ", { metaKey: true })).toBe(true);
      expect(press("x")).toBe(true);
      expect(selectedNames()).toEqual([]);
      // A key the list handles is taken, so the page does not scroll with it.
      expect(press(" ")).toBe(false);
    });
  });

  describe("selecting by touch (rules BR4.7)", () => {
    const tap = (element: HTMLElement) => {
      fireEvent.pointerDown(element, { pointerType: "touch" });
      fireEvent.click(element);
    };

    it("toggles a row by its tick box, so any set is built one by one", async () => {
      await openTop();
      const tick = (name: string) =>
        within(row(name)).getByTestId("file-row-tick") as HTMLInputElement;

      tap(tick("one.pdf"));
      tap(tick("three.pdf"));
      tap(tick("Calculus"));

      expect(selectedNames()).toEqual(["Calculus", "one.pdf", "three.pdf"]);
      expect(tick("one.pdf").checked).toBe(true);
      expect(tick("two.pdf").checked).toBe(false);

      tap(tick("one.pdf"));
      expect(selectedNames()).toEqual(["Calculus", "three.pdf"]);
      expect(status()).toBe("2 items selected.");
    });

    it("opens a folder by a tap on its name; a tap on a file's name selects it, and a second says opening is not available yet", async () => {
      const server = await openTop();
      const name = (rowName: string) =>
        within(row(rowName)).getByTestId("file-row-name");

      tap(name("two.pdf"));
      expect(selectedNames()).toEqual(["two.pdf"]);
      expect(status()).toBe("1 item selected.");

      tap(name("two.pdf"));
      expect(selectedNames()).toEqual(["two.pdf"]);
      expect(status()).toBe(OPENING_NOT_AVAILABLE_YET);

      tap(name("Calculus"));
      expect(server.calls.at(-1)?.folderId).toBe(CALCULUS);
      expect(window.location.pathname).toBe(`/folders/${CALCULUS}`);
    });

    it("treats a tap elsewhere on a row as a click, and a mouse click on a name as a click too", async () => {
      const server = await openTop();

      tap(within(row("Calculus")).getByTestId("file-row-size"));
      expect(selectedNames()).toEqual(["Calculus"]);

      const name = within(row("Physics")).getByTestId("file-row-name");
      fireEvent.pointerDown(name, { pointerType: "mouse" });
      fireEvent.click(name);
      expect(selectedNames()).toEqual(["Physics"]);
      expect(server.calls).toHaveLength(1);
    });

    it("still knows a tap in a browser that reports the tap's own click as a mouse's press", async () => {
      const server = await openTop();
      const name = within(row("Calculus")).getByTestId("file-row-name");

      // The finger touches; the browser then echoes it as a mouse.
      fireEvent.touchStart(name);
      fireEvent.pointerDown(name, { pointerType: "mouse" });
      fireEvent.click(name);

      expect(server.calls.at(-1)?.folderId).toBe(CALCULUS);
    });

    it("does not open a row twice when a double tap also arrives as a double-click", async () => {
      const server = await openTop();
      const name = within(row("two.pdf")).getByTestId("file-row-name");

      tap(name);
      tap(name);
      fireEvent.doubleClick(name);

      expect(selectedNames()).toEqual(["two.pdf"]);
      expect(status()).toBe(OPENING_NOT_AVAILABLE_YET);
      expect(server.calls).toHaveLength(1);
    });
  });

  describe("the actions follow the selection (rules BR4.4, BR4.10)", () => {
    it("offers Upload and New Folder with nothing selected", async () => {
      await openTop();

      expect(actions()).toEqual(["Upload", "New Folder"]);
    });

    it("offers Download, Rename and Delete as well for exactly one file", async () => {
      await openTop();
      fireEvent.click(row("one.pdf"));

      expect(actions()).toEqual([
        "Upload",
        "New Folder",
        "Download",
        "Rename",
        "Delete",
      ]);
    });

    it("offers Download and Delete, and not Rename, for one folder and for several items", async () => {
      await openTop();
      const withoutRename = ["Upload", "New Folder", "Download", "Delete"];

      fireEvent.click(row("Calculus"));
      expect(actions()).toEqual(withoutRename);

      fireEvent.click(row("one.pdf"));
      fireEvent.click(row("two.pdf"), { ctrlKey: true });
      expect(actions()).toEqual(withoutRename);
    });

    it("says that an action is not available yet, sends nothing and changes nothing", async () => {
      const server = await openTop();
      fireEvent.click(row("one.pdf"));

      for (const action of [
        "upload",
        "newFolder",
        "download",
        "rename",
        "delete",
      ]) {
        fireEvent.click(row("one.pdf"));
        fireEvent.click(screen.getByTestId(`action-${action}`));
        expect(status()).toBe("This is not available yet.");
      }

      expect(server.calls).toHaveLength(1);
      expect(selectedNames()).toEqual(["one.pdf"]);
      expect(names()).toHaveLength(5);
      expect(screen.getByTestId("action-rename").tagName).toBe("BUTTON");
    });
  });

  describe("refreshing the folder on screen (design W3)", () => {
    it('asks again with the version held when the page becomes visible, and keeps everything on "unchanged"', async () => {
      const server = await openTop();
      fireEvent.click(row("two.pdf"));
      const shown = rows();

      becomeVisible();

      expect(server.calls.at(-1)).toEqual({
        folderId: "root",
        heldVersion: '"v1"',
      });
      await server.answer({ kind: "unchanged", requestId: "page-9" });

      expect(rows()).toEqual(shown);
      expect(selectedNames()).toEqual(["two.pdf"]);
      expect(status()).toBe("1 item selected.");
      expect(screen.queryAllByTestId("file-row-placeholder")).toHaveLength(0);
    });

    it("keeps what is shown when the refresh fails", async () => {
      const server = await openTop();
      fireEvent.click(row("two.pdf"));

      becomeVisible();
      await server.answer(FAILED);

      expect(list().dataset.state).toBe("populated");
      expect(names()).toHaveLength(5);
      expect(selectedNames()).toEqual(["two.pdf"]);
      expect(document.body.textContent).not.toContain("could not be loaded");
    });

    it("replaces the rows with a new answer, keeping the selection by item, and says so only when a selected row is gone", async () => {
      const server = await openTop();
      fireEvent.click(row("one.pdf"));
      fireEvent.click(row("three.pdf"), { ctrlKey: true });
      const keptRow = row("three.pdf");

      // A row added, nothing selected gone: no announcement.
      becomeVisible();
      await server.answer(
        answered(
          TOP,
          "All",
          [fileRow("new", "new.pdf"), ...TOP_ROWS],
          undefined,
          '"v2"',
        ),
      );
      expect(names()[0]).toBe("new.pdf");
      expect(selectedNames()).toEqual(["one.pdf", "three.pdf"]);
      expect(status()).toBe("2 items selected.");
      // The same row element as before: rows are kept by identifier.
      expect(row("three.pdf")).toBe(keptRow);

      // A selected row gone: it leaves the selection, and that is said.
      becomeVisible();
      expect(server.calls.at(-1)?.heldVersion).toBe('"v2"');
      await server.answer(
        answered(
          TOP,
          "All",
          TOP_ROWS.filter((item) => item.itemId !== "file-1"),
          undefined,
          '"v3"',
        ),
      );
      expect(selectedNames()).toEqual(["three.pdf"]);
      expect(status()).toBe(
        "1 item you had selected is no longer in this folder.",
      );
    });

    it("shows the not-found view when the open folder was deleted meanwhile", async () => {
      const server = await openTop();
      fireEvent.click(row("one.pdf"));

      expect(document.title).toBe("All");

      becomeVisible();
      await server.answer(NOT_FOUND);

      expect(list().dataset.state).toBe("notFound");
      expect(actions()).toEqual(["Upload", "New Folder"]);
      // The title no longer names a folder that is not shown.
      expect(document.title).toBe("Virtuoso Drive");
    });

    it("does not refresh a folder that has not been shown yet, and drops a refresh's answer once another folder is opened", async () => {
      const server = controlledRead();
      render(<FolderScreen read={server.read} />);
      becomeVisible();
      expect(server.calls).toHaveLength(1);
      await server.answer(TOP_ANSWER);

      becomeVisible();
      fireEvent.doubleClick(row("Calculus"));
      // The refresh of "All" answers after "Calculus" was opened.
      await server.answer(answered(TOP, "All", [fileRow("x", "stale.pdf")]));
      await server.answer(answered(CALCULUS, "Calculus", []));

      expect(list().dataset.state).toBe("empty");
      expect(steps()).toEqual(["All", "Calculus"]);
    });

    it("moves the keyboard to the list when the action that had it disappears with the selection", async () => {
      const server = await openTop();
      fireEvent.click(row("one.pdf"));
      const rename = screen.getByTestId("action-rename");
      rename.focus();
      expect(document.activeElement).toBe(rename);

      // The selected file is gone: Rename is no longer offered.
      becomeVisible();
      await server.answer(
        answered(
          TOP,
          "All",
          TOP_ROWS.filter((item) => item.itemId !== "file-1"),
        ),
      );

      expect(screen.queryByTestId("action-rename")).toBeNull();
      await waitFor(() =>
        expect(list().contains(document.activeElement)).toBe(true),
      );
    });

    it("leaves the keyboard on an action that is still offered", async () => {
      const server = await openTop();
      fireEvent.click(row("one.pdf"));
      const upload = screen.getByTestId("action-upload");
      upload.focus();

      becomeVisible();
      await server.answer(
        answered(
          TOP,
          "All",
          TOP_ROWS.filter((item) => item.itemId !== "file-1"),
        ),
      );

      expect(document.activeElement).toBe(screen.getByTestId("action-upload"));
    });
  });

  describe("the guaranteed limit of 4,000 rows (performance design P24)", () => {
    it("shows them all and selects them all", async () => {
      const many = Array.from({ length: 4_000 }, (_unused, index) =>
        fileRow(`item-${index}`, `Lecture notes ${index}.pdf`, index),
      );
      await openTop(answered(TOP, "All", many));

      expect(rows()).toHaveLength(4_000);
      expect(names().at(-1)).toBe("Lecture notes 3999.pdf");
      expect(status()).toBe("Folder All, 4000 items.");

      press("a", { ctrlKey: true });

      expect(selectedNames()).toHaveLength(4_000);
      expect(status()).toBe("4000 items selected.");
      expect(actions()).toEqual(["Upload", "New Folder", "Download", "Delete"]);
    }, 60_000);
  });
});

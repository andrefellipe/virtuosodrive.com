// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  addressOf,
  folderFromAddress,
  knownPath,
  pushAddress,
  replaceAddress,
  ROOT,
  TOP_STEP,
} from "./address.ts";

const FOLDER = "3f2b8c1e-9a4d-4e6f-8b7a-0c1d2e3f4a5b";

describe("the page's addresses", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it('reads no folder as "All"', () => {
    expect(ROOT).toBe("root");
    expect(TOP_STEP).toEqual({ folderId: "root", name: "All" });
    for (const pathname of ["/", "", "/folders", "/folders/", "/something"]) {
      expect(folderFromAddress(pathname)).toBe("root");
    }
  });

  it("reads the folder an address names, with or without a closing slash", () => {
    expect(folderFromAddress(`/folders/${FOLDER}`)).toBe(FOLDER);
    expect(folderFromAddress(`/folders/${FOLDER}/`)).toBe(FOLDER);
  });

  it("passes on whatever follows /folders/ as it is, for the server to judge", () => {
    expect(folderFromAddress("/folders/not-an-identifier")).toBe(
      "not-an-identifier",
    );
    expect(folderFromAddress("/folders/a%20b")).toBe("a b");
    // Not valid encoding: kept as written, not an error.
    expect(folderFromAddress("/folders/%E0%A4%A")).toBe("%E0%A4%A");
    // More than one part names no folder.
    expect(folderFromAddress(`/folders/${FOLDER}/more`)).toBe("root");
  });

  it('writes the plain address for "All" and one identifier for any other folder', () => {
    expect(addressOf("root")).toBe("/");
    expect(addressOf(FOLDER)).toBe(`/folders/${FOLDER}`);
    expect(addressOf("a/b c")).toBe("/folders/a%2Fb%20c");
    expect(folderFromAddress(addressOf(FOLDER))).toBe(FOLDER);
  });

  it("adds a history entry when a folder is opened, with the steps known then", () => {
    const steps = [TOP_STEP, { folderId: FOLDER, name: "<b>Provas</b>" }];
    const before = window.history.length;

    pushAddress(FOLDER, steps);

    expect(window.location.pathname).toBe(`/folders/${FOLDER}`);
    expect(window.history.length).toBe(before + 1);
    expect(knownPath(window.history.state)).toEqual(steps);
    // The name is kept with the entry, never put into the address.
    expect(window.location.href).not.toContain("Provas");
  });

  it("replaces the top folder's own identifier with the plain address, without a new history entry", () => {
    window.history.replaceState(null, "", `/folders/${FOLDER}`);
    const before = window.history.length;

    replaceAddress(ROOT, [{ folderId: FOLDER, name: "All" }]);

    expect(window.location.pathname).toBe("/");
    expect(window.history.length).toBe(before);
  });

  it("ignores a history entry's state that is not a list of steps", () => {
    for (const state of [
      null,
      undefined,
      "steps",
      {},
      { steps: [] },
      { steps: "all" },
      { steps: [{ folderId: FOLDER }] },
      { steps: [{ folderId: 7, name: "x" }] },
      { steps: [null] },
    ]) {
      expect(knownPath(state)).toBeUndefined();
    }
  });
});

import { describe, expect, it } from "vitest";
import { EMPTY_SELECTION, refreshSelection, select } from "./selection.ts";
import type {
  SelectableRow,
  Selection,
  SelectionInput,
  SelectionKey,
} from "./selection.ts";

/** Five rows: a folder first, a folder in the middle, files around them. */
const ROWS: SelectableRow[] = [
  { itemId: "a", kind: "folder" },
  { itemId: "b", kind: "file" },
  { itemId: "c", kind: "file" },
  { itemId: "d", kind: "folder" },
  { itemId: "e", kind: "file" },
];

function having(
  selected: string[],
  anchor?: string,
  focused?: string,
): Selection {
  return { selected: new Set(selected), anchor, focused };
}

const ids = (selection: Selection): string[] => [...selection.selected].sort();

const click = (
  itemId: string,
  keys: { toggle?: boolean; range?: boolean } = {},
): SelectionInput => ({
  type: "click",
  itemId,
  toggle: keys.toggle ?? false,
  range: keys.range ?? false,
});

const key = (name: SelectionKey, shift = false): SelectionInput => ({
  type: "key",
  key: name,
  shift,
});

/**
 * The table of the design (W4), one case per row and per rule, with and
 * without an anchor (NFR12.20).
 */
describe("the selection function", () => {
  describe("click a row with no key held (rules BR4.1)", () => {
    it("selects that row only and makes it the anchor, with nothing selected before", () => {
      const { selection, effect } = select(ROWS, EMPTY_SELECTION, click("c"));

      expect(ids(selection)).toEqual(["c"]);
      expect(selection.anchor).toBe("c");
      expect(selection.focused).toBe("c");
      expect(effect).toBeUndefined();
    });

    it("deselects the others and moves the anchor", () => {
      const { selection } = select(
        ROWS,
        having(["a", "b", "e"], "a", "e"),
        click("c"),
      );

      expect(ids(selection)).toEqual(["c"]);
      expect(selection.anchor).toBe("c");
    });
  });

  describe("Ctrl-click or Command-click; a tick box (rules BR4.2)", () => {
    it("adds a row that was not selected, and makes it the anchor", () => {
      const { selection } = select(
        ROWS,
        having(["a"], "a", "a"),
        click("c", { toggle: true }),
      );

      expect(ids(selection)).toEqual(["a", "c"]);
      expect(selection.anchor).toBe("c");
      expect(selection.focused).toBe("c");
    });

    it("removes a row that was selected, and makes it the anchor all the same", () => {
      const { selection } = select(
        ROWS,
        having(["a", "c"], "a", "a"),
        click("c", { toggle: true }),
      );

      expect(ids(selection)).toEqual(["a"]);
      expect(selection.anchor).toBe("c");
    });

    it("does the same for a tap on a row's tick box, so any set can be built one by one", () => {
      let selection = EMPTY_SELECTION;
      for (const itemId of ["e", "a", "c", "a"]) {
        selection = select(ROWS, selection, {
          type: "tickBox",
          itemId,
        }).selection;
      }

      expect(ids(selection)).toEqual(["c", "e"]);
      expect(selection.anchor).toBe("a");
    });
  });

  describe("Shift-click (rules BR4.3)", () => {
    it("selects every row from the anchor to that row, both included, and leaves the anchor", () => {
      const { selection } = select(
        ROWS,
        having(["b"], "b", "b"),
        click("e", { range: true }),
      );

      expect(ids(selection)).toEqual(["b", "c", "d", "e"]);
      expect(selection.anchor).toBe("b");
      expect(selection.focused).toBe("e");
    });

    it("works upwards as well as downwards, and replaces what was selected", () => {
      const { selection } = select(
        ROWS,
        having(["a", "d", "e"], "d", "e"),
        click("b", { range: true }),
      );

      expect(ids(selection)).toEqual(["b", "c", "d"]);
      expect(selection.anchor).toBe("d");
    });

    it("with no anchor, starts from the row that had the keyboard focus before", () => {
      const { selection } = select(
        ROWS,
        having([], undefined, "b"),
        click("d", { range: true }),
      );

      expect(ids(selection)).toEqual(["b", "c", "d"]);
      expect(selection.anchor).toBe("b");
    });

    it("with no anchor and no row focused, starts from the first row", () => {
      const { selection } = select(
        ROWS,
        EMPTY_SELECTION,
        click("c", { range: true }),
      );

      expect(ids(selection)).toEqual(["a", "b", "c"]);
      expect(selection.anchor).toBe("a");
    });

    it("selects a range however many rows it spans, by their place compared as numbers", () => {
      const many: SelectableRow[] = Array.from(
        { length: 500 },
        (_u, index) => ({
          itemId: `row-${index}`,
          kind: "file",
        }),
      );

      const { selection } = select(
        many,
        having(["row-9"], "row-9", "row-9"),
        click("row-110", { range: true }),
      );

      // 9 to 110 by number is 102 rows; compared as text it would be far fewer.
      expect(selection.selected.size).toBe(102);
      expect(selection.selected.has("row-50")).toBe(true);
      expect(selection.selected.has("row-111")).toBe(false);
    });
  });

  describe("the arrow keys", () => {
    it("alone, move only the focus: selection and anchor are unchanged", () => {
      const before = having(["a", "e"], "e", "b");

      const down = select(ROWS, before, key("ArrowDown")).selection;
      const up = select(ROWS, before, key("ArrowUp")).selection;

      expect(down).toEqual({ ...before, focused: "c" });
      expect(up).toEqual({ ...before, focused: "a" });
    });

    it("stop at the first and the last row", () => {
      expect(
        select(ROWS, having([], undefined, "a"), key("ArrowUp")).selection
          .focused,
      ).toBe("a");
      expect(
        select(ROWS, having([], undefined, "e"), key("ArrowDown")).selection
          .focused,
      ).toBe("e");
    });

    it("with no row focused yet, go to the first row for down and the last for up", () => {
      expect(
        select(ROWS, EMPTY_SELECTION, key("ArrowDown")).selection.focused,
      ).toBe("a");
      expect(
        select(ROWS, EMPTY_SELECTION, key("ArrowUp")).selection.focused,
      ).toBe("e");
    });

    it("with Shift, select the range from the anchor to the row the focus moves to", () => {
      let selection = having(["b"], "b", "b");
      selection = select(ROWS, selection, key("ArrowDown", true)).selection;
      selection = select(ROWS, selection, key("ArrowDown", true)).selection;

      expect(ids(selection)).toEqual(["b", "c", "d"]);
      expect(selection.anchor).toBe("b");
      expect(selection.focused).toBe("d");

      // Coming back shrinks the range: it is always anchor to focus.
      selection = select(ROWS, selection, key("ArrowUp", true)).selection;
      expect(ids(selection)).toEqual(["b", "c"]);
    });

    it("with Shift and no anchor, start from the row that had the focus before the key", () => {
      const { selection } = select(
        ROWS,
        having([], undefined, "c"),
        key("ArrowUp", true),
      );

      expect(ids(selection)).toEqual(["b", "c"]);
      expect(selection.anchor).toBe("c");
      expect(selection.focused).toBe("b");
    });

    it("with Shift, no anchor and no row focused, start at the first row", () => {
      const { selection } = select(
        ROWS,
        EMPTY_SELECTION,
        key("ArrowDown", true),
      );

      expect(ids(selection)).toEqual(["a"]);
      expect(selection.anchor).toBe("a");
      expect(selection.focused).toBe("a");
    });
  });

  describe("Space on the focused row (rules BR4.6)", () => {
    it("adds the focused row, or removes it if it was selected, and makes it the anchor", () => {
      const added = select(ROWS, having(["a"], "a", "c"), key("Space"));
      const removed = select(ROWS, added.selection, key("Space"));

      expect(ids(added.selection)).toEqual(["a", "c"]);
      expect(added.selection.anchor).toBe("c");
      expect(ids(removed.selection)).toEqual(["a"]);
      expect(removed.selection.anchor).toBe("c");
    });

    it("does nothing when no row has the focus", () => {
      const before = having(["a"], "a");

      expect(select(ROWS, before, key("Space")).selection).toBe(before);
    });

    it("with Shift, selects the range from the anchor to the focused row", () => {
      const { selection } = select(
        ROWS,
        having(["a"], "a", "d"),
        key("Space", true),
      );

      expect(ids(selection)).toEqual(["a", "b", "c", "d"]);
      expect(selection.anchor).toBe("a");
    });

    it("builds any set by moving and pressing Space, and exactly one row by Escape and then Space", () => {
      let selection = having(["a", "b", "c"], "c", "c");
      // Escape, then Space on the focused row: that row alone.
      selection = select(ROWS, selection, key("Escape")).selection;
      selection = select(ROWS, selection, key("Space")).selection;
      expect(ids(selection)).toEqual(["c"]);

      // Two rows apart, with no pointer.
      selection = select(ROWS, selection, key("ArrowDown")).selection;
      selection = select(ROWS, selection, key("ArrowDown")).selection;
      selection = select(ROWS, selection, key("Space")).selection;
      expect(ids(selection)).toEqual(["c", "e"]);
    });
  });

  describe("Ctrl-A or Command-A", () => {
    it("selects every row and leaves the anchor and the focus", () => {
      const { selection } = select(
        ROWS,
        having(["b"], "b", "d"),
        key("SelectAll"),
      );

      expect(ids(selection)).toEqual(["a", "b", "c", "d", "e"]);
      expect(selection.anchor).toBe("b");
      expect(selection.focused).toBe("d");
    });

    it("with no anchor, takes the focused row as the anchor, or the first row", () => {
      expect(
        select(ROWS, having([], undefined, "d"), key("SelectAll")).selection
          .anchor,
      ).toBe("d");
      expect(
        select(ROWS, EMPTY_SELECTION, key("SelectAll")).selection.anchor,
      ).toBe("a");
    });
  });

  describe("Escape, and the Clear control of the status line", () => {
    it.each([
      ["Escape", key("Escape")],
      ["Clear", { type: "clear" } as SelectionInput],
    ])(
      "%s empties the selection and leaves no anchor; the focus stays",
      (_n, input) => {
        const { selection, effect } = select(
          ROWS,
          having(["a", "c"], "c", "c"),
          input,
        );

        expect(ids(selection)).toEqual([]);
        expect(selection.anchor).toBeUndefined();
        expect(selection.focused).toBe("c");
        expect(effect).toBeUndefined();
      },
    );
  });

  describe("opening a row (rules BR3.10)", () => {
    it.each([
      ["a double-click", { type: "open", itemId: "d" } as SelectionInput, "d"],
      [
        "a tap on its name",
        { type: "tapName", itemId: "d" } as SelectionInput,
        "d",
      ],
      ["Enter on the focused row", key("Enter"), "d"],
    ])(
      "%s on a folder opens it, with an empty selection and no anchor",
      (_n, input, folder) => {
        const { selection, effect } = select(
          ROWS,
          having(["a", "b"], "b", "d"),
          input,
        );

        expect(effect).toEqual({ type: "openFolder", itemId: folder });
        expect(selection).toEqual(EMPTY_SELECTION);
      },
    );

    it.each([
      ["a double-click", { type: "open", itemId: "c" } as SelectionInput],
      ["Enter on the focused row", key("Enter")],
    ])(
      "%s on a file selects that row only and says opening is not available yet",
      (_n, input) => {
        const { selection, effect } = select(
          ROWS,
          having(["a", "b"], "a", "c"),
          input,
        );

        expect(effect).toEqual({ type: "fileNotAvailable" });
        expect(ids(selection)).toEqual(["c"]);
        expect(selection.anchor).toBe("c");
      },
    );

    it("Enter does nothing when no row has the focus", () => {
      const before = having(["a"], "a");

      expect(select(ROWS, before, key("Enter"))).toEqual({ selection: before });
    });
  });

  describe("a tap on a file's name (rules BR4.7)", () => {
    it("selects that row only", () => {
      const { selection, effect } = select(ROWS, having(["a", "e"], "a", "a"), {
        type: "tapName",
        itemId: "c",
      });

      expect(ids(selection)).toEqual(["c"]);
      expect(selection.anchor).toBe("c");
      expect(effect).toBeUndefined();
    });

    it("on the file that is already the only selected row, changes nothing and says opening is not available yet", () => {
      const before = having(["c"], "c", "c");

      const { selection, effect } = select(ROWS, before, {
        type: "tapName",
        itemId: "c",
      });

      expect(selection).toBe(before);
      expect(effect).toEqual({ type: "fileNotAvailable" });
    });

    it("on a selected file that is not the only selected row, selects it alone", () => {
      const { selection, effect } = select(ROWS, having(["b", "c"], "b", "b"), {
        type: "tapName",
        itemId: "c",
      });

      expect(ids(selection)).toEqual(["c"]);
      expect(effect).toBeUndefined();
    });
  });

  describe("the Delete key (rules BR4.10)", () => {
    it("with something selected, chooses the Delete action and changes nothing", () => {
      const before = having(["b", "c"], "b", "c");

      expect(select(ROWS, before, key("Delete"))).toEqual({
        selection: before,
        effect: { type: "chooseDelete" },
      });
    });

    it("with nothing selected, does nothing", () => {
      expect(select(ROWS, EMPTY_SELECTION, key("Delete"))).toEqual({
        selection: EMPTY_SELECTION,
      });
    });
  });

  describe("inputs that cannot apply", () => {
    it("changes nothing for a row that is not in the list", () => {
      const before = having(["a"], "a", "a");

      for (const input of [
        click("gone"),
        click("gone", { range: true }),
        { type: "tickBox", itemId: "gone" },
        { type: "tapName", itemId: "gone" },
        { type: "open", itemId: "gone" },
      ] as SelectionInput[]) {
        expect(select(ROWS, before, input)).toEqual({ selection: before });
      }
    });

    it("changes nothing on an empty list, whatever the key", () => {
      for (const name of [
        "ArrowDown",
        "ArrowUp",
        "Space",
        "Enter",
        "SelectAll",
        "Delete",
      ] as SelectionKey[]) {
        expect(select([], EMPTY_SELECTION, key(name, true))).toEqual({
          selection: EMPTY_SELECTION,
        });
      }
    });

    it("ignores an anchor that is no longer among the rows", () => {
      const { selection } = select(
        ROWS,
        having([], "gone", "b"),
        click("c", { range: true }),
      );

      expect(ids(selection)).toEqual(["b", "c"]);
      expect(selection.anchor).toBe("b");
    });

    it("never changes the selection it was given", () => {
      const before = having(["a"], "a", "a");

      select(ROWS, before, click("c", { toggle: true }));
      select(ROWS, before, key("SelectAll"));

      expect(ids(before)).toEqual(["a"]);
    });
  });
});

/** Rules BR4.8: a list that changes between two answers. */
describe("the selection after a fresh answer", () => {
  const without = (...gone: string[]): SelectableRow[] =>
    ROWS.filter((row) => !gone.includes(row.itemId));

  it("keeps selection, anchor and focus when every row is still there, also in another order with rows added", () => {
    const before = having(["b", "d"], "b", "d");
    const after: SelectableRow[] = [
      { itemId: "new", kind: "file" },
      ...[...ROWS].reverse(),
    ];

    expect(refreshSelection(ROWS, after, before)).toEqual({
      selection: before,
      gone: 0,
    });
  });

  it("takes a selected row that is gone out of the selection, and says how many went", () => {
    const { selection, gone } = refreshSelection(
      ROWS,
      without("b", "e"),
      having(["a", "b", "e"], "a", "a"),
    );

    expect(ids(selection)).toEqual(["a"]);
    expect(gone).toBe(2);
    expect(selection.anchor).toBe("a");
    expect(selection.focused).toBe("a");
  });

  it("leaves no anchor when the anchor is gone", () => {
    const { selection } = refreshSelection(
      ROWS,
      without("c"),
      having(["a", "c"], "c", "a"),
    );

    expect(selection.anchor).toBeUndefined();
    expect(ids(selection)).toEqual(["a"]);
  });

  it("moves the focus to the row now at the place of a focused row that is gone", () => {
    const { selection } = refreshSelection(
      ROWS,
      without("c"),
      having([], undefined, "c"),
    );

    // "c" was third; the third row is now "d".
    expect(selection.focused).toBe("d");
  });

  it("moves the focus to the last row when the focused row was last and is gone", () => {
    const { selection } = refreshSelection(
      ROWS,
      without("e"),
      having(["e"], "e", "e"),
    );

    expect(selection.focused).toBe("d");
    expect(ids(selection)).toEqual([]);
  });

  it("leaves no focus when no row is left, and none when none was focused", () => {
    expect(
      refreshSelection(ROWS, [], having(["a"], "a", "a")).selection,
    ).toEqual({ selected: new Set(), anchor: undefined, focused: undefined });
    expect(
      refreshSelection(ROWS, without("a"), having(["b"], "b")).selection
        .focused,
    ).toBeUndefined();
  });
});

/**
 * Selection as a pure function (decision T23; rules BR4.1 to BR4.9): from
 * the rows on screen, the selection so far, and one input, to the new
 * selection and, sometimes, something for the screen to do. No part of the
 * selection's logic is in a component; the components only turn clicks, keys
 * and taps into the inputs below.
 *
 * Selection, anchor and focus are held by item identifier, never by place,
 * so that a fresh answer for the folder leaves them where they were.
 */

/** What the selection needs to know of a row. */
export interface SelectableRow {
  itemId: string;
  kind: "folder" | "file";
}

export interface Selection {
  /** The selected rows. */
  selected: ReadonlySet<string>;
  /** The row last chosen on its own or by toggling: the fixed end of a range. */
  anchor: string | undefined;
  /** The row the keyboard is on. Independent of what is selected. */
  focused: string | undefined;
}

/** Nothing selected, no anchor, no row focused: how every folder starts (rules BR4.9). */
export const EMPTY_SELECTION: Selection = {
  selected: new Set(),
  anchor: undefined,
  focused: undefined,
};

export type SelectionKey =
  | "ArrowUp"
  | "ArrowDown"
  | "Space"
  | "Enter"
  | "Escape"
  | "SelectAll"
  | "Delete";

export type SelectionInput =
  /** A click on a row, or a tap away from its tick box and its name. */
  | { type: "click"; itemId: string; toggle: boolean; range: boolean }
  /** A tap, or a click, on a row's tick box. */
  | { type: "tickBox"; itemId: string }
  /** A tap on a row's name (touch only; with a mouse it is a click). */
  | { type: "tapName"; itemId: string }
  /** A double-click on a row. */
  | { type: "open"; itemId: string }
  /** A key pressed while the list has the focus. SelectAll is Ctrl-A or Command-A. */
  | { type: "key"; key: SelectionKey; shift: boolean }
  /** The "Clear" control of the status line. */
  | { type: "clear" };

/** Something the screen does as a result of an input. */
export type SelectionEffect =
  | { type: "openFolder"; itemId: string }
  /** A file was opened; opening files arrives with a later Unit (rules BR3.10). */
  | { type: "fileNotAvailable" }
  /** The Delete key chose the Delete action (rules BR4.10). */
  | { type: "chooseDelete" };

export interface SelectionResult {
  selection: Selection;
  effect?: SelectionEffect;
}

const only = (itemId: string): Selection => ({
  selected: new Set([itemId]),
  anchor: itemId,
  focused: itemId,
});

function indexOf(rows: readonly SelectableRow[], itemId: string | undefined) {
  return itemId === undefined
    ? -1
    : rows.findIndex((row) => row.itemId === itemId);
}

/** The identifier if it is one of the rows, otherwise undefined. */
function present(
  rows: readonly SelectableRow[],
  itemId: string | undefined,
): string | undefined {
  return indexOf(rows, itemId) === -1 ? undefined : itemId;
}

/**
 * The anchor a range starts from: the anchor there is; if there is none, the
 * row that had the keyboard focus before this input, or the first row (rules
 * BR4.3). The same rule gives Ctrl-A its anchor.
 */
function anchorFor(
  rows: readonly SelectableRow[],
  selection: Selection,
): string | undefined {
  return (
    present(rows, selection.anchor) ??
    present(rows, selection.focused) ??
    rows[0]?.itemId
  );
}

/** Every row from one to the other, both included, by their place in the list. */
function rangeBetween(
  rows: readonly SelectableRow[],
  from: string,
  to: string,
): Set<string> {
  const a = indexOf(rows, from);
  const b = indexOf(rows, to);
  return new Set(
    rows.slice(Math.min(a, b), Math.max(a, b) + 1).map((row) => row.itemId),
  );
}

function toggled(selection: Selection, itemId: string): Selection {
  const selected = new Set(selection.selected);
  if (!selected.delete(itemId)) {
    selected.add(itemId);
  }
  return { selected, anchor: itemId, focused: itemId };
}

function rangeTo(
  rows: readonly SelectableRow[],
  selection: Selection,
  itemId: string,
): Selection {
  const anchor = anchorFor(rows, selection) ?? itemId;
  return {
    selected: rangeBetween(rows, anchor, itemId),
    anchor,
    focused: itemId,
  };
}

/** Opening a row: a folder opens in place; a file is selected and says "not yet". */
function opened(row: SelectableRow): SelectionResult {
  return row.kind === "folder"
    ? {
        selection: EMPTY_SELECTION,
        effect: { type: "openFolder", itemId: row.itemId },
      }
    : { selection: only(row.itemId), effect: { type: "fileNotAvailable" } };
}

function moved(
  rows: readonly SelectableRow[],
  selection: Selection,
  step: 1 | -1,
  shift: boolean,
): Selection {
  const from = indexOf(rows, selection.focused);
  // With no row focused yet, down starts at the first row and up at the last.
  const to =
    from === -1
      ? step === 1
        ? 0
        : rows.length - 1
      : Math.min(rows.length - 1, Math.max(0, from + step));
  const focused = (rows[to] as SelectableRow).itemId;
  if (!shift) {
    // Arrow alone: only the focus moves.
    return { ...selection, focused };
  }
  return rangeTo(rows, selection, focused);
}

function keyPressed(
  rows: readonly SelectableRow[],
  selection: Selection,
  key: SelectionKey,
  shift: boolean,
): SelectionResult {
  const focusedRow = rows[indexOf(rows, selection.focused)];
  switch (key) {
    case "ArrowDown":
      return { selection: moved(rows, selection, 1, shift) };
    case "ArrowUp":
      return { selection: moved(rows, selection, -1, shift) };
    case "Space":
      if (focusedRow === undefined) {
        return { selection };
      }
      return {
        selection: shift
          ? rangeTo(rows, selection, focusedRow.itemId)
          : toggled(selection, focusedRow.itemId),
      };
    case "SelectAll":
      return {
        selection: {
          selected: new Set(rows.map((row) => row.itemId)),
          anchor: anchorFor(rows, selection),
          focused: selection.focused,
        },
      };
    case "Escape":
      return {
        selection: { ...selection, selected: new Set(), anchor: undefined },
      };
    case "Enter":
      return focusedRow === undefined ? { selection } : opened(focusedRow);
    case "Delete":
      return selection.selected.size === 0
        ? { selection }
        : { selection, effect: { type: "chooseDelete" } };
  }
}

/**
 * The selection after one input (design W4). An input that names a row
 * which is not among the rows, and any input on an empty list, changes
 * nothing.
 */
export function select(
  rows: readonly SelectableRow[],
  selection: Selection,
  input: SelectionInput,
): SelectionResult {
  if (input.type === "clear") {
    return {
      selection: { ...selection, selected: new Set(), anchor: undefined },
    };
  }
  if (rows.length === 0) {
    return { selection };
  }
  if (input.type === "key") {
    return keyPressed(rows, selection, input.key, input.shift);
  }
  const row = rows[indexOf(rows, input.itemId)];
  if (row === undefined) {
    return { selection };
  }
  switch (input.type) {
    case "click":
      if (input.range) {
        return { selection: rangeTo(rows, selection, row.itemId) };
      }
      return {
        selection: input.toggle
          ? toggled(selection, row.itemId)
          : only(row.itemId),
      };
    case "tickBox":
      return { selection: toggled(selection, row.itemId) };
    case "tapName": {
      if (row.kind === "folder") {
        return opened(row);
      }
      const alreadyTheOnlyOne =
        selection.selected.size === 1 && selection.selected.has(row.itemId);
      return alreadyTheOnlyOne
        ? { selection, effect: { type: "fileNotAvailable" } }
        : { selection: only(row.itemId) };
    }
    case "open":
      return opened(row);
  }
}

export interface RefreshedSelection {
  selection: Selection;
  /** How many selected rows are gone. */
  gone: number;
}

/**
 * The selection after a fresh answer replaced the rows of the folder on
 * screen (rules BR4.8). Rows still present stay selected; a selected row
 * that is gone leaves the selection; if the anchor is gone there is no
 * anchor; if the focused row is gone, the focus moves to the row now at its
 * place, or to the last row.
 */
export function refreshSelection(
  previousRows: readonly SelectableRow[],
  rows: readonly SelectableRow[],
  selection: Selection,
): RefreshedSelection {
  const selected = new Set(
    [...selection.selected].filter((itemId) => indexOf(rows, itemId) !== -1),
  );
  let focused = present(rows, selection.focused);
  if (focused === undefined && selection.focused !== undefined) {
    const place = indexOf(previousRows, selection.focused);
    focused = (rows[place === -1 ? rows.length - 1 : place] ?? rows.at(-1))
      ?.itemId;
  }
  return {
    selection: { selected, anchor: present(rows, selection.anchor), focused },
    gone: selection.selected.size - selected.size,
  };
}

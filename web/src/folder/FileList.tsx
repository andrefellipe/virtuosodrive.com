import { memo, useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, RefObject } from "react";
import type { FolderRow } from "../api/folder.ts";
import { formatSize, iconFor } from "./formatting.ts";
import { CHECK_ICON, KIND_ICONS } from "./icons.ts";
import type { Selection, SelectionInput, SelectionKey } from "./selection.ts";

/** The five states of the list, as one value (reliability design R23). */
export type ListState =
  | { kind: "loading" }
  | { kind: "populated"; rows: readonly FolderRow[] }
  | { kind: "empty" }
  | { kind: "failed" }
  | { kind: "notFound" };

export interface FileListProps {
  list: ListState;
  /** The open folder's name, which labels the table. */
  folderName: string;
  selection: Selection;
  /** One input for the selection function: a click, a key, a tap. */
  onInput: (input: SelectionInput) => void;
  onRetry: () => void;
  /** Opens "All", from the not-found view. */
  onOpenTop: () => void;
  /** The list's own element, so that the screen can move focus to it. */
  listRef: RefObject<HTMLDivElement | null>;
}

interface RowProps {
  row: FolderRow;
  selected: boolean;
  /** Whether this is the one row that Tab reaches (the roving focus). */
  tabStop: boolean;
  onInput: (input: SelectionInput) => void;
  /** Whether the press that is being handled came from a finger. */
  byTouch: () => boolean;
}

/**
 * One row. A component of its own, keyed by the item's identifier and told
 * only whether it is selected and whether it is the Tab stop, so that a
 * change of selection redraws only the rows whose state changed
 * (performance design P24).
 */
const Row = memo(function Row({
  row,
  selected,
  tabStop,
  onInput,
  byTouch,
}: RowProps) {
  const icon = iconFor(row);

  const click = (event: MouseEvent<HTMLTableRowElement>): void => {
    const onName =
      (event.target as HTMLElement).closest("[data-part='name']") !== null;
    if (byTouch() && onName) {
      // By touch, a tap on a name opens a folder, or selects a file.
      onInput({ type: "tapName", itemId: row.itemId });
      return;
    }
    onInput({
      type: "click",
      itemId: row.itemId,
      toggle: event.ctrlKey || event.metaKey,
      range: event.shiftKey,
    });
  };

  return (
    <tr
      role="row"
      className={selected ? "file-row selected" : "file-row"}
      aria-selected={selected}
      tabIndex={tabStop ? 0 : -1}
      data-item-id={row.itemId}
      data-testid="file-row"
      onClick={click}
      onDoubleClick={() => {
        if (!byTouch()) {
          onInput({ type: "open", itemId: row.itemId });
        }
      }}
      onMouseDown={(event) => {
        if (event.shiftKey) {
          // A Shift-click selects rows, not the text between them.
          event.preventDefault();
        }
      }}
    >
      <td role="gridcell" className="file-mark">
        <input
          type="checkbox"
          className="file-tick"
          checked={selected}
          tabIndex={-1}
          aria-label={`Select ${row.name}`}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onInput({ type: "tickBox", itemId: row.itemId })}
          data-testid="file-row-tick"
        />
        {selected && (
          <img
            className="file-check"
            src={CHECK_ICON}
            alt="Selected"
            width="20"
            height="20"
            data-testid="file-row-check"
          />
        )}
      </td>
      <td role="gridcell" className="file-kind">
        <img
          src={KIND_ICONS[icon.icon]}
          alt={icon.label}
          width="30"
          height="30"
          data-icon={icon.icon}
          data-testid="file-row-icon"
        />
      </td>
      <td role="gridcell" className="file-name">
        <span data-part="name" data-testid="file-row-name">
          {row.name}
        </span>
      </td>
      <td role="gridcell" className="file-size" data-testid="file-row-size">
        {formatSize(row)}
      </td>
    </tr>
  );
});

const NO_ROWS: readonly FolderRow[] = [];

/** How long after a touch a click is still taken to be that touch's own. */
const TOUCH_TO_CLICK_MS = 800;

const KEYS: Record<string, SelectionKey> = {
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  " ": "Space",
  Enter: "Enter",
  Escape: "Escape",
  Delete: "Delete",
};

function keyOf(event: KeyboardEvent): SelectionKey | undefined {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    return "SelectAll";
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    // Combinations an operating system or a browser keeps for itself.
    return undefined;
  }
  return KEYS[event.key];
}

/**
 * The list of the open folder, in one of its five states (design, "States of
 * the list"). Populated, it is a native table with column headings: one Tab
 * stop, a roving focus moved by the arrow keys, each row exposing whether it
 * is selected (performance design P27). The whole table is in the page;
 * nothing is drawn only when scrolled to (P24).
 *
 * This component decides nothing about the selection: it turns clicks, keys
 * and taps into inputs for the selection function (decision T23).
 */
export function FileList({
  list,
  folderName,
  selection,
  onInput,
  onRetry,
  onOpenTop,
  listRef,
}: FileListProps) {
  // When a finger last touched the list. A tap is followed, within moments,
  // by the click it stands for; some browsers also report that click's press
  // as a mouse's, which must not undo what the touch said.
  const lastTouchAt = useRef(0);
  const lastTouchStartAt = useRef(0);
  const byTouch = useCallback(
    () => Date.now() - lastTouchAt.current < TOUCH_TO_CLICK_MS,
    [],
  );
  const hadFocus = useRef(false);
  const rows = list.kind === "populated" ? list.rows : NO_ROWS;
  const focused = selection.focused;

  // The roving focus: when the focused row changes while the list has the
  // keyboard, the focus goes with it. Also after a fresh answer removed the
  // focused row, which leaves the keyboard nowhere until it is put back.
  useEffect(() => {
    const element = listRef.current;
    if (element === null || focused === undefined || !hadFocus.current) {
      return;
    }
    const row = Array.from(
      element.querySelectorAll<HTMLElement>("[data-item-id]"),
    ).find((candidate) => candidate.dataset.itemId === focused);
    if (row !== undefined && document.activeElement !== row) {
      row.focus();
    }
  }, [focused, listRef, rows]);

  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const key = keyOf(event);
      if (key === undefined || list.kind !== "populated") {
        return;
      }
      // The list handles the key: no scrolling by Space or the arrows, and
      // no selecting of the whole page's text by Ctrl-A.
      event.preventDefault();
      onInput({ type: "key", key, shift: event.shiftKey });
    },
    [list.kind, onInput],
  );

  const touchStart = (): void => {
    lastTouchStartAt.current = Date.now();
    lastTouchAt.current = Date.now();
  };
  const pointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "touch") {
      lastTouchAt.current = Date.now();
    } else if (Date.now() - lastTouchStartAt.current >= TOUCH_TO_CLICK_MS) {
      // A mouse or a pen, and not the echo of a touch that has just begun.
      lastTouchAt.current = 0;
    }
  };

  const tabStop = focused ?? rows[0]?.itemId;

  return (
    <div
      className="file-list"
      ref={listRef}
      tabIndex={-1}
      aria-busy={list.kind === "loading"}
      onKeyDown={keyDown}
      onPointerDown={pointerDown}
      onTouchStart={touchStart}
      onFocus={() => {
        hadFocus.current = true;
      }}
      onBlur={(event) => {
        if (
          event.relatedTarget !== null &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          hadFocus.current = false;
        }
      }}
      data-testid="file-list"
      data-state={list.kind}
    >
      {(list.kind === "populated" || list.kind === "loading") && (
        <table
          className="file-table"
          role="grid"
          aria-label={folderName}
          aria-multiselectable="true"
        >
          {/* The roles are written out: below 768 pixels the rows are laid
              out as blocks, and some browsers then forget what a table's
              parts are unless they are told. */}
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col" className="file-mark">
                <span className="visually-hidden">Selected</span>
              </th>
              <th role="columnheader" scope="col" className="file-kind">
                <span className="visually-hidden">Kind</span>
              </th>
              <th role="columnheader" scope="col">
                Name
              </th>
              <th role="columnheader" scope="col">
                Size
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {list.kind === "loading"
              ? [1, 2, 3].map((placeholder) => (
                  <tr
                    role="row"
                    key={placeholder}
                    className="file-placeholder"
                    aria-hidden="true"
                    data-testid="file-row-placeholder"
                  >
                    <td role="gridcell" className="file-mark" />
                    <td role="gridcell" className="file-kind">
                      <span className="placeholder-block placeholder-icon" />
                    </td>
                    <td role="gridcell">
                      <span className="placeholder-block" />
                    </td>
                    <td role="gridcell">
                      <span className="placeholder-block placeholder-short" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
                  <Row
                    key={row.itemId}
                    row={row}
                    selected={selection.selected.has(row.itemId)}
                    tabStop={row.itemId === tabStop}
                    onInput={onInput}
                    byTouch={byTouch}
                  />
                ))}
          </tbody>
        </table>
      )}

      {list.kind === "empty" && (
        <p className="file-list-note" data-testid="file-list-empty">
          This folder is empty.
        </p>
      )}

      {list.kind === "failed" && (
        <div className="file-list-note" data-testid="file-list-failed">
          <p>The list could not be loaded.</p>
          <button
            type="button"
            className="button"
            onClick={onRetry}
            data-testid="file-list-retry"
          >
            Try again
          </button>
        </div>
      )}

      {list.kind === "notFound" && (
        <div className="file-list-note" data-testid="file-list-not-found">
          <p>This folder does not exist or was deleted.</p>
          <a
            href="/"
            className="plain-link"
            onClick={(event) => {
              event.preventDefault();
              onOpenTop();
            }}
            data-testid="file-list-open-top"
          >
            All
          </a>
        </div>
      )}
    </div>
  );
}

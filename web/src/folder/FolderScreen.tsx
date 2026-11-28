import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadResult } from "../api/call-server.ts";
import { readFolder } from "../api/folder.ts";
import type { FolderAnswer, FolderRow, PathStep } from "../api/folder.ts";
import { ActionBar, actionsFor, actionWithFocus } from "./ActionBar.tsx";
import {
  folderFromAddress,
  knownPath,
  pushAddress,
  replaceAddress,
  ROOT,
  TOP_STEP,
} from "./address.ts";
import { Breadcrumb, useNarrow } from "./Breadcrumb.tsx";
import { FileList } from "./FileList.tsx";
import type { ListState } from "./FileList.tsx";
import { countOfItems } from "./formatting.ts";
import { EMPTY_SELECTION, refreshSelection, select } from "./selection.ts";
import type { Selection, SelectionInput } from "./selection.ts";
import { StatusLine } from "./StatusLine.tsx";

export const NOT_AVAILABLE_YET = "This is not available yet.";
/** The page's title while no folder is shown: the entry document's own. */
export const SITE_TITLE = "Virtuoso Drive";
export const OPENING_NOT_AVAILABLE_YET = "Opening files is not available yet.";

type Read = (
  folderId: string,
  heldVersion?: string,
) => Promise<ReadResult<FolderAnswer>>;

export interface FolderScreenProps {
  /** Replaced in tests; the page uses the real call. */
  read?: Read;
}

/** Everything the screen shows, as one value, so that no two parts can disagree. */
interface Screen {
  /** The folder asked for: `root`, or an identifier. */
  asked: string;
  /** The breadcrumb's steps, as far as they are known. */
  steps: PathStep[];
  /** The list, in exactly one of its five states. */
  list: ListState;
  /** The open folder, once its answer has arrived. */
  folder: { name: string; version: string | undefined } | undefined;
  selection: Selection;
  /** What the status line says. */
  status: string;
}

const rowsOf = (list: ListState): readonly FolderRow[] =>
  list.kind === "populated" ? list.rows : [];

function listOf(rows: readonly FolderRow[]): ListState {
  return rows.length === 0 ? { kind: "empty" } : { kind: "populated", rows };
}

function selectedText(count: number): string {
  return count === 0
    ? "Nothing is selected."
    : `${countOfItems(count)} selected.`;
}

function goneText(gone: number): string {
  return gone === 1
    ? "1 item you had selected is no longer in this folder."
    : `${gone} items you had selected are no longer in this folder.`;
}

/**
 * The folder screen (design W2 to W4): the breadcrumb, the actions, the
 * status line and the list of the folder the address names.
 *
 *   - Opening a folder clears the selection, shows what is known of the
 *     path and three placeholder rows, and asks the server.
 *   - Each opening carries a number that rises; an answer that arrives for
 *     a folder the visitor has already left is dropped (reliability design
 *     R23).
 *   - When the page becomes visible again, the folder on screen is asked
 *     for again with the version held; "unchanged" and a failure both leave
 *     everything as it is (design W3). Asking on a timer is a later Unit's.
 *   - Every click, key and tap goes through the selection function; this
 *     component only shows the result and does what it says.
 *   - In U3 every action only says that it is not available yet.
 */
export function FolderScreen({ read = readFolder }: FolderScreenProps) {
  const [screen, setScreen] = useState<Screen>(() => ({
    asked: folderFromAddress(window.location.pathname),
    steps: knownPath(window.history.state) ?? [TOP_STEP],
    list: { kind: "loading" },
    folder: undefined,
    selection: EMPTY_SELECTION,
    status: "",
  }));
  const current = useRef(screen);
  current.current = screen;
  /** Rises with every folder opened; an answer for an earlier number is dropped. */
  const opening = useRef(0);
  const listElement = useRef<HTMLDivElement | null>(null);
  /** Set when the keyboard must go to the list once the screen is redrawn. */
  const focusListNext = useRef(false);
  const narrow = useNarrow();

  /** Moves the keyboard to the list: to its focused row if it has one. */
  const focusList = useCallback(() => {
    const list = listElement.current;
    const row = list?.querySelector<HTMLElement>("tr[tabindex='0']");
    (current.current.selection.focused !== undefined && row
      ? row
      : list
    )?.focus();
  }, []);

  /**
   * If the action that has the keyboard focus is about to disappear because
   * the selection changes, focus moves to the list (design W4).
   */
  const noteActionAboutToGo = useCallback(
    (rows: readonly FolderRow[], selection: Selection) => {
      const focused = actionWithFocus();
      const remaining = actionsFor(
        rows.filter((row) => selection.selected.has(row.itemId)),
      );
      if (focused !== undefined && !remaining.includes(focused)) {
        focusListNext.current = true;
      }
    },
    [],
  );

  /** Design W2, from step 2: a folder is opened. */
  const open = useCallback(
    async (asked: string, steps: PathStep[]) => {
      const mine = ++opening.current;
      setScreen({
        asked,
        steps,
        list: { kind: "loading" },
        folder: undefined,
        selection: EMPTY_SELECTION,
        status: "",
      });
      const result = await read(asked);
      if (mine !== opening.current) {
        // The visitor has already left this folder.
        return;
      }
      if (result.kind === "accessNeeded") {
        // The page is being reloaded to ask for the access password.
        return;
      }
      if (result.kind !== "answered") {
        const notFound =
          result.kind === "failed" && result.problemCode === "notFound";
        // No folder is shown, so the title names none: not the one left.
        document.title = SITE_TITLE;
        setScreen((before) => ({
          ...before,
          list: { kind: notFound ? "notFound" : "failed" },
        }));
        return;
      }
      const folder = result.data;
      // "All" has one address, the plain one: opened by its own identifier,
      // the address is replaced (rules BR3.1).
      const isTop = folder.path.length === 1;
      if (isTop && asked !== ROOT) {
        replaceAddress(ROOT, folder.path);
      }
      document.title = folder.name;
      setScreen({
        asked: isTop ? ROOT : asked,
        steps: folder.path,
        list: listOf(folder.items),
        folder: { name: folder.name, version: result.version },
        selection: EMPTY_SELECTION,
        status: `Folder ${folder.name}, ${countOfItems(folder.items.length)}.`,
      });
      listElement.current?.focus();
    },
    [read],
  );

  /** Design W3: the folder on screen is asked for again. */
  const refresh = useCallback(async () => {
    const before = current.current;
    if (
      before.folder === undefined ||
      (before.list.kind !== "populated" && before.list.kind !== "empty")
    ) {
      return;
    }
    const mine = opening.current;
    const result = await read(before.asked, before.folder.version);
    if (mine !== opening.current || result.kind === "unchanged") {
      return;
    }
    if (result.kind === "failed" && result.problemCode === "notFound") {
      // The open folder was deleted meanwhile.
      document.title = SITE_TITLE;
      setScreen((now) => ({
        ...now,
        list: { kind: "notFound" },
        selection: EMPTY_SELECTION,
        status: "",
      }));
      return;
    }
    if (result.kind !== "answered") {
      // A failed refresh keeps what is on screen.
      return;
    }
    const folder = result.data;
    const now = current.current;
    const refreshed = refreshSelection(
      rowsOf(now.list),
      folder.items,
      now.selection,
    );
    noteActionAboutToGo(folder.items, refreshed.selection);
    setScreen({
      ...now,
      steps: folder.path,
      list: listOf(folder.items),
      folder: { name: folder.name, version: result.version },
      selection: refreshed.selection,
      // Said only when a selected row is gone.
      status: refreshed.gone > 0 ? goneText(refreshed.gone) : now.status,
    });
  }, [read, noteActionAboutToGo]);

  // The folder the address names, when the page opens and whenever the
  // browser moves through its history.
  useEffect(() => {
    const fromAddress = (): void => {
      void open(
        folderFromAddress(window.location.pathname),
        knownPath(window.history.state) ?? [TOP_STEP],
      );
    };
    fromAddress();
    window.addEventListener("popstate", fromAddress);
    return () => {
      window.removeEventListener("popstate", fromAddress);
      // Leaving the page: whatever is still on its way is ignored.
      opening.current += 1;
    };
  }, [open]);

  useEffect(() => {
    const whenVisible = (): void => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", whenVisible);
    return () => document.removeEventListener("visibilitychange", whenVisible);
  }, [refresh]);

  /** Opens a folder from a row or a breadcrumb step: a new history entry, then W2. */
  const navigate = useCallback(
    (asked: string, steps: PathStep[]) => {
      pushAddress(asked, steps);
      void open(asked, steps);
    },
    [open],
  );

  const input = useCallback(
    (selectionInput: SelectionInput) => {
      const before = current.current;
      const rows = rowsOf(before.list);
      const { selection, effect } = select(
        rows,
        before.selection,
        selectionInput,
      );
      if (effect?.type === "openFolder") {
        const row = rows.find(
          (candidate) => candidate.itemId === effect.itemId,
        );
        navigate(effect.itemId, [
          ...before.steps,
          { folderId: effect.itemId, name: row?.name ?? "" },
        ]);
        return;
      }
      const changed =
        selection.selected.size !== before.selection.selected.size ||
        [...selection.selected].some(
          (itemId) => !before.selection.selected.has(itemId),
        );
      const status =
        effect?.type === "fileNotAvailable"
          ? OPENING_NOT_AVAILABLE_YET
          : effect?.type === "chooseDelete"
            ? NOT_AVAILABLE_YET
            : changed
              ? selectedText(selection.selected.size)
              : before.status;
      noteActionAboutToGo(rows, selection);
      if (selectionInput.type === "clear") {
        // The "Clear" control is about to go; the keyboard goes to the list.
        focusListNext.current = true;
      }
      setScreen({ ...before, selection, status });
    },
    [navigate, noteActionAboutToGo],
  );

  const selectedRows = rowsOf(screen.list).filter((row) =>
    screen.selection.selected.has(row.itemId),
  );
  const actions = actionsFor(selectedRows);

  // After the screen is redrawn: the keyboard goes to the list if a control
  // that had it has just gone.
  useEffect(() => {
    if (focusListNext.current) {
      focusListNext.current = false;
      focusList();
    }
  });

  return (
    <div className="folder-screen" data-testid="folder-screen">
      <Breadcrumb
        path={screen.steps}
        narrow={narrow}
        onNavigate={(index) => {
          const steps = screen.steps.slice(0, index + 1);
          navigate(
            index === 0 ? ROOT : (steps[index] as PathStep).folderId,
            steps,
          );
        }}
      />
      <ActionBar
        actions={actions}
        onAction={() =>
          setScreen((now) => ({ ...now, status: NOT_AVAILABLE_YET }))
        }
      />
      <StatusLine
        text={screen.status}
        canClear={screen.selection.selected.size > 0}
        onClear={() => input({ type: "clear" })}
      />
      <FileList
        list={screen.list}
        folderName={screen.folder?.name ?? "Folder"}
        selection={screen.selection}
        onInput={input}
        onRetry={() => void open(screen.asked, screen.steps)}
        onOpenTop={() => navigate(ROOT, [TOP_STEP])}
        listRef={listElement}
      />
    </div>
  );
}

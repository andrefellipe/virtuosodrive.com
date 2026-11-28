import type { FolderRow } from "../api/folder.ts";
import { ACTION_ICONS } from "./icons.ts";

export type ActionName =
  "upload" | "newFolder" | "download" | "rename" | "delete";

const LABELS: Record<ActionName, string> = {
  upload: "Upload",
  newFolder: "New Folder",
  download: "Download",
  rename: "Rename",
  delete: "Delete",
};

/**
 * The actions that fit a selection (rules BR4.4): with nothing selected,
 * Upload and New Folder; with exactly one file, also Download, Rename and
 * Delete; with one folder, or several items of any kind, also Download and
 * Delete, and not Rename. An action that would not fit is not shown.
 */
export function actionsFor(selected: readonly FolderRow[]): ActionName[] {
  if (selected.length === 0) {
    return ["upload", "newFolder"];
  }
  if (selected.length === 1 && selected[0]?.kind === "file") {
    return ["upload", "newFolder", "download", "rename", "delete"];
  }
  return ["upload", "newFolder", "download", "delete"];
}

export interface ActionBarProps {
  actions: readonly ActionName[];
  onAction: (action: ActionName) => void;
}

/** The action whose button has the keyboard focus now, if one has. */
export function actionWithFocus(): ActionName | undefined {
  const active = document.activeElement;
  return active instanceof HTMLElement
    ? (active.dataset.action as ActionName | undefined)
    : undefined;
}

/**
 * The row of actions. Native buttons that look as the old site's links did
 * (design change 6); each icon is decorative, beside the action's text. In
 * U3 every action only says that it is not available yet (rules BR4.10):
 * the screen does that, this component only reports the choice.
 */
export function ActionBar({ actions, onAction }: ActionBarProps) {
  return (
    <div
      className="actions"
      role="toolbar"
      aria-label="Actions"
      data-testid="action-bar"
    >
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          className="action-button"
          onClick={() => onAction(action)}
          data-action={action}
          data-testid={`action-${action}`}
        >
          <img src={ACTION_ICONS[action]} alt="" width="40" height="40" />
          {LABELS[action]}
        </button>
      ))}
    </div>
  );
}

export interface StatusLineProps {
  /** What the line says now. Names in it are text, like everything React renders. */
  text: string;
  /** Whether anything is selected: the line then carries "Clear". */
  canClear: boolean;
  onClear: () => void;
}

/**
 * The one polite status line above the list (performance design P27): always
 * in the page, its text changing with what happened: a folder opened, how
 * many rows are selected, a selected row gone, an action that is not
 * available yet. Focus is never moved to it. While anything is selected it
 * carries a "Clear" control, for touch and for everyone else (rules BR4.7).
 */
export function StatusLine({ text, canClear, onClear }: StatusLineProps) {
  return (
    <div className="status-line">
      <p
        className="status-line-text"
        role="status"
        aria-live="polite"
        data-testid="status-line"
      >
        {text}
      </p>
      {canClear && (
        <button
          type="button"
          className="plain-button"
          onClick={onClear}
          data-testid="status-line-clear"
        >
          Clear
        </button>
      )}
    </div>
  );
}

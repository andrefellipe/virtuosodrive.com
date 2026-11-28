import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import type { PathStep } from "../api/folder.ts";
import { addressOf, ROOT } from "./address.ts";

/** Below this width the breadcrumb collapses (rules BR3.9). */
export const NARROW_QUERY = "(max-width: 767.98px)";

/** Whether the page is narrower than 768 pixels, kept up to date. */
export function useNarrow(): boolean {
  const query = (): MediaQueryList | undefined =>
    typeof window.matchMedia === "function"
      ? window.matchMedia(NARROW_QUERY)
      : undefined;
  const [narrow, setNarrow] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const media = query();
    if (media === undefined) {
      return undefined;
    }
    const update = (): void => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return narrow;
}

export interface BreadcrumbProps {
  /** The steps from "All" to the open folder, as far as they are known. */
  path: readonly PathStep[];
  /** Below 768 pixels: show "All", "..." and the last two steps. */
  narrow: boolean;
  /** Opens the folder of the step at this place in the path. */
  onNavigate: (index: number) => void;
}

/** The address of a step: the first is always "All", whose address is the plain one. */
function stepAddress(path: readonly PathStep[], index: number): string {
  return addressOf(index === 0 ? ROOT : (path[index] as PathStep).folderId);
}

/**
 * The path from "All" to the open folder (rules BR3.9). Every step but the
 * last is a link that opens its folder; the last is text, marked as the
 * current page. The links carry real addresses, so they work on their own
 * even when the list could not be loaded (rules BR3.7).
 */
export function Breadcrumb({ path, narrow, onNavigate }: BreadcrumbProps) {
  const [expanded, setExpanded] = useState(false);
  // A new path starts collapsed again.
  const last = path.at(-1)?.folderId;
  useEffect(() => {
    setExpanded(false);
  }, [last]);

  const collapsed = narrow && !expanded && path.length > 4;
  const shown = path
    .map((step, index) => ({ step, index }))
    .filter(
      ({ index }) => !collapsed || index === 0 || index >= path.length - 2,
    );

  const open = (event: MouseEvent, index: number): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      // Left to the browser: a new tab or window, by the link's own address.
      return;
    }
    event.preventDefault();
    onNavigate(index);
  };

  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumb">
      <ol className="breadcrumb">
        {shown.flatMap(({ step, index }) => [
          <li key={`${index}-${step.folderId}`} className="breadcrumb-item">
            {index === path.length - 1 ? (
              <span aria-current="page" data-testid="breadcrumb-current">
                {step.name}
              </span>
            ) : (
              <a
                href={stepAddress(path, index)}
                onClick={(event) => open(event, index)}
                data-testid="breadcrumb-step"
              >
                {step.name}
              </a>
            )}
          </li>,
          ...(collapsed && index === 0
            ? [
                <li key="more" className="breadcrumb-item">
                  <button
                    type="button"
                    className="plain-button breadcrumb-more"
                    aria-label="Show the whole path"
                    aria-expanded="false"
                    onClick={() => setExpanded(true)}
                    data-testid="breadcrumb-more"
                  >
                    ...
                  </button>
                </li>,
              ]
            : []),
        ])}
      </ol>
    </nav>
  );
}

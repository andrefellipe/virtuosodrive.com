import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadResult } from "../api/call-server.ts";
import { readSiteInformation } from "../api/site-information.ts";
import type { SiteStatusAnswer } from "../api/site-information.ts";

type View =
  | { kind: "checking" }
  | { kind: "answered"; version: string; environment: string }
  | { kind: "couldNotReach"; requestId: string };

export interface SiteStatusProps {
  /** Replaced in tests; the page uses the real call. */
  read?: () => Promise<ReadResult<SiteStatusAnswer>>;
}

/**
 * The slice's status, in one of three views: checking; answered, with the
 * version and the environment; could not reach, with a "Try again" button and
 * the request identifier. It says the server and database answered only when
 * they just did: every check starts from "checking", and nothing from an
 * earlier visit or an earlier check is shown (rules BR1.2).
 */
export function SiteStatus({ read = readSiteInformation }: SiteStatusProps) {
  const [view, setView] = useState<View>({ kind: "checking" });
  const latestCheck = useRef(0);
  const retryButton = useRef<HTMLButtonElement>(null);

  const check = useCallback(async () => {
    const thisCheck = ++latestCheck.current;
    setView({ kind: "checking" });
    const result = await read();
    if (thisCheck !== latestCheck.current) {
      // A newer check has started; this answer is no longer the latest.
      return;
    }
    if (result.kind === "answered") {
      setView({
        kind: "answered",
        version: result.data.version,
        environment: result.data.environment,
      });
    } else if (result.kind === "failed") {
      setView({ kind: "couldNotReach", requestId: result.requestId });
    }
    // "accessNeeded": the page is being reloaded to ask for the access
    // password; the checking line stays until it is.
  }, [read]);

  useEffect(() => {
    void check();
    return () => {
      // Leaving the page: whatever is still on its way is ignored.
      latestCheck.current += 1;
    };
  }, [check]);

  useEffect(() => {
    if (view.kind === "couldNotReach") {
      retryButton.current?.focus();
    }
  }, [view.kind]);

  return (
    <section className="site-status" aria-label="Site status">
      <p
        className="site-status-line"
        role="status"
        aria-live="polite"
        data-testid="site-status-line"
      >
        {view.kind === "checking" && "Checking the server…"}
        {view.kind === "answered" && "The server and database answered."}
        {view.kind === "couldNotReach" && "The server could not be reached."}
      </p>

      {view.kind === "answered" && (
        <dl className="site-status-facts">
          <dt>Version</dt>
          <dd data-testid="site-status-version">{view.version}</dd>
          <dt>Environment</dt>
          <dd data-testid="site-status-environment">{view.environment}</dd>
        </dl>
      )}

      {view.kind === "couldNotReach" && (
        <>
          <button
            type="button"
            className="button"
            ref={retryButton}
            onClick={() => void check()}
            data-testid="site-status-retry-button"
          >
            Try again
          </button>
          {view.requestId !== "" && (
            <p
              className="site-status-request-id"
              data-testid="site-status-request-id"
            >
              Request identifier: {view.requestId}
            </p>
          )}
        </>
      )}
    </section>
  );
}

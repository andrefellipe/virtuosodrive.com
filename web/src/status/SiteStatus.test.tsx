// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../App.tsx";
import type { ReadResult } from "../api/call-server.ts";
import type { SiteStatusAnswer } from "../api/site-information.ts";
import { SiteStatus } from "./SiteStatus.tsx";

type Result = ReadResult<SiteStatusAnswer>;

const ANSWERED: Result = {
  kind: "answered",
  requestId: "page-1",
  data: {
    installedAt: "2026-12-01T14:03:22.118Z",
    version: "a1b2c3d",
    environment: "test",
  },
};
const FAILED: Result = { kind: "failed", requestId: "page-3" };

/** A stand-in for the call to the server whose answers the test hands out one by one. */
function controlledRead() {
  const waiting: ((result: Result) => void)[] = [];
  let calls = 0;
  return {
    read: () => {
      calls += 1;
      return new Promise<Result>((resolve) => waiting.push(resolve));
    },
    answer: (result: Result) => {
      const resolve = waiting.shift();
      if (resolve === undefined) {
        throw new Error("No call to the server is waiting for an answer");
      }
      resolve(result);
    },
    calls: () => calls,
  };
}

const statusLine = () => screen.getByTestId("site-status-line");
const retryButton = () => screen.queryByTestId("site-status-retry-button");

describe("SiteStatus", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the checking view while the server has not answered", () => {
    const server = controlledRead();
    render(<SiteStatus read={server.read} />);

    expect(statusLine().textContent).toBe("Checking the server…");
    expect(retryButton()).toBeNull();
    expect(screen.queryByTestId("site-status-version")).toBeNull();
    expect(server.calls()).toBe(1);
  });

  it("shows the answered view with the version and the environment", async () => {
    const server = controlledRead();
    render(<SiteStatus read={server.read} />);

    server.answer(ANSWERED);

    await waitFor(() =>
      expect(statusLine().textContent).toBe(
        "The server and database answered.",
      ),
    );
    expect(screen.getByTestId("site-status-version").textContent).toBe(
      "a1b2c3d",
    );
    expect(screen.getByTestId("site-status-environment").textContent).toBe(
      "test",
    );
    expect(retryButton()).toBeNull();
  });

  it("shows the could-not-reach view with a focused Try again button and the request identifier", async () => {
    const server = controlledRead();
    render(<SiteStatus read={server.read} />);

    server.answer(FAILED);

    await waitFor(() =>
      expect(statusLine().textContent).toBe("The server could not be reached."),
    );
    const button = retryButton();
    expect(button?.tagName).toBe("BUTTON");
    expect(button?.textContent).toBe("Try again");
    expect(document.activeElement).toBe(button);
    expect(screen.getByTestId("site-status-request-id").textContent).toBe(
      "Request identifier: page-3",
    );
    expect(screen.queryByTestId("site-status-version")).toBeNull();
  });

  it("does not show a Problem's text or code to the visitor", async () => {
    const server = controlledRead();
    render(<SiteStatus read={server.read} />);

    server.answer({
      kind: "failed",
      requestId: "server-9",
      problemCode: "serverError",
    });

    await waitFor(() => expect(retryButton()).not.toBeNull());
    expect(document.body.textContent).not.toContain("serverError");
  });

  it("goes back to checking when Try again is pressed, then shows the new answer", async () => {
    const server = controlledRead();
    render(<SiteStatus read={server.read} />);
    server.answer(FAILED);
    await waitFor(() => expect(retryButton()).not.toBeNull());

    fireEvent.click(retryButton() as HTMLElement);

    expect(statusLine().textContent).toBe("Checking the server…");
    expect(retryButton()).toBeNull();
    expect(screen.queryByTestId("site-status-request-id")).toBeNull();
    expect(server.calls()).toBe(2);

    server.answer(ANSWERED);
    await waitFor(() =>
      expect(screen.getByTestId("site-status-version").textContent).toBe(
        "a1b2c3d",
      ),
    );
  });

  it("never shows an earlier success: a new visit that fails shows only the failure", async () => {
    const first = controlledRead();
    const firstVisit = render(<SiteStatus read={first.read} />);
    first.answer(ANSWERED);
    await waitFor(() =>
      expect(screen.queryByTestId("site-status-version")).not.toBeNull(),
    );
    firstVisit.unmount();

    const second = controlledRead();
    render(<SiteStatus read={second.read} />);
    expect(statusLine().textContent).toBe("Checking the server…");
    expect(screen.queryByTestId("site-status-version")).toBeNull();

    second.answer(FAILED);
    await waitFor(() => expect(retryButton()).not.toBeNull());
    expect(document.body.textContent).not.toContain("a1b2c3d");
    expect(document.body.textContent).not.toContain("answered");
  });

  it("announces each change: the status line is a polite live region", async () => {
    const server = controlledRead();
    render(<SiteStatus read={server.read} />);
    const line = statusLine();

    expect(line.getAttribute("role")).toBe("status");
    expect(line.getAttribute("aria-live")).toBe("polite");

    server.answer(ANSWERED);
    await waitFor(() =>
      expect(line.textContent).toBe("The server and database answered."),
    );
    expect(statusLine()).toBe(line);
  });

  it("stays on checking, with no button, while the page reloads to ask for the access password", async () => {
    const server = controlledRead();
    render(<SiteStatus read={server.read} />);

    server.answer({ kind: "accessNeeded" });
    await Promise.resolve();
    await Promise.resolve();

    expect(statusLine().textContent).toBe("Checking the server…");
    expect(retryButton()).toBeNull();
  });
});

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the site's name and logo around the status", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Virtuoso Drive",
    );
    expect(document.querySelector("header img")).not.toBeNull();
    expect(screen.getByRole("main").contains(statusLine())).toBe(true);
  });
});

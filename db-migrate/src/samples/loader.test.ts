import { describe, expect, it } from "vitest";
import {
  FolderBusyError,
  PathTooDeepError,
  StoreRefusedError,
} from "../../../server/src/drive/store-errors.ts";
import {
  failureKind,
  loadSamples,
  REFUSED_IN_PRODUCTION,
  SampleLoadError,
} from "./loader.ts";
import type { SampleSummary } from "./loader.ts";

const FOLDER = "3f2b8c1e-9a4d-4e6f-8b7a-0c1d2e3f4a5b";
const A_NAME = "Prova final do Fulano.pdf";

describe("the sample loader", () => {
  it("refuses to run in production, before opening a connection, and says so in its summary", async () => {
    let connections = 0;
    const written: SampleSummary[] = [];

    const failure = await loadSamples({
      environment: "production",
      connect: () => {
        connections += 1;
        return Promise.reject(new Error("no connection may be opened"));
      },
      log: (summary) => written.push(summary),
    }).catch((error: unknown) => error);

    expect(connections).toBe(0);
    expect(failure).toBeInstanceOf(SampleLoadError);
    expect(REFUSED_IN_PRODUCTION).toBe("refusedInProduction");
    expect(written).toEqual([
      {
        mode: "load-samples",
        environment: "production",
        created: 0,
        found: 0,
        filled: 0,
        failed: { key: "none", kind: "refusedInProduction" },
      },
    ]);
    expect((failure as SampleLoadError).summary).toEqual(written[0]);
  });

  it("reports a connection that cannot be opened as a failure of the run, by the error's class only", async () => {
    const written: SampleSummary[] = [];

    await expect(
      loadSamples({
        environment: "test",
        connect: () =>
          Promise.reject(
            new Error(`could not connect while reading ${A_NAME}`),
          ),
        log: (summary) => written.push(summary),
      }),
    ).rejects.toThrow('Loading sample content failed at entry "none": Error');

    expect(written).toEqual([
      {
        mode: "load-samples",
        environment: "test",
        created: 0,
        found: 0,
        filled: 0,
        failed: { key: "none", kind: "Error" },
      },
    ]);
    expect(JSON.stringify(written)).not.toContain("Fulano");
  });

  describe("the kind of a failure, as it is logged", () => {
    it("is the rule's name and the code for a refused write, and never the database's message", () => {
      const databaseError = Object.assign(
        new Error(`duplicate key (${A_NAME}) already exists`),
        { code: "23505", constraint: "items_source_key_unique" },
      );

      const kind = failureKind(new StoreRefusedError(FOLDER, databaseError));

      expect(kind).toBe(
        "storeRefused (code 23505, rule items_source_key_unique)",
      );
      expect(failureKind(databaseError)).toBe("database error 23505");
      expect(`${kind}${failureKind(databaseError)}`).not.toContain("Fulano");
    });

    it("is the fault's name for the other named faults", () => {
      expect(failureKind(new FolderBusyError(FOLDER))).toBe("folderBusy");
      expect(failureKind(new PathTooDeepError(FOLDER, 64))).toBe("pathTooDeep");
    });

    it("is the error's class for anything else, and says unknown for what is no error", () => {
      expect(failureKind(new TypeError(A_NAME))).toBe("TypeError");
      expect(failureKind({ fault: A_NAME })).toBe("unknown");
      expect(failureKind(A_NAME)).toBe("unknown");
      expect(failureKind(null)).toBe("unknown");
    });
  });
});

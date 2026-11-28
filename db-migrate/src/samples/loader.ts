import type { ClientBase } from "pg";
import type { Transactions } from "../../../server/src/db/database.ts";
import { addItem } from "../../../server/src/drive/change-step.ts";
import type { ContentItem } from "../../../server/src/drive/change-step.ts";
import { ROOT_FOLDER } from "../../../server/src/drive/identifiers.ts";
import {
  describeDatabaseError,
  StoreRefusedError,
} from "../../../server/src/drive/store-errors.ts";
import { FAULTS } from "../../../server/src/log/fault.ts";
import { clientTransactions } from "../client-transactions.ts";
import { allNodes, SAMPLE_SET } from "./sample-set.ts";
import type { SampleNode } from "./sample-set.ts";

/**
 * The sample loader (design W6; reliability design R25): the change
 * runner's second mode. It makes nothing twice: each entry is looked for by
 * its source key, and created only when it is not there.
 *
 *   - Entries are processed in the fixed order of the sample set, parents
 *     before children, each created through the change step in a
 *     transaction of its own.
 *   - An entry that is to be deleted is created and marked deleted in that
 *     same transaction. A deleted folder is created with everything it
 *     holds in that one transaction too: nothing can be added to a folder
 *     once it is hidden.
 *   - Stopped half-way, it leaves a prefix of the entries, each complete.
 *     Run again, it finds those by their keys and carries on.
 *   - It refuses to do anything in production, before opening a connection
 *     (security design S31).
 *   - What it writes down holds no name of a file or folder, and never the
 *     database's own error text (observability design O23): counts, and for
 *     a failure the sample entry's key and the kind of failure.
 */

export interface SampleSummary {
  mode: "load-samples";
  environment: string;
  /** Items this run created. */
  created: number;
  /** Items found already there, and left as they are. */
  found: number;
  /** Sample files given contents. Always 0 until U4 stores contents. */
  filled: number;
  /** Where the run stopped, when it failed. */
  failed?: { key: string; kind: string };
}

/** A failed run. Its message and summary are safe to log: keys and kinds only. */
export class SampleLoadError extends Error {
  readonly summary: SampleSummary;

  constructor(summary: SampleSummary) {
    super(
      `Loading sample content failed at entry "${summary.failed?.key ?? "none"}": ${summary.failed?.kind ?? "unknown"}`,
    );
    this.name = "SampleLoadError";
    this.summary = summary;
  }
}

/** What the loader does when asked to run in production. */
export const REFUSED_IN_PRODUCTION = "refusedInProduction";

export interface LoaderDependencies {
  /** The environment's name, from the runner's own configuration. */
  environment: "test" | "production";
  /** Opens the change runner's connection, as the user that owns the tables. */
  connect(): Promise<ClientBase & { end(): Promise<void> }>;
  /** The entries to load; the repository's sample set when left out. */
  samples?: readonly SampleNode[];
  /** Writes the one summary of the run. */
  log(summary: SampleSummary): void;
}

const FIND_BY_SOURCE_KEY = "SELECT id FROM items WHERE source_key = $1";

/**
 * The kind of a failure, in words that are safe to log: a refusal's code, a
 * named fault (with the rule's name for a refused write), the database's
 * error code, or the error's class. Never a message.
 */
export function failureKind(error: unknown): string {
  if (error instanceof SampleRefused) {
    return error.refusal;
  }
  if (error instanceof StoreRefusedError) {
    return `storeRefused (code ${error.code ?? "unknown"}, rule ${error.rule ?? "unknown"})`;
  }
  const fault = (error as { fault?: unknown } | null)?.fault;
  if (
    typeof fault === "string" &&
    (FAULTS as readonly string[]).includes(fault)
  ) {
    return fault;
  }
  const { code } = describeDatabaseError(error);
  if (code !== undefined) {
    return `database error ${code}`;
  }
  return error instanceof Error ? error.name : "unknown";
}

/** The change step refused a sample entry. */
class SampleRefused extends Error {
  readonly refusal: string;

  constructor(refusal: string) {
    super(`The change step refused a sample entry: ${refusal}`);
    this.name = "SampleRefused";
    this.refusal = refusal;
  }
}

function asContent(node: SampleNode): ContentItem {
  return {
    kind: node.kind,
    name: node.name,
    ...(node.size === undefined ? {} : { size: node.size }),
    ...(node.contentType === undefined
      ? {}
      : { contentType: node.contentType }),
    sourceKey: node.sourceKey,
    ...(node.deleted ? { markDeleted: true } : {}),
    ...(node.kind === "folder"
      ? { contents: node.children.map(asContent) }
      : {}),
  };
}

interface Progress {
  created: number;
  found: number;
  /** The entry being worked on, for the summary of a failure. */
  at: string;
}

async function loadNode(
  client: ClientBase,
  transactions: Transactions,
  node: SampleNode,
  folderId: string,
  progress: Progress,
): Promise<void> {
  progress.at = node.sourceKey;
  // A deleted folder is one piece with everything in it: made in one
  // transaction, and so either wholly there or not there at all.
  const onePiece = node.kind === "folder" && node.deleted;
  const existing = await client.query<{ id: string }>(FIND_BY_SOURCE_KEY, [
    node.sourceKey,
  ]);
  let itemId = existing.rows[0]?.id;
  if (itemId !== undefined) {
    // Found: left exactly as it is (rules BR2.10).
    progress.found += onePiece ? 1 + allNodes(node.children).length : 1;
  } else {
    const content = asContent(node);
    const result = await addItem(transactions, {
      ...content,
      folderId,
      ...(onePiece ? {} : { contents: [] }),
    });
    if (!result.ok) {
      throw new SampleRefused(result.refusal);
    }
    itemId = result.itemId;
    progress.created += result.itemsWritten;
  }
  if (node.kind === "folder" && !onePiece) {
    for (const child of node.children) {
      await loadNode(client, transactions, child, itemId, progress);
    }
  }
}

/**
 * Loads the sample content. Answers the summary of the run, which it has
 * also written; on a failure writes the summary and throws SampleLoadError,
 * which fails the deployment before the new server and page are put in
 * place (reliability design R24).
 */
export async function loadSamples(
  dependencies: LoaderDependencies,
): Promise<SampleSummary> {
  const progress: Progress = { created: 0, found: 0, at: "none" };
  const summary = (failure?: unknown): SampleSummary => ({
    mode: "load-samples",
    environment: dependencies.environment,
    created: progress.created,
    found: progress.found,
    filled: 0,
    ...(failure === undefined
      ? {}
      : { failed: { key: progress.at, kind: failureKind(failure) } }),
  });
  const stop = (failure: unknown, kind?: string): never => {
    const failed = summary(failure);
    if (kind !== undefined && failed.failed !== undefined) {
      failed.failed.kind = kind;
    }
    dependencies.log(failed);
    throw new SampleLoadError(failed);
  };

  // Before any connection is opened.
  if (dependencies.environment !== "test") {
    return stop(new Error("production"), REFUSED_IN_PRODUCTION);
  }

  let client: (ClientBase & { end(): Promise<void> }) | undefined;
  try {
    client = await dependencies.connect();
    const transactions = clientTransactions(client);
    for (const node of dependencies.samples ?? SAMPLE_SET) {
      await loadNode(client, transactions, node, ROOT_FOLDER, progress);
    }
  } catch (error) {
    return stop(error);
  } finally {
    await client?.end().catch(() => undefined);
  }
  const done = summary();
  dependencies.log(done);
  return done;
}

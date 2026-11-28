import { z } from "zod";
import type { Database } from "../db/database.ts";
import { getFolderView } from "../drive/folder-reading.ts";
import { isFolderIdentifier, ROOT_FOLDER } from "../drive/identifiers.ts";
import {
  describeDatabaseError,
  PathTooDeepError,
} from "../drive/store-errors.ts";
import { makeVersionTag } from "../drive/version-tag.ts";
import {
  ACCEPT_GZIP_HEADER,
  ACCEPT_GZIP_HEADER_NAME,
  prepareJson,
} from "../http/body.ts";
import { defineOperation } from "../http/operation.ts";
import type {
  DeclaredHeaders,
  LogFields,
  Operation,
  OperationResult,
} from "../http/operation.ts";
import { OperationFailure } from "../http/problem.ts";

/** The header in which a caller says which version it holds. */
const VERSION_HELD = "if-none-match";

const versionSent = (headers: DeclaredHeaders): boolean =>
  headers[VERSION_HELD] !== undefined;

/**
 * The one way this operation says "not found": for a folder that is unknown,
 * deleted, or inside a deleted folder (security design S24). It takes no
 * argument, so nothing can vary the answer. An identifier of the wrong form
 * gets the same Problem from the request steps, before the operation runs.
 */
function notFound(): OperationResult {
  return {
    problem: "notFound",
    log: { folderOutcome: "notFound", notFoundReason: "absentOrHidden" },
  };
}

/**
 * What may be logged of a failed read. A database error's own message is
 * never passed on: it can quote a value, and here values are names
 * (observability design O23). Its code is enough to find the cause.
 */
function readFailure(error: unknown): unknown {
  if (error instanceof PathTooDeepError) {
    return new OperationFailure("serverError", error.message, {
      fault: error.fault,
    });
  }
  const { code, rule } = describeDatabaseError(error);
  if (code !== undefined) {
    return new OperationFailure(
      "serverError",
      `The database failed the folder read: code ${code}${rule === undefined ? "" : `, rule ${rule}`}`,
    );
  }
  return error;
}

export interface FolderOperationOptions {
  /** A clock in milliseconds, for the duration the operation reports. */
  now?: () => number;
}

/**
 * GET /v1/folders/{folderId} (contract C3; design W1). Answers a folder, the
 * path to it from "All", and its visible items in order. Anyone may ask: the
 * operation never looks at a session (security design S32).
 *
 *   - `root` means the top folder. An identifier that is neither `root` nor
 *     of the generated form is "not found", decided by the declared check of
 *     the path's value before anything reaches a statement (S20).
 *   - A caller that sends the version it holds is told "unchanged" (304, no
 *     content) when that is the current one; visibility is checked first
 *     (S27, in the Drive module).
 *   - The answer is compressed only for a caller that sends the header
 *     `X-Accept-Gzip: 1`, and then only when that is the smaller form to
 *     send (performance design P22, with the header of our own in place of
 *     "Accept-Encoding", which this operation does not read: see
 *     http/body.ts). It is never to be stored (S28): the request
 *     steps mark every answer so, "not found" and "unchanged" included.
 *   - A full answer reports the time the operation took, in `Server-Timing`,
 *     which the pipeline's speed gate reads.
 *
 * The working example for an operation with a path value, declared headers,
 * its own response headers and its own log fields.
 */
export function folderOperation(
  database: Database,
  options: FolderOperationOptions = {},
): Operation {
  const now = options.now ?? (() => performance.now());
  return defineOperation({
    name: "getFolder",
    method: "GET",
    path: "/v1/folders/{folderId}",
    query: z.strictObject({}),
    params: z.strictObject({
      folderId: z.string().refine(isFolderIdentifier),
    }),
    invalidParams: {
      problem: "notFound",
      // The identifier sent is not logged (observability design O20).
      log: (headers): LogFields => ({
        folderOutcome: "notFound",
        notFoundReason: "malformed",
        versionSent: versionSent(headers),
      }),
    },
    headers: [VERSION_HELD, ACCEPT_GZIP_HEADER],
    logFields: {
      folderId: "string",
      folderOutcome: "string",
      notFoundReason: "string",
      rows: "number",
      answerBytes: "number",
      versionSent: "boolean",
    },
    failureLog: { folderOutcome: "failed" },
    async run({ params, headers, log }) {
      const startedAt = now();
      log({ versionSent: versionSent(headers) });
      if (params.folderId !== ROOT_FOLDER) {
        // Well formed, so it may be logged; `root` is logged as the top
        // folder's own identifier once that is known.
        log({ folderId: params.folderId });
      }

      const answer = await database
        .run((connection) =>
          getFolderView(connection, params.folderId, headers[VERSION_HELD]),
        )
        .catch((error: unknown) => {
          throw readFailure(error);
        });

      if (answer.kind === "notFound") {
        return notFound();
      }
      if (answer.kind === "unchanged") {
        return {
          status: 304,
          headers: { etag: makeVersionTag(answer.folderId, answer.version) },
          log: { folderId: answer.folderId, folderOutcome: "unchanged" },
        };
      }
      const { prepared, sentBytes } = prepareJson(
        JSON.stringify(answer.view),
        headers[ACCEPT_GZIP_HEADER],
      );
      return {
        status: 200,
        prepared,
        headers: {
          etag: makeVersionTag(answer.view.folderId, answer.version),
          // A full answer depends on whether the caller sent the header:
          // compressed for one that did, plain for one that did not.
          vary: ACCEPT_GZIP_HEADER_NAME,
          "server-timing": `app;dur=${Math.max(0, now() - startedAt).toFixed(1)}`,
        },
        log: {
          folderId: answer.view.folderId,
          folderOutcome: "answered",
          rows: answer.view.items.length,
          answerBytes: sentBytes,
        },
      };
    },
  });
}

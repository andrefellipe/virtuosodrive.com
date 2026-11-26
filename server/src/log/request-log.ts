import { LogFormatter, Logger, LogItem } from "@aws-lambda-powertools/logger";
import type {
  LogAttributes,
  UnformattedAttributes,
} from "@aws-lambda-powertools/logger/types";
import type { RequestLogEntry } from "./entry.ts";
import { scrub } from "./scrub.ts";

/** Where request entries are written. */
export interface RequestLog {
  write(entry: RequestLogEntry): void;
}

/**
 * Writes the entry's own fields and nothing the library would add by itself,
 * so that a log line holds exactly the named fields.
 */
class EntryOnlyFormatter extends LogFormatter {
  public formatAttributes(
    attributes: UnformattedAttributes,
    additionalLogAttributes: LogAttributes,
  ): LogItem {
    // The library keeps "level" for itself and drops it from what it is
    // handed, so the entry's level is put back from the library's own.
    return new LogItem({
      attributes: {
        ...additionalLogAttributes,
        level: attributes.logLevel.toLowerCase(),
      },
    });
  }
}

/** Writes each entry as one line of JSON through Powertools for AWS Lambda. */
export function createRequestLog(): RequestLog {
  const logger = new Logger({
    logLevel: "INFO",
    logFormatter: new EntryOnlyFormatter(),
  });
  return {
    write(entry) {
      // Scrubbed here as well as where the entry is built: every entry passes
      // through this one function, whoever made it.
      const safe = scrub(entry) as unknown as LogAttributes;
      if (entry.level === "error") {
        logger.error("request", safe);
      } else {
        logger.info("request", safe);
      }
    },
  };
}

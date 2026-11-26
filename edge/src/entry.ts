import { createHandler } from "./handler.ts";
import type { EdgeCrypto } from "./handler.ts";
import type { EdgeEvent, EdgeRequest, EdgeResponse } from "./gate.ts";

/**
 * The file the build compiles for the edge. The edge runtime has no modules:
 * it calls a global function named "handler". The build therefore wraps this
 * file's code in a function, declares the object below in front of it, and
 * adds the global "handler" behind it, which calls what is stored here.
 */
declare const __vdGate: {
  createHandler?: (
    crypto: EdgeCrypto,
  ) => (event: EdgeEvent) => EdgeRequest | EdgeResponse;
};

__vdGate.createHandler = createHandler;

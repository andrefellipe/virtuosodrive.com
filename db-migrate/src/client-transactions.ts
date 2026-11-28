import type { ClientBase } from "pg";
import { TransactionAbandonedError } from "../../server/src/db/database.ts";
import type { Queryable, Transactions } from "../../server/src/db/database.ts";

/**
 * Transactions on the change runner's own connection, for the change step
 * (reliability design R21: in U3 only the sample loader runs it, inside the
 * change runner, on that function's own connection).
 *
 * The work runs under no deadline of its own: the function's own time limit
 * bounds the run, and the change step bounds its wait for a folder by
 * itself. If the work fails, the transaction is rolled back and the failure
 * is passed on; a rollback that itself fails is reported with it, because
 * the connection must then not be used again.
 *
 * Because there is no deadline, the work has always ended before the commit
 * or the rollback is sent; the server's own access, which gives up on work
 * that is still running, is where a late statement is a real danger. The
 * same guard is kept here all the same: once the transaction has ended, the
 * connection handed to the work refuses every further statement.
 */
export function clientTransactions(client: ClientBase): Transactions {
  const queryable: Queryable = client;
  return {
    async transaction(work) {
      // Set when the transaction ends, either way, before the commit or the
      // rollback is sent. A statement the work still sent afterwards (from a
      // branch it did not wait for) would run outside the transaction and be
      // kept on its own, so the connection handed to the work refuses it.
      let ended = false;
      await client.query("BEGIN");
      try {
        const result = await work({
          query: async <Row extends object>(
            text: string,
            values?: readonly unknown[],
          ) => {
            if (ended) {
              throw new TransactionAbandonedError();
            }
            return queryable.query<Row>(text, values);
          },
          remainingMs: () => undefined,
        });
        ended = true;
        await client.query("COMMIT");
        return result;
      } catch (error) {
        ended = true;
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          throw new Error(
            "A transaction failed and could not be rolled back; the connection must be closed",
            { cause: rollbackError },
          );
        }
        throw error;
      }
    },
  };
}

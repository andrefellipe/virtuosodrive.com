import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { problem, PROBLEM_CONTENT_TYPE } from "./http/problem.ts";

/**
 * The code a new environment's server function is created with, before the
 * first Release is deployed. It answers every request with status 503, which
 * is the honest state of an environment with nothing deployed (reliability
 * design R3).
 */
export async function handler(): Promise<APIGatewayProxyStructuredResultV2> {
  return {
    statusCode: 503,
    headers: {
      "content-type": PROBLEM_CONTENT_TYPE,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
    body: JSON.stringify(problem("serverError", 503)),
  };
}

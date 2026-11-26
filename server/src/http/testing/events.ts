import type { APIGatewayProxyEventV2 } from "aws-lambda";

export interface TestRequest {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

/** An event of the shape the HTTP API (payload format 2.0) hands the function. */
export function httpEvent(request: TestRequest): APIGatewayProxyEventV2 {
  const method = request.method ?? "GET";
  const query = request.query;
  const rawQueryString =
    query === undefined ? "" : new URLSearchParams(query).toString();
  return {
    version: "2.0",
    routeKey: `${method} ${request.path}`,
    rawPath: request.path,
    rawQueryString,
    headers: request.headers ?? {},
    ...(query === undefined ? {} : { queryStringParameters: query }),
    requestContext: {
      accountId: "000000000000",
      apiId: "example",
      domainName: "example.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "example",
      http: {
        method,
        path: request.path,
        protocol: "HTTP/1.1",
        sourceIp: "192.0.2.1",
        userAgent: "vitest",
      },
      requestId: "entry-point-request-id",
      routeKey: `${method} ${request.path}`,
      stage: "$default",
      time: "01/Dec/2026:14:03:22 +0000",
      timeEpoch: 1796133802118,
    },
    isBase64Encoded: false,
  };
}

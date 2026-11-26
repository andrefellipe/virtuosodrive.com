import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import type { Environment } from "./entry.ts";

export const MEASUREMENT_NAMESPACE = "VirtuosoDrive";

/** The four custom measurements of an environment (monitoring design). */
export const MEASUREMENT_NAMES = [
  "Requests",
  "ServerFailures",
  "Duration",
  "ColdStarts",
] as const;

export interface RequestMeasurement {
  outcome: number;
  durationMs: number;
  coldStart: boolean;
}

/** Where a request's measurements are written. Health checks write none. */
export interface Measurements {
  record(measurement: RequestMeasurement): void;
}

/**
 * Writes the measurements in CloudWatch's embedded metric format through
 * Powertools, with the single dimension "environment". ServerFailures and
 * ColdStarts are written as 0 when they did not happen, so that every period
 * with requests has a value to divide.
 */
export function createMeasurements(environment: Environment): Measurements {
  const metrics = new Metrics({ namespace: MEASUREMENT_NAMESPACE });
  // The library's own "service" dimension would double the number of custom
  // measurements; only "environment" is kept.
  metrics.clearDefaultDimensions();
  metrics.setDefaultDimensions({ environment });
  return {
    record(measurement) {
      metrics.addMetric("Requests", MetricUnit.Count, 1);
      metrics.addMetric(
        "ServerFailures",
        MetricUnit.Count,
        measurement.outcome >= 500 ? 1 : 0,
      );
      metrics.addMetric(
        "Duration",
        MetricUnit.Milliseconds,
        Math.max(0, measurement.durationMs),
      );
      metrics.addMetric(
        "ColdStarts",
        MetricUnit.Count,
        measurement.coldStart ? 1 : 0,
      );
      metrics.publishStoredMetrics();
    },
  };
}

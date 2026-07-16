"use client";

import { useEffect, useState } from "react";

export const TRAINING_FORECAST_BATCH_SIZE = 24;
export const TRAINING_FORECAST_INITIAL_BATCH_SIZE = 6;

export function useTrainingForecastLimit(input: {
  enabled: boolean;
  totalCount: number;
  batchSize?: number;
  initialBatchSize?: number;
}) {
  const batchSize = input.batchSize ?? TRAINING_FORECAST_BATCH_SIZE;
  const initialBatchSize = input.initialBatchSize ?? TRAINING_FORECAST_INITIAL_BATCH_SIZE;
  const [limit, setLimit] = useState(initialBatchSize);

  useEffect(() => {
    if (!input.enabled) {
      setLimit(initialBatchSize);
      return;
    }
    setLimit((current) => Math.min(Math.max(current, initialBatchSize), input.totalCount));
  }, [initialBatchSize, input.enabled, input.totalCount]);

  useEffect(() => {
    if (!input.enabled || limit >= input.totalCount) {
      return undefined;
    }

    const schedule =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 32);

    const cancel =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback
        : window.clearTimeout;

    const handle = schedule(() => {
      setLimit((current) => Math.min(current + batchSize, input.totalCount));
    });

    return () => {
      cancel(handle as number);
    };
  }, [batchSize, input.enabled, input.totalCount, limit]);

  return limit;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  PlayerDirectorySortWorkerRequest,
  PlayerDirectorySortWorkerResponse,
  PlayerDirectorySortWorkerRow,
} from "@/lib/foundation/workers/player-directory-sort.worker";

type SortDirection = "asc" | "desc";

export function usePlayerDirectorySortWorker() {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      return;
    }

    const worker = new Worker(new URL("./workers/player-directory-sort.worker.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<PlayerDirectorySortWorkerResponse>) => {
      if (event.data.requestId !== requestIdRef.current) {
        return;
      }
      setOrderedIds(event.data.orderedIds);
      setPending(false);
    };

    worker.onerror = () => {
      workerRef.current = null;
      setOrderedIds(null);
      setPending(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const sortRows = useCallback(
    (rows: PlayerDirectorySortWorkerRow[], sortKey: string, direction: SortDirection) => {
      if (!workerRef.current || rows.length < 120) {
        setOrderedIds(null);
        setPending(false);
        return false;
      }

      const requestId = ++requestIdRef.current;
      setPending(true);
      const payload: PlayerDirectorySortWorkerRequest = {
        requestId,
        rows,
        sortKey,
        direction,
      };
      workerRef.current.postMessage(payload);
      return true;
    },
    [],
  );

  return {
    orderedIds,
    pending,
    sortRows,
    supportsWorker: typeof Worker !== "undefined",
  };
}

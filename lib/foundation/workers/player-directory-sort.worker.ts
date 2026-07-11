/// <reference lib="webworker" />

export type PlayerDirectorySortWorkerRow = {
  id: string;
  sortValues: Record<string, string | number>;
};

export type PlayerDirectorySortWorkerRequest = {
  requestId: number;
  rows: PlayerDirectorySortWorkerRow[];
  sortKey: string;
  direction: "asc" | "desc";
};

export type PlayerDirectorySortWorkerResponse = {
  requestId: number;
  orderedIds: string[];
};

self.onmessage = (event: MessageEvent<PlayerDirectorySortWorkerRequest>) => {
  const { requestId, rows, sortKey, direction } = event.data;
  const sorted = [...rows].sort((left, right) => {
    const leftValue = left.sortValues[sortKey] ?? "";
    const rightValue = right.sortValues[sortKey] ?? "";
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
    }
    const leftText = String(leftValue);
    const rightText = String(rightValue);
    const cmp = leftText.localeCompare(rightText, "de", { sensitivity: "base", numeric: true });
    return direction === "asc" ? cmp : -cmp;
  });

  const response: PlayerDirectorySortWorkerResponse = {
    requestId,
    orderedIds: sorted.map((row) => row.id),
  };
  self.postMessage(response);
};

export type FoundationTableSortState = {
  key: string;
  direction: "asc" | "desc";
};

function compareSortValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "de", { numeric: true, sensitivity: "base" });
}

export function sortFoundationTableRows<T>(
  rows: T[],
  sortState: FoundationTableSortState | undefined,
  accessors: Record<string, (row: T) => string | number>,
) {
  if (!sortState) {
    return rows;
  }

  const accessor = accessors[sortState.key];
  if (!accessor) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    const result = compareSortValues(accessor(left), accessor(right));
    return sortState.direction === "asc" ? result : -result;
  });
}

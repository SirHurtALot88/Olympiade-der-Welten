import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

export type TransfermarktLabMode = "loading" | "error" | "filtered_empty" | "empty" | "table";

export function isBrowserSafePortrait(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return true;
  }

  if (value.startsWith("/") && !value.startsWith("/Users/")) {
    return true;
  }

  return false;
}

export function getTransfermarktPortraitModel(item: TransfermarktFreeAgentItem) {
  const resolvedSource = [item.portraitUrl, item.imageUrl, item.portraitPath].find((value) => isBrowserSafePortrait(value)) ?? null;
  const initials = item.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

  return {
    src: resolvedSource,
    initials,
    warning: resolvedSource ? null : "missing_or_unresolved_portrait",
  };
}

export function getTransfermarktLabMode(input: {
  busy: boolean;
  data: { items: unknown[]; total: number } | null;
  errors: string[];
  hasActiveFilters: boolean;
}) {
  if (input.busy && !input.data) {
    return "loading" satisfies TransfermarktLabMode;
  }

  if (input.errors.length > 0) {
    return "error" satisfies TransfermarktLabMode;
  }

  if (!input.data) {
    return "loading" satisfies TransfermarktLabMode;
  }

  if (input.data.total > 0 && input.data.items.length === 0) {
    return "filtered_empty" satisfies TransfermarktLabMode;
  }

  if (input.data.total === 0) {
    return input.hasActiveFilters ? ("filtered_empty" satisfies TransfermarktLabMode) : ("empty" satisfies TransfermarktLabMode);
  }

  return "table" satisfies TransfermarktLabMode;
}

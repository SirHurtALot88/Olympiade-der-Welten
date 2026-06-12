export type TransfermarktFormattingCertainty = "confirmed" | "likely" | "unknown";
export type TransfermarktTier = "S+" | "S" | "A" | "B" | "C" | "D" | "E" | "F";

export type TransfermarktColorRule = {
  id: string;
  certainty: TransfermarktFormattingCertainty;
  colors: string[];
  source: string;
};

export const TRANSFERMARKT_CONFIRMED_COLOR_RULES: TransfermarktColorRule[] = [
  {
    id: "core_axis_heat_scale",
    certainty: "confirmed",
    colors: ["#1565C0", "#42A5F5", "#2E7D32", "#66BB6A", "#F9A825", "#FFEB3B", "#FF9800", "#EF5350"],
    source: "Retool playersTable Pow/Spe/Men/Soc conditionalFormatting",
  },
  {
    id: "gt_count_heat_scale",
    certainty: "confirmed",
    colors: ["#4CAF50", "#FFEB3B", "#F44336"],
    source: "Retool playersTable >20/>40/>60/>80 conditionalFormatting",
  },
  {
    id: "class_tag_palette",
    certainty: "confirmed",
    colors: ["#ff8a80", "#b71c1c", "#a5d6a7", "#1b5e20", "#90caf9", "#0d47a1", "#ffe082", "#e65100"],
    source: "Retool playersTable Klasse conditionalFormatting",
  },
];

export const TRANSFERMARKT_UNKNOWN_COLOR_RULES: TransfermarktColorRule[] = [
  {
    id: "kartenfarbe",
    certainty: "unknown",
    colors: [],
    source: "No confirmed transfermarkt source in current Prisma/JSON path",
  },
];

export function formatTransfermarktCurrency(value: number | null) {
  if (value == null) {
    return "—";
  }

  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: Math.abs(value) < 1000 ? 2 : 0,
    maximumFractionDigits: Math.abs(value) < 1000 ? 2 : 0,
  }).format(value)} €`;
}

export function formatTransfermarktRatio(value: number | null) {
  if (value == null) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatTransfermarktPoints(value: number | null | undefined, maximumFractionDigits = 2) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export function getConfirmedAxisHeatStyle(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }

  const backgroundColor =
    value >= 86 ? "#1565C0" :
    value >= 76 ? "#42A5F5" :
    value >= 66 ? "#2E7D32" :
    value >= 56 ? "#66BB6A" :
    value >= 46 ? "#F9A825" :
    value >= 36 ? "#FFEB3B" :
    value >= 21 ? "#FF9800" :
    "#EF5350";

  const color =
    backgroundColor === "#1565C0" ||
    backgroundColor === "#42A5F5" ||
    backgroundColor === "#2E7D32"
      ? "#FFFFFF"
      : "#000000";

  return {
    backgroundColor,
    color,
  };
}

export function isUnknownFormattingRule(ruleId: string) {
  return TRANSFERMARKT_UNKNOWN_COLOR_RULES.some((rule) => rule.id === ruleId);
}

export function getConfirmedTierStyle(value: TransfermarktTier | null) {
  if (!value) {
    return undefined;
  }

  const backgroundColor =
    value === "S+" ? "#1565C0" :
    value === "S" ? "#42A5F5" :
    value === "A" ? "#2E7D32" :
    value === "B" ? "#66BB6A" :
    value === "C" ? "#F9A825" :
    value === "D" ? "#FFEB3B" :
    value === "E" ? "#FF9800" :
    "#EF5350";

  return {
    backgroundColor,
    color: value === "S+" || value === "S" || value === "A" ? "#FFFFFF" : "#000000",
  };
}

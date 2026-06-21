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
    colors: [
      "var(--heat-blue-dark)",
      "var(--heat-blue-light)",
      "var(--heat-green-dark)",
      "var(--heat-green-light)",
      "var(--heat-yellow-light)",
      "var(--heat-orange-light)",
      "var(--heat-red-light)",
      "var(--heat-red-dark)",
    ],
    source: "Retool playersTable Pow/Spe/Men/Soc conditionalFormatting, mapped to app heat palette",
  },
  {
    id: "gt_count_heat_scale",
    certainty: "confirmed",
    colors: ["var(--heat-strong-bg)", "var(--heat-neutral-bg)", "var(--heat-danger-bg)"],
    source: "Retool playersTable >20/>40/>60/>80 conditionalFormatting, mapped to app heat palette",
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
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
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

  const heat =
    value >= 86 ? { backgroundColor: "var(--heat-best-bg)", color: "var(--heat-best-text)" } :
    value >= 76 ? { backgroundColor: "var(--heat-elite-bg)", color: "var(--heat-elite-text)" } :
    value >= 66 ? { backgroundColor: "var(--heat-strong-bg)", color: "var(--heat-strong-text)" } :
    value >= 56 ? { backgroundColor: "var(--heat-good-bg)", color: "var(--heat-good-text)" } :
    value >= 46 ? { backgroundColor: "var(--heat-neutral-bg)", color: "var(--heat-neutral-text)" } :
    value >= 36 ? { backgroundColor: "var(--heat-risk-bg)", color: "var(--heat-risk-text)" } :
    value >= 21 ? { backgroundColor: "var(--heat-danger-light-bg)", color: "var(--heat-danger-light-text)" } :
    { backgroundColor: "var(--heat-danger-bg)", color: "var(--heat-danger-text)" };

  return {
    ...heat,
  };
}

export function isUnknownFormattingRule(ruleId: string) {
  return TRANSFERMARKT_UNKNOWN_COLOR_RULES.some((rule) => rule.id === ruleId);
}

export function getConfirmedTierStyle(value: TransfermarktTier | null) {
  if (!value) {
    return undefined;
  }

  if (value === "S+") return { backgroundColor: "var(--heat-best-bg)", color: "var(--heat-best-text)" };
  if (value === "S") return { backgroundColor: "var(--heat-elite-bg)", color: "var(--heat-elite-text)" };
  if (value === "A") return { backgroundColor: "var(--heat-strong-bg)", color: "var(--heat-strong-text)" };
  if (value === "B") return { backgroundColor: "var(--heat-good-bg)", color: "var(--heat-good-text)" };
  if (value === "C") return { backgroundColor: "var(--heat-neutral-bg)", color: "var(--heat-neutral-text)" };
  if (value === "D") return { backgroundColor: "var(--heat-risk-bg)", color: "var(--heat-risk-text)" };
  if (value === "E") return { backgroundColor: "var(--heat-danger-light-bg)", color: "var(--heat-danger-light-text)" };
  return { backgroundColor: "var(--heat-danger-bg)", color: "var(--heat-danger-text)" };
}

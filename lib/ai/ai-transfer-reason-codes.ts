export type AiSellReasonCode =
  | "negative_cash"
  | "low_cash_reserve"
  | "high_wage_burden"
  | "profit_window"
  | "underperformance"
  | "weak_contribution"
  | "poor_team_fit"
  | "hard_no_go"
  | "roster_over_opt"
  | "short_contract"
  | "expiring_contract"
  | "player_demand_pressure"
  | "board_salary_cap"
  | "board_renewal_warning"
  | "board_do_not_renew";

export type AiKeepReasonCode =
  | "low_wage_burden"
  | "sell_below_purchase"
  | "strong_contribution"
  | "top10_presence"
  | "good_team_fit"
  | "star_core_protection"
  | "covers_need_axis"
  | "long_contract"
  | "healthy_cash"
  | "player_demand_keep";

const SELL_REASON_PATTERNS: Array<{ code: AiSellReasonCode; patterns: string[] }> = [
  { code: "negative_cash", patterns: ["negatives Teamcash"] },
  { code: "low_cash_reserve", patterns: ["Cash-Reserve ist zu knapp"] },
  { code: "high_wage_burden", patterns: ["hohes Gehalt im Verhaeltnis"] },
  { code: "profit_window", patterns: ["realisierbarer Gewinn", "Verkaufsfenster"] },
  { code: "underperformance", patterns: ["Performance blieb unter Erwartung", "Abgang sinnvoll"] },
  { code: "weak_contribution", patterns: ["schwache lokale Score-Beitraege"] },
  { code: "poor_team_fit", patterns: ["passt nur schwach zum Teamprofil"] },
  { code: "hard_no_go", patterns: ["Hard-No-Go"] },
  { code: "roster_over_opt", patterns: ["Kader liegt ueber dem Optimum"] },
  { code: "short_contract", patterns: ["kurze Restvertragslaenge", "Vertrag laeuft aus und Fit"] },
  { code: "expiring_contract", patterns: ["auslaufender Vertrag braucht"] },
  { code: "player_demand_pressure", patterns: ["offene Spielerforderung erzeugt Kaderdruck"] },
  { code: "board_salary_cap", patterns: ["begrenzt Vertragsrahmen"] },
  { code: "board_renewal_warning", patterns: ["warnt vor voller Verlaengerung"] },
  { code: "board_do_not_renew", patterns: ["will keine Verlaengerung"] },
];

const KEEP_REASON_PATTERNS: Array<{ code: AiKeepReasonCode; patterns: string[] }> = [
  { code: "low_wage_burden", patterns: ["geringe Gehaltslast"] },
  { code: "sell_below_purchase", patterns: ["unter Einkauf liegen"] },
  { code: "strong_contribution", patterns: ["starke lokale Score-Beitraege"] },
  { code: "top10_presence", patterns: ["Top-10-Praesenz"] },
  { code: "good_team_fit", patterns: ["passt gut zum Teamprofil"] },
  { code: "star_core_protection", patterns: ["Star-/Core-Spieler", "Star bleibt Core", "Topstar"] },
  { code: "covers_need_axis", patterns: ["deckt die aktuelle Achsenluecke", "deckt aktuelle Achsenluecke"] },
  { code: "long_contract", patterns: ["laengerer Restvertrag"] },
  { code: "healthy_cash", patterns: ["Teamcash ist entspannt"] },
  { code: "player_demand_keep", patterns: ["offene Forderung muss eingeplant"] },
];

export function inferSellReasonCodes(reasons: string[]): AiSellReasonCode[] {
  const codes = new Set<AiSellReasonCode>();
  for (const reason of reasons) {
    for (const entry of SELL_REASON_PATTERNS) {
      if (entry.patterns.some((pattern) => reason.includes(pattern))) {
        codes.add(entry.code);
      }
    }
  }
  return [...codes];
}

export function inferKeepReasonCodes(reasons: string[]): AiKeepReasonCode[] {
  const codes = new Set<AiKeepReasonCode>();
  for (const reason of reasons) {
    for (const entry of KEEP_REASON_PATTERNS) {
      if (entry.patterns.some((pattern) => reason.includes(pattern))) {
        codes.add(entry.code);
      }
    }
  }
  return [...codes];
}

export function hasSellReason(codes: Iterable<AiSellReasonCode>, code: AiSellReasonCode) {
  return [...codes].includes(code);
}

export function hasKeepReason(codes: Iterable<AiKeepReasonCode>, code: AiKeepReasonCode) {
  return [...codes].includes(code);
}

export function mergeSellReasonCodes(explicit: AiSellReasonCode[] | null | undefined, reasons: string[]) {
  return [...new Set([...(explicit ?? []), ...inferSellReasonCodes(reasons)])];
}

export function mergeKeepReasonCodes(explicit: AiKeepReasonCode[] | null | undefined, reasons: string[]) {
  return [...new Set([...(explicit ?? []), ...inferKeepReasonCodes(reasons)])];
}

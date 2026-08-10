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
  | "proactive_early_buyout"
  | "player_demand_pressure"
  | "board_salary_cap"
  | "board_renewal_warning"
  | "board_do_not_renew"
  | "cash_runway_pressure"
  | "roster_quality_floor"
  /**
   * Verdient mehr, als Spieler seiner Leistung ueblicherweise verdienen. BEWUSST GETRENNT von
   * `high_wage_burden`: das misst "kostet viel im Verhaeltnis zum Teambudget" (also die Frage,
   * ob wir ihn uns leisten koennen), dieses hier "kostet mehr als er wert ist" (ob er es wert
   * ist). Ein Spitzenspieler kann teuer und trotzdem angemessen bezahlt sein; ein Ergaenzungs-
   * spieler billig und trotzdem ueberbezahlt.
   */
  | "overpaid_for_output"
  /**
   * Der Verkauf senkt die Apron-Abgabe des Teams. BEWUSST GETRENNT von `high_wage_burden` (kostet
   * viel im Verhaeltnis zum Teambudget) und `overpaid_for_output` (kostet mehr, als er wert ist):
   * dieser Grund haengt gar nicht am Spieler, sondern an der LAGE DES TEAMS zu seiner Apron-Decke.
   * Derselbe Spieler ist bei einem Team weit darueber ein Steuerposten und bei einem darunter keiner.
   */
  | "apron_levy_relief"
  /**
   * Schulden-Gehalts-Frühwarnung (siehe `schuldenlast-fruehwarnung.ts`): das Team traegt Kredit-
   * Restschuld UND Cash + Umsatz decken die naechste Saisonend-Abbuchung (Gehalt + Kreditrate)
   * nicht. BEWUSST GETRENNT von `cash_runway_pressure` (Kasse HEUTE zu knapp) und `negative_cash`
   * (Kasse schon im Minus): dieser Grund warnt VOR dem Minus — Chris' „es kann sein dass wir eher
   * spieler verkaufen muessen am ende der season weil wir schulden haben und sehr hohes gehalt".
   */
  | "debt_salary_runway";

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
  | "player_demand_keep"
  | "high_board_confidence"
  | "negative_net_proceeds"
  /** Verdient weniger als fuer seine Leistung ueblich — ein Vertrag, den man nicht aufgibt. */
  | "bargain_contract";

const SELL_REASON_PATTERNS: Array<{ code: AiSellReasonCode; patterns: string[] }> = [
  { code: "negative_cash", patterns: ["negatives Teamcash"] },
  { code: "low_cash_reserve", patterns: ["Cash-Reserve ist zu knapp"] },
  { code: "high_wage_burden", patterns: ["hohes Gehalt im Verhältnis"] },
  { code: "profit_window", patterns: ["realisierbarer Gewinn", "realisierbarer Netto-Gewinn", "Verkaufsfenster"] },
  { code: "underperformance", patterns: ["Performance blieb unter Erwartung", "Abgang sinnvoll"] },
  { code: "weak_contribution", patterns: ["schwache lokale Score-Beiträge"] },
  { code: "poor_team_fit", patterns: ["passt nur schwach zum Teamprofil"] },
  { code: "hard_no_go", patterns: ["Hard-No-Go"] },
  { code: "roster_over_opt", patterns: ["Kader liegt ueber dem Optimum"] },
  { code: "short_contract", patterns: ["kurze Restvertragslänge", "Vertrag läuft aus und Fit"] },
  { code: "expiring_contract", patterns: ["auslaufender Vertrag braucht"] },
  { code: "proactive_early_buyout", patterns: ["letztes Vertragsjahr"] },
  { code: "player_demand_pressure", patterns: ["offene Spielerforderung erzeugt Kaderdruck"] },
  { code: "board_salary_cap", patterns: ["begrenzt Vertragsrahmen"] },
  { code: "board_renewal_warning", patterns: ["warnt vor voller Verlaengerung"] },
  { code: "board_do_not_renew", patterns: ["will keine Verlaengerung"] },
  // Umlaute wie in der QUELLE (lib/ai/ai-transfermarkt-sell-preview-service.ts): dieser Zweig
  // hat die Begruendungstexte dort auf echte Umlaute umgestellt, statt sie in der Anzeige zu
  // ueberkleben. Die Muster muessen mitziehen, sonst greift die Zuordnung ins Leere.
  { code: "cash_runway_pressure", patterns: ["Gehaltslast übersteigt verfügbares Cash", "Kein Verkauf in dieser Saison trotz enger Cash-Lage"] },
  { code: "roster_quality_floor", patterns: ["unteres Kader-Drittel", "Qualität upgraden"] },
  { code: "overpaid_for_output", patterns: ["teurer als für diese Leistung üblich"] },
  { code: "apron_levy_relief", patterns: ["senkt die Apron-Abgabe"] },
  { code: "debt_salary_runway", patterns: ["Restschuld und Gehaltslast übersteigen"] },
];

const KEEP_REASON_PATTERNS: Array<{ code: AiKeepReasonCode; patterns: string[] }> = [
  { code: "low_wage_burden", patterns: ["geringe Gehaltslast"] },
  { code: "sell_below_purchase", patterns: ["unter Einkauf liegen"] },
  { code: "strong_contribution", patterns: ["starke lokale Score-Beiträge"] },
  { code: "top10_presence", patterns: ["Top-10-Präsenz"] },
  { code: "good_team_fit", patterns: ["passt gut zum Teamprofil"] },
  { code: "star_core_protection", patterns: ["Star-/Core-Spieler", "Star bleibt Core", "Topstar"] },
  { code: "covers_need_axis", patterns: ["deckt die aktuelle Achsenlücke", "deckt aktuelle Achsenlücke"] },
  { code: "long_contract", patterns: ["längerer Restvertrag"] },
  { code: "healthy_cash", patterns: ["Teamcash ist entspannt"] },
  { code: "player_demand_keep", patterns: ["offene Forderung muss eingeplant"] },
  { code: "high_board_confidence", patterns: ["statische Board-Confidence", "Kaderzusammenhalt bevorzugen"] },
  { code: "bargain_contract", patterns: ["günstiger als für diese Leistung üblich"] },
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

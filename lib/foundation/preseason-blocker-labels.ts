/**
 * Deutsche Klartexte für die Blocker-Codes der Preseason-Automatik — die Zeile
 * „Grund anzeigen" in der Aktivitätsleiste (FoundationActivityStrip) zeigte
 * vorher die rohen Enum-Namen (`roster_after_market_plan_below_player_min`,
 * `insufficient_cash`, …) wörtlich im Spieler-UI, und zwar auf JEDER Seite,
 * weil der Preseason-Banner überall mitläuft.
 *
 * Muster wie in `formatNegotiationSignalLabel`
 * (lib/foundation/tabs/foundation-format-render-helpers.ts, PR #457): EINE Map
 * für die bekannten Codes, und ein Fallback, der NIE wieder rohen Code
 * anzeigt — ein unbekannter Code wird als generischer deutscher Hinweis
 * gerendert und per `console.warn` gemeldet, statt als kaputter Enum-Name
 * durchzurutschen.
 *
 * Die Rohdaten (`FoundationActivityItem.reasons`) bleiben unangetastet — dort
 * stehen die Codes weiterhin fürs Debuggen (siehe Kommentar am Typ). Übersetzt
 * wird erst beim Rendern.
 */

const PRESEASON_BLOCKER_LABELS: Record<string, string> = {
  // --- Markt-Plan-Wächter (ai-market-plan-preview/apply-service) ---
  cash_after_market_plan_not_positive:
    "Kaufplan gestoppt — das Team wäre nach den Käufen im Minus.",
  cash_after_market_plan_below_reserve:
    "Kaufplan zurückgestellt — die Cash-Reserve des Teams wäre sonst angegriffen.",
  cash_after_market_plan_unknown:
    "Kaufplan angehalten — der Cash-Stand nach den Käufen ließ sich nicht sicher berechnen.",
  roster_after_market_plan_below_player_min:
    "Verkauf gestoppt — der Kader fiele sonst unter das Spieler-Minimum.",
  roster_after_market_plan_unknown:
    "Plan angehalten — die Kadergröße nach den Transfers ließ sich nicht sicher berechnen.",
  post_market_cash_not_positive:
    "Nach dem Marktlauf wäre das Team im Minus — der Rest des Plans wurde nicht ausgeführt.",
  insufficient_cash: "Nicht genug Cash für den geplanten Kauf.",
  buy_preview_blocked: "Die Kauf-Prüfung hat den geplanten Transfer abgelehnt.",
  roster_limit_reached: "Kader ist bereits voll — kein weiterer Zugang möglich.",
  market_value_missing: "Marktwert eines Kandidaten fehlt — der Kauf wurde übersprungen.",
  salary_demand_missing: "Gehaltsforderung eines Kandidaten fehlt — der Kauf wurde übersprungen.",
  sale_price_missing: "Verkaufspreis fehlt — der Verkauf wurde übersprungen.",
  sell_preview_missing_sale_price: "Verkaufspreis fehlt — der Verkauf wurde übersprungen.",
  sell_plan_missing_expected_value:
    "Erwarteter Verkaufserlös fehlt — der Verkauf wurde übersprungen.",
  sell_execute_failed: "Ein geplanter Verkauf ist fehlgeschlagen.",
  season_market_buy_forbidden:
    "Kaufen ist in dieser Phase gesperrt — gekauft wird erst im Kauffenster der neuen Saison.",
  cash_strategy_missing: "Cash-Strategie des Teams fehlt — der Marktplan konnte nicht rechnen.",
  ai_market_apply_budget_soft_stop:
    "Budget-Bremse: weitere Käufe wurden vorsorglich angehalten.",
  execution_aborted_after_team_failure:
    "Lauf nach einem Fehler bei einem Team angehalten — Rest folgt im nächsten Anlauf.",
  execution_rolled_back_after_team_failure:
    "Änderungen eines Teams nach einem Fehler zurückgenommen.",
  team_not_writable_by_caller: "Dieses Team darf von der Automatik nicht verändert werden.",
  team_control_mode_manual: "Manuell geführtes Team — die Automatik lässt es in Ruhe.",
  team_control_mode_passive: "Passives Team — die Automatik lässt es in Ruhe.",
  // --- Schutzregeln (werden i. d. R. schon vorher herausgefiltert) ---
  ai_training_change_cadence_throttled:
    "Trainings-Änderung gedrosselt — die KI darf ihr Training nur alle paar Spieltage umstellen.",
  // --- Allgemeine Zustands-Codes, die auch hier auftauchen können ---
  save_not_found: "Spielstand wurde nicht gefunden.",
  save_not_active: "Dieser Spielstand ist nicht aktiv.",
  season_not_found: "Saison wurde nicht gefunden.",
  team_not_found: "Team wurde nicht gefunden.",
  team_season_state_not_found: "Saison-Daten eines Teams fehlen.",
  transfer_window_closed: "Transferfenster ist aktuell geschlossen.",
  concurrent_save_write_conflict:
    "Ein anderer Mitspieler hat währenddessen gespeichert — bitte neu laden und erneut anstoßen.",
};

/** Sieht ein Segment wie ein Team-Kürzel aus (z. B. „S-C", „B-B", „D-L")? */
const TEAM_CODE_MUSTER = /^[A-Z0-9]{1,4}-[A-Z0-9]{1,4}$/;

/**
 * Übersetzt EINEN Blocker-Eintrag der Aktivitätsleiste in einen deutschen
 * Klartextsatz. Einträge kommen in mehreren Formen an:
 *   - nackter Code: `insufficient_cash`
 *   - Code mit Team: `cash_strategy_missing:B-B`
 *   - Team · Aktion · Code: `A-A · set_training_focus · ai_training_change_cadence_throttled`
 *   - Registry-Sammelzeile: `… +3 weitere` (bleibt unverändert)
 */
export function formatPreseasonBlockerLabel(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed === "" || trimmed.startsWith("…")) {
    return trimmed;
  }

  // Segmente aus allen bekannten Trennern ziehen; Reihenfolge bleibt erhalten.
  const segmente = trimmed
    .split(/[·:|,]/)
    .map((teil) => teil.trim())
    .filter((teil) => teil !== "");

  const teamCodes = segmente.filter((teil) => TEAM_CODE_MUSTER.test(teil));
  const teamPrefix = teamCodes.length > 0 ? `Team ${teamCodes[0]} — ` : "";

  for (const segment of segmente) {
    const label = PRESEASON_BLOCKER_LABELS[segment];
    if (label) {
      return `${teamPrefix}${label}`;
    }
  }

  // NIE rohen Code anzeigen — derselbe Vertrag wie formatNegotiationSignalLabel.
  if (typeof console !== "undefined") {
    console.warn(
      `[preseason-blocker] Code ohne deutsche Übersetzung: ${trimmed} — Eintrag in PRESEASON_BLOCKER_LABELS ergänzen.`,
    );
  }
  return `${teamPrefix}Automatik-Blocker (noch ohne Übersetzung — bitte melden).`;
}

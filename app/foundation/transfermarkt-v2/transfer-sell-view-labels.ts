/**
 * Spieltaugliche deutsche Labels für das Verkaufsfenster (Transfermarkt-Sell).
 *
 * Die Sell-Preview liefert interne Codes (GM-Archetypen, Board-Policies,
 * Readiness-Status, Blocking-/Warning-Keys) als rohe snake_case-Tokens.
 * Diese Helfer übersetzen sie in sauberen Spieltext — mit einem generischen
 * Humanizing-Fallback, damit NIE rohes snake_case im UI landet (gleiche
 * Mechanik wie `translateRenewalReason` im Gehaltsverhandlungs-Modal).
 *
 * Reine Copy-Schicht: keine Spiellogik, keine Zahlen, kein Einfluss auf den
 * Verkauf selbst.
 */

/** Letzter Fallback: nie rohes snake_case zeigen — in lesbaren Satz wandeln. */
function humanizeToken(token: string): string {
  const humanized = token.replace(/[_:]+/g, " ").trim();
  return humanized.length > 0 ? humanized.charAt(0).toUpperCase() + humanized.slice(1) : token;
}

/** Heuristik: bereits ausformulierte Sätze (mit Leerzeichen) unverändert lassen. */
function looksLikeSentence(value: string): boolean {
  return value.includes(" ");
}

/** GM-Archetypen (TeamGeneralManagerArchetype) → Spieltext. */
const GM_ARCHETYPE_LABELS: Record<string, string> = {
  bargain_hunter: "Schnäppchenjäger",
  talent_builder: "Talent-Entwickler",
  star_chaser: "Star-Jäger",
  depth_spammer: "Kadertiefe-Fan",
  elite_curator: "Elite-Kurator",
  facility_architect: "Ausbau-Architekt",
  risk_gambler: "Risikospieler",
  culture_keeper: "Kulturbewahrer",
  rivalry_hawk: "Rivalen-Falke",
  systems_tinkerer: "System-Tüftler",
};

export function formatGmArchetypeLabel(archetype: string | null | undefined): string {
  if (!archetype) {
    return "—";
  }
  return GM_ARCHETYPE_LABELS[archetype] ?? humanizeToken(archetype);
}

/** GM-Drucklevel (GmPressureLevel) → Spieltext. */
const GM_PRESSURE_LABELS: Record<string, string> = {
  stable: "fest im Sattel",
  watch: "Board beobachtet",
  hot: "heißer Stuhl",
};

export function formatGmPressureLabel(level: string | null | undefined): string {
  if (!level) {
    return "—";
  }
  return GM_PRESSURE_LABELS[level] ?? humanizeToken(level);
}

/** Transfer-Doktrin-Persona (TransferDoctrinePersona) → Spieltext. */
const DOCTRINE_PERSONA_LABELS: Record<string, string> = {
  star_builder: "Star-Aufbau",
  merchant: "Händler",
  developer: "Entwickler",
  churner: "Rotierer",
  hoarder: "Kader-Sammler",
  value_hunter: "Schnäppchenjäger",
  loyalist: "Loyalist",
  balanced: "Ausgewogen",
};

export function formatDoctrinePersonaLabel(persona: string | null | undefined): string {
  if (!persona) {
    return "—";
  }
  return DOCTRINE_PERSONA_LABELS[persona] ?? humanizeToken(persona);
}

/** Board-Vertragslinie (PlayerBoardTrustRenewalPolicy) → Spieltext. */
const BOARD_TRUST_POLICY_LABELS: Record<string, string> = {
  normal: "keine Auflagen",
  salary_cap: "Board fordert Gehaltsdeckel",
  renewal_warning: "Board sieht Verlängerung kritisch",
  do_not_renew: "Board will keine Verlängerung",
};

export function formatBoardTrustPolicyLabel(policy: string | null | undefined): string {
  if (!policy) {
    return "—";
  }
  return BOARD_TRUST_POLICY_LABELS[policy] ?? humanizeToken(policy);
}

/** Board-Stimmungs-Smiley (":)", ":|", ":/", ">:(") → Spieltext. */
const BOARD_TRUST_MOOD_LABELS: Record<string, string> = {
  ":)": "zufrieden",
  ":|": "neutral",
  ":/": "skeptisch",
  ">:(": "verärgert",
};

export function formatBoardTrustMoodLabel(smiley: string | null | undefined): string {
  if (!smiley) {
    return "—";
  }
  return BOARD_TRUST_MOOD_LABELS[smiley] ?? smiley;
}

/** Projizierter Aufstellungs-Status nach Verkauf (LegacyMatchdayReadinessStatus | "unknown"). */
const READINESS_LABELS: Record<string, string> = {
  ready: "weiter aufstellbar",
  underfilled_roster: "Kader zu klein",
  missing_lineup: "Aufstellung fehlt",
  invalid_lineup: "Aufstellung ungültig",
  missing_score_coverage: "Wertung unvollständig",
  unknown: "wird nach Verkauf geprüft",
};

export function formatReadinessAfterSellLabel(status: string | null | undefined): string {
  if (!status) {
    return "—";
  }
  return READINESS_LABELS[status] ?? humanizeToken(status);
}

/** Kader-Rolle (roleTag) → Spieltext, gleiche Konvention wie im Spieler-Drawer. */
const ROLE_TAG_LABELS: Record<string, string> = {
  starter: "Starter",
  bench: "Bank",
  rotation: "Rotation",
  prospect: "Talent",
};

export function formatRosterRoleTagLabel(roleTag: string | null | undefined): string {
  if (!roleTag) {
    return "—";
  }
  return ROLE_TAG_LABELS[roleTag] ?? humanizeToken(roleTag);
}

/** Blocking-Reason-Codes der Sell-Preview → Spieltext. */
export function translateSellBlockingReason(reason: string): string {
  if (looksLikeSentence(reason)) {
    return reason;
  }
  switch (reason) {
    case "sell_only_at_season_end":
      return "Verkauft wird erst im Verkaufsfenster am Season-End (nach MD10) — bis dahin nur Vorschau.";
    case "team_not_found":
      return "Teamdaten nicht gefunden — Verkauf aktuell nicht möglich.";
    case "player_not_found":
      return "Spielerdaten nicht gefunden — Verkauf aktuell nicht möglich.";
    case "active_player_not_found":
      return "Kader-Eintrag nicht gefunden — Verkauf aktuell nicht möglich.";
    case "active_player_not_in_team":
      return "Der Spieler steht nicht (mehr) in diesem Kader.";
    case "active_player_not_active":
      return "Der Spieler ist nicht (mehr) aktiv im Kader.";
    case "sale_price_missing":
      return "Für diesen Spieler liegt noch kein belastbarer Verkaufspreis vor.";
    case "active_player_salary_missing":
      return "Gehaltsdaten fehlen — Verkauf aktuell nicht möglich.";
    case "save_not_found":
    case "season_not_found":
    case "season_not_in_save":
    case "team_season_state_not_found":
    case "active_player_not_in_save":
    case "active_player_not_in_season":
      return "Spielstand-Daten passen nicht zusammen — bitte die Ansicht neu laden.";
    default:
      return humanizeToken(reason);
  }
}

/** Warning-Keys der Sell-Preview → Spieltext (Sätze bleiben unverändert). */
export function translateSellWarning(warning: string): string {
  if (looksLikeSentence(warning)) {
    return warning;
  }
  if (warning.startsWith("readiness_context:")) {
    return "Aufstellungs-Check unvollständig — die Prognose kann ungenau sein.";
  }
  switch (warning) {
    case "team_would_fall_under_7":
      return "Der Kader würde unter 7 Spieler fallen — eine Aufstellung wäre nicht mehr möglich.";
    case "team_would_fall_under_player_min":
      return "Der Kader würde unter das Team-Minimum fallen.";
    case "team_would_fall_under_player_opt":
      return "Der Kader würde unter die empfohlene Kadergröße fallen.";
    case "active_player_referenced_in_lineup":
      return "Der Spieler steht aktuell in einer Aufstellung — sie muss nach dem Verkauf angepasst werden.";
    case "team_readiness_would_get_worse":
      return "Nach dem Verkauf wäre das Team schlechter aufstellbar.";
    case "matchday_missing_for_readiness_preview":
      return "Aufstellungs-Check nicht möglich: kein aktiver Spieltag gefunden.";
    case "readiness_context_unavailable_for_sell_preview":
      return "Aufstellungs-Check aktuell nicht verfügbar.";
    default:
      return humanizeToken(warning);
  }
}

/** Matchday-IDs ("matchday-3") → kurzes Spieltext-Label ("MD 3"). */
export function formatMatchdayShortLabel(matchdayId: string): string {
  const numeric = matchdayId.match(/matchday-(\d+)/i)?.[1] ?? matchdayId.match(/md-?(\d+)/i)?.[1] ?? null;
  return numeric != null ? `MD ${numeric}` : humanizeToken(matchdayId);
}

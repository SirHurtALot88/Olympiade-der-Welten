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

/**
 * Kategorie-Tag für einen Verkaufs-/Haltegrund (Board-Bilanz, Zone D).
 *
 * Die Preview liefert `reasonsToSell`/`reasonsToKeep` nur als fertige Sätze —
 * die internen Reason-Codes (die die Kategorie eindeutig kennen würden)
 * verlassen den Service nicht. Statt den Kontrakt aufzubohren (neues Feld
 * durch Service → API → View für eine reine Anzeige-Gruppierung), ordnen wir
 * hier anhand von Stichworten ein — dieselbe Copy-Schicht-Logik wie
 * `translateSellWarning`. Reine Textklassifikation, kein neuer Wert.
 */
export type SellReasonCategory = "Finanzen" | "Leistung" | "Vertrag" | "Strategie";

export function classifySellReasonCategory(reason: string): SellReasonCategory {
  // Vertrag zuerst prüfen: "Buyout-Wahrscheinlichkeit" steckt im Vertragsjahr-Grund,
  // würde sonst über das Wort "Buyout" fälschlich als Finanzen einsortiert.
  if (/vertrag/i.test(reason)) {
    return "Vertrag";
  }
  if (/cash|gehalt|erlös|gewinn|verlust|marktwert|etat|einkauf|buyout|teamcash/i.test(reason)) {
    return "Finanzen";
  }
  if (/performance|score|top-10|erwartung|qualität/i.test(reason)) {
    return "Leistung";
  }
  // Fallback deckt Teamprofil/Hard-No-Go/Achsenlücke/Core-Schutz/Forderungen/Board-Confidence —
  // alles, was eher eine strategische als eine finanzielle/sportliche/vertragliche Aussage ist.
  return "Strategie";
}

/**
 * Gewichtsklasse eines Warning-Keys für Zone E ("Hinweise nach Gewicht" statt
 * vier gleich lauter roter Balken). Klassifikation ist PRO KEY, nicht pro
 * Text — neue, unbekannte Keys fallen defensiv auf "warn" (Achtung), nie auf
 * "blocker" (würde optisch fälschlich sperren) und nie auf "good" (könnte
 * einen echten Risikohinweis verschlucken).
 */
export type SellNoticeWeight = "blocker" | "warn" | "info" | "good";

const SELL_WARNING_BLOCKER_KEYS = new Set(["team_would_fall_under_7", "team_would_fall_under_player_min"]);
const SELL_WARNING_ACHTUNG_KEYS = new Set([
  "team_would_fall_under_player_opt",
  "team_readiness_would_get_worse",
  "active_player_referenced_in_lineup",
]);
const SELL_WARNING_HINWEIS_KEYS = new Set([
  "matchday_missing_for_readiness_preview",
  "readiness_context_unavailable_for_sell_preview",
]);

export function classifySellWarningWeight(warning: string): SellNoticeWeight {
  if (SELL_WARNING_BLOCKER_KEYS.has(warning)) {
    return "blocker";
  }
  if (SELL_WARNING_ACHTUNG_KEYS.has(warning)) {
    return "warn";
  }
  if (warning.startsWith("readiness_context:") || SELL_WARNING_HINWEIS_KEYS.has(warning)) {
    return "info";
  }
  return "warn";
}

/**
 * Gewichtsklasse einer `pricingPolicyNotes`-Zeile (freier Text, kein Key —
 * anders als `translateSellWarning` gibt es hier keinen stabilen Code, nur
 * die vier festen Sätze aus `buildSellPricingPolicyBreakdown`). Nur der
 * Team-Fit-Satz ist positiv; alles andere sind neutrale Preis-Mechanik-
 * Hinweise, kein Risiko — daher nie "blocker".
 */
export function classifySellPricingNoteWeight(note: string): "good" | "info" {
  return /stützt den Verkaufspreis/i.test(note) ? "good" : "info";
}

/** Matchday-IDs ("matchday-3") → kurzes Spieltext-Label ("MD 3"). */
export function formatMatchdayShortLabel(matchdayId: string): string {
  const numeric = matchdayId.match(/matchday-(\d+)/i)?.[1] ?? matchdayId.match(/md-?(\d+)/i)?.[1] ?? null;
  return numeric != null ? `MD ${numeric}` : humanizeToken(matchdayId);
}

/**
 * Einordnung eines Preview-Fehlers aus `/api/transfermarkt/sell`.
 *
 * Die Route lehnt Anfragen außerhalb des Verkaufsfensters mit
 * `phase_blocked:sell_players:<phase>` und `summary: null` ab — das ist KEIN
 * Defekt, sondern ein regulärer Spielzustand (Verkauft wird im Verkaufsfenster
 * am Saisonende). Das Modal rendert diesen Fall deshalb als ruhigen
 * Info-Bildschirm, nicht als Fehlermeldung. Alles andere bleibt ein Fehler
 * mit genau EINER Meldung und einem konkreten nächsten Schritt.
 */
export type SellPreviewIssue = {
  kind: "window_closed" | "error";
  title: string;
  message: string;
  /** Konkrete Handlungsempfehlung für den Spieler (oder null). */
  hint: string | null;
};

const SELL_WINDOW_CLOSED_BY_PHASE: Record<string, { message: string; hint: string }> = {
  season_active: {
    message: "Die Saison läuft noch — verkauft wird im Verkaufsfenster am Saisonende, nach Spieltag 10.",
    hint: "Bis dahin kannst du hier alles prüfen: Marktwert und Verkaufspreis siehst du im Kader und auf dem Transfermarkt.",
  },
  season_completed: {
    message: "Die Saison ist gespielt — schließe zuerst die Saisonauswertung ab, direkt danach öffnet das Verkaufsfenster.",
    hint: "Weiter über den Saisonabschluss im Spielfluss — dann kannst du hier verkaufen.",
  },
  season_review: {
    message: "Die Saisonauswertung läuft — direkt danach öffnet das Verkaufsfenster.",
    hint: "Schließe die Auswertung ab, dann kannst du hier verkaufen.",
  },
  season_rewards: {
    message: "Die Saison-Abrechnung läuft — direkt danach öffnet das Verkaufsfenster.",
    hint: "Schließe die Abrechnung ab, dann kannst du hier verkaufen.",
  },
  player_development: {
    message: "Die Spielerentwicklung läuft — direkt danach öffnet das Verkaufsfenster.",
    hint: "Schließe die Entwicklung ab, dann kannst du hier verkaufen.",
  },
  transfer_buy_phase: {
    message: "Gerade läuft die Kaufphase — die Verkaufsphase dieser Saisonwende ist bereits vorbei.",
    hint: "Das nächste Verkaufsfenster öffnet am Ende der kommenden Saison.",
  },
  lineup_setup: {
    message: "Die neue Saison wird gerade vorbereitet — das Verkaufsfenster öffnet wieder am Saisonende.",
    hint: "Stell zuerst deine Aufstellung, verkauft wird am Ende der Saison.",
  },
  next_season_ready: {
    message: "Die neue Saison steht bereit — das Verkaufsfenster öffnet wieder am Saisonende.",
    hint: "Starte die Saison, verkauft wird an ihrem Ende.",
  },
};

export function describeSellPreviewIssue(error: string): SellPreviewIssue {
  if (error.startsWith("phase_blocked:sell_players:")) {
    const phase = error.slice("phase_blocked:sell_players:".length);
    const copy = SELL_WINDOW_CLOSED_BY_PHASE[phase] ?? {
      message: "Das Verkaufsfenster ist gerade geschlossen — verkauft wird am Saisonende.",
      hint: "Du kannst die Vorschau später im Verkaufsfenster erneut öffnen.",
    };
    return { kind: "window_closed", title: "Transferfenster geschlossen", ...copy };
  }
  if (error.startsWith("phase_blocked:")) {
    return {
      kind: "window_closed",
      title: "In dieser Phase nicht möglich",
      message: "Diese Aktion ist in der aktuellen Spielphase gesperrt.",
      hint: "Folge dem Spielfluss — die Aktion wird wieder frei, sobald ihre Phase dran ist.",
    };
  }
  return {
    kind: "error",
    title: "Verkaufsvorschau nicht verfügbar",
    message: looksLikeSentence(error) ? error : translateSellBlockingReason(error),
    hint: "Lade die Vorschau neu — bleibt der Fehler, schließe den Dialog und öffne den Verkauf erneut.",
  };
}

export type SellDisabledReasonInput = {
  /** `"prisma"` = Referenzmodus, dort bleibt der Verkauf grundsaetzlich gesperrt. */
  readMetaSource?: string | null;
  preview: {
    canSell: boolean;
    blockingReasons?: string[] | null;
    warnings?: string[] | null;
  } | null;
  /** Art des Vorschau-Fehlers, falls einer vorliegt. */
  issueKind?: string | null;
  hasIssue: boolean;
  busy: boolean;
  strongAckPending: boolean;
};

/**
 * WARUM DER VERKAUFEN-KNOPF GESPERRT IST — in einem Satz, und zwar im WAHREN.
 *
 * Lag frueher als Kette von Fragezeichen-Operatoren im `FoundationMarketSellShellHost`. Steht jetzt
 * hier, weil sie eine Regel ist und keine Darstellung: welcher Grund genannt wird, entscheidet, was
 * Chris fuer kaputt haelt.
 */
export function resolveSellDisabledReason(input: SellDisabledReasonInput): string | null {
  const { preview } = input;
  const disabled =
    input.readMetaSource === "prisma" || !preview?.canSell || input.busy || input.strongAckPending;
  if (!disabled) return null;
  if (input.readMetaSource === "prisma") return "Im Referenzmodus bleibt der Verkauf gesperrt.";
  if (!preview) {
    if (input.issueKind === "window_closed") {
      return "Das Verkaufsfenster ist geschlossen — verkauft wird im Verkaufsfenster am Saisonende.";
    }
    return input.hasIssue
      ? "Die Verkaufsvorschau ist nicht verfügbar — bitte neu laden."
      : "Verkaufsvorschau wird noch geladen.";
  }
  if (!preview.canSell) {
    // HIER STAND EIN KADERGRUND, UND ER WAR IMMER FALSCH. Die Kette fragte zuerst, ob eine
    // Kadergroessen-WARNUNG vorliegt, und schrieb dann „Kader ist am Minimum — verkaufen wuerde
    // die Aufstellung unmoeglich machen." Der echte Grund aus `blockingReasons` kam erst danach
    // und wurde damit verdeckt.
    //
    // Nachgemessen: KEINER der beiden Verkaufsdienste kennt eine Kadergroessen-Sperre.
    // `transfermarkt-sell-service.ts:373` und `transfermarkt-local-service.ts:3166` setzen
    // `canSell = blockingReasons.length === 0`, und in beiden Listen steht kein Kadergrund. Der
    // Satz konnte also nur dann erscheinen, wenn etwas ANDERES sperrte — und schob es dem Kader in
    // die Schuhe. Genau das meldete Chris als `33c172`: „verkäufe gestoppt wegen spieler minimum
    // -> diesen grund darf es nicht geben […] das hatten wir jetzt schon so oft!"
    //
    // Die Kadergroessen-Warnung selbst bleibt in der Liste — sie ist ein Hinweis und war nie das
    // Problem. Was verschwindet, ist ihre Rolle als Erklaerung fuer eine fremde Sperre.
    const ersterGrund = preview.blockingReasons?.[0];
    return ersterGrund ? translateSellBlockingReason(ersterGrund) : "Dieser Verkauf ist gerade noch blockiert.";
  }
  if (input.busy) return "Der Verkauf wird gerade vorbereitet.";
  if (input.strongAckPending) {
    return "Bitte bestätige zuerst die Board-/GM-Warnung oben, dann kannst du final verkaufen.";
  }
  return null;
}

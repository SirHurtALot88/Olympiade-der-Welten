const GAME_FLOW_BLOCKER_LABELS: Record<string, string> = {
  missing_manual_lineup: "Mindestens ein manuell gesteuertes Team hat noch keine gespeicherte Einsatzliste.",
  passive_missing_lineup: "Mindestens ein passives Team hat noch keine gespeicherte Einsatzliste.",
  result_apply_missing_for_current_matchday: "Result Apply fehlt noch für diesen Spieltag.",
  // Beide Schluessel stehen fuer denselben Zustand (D1 gebucht, D2 offen) -- einmal aus dem
  // Server-Check (matchday-progress-service.ts), einmal aus dem Client-Flow-Schritt
  // (game-flow-controller.ts). Ohne Eintrag hier faellt der Text auf `reason.replaceAll("_", " ")`
  // zurueck ("result apply incomplete missing d2 for current matchday") -- exakt die Art
  // kryptischer Meldung, ueber die sich der Eigentuemer schon einmal beschwert hat.
  result_apply_incomplete_missing_d2_for_current_matchday:
    "Nur Disziplin 1 dieses Spieltags ist gebucht — in der Arena zuerst Disziplin 2 abschließen, danach lässt sich der Spieltag wechseln.",
  result_incomplete_missing_d2:
    "Nur Disziplin 1 dieses Spieltags ist gebucht — in der Arena zuerst Disziplin 2 abschließen, danach lässt sich der Spieltag wechseln.",
  standings_apply_missing_for_current_matchday: "Standings Apply fehlt noch für diesen Spieltag.",
  cash_apply_missing_for_current_matchday: "Cash Apply fehlt noch für diesen Spieltag.",
  tie_groups_require_confirmed_policy: "Tie-Policy blockiert den lokalen Standings-Schritt.",
  no_next_matchday_configured: "Kein weiterer Matchday ist im lokalen Seed konfiguriert.",
  duplicate_matchday_advance_for_current_scope: "Dieser Matchday wurde für diesen Save bereits abgeschlossen.",
  duplicate_apply_detected: "Dieser Apply wurde für Save und Matchday bereits gespeichert.",
  duplicate_apply_for_save_season_block: "Dieser Schritt wurde für Save und Matchday bereits angewendet.",
  season_end_only: "Preisgeld und Cash sind nur im Saisonabschluss erlaubt.",
  // Dieser Reason-Code wird nicht mehr erzeugt (der 7er-Floor ist entfernt, siehe
  // lib/lineups/legacy-matchday-partial-lineup-rule.ts) — Label bleibt fuer alte/persistierte Daten.
  under_minimum_matchday_players: "Mindestens 7 aktive Spieler sind für den Spieltag nötig.",
  partial_lineup_allowed: "Das Team setzt alle verfügbaren Spieler ein — das zählt als vollständig, auch wenn nicht jeder Slot besetzt ist.",
  lineup_matchday_is_not_active: "Lineups lassen sich nur für den aktuell aktiven Matchday ändern.",
  preview_status_not_ready: "Die Vorschau ist noch nicht im Status bereit.",
  board_objectives_failed: "Mindestens ein Board-Ziel ist verfehlt.",
  board_objectives_at_risk: "Mindestens ein Board-Ziel steht unter Druck.",
  high_board_pressure: "Board-Druck ist hoch — Ziele im Team-Profil prüfen.",
  prize_money_not_applied: "Preisgeld wurde für diese Saison noch nicht gebucht.",
  player_development_pending: "Spielerentwicklung ist noch nicht abgeschlossen.",
  formcards_assignment_optional: "Formkarten-Pool ist bereit — Zuweisung ist optional.",
  sponsor_objective_source_missing: "Sponsor-Ziel kann gerade nicht sauber gelesen werden.",
  source_missing: "Eine Quelle für diese Bewertung fehlt noch.",
  lineup_not_submitted: "Einsatzliste noch nicht bestätigt — Slots sind voll, bitte in der Einsatzliste abschliessen.",
  missing_formcard_selections: "Formkarten sind optional — ohne Auswahl spielst du ohne Bonus/Malus.",
  missing_formcard_pool: "Formkarten-Pool für diese Saison fehlt noch — bitte in der Einsatzliste erzeugen.",
  missing_lineup: "Einsatzliste ist noch nicht vollständig.",
  incomplete_lineup: "Einsatzliste noch nicht spielbereit — alle Slots füllen oder den gesamten Kader einsetzen.",
  training_missing: "Training für alle Kaderspieler muss zuerst gesetzt werden.",
  captain_recommended: "Noch kein Saison-Kapitän benannt — vor der ersten Disziplin einen aus deinen Spielern wählen.",
  no_active_team: "Kein aktives Team ausgewählt.",
  empty_roster: "Kader ist leer — erst Spieler hinzufügen.",
  transfer_window_closed: "Transferfenster ist aktuell geschlossen.",
  "resolve_status:incomplete_lineups": "Mindestens eine Einsatzliste ist noch unvollständig.",
  "resolve_status:missing_lineups": "Mindestens eine Einsatzliste fehlt noch komplett.",
  "resolve_status:missing_scores": "Mindestens ein Team hat noch fehlende Score-Quellen.",
  "resolve_status:missing_sources": "Mindestens eine Resolve-Quelle ist noch unvollständig.",
  "resolve_status:blocked": "Resolve Preview ist aktuell blockiert.",
};

export function formatGameFlowBlocker(reason: string) {
  if (GAME_FLOW_BLOCKER_LABELS[reason]) {
    return GAME_FLOW_BLOCKER_LABELS[reason];
  }

  if (reason.startsWith("blockedRule:")) {
    return `Blocker: ${reason.replace("blockedRule:", "")}`;
  }

  // Diese beiden trugen bisher kein Label und fielen auf `reason.replaceAll("_", " ")` zurück —
  // aus "incomplete_result:H-R" wurde "incomplete result:H-R". Der Spieler sah davon ohnehin
  // nichts: der Spieltag meldete nur "Standings Apply fehlt noch für diesen Spieltag", waehrend
  // der eigentliche Grund (zwei benannte Teams) in den Daten stand. Eine Sperre, die ihren Grund
  // nicht nennt, ist von einem Absturz nicht zu unterscheiden.
  if (reason.startsWith("incomplete_result:")) {
    const teamId = reason.slice("incomplete_result:".length);
    return `Team ${teamId} hat eine unvollständige Ergebniszeile — meist ein verletzter Spieler in der bereits abgegebenen Aufstellung. Solange das offen ist, lässt sich der Spieltag nicht übernehmen.`;
  }

  if (reason.startsWith("missing_result:")) {
    const teamId = reason.slice("missing_result:".length);
    return `Für Team ${teamId} fehlt die Ergebniszeile dieses Spieltags ganz.`;
  }

  if (reason.startsWith("missing_projected_cash:")) {
    return "Mindestens ein Team hat noch keinen berechenbaren Cash-nachher-Wert.";
  }

  // Kaufen und Verkaufen liegen in VERSCHIEDENEN Fenstern (`transfer-window-policy.ts`): am
  // Saisonende wird verkauft und verlaengert, gekauft wird in der neuen Saison vor dem ersten
  // Spieltag. Beide Meldungen sagten vorher pauschal „im Transferfenster" — das half genau dann
  // nicht, wenn ein Fenster offen war und trotzdem gesperrt blieb, was man gerade wollte.
  if (reason.startsWith("phase_blocked:buy_players:")) {
    return "Kaufen ist gerade gesperrt — gekauft wird in der neuen Saison vor dem 1. Spieltag, nicht am Saisonende.";
  }

  if (reason.startsWith("phase_blocked:sell_players:")) {
    return "Verkaufen ist gerade gesperrt — verkauft wird am Saisonende, nachdem der letzte Spieltag gerechnet ist.";
  }

  if (reason.startsWith("phase_blocked:sponsor_choice:")) {
    return "In dieser Phase nicht wählbar: Sponsorenwahl erst außerhalb der laufenden Saison.";
  }

  if (reason.startsWith("phase_blocked:facility_apply:")) {
    return "Bauen ist in dieser Phase noch nicht dran. Du kannst die Kosten trotzdem prüfen; bestätigen geht erst im Management-Fenster.";
  }

  if (reason.startsWith("phase_blocked:")) {
    return `In dieser Phase noch nicht erlaubt: ${reason.replace(/^phase_blocked:[^:]+:/, "").replaceAll("_", " ")}`;
  }

  if (reason.startsWith("tie_warning")) {
    return "Gleichstand blockiert diesen Schritt aktuell.";
  }

  return reason.replaceAll("_", " ");
}

export function formatGameFlowBlockerList(reasons: string[]) {
  return reasons.map(formatGameFlowBlocker).join(" · ");
}

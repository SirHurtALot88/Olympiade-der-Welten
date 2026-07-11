const GAME_FLOW_BLOCKER_LABELS: Record<string, string> = {
  missing_manual_lineup: "Mindestens ein manuell gesteuertes Team hat noch keine gespeicherte Einsatzliste.",
  passive_missing_lineup: "Mindestens ein passives Team hat noch keine gespeicherte Einsatzliste.",
  result_apply_missing_for_current_matchday: "Result Apply fehlt noch fuer diesen Spieltag.",
  standings_apply_missing_for_current_matchday: "Standings Apply fehlt noch fuer diesen Spieltag.",
  cash_apply_missing_for_current_matchday: "Cash Apply fehlt noch fuer diesen Spieltag.",
  tie_groups_require_confirmed_policy: "Tie-Policy blockiert den lokalen Standings-Schritt.",
  no_next_matchday_configured: "Kein weiterer Matchday ist im lokalen Seed konfiguriert.",
  duplicate_matchday_advance_for_current_scope: "Dieser Matchday wurde fuer diesen Save bereits abgeschlossen.",
  duplicate_apply_detected: "Dieser Apply wurde fuer Save und Matchday bereits gespeichert.",
  duplicate_apply_for_save_season_block: "Dieser Schritt wurde fuer Save und Matchday bereits angewendet.",
  season_end_only: "Preisgeld und Cash sind nur im Saisonabschluss erlaubt.",
  under_minimum_matchday_players: "Mindestens 7 aktive Spieler sind fuer den Spieltag noetig.",
  partial_lineup_allowed: "Das Team darf mit Mindestkader auch nur eine Disziplin voll besetzen.",
  lineup_matchday_is_not_active: "Lineups lassen sich nur fuer den aktuell aktiven Matchday aendern.",
  preview_status_not_ready: "Die Vorschau ist noch nicht im Status bereit.",
  board_objectives_failed: "Mindestens ein Board-Ziel ist verfehlt.",
  board_objectives_at_risk: "Mindestens ein Board-Ziel steht unter Druck.",
  high_board_pressure: "Board-Druck ist hoch — Ziele im Team-Profil pruefen.",
  prize_money_not_applied: "Preisgeld wurde fuer diese Saison noch nicht gebucht.",
  player_development_pending: "Spielerentwicklung ist noch nicht abgeschlossen.",
  formcards_assignment_optional: "Formkarten-Pool ist bereit — Zuweisung ist optional.",
  sponsor_objective_source_missing: "Sponsor-Ziel kann gerade nicht sauber gelesen werden.",
  source_missing: "Eine Quelle fuer diese Bewertung fehlt noch.",
  lineup_not_submitted: "Einsatzliste noch nicht bestaetigt — Slots sind voll, bitte in der Einsatzliste abschliessen.",
  missing_formcard_selections: "Formkarten sind optional — ohne Auswahl spielst du ohne Bonus/Malus.",
  missing_formcard_pool: "Formkarten-Pool fuer diese Saison fehlt noch — bitte in der Einsatzliste erzeugen.",
  missing_lineup: "Einsatzliste ist noch nicht vollstaendig.",
  incomplete_lineup: "Einsatzliste noch nicht spielbereit — alle Slots fuellen oder den gesamten Kader einsetzen.",
  training_missing: "Training fuer alle Kaderspieler muss zuerst gesetzt werden.",
  no_active_team: "Kein aktives Team ausgewaehlt.",
  empty_roster: "Kader ist leer — erst Spieler hinzufuegen.",
  transfer_window_closed: "Transferfenster ist aktuell geschlossen.",
  "resolve_status:incomplete_lineups": "Mindestens eine Einsatzliste ist noch unvollstaendig.",
  "resolve_status:missing_lineups": "Mindestens eine Einsatzliste fehlt noch komplett.",
  "resolve_status:missing_scores": "Mindestens ein Team hat noch fehlende Score-Quellen.",
  "resolve_status:missing_sources": "Mindestens eine Resolve-Quelle ist noch unvollstaendig.",
  "resolve_status:blocked": "Resolve Preview ist aktuell blockiert.",
};

export function formatGameFlowBlocker(reason: string) {
  if (GAME_FLOW_BLOCKER_LABELS[reason]) {
    return GAME_FLOW_BLOCKER_LABELS[reason];
  }

  if (reason.startsWith("blockedRule:")) {
    return `Blocker: ${reason.replace("blockedRule:", "")}`;
  }

  if (reason.startsWith("missing_projected_cash:")) {
    return "Mindestens ein Team hat noch keinen berechenbaren Cash-nachher-Wert.";
  }

  if (reason.startsWith("phase_blocked:buy_players:")) {
    return "Kaufphase ist geschlossen — Transfers sind nur im Transferfenster oder vor dem ersten Resultat moeglich.";
  }

  if (reason.startsWith("phase_blocked:sell_players:")) {
    return "Verkaufsphase ist geschlossen — Verkaeufe sind nur im Transferfenster oder vor dem ersten Resultat moeglich.";
  }

  if (reason.startsWith("phase_blocked:facility_apply:")) {
    return "Bauen ist in dieser Phase noch nicht dran. Du kannst die Kosten trotzdem pruefen; bestaetigen geht erst im Management-Fenster.";
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

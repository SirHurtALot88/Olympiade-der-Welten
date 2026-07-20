import { formatGameFlowBlocker } from "@/lib/foundation/game-flow-blocker-labels";
import type { GameFlowStepStatus } from "@/lib/foundation/game-flow-controller";

export type CockpitStepStatus = "open" | "ready" | "warning" | "blocked" | "applied";

export function getCockpitStepTone(status: CockpitStepStatus) {
  if (status === "applied") return "is-applied";
  if (status === "ready") return "is-ready";
  if (status === "warning") return "is-warning";
  if (status === "blocked") return "is-blocked";
  return "is-open";
}

export function getCockpitStatusLabel(status: CockpitStepStatus) {
  if (status === "applied") return "angewendet";
  if (status === "ready") return "bereit";
  if (status === "warning") return "achtung";
  if (status === "blocked") return "blockiert";
  return "offen";
}

export function getCockpitStatusPillClass(status: CockpitStepStatus) {
  return `pill cockpit-status-pill cockpit-status-pill-${status}`;
}

export function getGameFlowStatusLabel(status: GameFlowStepStatus) {
  if (status === "ready") return "bereit";
  if (status === "blocked") return "blockiert";
  if (status === "optional") return "optional";
  if (status === "completed") return "erledigt";
  if (status === "applying") return "läuft";
  return "achtung";
}

export function getGameFlowStatusClass(status: GameFlowStepStatus) {
  if (status === "ready") return "is-ready";
  if (status === "blocked") return "is-blocked";
  if (status === "completed") return "is-completed";
  if (status === "optional") return "is-optional";
  if (status === "applying") return "is-applying";
  return "is-warning";
}

export function mapAutoRunStatusToCockpitStatus(
  status: "ready" | "warning" | "blocked" | "applied" | "planned" | "skipped" | null | undefined,
): CockpitStepStatus {
  if (status === "applied") return "applied";
  if (status === "planned" || status === "ready") return "ready";
  if (status === "warning" || status === "skipped") return "warning";
  if (status === "blocked") return "blocked";
  return "open";
}

export function getAiTransferStatusLabel(
  status: "ready" | "no_sell_need" | "low_roster_depth" | "no_candidates" | "warning" | "blocked",
) {
  if (status === "ready") return "bereit";
  if (status === "no_sell_need") return "halten";
  if (status === "low_roster_depth") return "kader zu klein";
  if (status === "no_candidates") return "keine kandidaten";
  if (status === "warning") return "achtung";
  return "blockiert";
}

export function getAiTransferStatusPillClass(
  status: "ready" | "no_sell_need" | "low_roster_depth" | "no_candidates" | "warning" | "blocked",
) {
  return `transfer-status-pill${status === "ready" ? " is-ready" : status === "warning" || status === "no_sell_need" || status === "low_roster_depth" || status === "no_candidates" ? " is-warning" : " is-blocked"}`;
}

export function getAiTransferBudgetLabel(status: "healthy" | "tight" | "critical" | "unknown") {
  if (status === "healthy") return "gesund";
  if (status === "tight") return "eng";
  if (status === "critical") return "kritisch";
  return "offen";
}

export function getAiTransferRosterLabel(status: "under_min" | "under_opt" | "at_or_above_opt" | "unknown") {
  if (status === "under_min") return "unter Min";
  if (status === "under_opt") return "unter Opt";
  if (status === "at_or_above_opt") return "bei/über Opt";
  return "offen";
}

export function formatCockpitReason(reason: string) {
  const shared = formatGameFlowBlocker(reason);
  if (shared !== reason.replaceAll("_", " ")) {
    return shared;
  }

  if (reason === "insufficient_cash") return "Nicht genug Cash für dieses Upgrade.";
  if (reason === "facility_max_level") return "Dieses Gebäude ist bereits auf Max-Level.";
  if (reason === "facility_disabled") return "Dieses Gebäude ist aktuell deaktiviert und muss erst stabilisiert werden.";
  if (reason === "specialist_wing_variant_required") return "Bitte zuerst eine Spezialisten-Variante wählen.";
  if (reason === "specialist_wing_variant_switch_not_supported") return "Diese Spezialisten-Variante kann nach dem Bau nicht mehr gewechselt werden.";
  if (reason === "team_not_found") return "Team konnte für diese Gebäude-Aktion nicht gefunden werden.";
  if (reason === "save_not_active") return "Dieser Spielstand ist nicht aktiv.";
  if (reason === "save_not_found") return "Spielstand konnte nicht gefunden werden.";
  if (reason === "local_team_not_owned_or_ai_controlled") return "Nur eigene manuelle Teams dürfen Gebäude bauen oder warten.";
  if (reason === "confirm_token_required") return "Bitte Upgrade zuerst prüfen und danach bestätigen.";
  if (reason === "facility_upgrade_preview_stale") return "Die Upgrade-Vorschau ist veraltet. Bitte noch einmal prüfen.";
  if (reason === "facility_maintenance_preview_stale") return "Die Wartungs-Vorschau ist veraltet. Bitte noch einmal prüfen.";
  if (reason === "early_season_setup_allowed_before_first_result") return "Früher Saisonstart: Management-Aktion ist bis zum ersten echten Resultat erlaubt.";

  return shared;
}

export function formatObjectiveStatusLabel(status: string | null | undefined) {
  const mapped: Record<string, string> = {
    open: "offen",
    at_risk: "unter Druck",
    failed: "verfehlt",
    completed: "erfüllt",
    blocked: "blockiert",
    optional: "optional",
    ready: "bereit",
  };
  return mapped[String(status ?? "").toLowerCase()] ?? String(status ?? "offen").replaceAll("_", " ");
}

export function formatSeasonCompletionStepStatus(status: string | null | undefined) {
  const mapped: Record<string, string> = {
    planned: "geplant",
    applied: "angewendet",
    already_done: "schon erledigt",
    blocked: "blockiert",
    skipped: "übersprungen",
    ready: "bereit",
  };
  return mapped[String(status ?? "").toLowerCase()] ?? String(status ?? "offen").replaceAll("_", " ");
}

export function getSeasonCompletionStepTone(status: string | null | undefined) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "applied" || normalized === "already_done" || normalized === "ready") return "is-ready";
  if (normalized === "blocked") return "is-blocked";
  if (normalized === "skipped") return "is-warning";
  return "is-open";
}

export function formatAiLineupAuditWarning(warning: string) {
  const mapped: Record<string, string> = {
    ai_lineup_audit_no_source: "AI-Audit hat keine lesbare Lineup-Quelle.",
    ai_lineup_audit_no_lineup_drafts: "Keine gespeicherten Einsatzlisten für diese Saison gefunden.",
    ai_lineup_audit_no_ai_drafts: "AI-Teams haben keine gespeicherten Einsatzlisten.",
    ai_lineups_missing: "AI-Lineups fehlen.",
    ai_captain_unused: "Captain wurde nicht genutzt.",
    ai_form_cards_unused: "Formkarten wurden nicht genutzt.",
    ai_push_unused: "Push wurde nicht genutzt.",
    ai_mutators_unused: "Mutatoren wurden nicht genutzt.",
  };
  return mapped[warning] ?? formatCockpitReason(warning);
}

// Raw `homeWarnings` keys (see use-home-v2-overview-derivations.ts /
// use-foundation-shell-router-body-scope.tsx) that the Home v2 UI intentionally
// never surfaces as warning chips because a dedicated CTA already covers them.
// Must be filtered BEFORE formatHomeWarningLabel() runs — matching against the
// already-translated label here would silently stop filtering the moment the
// German copy changes.
export const HOME_HIDDEN_WARNING_KEYS = ["no_active_team", "season_started_no_results"];

export function formatHomeWarningLabel(warning: string) {
  const mapped: Record<string, string> = {
    no_active_team: "Kein aktives Team",
    season_started_no_results: "Saison ohne Ergebnis",
    no_final_standings: "Tabelle noch offen",
    missing_lineups: "Einsatzliste offen",
    lineup_not_submitted: "Einsatzliste voll — bitte in der Einsatzliste bestätigen.",
    formcard_pool_missing: "Formkarten-Pool fehlt",
    unused_negative_formcards: "Negative Formkarten offen",
    formcards_open: "Formkarten-Pool fehlt",
    formcards_assignment_optional: "Formkarten-Pool ok — Zuweisung optional",
    room_not_connected: "Room nicht verbunden",
  };
  return mapped[warning] ?? formatCockpitReason(warning);
}

export function formatMatchdayMvpWarning(warning: string) {
  if (warning.includes(": below_planning_target")) {
    const [teamName, detail] = warning.split(": below_planning_target ");
    return `${teamName} liegt unter dem Wunschkader ${detail}. Das blockiert den Spieltag nicht, solange mindestens 7 aktive Spieler vorhanden sind.`;
  }
  if (warning.includes(": target_roster_size_missing")) {
    const [teamName] = warning.split(": target_roster_size_missing");
    return `${teamName} hat noch keinen hinterlegten Wunschkader. Das ist ein Kaderhinweis, kein Matchday-Blocker.`;
  }
  return formatCockpitReason(warning);
}

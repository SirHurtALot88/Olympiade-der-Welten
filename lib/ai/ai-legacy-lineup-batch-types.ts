import type { AiLegacyLineupPreviewStatus } from "@/lib/ai/ai-needs-types";

/**
 * DIE FORMEN DER KI-STAPELVORSCHAU — an EINER Stelle, weil sie jetzt zwei Leser haben.
 *
 * Bis hierher standen diese Typen als lokale `type`-Bloecke im Lab-Client. Das war solange
 * folgenlos, wie sie nur dort gelesen wurden — und genau das war das Problem: die Bedienung zu
 * diesen Daten war gar nicht gerendert (`handleAiPreview`, `handleAdoptAiPreview`,
 * `handleSaveAiPreview`, `handleAiBatchApply`, `handleOpenAiBatchDetails` hatten KEINEN Aufrufer).
 * Die Vorschau wurde geladen, in den Zustand geschrieben — und nie angezeigt.
 *
 * Mit der wiederhergestellten Bedienung liest die Anzeigekomponente dieselben Antworten. Zwei
 * getrennte Typdeklarationen fuer dieselbe HTTP-Antwort laufen in diesem Projekt zuverlaessig
 * auseinander; deshalb liegen sie hier gemeinsam.
 */

export type AiBatchPreviewEntry = {
  teamId: string;
  teamName: string;
  teamCode: string;
  status: string;
  d1Status: string;
  d2Status: string;
  totalExpectedScore: number;
  d1DisciplineName: string | null;
  d2DisciplineName: string | null;
  d1SelectedPlayers: number;
  d1RequiredPlayers: number;
  d1MissingSlots: number;
  d2SelectedPlayers: number;
  d2RequiredPlayers: number;
  d2MissingSlots: number;
  d1CaptainName: string | null;
  d2CaptainName: string | null;
  warnings: string[];
  blockingReasons: string[];
  explanation: string;
};

export type AiBatchPreviewResponse = {
  readOnly: true;
  source: "sqlite" | "prisma";
  matchdayId: string;
  totalTeams: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  teams: AiBatchPreviewEntry[];
  error?: string;
};

export type AiBatchApplyTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  aiEligible: boolean;
  previewStatus: string;
  result:
    | "saved"
    | "skipped_warning"
    | "skipped_blocked"
    | "skipped_existing"
    | "skipped_manual"
    | "skipped_passive"
    | "skipped_disabled"
    | "failed_validation";
  overwriteExisting: boolean;
  warnings: string[];
  blockingReasons: string[];
  saved: boolean;
};

export type AiBatchApplyResponse = {
  source: "sqlite";
  readOnly: false;
  dryRun: boolean;
  includeWarningTeams: boolean;
  totalTeams: number;
  results: AiBatchApplyTeamResult[];
  summary: {
    totalTeams: number;
    aiEligibleTeams: number;
    skippedManual: number;
    skippedPassive: number;
    skippedDisabled: number;
    readyToSave: number;
    readyTeams: number;
    warningTeams: number;
    blockedTeams: number;
    wouldSave: number;
    savedTeams: number;
    skippedWarning: number;
    skippedBlocked: number;
    skippedExisting: number;
    existingLineups: number;
    wouldOverwrite: number;
    overwrittenExisting: number;
    plannedLineups: number;
    warnings: string[];
    blockingReasons: string[];
  };
  error?: string;
};

export type AiBatchPreviewSummary = {
  totalTeams: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
};

/**
 * DARF DER STAPELLAUF SCHREIBEN? — EINE Rechenstelle fuer Knopf und Handler.
 *
 * Der Stapellauf schreibt ausschliesslich KI-Teams, nie das im Feld gewaehlte. Er darf deshalb
 * NICHT an einer Teamschranke haengen. Genau das tat er aber: der Client prueft `isReadOnly`, und
 * darin steckt `isTeamManagementLocked` („du fuehrst dieses Team nicht"). Ergebnis, im Browser
 * nachgemessen: mit einem KI-Team im Feld — also im einzig sinnvollen Fall — standen „Probelauf"
 * und „Speichern" auf aus, und beim eigenen Team, das der Stapel gar nicht anfasst, auf an.
 *
 * Der Server zieht die richtige Linie und nur diese: `POST /api/lineups/legacy/ai-batch-apply`
 * lehnt `source=prisma` mit 409 ab („Prisma/Supabase mode is read-only in this build") und kennt
 * sonst keine Teampruefung. Die Anzeige spiegelt jetzt dieselbe Regel.
 */
export function canRunAiBatchApply(input: { source: "sqlite" | "prisma" }): boolean {
  return input.source !== "prisma";
}

/**
 * EIN Status-Wort fuer die Anzeige — statt roher Bezeichner wie `incomplete_roster`.
 *
 * Chris hat denselben Fehler an der Einsatzliste gemeldet („hier stand blank
 * `lineup_draft_is_locked`"): ein technischer Bezeichner auf dem Schirm ist von einem Absturz
 * nicht zu unterscheiden. Die Stapelvorschau haette ihn an 32 Zeilen gleichzeitig gezeigt.
 */
export function describeAiPreviewStatus(status: AiLegacyLineupPreviewStatus | string): string {
  switch (status) {
    case "ready":
      return "bereit";
    case "incomplete_roster":
      return "Kader zu klein";
    case "missing_scores":
      return "Werte fehlen";
    case "blocked":
      return "blockiert";
    default:
      return status;
  }
}

/**
 * Der Ton der Zeile. `warning` heisst: die KI hat einen Vorschlag, er hat aber offene Punkte —
 * speichern ist moeglich, nur eben nicht blind.
 */
export function getAiPreviewStatusTone(entry: {
  status: string;
  warnings: string[];
  blockingReasons: string[];
}): "ready" | "warning" | "blocked" {
  if (entry.blockingReasons.length > 0 || entry.status === "blocked") {
    return "blocked";
  }
  if (entry.status !== "ready" || entry.warnings.length > 0) {
    return "warning";
  }
  return "ready";
}

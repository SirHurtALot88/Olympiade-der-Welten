import type {
  FoundationActivityInput,
  FoundationActivityItem,
  FoundationActivityPreseasonRunSnapshot,
} from "@/lib/foundation/foundation-activity-types";

const COCKPIT_BUSY_LABELS: Record<string, string> = {
  "ai-market-apply": "AI-Markt wird angewendet",
  "ai-market-dry-run": "AI-Markt Dry-Run",
  "roster-fill-apply": "Kader wird aufgefuellt",
  "roster-fill-dry-run": "Kader-Fill Dry-Run",
  "ai-lineup-apply": "AI-Lineups werden gespeichert",
  "ai-lineup-dry-run": "AI-Lineup Dry-Run",
  "matchday-mvp-apply": "Matchday-MVP wird angewendet",
  "matchday-mvp-dry-run": "Matchday-MVP Dry-Run",
  "result-apply": "Matchday-Ergebnisse werden angewendet",
  "result-dry-run": "Matchday-Ergebnis Dry-Run",
  "standings-apply": "Tabelle wird angewendet",
  "standings-dry-run": "Tabellen Dry-Run",
  "cash-apply": "Preisgeld wird angewendet",
  "cash-dry-run": "Preisgeld Dry-Run",
  "preseason-preview": "Preseason-Vorschau laeuft",
  "preseason-next-season-setup": "Naechste Saison wird vorbereitet",
  "season-transition-start": "Saisonuebergang startet",
  "season-transition-preview": "Saisonuebergang Vorschau",
  "season-completion-execute": "Saisonabschluss laeuft",
  "season-completion-preview": "Saisonabschluss Vorschau",
  "matchday-advance": "Spieltag wird fortgeschaltet",
  "matchday-advance-dry-run": "Spieltag Dry-Run",
  "matchday-auto-run-execute": "Matchday Auto-Run laeuft",
  "matchday-auto-run-dry-run": "Matchday Auto-Run Dry-Run",
  "whole-season-dryrun": "Whole-Season Dry-Run laeuft",
  "season-snapshot-apply": "Season-Snapshot wird angewendet",
  "season-snapshot-dry-run": "Season-Snapshot Dry-Run",
  "cockpit-refresh": "Cockpit wird aktualisiert",
  "resolve-preview": "Resolve-Vorschau laeuft",
  "standings-preview": "Tabellen-Vorschau laeuft",
  "prize-preview": "Preisgeld-Vorschau laeuft",
};

function getPreseasonModeLabel(mode: FoundationActivityPreseasonRunSnapshot["mode"]) {
  if (mode === "setup_draft") return "Setup-Draft";
  if (mode === "season_market") return "Preseason-Markt";
  return "Preseason";
}

function buildPreseasonDetail(run: FoundationActivityPreseasonRunSnapshot, aiTeamsCount: number) {
  const parts = [`${run.aiTeamsCompleted}/${run.aiTeamsTotal || aiTeamsCount} Teams`];
  if (run.transferBuysApplied > 0) {
    parts.push(`${run.transferBuysApplied} ${run.mode === "setup_draft" ? "Picks" : "Kaeufe"}`);
  }
  if (run.transferSellsApplied > 0) {
    parts.push(`${run.transferSellsApplied} Verkaeufe`);
  }
  if (run.managerActionsApplied > 0) {
    parts.push(`${run.managerActionsApplied} Setup-Aktionen`);
  }
  if (run.blockingReasons[0]) {
    parts.push(run.blockingReasons[0]);
  }
  return parts.join(" · ");
}

export function buildFoundationActivities(input: FoundationActivityInput): FoundationActivityItem[] {
  const activities: FoundationActivityItem[] = [];

  if (input.isSaveBusy) {
    activities.push({
      id: "save-load",
      label: "Save laedt",
      detail: "Spielstand wird gewechselt",
      tone: "running",
    });
  }

  const preseasonRunning =
    input.aiPreseasonBusy || input.aiPreseasonRun?.status === "running";
  if (preseasonRunning) {
    const run = input.aiPreseasonRun;
    activities.push({
      id: "ai-preseason",
      label: run ? getPreseasonModeLabel(run.mode) : "AI-Preseason",
      detail: run ? buildPreseasonDetail(run, input.aiTeamsCount) : "AI-Teams werden vorbereitet",
      tone: "running",
      progressPct:
        run && run.aiTeamsTotal > 0
          ? Math.round((run.aiTeamsCompleted / run.aiTeamsTotal) * 100)
          : null,
    });
  }

  if (input.aiLineupEnsureBusy) {
    const summary = input.aiLineupEnsure;
    activities.push({
      id: "ai-lineup-ensure",
      label: "KI setzt Einsatzlisten",
      detail: summary
        ? `${summary.readyTeams}/${summary.totalTeams} Teams bereit`
        : "Lineups werden generiert",
      tone: "running",
      progressPct:
        summary && summary.totalTeams > 0
          ? Math.round((Math.max(summary.readyTeams, 0) / summary.totalTeams) * 100)
          : null,
    });
  }

  const adminStatus = input.adminSimulationRun?.status;
  if (input.adminSimulationBusy && adminStatus !== "running" && adminStatus !== "paused") {
    activities.push({
      id: "admin-season-sim-busy",
      label: "Season-Simulation",
      detail: "API-Aufruf laeuft",
      tone: "running",
    });
  } else if (adminStatus === "running" || adminStatus === "paused") {
    const run = input.adminSimulationRun;
    activities.push({
      id: "admin-season-sim",
      label: adminStatus === "paused" ? "Season-Simulation pausiert" : "Season-Simulation",
      detail: [run?.activePhase, run?.currentOperation].filter(Boolean).join(" · ") || "Fortschritt wird berechnet",
      tone: adminStatus === "paused" ? "warning" : "running",
      progressPct: run?.progressPct ?? null,
    });
  }

  if (input.seasonTransitionBusy) {
    activities.push({
      id: "season-transition",
      label: "Saisonuebergang",
      detail: "Transition laeuft im Hintergrund",
      tone: "running",
    });
  }

  if (input.preSeasonWorkflowBusy) {
    activities.push({
      id: "preseason-workflow",
      label: "Preseason-Workflow",
      detail: "Workflow-Schritte werden ausgefuehrt",
      tone: "running",
    });
  }

  if (input.seasonStartResetBusy) {
    activities.push({
      id: "season-start-reset",
      label: "Saison-Start-Reset",
      detail: "Save wird zurueckgesetzt",
      tone: "running",
    });
  }

  if (input.newGameBusy) {
    activities.push({
      id: "new-game",
      label: "Neues Spiel",
      detail: "Setup wird erstellt",
      tone: "running",
    });
  }

  if (input.rosterFillBusy) {
    activities.push({
      id: "roster-fill",
      label: "Kader-Fill",
      detail: "Roster wird automatisch ergaenzt",
      tone: "running",
    });
  }

  if (input.adminBalancingBusy) {
    activities.push({
      id: "admin-balancing",
      label: "Admin-Balancing",
      detail: "Balancing-Lauf aktiv",
      tone: "running",
    });
  }

  if (input.cockpitBusyKey) {
    activities.push({
      id: `cockpit-${input.cockpitBusyKey}`,
      label: COCKPIT_BUSY_LABELS[input.cockpitBusyKey] ?? "Hintergrund-Job",
      detail: input.cockpitBusyKey,
      tone: "running",
    });
  }

  if (input.marketBuyBusy) {
    activities.push({ id: "market-buy", label: "Transfer-Kauf", detail: "Kauf wird ausgefuehrt", tone: "running" });
  }
  if (input.marketSellBusy) {
    activities.push({ id: "market-sell", label: "Transfer-Verkauf", detail: "Verkauf wird ausgefuehrt", tone: "running" });
  }
  if (input.contractRenewalBusy) {
    activities.push({ id: "contract-renewal", label: "Vertragsverhandlung", detail: "Vertrag wird bearbeitet", tone: "running" });
  }
  if (input.sponsorChoiceBusy) {
    activities.push({ id: "sponsor-choice", label: "Sponsor waehlen", detail: "Sponsor wird gespeichert", tone: "running" });
  }
  if (input.facilityUpgradeBusy) {
    activities.push({ id: "facility-upgrade", label: "Gebaeude-Upgrade", detail: "Upgrade wird ausgefuehrt", tone: "running" });
  }
  if (input.facilityMaintenanceBusy) {
    activities.push({ id: "facility-maintenance", label: "Gebaeude-Wartung", detail: "Wartung wird ausgefuehrt", tone: "running" });
  }
  if (input.assignTeamCaptainBusy) {
    activities.push({ id: "assign-captain", label: "Kapitaen ernennen", detail: "Kapitaen wird gesetzt", tone: "running" });
  }
  if (input.marketAiPreviewBusy) {
    activities.push({ id: "market-ai-preview", label: "AI-Markt-Vorschau", detail: "Vorschau wird berechnet", tone: "running" });
  }

  if (input.liveSyncStatus === "syncing") {
    activities.push({ id: "live-sync", label: "Synchronisiert", detail: "Spielstand wird abgeglichen", tone: "running" });
  } else if (input.liveSyncStatus === "reconnecting") {
    activities.push({
      id: "live-reconnect",
      label: "Verbindung wird wiederhergestellt",
      detail: "Server-Verbindung unterbrochen",
      tone: "warning",
    });
  } else if (input.liveSyncStatus === "disconnected") {
    activities.push({
      id: "live-disconnected",
      label: "Verbindung getrennt",
      detail: "Live-Sync pausiert",
      tone: "blocked",
    });
  }

  if (input.fetchSlowWarning) {
    activities.push({
      id: "fetch-slow",
      label: "Laedt laenger als erwartet",
      detail: "Server antwortet verzoegert",
      tone: "warning",
    });
  }

  if (input.showIdleReady && activities.length === 0) {
    activities.push({
      id: "idle-ready",
      label: "Bereit",
      detail: "Alle Aktionen abgeschlossen",
      tone: "success",
    });
  }

  return activities;
}

export function getFoundationCockpitBusyLabel(key: string) {
  return COCKPIT_BUSY_LABELS[key] ?? key;
}

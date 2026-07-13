import type { ContractShape, GameInboxItem, TeamControlMode } from "@/lib/data/olyDataTypes";
import type { PlayerContractPreference } from "@/lib/market/contract-negotiation-preview";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import type { FeatureAuditStatus } from "@/lib/foundation/feature-audit-matrix";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";
import type { SaveSummary } from "@/lib/persistence/types";

type ActiveManagerTeamSource = "manual_select" | "route" | "saved_preference" | "default_human_team";

type FoundationAiPreseasonAutomationStatus = "running" | "completed" | "failed" | "skipped";
type FoundationAiPreseasonAutomationMode = "setup_draft" | "season_market" | "none";

type FoundationAiMarketPlanStatus = "hold" | "buy_only" | "sell_only" | "sell_then_buy" | "warning" | "blocked";

type FoundationAiNeedsCompareStatus = "matched" | "partial" | "deviated" | "retool_pick_source_missing" | "blocked";

type MarketNegotiationOutcomeTone = "success" | "warning" | "error";

export function getTransferTypeLabel(type: "buy" | "sell" | "contract_exit") {
  if (type === "contract_exit") return "Contract Exit";
  return type === "buy" ? "Kauf" : "Verkauf";
}

export function getTransferTypePillClass(type: "buy" | "sell" | "contract_exit") {
  return `transfer-status-pill ${type === "buy" ? "is-ready" : "is-warning"}`;
}
export function formatTeamControlModeLabel(mode: TeamControlMode | null | undefined) {
  if (mode === "manual") return "geführt";
  if (mode === "ai") return "automatisch";
  if (mode === "passive") return "beobachtet";
  return "offen";
}

export function getTransferSourceLabel(source: string | null | undefined) {
  if (!source) {
    return "—";
  }

  const labels: Record<string, string> = {
    manual_transfermarkt_buy: "Manual Buy",
    manual_transfermarkt_sell: "Manual Sell",
    auto_roster_fill: "Setup / Auto Roster Fill",
    ai_roster_fill: "Setup / AI Roster Fill",
    smoke_setup: "Smoke/Setup",
  };

  return labels[source] ?? source.replaceAll("_", " ");
}
export function formatMoney(value: number) {
  // Clamp a magnitude that rounds to zero so we never render "-0,0".
  const normalized = Math.round(value * 10) === 0 ? 0 : value;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(normalized);
}

export function formatNullableMoney(value: number | null | undefined) {
  return value == null ? "—" : formatMoney(value);
}

export function formatDisplayMoney(value: number) {
  // Clamp a magnitude that rounds to zero so we never render "-0,0".
  const normalized = Math.round(value * 10) === 0 ? 0 : value;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(normalized);
}

export function formatShortSaveId(saveId: string) {
  return saveId.length <= 14 ? saveId : `${saveId.slice(0, 8)}…${saveId.slice(-5)}`;
}

export function formatScenarioTypeLabel(scenarioType?: string | null) {
  switch (scenarioType) {
    case "fresh_start":
      return "Neuer Start";
    case "ai_redraft_test":
      return "Redraft Test";
    case "season1_simulation":
      return "S1 Simulation";
    case "season1_completed":
      return "S1 Completed";
    case "season_transition_test":
      return "Transition Test";
    case "season2_start":
      return "S2 Start";
    case "live_feature_test":
      return "Live Test";
    case "sandbox_multiseason_test":
      return "Sandbox";
    case "sandbox_snapshot":
      return "Sandbox Snapshot";
    default:
      return "Unmarkiert";
  }
}

export function formatGamePhaseLabel(phase?: string | null) {
  if (phase === "season_active") return "Saison läuft";
  if (phase === "season_review") return "Saisonrückblick";
  if (phase === "season_completed") return "Saison abgeschlossen";
  if (phase === "preseason_management") return "Preseason-Management";
  if (phase === "transfer_sell_phase") return "Verkaufsfenster";
  if (phase === "transfer_buy_phase") return "Kaufphase";
  if (phase === "lineup_setup") return "Lineup Setup";
  if (phase === "next_season_ready") return "Nächste Saison bereit";
  if (phase === "transfer_window") return "Transferfenster";
  if (phase === "setup") return "Vorbereitung";
  return phase ? phase.replaceAll("_", " ") : "Vorbereitung";
}

export function formatFeatureAuditStatus(status: FeatureAuditStatus) {
  if (status === "planned") return "Geplant";
  if (status === "preview") return "Preview";
  if (status === "local_write") return "Local Write";
  if (status === "sandbox_ready") return "Sandbox";
  if (status === "multiplayer_ready") return "Multiplayer";
  if (status === "prod_ready") return "Prod";
  return status;
}

export function resolveScenarioMetaLabel(meta?: SaveSummary["scenarioMeta"] | null) {
  if (!meta) return "default/fresh";
  switch (meta.scenarioType) {
    case "ai_redraft_test":
      return "clean-redraft";
    case "season1_simulation":
      return "simulation";
    case "season1_completed":
      return "season-end";
    case "season_transition_test":
      return "transition-test";
    case "season2_start":
      return "season-2-start";
    case "live_feature_test":
      return "live-test";
    case "sandbox_multiseason_test":
      return "sandbox";
    case "sandbox_snapshot":
      return "sandbox-snapshot";
    case "fresh_start":
      return "default/fresh";
    default:
      return "planning";
  }
}

export function buildScenarioWarning(meta?: SaveSummary["scenarioMeta"] | null) {
  if (!meta) return "Alte Save-Struktur ohne Scenario-Meta.";
  if (meta.scenarioType === "sandbox_multiseason_test") {
    return "Sandbox-Testsave: lokale Test-Writes erlaubt, nicht produktiv.";
  }
  if (meta.scenarioType === "sandbox_snapshot") {
    return "Sandbox-Snapshot: stabiler Rücksprungpunkt, nicht aktiv beschreiben.";
  }
  if (meta.scenarioType === "ai_redraft_test" && !meta.containsFinalStandings) {
    return "Dieser Save ist ein Redraft-Testsave ohne abgeschlossene Season.";
  }
  if (!meta.containsFinalStandings && meta.scenarioType !== "fresh_start" && meta.scenarioType !== "season2_start") {
    return "Dieser Save enthält keine abgeschlossene Season.";
  }
  return null;
}

export function buildContextStatusChips(meta?: SaveSummary["scenarioMeta"] | null) {
  return [
    {
      label: meta?.scenarioType === "sandbox_multiseason_test" ? "Sandbox" : "Kein Sandbox",
      ready: meta?.scenarioType === "sandbox_multiseason_test",
      warning: meta?.scenarioType === "sandbox_snapshot",
    },
    {
      label: meta?.allowTestWrites ? "Test Writes erlaubt" : "Test Writes aus",
      ready: Boolean(meta?.allowTestWrites),
      warning: Boolean(meta?.allowTestWrites),
    },
    {
      label: meta?.allowTestWrites ? "Nicht Produktiv" : "Produktivschutz",
      ready: !meta?.allowTestWrites,
      warning: Boolean(meta?.allowTestWrites),
    },
    {
      label: `S1 Ergebnisse ${meta?.containsSeasonHistory ? "vorhanden" : "fehlen"}`,
      ready: Boolean(meta?.containsSeasonHistory),
    },
    {
      label: `Final Standings ${meta?.containsFinalStandings ? "vorhanden" : "fehlen"}`,
      ready: Boolean(meta?.containsFinalStandings),
    },
    {
      label: `Season 2 ${meta?.activeSeasonId === "season-2" ? "aktiv" : "nicht aktiv"}`,
      ready: meta?.activeSeasonId === "season-2",
    },
    {
      label: meta?.scenarioType === "ai_redraft_test" ? "Redraft Testsave" : "Kein Redraft",
      ready: meta?.scenarioType !== "ai_redraft_test",
      warning: meta?.scenarioType === "ai_redraft_test",
    },
    {
      label: meta?.gamePhase ? `Phase ${meta.gamePhase}` : "Planning",
      ready: meta?.gamePhase !== "season_active",
    },
  ];
}

export function buildViewContextWarning(
  view: FoundationViewId,
  meta: SaveSummary["scenarioMeta"] | null,
  gamePhase: string | null | undefined,
) {
  if (meta?.scenarioType === "sandbox_multiseason_test") {
    return "Sandbox-Testsave: lokale Test-Writes sind erlaubt; Prisma/Remote/Direktinserts bleiben verboten.";
  }
  if (meta?.scenarioType === "sandbox_snapshot") {
    return "Sandbox-Snapshot: stabiler Rücksprungpunkt, bitte nicht als aktiven Schreibsave nutzen.";
  }

  if (meta?.scenarioType === "ai_redraft_test") {
    return "Redraft-Testsave: enthält Kader-/Pickdaten, aber keine vollständige Season-Historie.";
  }

  if ((view === "season" || view === "seasonV2" || view === "prize" || view === "cockpit") && !meta?.containsFinalStandings) {
    return "Dieser Save hat keine abgeschlossenen Season-Daten.";
  }

  if (
    (view === "training" || view === "trainingV2") &&
    (gamePhase ?? "season_active") === "season_active" &&
    !meta?.containsFinalStandings
  ) {
    return "Season-End Workflow blockiert: Season ist nicht abgeschlossen.";
  }

  return null;
}

export function getViewSourceBadgeLabel(view: FoundationViewId, meta?: SaveSummary["scenarioMeta"] | null) {
	  if (view === "home") return "source: manager home snapshot";
	  if (view === "hq") return "source: front office snapshot";
	  if (view === "inbox") return "source: derived inbox";
  if (view === "season") return meta?.containsFinalStandings ? "Spielstand: Saisonergebnisse" : "Spielstand: aktiv";
  if (view === "seasonV2") return meta?.containsFinalStandings ? "Spielstand: Saisonergebnisse" : "Spielstand: aktiv";
  if (view === "prize") return "Vorschau: Saisonende";
  if (view === "market") return "Spielstand: aktiv";
  if (view === "marketV2") return "Spielstand: aktiv";
  if (view === "historyV2") return "Spielstand: aktiv";
  if (view === "training" || view === "trainingV2") return "Kader: Entwicklung";
  if (view === "matchdayArena") return meta?.containsFinalStandings ? "Spieltag: entschieden" : "Spieltag: aktiv";
  if (view === "matchdayResult") return "Spieltag: Ergebnisse";
  if (view === "history") return "Spielstand: aktiv";
  return "Spielstand: aktiv";
}

export function formatActiveManagerTeamSource(source: ActiveManagerTeamSource) {
  switch (source) {
    case "route":
      return "URL";
    case "saved_preference":
      return "gespeichert";
    case "default_human_team":
      return "Startteam";
    case "manual_select":
    default:
      return "manuell";
  }
}

export function formatWholeNumber(value: number | null | undefined) {
  return formatLocalePoints(value, 0);
}

export function formatSignedDisplayMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatDisplayMoney(value)}`;
}

export function formatSignedTransfermarktCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatTransfermarktCurrency(value)}`;
}

export function formatSignedPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatLocalePoints(value, 1)}%`;
}

export function formatContractShapeLabel(shape: ContractShape | null | undefined) {
  if (shape === "front_loaded") {
    return "Front-loaded";
  }
  if (shape === "back_loaded") {
    return "Back-loaded";
  }
  if (shape === "balanced") {
    return "Balanced";
  }
  return "—";
}

export function formatContractLengthPreferenceLabel(value: PlayerContractPreference["lengthPreference"] | null | undefined) {
  if (value === "long") return "bevorzugt lange Verträge";
  if (value === "short") return "bevorzugt kurze Verträge";
  if (value === "medium") return "mag mittlere Verträge";
  return "keine klare Präferenz";
}

export function formatContractPreferenceMatchLabel(value: PlayerContractPreference["matchQuality"] | null | undefined) {
  if (value === "preferred") return "passt sehr gut";
  if (value === "acceptable") return "teilweise passend";
  if (value === "mismatch") return "kostet Vertrauen";
  return "—";
}

export function formatContractPreferenceCurrentStatus(
  contractPreference: Pick<PlayerContractPreference, "preferredMinLength" | "preferredMaxLength" | "shapePreference">,
  contractLength: number | null | undefined,
  contractShape: ContractShape | null | undefined,
) {
  const safeLength = typeof contractLength === "number" && Number.isFinite(contractLength) ? contractLength : null;
  const lengthMatches =
    safeLength != null &&
    safeLength >= contractPreference.preferredMinLength &&
    safeLength <= contractPreference.preferredMaxLength;
  const shapeMatches = contractShape === contractPreference.shapePreference;

  if (lengthMatches && shapeMatches) {
    return "Aktuell: Laufzeit und Form passen gut";
  }
  if (lengthMatches) {
    return `Aktuell: Laufzeit passt, Form stört (${formatContractShapeLabel(contractShape)})`;
  }
  if (shapeMatches) {
    return `Aktuell: Form passt, Laufzeit stört (${safeLength ?? "?"} Saisons)`;
  }
  return `Aktuell: Laufzeit (${safeLength ?? "?"}) und Form (${formatContractShapeLabel(contractShape)}) weichen ab`;
}

export function formatMoraleContractIntentLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    willing_to_extend: "verlängerungsbereit",
    short_term_only: "nur kurz binden",
    demands_raise: "fordert Aufwertung",
    considering_exit: "denkt an Wechsel",
    refuses_extension: "blockt Verlängerung",
  };
  return value ? labels[value] ?? value.replaceAll("_", " ") : "—";
}

export function formatChancePercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatWholeNumber(value)}%`;
}

export function formatNegotiationSignalLabel(value: string) {
  const labels: Record<string, string> = {
    Ambitious_reagiert_bei_schwachem_Angebot_kritischer: "Ambitionierter Spieler erwartet ein stärkeres Signal.",
    contract_length_override_in_effect: "Mehrjahresvertrag weicht vom Standard ab.",
    low_team_fit_reduces_acceptance: "Teamfit senkt die Zusagechance.",
    market_bracket_factor_preview_pending: "Marktwertklasse wird im Vertragsrisiko nur als Preview berücksichtigt.",
    negotiation_cancelled_after_contact: "Abgebrochene Verhandlung bleibt als schlechte Erfahrung gespeichert.",
    negotiation_rejected_bad_experience: "Abgelehntes Angebot bleibt als schlechte Erfahrung gespeichert.",
    offer_below_expected_salary: "Angebot liegt unter der Gehaltserwartung.",
    preview_only_contract_negotiation: "Verhandlungssimulation — finaler Kauf über „Kauf bestätigen“.",
    previous_rejected_offer_reduces_trust: "Spieler ist nach der letzten Runde noch angefressen und verhandelt härter.",
    salary_source_missing: "Gehaltserwartung fehlt.",
    trait_salary_factor_source_missing: "Trait-Gehaltseffekt noch nicht final aus Quelle belegt.",
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

export function getNegotiationFactorTone(value: string, fallback: "positive" | "negative" | "neutral") {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("bonus") ||
    normalized.includes("stuetzt") ||
    normalized.includes("deckt") ||
    normalized.includes("ueber") ||
    normalized.includes("gleichmaessig")
  ) {
    return "positive";
  }
  if (
    normalized.includes("below") ||
    normalized.includes("missing") ||
    normalized.includes("pending") ||
    normalized.includes("reduces") ||
    normalized.includes("kritischer") ||
    normalized.includes("lowball") ||
    normalized.includes("ablehnung") ||
    normalized.includes("belastet")
  ) {
    return "negative";
  }
  return fallback;
}

export function getNegotiationOutcomeToneClass(tone: MarketNegotiationOutcomeTone) {
  if (tone === "success") return "is-success";
  if (tone === "error") return "is-error";
  return "is-warning";
}

export function formatPpsValue(value: number | null | undefined) {
  return formatLocalePoints(value, 1);
}

export function formatNullablePps(value: number | null | undefined) {
  return value == null ? "—" : formatPpsValue(value);
}

export type DisciplineCategoryFilter = "all" | "power" | "speed" | "mental" | "social";

export function formatDisciplineCategoryLabel(category: string | null | undefined) {
  if (category === "power") return "rot";
  if (category === "speed") return "grün";
  if (category === "mental") return "blau";
  if (category === "social") return "gelb";
  return "neutral";
}

export function formatSignedNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${formatLocalePoints(value, digits)}`;
}

export function formatPlayerRatingValue(value: number | null | undefined) {
  return formatWholeNumber(value);
}

export function inferSaveTypeLabel(
  value:
    | {
        saveName?: string | null;
        saveStatus?: string | null;
      }
    | SaveSummary
    | null
    | undefined,
) {
  const saveName = value && "saveName" in value ? value.saveName : null;
  const summaryName = value && "name" in value ? value.name : null;
  const label = saveName ?? summaryName ?? "";
  const normalized = label.toLowerCase();
  if (normalized.includes("smoke")) {
    return "Smoke";
  }
  if (normalized.includes("fresh season")) {
    return "Fresh Season";
  }
  if (normalized.includes("dryrun") || normalized.includes("dry-run")) {
    return "DryRun";
  }
  const saveStatus = value && "saveStatus" in value ? value.saveStatus : null;
  const summaryStatus = value && "status" in value ? value.status : null;
  if ((saveStatus ?? summaryStatus ?? "") === "template") {
    return "Template";
  }
  return "Arbeitsstand";
}

export function formatContractNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}


export function getAiPreseasonStatusLabel(status: FoundationAiPreseasonAutomationStatus) {
  if (status === "running") return "AI pickt gerade";
  if (status === "completed") return "AI fertig";
  if (status === "failed") return "AI blockiert";
  return "AI übersprungen";
}

export function getAiPreseasonModeLabel(mode: FoundationAiPreseasonAutomationMode) {
  if (mode === "setup_draft") return "Setup-Draft";
  if (mode === "season_market") return "Preseason-Markt";
  return "Preseason";
}

export function getAiPreseasonStatusClass(status: FoundationAiPreseasonAutomationStatus) {
  if (status === "running") return "is-applying";
  if (status === "completed") return "is-completed";
  if (status === "failed") return "is-blocked";
  return "is-optional";
}
export function getAiLineupEnsureStatusClass(feed: { error?: string | null; summary?: { blockedTeams?: number | null; skippedBlocked?: number | null } | null } | null, busy: boolean) {
  if (busy) return "is-applying";
  if (feed?.error || (feed?.summary?.blockedTeams ?? 0) > 0 || (feed?.summary?.skippedBlocked ?? 0) > 0) return "is-blocked";
  return "is-completed";
}

export function getInboxSeverityLabel(severity: GameInboxItem["severity"]) {
  if (severity === "critical") return "kritisch";
  if (severity === "warning") return "Warnung";
  return "Info";
}

export function getInboxSeverityPillClass(severity: GameInboxItem["severity"]) {
  if (severity === "critical") return "transfer-status-pill is-blocked";
  if (severity === "warning") return "transfer-status-pill is-warning";
  return "transfer-status-pill is-info";
}

export function getInboxCategoryLabel(category: GameInboxItem["category"]) {
  if (category === "task") return "Aufgabe";
  if (category === "warning") return "Warnung";
  if (category === "news") return "Story";
  if (category === "result") return "Reveal";
  if (category === "finance") return "Finanzen";
  if (category === "transfer") return "Transfer";
  if (category === "training") return "Training";
  if (category === "contract") return "Vertrag";
  if (category === "facility") return "Gebäude";
  return "Hinweis";
}

export function getInboxCategoryIcon(category: GameInboxItem["category"]) {
  if (category === "task") return "!";
  if (category === "warning") return "!";
  if (category === "result") return "#";
  if (category === "finance") return "$";
  if (category === "transfer") return "+";
  if (category === "training") return "^";
  if (category === "contract") return "%";
  if (category === "facility") return "*";
  return "i";
}

export function getInboxStatusLabel(status: GameInboxItem["status"]) {
  if (status === "done") return "erledigt";
  if (status === "dismissed") return "ausgeblendet";
  return "offen";
}

export function getInboxStatusPillClass(status: GameInboxItem["status"]) {
  if (status === "done") return "transfer-status-pill is-ready";
  if (status === "dismissed") return "transfer-status-pill";
  return "transfer-status-pill is-info";
}
export function getAiMarketPlanStatusLabel(status: FoundationAiMarketPlanStatus) {
  if (status === "hold") return "halten";
  if (status === "buy_only") return "nur kaufen";
  if (status === "sell_only") return "nur verkaufen";
  if (status === "sell_then_buy") return "verkaufen dann kaufen";
  if (status === "warning") return "achtung";
  return "blockiert";
}

export function getAiMarketPlanStatusPillClass(status: FoundationAiMarketPlanStatus) {
  if (status === "hold") return "transfer-status-pill";
  if (status === "buy_only" || status === "sell_then_buy") return "transfer-status-pill is-ready";
  if (status === "sell_only" || status === "warning") return "transfer-status-pill is-warning";
  return "transfer-status-pill is-blocked";
}

export function getAiNeedsCompareStatusLabel(status: FoundationAiNeedsCompareStatus) {
  if (status === "matched") return "match";
  if (status === "partial") return "teilweise";
  if (status === "deviated") return "abweichung";
  if (status === "retool_pick_source_missing") return "retool fehlt";
  return "blockiert";
}

export function getAiNeedsCompareStatusPillClass(status: FoundationAiNeedsCompareStatus) {
  if (status === "matched") return "transfer-status-pill is-ready";
  if (status === "partial") return "transfer-status-pill";
  if (status === "deviated" || status === "retool_pick_source_missing") return "transfer-status-pill is-warning";
  return "transfer-status-pill is-blocked";
}
export function formatIdentityWeight(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

export function parseCsvList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function formatCsvList(values: string[] | null | undefined) {
  return values?.join(", ") ?? "";
}

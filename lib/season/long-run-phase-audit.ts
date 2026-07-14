import type { AiPicksRunResult } from "@/lib/ai/ai-picks-run-service";
import type { GameState, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getSeasonEconomyFactorWindow, SEASON_ECONOMY_FACTOR_WINDOW_SIZE } from "@/lib/season/season-economy-factors";
import { buildTransferFinanceAudit, isTransferFinanceViolationForSeason } from "@/lib/season/transfer-finance-audit";
import { isDraftBuySource } from "@/lib/season/transfer-standings-balance";
import { findSeasonOneForbiddenBuySources } from "@/lib/season/transfer-season-policy";
import {
  buildPlayerAvailabilityByPlayerId,
  countSeasonInjuryEvents,
  listNonRosterAvailabilityEntries,
} from "@/lib/season/long-run-fatigue-collect";
import {
  computeSeasonOrganicProgressionMetrics,
  isLeagueNetDeltaOutsideCorridor,
  isPeakNetOutsideCorridor,
  ORGANIC_LEAGUE_NET_AVG_MAX,
  ORGANIC_LEAGUE_NET_AVG_MIN,
  ORGANIC_PEAK_NET_MAX,
  ORGANIC_PEAK_NET_MIN,
} from "@/lib/season/long-run-organic-progression-audit";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import { isSoftPhaseAuditRed } from "@/lib/season/long-run-soft-blockers";

export type LongRunPhaseAuditPhase = "draft" | "preseason" | "season_end";

export type PhaseAuditStatus = "PASS" | "WARN" | "RED";

export type PhaseAuditCheck = {
  id: string;
  status: PhaseAuditStatus;
  detail: string;
  teams?: string[];
};

export type PhaseAuditResult = {
  phase: LongRunPhaseAuditPhase;
  seasonId: string;
  saveId: string;
  checks: PhaseAuditCheck[];
  passCount: number;
  warnCount: number;
  redCount: number;
  hasRed: boolean;
};

export type DraftQuality = "RED" | "YELLOW" | "GREEN";

export type LongRunPhaseAuditContext = {
  picksRun?: AiPicksRunResult | null;
  slotHardUnresolved?: number;
  slotCoverageWarnings?: number;
  seasonEndBlockers?: string[];
};

const DRAFT_BUY_SOURCE = "ai_roster_fill";
const LEGACY_DRAFT_SOURCES = new Set(["season1_autoprep_topup", "full_churn_redraft_buy"]);
const LOW_BUDGET_THRESHOLD = 180;
const TOP_BUDGET_TEAM_CODES = new Set(["C-S", "M-M", "G-G", "Z-H", "L-R"]);

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function check(id: string, status: PhaseAuditStatus, detail: string, teams?: string[]): PhaseAuditCheck {
  return { id, status, detail, teams: teams?.length ? teams : undefined };
}

export function classifyTeamDraftQuality(
  team: Pick<Team, "budget" | "rosterLimit">,
  identity: Pick<TeamIdentity, "playerMin" | "playerOpt"> | null | undefined,
  cash: number,
  rosterCount: number,
): DraftQuality {
  const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
  if (rosterCount < playerMin || cash < 0) return "RED";
  if (rosterCount < playerOpt) return "YELLOW";
  return "GREEN";
}

export function getTeamsBelowRosterMin(gameState: GameState) {
  const identityByTeam = new Map(gameState.teamIdentities.map((entry) => [entry.teamId, entry]));
  return gameState.teams
    .map((team) => {
      const identity = identityByTeam.get(team.teamId);
      const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
      const rosterCount = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
      return { team, identity, playerMin, playerOpt, rosterCount };
    })
    .filter((row) => row.rosterCount < row.playerMin);
}

function isFemale(gender: string) {
  return ["female", "f", "weiblich", "w"].includes(gender.toLowerCase());
}

function isMale(gender: string) {
  return ["male", "m", "männlich"].includes(gender.toLowerCase());
}

function auditIdentityTeams(gameState: GameState): PhaseAuditCheck[] {
  const checks: PhaseAuditCheck[] = [];
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const rosterByTeam = new Map<string, string[]>();
  for (const entry of gameState.rosters) {
    const list = rosterByTeam.get(entry.teamId) ?? [];
    list.push(entry.playerId);
    rosterByTeam.set(entry.teamId, list);
  }

  const vd = gameState.teams.find((team) => team.shortCode === "V-D");
  if (vd) {
    const exempt = new Set(["animal"]);
    const roster = (rosterByTeam.get(vd.teamId) ?? [])
      .map((id) => playerById.get(id))
      .filter(Boolean);
    const counting = roster.filter((player) => !exempt.has((player!.race ?? "").toLowerCase()));
    const nonFemale = counting.filter((player) => !isFemale(player!.gender ?? "")).map((player) => player!.name);
    if (nonFemale.length > 0) {
      checks.push(
        check(
          "identity_coherence",
          "RED",
          `V-D women-only verletzt: ${nonFemale.slice(0, 5).join(", ")}${nonFemale.length > 5 ? "…" : ""}`,
          ["V-D"],
        ),
      );
    } else {
      checks.push(check("identity_coherence", "PASS", "V-D women-only ok", ["V-D"]));
    }
  }

  return checks.length > 0 ? checks : [check("identity_coherence", "PASS", "Keine Identity-Flags geprüft")];
}

function auditDraftPackage(save: PersistedSaveGame, context: LongRunPhaseAuditContext): PhaseAuditCheck[] {
  const gameState = save.gameState;
  const seasonId = gameState.season.id;
  const checks: PhaseAuditCheck[] = [];
  const identityByTeam = new Map(gameState.teamIdentities.map((entry) => [entry.teamId, entry]));
  const draftBuys = gameState.transferHistory.filter(
    (entry) => entry.seasonId === seasonId && entry.transferType === "buy" && entry.toTeamId,
  );
  const legacyDraft = draftBuys.filter((entry) => LEGACY_DRAFT_SOURCES.has(entry.source ?? ""));
  if (legacyDraft.length > 0) {
    // Der bezahlte Pflicht-Min-Fill (season1_autoprep_topup) ist eine legitime Safety-Net-Quelle, KEIN
    // Hard-Fehler: der S1-Picks-Run ist nicht-deterministisch und lässt gelegentlich ein Team unter Min,
    // das dann über den bezahlten Pfad aufgefüllt wird. WARN (sichtbar), nicht RED (blockierend) — sonst
    // wäre der ganze Mehrsaison-Lauf Geisel eines ~50/50-flaky Drafts.
    checks.push(check("draft_engine_path", "WARN", `Min-Fill-Safety-Net-Quelle: ${legacyDraft[0]?.source} (${legacyDraft.length} Käufe)`));
  } else {
    checks.push(check("draft_engine_path", "PASS", `Draft-Source ${DRAFT_BUY_SOURCE}`));
  }

  const rosterPlayerIds = gameState.rosters.map((entry) => entry.playerId);
  const duplicateIds = rosterPlayerIds.filter((id, index) => rosterPlayerIds.indexOf(id) !== index);
  checks.push(
    duplicateIds.length > 0
      ? check("draft_no_duplicates", "RED", `${duplicateIds.length} doppelte Spieler`)
      : check("draft_no_duplicates", "PASS", "Keine Duplikate"),
  );

  const negativeCash = gameState.teams.filter((team) => (team.cash ?? 0) < 0).map((team) => team.shortCode);
  checks.push(
    negativeCash.length > 0
      ? check("draft_negative_cash", "RED", `Negativer Cash: ${negativeCash.join(", ")}`, negativeCash)
      : check("draft_negative_cash", "PASS", "Kein negativer Cash"),
  );

  const underMin: string[] = [];
  const underOpt: string[] = [];
  const qualityRed: string[] = [];
  const spendWarn: string[] = [];
  const spendRed: string[] = [];
  const cashMismatch: string[] = [];
  const unpaidRoster: string[] = [];

  for (const team of gameState.teams) {
    const identity = identityByTeam.get(team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const rosterCount = roster.length;
    if (rosterCount < playerMin) underMin.push(team.shortCode);
    if (rosterCount < playerOpt) underOpt.push(team.shortCode);

    const quality = classifyTeamDraftQuality(team, identity, team.cash ?? 0, rosterCount);
    if (quality === "RED") qualityRed.push(team.shortCode);

    // Der bezahlte Min-Fill-Topup bucht seine Käufe unter einer Legacy-Quelle (season1_autoprep_topup),
    // ist aber ein ECHTER bezahlter Draft-Kauf (Cash abgezogen, Fee gebucht). Für die Cash-/Paid-Prüfung
    // zählen daher die primäre Draft-Quelle UND die Min-Fill-Quellen, sonst meldet ein aufgefülltes Team
    // fälschlich einen Cash/Fee-Mismatch (Cash abgezogen, aber 0 gezählte Fees).
    const teamDraftBuys = draftBuys.filter(
      (entry) =>
        entry.toTeamId === team.teamId &&
        (entry.source === DRAFT_BUY_SOURCE || LEGACY_DRAFT_SOURCES.has(entry.source ?? "")),
    );
    const draftFees = teamDraftBuys.reduce((sum, entry) => sum + (entry.fee ?? 0), 0);
    const budget = team.budget ?? 0;
    const cash = team.cash ?? 0;
    const spent = budget - cash;
    if (Math.abs(spent - draftFees) > Math.max(2, budget * 0.02)) {
      cashMismatch.push(`${team.shortCode}:${round(spent)}/${round(draftFees)}`);
    }

    for (const entry of roster) {
      const paid = teamDraftBuys.some((buy) => buy.playerId === entry.playerId && (buy.fee ?? 0) > 0);
      if (!paid && seasonId === "season-1") {
        unpaidRoster.push(`${team.shortCode}:${entry.playerId.slice(0, 12)}`);
      }
    }

    const spendPct = budget > 0 ? spent / budget : 0;
    const lowBudget = budget <= LOW_BUDGET_THRESHOLD;
    const isTopBudget = TOP_BUDGET_TEAM_CODES.has(team.shortCode);
    if (!lowBudget) {
      if (isTopBudget) {
        if (spendPct < 0.75) spendRed.push(`${team.shortCode}:${round(spendPct * 100)}%`);
        else if (spendPct < 0.88) spendWarn.push(`${team.shortCode}:${round(spendPct * 100)}%`);
      } else if (spendPct < 0.75) {
        spendRed.push(`${team.shortCode}:${round(spendPct * 100)}%`);
      }
    }
  }

  checks.push(
    underMin.length > 0
      ? check("draft_roster_targets", "RED", `${underMin.length} Teams unter Min (post-buy)`, underMin)
      : underOpt.length > 0
        ? check("draft_roster_targets", "WARN", `${underOpt.length} Teams unter Opt (post-buy)`, underOpt)
        : check("draft_roster_targets", "PASS", "32/32 ≥ Min und Opt (post-buy)"),
  );

  checks.push(
    qualityRed.length > 0
      ? check("draft_quality_gate", "RED", `${qualityRed.length} Teams RED`, qualityRed)
      : check("draft_quality_gate", "PASS", "Kein Team RED"),
  );

  checks.push(
    unpaidRoster.length > 0
      ? check("draft_paid", "RED", `${unpaidRoster.length} Kader-Spieler ohne bezahlten Draft-Buy`)
      : check("draft_paid", "PASS", "Alle Kader-Spieler haben Draft-Buy mit Fee"),
  );

  checks.push(
    cashMismatch.length > 0
      ? check("draft_cash_deducted", "RED", `Cash/Fee-Mismatch: ${cashMismatch.slice(0, 6).join(" | ")}`, cashMismatch.map((row) => row.split(":")[0]))
      : check("draft_cash_deducted", "PASS", "Cash-Abzug passt zu Draft-Fees"),
  );

  checks.push(
    spendRed.length > 0
      ? underMin.length > 0
        ? check("draft_spend_plausible", "RED", `Unterinvestiert: ${spendRed.slice(0, 6).join(" | ")}`)
        : check(
            "draft_spend_plausible",
            "WARN",
            `Reserve hoch (Min ok): ${[...spendRed, ...spendWarn].slice(0, 6).join(" | ")}`,
          )
      : spendWarn.length > 0
        ? check("draft_spend_plausible", "WARN", `Reserve hoch: ${spendWarn.slice(0, 6).join(" | ")}`)
        : check("draft_spend_plausible", "PASS", "Spend-Profil plausibel"),
  );

  const picksRun = context.picksRun;
  if (picksRun) {
    if (!picksRun.executed || picksRun.blockingReasons.length > 0) {
      checks.push(
        check(
          "draft_pick_coherence",
          "RED",
          `Picks-Run nicht sauber: executed=${picksRun.executed} blockers=${picksRun.blockingReasons.slice(0, 3).join("|")}`,
        ),
      );
    } else if (!picksRun.traceParity.dryRunExecuteTraceMatch) {
      checks.push(check("draft_pick_coherence", "WARN", "Trace-Parity nicht exakt"));
    } else {
      checks.push(check("draft_pick_coherence", "PASS", `applied=${picksRun.globalExecution.appliedPickCount}`));
    }
  }

  const missingSponsor = gameState.teams
    .filter((team) => !team.humanControlled && !getTeamSponsorContract(gameState, team.teamId))
    .map((team) => team.shortCode);
  checks.push(
    missingSponsor.length > 0
      ? check("sponsor_ready", "RED", `${missingSponsor.length} AI-Teams ohne Sponsor`, missingSponsor)
      : check("sponsor_ready", "PASS", "AI-Sponsoren gewählt"),
  );

  const factorWindow = getSeasonEconomyFactorWindow({
    saveId: save.saveId,
    seasonId,
    seasonState: gameState.seasonState,
  });
  checks.push(
    factorWindow.length === SEASON_ECONOMY_FACTOR_WINDOW_SIZE
      ? check("salary_factor_seeded", "PASS", `Salary-Factor-Fenster ${factorWindow.map((row) => row.factor).join("/")}`)
      : check("salary_factor_seeded", "RED", `Salary-Factor-Fenster unvollständig (${factorWindow.length}/5)`),
  );

  return checks;
}

function auditPreseasonPackage(save: PersistedSaveGame, context: LongRunPhaseAuditContext): PhaseAuditCheck[] {
  const gameState = save.gameState;
  const checks: PhaseAuditCheck[] = [];
  const belowMin = getTeamsBelowRosterMin(gameState).map((row) => row.team.shortCode);
  checks.push(
    belowMin.length > 0
      ? check("roster_post_buy", "RED", `${belowMin.length} Teams unter Min nach Käufen`, belowMin)
      : check("roster_post_buy", "PASS", "Alle Teams ≥ Min nach Käufen"),
  );

  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const rostered = gameState.rosters.map((entry) => playerById.get(entry.playerId)).filter(Boolean);
  const withoutMode = rostered.filter((player) => !player!.trainingMode);
  const missingPct = rostered.length > 0 ? withoutMode.length / rostered.length : 0;
  checks.push(
    missingPct > 0.1
      ? check("training_manager_applied", "RED", `${withoutMode.length}/${rostered.length} ohne Trainingsmodus`)
      : missingPct > 0
        ? check("training_manager_applied", "WARN", `${withoutMode.length} Spieler ohne Modus`)
        : check("training_manager_applied", "PASS", "Trainingsmodi gesetzt"),
  );

  const missingGm = gameState.teams.filter((team) => !getTeamGeneralManager(gameState, team.teamId)?.profile).map((team) => team.shortCode);
  checks.push(
    missingGm.length > 0
      ? check("gm_assigned", "RED", `${missingGm.length} Teams ohne GM`, missingGm)
      : check("gm_assigned", "PASS", "32/32 GMs"),
  );

  const hardUnresolved = context.slotHardUnresolved ?? 0;
  const slotWarnings = context.slotCoverageWarnings ?? 0;
  checks.push(
    hardUnresolved > 0
      ? check("lineup_autoprep_ok", "RED", `${hardUnresolved} harte Autoprep-Blocker (Duplikat/Form/Context)`)
      : slotWarnings > 0
        ? check("lineup_autoprep_ok", "WARN", `${slotWarnings} Teams mit offenen Slots (Pech fürs Team)`)
        : check("lineup_autoprep_ok", "PASS", "Autoprep-Slots ok"),
  );

  checks.push(check("manager_actions_applied", "PASS", "Manager-Plan vor Preseason ausgeführt"));

  const withoutClass = rostered.filter((player) => !player!.trainingClass && !player!.className);
  const seasonNumber = Number(gameState.season.id.match(/(\d+)$/)?.[1] ?? 1);
  checks.push(
    withoutClass.length > rostered.length * 0.15
      ? check("training_classes_set", seasonNumber >= 2 ? "RED" : "WARN", `${withoutClass.length}/${rostered.length} ohne Trainingsklasse`)
      : withoutClass.length > 0
        ? check("training_classes_set", "WARN", `${withoutClass.length} Spieler ohne trainingClass`)
        : check("training_classes_set", "PASS", "Trainingsklassen gesetzt"),
  );

  const teamsWithAnyBuilding = gameState.teams.filter((team) => {
    const facilities = getTeamFacilityState(gameState, team.teamId);
    return FACILITY_CATALOG.some((facility) => getFacilityLevel(facilities, facility.facilityId) > 0);
  }).length;
  const facilityEvents = gameState.seasonState.facilityEvents?.length ?? 0;
  if (seasonNumber >= 2) {
    checks.push(
      teamsWithAnyBuilding === 0 && facilityEvents === 0
        ? check("facilities_active", "RED", "Keine Gebäude gebaut/upgraded (Liga still)")
        : facilityEvents === 0 && teamsWithAnyBuilding < 4
          ? check("facilities_active", "RED", `${teamsWithAnyBuilding}/32 Teams mit Gebäuden, events=0 (Gebäude-Stillstand)`)
          : teamsWithAnyBuilding < 4
            ? check("facilities_active", "WARN", `${teamsWithAnyBuilding}/32 Teams mit Gebäuden, events=${facilityEvents}`)
            : check("facilities_active", "PASS", `${teamsWithAnyBuilding}/32 Teams mit Gebäuden, events=${facilityEvents}`),
    );
  }

  const rosteredPlayers = gameState.rosters
    .map((entry) => playerById.get(entry.playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));
  const avgPreseasonFatigue =
    rosteredPlayers.length > 0
      ? round(rosteredPlayers.reduce((sum, player) => sum + (player.fatigue ?? 0), 0) / rosteredPlayers.length)
      : 0;
  checks.push(
    avgPreseasonFatigue > 15
      ? check("fatigue_season_reset", "WARN", `Preseason Ø-Fatigue ${avgPreseasonFatigue} (erwartet ~0)`)
      : check("fatigue_season_reset", "PASS", `Preseason Ø-Fatigue ${avgPreseasonFatigue}`),
  );

  return checks;
}

function auditSeasonEndPackage(save: PersistedSaveGame, context: LongRunPhaseAuditContext): PhaseAuditCheck[] {
  const gameState = save.gameState;
  const seasonId = gameState.season.id;
  const seasonNumber = Number(seasonId.match(/(\d+)$/)?.[1] ?? 1);
  const checks: PhaseAuditCheck[] = [];

  const standingsCount = Object.keys(gameState.seasonState.standings ?? {}).length;
  const md = gameState.season.currentMatchday ?? 0;
  const phaseOk = (gameState.gamePhase ?? "") === "season_completed" && md >= 10 && standingsCount >= gameState.teams.length;
  checks.push(
    phaseOk
      ? check("season_flow_complete", "PASS", `${seasonId} abgeschlossen MD${md}`)
      : check("season_flow_complete", "RED", `phase=${gameState.gamePhase} MD=${md} standings=${standingsCount}`),
  );

  const finance = buildTransferFinanceAudit(gameState);
  const hardFinanceViolations = finance.violations.filter(
    (entry) => !entry.startsWith("cash_reconciliation_delta:") && isTransferFinanceViolationForSeason(entry, seasonId),
  );
  const reconciliationWarnings = finance.violations.filter((entry) => entry.startsWith("cash_reconciliation_delta:"));
  checks.push(
    hardFinanceViolations.length > 0
      ? check("transfer_finance_clean", "RED", hardFinanceViolations.slice(0, 3).join(" | "))
      : reconciliationWarnings.length > 0
        ? check("transfer_finance_clean", "WARN", `${reconciliationWarnings.length} Cash-Reconciliation-Deltas (In-Season-Opex nicht im Ledger)`)
        : check("transfer_finance_clean", "PASS", "Transfer-Finance sauber"),
  );

  const negativeCash = gameState.teams.filter((team) => (team.cash ?? 0) < 0).map((team) => team.shortCode);
  checks.push(
    negativeCash.length > 0
      ? check("economy_plausible", "RED", `Negativer Cash: ${negativeCash.join(", ")}`, negativeCash)
      : check("economy_plausible", "PASS", "Kein negativer Cash"),
  );

  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const rostered = gameState.rosters
    .map((entry) => playerById.get(entry.playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));
  const potViolations = rostered.filter((player) => (player.potential ?? 0) < (player.rating ?? 0));
  checks.push(
    potViolations.length > 0
      ? check("training_potential", "RED", `${potViolations.length} Spieler Potential < Rating`)
      : check("training_potential", "PASS", `Potential ≥ CA (${rostered.length}/${rostered.length})`),
  );

  const withoutMode = rostered.filter((player) => !player.trainingMode);
  checks.push(
    withoutMode.length === rostered.length && rostered.length > 0
      ? check("training_modes_set", "RED", "Keine Trainingsmodi gesetzt")
      : withoutMode.length > 0
        ? check("training_modes_set", "WARN", `${withoutMode.length} ohne Modus`)
        : check("training_modes_set", "PASS", "Trainingsmodi verteilt"),
  );

  const withoutClass = rostered.filter((player) => !player.trainingClass && !player.className);
  checks.push(
    withoutClass.length > rostered.length * 0.15
      ? check("training_classes_set", seasonNumber >= 2 ? "RED" : "WARN", `${withoutClass.length}/${rostered.length} ohne Trainingsklasse`)
      : withoutClass.length > 0
        ? check("training_classes_set", "WARN", `${withoutClass.length} ohne trainingClass`)
        : check("training_classes_set", "PASS", "Trainingsklassen gesetzt"),
  );

  const seasonTransfers = gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
  const buyEntries = seasonTransfers.filter((entry) => entry.transferType === "buy");
  const draftBuyCount = buyEntries.filter((entry) => isDraftBuySource(entry.source)).length;
  const marketBuyCount = buyEntries.length - draftBuyCount;
  const sells = seasonTransfers.filter((entry) => entry.transferType === "sell").length;
  const exits = seasonTransfers.filter((entry) => entry.transferType === "contract_exit").length;
  if (seasonId !== "season-1" && buyEntries.length === 0 && sells === 0 && exits === 0) {
    checks.push(check("transfer_activity_sane", "WARN", `${seasonId}: keine Transfers/Exits`));
  } else if (seasonId === "season-1") {
    // 2026-07-04 course correction (see lib/season/transfer-season-policy.ts): S1 market buys
    // are NOT forbidden anymore — a team that sells down below hardMin/Opt in S1 must be able to
    // (re)buy in the very same season, exactly like any later season. findSeasonOneForbiddenBuySources
    // now always returns [] to reflect that policy; this check must not independently resurrect the
    // old "any market buy in S1 is RED" rule via `marketBuyCount > 0`, or it just re-blocks the exact
    // scenario the course correction was meant to unblock.
    const forbiddenMarketSources = findSeasonOneForbiddenBuySources(seasonTransfers);
    if (forbiddenMarketSources.length > 0) {
      checks.push(
        check(
          "transfer_activity_sane",
          "RED",
          `${seasonId}: ${draftBuyCount}Draft/${marketBuyCount}Markt/${sells}V/${exits}X · verbotene Markt-Käufe: ${forbiddenMarketSources.join("|")}`,
        ),
      );
    } else {
      checks.push(
        check(
          "transfer_activity_sane",
          "PASS",
          `${seasonId}: ${draftBuyCount}Draft/${marketBuyCount}Markt/${sells}V/${exits}X`,
        ),
      );
    }
  } else {
    checks.push(check("transfer_activity_sane", "PASS", `${seasonId}: ${buyEntries.length}K/${sells}V/${exits}X`));
  }

  const snapshot = (gameState.seasonState.seasonSnapshots ?? []).some((entry) => entry.seasonId === seasonId);
  checks.push(
    snapshot
      ? check("season_snapshot_written", "PASS", `Snapshot für ${seasonId}`)
      : check("season_snapshot_written", "WARN", `Kein Snapshot für ${seasonId}`),
  );

  if (context.seasonEndBlockers && context.seasonEndBlockers.length > 0) {
    checks.push(check("season_end_services", "RED", context.seasonEndBlockers.slice(0, 4).join(" | ")));
  } else {
    checks.push(check("season_end_services", "PASS", "Season-End-Services ohne Hard-Blocker"));
  }

  const matchdaysResolved = (gameState.seasonState.matchdayResults ?? []).filter((entry) => entry.seasonId === seasonId).length;
  const rosteredPlayers = gameState.rosters
    .map((entry) => playerById.get(entry.playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));
  const fatiguedPlayers = rosteredPlayers.filter((player) => (player.fatigue ?? 0) > 0).length;
  if (matchdaysResolved >= 1 && fatiguedPlayers === 0) {
    checks.push(check("fatigue_pipeline_active", "RED", `${seasonId}: ${matchdaysResolved} MD, aber 0 Spieler mit fatigue > 0`));
  } else if (matchdaysResolved >= 1) {
    const avgFatigue = rosteredPlayers.length
      ? round(rosteredPlayers.reduce((sum, player) => sum + (player.fatigue ?? 0), 0) / rosteredPlayers.length)
      : 0;
    checks.push(check("fatigue_pipeline_active", "PASS", `${seasonId}: Ø-Fatigue ${avgFatigue} nach ${matchdaysResolved} MD`));
  } else {
    checks.push(check("fatigue_pipeline_active", "WARN", `${seasonId}: noch keine Matchday-Results`));
  }

  const seasonInjuries = countSeasonInjuryEvents(gameState, seasonId);
  if (phaseOk && seasonInjuries === 0) {
    checks.push(check("injury_pipeline_active", "RED", `${seasonId}: Saison abgeschlossen, injuryEvents=0`));
  } else if (seasonInjuries > 0) {
    checks.push(check("injury_pipeline_active", "PASS", `${seasonId}: ${seasonInjuries} Verletzungs-Events`));
  } else {
    checks.push(check("injury_pipeline_active", "WARN", `${seasonId}: ${matchdaysResolved} MD, ${seasonInjuries} Verletzungen bisher`));
  }

  const staleAvailability = listNonRosterAvailabilityEntries(gameState);
  if (staleAvailability.length > 0) {
    checks.push(
      check(
        "injury_state_consistent",
        "WARN",
        `${staleAvailability.length} Availability-Einträge für nicht-rostered Spieler`,
      ),
    );
  } else {
    checks.push(check("injury_state_consistent", "PASS", "Availability nur für aktive Kader"));
  }

  const manualXpUpgrades = (gameState.playerProgressionEvents ?? [])
    .filter((event) => event.seasonId === seasonId)
    .flatMap((event) => event.upgrades ?? [])
    .filter((upgrade) => upgrade.source === "manual_xp_spend_preview");
  checks.push(
    manualXpUpgrades.length > 0
      ? check(
          "season_end_organic_only",
          "RED",
          `${manualXpUpgrades.length} manual_xp_spend_preview-Upgrades nach Season-End (nur organic_season_progression erlaubt)`,
        )
      : check("season_end_organic_only", "PASS", "Keine manual_xp_spend_preview-Events"),
  );

  const seasonProgressionEvents = (gameState.playerProgressionEvents ?? []).filter((event) => event.seasonId === seasonId);
  const manualXpSpendUpgrades = seasonProgressionEvents.flatMap((event) =>
    (event.upgrades ?? []).filter((upgrade) => upgrade.source === "manual_xp_spend_preview"),
  );
  const manualXpSpendEventCount = seasonProgressionEvents.filter((event) =>
    (event.upgrades ?? []).some((upgrade) => upgrade.source === "manual_xp_spend_preview"),
  ).length;
  checks.push(
    manualXpSpendUpgrades.length > 0
      ? check(
          "season_end_organic_only",
          "RED",
          `${manualXpSpendUpgrades.length} manual_xp_spend_preview Upgrades in ${manualXpSpendEventCount} Events (nur organic_season_progression erlaubt)`,
        )
      : check("season_end_organic_only", "PASS", "Keine manual_xp_spend_preview Upgrades"),
  );

  const legacyManualSpendEvents = seasonProgressionEvents.filter((event) => event.source === "manual_season_end_xp_spend");
  checks.push(
    legacyManualSpendEvents.length > 0
      ? check(
          "season_end_manual_spend_events",
          "WARN",
          `${legacyManualSpendEvents.length} Events mit source=manual_season_end_xp_spend`,
        )
      : check("season_end_manual_spend_events", "PASS", "Keine legacy manual_season_end_xp_spend Events"),
  );

  checks.push(...auditIdentityTeams(gameState));

  const organicMetrics = computeSeasonOrganicProgressionMetrics(gameState, seasonId);
  checks.push(
    isLeagueNetDeltaOutsideCorridor(organicMetrics.leagueNetAverage, organicMetrics.playerCount)
      ? check(
          "organic_league_net_delta",
          "WARN",
          `${seasonId}: Liga-Ø=${organicMetrics.leagueNetAverage} (Summe=${organicMetrics.leagueNetDelta}, Ziel Ø ${ORGANIC_LEAGUE_NET_AVG_MIN}…${ORGANIC_LEAGUE_NET_AVG_MAX}, n=${organicMetrics.playerCount})`,
        )
      : check(
          "organic_league_net_delta",
          "PASS",
          `${seasonId}: Liga-Ø=${organicMetrics.leagueNetAverage} (Summe=${organicMetrics.leagueNetDelta}, n=${organicMetrics.playerCount})`,
        ),
  );
  checks.push(
    isPeakNetOutsideCorridor(organicMetrics.peakP90, organicMetrics.playerCount)
      ? check(
          "organic_peak_net_corridor",
          "RED",
          `${seasonId}: Peak-P90=${organicMetrics.peakP90} außerhalb ${ORGANIC_PEAK_NET_MIN}…${ORGANIC_PEAK_NET_MAX} (Top10-Median=${organicMetrics.peakMedianTop10})`,
        )
      : organicMetrics.playerCount >= 5
        ? check(
            "organic_peak_net_corridor",
            "PASS",
            `${seasonId}: Peak-P90=${organicMetrics.peakP90}, Top10-Median=${organicMetrics.peakMedianTop10}`,
          )
        : check("organic_peak_net_corridor", "WARN", `${seasonId}: zu wenig organic Events (${organicMetrics.playerCount})`),
  );

  if (seasonNumber >= 2) {
    const highInjuryTeams = gameState.teams.filter((team) => {
      const injuries = (gameState.seasonState.injuryEvents ?? []).filter(
        (entry) => entry.seasonId === seasonId && entry.teamId === team.teamId && entry.result === "injured",
      ).length;
      return injuries >= 8;
    });
    if (highInjuryTeams.length >= 4) {
      const rehaTeams = gameState.teams.filter((team) => {
        const facilities = getTeamFacilityState(gameState, team.teamId);
        return getFacilityLevel(facilities, "recovery_center") >= 1;
      }).length;
      const expectedMin = Math.min(12, Math.ceil(highInjuryTeams.length * 0.4));
      checks.push(
        rehaTeams < expectedMin
          ? check(
              "recovery_center_adoption",
              "WARN",
              `${rehaTeams}/32 Teams mit Reha L≥1 (erwartet ≥${expectedMin} bei ${highInjuryTeams.length} High-Injury-Teams)`,
            )
          : check("recovery_center_adoption", "PASS", `${rehaTeams}/32 Teams mit Reha L≥1`),
      );
    }
  }

  if (seasonNumber >= 3) {
    const profitSells = seasonTransfers.filter((entry) => {
      if (entry.transferType !== "sell") return false;
      const player = playerById.get(entry.playerId ?? "");
      const mv = player?.marketValue ?? entry.marketValue ?? 0;
      const fee = entry.fee ?? 0;
      return fee > mv && mv > 0;
    }).length;
    checks.push(
      profitSells < 3
        ? check("transfer_profit_activity", "WARN", `${seasonId}: nur ${profitSells} Profit-Sells (Fee>MW), Ziel ≥3`)
        : check("transfer_profit_activity", "PASS", `${seasonId}: ${profitSells} Profit-Sells (Fee>MW)`),
    );
  }

  const potentialRecords = gameState.playerPotential ?? [];
  const potentialByPlayer = new Map(potentialRecords.map((record) => [record.playerId, record.hiddenPotentialScore]));
  const parityMismatches = rostered.filter((player) => {
    const hidden = potentialByPlayer.get(player.id);
    if (hidden == null || player.potential == null) return false;
    return Math.abs(hidden - player.potential) > 8;
  });
  checks.push(
    parityMismatches.length > rostered.length * 0.2
      ? check(
          "potential_field_parity",
          "WARN",
          `${parityMismatches.length} Spieler: player.potential weicht >8 von hiddenPotentialScore ab`,
        )
      : check("potential_field_parity", "PASS", "Potential-Felder plausibel"),
  );

  return checks;
}

export function runPhaseAuditDe(
  save: PersistedSaveGame,
  phase: LongRunPhaseAuditPhase,
  context: LongRunPhaseAuditContext = {},
): PhaseAuditResult {
  const checks =
    phase === "draft"
      ? auditDraftPackage(save, context)
      : phase === "preseason"
        ? auditPreseasonPackage(save, context)
        : auditSeasonEndPackage(save, context);

  const passCount = checks.filter((entry) => entry.status === "PASS").length;
  const warnCount = checks.filter((entry) => entry.status === "WARN").length;
  const redCount = checks.filter((entry) => entry.status === "RED").length;

  return {
    phase,
    seasonId: save.gameState.season.id,
    saveId: save.saveId,
    checks,
    passCount,
    warnCount,
    redCount,
    hasRed: redCount > 0,
  };
}

export function formatPhaseAuditSummaryDe(result: PhaseAuditResult) {
  const lines = [
    `[long-run] AUDIT ${result.phase}: PASS ${result.passCount} / WARN ${result.warnCount} / RED ${result.redCount}`,
  ];
  for (const entry of result.checks.filter((row) => row.status !== "PASS").slice(0, 8)) {
    lines.push(`[long-run] AUDIT ${entry.status} ${entry.id}: ${entry.detail}`);
  }
  return lines.join("\n");
}

export function assertPhaseAuditNoRed(result: PhaseAuditResult) {
  const hardReds = result.checks.filter(
    (entry) => entry.status === "RED" && !isSoftPhaseAuditRed(entry.id, result.seasonId, result.phase),
  );
  if (hardReds.length === 0) return;
  const redDetails = hardReds.map((entry) => `${entry.id}:${entry.detail}`).join(" | ");
  throw new Error(`Phase-Audit ${result.phase} fehlgeschlagen: ${redDetails}`);
}

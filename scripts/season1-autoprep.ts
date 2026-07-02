import fs from "node:fs";
import path from "node:path";

import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import type { GameState, LineupDraft, LineupDraftModifiers, Player } from "@/lib/data/olyDataTypes";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { getTeamPlayerMax } from "@/lib/foundation/roster-limits";
import { getTeamFacilityState, applyTrainingXpFacilityModifiers } from "@/lib/facilities/facility-effects";
import {
  buildGeneratedFormCardRecordsForSeason,
  getFormCardColorForDisciplineCategory,
  getLegacyMutatorTraitOptions,
  normalizeLineupDraftModifiers,
} from "@/lib/lineups/legacy-lineup-modifiers";
import {
  loadLocalLegacyLineupContextFromGameState,
} from "@/lib/lineups/legacy-lineup-local-service";
import type {
  DisciplineSide,
  LegacyFormCardOption,
  LegacyLineupEntryInput,
  LegacyLineupKeyParams,
  LegacyLineupLoadedContext,
  LegacyRosterPlayerRef,
} from "@/lib/lineups/legacy-lineup-types";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import { createLineupDraftId } from "@/lib/lineups/lineup-discipline-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

type PreflightReport = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  saveId: string;
  saveName: string;
  seasonId: string;
  seasonName: string;
  teamCount: number;
  rosterCount: number;
  transferHistoryCount: number;
  duplicateRosterPlayers: Array<{ playerId: string; count: number }>;
  teamsUnderSeven: Array<{ teamId: string; roster: number }>;
  teamsOverMax: Array<{ teamId: string; roster: number; playerMax: number }>;
  negativeCashTeams: Array<{ teamId: string; cash: number }>;
  aiPurchaseCount: number;
};

type TrainingAuditRow = {
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  controlMode: string;
  mode: PlayerTrainingMode;
  expectedXp: number;
  facilityXp: number;
  facilityModifierPct: number;
  riskLabel: string;
  riskWarning: string;
  reason: string;
};

type LineupAuditRow = {
  matchdayId: string;
  matchdayLabel: string;
  teamId: string;
  teamName: string;
  controlMode: string;
  source: string;
  status: "saved" | "blocked";
  entries: number;
  required: number;
  captains: number;
  d1: string;
  d2: string;
  selectedFormCards: number;
  mutatorStatus: string;
  warnings: string;
  blockers: string;
};

type FormCardAuditRow = {
  teamId: string;
  teamName: string;
  cards: number;
  red: number;
  green: number;
  blue: number;
  yellow: number;
  x2Potential: number;
  invalidColors: number;
  staleCards: number;
};

const OUTPUT_DIR =
  process.env.OLY_AUTOPREP_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";
const WRITE_ENABLED = process.argv.includes("--write");
const TARGET_SAVE_ID = process.env.OLY_TARGET_SAVE_ID ?? null;
const TARGET_SEASON_ID = process.env.OLY_TARGET_SEASON_ID ?? "season-1";
const EXPORT_PREFIX = process.env.OLY_EXPORT_PREFIX ?? "season1";

function exportName(suffix: string) {
  return `${EXPORT_PREFIX}-${suffix}`;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  const filePath = path.join(OUTPUT_DIR, fileName);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
  fs.writeFileSync(filePath, `${body}\n`, "utf8");
  return filePath;
}

function writeJson(fileName: string, payload: unknown) {
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

function writeMarkdown(fileName: string, markdown: string) {
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, markdown, "utf8");
  return filePath;
}

function buildPreflight(save: ReturnType<ReturnType<typeof createPersistenceService>["getActiveSave"]> extends infer T ? NonNullable<T> : never): PreflightReport {
  const gameState = save.gameState;
  const rosterCounts = new Map<string, number>();
  const playerRosterCounts = new Map<string, number>();
  for (const roster of gameState.rosters) {
    rosterCounts.set(roster.teamId, (rosterCounts.get(roster.teamId) ?? 0) + 1);
    playerRosterCounts.set(roster.playerId, (playerRosterCounts.get(roster.playerId) ?? 0) + 1);
  }

  const report: PreflightReport = {
    ok: true,
    blockers: [],
    warnings: [],
    saveId: save.saveId,
    saveName: save.name,
    seasonId: gameState.season.id,
    seasonName: gameState.season.name,
    teamCount: gameState.teams.length,
    rosterCount: gameState.rosters.length,
    transferHistoryCount: gameState.transferHistory.length,
    duplicateRosterPlayers: [...playerRosterCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([playerId, count]) => ({ playerId, count })),
    teamsUnderSeven: gameState.teams
      .map((team) => ({ teamId: team.teamId, roster: rosterCounts.get(team.teamId) ?? 0 }))
      .filter((entry) => entry.roster < 7),
    teamsOverMax: gameState.teams
      .map((team) => {
        const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
        return { teamId: team.teamId, roster: rosterCounts.get(team.teamId) ?? 0, playerMax: getTeamPlayerMax(team, identity) };
      })
      .filter((entry) => entry.roster > entry.playerMax),
    negativeCashTeams: gameState.teams
      .map((team) => ({ teamId: team.teamId, cash: team.cash }))
      .filter((entry) => entry.cash < 0),
    aiPurchaseCount: gameState.transferHistory.filter((entry) => entry.source === "ai_roster_fill" || entry.source === "ai_picks_run").length,
  };

  if (gameState.season.id !== TARGET_SEASON_ID) report.blockers.push(`active_season_not_${TARGET_SEASON_ID}:${gameState.season.id}`);
  if (gameState.teams.length !== 32) report.blockers.push(`team_count_not_32:${gameState.teams.length}`);
  if (report.duplicateRosterPlayers.length > 0) report.blockers.push("duplicate_roster_players");
  if (report.teamsUnderSeven.length > 0) report.blockers.push("teams_under_7");
  if (report.teamsOverMax.length > 0) report.blockers.push("teams_over_playerMax");
  if (report.negativeCashTeams.length > 0) report.blockers.push("negative_cash");
  if (report.aiPurchaseCount === 0) report.warnings.push("ai_purchases_not_detected_in_transfer_history_source");
  report.ok = report.blockers.length === 0;
  return report;
}

function decideTrainingMode(input: {
  player: Player;
  rosterRole?: string | null;
  usageRank: number;
  teamRosterSize: number;
}): { mode: PlayerTrainingMode; reason: string } {
  const positiveTraits = new Set((input.player.traitsPositive ?? []).map((trait) => trait.toLowerCase()));
  const negativeTraits = new Set((input.player.traitsNegative ?? []).map((trait) => trait.toLowerCase()));
  const fragile = positiveTraits.has("healthy") ? false : negativeTraits.has("fainthearted") || negativeTraits.has("timid");
  const diligent = positiveTraits.has("diligent") || positiveTraits.has("motivated");
  const lazy = negativeTraits.has("lazy");
  const topUsage = input.usageRank <= Math.max(4, Math.ceil(input.teamRosterSize * 0.45));
  const bench = /bench|depth|reserve/i.test(input.rosterRole ?? "") || input.usageRank > Math.ceil(input.teamRosterSize * 0.72);

  if (fragile || lazy) return { mode: "leicht", reason: fragile ? "fragile_or_fatigue_risk" : "lazy_trait_risk" };
  if (bench && diligent) return { mode: "hart", reason: "bench_development_with_diligent_signal" };
  if (bench) return { mode: "hart", reason: "bench_development" };
  if (topUsage) return { mode: "mittel", reason: "expected_starter_usage" };
  return { mode: diligent ? "hart" : "mittel", reason: diligent ? "development_trait_signal" : "balanced_default" };
}

function applyTrainingModes(gameState: GameState): { gameState: GameState; rows: TrainingAuditRow[] } {
  const startedAt = Date.now();
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const rows: TrainingAuditRow[] = [];
  const modeByPlayerId = new Map<string, PlayerTrainingMode>();

  for (const team of gameState.teams) {
    const control = getTeamControlSettings(gameState, team.teamId) ?? { controlMode: "manual" as const };
    const roster = gameState.rosters
      .filter((entry) => entry.teamId === team.teamId)
      .map((entry) => ({ entry, player: playerById.get(entry.playerId) }))
      .filter((entry): entry is { entry: GameState["rosters"][number]; player: Player } => Boolean(entry.player))
      .sort((left, right) => (right.player.ovr ?? right.player.rating ?? 0) - (left.player.ovr ?? left.player.rating ?? 0));

    const facilities = getTeamFacilityState(gameState, team.teamId);
    roster.forEach(({ entry, player }, index) => {
      const decision =
        control.controlMode === "manual"
          ? { mode: player.trainingMode ?? "mittel", reason: "manual_team_preview_only_not_overwritten" }
          : decideTrainingMode({ player, rosterRole: entry.roleTag, usageRank: index + 1, teamRosterSize: roster.length });
      if (control.controlMode !== "manual") {
        modeByPlayerId.set(player.id, decision.mode);
      }
      const forecast = buildPlayerProgressionForecast({
        gameState,
        player,
        playerRating: null,
        seasonPerformance: null,
        trainingModeByPlayerId: { [player.id]: decision.mode },
      });
      const facilityXp = applyTrainingXpFacilityModifiers(forecast.baseTrainingXP, facilities);
      rows.push({
        teamId: team.teamId,
        teamName: team.name,
        playerId: player.id,
        playerName: player.name,
        controlMode: control.controlMode,
        mode: decision.mode,
        expectedXp: forecast.seasonProjectedXP,
        facilityXp: facilityXp.after,
        facilityModifierPct: facilityXp.modifierPct,
        riskLabel: forecast.fatigueStrain.label,
        riskWarning: forecast.fatigueStrain.warning,
        reason: decision.reason,
      });
    });
  }

  console.error(`[autoprep] training modes done players=${rows.length} elapsed=${Date.now() - startedAt}ms`);
  return {
    gameState: {
      ...gameState,
      players: gameState.players.map((player) =>
        modeByPlayerId.has(player.id)
          ? {
              ...player,
              trainingMode: modeByPlayerId.get(player.id) ?? player.trainingMode,
            }
          : player,
      ),
    },
    rows,
  };
}

function selectBestTrait(entries: LegacyLineupEntryInput[], rosterPlayers: LegacyRosterPlayerRef[], usedTraits: Set<string>) {
  const optionValues = new Set(getLegacyMutatorTraitOptions().map((option) => option.value));
  const selectedPlayerIds = new Set(entries.map((entry) => entry.playerId));
  const counts = new Map<string, number>();
  for (const player of rosterPlayers) {
    if (!selectedPlayerIds.has(player.id)) continue;
    for (const trait of [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])]) {
      if (!optionValues.has(trait) || usedTraits.has(trait)) continue;
      counts.set(trait, (counts.get(trait) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}

function selectFormCards(input: {
  cards: LegacyFormCardOption[];
  disciplineColor: string | null;
  used: Set<string>;
}) {
  const available = input.cards
    .filter((card) => !input.used.has(card.id) && !card.isUsed && card.value > 0)
    .map((card) => ({
      card,
      effectiveValue: card.value * (input.disciplineColor && card.color === input.disciplineColor ? 2 : 1),
    }))
    .sort((left, right) => right.effectiveValue - left.effectiveValue || right.card.value - left.card.value || left.card.playerName.localeCompare(right.card.playerName));
  const selected = available.slice(0, 2).map((entry) => entry.card.id);
  selected.forEach((id) => input.used.add(id));
  return selected;
}

function buildModifiers(input: {
  context: LegacyLineupLoadedContext;
  entries: LegacyLineupEntryInput[];
}): LineupDraftModifiers {
  const modifiers = normalizeLineupDraftModifiers();
  const usedCardIds = new Set<string>();
  const usedTraits = new Set<string>();

  for (const side of ["d1", "d2"] as DisciplineSide[]) {
    const discipline = side === "d1" ? input.context.matchdayContract?.discipline1 : input.context.matchdayContract?.discipline2;
    const sideEntries = input.entries.filter((entry) => entry.disciplineSide === side);
    const color = getFormCardColorForDisciplineCategory(discipline?.category ?? null);
    const selectedCards = selectFormCards({
      cards: input.context.formCards ?? [],
      disciplineColor: color,
      used: usedCardIds,
    });
    modifiers[side].primaryFormCardId = selectedCards[0] ?? null;
    modifiers[side].secondaryFormCardId = selectedCards[1] ?? null;
    const trait1 = selectBestTrait(sideEntries, input.context.rosterPlayers, usedTraits);
    if (trait1) usedTraits.add(trait1);
    const trait2 = selectBestTrait(sideEntries, input.context.rosterPlayers, usedTraits);
    if (trait2) usedTraits.add(trait2);
    modifiers[side].mutatorTrait1 = trait1;
    modifiers[side].mutatorTrait2 = trait2;
  }

  return modifiers;
}

function upsertDraft(gameState: GameState, input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  entries: LegacyLineupEntryInput[];
  modifiers: LineupDraftModifiers;
  source: string;
}) {
  const now = new Date().toISOString();
  const lineupId = createLineupDraftId(input);
  const existingDrafts = gameState.seasonState.lineupDrafts ?? [];
  const existing = existingDrafts.find((draft) => draft.lineupId === lineupId);
  const nextDraft = {
    lineupId,
    saveId: input.saveId,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    teamId: input.teamId,
    status: "draft",
    entries: input.entries,
    modifiers: input.modifiers,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    source: input.source,
  } satisfies LineupDraft & { source: string };

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      lineupDrafts: [...existingDrafts.filter((draft) => draft.lineupId !== lineupId), nextDraft],
    },
  };
}

function prepLineups(gameState: GameState, saveId: string): { gameState: GameState; rows: LineupAuditRow[] } {
  const startedAt = Date.now();
  let nextGameState: GameState = {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      lineupDrafts: (gameState.seasonState.lineupDrafts ?? []).filter((draft) => draft.seasonId !== gameState.season.id),
    },
  };
  const rows: LineupAuditRow[] = [];

  for (const [matchdayIndex, matchdayId] of gameState.season.matchdayIds.entries()) {
    const matchdayStartedAt = Date.now();
    for (const [teamIndex, team] of gameState.teams.entries()) {
      const params: LegacyLineupKeyParams = {
        saveId,
        seasonId: gameState.season.id,
        matchdayId,
        teamId: team.teamId,
      };
      const control = getTeamControlSettings(nextGameState, team.teamId) ?? { controlMode: "manual" as const };
      const contextResult = loadLocalLegacyLineupContextFromGameState(nextGameState, params);
      if (!contextResult.ok) {
        rows.push({
          matchdayId,
          matchdayLabel: matchdayId,
          teamId: team.teamId,
          teamName: team.name,
          controlMode: control.controlMode,
          source: "not_saved",
          status: "blocked",
          entries: 0,
          required: 0,
          captains: 0,
          d1: "—",
          d2: "—",
          selectedFormCards: 0,
          mutatorStatus: "missing_context",
          warnings: contextResult.warnings.join(" | "),
          blockers: contextResult.errors.join(" | "),
        });
        continue;
      }

      const preview = buildAiLegacyLineupPreview(contextResult.context, "sqlite");
      const modifiers = buildModifiers({ context: contextResult.context, entries: preview.entries });
      const activePlayersCount = contextResult.context.activePlayers.length;
      const allowPartialLineup = activePlayersCount >= 7 && activePlayersCount < (
        (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
        (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0)
      );
      const validation = validateLegacyLineupContext(
        {
          ...contextResult.context,
          entries: preview.entries,
        },
        {
          enforceCompleteness: !allowPartialLineup,
          seasonCaptainLimit: contextResult.context.matchdayContract?.seasonCaptainSlots ?? 3,
          captainUsedBeforeCurrentDraft: contextResult.context.teamStatus?.captainUsedCount ?? 0,
          captainUsedBeforeCurrentDraftSides: contextResult.context.teamStatus?.captainUsedSides ?? [],
        },
      );
      const d1 = contextResult.context.matchdayContract?.discipline1;
      const d2 = contextResult.context.matchdayContract?.discipline2;
      const required = (d1?.requiredPlayers ?? 0) + (d2?.requiredPlayers ?? 0);
      const minimumDeployableEntries = Math.min(activePlayersCount, required);
      const missingDeployableEntries = Math.max(0, minimumDeployableEntries - preview.entries.length);
      const warnings = Array.from(new Set([
        ...(preview.warnings ?? []),
        ...validation.warnings,
        ...(allowPartialLineup ? [`partial_lineup_allowed:${preview.entries.length}/${required}:active=${activePlayersCount}`] : []),
      ]));
      const blockers =
        validation.isValid && preview.status !== "blocked" && missingDeployableEntries === 0
          ? []
          : [
              ...validation.errors,
              ...(preview.status === "blocked" ? preview.warnings : []),
              ...(missingDeployableEntries > 0
                ? [`lineup_resting_available_players:${preview.entries.length}/${minimumDeployableEntries}`]
                : []),
            ];
      const source = control.controlMode === "manual" ? "test_auto_lineup_for_simulation" : "ai_auto_lineup_for_simulation";

      if (blockers.length === 0) {
        nextGameState = upsertDraft(nextGameState, {
          ...params,
          entries: preview.entries,
          modifiers,
          source,
        });
      }

      rows.push({
        matchdayId,
        matchdayLabel: contextResult.context.matchday.label,
        teamId: team.teamId,
        teamName: team.name,
        controlMode: control.controlMode,
        source,
        status: blockers.length === 0 ? "saved" : "blocked",
        entries: preview.entries.length,
        required,
        captains: preview.entries.filter((entry) => entry.isCaptain).length,
        d1: d1?.displayName ?? "—",
        d2: d2?.displayName ?? "—",
        selectedFormCards: [
          modifiers.d1.primaryFormCardId,
          modifiers.d1.secondaryFormCardId,
          modifiers.d2.primaryFormCardId,
          modifiers.d2.secondaryFormCardId,
        ].filter(Boolean).length,
        mutatorStatus: [modifiers.d1.mutatorTrait1, modifiers.d1.mutatorTrait2, modifiers.d2.mutatorTrait1, modifiers.d2.mutatorTrait2].some(Boolean)
          ? "legacy_selected_traits"
          : "source_ready_no_matching_traits",
        warnings: warnings.join(" | "),
        blockers: blockers.join(" | "),
      });
      if ((teamIndex + 1) % 8 === 0) {
        console.error(`[autoprep] lineups ${matchdayId}: ${teamIndex + 1}/${gameState.teams.length} elapsed=${Date.now() - matchdayStartedAt}ms`);
      }
    }
    console.error(`[autoprep] matchday ${matchdayIndex + 1}/${gameState.season.matchdayIds.length} ${matchdayId} done elapsed=${Date.now() - matchdayStartedAt}ms total=${Date.now() - startedAt}ms`);
  }

  console.error(`[autoprep] lineups done rows=${rows.length} elapsed=${Date.now() - startedAt}ms`);
  return { gameState: nextGameState, rows };
}

function buildFormCardAudit(gameState: GameState): FormCardAuditRow[] {
  const validColors = new Set(["red", "green", "blue", "yellow"]);
  return gameState.teams.map((team) => {
    const cards = (gameState.seasonState.formCards ?? []).filter((card) => card.teamId === team.teamId);
    const x2Potential = cards.filter((card) => {
      const player = gameState.players.find((entry) => entry.id === card.playerId);
      if (!player) return false;
      return gameState.disciplines.some((discipline) => getFormCardColorForDisciplineCategory(discipline.category) === card.cardColor);
    }).length;
    return {
      teamId: team.teamId,
      teamName: team.name,
      cards: cards.length,
      red: cards.filter((card) => card.cardColor === "red").length,
      green: cards.filter((card) => card.cardColor === "green").length,
      blue: cards.filter((card) => card.cardColor === "blue").length,
      yellow: cards.filter((card) => card.cardColor === "yellow").length,
      x2Potential,
      invalidColors: cards.filter((card) => !validColors.has(card.cardColor)).length,
      staleCards: cards.filter((card) => card.seasonId !== gameState.season.id).length,
    };
  });
}

function summarizeTraining(rows: TrainingAuditRow[]) {
  return Object.values(
    rows.reduce<Record<string, {
      teamId: string;
      teamName: string;
      leicht: number;
      mittel: number;
      hart: number;
      expectedXp: number;
      facilityXp: number;
      highRisk: number;
      warnings: string[];
    }>>((acc, row) => {
      acc[row.teamId] ??= {
        teamId: row.teamId,
        teamName: row.teamName,
        leicht: 0,
        mittel: 0,
        hart: 0,
        expectedXp: 0,
        facilityXp: 0,
        highRisk: 0,
        warnings: [],
      };
      acc[row.teamId][row.mode] += 1;
      acc[row.teamId].expectedXp += row.expectedXp;
      acc[row.teamId].facilityXp += row.facilityXp;
      if (row.riskLabel === "hoch") {
        acc[row.teamId].highRisk += 1;
        acc[row.teamId].warnings.push(`${row.playerName}:${row.riskWarning}`);
      }
      return acc;
    }, {}),
  ).map((entry) => ({
    ...entry,
    expectedXp: round(entry.expectedXp, 0),
    facilityXp: round(entry.facilityXp, 0),
    warnings: entry.warnings.join(" | "),
  }));
}

function buildReadiness(gameState: GameState, preflight: PreflightReport, trainingRows: TrainingAuditRow[], lineupRows: LineupAuditRow[], formRows: FormCardAuditRow[]) {
  const byMatchday = gameState.season.matchdayIds.map((matchdayId) => {
    const rows = lineupRows.filter((row) => row.matchdayId === matchdayId);
    return {
      matchdayId,
      validLineups: rows.filter((row) => row.status === "saved").length,
      totalTeams: gameState.teams.length,
      missingLineups: gameState.teams.length - rows.filter((row) => row.status === "saved").length,
      invalidSlots: rows.filter((row) => row.status === "blocked" || row.entries !== row.required).length,
      blockedTeams: rows.filter((row) => row.status === "blocked").map((row) => row.teamId),
    };
  });
  const captainCountByTeam = Object.fromEntries(
    gameState.teams.map((team) => [
      team.teamId,
      (gameState.seasonState.lineupDrafts ?? [])
        .filter((draft) => draft.seasonId === gameState.season.id && draft.teamId === team.teamId)
        .reduce((sum, draft) => sum + draft.entries.filter((entry) => entry.isCaptain).length, 0),
    ]),
  );
  const allBlockers = [
    ...preflight.blockers,
    ...lineupRows.filter((row) => row.status === "blocked").map((row) => `lineup_blocked:${row.matchdayId}:${row.teamId}:${row.blockers}`),
    ...formRows.filter((row) => row.invalidColors > 0 || row.staleCards > 0).map((row) => `formcard_invalid:${row.teamId}`),
  ];

  return {
    ok: allBlockers.length === 0 && byMatchday.every((row) => row.validLineups === 32),
    preflight,
    byMatchday,
    captainCountByTeam,
    formCards: {
      total: formRows.reduce((sum, row) => sum + row.cards, 0),
      invalidColors: formRows.reduce((sum, row) => sum + row.invalidColors, 0),
      staleCards: formRows.reduce((sum, row) => sum + row.staleCards, 0),
    },
    training: summarizeTraining(trainingRows),
    mutators: {
      source: "legacy_selected_traits",
      seed: "deterministic:selected_lineup_traits_by_team_matchday_side",
      missingSourceCount: lineupRows.filter((row) => row.mutatorStatus.includes("missing")).length,
    },
    blockers: allBlockers,
  };
}

function buildMarkdown(readiness: ReturnType<typeof buildReadiness>, files: Record<string, string>) {
  const matchdayLines = readiness.byMatchday
    .map((row) => `| ${row.matchdayId} | ${row.validLineups}/${row.totalTeams} | ${row.missingLineups} | ${row.invalidSlots} | ${row.blockedTeams.join(" ") || "—"} |`)
    .join("\n");
  const trainingLines = readiness.training
    .map((row) => `| ${row.teamId} | ${row.leicht} | ${row.mittel} | ${row.hart} | ${row.expectedXp} | ${row.facilityXp} | ${row.highRisk} |`)
    .join("\n");

  return `# ${readiness.preflight.seasonName} Auto-Prep Readiness

Status: **${readiness.ok ? "READY" : "BLOCKED"}**

## Save
- Save: ${readiness.preflight.saveName} (${readiness.preflight.saveId})
- Season: ${readiness.preflight.seasonName} (${readiness.preflight.seasonId})
- Teams: ${readiness.preflight.teamCount}
- Rosters: ${readiness.preflight.rosterCount}
- Transferhistorie: ${readiness.preflight.transferHistoryCount}
- AI-Kaeufe sichtbar: ${readiness.preflight.aiPurchaseCount}

## Preflight
- Duplikate: ${readiness.preflight.duplicateRosterPlayers.length}
- Teams unter 7: ${readiness.preflight.teamsUnderSeven.length}
- Teams ueber Max: ${readiness.preflight.teamsOverMax.length}
- Negatives Cash: ${readiness.preflight.negativeCashTeams.length}
- Blocker: ${readiness.blockers.length > 0 ? readiness.blockers.join(" | ") : "keine"}

## Matchday Lineups
| Spieltag | valide Lineups | missing_lineups | invalid slots | blocked Teams |
| --- | ---: | ---: | ---: | --- |
${matchdayLines}

## Training Summary
| Team | leicht | mittel | hart | erwartete XP | Facility-XP | High Risk |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${trainingLines}

## Formkarten
- Gesamt: ${readiness.formCards.total}
- Invalid Colors: ${readiness.formCards.invalidColors}
- Stale Cards: ${readiness.formCards.staleCards}
- x2-Logik: echte Diszi-Kategorien -> POW rot, SPE gruen, MEN blau, SOC gelb.

## Mutatoren
- Quelle: ${readiness.mutators.source}
- Seed/Determinismus: ${readiness.mutators.seed}
- Missing Source Count: ${readiness.mutators.missingSourceCount}

## Exporte
- JSON: ${files.json}
- Lineup CSV: ${files.lineupCsv}
- Formkarten CSV: ${files.formCsv}
- Training CSV: ${files.trainingCsv}
`;
}

function main() {
  const startedAt = Date.now();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = (TARGET_SAVE_ID ? persistence.getSaveById(TARGET_SAVE_ID) : null) ?? persistence.getActiveSave() ?? bootstrapped.save;
  if (!save) {
    throw new Error("No active local save available.");
  }
  const preflight = buildPreflight(save);
  console.error(`[autoprep] preflight done ok=${preflight.ok} blockers=${preflight.blockers.length} elapsed=${Date.now() - startedAt}ms`);
  if (!preflight.ok) {
    const jsonPath = writeJson(exportName("autoprep-readiness.json"), { ok: false, preflight });
    writeMarkdown(exportName("autoprep-readiness.md"), `# ${save.gameState.season.name} Auto-Prep Readiness\n\nStatus: **BLOCKED**\n\nBlocker: ${preflight.blockers.join(" | ")}\n\nJSON: ${jsonPath}\n`);
    throw new Error(`Preflight blocked: ${preflight.blockers.join(" | ")}`);
  }

  let gameState = save.gameState;
  const generatedCards = buildGeneratedFormCardRecordsForSeason(gameState, save.saveId, gameState.season.id);
  console.error(`[autoprep] formcards generated cards=${generatedCards.length} elapsed=${Date.now() - startedAt}ms`);
  gameState = {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      formCards: [
        ...(gameState.seasonState.formCards ?? []).filter((card) => card.seasonId !== gameState.season.id),
        ...generatedCards,
      ],
    },
  };

  let trainingRows: TrainingAuditRow[] = [];
  if (process.env.OLY_AUTOPREP_SKIP_MANAGER_TRAINING === "1") {
    const training = applyTrainingModes(gameState);
    gameState = training.gameState;
    trainingRows = training.rows;
    console.error("[autoprep] legacy heuristic training applied (OLY_AUTOPREP_SKIP_MANAGER_TRAINING=1)");
  } else {
    const missingModes = gameState.players.filter(
      (player) =>
        gameState.rosters.some((entry) => entry.playerId === player.id) &&
        !player.trainingMode,
    ).length;
    if (missingModes > 0) {
      console.error(`[autoprep] skip heuristic training; ${missingModes} roster players without manager training mode`);
    } else {
      console.error("[autoprep] skip heuristic training (canonical manager path)");
    }
  }
  const lineupPrep = prepLineups(gameState, save.saveId);
  gameState = lineupPrep.gameState;
  console.error(`[autoprep] prep complete elapsed=${Date.now() - startedAt}ms`);

  if (WRITE_ENABLED) {
    persistence.saveSingleplayerState(save.saveId, gameState);
  }

  const formRows = buildFormCardAudit(gameState);
  const readiness = buildReadiness(gameState, preflight, trainingRows, lineupPrep.rows, formRows);
  const lineupCsv = writeCsv(exportName("lineup-readiness.csv"), lineupPrep.rows);
  const formCsv = writeCsv(exportName("formcards-audit.csv"), formRows);
  const trainingCsv = writeCsv(exportName("training-audit.csv"), trainingRows);
  const json = writeJson(exportName("autoprep-readiness.json"), readiness);
  const md = writeMarkdown(exportName("autoprep-readiness.md"), buildMarkdown(readiness, { json, lineupCsv, formCsv, trainingCsv }));

  console.log(JSON.stringify({
    ok: readiness.ok,
    dryRun: !WRITE_ENABLED,
    saveId: save.saveId,
    files: { md, json, lineupCsv, formCsv, trainingCsv },
    matchdays: readiness.byMatchday,
    blockers: readiness.blockers,
  }, null, 2));
}

main();

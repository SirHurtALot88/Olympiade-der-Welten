import fs from "node:fs";
import path from "node:path";

import {
  startAdminSeasonSimulation,
  tickAdminSeasonSimulation,
  type AdminSeasonSimulationRunState,
} from "@/lib/admin/season-simulation-runner";
import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";
import type { PersistedSaveGame } from "@/lib/persistence/types";

const DEFAULT_BEST_SAVE_ID = "fresh-pick-audit-run-6-1781727046372";
const OUT_DIR = path.join(process.cwd(), "outputs", "realistic-5season");
const BEST_AUDIT_SUMMARY = path.join(
  process.cwd(),
  "outputs",
  "fresh-pick-audit-10x",
  "fresh-pick-audit-10x-post-classification-summary.md",
);

type CsvValue = string | number | boolean | null | undefined;

function argValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? null;
  return null;
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function assertRunSaveIsNotActive(input: { persistence: ReturnType<typeof createPersistenceService>; runSaveId: string; stage: string }) {
  const activeSaveId = input.persistence.getActiveSave()?.saveId ?? null;
  if (activeSaveId === input.runSaveId) {
    throw new Error(`realistic_simulation_save_became_active:${input.runSaveId}:${input.stage}`);
  }
}

function round(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function num(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function teamCode(gameState: GameState, teamId: string | null | undefined) {
  if (!teamId) return "";
  return gameState.teams.find((team) => team.teamId === teamId)?.shortCode ?? teamId;
}

function teamName(gameState: GameState, teamId: string | null | undefined) {
  if (!teamId) return "";
  return gameState.teams.find((team) => team.teamId === teamId)?.name ?? teamId;
}

function writeCsv(file: string, rows: Record<string, CsvValue>[]) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const escape = (value: CsvValue) => {
    if (value == null) return "";
    const text = String(value);
    if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  };
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
  fs.writeFileSync(file, `${body}\n`, "utf8");
}

function readJsonl(file: string) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function transferTeamId(entry: TransferHistoryEntry, kind: "buy" | "sell" | "contract_exit") {
  if (kind === "buy") return entry.toTeamId;
  return entry.fromTeamId;
}

function classifyContractCost(entry: TransferHistoryEntry) {
  const remainingYears = Math.max(0, num(entry.remainingContractLength));
  const salary = Math.max(0, num(entry.salary));
  const remainingGuaranteedSalary = round(remainingYears * salary, 2);
  if (entry.transferType === "buy") {
    return {
      mode: "new_contract",
      expectedContractExitCost: 0,
      remainingGuaranteedSalary,
      severity: "INFO",
      note: "Neuvertrag; keine Exit-Kosten.",
    };
  }
  if (entry.transferType === "sell") {
    return {
      mode: "market_sale_buyer_assumes_contract",
      expectedContractExitCost: 0,
      remainingGuaranteedSalary,
      severity: "INFO",
      note: "Normaler Marktverkauf: Kaeufer uebernimmt Vertrag, kein Buyout beim Verkaeufer.",
    };
  }
  if (remainingYears > 0) {
    return {
      mode: "early_contract_exit_requires_buyout",
      expectedContractExitCost: remainingGuaranteedSalary,
      remainingGuaranteedSalary,
      severity: "RED",
      note: "Vorzeitiger Contract Exit mit Restlaufzeit gefunden; Kosten muessen explizit abgezogen werden.",
    };
  }
  return {
    mode: "expired_contract_exit_no_remaining_salary",
    expectedContractExitCost: 0,
    remainingGuaranteedSalary,
    severity: "INFO",
    note: "Vertrag war ausgelaufen; keine Restlaufzeit-Kosten.",
  };
}

function findBestSaveId() {
  const direct = argValue("--direct-save");
  if (direct) return direct;
  const explicit = argValue("--source-save");
  if (explicit) return explicit;
  if (fs.existsSync(BEST_AUDIT_SUMMARY)) {
    const text = fs.readFileSync(BEST_AUDIT_SUMMARY, "utf8");
    const match = text.match(/Best Save:\s*`([^`]+)`/);
    if (match?.[1]) return match[1];
  }
  return DEFAULT_BEST_SAVE_ID;
}

function selectedFormCardIds(modifiers: NonNullable<GameState["seasonState"]["lineupDrafts"]>[number]["modifiers"]) {
  const d1 = modifiers?.d1;
  const d2 = modifiers?.d2;
  return [
    d1?.primaryFormCardId,
    d1?.secondaryFormCardId,
    d2?.primaryFormCardId,
    d2?.secondaryFormCardId,
  ].filter((value): value is string => Boolean(value));
}

function selectedMutatorTraits(modifiers: NonNullable<GameState["seasonState"]["lineupDrafts"]>[number]["modifiers"]) {
  const d1 = modifiers?.d1;
  const d2 = modifiers?.d2;
  return [
    d1?.mutatorTrait1,
    d1?.mutatorTrait2,
    d2?.mutatorTrait1,
    d2?.mutatorTrait2,
  ].filter((value): value is string => Boolean(value));
}

function buildPerformanceRows(run: AdminSeasonSimulationRunState) {
  return readJsonl(run.reports.jsonl)
    .filter((entry) => entry.type === "matchday_performance_breakdown")
    .map((entry) => ({
      seasonId: String(entry.seasonId ?? ""),
      matchdayId: String(entry.matchdayId ?? ""),
      matchdayIndex: num(entry.matchdayIndex),
      phase: String(entry.phase ?? ""),
      durationMs: num(entry.durationMs),
      itemCount: num(entry.itemCount),
      source: String(entry.source ?? ""),
    }));
}

function buildPhaseRows(run: AdminSeasonSimulationRunState) {
  const events = readJsonl(run.reports.jsonl)
    .filter((entry) => entry.type === "phase_start" || entry.type === "phase_end")
    .map((entry) => ({
      at: Date.parse(String(entry.at ?? "")),
      type: String(entry.type ?? ""),
      phase: String(entry.phase ?? ""),
      seasonId: String(entry.seasonId ?? ""),
      matchdayId: String(entry.matchdayId ?? ""),
      status: String(entry.status ?? ""),
      progressPct: num(entry.progressPct),
    }))
    .filter((entry) => Number.isFinite(entry.at));
  const rows: Record<string, CsvValue>[] = [];
  const open = new Map<string, (typeof events)[number]>();
  for (const event of events) {
    const key = `${event.phase}:${event.seasonId}:${event.matchdayId}:${open.size}`;
    if (event.type === "phase_start") {
      open.set(`${event.phase}:${event.seasonId}:${event.matchdayId}`, event);
      continue;
    }
    const openKey = `${event.phase}:${event.seasonId}:${event.matchdayId}`;
    const start = open.get(openKey);
    rows.push({
      phase: event.phase,
      seasonId: event.seasonId,
      matchdayId: event.matchdayId,
      durationMs: start ? event.at - start.at : null,
      status: event.status,
      progressPct: event.progressPct,
    });
    open.delete(openKey);
    void key;
  }
  return rows;
}

function buildPerformanceHotspotRows(performanceRows: Record<string, CsvValue>[]) {
  const byPhase = new Map<string, { count: number; totalMs: number; maxMs: number }>();
  for (const row of performanceRows) {
    const phase = String(row.phase ?? "");
    const duration = num(row.durationMs);
    const current = byPhase.get(phase) ?? { count: 0, totalMs: 0, maxMs: 0 };
    current.count += 1;
    current.totalMs += duration;
    current.maxMs = Math.max(current.maxMs, duration);
    byPhase.set(phase, current);
  }
  return [...byPhase.entries()]
    .map(([phase, stats]) => ({
      phase,
      count: stats.count,
      totalMs: round(stats.totalMs),
      avgMs: round(stats.totalMs / Math.max(1, stats.count)),
      maxMs: round(stats.maxMs),
    }))
    .sort((left, right) => num(right.totalMs) - num(left.totalMs));
}

function buildContractCostRows(gameState: GameState, sourceTransferIds = new Set<string>()) {
  return gameState.transferHistory.map((entry) => {
    const cost = classifyContractCost(entry);
    const isPreExisting = sourceTransferIds.has(entry.id);
    const severity = isPreExisting && cost.severity === "RED" ? "PREEXISTING_RED" : cost.severity;
    return {
      seasonId: entry.seasonId,
      happenedAt: entry.happenedAt,
      preExistingSourceHistory: isPreExisting,
      transferType: entry.transferType,
      source: entry.source ?? "",
      playerId: entry.playerId,
      playerName: entry.playerName ?? "",
      fromTeam: teamCode(gameState, entry.fromTeamId),
      toTeam: teamCode(gameState, entry.toTeamId),
      fee: round(entry.fee),
      salary: round(entry.salary),
      marketValue: round(entry.marketValue),
      remainingContractLength: round(entry.remainingContractLength),
      remainingGuaranteedSalary: cost.remainingGuaranteedSalary,
      expectedContractExitCost: cost.expectedContractExitCost,
      saleContractCostMode: cost.mode,
      severity,
      note: isPreExisting ? `Pre-existing Source-History: ${cost.note}` : cost.note,
    };
  });
}

function buildFormCardRows(gameState: GameState) {
  const drafts = gameState.seasonState.lineupDrafts ?? [];
  const cards = gameState.seasonState.formCards ?? [];
  const seasons = Array.from(new Set([
    ...cards.map((card) => card.seasonId),
    ...drafts.map((draft) => draft.seasonId),
  ])).sort((left, right) => left.localeCompare(right, "de", { numeric: true }));

  return seasons.map((seasonId) => {
    const seasonCards = cards.filter((card) => card.seasonId === seasonId);
    const seasonDrafts = drafts.filter((draft) => draft.seasonId === seasonId);
    const usedCardIds = new Set(seasonDrafts.flatMap((draft) => selectedFormCardIds(draft.modifiers)));
    const usedCards = seasonCards.filter((card) => usedCardIds.has(card.id));
    const cardCount = (color: string) => seasonCards.filter((card) => card.cardColor === color).length;
    const usedCount = (color: string) => usedCards.filter((card) => card.cardColor === color).length;
    const negativeUsed = usedCards.filter((card) => card.cardValue < 0).length;
    return {
      seasonId,
      cardsTotal: seasonCards.length,
      redCards: cardCount("red"),
      greenCards: cardCount("green"),
      blueCards: cardCount("blue"),
      yellowCards: cardCount("yellow"),
      draftsTotal: seasonDrafts.length,
      resolvedDrafts: seasonDrafts.filter((draft) => draft.status === "resolved").length,
      submittedOrLockedDrafts: seasonDrafts.filter((draft) => draft.status === "submitted" || draft.status === "locked").length,
      selectedFormCards: usedCardIds.size,
      usedFormCardsInPool: usedCards.length,
      usedRedCards: usedCount("red"),
      usedGreenCards: usedCount("green"),
      usedBlueCards: usedCount("blue"),
      usedYellowCards: usedCount("yellow"),
      negativeFormCardsUsed: negativeUsed,
      missingSelectedCards: Array.from(usedCardIds).filter((cardId) => !seasonCards.some((card) => card.id === cardId)).length,
      warning:
        seasonCards.length === 0
          ? "RED: formcards_missing"
          : usedCardIds.size === 0 && seasonDrafts.length > 0
            ? "YELLOW: no_formcards_selected"
            : negativeUsed > 0
              ? "INFO: negative_formcards_used"
              : "OK",
    };
  });
}

function buildLineupMutatorRows(gameState: GameState) {
  const drafts = gameState.seasonState.lineupDrafts ?? [];
  const matchdayResultById = new Map((gameState.seasonState.matchdayResults ?? []).map((result) => [result.id, result] as const));
  const performanceSeason = (gameState.seasonState.playerDisciplinePerformances ?? []).reduce((map, performance) => {
    const result = matchdayResultById.get(performance.matchdayResultId);
    if (!result) return map;
    const key = `${result.seasonId}:${result.matchdayId}:${performance.teamId}`;
    const current = map.get(key) ?? {
      playerPerformanceRows: 0,
      mutatorScoreBonus: 0,
      mutatorPpsBonus: 0,
      mutatorPlayers: 0,
    };
    current.playerPerformanceRows += 1;
    current.mutatorScoreBonus += num(performance.mutatorScoreBonus);
    current.mutatorPpsBonus += num(performance.mutatorPpsBonus);
    if (num(performance.mutatorScoreBonus) !== 0 || num(performance.mutatorPpsBonus) !== 0) current.mutatorPlayers += 1;
    map.set(key, current);
    return map;
  }, new Map<string, { playerPerformanceRows: number; mutatorScoreBonus: number; mutatorPpsBonus: number; mutatorPlayers: number }>());

  return drafts.map((draft) => {
    const traits = selectedMutatorTraits(draft.modifiers);
    const cards = selectedFormCardIds(draft.modifiers);
    const perf = performanceSeason.get(`${draft.seasonId}:${draft.matchdayId}:${draft.teamId}`) ?? null;
    return {
      seasonId: draft.seasonId,
      matchdayId: draft.matchdayId,
      teamCode: teamCode(gameState, draft.teamId),
      teamId: draft.teamId,
      status: draft.status,
      lineupEntries: draft.entries.length,
      captains: draft.entries.filter((entry) => entry.isCaptain).length,
      selectedFormCards: cards.length,
      selectedMutators: traits.length,
      mutatorTraits: traits.join("|"),
      playerPerformanceRows: perf?.playerPerformanceRows ?? 0,
      mutatorPlayers: perf?.mutatorPlayers ?? 0,
      mutatorScoreBonus: round(perf?.mutatorScoreBonus ?? 0, 2),
      mutatorPpsBonus: round(perf?.mutatorPpsBonus ?? 0, 2),
      warning:
        draft.entries.length === 0
          ? "RED: lineup_empty"
          : traits.length === 0
            ? "YELLOW: no_mutators_selected"
            : perf && perf.mutatorPlayers === 0
              ? "YELLOW: selected_mutators_no_effect"
              : "OK",
    };
  });
}

function buildMoraleRows(gameState: GameState) {
  const relationshipEvents = gameState.playerRelationshipEvents ?? [];
  const relationshipByPlayer = new Map<string, number>();
  for (const event of relationshipEvents) {
    relationshipByPlayer.set(event.playerId, (relationshipByPlayer.get(event.playerId) ?? 0) + 1);
  }
  const storedMorale = gameState.playerMoraleState ?? [];
  const moraleRows =
    storedMorale.length > 0
      ? storedMorale
      : gameState.rosters.flatMap((roster) => {
          const assessment = assessPlayerMorale({ gameState, playerId: roster.playerId, teamId: roster.teamId });
          if (!assessment) return [];
          return [
            {
              playerId: roster.playerId,
              teamId: roster.teamId,
              morale: assessment.morale,
              visibleMood: assessment.visibleMood,
              lastUpdatedSeasonId: gameState.season.id,
              reasons: assessment.reasons,
              contractIntent: assessment.contractIntent,
            },
          ];
        });
  return moraleRows.map((morale) => ({
    seasonId: morale.lastUpdatedSeasonId,
    teamCode: teamCode(gameState, morale.teamId),
    teamId: morale.teamId,
    playerId: morale.playerId,
    morale: round(morale.morale, 1),
    mood: morale.visibleMood,
    contractIntent: morale.contractIntent,
    reasons: morale.reasons.map((reason) => `${reason.reasonId}:${reason.valueDelta}`).join("|"),
    relationshipEvents: relationshipByPlayer.get(morale.playerId) ?? 0,
    warning:
      morale.visibleMood === "angry" || morale.contractIntent === "refuses_extension"
        ? "RED: morale_contract_risk"
        : morale.visibleMood === "unhappy" || morale.contractIntent === "considering_exit"
          ? "YELLOW: morale_watch"
          : "OK",
  }));
}

function buildRelationshipRows(gameState: GameState) {
  return (gameState.playerRelationshipEvents ?? []).map((event) => ({
    seasonId: event.seasonId,
    teamCode: teamCode(gameState, event.teamId),
    teamId: event.teamId,
    playerId: event.playerId,
    reason: event.reason,
    delta: event.delta,
    severity: event.severity,
    source: event.source,
    createdAt: event.createdAt,
  }));
}

function buildObjectiveRows(gameState: GameState) {
  const board = gameState.seasonState.boardConfidence ?? {};
  return (gameState.seasonState.teamSeasonObjectives ?? []).map((objective) => ({
    seasonId: objective.seasonId,
    teamCode: teamCode(gameState, objective.teamId),
    teamId: objective.teamId,
    objectiveId: objective.objectiveId,
    category: objective.category,
    label: objective.label,
    targetValue: String(objective.targetValue ?? ""),
    currentValue: String(objective.currentValue ?? ""),
    status: objective.status,
    boardConfidenceDelta: round(objective.boardConfidenceDelta),
    source: objective.source,
    boardRatingCurrent: round(board[objective.teamId]?.value),
    pressureCurrent: round(board[objective.teamId]?.pressure),
  }));
}

function buildSystemHealthRows(input: {
  run: AdminSeasonSimulationRunState;
  gameState: GameState;
  financeRows: Record<string, CsvValue>[];
  contractRows: Record<string, CsvValue>[];
  boardRows: Record<string, CsvValue>[];
  objectiveRows: Record<string, CsvValue>[];
  xpRows: Record<string, CsvValue>[];
  formCardRows: Record<string, CsvValue>[];
  lineupMutatorRows: Record<string, CsvValue>[];
  moraleRows: Record<string, CsvValue>[];
  performanceRows: Record<string, CsvValue>[];
}) {
  const matchdayTotals = input.performanceRows.filter((row) => row.phase === "matchday_total");
  const maxMatchdayMs = Math.max(0, ...matchdayTotals.map((row) => num(row.durationMs)));
  const activeSeasonId = input.gameState.season.id;
  const activeObjectiveTeams = new Set(
    input.objectiveRows
      .filter((row) => row.seasonId === activeSeasonId)
      .map((row) => String(row.teamId)),
  ).size;
  return [
    {
      system: "runner",
      status: input.run.status === "completed" ? "OK" : "RED",
      metric: "status",
      value: input.run.status,
      detail: input.run.currentOperation,
    },
    {
      system: "performance",
      status: maxMatchdayMs > 120_000 ? "RED" : maxMatchdayMs > 60_000 ? "YELLOW" : "OK",
      metric: "max_matchday_ms",
      value: round(maxMatchdayMs),
      detail: `${matchdayTotals.length} matchdays`,
    },
    {
      system: "board",
      status: activeObjectiveTeams === input.gameState.teams.length ? "OK" : "RED",
      metric: "active_objective_teams",
      value: `${activeObjectiveTeams}/${input.gameState.teams.length}`,
      detail: `boardRows=${input.boardRows.length}`,
    },
    {
      system: "finance",
      status: input.financeRows.some((row) => num(row.cashEnd) < 0) ? "RED" : "OK",
      metric: "negative_cash_rows",
      value: input.financeRows.filter((row) => num(row.cashEnd) < 0).length,
      detail: "",
    },
    {
      system: "contracts",
      status: input.contractRows.some((row) => row.severity === "RED") ? "RED" : "OK",
      metric: "contract_cost_red",
      value: input.contractRows.filter((row) => row.severity === "RED").length,
      detail: "",
    },
    {
      system: "formcards",
      status: input.formCardRows.some((row) => String(row.warning).startsWith("RED")) ? "RED" : input.formCardRows.some((row) => String(row.warning).startsWith("YELLOW")) ? "YELLOW" : "OK",
      metric: "formcard_seasons",
      value: input.formCardRows.length,
      detail: `selected=${input.formCardRows.reduce((sum, row) => sum + num(row.selectedFormCards), 0)}`,
    },
    {
      system: "mutators",
      status: input.lineupMutatorRows.some((row) => String(row.warning).startsWith("RED")) ? "RED" : input.lineupMutatorRows.some((row) => String(row.warning).startsWith("YELLOW")) ? "YELLOW" : "OK",
      metric: "lineup_rows",
      value: input.lineupMutatorRows.length,
      detail: `mutatorPps=${round(input.lineupMutatorRows.reduce((sum, row) => sum + num(row.mutatorPpsBonus), 0), 2)}`,
    },
    {
      system: "morale",
      status: input.moraleRows.some((row) => String(row.warning).startsWith("RED")) ? "RED" : input.moraleRows.some((row) => String(row.warning).startsWith("YELLOW")) ? "YELLOW" : "OK",
      metric: "morale_rows",
      value: input.moraleRows.length,
      detail: "",
    },
    {
      system: "xp",
      status: input.xpRows.length === 0 ? "RED" : input.xpRows.filter((row) => num(row.materializedAttributePoints) > 0).length / Math.max(1, input.xpRows.length) < 0.05 ? "YELLOW" : "OK",
      metric: "xp_events",
      value: input.xpRows.length,
      detail: `materialized=${input.xpRows.filter((row) => num(row.materializedAttributePoints) > 0).length}`,
    },
  ];
}

function buildMarketRows(gameState: GameState) {
  return gameState.transferHistory.map((entry) => ({
    seasonId: entry.seasonId,
    matchdayId: entry.matchdayId ?? "",
    phase: entry.phase ?? "",
    happenedAt: entry.happenedAt,
    type: entry.transferType,
    playerId: entry.playerId,
    playerName: entry.playerName ?? "",
    fromTeam: teamCode(gameState, entry.fromTeamId),
    toTeam: teamCode(gameState, entry.toTeamId),
    fee: round(entry.fee),
    salary: round(entry.salary),
    marketValue: round(entry.marketValue),
    feeMinusMarketValue: round(num(entry.fee) - num(entry.marketValue)),
    feeMarketValueFactor: entry.marketValue > 0 ? round(entry.fee / entry.marketValue, 3) : null,
    remainingContractLength: round(entry.remainingContractLength),
    source: entry.source ?? "",
  }));
}

function buildFinanceRows(gameState: GameState, contractRows: Record<string, CsvValue>[]) {
  const contractExitCostByTeamSeason = new Map<string, number>();
  for (const row of contractRows) {
    const seasonId = String(row.seasonId ?? "");
    const cost = num(row.expectedContractExitCost);
    const team = row.transferType === "buy" ? String(row.toTeam ?? "") : String(row.fromTeam ?? "");
    if (!seasonId || !team) continue;
    const key = `${seasonId}:${team}`;
    contractExitCostByTeamSeason.set(key, num(contractExitCostByTeamSeason.get(key)) + cost);
  }
  const transfersByTeamSeason = new Map<string, { buys: number; sells: number; buyCount: number; sellCount: number; biggestBuy: number }>();
  for (const entry of gameState.transferHistory) {
    const teamId = transferTeamId(entry, entry.transferType);
    const code = teamCode(gameState, teamId);
    if (!code) continue;
    const key = `${entry.seasonId}:${code}`;
    const current = transfersByTeamSeason.get(key) ?? { buys: 0, sells: 0, buyCount: 0, sellCount: 0, biggestBuy: 0 };
    if (entry.transferType === "buy") {
      current.buys += num(entry.fee);
      current.buyCount += 1;
      current.biggestBuy = Math.max(current.biggestBuy, num(entry.fee));
    } else {
      current.sells += num(entry.fee);
      current.sellCount += 1;
    }
    transfersByTeamSeason.set(key, current);
  }
  return (gameState.seasonState.seasonSnapshots ?? []).flatMap((snapshot) =>
    snapshot.finalStandings.map((row) => {
      const key = `${snapshot.seasonId}:${row.teamCode}`;
      const transfers = transfersByTeamSeason.get(key) ?? { buys: 0, sells: 0, buyCount: 0, sellCount: 0, biggestBuy: 0 };
      const contractExitCost = num(contractExitCostByTeamSeason.get(key));
      const salary = row.salaryTotalEnd ?? row.salaryEnd;
      const cash = row.cashTotal ?? row.cashEnd;
      const guv = row.guv ?? null;
      const warnings = [
        cash != null && cash < 0 ? "cash_negative" : "",
        salary != null && cash != null && cash > 0 && salary / Math.max(1, cash) > 1.2 ? "salary_pressure" : "",
        transfers.biggestBuy > 65 ? "large_star_spend" : "",
      ].filter(Boolean).join("|");
      return {
        seasonId: snapshot.seasonId,
        teamCode: row.teamCode,
        teamName: row.teamName,
        rank: row.rank,
        points: round(row.points),
        cashEnd: round(cash),
        cashEndRaw: round(row.cashEnd),
        cashTotal: round(row.cashTotal),
        salaryTotal: round(salary),
        marketValueTotal: round(row.marketValueTotalEnd ?? row.marketValueEnd),
        sponsorSeason: round(row.sponsorSeason),
        sponsorTotal: round(row.sponsorTotal),
        guv: round(guv),
        transferBuyTotal: round(row.transferBuyTotal ?? transfers.buys),
        transferSellTotal: round(row.transferSellTotal ?? transfers.sells),
        transferNet: round(row.transferNet ?? transfers.sells - transfers.buys),
        transferBuyCount: row.transferBuyCount ?? transfers.buyCount,
        transferSellCount: row.transferSellCount ?? transfers.sellCount,
        biggestBuy: round(transfers.biggestBuy),
        contractExitCost: round(contractExitCost),
        warnings,
      };
    }),
  );
}

function buildBoardRows(gameState: GameState) {
  const objectives = gameState.seasonState.teamSeasonObjectives ?? [];
  return gameState.teams.map((team) => {
    const board = gameState.seasonState.boardConfidence?.[team.teamId] ?? null;
    const teamObjectives = objectives.filter((entry) => entry.teamId === team.teamId);
    const completed = teamObjectives.filter((entry) => entry.status === "completed").length;
    const failed = teamObjectives.filter((entry) => entry.status === "failed").length;
    const atRisk = teamObjectives.filter((entry) => entry.status === "at_risk").length;
    const delta = teamObjectives.reduce((sum, entry) => sum + num(entry.boardConfidenceDelta), 0);
    return {
      seasonId: gameState.season.id,
      teamCode: team.shortCode,
      teamName: team.name,
      boardRating: round(board?.value),
      pressure: round(board?.pressure),
      objectiveCount: teamObjectives.length,
      completed,
      failed,
      atRisk,
      open: teamObjectives.length - completed - failed - atRisk,
      objectiveDeltaSum: round(delta),
      warnings: board?.warnings?.join("|") ?? "",
    };
  });
}

function buildXpRows(gameState: GameState) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return (gameState.playerProgressionEvents ?? []).map((event) => {
    const player = playerById.get(event.playerId);
    const upgradePoints = event.upgrades.reduce((sum, upgrade) => sum + Math.max(0, upgrade.toValue - upgrade.fromValue), 0);
    return {
      seasonId: event.seasonId,
      teamCode: teamCode(gameState, event.teamId),
      playerId: event.playerId,
      playerName: player?.name ?? event.playerId,
      xpEarned: round(event.xpEarned),
      xpSpent: round(event.xpSpent),
      currentXPBefore: round(event.currentXPBefore),
      currentXPAfter: round(event.currentXPAfter),
      lifetimeXPBefore: round(event.lifetimeXPBefore),
      lifetimeXPAfter: round(event.lifetimeXPAfter),
      upgradeCount: event.upgrades.length,
      materializedAttributePoints: round(upgradePoints),
      marketValueBefore: round(event.progressionSnapshotBefore?.marketValue),
      marketValueAfter: round(event.progressionSnapshotAfter?.marketValue),
      salaryBefore: round(event.progressionSnapshotBefore?.salary),
      salaryAfter: round(event.progressionSnapshotAfter?.salary),
      warnings: event.economyWarnings?.join("|") ?? "",
      source: event.source,
      timestamp: event.timestamp,
    };
  });
}

function textOf(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function playerSignals(player: unknown) {
  const record = player as Record<string, unknown>;
  return [
    record.name,
    record.race,
    record.className,
    record.class,
    record.gender,
    record.archetype,
    record.tags,
    record.traits,
    record.description,
    record.prompt,
  ].map(textOf).join(" ");
}

function buildIdentityRows(gameState: GameState) {
  const players = new Map(gameState.players.map((player) => [player.id, player]));
  return gameState.teams.map((team) => {
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const rosterPlayers = roster.map((entry) => players.get(entry.playerId)).filter(Boolean);
    const count = Math.max(1, rosterPlayers.length);
    const share = (predicate: (text: string, player: unknown) => boolean) =>
      round((rosterPlayers.filter((player) => predicate(playerSignals(player), player)).length / count) * 100, 1);
    const height5Plus = share((_text, player) => num((player as Record<string, unknown>)?.height, 0) >= 5);
    const femaleOrPet = share((text) => /\bfemale\b|woman|girl|queen|lady|princess|animal|pet/.test(text));
    const demonHell = share((text) => /demon|hell|fiend|prime evil|succub|incub/.test(text));
    const pirate = share((text) => /pirate|swashbuck|wayfarer|corsair|sailor|captain|buccaneer/.test(text));
    const aquaNatureAlien = share((text) => /aqua|water|river|sea|ocean|alien|nature|organic|fish|mermaid|serpent/.test(text));
    return {
      teamCode: team.shortCode,
      teamName: team.name,
      rosterCount: rosterPlayers.length,
      cashEnd: round(team.cash),
      salaryTotal: round(roster.reduce((sum, entry) => sum + num(entry.salary), 0)),
      marketValueTotal: round(roster.reduce((sum, entry) => sum + num(entry.currentValue), 0)),
      avgContractLength: rosterPlayers.length ? round(roster.reduce((sum, entry) => sum + num(entry.contractLength), 0) / rosterPlayers.length, 2) : null,
      demonHellPct: demonHell,
      pirateSwashbucklerWayfarerPct: pirate,
      femaleOrPetPct: femaleOrPet,
      height5PlusPct: height5Plus,
      aquaNatureAlienPct: aquaNatureAlien,
      primaryClassShare: share((text) => text.includes(textOf((rosterPlayers[0] as Record<string, unknown> | undefined)?.className))),
      hardRuleViolations:
        team.shortCode === "T-G" && num(height5Plus) < 100
          ? "height_below_5_present"
          : team.shortCode === "V-D" && num(femaleOrPet) < 100
            ? "non_female_non_pet_present"
            : "",
      yellowGuidance: [
        team.shortCode === "H-R" && num(demonHell) < 75 ? "Demon/Hell Quote unter Ziel" : "",
        team.shortCode === "P-C" && num(pirate) < 50 ? "Pirate/Wayfarer Quote weiter beobachten" : "",
      ].filter(Boolean).join("|"),
    };
  });
}

function buildOverspendRows(gameState: GameState, financeRows: Record<string, CsvValue>[]) {
  return financeRows.map((row) => {
    const spend = num(row.transferBuyTotal);
    const salary = num(row.salaryTotal);
    const cash = num(row.cashEnd);
    const biggestBuy = num(row.biggestBuy);
    const warning =
      biggestBuy >= 90
        ? "RED: one_star_budget_lock"
        : biggestBuy >= 65 || cash < 0 || salary > 75
          ? "YELLOW: pressure_watch"
          : "INFO";
    return {
      seasonId: row.seasonId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      rank: row.rank,
      points: row.points,
      cashEnd: round(cash),
      salaryTotal: round(salary),
      transferSpend: round(spend),
      transferRevenue: row.transferSellTotal,
      biggestBuy: round(biggestBuy),
      salaryPressure: cash > 0 ? round(salary / cash, 3) : null,
      warning,
    };
  });
}

function writeSummary(input: {
  sourceSave: PersistedSaveGame;
  finalSave: PersistedSaveGame;
  run: AdminSeasonSimulationRunState;
  directSaveWrite: boolean;
  reportJsonFile: string;
  financeRows: Record<string, CsvValue>[];
  contractRows: Record<string, CsvValue>[];
  boardRows: Record<string, CsvValue>[];
  objectiveRows: Record<string, CsvValue>[];
  xpRows: Record<string, CsvValue>[];
  identityRows: Record<string, CsvValue>[];
  formCardRows: Record<string, CsvValue>[];
  lineupMutatorRows: Record<string, CsvValue>[];
  moraleRows: Record<string, CsvValue>[];
  relationshipRows: Record<string, CsvValue>[];
  performanceRows: Record<string, CsvValue>[];
  performanceHotspotRows: Record<string, CsvValue>[];
  systemHealthRows: Record<string, CsvValue>[];
  outDir: string;
}) {
  const redContractCosts = input.contractRows.filter((row) => row.severity === "RED");
  const negativeCashRows = input.financeRows.filter((row) => num(row.cashEnd) < 0);
  const xpMaterialized = input.xpRows.filter((row) => num(row.materializedAttributePoints) > 0).length;
  const latestSnapshots = input.finalSave.gameState.seasonState.seasonSnapshots ?? [];
  const redSystems = input.systemHealthRows.filter((row) => row.status === "RED");
  const yellowSystems = input.systemHealthRows.filter((row) => row.status === "YELLOW");
  const status =
    input.run.status !== "completed" || redSystems.length > 0
      ? "RED"
      : yellowSystems.length > 0
        ? "YELLOW"
        : "GREEN";
  const maxMatchday = input.performanceRows
    .filter((row) => row.phase === "matchday_total")
    .reduce((max, row) => Math.max(max, num(row.durationMs)), 0);
  const lines = [
    "# Realistic 5-Season Simulation",
    "",
    `Ampel: ${status}`,
    `Source Save: ${input.sourceSave.saveId} (${input.sourceSave.name})`,
    `Final Save: ${input.finalSave.saveId} (${input.finalSave.name})`,
    `Admin Run: ${input.run.runId}`,
    `Status: ${input.run.status}`,
    `Dauer: ${round(input.run.durationMs / 1000, 1)}s`,
    `Archivierte Seasons: ${latestSnapshots.length}`,
    "",
    "## Kernergebnis",
    `- Full-Churn: nein`,
    `- Prisma/Supabase Writes: nein`,
    `- Lokaler Save-Write: ${input.directSaveWrite ? "direkt in den Testsave" : "Save-Klon"}`,
    `- System REDs: ${redSystems.length}`,
    `- System YELLOWs: ${yellowSystems.length}`,
    `- Contract-Cost REDs: ${redContractCosts.length}`,
    `- Negative Cash Team-Seasons: ${negativeCashRows.length}`,
    `- XP materialized Events: ${xpMaterialized}/${input.xpRows.length}`,
    `- Board Rows: ${input.boardRows.length}; Objective Rows: ${input.objectiveRows.length}`,
    `- Formkarten-Seasons: ${input.formCardRows.length}; Lineup/Mutator Rows: ${input.lineupMutatorRows.length}`,
    `- Morale Rows: ${input.moraleRows.length}; Relationship Events: ${input.relationshipRows.length}`,
    `- Matchday Performance Rows: ${input.performanceRows.length}; Max Matchday: ${round(maxMatchday / 1000, 2)}s`,
    `- Identity Rows: ${input.identityRows.length}`,
    "",
    "## System-Ampel",
    ...input.systemHealthRows.map((row) => `- ${row.status} ${row.system}: ${row.metric}=${row.value}${row.detail ? ` (${row.detail})` : ""}`),
    "",
    "## Performance Hotspots",
    ...input.performanceHotspotRows.slice(0, 12).map((row) => `- ${row.phase}: total ${row.totalMs}ms, avg ${row.avgMs}ms, max ${row.maxMs}ms`),
    "",
    "## Contract-Cost-Regel",
    "- Marktverkauf: Käufer übernimmt Vertrag, kein voller Restgehalts-Abzug beim Verkäufer.",
    "- Auslaufender Vertrag: kein Buyout, Restlaufzeit 0.",
    "- Vorzeitiger Contract Exit mit Restlaufzeit wäre RED und steht in contract-costs.csv.",
    "",
    "## Reports",
    `- JSON: ${input.reportJsonFile}`,
    `- Verzeichnis: ${input.outDir}`,
    "- CSVs: finance, market, contract-costs, board-trust, board-objectives, xp-development, formcards, lineups-mutators, morale, relationship-events, performance, phase-timings, system-health",
  ];
  fs.writeFileSync(path.join(input.outDir, "realistic-5season-summary.md"), `${lines.join("\n")}\n`, "utf8");
}

async function run() {
  assertOlyProjectRoot();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const persistence = createPersistenceService();
  const previousActiveSaveId = persistence.getActiveSave()?.saveId ?? null;
  const sourceSaveId = findBestSaveId();
  const sourceSave = persistence.getSaveById(sourceSaveId);
  if (!sourceSave) throw new Error(`Source save not found: ${sourceSaveId}`);
  const directSaveWrite = hasArg("--direct") || Boolean(argValue("--direct-save"));

  const runSave = directSaveWrite
    ? persistence.activateSave(sourceSave.saveId) ?? sourceSave
    : persistence.createScenarioSnapshot({
      sourceSaveId: sourceSave.saveId,
      name: `Realistic 5-Season Simulation ${new Date().toISOString()}`,
      status: "archived",
      scenarioMeta: {
        scenarioType: "ai_redraft_test",
        label: "Realistic 5-Season Simulation",
        description: "Archivierter Audit-Snapshot fuer Mehrseasons-Simulation ohne aktiven Spielstand umzuschalten.",
        sourceSaveId: sourceSave.saveId,
        saveCategory: "manual",
        allowTestWrites: true,
        isStableTestPoint: false,
        gamePhase: sourceSave.gameState.gamePhase,
      },
    });
  if (!directSaveWrite) {
    assertRunSaveIsNotActive({ persistence, runSaveId: runSave.saveId, stage: "prepared" });
  }
  const adminRun = startAdminSeasonSimulation({
    saveId: runSave.saveId,
    seasonCount: 5,
    mode: "apply",
    fullChurnStress: false,
    injuriesTestMode: false,
  });

  let state: AdminSeasonSimulationRunState | null = adminRun;
  for (let tick = 1; tick <= 700; tick += 1) {
    if (!state || state.status !== "running") break;
    state = await tickAdminSeasonSimulation(state.runId);
    if (tick % 10 === 0 && state) {
      console.log(`[realistic-5season] tick=${tick} status=${state.status} phase=${state.activePhase} progress=${state.progressPct}%`);
    }
  }
  if (!state) throw new Error("Admin runner state disappeared.");
  if (!directSaveWrite && previousActiveSaveId && persistence.getActiveSave()?.saveId === runSave.saveId) {
    persistence.activateSave(previousActiveSaveId);
  }
  if (!directSaveWrite) {
    assertRunSaveIsNotActive({ persistence, runSaveId: runSave.saveId, stage: "after_runner" });
  }

  const finalSave = persistence.getSaveById(runSave.saveId);
  if (!finalSave) throw new Error(`Final save not found: ${runSave.saveId}`);

  const runDir = path.join(OUT_DIR, `${new Date().toISOString().replaceAll(":", "-")}-${state.runId}`);
  fs.mkdirSync(runDir, { recursive: true });
  const sourceTransferIds = new Set(sourceSave.gameState.transferHistory.map((entry) => entry.id));
  const contractRows = buildContractCostRows(finalSave.gameState, sourceTransferIds);
  const marketRows = buildMarketRows(finalSave.gameState);
  const financeRows = buildFinanceRows(finalSave.gameState, contractRows);
  const boardRows = buildBoardRows(finalSave.gameState);
  const objectiveRows = buildObjectiveRows(finalSave.gameState);
  const xpRows = buildXpRows(finalSave.gameState);
  const identityRows = buildIdentityRows(finalSave.gameState);
  const overspendRows = buildOverspendRows(finalSave.gameState, financeRows);
  const formCardRows = buildFormCardRows(finalSave.gameState);
  const lineupMutatorRows = buildLineupMutatorRows(finalSave.gameState);
  const moraleRows = buildMoraleRows(finalSave.gameState);
  const relationshipRows = buildRelationshipRows(finalSave.gameState);
  const performanceRows = buildPerformanceRows(state);
  const phaseRows = buildPhaseRows(state);
  const performanceHotspotRows = buildPerformanceHotspotRows(performanceRows);
  const systemHealthRows = buildSystemHealthRows({
    run: state,
    gameState: finalSave.gameState,
    financeRows,
    contractRows,
    boardRows,
    objectiveRows,
    xpRows,
    formCardRows,
    lineupMutatorRows,
    moraleRows,
    performanceRows,
  });
  const bugfixRows = [
    {
      area: "admin_runner_market",
      severity: "fix",
      message: "Realistic Follow-up Market laeuft nun in Preseason-Fenstern nach vorhandener Season-Historie ohne Full-Churn.",
      file: "lib/admin/season-simulation-runner.ts",
    },
    ...state.issues.map((issue) => ({
      area: issue.phase,
      severity: issue.level,
      message: issue.message,
      file: "",
    })),
  ];

  writeCsv(path.join(runDir, "realistic-5season-finance.csv"), financeRows);
  writeCsv(path.join(runDir, "realistic-5season-contract-costs.csv"), contractRows);
  writeCsv(path.join(runDir, "realistic-5season-market.csv"), marketRows);
  writeCsv(path.join(runDir, "realistic-5season-board-trust.csv"), boardRows);
  writeCsv(path.join(runDir, "realistic-5season-board-objectives.csv"), objectiveRows);
  writeCsv(path.join(runDir, "realistic-5season-xp-development.csv"), xpRows);
  writeCsv(path.join(runDir, "realistic-5season-team-identity.csv"), identityRows);
  writeCsv(path.join(runDir, "realistic-5season-overspend.csv"), overspendRows);
  writeCsv(path.join(runDir, "realistic-5season-formcards.csv"), formCardRows);
  writeCsv(path.join(runDir, "realistic-5season-lineups-mutators.csv"), lineupMutatorRows);
  writeCsv(path.join(runDir, "realistic-5season-morale.csv"), moraleRows);
  writeCsv(path.join(runDir, "realistic-5season-relationship-events.csv"), relationshipRows);
  writeCsv(path.join(runDir, "realistic-5season-performance.csv"), performanceRows);
  writeCsv(path.join(runDir, "realistic-5season-performance-hotspots.csv"), performanceHotspotRows);
  writeCsv(path.join(runDir, "realistic-5season-phase-timings.csv"), phaseRows);
  writeCsv(path.join(runDir, "realistic-5season-system-health.csv"), systemHealthRows);
  writeCsv(path.join(runDir, "realistic-5season-bugfix-log.csv"), bugfixRows);

  const openBalance = [
    "# Open Balance Notes",
    "",
    ...overspendRows
      .filter((row) => String(row.warning).startsWith("YELLOW") || String(row.warning).startsWith("RED"))
      .slice(0, 40)
      .map((row) => `- ${row.seasonId} ${row.teamCode}: ${row.warning}, cash ${row.cashEnd}, salary ${row.salaryTotal}, biggestBuy ${row.biggestBuy}`),
    "",
    ...(contractRows.some((row) => row.severity === "RED")
      ? ["## RED Contract Costs", ...contractRows.filter((row) => row.severity === "RED").map((row) => `- ${row.seasonId} ${row.playerName}: ${row.note}`)]
      : ["## Contract Costs", "- Keine vorzeitigen Contract-Exit-Kosten ohne Markierung gefunden."]),
  ];
  fs.writeFileSync(path.join(runDir, "realistic-5season-open-balance.md"), `${openBalance.join("\n")}\n`, "utf8");

  const report = {
    generatedAt: new Date().toISOString(),
    sourceSave: { saveId: sourceSave.saveId, name: sourceSave.name },
    finalSave: { saveId: finalSave.saveId, name: finalSave.name },
    directSaveWrite,
    adminRun: state,
    summary: {
      status: state.status,
      snapshots: finalSave.gameState.seasonState.seasonSnapshots?.length ?? 0,
      transferHistory: finalSave.gameState.transferHistory.length,
      contractCostRed: contractRows.filter((row) => row.severity === "RED").length,
      negativeCashTeamSeasons: financeRows.filter((row) => num(row.cashEnd) < 0).length,
      xpEvents: xpRows.length,
      boardRows: boardRows.length,
      objectiveRows: objectiveRows.length,
      formCardRows: formCardRows.length,
      lineupMutatorRows: lineupMutatorRows.length,
      moraleRows: moraleRows.length,
      relationshipRows: relationshipRows.length,
      maxMatchdayMs: Math.max(0, ...performanceRows.filter((row) => row.phase === "matchday_total").map((row) => num(row.durationMs))),
      systemHealth: systemHealthRows,
    },
  };
  const reportJsonFile = path.join(runDir, "realistic-5season-report.json");
  fs.writeFileSync(reportJsonFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeSummary({
    sourceSave,
    finalSave,
    run: state,
    directSaveWrite,
    reportJsonFile,
    financeRows,
    contractRows,
    boardRows,
    objectiveRows,
    xpRows,
    identityRows,
    formCardRows,
    lineupMutatorRows,
    moraleRows,
    relationshipRows,
    performanceRows,
    performanceHotspotRows,
    systemHealthRows,
    outDir: runDir,
  });

  console.log(JSON.stringify({
    ok: state.status === "completed",
    sourceSaveId: sourceSave.saveId,
    finalSaveId: finalSave.saveId,
    runId: state.runId,
    status: state.status,
    reports: runDir,
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

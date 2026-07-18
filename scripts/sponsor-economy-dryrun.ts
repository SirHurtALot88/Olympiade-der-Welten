/**
 * Sponsor-Ökonomie Dry-Run (5 Seasons)
 * ------------------------------------
 * ZWECK: Prüfen, ob die (rebalancierten) Sponsor-Einnahmen die Liga-Inflation zu stark treiben,
 * wenn ALLE Kosten (Facility-Upkeep, Gehälter, Kredite) je Saison abgezogen werden.
 *
 * KEINE Matchday-Simulation. Ränge werden rein STÄRKE-basiert (Quality-Rank) mit kleiner seeded
 * Varianz vergeben, Sponsoren AI-gepickt, am Saisonende nach finalRank gesettelt und dann die
 * Kosten abgezogen. Season für Season, deterministisch (seeded LCG).
 *
 * Ausführung:  node --import tsx scripts/sponsor-economy-dryrun.ts
 *
 * Facility-Upkeep-Quelle (WICHTIG):
 *   previewFacilitySeasonEndFinance(save, teamId).facilityUpkeepTotal
 *   (derselbe Builder, den ai-team-cash-reserve-service nutzt). Der frische Singleplayer-Seed
 *   hat KEINE gebauten Facilities (alle Level 0 -> Upkeep 0), deshalb wird beim Setup EINMALIG ein
 *   qualitäts-korrelierter Facility-Ausbau geseedet (Top-Team = hohe Level, Schluss-Team = niedrig),
 *   damit der Upkeep-Kostenblock überhaupt greift. Der einmalige Baupreis wird NICHT abgezogen
 *   (Start-Ausstattung); getestet wird der WIEDERKEHRENDE Saison-Upkeep.
 */

import {
  advanceSponsorContractsForNewSeason,
} from "@/lib/sponsor/sponsor-contract-lifecycle";
import { advanceTeamBeliebtheitForSeasonTransition } from "@/lib/economy/team-beliebtheit";
import { previewFacilitySeasonEndFinance } from "@/lib/facilities/facility-season-end-service";
import { getTeamAnnualLoanInstallment } from "@/lib/finance/loan-service";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  chooseSponsorOfferForAiTeams,
  ensureSeasonSponsorOffers,
  regenerateSponsorOffersForSeason,
} from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { applySponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { getPrizeMoneyReference } from "@/lib/sponsor/sponsor-economy-calibration";

// Einkommens-Modus: "sponsor" (rebalancierte Sponsoren, default) oder "prize" (altes Preisgeld nach Rang,
// als bewährter Referenz-Benchmark). Gleiche Ränge, gleiche Kosten — nur die Einkommensquelle wechselt.
const INCOME_MODE = (process.env.OLY_DRYRUN_INCOME ?? "sponsor").toLowerCase() === "prize" ? "prize" : "sponsor";
import { buildLeagueTeamQualityRanks } from "@/lib/sponsor/sponsor-team-quality-rank";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import {
  SPONSOR_CURVE_SHAPES,
  SPONSOR_RARITIES,
  SPONSOR_RARITY_KEYS,
  mapArchetypeToCurveShape,
  mapStarTierToRarity,
} from "@/lib/sponsor/sponsor-curve-shapes";
import type { GameState, SponsorCurveShape, SponsorRarity } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import type { FacilityId } from "@/lib/facilities/facility-catalog";

// ---------------------------------------------------------------------------
// Seeded deterministic PRNG (LCG) — für die Rang-Varianz. Kein Math.random.
// ---------------------------------------------------------------------------
const SEED = 0xC0FFEE;
let lcgState = SEED >>> 0;
function nextRandom(): number {
  // Numerical Recipes LCG
  lcgState = (Math.imul(lcgState, 1664525) + 1013904223) >>> 0;
  return lcgState / 0x100000000;
}
/** Ganzzahlige Varianz in [-span, +span], seeded. */
function seededVariance(span: number): number {
  return Math.round((nextRandom() * 2 - 1) * span);
}

function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits));
}
function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

// ---------------------------------------------------------------------------
// Facility-Seeding: der frische Seed hat 0 gebaute Facilities. Wir bauen je Team
// einen qualitäts-korrelierten Level-Satz, damit der Upkeep-Kostenblock real greift.
// Reihenfolge der 8 Facilities aus FACILITY_CATALOG.
// ---------------------------------------------------------------------------
const FACILITY_IDS: FacilityId[] = [
  "training_center",
  "recovery_center",
  "scouting_office",
  "analytics_room",
  "fan_shop",
  "arena_upgrade",
  "academy",
  "specialist_wing",
];

/**
 * Seedet Facility-Level je Team: Top-Team (leaguePosition 1) baut hoch, Schluss-Team niedrig.
 * baseLevel 1..5 aus der Ligaposition, einzelne Facilities leicht gestreut (deterministisch).
 */
function seedFacilities(gameState: GameState): GameState {
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const qualityRanks = buildLeagueTeamQualityRanks(rows, gameState.seasonState.beliebtheitByTeamId);
  const teamFacilities: NonNullable<GameState["seasonState"]["teamFacilities"]> = {
    ...(gameState.seasonState.teamFacilities ?? {}),
  };
  const teamCount = Math.max(1, gameState.teams.length);

  for (const team of gameState.teams) {
    const pos = qualityRanks.get(team.teamId)?.leaguePosition ?? teamCount;
    // pos 1 -> baseLevel 5, pos 32 -> baseLevel ~1
    const baseLevel = clamp(Math.round(5 - ((pos - 1) / (teamCount - 1)) * 4), 1, 5);
    const facilities: Record<string, { level: number; enabled: boolean; conditionPct: number }> = {};
    FACILITY_IDS.forEach((facilityId, index) => {
      // leichte deterministische Streuung: manche Facilities eine Stufe niedriger
      const jitter = (index + pos) % 3 === 0 ? -1 : 0;
      const level = clamp(baseLevel + jitter, 1, 5);
      facilities[facilityId] = { level, enabled: true, conditionPct: 100 };
    });
    teamFacilities[team.teamId] = { facilities: facilities as never };
  }

  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, teamFacilities },
  };
}

// ---------------------------------------------------------------------------
// Rang-Zuweisung (keine Matchdays): Quality-Rank + seeded Varianz -> eindeutige finalRanks 1..32.
// ---------------------------------------------------------------------------
function assignFinalRanks(gameState: GameState): GameState {
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const qualityRanks = buildLeagueTeamQualityRanks(rows, gameState.seasonState.beliebtheitByTeamId);

  // Sortier-Schlüssel = erwartete Ligaposition + Varianz (±2..3), dann eindeutige Ränge vergeben.
  const keyed = gameState.teams.map((team) => {
    const expected = qualityRanks.get(team.teamId)?.leaguePosition ?? gameState.teams.length;
    const variance = seededVariance(3); // ±3 Plätze Über-/Unterperformance
    return { teamId: team.teamId, sortKey: expected + variance, tiebreak: nextRandom() };
  });
  keyed.sort((a, b) => (a.sortKey - b.sortKey) || (a.tiebreak - b.tiebreak));

  const standings = { ...(gameState.seasonState.standings ?? {}) };
  keyed.forEach((entry, index) => {
    const rank = index + 1; // 1..32, eindeutig
    standings[entry.teamId] = {
      ...(standings[entry.teamId] ?? {}),
      rank,
      startplatz: rank,
      points: 100 - rank,
    } as never;
  });

  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, standings },
  };
}

// ---------------------------------------------------------------------------
// Sponsoren: Angebote sicherstellen + AI-Pick (Human-Team wird hier auch AI-gepickt).
// ---------------------------------------------------------------------------
function ensureSponsorContracts(gameState: GameState): GameState {
  let next = ensureSeasonSponsorOffers(gameState);
  next = regenerateSponsorOffersForSeason(next);
  next = chooseSponsorOfferForAiTeams(next);
  // Falls ein Team (z.B. das Human-Team, controlMode manual) keinen Vertrag hat: forciert AI-picken,
  // indem wir es temporär als AI behandeln.
  const withoutContract = next.teams.filter((team) => getTeamSponsorContract(next, team.teamId) == null);
  if (withoutContract.length > 0) {
    const forcedSettings = Object.fromEntries(
      next.teams.map((team) => [team.teamId, { teamId: team.teamId, controlMode: "ai", ownerId: "ai" }]),
    );
    next = chooseSponsorOfferForAiTeams(next, forcedSettings as never);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Kosten je Team (Saison).
// ---------------------------------------------------------------------------
function computeFacilityFinance(gameState: GameState, teamId: string): { upkeep: number; income: number } {
  const save: PersistedSaveGame = {
    saveId: "sponsor-economy-dryrun",
    status: "active",
    gameState,
  } as PersistedSaveGame;
  const preview = previewFacilitySeasonEndFinance(save, teamId);
  return { upkeep: preview.facilityUpkeepTotal, income: preview.facilityIncomeTotal };
}
function computeFacilityUpkeep(gameState: GameState, teamId: string): number {
  return computeFacilityFinance(gameState, teamId).upkeep;
}

type TeamSeasonLedger = {
  teamId: string;
  shortCode: string;
  cashBefore: number;
  sponsorIncome: number;
  salary: number;
  facilityUpkeep: number;
  loan: number;
  totalCost: number;
  net: number;
  cashAfter: number;
  finalRank: number;
  rarity: SponsorRarity | null;
  curveShape: SponsorCurveShape | null;
};

/** Rarität + Kurvenform des Team-Vertrags auflösen (mit Back-Compat auf Altverträge). */
function sponsorMetaOf(
  gameState: GameState,
  teamId: string,
): { rarity: SponsorRarity | null; curveShape: SponsorCurveShape | null } {
  const contract = getTeamSponsorContract(gameState, teamId);
  if (contract == null) return { rarity: null, curveShape: null };
  const rarity = contract.rarity ?? mapStarTierToRarity(contract.starTier);
  const curveShape = contract.curveShape ?? mapArchetypeToCurveShape(contract.archetype);
  return { rarity, curveShape };
}

// ---------------------------------------------------------------------------
// Aggregate + Ausgabe.
// ---------------------------------------------------------------------------
type SeasonSummary = {
  seasonId: string;
  leagueCash: number;
  leagueMarketValue: number;
  topCash: number;
  bottomCash: number;
  top5CashAvg: number;
  bottom5CashAvg: number;
  cashSpread: number;
  teamsPlus: number;
  teamsMinus: number;
  avgCoverRatio: number;
  bankrupt: number;
  rarityDist: Record<string, number>;
  totalSponsor: number;
  totalCost: number;
};

function pad(value: string | number, width: number): string {
  return String(value).padStart(width);
}
function padEnd(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

function printSeasonTable(seasonId: string, ledgers: TeamSeasonLedger[], summary: SeasonSummary) {
  console.log("");
  console.log("=".repeat(120));
  console.log(`SAISON ${seasonId}`);
  console.log("=".repeat(120));

  const sorted = [...ledgers].sort((a, b) => a.finalRank - b.finalRank);
  console.log(
    [
      padEnd("Rk", 3),
      padEnd("Team", 8),
      padEnd("Rarität", 11),
      padEnd("Kurve", 16),
      pad("Sponsor", 9),
      pad("Gehalt", 8),
      pad("Facility", 9),
      pad("Kredit", 7),
      pad("Kosten", 8),
      pad("Netto", 8),
      pad("CashNeu", 9),
      pad("Deckung", 8),
    ].join(" "),
  );
  console.log("-".repeat(120));
  for (const l of sorted) {
    const cover = l.totalCost > 0 ? l.sponsorIncome / l.totalCost : Infinity;
    const rarityLabel = l.rarity ? SPONSOR_RARITIES[l.rarity].labelDe : "-";
    const curveLabel = l.curveShape ? SPONSOR_CURVE_SHAPES[l.curveShape].labelDe : "-";
    console.log(
      [
        padEnd(l.finalRank, 3),
        padEnd(l.shortCode, 8),
        padEnd(rarityLabel, 11),
        padEnd(curveLabel, 16),
        pad(round(l.sponsorIncome), 9),
        pad(round(l.salary), 8),
        pad(round(l.facilityUpkeep), 9),
        pad(round(l.loan), 7),
        pad(round(l.totalCost), 8),
        pad(round(l.net), 8),
        pad(round(l.cashAfter), 9),
        pad(cover === Infinity ? "∞" : `${cover.toFixed(2)}x`, 8),
      ].join(" "),
    );
  }
  console.log("-".repeat(120));
  console.log(
    `Liga-Cash: ${round(summary.leagueCash)} | Liga-Marktwert: ${round(summary.leagueMarketValue)} | ` +
      `Sponsor-Summe: ${round(summary.totalSponsor)} | Kosten-Summe: ${round(summary.totalCost)}`,
  );
  console.log(
    `Schere Cash: Top ${round(summary.topCash)} / Bottom ${round(summary.bottomCash)} = ` +
      `${summary.bottomCash !== 0 ? (summary.topCash / summary.bottomCash).toFixed(2) : "∞"}x | ` +
      `Top5Ø ${round(summary.top5CashAvg)} / Bottom5Ø ${round(summary.bottom5CashAvg)} = ` +
      `${summary.bottom5CashAvg !== 0 ? (summary.top5CashAvg / summary.bottom5CashAvg).toFixed(2) : "∞"}x`,
  );
  console.log(
    `Sponsor deckt Kosten: ${summary.teamsPlus}/32 Plus, ${summary.teamsMinus}/32 Minus | ` +
      `ØDeckung ${summary.avgCoverRatio.toFixed(2)}x | Pleiten (cash<0): ${summary.bankrupt}`,
  );
  const rarityParts = SPONSOR_RARITY_KEYS.map(
    (r) => `${SPONSOR_RARITIES[r].labelDe}:${summary.rarityDist[r] ?? 0}`,
  );
  console.log(`Raritäts-Verteilung: ${rarityParts.join("  ")}`);
}

function buildSeasonSummary(seasonId: string, gameState: GameState, ledgers: TeamSeasonLedger[]): SeasonSummary {
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const leagueMarketValue = rows.reduce((sum, r) => sum + (r.marketValueTotal ?? 0), 0);
  const cashValues = gameState.teams.map((t) => t.cash).sort((a, b) => b - a);
  const leagueCash = cashValues.reduce((sum, c) => sum + c, 0);
  const top5 = cashValues.slice(0, 5);
  const bottom5 = cashValues.slice(-5);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

  let teamsPlus = 0;
  let teamsMinus = 0;
  let coverSum = 0;
  let coverCount = 0;
  for (const l of ledgers) {
    if (l.net >= 0) teamsPlus += 1;
    else teamsMinus += 1;
    if (l.totalCost > 0) {
      coverSum += l.sponsorIncome / l.totalCost;
      coverCount += 1;
    }
  }
  const rarityDist: Record<string, number> = {};
  for (const team of gameState.teams) {
    const { rarity } = sponsorMetaOf(gameState, team.teamId);
    if (rarity != null) rarityDist[rarity] = (rarityDist[rarity] ?? 0) + 1;
  }

  return {
    seasonId,
    leagueCash,
    leagueMarketValue,
    topCash: cashValues[0] ?? 0,
    bottomCash: cashValues[cashValues.length - 1] ?? 0,
    top5CashAvg: avg(top5),
    bottom5CashAvg: avg(bottom5),
    cashSpread: (cashValues[cashValues.length - 1] ?? 0) !== 0 ? (cashValues[0] ?? 0) / (cashValues[cashValues.length - 1] ?? 1) : Infinity,
    teamsPlus,
    teamsMinus,
    avgCoverRatio: coverCount > 0 ? coverSum / coverCount : 0,
    bankrupt: gameState.teams.filter((t) => t.cash < 0).length,
    rarityDist,
    totalSponsor: ledgers.reduce((s, l) => s + l.sponsorIncome, 0),
    totalCost: ledgers.reduce((s, l) => s + l.totalCost, 0),
  };
}

// ---------------------------------------------------------------------------
// Season-Übergang.
// ---------------------------------------------------------------------------
function transitionToNextSeason(gameState: GameState, nextSeasonId: string): GameState {
  // Beliebtheit fortschreiben (completed = aktuelle Saison), dann Verträge advancen + Saison-Id hoch.
  let next: GameState = {
    ...gameState,
    season: { ...gameState.season, id: nextSeasonId },
    seasonState: { ...gameState.seasonState, seasonId: nextSeasonId },
  };
  next = advanceTeamBeliebtheitForSeasonTransition({ completedGameState: gameState, nextGameState: next });
  next = advanceSponsorContractsForNewSeason(next, nextSeasonId);
  return next;
}

// ---------------------------------------------------------------------------
// Sanity-Check Ausgabe (nach Saison 1): 3 reichste + 3 ärmste Teams mit Kosten-Aufschlüsselung.
// ---------------------------------------------------------------------------
function printSanityCheck(ledgers: TeamSeasonLedger[]) {
  const byCash = [...ledgers].sort((a, b) => b.cashAfter - a.cashAfter);
  const richest = byCash.slice(0, 3);
  const poorest = byCash.slice(-3);
  console.log("");
  console.log("SANITY-CHECK (nach Saison 1)");
  console.log("-".repeat(96));
  const line = (l: TeamSeasonLedger, tag: string) =>
    `${padEnd(tag, 9)} ${padEnd(l.shortCode, 8)} Rk${padEnd(l.finalRank, 3)} ` +
    `${padEnd(l.rarity ? SPONSOR_RARITIES[l.rarity].labelDe : "-", 11)} ` +
    `${padEnd(l.curveShape ? SPONSOR_CURVE_SHAPES[l.curveShape].labelDe : "-", 16)} | ` +
    `sponsor ${pad(round(l.sponsorIncome), 8)} - gehalt ${pad(round(l.salary), 7)} - facility ${pad(round(l.facilityUpkeep), 7)} - ` +
    `kredit ${pad(round(l.loan), 5)} = netto ${pad(round(l.net), 8)} -> cash ${pad(round(l.cashAfter), 8)}`;
  for (const l of richest) console.log(line(l, "REICH"));
  for (const l of poorest) console.log(line(l, "ARM"));
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
function main() {
  const SEASONS = 5;
  console.log("Sponsor-Ökonomie Dry-Run — 5 Seasons (seeded, keine Matchday-Simulation)");
  console.log(`PRNG-Seed: 0x${SEED.toString(16).toUpperCase()}`);
  console.log("Facility-Upkeep-Quelle: previewFacilitySeasonEndFinance(...).facilityUpkeepTotal");

  let gameState = createSingleplayerGameState();
  // Facilities EINMALIG seeden (frischer Seed hat 0 gebaute Facilities -> sonst Upkeep 0).
  gameState = seedFacilities(gameState);

  const facProbe = gameState.teams.reduce(
    (acc, t) => {
      const f = computeFacilityFinance(gameState, t.teamId);
      return { upkeep: acc.upkeep + f.upkeep, income: acc.income + f.income };
    },
    { upkeep: 0, income: 0 },
  );
  console.log(
    `Facility-Upkeep nach Seeding: Liga-Summe ${round(facProbe.upkeep)} über ${gameState.teams.length} Teams ` +
      `(Ø ${round(facProbe.upkeep / gameState.teams.length)}/Team)`,
  );
  console.log(
    `INFO — Facility-Einnahmen (Fan-Shop+Arena, NICHT in Cash-Rechnung): Liga-Summe ${round(facProbe.income)} ` +
      `(Netto Facility Liga: ${round(facProbe.income - facProbe.upkeep)}). ` +
      `Die Cash-Rechnung zählt bewusst NUR Sponsor als Einkommen (kein Facility-Income, kein Preisgeld).`,
  );

  const summaries: SeasonSummary[] = [];
  let season1Ledgers: TeamSeasonLedger[] = [];

  for (let s = 1; s <= SEASONS; s += 1) {
    const seasonId = `season-${s}`;

    // 1) Sponsoren sicherstellen + AI-Pick (VOR finalRank, damit Angebote nicht in die Zukunft schauen).
    gameState = ensureSponsorContracts(gameState);

    // 2) Finish-Ränge zuweisen (Quality-Rank + seeded Varianz).
    gameState = assignFinalRanks(gameState);

    // Cash-Snapshot vor Settlement/Kosten.
    const cashBeforeByTeam = new Map(gameState.teams.map((t) => [t.teamId, t.cash]));

    // 3) Einkommen nach finalRank gutschreiben.
    const sponsorByTeam = new Map<string, number>();
    if (INCOME_MODE === "prize") {
      // Referenz-Benchmark: altes Preisgeld nach Rang (getPrizeMoneyReference), skaliert mit dem
      // Saison-Salary-Factor — exakt dieselbe Quelle, an der die Sponsor-Kurve kalibriert wurde.
      const sf = gameState.seasonState.seasonEconomyFactors?.[0]?.factor;
      const salaryFactor = typeof sf === "number" && Number.isFinite(sf) && sf > 0 ? sf : 1;
      const nextTeams = gameState.teams.map((team) => {
        const rank = (gameState.seasonState.standings?.[team.teamId] as { rank?: number })?.rank ?? 32;
        const prize = getPrizeMoneyReference(rank, salaryFactor);
        sponsorByTeam.set(team.teamId, round(prize, 2));
        return { ...team, cash: round(team.cash + prize, 2) };
      });
      gameState = { ...gameState, teams: nextTeams };
    } else {
      // Sponsor-Einnahmen settlen (nach finalRank). deductSalary=false — Gehälter ziehen wir selbst ab.
      const settlement = applySponsorSettlement({
        gameState,
        saveId: "sponsor-economy-dryrun",
        phase: "season_end",
        execute: true,
        deductSalary: false,
      });
      gameState = settlement.gameState;
      for (const team of gameState.teams) {
        sponsorByTeam.set(team.teamId, round((team.cash) - (cashBeforeByTeam.get(team.teamId) ?? 0), 2));
      }
    }

    // 4) Kosten je Team abziehen + Cash updaten.
    const ledgers: TeamSeasonLedger[] = [];
    const nextTeams = gameState.teams.map((team) => {
      const sponsorIncome = sponsorByTeam.get(team.teamId) ?? 0;
      const salary = getTeamDisplaySalaryTotal(gameState, team.teamId);
      const facilityUpkeep = computeFacilityUpkeep(gameState, team.teamId);
      const loan = getTeamAnnualLoanInstallment(gameState, team.teamId);
      const totalCost = round(salary + facilityUpkeep + loan, 2);
      const cashBefore = cashBeforeByTeam.get(team.teamId) ?? team.cash;
      // team.cash enthält bereits +sponsorIncome (aus applySponsorSettlement). Jetzt Kosten abziehen.
      const cashAfter = round(team.cash - totalCost, 2);
      ledgers.push({
        teamId: team.teamId,
        shortCode: team.shortCode,
        cashBefore,
        sponsorIncome,
        salary,
        facilityUpkeep,
        loan,
        totalCost,
        net: round(sponsorIncome - totalCost, 2),
        cashAfter,
        finalRank: (gameState.seasonState.standings?.[team.teamId] as { rank?: number })?.rank ?? 0,
        ...sponsorMetaOf(gameState, team.teamId),
      });
      return { ...team, cash: cashAfter };
    });
    gameState = { ...gameState, teams: nextTeams };

    // 5) Aggregate + Ausgabe.
    const summary = buildSeasonSummary(seasonId, gameState, ledgers);
    summaries.push(summary);
    printSeasonTable(seasonId, ledgers, summary);
    if (s === 1) {
      season1Ledgers = ledgers;
      printSanityCheck(ledgers);
    }

    // 6) Season-Übergang (außer nach letzter Saison).
    if (s < SEASONS) {
      gameState = transitionToNextSeason(gameState, `season-${s + 1}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Zusammenfassung über 5 Seasons.
  // ---------------------------------------------------------------------------
  const first = summaries[0];
  const last = summaries[summaries.length - 1];
  const cashGrowthPct = first.leagueCash !== 0 ? ((last.leagueCash - first.leagueCash) / first.leagueCash) * 100 : 0;
  const mvGrowthPct =
    first.leagueMarketValue !== 0 ? ((last.leagueMarketValue - first.leagueMarketValue) / first.leagueMarketValue) * 100 : 0;
  const spread = (sm: SeasonSummary) => (sm.bottomCash !== 0 ? sm.topCash / sm.bottomCash : Infinity);

  console.log("");
  console.log("#".repeat(96));
  console.log("ZUSAMMENFASSUNG — 5 SEASONS");
  console.log("#".repeat(96));
  console.log("");
  console.log(
    [
      padEnd("Saison", 9),
      pad("Liga-Cash", 12),
      pad("ΔCash%", 9),
      pad("Liga-MW", 11),
      pad("Schere", 9),
      pad("Top5/Bot5", 11),
      pad("Plus/Minus", 12),
      pad("ØDeck", 7),
      pad("Pleiten", 8),
    ].join(" "),
  );
  console.log("-".repeat(96));
  summaries.forEach((sm, i) => {
    const prev = i > 0 ? summaries[i - 1] : null;
    const dCash = prev && prev.leagueCash !== 0 ? ((sm.leagueCash - prev.leagueCash) / prev.leagueCash) * 100 : 0;
    const top5bot5 = sm.bottom5CashAvg !== 0 ? sm.top5CashAvg / sm.bottom5CashAvg : Infinity;
    console.log(
      [
        padEnd(sm.seasonId, 9),
        pad(round(sm.leagueCash), 12),
        pad(`${dCash >= 0 ? "+" : ""}${dCash.toFixed(1)}%`, 9),
        pad(round(sm.leagueMarketValue), 11),
        pad(`${spread(sm) === Infinity ? "∞" : spread(sm).toFixed(2)}x`, 9),
        pad(`${top5bot5 === Infinity ? "∞" : top5bot5.toFixed(2)}x`, 11),
        pad(`${sm.teamsPlus}/${sm.teamsMinus}`, 12),
        pad(`${sm.avgCoverRatio.toFixed(2)}x`, 7),
        pad(sm.bankrupt, 8),
      ].join(" "),
    );
  });
  console.log("-".repeat(96));
  console.log("");
  const totalBankrupt = summaries.reduce((s, sm) => s + sm.bankrupt, 0);
  const lastCover = last.teamsPlus;
  console.log(
    `Inflation über 5 Seasons: League-Cash S1→S5 ${round(first.leagueCash)}→${round(last.leagueCash)} ` +
      `(${cashGrowthPct >= 0 ? "+" : ""}${cashGrowthPct.toFixed(1)}%), ` +
      `Liga-Marktwert ${mvGrowthPct >= 0 ? "+" : ""}${mvGrowthPct.toFixed(1)}% (statisch: keine Roster-/Progression-Sim)`,
  );
  console.log(
    `Schere S1→S5: ${spread(first) === Infinity ? "∞" : spread(first).toFixed(2)}x → ` +
      `${spread(last) === Infinity ? "∞" : spread(last).toFixed(2)}x`,
  );
  console.log(`Pleiten gesamt (Team-Saisons mit cash<0): ${totalBankrupt}`);
  console.log(`Sponsor deckt Kosten (S5): ${lastCover}/32 Teams im Plus, ØDeckung ${last.avgCoverRatio.toFixed(2)}x`);
  const s5rarities = SPONSOR_RARITY_KEYS.map((r) => `${SPONSOR_RARITIES[r].labelDe}:${last.rarityDist[r] ?? 0}`).join("  ");
  console.log(`Raritäts-Verteilung (S5): ${s5rarities}`);
  void season1Ledgers;
}

main();

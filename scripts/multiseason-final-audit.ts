import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";

import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { summarizeBudgetDeploy } from "@/lib/ai/ai-budget-deploy-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const SUMMARY_ONLY = process.argv.includes("--summary-only");

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  if (process.argv.includes("--active")) {
    const active = persistence.getActiveSave();
    console.log("ACTIVE SAVE: " + (active ? `${active.saveId} · season=${active.gameState.season.id} · phase=${active.gameState.gamePhase}` : "(none)"));
    return;
  }

  const saveId = argValue("--save-id");
  if (!saveId) throw new Error("Provide --save-id <id>");
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const gs = save.gameState;
  const seasonId = gs.season.id;

  if (process.argv.includes("--history")) {
    const snaps = gs.seasonState.seasonSnapshots ?? [];
    console.log(`\n=== SEASON SNAPSHOTS (${snaps.length}) ===`);
    const coverage = new Map<string, Set<string>>();
    for (const snap of snaps) {
      const standings = snap.finalStandings ?? [];
      const teamSnaps = snap.teamSnapshots ?? [];
      console.log(`${snap.seasonId}: status=${snap.status ?? "?"} finalStandings=${standings.length} teamSnapshots=${teamSnaps.length} archivedAt=${snap.archivedAt ?? "?"}`);
      for (const rec of [...standings, ...teamSnaps]) {
        const set = coverage.get(rec.teamCode) ?? new Set<string>();
        set.add(snap.seasonId);
        coverage.set(rec.teamCode, set);
      }
    }
    console.log(`\n=== PER-TEAM SNAPSHOT COVERAGE (seasons present) ===`);
    for (const team of gs.teams) {
      const seasons = [...(coverage.get(team.shortCode) ?? [])].sort();
      console.log(`${team.shortCode}: ${seasons.length} -> [${seasons.join(", ")}]`);
    }
    const focusCodes = (argValue("--teams") ?? "W-W,N-N").split(",");
    for (const code of focusCodes) {
      console.log(`\n=== ${code} per-season snapshot ===`);
      for (const snap of snaps) {
        const rec = [...(snap.finalStandings ?? []), ...(snap.teamSnapshots ?? [])].find((r) => r.teamCode === code);
        if (!rec) {
          console.log(`${snap.seasonId}: (missing)`);
          continue;
        }
        console.log(
          `${snap.seasonId}: rank=${rec.rank} pts=${rec.points} cashEnd=${rec.cashEnd} mvEnd=${rec.marketValueEnd} salaryEnd=${rec.salaryEnd} buys=${rec.transferBuyCount}/${rec.transferBuyTotal ?? "?"} sells=${rec.transferSellCount}/${rec.transferSellTotal ?? "?"}`,
        );
      }
      const team = gs.teams.find((t) => t.shortCode === code);
      if (team) {
        const s1buys = gs.transferHistory.filter((t) => t.toTeamId === team.teamId && t.seasonId === "season-1");
        console.log(`  live: cash=${Math.round(team.cash)} budget=${Math.round(team.budget)} · S1 transferHistory buys=${s1buys.length} feeSum=${Math.round(s1buys.reduce((s, b) => s + (b.fee ?? 0), 0))}`);
      }
    }
    return;
  }

  const playerById = new Map(gs.players.map((p) => [p.id, p]));
  const teamByCode = new Map(gs.teams.map((t) => [t.shortCode, t]));
  const rosterByTeam = new Map<string, string[]>();
  for (const entry of gs.rosters) {
    const list = rosterByTeam.get(entry.teamId) ?? [];
    list.push(entry.playerId);
    rosterByTeam.set(entry.teamId, list);
  }

  // active contract salary per team
  const activeContractsByTeam = new Map<string, number>();
  const contractStatusCounts: Record<string, number> = {};
  for (const c of gs.contracts) {
    contractStatusCounts[c.status] = (contractStatusCounts[c.status] ?? 0) + 1;
    if (c.status === "active" && c.teamId) {
      activeContractsByTeam.set(c.teamId, (activeContractsByTeam.get(c.teamId) ?? 0) + (c.salary ?? 0));
    }
  }

  // ECONOMY per team
  const teamRows = gs.teams.map((team) => {
    const roster = rosterByTeam.get(team.teamId) ?? [];
    const players = roster.map((id) => playerById.get(id)).filter(Boolean) as typeof gs.players;
    const avgRating = players.length ? players.reduce((s, p) => s + (p.rating ?? 0), 0) / players.length : 0;
    const avgPot = players.length ? players.reduce((s, p) => s + (p.potential ?? 0), 0) / players.length : 0;
    const salaryTotal = activeContractsByTeam.get(team.teamId) ?? 0;
    return {
      code: team.shortCode,
      cash: Math.round(team.cash ?? 0),
      budget: Math.round(team.budget ?? 0),
      roster: roster.length,
      salaryTotal: Math.round(salaryTotal),
      avgRating: round(avgRating),
      avgPotential: round(avgPot),
    };
  });
  const negativeCashTeams = teamRows.filter((r) => r.cash < 0);
  const cashValues = teamRows.map((r) => r.cash).sort((a, b) => a - b);

  // POTENTIAL: rostered players potential vs current ability (rating)
  const rosteredPlayerIds = new Set(gs.rosters.map((r) => r.playerId));
  const rostered = gs.players.filter((p) => rosteredPlayerIds.has(p.id));
  const potOk = rostered.filter((p) => (p.potential ?? 0) >= (p.rating ?? 0));
  const potViolations = rostered.filter((p) => (p.potential ?? 0) < (p.rating ?? 0));

  // TRAINING: organic progression applied this/last season
  const orgThisSeason = rostered.filter((p) => p.lastOrganicProgression?.seasonId === seasonId);
  const orgAny = rostered.filter((p) => p.lastOrganicProgression);
  const orgWithGains = orgAny.filter((p) => (p.lastOrganicProgression?.netSetpoints ?? 0) > 0);
  const avgFatigue = rostered.length ? rostered.reduce((s, p) => s + (p.fatigue ?? 0), 0) / rostered.length : 0;
  const trainingModeCounts: Record<string, number> = {};
  for (const p of rostered) {
    const m = p.trainingMode ?? "none";
    trainingModeCounts[m] = (trainingModeCounts[m] ?? 0) + 1;
  }

  // TRANSFERS by season + type
  const transfersBySeason = new Map<string, { buy: number; sell: number; contract_exit: number; buyFee: number; sellFee: number }>();
  for (const t of gs.transferHistory) {
    const key = t.seasonId ?? "?";
    const row = transfersBySeason.get(key) ?? { buy: 0, sell: 0, contract_exit: 0, buyFee: 0, sellFee: 0 };
    row[t.transferType] = (row[t.transferType] ?? 0) + 1;
    if (t.transferType === "buy") row.buyFee += t.fee ?? 0;
    if (t.transferType === "sell") row.sellFee += t.fee ?? 0;
    transfersBySeason.set(key, row);
  }

  // IDENTITY: gender breakdown for flagged teams.
  // Exemption is a denylist of creature races that do NOT count toward the
  // female limit (even when male). Everything else counts (humans, orcs,
  // demons, constructs, aqua, plant, ...).
  const isFemale = (g: string) => ["female", "f", "weiblich", "w"].includes(g.toLowerCase());
  const isMale = (g: string) => ["male", "m", "männlich"].includes(g.toLowerCase());
  function genderBreakdown(code: string, exemptRaces: string[], femaleMinPct: number) {
    const team = teamByCode.get(code);
    if (!team) return null;
    const exempt = new Set(exemptRaces.map((r) => r.toLowerCase()));
    const roster = (rosterByTeam.get(team.teamId) ?? []).map((id) => playerById.get(id)).filter(Boolean) as typeof gs.players;
    const counts: Record<string, number> = {};
    const raceCounts: Record<string, number> = {};
    const players = roster.map((p) => ({ name: p.name, race: p.race ?? "?", gender: (p.gender ?? "?").toLowerCase() }));
    for (const p of players) {
      counts[p.gender] = (counts[p.gender] ?? 0) + 1;
      raceCounts[p.race] = (raceCounts[p.race] ?? 0) + 1;
    }
    const female = players.filter((p) => isFemale(p.gender)).length;
    // Counting population = roster minus exempt creature races.
    const counting = players.filter((p) => !exempt.has(p.race.toLowerCase()));
    const countingFemale = counting.filter((p) => isFemale(p.gender)).length;
    const countingFemalePct = round(pct(countingFemale, counting.length));
    // Non-exempt players that are NOT female (rule breakers): males always count
    // as a breach; "n" flagged separately for women-only teams.
    const nonExemptMales = counting.filter((p) => isMale(p.gender)).map((p) => `${p.name}:${p.race}`);
    const nonExemptNonFemale = counting.filter((p) => !isFemale(p.gender)).map((p) => `${p.name}:${p.race}:${p.gender}`);
    return {
      code,
      total: roster.length,
      exemptRaces,
      female,
      femalePct: round(pct(female, roster.length)),
      countingCount: counting.length,
      countingFemale,
      countingFemalePct,
      femaleMinPct,
      meetsMin: countingFemalePct >= femaleMinPct,
      nonExemptMales,
      nonExemptNonFemale,
      genders: counts,
      races: raceCounts,
      players,
    };
  }

  // GMs
  const gmAssignments = gs.seasonState.teamGeneralManagers ?? {};
  const gmRows = Object.values(gmAssignments).map((a) => ({
    teamId: a.teamId,
    gmId: a.gmId,
    influencePct: a.influencePct,
    source: a.source,
    dismissalReason: a.dismissalReason ?? null,
  }));
  const dismissals = gmRows.filter((g) => g.dismissalReason);

  const facilityEvents = gs.seasonState.facilityEvents ?? [];
  const facilityBySource: Record<string, number> = {};
  for (const event of facilityEvents) {
    facilityBySource[event.source ?? "?"] = (facilityBySource[event.source ?? "?"] ?? 0) + 1;
  }
  const facilityTeamRows = gs.teams.map((team) => {
    const facilities = getTeamFacilityState(gs, team.teamId);
    const levels = Object.fromEntries(
      FACILITY_CATALOG.map((facility) => [facility.facilityId, getFacilityLevel(facilities, facility.facilityId)]),
    );
    const levelSum = Object.values(levels).reduce((sum, level) => sum + level, 0);
    const roster = rosterByTeam.get(team.teamId) ?? [];
    const teamMw = roster.reduce((sum, playerId) => {
      const player = playerById.get(playerId);
      if (!player) return sum;
      return sum + (player.displayMarketValue ?? player.marketValue ?? 0);
    }, 0);
    return {
      code: team.shortCode,
      cash: Math.round(team.cash ?? 0),
      levelSum,
      levels,
      cashToMw: teamMw > 0 ? round((team.cash ?? 0) / teamMw, 2) : null,
    };
  });
  const allFacilitiesZeroTeams = facilityTeamRows.filter((row) => row.levelSum === 0).length;
  const budgetDeploy = summarizeBudgetDeploy(gs, seasonId);

  const report = {
    saveId,
    seasonId,
    gamePhase: gs.gamePhase,
    teams: gs.teams.length,
    players: gs.players.length,
    rosteredPlayers: rostered.length,
    economy: {
      negativeCashTeams: negativeCashTeams.map((r) => `${r.code}:${r.cash}`),
      cashMin: cashValues[0],
      cashMedian: cashValues[Math.floor(cashValues.length / 2)],
      cashMax: cashValues[cashValues.length - 1],
      totalCash: Math.round(cashValues.reduce((s, v) => s + v, 0)),
    },
    contracts: {
      statusCounts: contractStatusCounts,
      total: gs.contracts.length,
    },
    potential: {
      rostered: rostered.length,
      potGteCa: potOk.length,
      potGteCaPct: round(pct(potOk.length, rostered.length)),
      violations: potViolations.length,
      violationSample: potViolations.slice(0, 10).map((p) => `${p.name}:CA${p.rating}/POT${p.potential}`),
    },
    training: {
      organicThisSeason: orgThisSeason.length,
      organicEver: orgAny.length,
      organicWithNetGain: orgWithGains.length,
      avgFatigue: round(avgFatigue),
      trainingModeCounts,
    },
    transfers: {
      total: gs.transferHistory.length,
      bySeason: Object.fromEntries(
        [...transfersBySeason.entries()].sort().map(([k, v]) => [
          k,
          { ...v, buyFee: Math.round(v.buyFee), sellFee: Math.round(v.sellFee) },
        ]),
      ),
    },
    identity: {
      // D-P: only animals + dragons are exempt; >= 65% female among the rest.
      dp: genderBreakdown("D-P", ["animal", "dragon"], 65),
      // V-D: women-only; only animals exempt (may be male/n).
      vd: genderBreakdown("V-D", ["animal"], 100),
    },
    gms: {
      assignments: gmRows.length,
      influenceMin: gmRows.length ? Math.min(...gmRows.map((g) => g.influencePct)) : null,
      influenceMax: gmRows.length ? Math.max(...gmRows.map((g) => g.influencePct)) : null,
      dismissals: dismissals.length,
      dismissalSample: dismissals.slice(0, 8),
    },
    facilities: {
      allTeamsAllFacilitiesZero: allFacilitiesZeroTeams === gs.teams.length,
      allZeroTeamCount: allFacilitiesZeroTeams,
      facilityEventsTotal: facilityEvents.length,
      facilityEventsBySource: facilityBySource,
      leagueLevelSum: facilityTeamRows.reduce((sum, row) => sum + row.levelSum, 0),
      teamRows: facilityTeamRows,
    },
    budgetDeploy: {
      teamsNeedingDeploy: budgetDeploy.filter((row) => row.needsDeploy).length,
      medianDeployPct: (() => {
        const values = budgetDeploy.map((row) => row.deployPct).filter((value): value is number => value != null);
        if (values.length === 0) return null;
        values.sort((a, b) => a - b);
        return values[Math.floor(values.length / 2)];
      })(),
      rows: budgetDeploy,
    },
    teamRows: teamRows.sort((a, b) => b.cash - a.cash),
  };

  await mkdir(path.join(PROJECT_ROOT, "outputs"), { recursive: true });
  await writeFile(path.join(PROJECT_ROOT, "outputs", `multiseason-final-audit-${saveId}.json`), JSON.stringify(report, null, 2), "utf8");

  if (SUMMARY_ONLY) {
    console.log(
      JSON.stringify({
        saveId,
        seasonId,
        teamCount: report.teamRows.length,
        cashMedian: report.economy?.cashMedian ?? null,
        budgetDeployTeams: report.budgetDeploy?.teamsNeedingDeploy ?? null,
      }),
    );
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

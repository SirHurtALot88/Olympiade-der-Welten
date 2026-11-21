/**
 * BIT-GLEICHHEIT DER ALTEN REGEL (Belastung/Resistenz, 21.11.).
 *
 * Chris: die laufende Saison bestehender Spielstände (z. B. sein Save, Spieltag 12) bleibt beim alten
 * Verhalten. Dieser Test fährt eine ganze 20-Spieltage-Battle-Saison OHNE Belastungsstempel über die
 * echte Buchung — mit Attributen, echten Disziplinen und Slot-Rollen (die unter v2 die Last ändern
 * würden), gemischten Einsätzen (Schonen/Normal/Pushen), Traits, Trainingsmodi, Trainingsschicht,
 * D1-Teilbuchung + D2-Abschluss (Replay) und einem doppelten D2-Abschluss (forceReplace) — und
 * vergleicht einen Hash des Endstands mit dem Wert, den derselbe Test auf `origin/main` VOR dem Bau
 * ergab (nur Funktionen, die es dort schon gab). Weicht er ab, hat die Änderung die alte Regel berührt.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { GameState, LineupDraft, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import { applyFatigueAndInjuryAfterMatchday, getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";
import { buildSeasonSeededDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { accumulateMatchdayTrainingProgress } from "@/lib/training/matchday-training-accumulator";

/** Hash des Endstands auf origin/main (08d707c96), vor dem Bau von Belastung/Resistenz gemessen. */
const GOLDEN = "7ff0ddccea18f5db";

function zufall(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODI = ["leicht", "mittel", "hart"] as const;
const EINSAETZE = ["conserve", "normal", "push"] as const;

function baueLiga(): GameState {
  const r = zufall(4711);
  const plan = buildSeasonSeededDisciplineSchedule({
    saveId: "bit-gleich",
    seasonId: "season-1",
    disciplines: foundationSeedDisciplines,
    repeat: 2,
  }).entries.map((entry, index) => ({ ...entry, matchdayId: `md-${index + 1}` }));
  const teams: Team[] = [];
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (let t = 0; t < 8; t += 1) {
    const teamId = `T-${t}`;
    teams.push({ teamId, shortCode: teamId, name: teamId, budget: 50, cash: 50 } as unknown as Team);
    for (let p = 0; p < 11; p += 1) {
      const id = `p-${t}-${p}`;
      const traits = r() < 0.2 ? ["Healthy"] : r() < 0.25 ? ["FaintHearted"] : [];
      players.push({
        id,
        name: id,
        className: "Hero",
        race: "Human",
        traitsPositive: traits.filter((x) => x === "Healthy"),
        traitsNegative: traits.filter((x) => x === "FaintHearted"),
        coreStats: { pow: 60, spe: 60, men: 60, soc: 60 },
        fatigue: 0,
        form: 50,
        trainingMode: MODI[Math.floor(r() * 3)],
        attributeSheetStats: Object.fromEntries(playerGeneratorAttributeKeys.map((k) => [k, 1 + Math.floor(r() * 98)])),
      } as unknown as Player);
      rosters.push({ id: `r-${id}`, teamId, playerId: id } as unknown as RosterEntry);
    }
  }
  return {
    gamePhase: "matchday",
    scenarioMeta: { gameMode: "battle" },
    season: { id: "season-1", name: "S1", year: 1, currentMatchday: 1, matchdayIds: plan.map((e) => e.matchdayId) },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: plan,
      lineupDrafts: [],
      injuryEvents: [],
      playerAvailabilityState: [],
    },
    matchdayState: { matchdayId: "md-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: [],
    players,
    disciplines: foundationSeedDisciplines,
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerMoraleState: [],
    logs: [],
  } as unknown as GameState;
}

function stabil(wert: unknown): string {
  if (Array.isArray(wert)) return `[${wert.map(stabil).join(",")}]`;
  if (wert && typeof wert === "object") {
    return `{${Object.keys(wert as Record<string, unknown>)
      .sort()
      .filter((k) => (wert as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stabil((wert as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(wert);
}

function spieleAlteSaison(): string {
  let gs = baueLiga();
  const r = zufall(99);
  const plan = gs.seasonState.disciplineSchedule ?? [];
  for (let i = 0; i < plan.length; i += 1) {
    const md = plan[i]!;
    const matchdayId = md.matchdayId;
    const d1 = md.discipline1!;
    const d2 = md.discipline2!;
    const drafts: LineupDraft[] = gs.teams.map((team) => {
      const frei = gs.rosters
        .filter((ro) => ro.teamId === team.teamId)
        .map((ro) => ({ id: ro.playerId, v: getPlayerAvailabilityView(gs, ro.playerId, team.teamId, matchdayId) }))
        .filter((x) => !x.v.isUnavailable)
        .sort((a, b) => a.v.fatigue - b.v.fatigue || a.id.localeCompare(b.id))
        .map((x) => x.id);
      const n1 = d1.playerCount ?? 0;
      const n2 = d2.playerCount ?? 0;
      return {
        lineupId: `l-${team.teamId}-${matchdayId}`,
        saveId: "bit-gleich",
        seasonId: "season-1",
        matchdayId,
        teamId: team.teamId,
        status: "submitted",
        entries: [
          ...frei.slice(0, n1).map((playerId, slotIndex) => ({ disciplineId: d1.disciplineId, disciplineSide: "d1" as const, slotIndex, playerId, activePlayerId: playerId })),
          ...frei.slice(n1, n1 + n2).map((playerId, slotIndex) => ({ disciplineId: d2.disciplineId, disciplineSide: "d2" as const, slotIndex, playerId, activePlayerId: playerId })),
        ],
        modifiers: { d1: { intensity: EINSAETZE[Math.floor(r() * 3)] }, d2: { intensity: EINSAETZE[Math.floor(r() * 3)] } },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      } as LineupDraft;
    });
    gs = { ...gs, seasonState: { ...gs.seasonState, lineupDrafts: drafts } };
    const basis = { saveId: "bit-gleich", seasonId: "season-1", matchdayId, matchdayResultId: `res-${matchdayId}`, timestamp: "2026-01-01T00:00:00.000Z" };
    // D1-Teilbuchung, dann D2-Abschluss als Replay, an jedem dritten Spieltag ein zweiter D2-Abschluss.
    const teil = applyFatigueAndInjuryAfterMatchday({ ...basis, gameState: gs, commitThroughSide: "d1" });
    let voll = applyFatigueAndInjuryAfterMatchday({ ...basis, gameState: teil.gameState, commitThroughSide: "d2", isMatchdayReplay: true });
    if (i % 3 === 2) {
      voll = applyFatigueAndInjuryAfterMatchday({ ...basis, gameState: voll.gameState, commitThroughSide: "d2", isMatchdayReplay: true });
    }
    gs = accumulateMatchdayTrainingProgress({
      gameState: voll.gameState,
      seasonId: "season-1",
      matchdayId,
      deferredPlayerIds: voll.deferredPlayerIds,
      mitZuwachs: false,
    });
  }
  const kern = {
    availability: gs.seasonState.playerAvailabilityState,
    events: gs.seasonState.injuryEvents,
    // `updatedAt` des Trainings-Akkumulators ist eine Uhrzeit (new Date()), nicht Teil der Rechnung.
    fatigue: gs.players.map((p) => {
      const akku = { ...((p.seasonTrainingAccumulator ?? {}) as Record<string, unknown>) };
      delete akku.updatedAt;
      return [p.id, p.fatigue, akku];
    }),
  };
  return createHash("sha256").update(stabil(kern)).digest("hex").slice(0, 16);
}

describe("Belastung/Resistenz: alte Regel bit-identisch", () => {
  it("eine ganze Saison ohne Stempel ergibt exakt den Stand von vor dem Bau", () => {
    const hash = spieleAlteSaison();
    if (process.env.BELASTUNG_GOLDEN_DRUCKEN) console.log(`GOLDEN ${hash}`);
    expect(hash).toBe(GOLDEN);
  }, 120_000);
});

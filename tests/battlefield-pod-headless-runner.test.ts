/**
 * Abnahme fuer `runBattlefieldPodFixtures()` (02.11. abends, lib/battle/arena-headless-runner.ts):
 * der Liga-Weg in das Gefecht je Ort (`window.__arena.spieleBattlefieldPod`) gegen echten Chromium.
 *
 *  - ein echter Vier-Team-Pod liefert Platz 1..4 (2-1-0-0), genau k Kaempfer je Team mit playerId,
 *    Anteil (Summe 100) und roher Wertung;
 *  - deterministisch je Saat, eine andere Saat ergibt ein anderes Gefecht;
 *  - ein Team ohne Kader liefert `null` an seiner Position (Rueckfall des Aufrufers).
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runBattlefieldPodFixtures } from "@/lib/battle/arena-headless-runner";
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const LAUF_TIMEOUT_MS = 120_000;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  try {
    return readdirSync(join(homedir(), ".cache", "ms-playwright")).some((e) => e.startsWith("chromium"));
  } catch {
    return false;
  }
}

function baueKader(teamId: string, prefix: string, staerke: number, anzahl = 8): { players: Player[]; rosters: RosterEntry[] } {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (let i = 0; i < anzahl; i += 1) {
    const playerId = `${prefix}-${i}`;
    const b = staerke + i;
    players.push({
      id: playerId,
      name: `${prefix} Spieler ${i}`,
      rating: 50,
      marketValue: 100_000,
      salaryDemand: 10_000,
      className: "Warrior",
      race: "Human",
      alignment: "neutral",
      gender: "diverse",
      subclasses: ["Warrior"],
      traitsPositive: ["Loyal"],
      traitsNegative: [],
      disciplineRatings: { battlefield: b, tdm: 20 + i, spurt: 20 + i },
      attributeSheetStats: {
        power: b, health: b + 5, stamina: b, intelligence: b + 3, awareness: b, determination: b,
        speed: 40, dexterity: 40, charisma: b + 4, will: 40, spirit: b + 2, torment: b - 2,
      },
      preferredDisciplineIds: ["battlefield"],
    } as unknown as Player);
    rosters.push({ id: `roster-${playerId}`, teamId, playerId, contractLength: 3 } as unknown as RosterEntry);
  }
  return { players, rosters };
}

function baueGameState(teams: Array<{ teamId: string; prefix: string; staerke: number; anzahl?: number }>): GameState {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (const t of teams) {
    const k = baueKader(t.teamId, t.prefix, t.staerke, t.anzahl);
    players.push(...k.players);
    rosters.push(...k.rosters);
  }
  return { players, rosters } as unknown as GameState;
}

const TEAMS = [
  { teamId: "team-a", prefix: "A", staerke: 40 },
  { teamId: "team-b", prefix: "B", staerke: 50 },
  { teamId: "team-c", prefix: "C", staerke: 60 },
  { teamId: "team-d", prefix: "D", staerke: 70 },
];
const POD = { podId: "pod-1", teamIds: ["team-a", "team-b", "team-c", "team-d"] as const, seed: "bf-pod-seed" };

describe.skipIf(!chromiumVerfuegbar())("runBattlefieldPodFixtures", () => {
  it(
    "liefert ein echtes Gefecht je Ort: Platz 1..4, k Kaempfer je Team, deterministisch",
    async () => {
      const gameState = baueGameState(TEAMS);
      const [erster] = await runBattlefieldPodFixtures(gameState, [{ ...POD, teamIds: [...POD.teamIds] as [string, string, string, string] }], { k: 3 });
      const [zweiter] = await runBattlefieldPodFixtures(gameState, [{ ...POD, teamIds: [...POD.teamIds] as [string, string, string, string] }], { k: 3 });
      const [andere] = await runBattlefieldPodFixtures(gameState, [{ ...POD, seed: "andere-saat", teamIds: [...POD.teamIds] as [string, string, string, string] }], { k: 3 });
      expect(erster).not.toBeNull();
      const pod = erster!;
      expect(pod.teams.map((t) => t.teamId)).toEqual([...POD.teamIds]);
      expect([...pod.teams.map((t) => t.eventPlatz)].sort()).toEqual([1, 2, 3, 4]);
      expect(pod.teams.reduce((s, t) => s + t.ligaPunkte, 0)).toBeCloseTo(3, 9);
      expect(pod.boxscore).toHaveLength(12);
      for (const teamId of POD.teamIds) expect(pod.boxscore.filter((e) => e.teamId === teamId)).toHaveLength(3);
      for (const e of pod.boxscore) {
        expect(e.playerId).toMatch(/^[A-D]-\d$/);
        expect(e.wertung).toBeGreaterThan(0);
      }
      expect(pod.boxscore.reduce((s, e) => s + e.anteil, 0)).toBeCloseTo(100, 6);
      expect(zweiter).toEqual(erster);
      expect(andere).not.toEqual(erster);
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "ein Pod mit einem Team ohne Kader liefert null an seiner Position",
    async () => {
      const gameState = baueGameState([...TEAMS.slice(0, 3), { teamId: "team-d", prefix: "D", staerke: 70, anzahl: 0 }]);
      const ergebnisse = await runBattlefieldPodFixtures(gameState, [{ ...POD, teamIds: [...POD.teamIds] as [string, string, string, string] }], { k: 3 });
      expect(ergebnisse).toEqual([null]);
    },
    LAUF_TIMEOUT_MS,
  );
});

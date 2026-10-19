/**
 * STAFFEL MIT WENIGER ALS SECHS AUFGESTELLTEN LAEUFERN MUSS INS ZIEL KOMMEN.
 *
 * GEMELDET VON CHRIS (19.10., Spieltage-Review PR #1295, Punkt 2): "Staffel zeigt 0,0". An einem
 * echten 20-Spieltage-Battle-Save nachgemessen: ALLE 64 Staffel-Zeilen standen auf
 * `duellSeiten:[0,0]`, `teamPoints:1` — jede Staffel der Saison ein erzwungenes Remis.
 *
 * URSACHE (Opus-Review PR #1295): die Saison wuerfelt die Feldgroesse jeder Disziplin 2..6
 * (`buildSeasonPlayerCountByDiscipline()`), in jenem Save stand die Staffel auf FUENF Laeufer.
 * Mit Aufstellung laufen dann fuenf Laeufer je Seite, `bauSpurt()` (battle-mode.engine.js) setzte
 * die Beingrenzen aber fest auf `idx/art.jeSeite` = `idx/6`. Der fuenfte Laeufer endete bei
 * `beinBis = 5/6`, der Wechsel-Zweig fand keinen sechsten Nehmer, keine Seite kam je ins Ziel —
 * `spieleBahn()` lieferte nach dem Zeitbudget `[0,0]`. Ohne Aufstellung (Ersatzaufstellung, jede
 * kaderfeste Messung) liefen immer sechs Laeufer, deshalb blieb es in allen Messungen unsichtbar —
 * und auch eine nachtraegliche Sonde gegen den Save sah es nicht, weil sie den Entwurf eines
 * VERGANGENEN Spieltags nicht mehr las (`buildArenaAufstellungBeide()` liest den Entwurf des
 * AKTUELLEN `matchdayState.matchdayId`).
 *
 * Dieser Test stellt genau das nach: zwei Teams, je fuenf Staffel-Slots im Entwurf des aktuellen
 * Spieltags, und prueft, dass jedes Rennen einen Sieger hat und fuenf Laeufer je Seite im
 * Boxscore stehen. Dazu die Gegenprobe mit sechs Slots.
 *
 * ECHTER CHROMIUM (Muster `arena-headless-runner.test.ts`): der Motor ist ein IIFE mit DOM-/
 * Canvas-Zugriff. `full-test-suite` faehrt ohne Chromium -> `describe.skipIf`.
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runArenaFixtures } from "@/lib/battle/arena-headless-runner";
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const LAUF_TIMEOUT_MS = 120_000;
const MATCHDAY_ID = "season-1-matchday-3";

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  const cache = join(homedir(), ".cache", "ms-playwright");
  try {
    return readdirSync(cache).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}

const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();

/**
 * Zehn Spieler je Team (nicht genau sechs, s. Kommentar an `baueKader` in arena-headless-runner.test.ts).
 * `versatz` macht beide Teams VERSCHIEDEN stark: zwei identische Kader kommen auf der diskreten
 * Rennuhr gelegentlich im selben Tick ins Ziel — ein echtes Remis (`[0,0]`), das hier nicht mit dem
 * Fehlerbild "keine Seite kommt je ins Ziel" verwechselt werden soll.
 */
function baueKader(teamId: string, prefix: string, versatz: number): { players: Player[]; rosters: RosterEntry[] } {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (let i = 0; i < 10; i += 1) {
    const playerId = `${prefix}-${i}`;
    players.push({
      id: playerId,
      name: `${prefix} Laeufer ${i}`,
      rating: 50,
      className: "Warrior",
      race: "Human",
      subclasses: ["Warrior"],
      traitsPositive: ["Loyal"],
      traitsNegative: [],
      disciplineRatings: { staffel: 30 + i * 3 + versatz, tdm: 20 + i, spurt: 20 + i },
      attributeSheetStats: {
        power: 40 + i + versatz,
        health: 50 + i + versatz,
        stamina: 45 + i + versatz,
        intelligence: 30 + i + versatz,
        awareness: 35 + i + versatz,
        determination: 40 + i + versatz,
        speed: 55 + i + versatz,
        dexterity: 50 + i + versatz,
        charisma: 20 + i + versatz,
        will: 30 + i + versatz,
        spirit: 25 + i + versatz,
        torment: 10 + i + versatz,
      },
      preferredDisciplineIds: ["staffel"],
    } as unknown as Player);
    rosters.push({ id: `roster-${playerId}`, teamId, playerId, contractLength: 3 } as unknown as RosterEntry);
  }
  return { players, rosters };
}

function baueGameState(laeuferJeSeite: number): GameState {
  const heim = baueKader("team-heim", "Heim", 0);
  const gast = baueKader("team-gast", "Gast", 4);
  const entwurf = (teamId: string, players: Player[]) => ({
    lineupId: `lineup-${teamId}`,
    saveId: "save-test",
    seasonId: "season-1",
    matchdayId: MATCHDAY_ID,
    teamId,
    status: "submitted",
    entries: players.slice(0, laeuferJeSeite).map((player, slotIndex) => ({
      playerId: player.id,
      disciplineId: "staffel",
      slotIndex,
    })),
    createdAt: "2026-10-19T00:00:00.000Z",
    updatedAt: "2026-10-19T00:00:00.000Z",
  });
  return {
    players: [...heim.players, ...gast.players],
    rosters: [...heim.rosters, ...gast.rosters],
    matchdayState: { matchdayId: MATCHDAY_ID },
    seasonState: {
      lineupDrafts: [entwurf("team-heim", heim.players), entwurf("team-gast", gast.players)],
    },
  } as unknown as GameState;
}

const FIXTURES = ["s1", "s2", "s3", "s4"].map((seed) => ({ homeTeamId: "team-heim", awayTeamId: "team-gast", seed }));

describe.skipIf(!CHROMIUM_VERFUEGBAR)("Staffel mit Aufstellung unter sechs Laeufern", () => {
  it.each([5, 4, 2])(
    "%i Laeufer je Seite: jedes Rennen hat einen Sieger, kein [0,0]-Remis",
    async (laeufer) => {
      const ergebnisse = await runArenaFixtures(baueGameState(laeufer), FIXTURES, "staffel", { mutatoren: [] });
      expect(ergebnisse).toHaveLength(FIXTURES.length);
      for (const ergebnis of ergebnisse) {
        expect(ergebnis.seiten).not.toEqual([0, 0]);
        expect(ergebnis.seiten[0] + ergebnis.seiten[1]).toBe(1);
        // Die Aufstellung kommt an: genau `laeufer` je Seite stehen im Boxscore.
        expect(ergebnis.boxscore.filter((eintrag) => eintrag.side === "home")).toHaveLength(laeufer);
        expect(ergebnis.boxscore.filter((eintrag) => eintrag.side === "away")).toHaveLength(laeufer);
      }
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "Gegenprobe: sechs Laeufer je Seite (der Fall, den jede kaderfeste Messung faehrt) laufen weiter durch",
    async () => {
      const ergebnisse = await runArenaFixtures(baueGameState(6), FIXTURES, "staffel", { mutatoren: [] });
      for (const ergebnis of ergebnisse) {
        expect(ergebnis.seiten[0] + ergebnis.seiten[1]).toBe(1);
      }
    },
    LAUF_TIMEOUT_MS,
  );
});

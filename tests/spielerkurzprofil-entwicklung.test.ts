/**
 * Entwicklung im Kurzprofil (21.11.): die Zahlen stammen aus der buchenden Rechnung (`prognostiziereSpieltagsTraining`),
 * nicht aus einer zweiten. Geprüft: Ziel/Weg, Zuwachs == Summe der Attribut-Zuwächse, Potenzial-Faktor >= 1,
 * Maximum-Bremse bei Attribut 99, Verletzung sperrt.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { baueKurzEntwicklung } from "@/lib/foundation/spielerprofil-kurz-entwicklung";
import { prognostiziereSpieltagsTraining, setzeTrainingsZiel, trainingsProfilFuerZiel } from "@/lib/training/spieltag-training";

const IDS = Array.from({ length: 20 }, (_, i) => `md-${i + 1}`);
let BASIS: GameState;
let SPIELER_ID: string;

beforeAll(() => {
  const voll = createSingleplayerGameState();
  const teams = [...new Set(voll.rosters.map((r) => r.teamId))].slice(0, 2);
  const rosters = voll.rosters.filter((r) => teams.includes(r.teamId));
  const imKader = new Set(rosters.map((r) => r.playerId));
  BASIS = {
    ...voll,
    teams: voll.teams.filter((t) => teams.includes(t.teamId)),
    rosters,
    players: voll.players.filter((p) => imKader.has(p.id)).map((p) => ({ ...p, trainingMode: "mittel" as const, fatigue: 0 })),
    season: { ...voll.season, matchdayIds: IDS, totalMatchdays: 20 },
    matchdayState: { ...voll.matchdayState, matchdayId: "md-1" },
  };
  SPIELER_ID = rosters[0]!.playerId;
}, 60_000);

describe("baueKurzEntwicklung", () => {
  it("liefert Ziel, Weg und Zuwachs aus derselben Rechnung wie die Buchung", () => {
    const gs = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 1 });
    const kurz = baueKurzEntwicklung(gs, SPIELER_ID)!;
    const roh = prognostiziereSpieltagsTraining({ gameState: gs, playerId: SPIELER_ID });
    if (!roh || roh.verletzt) throw new Error("keine Vorschau");
    expect(kurz.ziel).toMatchObject({ disziplinId: "gewichtheben", weg: 1, art: "neben", quelle: "manager" });
    expect(kurz.zuwachsJeSpieltag).toBe(roh.summe);
    expect(kurz.profil.map((p) => p.attribute)).toEqual(trainingsProfilFuerZiel({ disziplinId: "gewichtheben", weg: 1 }).map((p) => p.attribute));
    expect(kurz.zuwachsAttribute.reduce((a, e) => a + e.wert, 0)).toBeCloseTo(roh.summe, 2);
    expect(kurz.potenzialFaktor === null || kurz.potenzialFaktor >= 1).toBe(true);
    expect(kurz.modus).toBe("mittel");
  });

  it("Primärweg heißt weg 0", () => {
    const gs = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    expect(baueKurzEntwicklung(gs, SPIELER_ID)!.ziel?.art).toBe("primaer");
  });

  it("ein Attribut am Maximum 99 erscheint als Maximum-Bremse", () => {
    const gs0 = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    const haupt = trainingsProfilFuerZiel({ disziplinId: "gewichtheben", weg: 0 })[0]!.attribute;
    const voll: GameState = {
      ...gs0,
      players: gs0.players.map((p) => (p.id === SPIELER_ID ? { ...p, attributeSheetStats: { ...p.attributeSheetStats, [haupt]: 99 } as Player["attributeSheetStats"] } : p)),
    };
    const kurz = baueKurzEntwicklung(voll, SPIELER_ID)!;
    expect(kurz.bremse?.mitMaximum).toBe(true);
    expect(kurz.bremse?.verlustProzent).toBeGreaterThan(0);
  });

  it("ein verletzter Spieler hat am nächsten Spieltag keinen Zuwachs", () => {
    const team = BASIS.rosters.find((r) => r.playerId === SPIELER_ID)!.teamId;
    const gs: GameState = {
      ...BASIS,
      matchdayState: { ...BASIS.matchdayState, matchdayId: "md-2" },
      seasonState: {
        ...BASIS.seasonState,
        playerAvailabilityState: [
          { playerId: SPIELER_ID, teamId: team, fatigue: 40, injuryStatus: "injured" as const, injuredAtMatchdayId: "md-1", injuryUntilMatchday: "md-2", injuredAtSeasonId: BASIS.season.id },
        ],
      },
    };
    const kurz = baueKurzEntwicklung(gs, SPIELER_ID)!;
    expect(kurz.verletzt).toBe(true);
    expect(kurz.zuwachsJeSpieltag).toBeNull();
    expect(kurz.bremse).toBeNull();
  });

  it("unbekannter Spieler: null", () => {
    expect(baueKurzEntwicklung(BASIS, "gibt-es-nicht")).toBeNull();
  });
});

import { beforeAll, describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { getPlayerActiveRecoveryCredit, projectMatchdayInjuryRisk } from "@/lib/fatigue/fatigue-injury-service";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";
import { berechneBelastungsForecast, RISIKO_SCHWELLE } from "@/lib/training/belastungs-forecast";
import { prognostiziereDisziplinTraining } from "@/lib/training/disziplin-trainings-prognose";
import { accumulateMatchdayTrainingProgress } from "@/lib/training/matchday-training-accumulator";
import { setzeTrainingsZiel } from "@/lib/training/spieltag-training";
import { baueWirkungVergleich, prognostiziereTrainingAbRueckkehr, waehleTopWirkung } from "@/lib/training/training-wirkung";

const IDS = Array.from({ length: 20 }, (_, i) => `md-${i + 1}`);
let VOLL: GameState;
let BROWSER: GameState;
let SPIELER_ID: string;
let TEAM_ID: string;

function mitSpieltag(gs: GameState, id = "md-1"): GameState {
  return { ...gs, matchdayState: { ...gs.matchdayState, matchdayId: id } };
}

/** Ganze Liga mit vollen Attributbögen (Server-Sicht) und dieselbe, nur die fremden Kader verdeckt (Browser-Sicht). */
beforeAll(() => {
  const voll = createSingleplayerGameState();
  const teams = [...new Set(voll.rosters.map((r) => r.teamId))].slice(0, 2);
  const rosters = voll.rosters.filter((r) => teams.includes(r.teamId));
  VOLL = {
    ...voll,
    players: voll.players.map((p) => ({ ...p, trainingMode: "mittel" as const, fatigue: 0 })),
    season: { ...voll.season, matchdayIds: IDS, totalMatchdays: 20 },
  };
  SPIELER_ID = rosters[0]!.playerId;
  TEAM_ID = rosters[0]!.teamId;
  const eigene = new Set(voll.rosters.filter((r) => r.teamId === TEAM_ID).map((r) => r.playerId));
  BROWSER = {
    ...VOLL,
    players: VOLL.players.map((p) => (eigene.has(p.id) ? p : ({ ...p, attributeSheetStats: undefined } as Player))),
  };
}, 60_000);

function spieler(gs: GameState, id = SPIELER_ID): Player {
  return gs.players.find((p) => p.id === id)!;
}

describe("Wo das ankommt: Eignung gegen den gespeicherten Wert, nicht gegen den Browser-Rang", () => {
  it("verdeckte fremde Kader ergeben nicht 99, sondern den Wert der Plan-Kacheln (Ursache der 99,3)", () => {
    const gs = mitSpieltag(setzeTrainingsZiel(BROWSER, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 }));
    const p = prognostiziereDisziplinTraining({ gameState: gs, playerId: SPIELER_ID })!;
    expect(p.eignungsModus).toBe("schaetzung");
    for (const z of p.zeilen) {
      expect(z.heute).toBe(spieler(gs).disciplineRatings?.[z.disziplinId]);
      expect(Math.abs(z.prognose - z.heute)).toBeLessThan(3);
    }
  });

  it("der Attributzuwachs kommt über die Matrix in mehreren Disziplinen an, nicht nur im Ziel", () => {
    for (const gs of [BROWSER, VOLL]) {
      const g = mitSpieltag(setzeTrainingsZiel(gs, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 }));
      const p = prognostiziereDisziplinTraining({ gameState: g, playerId: SPIELER_ID })!;
      expect(Object.keys(p.zuwachsJeAttribut).length).toBeGreaterThan(1);
      const mitPlus = p.zeilen.filter((z) => z.delta > 0);
      expect(mitPlus.length).toBeGreaterThan(3);
      expect(mitPlus.some((z) => !z.istZiel)).toBe(true);
      expect(p.zeilen.length).toBe(officialDisciplineWeightOrder.length);
    }
  });

  it("Schätzung (Browser) und exakte Liga (Server) liegen nah beieinander", () => {
    const ziel = { disziplinId: "gewichtheben", weg: 0 as const };
    const voll = prognostiziereDisziplinTraining({ gameState: mitSpieltag(VOLL), playerId: SPIELER_ID, ziel })!;
    const browser = prognostiziereDisziplinTraining({ gameState: mitSpieltag(BROWSER), playerId: SPIELER_ID, ziel })!;
    expect(voll.eignungsModus).toBe("liga");
    const nachId = new Map(browser.zeilen.map((z) => [z.disziplinId, z]));
    const abstand = voll.zeilen.map((z) => Math.abs(z.delta - nachId.get(z.disziplinId)!.delta));
    expect(abstand.reduce((a, b) => a + b, 0) / abstand.length).toBeLessThan(0.5);
  });

  it("Top-N: größter Zuwachs zuerst, genau n Zeilen", () => {
    const p = prognostiziereDisziplinTraining({ gameState: mitSpieltag(BROWSER), playerId: SPIELER_ID })!;
    const top = waehleTopWirkung(p.zeilen, 6);
    expect(top).toHaveLength(6);
    for (let i = 1; i < top.length; i += 1) expect(top[i - 1]!.delta).toBeGreaterThanOrEqual(top[i]!.delta);
    const rest = p.zeilen.filter((z) => !top.includes(z));
    expect(Math.max(...rest.map((z) => z.delta))).toBeLessThanOrEqual(top[5]!.delta);
    expect(waehleTopWirkung(p.zeilen, 0)).toHaveLength(0);
  });
});

describe("Plan-Vorschau: Top 5 bisher -> mit Änderung", () => {
  it("fünf Zeilen, der neue Plan hart wirkt mindestens so stark wie leicht", () => {
    const gs = mitSpieltag(BROWSER);
    const bisher = { ziel: { disziplinId: "gewichtheben", weg: 0 }, modus: "leicht" as const };
    const v = baueWirkungVergleich({ gameState: gs, playerId: SPIELER_ID, bisher, neu: { ...bisher, modus: "hart" }, anzahl: 5 })!;
    expect(v.zeilen).toHaveLength(5);
    for (const z of v.zeilen) expect(z.deltaNeu).toBeGreaterThanOrEqual(z.deltaBisher - 1e-9);
    expect(v.zeilen.some((z) => z.deltaNeu > z.deltaBisher)).toBe(true);
  });

  it("unveränderter Plan: bisher == neu", () => {
    const plan = { ziel: { disziplinId: "tdm", weg: 1 }, modus: "mittel" as const };
    const v = baueWirkungVergleich({ gameState: mitSpieltag(BROWSER), playerId: SPIELER_ID, bisher: plan, neu: plan })!;
    for (const z of v.zeilen) {
      expect(z.deltaBisher).toBe(z.deltaNeu);
      expect(z.bisher).toBe(z.neu);
    }
  });
});

describe("Verletzte: Prognose ab dem erwarteten Rückkehr-Spieltag", () => {
  function verletzt(bis: string, jetzt = "md-2"): GameState {
    const gs = mitSpieltag(setzeTrainingsZiel(VOLL, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 }), jetzt);
    return {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        playerAvailabilityState: [
          { playerId: SPIELER_ID, teamId: TEAM_ID, fatigue: 60, injuryStatus: "injured" as const, injuredAtMatchdayId: "md-1", injuryUntilMatchday: bis, injuredAtSeasonId: gs.season.id },
        ],
      },
    };
  }

  it("Zuwachs je Spieltag steht trotz Verletzung da und nennt den Rückkehr-Spieltag", () => {
    const p = prognostiziereTrainingAbRueckkehr({ gameState: verletzt("md-3"), playerId: SPIELER_ID });
    expect(p && !p.verletzt).toBe(true);
    if (!p || p.verletzt) return;
    expect(p.nachVerletzung).toBe(true);
    expect(p.abSpieltag.matchdayId).toBe("md-4");
    expect(p.abSpieltag.nummer).toBe(4);
    expect(p.summe).toBeGreaterThan(0);
  });

  it("gesund: ab dem nächsten Spieltag, ohne Hinweis", () => {
    const p = prognostiziereTrainingAbRueckkehr({ gameState: mitSpieltag(setzeTrainingsZiel(VOLL, SPIELER_ID, { disziplinId: "tdm", weg: 0 }), "md-5"), playerId: SPIELER_ID });
    expect(p && !p.verletzt && p.nachVerletzung).toBe(false);
    expect(p && !p.verletzt && p.abSpieltag.nummer).toBe(5);
  });

  it("Wo das ankommt rechnet ab Rückkehr: weniger Trainingstage als im gesunden Fall, Hinweis auf den ersten Spieltag", () => {
    const krank = prognostiziereDisziplinTraining({ gameState: verletzt("md-5"), playerId: SPIELER_ID })!;
    const gesund = prognostiziereDisziplinTraining({ gameState: mitSpieltag(setzeTrainingsZiel(VOLL, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 }), "md-2"), playerId: SPIELER_ID })!;
    expect(krank.verletztJetzt).toBe(true);
    expect(krank.ersterTrainingsSpieltag?.nummer).toBe(6);
    expect(krank.spieltageVerletzt).toBe(4);
    expect(krank.spieltageTrainiert).toBe(gesund.spieltageTrainiert - 4);
    expect(krank.zeilen.some((z) => z.delta > 0)).toBe(true);
    const v = baueWirkungVergleich({ gameState: verletzt("md-5"), playerId: SPIELER_ID, bisher: { ziel: { disziplinId: "gewichtheben", weg: 0 }, modus: "mittel" }, neu: { ziel: { disziplinId: "gewichtheben", weg: 0 }, modus: "mittel" } })!;
    expect(v.ersterTrainingsSpieltag?.nummer).toBe(6);
    expect(v.verletztJetzt).toBe(true);
  });

  it("Bis Saisonende verletzt: ehrliche Meldung statt Zahl", () => {
    const p = prognostiziereTrainingAbRueckkehr({ gameState: verletzt("md-20", "md-19"), playerId: SPIELER_ID });
    expect(p?.verletzt).toBe(true);
  });
});

describe("Belastungs-Forecast je Intensität: gezeigt = gebucht", () => {
  it("drei Stufen, hart >= mittel >= leicht, Werte in 0..100, Fenster bis Saisonende", () => {
    const gs = mitSpieltag(VOLL, "md-4");
    const f = berechneBelastungsForecast({ gameState: gs, playerId: SPIELER_ID })!;
    expect(f.naechsterSpieltag).toBe(4);
    for (const m of ["leicht", "mittel", "hart"] as const) {
      expect(f.stufen[m].punkte).toHaveLength(17);
      for (const p of f.stufen[m].punkte) {
        expect(p.wert).toBeGreaterThanOrEqual(0);
        expect(p.wert).toBeLessThanOrEqual(100);
      }
    }
    expect(f.stufen.hart.ende).toBeGreaterThanOrEqual(f.stufen.mittel.ende);
    expect(f.stufen.mittel.ende).toBeGreaterThanOrEqual(f.stufen.leicht.ende);
    expect(f.stufen.hart.ersterUeberSchwelle).not.toBeNull();
    expect(RISIKO_SCHWELLE).toBe(25);
  });

  it("erster Punkt = Konto nach dem Einsatz (projectMatchdayInjuryRisk) + Trainingsschicht eines Spieltags (Buchung des Akkumulators)", () => {
    const gs = mitSpieltag(VOLL, "md-1");
    const f = berechneBelastungsForecast({ gameState: gs, playerId: SPIELER_ID, spieltage: 1 })!;
    const einsatz = projectMatchdayInjuryRisk({
      player: spieler(gs),
      currentFatigue: 0,
      intensity: "normal",
      activeRecovery: getPlayerActiveRecoveryCredit(gs, TEAM_ID, "hart"),
    });
    // Trainingsschicht der Buchung: Modus hart bucht 22 / 20 Spieltage (ohne Reha-Gebaeude), siehe matchday-training-accumulator.
    const gebucht = accumulateMatchdayTrainingProgress({
      gameState: { ...gs, players: gs.players.map((p) => (p.id === SPIELER_ID ? { ...p, trainingMode: "hart" as const } : p)) },
      seasonId: gs.season.id,
      matchdayId: "md-1",
      ausfallSpielerIds: new Set(),
    });
    const schicht = spieler(gebucht).seasonTrainingAccumulator!.accumulatedTrainingFatigue;
    expect(schicht).toBeGreaterThan(0);
    const hart = f.stufen.hart.punkte[0]!;
    expect(hart.ausfall).toBe(false);
    expect(hart.wert).toBeCloseTo(Math.min(100, einsatz.fatigueBeforeRoll + schicht), 2);
  });

  it("Ausfall-Spieltag: kein Wurf, Risiko 0, Belastung sinkt", () => {
    const gs = mitSpieltag(VOLL, "md-2");
    const krank: GameState = {
      ...gs,
      players: gs.players.map((p) => (p.id === SPIELER_ID ? { ...p, fatigue: 60 } : p)),
      seasonState: {
        ...gs.seasonState,
        playerAvailabilityState: [
          { playerId: SPIELER_ID, teamId: TEAM_ID, fatigue: 60, injuryStatus: "injured" as const, injuredAtMatchdayId: "md-1", injuryUntilMatchday: "md-2", injuredAtSeasonId: gs.season.id },
        ],
      },
    };
    const f = berechneBelastungsForecast({ gameState: krank, playerId: SPIELER_ID, spieltage: 3 })!;
    const [erster, zweiter] = f.stufen.mittel.punkte;
    expect(erster!.ausfall).toBe(true);
    expect(erster!.risiko).toBe(0);
    expect(erster!.wert).toBeLessThan(f.jetzt);
    expect(zweiter!.ausfall).toBe(false);
    expect(zweiter!.risiko).toBeGreaterThan(0);
  });
});

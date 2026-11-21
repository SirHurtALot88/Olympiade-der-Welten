import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { advancePlayerFormState, entpackeFormVerlauf } from "@/lib/morale/form-moral-modifikator";
import {
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  playerGeneratorAttributeKeys,
} from "@/lib/player-generator/official-discipline-weights";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";
import { accumulateMatchdayTrainingProgress, schliesseOffeneTrainingsZuwaechse } from "@/lib/training/matchday-training-accumulator";
import { buildPlayerSeasonTrainingForecast } from "@/lib/foundation/player-matchday-training-history";
import { prognostiziereDisziplinTraining } from "@/lib/training/disziplin-trainings-prognose";
import {
  buildProjectedSeasonTrainingAccumulatorOverrides,
  getMatchdayBookedTrainingIds,
  resolveSeasonEndTrainingAccumulatorOverrides,
  resolveSeasonTrainingAccumulatorInputs,
} from "@/lib/training/organic-season-progression";
import {
  baueTrainingsZielKontext,
  bewerteTrainingsZiele,
  entpackeTrainingsVerlauf,
  kiTrainingsZielVorschlag,
  KI_ZIEL_WECHSEL_VORSPRUNG,
  prognostiziereSpieltagsTraining,
  schwersteMatrixAttribute,
  setzeTrainingsZiel,
  trainingsProfilFuerZiel,
  trainingsSaisonSumme,
  ueberlastungsAbzug,
  ueberlastungsAbzuegeFuerSpieltag,
  UEBERLASTUNG_SCHWELLE,
  wegeFuerDisziplin,
} from "@/lib/training/spieltag-training";
import { FATIGUE_LOAD_BY_MODE, TRAINING_SETPOINTS_BY_MODE } from "@/lib/training/training-mode-presentation";

const IDS = Array.from({ length: 20 }, (_, i) => `md-${i + 1}`);
let BASIS: GameState;
let SPIELER_ID: string;

/** Echte Spieler und Disziplinen, aber nur zwei Kader (schnell): 20 Spieltage, Saison 1. */
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
  };
  SPIELER_ID = rosters[0]!.playerId;
}, 60_000);

const ENV_VORHER = process.env.OLY_TRAINING_JE_SPIELTAG;
afterEach(() => {
  if (ENV_VORHER == null) delete process.env.OLY_TRAINING_JE_SPIELTAG;
  else process.env.OLY_TRAINING_JE_SPIELTAG = ENV_VORHER;
});

function spieler(gs: GameState, id = SPIELER_ID): Player {
  return gs.players.find((p) => p.id === id)!;
}

function buche(gs: GameState, matchdayId: string, ausfall?: Set<string>): GameState {
  return accumulateMatchdayTrainingProgress({ gameState: gs, seasonId: gs.season.id, matchdayId, ausfallSpielerIds: ausfall ?? new Set() });
}

function attr(p: Player, a: PlayerGeneratorAttributeName): number {
  return Number(p.attributeSheetStats?.[a]);
}

describe("Regel A: Ziel-Disziplin + Weg aus der Matrix", () => {
  it("Primaerweg: schwerstes Attribut 60 %, dann 25 % und 15 %; Nebenweg tauscht den 60-%-Platz", () => {
    for (const d of officialDisciplineWeightOrder) {
      const top = schwersteMatrixAttribute(d, 3);
      expect(top.length).toBe(3);
      const primaer = trainingsProfilFuerZiel({ disziplinId: d, weg: 0 });
      expect(primaer.map((e) => e.attribute)).toEqual(top.map((e) => e.attribute));
      expect(primaer.map((e) => e.anteil)).toEqual([0.6, 0.25, 0.15]);
      const neben = trainingsProfilFuerZiel({ disziplinId: d, weg: 1 });
      expect(neben[0]!.attribute).toBe(top[1]!.attribute);
      expect(neben[1]!.attribute).toBe(top[0]!.attribute);
      expect(wegeFuerDisziplin(d).map((w) => w.art)).toEqual(["primaer", "neben", "neben"]);
    }
  });

  it("liest die Matrix nur: Zeilensummen bleiben 166/167", () => {
    for (const a of playerGeneratorAttributeKeys) {
      const summe = officialDisciplineWeightOrder.reduce((s, d) => s + officialDisciplineWeightTable[a][d], 0);
      expect([166, 167]).toContain(summe);
    }
  });

  it("setzeTrainingsZiel prueft Disziplin und Weg", () => {
    expect(() => setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gibts-nicht", weg: 0 })).toThrow();
    expect(() => setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "tdm", weg: 3 })).toThrow();
    const gs = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "tdm", weg: 1 });
    expect(spieler(gs).trainingsZiel).toMatchObject({ disziplinId: "tdm", weg: 1 });
    expect(spieler(setzeTrainingsZiel(gs, SPIELER_ID, null)).trainingsZiel).toBeNull();
  });
});

describe("Je-Spieltag-Buchung", () => {
  it("bucht den Zuwachs sofort, gezeigt = gebucht (Vorschau == Verlauf == Attribut-Differenz)", () => {
    const gs0 = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    const vorschau = prognostiziereSpieltagsTraining({ gameState: { ...gs0, matchdayState: { ...gs0.matchdayState, matchdayId: "md-1" } }, playerId: SPIELER_ID });
    expect(vorschau && !vorschau.verletzt).toBe(true);
    const gs1 = buche(gs0, "md-1");
    const vorher = spieler(gs0);
    const nachher = spieler(gs1);
    const [zeile] = entpackeTrainingsVerlauf(gs1, SPIELER_ID);
    expect(zeile).toMatchObject({ matchdayId: "md-1", spieltag: 1, status: "trainiert", disziplinId: "gewichtheben", weg: 0, quelle: "manager", modus: "mittel" });
    expect(zeile!.summe).toBeGreaterThan(0);
    // Verlauf == tatsaechliche Attribut-Differenz
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
      expect(attr(nachher, a) - attr(vorher, a)).toBeCloseTo(zeile!.zuwachs[a] ?? 0, 6);
    }
    // Vorschau == gebucht
    if (vorschau && !vorschau.verletzt) {
      for (const a of PROGRESSION_ATTRIBUTE_ORDER) expect(zeile!.zuwachs[a] ?? 0).toBeCloseTo(vorschau.zuwachs[a] ?? 0, 6);
    }
    // Schwerpunkt ist das 60-%-Attribut (wenn es nicht an der Decke steht)
    const haupt = trainingsProfilFuerZiel({ disziplinId: "gewichtheben", weg: 0 })[0]!.attribute;
    const groesster = Object.entries(zeile!.zuwachs).sort((a, b) => b[1]! - a[1]!)[0]![0];
    expect(groesster).toBe(haupt);
    // Trainingslast weiter je Spieltag
    expect(zeile!.last).toBeCloseTo(FATIGUE_LOAD_BY_MODE.mittel / 20, 3);
    // Disziplinwerte folgen den Attributen (ligaweit neu abgeleitet)
    expect(nachher.disciplineRatings).toBeDefined();
    expect(nachher.seasonTrainingAccumulator?.startAttribute?.[haupt]).toBe(attr(vorher, haupt));
  });

  it("ist je Spieltag idempotent (gleicher Spieltag zweimal = einmal)", () => {
    const gs1 = buche(BASIS, "md-1");
    const gs2 = buche(gs1, "md-1");
    expect(spieler(gs2).attributeSheetStats).toEqual(spieler(gs1).attributeSheetStats);
    expect(spieler(gs2).seasonTrainingAccumulator?.verlauf).toEqual(spieler(gs1).seasonTrainingAccumulator?.verlauf);
  });

  it("anderer Modus beim Neu-Buchen desselben Spieltags: alter Zuwachs zurueck, neuer drauf", () => {
    const gs1 = buche(BASIS, "md-1");
    const hart = { ...gs1, players: gs1.players.map((p) => (p.id === SPIELER_ID ? { ...p, trainingMode: "hart" as const } : p)) };
    const gs2 = buche(hart, "md-1");
    const p0 = spieler(BASIS);
    const p2 = spieler(gs2);
    const [zeile] = entpackeTrainingsVerlauf(gs2, SPIELER_ID);
    expect(zeile!.modus).toBe("hart");
    expect(p2.seasonTrainingAccumulator?.matchdaysCounted).toBe(1);
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) expect(attr(p2, a) - attr(p0, a)).toBeCloseTo(zeile!.zuwachs[a] ?? 0, 6);
    expect(zeile!.summe).toBeGreaterThan(entpackeTrainingsVerlauf(gs1, SPIELER_ID)[0]!.summe);
  });

  it("Schalter aus: kein Zuwachs, kein Verlauf, nur Modus und Trainingslast wie bisher", () => {
    process.env.OLY_TRAINING_JE_SPIELTAG = "0";
    const gs1 = buche(BASIS, "md-1");
    expect(spieler(gs1).attributeSheetStats).toEqual(spieler(BASIS).attributeSheetStats);
    expect(spieler(gs1).seasonTrainingAccumulator?.verlauf).toBeUndefined();
    expect(spieler(gs1).seasonTrainingAccumulator?.modeByMatchday["md-1"]).toBe("mittel");
  });
});

describe("Halber Spieltag (Arena-Teilbuchung nach D1): Zuwachs erst mit D2", () => {
  // Befund 21.11. (docs/design/arena-fluss-21-11.md): buchte der D1-Commit den Zuwachs auf die Attribute,
  // aenderte sich die Arena-Eingabe mitten im Spieltag -- Motor-Neuaufbau nach D1 (Endstand weg) und
  // `arena_eingabe_divergenz` fuer D2.
  function bucheTeil(gs: GameState, matchdayId: string): GameState {
    return accumulateMatchdayTrainingProgress({
      gameState: gs,
      seasonId: gs.season.id,
      matchdayId,
      ausfallSpielerIds: new Set(),
      spieltagOffen: true,
    });
  }

  it("D1-Commit: Attribute und Disziplinwerte bleiben, Zuwachs steht offen im Verlauf", () => {
    const gs0 = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    const gs1 = bucheTeil(gs0, "md-1");
    expect(spieler(gs1).attributeSheetStats).toEqual(spieler(gs0).attributeSheetStats);
    for (const p of gs1.players) expect(p.disciplineRatings).toEqual(gs0.players.find((q) => q.id === p.id)!.disciplineRatings);
    const eintrag = spieler(gs1).seasonTrainingAccumulator?.verlauf?.find((e) => e.m === "md-1");
    expect(eintrag?.o).toBe(true);
    expect(Object.keys(eintrag?.z ?? {}).length).toBeGreaterThan(0);
    // Trainingslast und Modus zaehlen wie bisher schon beim ersten Commit.
    expect(spieler(gs1).seasonTrainingAccumulator?.modeByMatchday["md-1"]).toBe("mittel");
  });

  it("Teil + Abschluss == ein voller Commit (Attribute, Verlauf, Disziplinwerte)", () => {
    const gs0 = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    const voll = buche(gs0, "md-1");
    const teil = bucheTeil(gs0, "md-1");
    const nochmalTeil = bucheTeil(teil, "md-1");
    expect(nochmalTeil.players.map((p) => p.attributeSheetStats)).toEqual(teil.players.map((p) => p.attributeSheetStats));
    const abschluss = buche(nochmalTeil, "md-1");
    for (const p of voll.players) {
      const q = abschluss.players.find((x) => x.id === p.id)!;
      expect(q.attributeSheetStats).toEqual(p.attributeSheetStats);
      expect(q.disciplineRatings).toEqual(p.disciplineRatings);
      expect(q.seasonTrainingAccumulator?.verlauf).toEqual(p.seasonTrainingAccumulator?.verlauf);
      expect(q.seasonTrainingAccumulator?.matchdaysCounted).toBe(p.seasonTrainingAccumulator?.matchdaysCounted);
    }
    expect(entpackeTrainingsVerlauf(abschluss, SPIELER_ID)).toEqual(entpackeTrainingsVerlauf(voll, SPIELER_ID));
  });

  it("Moduswechsel zwischen D1 und D2: offener Zuwachs wird nicht abgezogen, der neue gebucht", () => {
    const teil = bucheTeil(BASIS, "md-1");
    const hart = { ...teil, players: teil.players.map((p) => (p.id === SPIELER_ID ? { ...p, trainingMode: "hart" as const } : p)) };
    const abschluss = buche(hart, "md-1");
    const [zeile] = entpackeTrainingsVerlauf(abschluss, SPIELER_ID);
    expect(zeile!.modus).toBe("hart");
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
      expect(attr(spieler(abschluss), a) - attr(spieler(BASIS), a)).toBeCloseTo(zeile!.zuwachs[a] ?? 0, 6);
    }
    expect(spieler(abschluss).seasonTrainingAccumulator?.verlauf?.some((e) => e.o)).toBe(false);
  });
});

describe("Offener Zuwachs: Kaderwechsel, Saisonende, Anzeige (Review 21.11.)", () => {
  function bucheTeil(gs: GameState, matchdayId: string): GameState {
    return accumulateMatchdayTrainingProgress({
      gameState: gs,
      seasonId: gs.season.id,
      matchdayId,
      ausfallSpielerIds: new Set(),
      spieltagOffen: true,
    });
  }
  const ohneKader = (gs: GameState, id: string): GameState => ({ ...gs, rosters: gs.rosters.filter((r) => r.playerId !== id) });

  it("Spieler verlaesst zwischen D1 und D2 den Kader: der Abschluss-Commit bucht seinen offenen Zuwachs trotzdem", () => {
    const voll = buche(BASIS, "md-1");
    const teil = bucheTeil(BASIS, "md-1");
    expect(spieler(teil).seasonTrainingAccumulator?.verlauf?.find((e) => e.m === "md-1")?.o).toBe(true);
    const abschluss = buche(ohneKader(teil, SPIELER_ID), "md-1");
    const p = spieler(abschluss);
    expect(p.attributeSheetStats).toEqual(spieler(voll).attributeSheetStats);
    expect(p.seasonTrainingAccumulator?.verlauf).toEqual(spieler(voll).seasonTrainingAccumulator?.verlauf);
    expect(getMatchdayBookedTrainingIds(p.seasonTrainingAccumulator, abschluss.season.id).has("md-1")).toBe(true);
    // Keine Last fuer den, der nicht mehr im Kader steht: nur der festgelegte Zuwachs wird nachgeholt.
    expect(p.fatigue).toBe(spieler(teil).fatigue);
    // Ein weiterer halber Commit laesst ihn in Ruhe.
    expect(spieler(bucheTeil(ohneKader(teil, SPIELER_ID), "md-1")).seasonTrainingAccumulator).toEqual(spieler(teil).seasonTrainingAccumulator);
  });

  it("schliesseOffeneTrainingsZuwaechse bucht exakt die festgelegten Zahlen (Verkauf/Saisonende-Pfad)", () => {
    const voll = buche(BASIS, "md-1");
    const teil = bucheTeil(BASIS, "md-1");
    const zu = schliesseOffeneTrainingsZuwaechse(teil, { playerIds: [SPIELER_ID] });
    expect(spieler(zu).attributeSheetStats).toEqual(spieler(voll).attributeSheetStats);
    expect(spieler(zu).seasonTrainingAccumulator?.verlauf?.some((e) => e.o)).toBe(false);
    // Andere Spieler bleiben offen; ohne offene Eintraege derselbe Stand.
    expect(zu.players.some((p) => p.id !== SPIELER_ID && p.seasonTrainingAccumulator?.verlauf?.some((e) => e.o))).toBe(true);
    expect(schliesseOffeneTrainingsZuwaechse(voll)).toBe(voll);
  });

  it("offener Eintrag zaehlt nicht als gebucht: am Saisonende faellt der Spieltag ins Budget (nicht verloren, nicht doppelt)", () => {
    const teil = bucheTeil(BASIS, "md-1");
    const akku = spieler(teil).seasonTrainingAccumulator;
    expect(getMatchdayBookedTrainingIds(akku, teil.season.id).has("md-1")).toBe(false);
    const offen = resolveSeasonEndTrainingAccumulatorOverrides({ accumulator: akku, seasonId: teil.season.id, totalMatchdays: 20, jeSpieltag: true });
    expect(offen.accumulatedBaseTrainingBudget).toBeCloseTo(TRAINING_SETPOINTS_BY_MODE.mittel / 20, 6);
    const gebucht = buche(teil, "md-1");
    const zu = resolveSeasonEndTrainingAccumulatorOverrides({
      accumulator: spieler(gebucht).seasonTrainingAccumulator,
      seasonId: teil.season.id,
      totalMatchdays: 20,
      jeSpieltag: true,
    });
    expect(zu.accumulatedBaseTrainingBudget).toBe(0);
  });

  it("Anzeige: Verlauf, Saisonsumme und Prognose kennzeichnen den offenen Zuwachs", () => {
    const teil = bucheTeil(BASIS, "md-1");
    const [zeile] = entpackeTrainingsVerlauf(teil, SPIELER_ID);
    expect(zeile!.offen).toBe(true);
    expect(zeile!.summe).toBeGreaterThan(0);
    const summeOffen = trainingsSaisonSumme(teil, SPIELER_ID);
    expect(summeOffen.summe).toBe(0);
    expect(summeOffen.offenSumme).toBe(zeile!.summe);
    const prognoseOffen = buildPlayerSeasonTrainingForecast({ gameState: teil, player: spieler(teil) })!;
    expect(prognoseOffen.offenTotal).toBeGreaterThan(0);

    const abschluss = buche(teil, "md-1");
    const [gebucht] = entpackeTrainingsVerlauf(abschluss, SPIELER_ID);
    expect(gebucht!.offen).toBe(false);
    expect(trainingsSaisonSumme(abschluss, SPIELER_ID).summe).toBe(summeOffen.offenSumme);
    expect(trainingsSaisonSumme(abschluss, SPIELER_ID).offenSumme).toBe(0);
    const prognose = buildPlayerSeasonTrainingForecast({ gameState: abschluss, player: spieler(abschluss) })!;
    expect(prognose.offenTotal).toBe(0);
    // Derselbe Zuwachs, nur einmal gezaehlt: offen und gebucht ergeben dieselbe Trainingssumme.
    expect(prognose.trainingTotal).toBeCloseTo(prognoseOffen.trainingTotal, 1);
  });
});

describe("Regel B: Verletzte trainieren nicht", () => {
  it("Ausfall-Spieltag: kein Zuwachs, keine Trainingslast, Modus nicht gezaehlt", () => {
    const gs1 = buche(BASIS, "md-1");
    const gs2 = buche({ ...gs1, players: gs1.players.map((p) => (p.id === SPIELER_ID ? { ...p, fatigue: 10 } : p)) }, "md-2", new Set([SPIELER_ID]));
    const p1 = spieler(gs1);
    const p2 = spieler(gs2);
    expect(p2.attributeSheetStats).toEqual(p1.attributeSheetStats);
    expect(p2.seasonTrainingAccumulator?.accumulatedTrainingFatigue).toBeCloseTo(p1.seasonTrainingAccumulator!.accumulatedTrainingFatigue, 6);
    expect(p2.seasonTrainingAccumulator?.matchdaysCounted).toBe(1);
    expect(p2.seasonTrainingAccumulator?.modeByMatchday["md-2"]).toBeUndefined();
    expect(entpackeTrainingsVerlauf(gs2, SPIELER_ID)[1]).toMatchObject({ matchdayId: "md-2", status: "verletzt", summe: 0, last: 0 });
  });

  it("erkennt den Ausfall aus dem Verfuegbarkeits-Stand (verletzt an md-1, gesperrt bis md-2)", () => {
    const team = BASIS.rosters.find((r) => r.playerId === SPIELER_ID)!.teamId;
    const gs = {
      ...BASIS,
      seasonState: {
        ...BASIS.seasonState,
        playerAvailabilityState: [
          { playerId: SPIELER_ID, teamId: team, fatigue: 40, injuryStatus: "injured" as const, injuredAtMatchdayId: "md-1", injuryUntilMatchday: "md-2", injuredAtSeasonId: BASIS.season.id },
        ],
      },
    };
    const gs2 = accumulateMatchdayTrainingProgress({ gameState: gs, seasonId: gs.season.id, matchdayId: "md-2" });
    expect(entpackeTrainingsVerlauf(gs2, SPIELER_ID)[0]!.status).toBe("verletzt");
    const gs1 = accumulateMatchdayTrainingProgress({ gameState: gs, seasonId: gs.season.id, matchdayId: "md-1" });
    // Am Verletzungs-Spieltag selbst hat er noch gespielt und trainiert.
    expect(entpackeTrainingsVerlauf(gs1, SPIELER_ID)[0]!.status).toBe("trainiert");
  });
});

describe("Regel E: Ueberlastung drueckt die Form gering", () => {
  it("Abzug je Modus und Zone, leicht schont", () => {
    expect(ueberlastungsAbzug("hart", UEBERLASTUNG_SCHWELLE - 1)).toBe(0);
    expect(ueberlastungsAbzug("hart", 60)).toBe(2);
    expect(ueberlastungsAbzug("hart", 85)).toBe(3);
    expect(ueberlastungsAbzug("mittel", 60)).toBe(1);
    expect(ueberlastungsAbzug("leicht", 95)).toBe(0);
  });

  it("geht ueber die Form-Fortschreibung, mit Grund im Verlauf (gezeigt = gebucht)", () => {
    const hart = { ...BASIS, players: BASIS.players.map((p) => (p.id === SPIELER_ID ? { ...p, trainingMode: "hart" as const } : p)) };
    let gs = buche(hart, "md-1");
    gs = { ...gs, players: gs.players.map((p) => (p.id === SPIELER_ID ? { ...p, fatigue: 85 } : p)) };
    const abzuege = ueberlastungsAbzuegeFuerSpieltag(gs, "md-1");
    expect(abzuege.get(SPIELER_ID)).toBe(3);
    const ohne = advancePlayerFormState(gs, "md-1").find((z) => z.playerId === SPIELER_ID)!;
    const mit = advancePlayerFormState(gs, "md-1", undefined, abzuege).find((z) => z.playerId === SPIELER_ID)!;
    expect(mit.form).toBeCloseTo(ohne.form - 3, 5);
    expect(entpackeFormVerlauf(mit).at(-1)!.ueberlastung).toBe(3);
    const mitForm = { ...gs, playerFormState: [mit] };
    expect(entpackeTrainingsVerlauf(mitForm, SPIELER_ID)[0]).toMatchObject({ formAbzug: 3, formAbzugText: "−3 Überlastung" });
  });
});

describe("Fokuswechsel wirkt ab dem naechsten Spieltag", () => {
  it("ein gebuchter Spieltag behaelt sein Ziel, der naechste nimmt das neue", () => {
    let gs = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    gs = buche(gs, "md-1");
    const nachMd1 = spieler(gs).attributeSheetStats;
    gs = setzeTrainingsZiel(gs, SPIELER_ID, { disziplinId: "speed-schach", weg: 1 });
    gs = buche(gs, "md-1");
    expect(spieler(gs).attributeSheetStats).toEqual(nachMd1);
    gs = buche(gs, "md-2");
    const zeilen = entpackeTrainingsVerlauf(gs, SPIELER_ID);
    expect(zeilen.map((z) => [z.disziplinId, z.weg])).toEqual([
      ["gewichtheben", 0],
      ["speed-schach", 1],
    ]);
    const neuHaupt = trainingsProfilFuerZiel({ disziplinId: "speed-schach", weg: 1 })[0]!.attribute;
    const groesster = Object.entries(zeilen[1]!.zuwachs).sort((a, b) => b[1]! - a[1]!)[0]![0];
    expect(groesster).toBe(neuHaupt);
  });
});

describe("Summe je Saison und kein Doppel-Buchen am Saisonende", () => {
  it("20 Spieltage: Saisonsumme == Summe der Verlaufszeilen == Attribut-Differenz; Saisonende bucht 0", () => {
    let gs = BASIS;
    for (const id of IDS) gs = buche(gs, id);
    const p0 = spieler(BASIS);
    const p = spieler(gs);
    const summe = trainingsSaisonSumme(gs, SPIELER_ID);
    expect(summe.spieltageTrainiert).toBe(20);
    let diff = 0;
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
      diff += attr(p, a) - attr(p0, a);
      expect(attr(p, a) - attr(p0, a)).toBeCloseTo(summe.zuwachsJeAttribut[a] ?? 0, 5);
    }
    expect(diff).toBeCloseTo(summe.summe, 4);
    // Groessenordnung (Konzept: Aufbau 2-3 Punkte im Schwerpunkt je Saison)
    expect(summe.schwerpunkt!.zuwachs).toBeGreaterThan(1);
    expect(summe.schwerpunkt!.zuwachs).toBeLessThan(8);

    const ende = resolveSeasonEndTrainingAccumulatorOverrides({
      accumulator: p.seasonTrainingAccumulator,
      seasonId: gs.season.id,
      totalMatchdays: 20,
      jeSpieltag: true,
    });
    expect(ende.accumulatedBaseTrainingBudget).toBe(0);
    expect(ende.performanceWeightMultiplier).toBeGreaterThan(0);
    // Die Alt-Prognose zaehlt die gebuchten Spieltage nicht noch einmal.
    expect(buildProjectedSeasonTrainingAccumulatorOverrides({ gameState: gs, player: p, draftMode: "mittel" }).accumulatedBaseTrainingBudget).toBe(0);
  });

  it("laufender Alt-Spielstand: Spieltage vor dem Umstieg bucht weiter das Saisonende, danach je Spieltag", () => {
    const alt = {
      ...BASIS,
      players: BASIS.players.map((p) =>
        p.id === SPIELER_ID
          ? {
              ...p,
              seasonTrainingAccumulator: {
                seasonId: BASIS.season.id,
                matchdaysCounted: 5,
                modeByMatchday: { "md-1": "mittel", "md-2": "mittel", "md-3": "mittel", "md-4": "hart", "md-5": "hart" } as Record<string, "mittel" | "hart">,
                accumulatedTrainingFatigue: 3,
                updatedAt: "x",
              },
            }
          : p,
      ),
    };
    // Neu-Buchen eines Alt-Spieltags mit gleichem Modus aendert nichts (bleibt Alt-Spieltag)
    const altHart = { ...alt, players: alt.players.map((p) => (p.id === SPIELER_ID ? { ...p, trainingMode: "hart" as const } : p)) };
    const replay = buche(altHart, "md-5");
    expect(spieler(replay).attributeSheetStats).toEqual(spieler(alt).attributeSheetStats);
    expect(spieler(replay).seasonTrainingAccumulator?.verlauf ?? []).toEqual([]);
    let gs = alt;
    for (const id of IDS.slice(5)) gs = buche(gs, id);
    const p = spieler(gs);
    expect(p.seasonTrainingAccumulator?.matchdaysCounted).toBe(20);
    const ende = resolveSeasonEndTrainingAccumulatorOverrides({ accumulator: p.seasonTrainingAccumulator, seasonId: gs.season.id, totalMatchdays: 20, jeSpieltag: true });
    const erwartet = (3 * TRAINING_SETPOINTS_BY_MODE.mittel + 2 * TRAINING_SETPOINTS_BY_MODE.hart) / 20;
    expect(ende.accumulatedBaseTrainingBudget).toBeCloseTo(erwartet, 6);
    // Schalter aus: alte Ableitung ueber alle gezaehlten Spieltage
    const aus = resolveSeasonEndTrainingAccumulatorOverrides({ accumulator: p.seasonTrainingAccumulator, seasonId: gs.season.id, totalMatchdays: 20, jeSpieltag: false });
    expect(aus).toEqual(resolveSeasonTrainingAccumulatorInputs({ accumulator: p.seasonTrainingAccumulator, seasonId: gs.season.id, totalMatchdays: 20 }));
  });

  it("ohne Akkumulator bucht das Saisonende mit Schalter AN kein Pauschalbudget", () => {
    expect(
      resolveSeasonEndTrainingAccumulatorOverrides({ accumulator: null, seasonId: "s", totalMatchdays: 20, jeSpieltag: true }).accumulatedBaseTrainingBudget,
    ).toBe(0);
  });
});

describe("KI-Vorschlag (Mensch und KI gleich)", () => {
  it("liefert eine gueltige Ziel-Disziplin mit Weg und bleibt bei Gleichstand beim bisherigen Ziel", () => {
    const kontext = baueTrainingsZielKontext(BASIS, "md-1");
    const p = spieler(BASIS);
    const bewertungen = bewerteTrainingsZiele(kontext, p);
    expect(bewertungen.length).toBe(BASIS.disciplines.length);
    const vorschlag = kiTrainingsZielVorschlag(kontext, p)!;
    expect(officialDisciplineWeightOrder as readonly string[]).toContain(vorschlag.disziplinId);
    // Ohne gesetztes Ziel trainiert der Spieler auf den Vorschlag (Quelle "ki")
    const gs = buche(BASIS, "md-1");
    const zeile = entpackeTrainingsVerlauf(gs, SPIELER_ID)[0]!;
    expect(zeile.quelle).toBe("ki");
    expect(zeile.disziplinId).toBe(vorschlag.disziplinId);
    // Haltekraft: am naechsten Spieltag dasselbe Ziel, solange kein anderes klar besser ist
    const kontext2 = baueTrainingsZielKontext(gs, "md-2");
    const bisher = bewerteTrainingsZiele(kontext2, spieler(gs)).find((b) => b.disziplinId === zeile.disziplinId)!;
    const beste = bewerteTrainingsZiele(kontext2, spieler(gs))[0]!;
    if (bisher.punkte * KI_ZIEL_WECHSEL_VORSPRUNG >= beste.punkte) expect(kiTrainingsZielVorschlag(kontext2, spieler(gs))!.disziplinId).toBe(zeile.disziplinId);
  });
});

describe("Trainings-Forecast je Disziplin (Modell fuer Profil und Entwicklung)", () => {
  const mitSpieltag = (matchdayId = "md-1") => ({ ...BASIS, matchdayState: { ...BASIS.matchdayState, matchdayId } });

  it("erster Schritt == der am naechsten Spieltag gebuchte Zuwachs (gezeigt = gebucht)", () => {
    const gs = setzeTrainingsZiel(mitSpieltag(), SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    const eins = prognostiziereDisziplinTraining({ gameState: gs, playerId: SPIELER_ID, spieltage: 1 })!;
    const gebucht = entpackeTrainingsVerlauf(buche(gs, "md-1"), SPIELER_ID)[0]!;
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) expect(eins.zuwachsJeAttribut[a] ?? 0).toBeCloseTo(gebucht.zuwachs[a] ?? 0, 6);
  });

  it("Rest der Saison: Zeilen fuer alle Disziplinen, Ziel markiert, nach Delta sortiert", () => {
    const gs = setzeTrainingsZiel(mitSpieltag(), SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    const p = prognostiziereDisziplinTraining({ gameState: gs, playerId: SPIELER_ID })!;
    expect(p.spieltageImFenster).toBe(20);
    expect(p.spieltageTrainiert).toBe(20);
    expect(p.zeilen.length).toBe(officialDisciplineWeightOrder.length);
    const ziel = p.zeilen.find((z) => z.disziplinId === "gewichtheben")!;
    expect(ziel.istZiel).toBe(true);
    expect(ziel.delta).toBeGreaterThanOrEqual(0);
    expect(p.zeilen[0]!.delta).toBeGreaterThanOrEqual(p.zeilen.at(-1)!.delta);
    expect(Object.values(p.zuwachsJeAttribut).reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThan(0);
    expect(p.annahme).toBe("andere_spieler_unveraendert");
  });

  it("Ausfall-Spieltage einer laufenden Verletzung zaehlen nicht", () => {
    const team = BASIS.rosters.find((r) => r.playerId === SPIELER_ID)!.teamId;
    const gs = {
      ...mitSpieltag("md-2"),
      seasonState: {
        ...BASIS.seasonState,
        playerAvailabilityState: [
          { playerId: SPIELER_ID, teamId: team, fatigue: 40, injuryStatus: "injured" as const, injuredAtMatchdayId: "md-1", injuryUntilMatchday: "md-2", injuredAtSeasonId: BASIS.season.id },
        ],
      },
    };
    const p = prognostiziereDisziplinTraining({ gameState: gs, playerId: SPIELER_ID, spieltage: 3 })!;
    expect(p.spieltageVerletzt).toBe(1);
    expect(p.spieltageTrainiert).toBe(2);
  });
});

describe("Transparenz des Spieltagszuwachses (gezeigt = gebucht)", () => {
  it("die Zerlegung stammt aus der buchenden Rechnung: gebucht == Zuwachs der Profil-Attribute, Beschleuniger >= 1", () => {
    const gs = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    const v = prognostiziereSpieltagsTraining({ gameState: { ...gs, matchdayState: { ...gs.matchdayState, matchdayId: "md-1" } }, playerId: SPIELER_ID });
    expect(v && !v.verletzt).toBe(true);
    if (!v || v.verletzt) return;
    const t = v.transparenz;
    expect(t.attribute.map((a) => a.attribute)).toEqual(v.profil.map((e) => e.attribute));
    for (const a of t.attribute) {
      expect(a.gebucht).toBe(v.zuwachs[a.attribute] ?? 0);
      expect(a.verlust).toBeGreaterThanOrEqual(0);
      expect(a.anteil).toBeGreaterThan(0);
    }
    expect(t.beschleuniger.faktor).toBeGreaterThanOrEqual(1);
    expect(t.verlustAnteil).toBeGreaterThanOrEqual(0);
    expect(t.verlustAnteil).toBeLessThanOrEqual(1);
  });

  it("ein Attribut am Maximum 99 bringt keinen Zuwachs: der Anteil geht als Verlust in die Anzeige", () => {
    const gs0 = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    const haupt = trainingsProfilFuerZiel({ disziplinId: "gewichtheben", weg: 0 })[0]!.attribute;
    const voll = {
      ...gs0,
      players: gs0.players.map((p) =>
        p.id === SPIELER_ID ? { ...p, attributeSheetStats: { ...p.attributeSheetStats, [haupt]: 99 } as Player["attributeSheetStats"] } : p,
      ),
      matchdayState: { ...gs0.matchdayState, matchdayId: "md-1" },
    };
    const v = prognostiziereSpieltagsTraining({ gameState: voll, playerId: SPIELER_ID });
    if (!v || v.verletzt) throw new Error("keine Vorschau");
    const a = v.transparenz.attribute.find((x) => x.attribute === haupt)!;
    expect(a.amMaximum).toBe(true);
    expect(a.grund).toBe("maximum");
    expect(a.gebucht).toBe(0);
    expect(a.verlust).toBeGreaterThan(0);
    expect(v.transparenz.verlustAnteil).toBeGreaterThan(0.4);
  });
});

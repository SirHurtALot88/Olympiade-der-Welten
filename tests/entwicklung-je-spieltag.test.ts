import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { officialDisciplineWeightTable, playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";
import {
  ENTWICKLUNGS_PARAMETER_STANDARD,
  entwicklungsGewichte,
  fokusFaktor,
  leistungsEinheit,
  leistungsFaktor,
  schwungFaktor,
  trainingsBudgetFaktor,
} from "@/lib/training/entwicklung-neu";
import {
  fokusDominanz,
  fuehreTagZusammen,
  istDiligent,
  ligaAbbauFaktor,
  leistungFuerTag,
  nettoDesEintrags,
  nettoBisher,
  verteileLeistung,
  type PpTagesIndex,
} from "@/lib/training/entwicklung-tag";
import { accumulateMatchdayTrainingProgress } from "@/lib/training/matchday-training-accumulator";
import {
  buildOrganicSeasonProgression,
  buildProjectedSeasonTrainingAccumulatorOverrides,
  resolveSeasonEndTrainingAccumulatorOverrides,
} from "@/lib/training/organic-season-progression";
import { entpackeTrainingsVerlauf, prognostiziereSpieltagsTraining, setzeTrainingsZiel, trainingsSaisonSumme } from "@/lib/training/spieltag-training";

/**
 * ENTWICKLUNG NEU, RUNDE 2 (22.11.): Training, Leistung und Abbau je Spieltag; das Saisonende nimmt nichts zurueck.
 * Die Zahlen der Eichung (Liga-Mittel, Anteile) stehen in docs/design/entwicklung-balance-22-11.md; hier sind die Regeln.
 */

const P = ENTWICKLUNGS_PARAMETER_STANDARD;
const IDS = Array.from({ length: 20 }, (_, i) => `md-${i + 1}`);
let BASIS: GameState;
let SPIELER_ID: string;

beforeAll(() => {
  const voll = createSingleplayerGameState();
  const teams = [...new Set(voll.rosters.map((r) => r.teamId))].slice(0, 2);
  const rosters = voll.rosters.filter((r) => teams.includes(r.teamId));
  const imKader = new Set(rosters.map((r) => r.playerId));
  const seasonId = voll.season.id;
  BASIS = {
    ...voll,
    scenarioMeta: { ...(voll.scenarioMeta ?? {}), gameMode: "battle" },
    teams: voll.teams.filter((t) => teams.includes(t.teamId)),
    rosters,
    players: voll.players.filter((p) => imKader.has(p.id)).map((p) => ({ ...p, trainingMode: "mittel" as const, fatigue: 0 })),
    season: { ...voll.season, matchdayIds: IDS, totalMatchdays: 20 },
    seasonState: { ...voll.seasonState, seasonId, entwicklungsRegel: { seasonId, regel: "neu" } },
  } as unknown as GameState;
  SPIELER_ID = rosters[0]!.playerId;
}, 60_000);

const ENV_VORHER = process.env.OLY_TRAINING_JE_SPIELTAG;
afterEach(() => {
  if (ENV_VORHER == null) delete process.env.OLY_TRAINING_JE_SPIELTAG;
  else process.env.OLY_TRAINING_JE_SPIELTAG = ENV_VORHER;
});

const spieler = (gs: GameState, id = SPIELER_ID): Player => gs.players.find((p) => p.id === id)!;
const attr = (p: Player, a: PlayerGeneratorAttributeName) => Number(p.attributeSheetStats?.[a]);
const buche = (gs: GameState, matchdayId: string, ausfall: Set<string> = new Set()) =>
  accumulateMatchdayTrainingProgress({ gameState: gs, seasonId: gs.season.id, matchdayId, ausfallSpielerIds: ausfall });

describe("Bausteine: Gewichte 60/40, Diligent 75/25, Leistung und Schwung", () => {
  it("Gewichte: 60 % Training, 40 % Leistung; mit Diligent 75 % / 25 %", () => {
    expect(entwicklungsGewichte(false)).toEqual({ training: 0.6, leistung: 0.4 });
    expect(entwicklungsGewichte(true)).toEqual({ training: 0.75, leistung: 0.25 });
    // Diligent: 25 % mehr Training, 37,5 % weniger Leistung gegenueber dem Normalfall (gleiche Eichung, gleicher Fokus).
    expect(trainingsBudgetFaktor(true, 0.7) / trainingsBudgetFaktor(false, 0.7)).toBeCloseTo(1.25, 6);
    expect(leistungsFaktor(true) / leistungsFaktor(false)).toBeCloseTo(0.625, 6);
  });

  it("der echte Trait Diligent wird erkannt (Gross-/Kleinschreibung egal), andere nicht", () => {
    expect(istDiligent({ traitsPositive: ["Loyal", "Diligent"] })).toBe(true);
    expect(istDiligent({ traitsPositive: ["diligent"] })).toBe(true);
    expect(istDiligent({ traitsPositive: ["Lazy"] })).toBe(false);
    expect(istDiligent({ traitsPositive: [] })).toBe(false);
  });

  it("Leistung: 0 am Median, darueber und darunter mit passendem Vorzeichen, monoton und begrenzt", () => {
    expect(leistungsEinheit(0)).toBe(0);
    expect(leistungsEinheit(P.ppEinheit * 2)).toBeGreaterThan(leistungsEinheit(P.ppEinheit));
    expect(leistungsEinheit(P.ppEinheit)).toBeGreaterThan(0);
    expect(leistungsEinheit(-P.ppEinheit)).toBeLessThan(0);
    expect(leistungsEinheit(-2 * P.ppEinheit)).toBeLessThan(leistungsEinheit(-P.ppEinheit));
    expect(leistungsEinheit(1000)).toBeCloseTo(leistungsEinheit(P.zMax * P.ppEinheit), 8);
    expect(leistungsEinheit(-1000)).toBeCloseTo(leistungsEinheit(-P.zMax * P.ppEinheit), 8);
  });

  it("Schwung und Fokus: der Schwung verstaerkt nur in Richtung der bisherigen Saison und bis zur Grenze; Fokus 1,5 / 0,5", () => {
    expect(schwungFaktor(0, 1)).toBe(1);
    expect(schwungFaktor(10, 0)).toBe(1);
    // Gegen die Richtung der bisherigen Saison keine Verstaerkung.
    expect(schwungFaktor(10, -1)).toBe(1);
    expect(schwungFaktor(-10, 1)).toBe(1);
    // In ihre Richtung: je weiter vorn, desto mehr, aber hoechstens 1 + staerke * max; wer kaum Netto hat, wird kaum verstaerkt.
    expect(schwungFaktor(6, 1)).toBeGreaterThan(schwungFaktor(3, 1));
    // Der negative Schwung hat eine eigene, kleinere Obergrenze (Review 22.11.: ab Netto -5,7 galt durchgehend x10).
    expect(schwungFaktor(-6, -1)).toBeLessThan(schwungFaktor(6, 1));
    expect(schwungFaktor(-1000, -1)).toBeCloseTo(1 + P.schwungStaerke * P.schwungMaxNegativ, 8);
    expect(schwungFaktor(-1000, -1)).toBeLessThan(schwungFaktor(1000, 1) / 2);
    expect(schwungFaktor(1000, 1)).toBeCloseTo(1 + P.schwungStaerke * P.schwungMax, 8);
    expect(schwungFaktor(1, 1)).toBeLessThan(1.15);
    expect(fokusFaktor(1)).toBeCloseTo(1.5, 8);
    expect(fokusFaktor(0.2)).toBeCloseTo(0.5, 8);
    expect(trainingsBudgetFaktor(false, null)).toBeCloseTo(P.trainingsSkala, 8);
  });

  it("verteileLeistung: nach Matrixgewicht JEDER gespielten Disziplin, Summe bleibt erhalten, Vorzeichen bleiben, Matrix nur gelesen", () => {
    const verteilt = verteileLeistung(new Map([["gewichtheben", 10]]));
    const summe = Object.values(verteilt).reduce((a, b) => a + (b ?? 0), 0);
    expect(summe).toBeCloseTo(10, 6);
    const gesamt = playerGeneratorAttributeKeys.reduce((s, a) => s + officialDisciplineWeightTable[a].gewichtheben, 0);
    for (const a of playerGeneratorAttributeKeys) {
      expect(verteilt[a] ?? 0).toBeCloseTo((10 * officialDisciplineWeightTable[a].gewichtheben) / gesamt, 6);
    }
    // Zwei Einsaetze mit verschiedenem Vorzeichen: jeder nach seiner Disziplin, die Summe ist die Summe der Einheiten.
    const gemischt = verteileLeistung(new Map([["gewichtheben", 6], ["tennis", -2]]));
    expect(Object.values(gemischt).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(4, 6);
    expect(verteileLeistung(new Map([["gewichtheben", 3]]), 2)).toEqual(
      Object.fromEntries(Object.entries(verteileLeistung(new Map([["gewichtheben", 6]]))).map(([k, v]) => [k, v])),
    );
  });

  it("Leistung eines Spieltags: nur wer antrat, jeder Einsatz gegen den Median SEINER Liga und Disziplin; ohne Einsatz 0", () => {
    const index: PpTagesIndex = {
      seasonId: "season-1",
      tage: new Map([
        [
          "md-1",
          {
            median: new Map([["liga1|gewichtheben", 2], ["liga2|gewichtheben", 4]]),
            spieler: new Map([
              ["gut", { jeDisziplin: new Map([["gewichtheben", 4]]), liga: "liga1" }],
              ["gleich", { jeDisziplin: new Map([["gewichtheben", 4]]), liga: "liga2" }],
              ["schwach", { jeDisziplin: new Map([["gewichtheben", 0.5]]), liga: "liga1" }],
            ]),
          },
        ],
      ]),
    };
    const mk = (id: string) => ({ id, traitsPositive: [] }) as unknown as Player;
    const summe = (id: string) => Object.values(leistungFuerTag({ index, matchdayId: "md-1", player: mk(id), verlauf: undefined })).reduce((a, b) => a + (b ?? 0), 0);
    expect(summe("gut")).toBeGreaterThan(0);
    expect(summe("gleich")).toBe(0);
    expect(summe("schwach")).toBeLessThan(0);
    expect(summe("fehlt")).toBe(0);
    // Rang je Liga: dieselben 4 PP sind in Liga 1 stark, in Liga 2 nur Median.
    expect(summe("gut")).toBeGreaterThan(summe("gleich"));
  });

  it("Netto bisher summiert Training + Leistung - Abbau der gebuchten Spieltage (ohne den eigenen); Fokus ist bis fokusMinTage neutral", () => {
    const verlauf = [
      { m: "a", s: "t" as const, z: { power: 1 }, p: { power: 2 }, a: { power: 0.5 } },
      { m: "b", s: "t" as const, z: { power: 0.5 } },
      { m: "c", s: "v" as const },
    ];
    expect(nettoBisher(verlauf)).toBeCloseTo(3, 8);
    expect(nettoBisher(verlauf, "b")).toBeCloseTo(2.5, 8);
    expect(nettoBisher(undefined)).toBe(0);
    expect(fokusDominanz([{ m: "a", s: "t", d: "tdm" }], "tdm")).toBeNull();
    const lang = Array.from({ length: 6 }, (_, i) => ({ m: `m${i}`, s: "t" as const, d: i < 5 ? "tdm" : "hockey" }));
    expect(fokusDominanz(lang)).toBeCloseTo(5 / 6, 8);
  });

  it("Zusammenfuehrung: Netto = Training + Leistung - Abbau; nie ueber die Decke, nie unter 1; Leistung folgt der Ertragskurve", () => {
    const frei = fuehreTagZusammen({ vorher: { power: 50 }, deckel: { power: 80 }, t: { power: 0.2 }, a: { power: 0.1 }, l: { power: 0.3 } });
    expect(frei.t.power).toBeCloseTo(0.2, 6);
    expect(frei.p.power).toBeCloseTo(0.3, 6);
    expect(frei.a.power).toBeCloseTo(0.1, 6);
    expect(nettoDesEintrags({ z: frei.t, p: frei.p, a: frei.a }).power).toBeCloseTo(0.4, 6);
    // An der Decke: Zuwachs wird gekappt (Leistung zuerst), der Abbau bleibt.
    const decke = fuehreTagZusammen({ vorher: { power: 79.9 }, deckel: { power: 80 }, t: { power: 0.2 }, a: { power: 0 }, l: { power: 0.3 } });
    expect(79.9 + (decke.t.power ?? 0) + (decke.p.power ?? 0)).toBeLessThanOrEqual(80.0001);
    // Negative Leistung wird nicht durch die Ertragskurve gedaempft; Wert faellt nie unter 1.
    const boden = fuehreTagZusammen({ vorher: { power: 1.2 }, deckel: { power: 80 }, t: {}, a: { power: 0.5 }, l: { power: -0.5 } });
    expect(1.2 + (boden.p.power ?? 0) - (boden.a.power ?? 0)).toBeGreaterThanOrEqual(1 - 1e-9);
  });
});

describe("Ligafaktor auf den Abbau (Thermostat fuer das Liga-Mittel)", () => {
  const liga = (tage: number, z: number, a: number, f?: number, p?: number): GameState =>
    ({
      season: { id: "season-1" },
      players: [
        {
          id: "p1",
          seasonTrainingAccumulator: {
            seasonId: "season-1",
            verlauf: Array.from({ length: tage }, (_, i) => ({ m: `md-${i + 1}`, s: "t" as const, z: { power: z }, a: { power: a }, ...(f ? { f } : {}), ...(p ? { p: { power: p } } : {}) })),
          },
        },
      ],
    }) as unknown as GameState;

  it("bis zum dritten Spieltag 1; danach so, dass der Abbau der ganzen Saison das Gleichgewicht (Zuwaechse - negative Leistung) trifft, begrenzt auf 0,6 bis 1,6", () => {
    expect(ligaAbbauFaktor(liga(2, 1, 1))).toBe(1);
    expect(ligaAbbauFaktor(liga(5, 1, 1))).toBeCloseTo(1, 8);
    // Ohne den Schritt-Deckel waeren es 19/15, 11/15, 1,6 und 0,6; je Spieltag aendert sich der Faktor aber hoechstens um 0,1 (Review 22.11.).
    expect(ligaAbbauFaktor(liga(5, 1.2, 1))).toBeCloseTo(1.1, 8);
    expect(ligaAbbauFaktor(liga(5, 1, 1, undefined, -0.2))).toBeCloseTo(0.9, 8);
    expect(ligaAbbauFaktor(liga(5, 9, 1))).toBeCloseTo(1.1, 8);
    expect(ligaAbbauFaktor(liga(5, 0.1, 1))).toBeCloseTo(0.9, 8);
  });

  it("der Faktor folgt dem Gleichgewicht in Schritten von hoechstens 0,1 je Spieltag, vom zuletzt gebuchten Faktor aus, und bleibt in 0,6 bis 1,6", () => {
    // Der letzte gebuchte Spieltag (md-5) trug f = 1,5; das Gleichgewicht liegt bei 1,6 -> hoechstens 1,6, nicht mehr als 1,5 + 0,1.
    expect(ligaAbbauFaktor(liga(5, 9, 1, 1.5))).toBeCloseTo(1.6, 8);
    // Vom Faktor 0,7 aus wird nach unten nur bis 0,6 gegangen (Untergrenze) und nach oben nur bis 0,8.
    expect(ligaAbbauFaktor(liga(5, 0.1, 1, 0.7))).toBeCloseTo(0.6, 8);
    expect(ligaAbbauFaktor(liga(5, 9, 1, 0.7))).toBeCloseTo(0.8, 8);
  });

  it("rechnet mit dem Abbau OHNE den damals angewendeten Faktor und laesst den eigenen Spieltag aus", () => {
    // Gebucht wurde a = 1,2 mit f = 1,2 (also Basis 1,0) und z = 1,2: Gleichgewicht bei Faktor 1,2.
    expect(ligaAbbauFaktor(liga(5, 1.2, 1.2, 1.2))).toBeCloseTo(1.2, 8);
    expect(ligaAbbauFaktor(liga(5, 1.2, 1.2, 1.2))).not.toBeCloseTo(1.3, 3);
    expect(ligaAbbauFaktor(liga(5, 1, 1), "md-5")).toBeCloseTo(1, 8);
  });
});

describe("Buchung je Spieltag: Training + Abbau, gezeigt = gebucht", () => {
  it("Attribut-Differenz == z - a des Verlaufs; Vorschau == gebuchtes Training und Abbau; der Abbau steht im Verlauf", () => {
    const gs0 = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    const vorschau = prognostiziereSpieltagsTraining({ gameState: { ...gs0, matchdayState: { ...gs0.matchdayState, matchdayId: "md-1" } }, playerId: SPIELER_ID });
    expect(vorschau && !vorschau.verletzt).toBe(true);
    const gs1 = buche(gs0, "md-1");
    const [zeile] = entpackeTrainingsVerlauf(gs1, SPIELER_ID);
    expect(zeile!.status).toBe("trainiert");
    expect(Object.keys(zeile!.abbau).length).toBeGreaterThan(0);
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
      const erwartet = (zeile!.zuwachs[a] ?? 0) + (zeile!.leistung[a] ?? 0) - (zeile!.abbau[a] ?? 0);
      expect(attr(spieler(gs1), a) - attr(spieler(gs0), a)).toBeCloseTo(erwartet, 6);
      if (vorschau && !vorschau.verletzt) {
        expect(zeile!.zuwachs[a] ?? 0).toBeCloseTo(vorschau.zuwachs[a] ?? 0, 6);
        expect(zeile!.abbau[a] ?? 0).toBeCloseTo(vorschau.abbau[a] ?? 0, 6);
      }
    }
    const summe = trainingsSaisonSumme(gs1, SPIELER_ID);
    expect(summe.nettoSumme).toBeCloseTo(zeile!.netto, 6);
    // Ohne Ergebnisse im Spielstand keine Leistung (L = 0, keine Strafe).
    expect(summe.leistungSumme).toBe(0);
  });

  it("derselbe Spieltag zweimal gebucht ergibt dasselbe wie einmal (Idempotenz) und der Rueckbau nimmt p und a mit", () => {
    const gs1 = buche(BASIS, "md-1");
    const gs2 = buche(gs1, "md-1");
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) expect(attr(spieler(gs2), a)).toBeCloseTo(attr(spieler(gs1), a), 6);
    // Anderer Modus fuer denselben Spieltag: der alte Eintrag samt Abbau wird zurueckgenommen, der neue gebucht.
    const hart = { ...gs1, players: gs1.players.map((p) => (p.id === SPIELER_ID ? { ...p, trainingMode: "hart" as const } : p)) };
    const gs3 = buche(hart, "md-1");
    const verlauf = entpackeTrainingsVerlauf(gs3, SPIELER_ID);
    expect(verlauf).toHaveLength(1);
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
      const erwartet = (verlauf[0]!.zuwachs[a] ?? 0) + (verlauf[0]!.leistung[a] ?? 0) - (verlauf[0]!.abbau[a] ?? 0);
      expect(attr(spieler(gs3), a) - attr(spieler(BASIS), a)).toBeCloseTo(erwartet, 6);
    }
  });

  it("Verletzte: kein Training, KEIN Abbau, keine Leistung (keine Mehrfachstrafe)", () => {
    const gs1 = buche(BASIS, "md-1", new Set([SPIELER_ID]));
    const [zeile] = entpackeTrainingsVerlauf(gs1, SPIELER_ID);
    expect(zeile!.status).toBe("verletzt");
    expect(zeile!.zuwachs).toEqual({});
    expect(zeile!.abbau).toEqual({});
    expect(zeile!.leistung).toEqual({});
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) expect(attr(spieler(gs1), a)).toBe(attr(spieler(BASIS), a));
  });

  it("Diligent bekommt mehr Training auf denselben Spieltag (75 statt 60 Prozent Gewicht)", () => {
    const mit = { ...BASIS, players: BASIS.players.map((p) => (p.id === SPIELER_ID ? { ...p, traitsPositive: [...(p.traitsPositive ?? []).filter((t) => t.toLowerCase() !== "diligent"), "Diligent"] } : p)) };
    const ohne = { ...BASIS, players: BASIS.players.map((p) => (p.id === SPIELER_ID ? { ...p, traitsPositive: (p.traitsPositive ?? []).filter((t) => t.toLowerCase() !== "diligent") } : p)) };
    const ziel = { disziplinId: "gewichtheben", weg: 0 as const };
    const vorMit = prognostiziereSpieltagsTraining({ gameState: { ...setzeTrainingsZiel(mit, SPIELER_ID, ziel), matchdayState: { ...mit.matchdayState, matchdayId: "md-1" } }, playerId: SPIELER_ID });
    const vorOhne = prognostiziereSpieltagsTraining({ gameState: { ...setzeTrainingsZiel(ohne, SPIELER_ID, ziel), matchdayState: { ...ohne.matchdayState, matchdayId: "md-1" } }, playerId: SPIELER_ID });
    if (!vorMit || vorMit.verletzt || !vorOhne || vorOhne.verletzt) throw new Error("keine Vorschau");
    expect(vorMit.budgetFaktor / vorOhne.budgetFaktor).toBeCloseTo(1.25, 3);
  });
});

describe("Prognose und Saisonende nehmen nichts zurueck", () => {
  // So rufen Trainingsseite, Spielerprofil und Bestenliste die Engine (Prognose, nicht Saisonende-Apply).
  const prognose = (gs: GameState) =>
    gs.players.map((p) => buildOrganicSeasonProgression({ gameState: gs, player: p, ...buildProjectedSeasonTrainingAccumulatorOverrides({ gameState: gs, player: p, draftMode: "mittel" }) }));

  it("zu Saisonbeginn zeigt die Prognose nie die volle Saisonend-Strafe (frueher bis -18): Mittel nahe 0, kein Spieler unter -6", () => {
    const werte = prognose(BASIS).map((e) => e.netSetpoints);
    const mittel = werte.reduce((a, b) => a + b, 0) / werte.length;
    expect(Math.abs(mittel)).toBeLessThan(3);
    expect(Math.min(...werte)).toBeGreaterThan(-6);
  });

  it("OLY_TRAINING_JE_SPIELTAG=aus aendert in einer \"neu\"-Saison nichts (nur der Stempel entscheidet), Prognose bleibt gleich", () => {
    const aktiv = prognose(BASIS).map((e) => e.netSetpoints);
    process.env.OLY_TRAINING_JE_SPIELTAG = "aus";
    const aus = prognose(BASIS).map((e) => e.netSetpoints);
    expect(aus).toEqual(aktiv);
  });

  it("nach 20 gebuchten Spieltagen bucht das Saisonende nichts mehr: Training zeigt keinen negativen Anteil, Netto 0", () => {
    let gs = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    for (const id of IDS) gs = buche(gs, id);
    const p = spieler(gs);
    expect(p.seasonTrainingAccumulator?.verlauf).toHaveLength(20);
    const ende = buildOrganicSeasonProgression({
      gameState: gs,
      player: p,
      ...resolveSeasonEndTrainingAccumulatorOverrides({ accumulator: p.seasonTrainingAccumulator, seasonId: gs.season.id, totalMatchdays: 20, jeSpieltag: true }),
    });
    expect(ende.netSetpoints).toBeCloseTo(0, 6);
    for (const e of ende.attributeBreakdown) {
      expect(e.training).toBeGreaterThanOrEqual(0);
      expect(e.delta).toBe(0);
    }
    // Die Saison hat dem Spieler Abbau und Training gebucht, beides im Verlauf sichtbar; Netto == Attribut-Differenz.
    const summe = trainingsSaisonSumme(gs, SPIELER_ID);
    expect(summe.abbauSumme).toBeGreaterThan(0);
    const diff = PROGRESSION_ATTRIBUTE_ORDER.reduce((s, a) => s + attr(p, a) - attr(spieler(BASIS), a), 0);
    expect(diff).toBeCloseTo(summe.nettoSumme, 2);
  });

  it("ohne Stempel (alt) rechnet alles wie vorher: kein Abbau je Spieltag im Verlauf", () => {
    const alt = { ...BASIS, seasonState: { ...BASIS.seasonState, entwicklungsRegel: { seasonId: BASIS.season.id, regel: "alt" as const } } } as GameState;
    const gs1 = buche(alt, "md-1");
    const [zeile] = entpackeTrainingsVerlauf(gs1, SPIELER_ID);
    expect(zeile!.abbau).toEqual({});
    expect(zeile!.leistung).toEqual({});
  });
});

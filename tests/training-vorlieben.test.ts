import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";
import {
  stempleTrainingsVorliebenBeimAnlegen,
  stempleTrainingsVorliebenNachLaden,
  trainingsVorliebenAktivFuer,
  trainingsVorliebenFuerSpielmodus,
  trainingsVorliebenRegelFuer,
} from "@/lib/resolve/trainings-vorlieben";
import { officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";
import {
  baueSaisonFortschritt,
  baueZielHeatmap,
  besteZelle,
  bereichVonDisziplin,
  spBisSaisonende,
  trainingsFenster,
  wertSpanne,
} from "@/lib/training/training-heatmap";
import {
  baueTrainingsZielKontext,
  berechneSpieltagsZuwachs,
  bewerteTrainingsZiele,
  prognostiziereSpieltagsTraining,
} from "@/lib/training/spieltag-training";
import {
  TRAININGS_VORLIEBEN_AUSGLEICH,
  VORLIEBE_FAKTOR_LIEBLING,
  VORLIEBE_FAKTOR_UNGELIEBT,
  aktuellesTrainingsZielId,
  leiteTrainingsVorliebenAb,
  vorliebeArt,
  vorliebeFaktor,
  vorliebeMoral,
} from "@/lib/training/trainings-vorlieben";

/**
 * TRAININGSVORLIEBEN (22.11.): Ableitung, Stempel, Budget-Faktor, Heatmap = Buchungsfunktion, Moral-Grund, KI-Gewicht.
 * Doku: docs/design/training-r2-bau-22-11.md.
 */

const IDS = Array.from({ length: 20 }, (_, i) => `md-${i + 1}`);
let BASIS: GameState;
let SPIELER: Player;

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
    seasonState: { ...voll.seasonState, seasonId, entwicklungsRegel: { seasonId, regel: "neu" }, trainingsVorlieben: { seasonId, regel: "v1" } },
    matchdayState: { ...voll.matchdayState, matchdayId: "md-12" },
  } as unknown as GameState;
  SPIELER = BASIS.players.find((p) => p.id === rosters[0]!.playerId)!;
}, 60_000);

afterEach(() => {
  delete process.env.OLY_TRAINING_VORLIEBEN;
});

const mitRegel = (gs: GameState, regel: "aus" | "v1"): GameState =>
  ({ ...gs, seasonState: { ...gs.seasonState, trainingsVorlieben: { seasonId: gs.season.id, regel } } }) as GameState;
const neuesSpiel = () =>
  ({ scenarioMeta: { gameMode: "battle" }, season: { id: "season-1" }, seasonState: { seasonId: "season-1" } }) as unknown as GameState;

describe("Vorlieben: Ableitung je Spieler", () => {
  it("zwei Lieblinge und eine ungeliebte, verschieden, alles Matrix-Disziplinen", () => {
    for (const p of BASIS.players) {
      const v = leiteTrainingsVorliebenAb(p, "season-1");
      expect(new Set([...v.lieblinge, v.ungeliebt]).size).toBe(3);
      for (const d of [...v.lieblinge, v.ungeliebt]) expect(officialDisciplineWeightOrder as readonly string[]).toContain(d);
    }
  });

  it("wechselt mit der Saison (Chris 23.11.): andere Saison, fuer die meisten Spieler andere Vorlieben; dieselbe Saison, dieselben", () => {
    let gewechselt = 0;
    for (let i = 0; i < 200; i += 1) {
      const p = { id: `test-spieler-${i}`, className: "Berserker" };
      const s1 = leiteTrainingsVorliebenAb(p, "season-1");
      expect(leiteTrainingsVorliebenAb(p, "season-1")).toEqual(s1);
      const s2 = leiteTrainingsVorliebenAb(p, "season-2");
      if (JSON.stringify(s1) !== JSON.stringify(s2)) gewechselt += 1;
    }
    expect(gewechselt).toBeGreaterThan(150);
  });

  it("deterministisch aus der Spieler-ID: gleiches Ergebnis, auch wenn sich Werte und Eignungen aendern", () => {
    const a = leiteTrainingsVorliebenAb(SPIELER, "season-1");
    const veraendert = {
      ...SPIELER,
      disciplineRatings: Object.fromEntries(Object.keys(SPIELER.disciplineRatings ?? {}).map((k) => [k, 1])),
      attributeSheetStats: { ...(SPIELER.attributeSheetStats ?? {}), power: 99 },
    } as Player;
    expect(leiteTrainingsVorliebenAb(veraendert, "season-1")).toEqual(a);
    expect(leiteTrainingsVorliebenAb({ id: SPIELER.id, className: SPIELER.className }, "season-1")).toEqual(a);
  });

  it("verteilt sich ueber alle Disziplinen und kippt mit der Klassenfarbe leicht (Tendenz, kein Zwang)", () => {
    const zaehler = new Map<string, number>();
    let imFarbton = 0;
    const n = 600;
    for (let i = 0; i < n; i += 1) {
      const v = leiteTrainingsVorliebenAb({ id: `test-spieler-${i}`, className: "Berserker" }, "season-1");
      for (const d of v.lieblinge) {
        zaehler.set(d, (zaehler.get(d) ?? 0) + 1);
        if (bereichVonDisziplin(d) === "pow") imFarbton += 1;
      }
    }
    // jede der 20 Disziplinen wird von jemandem geliebt; kein Ausreisser
    expect(zaehler.size).toBe(20);
    // 5 von 20 Disziplinen sind POW (25 %); mit Tendenz deutlich mehr, aber weit unter 100 %
    const anteil = imFarbton / (2 * n);
    expect(anteil).toBeGreaterThan(0.3);
    expect(anteil).toBeLessThan(0.6);
  });

  it("Faktoren: Liebling x1,30, ungeliebt x0,50 (Chris 23.11.); Moral +3 und -6", () => {
    expect(VORLIEBE_FAKTOR_LIEBLING).toBe(1.3);
    expect(VORLIEBE_FAKTOR_UNGELIEBT).toBe(0.5);
    expect([vorliebeFaktor(1), vorliebeFaktor(-1), vorliebeFaktor(0)]).toEqual([1.3, 0.5, 1]);
    expect([vorliebeMoral(1), vorliebeMoral(-1), vorliebeMoral(0)]).toEqual([3, -6, 0]);
    const v = leiteTrainingsVorliebenAb(SPIELER, "season-1");
    expect(vorliebeArt(SPIELER, v.lieblinge[0], "season-1")).toBe(1);
    expect(vorliebeArt(SPIELER, v.ungeliebt, "season-1")).toBe(-1);
    expect(vorliebeArt(SPIELER, null, "season-1")).toBe(0);
  });
});

describe("Vorlieben: Stempel im Spielstand", () => {
  it("ohne Stempel, mit fremdem Stempel und mit aus gilt aus", () => {
    expect(trainingsVorliebenRegelFuer(undefined)).toBe("aus");
    expect(trainingsVorliebenRegelFuer({ seasonState: { seasonId: "s" } })).toBe("aus");
    expect(trainingsVorliebenRegelFuer({ seasonState: { seasonId: "s2", trainingsVorlieben: { seasonId: "s1", regel: "v1" } } })).toBe("aus");
    expect(trainingsVorliebenAktivFuer({ seasonState: { seasonId: "s", trainingsVorlieben: { seasonId: "s", regel: "aus" } } })).toBe(false);
  });

  it("neues Spiel: v1 ab Saison 1, idempotent; die Prozessvariable wirkt nur beim Stempeln", () => {
    const gs = stempleTrainingsVorliebenBeimAnlegen(neuesSpiel());
    expect(gs.seasonState.trainingsVorlieben).toEqual({ seasonId: "season-1", regel: "v1" });
    expect(stempleTrainingsVorliebenBeimAnlegen(gs)).toBe(gs);
    process.env.OLY_TRAINING_VORLIEBEN = "aus";
    expect(trainingsVorliebenAktivFuer(gs)).toBe(true);
    expect(trainingsVorliebenFuerSpielmodus(neuesSpiel(), "season-2")).toEqual({ seasonId: "season-2", regel: "aus" });
  });

  it("Notbremse aus-sofort schaltet die Wirkung auch mitten in der Saison ab", () => {
    const gs = stempleTrainingsVorliebenBeimAnlegen(neuesSpiel());
    process.env.OLY_TRAINING_VORLIEBEN = "aus-sofort";
    expect(trainingsVorliebenAktivFuer(gs)).toBe(false);
  });

  it("Manager-Spielstand bekommt keinen Stempel", () => {
    const manager = { scenarioMeta: { gameMode: "manager" }, season: { id: "season-1" }, seasonState: { seasonId: "season-1" } } as unknown as GameState;
    expect(stempleTrainingsVorliebenBeimAnlegen(manager)).toBe(manager);
    expect(trainingsVorliebenFuerSpielmodus(manager, "season-2")).toBeUndefined();
  });

  it("bestehender Spielstand: Lade-Migration schreibt aus fest, der Saisonwechsel bringt v1", () => {
    const geladen = stempleTrainingsVorliebenNachLaden(neuesSpiel());
    expect(geladen.seasonState.trainingsVorlieben).toEqual({ seasonId: "season-1", regel: "aus" });
    expect(stempleTrainingsVorliebenNachLaden(geladen)).toBe(geladen);
    const wechsel = {
      ...geladen,
      season: { id: "season-2" },
      seasonState: { ...geladen.seasonState, seasonId: "season-2", trainingsVorlieben: trainingsVorliebenFuerSpielmodus(geladen, "season-2") },
    } as GameState;
    expect(trainingsVorliebenRegelFuer(geladen)).toBe("aus");
    expect(trainingsVorliebenRegelFuer(wechsel)).toBe("v1");
  });
});

describe("Vorlieben: Wirkung auf das Trainingsbudget (eine Funktion fuer Buchung, Vorschau und Heatmap)", () => {
  const ziel = (id: string) => ({ disziplinId: id, weg: 0 as const });

  it("Liebling x1,30, ungeliebt x0,50, neutral x1 gegenueber der Regel aus (mal Ausgleich)", () => {
    const v = leiteTrainingsVorliebenAb(SPIELER, BASIS.season.id);
    const neutral = officialDisciplineWeightOrder.find((d) => !v.lieblinge.includes(d) && v.ungeliebt !== d)!;
    const aus = mitRegel(BASIS, "aus");
    const rechne = (gs: GameState, d: string) => berechneSpieltagsZuwachs({ gameState: gs, player: SPIELER, ziel: ziel(d), quelle: "manager" })!;
    for (const [d, faktor] of [
      [v.lieblinge[0], 1.3],
      [v.lieblinge[1], 1.3],
      [v.ungeliebt, 0.5],
      [neutral, 1],
    ] as const) {
      const an = rechne(BASIS, d);
      const ohne = rechne(aus, d);
      expect(an.vorliebe.faktor).toBe(faktor);
      expect(ohne.vorliebe).toEqual({ art: 0, faktor: 1 });
      expect(an.budgetFaktor / ohne.budgetFaktor).toBeCloseTo(faktor * TRAININGS_VORLIEBEN_AUSGLEICH, 3);
      expect(an.budget / ohne.budget).toBeCloseTo(faktor * TRAININGS_VORLIEBEN_AUSGLEICH, 1);
    }
  });

  it("Regel aus liefert exakt den Stand vor Runde 2 (Notbremse ebenso)", () => {
    const v = leiteTrainingsVorliebenAb(SPIELER, BASIS.season.id);
    const aus = berechneSpieltagsZuwachs({ gameState: mitRegel(BASIS, "aus"), player: SPIELER, ziel: ziel(v.lieblinge[0]), quelle: "manager" })!;
    process.env.OLY_TRAINING_VORLIEBEN = "aus-sofort";
    const notbremse = berechneSpieltagsZuwachs({ gameState: BASIS, player: SPIELER, ziel: ziel(v.lieblinge[0]), quelle: "manager" })!;
    expect(notbremse.zuwachs).toEqual(aus.zuwachs);
    expect(notbremse.budgetFaktor).toBe(aus.budgetFaktor);
  });

  it("die KI gewichtet Lieblinge mit x1,30 und die ungeliebte mit x0,50 in der Zielbewertung", () => {
    const aus = mitRegel(BASIS, "aus");
    const kontextAn = baueTrainingsZielKontext(BASIS, "md-12");
    const kontextAus = baueTrainingsZielKontext(aus, "md-12");
    const v = leiteTrainingsVorliebenAb(SPIELER, BASIS.season.id);
    const an = new Map(bewerteTrainingsZiele(kontextAn, SPIELER).map((b) => [b.disziplinId, b.punkte]));
    const ohne = new Map(bewerteTrainingsZiele(kontextAus, SPIELER).map((b) => [b.disziplinId, b.punkte]));
    expect(an.size).toBe(20);
    for (const [d, faktor] of [
      [v.lieblinge[0], 1.3],
      [v.ungeliebt, 0.5],
    ] as const) {
      if ((ohne.get(d) ?? 0) > 0.001) expect((an.get(d) ?? 0) / (ohne.get(d) ?? 1)).toBeCloseTo(faktor, 2);
    }
  });
});

describe("Heatmap: dieselbe Rechnung wie die Buchung", () => {
  it("ein Trainingstag: die Zelle ist genau der Zuwachs, den `prognostiziereSpieltagsTraining` / die Buchungsfunktion liefert", () => {
    const letzter = { ...BASIS, matchdayState: { ...BASIS.matchdayState, matchdayId: "md-20" } } as GameState;
    const heat = baueZielHeatmap({ gameState: letzter, playerId: SPIELER.id })!;
    expect(heat.trainings).toBe(1);
    expect(heat.zeilen).toHaveLength(20);
    for (const zeile of heat.zeilen.slice(0, 6)) {
      for (const zelle of zeile.zellen) {
        const direkt = berechneSpieltagsZuwachs({ gameState: letzter, player: SPIELER, ziel: { disziplinId: zelle.disziplinId, weg: zelle.weg }, quelle: "manager" })!;
        expect(zelle.sp).toBeCloseTo(direkt.summe, 3);
        expect(zelle.budgetFaktor).toBeCloseTo(direkt.budgetFaktor, 3);
      }
    }
    const zelle = heat.zeilen[0]!.zellen[0]!;
    const prog = prognostiziereSpieltagsTraining({ gameState: letzter, playerId: SPIELER.id, ziel: { disziplinId: zelle.disziplinId, weg: zelle.weg } });
    expect(prog && !prog.verletzt ? prog.summe : null).toBeCloseTo(zelle.sp, 3);
  });

  it("mehrere Tage: mehr SP, Vorliebe steckt in der Zahl, die beste Zelle ist die mit dem groessten Wert", () => {
    const heat = baueZielHeatmap({ gameState: BASIS, playerId: SPIELER.id })!;
    expect(heat.trainings).toBe(9);
    const einer = baueZielHeatmap({ gameState: { ...BASIS, matchdayState: { ...BASIS.matchdayState, matchdayId: "md-20" } } as GameState, playerId: SPIELER.id })!;
    const zelle = heat.zeilen[0]!.zellen[0]!;
    expect(zelle.sp).toBeGreaterThan(einer.zeilen[0]!.zellen[0]!.sp * 4);
    const beste = besteZelle(heat, "sp")!;
    const { max } = wertSpanne(heat, "sp");
    expect(beste.sp).toBeCloseTo(max, 6);
    expect(spBisSaisonende({ gameState: BASIS, player: SPIELER, ziel: { disziplinId: beste.disziplinId, weg: beste.weg }, modus: "mittel" })).toBeCloseTo(beste.sp, 6);
  });

  it("alle Zellen tragen Bereich, Weg und Attribute; die Vorlieben-Zeilen entsprechen der Ableitung", () => {
    const heat = baueZielHeatmap({ gameState: BASIS, playerId: SPIELER.id })!;
    const v = leiteTrainingsVorliebenAb(SPIELER, BASIS.season.id);
    expect(heat.vorliebenAktiv).toBe(true);
    for (const zeile of heat.zeilen) {
      expect(zeile.bereich).not.toBeNull();
      expect(zeile.zellen.length).toBeGreaterThanOrEqual(1);
      expect(zeile.vorliebe).toBe(v.lieblinge.includes(zeile.disziplinId) ? 1 : v.ungeliebt === zeile.disziplinId ? -1 : 0);
      for (const zelle of zeile.zellen) expect(zelle.attribute[0]!.anteil).toBe(0.6);
    }
    const aus = baueZielHeatmap({ gameState: mitRegel(BASIS, "aus"), playerId: SPIELER.id })!;
    expect(aus.vorliebenAktiv).toBe(false);
    expect(aus.zeilen.every((z) => z.vorliebe === 0)).toBe(true);
  });

  it("Rang in der Liga je Disziplin: 1 = bester, gezaehlt unter den Kaderspielern der eigenen Liga", () => {
    const heat = baueZielHeatmap({ gameState: BASIS, playerId: SPIELER.id })!;
    const kader = BASIS.rosters.map((r) => BASIS.players.find((p) => p.id === r.playerId)!);
    for (const zeile of heat.zeilen.slice(0, 5)) {
      const eigener = SPIELER.disciplineRatings?.[zeile.disziplinId];
      if (typeof eigener !== "number") continue;
      const besser = kader.filter((p) => p.id !== SPIELER.id && (p.disciplineRatings?.[zeile.disziplinId] ?? -1) > eigener).length;
      expect(zeile.rangLiga).toBe(besser + 1);
      expect(zeile.ligaGroesse).toBe(kader.length);
    }
  });

  it("Verletzte: Ausfall-Spieltage zaehlen nicht, die Prognose gilt ab der Rueckkehr", () => {
    const fenster = trainingsFenster(BASIS, SPIELER.id);
    expect(fenster.ids).toHaveLength(9);
    expect(fenster.verletzt).toBe(0);
  });

  it("Fortschritt dieser Saison: ohne Verlauf alles null, mit Verlauf die gebuchte Veraenderung", () => {
    const leer = baueSaisonFortschritt(BASIS, SPIELER.id)!;
    expect(leer.attribute).toHaveLength(12);
    expect(leer.nettoSumme).toBe(0);
    expect(leer.groessterFortschritt).toBeNull();
    const mit = {
      ...BASIS,
      players: BASIS.players.map((p) =>
        p.id === SPIELER.id
          ? {
              ...p,
              seasonTrainingAccumulator: {
                seasonId: BASIS.season.id,
                matchdaysCounted: 2,
                verlauf: [
                  { m: "md-1", s: "t", d: "tdm", w: 0, i: "mittel", z: { power: 0.2, health: 0.1 } },
                  { m: "md-2", s: "t", d: "tdm", w: 0, i: "mittel", z: { power: 0.3 }, a: { health: 0.05 } },
                ],
              },
            }
          : p,
      ),
    } as unknown as GameState;
    const f = baueSaisonFortschritt(mit, SPIELER.id)!;
    expect(f.trainingSp).toBeCloseTo(0.6, 2);
    expect(f.attribute.find((a) => a.attribute === "power")!.delta).toBeCloseTo(0.5, 2);
    expect(f.attribute.find((a) => a.attribute === "health")!.delta).toBeCloseTo(0.05, 2);
    expect(f.groessterFortschritt).toBe("power");
    expect(f.spieltage).toEqual({ von: 1, bis: 2 });
  });
});

describe("Vorlieben: Moral-Grund", () => {
  const moralMit = (gs: GameState, ziel: string | null) => {
    const teamId = gs.rosters.find((r) => r.playerId === SPIELER.id)!.teamId;
    const spielstand = {
      ...gs,
      players: gs.players.map((p) => (p.id === SPIELER.id ? { ...p, trainingsZiel: ziel ? { disziplinId: ziel, weg: 0 as const } : null } : p)),
    } as GameState;
    return assessPlayerMorale({ gameState: spielstand, playerId: SPIELER.id, teamId });
  };

  it("Lieblingsdisziplin als Ziel: +3, ungeliebte: -6, sonst kein Grund; Regel aus: nie", () => {
    const v = leiteTrainingsVorliebenAb(SPIELER, BASIS.season.id);
    const neutral = officialDisciplineWeightOrder.find((d) => !v.lieblinge.includes(d) && v.ungeliebt !== d)!;
    const grund = (a: ReturnType<typeof moralMit>, id: string) => a?.reasons.find((r) => r.reasonId === id) ?? null;
    expect(grund(moralMit(BASIS, v.lieblinge[0]), "training_favorite_discipline")?.valueDelta).toBe(3);
    expect(grund(moralMit(BASIS, v.ungeliebt), "training_disliked_discipline")?.valueDelta).toBe(-6);
    const n = moralMit(BASIS, neutral);
    expect(grund(n, "training_favorite_discipline")).toBeNull();
    expect(grund(n, "training_disliked_discipline")).toBeNull();
    const aus = mitRegel(BASIS, "aus");
    expect(grund(moralMit(aus, v.lieblinge[0]), "training_favorite_discipline")).toBeNull();
  });

  it("ohne gesetztes Ziel zaehlt das Ziel des letzten gebuchten Trainingstags", () => {
    expect(aktuellesTrainingsZielId({ trainingsZiel: null, seasonTrainingAccumulator: { seasonId: "s", matchdaysCounted: 1, verlauf: [{ m: "a", s: "t", d: "tdm" }, { m: "b", s: "v" }] } as never }, "s")).toBe("tdm");
    expect(aktuellesTrainingsZielId({ trainingsZiel: null, seasonTrainingAccumulator: null }, "s")).toBeNull();
    expect(aktuellesTrainingsZielId({ trainingsZiel: { disziplinId: "hockey", weg: 0 }, seasonTrainingAccumulator: null }, "s")).toBe("hockey");
  });
});

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  ENTWICKLUNGS_PARAMETER_NEU2,
  ENTWICKLUNGS_PARAMETER_STANDARD,
  ENTWICKLUNGS_TEMPO_NEU2,
  entwicklungsParameterFuer,
} from "@/lib/training/entwicklung-neu";
import { berechneSpieltagsZuwachs } from "@/lib/training/spieltag-training";
import { GUETE_PARAMETER_STANDARD, setzeGueteParameterFuerMessung, trainingsGuete } from "@/lib/training/trainings-guete";
import { trainingsGueteFuerSpieler } from "@/lib/training/trainings-guete-spieler";

/**
 * VERTEILUNG 10/20/40/20/10 (Chris, 23.11.): Stempel neu2, Tempo, Trainingsguete aus Ursachen.
 * docs/design/entwicklung-balance-22-11.md Abschnitt 9.
 */

let BASIS: GameState;
let SPIELER: Player;

const stempel = (gs: GameState, regel: "alt" | "neu" | "neu2"): GameState =>
  ({ ...gs, seasonState: { ...gs.seasonState, entwicklungsRegel: { seasonId: gs.season.id, regel } } }) as GameState;

beforeAll(() => {
  const voll = createSingleplayerGameState();
  const team = voll.rosters[0]!.teamId;
  const rosters = voll.rosters.filter((r) => r.teamId === team);
  const ids = new Set(rosters.map((r) => r.playerId));
  BASIS = {
    ...voll,
    scenarioMeta: { ...(voll.scenarioMeta ?? {}), gameMode: "battle" },
    teams: voll.teams.filter((t) => t.teamId === team),
    rosters,
    players: voll.players.filter((p) => ids.has(p.id)).map((p) => ({ ...p, trainingMode: "mittel" as const, fatigue: 0 })),
  } as unknown as GameState;
  SPIELER = BASIS.players[0]!;
}, 60_000);

afterEach(() => setzeGueteParameterFuerMessung(null));

describe("Verteilung neu2: Parameter", () => {
  it("alle Raten wachsen um das Tempo, die Summengrenzen mit; die Form (60/40, Schwung, Gamma) bleibt", () => {
    const k = ENTWICKLUNGS_TEMPO_NEU2;
    expect(k).toBeGreaterThan(1);
    expect(ENTWICKLUNGS_PARAMETER_NEU2.trainingsSkala).toBeCloseTo(ENTWICKLUNGS_PARAMETER_STANDARD.trainingsSkala * k);
    expect(ENTWICKLUNGS_PARAMETER_NEU2.leistungsSkala).toBeCloseTo(ENTWICKLUNGS_PARAMETER_STANDARD.leistungsSkala * k);
    expect(ENTWICKLUNGS_PARAMETER_NEU2.abbauSkala).toBeCloseTo(k);
    expect(ENTWICKLUNGS_PARAMETER_NEU2.schwungSumme).toBeCloseTo(ENTWICKLUNGS_PARAMETER_STANDARD.schwungSumme * k);
    expect(ENTWICKLUNGS_PARAMETER_NEU2.gewichtTraining).toBe(0.6);
    expect(ENTWICKLUNGS_PARAMETER_NEU2.gewichtLeistung).toBe(0.4);
    expect(ENTWICKLUNGS_PARAMETER_NEU2.gamma).toBe(ENTWICKLUNGS_PARAMETER_STANDARD.gamma);
  });

  it("die Saison-Parameter folgen dem Stempel: neu2 = skaliert, neu und alt = Stand 22.11.", () => {
    expect(entwicklungsParameterFuer(stempel(BASIS, "neu2")).trainingsSkala).toBeCloseTo(ENTWICKLUNGS_PARAMETER_NEU2.trainingsSkala);
    expect(entwicklungsParameterFuer(stempel(BASIS, "neu")).trainingsSkala).toBeCloseTo(ENTWICKLUNGS_PARAMETER_STANDARD.trainingsSkala);
  });
});

describe("Trainingsguete: Ursachen, keine Wuerfel je Spieltag", () => {
  const basis = { playerId: "p-1", seasonId: "season-1", modus: "mittel" as const, wunsch: null, belastung: 0 };

  it("erfuellter Wunsch hebt, verfehlter senkt (zwei Stufen mehr als eine)", () => {
    const ohne = trainingsGuete(basis).passung;
    expect(ohne).toBe(0);
    const erfuellt = trainingsGuete({ ...basis, wunsch: "mittel" });
    const eine = trainingsGuete({ ...basis, wunsch: "hart" });
    const zwei = trainingsGuete({ ...basis, modus: "leicht", wunsch: "hart" });
    expect(erfuellt.passung).toBeGreaterThan(0);
    expect(eine.passung).toBeLessThan(0);
    expect(zwei.passung).toBeLessThan(eine.passung);
    expect(erfuellt.faktor).toBeGreaterThan(eine.faktor);
    expect(eine.faktor).toBeGreaterThan(zwei.faktor);
  });

  it("Ueberlastung senkt das Training und erhoeht den Abbau, im Modus hart staerker, im Modus leicht gar nicht", () => {
    const ruhig = trainingsGuete(basis);
    const ueber = trainingsGuete({ ...basis, belastung: 60 });
    const limit = trainingsGuete({ ...basis, belastung: 85 });
    const hartLimit = trainingsGuete({ ...basis, modus: "hart", belastung: 85 });
    const leichtLimit = trainingsGuete({ ...basis, modus: "leicht", belastung: 85 });
    expect(ruhig.belastung).toBe(0);
    expect(ueber.belastung).toBeLessThan(0);
    expect(limit.belastung).toBeLessThan(ueber.belastung);
    expect(hartLimit.belastung).toBeLessThan(limit.belastung);
    expect(leichtLimit.belastung).toBe(0);
    expect(ueber.abbauFaktor).toBeGreaterThan(1);
    expect(hartLimit.abbauFaktor).toBeGreaterThan(limit.abbauFaktor);
    expect(ruhig.abbauFaktor).toBe(1);
  });

  it("die Entfaltung ist fest je Spieler und Saison (nicht je Aufruf), wechselt aber mit der Saison und liegt in den Grenzen", () => {
    const a = trainingsGuete(basis);
    expect(trainingsGuete(basis).entfaltung).toBe(a.entfaltung);
    expect(Math.abs(a.entfaltung)).toBeLessThanOrEqual(GUETE_PARAMETER_STANDARD.entfaltung);
    const werte = new Set(Array.from({ length: 40 }, (_, i) => trainingsGuete({ ...basis, playerId: `p-${i}` }).entfaltung.toFixed(4)));
    expect(werte.size).toBeGreaterThan(30);
    expect(trainingsGuete({ ...basis, seasonId: "season-2" }).entfaltung).not.toBe(a.entfaltung);
  });

  it("der Gesamtfaktor bleibt in den Grenzen", () => {
    const schlecht = trainingsGuete({ ...basis, modus: "hart", wunsch: "leicht", belastung: 90 });
    expect(schlecht.faktor).toBeGreaterThanOrEqual(GUETE_PARAMETER_STANDARD.guteMin);
    setzeGueteParameterFuerMessung({ passungErfuellt: 5 });
    expect(trainingsGuete({ ...basis, wunsch: "mittel" }).faktor).toBeLessThanOrEqual(GUETE_PARAMETER_STANDARD.guteMax);
  });
});

describe("Trainingsguete im Spielstand: nur bei neu2, gezeigt = gebucht", () => {
  const ziel = { disziplinId: "gewichtheben", weg: 0 as const };

  it("ohne neu2-Stempel gibt es keine Guete und der Zuwachs bleibt der alte", () => {
    expect(trainingsGueteFuerSpieler(stempel(BASIS, "neu"), SPIELER)).toBeNull();
    expect(trainingsGueteFuerSpieler(stempel(BASIS, "alt"), SPIELER)).toBeNull();
    const z = berechneSpieltagsZuwachs({ gameState: stempel(BASIS, "neu"), player: SPIELER, ziel, quelle: "manager" });
    expect(z?.guete).toBeNull();
  });

  it("mit neu2 steckt der Guete-Faktor im Budget und im Abbau des Spieltags (eine Rechnung fuer Buchung und Vorschau)", () => {
    const gs = stempel(BASIS, "neu2");
    const ueberlastet = { ...SPIELER, trainingMode: "hart" as const, fatigue: 90 };
    const frisch = { ...SPIELER, trainingMode: "hart" as const, fatigue: 0 };
    const zUe = berechneSpieltagsZuwachs({ gameState: gs, player: ueberlastet, ziel, quelle: "manager" })!;
    const zFr = berechneSpieltagsZuwachs({ gameState: gs, player: frisch, ziel, quelle: "manager" })!;
    expect(zUe.guete).not.toBeNull();
    expect(zUe.guete!.belastung).toBeLessThan(0);
    expect(zFr.guete!.belastung).toBe(0);
    expect(zUe.budgetFaktor).toBeLessThan(zFr.budgetFaktor);
    const abbauUe = Object.values(zUe.abbau).reduce((a, b) => a + (b ?? 0), 0);
    const abbauFr = Object.values(zFr.abbau).reduce((a, b) => a + (b ?? 0), 0);
    expect(abbauUe).toBeGreaterThan(abbauFr);
    // Derselbe Aufruf zweimal: dieselbe Zahl (kein Zufall je Aufruf).
    const nochmal = berechneSpieltagsZuwachs({ gameState: gs, player: ueberlastet, ziel, quelle: "manager" })!;
    expect(nochmal.budgetFaktor).toBe(zUe.budgetFaktor);
  });

  it("neu2 trainiert in der Summe mehr je Spieltag als neu (Tempo), gleiche Ziel-Disziplin", () => {
    const neu = berechneSpieltagsZuwachs({ gameState: stempel(BASIS, "neu"), player: SPIELER, ziel, quelle: "manager" })!;
    const neu2 = berechneSpieltagsZuwachs({ gameState: stempel(BASIS, "neu2"), player: SPIELER, ziel, quelle: "manager" })!;
    expect(neu2.summe).toBeGreaterThan(neu.summe * 2);
  });
});

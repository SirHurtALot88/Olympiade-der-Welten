import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import { computeIndividualBoxscorePpsFromFixtureResults, resolveArenaPpsReferenz } from "@/lib/resolve/battle-mode-arena-team-points";
import { PP_SKALA_MAX, ppAusKurveSkaliert, ppSkalaAnker, skaliereUngedeckelt } from "@/lib/resolve/pp-skala";
import {
  PP_TAGESANKER_KNIE,
  PP_TAGESANKER_MAX,
  PP_TAGESANKER_ZIEL,
  ppTagesankerFuer,
  ppTagesankerWert,
  verteilePpNachTagesanker,
  weicheKappe,
} from "@/lib/resolve/pp-tagesanker";
import type { GameState } from "@/lib/data/olyDataTypes";
import { compactFoundationInitialGameState, rehydrateGameStateAfterCompactPut } from "@/lib/persistence/foundation-initial-compact-state";
import {
  stelleLaufendeSaisonAufC2Um,
  stempleWertungsSkalen,
  stempleWertungsSkalenBeimAnlegen,
  wertungsSkalenFuerNeueSaison,
} from "@/lib/resolve/wertungs-skalen";

// PP-TAGESANKER (scharf 22.11., docs/design/pp-tagesanker-live-22-11.md): die Schaltung liegt im Saison-Stempel
// `seasonState.wertungsSkalen.ppTagesanker`. Geprueft wird: neues Spiel an, laufender Save aus bis zum
// Saisonwechsel, Rueckweg, Notbremse; dazu die Verteilung selbst (Reihenfolge, unter 5, kein Klumpen,
// Tagesbester unabhaengig von der Feldstaerke) und die Rechenstelle der Arena-Boxscore-PP.

const battle = (seasonId: string, stempel?: Record<string, unknown>) =>
  ({
    scenarioMeta: { gameMode: "battle" },
    season: { id: seasonId, matchdayIds: ["md-1", "md-2", "md-3", "md-4"] },
    seasonState: { seasonId, matchdayResults: [], ...(stempel ? { wertungsSkalen: stempel } : {}) },
  }) as unknown as GameState;

function leereSchalter() {
  for (const k of ["OLY_PP_TAGESANKER", "NEXT_PUBLIC_OLY_PP_TAGESANKER", "OLY_PP_SKALA", "NEXT_PUBLIC_OLY_PP_SKALA", "OLY_ERGEBNIS_SKALA", "NEXT_PUBLIC_OLY_ERGEBNIS_SKALA"]) vi.stubEnv(k, "");
}

describe("PP-Tagesanker: Stempel und Schalter", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("neues Spiel: ab Saison 1 an (Stempel beim Anlegen), nur zusammen mit C2", () => {
    leereSchalter();
    const neu = stempleWertungsSkalenBeimAnlegen(battle("season-1"));
    expect(neu.seasonState.wertungsSkalen?.ppTagesanker).toBe(true);
    expect(ppTagesankerFuer(neu, "md-1")).toBe(true);
    // Manager-Modus bekommt keinen Stempel und damit nie den Tagesanker.
    const manager = { ...battle("season-1"), scenarioMeta: { gameMode: "manager" } } as unknown as GameState;
    expect(ppTagesankerFuer(stempleWertungsSkalenBeimAnlegen(manager), "md-1")).toBe(false);
    // Stempel mit alter PP-Skala: nie Tagesanker, selbst wenn das Feld gesetzt waere.
    expect(ppTagesankerFuer(battle("season-1", { seasonId: "season-1", pp: "alt", ergebnis: "alt", ppTagesanker: true }))).toBe(false);
    expect(ppTagesankerFuer(null)).toBe(false);
  });

  it("bestehender Save: laufende Saison bleibt aus (kein Stempel, Stempel ohne Feld, Umstellung mitten in der Saison)", () => {
    leereSchalter();
    expect(ppTagesankerFuer(battle("season-4"))).toBe(false);
    expect(ppTagesankerFuer(battle("season-4", { seasonId: "season-4", pp: "c2", ergebnis: "e1" }))).toBe(false);
    const mitten = stelleLaufendeSaisonAufC2Um(battle("season-4"));
    expect(mitten.seasonState.wertungsSkalen?.pp).toBe("c2");
    expect(ppTagesankerFuer(mitten, "md-2")).toBe(false);
  });

  it("Saisonwechsel: die naechste Saison bekommt den Tagesanker, die alte Saison behaelt ihren Stempel", () => {
    leereSchalter();
    const laufend = battle("season-4", { seasonId: "season-4", pp: "c2", ergebnis: "e1" });
    const naechste = stempleWertungsSkalen({ ...laufend.seasonState, seasonId: "season-5" });
    expect(naechste.wertungsSkalen).toEqual({ seasonId: "season-5", pp: "c2", ergebnis: "e1", ppTagesanker: true });
    expect(ppTagesankerFuer({ ...laufend, seasonState: naechste } as GameState)).toBe(true);
    expect(ppTagesankerFuer(laufend)).toBe(false);
    // Ein Stempel einer anderen Saison zaehlt nicht.
    expect(ppTagesankerFuer({ ...laufend, seasonState: { ...naechste, seasonId: "season-6" } } as GameState)).toBe(false);
  });

  it("Rueckweg OLY_PP_TAGESANKER=aus: neue Saisons ohne, gestempelte Saison rechnet wie gestempelt weiter", () => {
    leereSchalter();
    const gestempelt = battle("season-1", wertungsSkalenFuerNeueSaison("season-1"));
    vi.stubEnv("OLY_PP_TAGESANKER", "aus");
    expect(wertungsSkalenFuerNeueSaison("season-2")).toEqual({ seasonId: "season-2", pp: "c2", ergebnis: "e1", ppTagesanker: false });
    expect(ppTagesankerFuer(gestempelt)).toBe(true);
    expect(ppTagesankerFuer(battle("season-2", wertungsSkalenFuerNeueSaison("season-2")))).toBe(false);
  });

  it("Notbremse aus-sofort ignoriert den Stempel, auch fuer den Browser-Schalter", () => {
    leereSchalter();
    const gestempelt = battle("season-1", wertungsSkalenFuerNeueSaison("season-1"));
    vi.stubEnv("OLY_PP_TAGESANKER", "aus-sofort");
    expect(ppTagesankerFuer(gestempelt)).toBe(false);
    vi.stubEnv("OLY_PP_TAGESANKER", "");
    vi.stubEnv("NEXT_PUBLIC_OLY_PP_TAGESANKER", "aus-sofort");
    expect(ppTagesankerFuer(gestempelt)).toBe(false);
  });

  it("C2 ist Voraussetzung: PP-Notbremse und Messmodus roh schalten den Tagesanker mit ab", () => {
    leereSchalter();
    const gestempelt = battle("season-1", wertungsSkalenFuerNeueSaison("season-1"));
    vi.stubEnv("OLY_PP_SKALA", "aus-sofort");
    expect(ppTagesankerFuer(gestempelt)).toBe(false);
    vi.stubEnv("OLY_PP_SKALA", "roh");
    expect(ppTagesankerFuer(gestempelt)).toBe(false);
  });

  it("kompakte Anfangsladung und Rueckschreiben behalten das Stempelfeld (Browser = Server)", () => {
    leereSchalter();
    const voll = {
      ...battle("season-1", wertungsSkalenFuerNeueSaison("season-1")),
      players: [],
      playerBaselines: [],
      teams: [],
    } as unknown as GameState;
    const kompakt = compactFoundationInitialGameState(voll);
    expect(kompakt.seasonState.wertungsSkalen?.ppTagesanker).toBe(true);
    expect(ppTagesankerFuer(kompakt, "md-1")).toBe(true);
    const zurueck = rehydrateGameStateAfterCompactPut(voll, kompakt);
    expect(zurueck.seasonState.wertungsSkalen).toEqual(voll.seasonState.wertungsSkalen);
  });

  it("Eingabe-Hash: nur mit gestempeltem Tagesanker ein eigener Schluessel", () => {
    // (arena-eingabe-hash.ts ruft ppTagesankerFuer; der Schluessel haengt damit ausschliesslich am Stempel.)
    leereSchalter();
    expect(ppTagesankerFuer(battle("season-1", wertungsSkalenFuerNeueSaison("season-1")))).toBe(true);
    expect(ppTagesankerFuer(battle("season-1", { seasonId: "season-1", pp: "c2", ergebnis: "e1" }))).toBe(false);
  });
});

describe("PP-Tagesanker: weiche Kappe", () => {
  it("laesst Werte bis zum Knie unveraendert, ist darueber streng monoton und bleibt unter dem Maximum", () => {
    for (const x of [0, 0.5, 1.25, 3, PP_TAGESANKER_KNIE]) expect(weicheKappe(x)).toBeCloseTo(x, 12);
    expect(weicheKappe(-1)).toBe(0);
    expect(weicheKappe(Number.NaN)).toBe(0);
    let vorher = weicheKappe(PP_TAGESANKER_KNIE);
    for (let x = PP_TAGESANKER_KNIE + 0.25; x <= 20; x += 0.25) {
      const y = weicheKappe(x);
      expect(y).toBeGreaterThan(vorher);
      expect(y).toBeLessThan(PP_TAGESANKER_MAX);
      vorher = y;
    }
    // Stetig und glatt am Knie: Steigung 1 von beiden Seiten.
    const h = 1e-6;
    expect((weicheKappe(PP_TAGESANKER_KNIE + h) - weicheKappe(PP_TAGESANKER_KNIE)) / h).toBeCloseTo(1, 4);
  });
});

describe("PP-Tagesanker: Verteilung ueber alle Spieler eines Spieltags", () => {
  // Ein Spieltag wie Eiskunst Spieltag 1 im Live-Save: mehrere Spieler ueber dem festen Anker.
  const stark = new Map<string, number>([
    ["s1", 9.1], ["s2", 8.4], ["s3", 7.7], ["s4", 6.2], ["s5", 5.6], ["s6", 5.3], ["s7", 5.1], ["s8", 3.2], ["s9", 1.3], ["s10", 0.4], ["s11", 0],
  ]);

  it("Anker = Mittel der besten drei positiven Werte", () => {
    expect(ppTagesankerWert(stark.values())).toBeCloseTo((9.1 + 8.4 + 7.7) / 3, 12);
    expect(ppTagesankerWert([2, 0, -1])).toBe(2);
    expect(ppTagesankerWert([0, 0])).toBeNull();
  });

  it("haelt die Reihenfolge, bildet keinen Klumpen und bleibt unter 5", () => {
    const pp = verteilePpNachTagesanker(stark);
    const werte = [...stark.keys()].map((id) => pp.get(id)!);
    for (let i = 1; i < werte.length - 1; i += 1) expect(werte[i]).toBeLessThan(werte[i - 1]);
    expect(Math.max(...werte)).toBeLessThan(PP_SKALA_MAX);
    expect(Math.max(...werte)).toBeGreaterThan(4.7);
    expect(werte.filter((w) => w >= 4.995)).toHaveLength(0);
    expect(pp.get("s11")).toBe(0);
    // Heute (Deckel 5) staenden sieben dieser elf gleichauf bei 5.
    expect([...stark.values()].filter((u) => Math.min(PP_SKALA_MAX, u) >= PP_SKALA_MAX)).toHaveLength(7);
  });

  it("der Tagesbeste landet unabhaengig von der Feldstaerke bei demselben Wert (Hockey/Spurt-Fall)", () => {
    const schwach = new Map([...stark].map(([id, u]) => [id, u * 0.4] as const));
    const a = verteilePpNachTagesanker(stark);
    const b = verteilePpNachTagesanker(schwach);
    for (const id of stark.keys()) expect(b.get(id)).toBeCloseTo(a.get(id)!, 2);
    // Das Mittel der besten drei liegt vor der Kappe genau auf dem Ziel.
    const top3 = (["s1", "s2", "s3"] as const).map((id) => stark.get(id)! * (PP_TAGESANKER_ZIEL / ppTagesankerWert(stark.values())!));
    expect(top3.reduce((s, v) => s + v, 0) / 3).toBeCloseTo(PP_TAGESANKER_ZIEL, 12);
  });

  it("ein leerer oder nur nuller Spieltag bleibt bei 0", () => {
    expect([...verteilePpNachTagesanker(new Map()).entries()]).toEqual([]);
    expect([...verteilePpNachTagesanker(new Map([["a", 0], ["b", -2]])).values()]).toEqual([0, 0]);
  });
});

describe("PP-Tagesanker: an der Rechenstelle der Arena-Boxscore-PP", () => {
  // Eiskunst, Feldgroesse 6: zwei Paarungen, mehrere Spieler weit ueber dem festen Anker.
  const disziplin = "eiskunstlauf";
  const { referenz } = resolveArenaPpsReferenz(disziplin, 6, "feld");
  const werte = [0.3, 0.6, 0.9, 1.1, 1.3, 1.6, 1.9, 2.4, 2.9, 3.3, 3.8, 4.4].map((f) => f * referenz.iKrass);
  const fixtures: ArenaFixtureResult[] = [0, 1].map((n) => ({
    homeTeamId: `heim-${n}`,
    awayTeamId: `gast-${n}`,
    seiten: [0, 0],
    boxscore: werte.slice(n * 6, n * 6 + 6).map((wert, i) => ({ name: `s-${n}-${i}`, wert, playerId: `p-${n}-${i}`, side: i < 3 ? ("home" as const) : ("away" as const) })),
  }));

  it("aus: bit-identisch zur C2-Kurve mit Deckel 5 (mehrere Spieler gleichauf bei 5)", () => {
    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtures, 6, disziplin, "an", "neu", false);
    for (const f of fixtures) {
      for (const e of f.boxscore) {
        expect(pps.get(e.playerId!)).toBe(
          ppAusKurveSkaliert({ disciplineId: disziplin, wert: e.wert, referenz: { p50: referenz.iMittel, p995: referenz.iKrass }, modus: "an", playerCount: 6 }),
        );
      }
    }
    expect([...pps.values()].filter((v) => v === PP_SKALA_MAX).length).toBeGreaterThan(2);
  });

  it("an: Tagesanker ueber BEIDE Paarungen, kein Spieler gleichauf am Deckel, Reihenfolge = Impact", () => {
    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtures, 6, disziplin, "an", "neu", true);
    const nachImpact = fixtures.flatMap((f) => f.boxscore).sort((a, b) => a.wert - b.wert).map((e) => pps.get(e.playerId!)!);
    for (let i = 1; i < nachImpact.length; i += 1) expect(nachImpact[i]).toBeGreaterThan(nachImpact[i - 1]);
    expect(Math.max(...nachImpact)).toBeLessThan(PP_SKALA_MAX);
    expect(Math.max(...nachImpact)).toBeGreaterThan(4.7);
    // Im Messmodus "roh" und in einer alten Saison ("aus") wirkt der Schalter nicht.
    const roh = computeIndividualBoxscorePpsFromFixtureResults(fixtures, 6, disziplin, "roh", "neu", true);
    expect(Math.max(...roh.values())).toBeGreaterThan(PP_SKALA_MAX);
  });

  it("skaliereUngedeckelt({deckel:false}) liefert unterhalb des Deckels denselben Wert, darueber mehr als 5", () => {
    const anker = ppSkalaAnker(disziplin, 6)!;
    expect(skaliereUngedeckelt(disziplin, anker.rMed, 0, { playerCount: 6, deckel: false })).toBeCloseTo(
      skaliereUngedeckelt(disziplin, anker.rMed, 0, { playerCount: 6 }),
      2,
    );
    expect(skaliereUngedeckelt(disziplin, anker.rTop * 2, 0, { playerCount: 6, deckel: false })).toBeGreaterThan(PP_SKALA_MAX);
    expect(skaliereUngedeckelt(disziplin, anker.rTop * 2, 0, { playerCount: 6 })).toBe(PP_SKALA_MAX);
  });
});

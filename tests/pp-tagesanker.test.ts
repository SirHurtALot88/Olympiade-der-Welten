import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import { computeIndividualBoxscorePpsFromFixtureResults, resolveArenaPpsReferenz } from "@/lib/resolve/battle-mode-arena-team-points";
import { PP_SKALA_MAX, ppAusKurveSkaliert, ppSkalaAnker, skaliereUngedeckelt } from "@/lib/resolve/pp-skala";
import {
  PP_TAGESANKER_KNIE,
  PP_TAGESANKER_MAX,
  PP_TAGESANKER_ZIEL,
  ppTagesankerAktiv,
  ppTagesankerSchalter,
  ppTagesankerWert,
  verteilePpNachTagesanker,
  weicheKappe,
  wendePpTagesankerAn,
} from "@/lib/resolve/pp-tagesanker";

// PP-TAGESANKER (Prototyp 21.11., docs/design/pp-analyse-21-11.md): Standard AUS. Geprueft wird, dass
// der Schalter ohne Wert nichts aendert, dass die Verteilung die Reihenfolge haelt, unter 5 bleibt und
// keinen Klumpen bildet, und dass der Tagesbeste unabhaengig von der Staerke des Feldes um 5 landet.

function stelleSchalter(wert: string) {
  vi.stubEnv("OLY_PP_TAGESANKER", wert);
  vi.stubEnv("NEXT_PUBLIC_OLY_PP_TAGESANKER", "");
}

describe("PP-Tagesanker: Schalter", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("ist ohne Wert aus und wirkt nur zusammen mit der PP-Skala C2", () => {
    stelleSchalter("");
    expect(ppTagesankerSchalter()).toBe("aus");
    expect(ppTagesankerAktiv("an")).toBe(false);
    stelleSchalter("an");
    expect(ppTagesankerAktiv("an")).toBe(true);
    expect(ppTagesankerAktiv("aus")).toBe(false);
    expect(ppTagesankerAktiv("roh")).toBe(false);
    expect(ppTagesankerAktiv(null)).toBe(false);
    stelleSchalter("vielleicht");
    expect(ppTagesankerAktiv("an")).toBe(false);
  });

  it("ohne Schalter gibt wendePpTagesankerAn() dieselbe Map zurueck", () => {
    stelleSchalter("");
    const pps = new Map([["a", 5], ["b", 5], ["c", 2.1]]);
    expect(wendePpTagesankerAn("an", pps)).toBe(pps);
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
  afterEach(() => vi.unstubAllEnvs());

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
    stelleSchalter("");
    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtures, 6, disziplin, "an");
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
    stelleSchalter("an");
    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtures, 6, disziplin, "an");
    const nachImpact = fixtures.flatMap((f) => f.boxscore).sort((a, b) => a.wert - b.wert).map((e) => pps.get(e.playerId!)!);
    for (let i = 1; i < nachImpact.length; i += 1) expect(nachImpact[i]).toBeGreaterThan(nachImpact[i - 1]);
    expect(Math.max(...nachImpact)).toBeLessThan(PP_SKALA_MAX);
    expect(Math.max(...nachImpact)).toBeGreaterThan(4.7);
    // Im Messmodus "roh" und in einer alten Saison ("aus") wirkt der Schalter nicht.
    const roh = computeIndividualBoxscorePpsFromFixtureResults(fixtures, 6, disziplin, "roh");
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

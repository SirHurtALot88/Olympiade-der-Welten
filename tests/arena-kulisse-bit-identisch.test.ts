import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { waehleKulisseFuerFixture, waehleKulisseIndex } from "@/lib/battle/arena-kulisse";
import { kulissenNamenVon, waehleKulisseAnzeige } from "@/lib/battle/arena-kulisse-anzeige";
import { buildArenaMatchSeed, seedZuZahl } from "@/lib/battle/arena-seed";
import arenaKulissenNamenJson from "@/data/generated/arena-kulissen-namen.json";

/**
 * KULISSEN-FUNDAMENT (Baustein 1, 15.11., `lib/battle/arena-kulisse-anzeige.ts`). Beweist drei Dinge:
 *
 *   1. `waehleKulisseIndex()` (arena-kulisse.ts, #1354) ist ueber ALLE Disziplinen mit
 *      illustrierten Kulissen BIT-IDENTISCH zu `kulisseWaehlen()` in
 *      `public/mockups/battle-mode.engine.js` -- dieser Test zieht `ispyMischeHash()` und
 *      `normalisiereSaat()` als ECHTEN Quelltext aus der ausgelieferten Engine-Datei (wie
 *      `tests/battle-arena-heal-attribution.test.ts` es fuer `gegenZaehler()` tut) und baut den
 *      Schluessel exakt wie die dort gefundene `kulisseWaehlen()`-Zeile, statt die Logik hier
 *      nur noch einmal nachzubauen -- eine Nachbildung wuerde nur beweisen, dass MEINE Kopie
 *      stimmt, nicht die im Spiel ausgelieferte.
 *   2. `data/generated/arena-kulissen-namen.json` (der schlanke id/label-Abzug, den
 *      `waehleKulisseAnzeige()` fuer die Anzeige nutzt, s. dortiger Kommentar) passt noch zu
 *      `public/mockups/battle-mode.kulissen.js` (`window.__ARENA_KULISSEN`) -- driftet eines der
 *      beiden, faellt das sofort auf, statt still eine falsche Kulisse zu zeigen.
 *   3. `waehleKulisseAnzeige()` sagt dieselbe Kulisse voraus, die der Motor waehlt (ohne Profil:
 *      eigener Hash, mit Profil/Tennis: die gebuchte Variante aus #1354, Vierer-Pods: null).
 */

const ENGINE = readFileSync(join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");

/** Schneidet eine benannte Funktion (einfache, unverschachtelte Klammerung) aus dem Quelltext. */
function schneideFunktion(name: string): string {
  const anker = `function ${name}(`;
  const start = ENGINE.indexOf(anker);
  expect(start, `${anker} nicht in battle-mode.engine.js gefunden`).toBeGreaterThan(-1);
  const ende = ENGINE.indexOf("\n  }\n", start);
  expect(ende, `Ende von ${name} nicht gefunden`).toBeGreaterThan(-1);
  return ENGINE.slice(start, ende + 4);
}

function ladeEngineFunktion<T>(name: string): T {
  const quelle = schneideFunktion(name);
  // Bewusst: fuehrt den ECHTEN Funktionstext aus der ausgelieferten Datei aus, s. Kopfkommentar.
  return new Function(`"use strict"; return (${quelle});`)() as T;
}

const engineIspyMischeHash = ladeEngineFunktion<(x: number) => number>("ispyMischeHash");
const engineNormalisiereSaat = ladeEngineFunktion<(saat: unknown) => number>("normalisiereSaat");

/** `kulisseHash(s) = ispyMischeHash(normalisiereSaat(s))` -- dieselbe Zeile wie im Motor. */
function engineKulisseHash(schluessel: string): number {
  return engineIspyMischeHash(engineNormalisiereSaat(schluessel));
}

/**
 * Dieselbe Schluessel-Zeile wie in `kulisseWaehlen()` -- per `indexOf` bestaetigt, dass sie
 * tatsaechlich noch so im Motor steht (s. `expect` unten), nicht nur angenommen.
 */
const SCHLUESSEL_ZEILE =
  'const schluessel=[disc, saat==null?"":String(saat), meta.heimTeamId||"", meta.gastTeamId||"", meta.spieltag??""].join("|");';

function baueSchluessel(
  disc: string,
  saat: string | number | null | undefined,
  heimTeamId: string | null | undefined,
  gastTeamId: string | null | undefined,
  spieltag: string | number | null | undefined,
): string {
  return [disc, saat == null ? "" : String(saat), heimTeamId || "", gastTeamId || "", spieltag ?? ""].join("|");
}

type KulissenRegistry = Record<string, ReadonlyArray<{ id: string; label: string }>>;

function ladeEngineKulissenRegistry(): KulissenRegistry {
  const quelltext = readFileSync(join(process.cwd(), "public/mockups/battle-mode.kulissen.js"), "utf8");
  const treffer = /window\.__ARENA_KULISSEN\s*=\s*(\{[\s\S]*\});?\s*$/.exec(quelltext);
  expect(treffer, "window.__ARENA_KULISSEN nicht im erwarteten Format gefunden").not.toBeNull();
  return JSON.parse(treffer![1]!) as KulissenRegistry;
}

/** Deterministischer kleiner PRNG (mulberry32) -- kein `Math.random()`, reproduzierbare Laeufe. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("kulisseHash: Engine <-> TS", () => {
  it("die Schluessel-Zeile steht noch wortgleich in battle-mode.engine.js", () => {
    expect(ENGINE).toContain(SCHLUESSEL_ZEILE);
  });

  it("ispyMischeHash/normalisiereSaat aus der Engine ergeben denselben kulisseHash wie die TS-Portierung", () => {
    const rnd = mulberry32(1337);
    const disziplinen = ["tennis", "fechten", "wettessen", "basketball", "hockey"];
    const teamIds = ["team-a", "team-b", "", "team mit leerzeichen", "ümläut-team"];
    for (let i = 0; i < 500; i += 1) {
      const disc = disziplinen[Math.floor(rnd() * disziplinen.length)]!;
      const saatArten = [
        () => Math.floor(rnd() * 1_000_000),
        () => `save:s${Math.floor(rnd() * 9)}:md${Math.floor(rnd() * 30)}:arena:${disc}:a:b`,
        () => null,
        () => undefined,
      ];
      const saat = saatArten[Math.floor(rnd() * saatArten.length)]!() as string | number | null | undefined;
      const heimTeamId = teamIds[Math.floor(rnd() * teamIds.length)]!;
      const gastTeamId = teamIds[Math.floor(rnd() * teamIds.length)]!;
      const spieltagArten = [() => Math.floor(rnd() * 40) + 1, () => null, () => undefined, () => String(Math.floor(rnd() * 40))];
      const spieltag = spieltagArten[Math.floor(rnd() * spieltagArten.length)]!() as string | number | null | undefined;

      const schluessel = baueSchluessel(disc, saat, heimTeamId, gastTeamId, spieltag);
      const erwartet = engineKulisseHash(schluessel);

      const registry = arenaKulissenNamenJson as KulissenRegistry;
      const liste = registry[disc]!;
      const erwartetesIndex = erwartet % liste.length;
      expect(waehleKulisseIndex(liste.length, disc, saat, heimTeamId, gastTeamId, spieltag), schluessel).toBe(erwartetesIndex);
    }
  });

  it("liefert keine Anzeige fuer eine Disziplin ohne illustrierte Kulissen, genauso wie der Motor kulisseAktiv=null setzt", () => {
    const fixture = { homeTeamId: "a", awayTeamId: "b", matchdayId: "md-1" };
    expect(kulissenNamenVon("keine-solche-disziplin")).toEqual([]);
    expect(
      waehleKulisseAnzeige({ disciplineId: "keine-solche-disziplin", saveId: "s", seasonId: "x", spieltag: 1, fixture }),
    ).toBeNull();
  });
});

describe("waehleKulisseAnzeige: sagt die Motor-Wahl voraus", () => {
  const fixture = { homeTeamId: "team-a", awayTeamId: "team-b", matchdayId: "md-3" };

  it("ohne Profil (z.B. Basketball): Index = Motor-Hash ueber Duell-Saat, Fixture-Orientierung und numerischen Spieltag", () => {
    const saat = seedZuZahl(
      buildArenaMatchSeed({
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: fixture.matchdayId,
        disciplineId: "basketball",
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
      }),
    );
    const liste = (arenaKulissenNamenJson as KulissenRegistry).basketball!;
    const schluessel = baueSchluessel("basketball", saat, fixture.homeTeamId, fixture.awayTeamId, 3);
    const erwartet = liste[engineKulisseHash(schluessel) % liste.length]!;
    const anzeige = waehleKulisseAnzeige({ disciplineId: "basketball", saveId: "save-1", seasonId: "season-1", spieltag: 3, fixture });
    expect(anzeige).toEqual({ disziplin: "basketball", id: erwartet.id, label: erwartet.label });
  });

  it("mit Profil (Tennis): genau die gebuchte Variante aus #1354, nicht die Hash-Wahl mit numerischem Spieltag", () => {
    const saat = seedZuZahl(
      buildArenaMatchSeed({
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: fixture.matchdayId,
        disciplineId: "tennis",
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
      }),
    );
    const gebucht = waehleKulisseFuerFixture({
      disziplin: "tennis",
      saat,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      matchdayId: fixture.matchdayId,
    })!;
    const anzeige = waehleKulisseAnzeige({ disciplineId: "tennis", saveId: "save-1", seasonId: "season-1", spieltag: 3, fixture });
    expect(anzeige?.id).toBe(gebucht.id);
    expect(kulissenNamenVon("tennis").map((k) => k.id)).toContain(gebucht.id);
  });

  it("Vierer-Pod-Disziplinen: keine Vorhersage (der Motor nimmt dort eine Pod-Saat)", () => {
    for (const d of ["mini-dm", "battlefield", "staffel", "takeshis-castle"]) {
      expect(waehleKulisseAnzeige({ disciplineId: d, saveId: "save-1", seasonId: "season-1", spieltag: 3, fixture }), d).toBeNull();
    }
  });

  it("ist deterministisch und deckt ueber viele Saaten jede Kulisse einer Disziplin ab", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const f = { homeTeamId: `h${i}`, awayTeamId: `g${i}`, matchdayId: `md-${i}` };
      const a = waehleKulisseAnzeige({ disciplineId: "basketball", saveId: "s", seasonId: "x", spieltag: i + 1, fixture: f });
      const b = waehleKulisseAnzeige({ disciplineId: "basketball", saveId: "s", seasonId: "x", spieltag: i + 1, fixture: f });
      expect(a).toEqual(b);
      ids.add(a!.id);
    }
    expect([...ids].sort()).toEqual(kulissenNamenVon("basketball").map((k) => k.id).sort());
  });
});

describe("data/generated/arena-kulissen-namen.json <-> battle-mode.kulissen.js", () => {
  it("enthaelt fuer jede Disziplin exakt dieselben Kulissen-IDs/Labels, in derselben Reihenfolge", () => {
    const engineRegistry = ladeEngineKulissenRegistry();
    const schlankeRegistry = arenaKulissenNamenJson as KulissenRegistry;
    expect(Object.keys(schlankeRegistry).sort()).toEqual(Object.keys(engineRegistry).sort());
    for (const [disc, liste] of Object.entries(engineRegistry)) {
      expect(schlankeRegistry[disc], `Disziplin ${disc} fehlt im schlanken Abzug`).toBeDefined();
      expect(schlankeRegistry[disc]).toEqual(liste.map((k) => ({ id: k.id, label: k.label })));
    }
  });
});

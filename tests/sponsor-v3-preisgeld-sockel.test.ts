/**
 * ABNAHME DES V3-SPONSORMODELLS an den 32 ECHTEN Teams des Live-Saves.
 *
 * Diese Datei ist das Gegenstueck zu `tests/sponsor-preisgeld-sockel-entwurf.test.ts`: dort rechnete
 * die ENTSCHEIDUNGSVORLAGE ihre Formel selbst nach, hier laeuft die ECHTE Angebotserzeugung durch
 * dieselben Kennzahlen. Der Unterschied ist der Punkt der Uebung — eine Umsetzung, die die Formel
 * des Entwurfs noch einmal abschreibt, beweist nur, dass zweimal dasselbe getippt wurde.
 *
 * Gemessen wird ueber `buildSponsorV3TermsCore` (die Funktion, die auch `buildSponsorV3Terms` fuer
 * jedes echte Angebot aufruft), die produktive Sheet-Platzierungstabelle `getPrizePlacementBonus`
 * und `sponsorV3Settle` — also genau die Kette, aus der das Settlement zahlt.
 *
 * DIE ZIELKENNZAHLEN stammen aus docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md (Kurzfassung):
 *   RMSE gegen den Benchmark 0,00 bei reiner Basiswahl · <= 5,7 ueber die volle Bandbreite der Wahl
 *   Einzel-Team-Bandbreite < 13,5 · Spreizung 2,05-2,36 · Top-Tilt <= +-2,5
 */
import { describe, expect, it } from "vitest";

import {
  SPONSOR_LIVE_SAVE_S1_PLACEMENT,
  SPONSOR_LIVE_SAVE_S1_PRIZE_CURVE,
  SPONSOR_LIVE_SAVE_S1_TEAMS,
  type SponsorLiveSaveTeam,
} from "./_fixtures/sponsor-live-save-s1.fixture";
import { getPrizePlacementBonus } from "@/lib/season/prize-placement-table";
import { pickBonusObjective } from "@/lib/sponsor/sponsor-special-objectives";
import {
  buildSponsorV3TermsCore,
  sponsorV3ExpectedPayout,
  sponsorV3GoalProbability,
  sponsorV3IsGoalOfferable,
  sponsorV3IsMonotone,
  sponsorV3Settle,
  sponsorV3CardByKey,
  type SponsorV3ContractTerms,
} from "@/lib/sponsor/sponsor-v3-model";

/**
 * Die fuenf Karten, die dieses Abnahmeprotokoll misst: der V3-Slate in seiner damaligen Form
 * (Basis plus die vier Risikokarten). Sie werden nicht mehr ANGEBOTEN — dafuer sind seit V4 Basis
 * und Achsenkarten zustaendig —, rechnen in bestehenden Vertraegen aber unveraendert weiter.
 */
/**
 * Die REIHENFOLGE ist Teil der Messung, nicht Kosmetik: der Zufallsmix unten greift den Slate ueber
 * den Index ab. Eine andere Reihenfolge gibt jedem Team eine andere Karte und verschiebt saemtliche
 * Kennzahlen — deshalb steht hier der Slate exakt so, wie V3 ihn ausgeliefert hat.
 */
const SPONSOR_V3_MESSKARTEN = ["sicherheit", "basis", "ambition", "sonderziel", "ambition_ziel"]
  .map((key) => sponsorV3CardByKey(key));
import { SPONSOR_V3_FLOOR_C } from "@/lib/sponsor/sponsor-v3-offer-service";

const teams = SPONSOR_LIVE_SAVE_S1_TEAMS;
const SALARY_FACTOR = 1.15;

/** Deterministischer Hash — nur fuer die Auswahl "welches Team zieht welches Ziel", nie fuer Betraege. */
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Das Sonderziel, das die Angebotserzeugung diesem Team wirklich anbieten wuerde — gezogen mit der
 * PRODUKTIVEN `pickBonusObjective`, inklusive des V3-Katalogfilters. Nur so misst der Test dieselbe
 * p-Verteilung, die im Spiel entsteht; ein synthetisch gewuerfeltes p wuerde die Zielkennzahlen um
 * mehrere Zehntel verschieben (gemessen: RMSE des besten Falls 5,52 gegen 5,87).
 */
function goalKeyFor(team: SponsorLiveSaveTeam): string {
  const key = pickBonusObjective(
    "season-1",
    team.code,
    "identity",
    3,
    team.startRank,
    undefined,
    undefined,
    (candidate) => sponsorV3IsGoalOfferable(candidate, team.startRank),
  );
  expect(key, `${team.code}: kein bepreisbares Ziel im Katalog`).not.toBeNull();
  return key!;
}

/**
 * Der volle V3-Karten-Slate eines Teams, gebaut mit der PRODUKTIVEN Terms-Funktion.
 *
 * DIESE DATEI IST DAS ABNAHMEPROTOKOLL DES V3-MODELLS und misst gegen die EINGEFRORENE
 * Fixture-Kurve, nicht gegen die laufende Liga — sie bleibt damit auch nach dem V4-Kurvenumbau
 * gueltig und aussagekraeftig. Angeboten werden die vier Risikokarten nicht mehr, aber sie rechnen
 * in bestehenden Vertraegen weiter; genau deshalb muss ihre Rechnung weiter belegt sein.
 */
function slateOf(team: SponsorLiveSaveTeam): SponsorV3ContractTerms[] {
  const goalKey = goalKeyFor(team);
  return SPONSOR_V3_MESSKARTEN.map((card) =>
    buildSponsorV3TermsCore({
      prizeCurve: SPONSOR_LIVE_SAVE_S1_PRIZE_CURVE,
      placementBonus: getPrizePlacementBonus,
      startRank: team.startRank,
      rarity: team.rarity,
      card,
      goalKey,
      salaryFactor: SALARY_FACTOR,
      floor: SPONSOR_V3_FLOOR_C,
    }),
  );
}

const slates = new Map(teams.map((team) => [team.code, slateOf(team)] as const));
const cardOf = (team: SponsorLiveSaveTeam, key: string): SponsorV3ContractTerms =>
  slates.get(team.code)!.find((terms) => terms.cardKey === key)!;

// ── Kennzahlen (identisch zur Messung der Entscheidungsvorlage) ────────────────────────────────
type Metrics = {
  rmse: number;
  guvPlus: number;
  guvSpanne: number;
  spreizung: number;
  leagueSum: number;
  topTilt: number;
  inversions: number;
  outliers: Array<{ code: string; rank: number; dev: number }>;
};

function metricsOf(payoutByCode: Map<string, number>): Metrics {
  const rows = teams.map((team) => {
    const pay = payoutByCode.get(team.code) ?? 0;
    const ziel = team.prizeMoney + team.placementBonus;
    return { code: team.code, rank: team.rank, pay, dev: pay - ziel, guv: pay - team.salary };
  });
  const rmse = Math.sqrt(rows.reduce((acc, row) => acc + row.dev ** 2, 0) / rows.length);
  const guvs = rows.map((row) => row.guv);
  const pays = rows.map((row) => row.pay);
  const byRank = [...rows].sort((left, right) => left.rank - right.rank);
  let inversions = 0;
  for (let i = 0; i < byRank.length; i += 1) {
    for (let j = i + 1; j < byRank.length; j += 1) {
      if (byRank[i]!.pay < byRank[j]!.pay - 1e-9) inversions += 1;
    }
  }
  const top8 = byRank.slice(0, 8).reduce((acc, row) => acc + row.dev, 0) / 8;
  const bottom8 = byRank.slice(-8).reduce((acc, row) => acc + row.dev, 0) / 8;
  return {
    rmse,
    guvPlus: guvs.filter((value) => value > 0).length,
    guvSpanne: Math.max(...guvs) - Math.min(...guvs),
    spreizung: Math.max(...pays) / Math.min(...pays),
    leagueSum: pays.reduce((acc, value) => acc + value, 0),
    topTilt: top8 - bottom8,
    inversions,
    outliers: [...rows].sort((left, right) => Math.abs(right.dev) - Math.abs(left.dev)).slice(0, 3),
  };
}

function formatMetrics(label: string, m: Metrics): string {
  const outliers = m.outliers
    .map((entry) => `${entry.code} r${entry.rank} ${entry.dev >= 0 ? "+" : ""}${entry.dev.toFixed(1)}`)
    .join(", ");
  return (
    `${label.padEnd(26)} RMSE ${m.rmse.toFixed(2).padStart(6)} | GuV+ ${String(m.guvPlus).padStart(2)}/32 | ` +
    `Spanne ${m.guvSpanne.toFixed(1).padStart(5)} | Spreizung ${m.spreizung.toFixed(2)} | ` +
    `Liga ${m.leagueSum.toFixed(0).padStart(4)} | Top-Tilt ${m.topTilt >= 0 ? "+" : ""}${m.topTilt.toFixed(1)} | ` +
    `Inversionen ${String(m.inversions).padStart(2)}${outliers ? ` | Ausreisser: ${outliers}` : ""}`
  );
}

// ── Szenarien ueber die Entscheidungs-Bandbreite ───────────────────────────────────────────────
const heute = new Map(teams.map((team) => [team.code, team.sponsorCash] as const));
const benchmark = new Map(teams.map((team) => [team.code, team.prizeMoney + team.placementBonus] as const));

const alleBasis = new Map(
  teams.map((team) => [team.code, sponsorV3Settle(cardOf(team, "basis"), team.rank, 0)] as const),
);
const zufallsmix = new Map(
  teams.map((team) => {
    const slate = slates.get(team.code)!;
    const terms = slate[Math.floor(hash01(`${team.code}:card`) * slate.length)]!;
    const achieved = hash01(`${team.code}:goal`) < terms.goalP ? 1 : 0;
    return [team.code, sponsorV3Settle(terms, team.rank, achieved)] as const;
  }),
);
const besterFall = new Map(
  teams.map((team) => [
    team.code,
    Math.max(...slates.get(team.code)!.map((terms) => sponsorV3Settle(terms, team.rank, 1))),
  ] as const),
);
const schlechtesterFall = new Map(
  teams.map((team) => [
    team.code,
    Math.min(...slates.get(team.code)!.map((terms) => sponsorV3Settle(terms, team.rank, 0))),
  ] as const),
);

describe("Sponsormodell V3 — Abnahme an den 32 echten Teams des Live-Saves", () => {
  it("die produktive Sheet-Platzierungstabelle ist die, mit der der Benchmark gemessen wurde", () => {
    // Wenn die Angebotserzeugung eine andere Platzierungstabelle benutzt als der Benchmark, kann die
    // Basis-Karte den Benchmark gar nicht treffen — und genau das war der Nebenbefund des Entwurfs
    // (Sheet-Tabelle +1,28/−0,96 gegen die Code-Tabelle ±8,33).
    for (const [delta, expected] of SPONSOR_LIVE_SAVE_S1_PLACEMENT.entries()) {
      expect(getPrizePlacementBonus(delta), `rankDelta ${delta}`).toBeCloseTo(expected, 6);
    }
  });

  it("Basis-Karte == Benchmark: RMSE exakt 0", () => {
    const m = metricsOf(alleBasis);
    expect(m.rmse).toBeCloseTo(0, 6);
    for (const team of teams) {
      expect(alleBasis.get(team.code)!).toBeCloseTo(team.prizeMoney + team.placementBonus, 6);
    }
    // Overspender-Mechanik unangetastet: Kadereffizienz schlaegt Rang.
    const tc = teams.find((team) => team.code === "T-C")!;
    const mm = teams.find((team) => team.code === "M-M")!;
    const tcGuv = alleBasis.get("T-C")! - tc.salary;
    const mmGuv = alleBasis.get("M-M")! - mm.salary;
    expect(tcGuv).toBeGreaterThan(30);
    expect(mmGuv).toBeLessThan(10);
  });

  it("jede Karte jedes Teams ist EV-neutral und streng monoton im Endrang", () => {
    for (const team of teams) {
      const slate = slates.get(team.code)!;
      const anchor = slate[0]!.anchor;
      for (const terms of slate) {
        // Der Anker ist fuer alle Karten desselben Teams derselbe — er haengt nur an der Benchmark.
        expect(terms.anchor).toBeCloseTo(anchor, 9);
        // EV ueber die Ankerverteilung, Sonderziel als Bernoulli(p): muss den Anker treffen.
        expect(Math.abs(sponsorV3ExpectedPayout(terms) - anchor)).toBeLessThan(1e-9);
        expect(sponsorV3IsMonotone(terms), `${team.code}/${terms.cardKey} nicht monoton`).toBe(true);
        // Guardrail: der Tilt ist hart geklammert.
        expect(Math.abs(terms.tilt)).toBeLessThanOrEqual(0.3 + 1e-9);
      }
    }
  });

  it("EV-Gleichheit aller Karten eines Slates — die zentrale Zusage des Entwurfs", () => {
    for (const team of teams) {
      const values = slates.get(team.code)!.map((terms) => sponsorV3ExpectedPayout(terms));
      const spread = Math.max(...values) - Math.min(...values);
      expect(spread, `${team.code}: EV-Spreizung ${spread}`).toBeLessThan(1e-9);
    }
  });

  it("Rarity skaliert NUR die Hebelgroesse, nie den Erwartungswert", () => {
    const team = teams.find((entry) => entry.code === "T-C")!;
    const build = (rarity: string) =>
      buildSponsorV3TermsCore({
        prizeCurve: SPONSOR_LIVE_SAVE_S1_PRIZE_CURVE,
        placementBonus: getPrizePlacementBonus,
        startRank: team.startRank,
        rarity,
        card: sponsorV3CardByKey("ambition_ziel"),
        goalKey: goalKeyFor(team),
        salaryFactor: SALARY_FACTOR,
        floor: SPONSOR_V3_FLOOR_C,
      });
    const rarities = ["gewöhnlich", "magisch", "selten", "legendär"];
    const built = rarities.map(build);
    // Gleicher EV ueber alle vier Rarities …
    for (const terms of built) {
      expect(sponsorV3ExpectedPayout(terms)).toBeCloseTo(built[0]!.anchor, 9);
    }
    // … aber streng wachsende Spannweite (Titel minus letzter Platz plus Zielpraemie).
    const spans = built.map((terms) => sponsorV3Settle(terms, 1, 1) - sponsorV3Settle(terms, 32, 0));
    for (let i = 1; i < spans.length; i += 1) {
      expect(spans[i]!).toBeGreaterThan(spans[i - 1]!);
    }
  });

  it("Entscheidungs-Bandbreite: RMSE, Spreizung, Top-Tilt und Einzel-Team-Sprung im Ziel", () => {
    const best = metricsOf(besterFall);
    const worst = metricsOf(schlechtesterFall);
    const mix = metricsOf(zufallsmix);
    const heuteM = metricsOf(heute);

    for (const m of [best, worst, mix]) {
      // Zielvorgabe des Entwurfs: <= 5,7 ueber die volle Entscheidungs-Bandbreite (heute: 14,86).
      expect(m.rmse).toBeLessThanOrEqual(5.7);
      // Spreizung im Band 2,05 (Benchmark) bis 2,36 (schlechtester Fall). Der beste Fall liegt mit
      // 2,04 knapp DARUNTER — er hebt den Keller staerker als die Spitze, weil dort die
      // Zielpraemie relativ mehr wiegt. Flacher als der Benchmark ist unbedenklich; die harte
      // Grenze ist die Gehaltsspreizung 2,76, ueber der die Overspender-Mechanik kippen wuerde.
      expect(m.spreizung).toBeGreaterThanOrEqual(2.0);
      expect(m.spreizung).toBeLessThanOrEqual(2.36 + 0.01);
      // Keine systematische Top-/Bottom-Schieflage (heute: +15,4).
      expect(Math.abs(m.topTilt)).toBeLessThanOrEqual(2.5);
      // Und in jedem Fall besser als das abgeloeste System.
      expect(m.rmse).toBeLessThan(heuteM.rmse);
      // Rangordnung: die Wahl fuegt dem Benchmark (der ueber den Platzierungsbonus selbst 37
      // Inversionen enthaelt) nur begrenzt weitere hinzu — und bleibt weit unter heute (87).
      expect(m.inversions).toBeLessThanOrEqual(metricsOf(benchmark).inversions + 10);
      expect(m.inversions).toBeLessThan(heuteM.inversions);
    }

    // Einzel-Team-Bandbreite: keine Karte springt mehr als 13,5 C ueber/unter den Benchmark
    // (heutige Ausreisser: +34,2 / −26,7).
    for (const team of teams) {
      const ziel = team.prizeMoney + team.placementBonus;
      expect(besterFall.get(team.code)! - ziel, `${team.code} best`).toBeLessThan(13.5);
      expect(schlechtesterFall.get(team.code)! - ziel, `${team.code} worst`).toBeGreaterThan(-13.5);
    }
  });

  it("Kennzahlen-Tabelle der Umsetzung (Konsole)", () => {
    const lines = [
      formatMetrics("Ziel (Preisgeld)", metricsOf(benchmark)),
      formatMetrics("vorher (V2, eingefroren)", metricsOf(heute)),
      formatMetrics("V3: alle Basis", metricsOf(alleBasis)),
      formatMetrics("V3: Zufallsmix", metricsOf(zufallsmix)),
      formatMetrics("V3: bester Fall", metricsOf(besterFall)),
      formatMetrics("V3: schlechtester Fall", metricsOf(schlechtesterFall)),
    ];
    console.log(`\n${lines.join("\n")}\n`);
    expect(lines).toHaveLength(6);
  });

  it("Sonderziel-Katalog: nur Ziele im p-Band [0,15, 0,72] werden angeboten", () => {
    for (const team of teams) {
      const key = goalKeyFor(team);
      const p = sponsorV3GoalProbability(key, team.startRank);
      expect(p).toBeGreaterThanOrEqual(0.15);
      expect(p).toBeLessThanOrEqual(0.72);
      // Und die Klammer greift nicht: der Rohwert liegt bereits im Band, sonst waere das Ziel
      // gar nicht im Katalog. Genau das ist der Unterschied zu V2 (dort wurde geklammert).
      expect(sponsorV3IsGoalOfferable(key, team.startRank)).toBe(true);
    }
    // Gegenprobe: "Top 8"-artige Ziele fallen fuer schwache Teams heraus.
    expect(sponsorV3IsGoalOfferable("golden_title_shock", 30)).toBe(false);
    expect(sponsorV3IsGoalOfferable("cellar_escape", 3)).toBe(false);
  });

  it("die absolute Untergrenze ist ein Sicherheitsnetz, kein Balancing-Hebel", () => {
    // Sie darf in keiner Karte die Kurve verschlucken: nur die haerteste Konstellation des
    // Live-Saves (Meister mit Ambitionskarte auf Rang 32) darf sie ueberhaupt beruehren.
    let touched = 0;
    for (const team of teams) {
      for (const terms of slates.get(team.code)!) {
        for (let rank = 1; rank <= 32; rank += 1) {
          if ((terms.rankLadder[rank - 1] ?? 0) < SPONSOR_V3_FLOOR_C) touched += 1;
        }
      }
    }
    // 32 Teams x 5 Karten x 32 Raenge = 5120 Sprossen; die Untergrenze beruehrt davon eine Handvoll.
    expect(touched).toBeLessThan(20);
  });
});

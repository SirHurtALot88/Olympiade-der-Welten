/**
 * SIMULATION DES SPONSORENTWURFS "PREISGELD-SOCKEL" — Rechenteil der Entscheidungsvorlage
 * docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md. KEIN Produktivcode: dieser Test rechnet den Entwurf
 * an den 32 ECHTEN Teams des Live-Saves (tests/_fixtures/sponsor-live-save-s1.fixture.ts) gegen
 * den Preisgeld-Benchmark durch und friert die Kennzahlen als Assertions ein, damit jede spaetere
 * Diskussion dieselben Zahlen reproduziert (`npx vitest run tests/sponsor-preisgeld-sockel-entwurf.test.ts`).
 *
 * DER ENTWURF IN EINEM SATZ: Jeder Vertrag friert bei Unterschrift die Preisgeld-Benchmark-Leiter
 * M(f) = Preisgeld(f) + Platzierungsbonus(Startrang − f) ein; jede Sponsorentscheidung ist eine
 * EV-NEUTRALE Transformation um den vertraglich eingefrorenen Erwartungsanker A (Kurven-Tilt ±beta,
 * Sonderziel fair bepreist mit −p·G Sockelabzug). Rarity skaliert NUR die Groesse des Hebels, nie
 * den Erwartungswert. Damit gilt per Konstruktion: Basis-Sponsor == Benchmark (RMSE 0), und die
 * Entscheidungs-Bandbreite ist hart begrenzt statt Vertrags-Lotterie.
 */
import { describe, expect, it } from "vitest";

import {
  SPONSOR_LIVE_SAVE_S1_PLACEMENT,
  SPONSOR_LIVE_SAVE_S1_PRIZE_CURVE,
  SPONSOR_LIVE_SAVE_S1_SALARY_FACTOR,
  SPONSOR_LIVE_SAVE_S1_TEAMS,
  type SponsorLiveSaveTeam,
} from "./_fixtures/sponsor-live-save-s1.fixture";

// ── Entwurfs-Parameter (die Stellschrauben der Entscheidungsvorlage) ───────────────────────────
/** Kurven-Tilt-Staerke je Rarity — Rarity = GROESSE des Hebels, niemals Erwartungswert. */
const TILT_BY_RARITY: Record<string, number> = { "gewöhnlich": 0.15, magisch: 0.2, selten: 0.25, "legendär": 0.3 };
/** Sonderziel-Auszahlung je Rarity (voll erfuellt), gedeckelt — bepreist wird mit −p·G im Sockel. */
const GOAL_BY_RARITY: Record<string, number> = { "gewöhnlich": 6, magisch: 7.5, selten: 9, "legendär": 10 };
/** Erfolgswahrscheinlichkeits-Band der Sonderziele (identisch zur V2-Klammer GOAL_P_MIN/MAX). */
const GOAL_P_MIN = 0.15;
const GOAL_P_MAX = 0.72;
/** Streuung der Endrang-Erwartung fuer den eingefrorenen Anker (gemessen: sd(Start−End) ≈ 3.3). */
const ANCHOR_SIGMA = 4;

// ── Benchmark-Bausteine aus dem Fixture ────────────────────────────────────────────────────────
const prize = (rank: number): number => SPONSOR_LIVE_SAVE_S1_PRIZE_CURVE[Math.min(32, Math.max(1, rank)) - 1]!;
const placement = (delta: number): number =>
  SPONSOR_LIVE_SAVE_S1_PLACEMENT.get(Math.min(31, Math.max(-31, delta))) ?? 0;
/** Benchmark M(f) eines Teams: Preisgeld am Endrang + Platzierungsbonus gegen den Startrang. */
const benchmarkAt = (team: SponsorLiveSaveTeam, finalRank: number): number =>
  prize(finalRank) + placement(team.startRank - finalRank);

/**
 * Eingefrorener ERWARTUNGSANKER A des Vertrags: modell-erwarteter Benchmark-Wert bei Unterschrift
 * (diskretisierte Normalverteilung um den Startrang, an 1..32 gestutzt und renormiert). A ist eine
 * ZAHL IM VERTRAG — gegen sie ist jeder Tilt exakt EV-neutral, ohne Naeherung.
 */
function anchorOf(team: SponsorLiveSaveTeam): number {
  let sum = 0;
  let acc = 0;
  for (let r = 1; r <= 32; r += 1) {
    const w = Math.exp(-((r - team.startRank) ** 2) / (2 * ANCHOR_SIGMA * ANCHOR_SIGMA));
    sum += w;
    acc += w * benchmarkAt(team, r);
  }
  return acc / sum;
}

/** Endrang-Gewichte des Ankers — fuer die EV-Paritaets-Pruefung der Karten. */
function anchorWeights(team: SponsorLiveSaveTeam): number[] {
  const weights: number[] = [];
  for (let r = 1; r <= 32; r += 1) {
    weights.push(Math.exp(-((r - team.startRank) ** 2) / (2 * ANCHOR_SIGMA * ANCHOR_SIGMA)));
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}

// ── Die Karten des Entwurfs ────────────────────────────────────────────────────────────────────
type Card = { name: string; tilt: number; goal: boolean };
/** Der Karten-Slate eines Teams: 5 echte Entscheidungen, alle EV-gleich. */
function slateOf(team: SponsorLiveSaveTeam): Card[] {
  const beta = TILT_BY_RARITY[team.rarity] ?? 0.2;
  return [
    { name: "Sicherheit", tilt: -beta, goal: false },
    { name: "Basis", tilt: 0, goal: false },
    { name: "Ambition", tilt: beta, goal: false },
    { name: "Sonderziel", tilt: 0, goal: true },
    { name: "Ambition+Ziel", tilt: beta, goal: true },
  ];
}

/** Erfolgswahrscheinlichkeit des angebotenen Sonderziels (im Sim: deterministisch aus dem Teamcode). */
function goalProbabilityOf(team: SponsorLiveSaveTeam): number {
  const h = hash01(`${team.code}:goal-p`);
  return GOAL_P_MIN + h * (GOAL_P_MAX - GOAL_P_MIN);
}

/**
 * Auszahlung einer Karte am tatsaechlichen Endrang.
 * pay = M(f) + tilt·(M(f) − A)  − p·G + erreicht·G
 * Der Tilt verstaerkt (Ambition) oder daempft (Sicherheit) die Abweichung vom eingefrorenen
 * Erwartungsanker; das Sonderziel ist eine fair bepreiste Lotterie (EV-Beitrag exakt 0).
 */
function payoutOf(team: SponsorLiveSaveTeam, card: Card, finalRank: number, goalAchieved: boolean): number {
  const m = benchmarkAt(team, finalRank);
  const anchor = anchorOf(team);
  const goalSize = GOAL_BY_RARITY[team.rarity] ?? 7.5;
  const p = goalProbabilityOf(team);
  const goalPart = card.goal ? -p * goalSize + (goalAchieved ? goalSize : 0) : 0;
  return m + card.tilt * (m - anchor) + goalPart;
}

// ── Determinismus-Helfer ───────────────────────────────────────────────────────────────────────
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ── Kennzahlen (identisch zur Befund-Messung am Live-Save) ─────────────────────────────────────
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
  const teams = SPONSOR_LIVE_SAVE_S1_TEAMS;
  const rows = teams.map((t) => {
    const pay = payoutByCode.get(t.code) ?? 0;
    const ziel = t.prizeMoney + t.placementBonus;
    return { code: t.code, rank: t.rank, pay, dev: pay - ziel, guv: pay - t.salary };
  });
  const rmse = Math.sqrt(rows.reduce((a, r) => a + r.dev ** 2, 0) / rows.length);
  const guvs = rows.map((r) => r.guv);
  const pays = rows.map((r) => r.pay);
  const byRank = [...rows].sort((a, b) => a.rank - b.rank);
  let inversions = 0;
  for (let i = 0; i < byRank.length; i += 1) {
    for (let j = i + 1; j < byRank.length; j += 1) {
      if (byRank[i]!.pay < byRank[j]!.pay - 1e-9) inversions += 1;
    }
  }
  const top8 = byRank.slice(0, 8).reduce((a, r) => a + r.dev, 0) / 8;
  const bottom8 = byRank.slice(-8).reduce((a, r) => a + r.dev, 0) / 8;
  return {
    rmse,
    guvPlus: guvs.filter((g) => g > 0).length,
    guvSpanne: Math.max(...guvs) - Math.min(...guvs),
    spreizung: Math.max(...pays) / Math.min(...pays),
    leagueSum: pays.reduce((a, b) => a + b, 0),
    topTilt: top8 - bottom8,
    inversions,
    outliers: [...rows].sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev)).slice(0, 3),
  };
}

function formatMetrics(label: string, m: Metrics): string {
  const outliers = m.outliers.map((o) => `${o.code} r${o.rank} ${o.dev >= 0 ? "+" : ""}${o.dev.toFixed(1)}`).join(", ");
  return (
    `${label.padEnd(26)} RMSE ${m.rmse.toFixed(2).padStart(6)} | GuV+ ${String(m.guvPlus).padStart(2)}/32 | ` +
    `Spanne ${m.guvSpanne.toFixed(1).padStart(5)} | Spreizung ${m.spreizung.toFixed(2)} | ` +
    `Liga ${m.leagueSum.toFixed(0).padStart(4)} | Top-Tilt ${m.topTilt >= 0 ? "+" : ""}${m.topTilt.toFixed(1)} | ` +
    `Inversionen ${String(m.inversions).padStart(2)} | Ausreisser: ${outliers}`
  );
}

// ── Szenarien ueber die Entscheidungs-Bandbreite ───────────────────────────────────────────────
const teams = SPONSOR_LIVE_SAVE_S1_TEAMS;

/** IST heute: die tatsaechliche Auszahlung der eingefrorenen V2-Vertraege. */
const heute = new Map(teams.map((t) => [t.code, t.sponsorCash] as const));
/** Der Benchmark selbst (Preisgeld + Platzierungsbonus) — das Ziel. */
const benchmark = new Map(teams.map((t) => [t.code, t.prizeMoney + t.placementBonus] as const));
/** Alle waehlen die Basis-Karte. */
const alleBasis = new Map(teams.map((t) => [t.code, payoutOf(t, { name: "Basis", tilt: 0, goal: false }, t.rank, false)] as const));
/** Deterministischer Zufallsmix: jedes Team eine Karte aus dem Slate, Ziel-Erfolg ~ p. */
const zufallsmix = new Map(
  teams.map((t) => {
    const slate = slateOf(t);
    const card = slate[Math.floor(hash01(`${t.code}:card`) * slate.length)]!;
    const achieved = hash01(`${t.code}:goal`) < goalProbabilityOf(t);
    return [t.code, payoutOf(t, card, t.rank, achieved)] as const;
  }),
);
/** Bester Fall der Sponsorenwahl: jedes Team haette (ex post) die ertragreichste Karte erwischt. */
const besterFall = new Map(
  teams.map((t) => [t.code, Math.max(...slateOf(t).map((c) => payoutOf(t, c, t.rank, true)))] as const),
);
/** Schlechtester Fall: die ex post unguenstigste Karte, Sonderziel verfehlt. */
const schlechtesterFall = new Map(
  teams.map((t) => [t.code, Math.min(...slateOf(t).map((c) => payoutOf(t, c, t.rank, false)))] as const),
);
/** VERWORFENE Richtung zum Vergleich: Benchmark mit ±10 % Rarity-Etat-Streuung (Vertrags-Lotterie). */
const rarityEtat = new Map(
  teams.map((t) => [t.code, (t.prizeMoney + t.placementBonus) * (1 + (hash01(`${t.code}:etat`) - 0.5) * 0.2)] as const),
);

describe("Sponsorentwurf Preisgeld-Sockel — Simulation am Live-Save (32 echte Teams)", () => {
  it("Fixture reproduziert den gemessenen Befund (heutiges System vs. Benchmark)", () => {
    const heuteM = metricsOf(heute);
    const zielM = metricsOf(benchmark);
    // Der Befund aus der Live-Messung, hier eingefroren:
    expect(heuteM.rmse).toBeCloseTo(14.86, 1); // heutige Sponsoren ~15 C daneben
    expect(heuteM.guvPlus).toBe(20);
    expect(heuteM.guvSpanne).toBeCloseTo(61.2, 0);
    expect(heuteM.spreizung).toBeCloseTo(2.93, 1); // steiler als die Gehaltsspreizung 2.76
    expect(zielM.rmse).toBeCloseTo(0, 6);
    expect(zielM.guvPlus).toBe(25);
    expect(zielM.guvSpanne).toBeCloseTo(40.9, 0);
    // Preisgeld-Rangkurve (ohne Platzierungsbonus): Spreizung 1.87 — flacher als Gehalt 2.76.
    const pmOnly = teams.map((t) => t.prizeMoney);
    expect(Math.max(...pmOnly) / Math.min(...pmOnly)).toBeCloseTo(1.87, 1);
    const sal = teams.map((t) => t.salary);
    expect(Math.max(...sal) / Math.min(...sal)).toBeCloseTo(2.76, 1);
  });

  it("Basis-Karte == Benchmark: RMSE exakt 0, Overspender-Mechanik bleibt vollstaendig erhalten", () => {
    const m = metricsOf(alleBasis);
    expect(m.rmse).toBeCloseTo(0, 9);
    // Kadereffizienz schlaegt Rang: der Rang-18-Effizienzkader (T-C, Gehalt 44.2) macht die beste GuV
    // der Liga, der teuerste Meister (M-M, Gehalt 95.7) trotz Titel fast nichts — Overspender werden
    // ohne jede Sonderregel bestraft, weil die Kurve flacher ist als die Gehaltsspreizung.
    const tc = teams.find((t) => t.code === "T-C")!;
    const mm = teams.find((t) => t.code === "M-M")!;
    const tcGuv = alleBasis.get("T-C")! - tc.salary; // gemessen +32.3
    const mmGuv = alleBasis.get("M-M")! - mm.salary; // gemessen +7.6 — Rang 1, aber fast unterste GuV
    expect(tcGuv).toBeGreaterThan(30);
    expect(mmGuv).toBeLessThan(10);
    expect(tcGuv - mmGuv).toBeGreaterThan(20);
  });

  it("jede Karte ist exakt EV-neutral und streng monoton im Endrang", () => {
    for (const t of teams) {
      const weights = anchorWeights(t);
      const anchor = anchorOf(t);
      const p = goalProbabilityOf(t);
      for (const card of slateOf(t)) {
        // EV ueber die Anker-Verteilung, Sonderziel als Bernoulli(p): muss exakt A treffen.
        let ev = 0;
        for (let r = 1; r <= 32; r += 1) {
          ev += weights[r - 1]! * (p * payoutOf(t, card, r, true) + (1 - p) * payoutOf(t, card, r, false));
        }
        expect(Math.abs(ev - anchor)).toBeLessThan(1e-9);
        // Monotonie: ein besserer Endrang zahlt nie weniger.
        for (let r = 2; r <= 32; r += 1) {
          expect(payoutOf(t, card, r - 1, false)).toBeGreaterThan(payoutOf(t, card, r, false));
        }
      }
    }
  });

  it("Entscheidungs-Bandbreite: auch der schlechteste/beste Fall bleibt nah am Benchmark", () => {
    const best = metricsOf(besterFall);
    const worst = metricsOf(schlechtesterFall);
    const mix = metricsOf(zufallsmix);
    // Die gesamte Bandbreite der Sponsorenwahl bleibt unter der Haelfte des heutigen Fehlers (14.86).
    for (const m of [best, worst, mix]) {
      expect(m.rmse).toBeLessThan(7);
      // Flacher als die Gehaltsspreizung (2.76) — Effizienz entscheidet weiter die GuV.
      expect(m.spreizung).toBeLessThan(2.4);
      // Keine systematische Top-/Bottom-Schieflage: mittlere Abweichung Top-8 vs. Bottom-8 begrenzt.
      expect(Math.abs(m.topTilt)).toBeLessThan(5);
    }
    // Einzel-Team-Bandbreite: keine Karte kann mehr als ~13 C ueber/unter den Benchmark springen
    // (heutige Ausreisser: +34.2 / −26.7).
    for (const t of teams) {
      const ziel = t.prizeMoney + t.placementBonus;
      expect(besterFall.get(t.code)! - ziel).toBeLessThan(13.5);
      expect(schlechtesterFall.get(t.code)! - ziel).toBeGreaterThan(-13.5);
    }
    // Rangordnung: die Wahl fuegt gegenueber dem Benchmark (der ueber den Platzierungsbonus selbst
    // Inversionen enthaelt) nur begrenzt weitere hinzu — und bleibt unter heute.
    const zielInv = metricsOf(benchmark).inversions;
    const heuteInv = metricsOf(heute).inversions;
    for (const m of [best, worst, mix]) {
      expect(m.inversions).toBeLessThanOrEqual(zielInv + 8);
      expect(m.inversions).toBeLessThan(heuteInv);
    }
  });

  it("Kennzahlen-Tabelle der Entscheidungsvorlage (Konsole) + Sensitivitaet der Stellschrauben", () => {
    const lines = [
      formatMetrics("Ziel (Preisgeld)", metricsOf(benchmark)),
      formatMetrics("heute (V2, eingefroren)", metricsOf(heute)),
      formatMetrics("Entwurf: alle Basis", metricsOf(alleBasis)),
      formatMetrics("Entwurf: Zufallsmix", metricsOf(zufallsmix)),
      formatMetrics("Entwurf: bester Fall", metricsOf(besterFall)),
      formatMetrics("Entwurf: schlechtester", metricsOf(schlechtesterFall)),
      formatMetrics("verworfen: ±10% Etat", metricsOf(rarityEtat)),
    ];
    console.log(`\n${lines.join("\n")}\n`);

    // Sensitivitaet: Tilt-Staerke global skaliert (0.6x / 1x / 1.4x der Rarity-Werte).
    for (const scale of [0.6, 1, 1.4]) {
      const worst = new Map(
        teams.map((t) => {
          const cards = slateOf(t).map((c) => ({ ...c, tilt: c.tilt * scale }));
          return [t.code, Math.min(...cards.map((c) => payoutOf(t, c, t.rank, false)))] as const;
        }),
      );
      console.log(formatMetrics(`  Tilt x${scale.toFixed(1)} (worst)`, metricsOf(worst)));
    }

    // Die verworfene Etat-Streuung landet in derselben RMSE-Groessenordnung wie die BEWUSST GEWAEHLTE
    // Bandbreite des Entwurfs (gemessen ~3.8 vs. ~4.2) — nur ist sie reine Vertrags-Lotterie ohne
    // Entscheidungsgehalt. RMSE allein unterschaetzt das: gleicher Fehler, null Spielwert. Deshalb ist
    // "Rarity als Etat-Dial" verworfen und Rarity im Entwurf NUR die Groesse des Hebels.
    expect(metricsOf(rarityEtat).rmse).toBeGreaterThan(3);
  });

  it("Gehaltsanker: der Entwurf haengt am ECHTEN salary — der expectedSalary-Anker weicht messbar ab", () => {
    // Der Benchmark-Pool ist Gehaltssumme x Ligafaktor; der heutige Sponsor-Anker (expectedSalary)
    // wuerde einen abweichenden Pool ergeben. Z-H ist der Extremfall: 97.7 echt vs. 83.3 geglaettet.
    const sumReal = teams.reduce((a, t) => a + t.salary, 0);
    const sumExpected = teams.reduce((a, t) => a + t.salaryExpected, 0);
    expect(sumReal).toBeCloseTo(2056.6, 0);
    expect(sumExpected).toBeCloseTo(2017.4, 0);
    const zh = teams.find((t) => t.code === "Z-H")!;
    expect(zh.salary).toBeCloseTo(97.7, 1);
    expect(zh.salaryExpected).toBeCloseTo(83.3, 1);
    // Pool-Fehler des geglaetteten Ankers: ~39 C Liga-weit (~1.2 C je Team) — plus Einzelteam-Verzerrung.
    expect((sumReal - sumExpected) * SPONSOR_LIVE_SAVE_S1_SALARY_FACTOR).toBeGreaterThan(40);
  });
});

/**
 * DIE KI MUSS VOR DEM KAUF WISSEN, WAS DER KAUF SIE AN LUXUSSTEUER KOSTET.
 *
 * GEMELDET VON CHRIS: „für den planner oder pick agent muss das berücksichtigt werden dass AI weiß
 * oh wenn ich jetzt noch nen teuren spieler kaufe muss ich luxussteuer zahlen! das ist sau wichtig."
 *
 * VORHER erreichte der Apron die KI nur über die Cash-Reserve: `resolveApronTighteningMultiplier`
 * hob die Rücklage an, NACHDEM ein Team seine Decke gerissen hatte. Das ist eine Zustands-Bremse und
 * wirkt auf jeden Kandidaten gleich — ein Zugang mit 2 Gehalt und einer mit 14 waren für die
 * Kaufentscheidung gleich teuer. Die Zahl, die fehlte, ist der GRENZPREIS: was kostet genau DIESER
 * Zugang zusätzlich an Abgabe.
 *
 * Zwei Dinge hält dieser Test fest:
 *   1. die Rechnung selbst (nicht linear, mitlaufend, eine gemeinsame Formel mit der Abrechnung),
 *   2. dass die KI ihre Apron-Fragen auf DERSELBEN Grundlage stellt, die auch besteuert wird —
 *      das war ein echter Fehler, siehe unten.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  getTeamDisplaySalaryTotal,
  getTeamNegotiatedSalaryTotal,
} from "@/lib/sponsor/sponsor-team-salary-display";
import {
  getTeamApronSalaryBase,
  APRON_RATE_ZONE_1,
  APRON_RATE_ZONE_2,
  apronKonjunkturhebel,
  apronLevyForSalary,
  computeApronSettlement,
  resolveApronSalaryFactor,
} from "@/lib/season/apron-service";

const LINIEN = { line1: 100, line2: 125 };
const F = 1.24; // Konjunkturhebel voll aufgedreht: k = 1, die Sätze wirken unverkürzt.

describe("Die eine Abgaben-Formel", () => {
  it("unter der 1. Linie kostet zusätzliches Gehalt nichts", () => {
    expect(apronLevyForSalary({ salary: 99.9, ...LINIEN, salaryFactor: F })).toBe(0);
    expect(apronLevyForSalary({ salary: 100, ...LINIEN, salaryFactor: F })).toBe(0);
  });

  it("zwischen den Linien greift der erste Satz, darüber der zweite", () => {
    expect(apronLevyForSalary({ salary: 110, ...LINIEN, salaryFactor: F })).toBeCloseTo(10 * APRON_RATE_ZONE_1, 6);
    // 25 in Zone 1, 10 in Zone 2 — die Zonen addieren sich, sie lösen einander nicht ab.
    expect(apronLevyForSalary({ salary: 135, ...LINIEN, salaryFactor: F })).toBeCloseTo(
      25 * APRON_RATE_ZONE_1 + 10 * APRON_RATE_ZONE_2,
      6,
    );
  });

  it("der Konjunkturhebel dämpft die ganze Abgabe, nicht nur eine Zone", () => {
    const voll = apronLevyForSalary({ salary: 135, ...LINIEN, salaryFactor: 1.24 });
    const gedaempft = apronLevyForSalary({ salary: 135, ...LINIEN, salaryFactor: 1.0 });
    expect(gedaempft).toBeCloseTo(voll * apronKonjunkturhebel(1.0), 6);
  });

  it("ist DIESELBE Formel, die die Abrechnung benutzt — kein zweiter Nachbau", () => {
    // Der Beweis liegt im Ergebnis, nicht im Kommentar: die Roh-Abgabe der Liga-Abrechnung muss
    // Wert für Wert dem Einzelaufruf entsprechen. Ein Deckel darf hier nicht dazwischenfunken,
    // deshalb ein absichtlich riesiger `rankShare`.
    const gehaelter = [90, 100, 110, 125, 140];
    const settlement = computeApronSettlement({
      lines: LINIEN,
      salaryFactor: F,
      teams: gehaelter.map((salary, index) => ({ teamId: `t${index}`, salary, rankShare: 10_000 })),
    });
    for (const row of settlement.rows) {
      expect(row.rohAbgabe).toBeCloseTo(apronLevyForSalary({ salary: row.salary, ...LINIEN, salaryFactor: F }), 6);
    }
  });
});

describe("Der Salary Factor kommt aus einer Quelle", () => {
  /**
   * VOLLSTÄNDIGES Fenster, weil `resolveApronSalaryFactor` seit der Horizont-Reparatur über
   * `getSeasonEconomyFactorWindow` liest (eine Quelle, siehe apron-service.ts). Jeder geladene
   * Spielstand trägt genau so ein Fenster (`withSeededSeasonEconomyFactors`, save-repository.ts) —
   * die frühere Zweier-Attrappe war die Ausnahme, nicht der Normalfall.
   */
  function fenster(faktoren: number[]) {
    return {
      season: { id: "season-2" },
      seasonState: {
        seasonEconomyFactors: faktoren.map((factor, horizonIndex) => ({
          seasonId: "season-2",
          horizonIndex,
          factor,
        })),
      },
    } as never;
  }

  it("liest den laufenden Faktor aus dem Saison-Fenster", () => {
    expect(resolveApronSalaryFactor(fenster([1.19, 0.87, 0.83, 0.91, 1.24]))).toBe(1.19);
  });

  it("fällt auf 1 zurück, nicht auf 0 — sonst wäre die Steuer für die KI unsichtbar", () => {
    expect(resolveApronSalaryFactor({ seasonState: {} } as never)).toBe(1);
    expect(resolveApronSalaryFactor(fenster([0, 0.87, 0.83, 0.91, 1.24]))).toBe(1);
  });

  it("steht nicht mehr dreimal im Baum", () => {
    const dateien = [
      "lib/season/apron-settlement-service.ts",
      "lib/finance/apron-projection.ts",
      "lib/ai/ai-apron-cost-service.ts",
    ];
    for (const datei of dateien) {
      const quelle = readFileSync(join(process.cwd(), datei), "utf8");
      expect(quelle).not.toContain("function getCurrentSalaryFactor");
    }
  });
});

/**
 * DER FEHLER, DEN DIESE ÄNDERUNG MITNIMMT: `isTeamOverApronSalaryCeiling` und
 * `resolveApronTighteningMultiplier` maßen auf `getTeamSalarySum` — der ECHTEN, front-/back-loadeten
 * Vertragssumme. Besteuert wird aber die geglättete (`getTeamDisplaySalaryTotal`). Die KI prüfte ihre
 * Zurückhaltung also gegen eine andere Zahl, als am Saisonende bemessen wird. Auf Chris' Spielstand
 * (Saison 2, Spieltag 4) widersprachen sich die beiden bei 4 von 32 Teams, im Extremfall um 18,0:
 * Cold Steel stand mit echt 63,6 scheinbar weit unter seiner Decke von 81,0, zahlte aber real
 * Abgabe, weil die geglättete Summe 81,6 betrug.
 */
const TEAM_ID = "A-A";

/**
 * Ein Kader, in dem die DREI Gehaltsbegriffe garantiert verschieden sind:
 *
 *   verhandelt   — was bei Unterschrift ausgemacht wurde (`negotiatedAnnualSalary`), die
 *                  Bemessungsgrundlage der Abgabe.
 *   geglaettet   — das Formel-Gehalt aus Marktwert/Attributen (`expectedSalary`), die ALTE
 *                  Grundlage.
 *   Zahlung      — was dieses Jahr wirklich abgebucht wird (`salary`), bei geformten Vertraegen
 *                  ungleich dem verhandelten Wert.
 *
 * Nur wenn sie auseinanderfallen, sagt ein Vergleich etwas aus. Faellt eine dieser Zahlen
 * kuenftig mit einer anderen zusammen, schlaegt die Vorbedingung im Test an — genau so soll es
 * sein.
 */
function baueTeamMitAbweichendenGehaltsbegriffen(): GameState {
  const basis = createSingleplayerGameState();
  const rosters = basis.rosters.filter((entry) => entry.teamId === TEAM_ID).slice(0, 3);
  return {
    ...basis,
    rosters: rosters.map((entry, index) => ({
      ...entry,
      contractLength: 3,
      contractShape: index === 0 ? "front_loaded" : index === 1 ? "back_loaded" : "balanced",
      // verhandelt: bewusst deutlich unter dem Formelwert — das Team hat gut verhandelt.
      negotiatedAnnualSalary: 6 + index,
      // Zahlung dieses Jahr: bei geformten Vertraegen verschoben.
      salary: index === 0 ? 7.8 : index === 1 ? 4.2 : 8,
    })),
    players: basis.players.map((player) =>
      rosters.some((entry) => entry.playerId === player.id)
        ? { ...player, expectedSalary: 14, displayMarketValue: 60 }
        : player,
    ),
    teams: basis.teams,
  };
}

describe("Die KI misst auf der Grundlage, die auch besteuert wird", () => {
  const quelle = readFileSync(join(process.cwd(), "lib/ai/ai-cash-salary-target-service.ts"), "utf8");
  const apronTeil = quelle.slice(quelle.indexOf("// ── APRON"));

  it("die Apron-Fragen nehmen die Apron-Grundlage", () => {
    expect(apronTeil).toContain("getTeamApronSalaryBase(gameState, teamId) > resolveTeamApronSalaryCeiling");
    expect(apronTeil).not.toContain("getTeamSalarySum(gameState, teamId) > resolveTeamApronSalaryCeiling");
  });

  it("die Cash-Ziele behalten die echte Summe — dort wird wirklich abgebucht", () => {
    const cashTeil = quelle.slice(0, quelle.indexOf("// ── APRON"));
    expect(cashTeil).toContain("const salary = getTeamSalarySum(gameState, teamId);");
  });

  it("die Grundlage steht an genau einer Stelle — geprüft an der Zahl, nicht am Quelltext", () => {
    // HIER STAND EINE ZEICHENKETTEN-PRÜFUNG: `rumpf` musste wörtlich
    // `return getTeamDisplaySalaryTotal(gameState, teamId);` enthalten. Sie ist aus zwei Gründen
    // ersetzt worden.
    //
    // ERSTENS ist die Aussage überholt, und zwar inzwischen zweimal. Erst wanderte die Abgabe vom
    // geglätteten Formelwert auf das VERHANDELTE Gehalt („ja!", docs/APRON_UND_VERTRAGSFORMEN.md,
    // Schritt 3) — damit Verhandeln überhaupt zählt. Dann meldete Chris, auch das sei geglättet
    // („die REAL zu zahlende summe des jahres nach vertrag und nicht geglättet"): das verhandelte
    // Jahresgehalt ist der Durchschnitt über die Laufzeit, nicht das, was in dieser Saison vom
    // Konto geht. Die Grundlage ist deshalb heute `getTeamActualSalaryTotal`.
    //
    // ZWEITENS, und das ist der eigentliche Grund: eine Zeichenkette prüft nichts. Genau diese
    // Sorte Test war im Repo mehrfach über Wochen rot, ohne dass es auffiel, und eine andere
    // prüfte fleißig Werte über einer Funktion, die niemand mehr aufrief. Der Satz in der
    // Überschrift („die Umstellung wäre eine Zeile") hat sich zudem als falsch erwiesen: die
    // ehrliche Umstellung brauchte ein eigenes, gespeichertes Verhandlungs-Benchmark an jedem
    // Unterschriftspfad, weil das naheliegende Gehaltsfeld beim Saisonwechsel mit der Jahr-1-Rate
    // überschrieben wird — front_loaded hätte die Steuerbasis sonst dauerhaft gesenkt.
    //
    // WAS DIE PRÜFUNG STATTDESSEN FESTHÄLT: dass es genau EINE Grundlage gibt, erkennbar daran,
    // dass alle Apron-Fragen dieselbe Zahl sehen. Die Fixture wird so gebaut, dass die drei
    // denkbaren Grundlagen AUSEINANDERFALLEN — sonst wäre der Test auch dann grün, wenn zwei
    // Stellen verschiedene Wege nähmen.
    const gameState = baueTeamMitAbweichendenGehaltsbegriffen();

    const grundlage = getTeamApronSalaryBase(gameState, TEAM_ID);
    const verhandelt = getTeamNegotiatedSalaryTotal(gameState, TEAM_ID);
    const geglaettet = getTeamDisplaySalaryTotal(gameState, TEAM_ID);
    const echteZahlung = getTeamSalarySum(gameState, TEAM_ID);

    // Vorbedingung: die drei Begriffe MÜSSEN sich unterscheiden, sonst prüft der Rest nichts.
    expect(echteZahlung).not.toBeCloseTo(geglaettet, 2);
    expect(echteZahlung).not.toBeCloseTo(verhandelt, 2);

    // Besteuert wird, was in DIESER Saison wirklich gezahlt wird — dieselbe Zahl, gegen die die
    // KI ihre Gehaltsdecke prüft und die der Saisonende-Apply abbucht.
    expect(grundlage).toBeCloseTo(echteZahlung, 6);
  });
});

/**
 * DIE RANGFOLGE, NICHT NUR DAS VETO. Eine Kauf-Schranke, die erst blockiert, wenn das Geld nicht
 * mehr reicht, lässt die KI bis zuletzt den teureren Spieler wählen. Damit sie den GÜNSTIGEREN
 * bevorzugt, solange beide passen, muss die Abgabe in die Bewertung — und zwar als ANTEIL an der
 * Ablöse: 2 Abgabe auf einen 40er Transfer sind ein Rundungsfehler, 2 auf einen 6er ein Drittel
 * Aufschlag.
 */
describe("Die Abgabe verschiebt die Rangfolge, blockiert aber keinen Notkauf", () => {
  const basis = {
    playerId: "p1",
    playerName: "Kandidat",
    price: 20,
    marketValue: 20,
    salary: 8,
    ovr: 70,
    score: 55,
    rosterAfterSell: 12,
    playerMin: 10,
    playerOpt: 14,
    teamCash: 200,
    cashAfterSell: 200,
    plannedSellCount: 0,
    weakestSameAxisOvrRank: null,
    candidateRating: null,
    player: null,
    replacementSlots: [],
    doctrine: {
      personaBlend: [],
      personaHint: "",
      cashBufferScale: 1,
      buyIntentScale: 1,
      passIntentScale: 1,
      replacementFitScale: 1,
    },
    coversNeedAxis: false,
    isTrashCandidate: false,
  } as never as Parameters<typeof import("@/lib/ai/ai-buy-decision-engine").evaluateAiBuyDecision>[0];

  it("ohne Abgabe bleibt alles wie vorher — der Parameter ist rückwärtskompatibel", async () => {
    const { evaluateAiBuyDecision } = await import("@/lib/ai/ai-buy-decision-engine");
    const ohne = evaluateAiBuyDecision(basis);
    const mitNull = evaluateAiBuyDecision({ ...basis, apronMarginalLevy: null });
    expect(mitNull.passIntentScore).toBe(ohne.passIntentScore);
    expect(mitNull.reasonToPass).toEqual(ohne.reasonToPass);
  });

  it("eine Abgabe erhöht die Pass-Absicht und wird benannt", async () => {
    const { evaluateAiBuyDecision } = await import("@/lib/ai/ai-buy-decision-engine");
    const ohne = evaluateAiBuyDecision(basis);
    const mit = evaluateAiBuyDecision({ ...basis, apronMarginalLevy: 4 });
    expect(mit.passIntentScore).toBeGreaterThan(ohne.passIntentScore);
    expect(mit.reasonToPass.join(" ")).toContain("Luxussteuer: +4 Abgabe je Saison");
  });

  it("dieselbe Abgabe wiegt bei einem billigen Zugang schwerer als bei einem teuren", async () => {
    const { evaluateAiBuyDecision } = await import("@/lib/ai/ai-buy-decision-engine");
    const teuer = evaluateAiBuyDecision({ ...basis, price: 40, marketValue: 40, apronMarginalLevy: 3 });
    const billig = evaluateAiBuyDecision({ ...basis, price: 6, marketValue: 6, apronMarginalLevy: 3 });
    expect(billig.passIntentScore).toBeGreaterThan(teuer.passIntentScore);
  });

  it("ein Mindestkader-Notkauf setzt sich trotz Abgabe durch", async () => {
    const { evaluateAiBuyDecision } = await import("@/lib/ai/ai-buy-decision-engine");
    // Kader unter Min: die Lücke bringt bis zu 42 Kauf-Absicht ein, die Steuer höchstens 18.
    const notkauf = evaluateAiBuyDecision({
      ...basis,
      rosterAfterSell: 8,
      playerMin: 10,
      apronMarginalLevy: 99,
    });
    expect(notkauf.buyIntentScore).toBeGreaterThan(notkauf.passIntentScore);
  });
});

/**
 * Die Kauf-Schranke selbst lässt sich ohne einen kompletten 32-Team-Spielstand nicht sinnvoll
 * aufrufen. Geprüft wird deshalb der Vertrag, auf den es ankommt — und zwar an den drei Stellen, an
 * denen er brechen würde: der Grenzpreis muss je Kandidat entstehen, er muss MITLAUFEN (sonst
 * bekommen vier teure Zugänge hintereinander alle die Abgabe des ersten), und er muss in die
 * Puffer-Prüfung eingehen statt nur protokolliert zu werden.
 */
describe("Die Kauf-Schranke rechnet die Abgabe mit", () => {
  const gate = readFileSync(join(process.cwd(), "lib/ai/ai-market-plan-apply-service.ts"), "utf8");
  const rumpf = gate.slice(gate.indexOf("function buildFinalBuyGate("), gate.indexOf("function getAllowedBuyCount("));

  it("der Grenzpreis entsteht je Kandidat aus der Differenz zweier Abgaben", () => {
    expect(rumpf).toContain("const apronLevy = round2(");
    expect(rumpf).toContain("estimateApronLevyAtSalary(input.gameState, apronBaseSalary + apronSalaryAdded + (candidate.salary ?? 0))");
    expect(rumpf).toContain("estimateApronLevyAtSalary(input.gameState, apronBaseSalary + apronSalaryAdded)");
  });

  it("das Gehalt der bereits gewählten Zugänge läuft mit", () => {
    expect(rumpf).toContain("let apronSalaryAdded = 0;");
    expect(rumpf).toContain("apronSalaryAdded += candidate.salary ?? 0;");
    // Die Erhöhung muss NACH der Annahme stehen — ein abgelehnter Kandidat darf die Grundlage der
    // folgenden nicht anheben.
    expect(rumpf.indexOf("picked.push(candidate);")).toBeLessThan(rumpf.indexOf("apronSalaryAdded += candidate.salary ?? 0;"));
  });

  it("die Abgabe geht in die Puffer-Prüfung ein, nicht nur ins Protokoll", () => {
    expect(rumpf).toContain("const effectiveCost = price != null ? price + apronLevy : null;");
    expect(rumpf).toContain("cashRemaining != null && effectiveCost != null ? cashRemaining - effectiveCost");
  });

  it("die Blockade sagt, wenn die Abgabe daran beteiligt war", () => {
    expect(rumpf).toContain("apron_levy=");
  });
});

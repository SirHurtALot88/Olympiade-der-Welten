import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const APPLY = read("lib/season/cash-prize-apply-service.ts");
const PRIZE_MODEL = read("lib/foundation/tabs/use-prize-v2-panel-model.ts");

/**
 * GEMELDET: „bitte alle GuV Spalten etc. auf sponsoren bei aktuellem rang umstellen!!!
 * … wir wollen nirgendwo mehr preisgeld drin haben und sehen sondern nur noch sponsoren!"
 *
 * Die Spalten SPONSOREN und GUV im Saisonstand wurden aus `row.prizeMoney` gebildet — dem
 * Preisgeld-BENCHMARK, der per `CASH_PRIZE_BENCHMARK_ONLY` nie ausgezahlt wird. Die
 * Tabelle versprach damit Geld, das niemand je bekommt.
 *
 * Am echten Spielstand gemessen (Spieltag 10, `season_completed`):
 *
 *   Team   ALT (Preisgeld+Rang / GuV)   NEU (Sponsoren / Gebäude / GuV)
 *   C-C            67.5 /  25.0                48.1 /  3.5 /   9.1
 *   C-S           102.0 /  32.5                79.7 /  0.0 /  10.1
 *   D-L            66.2 /  15.9                39.5 /  0.0 / -10.8
 *
 * D-L zeigt, warum das mehr ist als Kosmetik: aus einem ausgewiesenen Gewinn von 15,9
 * wird ein realer Verlust von 10,8.
 */
describe("Saisonstand: GuV rechnet mit Sponsoren, nicht mit Preisgeld", () => {
  it("bildet die Sponsoren-Spalte aus der Sponsor-Abrechnung beim aktuellen Rang", () => {
    expect(APPLY).toContain("const sponsorTotal = row.sponsorCash != null ? Number(row.sponsorCash.toFixed(2)) : null;");
    // Und NICHT mehr aus dem Benchmark.
    expect(APPLY).not.toContain("row.prizeMoney != null ? Number((row.prizeMoney + (sponsorRank ?? 0))");
  });

  /**
   * NACHGEZOGEN: die Formel steht seit der GuV-Vereinheitlichung (#419) nicht mehr hier, sondern EINMAL
   * in `lib/finance/season-end-guv.ts`. Die Zusicherung bleibt dieselbe — die GuV rechnet die Gebäude
   * mit —, sie prüft nur nicht mehr eine kopierte Formel, sondern dass dieser Schritt die gemeinsame
   * Rechnung benutzt statt sich eine eigene zu bauen. Genau das Nachbauen war der Grund, warum es
   * überhaupt neun verschiedene GuV-Formeln gab.
   */
  it("rechnet die Gebäude in die GuV — über die gemeinsame Rechnung, nicht über eine eigene Formel", () => {
    expect(APPLY).toContain("resolveSeasonGuvByTeam(save.gameState)");
    expect(APPLY).toContain("const guv = seasonGuv?.guv ?? null;");
    // Und die alte, hier einkopierte Formel ist weg.
    expect(APPLY).not.toContain("Number((sponsorTotal + (row.facilityIncome ?? 0) - row.salaryTotal)");
    // Die gemeinsame Rechnung kennt die Gebäude auf beiden Seiten.
    const GUV = read("lib/finance/season-end-guv.ts");
    expect(GUV).toContain("gebaeude_einnahme");
    expect(GUV).toContain("gebaeude_unterhalt");
  });

  it("bildet auch den Season-Anteil aus dem Sponsorgeld", () => {
    expect(APPLY).toContain(
      "row.sponsorCash != null && sponsorBasis != null ? Number((row.sponsorCash - sponsorBasis).toFixed(2)) : null",
    );
  });
});

/**
 * Die GuV verspricht Sponsoren + Gebäude − Gehälter. Buchte der Saisonende-Schritt nur die
 * Sponsoren, versprächen die Spalten wieder mehr als ankommt — derselbe Fehler an neuer
 * Stelle. Die Gebäude-Abrechnung lief bisher NUR im `season-completion-service`, und der
 * hängt allein im Cockpit.
 */
describe("Saisonende-Buchung: die Spalte und das Konto meinen dasselbe", () => {
  it("bucht die Gebäude im selben Schritt wie die Sponsoren", () => {
    expect(APPLY).toContain("applyFacilitySeasonEndFinance(latestSave, team.teamId, facilityPreview.confirmToken");
    expect(APPLY).toContain("applySponsorSettlement({");
  });

  it("nur am Saisonende — der Spieltags-Pfad bucht nichts", () => {
    const facilityBlock = APPLY.slice(APPLY.indexOf("GEBAEUDE GEHOEREN ZUR SAISONABRECHNUNG"));
    expect(facilityBlock).toContain('if (input.phase === "season_end") {');
  });

  it("schliesst Doppelbuchung ueber dieselbe Sperre aus wie der Saisonabschluss", () => {
    expect(APPLY).toContain("hasFacilitySeasonEndFinanceApplied(latestSave.gameState");
    // Die Sperre gibt es nur einmal — nicht hier nachgebaut.
    const facility = read("lib/facilities/facility-season-end-service.ts");
    expect(facility).toContain("export function hasFacilitySeasonEndFinanceApplied");
  });

  /**
   * Der Grund fuer das Neu-Aufloesen in JEDEM Durchlauf steht im Saisonabschluss und gilt
   * hier genauso: `applyFacilitySeasonEndFinance` persistiert einen vollstaendigen
   * GameState aus dem ihm gegebenen Stand. Aus einem veralteten Schnappschuss gebaut,
   * ueberschriebe ein spaeteres Team die Buchung eines frueheren.
   */
  it("loest den Spielstand je Team neu auf, statt einen Schnappschuss zu halten", () => {
    const facilityBlock = APPLY.slice(APPLY.indexOf("GEBAEUDE GEHOEREN ZUR SAISONABRECHNUNG"));
    expect(facilityBlock).toContain("const latestSave = resolveLocalSave(input.persistence, save.saveId);");
  });
});

describe("Preisgeld-Tabelle: die Spalte zeigt Sponsoren", () => {
  it("hat keine Preisgeld-Spalte mehr", () => {
    expect(PRIZE_MODEL).not.toContain('label: "Preisgeld"');
    expect(PRIZE_MODEL).toContain('{ id: "sponsorCash", label: "Sponsoren", dataKey: "sponsorCash"');
    expect(PRIZE_MODEL).toContain('{ id: "facilityIncome", label: "Gebäude", dataKey: "facilityIncome"');
  });

  it("zeigt auch die Rang-Szenarien nicht mehr auf Preisgeld-Basis", () => {
    // `payoutIfTenBetter/-Worse` sind `prizeMoney + Rangbonus` — reine Benchmark-Zahlen.
    expect(PRIZE_MODEL).not.toContain('label: "+10 Plätze"');
    expect(PRIZE_MODEL).not.toContain('label: "-10 Plätze"');
  });

  it("sortiert nach der Groesse, die es zeigt", () => {
    expect(PRIZE_MODEL).toContain("sponsorCash: (row) => row.sponsorCash ?? Number.NEGATIVE_INFINITY,");
    expect(PRIZE_MODEL).not.toContain("prizeMoney: (row) => row.prizeMoney ?? Number.NEGATIVE_INFINITY,");
  });
});

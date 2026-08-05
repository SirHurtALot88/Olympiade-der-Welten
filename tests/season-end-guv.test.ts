import { describe, expect, it } from "vitest";

import {
  buildSeasonGuv,
  buildSeasonGuvHoverText,
  seasonGuvFromPosten,
  SEASON_GUV_POSTEN_KEYS,
} from "@/lib/finance/season-end-guv";
import { buildGuvBreakdown } from "@/lib/finance/guv-breakdown";

/**
 * GEMELDET VON CHRIS, zwei Sätze, die diese Datei absichern:
 *
 *  1. „ich will auch endlich dass überall die GuV das gleiche ausweist und nicht hier was anderes
 *     steht als im Sponsor-Tab oder dem Finanzen-Tab."
 *  2. „bitte aber alles was berechnet wird dann auch in das Hover over rein bringen damit man es
 *     sieht SELBST WENN ES 0 IST."
 *
 * Dazu: „Preisgeld gibts doch gar nicht mehr?" — die Einnahmen sind Sponsoren, Gebäude und Apron.
 */
describe("Die EINE GuV", () => {
  const vollstaendig = {
    teamId: "S-C",
    sponsorCash: 64.2,
    facilityIncome: 12,
    facilityUpkeep: 4.5,
    apronNetto: -6.3,
    apronRank: 7,
    apronGebucht: true,
    objectiveCashDelta: 3,
    salaryTotal: 42.5,
    loanInterest: 1.4,
    loanPrincipal: 5.6,
    transferNet: -193.7,
  };

  it("zeigt JEDEN Posten, auch die mit 0", () => {
    // Ein Team ohne Kredite, ohne Gebäude, ohne Apron: die Zeilen müssen trotzdem alle dastehen,
    // sonst bleibt offen, ob sie in der Zahl stecken. Genau das war die Forderung.
    const leer = buildSeasonGuv({ teamId: "T", sponsorCash: 50, salaryTotal: 40 });
    expect(leer.posten.map((entry) => entry.key)).toEqual([...SEASON_GUV_POSTEN_KEYS]);
    expect(leer.posten.find((entry) => entry.key === "kreditzins")?.amount).toBe(0);
    expect(leer.posten.find((entry) => entry.key === "gebaeude_einnahme")?.amount).toBe(0);
    expect(leer.posten.find((entry) => entry.key === "apron")?.amount).toBe(0);
    // Und sie stehen auch im Hover-Text — nicht nur im Datenmodell.
    const hover = buildSeasonGuvHoverText(leer);
    expect(hover).toContain("Kreditzins");
    expect(hover).toContain("Gebäude-Einnahme");
    expect(hover).toContain("Apron");
    expect(hover).toContain("Kredit-Tilgung");
  });

  it("rechnet Einnahmen − Ausgaben und zählt Transfers und Tilgung NICHT mit", () => {
    const guv = buildSeasonGuv(vollstaendig);
    // 64.2 + 12 + 3 − 6.3 − 42.5 − 4.5 − 1.4
    expect(guv.guv).toBe(24.5);
    expect(guv.einnahmen).toBe(79.2); // Sponsor + Gebäude + Ziele
    expect(guv.ausgaben).toBe(54.7); // Gehälter + Unterhalt + Zins + Apron-Abgabe

    // Die beiden Abgrenzungen sind da, aber ausserhalb der Summe. Wären die Transfers drin, stünde
    // in der Draft-Saison eine GuV von rund −170 statt der laufenden Betriebs-GuV.
    const abgrenzung = guv.posten.filter((entry) => !entry.counted).map((entry) => entry.key);
    expect(abgrenzung).toEqual(["kredittilgung", "transfers"]);
    expect(guv.posten.find((entry) => entry.key === "transfers")?.amount).toBe(-193.7);
  });

  it("nennt den Rang, auf den der Apron hochgerechnet ist", () => {
    // Der Apron wird erst am Saisonende gegen den ENDrang abgerechnet. Ohne diesen Hinweis läse sich
    // die Zeile wie ein bereits gebuchter Posten.
    const guv = buildSeasonGuv({ ...vollstaendig, apronGebucht: false, apronFrozenLines: false, apronGedeckelt: true });
    const apron = guv.posten.find((entry) => entry.key === "apron");
    expect(apron?.note).toContain("Platz 7");
    expect(apron?.note).toContain("noch nicht gebucht");
    expect(apron?.note).toContain("Deckel");
    expect(apron?.note).toContain("nicht eingefroren");
  });

  /**
   * REGRESSION, DIE ICH SELBST VERURSACHT HABE. Ich hatte den Apron bedingungslos mitgezählt, weil er
   * eine der drei Einnahmequellen ist. Zwei Invarianten-Tests haben das gefangen: der Finanzen-Reiter
   * verspricht `Σ(Einnahmen) − Σ(Ausgaben) == GuV == echte Cash-Veränderung`, und die
   * Geldfluss-Invariante verlangt `cashVorher + Σ Buchungen == cashNachher`. Eine HOCHRECHNUNG in der
   * GuV bricht beide, weil das Geld noch nicht geflossen ist.
   *
   * Auflösung: die Zeile ist IMMER da (Chris' „selbst wenn es 0 ist"), aber sie zählt erst, wenn die
   * Apron-Abrechnung dieser Saison wirklich gebucht wurde.
   */
  it("zählt den Apron erst, wenn er gebucht ist — vorher steht er als Hochrechnung daneben", () => {
    const ungebucht = buildSeasonGuv({ ...vollstaendig, apronGebucht: false });
    const apronZeile = ungebucht.posten.find((entry) => entry.key === "apron");
    expect(apronZeile).toBeDefined();
    expect(apronZeile?.counted).toBe(false);
    // Ohne den Apron: 64.2 + 12 + 3 − 42.5 − 4.5 − 1.4
    expect(ungebucht.guv).toBe(30.8);

    const gebucht = buildSeasonGuv({ ...vollstaendig, apronGebucht: true });
    expect(gebucht.posten.find((entry) => entry.key === "apron")?.counted).toBe(true);
    expect(gebucht.guv).toBe(24.5);
    expect(gebucht.posten.find((entry) => entry.key === "apron")?.note).toContain("gebucht");
  });

  it("kommt beim Wiederaufsummieren der Postenliste auf dieselbe Zahl", () => {
    // Die Liste wandert über den Feed durch die Oberfläche; dort liegen nur noch die Posten vor.
    const guv = buildSeasonGuv(vollstaendig);
    const wieder = seasonGuvFromPosten("S-C", guv.posten);
    expect(wieder.guv).toBe(guv.guv);
    expect(wieder.einnahmen).toBe(guv.einnahmen);
    expect(wieder.ausgaben).toBe(guv.ausgaben);
  });

  it("baut den Saisonstand-Hover aus den Posten statt aus dem Restterm", () => {
    // ALT: „Gebäude netto" wurde als Rest `guv − sponsor + gehälter` gerechnet. Dadurch verschwand
    // jeder Fehler in `guv` still in dieser Zeile — genau so blieb der Preisgeld-Bug unsichtbar.
    const guv = buildSeasonGuv(vollstaendig);
    const breakdown = buildGuvBreakdown({
      posten: guv.posten,
      sponsorTotal: 999, // absichtlich falsch: mit Posten darf das keine Rolle mehr spielen
      salaryTotal: 999,
      guv: null,
    });
    expect(breakdown.total).toBe(24.5);
    expect(breakdown.lines.map((line) => line.label)).toContain("Kreditzins");
    expect(breakdown.hoverText).toContain("Preisgeld gibt es nicht mehr");
  });

  it("fällt ohne Posten auf die alte schmale Herleitung zurück", () => {
    // Ansichten ohne Feed sollen nicht leer bleiben; der Rückfall bleibt erhalten.
    const breakdown = buildGuvBreakdown({ sponsorTotal: 50, salaryTotal: 40, guv: 15 });
    expect(breakdown.total).toBe(15);
    expect(breakdown.lines.map((line) => line.label)).toContain("Gebäude netto");
  });
});

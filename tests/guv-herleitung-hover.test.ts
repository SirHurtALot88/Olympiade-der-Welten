/**
 * GEMELDET VON CHRIS: „Die GuV im Saisonstand und die im Finanzen-Reiter weichen voneinander ab! …
 * am besten ein Hover auf dem GuV-Posten, der noch mal aufzeigt, wie die Zahl sich zusammensetzt!"
 *
 * ENTSCHEIDUNG VON CHRIS nach dem Befund: die zwei Definitionen bleiben, sie werden erklärt.
 *
 * Geprüft wird die Herleitung, nicht der Text:
 *
 *  1. Die Zerlegung geht exakt auf — „Gebäude netto" ist der Rest der Saisonstand-Formel.
 *  2. Beide Hover benennen, was NICHT drinsteckt: Transfers und Apron.
 *  3. Beide Ansichten lesen dieselbe Datei.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildGuvBreakdown, buildOperatingGuvHoverText } from "@/lib/finance/guv-breakdown";

const root = process.cwd();

describe("Die Saisonstand-GuV wird in ihre echten Terme zerlegt", () => {
  it("Sponsor + Gebäude netto − Gehälter ergibt wieder die angezeigte Zahl", () => {
    // Saisonstand-Formel (standings-overview/route.ts:440-443): Sponsor + Gebäude netto − Gehälter.
    const breakdown = buildGuvBreakdown({ sponsorTotal: 120, salaryTotal: 90, guv: 42 });
    const counted = breakdown.lines.filter((line) => line.counted);
    const sum = counted.reduce((total, line) => total + (line.value ?? 0), 0);
    expect(Number(sum.toFixed(2))).toBe(42);
    // Gebäude netto ist der Rest: 42 − 120 + 90 = 12.
    expect(counted.find((line) => line.label.startsWith("Gebäude"))?.value).toBe(12);
  });

  it("Gehälter erscheinen als Abzug, nicht als positiver Posten", () => {
    const breakdown = buildGuvBreakdown({ sponsorTotal: 100, salaryTotal: 80, guv: 30 });
    expect(breakdown.lines.find((line) => line.label === "Gehälter")?.value).toBe(-80);
  });

  it("fehlende Werte erfinden nichts", () => {
    // Gegenprobe: ohne Sponsor-Zahl darf kein Rest gerechnet werden, sonst steht eine erfundene
    // Gebäude-Zahl im Hover.
    const breakdown = buildGuvBreakdown({ sponsorTotal: null, salaryTotal: 80, guv: 30 });
    expect(breakdown.lines.find((line) => line.label.startsWith("Gebäude"))?.value).toBeNull();
    expect(breakdown.hoverText).toContain("—");
  });

  it("Transfers stehen als NICHT enthalten daneben", () => {
    const breakdown = buildGuvBreakdown({ sponsorTotal: 100, salaryTotal: 80, guv: 30, transferNet: -55 });
    const transfers = breakdown.lines.find((line) => line.label.startsWith("Transfers"));
    expect(transfers?.counted).toBe(false);
    // ... und verfälschen die Summe nicht.
    const sum = breakdown.lines.filter((line) => line.counted).reduce((t, l) => t + (l.value ?? 0), 0);
    expect(Number(sum.toFixed(2))).toBe(30);
  });
});

describe("Der Apron steht als Hochrechnung beim aktuellen Rang daneben", () => {
  const apron = {
    nettoDelta: -3.4,
    rank: 7,
    salary: 83.3,
    line1: 69.5,
    line2: 79,
    frozenLines: true,
    gedeckelt: false,
  };

  it("zählt NICHT in die GuV hinein — die Zerlegung geht weiter exakt auf", () => {
    const breakdown = buildGuvBreakdown({ sponsorTotal: 100, salaryTotal: 80, guv: 30, apron });
    const apronLine = breakdown.lines.find((line) => line.label.startsWith("Apron"));
    expect(apronLine?.counted).toBe(false);
    expect(apronLine?.value).toBe(-3.4);
    const sum = breakdown.lines.filter((line) => line.counted).reduce((total, line) => total + (line.value ?? 0), 0);
    expect(Number(sum.toFixed(2))).toBe(30);
  });

  it("nennt den Rang, auf den hochgerechnet wurde, und weist sich als Hochrechnung aus", () => {
    const text = buildGuvBreakdown({ sponsorTotal: 100, salaryTotal: 80, guv: 30, apron }).hoverText;
    // Der Einwand gegen den Apron im Hover war, dass Deckel und Ausschüttung am ENDRANG hängen.
    // Er wird nicht wegdefiniert: der Hover sagt beides — worauf gerechnet wurde und was noch offen ist.
    expect(text).toContain("Platz 7");
    expect(text).toContain("Hochrechnung");
    expect(text).toContain("Endrang");
  });

  it("rechnet die GuV inklusive Apron vor, statt sie den Leser bilden zu lassen", () => {
    const text = buildGuvBreakdown({ sponsorTotal: 100, salaryTotal: 80, guv: 30, apron }).hoverText;
    expect(text).toContain("mit Apron +26,6");
  });

  it("nennt die Bemessungsgrundlage und die Linien, gegen die sie steht", () => {
    // FRUEHER hiess dieser Fall „nennt die GEGLAETTETE Bemessungsgrundlage, weil sie von der
    // Gehaltsspalte abweichen darf" — der Apron rechnete auf einer anderen Groesse als die GuV.
    // Seit dem 13.08.2026 ist es dieselbe (die real zu zahlende Jahressumme), das Wort
    // „geglaettet" waere also eine Behauptung ueber einen Unterschied, den es nicht mehr gibt.
    // Die Zeile selbst bleibt noetig: ohne sie sucht man die Herkunft der Zahl.
    const text = buildGuvBreakdown({ sponsorTotal: 100, salaryTotal: 97.7, guv: 30, apron }).hoverText;
    expect(text).toContain("83,3");
    expect(text).not.toContain("geglättet");
    expect(text).toContain("69,5 / 79");
  });

  it("meldet einen greifenden Deckel und noch nicht eingefrorene Linien", () => {
    const text = buildGuvBreakdown({
      sponsorTotal: 100,
      salaryTotal: 80,
      guv: 30,
      apron: { ...apron, gedeckelt: true, frozenLines: false },
    }).hoverText;
    expect(text).toContain("Deckel begrenzt");
    expect(text).toContain("noch nicht eingefroren");
  });

  it("ohne Apron-Daten bleibt der Hover unverändert", () => {
    // Gegenprobe: die Hochrechnung ist additiv. Ein Aufrufer ohne Apron-Zahlen (Archivsaison,
    // fehlendes Team) bekommt exakt den Text von vorher statt einer leeren Apron-Zeile.
    const ohne = buildGuvBreakdown({ sponsorTotal: 100, salaryTotal: 80, guv: 30 });
    expect(ohne.hoverText).not.toContain("Hochrechnung");
    expect(ohne.lines.some((line) => line.label.startsWith("Apron"))).toBe(false);
  });
});

describe("Beide Hover benennen dieselbe Abgrenzung", () => {
  const standings = buildGuvBreakdown({ sponsorTotal: 100, salaryTotal: 80, guv: 30 }).hoverText;
  const finances = buildOperatingGuvHoverText({ totalIncome: 200, totalExpenses: 170 });

  it("Transfers und Apron werden in beiden ausdrücklich ausgenommen", () => {
    for (const [name, text] of [["Saisonstand", standings], ["Finanzen", finances]] as const) {
      expect(text, `${name}: Transfers fehlen`).toContain("Transfers");
      expect(text, `${name}: Apron fehlt`).toContain("Apron");
      // Die Abgrenzung muss dastehen — auf welches Wort sie faellt, ist Sache der Fassung.
      expect(text, `${name}: Abgrenzung fehlt`).toMatch(/Ohne Transfers|Nicht enthalten/);
    }
  });

  it("jeder erklärt, warum die ANDERE Ansicht eine andere Zahl zeigt", () => {
    expect(standings).toContain("Finanzen-Reiter rechnet breiter");
    expect(finances).toContain("Saisonstand rechnet schmaler");
  });

  it("keiner behauptet, eine der Zahlen sei falsch", () => {
    for (const text of [standings, finances]) {
      // Kein Hover darf die andere Zahl fuer falsch erklaeren — die Formulierung ist frei.
      expect(text).toMatch(/Beide stimmen|Beide sind richtig/);
    }
  });
});

describe("Beide Ansichten lesen dieselbe Herleitung", () => {
  it("Saisonstand und Finanzen importieren aus lib/finance/guv-breakdown", () => {
    // Zwei Kopien wären genau der Zustand, der die Meldung ausgelöst hat.
    const standings = readFileSync(join(root, "app/foundation/season-v2/SeasonStandingsNewLook.tsx"), "utf8");
    const finances = readFileSync(join(root, "app/foundation/finances/FoundationFinancesNewLook.tsx"), "utf8");
    expect(standings).toContain('from "@/lib/finance/guv-breakdown"');
    expect(finances).toContain('from "@/lib/finance/guv-breakdown"');
    expect(standings).toContain("buildGuvBreakdown(");
    expect(finances).toContain("buildOperatingGuvHoverText(");
  });
});

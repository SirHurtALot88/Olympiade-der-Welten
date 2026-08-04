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

describe("Beide Hover benennen dieselbe Abgrenzung", () => {
  const standings = buildGuvBreakdown({ sponsorTotal: 100, salaryTotal: 80, guv: 30 }).hoverText;
  const finances = buildOperatingGuvHoverText({ totalIncome: 200, totalExpenses: 170 });

  it("Transfers und Apron werden in beiden ausdrücklich ausgenommen", () => {
    for (const [name, text] of [["Saisonstand", standings], ["Finanzen", finances]] as const) {
      expect(text, `${name}: Transfers fehlen`).toContain("Transfers");
      expect(text, `${name}: Apron fehlt`).toContain("Apron");
      expect(text, `${name}: Abgrenzung fehlt`).toContain("Nicht enthalten:");
    }
  });

  it("jeder erklärt, warum die ANDERE Ansicht eine andere Zahl zeigt", () => {
    expect(standings).toContain("Finanzen-Reiter rechnet breiter");
    expect(finances).toContain("Saisonstand rechnet schmaler");
  });

  it("keiner behauptet, eine der Zahlen sei falsch", () => {
    for (const text of [standings, finances]) {
      expect(text).toContain("Beide sind richtig");
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

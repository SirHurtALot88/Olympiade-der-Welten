/**
 * M5 · Scouting-Feinschliff (Audit „markt", Befunde S1–S3; S4 Kontraste laufen über F1).
 *
 * S1 — Der Scouting Report zeigte zuerst ein bildschirmfüllendes Vorher/Nachher-Balkendiagramm
 *      (acht Balken, `nl-scout-impact-mirror`) und erst darunter, wessen Report das überhaupt ist.
 *      `ScoutingReportPanel` trägt dieselben `report.axisImpact`-Werte bereits als kompakte
 *      Chip-Zeile — die Balken-Spiegelung war eine zweite Darstellung derselben Zahlen (keine
 *      zusätzliche Information) und ist ersatzlos raus; der Spielerkopf steht jetzt zuerst.
 * S2 — CA/PO-Decke/Intel/Fee in der Shortlist-Tabelle und der "low"-Potenzial-Badge im Report
 *      waren unerklärte/unübersetzte Kürzel. Jetzt Glossar-Tooltips an den Spaltenköpfen und eine
 *      deutsche Potenzial-Einstufung ("Niedrig" statt "low").
 * S3 — Der eigene "Empfehlungen"-Reiter (eine "Kaufbereit"-Karte + zwei Zeilen Text) ist in die
 *      Übersicht gefaltet — Nav-Item raus (innen UND im Shell-Subnav), Inhalt zieht in den
 *      overview-Block um; ein alter `?tab=recommended`-Deep-Link fällt weiterhin auf denselben
 *      Inhalt zurück statt auf eine leere Seite.
 *
 * String-Assertions auf den Quelltext, wie `tests/transferhistorie-velo-look.test.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const CENTER = quelle("app/foundation/scouting-center-v2/ScoutingCenterV2NewLook.tsx");
const REPORT = quelle("app/foundation/scouting-center-v2/ScoutingReportPanel.tsx");
const SHORTLIST = quelle("app/foundation/scouting-center-v2/ScoutingShortlistBoard.tsx");
const SHELL = quelle("app/foundation/FoundationShellRouterBody.tsx");

describe("S1 — Spielerkopf zuerst, keine doppelte Impact-Darstellung mehr", () => {
  it("das bildschirmfüllende Vorher/Nachher-Balkendiagramm ist komplett raus", () => {
    expect(CENTER).not.toContain("nl-scout-impact-mirror");
    expect(CENTER).not.toContain("nl-scout-impact-charts");
    expect(CENTER).not.toContain("NlBarChart");
  });

  it("ScoutingReportPanel ist jetzt das einzige Element im 'reports'-Tab vor dem Wishlist-Picker", () => {
    const reportsBlock = CENTER.slice(CENTER.indexOf('activeTab === "reports"'), CENTER.indexOf("nl-scout-report-picker"));
    expect(reportsBlock).toContain("<ScoutingReportPanel");
  });

  it("der Spielerkopf (header) steht in ScoutingReportPanel vor der Top-6-Impact-Karte", () => {
    const headerIdx = REPORT.indexOf('<header className="scouting-report-header">');
    const impactIdx = REPORT.indexOf('data-testid="scouting-report-top6-impact"');
    expect(headerIdx).toBeGreaterThan(-1);
    expect(impactIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeLessThan(impactIdx);
  });
});

describe("S2 — Glossar-Tooltips auf CA/PO-Decke/Intel/Fee, 'low' übersetzt", () => {
  it("die Shortlist-Spaltenköpfe CA/PO-Decke/Intel/Fee tragen ein tooltip-Feld", () => {
    expect(SHORTLIST).toMatch(/key:\s*"intel"[\s\S]{0,200}tooltip:/);
    expect(SHORTLIST).toMatch(/key:\s*"ca"[\s\S]{0,200}tooltip:/);
    expect(SHORTLIST).toMatch(/key:\s*"po"[\s\S]{0,200}tooltip:/);
    expect(SHORTLIST).toMatch(/key:\s*"fee"[\s\S]{0,200}tooltip:/);
  });

  it("der Potenzial-Badge im Report übersetzt den rohen Enum-Wert (kein rohes 'low' mehr)", () => {
    expect(REPORT).toContain("POTENTIAL_BAND_LABEL[report.potentialBand]");
    expect(REPORT).not.toMatch(/\{report\.potentialBand\}\s*<\/span>/);
  });

  it("dieselbe Übersetzungstabelle wie ScoutingShortlistBoard (elite/high/medium/low/unknown)", () => {
    for (const quelleDatei of [REPORT, SHORTLIST]) {
      expect(quelleDatei).toContain('elite: "Elite"');
      expect(quelleDatei).toContain('low: "Niedrig"');
    }
  });
});

describe("S3 — Empfehlungen-Tab in die Übersicht gefaltet", () => {
  it("kein eigenes 'Empfehlungen'-Nav-Item mehr (weder innen noch im Shell-Subnav)", () => {
    expect(CENTER).not.toContain('{ id: "recommended", label: "Empfehlungen"');
    expect(SHELL).not.toContain('{ id: "recommended", label: "Empfehlungen" }');
  });

  it("die Empfehlungen-Karte rendert jetzt innerhalb des overview-Blocks", () => {
    const overviewStart = CENTER.indexOf('activeTab === "overview" || activeTab === "recommended"');
    const overviewBlockEnd = CENTER.indexOf('activeTab === "reports"');
    expect(overviewStart).toBeGreaterThan(-1);
    const overviewBlock = CENTER.slice(overviewStart, overviewBlockEnd);
    expect(overviewBlock).toContain('data-testid="scouting-recommendations"');
    expect(overviewBlock).toContain("Nächste Schritte");
  });

  it("ein alter '?tab=recommended'-Deep-Link fällt auf denselben Übersicht-Inhalt zurück statt auf eine leere Seite", () => {
    // Es darf keinen eigenständigen, nur an "recommended" gebundenen Render-Zweig mehr geben.
    expect(CENTER).not.toMatch(/\{activeTab === "recommended" \? \(/);
  });

  it("scouting-recommendations bleibt im Markup (Contract-Test scouting-display-contract.test.ts erwartet es nicht direkt, aber andere Konsumenten könnten)", () => {
    expect(CENTER).toContain('data-testid="scouting-recommendations"');
  });
});

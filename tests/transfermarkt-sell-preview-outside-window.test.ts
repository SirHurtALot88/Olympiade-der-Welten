import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const ROUTE = read("app/api/transfermarkt/sell/route.ts");

/**
 * Gemeldet: „PPs weg an MD10 — so kann ich keine Verkaufsentscheidung treffen."
 *
 * Ein Teil davon war das Verkaufs-Modal, das ausserhalb des Verkaufsfensters nur
 * Striche zeigte. Ursache war NICHT die Verkaufs-Engine: die Route schickte auch
 * die reine Vorschau (`dryRun`) durch `evaluateGamePhaseAction(…, "sell_players")`
 * und antwortete mit 409 und `summary: null`.
 *
 * Am echten Spielstand (`season_completed`, Spieltag 10) nachgemessen:
 *
 *   Routen-Gate  : allowed=false, phase_blocked:sell_players:season_completed
 *   Vorschau     : canSell=false, blockingReasons=["sell_only_at_season_end"],
 *                  salePrice 28.37, netProceeds 23.13, MW-Referenz 23.19
 *
 * Die Zahlen lagen also bereit — die Route liess sie nur nicht durch.
 */
describe("Verkaufs-Route: Vorschau auch ausserhalb des Verkaufsfensters", () => {
  it("laesst die Vorschau durch, den Verkauf aber nicht", () => {
    expect(ROUTE).toContain("if (!phaseGate.allowed && !dryRun) {");
  });

  /**
   * Der entscheidende Punkt: die Lockerung ist nur deshalb gefahrlos, weil die
   * Sperre ZWEIMAL steht. Faellt der Riegel in der Route fuer den Verkauf weg,
   * ist der Schutz weg — dieser Test haelt genau das fest.
   */
  it("behaelt die Sperre fuer den ausfuehrenden Pfad", () => {
    const gateStart = ROUTE.indexOf("const phaseGate = evaluateGamePhaseAction");
    const gateBlock = ROUTE.slice(gateStart, ROUTE.indexOf("const writeAuth", gateStart));
    expect(gateStart).toBeGreaterThan(-1);
    // Der 409-Ausgang existiert weiterhin, er gilt jetzt nur nicht mehr fuer dryRun.
    expect(gateBlock).toContain("status: 409");
    expect(gateBlock).toContain("summary: null");
    // Und er darf nicht versehentlich zu einem reinen `if (!phaseGate.allowed)` zurueckfallen.
    expect(gateBlock).not.toMatch(/if \(!phaseGate\.allowed\) \{/);
  });

  it("rechnet die Vorschau weiterhin ueber den Vorschau-Pfad, nie ueber den Verkauf", () => {
    expect(ROUTE).toContain(
      "const summary = dryRun ? previewLocalTransfermarktSell(params) : executeLocalTransfermarktSell(params);",
    );
  });

  /**
   * Die Route setzt fuer diesen Fall bewusst KEIN `error`: es ist kein Fehler,
   * sondern ein regulaerer Zustand. Der Grund steckt in `summary.blockingReasons`,
   * und das Modal rendert ihn dort als eigenen Zustand ("Verkauf blockiert",
   * Vorschau darunter lesbar). Waere zusaetzlich ein `error` gesetzt, zeigte das
   * Modal denselben Sachverhalt doppelt — genau der Meldungs-Stapel, der gerade
   * abgeschafft wurde.
   */
  it("meldet den geschlossenen Zustand als Blockgrund, nicht als Fehler", () => {
    const responseStart = ROUTE.indexOf("return NextResponse.json(\n      {\n        success: summary.canSell,");
    expect(responseStart).toBeGreaterThan(-1);
    const response = ROUTE.slice(responseStart, responseStart + 400);
    expect(response).toContain("summary,");
    expect(response).not.toContain("error:");
  });

  it("zeigt den Blockgrund im Modal an — und sagt dabei die Wahrheit", () => {
    const labels = read("app/foundation/transfermarkt-v2/transfer-sell-view-labels.ts");
    // „bis dahin nur Vorschau" stand schon da — es stimmte nur nicht.
    expect(labels).toContain("bis dahin nur Vorschau");
    const host = read("app/foundation/transfermarkt-v2/FoundationMarketSellShellHost.tsx");
    expect(host).toContain('data-testid="transfer-sell-blocked-callout"');
    expect(host).toContain("translateSellBlockingReason(preview.blockingReasons[0])");
  });
});

/**
 * GEMELDET VON CHRIS: „wenn man sich die wertung anschaut und dort auf verkaufen klickt oder so
 * oder im verträge reiter auf verkaufen, dann sollte der screen auch zum verkaufsmodal springen
 * was unten aufgeht, sonst ist der user nur irritiert. und wenn der spieler verkauft wurde soll
 * es wieder hoch springen zu den verträgen."
 *
 * WARUM DAS „UNTEN AUFGEHT": der Verkaufsdialog ist kein Overlay. Der Shell-Router haengt ihn als
 * eigene Flaeche zusaetzlich ein, waehrend die Teamansicht stehen bleibt — deren `active` haengt
 * an `activeView === "teams"` und nicht am Panel. Die Flaeche erscheint deshalb UNTER dem, was man
 * gerade liest.
 *
 * An dieser Stelle stand ein Sprung nach GANZ OBEN. Der stimmte fuer den Weg aus dem Transfermarkt,
 * wo die Flaeche die Seite ersetzt — aus der Teamansicht heraus fuehrte er vom Dialog weg. Ein
 * frueherer Bericht („springt der screen nicht zum verkaufsmodal, das irritiert") wurde damals so
 * behoben; die Haelfte, die anhaengt statt zu ersetzen, blieb offen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SCOPE = readFileSync(
  join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
  "utf8",
);
const HELFER = readFileSync(join(process.cwd(), "lib/foundation/verkauf-sprung.ts"), "utf8");
const SELL_HOST = readFileSync(
  join(process.cwd(), "app/foundation/transfermarkt-v2/FoundationMarketSellShellHost.tsx"),
  "utf8",
);

/** Der Rumpf von `openMarketSellModal` — dort faellt die Entscheidung, wohin gesprungen wird. */
function oeffnenRumpf() {
  const start = SCOPE.indexOf("async function openMarketSellModal(");
  expect(start, "openMarketSellModal nicht gefunden").toBeGreaterThanOrEqual(0);
  return SCOPE.slice(start, SCOPE.indexOf("async function openMarketSellPeek(", start));
}

describe("Verkaufen springt zum Dialog, nicht an den Seitenanfang", () => {
  it("springt beim Oeffnen zur Verkaufsflaeche", () => {
    expect(oeffnenRumpf()).toContain("springeZuElement(VERKAUFSFLAECHE_ANKER)");
  });

  it("springt NICHT mehr blind an den Seitenanfang", () => {
    // Genau diese Zeilen fuehrten aus der Teamansicht heraus vom Dialog weg.
    const rumpf = oeffnenRumpf();
    expect(rumpf).not.toContain("window.scrollTo({ top: 0");
    expect(rumpf).not.toContain("document.body.scrollTop = 0");
  });

  it("merkt sich vorher, wo der Bildschirm stand", () => {
    expect(oeffnenRumpf()).toContain("marketSellRuecksprungRef.current");
  });

  it("der Anker zeigt auf eine Kennung, die die Flaeche wirklich traegt", () => {
    // Ohne diese Zusage zeigt der Sprung auf ein Element, das es nicht gibt — und faellt still aus.
    expect(HELFER).toContain('\'[data-testid="transfer-sell-page"]\'');
    expect(SELL_HOST).toContain('testId="transfer-sell-page"');
  });
});

describe("Nach dem Verkauf zurueck zu den Vertraegen", () => {
  it("springt nach erfolgreichem Verkauf an die gemerkte Stelle zurueck", () => {
    const start = SCOPE.indexOf("async function confirmTransfermarktSell(");
    expect(start).toBeGreaterThanOrEqual(0);
    const rumpf = SCOPE.slice(start, start + 6000);
    expect(rumpf).toContain("springeZuPosition(ruecksprung)");
    // Erst schliessen, dann springen — sonst springt man in eine Flaeche, die noch steht.
    expect(rumpf.indexOf("setFoundationPanel(null)")).toBeLessThan(rumpf.indexOf("springeZuPosition(ruecksprung)"));
  });

  it("bringt auch das Abbrechen an dieselbe Stelle zurueck", () => {
    const start = SCOPE.indexOf("function closeMarketSellModal(");
    const rumpf = SCOPE.slice(start, SCOPE.indexOf("function retryMarketSellPreview(", start));
    expect(rumpf).toContain("springeZuPosition(ruecksprung)");
  });

  it("merkt sich die Position und keinen festen Anker", () => {
    // Geklickt wird auch aus der Wertung und aus dem Auslauf-Center. Ein fester Vertraege-Anker
    // waere fuer die der falsche Ort — die Position bringt jeden dorthin zurueck, wo er war.
    expect(HELFER).toContain("export function springeZuPosition(position: number)");
  });
});

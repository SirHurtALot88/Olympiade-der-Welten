/**
 * GEMELDET: „wenn ich einen spieler verkaufen will, springt der screen nicht zum verkaufsmodal,
 * das irritiert."
 *
 * Der Verkauf ist seit dem Strangler-Umbau eine eigene Drilldown-Seite und kein Overlay. Die Seite
 * tauscht also nur ihren Inhalt aus — die Scrollposition bleibt, wo sie war. Wer weit unten in der
 * Kaderliste auf „Verkaufen" tippt, landet weit unten in der neuen Ansicht und sieht den Dialog
 * überhaupt nicht.
 *
 * Der Kauf-Flow hatte genau dieses Problem schon einmal und räumt es seither selbst auf
 * (`scrollBuyModalToTop`). Dem Verkauf fehlte das Gegenstück ersatzlos — dieser Test hält fest,
 * dass beide Wege es jetzt tun.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

describe("Der Verkauf springt an den Anfang der Ansicht", () => {
  const scope = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
  /** Nur der Rumpf von `openMarketSellModal` — sonst prüft man fremde Scroll-Aufrufe mit. */
  const oeffnen = (() => {
    const start = scope.indexOf("async function openMarketSellModal(");
    expect(start).toBeGreaterThanOrEqual(0);
    const ende = scope.indexOf("function closeMarketSellModal(", start);
    expect(ende).toBeGreaterThan(start);
    return scope.slice(start, ende);
  })();

  it("scrollt beim Öffnen nach oben", () => {
    expect(oeffnen).toContain("window.scrollTo({ top: 0");
  });

  it("setzt auch die beiden Dokument-Scroller zurück", () => {
    // Je nach Ansicht scrollt mal <html>, mal <body> — der Kauf-Flow deckt beide ab,
    // und aus demselben Grund tut es der Verkauf hier auch.
    expect(oeffnen).toContain("document.documentElement.scrollTop = 0");
    expect(oeffnen).toContain("document.body.scrollTop = 0");
  });

  it("fasst `window` nur an, wenn es existiert", () => {
    // Der Scope läuft auch serverseitig durch — ein blanker window-Zugriff wäre ein
    // Renderfehler statt eines Sprungs.
    expect(oeffnen).toContain('typeof window !== "undefined"');
  });

  it("scrollt VOR dem URL-Sync, nicht danach", () => {
    // Sonst schiebt der History-Eintrag die Position wieder zurecht und der Sprung
    // wäre je nach Browser wirkungslos.
    expect(oeffnen.indexOf("window.scrollTo({ top: 0")).toBeLessThan(
      oeffnen.indexOf("syncFoundationViewInUrl"),
    );
  });

  it("lässt den Kauf-Flow unverändert seinen eigenen Weg gehen", () => {
    // Zwei Wege, aber kein doppelter: der Kauf scrollt im Client, der Verkauf im Scope.
    const client = quelle("app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx");
    expect(client).toContain("function scrollBuyModalToTop()");
  });
});

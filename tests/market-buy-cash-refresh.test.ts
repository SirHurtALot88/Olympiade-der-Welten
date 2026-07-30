/**
 * GEMELDET AUS DEM SPIEL (Franky, Transfermarkt):
 * „cash anzeige updated sich nicht nach kauf eines spielers"
 *
 * Der Kauf lud nur den SPIELSTAND neu (`loadSave`). Die Cash-Zahl im Transfermarkt kommt aber nicht
 * von dort, sondern aus `marketFeed.teamContext.teamCash` — und der Markt-Feed hängt an einem
 * eigenen Zähler (`marketReloadToken`), nicht am Spielstand. Nach einem Kauf ändert sich keine
 * seiner übrigen Abhängigkeiten (gleicher Save, gleiche Ansicht, gleiche Saison, gleiches Team),
 * also lief der Effekt nicht noch einmal und die Zahl blieb auf dem Stand VOR dem Kauf.
 *
 * Bitter dabei: die Erfolgsmeldung behauptete ausdrücklich „Cash, Gehalt, Kader und Marktfeed sind
 * neu geladen". Für den Marktfeed stimmte das nicht — die Meldung war die einzige Stelle, an der
 * der Widerspruch überhaupt sichtbar wurde.
 *
 * Geprüft wird am Quelltext: der Kauf-Abschluss liegt in einem Client-Host, dessen Effektkette
 * (Feed-Fetch → teamContext → Anzeige) sich ohne halbe Foundation-Shell nicht nachstellen lässt.
 * Das belegt nicht, dass die Zahl im Browser springt; es hält fest, dass der Anstoß da ist und
 * nicht wieder verschwindet.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const HOST = read("app/foundation/transfermarkt-v2/FoundationMarketV2ShellHost.tsx");
const SCOPE = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const FEED = read("lib/foundation/tabs/use-foundation-market-feed-actions.ts");
const CLIENT = read("app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx");

describe("Transfermarkt — Cash steht nach dem Kauf richtig", () => {
  /** DIE URSACHE, als Erwartung festgehalten: die Zahl kommt aus dem Feed, nicht aus dem Save. */
  it("die Cash-Zahl kommt aus dem Markt-Feed", () => {
    expect(CLIENT).toContain("const marketContext = marketFeed?.teamContext ?? null;");
    expect(CLIENT).toContain("marketContext?.teamCash");
  });

  /** Und der Feed haengt an seinem eigenen Zaehler — deshalb genuegt `loadSave` nicht. */
  it("der Feed laedt nur neu, wenn sein Zaehler sich bewegt", () => {
    expect(FEED).toContain("marketReloadToken");
  });

  it("der Kauf-Abschluss stoesst den Feed an", () => {
    const handler = HOST.slice(HOST.indexOf("onBuyCompleted:"), HOST.indexOf("onSell:"));
    expect(handler.length, "leerer Ausschnitt — die Marken passen nicht mehr").toBeGreaterThan(100);
    expect(handler).toContain("await loadSave(activeSaveId);");
    expect(handler).toContain("bumpMarketReloadToken();");
  });

  /**
   * Reihenfolge ist hier Absicht: erst den Spielstand holen, dann den Feed anstossen. Andersherum
   * koennte der Feed noch mit dem alten Save-Zustand antworten und die Zahl bliebe wieder stehen.
   */
  it("erst der Spielstand, dann der Feed", () => {
    const handler = HOST.slice(HOST.indexOf("onBuyCompleted:"), HOST.indexOf("onSell:"));
    expect(handler.indexOf("await loadSave(activeSaveId);")).toBeLessThan(handler.indexOf("bumpMarketReloadToken();"));
  });

  it("der Host bekommt den Anstoss von der Shell durchgereicht", () => {
    expect(HOST).toContain("bumpMarketReloadToken: () => void;");
    expect(SCOPE).toContain("bumpMarketReloadToken: () => setMarketReloadToken((current) => current + 1),");
  });
});

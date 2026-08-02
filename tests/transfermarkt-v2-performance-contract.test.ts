import fs from "node:fs";
import path from "node:path";
const readFileSync = fs.readFileSync;
const join = path.join;

import { describe, expect, it } from "vitest";

const transfermarktV2ClientPath = path.join(
  process.cwd(),
  "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx",
);
const transfermarktV2NewLookPath = path.join(
  process.cwd(),
  "app/foundation/transfermarkt-v2/TransfermarktV2NewLook.tsx",
);

// Neuer Look: TransfermarktV2Client.tsx is the data/logic wrapper; the markup lives
// in TransfermarktV2NewLook.tsx. Read both so a contract token is found wherever it now lives.
function readMarketSource() {
  return (
    fs.readFileSync(transfermarktV2ClientPath, "utf8") +
    "\n" +
    fs.readFileSync(transfermarktV2NewLookPath, "utf8")
  );
}

describe("transfermarkt v2 performance contract", () => {
  /**
   * UMGESCHRIEBEN. Dieser Test hat bis eben das GEMESSENE PROBLEM festgeschrieben: er verlangte
   * ausdrücklich `loadFullMarketInPages` und `while (hasMore)` — also die Seiten-Schleife, die
   * beim Öffnen des Marktes 13 Anfragen abgesetzt und die wachsende Liste siebenmal neu
   * veröffentlicht hat. Gemessen: 54–59 Sekunden, bis die Liste stand, und weil die Sortierung
   * über den ganzen Bestand läuft, sortierte sie sich bei jeder Veröffentlichung um. Ein Klick
   * auf eine Zeile traf danach eine andere.
   *
   * Die Zusage lautet jetzt anders — nicht „in kleinen Seiten", sondern „sofort bedienbar, dann
   * genau EIN Nachschlag":
   */
  it("zeigt die erste Seite sofort und holt den Rest in EINEM Zug nach", () => {
    const source = readMarketSource();

    expect(source).not.toContain("FULL_MARKET_LIMIT");
    expect(source).not.toContain("loadCompleteMarket");
    // Die alte Seiten-Schleife ist nicht mehr der Normalfall.
    expect(source).not.toContain("loadFullMarketInPages");
    expect(source).toContain("async function loadMarket()");
    // Erste Seite: unverändert 250, damit sie schnell da ist.
    expect(source).toContain("const MARKET_PAGE_LIMIT = 250");
    expect(source).toContain('hole({ limit: String(MARKET_PAGE_LIMIT), offset: "0" })');
    // Der Rest kommt in einer einzigen Antwort — der Server kann das, die Route reicht es jetzt durch.
    expect(source).toContain('hole({ fullPool: "true" })');
    // Genau zwei Veröffentlichungen: erste Seite, dann einmal vollständig.
    expect(source.match(/veroeffentliche\(/g)?.length).toBe(3); // 1× Definition + 2× Aufruf
  });

  it("sagt dem Spieler, dass die Reihenfolge noch vorläufig ist", () => {
    // Zwischen erster Seite und Nachschlag zeigt die Liste die Server-Reihenfolge, nicht die
    // gewählte Sortierung. Ohne Hinweis hält man die ersten 250 für „die Besten".
    const source = readMarketSource();
    expect(source).toContain("marketCompleting");
    expect(readFileSync(join(process.cwd(), "app/foundation/transfermarkt-v2/TransfermarktV2NewLook.tsx"), "utf8")).toContain(
      "Reihenfolge noch vorläufig",
    );
  });

  it("reicht fullPool nur mit Schutzkappen durch", () => {
    // Ohne Kappen wäre das ein offener Hahn: die Vollansicht je Spieler ist um ein Vielfaches
    // größer, und der Prisma-Referenzpfad deckelt ohnehin hart auf 250.
    const route = readFileSync(join(process.cwd(), "app/api/transfermarkt/free-agents/route.ts"), "utf8");
    expect(route).toContain('searchParams.get("fullPool") === "true" && compactList && source === "sqlite"');
  });

  it("renders all loaded visible candidates without a manual load-more gate", () => {
    const source = readMarketSource();

    expect(source).not.toContain("VISIBLE_CANDIDATE_RENDER_LIMIT");
    expect(source).not.toContain("Mehr laden");
    expect(source).not.toContain("loadNextMarketPage");
    expect(source).toContain("candidates={renderedVisibleItems}");
    /**
     * Kein wachsendes Render-Fenster mehr: es hat den Aufbau in eine Zitterpartie verwandelt
     * (Karten wurden bei jeder Umsortierung ab- und neu gemountet) und am Ende trotzdem alle
     * gerendert — gemessen 1887 Karten gleichzeitig im DOM, ein Klick auf „Bester Fit" kostete
     * rund 2 Sekunden.
     *
     * Stattdessen ein echtes Scroll-Fenster mit Platzhaltern. Gemessen danach: 25 Karten im DOM,
     * Umsortieren ~0,5 s. (`content-visibility: auto` war der erste Versuch und ist nachweislich
     * wirkungslos geblieben — 0 von 1533 Karten wurden übersprungen; deshalb wieder entfernt.)
     */
    expect(source).not.toContain("MARKET_RENDER_STEP");
    expect(source).not.toContain("renderedCandidateCount");
    expect(source).toContain("NL_CANDIDATE_ROW_HEIGHT");
    expect(source).toContain("sichtbaresFenster.map((item)");
    expect(source).toContain("onScroll={onCandidateListScroll}");
    // Die Auswahl muss im Fenster bleiben, sonst bricht die Tastaturnavigation ab.
    expect(source).toContain("auswahlIndex >= 0 && (auswahlIndex < fensterStart");
    expect(source).toContain("totalVisibleCount={visibleItems.length}");
    expect(source).toContain("${totalVisibleCount} sichtbar");
  });

  it("supports keyboard navigation through the visible candidate list", () => {
    const source = readMarketSource();

    expect(source).toContain("candidateButtonRefs");
    expect(source).toContain("handleNlSelectKeyDown");
    expect(source).toContain("onGlobalCandidateKeyDown");
    expect(source).toContain("ArrowDown");
    expect(source).toContain("ArrowUp");
    expect(source).toContain("Home");
    expect(source).toContain("End");
    expect(source).toContain("scrollIntoView({ block: \"nearest\" })");
  });

  it("keeps internal feed buckets out of the player-facing filter UI", () => {
    const source = readMarketSource();

    expect(source).not.toContain("bucketFilter");
    expect(source).not.toContain("setBucketFilter");
    expect(source).not.toContain(">Feed<");
    expect(source).not.toContain("Passt direkt");
    expect(source).not.toContain("Sofort bereit");
    expect(source).not.toContain("Meiste Upside");
    expect(source).toContain("Meistes Potenzial");
  });

  it("starts the player-facing market sorted by potential", () => {
    const source = readMarketSource();

    expect(source).toContain('useState<MarketSortMode>("potential")');
    expect(source).toContain('sortMode: "potential"');
    expect(source).toContain('potential: "Meistes Potenzial"');
  });

  it("shows class attribute tier display instead of legacy development route language", () => {
    const source = readMarketSource();

    expect(source).toContain("getAttributeTierClass");
    expect(source).toContain("buildTransfermarktScoutedAttributeRows");
    expect(source).toContain('aria-label="Attribut-Tiers"');
    expect(source).toContain('aria-label="Feinattribute"');
    expect(source).not.toContain("<span>Entwicklungspfad</span>");
    expect(source).not.toContain("Route {formatDevelopmentRouteLabel(selectedPlayer.developmentRoute)}");
    expect(source).not.toContain("Training {formatToneLabel(selectedPlayer.trainingFormTier)}");
  });

  it("shows discipline abbreviations and slot size next to top disciplines", () => {
    const source = readMarketSource();

    expect(source).toContain("getNlDisciplineAbbreviation");
    expect(source).toContain("entry.playerCount");
    expect(source).toContain("Top-Disziplinen (gescoutet)");
    expect(source).toContain("${entry.abbr} (${entry.playerCount})");
  });

  it("opens the player profile from a candidate name click", () => {
    const source = readMarketSource();

    expect(source).toContain("nl-market-candidate-name");
    expect(source).toContain("onOpenPlayerDetails({ playerId: item.playerId })");
  });
});

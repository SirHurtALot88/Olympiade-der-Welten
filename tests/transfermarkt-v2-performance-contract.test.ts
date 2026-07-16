import fs from "node:fs";
import path from "node:path";

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
  it("loads the full market automatically in small pages", () => {
    const source = readMarketSource();

    expect(source).not.toContain("FULL_MARKET_LIMIT");
    expect(source).not.toContain("loadCompleteMarket");
    expect(source).toContain("const MARKET_PAGE_LIMIT = 250");
    expect(source).toContain("limit: String(MARKET_PAGE_LIMIT)");
    expect(source).toContain("loadFullMarketInPages");
    expect(source).toContain("while (hasMore)");
    // The auto-load hint copy was dropped; pagination keeps going while the server
    // reports more pages (setMarketHasMore(hasMore)) — that is the small-page auto-load.
    expect(source).toContain("setMarketHasMore(hasMore)");
  });

  it("renders all loaded visible candidates without a manual load-more gate", () => {
    const source = readMarketSource();

    expect(source).not.toContain("VISIBLE_CANDIDATE_RENDER_LIMIT");
    expect(source).not.toContain("Mehr laden");
    expect(source).not.toContain("loadNextMarketPage");
    expect(source).toContain("candidates={renderedVisibleItems}");
    expect(source).toContain("candidates.map((item)");
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

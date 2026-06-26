import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const transfermarktV2ClientPath = path.join(
  process.cwd(),
  "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx",
);

describe("transfermarkt v2 performance contract", () => {
  it("loads the full market automatically in small pages", () => {
    const source = fs.readFileSync(transfermarktV2ClientPath, "utf8");

    expect(source).not.toContain("FULL_MARKET_LIMIT");
    expect(source).not.toContain("loadCompleteMarket");
    expect(source).toContain("const MARKET_PAGE_LIMIT = 250");
    expect(source).toContain("limit: String(MARKET_PAGE_LIMIT)");
    expect(source).toContain("loadFullMarketInPages");
    expect(source).toContain("while (hasMore)");
    expect(source).toContain("Weitere Kandidaten werden automatisch geladen.");
  });

  it("renders all loaded visible candidates without a manual load-more gate", () => {
    const source = fs.readFileSync(transfermarktV2ClientPath, "utf8");

    expect(source).not.toContain("VISIBLE_CANDIDATE_RENDER_LIMIT");
    expect(source).not.toContain("Mehr laden");
    expect(source).not.toContain("loadNextMarketPage");
    expect(source).toContain("renderedVisibleItems.map");
    expect(source).toContain("visibleItems.length} sichtbar");
  });

  it("supports keyboard navigation through the visible candidate list", () => {
    const source = fs.readFileSync(transfermarktV2ClientPath, "utf8");

    expect(source).toContain("candidateButtonRefs");
    expect(source).toContain("handleCandidateKeyDown");
    expect(source).toContain("onGlobalCandidateKeyDown");
    expect(source).toContain("ArrowDown");
    expect(source).toContain("ArrowUp");
    expect(source).toContain("Home");
    expect(source).toContain("End");
    expect(source).toContain("scrollIntoView({ block: \"nearest\" })");
  });

  it("keeps internal feed buckets out of the player-facing filter UI", () => {
    const source = fs.readFileSync(transfermarktV2ClientPath, "utf8");

    expect(source).not.toContain("bucketFilter");
    expect(source).not.toContain("setBucketFilter");
    expect(source).not.toContain(">Feed<");
    expect(source).not.toContain("Passt direkt");
    expect(source).not.toContain("Sofort bereit");
    expect(source).not.toContain("Meiste Upside");
    expect(source).toContain("Meistes Potenzial");
  });

  it("starts the player-facing market sorted by potential", () => {
    const source = fs.readFileSync(transfermarktV2ClientPath, "utf8");

    expect(source).toContain('useState<MarketSortMode>("potential")');
    expect(source).toContain('<option value="potential">Meistes Potenzial</option>');
  });

  it("shows class attribute training impact instead of legacy development route language", () => {
    const source = fs.readFileSync(transfermarktV2ClientPath, "utf8");

    expect(source).toContain("Attribut-Wirkung");
    expect(source).toContain("getClassTrainingImpact");
    expect(source).toContain("TRAINING_ATTRIBUTE_LABELS");
    expect(source).not.toContain("<span>Entwicklungspfad</span>");
    expect(source).not.toContain("Route {formatDevelopmentRouteLabel(selectedPlayer.developmentRoute)}");
    expect(source).not.toContain("Training {formatToneLabel(selectedPlayer.trainingFormTier)}");
  });

  it("shows team rank and slot size next to top disciplines", () => {
    const source = fs.readFileSync(transfermarktV2ClientPath, "utf8");

    expect(source).toContain("formatDisciplineContextLabel");
    expect(source).toContain("entry.teamRank");
    expect(source).toContain("entry.playerCount");
    expect(source).toContain("Teamrank");
    expect(source).toContain("Slots");
  });

  it("opens the player drawer from a candidate card double click", () => {
    const source = fs.readFileSync(transfermarktV2ClientPath, "utf8");

    expect(source).toContain("onDoubleClick={() => onOpenPlayerDetails?.({ playerId: item.playerId })}");
  });
});

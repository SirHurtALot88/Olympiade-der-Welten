import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";
const foundationViewRoutingPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/foundation-view-routing.ts";
const transfermarktV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx";
const lineupPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx";
const teamDrawerPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/TeamDetailDrawer.tsx";
const fitServicePath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/market/transfermarkt-fit.ts";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";

describe("foundation transfermarkt ui contract", () => {
  it("keeps the global foundation context visible", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(foundationClientPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain('data-testid="foundation-context-banner"');
    expect(fileText).toContain("buildContextStatusChips");
    expect(fileText).toContain("buildViewContextWarning");
    expect(cssText).toContain(".foundation-context-banner");
    expect(cssText).toContain(".foundation-context-warning");
  });

  it("opens Transfermarkt V2 as the primary market flow", async () => {
    const [fileText, routingText] = await Promise.all([
      fs.readFile(foundationClientPath, "utf8"),
      fs.readFile(foundationViewRoutingPath, "utf8"),
    ]);

    expect(routingText).toContain('view === "transfermarkt-v2" || view === "transfermarkt" || view === "market"');
    expect(routingText).toContain('return "marketV2"');
    expect(fileText).toContain("normalizeFoundationViewParam");
    expect(fileText).toContain("getDefaultFoundationViewTarget(view as FoundationViewId)");
    expect(fileText).toContain('setFoundationView("marketV2", setActiveView)');
  });

  it("keeps Transfermarkt V2 centered on scouting, deal preview and own roster context", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(transfermarktV2Path, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("Markt-Pool");
    expect(fileText).toContain("Scouting-Profil");
    expect(fileText).toContain("Deal-Desk");
    expect(fileText).toContain("Deal-Vorschau");
    expect(fileText).toContain("Aktueller Kader");
    expect(fileText).toContain("Wishlist & Bedarf");
    expect(fileText).toContain("Deal prüfen");
    expect(fileText).toContain("Auf Wishlist");
    expect(fileText).toContain("Beobachten");
    expect(fileText).toContain("market-v2-star-row");
    expect(fileText).toContain("axisStarsDisplay");
    expect(fileText).toContain("onToggleScoutingWatch");
    expect(fileText).toContain("market-v2-scout-certainty");
    expect(cssText).toContain(".market-v2-scout-certainty-bar");
    expect(fileText).toContain("scoutingProfileTooltip");
    expect(fileText).toContain("title={scoutingProfileTooltip}");
    expect(fileText).toContain("Scouting L");
    expect(fileText).toContain("marketValueBrackets");
    expect(fileText).toContain("Board-Fokus");
    expect(fileText).toContain("Kaufdialog");
    expect(fileText).toContain("Kauf final abschließen");
    expect(fileText).toContain("Warum der Deal so ausfällt");
    expect(fileText).toContain("getCandidateFrameStyle");
  });

  it("keeps Transfermarkt V2 filters for market value and salary pressure", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(transfermarktV2Path, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("Max MW");
    expect(fileText).toContain("Max Gehalt");
    expect(fileText).toContain("Min Ratio");
    expect(fileText).toContain("setMaxSalary");
    expect(fileText).toContain("setMaxRatio");
    expect(fileText).toContain("effectiveMaxSalary");
    expect(fileText).toContain("effectiveMinRatio");
    expect(cssText).toContain(".market-v2-range-row .secondary-button");
  });

  it("persists Transfermarkt V2 filters and named presets locally", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(transfermarktV2Path, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("MARKET_FILTER_STORAGE_PREFIX");
    expect(fileText).toContain("readMarketFilterStorage");
    expect(fileText).toContain("writeMarketFilterStorage");
    expect(fileText).toContain("saveCurrentFilterPreset");
    expect(fileText).toContain("loadFilterPreset");
    expect(fileText).toContain("Filter speichern");
    expect(fileText).toContain("Keine gespeicherten Filter");
    expect(fileText).toContain("HIDDEN_RACE_FILTER_VALUES");
    expect(cssText).toContain(".market-v2-filter-presets");
    expect(cssText).toContain(".market-v2-filter-preset-chip");
  });

  it("shows five colored discipline fit rows in Transfermarkt V2", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(transfermarktV2Path, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("getDisciplineCategoryClass");
    expect(fileText).toContain("topDisciplineScores.slice(0, 5)");
    expect(cssText).toContain(".market-v2-diszi-row.is-power");
    expect(cssText).toContain(".market-v2-diszi-row.is-speed");
    expect(cssText).toContain(".market-v2-diszi-row.is-mental");
    expect(cssText).toContain(".market-v2-diszi-row.is-social");
    expect(cssText).toContain(".market-v2-disclosure-grid");
  });

  it("shows Transfermarkt V2 training affinities with drawer-style markers", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(transfermarktV2Path, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("market-v2-inline-training");
    expect(fileText).toContain("market-v2-training-affinity-grid");
    expect(fileText).toContain("market-v2-training-affinity-chip is-signature");
    expect(fileText).toContain("market-v2-training-affinity-chip is-weak");
    expect(cssText).toContain(".market-v2-training-affinity-chip.is-signature");
    expect(cssText).toContain(".market-v2-training-affinity-chip.is-weak");
  });

  it("keeps the Transfermarkt V2 deal desk as an immediate impact preview", async () => {
    const fileText = await fs.readFile(transfermarktV2Path, "utf8");

    expect(fileText).toContain("previewPurchasePrice");
    expect(fileText).toContain("previewCashBefore");
    expect(fileText).toContain("previewCashAfter");
    expect(fileText).toContain("previewTeamSalaryBefore");
    expect(fileText).toContain("previewRosterAfter");
    expect(fileText).toContain("<span>Ablöse</span>");
    expect(fileText).toContain("<span>Bedarf / Fit</span>");
    expect(fileText).toContain("Potenzial vs MW");
    expect(fileText).toContain("mehr Luft als aktueller MW");
    expect(fileText).toContain("eher schon teuer bezahlt");
    expect(fileText).toContain("Board-Fokus");
    expect(fileText).toContain("selectedPlayerWishlisted");
    expect(fileText).not.toContain("Happy / Trust / Push");
    expect(fileText).not.toContain("Final im Dialog");
    expect(fileText).not.toContain('className="market-v2-buy-controls"');
  });

  it("lets local Chris/manual teams stay manageable in quick market views", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain("localUserManualTeams");
    expect(fileText).toContain("settings.ownerSlot === \"user\"");
    expect(fileText).toContain("settings.displayLabel === \"Chris\"");
    expect(fileText).toContain("manageableTeamIds={ownerQuickSwitchTeams.map((team) => team.teamId)}");
    expect(fileText).toContain("targetControl?.ownerSlot === \"user\"");
    expect(fileText).toContain("activeOwnerId: resolvedOwnerId");
  });

  it("keeps scouting values intentionally fuzzy instead of exposing exact hidden truths", async () => {
    const marketText = await fs.readFile(transfermarktV2Path, "utf8");

    expect(marketText).toContain("getScoutReliabilityCopy");
    expect(marketText).toContain("getScoutingTierWindow");
    expect(marketText).toContain("getScoutedTopDisciplineHeadline");
    expect(marketText).toContain("getScoutedDisciplineLine");
  });

  it("documents that local team fit can still go negative for bad profile matches", async () => {
    const fileText = await fs.readFile(fitServicePath, "utf8");

    expect(fileText).toContain("scorePresenceToken");
    expect(fileText).toContain("scorePresenceArray");
    expect(fileText).toContain("scorePresenceToken(raceKey, tokenCounts.races, -2)");
    expect(fileText).toContain("scorePresenceArray(traitKeys, tokenCounts.traits, -1)");
  });

  it("keeps the team drawer relationship cards alive", async () => {
    const [clientText, drawerText, cssText] = await Promise.all([
      fs.readFile(foundationClientPath, "utf8"),
      fs.readFile(teamDrawerPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(clientText).toContain("buildTeamRelationshipCards");
    expect(clientText).toContain("relationships: drawerRelationships");
    expect(drawerText).toContain("relationships:");
    expect(drawerText).toContain("formatRelationshipList");
    expect(cssText).toContain(".team-drawer-relationship-chip");
  });

  it("keeps Transfermarkt V2 buy dialog negotiation affordances", async () => {
    const [fileText, foundationText] = await Promise.all([
      fs.readFile(transfermarktV2Path, "utf8"),
      fs.readFile(foundationClientPath, "utf8"),
    ]);

    expect(fileText).toContain("Kaufdialog");
    expect(fileText).toContain("resetBuyDemandFrame");
    expect(fileText).toContain("Spieler ist noch angefressen");
    expect(fileText).toContain('buyNegotiationOutcome?.status !== "accepted"');
    expect(fileText).toContain('persistNegotiationOutcome(buyPreview, "countered")');
    expect(foundationText).toContain("toggleScoutingWatch");
    expect(foundationText).toContain("onToggleScoutingWatch");
    expect(foundationText).toContain("openMarketOfferPanel");
  });

  it("keeps the lineup coach wording tied to the new candidate quality flow", async () => {
    const [lineupText, cssText] = await Promise.all([
      fs.readFile(lineupPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(lineupText).toContain("Passt sofort");
    expect(lineupText).toContain("Gute Alternative");
    expect(lineupText).toContain("Riskant wegen Fatigue");
    expect(lineupText).toContain("Blockiert / schon eingesetzt");
    expect(lineupText).toContain("Nur Notfall");
    expect(lineupText).toContain("Hier weiter");
    expect(lineupText).toContain("Lineup bereit speichern");
    expect(lineupText).toContain("Captains offen");
    expect(cssText).toContain(".legacy-lineup-slot-conflict-chip");
    expect(cssText).toContain(".legacy-lineup-side-issue-chip");
    expect(cssText).toContain(".legacy-matchday-player-score-chip.is-quality-instant");
  });

  it("separates market loading from empty filter state", async () => {
    const fileText = await fs.readFile(transfermarktV2Path, "utf8");

    expect(fileText).toContain("bootstrapReady");
    expect(fileText).toContain("marketBusy && visibleItems.length === 0");
    expect(fileText).toContain("market-v2-candidate-skeleton");
    expect(fileText).toContain("!marketBusy && visibleItems.length === 0");
    expect(fileText).toContain('defaultSeasonId === "loading"');
  });

  it("blocks market buy for teams the active owner cannot manage", async () => {
    const [foundationText, v2Text] = await Promise.all([
      fs.readFile(foundationClientPath, "utf8"),
      fs.readFile(transfermarktV2Path, "utf8"),
    ]);

    expect(foundationText).toContain("openMarketBuyModal");
    expect(foundationText).toContain("!canManageTeamId(effectiveTeamId)");
    expect(v2Text).toContain("manageableTeamIdSet");
    expect(v2Text).toContain("steuerbaren Teams");
  });

  it("shows negotiation abort feedback when closing buy offer pages", async () => {
    const v2Text = await fs.readFile(transfermarktV2Path, "utf8");

    expect(v2Text).toContain("Kauf von ${playerName} abgebrochen");
    expect(v2Text).toContain("data-testid=\"transfer-offer-page\"");
  });
});

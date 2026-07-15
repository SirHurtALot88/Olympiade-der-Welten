import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource, readFoundationSurfaceSource } from "./foundation-orchestrator-source";

const root = process.cwd();
const foundationClientPath = path.join(root, "app/foundation/FoundationPageClient.tsx");
const foundationShellRouterBodyPath = path.join(root, "app/foundation/FoundationShellRouterBody.tsx");

async function readFoundationSurfaceSourceLocal() {
  return readFoundationSurfaceSource(root);
}
const foundationPageModuleHelpersPath = path.join(root, "lib/foundation/tabs/foundation-page-module-helpers.tsx");
const foundationViewRoutingPath = path.join(root, "lib/foundation/foundation-view-routing.ts");
const transfermarktV2Path = path.join(root, "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx");
const transfermarktV2NewLookPath = path.join(root, "app/foundation/transfermarkt-v2/TransfermarktV2NewLook.tsx");

// Neuer Look: TransfermarktV2Client.tsx is the data/logic wrapper; the markup lives in
// TransfermarktV2NewLook.tsx. Read both concatenated so a contract token is found wherever it
// now lives (logic in the client, markup in the NewLook).
async function readTransfermarktV2Source() {
  const [clientText, newLookText] = await Promise.all([
    fs.readFile(transfermarktV2Path, "utf8"),
    fs.readFile(transfermarktV2NewLookPath, "utf8"),
  ]);
  return `${clientText}\n${newLookText}`;
}
const marketBuyHostPath = path.join(root, "app/foundation/transfermarkt-v2/FoundationMarketBuyShellHost.tsx");
const lineupPath = path.join(root, "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx");
const teamDrawerPath = path.join(root, "app/foundation/TeamDetailDrawer.tsx");
const teamsRosterHookPath = path.join(root, "lib/foundation/tabs/use-foundation-cross-tab-teams-roster.ts");
const fitServicePath = path.join(root, "lib/market/transfermarkt-fit.ts");
const globalsPath = path.join(root, "app/globals.css");

describe("foundation transfermarkt ui contract", () => {
  it("keeps the global foundation context visible", async () => {
    const [fileText, cssText] = await Promise.all([
      readFoundationSurfaceSourceLocal(),
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
      readFoundationOrchestratorSource(root),
      fs.readFile(foundationViewRoutingPath, "utf8"),
    ]);

    expect(routingText).toContain('view === "transfermarkt-v2" || view === "transfermarkt" || view === "market"');
    expect(routingText).toContain('return "marketV2"');
    expect(fileText).toContain("normalizeFoundationViewParam");
    const moduleHelpersText = await fs.readFile(foundationPageModuleHelpersPath, "utf8");
    expect(moduleHelpersText).toContain("getDefaultFoundationViewTarget(view as FoundationViewId)");
    expect(fileText).toContain('setFoundationView("marketV2", setActiveView)');
  });

  it("keeps Transfermarkt V2 centered on scouting, deal preview and own roster context", async () => {
    const [fileText, buyHostText, cssText] = await Promise.all([
      readTransfermarktV2Source(),
      fs.readFile(marketBuyHostPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("Markt-Pool");
    expect(fileText).toContain("Scouting-Profil");
    expect(fileText).toContain("Deal-Desk");
    expect(fileText).toContain("Deal-Vorschau");
    expect(fileText).toContain("Aktueller Kader");
    expect(fileText).toContain("Wishlist & Scouting");
    expect(fileText).toContain("Deal prüfen");
    expect(fileText).toContain("Auf Wishlist");
    expect(fileText).toContain("Beobachten");
    expect(fileText).toContain("nl-market-ca-stars");
    expect(fileText).toContain("axisStarsDisplay");
    expect(fileText).toContain("onToggleScoutingWatch");
    expect(fileText).toContain("selectedPlayerScoutCertainty");
    expect(cssText).toContain(".market-v2-scout-certainty-bar");
    expect(fileText).toContain("nl-market-focus-card");
    expect(fileText).toContain("scoutingLevel");
    expect(fileText).toContain("filterTransfermarktFreeAgentsByBracket");
    expect(fileText).toContain("poolBracketPanel");
    expect(fileText).toContain("setPoolBracketPanel");
    expect(fileText).toContain("nl-market-board");
    expect(fileText).toContain('data-testid="transfer-deal-open-button"');
    expect(buyHostText).toContain("Kauf final abschließen");
    expect(buyHostText).toContain("Warum der Deal so ausfällt");
    expect(fileText).toContain("getTransfermarktPortraitModel");
  });

  it("keeps Transfermarkt V2 filters for market value and salary pressure", async () => {
    const [fileText, cssText] = await Promise.all([
      readTransfermarktV2Source(),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("nl-market-ratio-chips");
    expect(fileText).toContain("MW ÷ Gehalt ≥");
    expect(fileText).toContain("minRatioFilter");
    expect(fileText).toContain("setMaxSalary");
    expect(fileText).toContain("setMaxRatio");
    expect(fileText).toContain("effectiveMaxSalary");
    expect(fileText).toContain("effectiveMinRatio");
    expect(cssText).toContain(".market-v2-range-row .secondary-button");
  });

  it("persists Transfermarkt V2 filters and named presets locally", async () => {
    const [fileText, cssText] = await Promise.all([
      readTransfermarktV2Source(),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("MARKET_FILTER_STORAGE_PREFIX");
    expect(fileText).toContain("readMarketFilterStorage");
    expect(fileText).toContain("writeMarketFilterStorage");
    expect(fileText).toContain("MarketFilterPreset");
    expect(fileText).toContain("setFilterPresets");
    expect(fileText).toContain("filterPresetMessage");
    expect(fileText).toContain("writeMarketFilterStorage(defaultSaveId, currentFilterSnapshot, filterPresets)");
    expect(fileText).toContain("HIDDEN_RACE_FILTER_VALUES");
    expect(cssText).toContain(".market-v2-filter-presets");
    expect(cssText).toContain(".market-v2-filter-preset-chip");
  });

  it("shows colored discipline fit rows in Transfermarkt V2", async () => {
    const [fileText, cssText] = await Promise.all([
      readTransfermarktV2Source(),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("NL_AXIS_DISCIPLINE_CATEGORY");
    expect(fileText).toContain("nlToneClass");
    expect(fileText).toContain("topDisciplineScores.slice(0, 5)");
    expect(cssText).toContain(".market-v2-diszi-row.is-power");
    expect(cssText).toContain(".market-v2-diszi-row.is-speed");
    expect(cssText).toContain(".market-v2-diszi-row.is-mental");
    expect(cssText).toContain(".market-v2-diszi-row.is-social");
    expect(cssText).toContain(".market-v2-disclosure-grid");
  });

  it("shows Transfermarkt V2 talent and attribute-tier markers on the candidate profile", async () => {
    const [fileText, cssText] = await Promise.all([
      readTransfermarktV2Source(),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("nl-market-talent-row");
    expect(fileText).toContain('label="Talent"');
    expect(fileText).toContain("getAttributeTierClass");
    expect(fileText).toContain("NlAbilityStars");
    expect(cssText).toContain(".market-v2-training-affinity-chip.is-signature");
    expect(cssText).toContain(".market-v2-training-affinity-chip.is-weak");
  });

  it("keeps the Transfermarkt V2 deal desk as an immediate impact preview", async () => {
    const fileText = await readTransfermarktV2Source();

    expect(fileText).toContain("previewPurchasePrice");
    expect(fileText).toContain("previewCashBefore");
    expect(fileText).toContain("previewCashAfter");
    expect(fileText).toContain("previewTeamSalaryBefore");
    expect(fileText).toContain("previewRosterAfter");
    expect(fileText).toContain('label="Ablöse"');
    expect(fileText).toContain("nl-market-deal-topline");
    expect(fileText).toContain("NlMarketBeforeAfterRow");
    expect(fileText).toContain("nl-market-need-tag");
    expect(fileText).toContain("nl-market-impact-summary");
    expect(fileText).toContain("nl-market-board");
    expect(fileText).toContain("selectedPlayerWishlisted");
    expect(fileText).not.toContain("Happy / Trust / Push");
    expect(fileText).not.toContain("Final im Dialog");
    expect(fileText).not.toContain('className="market-v2-buy-controls"');
  });

  it("lets local Chris/manual teams stay manageable in quick market views", async () => {
    const fileText = await readFoundationOrchestratorSource(root);
    const teamControlHookText = await fs.readFile(
      path.join(root, "lib/foundation/tabs/use-foundation-cross-tab-team-control.ts"),
      "utf8",
    );

    expect(teamControlHookText).toContain("localUserManualTeams");
    expect(fileText).toContain("settings.ownerSlot === \"user\"");
    expect(fileText).toContain("settings.displayLabel === \"Chris\"");
    expect(fileText).toContain("FoundationTransfermarktV2Panel");
    expect(fileText).toContain("manageableTeamIds: foundationManageableTeamIds");
    expect(fileText).toContain("targetControl?.ownerSlot === \"user\"");
    expect(fileText).toContain("activeOwnerId: resolvedOwnerId");
  });

  it("keeps scouting values intentionally fuzzy instead of exposing exact hidden truths", async () => {
    const marketText = await readTransfermarktV2Source();

    expect(marketText).toContain("getScoutingTierWindow");
    expect(marketText).toContain("resolveScoutingConfidenceFromLevel");
    expect(marketText).toContain("isScoutedImpactExact");
    expect(marketText).toContain("formatScoutedImpactDelta");
  });

  it("documents that local team fit can still go negative for bad profile matches", async () => {
    const fileText = await fs.readFile(fitServicePath, "utf8");

    expect(fileText).toContain("scorePresenceToken");
    expect(fileText).toContain("scorePresenceArray");
    expect(fileText).toContain("scorePresenceToken(raceKey, tokenCounts.races, -2)");
    expect(fileText).toContain("scorePresenceArray(traitKeys, tokenCounts.traits, -1)");
  });

  it("uses compact full-art portrait cards in the candidate rail and table hover previews", async () => {
    const [fileText, cssText] = await Promise.all([
      readTransfermarktV2Source(),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain("getTransfermarktPortraitModel");
    expect(fileText).toContain("playerRatingsById");
    expect(fileText).toContain("nl-market-candidate-portrait");
    expect(fileText).toContain("caScore={item.ovr}");
    expect(fileText).toContain("NlAbilityStars");
    expect(fileText).toContain('data-testid="transfer-candidate-card"');
    expect(fileText).toContain("OptimizedMediaImage");
    expect(fileText).toContain("nl-market-wishlist-chip");
    expect(fileText).toContain("nl-market-roster-list");
    expect(cssText).toContain(".foundation-player-portrait-preview-panel");
  });

  it("keeps the team drawer relationship cards alive", async () => {
    const [clientText, teamsRosterHookText, drawerText, cssText] = await Promise.all([
      readFoundationOrchestratorSource(root),
      fs.readFile(teamsRosterHookPath, "utf8"),
      fs.readFile(teamDrawerPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(clientText).toContain("buildTeamDetailDrawerData");
    expect(teamsRosterHookText).toContain("buildTeamRelationshipCards");
    expect(teamsRosterHookText).toContain("relationships: drawerRelationships");
    expect(drawerText).toContain("relationships:");
    expect(drawerText).toContain("formatRelationshipList");
    expect(cssText).toContain(".team-drawer-relationship-chip");
  });

  it("keeps Transfermarkt V2 buy dialog negotiation affordances", async () => {
    const [fileText, buyHostText, foundationText, marketHostText] = await Promise.all([
      readTransfermarktV2Source(),
      fs.readFile(marketBuyHostPath, "utf8"),
      readFoundationOrchestratorSource(root),
      fs.readFile(path.join(root, "app/foundation/transfermarkt-v2/FoundationMarketV2ShellHost.tsx"), "utf8"),
    ]);

    expect(fileText).toContain('data-testid="transfer-deal-open-button"');
    expect(fileText).toContain("resetBuyDemandFrame");
    expect(buyHostText).toContain("Spieler ist noch angefressen");
    expect(buyHostText).toContain('buyNegotiationOutcome?.status !== "accepted"');
    expect(fileText).toContain('persistNegotiationOutcome(buyPreview, "countered")');
    expect(foundationText).toContain("toggleScoutingWatch");
    expect(marketHostText).toContain("onToggleScoutingWatch");
    expect(foundationText).toContain("openMarketOfferPanel");
    expect(fileText).toContain("FoundationShellRouterMarketBuy");
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
    const fileText = await readTransfermarktV2Source();

    expect(fileText).toContain("bootstrapReady");
    expect(fileText).toContain("marketBusy && candidates.length === 0");
    expect(fileText).toContain("nl-market-loading-skeletons");
    expect(fileText).toContain("!marketBusy && !marketError && candidates.length === 0");
    expect(fileText).toContain('defaultSeasonId === "loading"');
  });

  it("blocks market buy for teams the active owner cannot manage", async () => {
    const [foundationText, v2Text] = await Promise.all([
      readFoundationOrchestratorSource(root),
      readTransfermarktV2Source(),
    ]);

    expect(foundationText).toContain("openMarketBuyModal");
    expect(foundationText).toContain("!canManageTeamId(effectiveTeamId)");
    expect(v2Text).toContain("manageableTeamIdSet");
    expect(v2Text).toContain("steuerbaren Teams");
  });

  it("shows negotiation abort feedback when closing buy offer pages", async () => {
    const [v2Text, buyHostText] = await Promise.all([
      readTransfermarktV2Source(),
      fs.readFile(marketBuyHostPath, "utf8"),
    ]);

    expect(v2Text).toContain("Kauf von ${playerName} abgebrochen");
    expect(v2Text).toContain("Verhandlung mit ${playerName} abgebrochen");
    expect(buyHostText).toContain("data-testid=\"transfer-offer-page\"");
    expect(v2Text).toContain("FoundationShellRouterMarketBuy");
  });

  it("loads buy preview skeleton and two-step confirm flow in Transfermarkt V2", async () => {
    const [v2Text, buyHostText, cssText] = await Promise.all([
      readTransfermarktV2Source(),
      fs.readFile(marketBuyHostPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(buyHostText).toContain("data-testid=\"transfer-buy-preview-skeleton\"");
    expect(buyHostText).toContain("data-testid=\"transfer-buy-confirm-button\"");
    expect(buyHostText).toContain("Kauf final abschließen");
    expect(buyHostText).toContain("buyNegotiationOutcome?.status !== \"accepted\"");
    expect(v2Text).toContain("negotiation_cancelled_after_contact");
    expect(buyHostText).toContain("Spieler ist noch angefressen");
    expect(v2Text).toContain("allSeasons: \"1\"");
    expect(v2Text).toContain("nl-market-history-card");
    expect(v2Text).toContain("(alle Seasons)");
    expect(cssText).toContain(".transfer-buy-preview-skeleton");
  });

  it("exposes sprint L mobile preview sheet, candidate chips, contract control, rejection meter, and Auto labels", async () => {
    const [v2Text, sellHostText, drawerText, teamsPanelText, cssText] = await Promise.all([
      readTransfermarktV2Source(),
      fs.readFile(path.join(root, "app/foundation/transfermarkt-v2/FoundationMarketSellShellHost.tsx"), "utf8"),
      fs.readFile(teamDrawerPath, "utf8"),
      fs.readFile(path.join(root, "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx"), "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(v2Text).toContain("nl-market-candidate-signals");
    expect(v2Text).toContain("nl-market-signal-chip");
    expect(v2Text).toContain('data-testid="market-v2-contract-segmented"');
    expect(v2Text).toContain("previewCashBefore");
    expect(v2Text).toContain("previewCashAfter");
    expect(sellHostText).toContain("Auto-Empfehlung");
    expect(sellHostText).not.toContain("AI-Empfehlung");

    expect(drawerText).toContain('data-testid="team-drawer-tabs"');
    expect(drawerText).toContain('data-testid="team-drawer-transfer-tab"');
    expect(drawerText).toContain('data-testid="team-drawer-duel-card"');
    expect(teamsPanelText).toContain('data-testid="teams-v2-transfer-tab"');
    expect(teamsPanelText).toContain("teams-v2-name-cell is-sticky-actions");
    expect(teamsPanelText).toContain("table-icon-button");

    expect(cssText).toContain(".market-v2-mobile-preview-sheet");
    expect(cssText).toContain(".market-v2-rejection-meter");
  });
});

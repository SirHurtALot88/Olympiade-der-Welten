import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const foundationClientPath = path.join(root, "app/foundation/FoundationPageClient.tsx");
const shellRouterBodyPath = path.join(root, "app/foundation/FoundationShellRouterBody.tsx");
const shellScopePath = path.join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const shellRouterPath = path.join(root, "app/foundation/FoundationShellRouter.tsx");
const managerOfficePath = path.join(root, "app/foundation/home-v2/ManagerOfficeClient.tsx");
const foundationPageTypesPath = path.join(root, "lib/foundation/tabs/foundation-page-types.ts");
const moduleHelpersPath = path.join(root, "lib/foundation/tabs/foundation-page-module-helpers.tsx");
const homeV2Path = path.join(root, "app/foundation/home-v2/HomeV2Client.tsx");
const navConfigPath = path.join(root, "lib/foundation/foundation-nav-config.ts");
const viewRoutingPath = path.join(root, "lib/foundation/foundation-view-routing.ts");
const facilitiesOverviewV2Path = path.join(root, "app/foundation/facilities-overview-v2/FacilitiesOverviewV2Client.tsx");
const scoutingHubV2Path = path.join(root, "app/foundation/scouting-center-v2/ScoutingCenterV2Client.tsx");
const inboxV2Path = path.join(root, "app/foundation/inbox-v2/InboxV2Client.tsx");
const globalsPath = path.join(root, "app/globals.css");

describe("foundation home v2 ui contract", () => {
  it("merges home and office into one home v2 view with sub navigation", async () => {
    const [shellText, navText, routingText, panelText, officeText, hostText] = await Promise.all([
      fs.readFile(shellRouterBodyPath, "utf8"),
      fs.readFile(navConfigPath, "utf8"),
      fs.readFile(viewRoutingPath, "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/home-v2/FoundationHomeV2Panel.tsx"), "utf8"),
      fs.readFile(managerOfficePath, "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/home-v2/FoundationHomeV2Host.tsx"), "utf8"),
    ]);

    expect(shellText).toContain("FoundationSubNav");
    expect(panelText).toContain('tab === "overview"');
    expect(shellText).toContain("homeV2Tab");
    expect(shellText).toContain("FoundationShellRouterHomeV2");
    expect(panelText).toContain('if (!active)');
    expect(panelText).toContain('id="foundation-home-v2"');
    expect(panelText).toContain("ManagerOfficeClient");
    expect(officeText).toContain('data-testid="foundation-hq"');
    expect(shellText).not.toContain('getViewClass("hq")');
    expect(navText).not.toContain('id: "hq"');
    expect(routingText).toContain('if (view === "hq") return "homeV2"');
    expect(shellText).not.toContain("FoundationHomeV2Panel");
    expect(hostText).toContain("onOpenOffice");
  });

  it("keeps the Velo-inspired dashboard focused on top players, KPIs and flow actions", async () => {
    const fileText = await fs.readFile(homeV2Path, "utf8");

    expect(fileText).toContain("Top 6 Spieler");
    expect(fileText).toContain("HOME_V2_TOP_PLAYER_COUNT");
    expect(fileText).toContain("home-v2-player-grid");
    expect(fileText).toContain("home-v2-hero-stats");
    expect(fileText).toContain("home-v2-signal-strip");
    expect(fileText).not.toContain("home-v2-quick-nav");
    expect(fileText).toContain("onContinue");
    expect(fileText).toContain("onOpenBoardObjectives");
    expect(fileText).toContain("home-v2-objective-card");
    expect(fileText).toContain("home-v2-development-panel");
    expect(fileText).not.toContain("Manager Overview V2");
    expect(fileText).not.toContain("HQ öffnen");
    expect(fileText).toContain("FoundationGameDecisionBoard");
    expect(fileText).toContain('testId="home-v2-today-board"');
    expect(fileText).toContain("Gebäude");
    expect(fileText).toContain("Entscheidungen");
    expect(fileText).toContain('data-testid="foundation-home-v2"');
  });

  it("shows core axis stats and absolute CA/PO range on top player cards", async () => {
    const [homeText, typesText, hostText, scopeText, overviewDerivationsText] = await Promise.all([
      fs.readFile(homeV2Path, "utf8"),
      fs.readFile(
        path.join(process.cwd(), "app/foundation/home-v2/home-v2-types.ts"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "app/foundation/home-v2/FoundationHomeV2Host.tsx"), "utf8"),
      fs.readFile(shellScopePath, "utf8"),
      fs.readFile(path.join(process.cwd(), "lib/foundation/tabs/use-home-v2-overview-derivations.ts"), "utf8"),
    ]);

    expect(homeText).toContain("FoundationPlayerPortraitCard");
    expect(homeText).toContain("leagueHeatPools");
    expect(homeText).toContain("is-rank-gold");
    expect(homeText).toContain("is-rank-silver");
    expect(homeText).toContain("is-rank-bronze");
    expect(homeText).not.toContain("VeloStarRating");
    expect(hostText).toContain("leagueHeatPools: leaguePlayerHeatPools");
    expect(scopeText).toContain('activeView !== "homeV2"');
    expect(typesText).toContain("leagueHeatPools");
    expect(typesText).toContain("caRating");
    expect(typesText).toContain("poRangeMin");
    expect(typesText).toContain("poRangeMax");
    expect(typesText).toContain("rosterRank");
    expect(typesText).toContain("pow:");
    expect(overviewDerivationsText).toContain("buildPlayerDevelopmentInsight");
    expect(overviewDerivationsText).toContain("buildPlayerProgressionForecast");
    expect(overviewDerivationsText).toContain("potentialRangeDisplay");
    expect(typesText).toContain("HOME_V2_TOP_PLAYER_COUNT");
    expect(overviewDerivationsText).toContain("homePlayerCards.slice(0, 6)");
  });

  it("keeps HQ hero lean with captain picker and without duplicate front-office strip", async () => {
    const [officeText, homeText, cssText, shellText] = await Promise.all([
      fs.readFile(managerOfficePath, "utf8"),
      fs.readFile(homeV2Path, "utf8"),
      fs.readFile(globalsPath, "utf8"),
      fs.readFile(shellRouterBodyPath, "utf8"),
    ]);

    expect(officeText).toContain("foundation-hq-gm-line");
    expect(officeText).toContain('data-testid="foundation-hq-captain-picker"');
    expect(officeText).toContain("Kapitän ernennen");
    expect(officeText).not.toContain("Front-Office Fokus");
    expect(officeText).not.toContain("foundation-hq-command");
    expect(homeText).not.toContain("home-v2-hero-meta");
    expect(cssText).toContain(".foundation-hq-captain-picker");
    expect(shellText).toContain('activeView === "homeV2"');
  });

  it("wires the modern v2 layout classes", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");

    expect(cssText).toContain(".home-v2-shell");
    expect(cssText).toContain(".home-v2-player-card");
    expect(cssText).toContain(".home-v2-player-hero");
    expect(cssText).toContain(".home-v2-player-overlay");
    expect(cssText).toContain(".is-rank-gold");
    expect(cssText).toContain(".is-rank-silver");
    expect(cssText).toContain(".is-rank-bronze");
    expect(cssText).toContain(".foundation-player-portrait-stat");
    expect(cssText).toContain(".home-v2-player-orbit.is-overlay .velo-stat-orbit-chip.is-pow");
    expect(cssText).toContain(".team-portraits-grid");
    expect(cssText).toContain(".home-v2-hero");
    expect(cssText).toContain(".home-v2-signal-strip");
    expect(cssText).toContain(".foundation-home-v2-panel .home-v2-subnav");
  });
});

describe("foundation ui v2 roadmap contract", () => {
  it("routes preview navigation for facilities, scouting hub and inbox v2", async () => {
    const [shellText, scopeText, routerText, navText, pageTypesText, moduleHelpersText] = await Promise.all([
      fs.readFile(shellRouterBodyPath, "utf8"),
      fs.readFile(shellScopePath, "utf8"),
      fs.readFile(shellRouterPath, "utf8"),
      fs.readFile(navConfigPath, "utf8"),
      fs.readFile(foundationPageTypesPath, "utf8"),
      fs.readFile(moduleHelpersPath, "utf8"),
    ]);

    expect(pageTypesText).toContain('| "facilitiesOverviewV2"');
    expect(pageTypesText).toContain('| "scoutingCenterV2"');
    expect(pageTypesText).toContain('| "inboxV2"');
    expect(shellText).toContain("<ScoutingCenterV2Client");
    expect(routerText).toContain("FoundationShellRouterInboxV2");
    expect(
      (await fs.readFile(path.join(root, "app/foundation/inbox-v2/FoundationInboxV2Host.tsx"), "utf8")),
    ).toContain("<InboxV2Client");
    expect(navText).toContain('{ id: "inboxV2", label: "Inbox"');
    expect(moduleHelpersText).toContain('label: "Scouting Hub"');
    expect(scopeText).toContain("getTransfermarktScoutingVisibilityBuckets");
  });

  it("keeps facilities overview v2 read-only without classic training jump links", async () => {
    const fileText = await fs.readFile(facilitiesOverviewV2Path, "utf8");

    expect(fileText).toContain("Gebäude");
    expect(fileText).not.toContain("onOpenClassicTraining");
    expect(fileText).toContain("facilities-overview-v2-grid");
    expect(fileText).toContain('data-testid="foundation-facilities-overview-v2"');
  });

  it("keeps scouting hub v2 as transfermarkt summary, not standalone center", async () => {
    const fileText = await fs.readFile(scoutingHubV2Path, "utf8");

    expect(fileText).toContain("Scouting");
    expect(fileText).toContain("Transfermarkt öffnen");
    expect(fileText).toContain("Scouting-Warteschlange");
    expect(fileText).toContain("ScoutingPriorityQueue");
    expect(fileText).toContain("scoutPipeline");
  });

  it("keeps inbox v2 as the canonical compact inbox", async () => {
    const fileText = await fs.readFile(inboxV2Path, "utf8");

    expect(fileText).toContain('data-testid="foundation-inbox-v2"');
    expect(fileText).toContain("inbox-v2-layout");
    expect(fileText).toContain("Entscheidungen");
    expect(fileText).not.toContain("Inbox Classic");
  });

  it("exposes sprint N urgency sort, inbox checkoffs, compact save menu, and quieter mobile nav", async () => {
    const [homeText, shellText, overviewDerivationsText, auditText, cssText, crossTabFlowText] = await Promise.all([
      fs.readFile(homeV2Path, "utf8"),
      fs.readFile(shellRouterBodyPath, "utf8"),
      fs.readFile(path.join(root, "lib/foundation/tabs/use-home-v2-overview-derivations.ts"), "utf8"),
      fs.readFile(path.join(root, "scripts/tmp-ux-audit-play.ts"), "utf8"),
      fs.readFile(globalsPath, "utf8"),
      fs.readFile(path.join(root, "lib/foundation/tabs/use-foundation-cross-tab-game-flow.ts"), "utf8"),
    ]);

    expect(homeText).toContain("relevantWarnings");
    expect(homeText).toContain("home-v2-inbox-checkoff");
    expect(homeText).toContain("onCompleteInboxItem");

    expect(overviewDerivationsText).toContain("homeTodayCards");
    expect(overviewDerivationsText).toContain("sortTodayCardsByUrgency");

    expect(shellText).toContain('data-testid="foundation-save-compact-menu"');
    expect(shellText).toContain("formatShortSaveId(activeSaveId)");
    expect(shellText).toContain("FoundationShellRouterHomeV2");

    expect(crossTabFlowText).toContain('item.severity === "blocked" || item.severity === "warning"');

    expect(auditText).toContain("AUDIT_VIEWS");
    expect(auditText).toContain("home-v2");
    expect(auditText).toContain("history-v2");
    expect(auditText).toContain('"desktop"');
    expect(auditText).toContain('"mobile"');

    expect(cssText).toContain(".foundation-subnav-item");
    expect(cssText).toContain("prefers-reduced-motion");
  });
});

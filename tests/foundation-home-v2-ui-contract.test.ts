import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const foundationClientPath = path.join(root, "app/foundation/FoundationPageClient.tsx");
const homeV2Path = path.join(root, "app/foundation/home-v2/HomeV2Client.tsx");
const navConfigPath = path.join(root, "lib/foundation/foundation-nav-config.ts");
const viewRoutingPath = path.join(root, "lib/foundation/foundation-view-routing.ts");
const facilitiesOverviewV2Path = path.join(root, "app/foundation/facilities-overview-v2/FacilitiesOverviewV2Client.tsx");
const scoutingHubV2Path = path.join(root, "app/foundation/scouting-center-v2/ScoutingCenterV2Client.tsx");
const inboxV2Path = path.join(root, "app/foundation/inbox-v2/InboxV2Client.tsx");
const globalsPath = path.join(root, "app/globals.css");

describe("foundation home v2 ui contract", () => {
  it("merges home and office into one home v2 view with sub navigation", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");
    const navText = await fs.readFile(navConfigPath, "utf8");
    const routingText = await fs.readFile(viewRoutingPath, "utf8");

    expect(fileText).toContain("FoundationSubNav");
    const panelText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/home-v2/FoundationHomeV2Panel.tsx"),
      "utf8",
    );
    expect(panelText).toContain('tab === "overview"');
    expect(fileText).toContain('homeV2Tab === "office"');
    expect(fileText).toContain('navigateHomeTab("office")');
    expect(panelText).toContain('if (!active)');
    expect(panelText).toContain('id="foundation-home-v2"');
    expect(panelText).toContain("ManagerOfficeClient");
    const officeText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/home-v2/ManagerOfficeClient.tsx"),
      "utf8",
    );
    expect(officeText).toContain('data-testid="foundation-hq"');
    expect(fileText).not.toContain('getViewClass("hq")');
    expect(navText).not.toContain('id: "hq"');
    expect(routingText).toContain('if (view === "hq") return "homeV2"');
    expect(fileText).toContain("FoundationHomeV2Panel");
    expect(fileText).toContain("onOpenOffice");
    expect(fileText).not.toContain('onOpenClassicHome={() => setFoundationView("home", setActiveView)}');
  });

  it("keeps the Velo-inspired dashboard focused on top players, KPIs and flow actions", async () => {
    const fileText = await fs.readFile(homeV2Path, "utf8");

    expect(fileText).toContain("Top 6 Spieler");
    expect(fileText).toContain("HOME_V2_TOP_PLAYER_COUNT");
    expect(fileText).toContain("home-v2-player-grid");
    expect(fileText).toContain("home-v2-hero-stats");
    expect(fileText).toContain("home-v2-signal-strip");
    expect(fileText).toContain("home-v2-quick-nav");
    expect(fileText).toContain("onContinue");
    expect(fileText).toContain("onOpenBoardObjectives");
    expect(fileText).toContain("home-v2-objective-card");
    expect(fileText).toContain("onOpenOffice");
    expect(fileText).toContain("Office");
    expect(fileText).not.toContain("Manager Overview V2");
    expect(fileText).not.toContain("HQ öffnen");
    expect(fileText).toContain("Facilities");
    expect(fileText).toContain("Inbox");
    expect(fileText).toContain('data-testid="foundation-home-v2"');
  });

  it("shows core axis stats and absolute CA/PO range on top player cards", async () => {
    const [homeText, typesText, foundationText] = await Promise.all([
      fs.readFile(homeV2Path, "utf8"),
      fs.readFile(
        path.join(process.cwd(), "app/foundation/home-v2/home-v2-types.ts"),
        "utf8",
      ),
      fs.readFile(foundationClientPath, "utf8"),
    ]);

    expect(homeText).toContain("VeloStatOrbitRow");
    expect(homeText).not.toContain("showGrade");
    expect(homeText).not.toContain("VeloStarRating");
    expect(homeText).toContain('data-testid="home-player-ca-po-row"');
    expect(homeText).toContain('data-testid="home-player-potential-range"');
    expect(homeText).toContain("formatPotentialRange");
    expect(homeText).toContain("formatAbilityPoints");
    expect(homeText).toContain("home-v2-player-stat");
    expect(homeText).toContain("Rank");
    expect(typesText).toContain("caRating");
    expect(typesText).toContain("poRangeMin");
    expect(typesText).toContain("poRangeMax");
    expect(typesText).toContain("rosterRank");
    expect(typesText).toContain("pow:");
    expect(foundationText).toContain("buildPlayerDevelopmentInsight");
    expect(foundationText).toContain("buildPlayerProgressionForecast");
    expect(foundationText).toContain("potentialRangeDisplay");
    expect(typesText).toContain("HOME_V2_TOP_PLAYER_COUNT");
    expect(foundationText).toContain("homePlayerCards.slice(0, 6)");
  });

  it("wires the modern v2 layout classes", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");

    expect(cssText).toContain(".home-v2-shell");
    expect(cssText).toContain(".home-v2-player-card");
    expect(cssText).toContain(".home-v2-player-stat");
    expect(cssText).toContain(".home-v2-hero");
    expect(cssText).toContain(".home-v2-signal-strip");
    expect(cssText).toContain(".foundation-home-v2-panel .home-v2-subnav");
  });
});

describe("foundation ui v2 roadmap contract", () => {
  it("routes preview navigation for facilities, scouting hub and inbox v2", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");
    const navText = await fs.readFile(navConfigPath, "utf8");

    expect(fileText).toContain('| "facilitiesOverviewV2"');
    expect(fileText).toContain('| "scoutingCenterV2"');
    expect(fileText).toContain('| "inboxV2"');
    expect(fileText).toContain("<ScoutingCenterV2Client");
    expect(fileText).toContain("<InboxV2Client");
    expect(navText).toContain('{ id: "inboxV2", label: "Inbox"');
    expect(fileText).toContain('label: "Scouting Hub"');
    expect(fileText).toContain("getTransfermarktScoutingVisibilityBuckets");
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
    expect(fileText).toContain("Aktiv gescoutet");
    expect(fileText).toContain("Base Infos (immer)");
    expect(fileText).toContain("Draft & Rekrutierung");
    expect(fileText).not.toContain("Recent Reports");
    expect(fileText).toContain("Scout-Pipeline");
    expect(fileText).toContain("Nur gemerkt");
  });

  it("keeps inbox v2 as the canonical compact inbox", async () => {
    const fileText = await fs.readFile(inboxV2Path, "utf8");

    expect(fileText).toContain('data-testid="foundation-inbox-v2"');
    expect(fileText).toContain("inbox-v2-layout");
    expect(fileText).toContain("Entscheidungen");
    expect(fileText).not.toContain("Inbox Classic");
  });
});

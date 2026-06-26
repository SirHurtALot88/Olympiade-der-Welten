import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";
const homeV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/home-v2/HomeV2Client.tsx";
const navConfigPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/foundation-nav-config.ts";
const viewRoutingPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/foundation-view-routing.ts";
const facilitiesOverviewV2Path =
  "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/facilities-overview-v2/FacilitiesOverviewV2Client.tsx";
const scoutingHubV2Path =
  "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/scouting-center-v2/ScoutingCenterV2Client.tsx";
const inboxV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/inbox-v2/InboxV2Client.tsx";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";

describe("foundation home v2 ui contract", () => {
  it("merges home and office into one home v2 view with sub navigation", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");
    const navText = await fs.readFile(navConfigPath, "utf8");
    const routingText = await fs.readFile(viewRoutingPath, "utf8");

    expect(fileText).toContain("FoundationSubNav");
    expect(fileText).toContain('homeV2Tab === "overview"');
    expect(fileText).toContain('homeV2Tab === "office"');
    expect(fileText).toContain('navigateHomeTab("office")');
    expect(fileText).toContain("ManagerOfficeClient");
    const officeText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/home-v2/ManagerOfficeClient.tsx",
      "utf8",
    );
    expect(officeText).toContain('data-testid="foundation-hq"');
    expect(fileText).not.toContain('getViewClass("hq")');
    expect(navText).not.toContain('id: "hq"');
    expect(routingText).toContain('if (view === "hq") return "homeV2"');
    expect(fileText).toContain("<HomeV2Client");
    expect(fileText).toContain("onOpenOffice");
    expect(fileText).not.toContain('onOpenClassicHome={() => setFoundationView("home", setActiveView)}');
  });

  it("keeps the Velo-inspired dashboard focused on top players, KPIs and flow actions", async () => {
    const fileText = await fs.readFile(homeV2Path, "utf8");

    expect(fileText).toContain("Top 3 Spieler");
    expect(fileText).toContain("home-v2-player-grid");
    expect(fileText).toContain("home-v2-kpi-grid");
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

  it("shows grade letters on orbit chips and potential band on top player cards", async () => {
    const [homeText, typesText, foundationText] = await Promise.all([
      fs.readFile(homeV2Path, "utf8"),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/home-v2/home-v2-types.ts",
        "utf8",
      ),
      fs.readFile(foundationClientPath, "utf8"),
    ]);

    // Grade letters on orbit row
    expect(homeText).toContain("showGrade");
    // Potential band pill
    expect(homeText).toContain('data-testid="home-player-potential-band"');
    expect(homeText).toContain("getPotentialBandLabel");
    // Types extended
    expect(typesText).toContain("potential?");
    expect(typesText).toContain("potentialBand?");
    // Foundation populates the fields
    expect(foundationText).toContain("getPotentialBand");
    expect(foundationText).toContain("player.potential");
  });

  it("wires the modern v2 layout classes", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");

    expect(cssText).toContain(".home-v2-shell");
    expect(cssText).toContain(".home-v2-player-card");
    expect(cssText).toContain(".home-v2-kpi-grid");
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

  it("keeps facilities overview v2 read-only and linked back to classic training", async () => {
    const fileText = await fs.readFile(facilitiesOverviewV2Path, "utf8");

    expect(fileText).toContain("Facilities Overview V2");
    expect(fileText).toContain("Training Classic");
    expect(fileText).toContain("facilities-overview-v2-grid");
    expect(fileText).toContain('data-testid="foundation-facilities-overview-v2"');
  });

  it("keeps scouting hub v2 as transfermarkt summary, not standalone center", async () => {
    const fileText = await fs.readFile(scoutingHubV2Path, "utf8");

    expect(fileText).toContain("Scouting & Transfermarkt");
    expect(fileText).toContain("Transfermarkt öffnen");
    expect(fileText).toContain("Watchlist / Beobachtet");
    expect(fileText).toContain("Base Infos (immer)");
    expect(fileText).toContain("Draft & Rekrutierung");
    expect(fileText).not.toContain("Recent Reports");
    expect(fileText).toContain("Nächster Meilenstein");
    expect(fileText).toContain("Aktive Beobachtung");
  });

  it("keeps inbox v2 as the canonical compact inbox", async () => {
    const fileText = await fs.readFile(inboxV2Path, "utf8");

    expect(fileText).toContain('data-testid="foundation-inbox-v2"');
    expect(fileText).toContain("inbox-v2-layout");
    expect(fileText).toContain("Entscheidungen & Hinweise");
    expect(fileText).not.toContain("Inbox Classic");
  });
});

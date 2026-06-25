import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";
const homeV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/home-v2/HomeV2Client.tsx";
const facilitiesOverviewV2Path =
  "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/facilities-overview-v2/FacilitiesOverviewV2Client.tsx";
const scoutingHubV2Path =
  "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/scouting-center-v2/ScoutingCenterV2Client.tsx";
const inboxV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/inbox-v2/InboxV2Client.tsx";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";

describe("foundation home v2 ui contract", () => {
  it("routes the preview navigation into Home V2 without replacing classic home", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain('| "homeV2"');
    expect(fileText).toContain('{ id: "homeV2", label: "Home v2"');
    expect(fileText).toContain('return "foundation-home-v2"');
    expect(fileText).toContain("<HomeV2Client");
    expect(fileText).toContain('onOpenClassicHome={() => setFoundationView("home", setActiveView)}');
    expect(fileText).toContain('activeView === "home" ? (');
  });

  it("keeps the Velo-inspired dashboard focused on top players, KPIs and flow actions", async () => {
    const fileText = await fs.readFile(homeV2Path, "utf8");

    expect(fileText).toContain("Top 3 Spieler");
    expect(fileText).toContain("home-v2-player-grid");
    expect(fileText).toContain("home-v2-kpi-grid");
    expect(fileText).toContain("onContinue");
    expect(fileText).toContain("Classic Home");
    expect(fileText).toContain("Facilities");
    expect(fileText).toContain("Inbox");
    expect(fileText).toContain('data-testid="foundation-home-v2"');
  });

  it("wires the modern v2 layout classes", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");

    expect(cssText).toContain(".home-v2-shell");
    expect(cssText).toContain(".home-v2-player-card");
    expect(cssText).toContain(".home-v2-kpi-grid");
  });
});

describe("foundation ui v2 roadmap contract", () => {
  it("routes preview navigation for facilities, scouting hub and inbox v2", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain('| "facilitiesOverviewV2"');
    expect(fileText).toContain('| "scoutingCenterV2"');
    expect(fileText).toContain('| "inboxV2"');
    expect(fileText).toContain("<FacilitiesOverviewV2Client");
    expect(fileText).toContain("<ScoutingCenterV2Client");
    expect(fileText).toContain("<InboxV2Client");
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
    expect(fileText).toContain('data-testid="foundation-scouting-hub-v2"');
  });

  it("keeps inbox v2 as master-detail with classic fallback", async () => {
    const fileText = await fs.readFile(inboxV2Path, "utf8");

    expect(fileText).toContain("Inbox V2");
    expect(fileText).toContain("inbox-v2-layout");
    expect(fileText).toContain("Inbox Classic");
    expect(fileText).toContain('data-testid="foundation-inbox-v2"');
  });
});

import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const root = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten";

describe("foundation page surfaces contract", () => {
  it("routes player and team identity to full pages instead of global drawers", async () => {
    const foundationText = await fs.readFile(`${root}/app/foundation/FoundationPageClient.tsx`, "utf8");
    const routingText = await fs.readFile(`${root}/lib/foundation/foundation-view-routing.ts`, "utf8");

    expect(foundationText).toContain("openPlayerProfileById");
    expect(foundationText).toContain("openTeamProfileById");
    expect(foundationText).toContain("<PlayerProfileClient");
    expect(foundationText).toContain("<TeamProfileClient");
    expect(foundationText).not.toMatch(/<PlayerDetailDrawer[\s/>]/);
    expect(foundationText).not.toMatch(/<TeamDetailDrawer[\s/>]/);
    expect(routingText).toContain('"playerProfile"');
    expect(routingText).toContain('"teamProfile"');
  });

  it("routes transactional flows to drilldown pages with browser history", async () => {
    const transferText = await fs.readFile(`${root}/app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx`, "utf8");
    const foundationText = await fs.readFile(`${root}/app/foundation/FoundationPageClient.tsx`, "utf8");
    const facilityText = await fs.readFile(`${root}/app/foundation/facilities-v2/facility-ui-shared.tsx`, "utf8");

    expect(transferText).toContain("foundation-drilldown-page");
    expect(transferText).toContain('data-testid="transfer-offer-page"');
    expect(transferText).not.toContain("foundation-modal-backdrop");
    expect(foundationText).toContain('data-testid="transfer-sell-page"');
    expect(foundationText).toContain('data-testid="season-briefing-page"');
    expect(foundationText).not.toContain("season-briefing-modal");
    expect(foundationText).not.toContain("foundation-modal-backdrop");
    expect(foundationText).not.toContain("marketBuyModalOpen");
    expect(foundationText).toContain("openMarketOfferPanel(item.playerId)");
    expect(facilityText).toContain('data-testid="facility-upgrade-page"');
    expect(facilityText).not.toContain("foundation-modal-backdrop");
  });
});

describe("team profile ui contract", () => {
  it("exposes full-page team dossier with roster navigation to player profile", async () => {
    const [teamProfileText, drawerText] = await Promise.all([
      fs.readFile(`${root}/app/foundation/team-profile/TeamProfileClient.tsx`, "utf8"),
      fs.readFile(`${root}/app/foundation/TeamDetailDrawer.tsx`, "utf8"),
    ]);

    expect(teamProfileText).toContain('variant="page"');
    expect(drawerText).toContain('data-testid="foundation-team-profile"');
    expect(drawerText).toContain("onOpenPlayer");
    expect(drawerText).toContain("team-drawer-lead-summary");
    expect(drawerText).toContain("team-drawer-relations-panel");
    expect(drawerText).toContain("team-drawer-objective-board");
    expect(drawerText).toContain("team-drawer-objective-row-main");
  });
});

describe("drawer-to-page layout contract", () => {
  it("uses full-width page styles for converted drawer surfaces", async () => {
    const cssText = await fs.readFile(`${root}/app/globals.css`, "utf8");

    expect(cssText).toContain(".player-drawer.player-drawer-page");
    expect(cssText).toContain("max-width: none");
    expect(cssText).toContain(".foundation-player-profile-panel.panel");
    expect(cssText).toContain(".foundation-team-profile-panel.panel");
    expect(cssText).toContain(".foundation-drilldown-page");
    expect(cssText).toContain(".team-drawer-lead-summary");
    expect(cssText).toContain(".team-drawer-relations-panel");
    expect(cssText).toContain(".team-drawer-objective-board");
    expect(cssText).toContain(".team-drawer-objective-row-main");
  });
});

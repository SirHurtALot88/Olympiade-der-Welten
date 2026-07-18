import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource, readFoundationSurfaceSource } from "./foundation-orchestrator-source";

const root = process.cwd();

describe("foundation page surfaces contract", () => {
  it("routes player and team identity to full pages instead of global drawers", async () => {
    const foundationText = await readFoundationSurfaceSource(root);
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
    const buyHostText = await fs.readFile(
      `${root}/app/foundation/transfermarkt-v2/FoundationMarketBuyShellHost.tsx`,
      "utf8",
    );
    const sellHostText = await fs.readFile(
      `${root}/app/foundation/transfermarkt-v2/FoundationMarketSellShellHost.tsx`,
      "utf8",
    );
    const orchestratorText = await readFoundationOrchestratorSource(root);
    const foundationText = await readFoundationSurfaceSource(root);
    const facilityText = await fs.readFile(`${root}/app/foundation/facilities-v2/facility-ui-shared.tsx`, "utf8");

    expect(buyHostText).toContain("foundation-drilldown-page");
    expect(buyHostText).toContain('data-testid="transfer-offer-page"');
    expect(transferText).not.toContain("foundation-modal-backdrop");
    // Verkaufs-Drilldown lebt im dedizierten Shell-Host, der Body rendert ihn
    // über FoundationShellRouterMarketSell (Strangler Phase 5.3 abgeschlossen).
    expect(sellHostText).toContain("foundation-drilldown-page");
    expect(sellHostText).toContain('data-testid="transfer-sell-page"');
    expect(foundationText).toContain("FoundationShellRouterMarketSell");
    expect(foundationText).toContain('data-testid="season-briefing-page"');
    expect(orchestratorText).not.toContain("season-briefing-modal");
    expect(orchestratorText).not.toContain("foundation-modal-backdrop");
    expect(orchestratorText).not.toContain("marketBuyModalOpen");
    expect(orchestratorText).toContain("openMarketOfferPanel(item.playerId)");
    expect(facilityText).toContain('data-testid="facility-upgrade-page"');
    expect(facilityText).not.toContain("foundation-modal-backdrop");
  });
});

describe("team profile ui contract", () => {
  it("exposes full-page team dossier with roster navigation to player profile", async () => {
    const [teamProfileText, newLookText] = await Promise.all([
      fs.readFile(`${root}/app/foundation/team-profile/TeamProfileClient.tsx`, "utf8"),
      fs.readFile(`${root}/app/foundation/team-profile/TeamProfileNewLook.tsx`, "utf8"),
    ]);

    // The canonical team dossier is TeamProfileNewLook, rendered by TeamProfileClient.
    expect(teamProfileText).toContain("<TeamProfileNewLook");
    expect(newLookText).toContain('data-testid="foundation-team-profile"');
    expect(newLookText).toContain("onOpenPlayer");
    expect(newLookText).toContain("renderRelationshipColumn");
    expect(newLookText).toContain('data-testid="nl-teamprofile-board"');
    expect(newLookText).toContain('data-testid="nl-teamprofile-roster"');
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

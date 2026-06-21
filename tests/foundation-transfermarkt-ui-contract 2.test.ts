import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";
const transfermarktV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx";
const lineupPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx";
const teamDrawerPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/TeamDetailDrawer.tsx";
const drawerDataPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/player-detail-drawer.ts";
const fitServicePath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/market/transfermarkt-fit.ts";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";

describe("foundation transfermarkt ui contract", () => {
  it("keeps the global foundation context visible", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(foundationClientPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(fileText).toContain('data-testid="foundation-context-banner"');
    expect(fileText).toContain("Aktiver Kontext");
    expect(fileText).toContain("buildContextStatusChips");
    expect(fileText).toContain("buildViewContextWarning");
    expect(cssText).toContain(".foundation-context-banner");
    expect(cssText).toContain(".foundation-context-warning");
  });

  it("opens Transfermarkt V2 as the primary market flow", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain('if (view === "market") return "marketV2";');
    expect(fileText).toContain('if (view === "transfermarkt" || view === "market")');
    expect(fileText).toContain("getDefaultFoundationViewTarget(view.id)");
    expect(fileText).toContain('setFoundationView("marketV2", setActiveView)');
  });

  it("keeps Transfermarkt V2 centered on scouting, deal preview and own roster context", async () => {
    const fileText = await fs.readFile(transfermarktV2Path, "utf8");

    expect(fileText).toContain("Markt-Pool");
    expect(fileText).toContain("Scouting-Profil");
    expect(fileText).toContain("Deal-Desk");
    expect(fileText).toContain("Deal-Vorschau");
    expect(fileText).toContain("Aktueller Kader");
    expect(fileText).toContain("Wishlist & Bedarf");
    expect(fileText).toContain("Deal prüfen");
    expect(fileText).toContain("Kaufdialog");
    expect(fileText).toContain("Kauf final abschließen");
    expect(fileText).toContain("Happy / Trust / Push");
    expect(fileText).toContain("Warum der Deal so ausfällt");
    expect(fileText).toContain("getCandidateFrameStyle");
  });

  it("keeps scouting values intentionally fuzzy instead of exposing exact hidden truths", async () => {
    const [marketText, drawerText] = await Promise.all([
      fs.readFile(transfermarktV2Path, "utf8"),
      fs.readFile(drawerDataPath, "utf8"),
    ]);

    expect(marketText).toContain("getScoutReliabilityCopy");
    expect(marketText).toContain("getScoutingTierWindow");
    expect(marketText).toContain("getScoutedTopDisciplineHeadline");
    expect(marketText).toContain("getScoutedDisciplineLine");
    expect(drawerText).toContain("scoutingConfidence");
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
});

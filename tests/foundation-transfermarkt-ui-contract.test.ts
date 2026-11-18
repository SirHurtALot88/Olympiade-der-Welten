import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource, readFoundationSurfaceSource } from "./foundation-orchestrator-source";

const root = process.cwd();

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
// Der Kandidaten-Qualitaets-Wortlaut ("Passt sofort" usw.) und die Save-CTA-Texte sitzen seit dem
// Verschieben des Rechenkerns nicht mehr inline im Client, sondern in lib/lineups/. Beide Quellen
// zusammen lesen, damit dieser Vertrag ueber den Umzug hinweg bestehen bleibt.
const lineupCandidateModelPath = path.join(root, "lib/lineups/lineup-candidate-model.ts");
const lineupAuditPath = path.join(root, "lib/lineups/lineup-audit.ts");
const teamProfileNewLookPath = path.join(root, "app/foundation/team-profile/TeamProfileNewLook.tsx");
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

  it("lets local Chris/manual teams stay manageable in quick market views", async () => {
    const fileText = await readFoundationOrchestratorSource(root);
    const teamControlHookText = await fs.readFile(
      path.join(root, "lib/foundation/tabs/use-foundation-cross-tab-team-control.ts"),
      "utf8",
    );

    expect(teamControlHookText).toContain("localUserManualTeams");
    // Stufe 2.4 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Befund "die UI erlaubt mehr als der
    // Server"): hier stand frueher zusaetzlich `settings.ownerSlot === "user"` /
    // `settings.displayLabel === "Chris"` als eigener, grosszuegigerer Freigabe-Zweig
    // (`isLocalUserManualTeam`) -- unabhaengig von `effectiveActiveOwnerId`. Der Server prueft
    // beim Schreiben ausschliesslich exakte Owner-Gleichheit; die Oberflaeche erlaubte also mehr
    // als der Server, was NACH einem Klick in einem 403 endete. Der Zweig ist raus, Chris' Teams
    // bleiben trotzdem manageable, weil `effectiveActiveOwnerId` fuer ihn jetzt zuverlaessig
    // aufgeloest wird (siehe tests/frankys-browser-kennt-seine-teams.test.ts, das den entfernten
    // Zweig praezise -- ohne Kommentarzeilen -- prueft).
    expect(fileText).toContain("canOwnerManageTeam(selectedTeamControl, effectiveActiveOwnerId)");
    expect(fileText).toContain("FoundationTransfermarktV2Panel");
    expect(fileText).toContain("manageableTeamIds: foundationManageableTeamIds");
    // Stufe 0.3 (Befund B2): `withRoomBody` schickte hier frueher `activeOwnerId: resolvedOwnerId`
    // mit — die Owner-ID des ZIELTEAMS, nicht die eigene. Der Server ignoriert das Feld jetzt und
    // bestimmt die Identitaet selbst (Sitz-Token im Raum, sonst die Sitzung); die Zeile ist raus,
    // statt irrefuehrend stehen zu bleiben. Diese Zusicherung haelt fest, dass sie nicht
    // zurueckkehrt.
    expect(fileText).not.toContain("activeOwnerId: resolvedOwnerId");
  });

  it("documents that local team fit can still go negative for bad profile matches", async () => {
    const fileText = await fs.readFile(fitServicePath, "utf8");

    expect(fileText).toContain("scorePresenceToken");
    expect(fileText).toContain("scorePresenceArray");
    expect(fileText).toContain("scorePresenceToken(raceKey, tokenCounts.races, -2)");
    expect(fileText).toContain("scorePresenceArray(traitKeys, tokenCounts.traits, -1)");
  });

  it("keeps the team profile relationship cards alive", async () => {
    const [clientText, teamsRosterHookText, teamProfileText] = await Promise.all([
      readFoundationOrchestratorSource(root),
      fs.readFile(teamsRosterHookPath, "utf8"),
      fs.readFile(teamProfileNewLookPath, "utf8"),
    ]);

    expect(clientText).toContain("buildTeamDetailDrawerData");
    expect(teamsRosterHookText).toContain("buildTeamRelationshipCards");
    expect(teamsRosterHookText).toContain("relationships: drawerRelationships");
    expect(teamProfileText).toContain("renderRelationshipColumn");
    expect(teamProfileText).toContain("data.relationships.allies");
    expect(teamProfileText).toContain("data.relationships.rivals");
  });

  it("keeps the lineup coach wording tied to the new candidate quality flow", async () => {
    const [lineupText, candidateModelText, auditText, cssText] = await Promise.all([
      fs.readFile(lineupPath, "utf8"),
      fs.readFile(lineupCandidateModelPath, "utf8"),
      fs.readFile(lineupAuditPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(candidateModelText).toContain("Passt sofort");
    expect(candidateModelText).toContain("Gute Alternative");
    expect(candidateModelText).toContain("Riskant wegen Fatigue");
    expect(candidateModelText).toContain("Blockiert / schon eingesetzt");
    expect(candidateModelText).toContain("Nur Notfall");
    expect(auditText).toContain("Hier weiter");
    expect(auditText).toContain("Lineup bereit speichern");
    expect(lineupText).toContain("Captains offen");
    expect(cssText).toContain(".legacy-lineup-slot-conflict-chip");
    expect(cssText).toContain(".legacy-lineup-side-issue-chip");
    expect(cssText).toContain(".legacy-matchday-player-score-chip.is-quality-instant");
  });

});

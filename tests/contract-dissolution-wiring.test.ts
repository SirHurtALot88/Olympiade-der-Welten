import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const read = (relativePath: string) => readFileSync(join(REPO_ROOT, relativePath), "utf8");

const LOCAL_SERVICE = read("lib/morale/contract-dissolution-local-service.ts");
const ROUTE = read("app/api/contracts/dissolution/route.ts");
const SCOPE = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const PANEL = read("app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx");
const CSS = read("app/globals.css");

/**
 * Die Engine-Schicht (#243) konnte niemand aufrufen — "ohne Anbindung sieht man im Spiel
 * noch nichts". Diese Suite haelt die Kette fest, die daraus ein bedienbares Feature macht:
 * Dienst -> Route -> Shell-Handler -> Knoepfe im Kader.
 */
describe("Vertragsaufloesung: Verdrahtung", () => {
  it("holt die Moral aus derselben Quelle wie das Spielerprofil", () => {
    // buildContractDissolutionOffers leitet die Moral bewusst nicht selbst ab — sonst
    // driftet der Wert von der Anzeige weg. Der lokale Dienst ist die Bruecke.
    expect(LOCAL_SERVICE).toContain("assessPlayerMorale({");
    expect(LOCAL_SERVICE).toContain("moraleByPlayerId: buildTeamMoraleMap(gameState, teamId)");
  });

  it("rechnet das Angebot auf dem Server neu, statt es entgegenzunehmen", () => {
    // Sonst koennte ein veralteter Preis aus der Ansicht gebucht werden.
    expect(LOCAL_SERVICE).toContain("const offers = buildOffers(save.gameState");
    expect(LOCAL_SERVICE).toContain('return { ok: false, error: "offer_not_available", offers };');
  });

  it("persistiert die Entscheidung", () => {
    expect(LOCAL_SERVICE).toContain("persistence.saveSingleplayerState(input.saveId, nextGameState);");
    expect(LOCAL_SERVICE).toContain("acceptContractDissolution(decision) : declineContractDissolution(decision)");
  });

  it("bietet Lesen und Schreiben ueber eine Route an", () => {
    expect(ROUTE).toContain("export async function GET(");
    expect(ROUTE).toContain("export async function POST(");
    expect(ROUTE).toContain("listLocalContractDissolutionOffers({ saveId, seasonId, teamId })");
    expect(ROUTE).toContain("executeLocalContractDissolution({ saveId, seasonId, teamId, playerId, decision })");
    // Dieselbe Sperre wie beim Verkauf.
    expect(ROUTE).toContain('body.source === "prisma"');
  });

  it("laedt Angebote nur im Season-End-Fenster und fuers eigene Team", () => {
    expect(SCOPE).toContain("if (!selectedTeamRosterActionsAvailable || !selectedTeam?.teamId || !activeSaveId)");
    expect(SCOPE).toContain("/api/contracts/dissolution?");
  });

  it("laedt den Spielstand nach der Entscheidung neu", () => {
    // Ohne Reload zeigte der Kader den verkauften Spieler weiter an.
    expect(SCOPE).toContain("async function decideContractDissolution(");
    expect(SCOPE).toMatch(/decideContractDissolution[\s\S]{0,3000}await loadSave\(activeSaveId\);/);
  });

  it("reicht die Angebote bis in den Kader durch", () => {
    expect(SCOPE).toContain("onDecideContractDissolution: decideContractDissolution,");
    expect(PANEL).toContain('data-testid="teams-contract-dissolution"');
    expect(PANEL).toContain('onDecideContractDissolution?.(offer.playerId, "accepted")');
    expect(PANEL).toContain('onDecideContractDissolution?.(offer.playerId, "declined")');
  });

  it("zeigt den Block nur, wenn Aktionen freigegeben sind und es Angebote gibt", () => {
    expect(PANEL).toContain("{rosterActionsEnabled && contractDissolutionOffers.length > 0 ? (");
  });

  it("sperrt waehrend des Schreibens alle Knoepfe, nicht nur die der Zeile", () => {
    // Zwei parallele Entscheidungen wuerden gegen denselben Spielstand schreiben.
    expect(PANEL).toContain("const anyBusy = contractDissolutionBusyPlayerId != null;");
    expect(PANEL).toContain("disabled={busy || anyBusy}");
  });

  it("bringt die Liste ein eigenes Layout mit", () => {
    expect(CSS).toContain(".teams-dissolution-item");
    expect(CSS).toContain(".teams-dissolution-actions");
  });
});

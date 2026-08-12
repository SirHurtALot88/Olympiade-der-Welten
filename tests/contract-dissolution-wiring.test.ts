import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

/**
 * Die Moralrechnung selbst hat eigene Tests. Hier zaehlt nur, dass die Bruecke GENAU DAS
 * durchreicht, was `assessPlayerMorale` fuer die Spieler DIESES Teams liefert — und sonst nichts.
 */
vi.mock("@/lib/morale/player-morale-service", async () => {
  const echt = await vi.importActual<typeof import("@/lib/morale/player-morale-service")>(
    "@/lib/morale/player-morale-service",
  );
  return {
    ...echt,
    assessPlayerMorale: (input: { playerId: string; teamId: string }) =>
      input.playerId === "p-stumm" ? null : { morale: input.playerId === "p-sauer" ? 12.5 : 71 },
  };
});

const { buildTeamMoraleMap } = await import("@/lib/morale/contract-dissolution-service");

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
    // driftet der Wert von der Anzeige weg. Die Bruecke ist `buildTeamMoraleMap`; sie steht
    // neben der Angebots-Funktion, weil sie inzwischen von DREI Seiten gebraucht wird
    // (Route, Inbox, KI-Entscheidung) und als Kopie dreimal auseinanderlaufen wuerde.
    expect(LOCAL_SERVICE).toContain("moraleByPlayerId: buildTeamMoraleMap(gameState, teamId)");
  });

  it("reicht genau die Moral des eigenen Kaders durch — keine fremden Spieler, keine erfundenen Werte", () => {
    const gameState = {
      rosters: [
        { teamId: "C-C", playerId: "p-sauer" },
        { teamId: "C-C", playerId: "p-froh" },
        { teamId: "C-C", playerId: "p-stumm" },
        { teamId: "M-M", playerId: "p-fremd" },
      ],
    } as never;
    // p-stumm hat keine belastbare Moral -> steht bewusst NICHT drin (statt als 0 zu erscheinen,
    // was ihn faelschlich unter die Aufloesungs-Schwelle brechen wuerde).
    expect(buildTeamMoraleMap(gameState, "C-C")).toEqual({ "p-sauer": 12.5, "p-froh": 71 });
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

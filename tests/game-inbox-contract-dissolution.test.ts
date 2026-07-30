import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { isSeasonEndRosterPhase, SEASON_END_ROSTER_PHASES } from "@/lib/season/season-end-roster-window";

const REPO_ROOT = process.cwd();
const INBOX = readFileSync(join(REPO_ROOT, "lib/foundation/game-inbox-service.ts"), "utf8");
const PRIMARY_ACTION = readFileSync(
  join(REPO_ROOT, "lib/foundation/tabs/use-foundation-cross-tab-screen-primary-action.ts"),
  "utf8",
);

function stateWithPhase(gamePhase: string): GameState {
  return { gamePhase } as unknown as GameState;
}

/**
 * Die Vertragsaufloesung war nur sichtbar, wenn man am Saisonende zufaellig in den Kader
 * schaute. Bei einer Entscheidung mit Frist — wer nichts tut, behaelt den Spieler samt
 * seiner Unzufriedenheit — zu wenig. Die Inbox meldet offene Angebote jetzt aktiv.
 *
 * Der Erzeuger selbst laesst sich nicht sinnvoll isoliert aufrufen: er geht ueber
 * `assessPlayerMorale`, und das zieht Marktfit, Spielerwuensche und den Disziplin-Katalog
 * nach. Genau diese Quelle ist aber Absicht — die Kader-Ansicht rechnet mit derselben,
 * sonst meldete die Inbox Angebote, die der Kader nicht zeigt. Geprueft wird deshalb der
 * Phasen-Helfer echt und die Verdrahtung ueber den Quelltext.
 */
describe("Saisonende-Fenster: geteilte Phasenliste", () => {
  it("erkennt die Phasen, in denen Kader-Entscheidungen offenstehen", () => {
    expect(isSeasonEndRosterPhase(stateWithPhase("season_review"))).toBe(true);
    expect(isSeasonEndRosterPhase(stateWithPhase("transfer_sell_phase"))).toBe(true);
    expect(isSeasonEndRosterPhase(stateWithPhase("preseason_management"))).toBe(true);
  });

  it("schweigt während der laufenden Saison", () => {
    // Vorher gibt es keine Angebote — ein Hinweis waere eine Aufforderung zu etwas, das
    // man gar nicht tun kann.
    expect(isSeasonEndRosterPhase(stateWithPhase("season_active"))).toBe(false);
    expect(isSeasonEndRosterPhase({} as GameState)).toBe(false);
  });

  it("wird von Kader-Ansicht UND Inbox benutzt, nicht zweimal getippt", () => {
    // Zwei Listen waeren genau die Drift, bei der die Inbox etwas meldet, das der Kader
    // nicht freigibt — oder umgekehrt.
    expect(PRIMARY_ACTION).toContain("isSeasonEndRosterPhase(input.gameState)");
    expect(INBOX).toContain("isSeasonEndRosterPhase(input.gameState)");
    // Die Phasen stehen nur noch an einer Stelle.
    expect(PRIMARY_ACTION).not.toContain('"transfer_sell_phase",');
    expect(SEASON_END_ROSTER_PHASES.size).toBeGreaterThan(0);
  });
});

describe("Inbox: Vertragsauflösung auf Spielerwunsch", () => {
  it("erzeugt den Hinweis nur für gesteuerte Teams im Saisonende-Fenster", () => {
    expect(INBOX).toContain('if (input.controlMode !== "manual" || !isSeasonEndRosterPhase(input.gameState))');
  });

  it("bündelt alle Spieler eines Teams in EINEN Eintrag", () => {
    // Drei unzufriedene Spieler sollen die Inbox nicht fluten — entschieden wird ohnehin
    // gesammelt im Kader.
    expect(INBOX).toContain("`contract_dissolution_offer:${input.saveId}:${seasonId}:${input.team.teamId}`");
    expect(INBOX).toContain('playerId: offers.length === 1 ? offers[0].playerId : null,');
  });

  it("führt dorthin, wo man tatsächlich entscheidet", () => {
    expect(INBOX).toContain('targetView: "teams",');
    expect(INBOX).toContain('ctaLabel: "Im Kader entscheiden",');
  });

  it("nennt beide Seiten der Entscheidung", () => {
    // Annehmen und Ablehnen haben beide einen Preis — der Hinweis darf nicht nur den
    // Erloes bewerben.
    expect(INBOX).toContain("Annehmen bringt den vollen Verkaufspreis und spart den Buyout; ablehnen kostet den Spieler weiter Moral.");
  });

  it("holt die Moral aus derselben Quelle wie Kader und Profil", () => {
    expect(INBOX).toContain("assessPlayerMorale({");
    expect(INBOX).toContain("buildContractDissolutionOffers({");
  });
});

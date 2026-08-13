/**
 * ZWEI RECHENSTELLEN FUER DEN VERKAUFSPREIS — SIE MUESSEN GLEICH BLEIBEN.
 *
 * Im Spiel gibt es den VK-Preis an zwei unabhaengigen Orten:
 *  1. `buildTeamContractSeasonTable` (lib/market/contract-negotiation-preview.ts) -> `exitValue`,
 *     gelesen von der Kaderprofil-Karte ueber `use-foundation-cross-tab-teams-roster.ts`.
 *  2. `buildExpectedSellValueByPlayerId` (lib/market/transfermarkt-expected-sell-value.ts) ->
 *     `grossSalePrice`, gelesen von der Spielerliste und der Teams-Portraitkarte.
 *
 * Beide rechnen HEUTE dasselbe (`saleFactorBreakdown.salePrice`, Rueckfall Marktwert) — aber sie
 * rechnen es zweimal, und die zweite Stelle uebergibt die `saveId` nicht. Genau daran haengt in
 * `hasCurrentSeasonSaleFactorRanking` die Frage, ob der Leistungsanteil der laufenden Saison
 * ueberhaupt zaehlt. Gemessen am echten Spielstand (Saison 2, Spieltag 10) stimmen beide auf
 * 340 Kadereintraegen exakt ueberein — die Asymmetrie ist heute folgenlos, weil der Ledger den
 * Rang-Kontext auch ohne `saveId` findet.
 *
 * DAS IST DER GRUND FUER DIESEN TEST: eine Uebereinstimmung, die auf einem Zufall beruht, ist
 * keine Zusage. Wer eine der beiden Stellen anfasst, soll es hier merken und nicht erst, wenn im
 * Spiel zwei Geldbetraege fuer denselben Spieler nebeneinander stehen — an denen eine
 * Verkaufsentscheidung haengt.
 *
 * Der Test prueft WERTE ueber den ganzen Kader, nicht die Gleichheit zweier Quelltextzeilen.
 */
import { describe, expect, it } from "vitest";

import { buildTeamContractSeasonTable } from "@/lib/market/contract-negotiation-preview";
import { buildExpectedSellValueByPlayerId } from "@/lib/market/transfermarkt-expected-sell-value";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

describe("VK: Vertragstabelle gegen Verkaufswert-Karte", () => {
  it("liefert fuer jeden Kaderspieler denselben Betrag — ueber alle Teams", () => {
    const gameState = createSingleplayerGameState();
    const ausKarte = buildExpectedSellValueByPlayerId(gameState, { saveId: "test-save" });

    let verglichen = 0;
    for (const team of gameState.teams) {
      const tabelle = buildTeamContractSeasonTable({
        gameState,
        teamId: team.teamId,
        seasonLabelBase: "Saison 1",
      });

      for (const zeile of tabelle.rows) {
        const eintrag = ausKarte.get(zeile.playerId);
        if (!eintrag || zeile.exitValue == null) {
          continue;
        }
        expect(
          zeile.exitValue,
          `${team.teamId} / ${zeile.playerId}: Vertragstabelle ${zeile.exitValue} gegen Verkaufswert ${eintrag.grossSalePrice}`,
        ).toBeCloseTo(eintrag.grossSalePrice, 2);
        verglichen += 1;
      }
    }

    // Ohne diese Zeile koennte der Test gruen sein, weil er nichts verglichen hat.
    expect(verglichen, "kein einziger Spieler verglichen").toBeGreaterThan(100);
  });

  it("vergleicht gegen den BRUTTO-Preis, nicht gegen den Netto-Erloes", () => {
    // Die Unterscheidung ist der eigentliche Fehler gewesen, den Chris gesehen hat: die
    // Portraitkarte zeigte `expectedSellValue` (Brutto minus offenem Rest-Buyout), die
    // Spielerliste `grossSalePrice`. Dieser Fall haelt fest, dass es zwei verschiedene Zahlen
    // SIND — sonst wuerde der Test oben auch dann gruen bleiben, wenn wieder jemand das falsche
    // Feld nimmt.
    const gameState = createSingleplayerGameState();
    const ausKarte = buildExpectedSellValueByPlayerId(gameState, { saveId: "test-save" });

    const mitOffenemBuyout = [...ausKarte.values()].filter((eintrag) => eintrag.buyoutCost > 0.005);
    expect(mitOffenemBuyout.length, "kein Spieler mit offenem Buyout im Startkader").toBeGreaterThan(0);
    for (const eintrag of mitOffenemBuyout) {
      expect(eintrag.expectedSellValue).toBeCloseTo(eintrag.grossSalePrice - eintrag.buyoutCost, 2);
      expect(eintrag.expectedSellValue).not.toBeCloseTo(eintrag.grossSalePrice, 2);
    }
  });
});

import type { GameState } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTransfermarktSaleFactorBreakdown, normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { applySellPricingPolicyToBreakdown } from "@/lib/market/transfermarkt-sell-pricing-policy";
import { resolveTransfermarktSellProceeds } from "@/lib/market/transfermarkt-sell-proceeds";

export type ExpectedSellValueEntry = {
  /** Brutto-Verkaufspreis laut Sale-Factor (Bracket-Rang × MW), Fallback MW. */
  grossSalePrice: number;
  /**
   * Offener Buyout — dieselbe Zahl, die der Verkaufsdialog zeigt und die Ausführung abbucht.
   * Ob das laufende Vertragsjahr noch darin steckt, hängt daran, ob das Gehalt dieser Saison
   * schon gebucht wurde (`resolveElapsedContractSeasonsForBuyout`).
   */
  buyoutCost: number;
  /** Netto-Erlös = Brutto − Buyout; kann negativ sein (Mehrjahresvertrag). */
  expectedSellValue: number;
  /**
   * Tatsächlich gezahlter Kaufpreis (RosterEntry.purchasePrice, display-skaliert).
   * `null` bei Eigengewächsen/Startkader-Einträgen ohne dokumentierten Kaufpreis —
   * dort ist "—" die ehrliche Antwort, KEIN Rückgriff auf den (berechneten) Marktwert
   * wie in `economy.purchasePrice`, der wäre eine erfundene Basis.
   */
  purchasePrice: number | null;
  /** Gewinn/Verlust eines Verkaufs vs. gezahltem Kaufpreis (Netto − Kaufpreis); `null` ohne Kaufpreis. */
  profitVsPurchase: number | null;
};

/**
 * Erwarteter Verkaufserlös für ALLE Kaderspieler in einem Durchgang.
 *
 * WARUM eine Batch-Funktion statt der bestehenden Sell-Preview: Die Spielerliste rendert bis zu
 * ~330 Zeilen — ein Server-Preview (`previewLocalTransfermarktSell` /
 * `ai-transfermarkt-sell-preview-service`) pro Zeile ist ausgeschlossen. Die eigentliche Rechnung
 * hinter `buildExpectedSellValue` (ai-transfermarkt-sell-preview-service.ts) ist aber rein
 * synchron: Sale-Factor-Breakdown (`buildTransfermarktSaleFactorBreakdown`, inkl. MD10-Freeze-
 * Fenster und Bracket-Rang-Pool, dessen Rank-Kontext pro GameState per WeakMap gecacht ist) plus
 * Buyout-Abzug (`resolveTransfermarktSellProceeds`).
 *
 * KEINE EIGENE SICHT MEHR: Diese Spalte rechnete früher bewusst anders als der Verkaufs-Flow
 * (`seasonsElapsed: 1` — "Saisonende-Sicht") und sagte damit für denselben Spieler einen anderen
 * Buyout voraus als der Dialog, der dann abbuchte. Gemeldet als "da schau, das passt nicht".
 * Jetzt entscheidet `resolveElapsedContractSeasonsForBuyout` am Spielstand, ob das laufende
 * Vertragsjahr noch offen ist — für diese Spalte, für die Verträge-Karte, für Vorschau und
 * Ausführung gleichermaßen.
 *
 * Nur Spieler MIT Roster-Eintrag bekommen einen Wert: Free Agents stehen in keinem Kader und
 * können nicht verkauft werden — für sie ist "—" (kein Eintrag in der Map) die ehrliche Antwort,
 * kein geschätzter Wert. Ebenso fehlt der Eintrag, wenn kein belastbarer Marktwert existiert
 * (`factorSource: "missing_market_value"` → salePrice/MW beide null).
 */
export function buildExpectedSellValueByPlayerId(
  gameState: GameState,
  options?: { saveId?: string | null },
): Map<string, ExpectedSellValueEntry> {
  const result = new Map<string, ExpectedSellValueEntry>();
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));

  for (const rosterEntry of gameState.rosters) {
    const player = playersById.get(rosterEntry.playerId);
    if (!player) {
      continue;
    }

    const rohBreakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterEntry, {
      saveId: options?.saveId ?? null,
    });
    /**
     * DIE DRITTE ANZEIGE ZIEHT NACH — und damit rechnen alle drei dasselbe.
     *
     * Bei Ticket #44 („+10,7 oben, +9,3 im Profil — was ist nun richtig?") fehlte der
     * Vertragstabelle `applySellPricingPolicyToBreakdown`. Entschieden hat die Buchung: der
     * gemeldete Spieler wurde zwoelf Minuten spaeter fuer `fee 28.09` verkauft, und das ist die
     * Zahl MIT dieser Stufe. Die Vertragstabelle wurde deshalb korrigiert.
     *
     * Damit stand diese Karte hier als einzige noch ohne die Stufe da — und `main` hat inzwischen
     * einen Test, der genau die Gleichheit der beiden Rechenstellen festhaelt
     * (`vk-zwei-rechenstellen-bleiben-gleich`). Er wurde rot, und er hatte recht: 31,78 gegen
     * 37,39 an einem einzigen Spieler.
     *
     * Die Reihenfolge der Korrektur ist kein Zufall. Die Ausfuehrung
     * (`executeLocalTransfermarktSell`) nimmt die bereinigte Fassung — wer sich ihr angleicht,
     * hat recht; wer die rohe zeigt, verspricht Geld, das nie ankommt.
     */
    const breakdown = applySellPricingPolicyToBreakdown({
      gameState,
      teamId: rosterEntry.teamId,
      player,
      rosterEntry,
      baseBreakdown: rohBreakdown,
      // Der Kaderdruck bemisst sich am Kader NACH diesem einen Verkauf — sonst bewertet er einen
      // Kader, den es danach nicht mehr gibt.
      rosterAfter: Math.max(
        0,
        gameState.rosters.filter((eintrag) => eintrag.teamId === rosterEntry.teamId).length - 1,
      ),
    }).breakdown;
    const economy = resolvePlayerEconomyContract({ player, rosterEntry });
    // Gleiche Fallback-Kette wie `buildExpectedSellValue` im AI-Sell-Preview-Service:
    // Sale-Factor-Preis, sonst Marktwert — ohne beides gibt es keinen ehrlichen Wert.
    const grossSalePrice = breakdown.salePrice ?? economy.marketValue ?? null;
    if (grossSalePrice == null) {
      continue;
    }

    // NUR der echte gezahlte Kaufpreis vom Roster-Eintrag (display-normalisiert, Raw-Cents >1000
    // werden skaliert). Bewusst NICHT `economy.purchasePrice`: der fällt auf den berechneten
    // Marktwert zurück und würde für Eigengewächse/Startkader eine erfundene G/V-Basis vortäuschen.
    const purchasePrice = normalizeVisibleRosterMoney(rosterEntry.purchasePrice, null);

    const proceeds = resolveTransfermarktSellProceeds({
      rosterEntry,
      grossSalePrice,
      purchasePrice,
      gameState,
      // KEIN `seasonsElapsed` mehr: ob das laufende Vertragsjahr noch in der Ablöse steckt,
      // entscheidet `resolveElapsedContractSeasonsForBuyout` am Spielstand — dieselbe Antwort,
      // die auch Verkaufsdialog und Ausführung bekommen.
    });

    result.set(player.id, {
      grossSalePrice: proceeds.grossSalePrice,
      buyoutCost: proceeds.buyoutCost,
      expectedSellValue: proceeds.netProceeds,
      purchasePrice,
      profitVsPurchase: proceeds.netProfitVsPurchase,
    });
  }

  return result;
}

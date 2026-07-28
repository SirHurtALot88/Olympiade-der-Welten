import type { GameState } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTransfermarktSaleFactorBreakdown, normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { resolveTransfermarktSellProceeds } from "@/lib/market/transfermarkt-sell-proceeds";

export type ExpectedSellValueEntry = {
  /** Brutto-Verkaufspreis laut Sale-Factor (Bracket-Rang × MW), Fallback MW. */
  grossSalePrice: number;
  /**
   * Offener Buyout aus SAISONENDE-Sicht: das laufende Vertragsjahr gilt als verbraucht
   * (Laufzeit −1), d. h. bei Restlaufzeit 1 ("expiring") ist der Buyout 0.
   */
  buyoutCost: number;
  /** Netto-Erlös = Brutto − Saisonende-Buyout; kann negativ sein (Mehrjahresvertrag). */
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
 * SAISONENDE-SICHT (bewusste Abweichung von der Sofort-Verkaufs-Vorschau): Die Spalte beantwortet
 * "Was bringt ein Verkauf am SAISONENDE?" — dort ist das laufende Vertragsjahr abbezahlt
 * (`statusAfterSeasonTick` zählt `contractLength` herunter und kürzt das erste Schedule-Jahr weg).
 * Deshalb wird der Buyout mit `seasonsElapsed: 1` gerechnet: das erste (laufende) Vertragsjahr
 * fällt aus dem Rest-Schedule, auslaufende Verträge (Restlaufzeit 1 = "expiring") haben KEINEN
 * Buyout mehr. Der echte Verkaufs-Flow (`previewLocalTransfermarktSell` /
 * `executeLocalTransfermarktSell`) rechnet weiterhin mit der vollen Restlaufzeit und bleibt
 * unberührt — nur diese Übersichtsspalte modelliert die Saisonende-Sicht.
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

    const breakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterEntry, {
      saveId: options?.saveId ?? null,
    });
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
      // Saisonende-Sicht (Laufzeit −1): das laufende Vertragsjahr fällt aus dem Buyout —
      // siehe Funktions-Kommentar. Der echte Sell-Flow nutzt weiterhin den Default 0.
      seasonsElapsed: 1,
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

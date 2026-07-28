import type { GameState } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { resolveTransfermarktSellProceeds } from "@/lib/market/transfermarkt-sell-proceeds";

export type ExpectedSellValueEntry = {
  /** Brutto-Verkaufspreis laut Sale-Factor (Bracket-Rang × MW), Fallback MW. */
  grossSalePrice: number;
  /** Offener Buyout aus dem Restvertrag (calculateOpenBuyoutCost). */
  buyoutCost: number;
  /** Netto-Erlös = Brutto − Buyout; kann negativ sein (Mehrjahresvertrag). */
  expectedSellValue: number;
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
 * Buyout-Abzug (`resolveTransfermarktSellProceeds`). Diese Funktion spiegelt exakt diese beiden
 * Schritte — KEINE eigene Formel, damit die Spalte denselben Wert zeigt wie der Sell-Dialog.
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

    const proceeds = resolveTransfermarktSellProceeds({
      rosterEntry,
      grossSalePrice,
      purchasePrice: economy.purchasePrice,
      gameState,
    });

    result.set(player.id, {
      grossSalePrice: proceeds.grossSalePrice,
      buyoutCost: proceeds.buyoutCost,
      expectedSellValue: proceeds.netProceeds,
    });
  }

  return result;
}

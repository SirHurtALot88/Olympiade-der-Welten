import type { ExpectedSellValueEntry } from "@/lib/market/transfermarkt-expected-sell-value";

/**
 * VK-Anzeige der Kader-Portraitkarte (Teams-Ansicht) — DIESELBE Definition wie die
 * "VK-Wert"-Spalte der Spielerliste (`FoundationPlayersTableNewLook.tsx`, Spalte `sellValue`):
 * Brutto-Verkaufspreis (Marktwert × Verkaufsfaktor), NICHT der Netto-Erlös.
 *
 * BEFUND (Chris, Portraitkarte zeigte 30,4 statt Brutto 41,14 oder Netto 12,34 für denselben
 * Spieler): die Karte griff auf `ExpectedSellValueEntry.expectedSellValue` (Netto = Brutto minus
 * Rest-Buyout) zu, während die Spielerliste `grossSalePrice` (Brutto) zeigt — zwei verschiedene
 * Felder DESSELBEN Objekts, macht zwei verschiedene Zahlen für denselben Spieler zur gleichen
 * Zeit. Die konkret gemeldete Zahl 30,4 ließ sich am synchronisierten Spielstand mit KEINEM der
 * beiden Felder exakt reproduzieren (Brutto 41,14 / Buyout 28,80 / Netto 12,34) — das Live-Spiel
 * ist zwischen Screenshot und Sync weitergelaufen (der Buyout hängt am Vertragsjahr-Fortschritt,
 * `resolveElapsedContractSeasonsForBuyout`). Die Rechenkette selbst (erst Marktwert × Faktor,
 * DANN Buyout abziehen) ist aber genau die, die auch hier gilt — siehe
 * `buildTransfermarktSaleFactorBreakdown` (lib/market/transfermarkt-sale-factor.ts) und
 * `resolveTransfermarktSellProceeds` (lib/market/transfermarkt-sell-proceeds.ts).
 *
 * Buyout und Netto bleiben trotzdem sichtbar — nur nicht mehr als Hauptzahl, sondern im Tooltip.
 */
export type TeamsPortraitSellValueDisplay = {
  /** = entry.grossSalePrice — dieselbe Zahl wie `row.sellPreview.grossSalePrice` in der Spielerliste. */
  vkValue: number;
  /** VK minus Marktwert — der Aufschlag/Abschlag des Verkaufsfaktors. `null` ohne Marktwert. */
  vkDeltaVsMarketValue: number | null;
  tooltip: string;
};

export function resolveTeamsPortraitSellValueDisplay(input: {
  entry: Pick<ExpectedSellValueEntry, "grossSalePrice" | "buyoutCost" | "expectedSellValue">;
  marketValue: number | null;
}): TeamsPortraitSellValueDisplay {
  const { entry, marketValue } = input;
  const vkValue = entry.grossSalePrice;
  const vkDeltaVsMarketValue = marketValue != null && Number.isFinite(marketValue) ? vkValue - marketValue : null;

  const tooltip =
    `VK — erwarteter Verkaufspreis = Marktwert × Verkaufsfaktor (Brutto), in Klammern hinter dem Marktwert.` +
    (entry.buyoutCost > 0
      ? ` Rest-Buyout ${entry.buyoutCost.toFixed(2)} Mio noch offen → Netto bei Verkauf jetzt ${entry.expectedSellValue.toFixed(2)} Mio.`
      : ` Kein offener Buyout mehr — Netto bei Verkauf jetzt entspricht dem Brutto.`);

  return { vkValue, vkDeltaVsMarketValue, tooltip };
}

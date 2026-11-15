/**
 * Lebenszyklus lange nicht verkaufter Artikel (Chris, 13.11.2026): Ein Artikel, der sich seit Monaten nicht verkauft, ist nicht „zu günstig“,
 * selbst wenn die Marktformel einen höheren Preis nennt: zu dem Preis kauft ihn niemand.
 *
 * - Preis senken:      > 5 € VK, Bestand da, seit 180 Tagen kein Verkauf  -> günstiger machen (der Ladenhüter-Abschlag zeigt wohin)
 * - Auslaufen lassen:  VK schon am Mindestpreis (unter 6 €), Bestand da, seit 180 Tagen kein Verkauf -> nicht nachkaufen, Rest abverkaufen
 * - Auslisten:         wie Auslaufen lassen, aber seit 365 Tagen kein Verkauf -> Angebot beenden (bündeln oder verschenken statt Gebühren)
 * Nie verkaufte Artikel gehören nicht dazu (zu neu oder falsch bepreist, siehe Preiskorrektur).
 */
export const LIFECYCLE = { staleDays: 180, delistDays: 365, cheapVk: 5.99 };

export type Lifecycle = "preis_senken" | "auslaufen" | "auslisten";

export function assessLifecycle(i: { active: boolean; hidden: boolean; stock: number; vk: number; daysSinceSale: number | null }): Lifecycle | null {
  if (!i.active || i.hidden || i.stock <= 0 || i.daysSinceSale === null || !(i.vk > 0)) return null;
  if (i.daysSinceSale < LIFECYCLE.staleDays) return null;
  const cheap = i.vk <= LIFECYCLE.cheapVk;
  if (!cheap) return "preis_senken";
  return i.daysSinceSale >= LIFECYCLE.delistDays ? "auslisten" : "auslaufen";
}

export const LIFECYCLE_LABEL: Record<Lifecycle, { label: string; hint: string }> = {
  preis_senken: { label: "Preis senken", hint: "Seit über 180 Tagen kein Verkauf: zu dem Preis kauft ihn niemand. Günstiger einstellen (Empfohlen zeigt den Preis mit Ladenhüter-Abschlag)." },
  auslaufen: { label: "Auslaufen lassen", hint: "Am Mindestpreis und seit über 180 Tagen kein Verkauf: nicht nachkaufen, den Rest verkaufen lassen." },
  auslisten: { label: "Auslisten", hint: "Am Mindestpreis und seit über einem Jahr kein Verkauf: Angebot beenden, die Karten bündeln (Lot) oder anders loswerden." },
};


/**
 * Sortiment-Status je Artikel (Konzept PREIS_DYNAMIK_KONZEPT.md, Chris 13.11.): Behalten, Beobachten, Preis prüfen (geschützt) oder eine
 * der drei Massnahmen oben. Die Uhr ist "Tage am aktuellen Preis ohne Verkauf": seit dem spaeteren aus letztem Verkauf und letzter
 * Preisaenderung (nie verkaufte: seit dem geschaetzten Alter des Angebots). Eine Preisaenderung setzt die Uhr zurueck, damit ein
 * frisch korrigierter Artikel nicht gleich als Ladenhueter gilt.
 */
export type SortimentStatus = "behalten" | "beobachten" | "pruefen" | Lifecycle;

export interface SortimentInput {
  active: boolean;
  hidden: boolean;
  stock: number;
  vk: number;
  units365: number;
  /** Gewinn je Stueck (DB II) bei heutigem Preis; null = unbekannt. */
  unitProfit: number | null;
  lastSoldDays: number | null;
  lastPriceChangeDays: number | null;
  /** Geschaetztes Mindestalter des eBay-Angebots in Tagen (nur fuer nie verkaufte). */
  listedDays: number | null;
}

export function daysAtPrice(i: Pick<SortimentInput, "lastSoldDays" | "lastPriceChangeDays" | "listedDays">): number | null {
  const base = i.lastSoldDays ?? i.listedDays;
  if (base === null && i.lastPriceChangeDays === null) return null;
  // spaeteres Ereignis = kleinere Tage-Zahl
  const candidates = [i.lastSoldDays, i.lastPriceChangeDays].filter((d): d is number => d !== null);
  return candidates.length > 0 ? Math.min(...candidates) : base;
}

export function assessSortiment(i: SortimentInput): { status: SortimentStatus; reason: string } | null {
  if (!i.active || i.hidden || i.stock <= 0) return null;
  // Frisch geaendert: abwarten, die Wirkung des neuen Preises ist noch nicht messbar
  if (i.lastPriceChangeDays !== null && i.lastPriceChangeDays <= 30) return { status: "pruefen", reason: `Preis erst vor ${i.lastPriceChangeDays} Tagen geändert: abwarten, bevor etwas entschieden wird.` };
  if (i.units365 >= 2 || (i.units365 >= 1 && (i.unitProfit ?? 0) >= 3)) return { status: "behalten", reason: `${i.units365} Verkauf${i.units365 === 1 ? "" : "e"} in 365 Tagen${i.unitProfit !== null ? `, ${i.unitProfit.toFixed(2).replace(".", ",")} € Gewinn je Stück` : ""}.` };
  const neverSold = i.lastSoldDays === null && i.units365 === 0;
  if (neverSold && (i.listedDays === null || i.listedDays < 365)) return { status: "pruefen", reason: i.listedDays === null ? "Nie verkauft, Alter des Angebots unbekannt: Preis und Titel prüfen." : `Nie verkauft, erst seit etwa ${i.listedDays} Tagen online: Preis und Titel prüfen.` };
  const days = daysAtPrice(i);
  const action = assessLifecycle({ active: i.active, hidden: i.hidden, stock: i.stock, vk: i.vk, daysSinceSale: days });
  if (action) return { status: action, reason: `${days} Tage am aktuellen Preis ohne Verkauf.` };
  return { status: "beobachten", reason: i.units365 === 1 ? "1 Verkauf in 365 Tagen mit geringem Gewinn." : `${days ?? "?"} Tage am aktuellen Preis ohne Verkauf.` };
}

export const SORTIMENT_LABEL: Record<SortimentStatus, string> = {
  behalten: "Behalten",
  beobachten: "Beobachten",
  pruefen: "Preis prüfen",
  preis_senken: "Preis senken",
  auslaufen: "Auslaufen lassen",
  auslisten: "Auslisten",
};

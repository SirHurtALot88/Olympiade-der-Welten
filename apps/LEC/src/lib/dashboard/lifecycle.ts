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

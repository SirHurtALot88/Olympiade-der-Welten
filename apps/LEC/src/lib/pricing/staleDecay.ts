/**
 * Ladenhüter-Abschlag (Chris, 13.11.): Verkauft sich ein Artikel mit Bestand lange nicht, bleibt der
 * Formelpreis (25–33 % Marge, Marktdeckel) nicht für immer stehen, sondern der empfohlene VK sinkt mit der Zeit.
 * Ab 120 Tagen ohne Verkauf: je weitere 30 Tage 5 % weniger, höchstens 30 %. Untergrenze ist der VK, bei dem der
 * Deckungsbeitrag null ist (Kosten gedeckt, nichts verdient), und nie unter 4,99 €.
 */
export const STALE_DECAY = { startDays: 120, stepDays: 30, stepPct: 0.05, maxPct: 0.3 };

export function staleDiscountPct(daysSinceSale: number | null, stock: number): number {
  if (daysSinceSale === null || stock <= 0 || daysSinceSale < STALE_DECAY.startDays) return 0;
  const steps = Math.floor((daysSinceSale - STALE_DECAY.startDays) / STALE_DECAY.stepDays) + 1;
  return Math.min(STALE_DECAY.maxPct, steps * STALE_DECAY.stepPct);
}

/** Wendet den Abschlag auf die Zielspanne an; `floor` = VK mit Deckungsbeitrag null. */
export function applyStaleDiscount(target: { min: number; opt: number }, pct: number, floor: number, priceFloor = 4.99): { min: number; opt: number } {
  if (pct <= 0) return target;
  const lowest = Math.max(priceFloor, Number.isFinite(floor) ? floor : 0);
  const min = Math.max(lowest, target.min * (1 - pct));
  const opt = Math.max(min, target.opt * (1 - pct));
  // Nie hoeher als vorher (wenn die Untergrenze selbst ueber dem Ziel liegt, bleibt das Ziel).
  return { min: Math.min(min, target.min), opt: Math.min(opt, target.opt) };
}

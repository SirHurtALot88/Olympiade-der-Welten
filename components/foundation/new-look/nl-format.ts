/**
 * New-Look Geld-Formatierung ("Neuer Look" Design-System).
 *
 * Beträge liegen bereits in Mio-Einheit vor und werden app-weit EINHEITLICH als
 * "Mio" mit de-DE-Komma und genau einer Nachkommastelle dargestellt — auch kleine
 * Beträge (0,1 Mio statt "100k"), damit derselbe Wert nie in zwei Einheiten erscheint.
 */
export function formatNlMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  // Clamp a magnitude that rounds to zero so we never render "-0,0 Mio".
  const normalized = Math.round(value * 10) === 0 ? 0 : value;
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(normalized)} Mio`;
}

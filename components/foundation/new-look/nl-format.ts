/**
 * New-Look Geld-Formatierung ("Neuer Look" Design-System).
 *
 * Kompakte "Mio"/"k"-Darstellung für Beträge, die bereits in Mio vorliegen —
 * ursprünglich lokal in `HomeV2NewLook.tsx` definiert, hier 1:1 (byte-für-byte
 * identisches Verhalten) für alle Neuer-Look-Screens geteilt.
 */
export function formatNlMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  if (Math.abs(value) < 1 && value !== 0) {
    const thousands = value * 1000;
    // Clamp a magnitude that rounds to zero so we never render "-0k".
    const normalized = Math.round(thousands) === 0 ? 0 : thousands;
    return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(normalized)}k`;
  }
  // Clamp a magnitude that rounds to zero so we never render "-0,0 Mio".
  const normalized = Math.round(value * 10) === 0 ? 0 : value;
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(normalized)} Mio`;
}

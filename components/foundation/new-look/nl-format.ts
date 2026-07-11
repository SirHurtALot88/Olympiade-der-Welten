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
    return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value * 1000)}k`;
  }
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} Mio`;
}

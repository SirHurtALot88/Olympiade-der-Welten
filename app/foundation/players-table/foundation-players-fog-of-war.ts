/**
 * Fog-of-war Hilfsfunktion für verdecktes Spieler-Potenzial (PO) — geteilt
 * zwischen `FoundationPlayersTableNewLook.tsx` (Tabellenzeilen + Name-Hover)
 * und `FoundationPlayersLeaderPodium.tsx` (Podium-Hover), damit beide exakt
 * dieselbe Unschärfe-Logik verwenden statt einer zweiten, abweichenden Kopie.
 * In eine eigene Datei ausgelagert (statt Re-Export aus der Tabellen-Datei),
 * weil das Podium in die Tabellen-Datei importiert wird — ein Re-Export aus
 * dort würde einen zirkulären Modul-Import erzeugen.
 *
 * Für Spieler, die NICHT zum vom Menschen geführten Team gehören, ist das
 * Potenzial (PO) verdeckt. Ein konkreter PO-Wert würde in `NlAbilityStars`
 * als volle Sterne rendern (z. B. ★★★★★) und so fremdes Potenzial leaken.
 * Statt dessen wird ein unscharfer PO-BEREICH (Score-Space 35..99) übergeben,
 * damit die Hohl-Kontur-Behandlung (`known={false}`) den Bereich als
 * "geschätzt" zeichnet. Bandbreite konsistent mit der ungescouteten
 * Scouting-Unsicherheit (±16, vgl. `getScoutingUncertainty(0)` in
 * `lib/progression/player-potential-service.ts`), auf 35..99 geklammert. Es
 * wird KEINE PO-Zahl gerendert — nur die Sternmathematik nutzt den Bereich
 * (die `PO ≥ CA`-Klammerung passiert in `NlAbilityStars`).
 */
const NL_FOG_PO_BAND = 16;

export function getFoggedPoScoreRange(potential: number | null | undefined): { min: number; max: number } | null {
  if (potential == null || !Number.isFinite(potential) || potential <= 0) {
    return null;
  }
  const hidden = Math.round(Math.min(99, Math.max(1, potential)));
  return {
    min: Math.round(Math.min(99, Math.max(35, hidden - NL_FOG_PO_BAND))),
    max: Math.round(Math.min(99, Math.max(35, hidden + NL_FOG_PO_BAND))),
  };
}

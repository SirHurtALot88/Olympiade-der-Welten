/**
 * EINSATZLISTE-REVAMP, PAKET 1 — reine Anzeige-Helfer (Slot-Kürzel, Slot-Farben, Gold-Rahmen).
 *
 * Konzept: docs/design/aufstellung-screen-rework-08-11.md (Fable, Abschnitte 5, 7, 8),
 * Architektur und Entscheidungen: docs/design/einsatzliste-revamp-architektur-08-11.md.
 *
 * NUR ANZEIGE. Nichts hier wird von Resolve, Arena-Adapter oder Motor gelesen; die Datei
 * importiert bewusst nichts aus dem Simulations- oder Matrixpfad. Sie bekommt fertige Zahlen
 * (Slot-Projektionen, Disziplin-Eignung) und entscheidet nur, wie sie aussehen.
 */

/**
 * SECHS POSITIONSFARBEN — die Farbe hängt am Slot-Index (D1-1 … D1-6), nicht an der Rolle.
 * Sechs Farben lernt man an einem Abend; 20 Disziplinen x 6 Rollen wären 120.
 *
 * Index = `LegacyLineupLabSlot.slotIndex`, also genau die Zahl, die die Einsatzliste als
 * „D1-3" schon zeigt, und zugleich die Stelle in `DISCIPLINE_ROLE_THEMES` (bzw. in
 * `ROLE_THEME_IDS_BY_SLOT_COUNT` bei Battlefield), aus der der Arena-Adapter die Rolle
 * liest. Dieselbe Zahl auf beiden Seiten, ohne Übersetzung.
 *
 * Validiert mit der dataviz-Palettenprüfung (validate_palette.js, dunkles Thema, gegen
 * --nl-panel #131a26 und --nl-panel-2 #0f1621, benachbarte Paare): Helligkeitsband, Chroma,
 * CVD-Abstand 12,1, Normalsicht 17,8, Kontrast >= 3:1 — alles PASS. Über ALLE Paare (wichtig
 * für das spätere Mini-Feld, wo die Marken nicht in Reihe stehen) reicht es nicht; deshalb
 * steht das KÜRZEL immer daneben, die Farbe ist nie das einzige Merkmal. Bewusst abseits der
 * reservierten Töne: --nl-good (grün), --nl-warn/--nl-gold (gelb), --nl-risk (rot).
 * Nur Rand oder Kürzel-Chip, nie Flächenfüllung.
 */
export const EINSATZLISTE_SLOTFARBEN = [
  "#bd5e84", // 1 Rosé
  "#329cd4", // 2 Himmelblau
  "#a54f11", // 3 Rost
  "#8b53d4", // 4 Violett
  "#c97147", // 5 Kupfer
  "#b8479a", // 6 Pflaume
] as const;

export function slotFarbe(slotIndex: number): string {
  const n = EINSATZLISTE_SLOTFARBEN.length;
  const i = Number.isFinite(slotIndex) ? ((Math.trunc(slotIndex) % n) + n) % n : 0;
  return EINSATZLISTE_SLOTFARBEN[i]!;
}

/**
 * Grundregel wie im Arena-Board (`slotKuerzel` in battle-mode.engine.js): zwei Wörter ->
 * beide Anfangsbuchstaben („Hold Line" -> HL), ein Wort -> die ersten zwei Buchstaben.
 */
export function slotKuerzel(label: string): string {
  const woerter = label.trim().split(/\s+/).filter(Boolean);
  if (woerter.length === 0) return "–";
  const roh = woerter.length >= 2 ? woerter[0]![0]! + woerter[1]![0]! : woerter[0]!.slice(0, 2);
  return roh.toUpperCase();
}

/**
 * Kürzel für ALLE Slots einer Disziplin, eindeutig. Die Grundregel kollidiert heute zweimal
 * (Staffel: Curve Runner / Chase Runner -> CR; Breaking: Standhalten / Steingesicht -> ST).
 * Der spätere Slot nimmt dann seinen ersten Buchstaben plus den nächsten noch freien
 * Buchstaben seines Labels (Chase Runner -> CH, Steingesicht -> SE). Deterministisch, ohne
 * Disziplin für Disziplin eine Liste zu pflegen.
 */
export function slotKuerzelFuerListe(labels: readonly string[]): string[] {
  const vergeben = new Set<string>();
  return labels.map((label) => {
    let kuerzel = slotKuerzel(label);
    if (vergeben.has(kuerzel)) {
      const buchstaben = label.replace(/[^\p{L}\p{N}]/gu, "");
      const erster = buchstaben[0] ?? "";
      for (const weiterer of buchstaben.slice(1)) {
        const kandidat = (erster + weiterer).toUpperCase();
        if (!vergeben.has(kandidat)) {
          kuerzel = kandidat;
          break;
        }
      }
    }
    vergeben.add(kuerzel);
    return kuerzel;
  });
}

/**
 * GOLDENER RAHMEN: die Top-N des Kaders nach BASIS-EIGNUNG in dieser Disziplin
 * (N = Slotzahl der Seite). Gold sagt „gehört in diese Disziplin", unabhängig vom Slot —
 * die Slot-Passung zeigt die Zahl daneben.
 *
 * Gleichstand: der Name entscheidet (stabil, sonst flackert das Gold zwischen Renders).
 * Spieler ohne Eignungswert zählen nicht mit.
 */
export function topNNachEignung(
  spieler: Iterable<{ id: string; name: string; eignung: number | null | undefined }>,
  n: number,
): Set<string> {
  const anzahl = Math.max(0, Math.trunc(n));
  if (anzahl === 0) return new Set();
  const mitWert = [...spieler].filter(
    (eintrag): eintrag is { id: string; name: string; eignung: number } =>
      eintrag.eignung != null && Number.isFinite(eintrag.eignung),
  );
  mitWert.sort((a, b) => (b.eignung !== a.eignung ? b.eignung - a.eignung : a.name.localeCompare(b.name, "de")));
  return new Set(mitWert.slice(0, anzahl).map((eintrag) => eintrag.id));
}

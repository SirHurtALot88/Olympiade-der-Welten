/**
 * EINSATZLISTE-REVAMP, PAKET 1 — reine Anzeige-Helfer (Slot-Kürzel, Slot-Farben, Gold-Rahmen).
 *
 * Konzept: docs/design/aufstellung-screen-rework-08-11.md (Fable, Abschnitte 5, 7, 8),
 * Architektur und Entscheidungen: docs/design/einsatzliste-revamp-architektur-08-11.md.
 *
 * NUR ANZEIGE. Nichts hier wird von Resolve, Arena-Adapter oder Motor gelesen; die Datei
 * importiert bewusst nichts aus dem Simulations- oder Matrixpfad. Sie bekommt fertige Zahlen
 * (Slot-Projektionen) und entscheidet nur, wie sie aussehen.
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
 * GOLDENER RAHMEN = BESTBESETZUNG, NACH DEM SLOTWERT.
 *
 * Chris 08.11. (Fable-Rework Abschnitt 13 Frage 2): „Zu Punkt 2, den Rahmen machen wir nach dem
 * Slotwert." Lesart nach Fables visuellem Gesamtkonzept
 * (`docs/design/einsatzliste-gesamtkonzept-visuell-08-11.md` Abschnitt 5): Gold trägt, wer in
 * DIESEM Slot den höchsten Wert des GANZEN Kaders hat — „niemand im Kader wäre hier besser".
 * Höchstens ein Gold je Slot, bei perfekter Aufstellung genau N (= Slotzahl) auf dem Feld.
 * Steht der Kader-Beste woanders oder gar nicht im Aufgebot, zeigt der Slot das gestrichelt
 * („Gold verschenkt").
 *
 * Wert = `projectedScore` aus `playerBestSlotSummaryByActivePlayerId`: dieselbe Projektion, die
 * die Einsatzliste an Slot, Kader-Zeile und Drag-Vorschau zeigt.
 *
 * Diese Lesart ist Fables Vorschlag und noch nicht von Chris bestätigt. Meint er stattdessen
 * „die N höchsten Slotwerte auf dem Feld", ändert sich nur diese Funktion.
 *
 * Gleichstand: der Name entscheidet (stabil, sonst flackert das Gold zwischen Renders).
 * Spieler ohne Wert in einem Slot zählen dort nicht mit.
 */
export type Bestbesetzung = { id: string; name: string; wert: number };

export function bestbesetzungJeSlot(input: {
  slotKeys: Iterable<string>;
  slotWerteJeSpieler: Iterable<[string, ReadonlyArray<{ slotKey: string; projectedScore: number | null }>]>;
  nameVon: (activePlayerId: string) => string;
}): Map<string, Bestbesetzung | null> {
  const beste = new Map<string, Bestbesetzung>();
  for (const [id, eintraege] of input.slotWerteJeSpieler) {
    const name = input.nameVon(id);
    for (const eintrag of eintraege) {
      const wert = eintrag.projectedScore;
      if (wert == null || !Number.isFinite(wert)) continue;
      const bisher = beste.get(eintrag.slotKey);
      if (!bisher || wert > bisher.wert || (wert === bisher.wert && name.localeCompare(bisher.name, "de") < 0)) {
        beste.set(eintrag.slotKey, { id, name, wert });
      }
    }
  }
  return new Map([...input.slotKeys].map((key) => [key, beste.get(key) ?? null] as const));
}

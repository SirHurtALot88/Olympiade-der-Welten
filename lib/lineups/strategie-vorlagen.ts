/**
 * STRATEGIE-VORLAGEN JE DISZIPLIN — Katalog als Daten (Pilot Wettessen, 17.11.).
 *
 * Konzept: docs/design/strategie-templates-16-11.md (Abschnitte 3.1, 4.1, 6.1, 7 Schritt 1),
 * von Chris am 17.11. mit den fünf Empfehlungen aus Abschnitt 8 freigegeben.
 *
 * Eine Vorlage ändert, WAS die Spieler einer Mannschaft tun, nie WIE GUT: keine Stat, kein
 * Rezept-Gewicht, keine Eignungsmatrix. „Neutral" ist KEIN Eintrag dieser Tabelle, sondern die
 * Abwesenheit des Feldes `strategie` im `LineupDraftModifierSide` (Abschnitt 1.3 Punkt 1) — nur so
 * bleibt der Motor ohne Vorlage bit-identisch.
 *
 * Diese Tabelle trägt nur Kennung und Texte. Die Wirkung (welche Stufe in welche Richtung) steht im
 * Motor neben der Mechanik (`STRATEGIE_VORLAGEN` in public/mockups/battle-mode.engine.js); ein Test
 * (tests/strategie-vorlagen-wettessen.test.ts) hält beide Listen deckungsgleich.
 *
 * Alles hängt an der Flagge `OLY_STRATEGIE_VORLAGEN` (Standard AUS). Im Browser sieht Next.js nur
 * `NEXT_PUBLIC_*`-Variablen, und die werden beim Bauen eingesetzt — wer die Vorlagen einschaltet,
 * setzt deshalb BEIDE: `OLY_STRATEGIE_VORLAGEN=1` (Server: Vorlauf/Buchung) und
 * `NEXT_PUBLIC_OLY_STRATEGIE_VORLAGEN=1` (Bauzeit: Einsatzliste und Arena-Anzeige). Ist nur eine
 * gesetzt, gilt sie für ihre Seite allein (s. Risiken im Konzept-Doc, Abschnitt 9).
 */

export type StrategieStufe = "defensiv" | "offensiv";

export type StrategieVorlage = {
  /** Kennung, wie sie im Entwurf (`modifiers.dX.strategie`) und im Motor steht. */
  id: string;
  stufe: StrategieStufe;
  /** Knopfbeschriftung in der Einsatzliste. */
  name: string;
  /** Ein Satz Verhalten — kein Zahlwert (Konzept 4.1). */
  satz: string;
  /** Was die Vorlage sichtbar ändert (▲) und was sie kostet (▼). */
  wirkung: readonly string[];
};

/**
 * Nur Disziplinen mit gebauter Wirkung stehen hier. Pilot: Wettessen (Konzept 7, Schritt 1).
 * Wettessen-Haltungen im Motor, geordnet von ruhig nach offensiv:
 * gleichmaessig → schlussspurt → sprint. Die Vorlage verschiebt die KI-Haltung jedes Essers um
 * EINE Stufe (Empfehlung 3 aus Abschnitt 8), sie setzt nicht alle gleich.
 */
export const STRATEGIE_VORLAGEN_KATALOG: Readonly<Record<string, readonly StrategieVorlage[]>> = Object.freeze({
  wettessen: Object.freeze([
    Object.freeze({
      id: "kontrolliert",
      stufe: "defensiv" as const,
      name: "Kontrolliert",
      satz: "Deine Esser teilen sich den Magen ein: jeder eine Stufe ruhiger als sonst (Richtung gleichmäßig).",
      wirkung: Object.freeze(["▲ gleichmäßiger Bissverlauf", "▲ weniger Fehlbisse am Anfang", "▼ kaum Schlussspurt am Ende"]),
    }),
    Object.freeze({
      id: "reinhauen",
      stufe: "offensiv" as const,
      name: "Reinhauen",
      satz: "Deine Esser gehen früher ans Limit: jeder eine Stufe offensiver als sonst (Richtung Sprint).",
      wirkung: Object.freeze(["▲ mehr Bissen in den ersten Minuten", "▼ früher an der Mauer", "▼ mehr Fehlbisse am Anfang"]),
    }),
  ]),
});

/** Gilt die Flagge? Server: `OLY_STRATEGIE_VORLAGEN`, Browser: die beim Bauen eingesetzte NEXT_PUBLIC-Variante. */
export function istStrategieVorlagenAktiv(): boolean {
  return process.env.OLY_STRATEGIE_VORLAGEN === "1" || process.env.NEXT_PUBLIC_OLY_STRATEGIE_VORLAGEN === "1";
}

export function strategieVorlagenFuer(disciplineId: string | null | undefined): readonly StrategieVorlage[] {
  if (!disciplineId) return [];
  return Object.prototype.hasOwnProperty.call(STRATEGIE_VORLAGEN_KATALOG, disciplineId)
    ? STRATEGIE_VORLAGEN_KATALOG[disciplineId]!
    : [];
}

/**
 * Nur Kennungen dieser Disziplin werden angenommen; alles andere (fehlend, `null`, Tippfehler,
 * Kennung einer anderen Disziplin) ist neutral = `null` (Konzept Abschnitt 5, Fehlerfälle).
 */
export function normalisiereStrategie(disciplineId: string | null | undefined, wert: unknown): string | null {
  if (typeof wert !== "string" || !wert) return null;
  return strategieVorlagenFuer(disciplineId).some((vorlage) => vorlage.id === wert) ? wert : null;
}

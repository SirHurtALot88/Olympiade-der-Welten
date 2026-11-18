/**
 * EIN GEMEINSAMES TRANSFERFENSTER ZWISCHEN DEN SAISONS — der Schalter.
 *
 * ENTSCHIEDEN VON CHRIS (18.11., „ok dann mach das so!"), aus `docs/design/transfermarkt-modern-18-11.md`
 * Frage 2 und 3: Kaufen und Verkaufen sind im selben Fenster offen, in beliebiger Reihenfolge, fuer Mensch und
 * KI gleich. Das Fenster liegt in der NEUEN Saison vor ihrem ersten Spieltag (`isEarlySeasonTransferSetup`).
 * Das Saisonende bleibt fuer Abrechnung, Vertragsenden und Verlaengerungen; verkauft wird dort nicht mehr.
 *
 * Volle Herleitung: `docs/design/transferfenster-gemeinsam-18-11.md`.
 *
 * STANDARD AN. `OLY_TRANSFERFENSTER_GEMEINSAM=0` (Server) bzw. `NEXT_PUBLIC_OLY_TRANSFERFENSTER_GEMEINSAM=0`
 * (Browser, beim Build) stellt das alte Verhalten her: Verkaufen nur am Saisonende, Kaufen nur am Saisonstart,
 * KI-Verkaeufe in der Saisonende-Kette. Der Schalter betrifft nur das Fenster (Phasen, KI-Ablauf, Texte). Die
 * Buchung der Transferbilanz („Fenster vor Saison N gehoert zu Saison N", `lib/season/transferbilanz-buchung.ts`)
 * gilt in beiden Stellungen — sie ordnet auch die Saisonende-Verkaeufe des alten Ablaufs richtig zu.
 */

function istAus(wert: string | undefined): boolean {
  const w = (wert ?? "").trim().toLowerCase();
  return w === "0" || w === "aus" || w === "false" || w === "off" || w === "nein";
}

/** Liest den Schalter bei jedem Aufruf neu (Tests und Messlaeufe setzen ihn zur Laufzeit). */
export function istTransferfensterGemeinsam(): boolean {
  // NEXT_PUBLIC_ muss als woertlicher Zugriff dastehen, damit Next.js ihn im Browser-Bundle ersetzt.
  if (istAus(process.env.NEXT_PUBLIC_OLY_TRANSFERFENSTER_GEMEINSAM)) return false;
  return !istAus(process.env.OLY_TRANSFERFENSTER_GEMEINSAM);
}

/**
 * Welcher Anteil der Verkaufserloese aus dem Fenster fuer Kaeufe im selben Fenster frei ist.
 *
 * Chris 18.11. (Empfehlung aus `docs/design/transfermarkt-modern-18-11.md` Frage 3, freigegeben): „Erloese sind
 * zu 100 % frei. Wer selbst Platz schafft, darf das Geld nutzen; das ist der Hebel des Spielers gegen die Sperre."
 * Die Vorstands-Quote gilt nur fuer die Kasse zu Fensterbeginn. Schalter aus: die alte Regel (Quote auch auf
 * die Erloese).
 */
export function verkaufserloeseFreiAnteil(vorstandsQuote: number): number {
  return istTransferfensterGemeinsam() ? 1 : vorstandsQuote;
}

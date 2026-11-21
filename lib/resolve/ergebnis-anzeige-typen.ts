/**
 * ANZEIGE-ZAHL EINES DUELLS (21.11., Spieltagswertung): die Zahl, die ein Spieler als Ergebnis erwartet, wenn der
 * Seitenstand `seiten` nur ein Siegmarker ist.
 *
 *  - `zeit`: Zeitfahren und Staffel buchen "1 : 0" -- `werte` sind die beiden Zeitsummen bzw. Zielzeiten in
 *    angezeigten Sekunden (`[dieses Team, Gegner]`, kleiner = besser).
 *  - `besiegt`: Breaking (Folter-Zweikampf) zaehlt besiegte Gegner -- `werte` = `[von diesem Team besiegt,
 *    vom Gegner besiegt]`.
 *
 * Reine Nachlese aus dem gelaufenen Motor-Spiel: `seiten`, Punkte und Wertung sehen davon nichts. Aeltere Zeilen
 * tragen das Feld nicht; jeder Leser muss sein Fehlen aushalten.
 */
export type ErgebnisAnzeigeZahl = {
  art: "zeit" | "besiegt";
  werte: [number, number];
};

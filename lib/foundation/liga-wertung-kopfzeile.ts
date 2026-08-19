/**
 * DIE KOPFZEILE DER LIGA-WERTUNG — Befund B5 aus `docs/AUDIT-INGAME-2026-08-19.md`.
 *
 * GEMELDET AUS DEM AUDIT: auf demselben Bildschirm stand oben „SAISON ABGESCHLOSSEN · Platz 20
 * zum Saisonende" und weiter unten „LIGA-WERTUNG · SAISON LÄUFT".
 *
 * URSACHE: die Beschriftung kannte nur ZWEI Zustaende — Archiv oder laufend. Es gibt aber drei.
 * Die Saison des Spielstands ist nicht archiviert (sie ist die aktuelle), und trotzdem ist sie
 * durch. Genau dieser Fall fiel in den Zweig „laeuft".
 *
 * WARUM ALS EIGENE DATEI: die Zeile stand wortgleich an zwei Stellen — im Saisonstand
 * (`SeasonStandingsNewLook`) und in den Raengen (`FoundationShellRouterBody`). Zwei getippte
 * Kopien derselben Aussage waren der Grund, dass der dritte Zustand an beiden Stellen fehlte;
 * ihn zweimal nachzutragen haette die naechste Abweichung nur vorbereitet.
 */

export type LigaWertungLage = {
  /** Eine abgeschlossene Saison aus dem Archiv wird betrachtet, nicht die des Spielstands. */
  istArchiv: boolean;
  /**
   * Die betrachtete Saison ist durch — alle Spieltage gewertet, der Spielstand steht in einer
   * Saisonende-Phase (`isSeasonEndPhase`). Bei einer Archiv-Saison ohne Belang.
   */
  istAbgeschlossen: boolean;
};

export const LIGA_WERTUNG_ARCHIV = "Liga-Wertung · Archiv";
export const LIGA_WERTUNG_ABGESCHLOSSEN = "Liga-Wertung · Saison abgeschlossen";
export const LIGA_WERTUNG_LAEUFT = "Liga-Wertung · Saison läuft";

export function resolveLigaWertungKopfzeile(lage: LigaWertungLage): string {
  if (lage.istArchiv) {
    return LIGA_WERTUNG_ARCHIV;
  }
  // Reihenfolge zaehlt: „abgeschlossen" muss VOR „laeuft" geprueft werden, sonst faellt der
  // dritte Zustand wieder in den zweiten — genau der Fehler, um den es hier geht.
  return lage.istAbgeschlossen ? LIGA_WERTUNG_ABGESCHLOSSEN : LIGA_WERTUNG_LAEUFT;
}

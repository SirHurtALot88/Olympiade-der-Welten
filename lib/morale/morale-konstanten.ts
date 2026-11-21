/**
 * Zahlen der Moral-Rechnung, die auch die Anzeige braucht (Entwicklung: „was heisst Moral -10?").
 * Klein und ohne Abhaengigkeiten, damit die Oberflaeche sie laden kann, ohne den ganzen Moral-Dienst zu ziehen.
 * `player-morale-service.ts` rechnet mit genau diesen Werten (gezeigt = gebucht).
 */

/** Alle Moral-Gruende zusammen werden um diesen Faktor um die Mitte 50 gestreckt (Skala 0..100). */
export const MORAL_SKALA_FAKTOR = 1.2;

/** Innerhalb einer Saison zaehlt der gespeicherte Moralwert mit diesem Gewicht, der frisch gerechnete mit dem Rest. */
export const MORAL_UEBERTRAG_GLEICHE_SAISON = 0.55;

/** Summe aller Forderungs-Wirkungen je Spieler wird auf diesen Bereich begrenzt (Moralpunkte vor der Streckung). */
export const MORAL_FORDERUNGEN_UNTERGRENZE = -18;
export const MORAL_FORDERUNGEN_OBERGRENZE = 12;

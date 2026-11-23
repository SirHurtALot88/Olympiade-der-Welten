/**
 * MEDAILLEN-TYPEN (22.11., docs/design/finanzen-posten-22-11.md g.1 und f.1). Nur Typen, damit `olyDataTypes.ts` sie ohne Kreisimport liest.
 */

export type MedaillenFarbe = "pow" | "spe" | "men" | "soc";

/** Regel-Stempel dieser Saison: "an" = Disziplin-Medaillen und Farb-Meister am Saisonende, bezahlt aus dem Rangpraemien-Topf. */
export type MedaillenRegelStempel = {
  seasonId: string;
  regel: "an" | "aus";
  /** Anteil, um den jede Rangpraemie des Sponsors sinkt (Topf-Abzug), fest fuer die Saison. */
  rangAbzug: number;
  /** Spiegel der Notbremse `OLY_MEDAILLEN=aus-sofort`. */
  notbremse?: boolean;
  /** Moral-Zuschlag aus der Vergabe der VORSAISON je Spieler (wirkt in dieser Saison). */
  moralVorsaison?: Record<string, { punkte: number; text: string }>;
};

export type MedaillenZeile = {
  disziplinId: string;
  liga: 1 | 2;
  teamId: string;
  /** 1 = Gold, 2 = Silber, 3 = Bronze. */
  platz: 1 | 2 | 3;
  geteilt: boolean;
  geld: number;
  /** Ergebnis-Summe (E1; Pod: Verhaeltnis) der Wertung. */
  wert: number;
};

export type FarbMeisterZeile = {
  farbe: MedaillenFarbe;
  liga: 1 | 2;
  teamId: string;
  geld: number;
  punkte: number;
  geteilt: boolean;
};

export type MedaillenVergabe = {
  seasonId: string;
  medaillen: MedaillenZeile[];
  farbMeister: FarbMeisterZeile[];
  /** Geld je Team in C: Medaillen und Farb-Meister getrennt. */
  geldJeTeam: Record<string, { medaillen: number; farbe: number }>;
  /** Moral-Punkte je Spieler aus dieser Vergabe (hoechstens +10). */
  moral: Record<string, { punkte: number; text: string }>;
  /** Wann gebucht wurde (ISO). Eine zweite Buchung tut nichts. */
  gebuchtAm: string;
};

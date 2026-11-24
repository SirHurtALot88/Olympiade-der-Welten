/**
 * SPONSOR-TOPF: TYPEN (24.11., docs/design/sponsoren-rework-bau-24-11.md; Konzept docs/design/sponsoren-rework-22-11.md).
 *
 * Nur Typen, kein Code: olyDataTypes.ts importiert sie, ohne dass ein Rechenmodul in den Typkreis gezogen wird.
 */

/** Vertragsart: Hebel h auf den Leistungsteil (0,5 / 1,0 / 1,5) und Zieleinsatz (0 / 4 / 8 C). */
export type SponsorVertragsart = "fest" | "leistung" | "praemie";

/** Die vier Farben, aus denen ein Team zwei Farb-Partner waehlt (Klassenfarbe = Disziplinfarbe). */
export type SponsorFarbe = "pow" | "spe" | "men" | "soc";

export type SponsorRegelVersion = "topf" | "alt";

/** Alles, was der Stichtag je Team festschreibt (Grundbetrag, Passung, Hebel, Erwartungsrang, Plan-Posten). */
export type SponsorTopfTeamStand = {
  teamId: string;
  liga: 1 | 2;
  /** Erwartungsrang, ungerundet, je Liga auf Summe 136 geschoben. Derselbe Anker wie beim Vorstand. */
  erwartungsrang: number;
  /** Beliebtheit (TeamIdentity.popularity), Eingang des Marktgroessen-Terms. */
  beliebtheit: number;
  /** Hebel der Vertragsart (0,5 / 1 / 1,5); ohne Vertrag 1. */
  hebel: number;
  vertragsart: SponsorVertragsart | null;
  /** Passung, normiert auf Liga-Mittel 1,00 (0,95 bis 1,05 vor der Normierung). */
  passung: number;
  /** Treuebonus dieser Saison in C (0 / 1 / 2). */
  treue: number;
  /** Grundbetrag G (ohne Treuebonus), nach Vorab-Zusage. */
  grundbetrag: number;
  /** Plan-Posten (Kosten B, uebrige Einnahmen P, Kaderwert W) am Stichtag. */
  kosten: number;
  planEinnahmen: number;
  kaderwert: number;
  /** Die zwei Farb-Partner; leer ohne Vertrag. */
  farben: SponsorFarbe[];
};

export type SponsorTopfEingefroren = {
  /** Gesamtfaktor F dieser Saison (Grundwert x Konjunktur). */
  faktor: number;
  /** Betriebsteil K_B (geklammert), K_B roh, Kader-Ersatz K_E, Uebertrag, Topf T, Hauptsponsor-Topf T_H. */
  betriebsteil: number;
  betriebsteilRoh: number;
  kaderErsatz: number;
  uebertrag: number;
  topf: number;
  hauptTopf: number;
  /** Farb-Topf je Farbe: [Liga 1, Liga 2] in C. */
  farbTopf: [number, number];
  /** Summe der Treueboni (vorab aus dem Topf genommen). */
  treueSumme: number;
  /**
   * LIGA-WERT-RUECKKOPPLUNG (Entscheidung 1, 23.11.: "die Liga bleibt im Wert"): Liga-Wert (Summe Kasse + Summe Kaderwert) am Stichtag, die Abweichung
   * gegen den Stichtag der Vorsaison und die daraus fortgeschriebene, angewandte Korrektur des Topfs (C, positiv = Topf kleiner).
   */
  ligaWert: number;
  ligaWertDrift: number | null;
  wertKorrektur: number;
  sigma: number;
  teams: Record<string, SponsorTopfTeamStand>;
  gesperrtAm: string;
};

export type SponsorTopfVorlaeufig = {
  topf: number;
  /** Vorlaeufiger Grundbetrag je Team (ohne Zusage-Abschlag); die Vorab-Zusage ist 90 % davon. */
  grund: Record<string, number>;
};

/** Ein Sponsorentermin: Entscheidung statt Wuerfel (max. 2 je Saison und Team). */
export type SponsorTermin = {
  id: string;
  seasonId: string;
  teamId: string;
  /** Spieltag-Index (1..N), nach dem der Termin ansteht. */
  nachSpieltag: number;
  status: "offen" | "zugesagt" | "abgesagt";
  /** Benannter Spieler, der bei Zusage am naechsten Spieltag Form -1 hat. */
  spielerId: string | null;
  betrag: number;
  entschiedenVon?: "mensch" | "ki";
  entschiedenAm?: string;
};

export type SponsorRegelStempel = {
  seasonId: string;
  version: SponsorRegelVersion;
  /** Grundwert des Saisonfaktors (1,00); die Konjunktur der Saison steht in `eingefroren.faktor`. */
  saisonfaktor: number;
  /** kappa: 1 = Kader-Ersatz im Topf (Chris, 23.11.). In Saison 1 wirkt er nicht. */
  kaderErsatz: 0 | 1;
  /** Betriebsteil K_B der VORSAISON, Bezug der 15-%-Bremse. Fehlt in Saison 1 (Richtwert 32 x 62 C). */
  betriebsteilVorjahr: number | null;
  uebertrag: number;
  /** Erste Topf-Saison eines Spielstands, der vorher nach dem alten System lief: keine Bremse (es gibt keinen Betriebsteil der Vorsaison, der Richtwert gilt nur fuer neue Spiele). */
  ohneBremse?: boolean;
  /** Liga-Wert am Stichtag der Vorsaison und die dort angewandte Korrektur (Bezug der Rueckkopplung); `null` in der ersten Topf-Saison. */
  ligaWertVorjahr?: number | null;
  ligaWertKorrektur?: number;
  vorlaeufig: SponsorTopfVorlaeufig | null;
  eingefroren: SponsorTopfEingefroren | null;
  termine?: SponsorTermin[];
  /** Notbremse (OLY_SPONSOR_REGEL=aus-sofort): Grundbetrag zahlt weiter, Leistungsteil und Farb-Partner sind aus. */
  notbremse?: boolean;
};

/** Der Vertragsteil des neuen Systems; haengt am `TeamSponsorContract` und rollt mit ihm ueber die Laufzeit. */
export type SponsorTopfVertrag = {
  vertragsart: SponsorVertragsart;
  /** Gewaehlte Laufzeit 1 bis 3 und das erreichte Vertragsjahr (1 = erstes). */
  laufzeit: 1 | 2 | 3;
  jahr: number;
  farben: SponsorFarbe[];
  /** Saisons, die das Team vor diesem Vertrag schon mit dieser Dachmarke gespielt hat (0 bis 3), fuer die Passung. */
  treueSaisons: number;
  /** Wer hat gewaehlt: Mensch, KI, delegierte KI, Auto-Fuellung am Stichtag, Ueberfuehrung aus dem alten System. */
  gewaehltVon: "mensch" | "ki" | "delegiert" | "auto" | "ueberfuehrt";
  /** Zieleinsatz in C (0 / 4 / 8); abgeleitet aus der Vertragsart, hier eingefroren. */
  zielEinsatz: number;
  /**
   * Nur bei `gewaehltVon: "ueberfuehrt"`: der Anker (Erwartungswert) des alten Vertrags in C je Saison, damit die Seite die Aenderung beim
   * Wechsel auf den Topf offen zeigen kann ("kein Vertrag verliert beim Saisonwechsel Geld ohne Anzeige").
   */
  vorherAnker?: number | null;
  /** Felder, die die KI gefuellt hat, obwohl ein Mensch gewaehlt hat ("von" je Feld); leer = alles vom Waehlenden. */
  kiFelder?: Array<"vertragsart" | "laufzeit" | "farben">;
};

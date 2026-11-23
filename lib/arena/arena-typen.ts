/**
 * ARENA-TYPEN (22.11., docs/design/finanzen-posten-22-11.md g.2, h, i.1; Bau: docs/design/arena-tickets-medaillen-22-11.md).
 * Nur Typen und Namen, damit `olyDataTypes.ts` sie ohne Kreisimport lesen kann.
 */

export type ArenaBereich = "steh" | "sitz" | "loge";
export const ARENA_BEREICHE: readonly ArenaBereich[] = ["steh", "sitz", "loge"] as const;

export type ArenaPlaetze = Record<ArenaBereich, number>;

export type DauerkartenStufe = "wenig" | "normal" | "viel";

/** Regel-Stempel dieser Saison: "an" = Platzarten, Tickets, Dauerkarten, Ausbau von Hand; "aus" = das alte Gebaeude "Arena Upgrade". */
export type ArenaRegelStempel = {
  seasonId: string;
  regel: "an" | "aus";
  /** Der Stempel loest einen alten Spielstand ab: die erste Arena wird aus dem Gebaeude "Arena Upgrade" abgebildet (Doku: Abbildung). */
  umstieg?: boolean;
  /** Saat der gewuerfelten ligaweiten Ereignisse (Unwetter, Streik, Feiertag): im Spielstand, nie aus der Uhr. */
  saat: string;
  /** Spiegel der Notbremse `OLY_ARENA=aus-sofort`, vom Server beim naechsten Buchen gesetzt. */
  notbremse?: boolean;
};

/** Ein Ereignis eines Heimspiels (g.3) mit seinem Faktor je Platzart. */
export type ArenaEreignisZeile = {
  id: string;
  label: string;
  faktor: ArenaPlaetze;
};

/** Ein gebuchtes Heimspiel: Nachfrage, Auslastung und Geld. Zeigt, was gebucht wurde (gezeigt = gebucht). */
export type ArenaHeimspiel = {
  seasonId: string;
  matchdayId: string;
  matchdayIndex: number;
  gegnerId: string | null;
  stimmung: number;
  fanbasis: number;
  /** Plaetze beim Heimspiel. */
  plaetze: ArenaPlaetze;
  /** Nachfrage je Platzart (Personen, nach Ereignis und Ueberlauf), vor dem Deckel durch die Plaetze. */
  nachfrage: ArenaPlaetze;
  /** Auslastung je Platzart (0..1, Dauerkarten-Inhaber zaehlen als anwesend). */
  auslastung: ArenaPlaetze;
  /** Tageskasse je Platzart in C (nach Zuschlag). */
  kasse: ArenaPlaetze;
  /** Zuschlag auf Tageskarten bei ausverkauftem Haus je Platzart (0..0,5). */
  zuschlag: ArenaPlaetze;
  ereignisse: string[];
  /** Summe der Tageskasse in C. */
  tickets: number;
};

/** Ein Grund fuer eine Aenderung der Fanbasis (Fan-Modell organisch, 23.11.): `delta` in Fans, mit Vorzeichen. */
export type ArenaFanGrund = { id: string; label: string; delta: number };

/** Gemerkter Kaderspieler (fuer Kauf und Verkauf von Stars): Stern-Gewicht zum Zeitpunkt des Zugangs und Name. */
export type ArenaKaderMerk = { w: number; n: string };

export type ArenaAusbauZeile = {
  seasonId: string;
  matchdayIndex: number;
  bereich: ArenaBereich;
  schritte: number;
  kosten: number;
  von: "mensch" | "ki";
  zeit?: string;
};

export type ArenaDauerkarten = {
  seasonId: string;
  stufe: DauerkartenStufe;
  /** Anteil der Plaetze (0,2 / 0,4 / 0,6). */
  anteil: number;
  /** Verkaufte Dauerkarten je Platzart, absolut zum Zeitpunkt des Verkaufs (neue Plaetze mitten in der Saison gehen nur in die Tageskasse). */
  plaetze: ArenaPlaetze;
  /** Geld, das die Dauerkarten gebracht haben (in der Kasse). */
  geld: number;
  /** Heimspiele, auf die sich das Geld verteilt (Preisgrundlage). */
  heimspiele: number;
  /** `true`, wenn der Manager nicht gewaehlt hat (Standard). */
  standard?: boolean;
  /** `true`: das Geld wurde sofort bei der Wahl gutgeschrieben (nicht mit dem Spieltag-Abschluss). */
  sofort?: boolean;
  /** Zeitpunkt der Wahl (ISO), nur zur Sortierung im Kontoauszug. */
  zeit?: string;
};

/** Der Arena-Stand eines Teams (`seasonState.arena[teamId]`). Wirkt nur auf Geld, nie auf die Wertung. */
export type ArenaTeamStand = {
  plaetze: ArenaPlaetze;
  fanbasis: number;
  /** Fan-Stimmung 0..100. */
  stimmung: number;
  /** Serie: positive Zahl = Siege in Folge, negative = Niederlagen in Folge. */
  serie: number;
  /** Tabellenpunkte nach dem zuletzt gebuchten Spieltag (Grundlage der Ergebnis-Differenz). */
  punkte: number;
  /** Letzter gebuchter Spieltag (1-basiert) dieser Saison. */
  stand: number;
  seasonId: string;
  /** Tabellenplatz-Anteil der Vorsaison (0 letzter bis 1 erster), Grundlage der Logen bis Spieltag 5. */
  tabelleVorjahr?: number;
  dauerkarten: ArenaDauerkarten | null;
  heimspiele: ArenaHeimspiel[];
  /** Die letzten drei Heimspiele der Vorsaison (fuer die Vorschau vor dem ersten Heimspiel). */
  letzte: ArenaHeimspiel[];
  ausbau: ArenaAusbauZeile[];
  /** Ausbau-Schritte DIESER Saison je Bereich (Grundlage der KI-Grenze). */
  ausbauSaison: ArenaPlaetze;
  /** Langzeitwert der Fans dieses Teams (Anker): die Fanbasis zieht langsam dorthin, er folgt ihr am Saisonende zu 40 %. */
  fanAnker?: number;
  /** Fanbasis zu Beginn dieser Saison (Grundlage der Saison-Schranke -15 % bis +30 %). */
  fanStart?: number;
  /** Erwartung der Kaderstaerke (0 = schwaechster Kader der Liga, 1 = staerkster), zu Beginn der Saison gemerkt. */
  erwartung?: number;
  /** Kader beim letzten gebuchten Spieltag; Unterschiede = Kaeufe und Verkaeufe. Fehlt es, wird es ohne Wirkung angelegt. */
  kader?: Record<string, ArenaKaderMerk>;
  /** Bilanz der Fan-Aenderung DIESER Saison je Grund (Summe in Fans). */
  fanBilanz?: ArenaFanGrund[];
  /** Bilanz der Vorsaison, einschliesslich des Saisonende-Schritts. */
  fanBilanzVorsaison?: ArenaFanGrund[];
  /** Die letzte Aenderung (Spieltag `tag`, 0 = Saisonwechsel) mit Gruenden. */
  fanLetzte?: { tag: number; seasonId: string; delta: number; gruende: ArenaFanGrund[] };
  /** Fanbasis nach jedem gebuchten Spieltag dieser Saison (Index = Spieltag, 0 = Saisonstart). */
  fanVerlauf?: number[];
  /** Relative Aenderung der Fanbasis in der Vorsaison (Grundlage der KI-Prognose vor Spieltag 5). */
  fanTrendVorsaison?: number;
};

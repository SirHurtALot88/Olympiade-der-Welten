/**
 * ARENA-MODELL (22.11.): reine Rechnung, ohne Spielstand und ohne Zufall. Client-sicher (Seite, Server und Messskripte rechnen
 * dieselbe Funktion, damit gezeigt = gebucht gilt). Vorlage: docs/design/finanzen-posten-22-11.md g.2 (Platzarten, Nachfrage),
 * h (Ausbau von Hand), i.1 (guenstigere Plaetze); Bau und Abweichungen: docs/design/arena-tickets-medaillen-22-11.md.
 *
 * Einheit C. Preise je Heimspiel; "Liga 1 = Liga 2 x 4/3". Die Preise stehen hier fest bei 100 % (Ticketpreisstufen gibt es nicht;
 * PM-Entscheidung 22.11., weil die Ausruestung als Gegenposten gebaut ist).
 */
import { ARENA_BEREICHE, type ArenaBereich, type ArenaPlaetze, type DauerkartenStufe } from "@/lib/arena/arena-typen";

export const HEIMSPIELE_REFERENZ = 10;
/** Liga-1-Faktor auf die Ticketpreise. */
export const LIGA1_PREISFAKTOR = 4 / 3;

/** Preis in C je 1.000 Plaetze und Heimspiel in Liga 2 (g.2). */
export const PREIS_JE_1000: Record<ArenaBereich, number> = { steh: 0.06, sitz: 0.12, loge: 0.6 };

/** Die Grundarena: 4.000 Plaetze, davon 3.000 Steh und 1.000 Sitz, keine Logen. Kostet nichts und hat keinen Unterhalt. */
export const GRUND_PLAETZE: ArenaPlaetze = { steh: 3000, sitz: 1000, loge: 0 };
/** Ein Ausbau-Schritt (h.1): Steh und Sitz +1.000, Loge +100. */
export const SCHRITT_GROESSE: ArenaPlaetze = { steh: 1000, sitz: 1000, loge: 100 };
/** Obergrenzen (PM 22.11.): 15.000 Steh, 10.000 Sitz, 1.200 Logen. */
export const OBERGRENZE: ArenaPlaetze = { steh: 15000, sitz: 10000, loge: 1200 };

/** Bau je Schritt (i.1): die erste Haelfte guenstiger, die zweite Haelfte teurer (+ rund 20 %). */
export const BAU_STAFFEL: Record<ArenaBereich, { erste: number; preisA: number; preisB: number }> = {
  steh: { erste: 6, preisA: 0.9, preisB: 1.1 },
  sitz: { erste: 5, preisA: 2.0, preisB: 2.4 },
  loge: { erste: 6, preisA: 1.5, preisB: 1.8 },
};
/** Unterhalt je Schritt und Saison (i.1), auch wenn die Plaetze leer bleiben; gebucht je Spieltag (1/N). */
export const UNTERHALT_JE_SCHRITT: Record<ArenaBereich, number> = { steh: 0.1, sitz: 0.2, loge: 0.1 };

/** Dauerkarten (f.2): Rabatt 25 %, eine Stufe fuer alle Platzarten. */
export const DAUERKARTEN_RABATT = 0.25;
export const DAUERKARTEN_ANTEIL: Record<DauerkartenStufe, number> = { wenig: 0.2, normal: 0.4, viel: 0.6 };
export const DAUERKARTEN_STUFEN: readonly DauerkartenStufe[] = ["wenig", "normal", "viel"] as const;
export const DAUERKARTEN_LABEL: Record<DauerkartenStufe, string> = { wenig: "Wenig", normal: "Normal", viel: "Viel" };

/** Nachfrage (g.2): Fanbasis x (0,30 + 0,85 x Stimmung/100) x Ereignis; Aufteilung auf Stehen und Sitzen nach der Stimmung. */
export const NACHFRAGE_GRUND = 0.3;
export const NACHFRAGE_STIMMUNG = 0.85;
export const STEH_ANTEIL_GRUND = 0.35;
export const STEH_ANTEIL_STIMMUNG = 0.3;
/** Wer keinen Stehplatz bekommt, kauft zu 50 % einen Sitzplatz; wer keinen Sitzplatz bekommt, zu 80 % einen Stehplatz. */
export const UEBERLAUF_STEH_ZU_SITZ = 0.5;
export const UEBERLAUF_SITZ_ZU_STEH = 0.8;
/** Fanbasis: haengt NICHT am Stadion (Fan-Modell organisch, 23.11., `fan-modell.ts`); das Stadion begrenzt nur die verkauften Tickets. */
/** Zuschlag auf Tageskarten bei ausverkauftem Haus: halber Ueberhang, hoechstens +25 % (Logen +50 %). */
export const ZUSCHLAG_MAX: Record<ArenaBereich, number> = { steh: 0.25, sitz: 0.25, loge: 0.5 };

export const NULL_PLAETZE: ArenaPlaetze = { steh: 0, sitz: 0, loge: 0 };
export const EINS_PLAETZE: ArenaPlaetze = { steh: 1, sitz: 1, loge: 1 };

export function mapBereiche<T>(f: (b: ArenaBereich) => T): Record<ArenaBereich, T> {
  return { steh: f("steh"), sitz: f("sitz"), loge: f("loge") };
}

export const runde2 = (v: number) => Math.round(v * 100) / 100;
export const runde1 = (v: number) => Math.round(v * 10) / 10;

export function gesamtPlaetze(p: ArenaPlaetze): number {
  return p.steh + p.sitz + p.loge;
}

/** Preis EINES Platzes je Heimspiel in C. */
export function preisJePlatz(bereich: ArenaBereich, liga1: boolean): number {
  return (PREIS_JE_1000[bereich] / 1000) * (liga1 ? LIGA1_PREISFAKTOR : 1);
}

/** Volles Haus je Saison (`heimspiele` Heimspiele) in C. */
export function volleHausSaison(plaetze: ArenaPlaetze, liga1: boolean, heimspiele = HEIMSPIELE_REFERENZ): number {
  return ARENA_BEREICHE.reduce((s, b) => s + plaetze[b] * preisJePlatz(b, liga1) * heimspiele, 0);
}

/* ------------------------------------------------------------------------------------------------ Ausbau */

/** Zahl der Schritte, die ein Bereich ueber der Grundarena hat. */
export function schritteGebaut(bereich: ArenaBereich, plaetze: number): number {
  return Math.max(0, Math.round((plaetze - GRUND_PLAETZE[bereich]) / SCHRITT_GROESSE[bereich]));
}

export function maxSchritte(bereich: ArenaBereich): number {
  return Math.round((OBERGRENZE[bereich] - GRUND_PLAETZE[bereich]) / SCHRITT_GROESSE[bereich]);
}

/** Bau des `nr`-ten Schrittes (1-basiert) in C. */
export function schrittPreis(bereich: ArenaBereich, nr: number): number {
  const s = BAU_STAFFEL[bereich];
  return nr <= s.erste ? s.preisA : s.preisB;
}

/** Bau von `schritte` Schritten, wenn schon `gebaut` Schritte stehen. */
export function bauKosten(bereich: ArenaBereich, gebaut: number, schritte: number): number {
  let summe = 0;
  for (let i = 1; i <= schritte; i += 1) summe += schrittPreis(bereich, gebaut + i);
  return runde2(summe);
}

export function unterhaltSaison(plaetze: ArenaPlaetze): number {
  return runde2(ARENA_BEREICHE.reduce((s, b) => s + schritteGebaut(b, plaetze[b]) * UNTERHALT_JE_SCHRITT[b], 0));
}

export function plaetzeNachSchritten(plaetze: ArenaPlaetze, schritte: Partial<Record<ArenaBereich, number>>): ArenaPlaetze {
  return mapBereiche((b) => Math.min(OBERGRENZE[b], plaetze[b] + (schritte[b] ?? 0) * SCHRITT_GROESSE[b]));
}

/* ------------------------------------------------------------------------------------------------ Nachfrage und Kasse */

export type HeimspielEingabe = {
  plaetze: ArenaPlaetze;
  fanbasis: number;
  /** Fan-Stimmung 0..100. */
  stimmung: number;
  liga1: boolean;
  /** Ereignis-Faktor je Platzart (Produkt, auf 0,5 bis 2,0 begrenzt). */
  ereignis?: ArenaPlaetze;
  /** Sponsor-Stufe 0 (kleinster Sponsor der Liga) bis 1 (groesster). */
  sponsorStufe: number;
  /** Tabellenplatz-Anteil 0 (letzter) bis 1 (erster). */
  tabellenAnteil: number;
  /** Verkaufte Dauerkarten je Platzart (absolut). */
  dauer?: ArenaPlaetze;
};

export type HeimspielErgebnis = {
  nachfrage: ArenaPlaetze;
  auslastung: ArenaPlaetze;
  zuschlag: ArenaPlaetze;
  kasse: ArenaPlaetze;
  tickets: number;
  /** Besucher insgesamt (Dauerkarten-Inhaber zaehlen mit). */
  besucher: number;
};

export function logenAuslastung(sponsorStufe: number, tabellenAnteil: number): number {
  const s = Math.min(1, Math.max(0, sponsorStufe));
  const t = Math.min(1, Math.max(0, tabellenAnteil));
  return 0.2 + 0.4 * s + 0.4 * t;
}

/** Grundnachfrage in Personen (vor Ereignis und Aufteilung). */
export function grundNachfrage(fanbasis: number, stimmung: number): number {
  return fanbasis * (NACHFRAGE_GRUND + (NACHFRAGE_STIMMUNG * stimmung) / 100);
}

export function stehAnteil(stimmung: number): number {
  return STEH_ANTEIL_GRUND + (STEH_ANTEIL_STIMMUNG * stimmung) / 100;
}

/** Nachfrage je Platzart in Personen, einschliesslich Ereignis und Ueberlauf zwischen Stehen und Sitzen. */
export function nachfrageJeBereich(e: Pick<HeimspielEingabe, "plaetze" | "fanbasis" | "stimmung" | "ereignis" | "sponsorStufe" | "tabellenAnteil">): ArenaPlaetze {
  const ev = e.ereignis ?? EINS_PLAETZE;
  const gesamt = grundNachfrage(e.fanbasis, e.stimmung);
  const share = stehAnteil(e.stimmung);
  const wantSteh = gesamt * share * ev.steh;
  const wantSitz = gesamt * (1 - share) * ev.sitz;
  const stehUeber = Math.max(0, wantSteh - e.plaetze.steh);
  const sitzUeber = Math.max(0, wantSitz - e.plaetze.sitz);
  return {
    steh: wantSteh + UEBERLAUF_SITZ_ZU_STEH * sitzUeber,
    sitz: wantSitz + UEBERLAUF_STEH_ZU_SITZ * stehUeber,
    loge: e.plaetze.loge * logenAuslastung(e.sponsorStufe, e.tabellenAnteil) * ev.loge,
  };
}

/** Ein Heimspiel: Nachfrage, Auslastung, Zuschlag und Tageskasse. Reine Funktion. */
export function rechneHeimspiel(e: HeimspielEingabe): HeimspielErgebnis {
  const nachfrage = nachfrageJeBereich(e);
  const dauer = e.dauer ?? NULL_PLAETZE;
  const auslastung = { ...NULL_PLAETZE };
  const zuschlag = { ...NULL_PLAETZE };
  const kasse = { ...NULL_PLAETZE };
  let besucher = 0;
  for (const b of ARENA_BEREICHE) {
    const pl = e.plaetze[b];
    if (pl <= 0) continue;
    const verhaeltnis = nachfrage[b] / pl;
    const a = Math.min(1, verhaeltnis);
    const ueber = Math.max(0, verhaeltnis - 1);
    const z = Math.min(ZUSCHLAG_MAX[b], 0.5 * ueber);
    const d = Math.min(dauer[b], pl);
    const tages = a * (pl - d);
    auslastung[b] = a;
    zuschlag[b] = z;
    kasse[b] = tages * preisJePlatz(b, e.liga1) * (1 + z);
    besucher += d + tages;
  }
  const tickets = kasse.steh + kasse.sitz + kasse.loge;
  return { nachfrage, auslastung, zuschlag, kasse, tickets, besucher };
}

/** Gesamte Auslastung (Steh + Sitz gewichtet nach Plaetzen); Logen zaehlen nicht. */
export function auslastungFan(plaetze: ArenaPlaetze, auslastung: ArenaPlaetze): number {
  const n = plaetze.steh + plaetze.sitz;
  if (n <= 0) return 0;
  return (plaetze.steh * auslastung.steh + plaetze.sitz * auslastung.sitz) / n;
}

/* ------------------------------------------------------------------------------------------------ Stimmung */

/**
 * Fan-Stimmung nach einem Spieltag (Finanzkonzept V2, Abschnitt 4, ohne Preis, Stars und Transfers):
 * Ergebnis 2:0 = +4, 1:1 = 0, 0:2 = -4 (Heimspiel x 1,5), Serie ab drei, Rueckzug zur Mitte -0,08 x (S - 50).
 * `deltaPunkte`: Tabellenpunkte dieses Spieltags, 0 bis 4.
 */
export function stimmungNachSpieltag(alt: number, deltaPunkte: number | null, heim: boolean, serie: number): number {
  let s = alt;
  if (deltaPunkte != null) {
    const d = Math.min(4, Math.max(0, deltaPunkte));
    const roh = (d - 2) * 2;
    s += heim ? roh * 1.5 : roh;
  }
  if (serie >= 3) s += 1;
  else if (serie <= -3) s -= 1;
  s -= 0.08 * (s - 50);
  return Math.min(100, Math.max(0, s));
}

/** Serie nach einem Spieltag: Siege (Delta >= 3) zaehlen hoch, Niederlagen (Delta <= 1) runter, ein Remis setzt zurueck. */
export function serieNachSpieltag(serie: number, deltaPunkte: number | null): number {
  if (deltaPunkte == null) return serie;
  if (deltaPunkte >= 3) return serie > 0 ? serie + 1 : 1;
  if (deltaPunkte <= 1) return serie < 0 ? serie - 1 : -1;
  return 0;
}

/* ------------------------------------------------------------------------------------------------ Dauerkarten */

export function dauerkartenPlaetze(plaetze: ArenaPlaetze, stufe: DauerkartenStufe): ArenaPlaetze {
  const a = DAUERKARTEN_ANTEIL[stufe];
  return mapBereiche((b) => Math.round(plaetze[b] * a));
}

/** Das Geld der Dauerkarten (sofort), bei `heimspiele` Heimspielen und Rabatt 25 %. */
export function dauerkartenGeld(plaetze: ArenaPlaetze, stufe: DauerkartenStufe, liga1: boolean, heimspiele: number): number {
  const d = dauerkartenPlaetze(plaetze, stufe);
  return runde2(ARENA_BEREICHE.reduce((s, b) => s + d[b] * preisJePlatz(b, liga1) * heimspiele * (1 - DAUERKARTEN_RABATT), 0));
}

/** Die KI-Regel (f.2): erwartete Auslastung unter 70 % -> viel, ueber 80 % -> wenig, sonst normal; Kasse knapp -> eine Stufe hoeher. */
export function kiDauerkartenStufe(erwarteteAuslastung: number, kasseKnapp: boolean): DauerkartenStufe {
  let i = erwarteteAuslastung < 0.7 ? 2 : erwarteteAuslastung > 0.8 ? 0 : 1;
  if (kasseKnapp) i = Math.min(2, i + 1);
  return DAUERKARTEN_STUFEN[i]!;
}

/* ------------------------------------------------------------------------------------------------ Vorschau "kostet / bringt ca." */

export type AusbauZeile = {
  bereich: ArenaBereich;
  schritte: number;
  plaetzeVorher: number;
  plaetzeNachher: number;
  kosten: number;
  unterhalt: number;
  /** Netto je Saison, wenn die neuen Plaetze voll werden (Voll). */
  nettoVoll: number;
  /** Netto je Saison bei der Nachfrage von heute (Erwartet); negativ = nur Unterhalt. */
  nettoErwartet: number;
  /** Saisons bis bezahlt (Voll bzw. Erwartet); `null` = nie. */
  bezahltVoll: number | null;
  bezahltErwartet: number | null;
  /** Der Bereich ist heute nicht ausverkauft (Auslastung unter 90 %). */
  nichtVoll: boolean;
  /** Obergrenze erreicht: mehr Schritte gehen nicht. */
  amLimit: boolean;
};

export type AusbauVorschau = {
  zeilen: AusbauZeile[];
  kosten: number;
  unterhalt: number;
  nettoVoll: number;
  nettoErwartet: number;
  bezahltVoll: number | null;
  bezahltErwartet: number | null;
};

export const NIE_NACH_SAISONS = 20;

function saisonsBisBezahlt(kosten: number, netto: number): number | null {
  if (kosten <= 0) return 0;
  if (!(netto > 1e-9)) return null;
  const s = kosten / netto;
  return s > NIE_NACH_SAISONS ? null : s;
}

/**
 * "Kostet X, bringt ca. Y" fuer einen geplanten Ausbau (`schritte` je Bereich). "Erwartet" rechnet dieselbe Heimspiel-Formel wie die
 * Buchung (neutrales Ereignis) mit der Stimmung und Fanbasis von heute, "Voll" zaehlt jeden neuen Platz als verkauft. Beides je
 * Saison (`heimspiele` Heimspiele) und nach Unterhalt.
 */
export function ausbauVorschau(input: {
  plaetze: ArenaPlaetze;
  schritte: Partial<Record<ArenaBereich, number>>;
  fanbasis: number;
  stimmung: number;
  liga1: boolean;
  sponsorStufe: number;
  tabellenAnteil: number;
  heimspiele?: number;
}): AusbauVorschau {
  const n = input.heimspiele ?? HEIMSPIELE_REFERENZ;
  const nachher = plaetzeNachSchritten(input.plaetze, input.schritte);
  const basis = { fanbasis: input.fanbasis, stimmung: input.stimmung, liga1: input.liga1, sponsorStufe: input.sponsorStufe, tabellenAnteil: input.tabellenAnteil };
  const alt = rechneHeimspiel({ ...basis, plaetze: input.plaetze });
  const neu = rechneHeimspiel({ ...basis, plaetze: nachher });
  const zeilen: AusbauZeile[] = ARENA_BEREICHE.map((b) => {
    const gewuenscht = Math.max(0, Math.round(input.schritte[b] ?? 0));
    const gebaut = schritteGebaut(b, input.plaetze[b]);
    const schritte = Math.min(gewuenscht, maxSchritte(b) - gebaut);
    const kosten = bauKosten(b, gebaut, schritte);
    const unterhalt = runde2(schritte * UNTERHALT_JE_SCHRITT[b]);
    const mehrPlaetze = nachher[b] - input.plaetze[b];
    const voll = mehrPlaetze * preisJePlatz(b, input.liga1) * n - unterhalt;
    const erwartet = (neu.kasse[b] - alt.kasse[b]) * n - unterhalt;
    return {
      bereich: b,
      schritte,
      plaetzeVorher: input.plaetze[b],
      plaetzeNachher: nachher[b],
      kosten,
      unterhalt,
      nettoVoll: runde2(voll),
      nettoErwartet: runde2(erwartet),
      bezahltVoll: schritte > 0 ? saisonsBisBezahlt(kosten, voll) : null,
      bezahltErwartet: schritte > 0 ? saisonsBisBezahlt(kosten, erwartet) : null,
      nichtVoll: input.plaetze[b] > 0 && alt.auslastung[b] < 0.9,
      amLimit: gebaut + schritte >= maxSchritte(b),
    };
  });
  const kosten = runde2(zeilen.reduce((s, z) => s + z.kosten, 0));
  const nettoVoll = runde2(zeilen.reduce((s, z) => s + z.nettoVoll, 0));
  const nettoErwartet = runde2(zeilen.reduce((s, z) => s + z.nettoErwartet, 0));
  return {
    zeilen,
    kosten,
    unterhalt: runde2(zeilen.reduce((s, z) => s + z.unterhalt, 0)),
    nettoVoll,
    nettoErwartet,
    bezahltVoll: saisonsBisBezahlt(kosten, nettoVoll),
    bezahltErwartet: saisonsBisBezahlt(kosten, nettoErwartet),
  };
}

/** Eine Zeile der Ausbau-Leiter (h.2 / i.1): Schritt `nr` eines Bereichs. */
export function leiterZeile(bereich: ArenaBereich, nr: number, liga1: boolean, heimspiele = HEIMSPIELE_REFERENZ) {
  const plaetze = GRUND_PLAETZE[bereich] + nr * SCHRITT_GROESSE[bereich];
  const bauGesamt = bauKosten(bereich, 0, nr);
  const unterhalt = runde2(nr * UNTERHALT_JE_SCHRITT[bereich]);
  const schrittPreisNr = nr > 0 ? schrittPreis(bereich, nr) : 0;
  const hausSaison = plaetze * preisJePlatz(bereich, liga1) * heimspiele;
  const nettoSchritt = SCHRITT_GROESSE[bereich] * preisJePlatz(bereich, liga1) * heimspiele - UNTERHALT_JE_SCHRITT[bereich];
  return {
    nr,
    plaetze,
    bau: schrittPreisNr,
    bauGesamt,
    unterhalt,
    hausSaison: runde2(hausSaison),
    nettoSchritt: runde2(nettoSchritt),
    bezahlt: nr > 0 ? saisonsBisBezahlt(schrittPreisNr, nettoSchritt) : null,
  };
}

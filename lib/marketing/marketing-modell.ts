/**
 * MARKETING: DIE RECHNUNG (22.11., docs/design/marketing-22-11.md, Runde 3).
 *
 * REIN und client-sicher: kein GameState, keine Node-Importe. Eingabe sind schlichte Zahlen und Listen, Ausgabe ist die
 * volle Zerlegung, die die Seite zeigt (gezeigt = gebucht: Seite, Buchung und Moral lesen genau diese Funktion).
 *
 *   Reichweite   = Leistung (0..30) + Ausstrahlung (0..46) + Typ (0..14) + Schub (0..20), höchstens 100
 *   Marketability = Reichweite x Passung (0,6..1,4), höchstens 100
 *   Werbegeld/Saison = Höchstwert x ((Marketability - 30) / 70)^2        (Liga 1: 10 C, Liga 2: 7,5 C)
 *   Team-Anteil  = 40 % + Persönlichkeit + Klausel + Laufzeit + Moral + Aushängeschild + Teamerfolg, begrenzt auf 15..65 %
 *   ans Team     = min(Team-Anteil x Werbegeld, 25 % des Saisongehalts)         (Sicherheitsnetz)
 *   an ihn       = Rest, hebt die MORAL (+2/+4/+6/+8 ab 0,5/1,5/3/5 C), geht nie in die Kasse
 *
 * Alle Gewichte sind Startwerte der Messung (`scripts/miss-marketing-saison.ts`).
 */
import {
  FARB_NAMEN,
  KLASSEN_FARBE,
  KLASSEN_TYP,
  RASSEN_TYP,
  TRAIT_ALIAS,
  TRAIT_MORAL_GEWICHT,
  TRAIT_TABELLE,
  TRAIT_TEAM_ANTEIL,
  type FanListe,
  type Fanfarbe,
} from "@/lib/marketing/marketing-daten";

/** Stellschrauben (Konzept 4.1 bis 4.3; Teammarke und Deckel nach der Scheren-Messung vom 22.11., docs/design/marketing-bau-22-11.md). */
export const MARKETING_KONFIG = {
  werbeMax: { 1: 10, 2: 7.5 } as Record<1 | 2, number>,
  /**
   * Teammarke (Sockel) je Saison, UMGEKEHRT nach Budget-Rang gestaffelt (Messung 22.11.: ein pauschaler Sockel oeffnete die Schere reich/arm,
   * und ein Sockel nach Finanzwert (1..10) wirkte nicht, weil der Finanzwert kaum mit dem Budget zusammenhaengt): Liga-Basis (Liga 1: 3,0 C,
   * Liga 2: 5,0 C, Ligamittel 4,0 C) + 0,35 C je Platz Abstand von der Ligamitte (Budget-Rang 1 = reichstes Team zahlt am wenigsten), 0..9 C.
   * Liga 2 bekommt mehr, weil ihr Werbe-Hoechstwert kleiner ist (sonst waechst das Einnahmenverhaeltnis Liga 1 zu Liga 2).
   */
  teammarkeLiga: { 1: 3.0, 2: 5.0 } as Record<1 | 2, number>,
  teammarkeRangSteigung: 0.35,
  teammarkeMin: 0,
  teammarkeMax: 9,
  /** Deckel fuer die Summe der Team-Anteile je Team und Saison (C). Was darueber liegt, geht als Spieler-Anteil an die Moral. */
  teamAnteileDeckel: 12,
  teamAnteilBasis: 40,
  teamAnteilMin: 15,
  teamAnteilMax: 65,
  netzAnteilGehalt: 0.25,
  gesichtWerbeFaktor: 1.25,
  gesichtAnteilPunkte: 8,
  klauselPunkte: 10,
  /** Spieler-Anteil in C je Saison -> Moral-Zuschlag (absteigend). */
  moralStufen: [
    [5, 8],
    [3, 6],
    [1.5, 4],
    [0.5, 2],
  ] as Array<[number, number]>,
} as const;

/**
 * Teammarke je Saison in C. `rang` = Budget-Rang im eigenen Ligakreis (1 = reichstes Team), `anzahl` = Teams dieses Kreises. Der Abstand von der
 * Mitte wird auf eine 16er-Liga normiert (Spielstaende ohne Liga-Split haben 32 Teams in einem Kreis).
 */
export function teammarkeAusRang(liga: 1 | 2, rang: number, anzahl: number): number {
  const n = Math.max(2, anzahl);
  const abstand = ((rang - (n + 1) / 2) / (n - 1)) * 15;
  const t = MARKETING_KONFIG.teammarkeLiga[liga] + MARKETING_KONFIG.teammarkeRangSteigung * abstand;
  return Math.round(klemme(t, MARKETING_KONFIG.teammarkeMin, MARKETING_KONFIG.teammarkeMax) * 100) / 100;
}

export function normalisiereTrait(roh: string | null | undefined): string {
  const k = (roh ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return TRAIT_ALIAS[k] ?? k;
}

function klemme(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

export type FanProfil = {
  teamId: string;
  name: string;
  /** -1 (Bösewicht-Fans) bis +1 (Liebling-Fans), aus `manners`. */
  ton: number;
  zielgruppe: string;
  mag: FanListe;
  meidet: FanListe;
  fanfarbe: Fanfarbe;
};

export function tonDerFans(manners: number): number {
  return klemme((manners - 5.5) / 4.5, -1, 1);
}

export type MarketingSpielerEingabe = {
  race: string;
  className: string;
  /** "Chaotic-Good"-Gesinnung; ein Ende auf -G gibt +0,4 Ton, auf -B -0,4. */
  alignment?: string | null;
  traits: string[];
  /** Leistungsperzentil 0..100 (Rating, später PP, gegen den Pool). */
  leistungPerz: number;
  /** Schub durch Aktionen 0..20 (Konzept 2.1; noch nicht gebucht, bleibt 0). */
  schub?: number;
  /** Saisongehalt in C. */
  gehalt: number;
  /** Moral ohne den Werbe-Zuschlag (kein Kreis). `null` = unbekannt, zählt neutral. */
  moralOhne?: number | null;
  /** Verbleibende Vertragssaisons (1 = letzte). `null` = unbekannt, zählt neutral. */
  restlaufzeit?: number | null;
  /** Werbeklausel: -1 Spieler behält mehr, 0 Standard, +1 Team bekommt mehr. */
  klausel?: -1 | 0 | 1;
  verletzt?: boolean;
  istGesicht?: boolean;
};

export type MarketingTeamEingabe = {
  profil: FanProfil;
  liga: 1 | 2;
  /** Teamerfolg der Vorsaison in Punkten (-3, 0, +3, +6) samt Begründung. */
  erfolgPunkte: number;
  erfolgGrund: string;
};

export type TeamAnteilBaustein = { id: string; label: string; punkte: number; text: string };

export type MarketingSpielerErgebnis = {
  // Reichweite
  leistung: number;
  ausstrahlung: number;
  typ: number;
  schub: number;
  reichweite: number;
  traitSumme: number;
  // Ton und Kante
  ton: number;
  kante: number;
  // Passung
  passKante: number;
  passTon: number;
  passThema: number;
  passFarbe: number;
  passung: number;
  themaTexte: string[];
  // Ergebnis
  marketability: number;
  werbegeld: number;
  teamAnteilProzent: number;
  teamAnteilRoh: number;
  bausteine: TeamAnteilBaustein[];
  netzGreift: boolean;
  ansTeam: number;
  anIhn: number;
  moralZuschlag: number;
  verletztHalb: boolean;
};

/** Thema (-1..+1): Rasse ±1, Klasse ±0,5, je Trait ±0,5 (Traits zusammen höchstens ±1). */
export function berechneThema(
  e: Pick<MarketingSpielerEingabe, "race" | "className" | "traits">,
  profil: Pick<FanProfil, "mag" | "meidet">,
): { wert: number; texte: string[] } {
  const texte: string[] = [];
  const hat = (liste: string[], x: string) => liste.some((l) => l.toLowerCase() === x.toLowerCase());
  const rasse = hat(profil.mag.rassen, e.race) ? 1 : hat(profil.meidet.rassen, e.race) ? -1 : 0;
  const klasse = hat(profil.mag.klassen, e.className) ? 0.5 : hat(profil.meidet.klassen, e.className) ? -0.5 : 0;
  if (rasse) texte.push(`${e.race} ${rasse > 0 ? "+" : "−"}${Math.abs(rasse)}`);
  if (klasse) texte.push(`${e.className} ${klasse > 0 ? "+" : "−"}${Math.abs(klasse)}`);
  let traitSumme = 0;
  const gesehen = new Set<string>();
  for (const roh of e.traits) {
    const k = normalisiereTrait(roh);
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    const name = TRAIT_TABELLE[k]?.name;
    if (!name) continue;
    const v = hat(profil.mag.traits, name) ? 0.5 : hat(profil.meidet.traits, name) ? -0.5 : 0;
    if (v) {
      traitSumme += v;
      texte.push(`${name} ${v > 0 ? "+" : "−"}0,5`);
    }
  }
  return { wert: klemme(rasse + klasse + klemme(traitSumme, -1, 1), -1, 1), texte };
}

/** Der Team-Anteil in seinen sechs Bausteinen (Konzept 4.2). */
export function berechneTeamAnteil(
  e: Pick<MarketingSpielerEingabe, "traits" | "moralOhne" | "restlaufzeit" | "klausel" | "istGesicht">,
  t: Pick<MarketingTeamEingabe, "erfolgPunkte" | "erfolgGrund">,
): { prozent: number; roh: number; bausteine: TeamAnteilBaustein[] } {
  const gesehen = new Set<string>();
  let pers = 0;
  const persTexte: string[] = [];
  for (const roh of e.traits) {
    const k = normalisiereTrait(roh);
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    const p = TRAIT_TEAM_ANTEIL[k];
    if (p) {
      pers += p;
      persTexte.push(`${TRAIT_TABELLE[k]?.name ?? k} ${p > 0 ? "+" : "−"}${Math.abs(p)}`);
    }
  }
  const persBegrenzt = klemme(pers, -20, 20);
  const rest = e.restlaufzeit;
  const laufzeit = rest == null ? 0 : rest <= 1 ? -5 : rest >= 3 ? 5 : 0;
  const klausel = (e.klausel ?? 0) * MARKETING_KONFIG.klauselPunkte;
  const moral = e.moralOhne == null ? 0 : klemme(Math.round((e.moralOhne - 60) / 4), -5, 5);
  const gesicht = e.istGesicht ? MARKETING_KONFIG.gesichtAnteilPunkte : 0;
  const bausteine: TeamAnteilBaustein[] = [
    {
      id: "persoenlichkeit",
      label: "Persönlichkeit",
      punkte: persBegrenzt,
      text: persTexte.length ? persTexte.join(" · ") + (pers !== persBegrenzt ? " · begrenzt auf ±20" : "") : "kein Trait, der gibt oder nimmt",
    },
    {
      id: "laufzeit",
      label: "Vertragslaufzeit",
      punkte: laufzeit,
      text: rest == null ? "Laufzeit unbekannt" : rest <= 1 ? "letzte Vertragssaison: er hält sich alles offen" : rest >= 3 ? `noch ${rest} Saisons: lange gebunden` : `noch ${rest} Saisons`,
    },
    {
      id: "klausel",
      label: "Werbeklausel",
      punkte: klausel,
      text: (e.klausel ?? 0) < 0 ? "Spieler behält mehr" : (e.klausel ?? 0) > 0 ? "Team bekommt mehr" : "Standard",
    },
    {
      id: "moral",
      label: "Moral",
      punkte: moral,
      text: e.moralOhne == null ? "Moral unbekannt" : `Moral ${Math.round(e.moralOhne)} · (Moral − 60) ÷ 4`,
    },
    { id: "gesicht", label: "Aushängeschild", punkte: gesicht, text: e.istGesicht ? "der Verein führt die Kampagne" : "nicht das Gesicht der Saison" },
    { id: "erfolg", label: "Teamerfolg", punkte: t.erfolgPunkte, text: t.erfolgGrund },
  ];
  const roh = MARKETING_KONFIG.teamAnteilBasis + bausteine.reduce((s, b) => s + b.punkte, 0);
  return { prozent: klemme(roh, MARKETING_KONFIG.teamAnteilMin, MARKETING_KONFIG.teamAnteilMax), roh, bausteine };
}

/** Moral-Zuschlag aus dem Spieler-Anteil in C je Saison, mit Trait-Gewicht (Diva, Egomaniac, Mercenary, Ambitious ×1,5; Altruistic, Timid ×0,5). */
export function moralZuschlagAus(anIhn: number, traits: string[]): number {
  let stufe = 0;
  for (const [ab, punkte] of MARKETING_KONFIG.moralStufen) {
    if (anIhn >= ab) {
      stufe = punkte;
      break;
    }
  }
  if (stufe === 0) return 0;
  const gesehen = new Set<string>();
  let gewicht = 1;
  for (const roh of traits) {
    const k = normalisiereTrait(roh);
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    gewicht *= TRAIT_MORAL_GEWICHT[k] ?? 1;
  }
  return Math.round(stufe * gewicht);
}

/** Die ganze Rechnung für einen Spieler bei einem Team. */
export function berechneMarketing(e: MarketingSpielerEingabe, t: MarketingTeamEingabe): MarketingSpielerErgebnis {
  const gesehen = new Set<string>();
  let traitSumme = 0;
  let lieb = 0;
  let anecker = 0;
  for (const roh of e.traits) {
    const k = normalisiereTrait(roh);
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    const z = TRAIT_TABELLE[k];
    if (!z) continue;
    traitSumme += z.reichweite;
    const g = z.ton * Math.max(z.reichweite, 1);
    if (g > 0) lieb += g;
    else anecker -= g;
  }
  const leistung = r1(0.3 * klemme(e.leistungPerz, 0, 100));
  const ausstrahlung = klemme(10 + 1.2 * traitSumme, 0, 46);
  const typ = Math.min(14, (KLASSEN_TYP[e.className] ?? 0) + (RASSEN_TYP[e.race] ?? 0));
  const schub = klemme(e.schub ?? 0, 0, 20);
  const reichweite = Math.min(100, leistung + ausstrahlung + typ + schub);
  const gesinnung = /-G$/.test(e.alignment ?? "") ? 0.4 : /-B$/.test(e.alignment ?? "") ? -0.4 : 0;
  const ton = klemme((lieb - anecker) / 12 + gesinnung, -1, 1);
  const kante = klemme((lieb + anecker) / 20, 0, 1);

  const thema = berechneThema(e, t.profil);
  const farbIdx = KLASSEN_FARBE[e.className];
  const farbe = farbIdx == null ? 0 : klemme((t.profil.fanfarbe[farbIdx] - 5) / 5, -1, 1);
  const passKante = -0.1 + 0.2 * kante;
  const passTon = 0.22 * ton * t.profil.ton;
  const passThema = 0.15 * thema.wert;
  const passFarbe = 0.05 * farbe;
  const passung = klemme(1 + passKante + passTon + passThema + passFarbe, 0.6, 1.4);
  const marketability = Math.min(100, reichweite * passung);

  const verletztHalb = e.verletzt === true;
  let werbegeld =
    MARKETING_KONFIG.werbeMax[t.liga] * Math.pow(Math.max(0, marketability - 30) / 70, 2) * (e.istGesicht ? MARKETING_KONFIG.gesichtWerbeFaktor : 1);
  if (verletztHalb) werbegeld *= 0.5;
  const anteil = berechneTeamAnteil(e, t);
  const netz = MARKETING_KONFIG.netzAnteilGehalt * Math.max(0, e.gehalt);
  const nachAnteil = (anteil.prozent / 100) * werbegeld;
  const netzGreift = nachAnteil > netz + 0.005;
  const ansTeam = Math.min(nachAnteil, netz);
  const anIhn = werbegeld - ansTeam;
  return {
    leistung,
    ausstrahlung: r1(ausstrahlung),
    typ,
    schub,
    reichweite: r1(reichweite),
    traitSumme,
    ton: r2(ton),
    kante: r2(kante),
    passKante: r2(passKante),
    passTon: r2(passTon),
    passThema: r2(passThema),
    passFarbe: r2(passFarbe),
    passung: r2(passung),
    themaTexte: thema.texte,
    marketability: r1(marketability),
    werbegeld,
    teamAnteilProzent: Math.round(anteil.prozent),
    teamAnteilRoh: Math.round(anteil.roh),
    bausteine: anteil.bausteine,
    netzGreift,
    ansTeam,
    anIhn,
    moralZuschlag: moralZuschlagAus(anIhn, e.traits),
    verletztHalb,
  };
}

// ---------------------------------------------------------------------------------------------
// Fanfarbe: Drift beim Saisonwechsel (Konzept 3.2)
// ---------------------------------------------------------------------------------------------

/** Schritt der Drift: 10 % Saisonziel verfehlt, 15 % erreicht, 20 % Titel/Aufstieg/Farb-Meister. */
export function driftSchritt(erfolg: "verfehlt" | "erreicht" | "titel"): number {
  return erfolg === "titel" ? 0.2 : erfolg === "erreicht" ? 0.15 : 0.1;
}

/**
 * Fanfarbe neu = alt + Schritt x (Ziel - alt), Ziel = 20 x (½ Kader-Anteil + ½ Erfolgs-Anteil). Anker: keine Farbe entfernt sich mehr
 * als 6 Punkte vom Startwert, keine wird negativ, die Summe bleibt 20.
 */
export function driftFanfarbe(
  alt: Fanfarbe,
  start: Fanfarbe,
  kaderAnteil: [number, number, number, number],
  erfolgsAnteil: [number, number, number, number],
  schritt: number,
): Fanfarbe {
  const neu = alt.map((a, i) => {
    const ziel = 20 * (0.5 * kaderAnteil[i] + 0.5 * erfolgsAnteil[i]);
    return klemme(a + schritt * (ziel - a), Math.max(0, start[i] - 6), start[i] + 6);
  });
  for (let durchgang = 0; durchgang < 4; durchgang += 1) {
    const summe = neu.reduce((s, x) => s + x, 0);
    if (Math.abs(summe - 20) < 1e-9) break;
    const frei = neu.map((x, i) => {
      const unten = Math.max(0, start[i] - 6);
      const oben = start[i] + 6;
      return summe > 20 ? x > unten + 1e-9 : x < oben - 1e-9;
    });
    const n = frei.filter(Boolean).length;
    if (n === 0) break;
    const delta = (20 - summe) / n;
    for (let i = 0; i < 4; i += 1) {
      if (!frei[i]) continue;
      neu[i] = klemme(neu[i] + delta, Math.max(0, start[i] - 6), start[i] + 6);
    }
  }
  return [r2(neu[0]), r2(neu[1]), r2(neu[2]), r2(neu[3])];
}

/** Anteile (Summe 1) aus vier Zahlen; bei Summe 0 gleichverteilt. */
export function anteile4(werte: [number, number, number, number]): [number, number, number, number] {
  const s = werte.reduce((a, b) => a + Math.max(0, b), 0);
  if (s <= 0) return [0.25, 0.25, 0.25, 0.25];
  return werte.map((w) => Math.max(0, w) / s) as [number, number, number, number];
}

export { FARB_NAMEN };

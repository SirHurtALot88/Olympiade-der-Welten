/**
 * BELASTUNG UND RESISTENZ (Regel „v2“, Chris 21.11., Variante „mild“).
 *
 * Grundlage: docs/design/belastung-resistenz-v2-21-11.md (Härtetest), Mockup
 * public/mockups/belastung-resistenz-v2-21-11.html, Antworten Chris in docs/design/belastung-resistenz-21-11.md.
 * Bau-Doku: docs/design/belastung-resistenz-bau-21-11/README.md.
 *
 * REINE FUNKTIONEN, keine Server-Importe: dieselbe Rechnung läuft in der Buchung
 * (`lib/fatigue/fatigue-injury-service.ts`: Roll-Map, Apply, Replay-Rücknahme), in der KI-Aufstellung
 * und in der Einsatzlisten-Vorschau im Browser. Gezeigt = gebucht.
 *
 *   Last eines Einsatzes = (Grundlast der Platz-Stufe + Zusatz aus Resistenz) × Trait × Einsatz
 *
 *   Stufe     Schwelle  Grundlast
 *   niedrig      45       12,5
 *   mittel       60       15,0
 *   hoch         75       17,5
 *
 *   Resistenz = Wert des Spielers im Belastungs-Attribut des Platzes (`strainAttribute`).
 *   unter der Schwelle: +0,15 je fehlendem Punkt, höchstens +4
 *   über der Schwelle:  −0,05 je Punkt, höchstens −2
 *
 * Resistenz wirkt NUR auf die Erschöpfung. Das Verletzungsrisiko folgt unverändert allein aus der
 * Erschöpfung (`fatigue-calibration.ts`).
 *
 * Alte Regel („alt“): 16 × Trait × Einsatz für jeden Platz — gilt für jede Saison ohne Stempel
 * (`seasonState.belastungsRegel`), also für die laufende Saison jedes bestehenden Spielstands.
 */
export type BelastungsRegelVersion = "alt" | "v2";

export type BelastungsStufe = "low" | "medium" | "high";

export const BELASTUNG_V2 = {
  schwelle: { low: 45, medium: 60, high: 75 } as Record<BelastungsStufe, number>,
  grundlast: { low: 12.5, medium: 15, high: 17.5 } as Record<BelastungsStufe, number>,
  jePunktDrunter: 0.15,
  deckelDrunter: 4,
  jePunktDrueber: 0.05,
  deckelDrueber: 2,
} as const;

/**
 * Aktive Erholung je Einsatz in einer v2-Saison (Chris 21.11.: 4,5 → 4,0). Gleicht die Pause nach
 * Spieltag 10 aus, damit der Verletzungskorridor 150–200 hält (Härtetest Abschnitt B).
 * Gilt nur, wo die aktive Erholung überhaupt greift (`isFatigueActiveRecoveryEnabled`).
 */
export const BELASTUNG_V2_AKTIVE_ERHOLUNG = 4.0;

/** Nach diesem Spieltag (1-basiert) liegt in einer v2-Saison die Pause: ein Ruhe-Spieltag für alle. */
export const BELASTUNG_PAUSE_NACH_SPIELTAG = 10;

/**
 * KI-Gewicht der Last beim Besetzen der Plätze: Platzwert − Gewicht × Last. Bewusst klein
 * (Chris: „leicht gewichtet, nicht dominant“) — im Härtetest fiele die Liga unter den Korridor,
 * wenn alle Teams rein nach Last setzten. Gemessen in docs/design/belastung-resistenz-bau-21-11/README.md.
 */
export const BELASTUNG_KI_LASTGEWICHT = 0.25;

export function istBelastungsStufe(wert: unknown): wert is BelastungsStufe {
  return wert === "low" || wert === "medium" || wert === "high";
}

function runde(wert: number, stellen = 2) {
  return Number(wert.toFixed(stellen));
}

export type SlotBelastungsTeile = {
  stufe: BelastungsStufe;
  schwelle: number;
  grundlast: number;
  /** Resistenzwert (Belastungs-Attribut des Spielers), null = unbekannt (dann kein Zusatz). */
  resistenz: number | null;
  /** Resistenz minus Schwelle (0 bei unbekannter Resistenz). */
  abstand: number;
  /** Zusatz zur Grundlast: positiv = zu schwach, negativ = über der Schwelle. */
  zusatz: number;
  /** Zusatz am Deckel (+4 bzw. −2). */
  amDeckel: boolean;
};

/** Grundlast und Resistenz-Zusatz eines Platzes für einen Spieler (vor Trait und Einsatz). */
export function berechneSlotBelastungsTeile(input: {
  stufe: BelastungsStufe;
  resistenz: number | null | undefined;
}): SlotBelastungsTeile {
  const stufe = istBelastungsStufe(input.stufe) ? input.stufe : "medium";
  const schwelle = BELASTUNG_V2.schwelle[stufe];
  const grundlast = BELASTUNG_V2.grundlast[stufe];
  const resistenz =
    typeof input.resistenz === "number" && Number.isFinite(input.resistenz) ? input.resistenz : null;
  if (resistenz == null) {
    return { stufe, schwelle, grundlast, resistenz: null, abstand: 0, zusatz: 0, amDeckel: false };
  }
  const abstand = runde(resistenz - schwelle, 2);
  let zusatz = 0;
  let amDeckel = false;
  if (abstand < 0) {
    const roh = BELASTUNG_V2.jePunktDrunter * -abstand;
    amDeckel = roh >= BELASTUNG_V2.deckelDrunter;
    zusatz = Math.min(BELASTUNG_V2.deckelDrunter, roh);
  } else if (abstand > 0) {
    const roh = BELASTUNG_V2.jePunktDrueber * abstand;
    amDeckel = roh >= BELASTUNG_V2.deckelDrueber;
    zusatz = -Math.min(BELASTUNG_V2.deckelDrueber, roh);
  }
  return { stufe, schwelle, grundlast, resistenz, abstand, zusatz: runde(zusatz, 4), amDeckel };
}

/**
 * DIE EINE LAST-FORMEL eines Einsatzes — Buchung, KI und Anzeige rufen genau diese Funktion.
 *
 * `lastFaktor` = Trait-Multiplikator × Einsatz-Multiplikator (Schonen 0,75 / Normal 1 / Pushen 1,4).
 * `altGrundlast` = `MATCHDAY_FATIGUE_LOAD` (16, ENV-tunebar) für die alte Regel.
 *
 * Alte Regel: `round(altGrundlast × lastFaktor)` — exakt die bisherige Rechnung (bit-identisch,
 * dieselbe Multiplikationsreihenfolge: Grundlast × Trait × Einsatz).
 */
export function berechneEinsatzLast(input: {
  regel: BelastungsRegelVersion;
  altGrundlast: number;
  traitMultiplikator: number;
  einsatzMultiplikator: number;
  slot?: { stufe: BelastungsStufe; resistenz: number | null | undefined } | null;
}): number {
  if (input.regel !== "v2" || !input.slot) {
    return runde(input.altGrundlast * input.traitMultiplikator * input.einsatzMultiplikator);
  }
  const teile = berechneSlotBelastungsTeile(input.slot);
  return runde((teile.grundlast + teile.zusatz) * input.traitMultiplikator * input.einsatzMultiplikator);
}

export type BelastungsTon = "gut" | "mittel" | "schwach" | "neutral";

/**
 * Farbton wie im Mockup: grün ab der Schwelle, rot ab 60 % des Deckels darunter, sonst gelb.
 * `neutral` bei alter Regel oder unbekannter Resistenz.
 */
export function belastungsTon(teile: SlotBelastungsTeile | null | undefined): BelastungsTon {
  if (!teile || teile.resistenz == null) return "neutral";
  if (teile.abstand >= 0) return "gut";
  return teile.zusatz >= BELASTUNG_V2.deckelDrunter * 0.6 ? "schwach" : "mittel";
}

/** „zu schwach +1,6“ / „über Schwelle −0,8“ / „an der Schwelle“ — Kurztext für Slot-Vorschau und Kader. */
export function belastungsZusatzText(teile: SlotBelastungsTeile | null | undefined): string | null {
  if (!teile || teile.resistenz == null) return null;
  const zahl = (wert: number) => Math.abs(wert).toFixed(1).replace(".", ",");
  if (teile.zusatz > 0) return `zu schwach +${zahl(teile.zusatz)}${teile.amDeckel ? " (Deckel)" : ""}`;
  if (teile.zusatz < 0) return `über Schwelle −${zahl(teile.zusatz)}${teile.amDeckel ? " (Deckel)" : ""}`;
  return "an der Schwelle";
}

function klemmeFatigue(wert: number | null | undefined) {
  if (typeof wert !== "number" || !Number.isFinite(wert)) return 0;
  return Math.max(0, Math.min(100, Number(wert.toFixed(2))));
}

/**
 * Erschöpfung, mit der ein Einsatz in den Verletzungswurf geht: aktuelle Erschöpfung + (Last − aktive
 * Erholung), mit derselben doppelten Klemmung wie der Wurf (`projectMatchdayInjuryRisk`,
 * `buildMatchdayInjuryRollMap`). Rein, damit die Einsatzlisten-Vorschau dieselbe Zahl im Browser rechnet.
 */
export function projiziereEinsatzErschoepfung(input: {
  aktuelleFatigue: number | null | undefined;
  last: number;
  aktiveErholung?: number | null;
}): number {
  const aktiv = Math.max(0, input.aktiveErholung ?? 0);
  const netto = aktiv === 0 ? input.last : runde(input.last - aktiv);
  return klemmeFatigue(klemmeFatigue(input.aktuelleFatigue) + netto);
}

export const BELASTUNGS_STUFEN_TEXT: Record<BelastungsStufe, string> = {
  low: "niedrig",
  medium: "mittel",
  high: "hoch",
};

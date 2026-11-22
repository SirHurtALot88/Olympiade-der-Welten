/**
 * ENTWICKLUNG NEU (Chris, 22.11., docs/design/entwicklung-balance-22-11.md) -- reine Rechenbausteine.
 *
 * Gilt nur, wenn der Spielstand die Saison mit `seasonState.entwicklungsRegel = "neu"` gestempelt hat
 * (`lib/resolve/entwicklung-regel.ts`); jeder Aufrufer fragt `entwicklungNeuFuer(gameState)`.
 *
 * Die Zahlen sind an einem Messlauf geeicht (32 KI-Teams von Anfang an, `scripts/miss-entwicklung.ts`); die Doku nennt
 * Vorher/Nachher je Saison. `OLY_ENT_PARAMS` (JSON) ueberschreibt einzelne Werte NUR fuer Messlaeufe -- im Spiel nie gesetzt.
 */

export type EntwicklungsParameter = {
  /** Leistungsfaktor auf den gebuchten Trainingszuwachs: unterstes / oberstes Ende (Chris: ca. 0,6 bis 1,4). */
  faktorMin: number;
  faktorMax: number;
  /** Einsaetze (Disziplin-Auftritte einer Saison), ab denen der Leistungsfaktor voll zaehlt. */
  einsatzVoll: number;
  /** Mindestzahl Einsaetze, ab der ein Spieler in die Liga-Rangfolge der Leistung eingeht. */
  einsatzMin: number;
  /** Rangwert (0..1) fuer Spieler mit weniger als `einsatzMin` Einsaetzen. */
  rangWenigEinsaetze: number;
  /** Leistungskanal (Zuwachs aus gespielten Disziplinen) wird mit diesem Faktor skaliert. */
  leistungsSkala: number;
  /** Grundabbau je Attribut und Saison (alt: 0,3). */
  abbauBasis: number;
  /** Verfall (Summe ueber alle zwoelf Attribute) je Ausfalltag: wer verletzt fehlt, verliert zusaetzlich. */
  verfallJeAusfalltag: number;
  /** Fokus: wer sein Trainingsziel haelt, bekommt bis zu +fokusStaerke, wer es dauernd wechselt bis zu -fokusStaerke auf den Zuwachs. */
  fokusStaerke: number;
  /** Abbau haengt an der Leistung: je Rangpunkt unter der Mitte (0,5) wachsen Abbau und Verfall um diesen Anteil. */
  abbauLeistungsKopplung: number;
  /** Entwicklungskurve: Rohsumme x -> sign(x) * kurveA * |x / kurveSigma| ^ kurveK, hoechstens +-kurveMax. */
  kurveA: number;
  kurveSigma: number;
  kurveK: number;
  kurveMax: number;
  /** Schub-Deckel: ohne Leistung ueber dem Median und gehaltenes Ziel waechst ein Spieler hoechstens um diesen Betrag (< 8). */
  schubOhneVerdienstMax: number;
  /** Leistungsrang (0..1), ab dem der Deckel zu steigen beginnt; Fokus-Anteil und Mindesttage mit Ziel analog. */
  schubRangMin: number;
  schubFokusMin: number;
  schubZielTageMin: number;
  /** Breite der Rampe (Rang- und Fokus-Anteil), ueber die der Deckel von `schubOhneVerdienstMax` auf `kurveMax` steigt. */
  schubRampe: number;
};

export const ENTWICKLUNGS_PARAMETER_STANDARD: EntwicklungsParameter = {
  faktorMin: 0.6,
  faktorMax: 1.4,
  einsatzVoll: 10,
  einsatzMin: 4,
  rangWenigEinsaetze: 0.25,
  leistungsSkala: 0.6,
  abbauBasis: 0.51,
  verfallJeAusfalltag: 0.25,
  fokusStaerke: 0.5,
  abbauLeistungsKopplung: 1.0,
  kurveA: 2.5,
  kurveSigma: 4,
  kurveK: 2.6,
  kurveMax: 18,
  schubOhneVerdienstMax: 7.5,
  schubRangMin: 0.5,
  schubFokusMin: 0.6,
  schubZielTageMin: 12,
  schubRampe: 0.15,
};

let parameterCache: EntwicklungsParameter | null = null;

export function entwicklungsParameter(): EntwicklungsParameter {
  if (parameterCache) return parameterCache;
  let ueberschrieben: Partial<EntwicklungsParameter> = {};
  const roh = typeof process !== "undefined" ? process.env?.OLY_ENT_PARAMS : undefined;
  if (roh) {
    try {
      ueberschrieben = JSON.parse(roh) as Partial<EntwicklungsParameter>;
    } catch {
      ueberschrieben = {};
    }
  }
  parameterCache = { ...ENTWICKLUNGS_PARAMETER_STANDARD, ...ueberschrieben };
  return parameterCache;
}

/**
 * Abnehmender Ertrag je Abstand zur Decke (h = Decke - aktueller Wert): bis 1 Punkt Abstand kaum noch Zuwachs (0,05, wie
 * bisher "capped"), ab 10 Punkten voller Satz, dazwischen stetig. Der alte Zustandsschritt (1 / 0,45 / 0,05) lag bei 5 Punkten
 * Abstand auf 0,45 -- die Kurve trifft dort 0,47 und ist ueber 5 bis 10 Punkte neu abfallend statt voll.
 */
export function ertragsFaktor(abstandZurDecke: number | null | undefined): number {
  if (abstandZurDecke == null || !Number.isFinite(abstandZurDecke)) return 1;
  if (abstandZurDecke <= 1) return 0.05;
  if (abstandZurDecke >= 10) return 1;
  return 0.05 + (0.95 * (abstandZurDecke - 1)) / 9;
}

/**
 * Wie viel vom gebuchten Trainingszuwachs ankommt: gut die Haelfte ohne Einsaetze (`faktorMin`), bei vollem Einsatz und
 * Spitzenleistung `faktorMax`. `rang` = Anteil der Liga-Spieler mit schwaecherer Leistung (0..1).
 */
export function trainingsAnkommFaktor(einsaetze: number, rang: number, p: EntwicklungsParameter = entwicklungsParameter()): number {
  const einsatzAnteil = Math.max(0, Math.min(1, einsaetze / p.einsatzVoll));
  const r = Math.max(0, Math.min(1, rang));
  return p.faktorMin + (p.faktorMax - p.faktorMin) * einsatzAnteil * r;
}

/** Verfall (Summe ueber zwoelf Attribute, >= 0) eines Spielers aus seinen Ausfalltagen (Verletzung: kein Training). */
export function verfallSumme(ausfallTage: number, p: EntwicklungsParameter = entwicklungsParameter()): number {
  return p.verfallJeAusfalltag * Math.max(0, ausfallTage);
}

/**
 * Entwicklungskurve: kleine Rohsummen werden gedaempft (die Masse bleibt "kaum veraendert"), grosse verstaerkt (wenige
 * Schuebe und Einbrueche). Das Vorzeichen bleibt, nur der Betrag aendert sich -- die Verteilung auf die Attribute ebenso.
 */
export function entwicklungsKurve(rohSumme: number, p: EntwicklungsParameter = entwicklungsParameter(), maxPlus: number = p.kurveMax): number {
  if (!Number.isFinite(rohSumme) || rohSumme === 0) return 0;
  const betrag = Math.min(rohSumme > 0 ? maxPlus : p.kurveMax, p.kurveA * Math.pow(Math.abs(rohSumme) / p.kurveSigma, p.kurveK));
  return Math.sign(rohSumme) * betrag;
}

/** Faktor, mit dem alle Attribut-Deltas eines Spielers multipliziert werden (>= 0). */
export function entwicklungsKurvenSkala(rohSumme: number, p: EntwicklungsParameter = entwicklungsParameter(), maxPlus: number = p.kurveMax): number {
  if (!Number.isFinite(rohSumme) || Math.abs(rohSumme) < 1e-6) return 1;
  return entwicklungsKurve(rohSumme, p, maxPlus) / rohSumme;
}

/** Fokus-Faktor aus dem Anteil des meistgewaehlten Trainingsziels (0..1): 1 - s bei <= 0,4, 1 + s bei 1,0. */
export function fokusFaktor(dominanz: number, p: EntwicklungsParameter = entwicklungsParameter()): number {
  const t = Math.max(0, Math.min(1, (dominanz - 0.4) / 0.6));
  return 1 - p.fokusStaerke + 2 * p.fokusStaerke * t;
}

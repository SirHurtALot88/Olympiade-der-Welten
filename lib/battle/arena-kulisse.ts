/**
 * OBERFLAECHEN-EFFEKTE (08.11., docs/design/oberflaechen-effekte-konzept-08-11.md, Stufe 1-3).
 *
 * Eine Kulissen-Variante (Tennis auf Rasen, Sand oder Hochhausdach) ist ein kleiner, nullsummiger
 * Versatz auf die Matrixgewichte der Disziplin:
 *
 *     W_variante[k] = W_matrix[k] + K[d][v][k]
 *     OW(p, v)      = Summe_k K[d][v][k] * a_p[k] / 100      (gedeckelt auf +/- deckel)
 *
 * Die gesperrte Matrix (`lib/player-generator/official-discipline-weights.ts`) bleibt dabei
 * unangetastet -- sie wird hier nicht einmal importiert. Weil jede Spalte ueber die Varianten zu
 * Null summiert und die Variantenwahl gleichverteilt ist, ist das Saisonmittel exakt die Matrix.
 *
 * Diese Datei ist chromium-/React-frei (wie `arena-seed.ts`), damit Host, Runner, Aufstellung und
 * Tests dieselbe Wahl treffen. Die Engine (`public/mockups/battle-mode.engine.js`) traegt dieselben
 * Profile als JSON-Zeile `KULISSEN_PROFILE` und denselben Hash; `tests/arena-kulisse.test.ts`
 * prueft beides auf Gleichheit.
 */

/**
 * FNV-1a ueber einen Text -- Zeichen fuer Zeichen `normalisiereSaat()` aus der Engine (fuer einen
 * nicht-leeren String). Fuer Zahlen/leer: `saat || 1337` wie dort.
 */
export function kulisseNormalisiereSaat(saat: string | number | null | undefined): number {
  if (typeof saat === "string" && saat.length) {
    let h = 2166136261;
    for (let i = 0; i < saat.length; i += 1) {
      h ^= saat.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  return (saat as number) || 1337;
}

/** Avalanche-Mix (MurmurHash3-Finalizer-Stil) -- Zeichen fuer Zeichen `ispyMischeHash()`. */
export function kulisseMischeHash(x: number): number {
  let h = x >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** `kulisseHash` der Engine: `ispyMischeHash(normalisiereSaat(s))`. */
export function kulisseHash(text: string): number {
  return kulisseMischeHash(kulisseNormalisiereSaat(text));
}

/**
 * Der Hash-Schluessel, Feld fuer Feld wie `kulisseWaehlen()` in der Engine:
 * `disziplin|saat|heim|gast|spieltag`, fehlende Teile als leerer Text.
 */
export function kulisseSchluessel(
  disziplin: string,
  saat: string | number | null | undefined,
  heimTeamId: string | null | undefined,
  gastTeamId: string | null | undefined,
  spieltag: string | number | null | undefined,
): string {
  return [disziplin, saat == null ? "" : String(saat), heimTeamId || "", gastTeamId || "", spieltag ?? ""].join("|");
}

/** Index der Variante bei `anzahl` Varianten -- dieselbe Rechnung wie die Engine. */
export function waehleKulisseIndex(
  anzahl: number,
  disziplin: string,
  saat: string | number | null | undefined,
  heimTeamId: string | null | undefined,
  gastTeamId: string | null | undefined,
  spieltag: string | number | null | undefined,
): number {
  if (!(anzahl > 0)) return -1;
  return kulisseHash(kulisseSchluessel(disziplin, saat, heimTeamId, gastTeamId, spieltag)) % anzahl;
}

export type KulissenAttribut =
  | "power"
  | "health"
  | "stamina"
  | "intelligence"
  | "awareness"
  | "determination"
  | "speed"
  | "dexterity"
  | "charisma"
  | "will"
  | "spirit"
  | "torment";

export type KulissenVariante = {
  id: string;
  label: string;
  /** Ein Wort fuer den Kompakt-Chip am Spieler ("Sand ++"). */
  kurz: string;
  /** Ein Halbsatz, was der Platz will -- fuer die Kulissen-Zeile im Picker. */
  untertitel: string;
  /** Delta in Gewichtspunkten auf die Matrix, Summe 0. */
  profil: Partial<Record<KulissenAttribut, number>>;
};

export type KulissenDisziplinProfil = {
  /** Harter Deckel des Oberflaechenwerts in Eignungspunkten (Konzept Regel 9). */
  deckel: number;
  /** Reihenfolge = Reihenfolge in `battle-mode.kulissen.js` (gleicher Hash-Index). */
  varianten: KulissenVariante[];
};

/**
 * Die Profile. Tennis ist der Pilot (Konzept 5.1, Fables Tabelle unveraendert, Deckel +/-5).
 * Jede Disziplin ohne Eintrag hat keinen Oberflaechen-Effekt.
 */
export const ARENA_KULISSEN_PROFILE: Readonly<Record<string, KulissenDisziplinProfil>> = {
  tennis: {
    deckel: 5,
    varianten: [
      {
        id: "court",
        label: "Centre Court",
        kurz: "Rasen",
        untertitel: "Rasen, flacher Absprung, kurze Ballwechsel",
        profil: { awareness: 3, speed: 3, intelligence: 1, stamina: -4, dexterity: -1, determination: -2 },
      },
      {
        id: "riviera",
        label: "Sandplatz Riviera",
        kurz: "Sand",
        untertitel: "Sand, hoher Absprung, lange Ballwechsel",
        profil: { awareness: -2, speed: -3, intelligence: -2, stamina: 4, dexterity: 3, determination: 1, charisma: -1 },
      },
      {
        id: "dach",
        label: "Hochhausdach",
        kurz: "Dach",
        untertitel: "Hartplatz unter Flutlicht, berechenbarer Absprung",
        profil: { awareness: -1, intelligence: 1, dexterity: -2, determination: 1, charisma: 1 },
      },
    ],
  },
};

/** Gibt die Profile im Engine-Format zurueck (fuer den Gleichheitstest gegen `KULISSEN_PROFILE`). */
export function kulissenProfileImEngineFormat(): Record<
  string,
  { deckel: number; varianten: string[]; profil: Record<string, Partial<Record<KulissenAttribut, number>>> }
> {
  const aus: ReturnType<typeof kulissenProfileImEngineFormat> = {};
  for (const [d, p] of Object.entries(ARENA_KULISSEN_PROFILE)) {
    aus[d] = {
      deckel: p.deckel,
      varianten: p.varianten.map((v) => v.id),
      profil: Object.fromEntries(p.varianten.map((v) => [v.id, { ...v.profil }])),
    };
  }
  return aus;
}

export function hatKulissenProfil(disziplin: string): boolean {
  return Object.prototype.hasOwnProperty.call(ARENA_KULISSEN_PROFILE, disziplin);
}

/**
 * STUFE 1 (Fundament): die Variante einer Begegnung, bevor der Spieltag laeuft.
 *
 * Kanonische Eingaben (Host, Runner und Picker benutzen genau diese, damit Anzeige und Wertung
 * dieselbe Variante sehen): `saat` = die Zahl-Saat der Begegnung (`seedZuZahl(buildArenaMatchSeed(...))`),
 * Heim/Gast in FIXTURE-Orientierung (nie die UI-Auswahl), `spieltag` = die `matchdayId`.
 * Keine neue Zufallsquelle: derselbe FNV-1a+fmix32-Hash wie `kulisseWaehlen()` der Engine.
 *
 * Gibt `null` fuer jede Disziplin ohne Kulissen-Profil zurueck.
 */
export function waehleKulisse(
  disziplin: string,
  saat: string | number | null | undefined,
  heimTeamId: string | null | undefined,
  gastTeamId: string | null | undefined,
  spieltag: string | number | null | undefined,
): KulissenVariante | null {
  const p = ARENA_KULISSEN_PROFILE[disziplin];
  if (!p || !p.varianten.length) return null;
  return p.varianten[waehleKulisseIndex(p.varianten.length, disziplin, saat, heimTeamId, gastTeamId, spieltag)] ?? null;
}

export type KulissenFixtureEingabe = {
  disziplin: string;
  saat: number;
  homeTeamId: string;
  awayTeamId: string;
  matchdayId: string | null | undefined;
};

/** `waehleKulisse` mit den kanonischen Fixture-Eingaben (s. dort). */
export function waehleKulisseFuerFixture(eingabe: KulissenFixtureEingabe): KulissenVariante | null {
  return waehleKulisse(eingabe.disziplin, eingabe.saat, eingabe.homeTeamId, eingabe.awayTeamId, eingabe.matchdayId ?? "");
}

export type KulissenBeitrag = {
  attribut: KulissenAttribut;
  wert: number;
  delta: number;
  /** K[k] * (a[k] - Feldmittel[k]) / 100, s. Konzept 4.2 b. */
  beitrag: number;
};

export type Oberflaechenwert = {
  /** Gedeckelter Oberflaechenwert in Eignungspunkten -- genau der Wert, den die Engine addiert. */
  ow: number;
  /** Ungedeckelter Rohwert. */
  owRoh: number;
  /** Beitraege je Profil-Attribut, nach Betrag absteigend. */
  beitraege: KulissenBeitrag[];
};

/**
 * Oberflaechenwert eines Spielers auf einer Variante. `feldmittel` (optional) macht die Beitraege
 * relativ zum Feld des Spieltags ("aus welchen Gruenden"); ohne Feldmittel ist der Bezugspunkt 50.
 * Der OW selbst haengt wegen Summe K = 0 nicht vom Bezugspunkt ab.
 */
export function berechneOberflaechenwert(
  attribute: Partial<Record<string, number>>,
  disziplin: string,
  varianteId: string,
  feldmittel?: Partial<Record<string, number>>,
): Oberflaechenwert | null {
  const p = ARENA_KULISSEN_PROFILE[disziplin];
  const v = p?.varianten.find((x) => x.id === varianteId);
  if (!p || !v) return null;
  let roh = 0;
  const beitraege: KulissenBeitrag[] = [];
  for (const [k, delta] of Object.entries(v.profil) as [KulissenAttribut, number][]) {
    if (!delta) continue;
    const a = Number(attribute[k] ?? 0) || 0;
    roh += (delta * a) / 100;
    const bezug = Number(feldmittel?.[k] ?? 50) || 0;
    beitraege.push({ attribut: k, wert: a, delta, beitrag: (delta * (a - bezug)) / 100 });
  }
  beitraege.sort((x, y) => Math.abs(y.beitrag) - Math.abs(x.beitrag));
  const ow = Math.max(-p.deckel, Math.min(p.deckel, roh));
  return { ow, owRoh: roh, beitraege };
}

export type KulissenTendenz = "++" | "+" | "0" | "-" | "--";

/** Konzept 4.1: >= +2,5 `++`, +1,0..+2,5 `+`, -1,0..+1,0 `0`, -2,5..-1,0 `-`, <= -2,5 `--`. */
export function kulissenTendenz(ow: number): KulissenTendenz {
  if (ow >= 2.5) return "++";
  if (ow >= 1) return "+";
  if (ow > -1) return "0";
  if (ow > -2.5) return "-";
  return "--";
}

export const KULISSEN_TENDENZ_TEXT: Readonly<Record<KulissenTendenz, string>> = {
  "++": "liegt diesem Platz klar — macht bei knappem Abstand den Unterschied",
  "+": "kommt mit diesem Platz gut zurecht",
  "0": "neutral auf diesem Platz",
  "-": "tut sich auf diesem Platz schwer",
  "--": "liegt diesem Platz gar nicht — verliert die knappen Duelle",
};

const ATTRIBUT_LABEL: Readonly<Record<KulissenAttribut, string>> = {
  power: "Power",
  health: "Health",
  stamina: "Stamina",
  intelligence: "Intelligence",
  awareness: "Awareness",
  determination: "Determination",
  speed: "Speed",
  dexterity: "Dexterity",
  charisma: "Charisma",
  will: "Will",
  spirit: "Spirit",
  torment: "Torment",
};

export function kulissenAttributLabel(k: string): string {
  return ATTRIBUT_LABEL[k as KulissenAttribut] ?? k;
}

/** Die zwei bis drei groessten Auf- und Abwertungen einer Variante, fuer die Kulissen-Zeile. */
export function kulissenTendenzChips(
  variante: KulissenVariante,
  anzahl = 3,
): Array<{ attribut: KulissenAttribut; label: string; delta: number; richtung: "auf" | "ab" }> {
  return (Object.entries(variante.profil) as [KulissenAttribut, number][])
    .filter(([, d]) => d !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || b[1] - a[1])
    .slice(0, anzahl)
    .map(([attribut, delta]) => ({ attribut, label: ATTRIBUT_LABEL[attribut], delta, richtung: delta > 0 ? "auf" : "ab" }));
}

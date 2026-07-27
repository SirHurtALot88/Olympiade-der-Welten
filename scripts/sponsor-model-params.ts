/**
 * EIN Parametersatz fuer alle Sponsor-Modellskripte (kein Produktionscode).
 *
 * WARUM DIESE DATEI EXISTIERT — gemessener Befund des Balancing-Audits:
 * Die drei Modellskripte trugen DREI VERSCHIEDENE Parametersaetze. Die Pruefmaschinerie
 * (FOSD-Fallen-Test, EV-Paritaet, Kalibrierung, Stresstest) sitzt in
 * scripts/sponsor-model-proposal.ts und lief noch mit den ALTEN Werten:
 *
 *   Groesse              proposal.ts (alt)      bands.ts / 5season-model.ts (neu)
 *   Untergrenze          44 flach               38/40/42/45 je Rarity, absolut min 35
 *   LIGA-Spitze          77                     72
 *   Kurve aufwaerts      4*d (linear)           2.5*d - 0.9*d^2 (konkav)
 *   Kurve abwaerts       4.5*d                  2.8*d
 *   Klausel-Spannweite   18                     11
 *   sigma                4                      5.5
 *   Korridor             +-8 Raenge             +-11 Raenge
 *   Pool-Gleichanteil    (existierte nicht)     0.5
 *
 * Folge: der NEUE Satz war nie auf Fallenfreiheit geprueft. Alle "0 Fallen"-Haken der
 * Vergangenheit galten fuer einen Parametersatz, den kein anderes Skript mehr benutzt.
 *
 * Ab hier liest jedes Skript aus DIESER Datei. Wer einen Wert aendert, aendert ihn ueberall,
 * und die Pruefmaschinerie sieht ihn sofort.
 *
 * Diese Datei ist reine Datenhaltung — sie gibt nichts aus und ruft nichts auf.
 */

// ── Leiter 1: LIGA — was ein Tabellenplatz absolut wert ist ────────────────────────────────────
export const TIERS = [
  { label: "Meister", lo: 1, hi: 1 }, { label: "Top 4", lo: 2, hi: 4 }, { label: "Top 8", lo: 5, hi: 8 },
  { label: "Top 12", lo: 9, hi: 12 }, { label: "Top 16", lo: 13, hi: 16 }, { label: "Top 20", lo: 17, hi: 20 },
  { label: "Top 24", lo: 21, hi: 24 }, { label: "Top 28", lo: 25, hi: 28 }, { label: "Platz 32", lo: 29, hi: 32 },
];
/** Rang -> Stufenindex. Klemmt und rundet, damit gebrochene Staerkeraenge nicht -1 (=> NaN) liefern. */
export const tierOf = (rank: number): number => {
  const c = Math.max(1, Math.min(32, Math.round(rank)));
  return TIERS.findIndex((t) => c >= t.lo && c <= t.hi);
};
/**
 * Spitze 72 statt 77: die alte 77 war gegen die flache Untergrenze 44 kalibriert. Mit der
 * gestaffelten Untergrenze (38-45) traegt die Leiter unten mehr und braucht oben weniger.
 */
export const LIGA = [72, 67, 63, 59, 55, 51, 47, 43, 39];

// ── Untergrenze — je Rarity gestaffelt, absolutes Minimum 35 ───────────────────────────────────
/**
 * Die Untergrenze haengt an der RARITY der Karte, nicht an der Tabellenstufe: eine bessere Karte
 * garantiert mehr. 35 ist das absolute Minimum, das nie unterschritten wird.
 *
 * Historie: 44 flach klemmte fast jedes Band am unteren Ende fest; im Extremfall
 * (gewoehnlich/sockellastig/Platz 32) kollabierte die Karte auf 44-44 mit Spannweite 0 — dort
 * wirkte weder Kurve noch Klausel noch Sonderziel.
 */
export const FLOOR_RARITY: Record<string, number> = {
  "gewöhnlich": 38, "magisch": 40, "selten": 42, "legendär": 45,
};
export const FLOOR_ABSOLUT = 35;
/** Daempfung, mit der die Untergrenze im schwachen Ligajahr mitfaellt. */
export const FLOOR_DAMP = 0.8;
/**
 * Untergrenze faellt bei sf < 1 gedaempft mit, steigt bei sf > 1 NICHT.
 * Sie ist Schutz, keine Belohnung: im guten Jahr mitzuwachsen hiesse, den Keller genau dann
 * anzuheben, wenn die Spitze bevorzugt werden soll (gemessen: U-Form im Ueberschuss).
 */
export const floorAt = (rarity: string, sf: number): number =>
  Math.max(FLOOR_ABSOLUT, (FLOOR_RARITY[rarity] ?? FLOOR_RARITY["magisch"]!) * (sf >= 1 ? 1 : 1 - FLOOR_DAMP * (1 - sf)));

// ── Ziel-EV-Leiter ─────────────────────────────────────────────────────────────────────────────
export const TARGET_EV_BASE = [76.0, 73.6, 71.6, 67.9, 63.8, 59.9, 56.7, 54.1, 53.0];
export const TARGET_EV_MEAN = TARGET_EV_BASE.reduce((a, b) => a + b, 0) / TARGET_EV_BASE.length;
/** Steilheit: spreizt die Leiter um ihren Mittelwert. 1.7 ist der abgenommene Wert. */
export const TARGET_GAMMA = Number(process.env.OLY_SPONSOR_GAMMA ?? 1.7);
export const TARGET_EV_SHAPE = TARGET_EV_BASE.map((v) => TARGET_EV_MEAN + (v - TARGET_EV_MEAN) * TARGET_GAMMA);

// ── Rarity als BUDGET-Pool ─────────────────────────────────────────────────────────────────────
export const RARITY_MULT: Record<string, number> = {
  "gewöhnlich": 0.85, "magisch": 1.0, "selten": 1.15, "legendär": 1.35,
};
export const RARITY_ORDER = ["gewöhnlich", "magisch", "selten", "legendär"];
/** Ziehungsgewichte der Rarities fuer den Mehrsaisonlauf. */
export const RARITY_DRAW: Record<string, number> = {
  "gewöhnlich": 0.30, "magisch": 0.47, "selten": 0.18, "legendär": 0.05,
};
/** Der Pool in C, den eine Rarity gegenueber dem Standard zusaetzlich vergibt (gewoehnlich: negativ). */
export const poolFor = (rarity: string): number =>
  ((RARITY_MULT[rarity] ?? 1) - 1) * TARGET_EV_MEAN * TIERS.length;
/**
 * Anteil des Pools, der GLEICHMAESSIG auf alle Stufen geht, bevor das Profil den Rest formt.
 * Ohne ihn gehen Keller-Teams bei einem spitzenlastigen Profil leer aus (gemessen: Platz 32 bekam
 * 48/49/50/51 ueber alle vier Rarities — eine legendaere Karte war dort so viel wert wie eine
 * gewoehnliche).
 */
export const POOL_EVEN_SHARE = Number(process.env.OLY_SPONSOR_EVEN ?? 0.5);
/** Standard-Sonderziel-Anteil der Basiskarte, unabhaengig vom Pool. */
export const BASE_SPECIAL = 0.25;

// ── Leiter 2: relative Kurve (repraesentative Form) ────────────────────────────────────────────
/**
 * Aufwaerts-Ast von 4 auf 2.5 zurueckgenommen (Decken lagen je Stufe rund 10 C zu hoch), mit
 * konkavem Term: grosse Spruenge zahlen unterproportional. Abwaerts-Ast von 4.5 auf 2.8
 * abgeflacht, damit ein abgestuerzter Favorit nicht sofort an der Untergrenze klebt.
 */
export const CURVE_BASE = 5;
export const CURVE_UP = 2.5;
export const CURVE_CONCAVE = 0.9;
export const CURVE_DOWN = 2.8;
export const rel = (d: number): number =>
  (d > 0 ? CURVE_BASE + CURVE_UP * d - CURVE_CONCAVE * d * d : CURVE_BASE + CURVE_DOWN * d);

// ── Leiter 4: Klausel ──────────────────────────────────────────────────────────────────────────
/**
 * Bonus und Malus werden aus (P, Spannweite s) ABGELEITET: bonus = s*(1-P), malus = s*P.
 * Damit ist der EV-Beitrag jeder Klausel exakt 0 und die Spannweite exakt s — beides unabhaengig
 * von P. Frei gewaehlte Bonus/Malus neben klausel-eigenem P erzeugten nachweislich Dominanz.
 */
export const clauseBonus = (s: number, p: number): number => s * (1 - p);
export const clauseMalus = (s: number, p: number): number => s * p;
/** Repraesentative Klausel fuer Baender und Mehrsaisonlauf: Spannweite 11 (vorher 18), p 0.5. */
export const CLAUSE_S_REPR = 11;
export const CLAUSE_P_REPR = 0.5;

// ── Leiter 3: Sonderziel ───────────────────────────────────────────────────────────────────────
/**
 * Das Sonderziel ist eine LOTTERIE, kein Zuschlag: mit Wahrscheinlichkeit P_GOAL zahlt es
 * `EV / P_GOAL`, sonst nichts. Der Fallen-Test hat es frueher nur als Erwartungswert gefuehrt —
 * das war falsch, seit die Verteilungsprofile bis zu 70 % des Budgets dorthin schieben.
 *
 * P_GOAL ist eine DESIGN-SCHAETZUNG (Mitte des Bandes 0.15-0.72 aus sponsor-objective-pricing.ts)
 * und der groesste ungemessene Parameter des Entwurfs.
 */
export const P_GOAL = Number(process.env.OLY_SPONSOR_PGOAL ?? 0.45);
/** Deckel wie in sponsor-objective-pricing.ts: ohne ihn dominiert der Tail sehr schwerer Ziele. */
export const GOAL_REWARD_CAP = 4.0;
export const goalPayout = (evTarget: number, p: number = P_GOAL): number =>
  evTarget * Math.min(GOAL_REWARD_CAP, 1 / Math.max(p, 1e-6));

// ── Ergebnisstreuung und erreichbarer Korridor ─────────────────────────────────────────────────
/** Streuung der Endraenge um den Erwartungsrang. GESETZT, nicht gemessen — traegt das Ergebnis. */
export const SIGMA = 5.5;
/** Halbe Breite des als erreichbar betrachteten Rangkorridors. */
export const CORRIDOR = 11;
export const dist = (expected: number, sigma: number = SIGMA): number[] => {
  const w: number[] = [];
  for (let r = 1; r <= 32; r += 1) w.push(Math.exp(-((r - expected) ** 2) / (2 * sigma * sigma)));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
};
/** Die als erreichbar betrachteten Endraenge eines Teams mit Erwartungsrang `expected`. */
export const corridorOf = (expected: number, half: number = CORRIDOR): number[] => {
  const band: number[] = [];
  for (let r = Math.max(1, Math.round(expected) - half); r <= Math.min(32, Math.round(expected) + half); r += 1) band.push(r);
  return band;
};

// ── Verteilungsprofile ─────────────────────────────────────────────────────────────────────────
/**
 * Die Rarity liefert ein BUDGET, das Profil entscheidet, WO es landet.
 * `specialShare` = Anteil des Pools, der ins Sonderziel geht.
 * `tierWeights`  = Verteilung des geformten Rests ueber die 9 Stufen, Summe 1.
 */
export type Profile = { name: string; specialShare: number; tierWeights: number[]; note: string };
export const PROFILES: Profile[] = [
  { name: "ausgewogen",    specialShare: 0.25, tierWeights: [.11, .11, .11, .11, .11, .11, .11, .11, .12],
    note: "Pool gleichmaessig ueber alle Stufen" },
  { name: "spitzenlastig", specialShare: 0.15, tierWeights: [.28, .24, .18, .12, .08, .05, .03, .02, .00],
    note: "fast alles auf die Spitzenplaetze — ein Angebot fuer Titelambitionen" },
  { name: "sockellastig",  specialShare: 0.15, tierWeights: [.00, .02, .03, .05, .08, .12, .18, .24, .28],
    note: "zieht die unteren Plaetze ans Mittelfeld heran" },
  { name: "mittelfeld",    specialShare: 0.20, tierWeights: [.02, .05, .10, .18, .25, .18, .10, .07, .05],
    note: "belohnt das Mittelfeld, Spitze und Keller gehen leer aus" },
  { name: "zielschwer",    specialShare: 0.70, tierWeights: [.11, .11, .11, .11, .11, .11, .11, .11, .12],
    note: "der Pool steckt fast komplett im Sonderziel — maximaler Eigeneinfluss" },
];
export const profileByName = (name: string): Profile => PROFILES.find((p) => p.name === name) ?? PROFILES[0]!;

/**
 * Aufteilung des Pools auf Leiter (1+2+4) und Sonderziel fuer eine gegebene Stufe.
 * EINE Stelle — vorher rechneten bands.ts, 5season-model.ts und proposal.ts das jeweils selbst,
 * proposal.ts sogar ohne den Gleichanteil.
 */
export function cardTargets(rarity: string, profile: Profile, tier: number) {
  const pool = poolFor(rarity);
  const shaped = pool * (1 - profile.specialShare);
  const evenPart = (shaped * POOL_EVEN_SHARE) / TIERS.length;
  const profilePart = shaped * (1 - POOL_EVEN_SHARE) * profile.tierWeights[tier]!;
  return {
    /** Kalibrierziel fuer Liga + Kurve + Klausel. */
    ladder: TARGET_EV_SHAPE[tier]! * (1 - BASE_SPECIAL) + evenPart + profilePart,
    /** Erwartungswert des Sonderziels. */
    special: TARGET_EV_SHAPE[tier]! * BASE_SPECIAL + (pool * profile.specialShare) / TIERS.length,
  };
}

// ── Wirtschaftliche Referenzen aus einem echten S1-Save ────────────────────────────────────────
export const SALARY_SUM_S1 = 2078;
export const SALARY_TOP = 87.8;
export const SALARY_MIN = 43.7;
export const salaryAtRank = (r: number): number => SALARY_TOP - (SALARY_TOP - SALARY_MIN) * ((r - 1) / 31);
/** Fuenf Saisons mit wechselndem salaryFactor — mal schwach, mal stark. */
export const SEASON_SF = [0.85, 1.15, 0.95, 1.25, 0.80];

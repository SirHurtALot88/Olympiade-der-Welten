/**
 * SPONSOR-MODELL V2 — REINE RECHENSCHICHT (Phase P1 des Umsetzungsplans).
 *
 * Vier getrennte Leitern statt eines Mischmaschs:
 *   Leiter 1  LIGA        absolut, 4er-Stufen, sponsorUNABHAENGIG — was ein Platz wert ist.
 *   Leiter 2  KURVE       RELATIV (d = erwartete Stufe − erreichte Stufe). Die Sponsor-Identitaet.
 *   Leiter 3  SONDERZIEL  Lotterie: mit P_GOAL zahlt sie EV/P_GOAL, sonst nichts.
 *   Leiter 4  KLAUSEL     rangUNABHAENGIGE Zustandsbedingung mit Bonus UND Malus.
 *
 * Diese Datei enthaelt AUSSCHLIESSLICH pure Funktionen — kein GameState, kein IO, keine Zufalls-
 * quelle, keine Datumsabhaengigkeit. Sie ist damit einzeln testbar und wird von der
 * Angebotserzeugung, vom Settlement, von der Anzeige und von der KI-Bewertung gemeinsam benutzt.
 * Genau das traegt die harte Projekt-Invariante "Anzeige == Settlement": es gibt nur EINE
 * Rechenstelle.
 *
 * HERKUNFT DER ZAHLEN — nicht erfunden, sondern gemessen:
 * Alle Konstanten sind identisch zu `scripts/sponsor-model-params.ts`, der Referenz, gegen die der
 * Engine-Schattentest gelaufen ist (docs/SPONSOR_SCHATTENTEST_ENGINE.md). `tests/sponsor-v2-model.test.ts`
 * vergleicht beide Seiten Zahl fuer Zahl und schlaegt an, sobald sie auseinanderlaufen — die
 * Doppelhaltung ist damit abgesichert statt gehofft. (Die Skripte duerfen nicht aus lib/ importieren
 * und lib/ nicht aus scripts/: scripts sind Werkzeuge, lib ist Produktionscode.)
 */

// ── Leiter 1: LIGA ─────────────────────────────────────────────────────────────────────────────
export const SPONSOR_V2_TIERS: ReadonlyArray<{ label: string; lo: number; hi: number }> = [
  { label: "Meister", lo: 1, hi: 1 }, { label: "Top 4", lo: 2, hi: 4 }, { label: "Top 8", lo: 5, hi: 8 },
  { label: "Top 12", lo: 9, hi: 12 }, { label: "Top 16", lo: 13, hi: 16 }, { label: "Top 20", lo: 17, hi: 20 },
  { label: "Top 24", lo: 21, hi: 24 }, { label: "Top 28", lo: 25, hi: 28 }, { label: "Platz 32", lo: 29, hi: 32 },
];
/** Rang -> Stufenindex. Klemmt und rundet, damit gebrochene Staerkeraenge nicht -1 (=> NaN) liefern. */
export function sponsorV2TierOf(rank: number): number {
  const c = Math.max(1, Math.min(32, Math.round(rank)));
  const idx = SPONSOR_V2_TIERS.findIndex((t) => c >= t.lo && c <= t.hi);
  return idx < 0 ? SPONSOR_V2_TIERS.length - 1 : idx;
}
export const SPONSOR_V2_LIGA: readonly number[] = [74, 68, 64, 59, 55, 51, 47, 43, 39];

// ── Untergrenze ────────────────────────────────────────────────────────────────────────────────
export const SPONSOR_V2_RARITIES = ["gewöhnlich", "magisch", "selten", "legendär"] as const;
export type SponsorV2Rarity = (typeof SPONSOR_V2_RARITIES)[number];
export const SPONSOR_V2_FLOOR_RARITY: Readonly<Record<SponsorV2Rarity, number>> = {
  "gewöhnlich": 35, "magisch": 37, "selten": 39, "legendär": 42,
};
export const SPONSOR_V2_FLOOR_ABSOLUT = 35;
/** Daempfung, mit der die Untergrenze im schwachen Ligajahr mitfaellt. */
export const SPONSOR_V2_FLOOR_DAMP = 0.8;
/**
 * Untergrenze faellt bei sf < 1 gedaempft mit, steigt bei sf > 1 NICHT.
 * Sie ist Schutz, keine Belohnung: im guten Jahr mitzuwachsen hiesse, den Keller genau dann
 * anzuheben, wenn die Spitze bevorzugt werden soll.
 */
export function sponsorV2FloorAt(rarity: SponsorV2Rarity, salaryFactor: number): number {
  const base = SPONSOR_V2_FLOOR_RARITY[rarity] ?? SPONSOR_V2_FLOOR_RARITY["magisch"];
  return Math.max(SPONSOR_V2_FLOOR_ABSOLUT, base * (salaryFactor >= 1 ? 1 : 1 - SPONSOR_V2_FLOOR_DAMP * (1 - salaryFactor)));
}

// ── Ziel-EV-Leiter und Rarity-Pool ─────────────────────────────────────────────────────────────
const TARGET_EV_BASE = [76.0, 73.6, 71.6, 67.9, 63.8, 59.9, 56.7, 54.1, 53.0];
const TARGET_EV_MEAN = TARGET_EV_BASE.reduce((a, b) => a + b, 0) / TARGET_EV_BASE.length;
/** Steilheit: spreizt die Leiter um ihren Mittelwert. 1.7 ist der abgenommene Wert. */
export const SPONSOR_V2_TARGET_GAMMA = 1.7;
export const SPONSOR_V2_TARGET_EV_SHAPE: readonly number[] =
  TARGET_EV_BASE.map((v) => TARGET_EV_MEAN + (v - TARGET_EV_MEAN) * SPONSOR_V2_TARGET_GAMMA);

export const SPONSOR_V2_RARITY_MULT: Readonly<Record<SponsorV2Rarity, number>> = {
  "gewöhnlich": 0.85, "magisch": 1.0, "selten": 1.15, "legendär": 1.35,
};
/** Der Pool in C, den eine Rarity gegenueber dem Standard zusaetzlich vergibt (gewoehnlich: negativ). */
export function sponsorV2PoolFor(rarity: SponsorV2Rarity): number {
  return ((SPONSOR_V2_RARITY_MULT[rarity] ?? 1) - 1) * TARGET_EV_MEAN * SPONSOR_V2_TIERS.length;
}
/**
 * VOLLE EV-Renormierung: der Rarity-Pool geht gleichmaessig auf alle Stufen. Der Gesamt-EV einer
 * Karte haengt damit nur noch an Rarity und Erwartungsstufe — die Profile unterscheiden sich
 * ausschliesslich in der FORM. Halbe Renormierung liess 932 FOSD-Dominanzfaelle stehen.
 */
export const SPONSOR_V2_POOL_EVEN_SHARE = 1.0;

// ── Leiter 2: relative Kurven ──────────────────────────────────────────────────────────────────
const CURVE_BASE = 5, CURVE_UP = 2.5, CURVE_CONCAVE = 0.9, CURVE_DOWN = 2.8;
/**
 * Der konkave Term ist GESAETTIGT statt quadratisch: a*d/(1+beta*d) statt a*d − c*d².
 * beta = 0.36 reproduziert die urspruengliche Absicht bis zur zweiten Ordnung bei d = 0
 * (f'(0) = 2.5, f''(0) = −1.8), die Ableitung 2.5/(1+0.36d)² ist aber ueberall positiv. Die
 * quadratische Fassung hatte ihren Scheitel bei d = 1.389 und bestrafte danach ein Wunderjahr.
 */
export const SPONSOR_V2_CURVE_BETA = CURVE_CONCAVE / CURVE_UP;
const relLinear = (d: number): number =>
  (d > 0 ? CURVE_BASE + (CURVE_UP * d) / (1 + SPONSOR_V2_CURVE_BETA * d) : CURVE_BASE + CURVE_DOWN * d);

export type SponsorV2CurveName = "Sockel" | "Halten" | "Linear" | "Gipfel" | "Steil" | "Flach";
export type SponsorV2Curve = { name: SponsorV2CurveName; rel: (d: number) => number; note: string };
export const SPONSOR_V2_CURVES: readonly SponsorV2Curve[] = [
  { name: "Sockel", rel: (d) => (d <= 0 ? 6 : 6 + d), note: "hoher Sockel, kaum Decke" },
  { name: "Halten", rel: (d) => (d === 0 ? 12 : d > 0 ? 12 - 3 * d : 12 + 6 * d), note: "Maximum beim exakten Halten" },
  { name: "Linear", rel: relLinear, note: "gleichmaessig, milder Malus" },
  { name: "Gipfel", rel: (d) => (d >= 2 ? 14 + 10 * (d - 2) : d === 1 ? 2 : -6 + 3 * d), note: "erst zwei Stufen zahlen, darunter Malus" },
  { name: "Steil", rel: (d) => (d < 0 ? 5 * d : 7 * d), note: "steilster Verlauf beidseitig" },
  { name: "Flach", rel: (d) => (d <= 0 ? 2 : 2 + 2 * d), note: "Rang fast egal — die Klausel entscheidet" },
];
export function sponsorV2CurveByName(name: string): SponsorV2Curve {
  return SPONSOR_V2_CURVES.find((c) => c.name === name) ?? SPONSOR_V2_CURVES[2]!;
}

// ── Leiter 4: Klauseln ─────────────────────────────────────────────────────────────────────────
/**
 * Bonus und Malus werden aus (P, Spannweite s) ABGELEITET: bonus = s*(1−P), malus = s*P.
 * Damit ist der EV-Beitrag jeder Klausel exakt 0 und die Spannweite exakt s — beides unabhaengig
 * von P. Frei gewaehlte Bonus/Malus neben klausel-eigenem P erzeugten nachweislich Dominanz.
 */
export const sponsorV2ClauseBonus = (s: number, p: number): number => s * (1 - p);
export const sponsorV2ClauseMalus = (s: number, p: number): number => s * p;

export type SponsorV2Clause = {
  name: string; label: string; p: number; s: number; lever: string;
  /** true = am Saison-END-Zustand trivial auswertbar. Nur diese gehen in den Angebots-Pool. */
  evaluable: boolean;
  /** "up" = Metrik >= Schwelle erfuellt, "down" = Metrik <= Schwelle erfuellt. */
  direction: "up" | "down";
};
/**
 * 15 Klauseln. Der Katalog hatte 20; fuenf sind nach dem Engine-Schattentest raus (Charakterarbeit
 * und Kapitaenstreue prinzipiell nicht messbar, Hartes Training / XP-Disziplin / Beliebtheit ohne
 * Daten im Lauf), zwei sind neu gefasst (Ausbau auf alle Gebaeude, Wortlaut mit freier Schwelle).
 * Begruendung je Eintrag: docs/SPONSOR_SCHATTENTEST_ENGINE.md, Abschnitt 8.
 */
export const SPONSOR_V2_CLAUSES: readonly SponsorV2Clause[] = [
  { name: "Einsatzlast", label: "Saison-Fatigue-Schnitt ≥ X (auspowern)", p: 0.55, s: 24,
    lever: "trainingMode + Rotation", evaluable: false, direction: "up" },
  { name: "Schonung", label: "Saison-Fatigue-Schnitt ≤ X (rotieren)", p: 0.5, s: 17,
    lever: "Rotation, kostet Tabellenpunkte", evaluable: false, direction: "down" },
  { name: "Talentschmiede", label: "X Spieler steigen eine Klasse auf", p: 0.4, s: 24,
    lever: "Trainingsfokus + Anlagen", evaluable: true, direction: "up" },
  { name: "Wertaufbau", label: "Kaderwert +X % über die Saison", p: 0.5, s: 20,
    lever: "Training + Transfers", evaluable: true, direction: "up" },
  { name: "Achsenprofil", label: "eine Achse (POW/SPE/MEN/SOC) in die Top-N der Klasse", p: 0.45, s: 22,
    lever: "Trainingsklasse + Kaderbau", evaluable: false, direction: "down" },
  { name: "Disziplinen", label: "X Disziplinen mit positivem Saison-Delta", p: 0.5, s: 19,
    lever: "preferredDisciplines + Training", evaluable: false, direction: "up" },
  { name: "Schuldenfrei", label: "kein neuer Kredit (oder einen getilgt)", p: 0.85, s: 8,
    lever: "Finanzplanung", evaluable: true, direction: "down" },
  { name: "Gehaltseffizienz", label: "Gehaltssumme unter der Schwelle deiner Klasse", p: 0.5, s: 18,
    lever: "Verhandlung + Kaderschnitt", evaluable: true, direction: "down" },
  { name: "Kaderruhe", label: "höchstens X Transfers (Zu- und Abgänge)", p: 0.6, s: 15,
    lever: "Transferdisziplin", evaluable: true, direction: "down" },
  { name: "Ausbau", label: "mindestens X Gebäudestufen ausbauen", p: 0.6, s: 25,
    lever: "Bauinvestition statt Spieler", evaluable: true, direction: "up" },
  { name: "Prophylaxe", label: "höchstens X Verletzungen über die Saison", p: 0.45, s: 20,
    lever: "Belastungssteuerung", evaluable: true, direction: "down" },
  { name: "Moral", label: "Ø-Moral am Saisonende über der Schwelle", p: 0.55, s: 17,
    lever: "Rollen, Einsatzzeiten, Kapitän", evaluable: true, direction: "up" },
  { name: "Vielseitigkeit", label: "≥ X verschiedene Subklassen im Kader", p: 0.6, s: 16,
    lever: "Kaderkomposition breit halten", evaluable: true, direction: "up" },
  { name: "Fokusschule", label: "≥ X Spieler auf derselben Trainingsklasse", p: 0.55, s: 19,
    lever: "trainingClass buendeln — Gegenteil von Vielseitigkeit", evaluable: true, direction: "up" },
  { name: "Wortlaut", label: "höchstens X gebrochene Spielerversprechen", p: 0.45, s: 22,
    lever: "Rolle/Einsätze/Trainingsmodus zusagen und liefern", evaluable: false, direction: "down" },
];
export function sponsorV2ClauseByName(name: string): SponsorV2Clause {
  return SPONSOR_V2_CLAUSES.find((c) => c.name === name) ?? SPONSOR_V2_CLAUSES[0]!;
}

// ── Leiter 3: Sonderziel als Lotterie ──────────────────────────────────────────────────────────
/**
 * Das Sonderziel ist eine LOTTERIE, kein Zuschlag: mit Wahrscheinlichkeit P_GOAL zahlt es
 * `EV / P_GOAL` (gedeckelt), sonst nichts. P_GOAL ist eine DESIGN-SCHAETZUNG und der groesste
 * ungemessene Parameter des Entwurfs.
 */
export const SPONSOR_V2_P_GOAL = 0.45;
export const SPONSOR_V2_GOAL_REWARD_CAP = 4.0;
export function sponsorV2GoalPayout(evTarget: number, p: number = SPONSOR_V2_P_GOAL): number {
  return evTarget * Math.min(SPONSOR_V2_GOAL_REWARD_CAP, 1 / Math.max(p, 1e-6));
}

// ── Die drei harten Kartenschranken ────────────────────────────────────────────────────────────
/**
 * VORGABE DES AUFTRAGGEBERS, woertlich: "sonderziele duerfen maximal 15% vom gesamtwert der karte
 * ausmachen". Gemessen wird an der Auszahlung auf dem ERWARTUNGSRANG mit erfuellter Klausel — also
 * an genau der Zeile "Auszahlung beim aktuellen Platz", an der der Verstoss aufgefallen ist
 * (Bosch Hausgeraete: 166,0 von 214,4 = 77 %).
 *
 * Der Deckel wird beim Bau der Karte durchgesetzt (`buildSponsorV2Terms`), nicht beim Anzeigen:
 * ein Betrag, der erst in der Darstellung gekuerzt wird, waere eine Anzeige, die das Settlement
 * nicht einloest.
 */
export const SPONSOR_V2_GOAL_MAX_SHARE = 0.15;
/**
 * Die Untergrenze ist SCHUTZ, kein Kartenanteil. Sie darf nie mehr als dieser Bruchteil dessen
 * sein, was die Karte im Mittel ueberhaupt zahlt — sonst verschluckt sie Rangleiter, Klausel und
 * Sonderziel und die Karte zahlt auf jedem Platz denselben Betrag. Genau das war der Kollaps.
 */
export const SPONSOR_V2_FLOOR_MAX_SHARE = 0.55;
/**
 * Mindestspreizung der garantierten Rangleiter zwischen Meister und Platz 32, NACH K. Darunter ist
 * der Endrang wirtschaftlich bedeutungslos. 12 C sind rund ein Viertel der schwaechsten Karte.
 */
export const SPONSOR_V2_MIN_LADDER_SPREAD = 12;
/** Mindestwirkung der Klausel auf dem Erwartungsrang, NACH K. Eine Klausel mit 0,0 ist ein totes Modul. */
export const SPONSOR_V2_MIN_CLAUSE_EFFECT = 2;
/**
 * Groesste Spannweite (Bonus + Malus), die eine Klausel gemessen am Karten-Erwartungswert haben darf.
 *
 * Die Spannweiten s = 8..25 C stammen aus dem Schattentest und wurden gegen eine andere Groessen-
 * ordnung gemessen als die heutigen Karten: eine gewoehnliche Karte fuer ein Kellerteam hat einen
 * Erwartungswert von 35,6 C, die Klausel "Ausbau" allein eine Spannweite von 25 C. Der Malus von
 * 15 C zwang die Untergrenze auf 7 C herunter, damit er ueberhaupt sichtbar wird — sonst waere er
 * abgeschnitten und die Klausel wirkungslos. Eine Klausel, deren Ausschlag zwei Drittel der Karte
 * ausmacht, ist keine Nebenbedingung mehr, sondern die Karte.
 */
export const SPONSOR_V2_CLAUSE_MAX_SHARE = 0.35;
/** Die Spannweite, mit der diese Klausel auf DIESER Karte wirklich rechnet. */
export function sponsorV2ClauseSpreadForCard(clauseSpread: number, cardTargetEv: number): number {
  return Math.max(0, Math.min(clauseSpread, SPONSOR_V2_CLAUSE_MAX_SHARE * Math.max(0, cardTargetEv)));
}
/** Mindestauszahlung des Sonderziels, NACH K. Ein Sonderziel mit 0,0 ist ein totes Modul. */
export const SPONSOR_V2_MIN_GOAL_PAYOUT = 1.5;

/**
 * Untergrenze DIESER Karte: die Rarity-Untergrenze, aber gekappt auf einen Anteil des
 * Karten-Erwartungswerts. Fuer reiche Karten aendert sich nichts (die Rarity-Untergrenze bleibt
 * darunter), fuer arme Karten weicht sie — und genau die waren kollabiert.
 */
export function sponsorV2FloorForCard(rarity: SponsorV2Rarity, salaryFactor: number, cardTargetEv: number): number {
  return Math.min(sponsorV2FloorAt(rarity, salaryFactor), SPONSOR_V2_FLOOR_MAX_SHARE * Math.max(0, cardTargetEv));
}

// ── Ergebnisstreuung und Rueckschritt zur Mitte ────────────────────────────────────────────────
/** GEMESSEN, nicht gesetzt: 6.62 ueber 128 echte Team-Saisons. Design war 5.5. */
export const SPONSOR_V2_SIGMA = 6.6;
export const SPONSOR_V2_RANK_MEAN = 16.5;
/**
 * Schrumpfung zur Tabellenmitte, per Kleinstquadraten aus denselben 128 Team-Saisons.
 * Ohne sie ist die Verteilung um den Erwartungsrang zentriert — fuer ein Spitzenteam systematisch
 * zu optimistisch (gemessen: es landet +3.34 Raenge schlechter), fuer ein Kellerteam zu
 * pessimistisch (−2.11 besser).
 */
export const SPONSOR_V2_BIAS_SHRINK = 0.255;
/** Mittelpunkt der Ergebnisverteilung eines Teams mit Erwartungsrang `expectedRank`. */
export function sponsorV2CenterRank(expectedRank: number): number {
  return SPONSOR_V2_RANK_MEAN + (1 - SPONSOR_V2_BIAS_SHRINK) * (expectedRank - SPONSOR_V2_RANK_MEAN);
}
/** Wahrscheinlichkeit je Endrang 1..32 (Index 0 = Rang 1). */
export function sponsorV2RankDistribution(expectedRank: number, sigma: number = SPONSOR_V2_SIGMA): number[] {
  const c = sponsorV2CenterRank(expectedRank);
  const w: number[] = [];
  for (let r = 1; r <= 32; r += 1) w.push(Math.exp(-((r - c) ** 2) / (2 * sigma * sigma)));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

// ── Verteilungsprofile (Formachse) ─────────────────────────────────────────────────────────────
export type SponsorV2Profile = {
  name: string;
  /** Anteil der ganzen Karte, der ins Sonderziel geht. */
  specialShare: number;
  /**
   * Formgewichte je STUFENSCHRITT: 8 Schritte zwischen den 9 Tabellenstufen. `stepWeights[i]` ist
   * der Anteil des Formbudgets auf dem Schritt von Stufe i+1 auf Stufe i, also auf einer
   * VERBESSERUNG um eine Stufe. Alle >= 0, Summe 1 — genau daraus folgt die Monotonie.
   */
  stepWeights: number[];
  note: string;
};
/**
 * `specialShare` ist der Anteil des KARTEN-ERWARTUNGSWERTS, der ins Sonderziel geht — nicht der
 * Anteil der AUSZAHLUNG. Die Auszahlung folgt daraus als `specialShare * total / p` und ist
 * zusaetzlich hart bei `SPONSOR_V2_GOAL_MAX_SHARE` der Gesamtauszahlung gedeckelt.
 *
 * DIE WERTE SIND GESENKT (frueher .25/.15/.15/.20/.70) — als Fehlerbehebung, nicht als Feinschliff.
 * Bei `specialShare = 0.70` verlangte die Kalibrierung von der Rangleiter einen Erwartungswert
 * UNTER der Untergrenze: `sponsorV2Calibrate` konnte sein Ziel nicht mehr erreichen, lief an den
 * unteren Rand seiner Bisektion, und JEDER der 32 Raenge klemmte auf der Untergrenze. Gemessen an
 * 160 echt erzeugten Karten: 21 vollstaendig flache Leitern, 63 Karten mit unsichtbarer Klausel,
 * 138 mit einem Sonderziel ueber 15 % der Karte. Abgesichert in `tests/sponsor-v2-card-space.test.ts`.
 */
export const SPONSOR_V2_PROFILES: readonly SponsorV2Profile[] = [
  { name: "ausgewogen", specialShare: 0.06, stepWeights: [.125, .125, .125, .125, .125, .125, .125, .125],
    note: "Formzuwachs gleichmaessig ueber alle Stufenschritte" },
  { name: "spitzenlastig", specialShare: 0.04, stepWeights: [.30, .24, .18, .12, .08, .05, .02, .01],
    note: "der Formzuwachs sitzt ganz oben — bezahlt wird der Sprung in die Spitzenraenge" },
  { name: "sockellastig", specialShare: 0.04, stepWeights: [.01, .02, .05, .08, .12, .18, .24, .30],
    note: "der Formzuwachs sitzt ganz unten — schon der Sprung aus dem Keller zahlt" },
  { name: "mittelfeld", specialShare: 0.05, stepWeights: [.03, .07, .15, .25, .25, .15, .07, .03],
    note: "der Formzuwachs sitzt in der Tabellenmitte — Spitze und Keller sind flach" },
  { name: "zielbetont", specialShare: 0.10, stepWeights: [.125, .125, .125, .125, .125, .125, .125, .125],
    note: "groesster Sonderziel-Anteil, den die 15-%-Obergrenze zulaesst — maximaler Eigeneinfluss" },
];
export function sponsorV2ProfileByName(name: string): SponsorV2Profile {
  return SPONSOR_V2_PROFILES.find((p) => p.name === name) ?? SPONSOR_V2_PROFILES[0]!;
}

/**
 * FORMKOMPONENTE — kumuliert statt punktweise, und genau deshalb monoton.
 *
 * Die frueher benutzten punktweisen `tierWeights` waren ueber die Stufen nicht monoton (bei
 * "mittelfeld" lag Stufe 4 mit .25 ueber Stufe 3 mit .18) und erzeugten damit Karten, die fuer
 * einen BESSEREN Endrang WENIGER zahlten — gemessen 6 von 128 realisierten Karten.
 *
 * `formLadder(t) = Σ_{i>=t} stepWeights[i]` ist wegen stepWeights >= 0 ueber die Stufen
 * nicht-steigend, als Funktion des RANGES also nicht-fallend. Abgezogen wird ein rangunabhaengiger
 * Mittelwert, damit der Beitrag im Erwartungswert exakt 0 bleibt (Profil-Dominanzfreiheit).
 */
export const SPONSOR_V2_FORM_AMPLITUDE: number = 24;
export function sponsorV2FormLadder(profile: SponsorV2Profile, tier: number): number {
  let acc = 0;
  for (let i = Math.max(0, tier); i < profile.stepWeights.length; i += 1) acc += profile.stepWeights[i]!;
  return acc;
}
/**
 * Der erwartungsgewichtete Mittelwert der Formleiter wird GECACHT. Ohne Cache baut jeder Aufruf
 * eine 32-Punkte-Verteilung neu, und die Kalibrierung ruft formShape 100 (Bisektion) x 32 (Raenge)
 * x 4 (Ecken) mal auf — gemessen 46 Sekunden fuer den Paritaetstest statt Millisekunden. Der Cache
 * ist gefahrlos, weil alle Eingaenge Konstanten dieses Moduls sind (Profil, Erwartungsrang, sigma).
 */
const formMeanCache = new Map<string, number>();
export function sponsorV2FormShape(profile: SponsorV2Profile, expectedRank: number, finalTier: number): number {
  if (SPONSOR_V2_FORM_AMPLITUDE === 0) return 0;
  const key = `${profile.name}:${Math.round(expectedRank)}`;
  let mean = formMeanCache.get(key);
  if (mean === undefined) {
    const w = sponsorV2RankDistribution(expectedRank);
    mean = 0;
    for (let i = 0; i < 32; i += 1) mean += w[i]! * sponsorV2FormLadder(profile, sponsorV2TierOf(i + 1));
    formMeanCache.set(key, mean);
  }
  return SPONSOR_V2_FORM_AMPLITUDE * (sponsorV2FormLadder(profile, finalTier) - mean);
}

// ── Kartenziele ────────────────────────────────────────────────────────────────────────────────
export type SponsorV2CardTargets = { ladder: number; special: number; total: number };
/** Aufteilung des Ziel-EV auf Leiter (1+2+4) und Sonderziel fuer eine gegebene Erwartungsstufe. */
export function sponsorV2CardTargets(rarity: SponsorV2Rarity, profile: SponsorV2Profile, tier: number): SponsorV2CardTargets {
  const pool = sponsorV2PoolFor(rarity);
  const evenPart = (pool * SPONSOR_V2_POOL_EVEN_SHARE) / SPONSOR_V2_TIERS.length;
  const total = SPONSOR_V2_TARGET_EV_SHAPE[tier]! + evenPart;
  return { ladder: total * (1 - profile.specialShare), special: total * profile.specialShare, total };
}

// ── Die Karte ──────────────────────────────────────────────────────────────────────────────────
export type SponsorV2Card = {
  rarity: SponsorV2Rarity;
  profile: SponsorV2Profile;
  curve: SponsorV2Curve;
  clause: SponsorV2Clause;
};
export type SponsorV2Params = {
  sigma: number;
  pClause: number;
  pGoal: number;
  /**
   * Untergrenze DIESER Karte. Fehlt sie, gilt die reine Rarity-Untergrenze (Altverhalten der
   * Modell-Referenz in scripts/). Die Angebotserzeugung setzt sie immer explizit, weil erst die
   * kartenindividuelle Untergrenze den Leiterkollaps verhindert.
   */
  floor?: number;
  /**
   * Auszahlung des Sonderziels dieser Karte. Fehlt sie, wird sie aus den Kartenzielen abgeleitet.
   * Die Angebotserzeugung setzt sie explizit, weil sie zusaetzlich bei 15 % der Karte gedeckelt ist.
   */
  goalPayout?: number;
};
export function sponsorV2ParamsOf(card: SponsorV2Card): SponsorV2Params {
  return { sigma: SPONSOR_V2_SIGMA, pClause: card.clause.p, pGoal: SPONSOR_V2_P_GOAL };
}

/** Rangteil der Karte bei gegebenem Endrang. Kein Korridor, kein Klemmen — die Engine kennt beides nicht. */
export function sponsorV2RankPart(card: SponsorV2Card, expectedRank: number, finalRank: number, cal: number): number {
  const finTier = sponsorV2TierOf(finalRank);
  return SPONSOR_V2_LIGA[finTier]!
    + card.curve.rel(sponsorV2TierOf(expectedRank) - finTier)
    + sponsorV2FormShape(card.profile, expectedRank, finTier)
    + cal;
}

/** Arme der Klausel unter dem P, mit dem gerechnet wird. */
export function sponsorV2ClauseArms(clause: SponsorV2Clause, p: number = clause.p): { bonus: number; malus: number } {
  return { bonus: sponsorV2ClauseBonus(clause.s, p), malus: sponsorV2ClauseMalus(clause.s, p) };
}

/** Auszahlung des Sonderziels dieser Karte, wenn es erreicht wird. */
export function sponsorV2GoalPayoutOf(card: SponsorV2Card, expectedRank: number, pGoal: number = SPONSOR_V2_P_GOAL): number {
  const { special } = sponsorV2CardTargets(card.rarity, card.profile, sponsorV2TierOf(expectedRank));
  return sponsorV2GoalPayout(special, pGoal);
}

/** Realisierte Auszahlung VOR der K-Skalierung: konkreter Endrang, konkreter Klausel-/Zielzustand. */
export function sponsorV2RawPayout(
  card: SponsorV2Card, expectedRank: number, finalRank: number, cal: number,
  params: SponsorV2Params, clauseMet: boolean, goalMet: boolean,
): number {
  const { bonus, malus } = sponsorV2ClauseArms(card.clause, params.pClause);
  const gp = params.goalPayout ?? sponsorV2GoalPayoutOf(card, expectedRank, params.pGoal);
  const fl = params.floor ?? sponsorV2FloorAt(card.rarity, 1.0);
  const v = sponsorV2RankPart(card, expectedRank, finalRank, cal)
    + (clauseMet ? bonus : -malus)
    + (goalMet ? gp : 0);
  return Math.max(fl, v);
}

/** Die vier Auszahlungsecken (Klausel x Sonderziel) bei einem festen Endrang, VOR K. */
export function sponsorV2Corners(
  card: SponsorV2Card, expectedRank: number, finalRank: number, cal: number, params: SponsorV2Params,
): Array<{ v: number; p: number }> {
  const out: Array<{ v: number; p: number }> = [];
  for (const clauseMet of [true, false]) {
    for (const goalMet of [true, false]) {
      out.push({
        v: sponsorV2RawPayout(card, expectedRank, finalRank, cal, params, clauseMet, goalMet),
        p: (clauseMet ? params.pClause : 1 - params.pClause) * (goalMet ? params.pGoal : 1 - params.pGoal),
      });
    }
  }
  return out;
}

/** Erwartungswert der GANZEN Karte ueber alle 32 Endraenge, inklusive Untergrenze. */
export function sponsorV2ExpectedValue(
  card: SponsorV2Card, expectedRank: number, cal: number, params: SponsorV2Params,
): number {
  const w = sponsorV2RankDistribution(expectedRank, params.sigma);
  let acc = 0;
  for (let r = 1; r <= 32; r += 1) {
    acc += w[r - 1]! * sponsorV2Corners(card, expectedRank, r, cal, params).reduce((a, c) => a + c.p * c.v, 0);
  }
  return acc;
}

/** Standardabweichung der ganzen Karte — die Risikoachse, die dem Spieler angezeigt wird. */
export function sponsorV2StandardDeviation(
  card: SponsorV2Card, expectedRank: number, cal: number, params: SponsorV2Params,
): number {
  const m = sponsorV2ExpectedValue(card, expectedRank, cal, params);
  const w = sponsorV2RankDistribution(expectedRank, params.sigma);
  let acc = 0;
  for (let r = 1; r <= 32; r += 1) {
    for (const c of sponsorV2Corners(card, expectedRank, r, cal, params)) acc += w[r - 1]! * c.p * (c.v - m) ** 2;
  }
  return Math.sqrt(acc);
}

/**
 * Kalibrieroffset per Bisektion — der EV ist streng monoton steigend in `cal`.
 * DAS ist die Stelle, die EV-Paritaet herstellt: jede Karte eines Teams wird auf denselben
 * Ziel-EV gezogen, egal welche Kurve und Klausel sie traegt. Die Karten unterscheiden sich danach
 * ausschliesslich in Risiko und Form, nie in der Hoehe.
 */
export function sponsorV2Calibrate(card: SponsorV2Card, expectedRank: number, params: SponsorV2Params): number {
  const target = sponsorV2CardTargets(card.rarity, card.profile, sponsorV2TierOf(expectedRank)).total;
  let lo = -400, hi = 400;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    if (sponsorV2ExpectedValue(card, expectedRank, mid, params) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── K-Skalierung auf das Ligajahr ──────────────────────────────────────────────────────────────
/**
 * `gezahlt = max(fl, fl + (roh − fl) * K)`. Die Untergrenze skaliert NICHT mit — sonst waeren im
 * schlechten Jahr genau die Teams tot, die geschuetzt werden sollen. Die Stauchung kommt komplett
 * aus dem Teil OBERHALB der Untergrenze, der Verlust trifft also die Spitze, nicht den Keller.
 */
export function sponsorV2ScaleWithK(
  raw: number, rarity: SponsorV2Rarity, salaryFactor: number, k: number, floorOverride?: number,
): number {
  const fl = floorOverride ?? sponsorV2FloorAt(rarity, salaryFactor);
  return Math.max(fl, fl + (raw - fl) * k);
}
/** Traf die Untergrenze zu? */
export function sponsorV2HitFloor(raw: number, rarity: SponsorV2Rarity, salaryFactor: number, k: number): boolean {
  const fl = sponsorV2FloorAt(rarity, salaryFactor);
  return fl + (raw - fl) * k <= fl + 1e-9;
}

export type SponsorV2LeagueEntry = {
  card: SponsorV2Card;
  expectedRank: number;
  cal: number;
  /** Die Parameter, mit denen die Karte kalibriert wurde — inklusive ihrer Untergrenze. */
  params?: SponsorV2Params;
};
/** Erwartete Auszahlung EINER Karte vor der Saison bei gegebenem K — nur Vor-Saison-Information. */
export function sponsorV2ExpectedPaidAtK(
  entry: SponsorV2LeagueEntry, params: SponsorV2Params, salaryFactor: number, k: number,
): number {
  const w = sponsorV2RankDistribution(entry.expectedRank, params.sigma);
  let acc = 0;
  for (let r = 1; r <= 32; r += 1) {
    for (const c of sponsorV2Corners(entry.card, entry.expectedRank, r, entry.cal, params)) {
      acc += w[r - 1]! * c.p * sponsorV2ScaleWithK(c.v, entry.card.rarity, salaryFactor, k, params.floor);
    }
  }
  return acc;
}
/**
 * K SO LOESEN, dass die ERWARTETE Liga-Summe die Zielsumme trifft — EX ANTE, also ohne einen
 * einzigen realisierten Endrang. Wer K nachtraeglich gegen die Ziehungen loest, misst nicht die
 * Deckung, sondern definiert sie.
 */
export function sponsorV2SolveLeagueK(
  entries: SponsorV2LeagueEntry[], salaryFactor: number, targetSum: number,
): number {
  const sumAt = (k: number) => entries.reduce(
    (a, e) => a + sponsorV2ExpectedPaidAtK(e, e.params ?? sponsorV2ParamsOf(e.card), salaryFactor, k), 0);
  let lo = 0, hi = 12;
  if (entries.length === 0) return 1;
  if (sumAt(hi) < targetSum) return hi;
  for (let i = 0; i < 120; i += 1) {
    const mid = (lo + hi) / 2;
    if (sumAt(mid) < targetSum) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── Die eingefrorene Auszahlungsleiter ─────────────────────────────────────────────────────────
/**
 * Alles, was eine unterschriebene V2-Karte fuer die Abrechnung braucht — VOR der Saison eingefroren
 * und im Vertrag gespeichert. Danach ist die Abrechnung reine Arithmetik ohne Modellzugriff, und
 * Anzeige und Settlement koennen gar nicht mehr auseinanderlaufen.
 *
 * `rankLadder[i]` ist der Rangteil bei Endrang i+1 OHNE Klausel, Sonderziel, Untergrenze und K.
 * Die vollstaendige Auszahlung liefert `sponsorV2SettleFromTerms`.
 */
export type SponsorV2LockedTerms = {
  rankLadder: number[];
  clauseBonus: number;
  clauseMalus: number;
  goalPayout: number;
  rarity: SponsorV2Rarity;
  salaryFactor: number;
  k: number;
  expectedRank: number;
  curveName: string;
  profileName: string;
  clauseName: string;
};

export function sponsorV2LockTerms(
  card: SponsorV2Card, expectedRank: number, cal: number, salaryFactor: number, k: number,
  params: SponsorV2Params = sponsorV2ParamsOf(card),
): SponsorV2LockedTerms {
  const arms = sponsorV2ClauseArms(card.clause, params.pClause);
  return {
    rankLadder: Array.from({ length: 32 }, (_, i) => sponsorV2RankPart(card, expectedRank, i + 1, cal)),
    clauseBonus: arms.bonus,
    clauseMalus: arms.malus,
    goalPayout: sponsorV2GoalPayoutOf(card, expectedRank, params.pGoal),
    rarity: card.rarity,
    salaryFactor, k, expectedRank,
    curveName: card.curve.name, profileName: card.profile.name, clauseName: card.clause.name,
  };
}

/**
 * Abrechnung aus den eingefrorenen Konditionen. EINE Stelle — Anzeige, Prognose, KI-Bewertung und
 * Settlement rufen alle diese Funktion, deshalb kann die Invariante "Anzeige == Settlement" nicht
 * durch eine zweite Rechenvariante brechen.
 */
export function sponsorV2SettleFromTerms(
  terms: SponsorV2LockedTerms, finalRank: number, clauseMet: boolean, goalMet: boolean,
): number {
  const idx = Math.max(1, Math.min(32, Math.round(finalRank))) - 1;
  const fl = sponsorV2FloorAt(terms.rarity, 1.0);
  const raw = Math.max(fl, terms.rankLadder[idx]!
    + (clauseMet ? terms.clauseBonus : -terms.clauseMalus)
    + (goalMet ? terms.goalPayout : 0));
  return sponsorV2ScaleWithK(raw, terms.rarity, terms.salaryFactor, terms.k);
}

/** Die vollstaendige Auszahlungsleiter fuer die Anzeige: je Endrang der Wert im gegebenen Zustand. */
export function sponsorV2LadderFromTerms(
  terms: SponsorV2LockedTerms, clauseMet: boolean, goalMet: boolean,
): number[] {
  return Array.from({ length: 32 }, (_, i) => sponsorV2SettleFromTerms(terms, i + 1, clauseMet, goalMet));
}

// ── FOSD — der Fallen-Test, als Bibliotheksfunktion ────────────────────────────────────────────
export type SponsorV2Lottery = { outcomes: Array<{ v: number; p: number }> };
const cdfAt = (l: SponsorV2Lottery, x: number) => l.outcomes.reduce((a, o) => a + (o.v <= x + 1e-9 ? o.p : 0), 0);
const supportOf = (a: SponsorV2Lottery, b: SponsorV2Lottery) => [...a.outcomes.map((o) => o.v), ...b.outcomes.map((o) => o.v)];
/**
 * Erststufen-stochastische Dominanz. Der frueher benutzte ELEMENTWEISE Vergleich ist ungueltig,
 * seit jede Klausel ihr eigenes p traegt: er vergleicht Zellen ueber verschiedene
 * Wahrscheinlichkeitsmasse und erzeugt systematisch False Positives.
 */
export function sponsorV2FosdAtLeast(a: SponsorV2Lottery, b: SponsorV2Lottery): boolean {
  for (const x of supportOf(a, b)) if (cdfAt(a, x) > cdfAt(b, x) + 1e-9) return false;
  return true;
}
export function sponsorV2FosdStrictly(a: SponsorV2Lottery, b: SponsorV2Lottery): boolean {
  for (const x of supportOf(a, b)) if (cdfAt(a, x) < cdfAt(b, x) - 1e-9) return true;
  return false;
}
/** Lotterien einer Karte ueber ALLE 32 Endraenge. Kein Korridor — die Engine kennt keinen. */
export function sponsorV2Lotteries(
  card: SponsorV2Card, expectedRank: number, cal: number, params: SponsorV2Params,
): SponsorV2Lottery[] {
  return Array.from({ length: 32 }, (_, i) => ({ outcomes: sponsorV2Corners(card, expectedRank, i + 1, cal, params) }));
}
/** Kollabiert = ueber den gesamten Bereich derselbe Betrag; kann weder dominieren noch dominiert werden. */
export function sponsorV2IsCollapsed(lot: SponsorV2Lottery[]): boolean {
  const vals = lot.flatMap((l) => l.outcomes.map((o) => o.v));
  return Math.max(...vals) - Math.min(...vals) < 1e-6;
}
/** Ist `a` eine Falle, also von irgendeiner anderen Karte der Liste rang-konditional dominiert? */
export function sponsorV2IsTrap(a: SponsorV2Lottery[], others: SponsorV2Lottery[][]): boolean {
  return others.some((b) => b !== a
    && a.every((la, i) => sponsorV2FosdAtLeast(b[i]!, la))
    && a.some((la, i) => sponsorV2FosdStrictly(b[i]!, la)));
}

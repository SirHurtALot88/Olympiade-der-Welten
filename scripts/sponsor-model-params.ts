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
export const LIGA = [74, 68, 64, 59, 55, 51, 47, 43, 39];

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
  // Gesenkt, damit die Untergrenze den Kartenwert nicht mehr abschneidet: bei gewoehnlich lag das
  // Ziel-EV der unteren Stufen (35,6-37,5) UNTER der garantierten 38, die Karte kollabierte dort in
  // den Boden und Kurve, Klausel und Sonderziel wirkten nicht mehr. Der Schutz kommt jetzt aus der
  // AUSWAHL — ein Team sieht fuenf Angebote und muss kein schwaches nehmen — statt aus einer
  // Garantie, die schwache Karten daran hinderte, schwach zu sein.
  "gewöhnlich": 35, "magisch": 37, "selten": 39, "legendär": 42,
};
export const FLOOR_ABSOLUT = 35;
/**
 * Stellschraube fuer die Untergrenze, damit ihre Wirkung MESSBAR ist statt behauptet.
 * Hintergrund: der Engine-Schattentest zeigt, dass die Untergrenze am Tabellenende Karten
 * abschneidet und dadurch Fallen erzeugt (offener Punkt 3 des Umsetzungsplans). Mit dieser
 * Schraube laesst sich die Empfindlichkeit direkt durchrechnen, statt sie zu diskutieren.
 */
export const FLOOR_SCALE = Number(process.env.OLY_SPONSOR_FLOORSCALE ?? 1);
/** Daempfung, mit der die Untergrenze im schwachen Ligajahr mitfaellt. */
export const FLOOR_DAMP = 0.8;
/**
 * Untergrenze faellt bei sf < 1 gedaempft mit, steigt bei sf > 1 NICHT.
 * Sie ist Schutz, keine Belohnung: im guten Jahr mitzuwachsen hiesse, den Keller genau dann
 * anzuheben, wenn die Spitze bevorzugt werden soll (gemessen: U-Form im Ueberschuss).
 */
export const floorAt = (rarity: string, sf: number): number =>
  FLOOR_SCALE * Math.max(FLOOR_ABSOLUT, (FLOOR_RARITY[rarity] ?? FLOOR_RARITY["magisch"]!) * (sf >= 1 ? 1 : 1 - FLOOR_DAMP * (1 - sf)));

// ── Ziel-EV-Leiter ─────────────────────────────────────────────────────────────────────────────
export const TARGET_EV_BASE = [76.0, 73.6, 71.6, 67.9, 63.8, 59.9, 56.7, 54.1, 53.0];
export const TARGET_EV_MEAN = TARGET_EV_BASE.reduce((a, b) => a + b, 0) / TARGET_EV_BASE.length;
/** Steilheit: spreizt die Leiter um ihren Mittelwert. 1.7 ist der abgenommene Wert. */
// GESENKT von 1.7 auf 1.2 (identisch zu lib/, SPONSOR_V2_TARGET_GAMMA): die Ziel-EV-Leiter ist nach
// Erwartungsstufe indiziert und die Rangleiter differenziert bereits ein zweites Mal — 1.7 zaehlte
// den Unterschied doppelt und drueckte den Keller (gewoehnlich Stufe 8) auf 35,6 C, nur 0,6 C ueber
// die vereinbarte Untergrenze 35. Mittelwert-erhaltend, Ligasumme unveraendert.
export const TARGET_GAMMA = Number(process.env.OLY_SPONSOR_GAMMA ?? 1.2);
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
/**
 * 1.0 = VOLLE EV-Renormierung (Auflage d). 0.5 war die halbe Massnahme: sie verhinderte nur, dass
 * Keller-Teams bei spitzenlastigem Profil voellig leer ausgehen, liess aber die halbe EV-Schieflage
 * ueber die Profile stehen — und damit 932 FOSD-Dominanzfaelle. Ueber OLY_SPONSOR_EVEN=0.5 laesst
 * sich der alte Zustand zum Vergleich wiederherstellen.
 */
export const POOL_EVEN_SHARE = Number(process.env.OLY_SPONSOR_EVEN ?? 1.0);
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

/**
 * ALTE FASSUNG, nur noch fuer den Monotonie-Nachweis aufbewahrt — NICHT benutzen.
 *
 * MONOTONIE-BUG (gemessen): rel(d) = 5 + 2.5d - 0.9d^2 hat ihren Scheitel bei d = 2.5/1.8 = 1.389
 * und FAELLT danach. Ab d = 4 liegt sie unter dem Wert bei d = 0, ab d = 5 sogar unter der
 * Ligastufe. Folge fuer ein Team mit Erwartungsrang 30 (Stufe 8), Rangteil ohne Offset:
 *
 *   Endrang     1     3     6    10    14    18    22    26    30
 *   roh      39.4  45.4  50.6  54.0  55.6  55.4  53.4  49.6  44.0
 *
 * Der TITELGEWINN zahlt 39.4, ein Platz 13-16 aber 55.6 — ein Wunderjahr wird um 16.2 C bestraft.
 * Die Pruefskripte versteckten das hinter dem +-11-Korridor (aus Stufe 8 sind Stufe 0-3 gar nicht
 * erreichbar); die echte Engine hat keinen Korridor.
 */
export const relConcaveRaw = (d: number): number =>
  (d > 0 ? CURVE_BASE + CURVE_UP * d - CURVE_CONCAVE * d * d : CURVE_BASE + CURVE_DOWN * d);

/**
 * FIX: der konkave Term wird gesaettigt statt quadratisch — a*d/(1+beta*d) statt a*d - c*d^2.
 *
 * beta = CURVE_CONCAVE / CURVE_UP = 0.36 ist so gewaehlt, dass die neue Kurve die alte bis zur
 * ZWEITEN Ordnung bei d = 0 reproduziert (f'(0) = 2.5, f''(0) = -1.8 in beiden Faellen). Die
 * Design-Absicht "grosse Spruenge zahlen unterproportional" bleibt damit exakt erhalten, die
 * Ableitung 2.5/(1+0.36d)^2 ist aber ueber den GESAMTEN Bereich positiv.
 *
 * VERWORFENE ALTERNATIVE — den konkaven Term am Scheitel klemmen (d^2 -> min(d, 1.389)^2):
 * ebenfalls monoton, aber danach laeuft die Kurve wieder mit voller Steigung 2.5 weiter. Gemessen
 * bei d = 8: geklemmt 23.26 gegen gesaettigt 10.15, fuer das Team mit Erwartungsrang 30 also
 * Titelgewinn 95.3 statt 82.2. Das macht genau die Deckensenkung der schwachen Stufen rueckgaengig,
 * fuer die der konkave Term ueberhaupt eingefuehrt wurde. Die Saettigung haelt beides zusammen.
 */
export const CURVE_BETA = CURVE_CONCAVE / CURVE_UP;
export const rel = (d: number): number =>
  (d > 0 ? CURVE_BASE + (CURVE_UP * d) / (1 + CURVE_BETA * d) : CURVE_BASE + CURVE_DOWN * d);

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

/**
 * KLAUSELKATALOG — EINE Quelle der Wahrheit.
 *
 * Vorher stand er zweimal: als `CLAUSES` in scripts/sponsor-model-proposal.ts und als Spiegel
 * `SHADOW_CLAUSES` in scripts/sponsor-shadow-core.ts. Genau diese Doppelhaltung hat schon einmal
 * drei auseinandergelaufene Parametersaetze erzeugt. Jetzt steht er hier; beide Skripte importieren.
 *
 * ── AUFRAEUMEN NACH DEM ENGINE-SCHATTENTEST (docs/SPONSOR_SCHATTENTEST_ENGINE.md) ──────────────
 * Der Katalog hatte 20 Eintraege. Fuenf sind RAUS, zwei sind NEU GEFASST — jede Entscheidung
 * gegen eine Messung aus 160 Team-Saisons:
 *
 *   ENTFERNT, weil das Datenmodell den noetigen Vorher-Zustand nicht fuehrt (prinzipiell):
 *     - Charakterarbeit  `traitsNegative` wird im laufenden Spiel nie mutiert und ein Kaderstand
 *                        zum Saisonanfang existiert im Save nicht → kein Delta rekonstruierbar.
 *     - Kapitaenstreue   `setTeamCaptain` ERSETZT den (Team, Saison)-Record; ein Wechsel
 *                        hinterlaesst keine Spur. Zusaetzlich: 0 Eintraege in `teamCaptains`.
 *   ENTFERNT, weil die Metrik im Lauf gar nicht entsteht (praktisch):
 *     - Hartes Training  `seasonTrainingAccumulator` bei 0 von 2984 Spielern gesetzt.
 *     - XP-Disziplin     `playerProgressionEvents`: 1708 Eintraege, Summe xpEarned = 0 → kein Nenner.
 *     - Beliebtheit      `beliebtheitByTeamId` und -History leer. Nicht prinzipiell unmoeglich —
 *                        wieder aufnehmen, sobald der Beliebtheits-Ledger fortgeschrieben wird.
 *
 *   NEU GEFASST:
 *     - Ausbau    zaehlte nur fan_shop/arena_upgrade und mass P = 0.11 gegen Design 0.45. Von 148
 *                 echten Gebaeude-Upgrades im Lauf lagen nur 17 auf diesen beiden. Die Klausel war
 *                 nicht zu schwer, sie zeigte auf die falschen Gebaeude. Jetzt: ALLE Gebaeude,
 *                 Schwelle frei. Gemessen bei X >= 1: P = 0.59 → Design-P von 0.45 auf 0.60.
 *     - Wortlaut  feste Schwelle "alle Versprechen eingehalten" wurde in 160 Team-Saisons NIE
 *                 erfuellt (min 3, Median 8, max 11 gebrochene Versprechen) — ein garantierter
 *                 Malus von s*P = 9.9 C, den kein Spieler abwenden kann. Jetzt "hoechstens X
 *                 gebrochene Versprechen"; bei X <= 7 ist P = 0.47, das Design-P 0.45 bleibt.
 *
 * `evaluable` markiert, ob die Klausel am Saison-END-ZUSTAND trivial messbar ist. Nur diese gehen
 * in den Produktions-Pool des Sponsorsystems V2 (Phase P3) — lieber acht funktionierende Klauseln als
 * zwanzig halbe. Die uebrigen bleiben im Modellkatalog, weil sie fuer Balancing und Fallen-Test
 * zaehlen, aber ohne Evaluator nicht angeboten werden duerfen.
 */
export type ClauseSpec = {
  name: string; label: string; p: number; s: number; lever: string;
  /** true = am Saison-End-Zustand trivial auswertbar (Produktions-Pool von V2). */
  evaluable: boolean;
  /** "up" = Metrik >= Schwelle erfuellt, "down" = Metrik <= Schwelle erfuellt. */
  direction: "up" | "down";
};
export const CLAUSES: ClauseSpec[] = [
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
export const clauseByName = (name: string): ClauseSpec =>
  CLAUSES.find((c) => c.name === name) ?? CLAUSES[0]!;
/** Der Produktions-Pool des Sponsorsystems V2: nur am Saison-End-Zustand trivial messbare Klauseln. */
export const EVALUABLE_CLAUSES = CLAUSES.filter((c) => c.evaluable);

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
/**
 * Streuung der Endraenge um den Erwartungsrang — GEMESSEN, nicht mehr gesetzt.
 *
 * Vorher 5.5 als Designannahme. Der Schattentest gegen die echte Engine
 * (docs/SPONSOR_SCHATTENTEST_ENGINE.md, 128 echte Team-Saisons aus 4 abgeschlossenen Saisons)
 * misst 6.62 gepoolt (je Saison 5.54 / 7.10 / 6.52 / 7.47). Gesetzt wird 6.6.
 */
export const SIGMA = Number(process.env.OLY_SPONSOR_SIGMA ?? 6.6);
/** Halbe Breite des als erreichbar betrachteten Rangkorridors. */
export const CORRIDOR = 11;

/**
 * RUECKSCHRITT ZUR MITTE — gemessen und bis zum Schattentest im Modell gar nicht abgebildet.
 *
 * `dist()` setzte eine um den Erwartungsrang ZENTRIERTE Normalverteilung an. Die Engine erzeugt
 * das nicht: starke Teams (Erwartung 1-11) landen im Schnitt +3.34 Raenge SCHLECHTER, schwache
 * (22-32) 2.11 Raenge BESSER (mittel -1.35). Fuer ein Spitzenteam war die Kalibrierung damit
 * systematisch zu optimistisch, fuer ein Kellerteam zu pessimistisch — mit direkter Folge fuer
 * die EV-Paritaet der jeweiligen Karten.
 *
 * Modelliert als EINE Zahl statt dreier Klassen-Bias, damit der Effekt stetig ueber die Raenge
 * wirkt und keine Sprungstellen an den Klassengrenzen entstehen:
 *     Mittelpunkt(e) = RANK_MEAN + (1 - BIAS_SHRINK) * (e - RANK_MEAN)
 * Der Bias ist dann -BIAS_SHRINK * (e - RANK_MEAN): oben positiv, unten negativ.
 *
 * BIAS_SHRINK = 0.255 ist der Kleinstquadrate-Schaetzer aus denselben 128 Team-Saisons
 * (scripts/sponsor-shadow-measure.ts, Abschnitt "RUECKSCHRITT ZUR MITTE"). Er reproduziert
 * stark +2.68 gegen gemessen +3.34 und schwach -2.68 gegen gemessen -2.11 und erklaert 12.7 %
 * der Rangvarianz; das Restsigma sinkt von 6.62 auf 6.18.
 *
 * WICHTIG fuer die Liga-Summe: die Schrumpfung ist um RANK_MEAN symmetrisch, der Mittelwert der
 * Verteilungsmittelpunkte ueber alle 32 Teams bleibt also 16.5. Sie verschiebt Geld zwischen
 * Spitze und Keller, nicht in die Liga hinein oder heraus.
 */
export const RANK_MEAN = 16.5;
export const BIAS_SHRINK = Number(process.env.OLY_SPONSOR_SHRINK ?? 0.255);
/** Mittelpunkt der Ergebnisverteilung eines Teams mit Erwartungsrang `expected`. */
export const centerRank = (expected: number): number =>
  RANK_MEAN + (1 - BIAS_SHRINK) * (expected - RANK_MEAN);

export const dist = (expected: number, sigma: number = SIGMA): number[] => {
  const c = centerRank(expected);
  const w: number[] = [];
  for (let r = 1; r <= 32; r += 1) w.push(Math.exp(-((r - c) ** 2) / (2 * sigma * sigma)));
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
export type Profile = {
  name: string;
  specialShare: number;
  tierWeights: number[];
  /**
   * Formgewichte je STUFENSCHRITT statt je Stufe: 8 Schritte zwischen den 9 Tabellenstufen.
   * `stepWeights[i]` ist der Anteil des Formbudgets, der auf den Schritt von Stufe i+1 auf
   * Stufe i entfaellt — also auf eine VERBESSERUNG um eine Stufe. Alle Eintraege >= 0, Summe 1.
   * Siehe formShape: genau daraus folgt die Monotonie der Auszahlungsleiter.
   */
  stepWeights: number[];
  note: string;
};
/**
 * `specialShare` GESENKT (frueher .25/.15/.15/.20/.70) und "zielschwer" zu "zielbetont" umbenannt.
 * Grund: bei .70 verlangte die Kalibrierung von der Rangleiter einen Erwartungswert unter der
 * Untergrenze, die Bisektion lief an ihren Rand und die Karte klemmte auf allen 32 Raengen an der
 * Untergrenze. Zusaetzlich deckelt lib/ das Sonderziel jetzt hart bei 15 % der Kartenauszahlung.
 * Diese Datei ist die REFERENZ, gegen die tests/sponsor-v2-model.test.ts lib/ Zahl fuer Zahl
 * vergleicht — sie muss deshalb mitgezogen werden.
 */
export const PROFILES: Profile[] = [
  { name: "ausgewogen",    specialShare: 0.06, tierWeights: [.11, .11, .11, .11, .11, .11, .11, .11, .12],
    stepWeights: [.125, .125, .125, .125, .125, .125, .125, .125],
    note: "Formzuwachs gleichmaessig ueber alle Stufenschritte" },
  { name: "spitzenlastig", specialShare: 0.04, tierWeights: [.28, .24, .18, .12, .08, .05, .03, .02, .00],
    stepWeights: [.30, .24, .18, .12, .08, .05, .02, .01],
    note: "der Formzuwachs sitzt ganz oben — bezahlt wird der Sprung in die Spitzenraenge" },
  { name: "sockellastig",  specialShare: 0.04, tierWeights: [.00, .02, .03, .05, .08, .12, .18, .24, .28],
    stepWeights: [.01, .02, .05, .08, .12, .18, .24, .30],
    note: "der Formzuwachs sitzt ganz unten — schon der Sprung aus dem Keller zahlt" },
  { name: "mittelfeld",    specialShare: 0.05, tierWeights: [.02, .05, .10, .18, .25, .18, .10, .07, .05],
    stepWeights: [.03, .07, .15, .25, .25, .15, .07, .03],
    note: "der Formzuwachs sitzt in der Tabellenmitte — Spitze und Keller sind flach" },
  { name: "zielbetont",    specialShare: 0.10, tierWeights: [.11, .11, .11, .11, .11, .11, .11, .11, .12],
    stepWeights: [.125, .125, .125, .125, .125, .125, .125, .125],
    note: "groesster Sonderziel-Anteil, den die 15-%-Obergrenze zulaesst — maximaler Eigeneinfluss" },
];
export const profileByName = (name: string): Profile => PROFILES.find((p) => p.name === name) ?? PROFILES[0]!;

/**
 * FORMKOMPONENTE (Auflage d des Balancing-Audits).
 *
 * Vorher indizierten die `tierWeights` die ERWARTUNGSSTUFE des Teams. Damit war das Profil fuer ein
 * gegebenes Team eine reine EV-VERSCHIEBUNG — und ein Profil mit mehr EV dominiert jedes andere per
 * FOSD, trivialerweise. Gemessen: 932 Dominanzfaelle von 1920 Zellen, EV-Spread ueber die Profile
 * bis 41.3 % bei legendaer.
 *
 * Jetzt indizieren die Gewichte den ENDRANG und werden um ihren erwartungsgewichteten Mittelwert
 * zentriert. Damit ist der Beitrag der Formkomponente fuer JEDES Team exakt 0 im Erwartungswert:
 * ein spitzenlastiges Profil zahlt mehr, WENN das Team oben landet, und weniger, wenn nicht. Zwei
 * EV-gleiche Formen, die sich ueber den Rang kreuzen, koennen sich per Konstruktion nicht
 * dominieren — genau das war das Ziel.
 */
/**
 * MONOTONIE-FIX (Riss 3 des Engine-Schattentests).
 *
 * GEMESSEN VORHER: 6 von 128 realisierten Karten zahlten fuer einen BESSEREN Endrang WENIGER,
 * groesster Rueckschritt 2.8 C zwischen Rang 12 und 13. Alle sechs trugen das Profil `mittelfeld`.
 *
 * URSACHE: die alte Fassung las `tierWeights[finalTier]` PUNKTWEISE. Die tierWeights sind ueber die
 * Tabellenstufen nicht monoton — bei `mittelfeld` liegt Stufe 4 (Raenge 13-16, Gewicht .25) ueber
 * Stufe 3 (Raenge 9-12, Gewicht .18). Bei Amplitude 60 sind das 4.2 C Aufschlag fuers SCHLECHTERE
 * Band, waehrend die LIGA-Leiter dort nur 4 C Unterschied hat. Die EV-Zentrierung haelt den
 * Erwartungswert neutral — sie sagt nichts ueber Monotonie im Rang.
 *
 * FIX: die Formkomponente ist jetzt eine KUMULIERTE Summe nicht-negativer Stufenschritte statt
 * eines punktweisen Gewichts:
 *     formLadder(t) = Summe der stepWeights[i] fuer i >= t          (formLadder(8) = 0, formLadder(0) = 1)
 *     formShape     = FORM_AMPLITUDE * (formLadder(finalTier) - E[formLadder])
 * Weil alle stepWeights >= 0 sind, ist formLadder ueber die Stufen nicht-steigend, also als
 * Funktion des RANGES nicht-fallend. Der Formbeitrag kann eine Rangverbesserung damit per
 * Konstruktion nie verteuern. Die EV-Zentrierung (und damit die Profil-Dominanzfreiheit) bleibt
 * unveraendert, weil nur ein rang-unabhaengiger Mittelwert abgezogen wird.
 *
 * VERWORFENE ALTERNATIVE — Amplitude senken, bis die Nicht-Monotonie unter die LIGA-Stufe faellt:
 * die garantierte Stufenrendite ist LIGA-Schritt (min 4 C) plus Kurvenschritt (min -3 C bei
 * `Halten`) = 1 C; der groesste negative Gewichtsschritt bei `mittelfeld` ist -0.07. Die Amplitude
 * haette auf 14 gemusst — das haette die Profilachse praktisch abgeschafft, statt sie zu reparieren.
 *
 * AMPLITUDE 24 statt 60: die alte Zahl multiplizierte GEWICHTE (Spanne rund 0.28), die neue eine
 * kumulierte Leiter (Spanne exakt 1.0). 60 x 0.28 = 16.8 C Formspanne vorher; 24 x 1.0 = 24 C
 * jetzt — dieselbe Groessenordnung, gemessen an der LIGA-Leiter (74 - 39 = 35 C) etwa zwei Drittel.
 */
export const FORM_AMPLITUDE = Number(process.env.OLY_SPONSOR_FORM ?? 24);
/** Kumulierte, ueber die Stufen nicht-steigende Formleiter eines Profils. Index 0..8. */
export function formLadder(profile: Profile, tier: number): number {
  let acc = 0;
  for (let i = tier; i < profile.stepWeights.length; i += 1) acc += profile.stepWeights[i]!;
  return acc;
}
const formMeanCache = new Map<string, number>();
export function formShape(profile: Profile, expected: number, finalTier: number): number {
  if (FORM_AMPLITUDE === 0) return 0;
  const key = `${profile.name}:${Math.round(expected)}`;
  let mean = formMeanCache.get(key);
  if (mean === undefined) {
    mean = dist(expected).reduce((a, w, i) => a + w * formLadder(profile, tierOf(i + 1)), 0);
    formMeanCache.set(key, mean);
  }
  return FORM_AMPLITUDE * (formLadder(profile, finalTier) - mean);
}

/**
 * Aufteilung des Pools auf Leiter (1+2+4) und Sonderziel fuer eine gegebene Stufe.
 * EINE Stelle — vorher rechneten bands.ts, 5season-model.ts und proposal.ts das jeweils selbst,
 * proposal.ts sogar ohne den Gleichanteil.
 */
export function cardTargets(rarity: string, profile: Profile, tier: number) {
  const pool = poolFor(rarity);
  // EV-RENORMIERUNG: bei POOL_EVEN_SHARE = 1 bekommt jede Stufe denselben Poolanteil, unabhaengig
  // vom Profil. Der Gesamt-EV der Karte haengt damit nur noch an Rarity und Erwartungsstufe —
  // die Profile unterscheiden sich ausschliesslich in der FORM.
  const evenPart = (pool * POOL_EVEN_SHARE) / TIERS.length;
  const profilePart = pool * (1 - POOL_EVEN_SHARE) * profile.tierWeights[tier]!;
  const total = TARGET_EV_SHAPE[tier]! + evenPart + profilePart;
  return {
    /** Kalibrierziel fuer Liga + Kurve + Klausel. */
    ladder: total * (1 - profile.specialShare),
    /** Erwartungswert des Sonderziels — der Anteil, den das Profil ins Ziel schiebt. */
    special: total * profile.specialShare,
    /** Gesamt-EV der Karte. Bei voller Renormierung fuer alle Profile identisch. */
    total,
  };
}

// ── Wirtschaftliche Referenzen aus einem echten S1-Save ────────────────────────────────────────
export const SALARY_SUM_S1 = 2078;
export const SALARY_TOP = 87.8;
export const SALARY_MIN = 43.7;
export const salaryAtRank = (r: number): number => SALARY_TOP - (SALARY_TOP - SALARY_MIN) * ((r - 1) / 31);
/** Fuenf Saisons mit wechselndem salaryFactor — mal schwach, mal stark. */
export const SEASON_SF = [0.85, 1.15, 0.95, 1.25, 0.80];

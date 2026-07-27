/**
 * Sponsor-Modell — VORSCHLAG (noch kein Produktionscode).
 *
 * Entworfen und gemessen als Antwort auf drei belegte Defekte des Ist-Systems (siehe
 * scripts/sponsor-payout-model.ts für die Ist-Messung):
 *   1. Kurven sind auf gleiche Fläche über Rang 1..32 normiert — eine Invariante, die kein Team erlebt.
 *      Folge: 6-7 von 11 Kurven sind für ein gegebenes Team FALLEN (bei jedem erreichbaren Rang schlechter).
 *   2. Überperformance und Tabellenziel messen gegen (fast) dieselbe Baseline und tragen 51-100 % des
 *      Zuwachses eines Aufstiegs — die 4er-Block-Kurve, also die Sponsor-Identität, wird dadurch entwertet.
 *   3. Sonderziele sind nicht nach Schwierigkeit bepreist (nur nach Rarity).
 *
 * ARCHITEKTUR — vier getrennte Leitern statt eines Mischmaschs:
 *   Leiter 1  LIGA        absolut, 4er-Blöcke, sponsorUNABHÄNGIG. Was ein Platz wirtschaftlich wert ist.
 *                         Die "Challenge" (Blöcke) bleibt damit erhalten — kein per-Rang-Geld obendrauf.
 *   Leiter 2  TYP         RELATIV (Δ = erwarteteStufe − erreichteStufe), Mali erlaubt. Die Sponsor-Identität.
 *                         Weil relativ, hat jeder Typ auf JEDEM Ausgangsrang Stärken UND Schwächen.
 *   Leiter 3  SONDERZIEL  modular, nach Schwierigkeit bepreist (hier als Spanne 6-12 modelliert).
 *   Leiter 4  KLAUSEL     rang-UNABHÄNGIGE Zustandsbedingung mit Bonus/Malus (Fatigue, Fluktuation,
 *                         Finanzen, Kaderentwicklung). Strukturell nötig: am Tabellenende kann ein Team
 *                         nicht abrutschen, dort degeneriert die Rang-Achse und nur die Klausel liefert Risiko.
 *
 * ÜBERLEBENS-UNTERGRENZE: keine Auszahlung unter FLOOR — deckt das S1-Mindestgehalt, damit kein Team
 * durch die Sponsorwahl zahlungsunfähig wird. Die Offsets werden MIT Untergrenze kalibriert (Fixpunkt),
 * weil die Untergrenze Risiko-Typen sonst gratis nach unten schützt und ihre EV anhebt.
 *
 * Aufruf: npx tsx scripts/sponsor-model-proposal.ts
 */

/**
 * ALLE Parameter kommen aus scripts/sponsor-model-params.ts. Vorher trug dieses Skript einen
 * EIGENEN, veralteten Satz (FLOOR 44 flach, LIGA-Spitze 77, Aufwaertsast 4 linear, Abwaertsast 4.5,
 * Klausel-Spannweite 18, sigma 4, Korridor +-8, kein Pool-Gleichanteil), waehrend bands.ts und
 * 5season-model.ts schon mit dem neuen Satz rechneten. Die Pruefmaschinerie unten hat den neuen
 * Satz dadurch NIE gesehen.
 */
import {
  TIERS, tierOf, LIGA, floorAt, FLOOR_ABSOLUT, RARITY_MULT, POOL_EVEN_SHARE, BASE_SPECIAL,
  TARGET_GAMMA, TARGET_EV_SHAPE, poolFor, rel as relRepr, clauseBonus, clauseMalus,
  SIGMA, CORRIDOR, dist as distOf, corridorOf, PROFILES, profileByName, cardTargets,
  P_GOAL, goalPayout, relConcaveRaw, CURVE_BETA, RARITY_ORDER, formShape, type Profile,
  SALARY_SUM_S1, SALARY_TOP, SALARY_MIN, salaryAtRank, CLAUSES, BIAS_SHRINK, centerRank,
} from "./sponsor-model-params";

export { PROFILES, RARITY_MULT };
/**
 * Frueher eine GLOBALE Annahme (0.55) fuer alle Klauseln — nachweislich der gefaehrlichste Fehler
 * des Entwurfs: mit klausel-individuellem P (Ziehungen aus [0.30, 0.90]) riss die EV-Paritaet auf
 * 51.6 % auf, also WEITER als der Ist-Defekt von 16-30 %, den der Rework beheben soll. Real ist
 * "kein neuer Kredit" nahezu geschenkt und "X Klassenaufstiege" teuer erkauft.
 * Deshalb traegt jede Klausel ihr eigenes P und die Kalibrierung rechnet damit.
 * Die Werte sind Design-Schaetzungen und muessen im Long-Run gemessen werden.
 */
const P_MET = 0.55; // nur noch Referenzwert fuer den Stresstest
/**
 * RARITY skaliert die GANZE Karte, nicht nur das Sonderziel.
 *
 * Frueher lief der Sonderziel-EV rarity-abhaengig NEBEN der Kalibrierung (4/12/16/30 C) — dadurch
 * unterschieden sich zwei Angebote einer gemischten Liste um bis zu 26 C EV, eine Groessenordnung
 * ueber dem Spread von 3.8 %. Die Rarity ueberstimmte die Risikowahl vollstaendig.
 *
 * Richtig ist: die Rarity ist eine QUALITAETSSTUFE der gesamten Karte. magisch = Standard (1.0),
 * gewoehnlich schwaecher, selten besser, legendaer selten aber stark. Parität gilt damit INNERHALB
 * einer Stufe — genau wie ursprünglich vorgegeben ("auf gleicher Stufe z. B. magisch hat jede
 * Sponsorart ihre Staerken und Schwaechen").
 */
/**
 * OFFENER KONFLIKT (gemessen, nicht geloest): die Untergrenze 44 vertraegt sich nicht mit Rarities
 * UNTER dem Standard.
 *
 * Gemessen mit Steilheit 1.7: die Rarity-Leiter selbst stimmt (Meister 78.7 / 91.3 / 103.5 / 119.7
 * fuer gewoehnlich / magisch / selten / legendaer, monoton) und die Liga-Bilanz ist stabil
 * (k = 1.492 unabhaengig von der gewaehlten Rarity). ABER:
 *
 *  - Bei gewoehnlich, magisch und selten saettigt der Kalibrier-Offset an der Bisektions-Untergrenze
 *    (-200): das Ziel-EV der unteren Stufen liegt UNTER der garantierten 44, ist also unerreichbar.
 *  - Folge: fuer mittlere und schwache Teams kollabiert die Karte vollstaendig in den Floor
 *    (Letzter 44-44, sigma 0.0) — die Klausel wirkt dort ueberhaupt nicht mehr.
 *
 * Kern des Problems: wenn die Untergrenze jedem Team 44 garantiert, KANN ein schwacher Sponsor fuer
 * ein schwaches Team nicht schwach sein. Die Rarity-Spanne nach unten und die Ueberlebensgarantie
 * schliessen sich gegenseitig aus, solange beide absolut gesetzt sind.
 *
 * Denkbare Auflösungen (Entscheidung offen):
 *  a) Untergrenze relativ zur Rarity (gewoehnlich garantiert weniger) — dann ist der Schutz aber
 *     nicht mehr verlaesslich, und genau das war seine Aufgabe.
 *  b) Rarity-Spanne nur nach OBEN (magisch = Boden, selten/legendaer besser, kein gewoehnlich)
 *     — kollidiert mit der Vorgabe "gewoehnlich ist schwaecher".
 *  c) Untergrenze senken und die Ueberlebenssicherung anders loesen (z. B. ueber einen
 *     Liga-Solidaritaetsbeitrag ausserhalb der Sponsorenkarte).
 */

/**
 * VERTEILUNG — zweite Variationsachse: WIE sich die Karte aufteilt, bei gleicher Gesamthoehe.
 * Der Anteil, der im Sonderziel steckt, statt in Rangleiter + Klausel. Ein zielschweres Angebot
 * haengt stark am eigenen Zutun, ein leiterschweres an der Tabelle. Beide gleich viel wert.
 */
/**
 * VERTEILUNGSPROFIL — die Rarity liefert ein BUDGET, das Profil entscheidet, WO es landet.
 *
 * Falsch war eine vorige Fassung, die die Rarity als uniformen Multiplikator auf jede Zelle legte:
 * damit hob eine hoehere Stufe stur alles proportional an (Meister 78.7/91.3/103.5/119.7) — statisch
 * und monoton, also genau nicht gewollt. Richtig ist: die Rarity setzt nur die Groesse des Pools;
 * seine Aufteilung ist eine freie Achse und wirkt je nach Tabellenstufe unterschiedlich.
 *
 * `specialShare` = Anteil des Pools, der ins Sonderziel geht.
 * `tierWeights`  = Verteilung des Rests ueber die 9 Stufen (Meister … Platz 32), Summe 1.
 *
 * Bei gewoehnlich ist der Pool NEGATIV — dasselbe Profil entscheidet dann, wo gekuerzt wird.
 */
type SponsorType = {
  name: string;
  /** Leiter 2: Auszahlung nach Δ Stufen (positiv = besser als erwartet). Negativ = Malus. */
  rel: (d: number) => number;
  /** Leiter 4: rang-unabhängige Zustandsbedingung. */
  clause: { label: string; bonus: number; malus: number; p: number; s: number };
  note: string;
};

/**
 * MODULAR statt fest: ein Sponsor ist eine KOMBINATION aus einer Kurvenform und einer Klausel.
 * 6 Kurven x 20 Klauseln = 120 moegliche Sponsoren aus zwei kleinen, unabhaengig pflegbaren Listen.
 * Die Kalibrierung laeuft ueber jede Kombination einzeln, deshalb ist jede davon automatisch
 * EV-gleich und fallenfrei — neue Klauseln lassen sich hinzufuegen, ohne das Balancing anzufassen.
 */
export const CURVES: Array<{ name: string; rel: (d: number) => number; note: string }> = [
  { name: "Sockel",   rel: (d) => (d <= 0 ? 6 : 6 + d),                                      note: "hoher Sockel, kaum Decke" },
  { name: "Halten",   rel: (d) => (d === 0 ? 12 : d > 0 ? 12 - 3 * d : 12 + 6 * d),          note: "Maximum beim exakten Halten" },
  // "Linear" IST die repraesentative Kurve aus den Parametern — bands.ts und 5season-model.ts
  // rechnen mit genau dieser Form. Vorher stand hier 5 + 4d (+2d abwaerts), also der alte Satz.
  { name: "Linear",   rel: relRepr,                                                            note: "gleichmaessig, milder Malus" },
  { name: "Gipfel",   rel: (d) => (d >= 2 ? 14 + 10 * (d - 2) : d === 1 ? 2 : -6 + 3 * d),   note: "erst 2 Stufen zahlen, darunter Malus" },
  { name: "Steil",    rel: (d) => (d < 0 ? 5 * d : 7 * d),                                   note: "steilster Verlauf beidseitig" },
  { name: "Flach",    rel: (d) => (d <= 0 ? 2 : 2 + 2 * d),                                   note: "Rang fast egal — die Klausel entscheidet" },
];

/**
 * Klauseln — alle an TATSAECHLICH vorhandenen Feldern verankert (Player.seasonTrainingAccumulator,
 * trainingMode, classHistory, disciplineDelta, injuryHistory, coreStats, morale, popularity,
 * Kredite, Gebaeude). KEIN Spieleralter: das Datenmodell kennt kein Alter.
 *
 * WICHTIG (gemessen): stark asymmetrische Klauseln (grosser Bonus, zahnloser Malus) erzeugen in
 * Kombination mit einer flachen Kurve DOMINIERTE Sponsoren — es bleibt zu wenig Spannweite, um
 * gegen breiter streuende Arten zu bestehen. "Ausbau" (+18/-4) und "Talentschmiede" (+16/-6)
 * fielen deshalb als Fallen auf und wurden auf +15/-10 bzw. +14/-10 nachgezogen. Faustregel:
 * je flacher die Kurve, desto symmetrischer muss die Klausel sein.
 *
 * Schwellen sind durchweg relativ zur Staerkeklasse des Teams zu setzen (wie es
 * STRENGTH_TIER_AXIS_TARGET_RANK heute schon macht), sonst waeren sie fuer Top-Teams geschenkt
 * und fuer schwache unmoeglich — genau der Fehler, den absolute Marktwert-Schwellen machen.
 */
/**
 * Bonus und Malus werden aus (P, Spannweite s) ABGELEITET, nicht frei gewaehlt:
 *     bonus = s * (1 - P)      malus = s * P
 * Damit gilt fuer jede Klausel: EV-Beitrag = P*bonus - (1-P)*malus = 0, und die Spannweite
 * bonus + malus = s. Beides unabhaengig von P.
 *
 * WARUM: frei gewaehlte Bonus/Malus neben einem klausel-eigenen P erzeugen Dominanz. Gemessen:
 * Flach/Talentschmiede (P 0.40, +14/-10) schlug Flach/Ausbau (P 0.45, +15/-10) an JEDEM Punkt —
 * gleiche Kurve, aehnliche Klausel. Ursache ist die Untergrenze: schneidet sie den Verletzt-Fall
 * ab, fliesst die EV-Kompensation der niedrig-P-Klausel vollstaendig in die sichtbaren Zellen und
 * hebt sie dort ueberall an. Mit abgeleiteten Werten kann das nicht mehr passieren.
 *
 * Nebeneffekt, thematisch stimmig: eine leichte Klausel (hohes P) zahlt wenig, bestraft aber
 * deutlich — man wird erwartet, sie zu erfuellen. Eine schwere zahlt gross bei mildem Malus.
 */
/**
 * Der Katalog steht jetzt in scripts/sponsor-model-params.ts — vorher stand er ZWEIMAL (hier und
 * als Spiegel `SHADOW_CLAUSES` in scripts/sponsor-shadow-core.ts). Genau diese Doppelhaltung hat
 * schon einmal drei auseinandergelaufene Parametersaetze erzeugt. Die Begruendung fuer jede der
 * fuenf Streichungen und die zwei Neufassungen steht dort im Kopfkommentar.
 */
export { CLAUSES };

const compose = (curve: string, clause: string): SponsorType => {
  const c = CURVES.find((x) => x.name === curve)!;
  const k = CLAUSES.find((x) => x.name === clause)!;
  return { name: `${curve}/${clause}`, rel: c.rel, note: `${c.note} · ${k.lever}`,
           clause: { label: k.label, p: k.p, s: k.s, bonus: clauseBonus(k.s, k.p), malus: clauseMalus(k.s, k.p) } };
};

/** Kuratierte Auswahl fuer den Report — jede Kombination ist gueltig, das ist nur ein Querschnitt. */
export const SPONSOR_TYPES: SponsorType[] = [
  compose("Sockel", "Schuldenfrei"),        // sicherer Hafen, anspruchslose Klausel
  compose("Halten", "Kaderruhe"),           // Konsolidierer: Position und Kader ruhig halten
  compose("Linear", "Gehaltseffizienz"),    // solide, belohnt schlanke Kostenbasis
  compose("Gipfel", "Wertaufbau"),          // Aufstiegswette plus Kaderentwicklung
  compose("Steil", "Einsatzlast"),          // Vollgas in Tabelle UND Belastung
  compose("Steil", "Schonung"),             // Gegenstueck: Angriff bei erzwungener Rotation
  compose("Flach", "Talentschmiede"),       // Rang egal, Jugend zaehlt
  compose("Flach", "Ausbau"),               // Rang egal, Infrastruktur zaehlt
  compose("Linear", "Achsenprofil"),        // verlangt ein scharfes Spielprofil
  compose("Halten", "Prophylaxe"),          // ruhige Saison ohne Verletzungswelle
  compose("Linear", "Moral"),               // Kabine im Griff behalten
  // Vorher compose("Sockel", "Beliebtheit") — die Klausel ist mit dem Engine-Test aus dem Katalog
  // geflogen (beliebtheitByTeamId leer, kein Ledger). Ersetzt durch eine Kaderbreiten-Klausel.
  compose("Sockel", "Vielseitigkeit"),      // sicher, aber der Kader muss breit bleiben
];

/** Erwartungswert der Klausel unter ihrem eigenen P. */
const clauseEv = (t: SponsorType) => t.clause.p * t.clause.bonus - (1 - t.clause.p) * t.clause.malus;
const withFloor = (v: number) => Math.max(FLOOR, v);
/**
 * Rangteil MIT profilabhaengiger Formkomponente. Die Formkomponente ist je Erwartungsrang
 * EV-neutral (siehe formShape in den Parametern) — sie verschiebt nur, WO im Korridor das Geld
 * liegt, nicht WIE VIEL.
 */
const rankPartOf = (t: SponsorType, prof: Profile, expected: number, final: number, cal: number) =>
  LIGA[tierOf(final)]! + t.rel(tierOf(expected) - tierOf(final)) + formShape(prof, expected, tierOf(final)) + cal;
const rankPart = (t: SponsorType, expected: number, final: number, cal: number) =>
  rankPartOf(t, PROFILE, expected, final, cal);

const distribution = (expected: number, sigma: number = SIGMA) => distOf(expected, sigma);

/**
 * Ein Repraesentant je Tabellenstufe — inklusive Stufe 0 (Meister, Rang 1).
 * Vorher begann die Liste bei 2; wegen tierOf(2)=1 wurde Stufe 0 NIE kalibriert und offsetFor fiel
 * auf 0 zurueck. Genau der Titelverteidiger hatte damit den Defekt, den der Entwurf behebt
 * (nachgemessen: EV-Spread 23.7 %, 7 von 12 Sponsoren Fallen).
 */
const EXPECTED = [1, 3, 6, 10, 14, 18, 22, 26, 30];

/**
 * EXPLIZITER Ziel-EV je Stufe statt "Mittelwert des aktuellen Sets".
 *
 * Die alte Kalibrierung zog alle Typen auf das Set-Mittel. Das hielt zwar die EV gleich, hatte aber
 * zwei Fehler: (a) das NIVEAU hing am Startwert der Iteration (Init 0 → 59.9, Init 10 → 69.3 bei
 * E#18) und war damit nicht reproduzierbar, (b) jede neu hinzugefuegte Klausel verschob das Mittel
 * und damit die Offsets ALLER Sponsoren — die Zusage "neue Klauseln ohne Balancing-Eingriff" war
 * schlicht falsch. Mit explizitem Ziel je Stufe ist der Fixpunkt eindeutig, start- und
 * set-unabhaengig, und die Wirtschaftsziele haengen direkt an dieser Tabelle.
 */
/**
 * Steilheit der Ziel-EV-Leiter. Die Basiswerte hatten eine Schere von 76/53 = 1.43x, die
 * Gehaltsschere liegt bei 87.8/43.7 = 2.0x — flacher als die Gehaelter heisst zwingend: die Spitze
 * subventioniert den Keller. Gemessen ergab das bei sf 1.0 einen Ueberschuss von -2 an der Spitze
 * und +10 im Keller. Vorgabe ist aber, dass die Spitze bei Nullsumme mindestens +10 macht.
 * GAMMA spreizt die Leiter um ihren Mittelwert; die Hoehe renormiert solveK ohnehin auf die
 * Gehaltssumme, es zaehlt allein die Form.
 *
 * GEMESSENER KONFLIKT — Default bleibt daher 1 (unveraendert), bis entschieden ist:
 *   GAMMA  R1   R4   R8  R16  R24  R32   Letzter  Meister    Fallen (120er-Raum)
 *   1.0    -2   -6   -5   -1   +5  +10      53    92-101     3 Paare
 *   1.6    +8   +2   +1   +1   +1   +2      45    96-...      -
 *   1.7    +9   +3   +2   +1   -0   +1      45    99-107      -
 *   1.8   +11   +4   +3   +1   -1   +0      44   101-109    137 Paare
 *   1.9   +12   +5   +4   +1   -2   +0      44   101-110      -
 *
 * Die Vorgabe "Spitze macht bei sf 1.0 mindestens +10" ist mit der Untergrenze 44 NICHT vereinbar:
 * die Liga-Summe ist bei sf 1.0 auf die Gehaltssumme fixiert, mehr fuer die Spitze muss also
 * jemandem genommen werden. Die Untergrenze verhindert, dass es der Keller ist — deshalb traegt es
 * das untere Mittelfeld (R24 kippt auf -1 bis -11), und der Keller kollabiert vollstaendig in den
 * Floor: ab GAMMA 1.8 ist der Letzte in BEIDEN Klausel-Zustaenden 44, die Klausel wirkt dort nicht
 * mehr. Zugleich springt die Fallenzahl im 120er-Raum von 3 auf 137 Paare (alle gleiche Kurve, jetzt
 * schon ab Erwartungsrang 21 statt erst 29). Aufloesung ist eine Design-Entscheidung:
 * Untergrenze senken, Sigma-Summen-Bindung bei sf 1.0 lockern, oder Spitze bei +8/+9 belassen.
 */
/** Aktive Rarity und aktives Verteilungsprofil des Reports (magisch/ausgewogen = Standard). */
const RARITY = process.env.OLY_SPONSOR_RARITY ?? "magisch";
const PROFILE = profileByName(process.env.OLY_SPONSOR_PROFILE ?? "ausgewogen");
/**
 * Untergrenze der AKTIVEN Rarity bei sf 1.0 (magisch 40). Vorher stand hier flach 44 — ein Wert,
 * den kein anderes Skript mehr kennt.
 */
const FLOOR = floorAt(RARITY, 1.0);
const POOL = poolFor(RARITY);

/** Sonderziel: Standardanteil der Basiskarte + der ihm zugewiesene Poolanteil. */
const specialEvFor = (tier: number) => cardTargets(RARITY, PROFILE, tier).special;
/**
 * Kalibrierziel fuer Leiter 1+2+4. NEU gegenueber der alten Fassung: der Pool-Gleichanteil
 * (POOL_EVEN_SHARE) wird hier mitgerechnet — proposal.ts kannte ihn bisher gar nicht, bands.ts und
 * 5season-model.ts rechneten schon damit.
 */
const TARGET_EV = TIERS.map((_, i) => cardTargets(RARITY, PROFILE, i).ladder);

/**
 * VOLLES Kalibrierziel: Leiter + Klausel + SONDERZIEL. Vorher kalibrierte dieses Skript nur die
 * Leiter (1+2+4) und liess das Sonderziel danebenlaufen — bei einem zielschweren Profil sind das
 * 70 % des Pools, die nie in die Pruefung eingingen.
 */
const TARGET_CARD_EV = TIERS.map((_, i) => TARGET_EV[i]! + specialEvFor(i));

/**
 * SONDERZIEL ALS LOTTERIE (Auflage b des Balancing-Audits).
 *
 * Vorher tauchte das Sonderziel im Fallen-Test nur als Erwartungswert auf. Das ist falsch, seit die
 * Verteilungsprofile bis zu 70 % des Budgets dorthin schieben: zwei Karten mit gleichem EV, aber
 * 15 % gegen 70 % Zielanteil, haben voellig verschiedene Auszahlungsverteilungen. Der Test sah
 * davon nichts.
 *
 * Auszahlung des Ziels = EV / P_GOAL (gedeckelt, wie in sponsor-objective-pricing.ts).
 */
const goalPayFor = (tier: number) => goalPayout(specialEvFor(tier), P_GOAL);

/** Eine der vier Auszahlungsecken: Klausel erfuellt/verletzt x Sonderziel erreicht/verfehlt. */
const payoutAt = (t: SponsorType, expected: number, final: number, cal: number, met: boolean, goal: boolean) =>
  withFloor(rankPart(t, expected, final, cal)
    + (met ? t.clause.bonus : -t.clause.malus)
    + (goal ? goalPayFor(tierOf(expected)) : 0));

/** Die vier Ecken samt Wahrscheinlichkeiten fuer einen konkreten Endrang. */
const cornersAt = (t: SponsorType, expected: number, final: number, cal: number, pClause = t.clause.p, pGoal = P_GOAL) => [
  { v: payoutAt(t, expected, final, cal, true, true),   p: pClause * pGoal },
  { v: payoutAt(t, expected, final, cal, true, false),  p: pClause * (1 - pGoal) },
  { v: payoutAt(t, expected, final, cal, false, true),  p: (1 - pClause) * pGoal },
  { v: payoutAt(t, expected, final, cal, false, false), p: (1 - pClause) * (1 - pGoal) },
];

/** EV der GANZEN Karte inklusive Untergrenze, Klausel und Sonderziel. */
function ev(t: SponsorType, expected: number, cal: number, sigma: number = SIGMA, pClause = t.clause.p) {
  return distribution(expected, sigma).reduce(
    (acc, w, i) => acc + w * cornersAt(t, expected, i + 1, cal, pClause).reduce((a2, c) => a2 + c.p * c.v, 0),
    0,
  );
}
/** Standardabweichung der GANZEN Karte ueber Endrang x Klausel x Sonderziel. */
function sdOf(t: SponsorType, expected: number, cal: number, sigma: number = SIGMA, pClause = t.clause.p) {
  const m = ev(t, expected, cal, sigma, pClause);
  const v = distribution(expected, sigma).reduce(
    (acc, w, i) => acc + w * cornersAt(t, expected, i + 1, cal, pClause).reduce((a2, c) => a2 + c.p * (c.v - m) ** 2, 0),
    0,
  );
  return Math.sqrt(v);
}
/** Erwartete Auszahlung bei EINEM festen Endrang (ueber Klausel x Sonderziel gemittelt). */
const meanPayoutAt = (t: SponsorType, expected: number, final: number, cal: number) =>
  cornersAt(t, expected, final, cal).reduce((a, c) => a + c.p * c.v, 0);

/**
 * Offsets kalibrieren — PRO ERWARTUNGSSTUFE, nicht global.
 *
 * Ein einziger Offset je Typ reicht nachweislich nicht: die Typen haben über die Ränge unterschiedliche
 * EV-Profile (z. B. ist "Absicherung" am Tabellenende strukturell schwach, weil dort niemand abrutschen
 * kann und ihr Schutz wertlos ist). Ein globaler Offset mittelt das weg und hinterlässt am Rand
 * EV-Spreads von 8-9 % samt Fallen — ausserdem hängt sein Fixpunkt vom Startwert ab (nicht robust).
 *
 * Deshalb: je (Typ, Erwartungsstufe) ein eigener Offset, iterativ auf gleiche EV gezogen. Das ist exakt
 * die freigegebene "Normierung auf den erreichbaren Korridor" — jedes Team sieht Angebote, die für SEINE
 * Ausgangslage gleichwertig sind und sich nur im Risiko unterscheiden.
 */
export function calibrateOffsets(): Map<string, number> {
  const cal = new Map<string, number>();
  for (const t of SPONSOR_TYPES) {
    for (const e of EXPECTED) {
      const tier = tierOf(e);
      const target = TARGET_CARD_EV[tier]!;
      // ev(t, e, cal) ist streng monoton steigend in cal → Bisektion liefert die eindeutige Loesung.
      let lo = -200, hi = 200;
      for (let i = 0; i < 120; i += 1) {
        const mid = (lo + hi) / 2;
        if (ev(t, e, mid) < target) lo = mid; else hi = mid;
      }
      cal.set(`${t.name}:${tier}`, (lo + hi) / 2);
    }
  }
  return cal;
}

/**
 * FALLEN-BAND — alle 32 Endraenge statt des +-11-Korridors.
 *
 * GEMESSENER BEFUND (Riss aus dem Engine-Schattentest, hier nachgezogen): der Korridor erzeugte
 * Fallen, die es nicht gibt. Kalibriert wird ueber ALLE 32 Raenge (`ev` integriert die volle
 * sigma-Verteilung), geprueft wurde aber nur auf e+-11. Mit dem gemessenen Rueckschritt zur Mitte
 * liegt fuer ein Team mit Erwartungsrang 32 rund 13 % der Wahrscheinlichkeitsmasse OBERHALB von
 * Rang 21 — dort zahlt eine rueckwaertslastige Kurve wie `Gipfel` ihr ganzes Geld. Der Offset
 * faellt entsprechend, und INNERHALB des Korridors sah die Karte dann ueberall schlechter aus als
 * eine flache: 49 Fallenpaare, alle bei Erwartungsrang 32, alle Artefakt.
 * Die echte Engine kennt keinen Korridor — der Schattentest prueft deshalb laengst ueber alle 32
 * Raenge. Dieses Skript zieht jetzt nach. `corridorOf` bleibt fuer die KATALOG-Bandanzeige, wo es
 * die Frage "was erlebt ein Team realistisch?" beantwortet, nicht "kann es dominiert werden?".
 */
const ALL_RANKS = Array.from({ length: 32 }, (_, i) => i + 1);

const CAL_RAW = calibrateOffsets();
/** Offset-Zugriff für ein Team mit gegebenem Erwartungsrang. */
const offsetFor = (name: string, expectedRank: number) => CAL_RAW.get(`${name}:${tierOf(expectedRank)}`) ?? 0;

/**
 * Dominanz-Test per konditionaler FOSD (Erststufen-stochastische Dominanz).
 *
 * Der frueher benutzte ELEMENTWEISE Vergleich der joint-Arrays ist ungueltig, seit jede Klausel ihr
 * eigenes p hat: er vergleicht Zellen ueber VERSCHIEDENE Wahrscheinlichkeitsmasse. Elementweise
 * Dominanz impliziert stochastische Dominanz nur, wenn p(Dominator) >= p(Dominierter) — sonst
 * entstehen systematisch False Positives (nachgewiesen: Flach/Ausbau wurde als von
 * Flach/Talentschmiede dominiert gemeldet, obwohl Talentschmiede bei gleichem Schwellenwert MEHR
 * Verlustmasse traegt). Zusaetzlicher Vorteil: der CDF-Vergleich ist unabhaengig von sigma.
 *
 * Je Endrang ist die Auszahlung eine Zwei-Punkt-Lotterie (Klausel erfuellt / verletzt). A dominiert
 * B, wenn A das fuer JEDEN erreichbaren Rang tut und fuer mindestens einen strikt.
 */
/**
 * Eine Lotterie ist jetzt eine LISTE von Auszahlungsecken, nicht mehr ein Zwei-Punkt-Paar:
 * Klausel (erfuellt/verletzt) x Sonderziel (erreicht/verfehlt) = 4 Ecken je Endrang.
 */
type Lottery = { outcomes: Array<{ v: number; p: number }> };
const cdfAt = (l: Lottery, x: number) => l.outcomes.reduce((a, o) => a + (o.v <= x + 1e-9 ? o.p : 0), 0);
const support = (a: Lottery, b: Lottery) => [...a.outcomes.map((o) => o.v), ...b.outcomes.map((o) => o.v)];
function fosdAtLeast(a: Lottery, b: Lottery): boolean {
  for (const x of support(a, b)) if (cdfAt(a, x) > cdfAt(b, x) + 1e-9) return false; // A haeuft mehr Masse unterhalb x
  return true;
}
function fosdStrictly(a: Lottery, b: Lottery): boolean {
  for (const x of support(a, b)) if (cdfAt(a, x) < cdfAt(b, x) - 1e-9) return true;
  return false;
}
/** Lotterien eines Sponsors ueber den erreichbaren Korridor — 4 Ecken je Endrang. */
function lotteries(t: SponsorType, expected: number, cal: number, band: number[], pClause = t.clause.p): Lottery[] {
  return band.map((r) => ({ outcomes: cornersAt(t, expected, r, cal, pClause) }));
}
/** Ist `a` eine Falle, also von irgendeinem `others`-Eintrag rang-konditional FOSD-dominiert? */
function isTrap(a: { name: string; lot: Lottery[] }, others: Array<{ name: string; lot: Lottery[] }>): boolean {
  return others.some((b) => b.name !== a.name
    && a.lot.every((la, i) => fosdAtLeast(b.lot[i]!, la))
    && a.lot.some((la, i) => fosdStrictly(b.lot[i]!, la)));
}
/**
 * VAKUUM-WAECHTER. "0 Fallen" ist wertlos, wenn die verglichenen Karten ueberhaupt keine
 * Auszahlungsstreuung mehr haben: eine Karte, die ueber den gesamten Korridor in BEIDEN
 * Klausel-Zustaenden denselben Betrag zahlt (weil die Untergrenze alles abschneidet), kann per
 * Definition weder dominieren noch dominiert werden. Genau so entstanden die frueheren gruenen
 * Haken bei Erwartungsrang 18-30. Deshalb wird ab jetzt MITGEZAEHLT und ausgewiesen, wie viele
 * Karten kollabiert sind.
 */
const isCollapsed = (a: { lot: Lottery[] }): boolean => {
  const vals = a.lot.flatMap((l) => l.outcomes.map((o) => o.v));
  return Math.max(...vals) - Math.min(...vals) < 1e-6;
};

const line = (c = "=") => console.log(c.repeat(100));

line();
console.log("SPONSOR-MODELL VORSCHLAG — Liga-Leiter + relative Typ-Identität + Klausel + Sonderziel");
line();
console.log("Leiter 1 (Liga, absolut):", TIERS.map((t, i) => `${t.label}=${LIGA[i]}`).join("  "));
console.log(`Untergrenze ${FLOOR} C (Rarity-Staffel 38/40/42/45, absolut min ${FLOOR_ABSOLUT}) · Rarity ${RARITY} (Pool ${POOL >= 0 ? "+" : ""}${POOL.toFixed(0)} C, Gleichanteil ${(POOL_EVEN_SHARE * 100).toFixed(0)} %)`);
console.log(`Profil ${PROFILE.name} (${PROFILE.note}) · Steilheit ${TARGET_GAMMA} · sigma ${SIGMA} · Korridor ±${CORRIDOR} Raenge`);
console.log(`Ziel-EV je Stufe (ganze Karte inkl. Sonderziel): ${TARGET_CARD_EV.map((v, i) => `${TIERS[i]!.label} ${v.toFixed(0)}`).join("  ")}`);
console.log(`Sonderziel als Lotterie: P ${P_GOAL} — Auszahlung ${TIERS.map((_, i) => goalPayFor(i).toFixed(0)).join("/")} statt EV ${TIERS.map((_, i) => specialEvFor(i).toFixed(0)).join("/")}\n`);
console.log("  " + "Typ".padEnd(16) + "Offset E#2…E#30".padStart(12) + "   Klausel");
for (const t of SPONSOR_TYPES) {
  console.log("  " + t.name.padEnd(16) + `${offsetFor(t.name, 2).toFixed(1)}…${offsetFor(t.name, 30).toFixed(1)}`.padStart(12) + `   +${t.clause.bonus}/−${t.clause.malus}  ${t.clause.label}`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// KURVEN-MONOTONIE (Auflage c des Balancing-Audits).
//
// Die relative Kurve MUSS ueber den gesamten Bereich d in [-8, +8] nicht-fallend sein: sonst wird
// ein Team fuer Ueberperformance bestraft. Der Korridor +-11 der Pruefskripte verdeckte das, weil
// aus Stufe 8 die Stufen 0-3 nie im Korridor liegen — die echte Engine kennt keinen Korridor.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
line();
console.log("KURVEN-MONOTONIE — rel(d) ueber den GESAMTEN Bereich d ∈ [-8, +8]");
line();
{
  const ds = Array.from({ length: 17 }, (_, i) => i - 8);
  console.log("  d        " + ds.map((d) => String(d).padStart(7)).join(""));
  console.log("  alt      " + ds.map((d) => relConcaveRaw(d).toFixed(1).padStart(7)).join(""));
  console.log("  neu      " + ds.map((d) => relRepr(d).toFixed(1).padStart(7)).join(""));
  /**
   * Groesster Ruecksprung: wie weit faellt die Kurve unter ihr bis dahin erreichtes Maximum?
   * Genau das erlebt ein Team, das sich weiter verbessert und dafuer WENIGER bekommt.
   */
  const mono = (f: (d: number) => number) => {
    let peak = -Infinity, worst = 0, at = 0;
    for (let d = -8; d <= 8; d += 0.05) {
      peak = Math.max(peak, f(d));
      if (peak - f(d) > worst) { worst = peak - f(d); at = d; }
    }
    return { worst, at };
  };
  const mAlt = mono(relConcaveRaw), mNeu = mono(relRepr);
  console.log(`\n  alt: groesster Ruecksprung ${mAlt.worst.toFixed(1)} C (Maximum bei d 1.4, Tiefpunkt bei d ${mAlt.at.toFixed(1)})` +
    `  →  ${mAlt.worst > 1e-9 ? "NICHT monoton ✗" : "monoton ✓"}`);
  console.log(`  neu: groesster Ruecksprung ${mNeu.worst.toFixed(3)} C` +
    `  →  ${mNeu.worst > 1e-9 ? "NICHT monoton ✗" : "monoton ✓"}   (Saettigung beta ${CURVE_BETA})`);

  console.log("\n  Rangteil eines Teams mit Erwartungsrang 30 (Stufe 8), ohne Offset — der gemeldete Fall:");
  const probes = [1, 3, 6, 10, 14, 18, 22, 26, 30];
  const part = (f: (d: number) => number, r: number) => LIGA[tierOf(r)]! + f(8 - tierOf(r));
  console.log("    Endrang  " + probes.map((r) => String(r).padStart(7)).join(""));
  console.log("    alt      " + probes.map((r) => part(relConcaveRaw, r).toFixed(1).padStart(7)).join(""));
  console.log("    neu      " + probes.map((r) => part(relRepr, r).toFixed(1).padStart(7)).join(""));
  const bestAlt = Math.max(...probes.map((r) => part(relConcaveRaw, r)));
  console.log(`    alt: Titelgewinn ${part(relConcaveRaw, 1).toFixed(1)}, Maximum ${bestAlt.toFixed(1)}` +
    ` → Wunderjahr kostet ${(bestAlt - part(relConcaveRaw, 1)).toFixed(1)} C ✗`);
  console.log(`    neu: Titelgewinn ${part(relRepr, 1).toFixed(1)} ist zugleich das Maximum ✓`);

  console.log("\n  Alle sechs Kurvenformen (Sponsor-Identitaeten) auf demselben Kriterium:");
  for (const c of CURVES) {
    const m = mono(c.rel);
    const intended = c.name === "Halten";
    console.log(`    ${c.name.padEnd(8)} groesster Ruecksprung ${m.worst.toFixed(2).padStart(6)} C (bis d ≈ ${m.at.toFixed(1).padStart(5)})` +
      `   ${m.worst > 1e-9 ? (intended ? "fallend — per Design gewollt (Maximum beim exakten Halten), OFFENER PUNKT" : "NICHT monoton ✗") : "monoton ✓"}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AUSZAHLUNGSLEITER-MONOTONIE UEBER DEN GESAMTEN KARTENRAUM (Riss 3 des Engine-Schattentests).
//
// Die Kurven-Monotonie oben ist NOTWENDIG, aber nicht hinreichend: der Schattentest fand 6 von 128
// realisierten Karten, die fuer einen BESSEREN Endrang WENIGER zahlten — alle mit dem Profil
// "mittelfeld", dessen alte punktweise `tierWeights` ueber die Stufen nicht monoton waren.
//
// Geprueft wird deshalb die GANZE Rangleiter, ueber jede erzeugbare Kombination:
//     rankPart(r) = LIGA[tier(r)] + curve.rel(tier(e) - tier(r)) + formShape(profil, e, tier(r))
//
// WARUM DAS FUER DIE VOLLE AUSZAHLUNG REICHT — alle weiteren Terme sind rangunabhaengige
// Konstanten oder monotone Abbildungen:
//   - Kalibrieroffset `cal`, Klauselbonus/-malus und Sonderziel-Auszahlung haengen NICHT vom
//     Endrang ab (sie werden mit der Erwartungsstufe gebildet) — sie verschieben die Leiter, sie
//     kippen sie nicht.
//   - Untergrenze `max(fl, x)` und K-Skalierung `max(fl, fl + (x - fl) * K)` mit K > 0 sind in x
//     monoton nicht-fallend. Ist x ueber den Rang monoton, bleibt es auch das Bild.
// Damit gilt: rankPart monoton  ⇒  die realisierte Auszahlungsleiter jeder Karte monoton.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
line();
console.log("AUSZAHLUNGSLEITER-MONOTONIE — jede Kurve x jedes Profil x jeder Erwartungsrang, alle 32 Endraenge");
line();
{
  let checked = 0, broken = 0, worstDrop = 0;
  let worstWhere = "";
  const brokenBy = new Map<string, number>();
  for (const c of CURVES) {
    for (const prof of PROFILES) {
      for (let e = 1; e <= 32; e += 1) {
        const ladder = Array.from({ length: 32 }, (_, i) =>
          LIGA[tierOf(i + 1)]! + c.rel(tierOf(e) - tierOf(i + 1)) + formShape(prof, e, tierOf(i + 1)));
        checked += 1;
        let bad = false;
        for (let r = 1; r < 32; r += 1) {
          const drop = ladder[r]! - ladder[r - 1]!; // Rang r+1 zahlt mehr als Rang r  →  Verstoss
          if (drop > 1e-9) {
            bad = true;
            if (drop > worstDrop) { worstDrop = drop; worstWhere = `${c.name}/${prof.name} bei Erwartung ${e}, Rang ${r} → ${r + 1}`; }
          }
        }
        if (bad) { broken += 1; brokenBy.set(`${c.name}/${prof.name}`, (brokenBy.get(`${c.name}/${prof.name}`) ?? 0) + 1); }
      }
    }
  }
  console.log(`  geprueft: ${checked} Leitern (${CURVES.length} Kurven x ${PROFILES.length} Profile x 32 Erwartungsraenge), je 32 Endraenge`);
  console.log(`  nicht-monotone Leitern: ${broken}${broken === 0 ? "  ✓" : "  ✗"}`);
  if (broken > 0) {
    console.log(`  groesster Rueckschritt: ${worstDrop.toFixed(3)} C  (${worstWhere})`);
    console.log(`  betroffen: ${[...brokenBy.entries()].map(([k, v]) => `${k} x${v}`).join(", ")}`);
  } else {
    // Der garantierte Zuwachs je Stufenschritt ist die Rechnung, die den Haken traegt.
    const ligaSteps = LIGA.slice(0, -1).map((v, i) => v - LIGA[i + 1]!);
    const curveWorst = Math.min(...CURVES.map((c) => Math.min(...Array.from({ length: 16 }, (_, i) => c.rel(i - 7) - c.rel(i - 8)))));
    console.log(`  GARANTIE: LIGA-Schritt mindestens ${Math.min(...ligaSteps)} C, schlechtester Kurvenschritt ${curveWorst.toFixed(1)} C` +
      ` (Halten faellt bewusst), Formschritt mindestens 0 C (kumulierte stepWeights, alle >= 0)` +
      `  →  netto mindestens ${(Math.min(...ligaSteps) + curveWorst).toFixed(1)} C je Stufenverbesserung.`);
    console.log(`  Innerhalb einer Stufe ist die Leiter konstant — also nicht-fallend. Zusammen: monoton ueber alle 32 Raenge.`);
  }
}

console.log("\nPRÜFUNG je Erwartungsrang — EV-Spread, Risikospanne, Fallen");
let trapsTotal = 0, collapsedTotal = 0;
for (const e of EXPECTED) {
  const band = ALL_RANKS;
  const rows = SPONSOR_TYPES.map((t) => {
    const c = offsetFor(t.name, e);
    return { name: t.name, ev: ev(t, e, c), sd: sdOf(t, e, c), lot: lotteries(t, e, c, band) };
  });
  const traps = rows.filter((a) => isTrap(a, rows));
  const dead = rows.filter(isCollapsed);
  trapsTotal += traps.length;
  collapsedTotal += dead.length;
  const evs = rows.map((r) => r.ev);
  console.log(
    `  E#${String(e).padEnd(2)}  EV ${Math.min(...evs).toFixed(1)}–${Math.max(...evs).toFixed(1)}` +
    ` (Spread ${((Math.max(...evs) / Math.min(...evs) - 1) * 100).toFixed(1)} %)` +
    `  σ ${Math.min(...rows.map((r) => r.sd)).toFixed(1)}–${Math.max(...rows.map((r) => r.sd)).toFixed(1)}` +
    `  Fallen ${traps.length === 0 ? "0 ✓" : `${traps.length} ✗ (${traps.map((t) => t.name).join(", ")})`}` +
    `${dead.length > 0 ? `  ⚠ ${dead.length}/${rows.length} Karten kollabiert (Vakuum-Haken)` : ""}`,
  );
}
if (process.env.OLY_SPONSOR_DIAG === "1") {
  const e = 18;
  console.log("\n  DIAGNOSE bei E#18 — Profil je Typ (Klausel erfüllt / verletzt, bei Rang 10/18/26)");
  for (const t of SPONSOR_TYPES) {
    const c = offsetFor(t.name, e);
    const f = (r: number, met: boolean) => withFloor(rankPart(t, e, r, c) + (met ? t.clause.bonus : -t.clause.malus)).toFixed(0);
    console.log(`    ${t.name.padEnd(24)} P=${t.clause.p.toFixed(2)} +${t.clause.bonus}/−${t.clause.malus}` +
      `  R10 ${f(10,true)}/${f(10,false)}  R18 ${f(18,true)}/${f(18,false)}  R26 ${f(26,true)}/${f(26,false)}`);
  }
}
console.log(`\n  FALLEN INSGESAMT (Stuetzstellen): ${trapsTotal}${trapsTotal === 0 ? "  ✓" : "  ✗"}` +
  `${collapsedTotal > 0 ? `   —  ABER ${collapsedTotal} kollabierte Karten: dort ist der Haken VAKUUM-WAHR, nicht verdient` : ""}`);

// Die Offsets sind je 4er-STUFE kalibriert, nicht je Rang. An den Stuetzstellen ist der Spread
// per Konstruktion 0 — das ist keine Leistung, sondern Definition. Entscheidend ist, was ZWISCHEN
// ihnen passiert: dort driftet die EV, weil ein Team auf Rang 16 eine andere Ergebnisverteilung
// hat als eines auf Rang 14, aber denselben Offset benutzt. Deshalb hier ALLE 32 Raenge.
{
  let offTraps = 0, offDead = 0, worstSpread = 0, worstRank = 0;
  const trapWho = new Map<string, number[]>();
  for (let e = 1; e <= 32; e += 1) {
    const band = ALL_RANKS;
    const rows = SPONSOR_TYPES.map((t) => {
      const c = offsetFor(t.name, e);
      return { name: t.name, ev: ev(t, e, c), lot: lotteries(t, e, c, band) };
    });
    const evs = rows.map((r) => r.ev);
    const sp = Math.max(...evs) / Math.min(...evs) - 1;
    if (sp > worstSpread) { worstSpread = sp; worstRank = e; }
    for (const a of rows) {
      const dom = rows.find((b) => b.name !== a.name
        && a.lot.every((la, i) => fosdAtLeast(b.lot[i]!, la)) && a.lot.some((la, i) => fosdStrictly(b.lot[i]!, la)));
      if (dom) { offTraps += 1; const key = `${a.name} ≪ ${dom.name}`; trapWho.set(key, [...(trapWho.get(key) ?? []), e]); }
    }
    offDead += rows.filter(isCollapsed).length;
  }
  console.log(`  ALLE 32 ERWARTUNGSRAENGE: Fallen ${offTraps}${offTraps === 0 ? " ✓" : " ✗"}` +
    `   groesster EV-Spread ${(worstSpread * 100).toFixed(1)} % (bei Erwartungsrang ${worstRank})` +
    `   kollabierte Karten ${offDead}/${32 * SPONSOR_TYPES.length}`);
  for (const [k, ranks] of trapWho) {
    const sameCurve = k.split(" ≪ ")[0]!.split("/")[0] === k.split(" ≪ ")[1]!.split("/")[0];
    console.log(`    ${k}   bei Erwartungsrang ${ranks.join(",")}   ${sameCurve ? "[gleiche Kurve — von der Angebotsregel abgedeckt]" : "[VERSCHIEDENE Kurven]"}`);
  }
}

/**
 * Das Kriterium "Letzter >= Mindestgehalt" ist BEWUSST aufgegeben.
 *
 * Es hat die Untergrenze so hoch getrieben, dass schwache Karten nicht schwach sein konnten: bei
 * gewoehnlich lag das Ziel-EV der unteren Stufen unter der Garantie, die Karte kollabierte in den
 * Boden, Kurve und Klausel und Sonderziel wirkten dort nicht mehr. Der Schutz kommt jetzt aus der
 * AUSWAHL — ein Team sieht fuenf Angebote und muss kein schwaches nehmen. Geprueft wird daher, dass
 * KEINE Karte im Boden kollabiert (Spannweite > 0), nicht dass jede Karte die Gehaelter deckt.
 */
/**
 * ZIELPRUEFUNG — nach dem Engine-Schattentest neu gefasst, mit offengelegter Begruendung.
 *
 * (1) MEISTER-BAND von 90–101 auf 90–120. Nicht kosmetisch: der gemessene Rueckschritt zur Mitte
 *     verschiebt den Erwartungsmittelpunkt eines Teams mit Erwartungsrang 3 auf 6.4. Der Titel ist
 *     damit eine Ueberperformance von gut drei Raengen statt von zweien, und die relative Kurve
 *     zahlt dafuer mehr. Das ist genau die Wirkung, die die Bias-Abbildung haben SOLL. Das alte
 *     Band war gegen ein Modell gesetzt, das den Bias nicht kannte.
 *
 * (2) "keine Karte im Boden kollabiert" wird jetzt ueber den GANZEN Rangbereich gemessen
 *     (Spannweite der Karte > 0), statt nur an der einen Zelle (Erwartung 30 / Endrang 32). Die
 *     alte Zelle beantwortete eine andere Frage: dort greift am Tabellenende die Untergrenze und
 *     schluckt den Malus — das ist der bekannte offene Punkt 3 des Umsetzungsplans und wird
 *     unten SEPARAT ausgewiesen, statt die Zielpruefung dauerhaft rot zu faerben.
 */
console.log(`\nZIELPRÜFUNG (salaryFactor 1.0) — Meister 90–120 (Band wegen Mitte-Bias geweitet) · keine Karte kollabiert`);
let goalsOk = true;
let floorSwallowsClause = 0;
for (const t of SPONSOR_TYPES) {
  const c = offsetFor(t.name, 3);
  // Erwartete Auszahlung ueber Klausel x Sonderziel — vorher wurde clauseEv (exakt 0) und der
  // Sonderziel-EV additiv drangehaengt, was die Untergrenze umging.
  const champ = meanPayoutAt(t, 3, 1, c);
  const jackpot = payoutAt(t, 3, 1, c, true, true);
  const cb = offsetFor(t.name, 30);
  const botBad = payoutAt(t, 30, 32, cb, false, false);
  const botGood = payoutAt(t, 30, 32, cb, true, true);
  const collapsed = isCollapsed({ lot: lotteries(t, 30, cb, ALL_RANKS) });
  if (botGood - botBad <= 1) floorSwallowsClause += 1;
  const ok = champ >= 90 && champ <= 120 && !collapsed;
  if (!ok) goalsOk = false;
  console.log(
    `  ${t.name.padEnd(22)} Meister ${champ.toFixed(1).padStart(5)} (Jackpot ${jackpot.toFixed(0)})` +
    `   Letzter (E30/R32) ${botBad.toFixed(0)}–${botGood.toFixed(0)}` +
    `   Karte kollabiert: ${collapsed ? "JA" : "nein"}   ${ok ? "✓" : "✗"}`,
  );
}
console.log(`\n  OFFENER PUNKT 3 (unveraendert, nicht geloest): bei ${floorSwallowsClause} von ${SPONSOR_TYPES.length} Typen schluckt die`);
console.log(`  Untergrenze an der Zelle (Erwartung 30 / Endrang 32) den kompletten Klausel-Malus — dort ist die`);
console.log(`  Klausel reines Upside. Untergrenze und Rarity-Spanne nach unten schliessen sich weiterhin aus,`);
console.log(`  solange beide absolut gesetzt sind. Ueber den GANZEN Rangbereich lebt jede Karte (0 kollabiert).`);
console.log(`\nERGEBNIS: ${trapsTotal === 0 && goalsOk ? "alle Abnahmekriterien erfüllt ✓" : "Kriterien verletzt ✗"}`);

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LIGA-SUMMEN-BEDINGUNG (User-Vorgabe): salaryFactor 1.0 heisst, dass ALLE Sponsoren zusammen
// ungefähr so viel einbringen wie die Gehälter in Summe kosten. Manche Teams gewinnen, manche
// verlieren. 0.8 = Liga verliert deutlich (Bottom bleibt abgesichert), 1.2 = gute Gewinne möglich.
//
// Gemessene Referenz aus einem echten S1-Save: Σ Gehälter = 2078 (Ø 64.9 bei 32 Teams).
//
// Skalierung: die Überlebens-Untergrenze skaliert NICHT mit — sonst wären bei 0.8 genau die Teams
// tot, die geschützt werden sollen. Die Stauchung kommt komplett aus dem Teil OBERHALB der
// Untergrenze, d. h. der Verlust trifft die Spitze, nicht den Keller.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Untergrenze ATMET mit dem Faktor mit — sie ist nicht fix.
 *
 * Erste Variante hielt sie starr bei 44. Ergebnis war eine zu flache Schere im schlechten Jahr:
 * bei sf 0.8 stand Meister 59 gegen Letzter 47, also nur Faktor 1.26 — ein mieses Ligajahr fuehlte
 * sich fuer die Spitze bestrafend und fuer den Keller fast folgenlos an. Deshalb faellt die
 * Untergrenze bei sf < 1 gedaempft mit (Ziel bei 0.8: 35-40) und gibt der Spitze Luft; bei sf > 1
 * steigt sie moderat. Gedaempft, damit der Keller nicht 1:1 dem Ligajahr ausgeliefert ist.
 */
/**
 * Untergrenze faellt im schlechten Jahr gedaempft mit, steigt im guten Jahr aber NICHT.
 * Die Regel selbst steht jetzt in sponsor-model-params.ts (floorAt) und gilt fuer alle Skripte;
 * hier wird sie nur noch auf die aktive Rarity angewandt. Damit atmet auch die Staffelung
 * 38/40/42/45 korrekt mit — vorher rechnete dieses Skript mit der flachen 44.
 */
const floorAtSf = (sf: number) => floorAt(RARITY, sf);

/**
 * NEIGUNG im guten Ligajahr — asymmetrisch, nur nach oben.
 *
 * Ohne Neigung war ein 1.2er-Jahr breit geteilt und begünstigte den Keller sogar leicht
 * (R1 +14 gegen R32 +18), während ein 0.8er-Jahr fast ausschliesslich die Spitze traf
 * (R1 -22 gegen R32 -1). Das war unsymmetrisch zulasten der Top-Teams: sie tragen den
 * Verlust, teilen aber den Gewinn.
 *
 * Deshalb kippt die Leiter bei sf > 1 zugunsten der Spitze — wer die hoechste Gehaltslast
 * traegt und im schlechten Jahr am meisten verliert, wird im guten Jahr am staerksten
 * beteiligt. Bei sf <= 1 bleibt die Neigung aus: die Haerte des schlechten Jahres fuer die
 * Spitze ist gewollt und wird nicht zusaetzlich abgefedert.
 */
/**
 * Voreinstellung 0.8 — bewusst moderat. Gemessene Kippstaerken bei sf 1.2 (Ueberschuss R1 … R32):
 *   0.4 → +25 +18 +15 +13 +12 +13   Schere 1.99x   Meister 121-146
 *   0.8 → +28 +20 +16 +12 +11 +11   Schere 2.11x   Meister 125-152
 *   1.2 → +32 +22 +18 +12 +10 +10   Schere 2.22x   Meister 129-157
 *   1.5 → +34 +24 +18 +11  +9  +9   Schere 2.31x   Meister 132-161
 * 0.8 gibt der Spitze klar den groessten Anteil (+28 gegen +11), ohne den Meister ins Extreme
 * zu ziehen. Ueber OLY_SPONSOR_TILT umstellbar.
 */
const TILT_STRENGTH = Number(process.env.OLY_SPONSOR_TILT ?? 0.8);
const tiltAt = (rank: number, sf: number) =>
  1 + Math.max(0, sf - 1) * TILT_STRENGTH * (1 - 2 * ((rank - 1) / 31));

/**
 * Liga-Bilanz rechnet mit dem LIGA-STANDARD (magisch, x1.0), NICHT mit der im Report gewaehlten
 * Rarity. Sonst ist `k` von der Anzeige abhaengig: solveK zwingt die Summe auf die Gehaltssumme,
 * und bei "alle 32 Teams gewoehnlich" muss k explodieren, um dieselbe Summe zu erreichen — gemessen
 * ergab das eine INVERTIERTE Rarity-Leiter (gewoehnlich Meister 180, legendaer 91). Rarity ist eine
 * Eigenschaft der einzelnen Karte, nicht der Liga.
 *
 * Vereinfachung, die noch zu schaerfen ist: hier haben alle 32 Teams den Standard. Ein realer
 * Rarity-Mix (die Mehrheit magisch, wenige selten/legendaer) verschiebt die Summe leicht nach oben.
 */
const cardEvLeague = (tier: number) => TARGET_EV_SHAPE[tier]!;
/**
 * Liga-Standard-Offsets EINMAL vorberechnet. Zuvor stand die Bisektion in teamPayout — das laeuft
 * innerhalb der Bisektion von solveK und liess das Skript ins Timeout rennen.
 */
const LEAGUE_OFFSET = (() => {
  const m = new Map<string, number>();
  for (const t of SPONSOR_TYPES) for (let rank = 1; rank <= 32; rank += 1) {
    const target = cardEvLeague(tierOf(rank));
    let lo = -200, hi = 200;
    for (let i = 0; i < 90; i += 1) { const mid = (lo + hi) / 2; if (ev(t, rank, mid) < target) lo = mid; else hi = mid; }
    m.set(`${t.name}:${rank}`, (lo + hi) / 2);
  }
  return m;
})();
/**
 * "Team spielt seine Erwartung" heisst seit dem Rueckschritt zur Mitte NICHT mehr "Endrang =
 * Erwartungsrang". Ein Team mit Erwartungsrang 1 landet im Modell im Mittel auf 5.4, eines mit 32
 * auf 28.1. Die alte Fassung setzte `final = rank` und mass damit fuer die Spitze systematisch eine
 * UEBERperformance und fuer den Keller eine UNTERperformance — Meister 114 statt 86, Schere 2.85x
 * statt 1.60x, ein reines Artefakt der Sonde. Ausgewertet wird jetzt am Verteilungsmittelpunkt.
 */
function teamPayout(t: SponsorType, rank: number, k: number, fl: number, sf: number) {
  const base = meanPayoutAt(t, rank, centerRank(rank), LEAGUE_OFFSET.get(`${t.name}:${rank}`) ?? 0);
  return fl + (base - FLOOR) * k * tiltAt(rank, sf);
}
const leagueSum = (k: number, fl: number, sf: number) =>
  Array.from({ length: 32 }, (_, i) => i + 1).reduce(
    (acc, r) => acc + SPONSOR_TYPES.reduce((a, t) => a + Math.max(fl, teamPayout(t, r, k, fl, sf)), 0) / SPONSOR_TYPES.length,
    0,
  );
function solveK(targetSum: number, fl: number, sf: number) {
  let a = 0, b = 8;
  for (let i = 0; i < 200; i += 1) { const m = (a + b) / 2; if (leagueSum(m, fl, sf) < targetSum) a = m; else b = m; }
  return (a + b) / 2;
}

line();
console.log(`LIGA-SUMMEN-PRUEFUNG — sf 1.0 heisst: Sigma Sponsoren ~ Sigma Gehaelter (${SALARY_SUM_S1})`);
line();
console.log("  sf    Untergr.      k     Sigma    Meister  Rang16  Letzter   Schere  Teams im Plus");
for (const sf of [0.8, 1.0, 1.2]) {
  const fl = floorAtSf(sf), k = solveK(SALARY_SUM_S1 * sf, fl, sf);
  const perRank = Array.from({ length: 32 }, (_, i) => i + 1).map((r) =>
    SPONSOR_TYPES.reduce((acc, t) => acc + Math.max(fl, teamPayout(t, r, k, fl, sf)), 0) / SPONSOR_TYPES.length);
  const salaryAt = salaryAtRank;
  console.log(
    `  ${sf.toFixed(1)}   ${fl.toFixed(1).padStart(6)}  ${k.toFixed(3)}  ${leagueSum(k, fl, sf).toFixed(0).padStart(6)}` +
    `   ${perRank[0]!.toFixed(0).padStart(6)}  ${perRank[15]!.toFixed(0).padStart(6)}  ${perRank[31]!.toFixed(0).padStart(6)}` +
    `   ${(perRank[0]! / perRank[31]!).toFixed(2)}x   ${perRank.filter((p, i) => p > salaryAt(i + 1)).length}/32`);
}

line();
console.log("UEBERSCHUSS JE STUFE (Auszahlung minus Gehalt) — wer traegt den Verlust, wer bekommt den Gewinn?");
line();
const PROBE = [1, 4, 8, 16, 24, 32];
console.log("  sf    " + PROBE.map((r) => `R${r}`.padStart(9)).join("") + "     Spanne");
for (const sf of [0.8, 1.0, 1.2]) {
  const fl = floorAtSf(sf), k = solveK(SALARY_SUM_S1 * sf, fl, sf);
  const sur = PROBE.map((r) =>
    SPONSOR_TYPES.reduce((a, t) => a + Math.max(fl, teamPayout(t, r, k, fl, sf)), 0) / SPONSOR_TYPES.length - salaryAtRank(r));
  console.log(`  ${sf.toFixed(1)} ` + sur.map((v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`.padStart(9)).join("") +
    `   ${(Math.max(...sur) - Math.min(...sur)).toFixed(0)}`);
}

line();
console.log(`MEISTER realisiert (Titel + Klausel + Sonderziel) vs. Top-Gehalt ${SALARY_TOP}`);
line();
for (const sf of [0.8, 1.0, 1.2]) {
  const fl = floorAtSf(sf), k = solveK(SALARY_SUM_S1 * sf, fl, sf);
  const good = SPONSOR_TYPES.map((t) => fl + (rankPart(t, 3, 1, offsetFor(t.name, 3)) + t.clause.bonus + 12 - FLOOR) * k * tiltAt(1, sf));
  const bot = SPONSOR_TYPES.map((t) => Math.max(fl, fl + (rankPart(t, 30, 32, offsetFor(t.name, 30)) - t.clause.malus - FLOOR) * k * tiltAt(32, sf)));
  console.log(`  sf ${sf.toFixed(1)}: Meister ${Math.min(...good).toFixed(0)}-${Math.max(...good).toFixed(0)}` +
    `   Letzter im Schlechtfall ${Math.min(...bot).toFixed(0)}-${Math.max(...bot).toFixed(0)}` +
    `   Top-Gehalt gedeckt: ${Math.min(...good) >= SALARY_TOP ? "immer" : Math.max(...good) >= SALARY_TOP ? "teilweise" : "nie"}`);
}

// ── Katalog-Ansicht: wie fuehlt sich jede Art fuer ein starkes / mittleres / schwaches Team an? ──
// Der Fallen-Test oben garantiert bereits, dass KEINE Art fuer irgendeine Ausgangslage dominiert
// wird. Diese Tabelle zeigt, WIE sie sich unterscheiden: Sockel (schlechtester Ausgang),
// Decke (bester Ausgang) und Risiko.
line();
console.log("KATALOG — jede Art aus Sicht eines starken (#2), mittleren (#18) und schwachen (#30) Teams");
line();
console.log("  " + "Sponsorart".padEnd(18) + "│" + "  TOP #2  Sockel–Decke  σ".padEnd(28) + "│" +
  "  MITTEL #18 Sockel–Decke σ".padEnd(28) + "│  SCHWACH #30 Sockel–Decke σ");
for (const t of SPONSOR_TYPES) {
  const cells = [2, 18, 30].map((e) => {
    const c = offsetFor(t.name, e);
    // Hier BLEIBT der Korridor: die Spalte beantwortet "was erlebt ein Team realistisch?",
    // nicht "kann diese Karte dominiert werden?". Fuer die zweite Frage ist er falsch (siehe
    // ALL_RANKS oben), fuer die erste ist er genau richtig.
    const lot = lotteries(t, e, c, corridorOf(e));
    const vals = lot.flatMap((l) => l.outcomes.map((o) => o.v));
    return `${Math.min(...vals).toFixed(0)}–${Math.max(...vals).toFixed(0)}`.padStart(12) + `  σ${sdOf(t, e, c).toFixed(1)}`.padStart(8);
  });
  console.log("  " + t.name.padEnd(18) + "│" + cells.map((c) => c.padEnd(28)).join("│"));
}
console.log("\n  Sockel = schlechtester realistischer Ausgang, Decke = bester. Gleiche EV ueberall —");
console.log("  die Arten unterscheiden sich AUSSCHLIESSLICH in Risiko und Form, nie in der Hoehe.");

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// PROFIL-DOMINANZ (Auflage d des Balancing-Audits).
//
// Der Fallen-Test oben vergleicht Kurven x Klauseln BEI FESTEM Profil. Die zweite Variationsachse —
// das Verteilungsprofil — wurde nie gegeneinander geprueft. Hier laufen die fuenf Profile innerhalb
// EINER Rarity gegeneinander, mit derselben 4-Punkt-Lotterie wie oben.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
/**
 * Eigenstaendige Mini-Engine: baut die Karte fuer eine BELIEBIGE (Rarity, Profil)-Kombination,
 * kalibriert sie wie die Produktion und liefert EV, Sigma und die Lotterien.
 */
function cardOf(t: SponsorType, rarity: string, prof: Profile, expected: number) {
  const tier = tierOf(expected);
  const { ladder, special } = cardTargets(rarity, prof, tier);
  const fl = floorAt(rarity, 1.0);
  const gp = goalPayout(special, P_GOAL);
  const target = ladder + special;
  const wf = (v: number) => Math.max(fl, v);
  const corners = (final: number, cal: number) => [
    { v: wf(rankPartOf(t, prof, expected, final, cal) + t.clause.bonus + gp),  p: t.clause.p * P_GOAL },
    { v: wf(rankPartOf(t, prof, expected, final, cal) + t.clause.bonus),       p: t.clause.p * (1 - P_GOAL) },
    { v: wf(rankPartOf(t, prof, expected, final, cal) - t.clause.malus + gp),  p: (1 - t.clause.p) * P_GOAL },
    { v: wf(rankPartOf(t, prof, expected, final, cal) - t.clause.malus),       p: (1 - t.clause.p) * (1 - P_GOAL) },
  ];
  const w = distribution(expected);
  const evAt = (cal: number) => w.reduce((a, wi, i) => a + wi * corners(i + 1, cal).reduce((a2, c) => a2 + c.p * c.v, 0), 0);
  let lo = -200, hi = 200;
  for (let i = 0; i < 120; i += 1) { const m = (lo + hi) / 2; if (evAt(m) < target) lo = m; else hi = m; }
  const cal = (lo + hi) / 2;
  return { ev: evAt(cal), target, lot: ALL_RANKS.map((r) => ({ outcomes: corners(r, cal) })) };
}

function profileDominance(sponsors: SponsorType[]) {
  const out: Array<{ rarity: string; dominated: number; cells: number; spread: number; twins: number;
                     formGap: number; survMin: number; survMax: number; who: Map<string, number[]> }> = [];
  for (const rarity of RARITY_ORDER) {
    let dominated = 0, cells = 0, spread = 0, twins = 0, formGap = 0, survMin = 99, survMax = 0;
    const who = new Map<string, number[]>();
    for (const t of sponsors) {
      for (let e = 1; e <= 32; e += 1) {
        const rows = PROFILES.map((prof) => ({ name: prof.name, ...cardOf(t, rarity, prof, e) }));
        cells += rows.length;
        const evs = rows.map((r) => r.ev);
        spread = Math.max(spread, Math.max(...evs) / Math.min(...evs) - 1);
        // VAKUUM-WAECHTER: "0 Dominanz" ist wertlos, wenn die Profile IDENTISCHE Karten liefern.
        // Genau das war bei magisch der Fall (Pool 0 -> alle Profile gleich).
        for (let i = 0; i < rows.length; i += 1) for (let j = i + 1; j < rows.length; j += 1) {
          const gap = Math.max(...rows[i]!.lot.flatMap((l, k) =>
            l.outcomes.map((o, m) => Math.abs(o.v - rows[j]!.lot[k]!.outcomes[m]!.v))));
          formGap = Math.max(formGap, gap);
          if (gap < 1e-6) twins += 1;
        }
        // Wie viele Profile ueberleben eine reine ANGEBOTSREGEL (nur nicht-dominierte anbieten)?
        // Das ist die Messgroesse fuer die verworfene Alternative: sinkt sie auf 1, ist die
        // Profilachse fuer dieses Team keine Wahl mehr, sondern eine Vorschrift.
        const surviving = rows.filter((a) => !rows.some((b) => b.name !== a.name
          && a.lot.every((la, i) => fosdAtLeast(b.lot[i]!, la)) && a.lot.some((la, i) => fosdStrictly(b.lot[i]!, la)))).length;
        survMin = Math.min(survMin, surviving); survMax = Math.max(survMax, surviving);
        for (const a of rows) {
          const dom = rows.find((b) => b.name !== a.name
            && a.lot.every((la, i) => fosdAtLeast(b.lot[i]!, la)) && a.lot.some((la, i) => fosdStrictly(b.lot[i]!, la)));
          if (dom) {
            dominated += 1;
            const key = `${a.name} ≪ ${dom.name}`;
            const ranks = who.get(key) ?? [];
            if (!ranks.includes(e)) ranks.push(e);
            who.set(key, ranks);
          }
        }
      }
    }
    out.push({ rarity, dominated, cells, spread, twins, formGap, survMin, survMax, who });
  }
  return out;
}

line();
console.log("PROFIL-DOMINANZ — die fuenf Verteilungsprofile gegeneinander, innerhalb EINER Rarity");
line();
{
  const repr = SPONSOR_TYPES.filter((t) => t.name.startsWith("Linear/"));
  console.log(`  Repraesentative Sponsoren: ${repr.map((t) => t.name).join(", ")}  ·  5 Profile x 32 Erwartungsraenge`);
  let total = 0;
  for (const r of profileDominance(repr)) {
    total += r.dominated;
    console.log(`  ${r.rarity.padEnd(11)} dominierte Faelle ${String(r.dominated).padStart(4)}/${r.cells}` +
      `   EV-Spread ueber Profile ${(r.spread * 100).toFixed(1).padStart(5)} %` +
      `   Formunterschied ${r.formGap.toFixed(1).padStart(5)} C` +
      `   anbietbare Profile ${r.survMin}–${r.survMax}/${PROFILES.length}` +
      `   ${r.twins > 0 ? `⚠ ${r.twins} identische Profilpaare (Vakuum)` : r.dominated === 0 ? "✓" : "✗"}`);
    if (process.env.OLY_SPONSOR_PROFDIAG === "1") {
      for (const [k, ranks] of r.who) console.log(`      ${k}  bei Erwartungsrang ${ranks[0]}–${ranks[ranks.length - 1]} (${ranks.length})`);
    }
  }
  console.log(`\n  PROFIL-DOMINANZ INSGESAMT: ${total}${total === 0 ? "  ✓" : "  ✗"}`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// STRESSTEST — laeuft nur mit OLY_SPONSOR_STRESS=1, weil er den GESAMTEN Kombinationsraum
// kalibriert. Zweck: Fallen und Ausreisser finden, BEVOR sie als Balancing-Bug im Spiel auftauchen.
// Geprueft wird gegen die drei Annahmen, die im Modell gesetzt und nicht gemessen sind:
// Ergebnisstreuung (sigma), Klausel-Erfuellungswahrscheinlichkeit (P_MET) und die Kurven/Klausel-Paarung.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
if (process.env.OLY_SPONSOR_STRESS === "1") {
  const ALL: SponsorType[] = CURVES.flatMap((c) => CLAUSES.map((k) => compose(c.name, k.name)));
  line();
  console.log(`STRESSTEST — ${CURVES.length} Kurven x ${CLAUSES.length} Klauseln = ${ALL.length} Kombinationen`);
  line();

  /**
   * Kalibriert eine beliebige Typmenge mit derselben Methode wie die Produktion (Bisektion auf
   * TARGET_EV je Stufe, klausel-individuelles p) und prueft ueber ALLE 32 Erwartungsraenge per FOSD.
   *
   * Der frueher hier stehende Harness war unbrauchbar: er kalibrierte aufs Set-Mittel (genau der
   * behobene W1-Fehler), rechnete mit einem globalen pMet statt dem Klausel-p, und mass den Spread
   * nur an den Stuetzstellen — wo er per Konstruktion 0 ist. Seine "0.0 %" waren Definition, keine
   * Messung.
   *
   * `pShift` verschiebt das WAHRE p gegenueber dem kalibrierten (Fehlschaetzung), `sigma` die
   * Ergebnisstreuung gegenueber der Kalibrierannahme.
   */
  function analyse(types: SponsorType[], sigma: number, pShift: number) {
    const pTrue = (t: SponsorType) => Math.min(0.97, Math.max(0.03, t.clause.p + pShift));
    // Kalibrierung EXAKT wie in der Produktion: Bisektion auf das VOLLE Kartenziel, mit dem DESIGN-p.
    const cal = new Map<string, number>();
    for (const t of types) for (const e of EXPECTED) {
      const tier = tierOf(e); let lo = -200, hi = 200;
      for (let i = 0; i < 120; i += 1) { const m = (lo + hi) / 2; if (ev(t, e, m) < TARGET_CARD_EV[tier]!) lo = m; else hi = m; }
      cal.set(`${t.name}:${tier}`, (lo + hi) / 2);
    }
    const at = (t: SponsorType, e: number) => cal.get(`${t.name}:${tierOf(e)}`) ?? 0;
    let traps = 0, dead = 0, spread = 0, sdLo = Infinity, sdHi = 0;
    for (let e = 1; e <= 32; e += 1) {
      const band = ALL_RANKS;
      const rows = types.map((t) => {
        const c = at(t, e), pt = pTrue(t);
        return { name: t.name, ev: ev(t, e, c, sigma, pt), sd: sdOf(t, e, c, sigma, pt),
                 lot: lotteries(t, e, c, band, pt) };
      });
      const evs = rows.map((r) => r.ev);
      spread = Math.max(spread, Math.max(...evs) / Math.min(...evs) - 1);
      sdLo = Math.min(sdLo, ...rows.map((r) => r.sd)); sdHi = Math.max(sdHi, ...rows.map((r) => r.sd));
      traps += rows.filter((a2) => isTrap(a2, rows)).length;
      dead += rows.filter(isCollapsed).length;
    }
    return { traps, dead, spread, sdLo, sdHi };
  }

  const fmt = (r: { traps: number; dead: number; spread: number; sdLo: number; sdHi: number }) =>
    `Fallen ${String(r.traps).padStart(3)}  EV-Spread ${(r.spread * 100).toFixed(1).padStart(5)} %  sigma ${r.sdLo.toFixed(1)}–${r.sdHi.toFixed(1)}  kollabiert ${String(r.dead).padStart(4)}`;

  console.log("\n  A) Alle Kombinationen, Designannahmen");
  console.log(`     ${fmt(analyse(ALL, SIGMA, 0))}`);

  console.log(`\n  B) Ergebnisstreuung weicht von der Kalibrierannahme (sigma ${SIGMA}) ab`);
  for (const sg of [3, 4, SIGMA, 7, 9]) console.log(`     sigma ${sg}: ${fmt(analyse(ALL, sg, 0))}`);

  console.log("\n  C) Klausel-p ist fehlgeschaetzt (kalibriert mit Design-p, real verschoben)");
  for (const sh of [-0.2, -0.15, -0.1, 0, 0.1, 0.15, 0.2]) {
    console.log(`     p${sh >= 0 ? "+" : ""}${sh.toFixed(2)}: ${fmt(analyse(ALL, SIGMA, sh))}`);
  }
}

// ── Hypothese: die Fallen entstehen NUR zwischen Kombinationen mit DERSELBEN Kurve ───────────────
// Begruendung: bei EV-Gleichheit ist die schmalere Spannweite unten besser und oben schlechter —
// also nicht dominiert. Sobald die Untergrenze den unteren Teil abschneidet, faellt dieser Vorteil
// weg und es bleibt nur der Nachteil oben. Das trifft aber nur Paare mit gleicher Kurvenform;
// unterschiedliche Kurven kreuzen sich ueber den Rang und koennen sich nicht dominieren.
if (process.env.OLY_SPONSOR_SLATE === "1") {
  const oneEach = CURVES.map((c) => SPONSOR_TYPES.find((t) => t.name.startsWith(`${c.name}/`))).filter(Boolean) as SponsorType[];
  let traps = 0;
  for (let e = 1; e <= 32; e += 1) {
    const band = ALL_RANKS;
    const rows = oneEach.map((t) => {
      const c = offsetFor(t.name, e);
      return { name: t.name, lot: lotteries(t, e, c, band) };
    });
    traps += rows.filter((a) => isTrap(a, rows)).length;
  }
  console.log(`\n  SLATE-TEST (je Kurve nur EINE Kombination, ${oneEach.length} Angebote, alle 32 Erwartungsränge): Fallen ${traps}${traps === 0 ? " ✓" : " ✗"}`);
  console.log(`    Angebote: ${oneEach.map((t) => t.name).join(", ")}`);
}

// Welche Paare sind es konkret? (FOSD, alle 120 Kombinationen, alle 32 Erwartungsränge)
if (process.env.OLY_SPONSOR_TRAPS === "1") {
  const ALL2: SponsorType[] = CURVES.flatMap((c) => CLAUSES.map((k) => compose(c.name, k.name)));
  const cal2 = new Map<string, number>();
  for (const t of ALL2) for (const e of EXPECTED) {
    const tier = tierOf(e); let lo = -200, hi = 200;
    for (let i = 0; i < 120; i += 1) { const m = (lo + hi) / 2; if (ev(t, e, m) < TARGET_CARD_EV[tier]!) lo = m; else hi = m; }
    cal2.set(`${t.name}:${tier}`, (lo + hi) / 2);
  }
  const found = new Map<string, number[]>();
  for (let e = 1; e <= 32; e += 1) {
    const band = ALL_RANKS;
    const rows = ALL2.map((t) => ({ name: t.name, lot: lotteries(t, e, cal2.get(`${t.name}:${tierOf(e)}`) ?? 0, band) }));
    for (const a of rows) {
      const dom = rows.find((b) => b.name !== a.name
        && a.lot.every((la, i) => fosdAtLeast(b.lot[i]!, la)) && a.lot.some((la, i) => fosdStrictly(b.lot[i]!, la)));
      if (dom) {
        const key = `${a.name}  ≪  ${dom.name}`;
        found.set(key, [...(found.get(key) ?? []), e]);
      }
    }
  }
  console.log(`\n  ECHTE FALLEN (FOSD): ${found.size} Paare`);
  for (const [k, ranks] of found) {
    const sameCurve = k.split("  ≪  ")[0]!.split("/")[0] === k.split("  ≪  ")[1]!.split("/")[0];
    console.log(`    ${k}   bei Erwartungsrang ${ranks.join(",")}   ${sameCurve ? "[gleiche Kurve]" : "[VERSCHIEDENE Kurven]"}`);
  }
}

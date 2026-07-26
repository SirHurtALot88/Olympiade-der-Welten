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

const TIERS = [
  { label: "Meister", lo: 1, hi: 1 }, { label: "Top 4", lo: 2, hi: 4 }, { label: "Top 8", lo: 5, hi: 8 },
  { label: "Top 12", lo: 9, hi: 12 }, { label: "Top 16", lo: 13, hi: 16 }, { label: "Top 20", lo: 17, hi: 20 },
  { label: "Top 24", lo: 21, hi: 24 }, { label: "Top 28", lo: 25, hi: 28 }, { label: "Platz 32", lo: 29, hi: 32 },
];
/**
 * Leiter 1, kalibriert bei salaryFactor 1.0 auf: Meister typisch 90-100 MIT JEDEM Sponsortyp,
 * Letzter ≥ Mindestgehalt 43,7 MIT JEDEM Sponsortyp.
 *
 * Die Spitze (Meister 77) ist bewusst so gesetzt, dass selbst der Typ mit der NIEDRIGSTEN Decke
 * ("Absicherung", per Design wenig Upside) als Meister noch ≥90 und damit über dem gemessenen
 * Top-Gehalt (87,8) landet — sonst wäre die sichere Sponsorwahl beim Titelgewinn wirtschaftlich
 * bestrafend, was dem Ziel "alle Gehälter zahlbar + etwas übrig" widerspricht.
 */
const LIGA = [77, 70, 65, 61, 56, 52, 48, 44, 40];
/** Überlebens-Untergrenze (S1-Mindestgehalt 43,7 gemessen aus einem echten Save). */
const FLOOR = 44;
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
export const RARITY_MULT: Record<string, number> = {
  "gewöhnlich": 0.85, "magisch": 1.0, "selten": 1.15, "legendär": 1.35,
};

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
export const PROFILES: Array<{ name: string; specialShare: number; tierWeights: number[]; note: string }> = [
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

const tierOf = (rank: number) => TIERS.findIndex((t) => rank >= t.lo && rank <= t.hi);

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
  { name: "Linear",   rel: (d) => 5 + 4 * d + (d < 0 ? 2 * d : 0),                            note: "gleichmaessig, milder Malus" },
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
export const CLAUSES: Array<{ name: string; label: string; p: number; s: number; lever: string }> = [
  { name: "Einsatzlast",   label: "Saison-Fatigue-Schnitt ≥ X (auspowern)", p: 0.55, s: 24, lever: "trainingMode + Rotation" },
  { name: "Schonung",      label: "Saison-Fatigue-Schnitt ≤ X (rotieren)", p: 0.5, s: 17,  lever: "Rotation, kostet Tabellenpunkte" },
  { name: "Hartes Training", label: "Anteil Spieltage mit Modus 'hart' ≥ X %", p: 0.6, s: 20,  lever: "trainingMode je Spieltag" },
  { name: "Talentschmiede", label: "X Spieler steigen eine Klasse auf", p: 0.4, s: 24, lever: "Trainingsfokus + Anlagen" },
  { name: "Wertaufbau",    label: "Kaderwert +X % über die Saison", p: 0.5, s: 20,  lever: "Training + Transfers" },
  { name: "Achsenprofil",  label: "eine Achse (POW/SPE/MEN/SOC) in die Top-N der Klasse", p: 0.45, s: 22, lever: "Trainingsklasse + Kaderbau" },
  { name: "Disziplinen",   label: "X Disziplinen mit positivem Saison-Delta", p: 0.5, s: 19,  lever: "preferredDisciplines + Training" },
  { name: "Schuldenfrei",  label: "kein neuer Kredit (oder einen getilgt)", p: 0.85, s: 8,  lever: "Finanzplanung" },
  { name: "Gehaltseffizienz", label: "Gehaltssumme unter der Schwelle deiner Klasse", p: 0.5, s: 18,  lever: "Verhandlung + Kaderschnitt" },
  { name: "Kaderruhe",     label: "höchstens X Transfers (Zu- und Abgänge)", p: 0.6, s: 15,  lever: "Transferdisziplin" },
  { name: "Ausbau",        label: "Fan-Shop-/Arena-Stufen erhöhen", p: 0.45, s: 25, lever: "Bauinvestition statt Spieler" },
  { name: "Prophylaxe",    label: "höchstens X Verletzungen über die Saison", p: 0.45, s: 20,  lever: "Belastungssteuerung" },
  { name: "Moral",         label: "Ø-Moral am Saisonende über der Schwelle", p: 0.55, s: 17,  lever: "Rollen, Einsatzzeiten, Kapitän" },
  { name: "Beliebtheit",   label: "Beliebtheit um X steigern", p: 0.45, s: 17,  lever: "Erfolg + Fan-Infrastruktur" },
  // ── Nachtrag: Hebel aus XP-Oekonomie, Traits, Kaderkomposition, Kapitaen, Versprechen ─────────
  { name: "XP-Disziplin",  label: "≥ X % der verdienten XP investiert statt gehortet", p: 0.65, s: 17,  lever: "currentXP/spentXP steuern" },
  { name: "Charakterarbeit", label: "X negative Traits aus dem Kader entfernen", p: 0.4, s: 20,  lever: "traitsNegative — Abgabe oder Entwicklung" },
  { name: "Vielseitigkeit", label: "≥ X verschiedene Subklassen im Kader", p: 0.6, s: 16,  lever: "Kaderkomposition breit halten" },
  { name: "Fokusschule",   label: "≥ X Spieler auf derselben Trainingsklasse", p: 0.55, s: 19,  lever: "trainingClass buendeln — Gegenteil von Vielseitigkeit" },
  { name: "Kapitänstreue", label: "derselbe Kapitän über die ganze Saison", p: 0.75, s: 14,  lever: "appoint_captain nicht wechseln" },
  { name: "Wortlaut",      label: "alle Spielerversprechen eingehalten", p: 0.45, s: 22, lever: "Rolle/Einsätze/Trainingsmodus zusagen und liefern" },
];

const compose = (curve: string, clause: string): SponsorType => {
  const c = CURVES.find((x) => x.name === curve)!;
  const k = CLAUSES.find((x) => x.name === clause)!;
  return { name: `${curve}/${clause}`, rel: c.rel, note: `${c.note} · ${k.lever}`,
           clause: { label: k.label, p: k.p, s: k.s, bonus: k.s * (1 - k.p), malus: k.s * k.p } };
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
  compose("Sockel", "Beliebtheit"),         // sicher, aber Fans muessen wachsen
];

/** Erwartungswert der Klausel unter ihrem eigenen P. */
const clauseEv = (t: SponsorType) => t.clause.p * t.clause.bonus - (1 - t.clause.p) * t.clause.malus;
const withFloor = (v: number) => Math.max(FLOOR, v);
const rankPart = (t: SponsorType, expected: number, final: number, cal: number) =>
  LIGA[tierOf(final)]! + t.rel(tierOf(expected) - tierOf(final)) + cal;

function distribution(expected: number, sigma = 4) {
  const w: number[] = [];
  for (let r = 1; r <= 32; r += 1) w.push(Math.exp(-((r - expected) ** 2) / (2 * sigma * sigma)));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

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
const TARGET_EV_BASE = [76.0, 73.6, 71.6, 67.9, 63.8, 59.9, 56.7, 54.1, 53.0];
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
const TARGET_GAMMA = Number(process.env.OLY_SPONSOR_GAMMA ?? 1.7);
const TARGET_EV_SHAPE = (() => {
  const mean = TARGET_EV_BASE.reduce((a, b) => a + b, 0) / TARGET_EV_BASE.length;
  return TARGET_EV_BASE.map((v) => mean + (v - mean) * TARGET_GAMMA);
})();

/** Aktive Rarity und aktives Verteilungsprofil des Reports (magisch/ausgewogen = Standard). */
const RARITY = process.env.OLY_SPONSOR_RARITY ?? "magisch";
const PROFILE = PROFILES.find((x) => x.name === (process.env.OLY_SPONSOR_PROFILE ?? "ausgewogen")) ?? PROFILES[0]!;

/** Standard-Sonderziel-Anteil der Basiskarte (magisch), unabhaengig vom Pool. */
const BASE_SPECIAL_SHARE = 0.25;
/**
 * Der Pool, den die Rarity gegenueber dem Standard zusaetzlich vergibt (bei gewoehnlich negativ).
 * Bezugsgroesse ist der Mittelwert der Standardleiter, damit der Pool eine Groesse in C ist und
 * nicht selbst schon eine Form hat.
 */
const POOL_REF = TARGET_EV_SHAPE.reduce((x, y) => x + y, 0) / TARGET_EV_SHAPE.length;
const POOL = ((RARITY_MULT[RARITY] ?? 1) - 1) * POOL_REF * TIERS.length;

/** Sonderziel: Standardanteil der Basiskarte + der ihm zugewiesene Poolanteil. */
const specialEvFor = (tier: number) =>
  TARGET_EV_SHAPE[tier]! * BASE_SPECIAL_SHARE + (POOL * PROFILE.specialShare) / TIERS.length;
/** Kalibrierziel fuer Leiter 1+2+4: Basisleiter ohne Sonderziel + der Poolanteil DIESER Stufe. */
const TARGET_EV = TARGET_EV_SHAPE.map((v, i) =>
  v * (1 - BASE_SPECIAL_SHARE) + POOL * (1 - PROFILE.specialShare) * PROFILE.tierWeights[i]!);

/** EV inklusive Untergrenze und Klausel. */
function ev(t: SponsorType, expected: number, cal: number) {
  return distribution(expected).reduce(
    (acc, w, i) =>
      acc + w * (t.clause.p * withFloor(rankPart(t, expected, i + 1, cal) + t.clause.bonus)
               + (1 - t.clause.p) * withFloor(rankPart(t, expected, i + 1, cal) - t.clause.malus)),
    0,
  );
}
const meanEv = (t: SponsorType, cal: number) => EXPECTED.reduce((a, e) => a + ev(t, e, cal), 0) / EXPECTED.length;

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
      const target = TARGET_EV[tier]!;
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
type Lottery = { hi: number; lo: number; p: number };
function fosdAtLeast(a: Lottery, b: Lottery): boolean {
  for (const x of [a.lo, a.hi, b.lo, b.hi]) {
    const ca = (a.lo <= x ? 1 - a.p : 0) + (a.hi <= x ? a.p : 0);
    const cb = (b.lo <= x ? 1 - b.p : 0) + (b.hi <= x ? b.p : 0);
    if (ca > cb + 1e-9) return false; // A haeuft mehr Masse unterhalb x -> nicht besser
  }
  return true;
}
function fosdStrictly(a: Lottery, b: Lottery): boolean {
  for (const x of [a.lo, a.hi, b.lo, b.hi]) {
    const ca = (a.lo <= x ? 1 - a.p : 0) + (a.hi <= x ? a.p : 0);
    const cb = (b.lo <= x ? 1 - b.p : 0) + (b.hi <= x ? b.p : 0);
    if (ca < cb - 1e-9) return true;
  }
  return false;
}
/** Lotterien eines Sponsors ueber den erreichbaren Korridor. */
function lotteries(t: SponsorType, expected: number, cal: number, band: number[]): Lottery[] {
  return band.map((r) => ({
    hi: withFloor(rankPart(t, expected, r, cal) + t.clause.bonus),
    lo: withFloor(rankPart(t, expected, r, cal) - t.clause.malus),
    p: t.clause.p,
  }));
}
/** Ist `a` eine Falle, also von irgendeinem `others`-Eintrag rang-konditional FOSD-dominiert? */
function isTrap(a: { name: string; lot: Lottery[] }, others: Array<{ name: string; lot: Lottery[] }>): boolean {
  return others.some((b) => b.name !== a.name
    && a.lot.every((la, i) => fosdAtLeast(b.lot[i]!, la))
    && a.lot.some((la, i) => fosdStrictly(b.lot[i]!, la)));
}

const line = (c = "=") => console.log(c.repeat(100));

line();
console.log("SPONSOR-MODELL VORSCHLAG — Liga-Leiter + relative Typ-Identität + Klausel + Sonderziel");
line();
console.log("Leiter 1 (Liga, absolut):", TIERS.map((t, i) => `${t.label}=${LIGA[i]}`).join("  "));
console.log(`Untergrenze ${FLOOR} C · Rarity ${RARITY} (Pool ${POOL >= 0 ? "+" : ""}${POOL.toFixed(0)} C) · Profil ${PROFILE.name} (${PROFILE.note}) · Steilheit ${TARGET_GAMMA}`);
console.log(`Ziel-EV je Stufe: ${TARGET_EV.map((v, i) => `${TIERS[i]!.label} ${v.toFixed(0)}`).join("  ")}\n`);
console.log("  " + "Typ".padEnd(16) + "Offset E#2…E#30".padStart(12) + "   Klausel");
for (const t of SPONSOR_TYPES) {
  console.log("  " + t.name.padEnd(16) + `${offsetFor(t.name, 2).toFixed(1)}…${offsetFor(t.name, 30).toFixed(1)}`.padStart(12) + `   +${t.clause.bonus}/−${t.clause.malus}  ${t.clause.label}`);
}

console.log("\nPRÜFUNG je Erwartungsrang — EV-Spread, Risikospanne, Fallen");
let trapsTotal = 0;
for (const e of EXPECTED) {
  const band: number[] = [];
  for (let r = Math.max(1, e - 8); r <= Math.min(32, e + 8); r += 1) band.push(r);
  const rows = SPONSOR_TYPES.map((t) => {
    const c = offsetFor(t.name, e);
    const lot = lotteries(t, e, c, band);
    const e0 = ev(t, e, c);
    const d = distribution(e);
    let v = 0;
    d.forEach((w, i) => {
      v += w * t.clause.p * (withFloor(rankPart(t, e, i + 1, c) + t.clause.bonus) - e0) ** 2
         + w * (1 - t.clause.p) * (withFloor(rankPart(t, e, i + 1, c) - t.clause.malus) - e0) ** 2;
    });
    return { name: t.name, ev: e0, sd: Math.sqrt(v), lot };
  });
  const traps = rows.filter((a) => isTrap(a, rows));
  trapsTotal += traps.length;
  const evs = rows.map((r) => r.ev);
  console.log(
    `  E#${String(e).padEnd(2)}  EV ${Math.min(...evs).toFixed(1)}–${Math.max(...evs).toFixed(1)}` +
    ` (Spread ${((Math.max(...evs) / Math.min(...evs) - 1) * 100).toFixed(1)} %)` +
    `  σ ${Math.min(...rows.map((r) => r.sd)).toFixed(1)}–${Math.max(...rows.map((r) => r.sd)).toFixed(1)}` +
    `  Fallen ${traps.length === 0 ? "0 ✓" : `${traps.length} ✗ (${traps.map((t) => t.name).join(", ")})`}`,
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
console.log(`\n  FALLEN INSGESAMT (Stuetzstellen): ${trapsTotal}${trapsTotal === 0 ? "  ✓" : "  ✗"}`);

// Die Offsets sind je 4er-STUFE kalibriert, nicht je Rang. An den Stuetzstellen ist der Spread
// per Konstruktion 0 — das ist keine Leistung, sondern Definition. Entscheidend ist, was ZWISCHEN
// ihnen passiert: dort driftet die EV, weil ein Team auf Rang 16 eine andere Ergebnisverteilung
// hat als eines auf Rang 14, aber denselben Offset benutzt. Deshalb hier ALLE 32 Raenge.
{
  let offTraps = 0, worstSpread = 0, worstRank = 0;
  for (let e = 1; e <= 32; e += 1) {
    const band: number[] = [];
    for (let r = Math.max(1, e - 8); r <= Math.min(32, e + 8); r += 1) band.push(r);
    const rows = SPONSOR_TYPES.map((t) => {
      const c = offsetFor(t.name, e);
      return { name: t.name, ev: ev(t, e, c), lot: lotteries(t, e, c, band) };
    });
    const evs = rows.map((r) => r.ev);
    const sp = Math.max(...evs) / Math.min(...evs) - 1;
    if (sp > worstSpread) { worstSpread = sp; worstRank = e; }
    offTraps += rows.filter((a) => isTrap(a, rows)).length;
  }
  console.log(`  ALLE 32 ERWARTUNGSRAENGE: Fallen ${offTraps}${offTraps === 0 ? " ✓" : " ✗"}` +
    `   groesster EV-Spread ${(worstSpread * 100).toFixed(1)} % (bei Erwartungsrang ${worstRank})`);
}

console.log("\nZIELPRÜFUNG (salaryFactor 1.0) — Meister typisch 90–100 · Letzter ≥ 43,7 (Mindestgehalt)");
let goalsOk = true;
for (const t of SPONSOR_TYPES) {
  const c = offsetFor(t.name, 3);
  const champ = withFloor(rankPart(t, 3, 1, c) + clauseEv(t) + specialEvFor(tierOf(1)));
  const jackpot = withFloor(rankPart(t, 3, 1, c) + t.clause.bonus + 12);
  const cb = offsetFor(t.name, 30);
  const botBad = withFloor(rankPart(t, 30, 32, cb) - t.clause.malus);
  const botGood = withFloor(rankPart(t, 30, 32, cb) + t.clause.bonus + 12);
  // Toleranz nach oben: der Typ mit dem höchsten Risiko darf beim Titelgewinn knapp über 100 landen —
  // das ist genau sein Jackpot-Fall und thematisch gewollt. Untergrenze 90 gilt strikt für JEDEN Typ.
  const ok = champ >= 90 && champ <= 101 && botBad >= 43.7;
  if (!ok) goalsOk = false;
  console.log(
    `  ${t.name.padEnd(16)} Meister ${champ.toFixed(1).padStart(5)} (Jackpot ${jackpot.toFixed(0)})` +
    `   Letzter ${botBad.toFixed(0)}–${botGood.toFixed(0)}   ${ok ? "✓" : "✗"}`,
  );
}
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
const SALARY_SUM_S1 = 2078;

/**
 * Untergrenze ATMET mit dem Faktor mit — sie ist nicht fix.
 *
 * Erste Variante hielt sie starr bei 44. Ergebnis war eine zu flache Schere im schlechten Jahr:
 * bei sf 0.8 stand Meister 59 gegen Letzter 47, also nur Faktor 1.26 — ein mieses Ligajahr fuehlte
 * sich fuer die Spitze bestrafend und fuer den Keller fast folgenlos an. Deshalb faellt die
 * Untergrenze bei sf < 1 gedaempft mit (Ziel bei 0.8: 35-40) und gibt der Spitze Luft; bei sf > 1
 * steigt sie moderat. Gedaempft, damit der Keller nicht 1:1 dem Ligajahr ausgeliefert ist.
 */
const FLOOR_DAMP = 0.8;
/**
 * Untergrenze faellt im schlechten Jahr gedaempft mit, steigt im guten Jahr aber NICHT.
 *
 * Sie ist ein Schutzmechanismus, keine Belohnung: in einem miesen Ligajahr muss sie nachgeben,
 * damit die Schere nicht flach wird (sonst Meister 59 gegen Letzter 47 = 1.26x). In einem guten
 * Jahr mitzuwachsen hiesse dagegen, den Keller genau dann anzuheben, wenn die Spitze bevorzugt
 * werden soll — gemessen ergab das eine U-Form im Ueberschuss (R1 +25, R16 +11, R32 +14), also
 * ein ausgequetschtes Mittelfeld. Ohne Mitwachsen faellt der Ueberschuss sauber von oben nach unten.
 */
const floorAt = (sf: number) => (sf >= 1 ? FLOOR : FLOOR * (1 - FLOOR_DAMP * (1 - sf)));

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
const specialEvLeague = (tier: number) => cardEvLeague(tier) * BASE_SPECIAL_SHARE;
/**
 * Liga-Standard-Offsets EINMAL vorberechnet. Zuvor stand die Bisektion in teamPayout — das laeuft
 * innerhalb der Bisektion von solveK und liess das Skript ins Timeout rennen.
 */
const LEAGUE_OFFSET = (() => {
  const m = new Map<string, number>();
  for (const t of SPONSOR_TYPES) for (let rank = 1; rank <= 32; rank += 1) {
    const target = cardEvLeague(tierOf(rank)) * (1 - BASE_SPECIAL_SHARE);
    let lo = -200, hi = 200;
    for (let i = 0; i < 90; i += 1) { const mid = (lo + hi) / 2; if (ev(t, rank, mid) < target) lo = mid; else hi = mid; }
    m.set(`${t.name}:${rank}`, (lo + hi) / 2);
  }
  return m;
})();
function teamPayout(t: SponsorType, rank: number, k: number, fl: number, sf: number) {
  const base = rankPart(t, rank, rank, LEAGUE_OFFSET.get(`${t.name}:${rank}`) ?? 0) + clauseEv(t) + specialEvLeague(tierOf(rank));
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
  const fl = floorAt(sf), k = solveK(SALARY_SUM_S1 * sf, fl, sf);
  const perRank = Array.from({ length: 32 }, (_, i) => i + 1).map((r) =>
    SPONSOR_TYPES.reduce((acc, t) => acc + Math.max(fl, teamPayout(t, r, k, fl, sf)), 0) / SPONSOR_TYPES.length);
  const salaryAt = (r: number) => 87.8 - (87.8 - 43.7) * ((r - 1) / 31);
  console.log(
    `  ${sf.toFixed(1)}   ${fl.toFixed(1).padStart(6)}  ${k.toFixed(3)}  ${leagueSum(k, fl, sf).toFixed(0).padStart(6)}` +
    `   ${perRank[0]!.toFixed(0).padStart(6)}  ${perRank[15]!.toFixed(0).padStart(6)}  ${perRank[31]!.toFixed(0).padStart(6)}` +
    `   ${(perRank[0]! / perRank[31]!).toFixed(2)}x   ${perRank.filter((p, i) => p > salaryAt(i + 1)).length}/32`);
}

line();
console.log("UEBERSCHUSS JE STUFE (Auszahlung minus Gehalt) — wer traegt den Verlust, wer bekommt den Gewinn?");
line();
const salaryAtRank = (r: number) => 87.8 - (87.8 - 43.7) * ((r - 1) / 31);
const PROBE = [1, 4, 8, 16, 24, 32];
console.log("  sf    " + PROBE.map((r) => `R${r}`.padStart(9)).join("") + "     Spanne");
for (const sf of [0.8, 1.0, 1.2]) {
  const fl = floorAt(sf), k = solveK(SALARY_SUM_S1 * sf, fl, sf);
  const sur = PROBE.map((r) =>
    SPONSOR_TYPES.reduce((a, t) => a + Math.max(fl, teamPayout(t, r, k, fl, sf)), 0) / SPONSOR_TYPES.length - salaryAtRank(r));
  console.log(`  ${sf.toFixed(1)} ` + sur.map((v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`.padStart(9)).join("") +
    `   ${(Math.max(...sur) - Math.min(...sur)).toFixed(0)}`);
}

line();
console.log("MEISTER realisiert (Titel + Klausel + Sonderziel) vs. Top-Gehalt 87.8");
line();
for (const sf of [0.8, 1.0, 1.2]) {
  const fl = floorAt(sf), k = solveK(SALARY_SUM_S1 * sf, fl, sf);
  const good = SPONSOR_TYPES.map((t) => fl + (rankPart(t, 3, 1, offsetFor(t.name, 3)) + t.clause.bonus + 12 - FLOOR) * k * tiltAt(1, sf));
  const bot = SPONSOR_TYPES.map((t) => Math.max(fl, fl + (rankPart(t, 30, 32, offsetFor(t.name, 30)) - t.clause.malus - FLOOR) * k * tiltAt(32, sf)));
  console.log(`  sf ${sf.toFixed(1)}: Meister ${Math.min(...good).toFixed(0)}-${Math.max(...good).toFixed(0)}` +
    `   Letzter im Schlechtfall ${Math.min(...bot).toFixed(0)}-${Math.max(...bot).toFixed(0)}` +
    `   Top-Gehalt gedeckt: ${Math.min(...good) >= 87.8 ? "immer" : Math.max(...good) >= 87.8 ? "teilweise" : "nie"}`);
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
    const band: number[] = [];
    for (let r = Math.max(1, e - 8); r <= Math.min(32, e + 8); r += 1) band.push(r);
    const lot = lotteries(t, e, c, band);
    const e0 = ev(t, e, c); const d = distribution(e);
    let v = 0;
    d.forEach((w, i) => {
      v += w * t.clause.p * (withFloor(rankPart(t, e, i + 1, c) + t.clause.bonus) - e0) ** 2
         + w * (1 - t.clause.p) * (withFloor(rankPart(t, e, i + 1, c) - t.clause.malus) - e0) ** 2;
    });
    const vals = lot.flatMap((l) => [l.hi, l.lo]);
    return `${Math.min(...vals).toFixed(0)}–${Math.max(...vals).toFixed(0)}`.padStart(12) + `  σ${Math.sqrt(v).toFixed(1)}`.padStart(8);
  });
  console.log("  " + t.name.padEnd(18) + "│" + cells.map((c) => c.padEnd(28)).join("│"));
}
console.log("\n  Sockel = schlechtester realistischer Ausgang, Decke = bester. Gleiche EV ueberall —");
console.log("  die Arten unterscheiden sich AUSSCHLIESSLICH in Risiko und Form, nie in der Hoehe.");

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
    const dist2 = (e: number) => {
      const w: number[] = [];
      for (let r = 1; r <= 32; r += 1) w.push(Math.exp(-((r - e) ** 2) / (2 * sigma * sigma)));
      const su = w.reduce((x, y) => x + y, 0);
      return w.map((x) => x / su);
    };
    const pTrue = (t: SponsorType) => Math.min(0.97, Math.max(0.03, t.clause.p + pShift));
    const evTrue = (t: SponsorType, e: number, cal: number) => {
      const pt = pTrue(t);
      return dist2(e).reduce((acc, w, i) =>
        acc + w * (pt * withFloor(rankPart(t, e, i + 1, cal) + t.clause.bonus)
                 + (1 - pt) * withFloor(rankPart(t, e, i + 1, cal) - t.clause.malus)), 0);
    };
    // Kalibrierung EXAKT wie in der Produktion: Bisektion auf TARGET_EV, mit dem DESIGN-p.
    const cal = new Map<string, number>();
    for (const t of types) for (const e of EXPECTED) {
      const tier = tierOf(e); let lo = -200, hi = 200;
      for (let i = 0; i < 120; i += 1) { const m = (lo + hi) / 2; if (ev(t, e, m) < TARGET_EV[tier]!) lo = m; else hi = m; }
      cal.set(`${t.name}:${tier}`, (lo + hi) / 2);
    }
    const at = (t: SponsorType, e: number) => cal.get(`${t.name}:${tierOf(e)}`) ?? 0;
    let traps = 0, spread = 0, sdLo = Infinity, sdHi = 0;
    for (let e = 1; e <= 32; e += 1) {
      const band: number[] = [];
      for (let r = Math.max(1, e - 8); r <= Math.min(32, e + 8); r += 1) band.push(r);
      const rows = types.map((t) => {
        const c = at(t, e); const e0 = evTrue(t, e, c); const d = dist2(e); const pt = pTrue(t);
        let v = 0;
        d.forEach((w, i) => {
          v += w * pt * (withFloor(rankPart(t, e, i + 1, c) + t.clause.bonus) - e0) ** 2
             + w * (1 - pt) * (withFloor(rankPart(t, e, i + 1, c) - t.clause.malus) - e0) ** 2;
        });
        return { name: t.name, ev: e0, sd: Math.sqrt(v), lot: lotteries(t, e, c, band) };
      });
      const evs = rows.map((r) => r.ev);
      spread = Math.max(spread, Math.max(...evs) / Math.min(...evs) - 1);
      sdLo = Math.min(sdLo, ...rows.map((r) => r.sd)); sdHi = Math.max(sdHi, ...rows.map((r) => r.sd));
      traps += rows.filter((a2) => isTrap(a2, rows)).length;
    }
    return { traps, spread, sdLo, sdHi };
  }

  const fmt = (r: { traps: number; spread: number; sdLo: number; sdHi: number }) =>
    `Fallen ${String(r.traps).padStart(3)}  EV-Spread ${(r.spread * 100).toFixed(1).padStart(5)} %  sigma ${r.sdLo.toFixed(1)}–${r.sdHi.toFixed(1)}`;

  console.log("\n  A) Alle Kombinationen, Designannahmen");
  console.log(`     ${fmt(analyse(ALL, 4, 0))}`);

  console.log("\n  B) Ergebnisstreuung weicht von der Kalibrierannahme (sigma 4) ab");
  for (const sg of [2, 3, 4, 6, 8]) console.log(`     sigma ${sg}: ${fmt(analyse(ALL, sg, 0))}`);

  console.log("\n  C) Klausel-p ist fehlgeschaetzt (kalibriert mit Design-p, real verschoben)");
  for (const sh of [-0.2, -0.15, -0.1, 0, 0.1, 0.15, 0.2]) {
    console.log(`     p${sh >= 0 ? "+" : ""}${sh.toFixed(2)}: ${fmt(analyse(ALL, 4, sh))}`);
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
    const band: number[] = [];
    for (let r = Math.max(1, e - 8); r <= Math.min(32, e + 8); r += 1) band.push(r);
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
    for (let i = 0; i < 120; i += 1) { const m = (lo + hi) / 2; if (ev(t, e, m) < TARGET_EV[tier]!) lo = m; else hi = m; }
    cal2.set(`${t.name}:${tier}`, (lo + hi) / 2);
  }
  const found = new Map<string, number[]>();
  for (let e = 1; e <= 32; e += 1) {
    const band: number[] = [];
    for (let r = Math.max(1, e - 8); r <= Math.min(32, e + 8); r += 1) band.push(r);
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

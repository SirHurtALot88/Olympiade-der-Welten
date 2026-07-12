export type GameEncyclopediaEntry = {
  id: string;
  term: string;
  aliases: string[];
  category: "Kennzahl" | "Spieltag" | "Kader" | "Training" | "Finanzen" | "System";
  short: string;
  meaning: string;
  factors: string[];
  usage: string;
  caveat?: string;
};

export const GAME_ENCYCLOPEDIA_ENTRIES: GameEncyclopediaEntry[] = [
  {
    id: "ovr",
    term: "OVR",
    aliases: ["overall", "gesamtstaerke", "gesamtstärke", "rating"],
    category: "Kennzahl",
    short: "Gesamtstärke als schneller Vergleichswert.",
    meaning:
      "OVR fasst den aktuellen Spielerwert kompakt zusammen. Es ist gut zum Scannen, aber nicht automatisch der beste Spieltagswert.",
    factors: [
      "Kernwerte und Attributprofil",
      "Disziplinprofil und Breite des Spielers",
      "gespeicherte Saisonleistung wie PPs und MVS, sobald vorhanden",
      "Normalisierung gegen den aktuellen Spielerpool",
    ],
    usage: "Nutze OVR zum schnellen Vorsortieren. Für Lineups sind Disziplinwert, Slotrolle, Fatigue, Form und Mutatoren wichtiger.",
    caveat: "Ein hoher OVR-Spieler kann in der falschen Disziplin schlechter sein als ein Spezialist mit niedrigerem OVR.",
  },
  {
    id: "pps",
    term: "PPs",
    aliases: ["pps", "player points", "season points", "punkte beitrag", "punktebeitrag"],
    category: "Kennzahl",
    short: "Echter Punktebeitrag aus gespielten Wettbewerben.",
    meaning:
      "PPs zeigen, wie viel ein Spieler oder Team in echten Spieltagswertungen beigetragen hat. Das ist rückblickend aussagekräftiger als reine Vorschauwerte.",
    factors: [
      "Platzierung in D1 und D2",
      "gespeicherte Matchday-Ergebnisse",
      "Score nach Slots, Rollen, Form, Push, Captain, Powers und Mutatoren",
      "Rank-to-Points-Logik der Disziplin",
    ],
    usage: "Nutze PPs, um echte Leistung und Saisonimpact zu lesen. Besonders stark für Season Review, Training und Vertragsfragen.",
    caveat: "PPs hängen auch davon ab, wie oft und wo ein Spieler eingesetzt wurde.",
  },
  {
    id: "mvs",
    term: "MVS",
    aliases: ["matchday value score", "value score", "matchday value"],
    category: "Kennzahl",
    short: "Matchday Value Score für praktischen Spieltagsnutzen.",
    meaning:
      "MVS bewertet, wie nützlich ein Spieler im Saison- und Spieltagskontext war. Er schaut nicht nur auf reine Stärke, sondern auf verwertbaren Impact.",
    factors: [
      "Disziplin-Rankpunkte und starke Einsätze",
      "Clutch-Disziplinen und Top-Platzierungen",
      "Vielseitigkeit über mehrere Disziplinen",
      "Anzahl und Qualität der Einsätze",
    ],
    usage: "Nutze MVS für Value-Fragen: Wer hilft wirklich, wer sieht nur auf dem Papier gut aus, wer ist sein Gehalt wert?",
    caveat: "MVS braucht gespeicherte Saisonleistung. Bei neuen Free Agents ist er bewusst oft nicht sichtbar.",
  },
  {
    id: "mw",
    term: "MW",
    aliases: ["marktwert", "market value", "wert"],
    category: "Finanzen",
    short: "Wirtschaftlicher Spielerwert für Kaufen, Verkaufen und Kaderwert.",
    meaning:
      "MW ist die grobe Marktwert-Sicht. Er verbindet sportliche Qualität mit Alterung des Saves, Leistung, Nachfrage und wirtschaftlichem Kontext.",
    factors: ["OVR und Leistungsprofil", "MVS/PPs, wenn belegt", "Rolle, Bedarf und Roster-Kontext", "Vertrags- und Gehaltsdruck"],
    usage: "Nutze MW für Deal-Gefühl und Verkaufspotenzial. Vergleiche ihn immer mit Gehalt und Bedarf.",
    caveat: "MW ist keine Kaufempfehlung. Ein billiger Spieler mit perfektem Slotfit kann wertvoller sein.",
  },
  {
    id: "value",
    term: "Value",
    aliases: ["preis leistung", "preis/leistung", "ratio", "pps pro gehalt"],
    category: "Finanzen",
    short: "Sportlicher Nutzen im Verhältnis zu Kosten.",
    meaning:
      "Value beantwortet die Managerfrage: Bekomme ich für Gehalt, Cash oder Slotverbrauch genug Wirkung zurück?",
    factors: ["PPs und MVS", "Gehalt und Marktwert", "Kaderbedarf", "Rolle im Team", "Risiko durch Vertrag, Fatigue oder Moral"],
    usage: "Nutze Value bei Verkaufsfragen, Vertragsdruck und Transfermarkt-Vergleichen.",
  },
  {
    id: "push",
    term: "Push",
    aliases: ["boost", "einsatzstufe", "schonen", "normal"],
    category: "Spieltag",
    short: "Teamweite Intensität für den Spieltag.",
    meaning:
      "Push, Normal und Schonen verändern die Spieltagsleistung und das Risiko. Der Effekt kommt on top auf den Slotscore.",
    factors: ["Team-Intensität", "Fatigue- und Risiko-Modell", "GM-/AI-Entscheidung", "aktuelle Saisonlage"],
    usage: "Push lohnt sich, wenn ein Rang kippen kann oder ein wichtiger Spieltag verteidigt werden muss.",
    caveat: "Mehr Push ist nicht immer besser. Er kann Erschöpfung und Folgerisiken erhöhen.",
  },
  {
    id: "captain",
    term: "Captain",
    aliases: ["kapitaen", "kapitän", "captain bonus"],
    category: "Spieltag",
    short: "Limitierter Bonus für einen wichtigen Spieler/Slot.",
    meaning:
      "Captain verstärkt einen konkreten Einsatz. Weil die Anzahl pro Saison begrenzt ist, ist der Timing-Wert oft wichtiger als der reine Bonus.",
    factors: ["Spieler-Score", "Disziplin-Größe", "Saisonlimit", "GM-Risikostil", "Rangpotenzial der Disziplin"],
    usage: "Setze Captain dort, wo ein starker Spieler einen Rang wirklich drehen oder absichern kann.",
  },
  {
    id: "mutatoren",
    term: "Mutatoren",
    aliases: ["mutator", "traits", "trait bonus"],
    category: "Spieltag",
    short: "Disziplin-Tags, die passende Spieler im Score belohnen.",
    meaning:
      "Jede Disziplin kann Mutatoren haben. Eingesetzte Spieler mit passenden Traits bekommen zusätzlichen Score; das macht Teamidentität und Spezialisten wichtiger.",
    factors: ["zwei Mutatoren pro Disziplin", "passende positive/negative Trait-Tags", "aktive eingesetzte Spieler", "Scorebonus pro Treffer"],
    usage: "Nutze Mutatoren, um Spezialisten in engen Disziplinen zu finden und AI-Lineups besser zu verstehen.",
  },
  {
    id: "xp",
    term: "XP",
    aliases: ["entwicklung", "progression", "training xp", "netto xp"],
    category: "Training",
    short: "Entwicklungspunkte für Wachstum, Erhalt und Rückschritt.",
    meaning:
      "XP entsteht aus Training und Performance. Netto-XP zeigt, ob ein Spieler eher wachsen, stabil bleiben oder regressieren wird.",
    factors: ["Trainingsmodus", "Einsätze", "MVS und gedeckelte PPs", "Gebäude", "Potential", "Trait-Bonus und Trait-Malus"],
    usage: "Nutze XP, um zu entscheiden, wer hart trainiert, wer geschont wird und wo Upgrades sinnvoll sind.",
    caveat: "Baseline und Regression können Wachstum auffressen, wenn ein Spieler wenig spielt oder schlecht passt.",
  },
  {
    id: "pow-spe-men-soc",
    term: "POW / SPE / MEN / SOC",
    aliases: ["pow", "spe", "men", "soc", "achsen", "attributes"],
    category: "Kader",
    short: "Vier Hauptachsen für Spieler, Teams und Disziplinen.",
    meaning:
      "POW, SPE, MEN und SOC sind die groben Leistungsachsen. Disziplinen gewichten sie unterschiedlich, Slotrollen können diese Gewichtung weiter drehen.",
    factors: ["Attribute des Spielers", "Disziplingewichtung", "Slotrolle", "Teamprofil und Powers", "Training und Progression"],
    usage: "Nutze die Achsen, um zu verstehen, warum ein Team in bestimmten Disziplinen stark oder schwach ist.",
  },
  {
    id: "fatigue",
    term: "Fatigue",
    aliases: ["fatigue", "ermuedung", "ermüdung", "belastung", "erschoepfung", "erschöpfung", "muedigkeit"],
    category: "Kader",
    short: "Belastungswert 0–100, der Leistung und Verletzungsrisiko steuert.",
    meaning:
      "Fatigue zeigt die aktuelle Ermüdung eines Spielers. Sie senkt die Spieltagsleistung und hebt das Verletzungsrisiko, baut sich aber durch Schonung und leichtes Training wieder ab.",
    factors: [
      "Skala 0–100, Risikostufen ab 40 (mittel) und 65 (hoch)",
      "Leistungsabzug steigt linear bis maximal 25 % bei Fatigue 80+",
      "Verletzungsrisiko wächst mit (ca. 10 % bei 50, 25 % bei 80)",
      "Aufbau durch Push, harte Slots und viele Einsätze",
      "Abbau durch Schonen, leichtes Training und Pausen",
    ],
    usage: "Lies Fatigue vor jedem Push. Bei belasteten Spielern kostet ein aggressiver Einsatz Leistung und riskiert Ausfälle.",
    caveat: "Nicht dieselbe Sache wie Intensität: Intensität ist die Trainingsstufe, Fatigue der resultierende Belastungsstand.",
  },
  {
    id: "form-formkarten",
    term: "Form / Formkarten",
    aliases: ["form", "formkarte", "formkarten", "form cards", "form card", "formkurve", "tagesform"],
    category: "Spieltag",
    short: "Farbige Bonus-/Maluskarten, die einen Einsatz aufwerten oder bremsen.",
    meaning:
      "Formkarten sind pro Spieler und Saison generierte Karten mit Farbe und Wert. Positive Karten heben den Slotscore, negative senken ihn; ihre Farbe folgt der Spielerklasse.",
    factors: [
      "Farbe folgt der Klasse (rot/grün/blau/gelb)",
      "cardValue wirkt als positiver oder negativer Bonus auf den Slotscore",
      "Einsatz auf den D1-/D2-Seiten im Lineup",
      "ungenutzte negative Karten kosten am Saisonende Strafpunkte",
      "die zweite Karte einer Seite darf nicht negativ sein",
    ],
    usage: "Setze starke positive Karten dort, wo ein Rang kippen kann, und arbeite negative Karten kontrolliert ab, um Strafpunkte zu vermeiden.",
  },
  {
    id: "slotrolle",
    term: "Slotrolle",
    aliases: ["slotrolle", "slot rolle", "slot role", "f i", "f ii", "slotrollen", "rolle", "playbook rolle"],
    category: "Spieltag",
    short: "Rolle eines Aufstellungsslots, die Attributgewichte und Fatigue dreht.",
    meaning:
      "Jede Disziplin hat eigene Slotrollen (z. B. F I, F II). Jede Rolle verschiebt die Attributgewichtung auf ihre Fokuswerte und bestimmt, wie stark ein Spieler in genau diesem Slot passt.",
    factors: [
      "pro Disziplin bis zu sechs eigene Slots/Rollen",
      "verschiebt Gewichte auf Major- und Minor-Fokusattribute",
      "Slot-Fit-Modifier bis rund ±8.5 auf den Score",
      "je Rolle ein Fatigue-Profil und ein Strain-Attribut",
      "Klassen-Hints als Orientierung für gute Besetzung",
    ],
    usage: "Besetze Slots nach Rolle, nicht nur nach OVR. Ein Spieler mit passendem Fokusprofil holt spürbaren Slot-Fit-Bonus.",
    caveat: "Ein Off-Role-Fit kann den Score deutlich drücken, auch wenn der Spieler nominell stark ist.",
  },
  {
    id: "team-power",
    term: "Powers / Team-Power",
    aliases: ["power", "powers", "team power", "team-power", "teampower", "team powers"],
    category: "Spieltag",
    short: "Begrenzte Team-Sonderfähigkeiten für Boosts oder Debuffs.",
    meaning:
      "Team-Powers kommen aus Team-Identität oder Facilities. Sie geben dem eigenen Team einen Boost oder legen einem Ziel einen Debuff auf und haben nur begrenzte Ladungen pro Saison.",
    factors: [
      "Quelle: Team-Identität oder Facility",
      "Effekt: Self-/Support-Boost oder Debuff (Snipe/Field/Rivalry)",
      "Zielmodus (selbst, Top-Team, Rivale, Rang-Nachbar, Rang-Band)",
      "begrenzte Charges pro Saison",
      "optionaler Conditional-Bonus bei Top-8-Trigger",
    ],
    usage: "Plane Powers wie Captain: dort einsetzen, wo ein Rang wirklich zu drehen ist oder ein Rivale gezielt gebremst werden soll.",
  },
  {
    id: "guv",
    term: "GuV",
    aliases: ["guv", "gu v", "gewinn und verlust", "gewinn/verlust", "profit", "verlust", "saldo", "bilanz"],
    category: "Finanzen",
    short: "Gewinn und Verlust der Saison: Einnahmen minus Ausgaben.",
    meaning:
      "Die GuV bündelt die wirtschaftliche Saisonbilanz eines Teams. Sie zeigt, ob unterm Strich Geld reinkommt oder abfließt, und fließt in den Gesamtkontostand.",
    factors: [
      "Einnahmen: Sponsoren, Preisgeld, Arena, Spielerverkäufe",
      "Ausgaben: Gehälter, Facility-Unterhalt, Transferkäufe",
      "Saldo über die laufende Saison",
      "Arena-Einnahmen skalieren mit der Beliebtheit",
    ],
    usage: "Lies die GuV, um zu sehen, ob dein Kader- und Facility-Betrieb tragfähig ist oder Verkäufe/Sparen nötig werden.",
    caveat: "GuV ist der Saisonfluss, nicht der Kontostand. Cash Total zeigt den Bestand.",
  },
  {
    id: "cash",
    term: "Cash",
    aliases: ["cash", "guthaben", "kasse", "kontostand", "cash total", "budget", "geld"],
    category: "Finanzen",
    short: "Verfügbares Guthaben für Transfers, Gehälter und Facilities.",
    meaning:
      "Cash ist das liquide Geld deines Teams. Es begrenzt, was du kaufen, halten und ausbauen kannst, und verändert sich laufend durch Einnahmen und Ausgaben.",
    factors: [
      "verfügbares Guthaben für Käufe, Gehälter und Facility-Ausbau",
      "wächst durch Sponsoren, Preisgeld, Arena und Verkäufe",
      "sinkt durch Transferkäufe, Gehälter und Unterhalt",
      "Cash Total = Gesamtkontostand inkl. Saison-GuV",
    ],
    usage: "Prüfe Cash vor Transferentscheidungen und halte Reserve für Gehälter und Facility-Unterhalt zurück.",
  },
  {
    id: "rang",
    term: "Rang",
    aliases: ["rang", "rank", "platz", "tabellenplatz", "feld rang", "feld-rennen-rang", "platzierung", "position"],
    category: "Spieltag",
    short: "Position im Gesamtfeld aller Teams (#x von N).",
    meaning:
      "Der Rang ist die Platzierung deines Teams im Feld aller Teams. Er ergibt sich aus den Saisonpunkten und entscheidet über Preisgeld und Ansehen.",
    factors: [
      "Position in der Gesamttabelle aller Teams (#x von N)",
      "ergibt sich aus den kumulierten Saisonpunkten",
      "steuert Preisgeld-Verteilung am Saisonende",
      "fließt als Erfolg in Beliebtheit und Kommerz-Rating",
      "je Disziplin zusätzlich ein Feld-Rang pro Spieltag",
    ],
    usage: "Nutze den Rang als Zielmarke: kleine Rangsprünge nahe Preisgeld-Schwellen sind oft mehr Push und Captain wert.",
  },
  {
    id: "kommerz-beliebtheit",
    term: "Kommerz-Rating / Beliebtheit",
    aliases: ["kommerz", "kommerz-rating", "kommerzrating", "commercial rating", "beliebtheit", "popularity", "fanfaktor"],
    category: "Finanzen",
    short: "Zwei Ansehenswerte, die Sponsoren-Angebote und Arena-Einnahmen steuern.",
    meaning:
      "Beliebtheit ist ein Team-Faktor um 1.0 (Liga-Schnitt), der die Arena-Einnahmen skaliert. Das Kommerz-Rating bewertet dein Team für Sponsoren und bestimmt Angebots-Tiers.",
    factors: [
      "Beliebtheit: Faktor 0.5–1.5 (1.0 = Liga-Schnitt) skaliert Arena-Einnahmen",
      "Beliebtheit aus Erfolg (50 %), Fan-Favoriten (30 %), Starpower (20 %)",
      "Kommerz-Rating aus jüngstem Erfolg, Kaderpotenzial und Prestige",
      "höheres Rating = bessere Sponsoren-Angebote und Tiers",
    ],
    usage: "Sportlicher Erfolg zahlt doppelt: Er hebt Beliebtheit (Arena) und Kommerz-Rating (Sponsoren) gleichzeitig.",
  },
  {
    id: "prestige",
    term: "Prestige",
    aliases: ["prestige", "prestige score", "ansehen", "renommee", "reputation"],
    category: "Finanzen",
    short: "Historisches Ansehen aus Medaillen und Top-Platzierungen.",
    meaning:
      "Prestige misst die Erfolgshistorie eines Teams. Es wächst mit Medaillen und guten Platzierungen und ist ein Baustein des Kommerz-Ratings für Sponsoren.",
    factors: [
      "historische Medaillen (Gold, Silber, Bronze)",
      "frühere Top-5- und Top-10-Platzierungen",
      "Ambitions-Bonus der Team-Identität",
      "gedeckelt auf 0–20 Punkte",
      "Teil des Kommerz-Ratings für Sponsoren",
    ],
    usage: "Prestige baut sich langfristig auf. Konstante Top-Ergebnisse zahlen sich über Sponsoren später aus.",
  },
  {
    id: "board-vertrauen",
    term: "Board-Vertrauen",
    aliases: ["board vertrauen", "board-vertrauen", "board confidence", "boardvertrauen", "vorstand", "jobsicherheit"],
    category: "System",
    short: "Vertrauen des Vorstands, 0–100, steuert deine Jobsicherheit.",
    meaning:
      "Board-Vertrauen zeigt, wie zufrieden der Vorstand mit dir ist. Es steigt mit erfüllten Zielen und guten Rängen und sinkt bei verfehlten Erwartungen.",
    factors: [
      "Skala 0–100, unter etwa 42 wird es kritisch",
      "steigt durch erfüllte Saisonziele und gute Platzierungen",
      "sinkt bei klar verfehlten Erwartungen",
      "beeinflusst Jobsicherheit (GM Hot Seat) und Vertragsdruck",
    ],
    usage: "Behalte Board-Vertrauen im Blick, wenn es Richtung kritischer Zone rutscht: dann zählen Zielerfüllung und Ergebnisse besonders.",
  },
  {
    id: "punkte",
    term: "Punkte",
    aliases: ["punkte", "points", "saisonpunkte", "tagespunkte", "season points", "matchday points", "bonuspunkte"],
    category: "Spieltag",
    short: "Tagespunkte je Spieltag summieren sich zu den Saisonpunkten.",
    meaning:
      "Tagespunkte sind das Ergebnis eines einzelnen Spieltags, entstanden aus der Platzierung je Disziplin. Ihre Summe über die Saison ergibt die Saisonpunkte und damit den Rang.",
    factors: [
      "Tagespunkte: Ergebnis eines Spieltags (Rang→Punkte je Disziplin)",
      "Saisonpunkte: Summe aller Tagespunkte über die Saison",
      "Saisonpunkte bestimmen den Tabellenrang",
      "Bonuspunkte können zusätzlich einfließen",
    ],
    usage: "Denk in Tagespunkten, wenn du einen Spieltag planst, und in Saisonpunkten, wenn du den Rang absichern willst.",
  },
  {
    id: "pps-vs-pps",
    term: "PPS vs PPs",
    aliases: ["pps", "pps vs pps", "player points", "d1 pps", "d2 pps", "total pps", "punkte pro spieltag"],
    category: "Kennzahl",
    short: "PPS = Spieltagspunkte im Resolve, PPs = Saison-Punktebeitrag.",
    meaning:
      "Die Schreibweise entscheidet: PPS (großes S) sind die auf einem Spieltag vergebenen Punkte im Resolve. PPs (kleines s) sind der über die Saison gesammelte Punktebeitrag eines Spielers.",
    factors: [
      "PPs: über die Saison gesammelter Punktebeitrag eines Spielers",
      "PPS: im Resolve/Spieltag vergebene Punkte (Rang→Punkte)",
      "PPS erscheint als D1 PPS, D2 PPS und Total PPS",
      "beide beruhen auf derselben Rank-to-Points-Logik der Disziplin",
    ],
    usage: "Lies PPS, wenn du einen einzelnen Spieltag auswertest, und PPs, wenn du Saisonimpact und Value beurteilst.",
    caveat: "Leicht zu verwechseln: PPS ist spieltagsbezogen, PPs saisonbezogen.",
  },
  {
    id: "potential-ca",
    term: "Potential (PO) & CA",
    aliases: ["potential", "po", "ca", "current ability", "potenzial", "aktuelle faehigkeit", "sterne", "star range"],
    category: "Kader",
    short: "CA ist die aktuelle Fähigkeit, PO das versteckte Potenzial.",
    meaning:
      "CA (Current Ability) zeigt die aktuelle Stärke als Sterne, PO (Potential) das versteckte Entwicklungspotenzial. Fremde Spieler siehst du nur als Sterne-Range, das eigene Team exakt.",
    factors: [
      "CA = aktuelle Fähigkeit (Rating/OVR als Sterne)",
      "PO = verstecktes Potenzial (Score 35–99 als Sterne)",
      "eigenes Team exakt, fremde Spieler nur als Sterne-Range",
      "höheres Scouting-Level verengt die Range (weniger Unsicherheit)",
      "weiche Range ohne harte Decke — PO kann über Saisons driften",
    ],
    usage: "Nutze CA für den Ist-Zustand und PO für Entwicklungsentscheidungen. Bei fremden Spielern erst scouten, bevor du Aufpreis für PO zahlst.",
    caveat: "Die Sterne-Range ist bewusst unscharf (Fog of War). Ohne Scouting ist die Spanne breit.",
  },
  {
    id: "regression",
    term: "Regression",
    aliases: ["regression", "rueckschritt", "rückschritt", "abbau", "regression risk", "stagnation"],
    category: "Training",
    short: "Rückschritt, wenn Regressionsdruck die verdiente XP übersteigt.",
    meaning:
      "Regression tritt ein, wenn ein Spieler mehr Substanz verliert als er durch Training gewinnt. Die Netto-XP entscheidet, ob er wächst, stabil bleibt oder zurückfällt.",
    factors: [
      "Netto-XP = verdiente XP minus Erhalt minus Regressionsdruck",
      "Regressionsdruck durch negativen Development-Gap und Risiko-Traits",
      "hohe Fatigue (ab etwa 70) und wenig Einsatz verstärken den Rückschritt",
      "niedrige Scout-Sicherheit erhöht das Risiko",
      "die Baseline zieht ungenutzte oder fehlbesetzte Spieler nach unten",
    ],
    usage: "Gib Regressionskandidaten klare Rollen und Einsätze oder teste rechtzeitig den Marktwert, bevor Substanz verloren geht.",
  },
  {
    id: "intensitaet",
    term: "Intensität",
    aliases: ["intensitaet", "intensität", "intensity", "leicht", "mittel", "hart", "trainingsintensitaet", "trainingsintensität"],
    category: "Training",
    short: "Teamweite Trainingsstufe Leicht/Mittel/Hart mit XP-Erholungs-Tradeoff.",
    meaning:
      "Die Intensität steuert das Team-Training. Härter bringt mehr XP, kostet aber Erholung und erhöht das Verletzungsrisiko; leichter dreht es um.",
    factors: [
      "Leicht: mehr Erholung (+25 %), weniger XP, geringeres Verletzungsrisiko",
      "Mittel: neutraler Standard",
      "Hart: viel XP, aber rund -32 % Erholung und höheres Verletzungsrisiko",
      "gilt teamweit fürs Training, nicht für den Spieltag",
      "pro Saison gesperrt, sobald sie gesetzt wurde",
    ],
    usage: "Wähle Hart für Entwicklungskader mit guter Erholung und Leicht bei belasteten oder verletzungsanfälligen Teams.",
    caveat: "Nicht mit dem Spieltag-Push (Schonen/Normal/Push) verwechseln — das ist die Einsatzstufe, nicht das Training.",
  },
];

export function normalizeGameEncyclopediaTerm(term: string) {
  return term
    .trim()
    .toLowerCase()
    .replaceAll(".", "")
    .replaceAll("ø", "")
    .replaceAll("Δ", "delta")
    .replace(/\s+/g, " ");
}

export function getGameEncyclopediaEntry(term: string | null | undefined) {
  if (!term) return null;
  const normalized = normalizeGameEncyclopediaTerm(term);
  const compact = normalized.replace(/[^a-z0-9]/g, "");

  return (
    GAME_ENCYCLOPEDIA_ENTRIES.find((entry) => {
      const values = [entry.id, entry.term, ...entry.aliases].map((value) => normalizeGameEncyclopediaTerm(value));
      return values.some((value) => value === normalized || value.replace(/[^a-z0-9]/g, "") === compact);
    }) ??
    GAME_ENCYCLOPEDIA_ENTRIES.find((entry) =>
      [entry.id, entry.term, ...entry.aliases]
        .map((value) => normalizeGameEncyclopediaTerm(value))
        .some((value) => normalized.includes(value) || compact.includes(value.replace(/[^a-z0-9]/g, ""))),
    ) ??
    null
  );
}

export function getGameTermTooltip(term: string | null | undefined) {
  const entry = getGameEncyclopediaEntry(term);
  return entry ? `${entry.term}: ${entry.short} Klick öffnet das Lexikon.` : null;
}

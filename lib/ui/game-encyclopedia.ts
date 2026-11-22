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

/** Stabile Anzeige-Reihenfolge der Lexikon-Kategorien für Filter/Gruppierung. */
export const GAME_ENCYCLOPEDIA_CATEGORIES: GameEncyclopediaEntry["category"][] = [
  "Kennzahl",
  "Spieltag",
  "Kader",
  "Training",
  "Finanzen",
  "System",
];

export const GAME_ENCYCLOPEDIA_ENTRIES: GameEncyclopediaEntry[] = [
  {
    id: "ovr",
    term: "OVR",
    aliases: ["overall", "gesamtstärke", "rating"],
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
    aliases: ["pps", "pps vs pps", "player points", "season points", "punkte beitrag", "punktebeitrag", "d1 pps", "d2 pps", "total pps", "punkte pro spieltag"],
    category: "Kennzahl",
    short: "Player Points: Leistungsmaß und Punktebeitrag eines Spielers, ein Top-Spieler liegt je Disziplin und Spieltag um 5.",
    meaning:
      "PPs zeigen, wie gut ein Spieler in einer Disziplin gespielt hat. Sie hängen an seiner eigenen Leistung, nicht am Ausgang des Duells: auch ein guter Spieler im Verlierer-Team kann viele PPs holen. Sie sind NICHT die Tabellenpunkte des Teams (das sind die Duellpunkte 2/1/0).",
    factors: ["eigene Leistung (Impact) im Duell", "Skala: der beste Spieler einer Disziplin an einem Spieltag liegt um 5 PP", "erscheinen je Disziplin, als D1 PPs, D2 PPs und Total PPs", "über die Saison summieren sie sich zum Saison-Beitrag des Spielers"],
    usage: "Nutze PPs, um zu sehen, wer in welcher Disziplin trägt — für Aufstellung, Training und Verkauf.",
    caveat: "PPs sagen nichts über Sieg oder Niederlage des Teams; dafür gibt es die Duellpunkte.",
  },
  {
    id: "mvs",
    term: "MVS",
    // Alte Schreibweisen bleiben als Alias stehen, damit die Suche sie weiter findet.
    aliases: ["market value score", "matchday value score", "value score", "matchday value"],
    category: "Kennzahl",
    short: "Market Value Score — was ein Spieler auf dem Platz wert ist.",
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
      "MW ist die grobe Marktwert-Sicht. Er verbindet sportliche Qualität mit Leistung, Nachfrage und wirtschaftlichem Kontext.",
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
    term: "Einsatzstufe",
    aliases: ["push", "boost", "vollgas", "schonen", "normal", "einsatzstufe"],
    category: "Spieltag",
    short: "Schonen, Normal oder Vollgas: wie hart ein Spieler am Spieltag rangenommen wird.",
    meaning:
      "Die Einsatzstufe steuert, wie viel Erschöpfung ein Einsatz kostet. Schonen belastet am wenigsten (Faktor 0,75), Normal ist der Standard (1), Vollgas kostet am meisten (1,4).",
    factors: ["Schonen 0,75 · Normal 1 · Vollgas 1,4 auf die Last des Platzes", "Last hängt zusätzlich vom Platz und der Resistenz des Spielers ab", "mehr Erschöpfung = mehr Verletzungsrisiko beim nächsten Einsatz"],
    usage: "Vollgas lohnt sich, wenn ein Duell knapp ist und der Spieler danach pausieren kann. Schonen hilft, Spieler für wichtige Spieltage frisch zu halten.",
    caveat: "Nicht mit der Trainingsintensität verwechseln — die wirkt nur auf das Training, nicht auf den Spieltag.",
  },
  {
    id: "captain",
    term: "Captain",
    aliases: ["kapitän", "captain bonus"],
    category: "Spieltag",
    short: "Limitierter Bonus für einen wichtigen Spieler/Slot.",
    meaning:
      "Captain verstärkt einen konkreten Einsatz. Weil die Anzahl pro Saison begrenzt ist, ist der Timing-Wert oft wichtiger als der reine Bonus.",
    factors: ["Spieler-Score", "Disziplin-Größe", "Saisonlimit", "GM-Risikostil", "Rangpotenzial der Disziplin"],
    usage: "Setze Captain dort, wo ein starker Spieler einen Rang wirklich drehen oder absichern kann.",
  },
  {
    id: "resistenz",
    term: "Resistenz / Belastung",
    aliases: ["resistenz", "last", "belastungs-attribut", "härtetest", "pause nach spieltag 10"],
    category: "Spieltag",
    short: "Wie gut ein Spieler die Last seines Platzes verträgt.",
    meaning:
      "Jeder Platz belastet ein bestimmtes Attribut des Spielers. Die Resistenz ist sein Wert in genau diesem Attribut: liegt er über der Schwelle des Platzes (45, 60 oder 75 je nach niedrig, mittel, hoch), kostet der Einsatz weniger Erschöpfung, liegt er darunter, mehr. Die Resistenz wirkt nur auf die Erschöpfung; das Verletzungsrisiko folgt dann aus der Erschöpfung.",
    factors: ["Resistenz = Wert im Belastungs-Attribut des Platzes", "unter der Schwelle bis zu +4 Last, darüber bis zu −2", "Einsatzstufe und Eigenschaften verändern die Last zusätzlich", "nach Spieltag 10 gibt es eine Pause: alle erholen sich einen spielfreien Spieltag"],
    usage: "Setze resistente Spieler auf harte Plätze und schwache Spieler auf leichte. Die Einsatzliste zeigt dir die Last je Platz, bevor du bestätigst.",
    caveat: "Gilt in Saisons, die mit der neuen Belastungsregel angelegt wurden (20 Spieltage); eine bereits laufende Saison rechnet noch nach der alten Regel.",
  },
  {
    id: "verletzung",
    term: "Verletzung",
    aliases: ["verletzt", "verletzungen", "verletzungsrisiko", "ausfall", "nicht einsetzbar"],
    category: "Kader",
    short: "Verletzte Spieler sind nicht einsetzbar.",
    meaning:
      "Ein verletzter Spieler darf für die Dauer der Verletzung weder von dir noch von der KI noch von einem automatischen Auffüllen aufgestellt werden und wird nicht gewertet. In der Disziplin, in der er sich verletzt hat, zählt nur die Hälfte seiner Basisleistung.",
    factors: ["nicht einsetzbar: Mensch, KI und Auto-Auffüllen gleich", "in der Verletzungs-Disziplin zählt nur die Hälfte der Basisleistung", "Verletzte trainieren nicht", "das Risiko hängt an der Erschöpfung"],
    usage: "Halte mehr als acht Spieler und rotiere, damit eine Verletzung nicht deine Aufstellung sprengt.",
  },
  {
    id: "form-moral",
    term: "Form und Moral",
    aliases: ["form", "moral", "form-stufe", "stimmung", "kabine", "zufrieden", "verärgert"],
    category: "Kader",
    short: "Form: Tagesform des Spielers; Moral: seine Zufriedenheit.",
    meaning:
      "Form zeigt als Pfeil (▲▲ bis ▼▼), ob ein Spieler gerade heiß oder außer Tritt ist. Moral zeigt als Gesicht von grün bis rot und als Zahl, wie zufrieden er ist: sehr zufrieden, zufrieden, neutral, unzufrieden, verärgert. Beides verändert seine Stärke in der Arena nur leicht (zusammen höchstens etwa 2,7 %).",
    factors: ["Form wird nach jedem Spieltag fortgeschrieben", "Moral hängt an Einsatz, Ergebnissen, Verletzung und Vorstandslage", "Gesicht-Stufen bei 80, 60, 40 und 20", "ein verärgerter Spieler ohne Einsätze kann Ärger machen"],
    usage: "Achte auf Moral unter 40: wer lange nicht spielt, wird unzufrieden.",
    caveat: "Form und Moral verschieben die Rangfolge kaum; sie sind ein Zusatz, nicht der Hauptgrund für Siege.",
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
    factors: ["Attribute des Spielers", "Disziplingewichtung", "Slotrolle", "Training und Progression"],
    usage: "Nutze die Achsen, um zu verstehen, warum ein Team in bestimmten Disziplinen stark oder schwach ist.",
  },
  {
    id: "ca",
    term: "CA",
    aliases: ["current ability", "aktuelle stärke", "ist-stärke", "ca-sterne"],
    category: "Kader",
    short: "Aktuelle Spielstärke — was der Spieler heute kann.",
    meaning:
      "CA (Current Ability) ist der Ist-Wert eines Spielers, als Sterne oder Score. Im Gegensatz zum Potenzial zeigt CA die heutige Leistungsfähigkeit, nicht die maximale Ausbaustufe.",
    factors: ["Attributprofil und Achsen", "Disziplinbreite", "Form", "bisherige Entwicklung"],
    usage: "Nutze CA für den direkten Leistungsvergleich zweier Spieler. Für die Zukunft zählt zusätzlich das Potenzial (PO).",
    caveat: "Bei unvollständigem Scouting ist CA nur geschätzt (Range).",
  },
  {
    id: "kaderstaerke",
    term: "Kaderstärke",
    aliases: ["kaderstärke", "kader stärke", "team stärke", "teamstärke", "stärke", "stärke-rang", "kaderstärke-rang"],
    category: "Kennzahl",
    short: "Die Stärke des Teams, gerechnet über die besten 6 Spieler.",
    meaning:
      "Die Kaderstärke zählt die besten sechs Spieler des Kaders, nicht die Einsatzplätze. So verrät sie nicht, wie ein Duell ausgeht, zeigt aber, wie breit ein Team aufgestellt ist. Bei fremden Teams siehst du nur eine grobe Stufe, exakt wird sie erst mit vollem Scouting.",
    factors: ["besten 6 Spieler des Kaders", "Rang je Disziplin gegen die eigene Liga", "fremde Teams: grobe Stufe, exakt nur bei vollem Scouting"],
    usage: "Nutze den Kaderstärke-Rang je Disziplin, um zu sehen, wo dein Team stark oder dünn besetzt ist.",
  },
  {
    id: "po",
    term: "PO",
    aliases: ["potenzial", "potential", "po-range", "potenzialdecke", "potenzialband"],
    category: "Kader",
    short: "Potenzial — die maximale Ausbaustufe eines Spielers.",
    meaning:
      "PO (Potenzial) ist die Obergrenze, auf die ein Spieler mit Training wachsen kann. Bei unvollständigem Scouting als Bereich angezeigt (z. B. 2.5–4.0 Sterne). Je höher PO, desto größer der Trainingsertrag.",
    factors: ["Talent/Anlage", "Abstand zur aktuellen Stärke (Restwachstum)", "Scouting-Sicherheit (Range-Breite)"],
    usage: "Nutze PO, um Entwicklungsspieler zu erkennen. Die Lücke zwischen CA und PO ist der Wachstumsspielraum.",
    caveat: "Ein hohes PO ist kein Versprechen — schlechtes Training oder wenig Einsatz lassen es ungenutzt.",
  },
  {
    id: "fit",
    term: "Fit",
    aliases: ["team-fit", "team fit", "kaderfit", "passung"],
    category: "Finanzen",
    short: "Wie gut ein Marktspieler zum eigenen Kaderprofil passt.",
    meaning:
      "Fit misst, wie gut ein Transferkandidat auf die Achsen- und Bedarfsprofile des eigenen Teams passt. Hoher Fit macht Wechsel und Vertrag günstiger und wirksamer, negativer Fit teurer und riskanter.",
    factors: ["Achsenprofil vs. Teamlücken", "Slot-/Rollenpassung", "Kaderbedarf (Bedarf)", "Disziplinabdeckung"],
    usage: "Nutze Fit als Schnellsignal im Transfermarkt: Passt der Spieler überhaupt zu uns, bevor du auf MW und Gehalt schaust?",
  },
  {
    id: "bedarf",
    term: "Bedarf",
    aliases: ["kaderbedarf", "need", "needmatch", "need match", "bedarfssignal"],
    category: "Kader",
    short: "In welchen Bereichen dem Team Stärke fehlt.",
    meaning:
      "Bedarf markiert Achsen oder Disziplinen, in denen der Kader schwach ist, und wie stark ein Kandidat diese Lücke schliessen würde. Als Sortier- und Signal-Chip im Transfermarkt.",
    factors: ["Team-Achsenprofil", "Kadertiefe pro Rolle", "Disziplinabdeckung", "needMatchScore des Kandidaten"],
    usage: "Nutze Bedarf, um gezielt die richtigen Lücken zu füllen, statt nur den stärksten verfügbaren Spieler zu holen.",
  },
  {
    id: "tier-badge",
    term: "Tier",
    aliases: ["tier badge", "s+", "buchstaben-tier", "klasse-tier", "abstufung"],
    category: "Kennzahl",
    short: "Buchstaben-Ranking eines Werts (S+ bis F).",
    meaning:
      "Tier-Badges übersetzen einen Score in eine Schulnoten-artige Klasse: S+ (Spitze) über S, A, B, C, D, E bis F (schwach). Für schnellen Klassenvergleich von Attributen oder Disziplin-Scores.",
    factors: ["S+ ab ~88", "S ab ~82, A ab ~76, B ab ~70", "C ab ~64, D ab ~58, E ab ~52", "darunter F"],
    usage: "Nutze Tier-Badges zum Scannen: Ein B-Spieler ist solide, ein S+ ist Elite in diesem Wert.",
  },
  {
    id: "scouting-intel",
    term: "Intel",
    aliases: ["konfidenz", "confidence", "scout-konfidenz", "scouting-sicherheit", "certainty"],
    category: "Kader",
    short: "Wie sicher die angezeigten Scouting-Werte sind.",
    meaning:
      "Intel (Konfidenz) ist die Scouting-Sicherheit in Prozent. Niedrige Intel bedeutet breite Wertebereiche und verdeckte Traits; hohe Intel zeigt echte Werte statt Schätzungen.",
    factors: ["Scouting-Fortschritt am Spieler", "Facility-Level Scouting", "vergangene Spieltage im Fokus"],
    usage: "Nutze Intel, um zu wissen, wie sehr du den angezeigten CA/PO trauen kannst, bevor du Geld ausgibst.",
  },
  {
    id: "scouting-level",
    term: "Scouting-Level",
    aliases: ["scouting l", "scout level", "erkenntnisstufe", "scouting-stufe"],
    category: "Kader",
    short: "Erkenntnisstufe eines Spielers (Gesichtet bis Vollständig).",
    meaning:
      "Das Scouting-Level fasst Facility-Level und Intel zu Stufen zusammen: Gesichtet, Beobachtet, Analysiert, Vertieft, Durchleuchtet, Vollständig. Es steuert, wie viel echte Werte statt Ranges du siehst.",
    factors: ["Facility-Level Scouting", "Intel/Konfidenz des Spielers", "Fokus-Scouting über Zeit"],
    usage: "Nutze das Level, um zu entscheiden, ob ein Kandidat schon reif für eine Kaufentscheidung ist.",
  },
  {
    id: "fatigue",
    term: "Erschöpfung",
    aliases: ["fatigue", "ermüdung", "erschöpfung", "belastung"],
    category: "Spieltag",
    short: "Angesammelte Belastung eines Spielers; hohe Erschöpfung erhöht das Verletzungsrisiko.",
    meaning:
      "Jeder Einsatz kostet Erschöpfung. Sie sinkt durch Erholung (Bank, aktive Erholung, Reha-Zentrum, Trainingsmodus) und durch die Pause nach Spieltag 10. Je höher sie ist, desto größer das Risiko, dass sich der Spieler verletzt.",
    factors: ["Last des Platzes, Einsatzstufe und Resistenz des Spielers", "Erholung auf der Bank und im Training", "Reha-Zentrum erhöht die Erholung", "Pause nach Spieltag 10: alle erholen sich einen spielfreien Spieltag"],
    usage: "Schau vor jedem Spieltag auf die Last-Vorschau in der Einsatzliste und rotiere, bevor jemand zu erschöpft ist.",
  },
  {
    id: "netto-forecast",
    term: "Netto-Forecast",
    aliases: ["netto forecast", "netto", "setpoints forecast", "sp-forecast", "entwicklungsforecast"],
    category: "Training",
    short: "Prognostizierte Saison-Attributänderung in Setpoints.",
    meaning:
      "Der Netto-Forecast ist Training plus Performance minus Regression über alle Attribute, gemessen in Setpoints (SP). Er zeigt die Saisonend-Tendenz: ab etwa +2 SP wächst der Spieler, unter 0 fällt er.",
    factors: ["Trainingsmodus und Facility", "Einsatzleistung", "Regressions-Druck", "Potenzial-Multiplikator"],
    usage: "Nutze den Netto-Forecast, um zu sehen, wer sich entwickelt und wo Training oder Einsatz nachgesteuert werden muss.",
    caveat: "Es ist eine Saison-Tendenz, kein Sofort-Upgrade.",
  },
  {
    id: "regression",
    term: "Rückschritt-Risiko",
    aliases: ["regression", "rückschritt-risiko", "regressions-druck", "regressionspressure", "rückschritt"],
    category: "Training",
    short: "Druck, der Attribute schrumpfen lässt.",
    meaning:
      "Das Rückschritt-Risiko (Regression) beschreibt den Druck aus Marktwert-Erwartung, Belastung und Einsatzmangel, der Attribute abbauen lässt. Hohes Risiko kann einen positiven Netto-Forecast ins Minus kippen.",
    factors: ["Marktwert-/Erwartungsdruck", "Fatigue und Einsatzmangel", "Nähe zur Potenzialdecke"],
    usage: "Nutze das Risiko, um gefährdete Spieler früh mit Training oder Einsatz zu stabilisieren.",
  },
  {
    id: "guv",
    term: "GuV",
    aliases: ["gewinn und verlust", "gewinn/verlust", "profit loss", "transfer-guv", "p/l"],
    category: "Finanzen",
    short: "Gewinn oder Verlust eines Transfers.",
    meaning:
      "GuV (Gewinn und Verlust) ist die Differenz aus Verkaufserlös und Einstands-/Buchwert eines Spielers. Kennzahl der Transfer-Historie und der Saison-Bilanz.",
    factors: ["Verkaufspreis", "Kaufpreis/Buchwert", "Marktwert-Entwicklung", "Vertragsrestwert"],
    usage: "Nutze GuV, um zu sehen, ob deine Transferpolitik über die Saison Geld verdient oder verbrennt.",
  },
  {
    id: "setpoints",
    term: "Setpoints",
    aliases: ["sp", "trainingspunkte", "attributpunkte", "setpoint"],
    category: "Training",
    short: "Einheit für Trainings- und Attributwachstum (SP).",
    meaning:
      "Setpoints (SP) sind die Einheit, in der Wachstumsbudget, Attributzuwachs und der Netto-Forecast gemessen werden. Mehr SP bedeuten mehr echte Attributentwicklung.",
    factors: ["Trainingsmodus", "Potenzial-Multiplikator", "Facility-Boni", "Einsatzleistung"],
    usage: "Nutze SP als Währung der Entwicklung: Wohin fliesst das knappe Wachstumsbudget?",
  },
  {
    id: "reha",
    term: "Reha",
    aliases: ["rehabilitation", "rehab", "in reha", "verletzungsaufbau"],
    category: "Kader",
    short: "Aufbaustatus nach Verletzung — noch nicht voll einsatzbereit.",
    meaning:
      "Reha markiert einen Spieler, der nach einer Verletzung wieder aufgebaut wird und noch nicht die volle Leistung oder Einsatzfreigabe hat.",
    factors: ["Verletzungsschwere", "verbleibende Reha-Dauer", "Belastungssteuerung"],
    usage: "Nutze den Reha-Status, um die Belastung dieser Spieler vorsichtig zu planen.",
  },
  {
    id: "bracket",
    term: "Bracket",
    aliases: ["vergleichsgruppe", "preis-bracket", "bracket-gruppe"],
    category: "Finanzen",
    short: "Vergleichsgruppe für den Verkaufspreis.",
    meaning:
      "Ein Bracket ist die Gruppe vergleichbarer Spieler (nach MVS), in die ein Spieler für die Preisfindung einsortiert wird. Der Rang innerhalb der Bracket-Gruppe beeinflusst den erzielbaren Preis.",
    factors: ["MVS des Spielers", "Größe der Bracket-Gruppe", "Rang innerhalb der Gruppe"],
    usage: "Nutze das Bracket, um realistisch einzuschätzen, was ein Spieler am Markt bringt.",
  },
  {
    id: "board",
    term: "Board",
    aliases: ["vereinsführung", "front office", "board-rating", "vorstand"],
    category: "System",
    short: "Bewertung des Managers durch die Vereinsführung.",
    meaning:
      "Das Board ist die Vereinsführung. Das Board-Rating drückt aus, wie zufrieden sie mit dir sind. Ein niedriges Rating gefährdet den Job.",
    factors: ["Zielerfüllung", "sportliche und wirtschaftliche Lage", "Erwartungen der Saison"],
    usage: "Beobachte das Board-Rating, um zu wissen, wie sicher dein Posten ist.",
  },
  {
    id: "board-druck",
    term: "Druck",
    aliases: ["board-druck", "boardpressure", "erwartungsdruck", "jobsicherheit"],
    category: "System",
    short: "Erwartungsdruck des Boards auf den Manager.",
    meaning:
      "Druck (Board-Druck) misst, wie stark die Vereinsführung auf Ergebnisse drängt. Er steigt, wenn Board-Ziele verfehlt werden, und senkt die Jobsicherheit.",
    factors: ["Status der Board-Ziele", "jüngste Ergebnisse", "Saisonerwartung"],
    usage: "Hoher Druck heisst: liefere bei den Board-Zielen, bevor der Job wackelt.",
  },
  {
    id: "board-ziele",
    term: "Board-Ziele",
    aliases: ["board objectives", "saisonziele", "board-ziel", "objectives", "vorstandsziele", "vorstandsziel", "auf kurs", "gefährdet", "verfehlt"],
    category: "System",
    short: "Vom Vorstand gesetzte Saisonziele: auf Kurs, gefährdet oder verfehlt.",
    meaning:
      "Board-Ziele sind die Vorgaben der Vereinsführung für die Saison. Mitten in der Saison rechnet die Anzeige zum Saisonende hoch (Ist-Stand plus offene Spieltage): ein Ziel ist „auf Kurs“, wenn es erfüllt oder erreichbar ist, „gefährdet“, wenn es aktuell darunter liegt, und „verfehlt“ erst, wenn es rechnerisch nicht mehr erreichbar ist. Die Abrechnung am Saisonende gilt unverändert.",
    factors: ["Tabellenplatz und Punkte, mit den noch möglichen Punkten der Restsaison (Duell: höchstens 4 je Spieltag)", "wirtschaftliche Vorgaben (z. B. Kasse halten) werden erst am Saisonende entschieden", "Zähler (Siege, Medaillen) sind verfehlt, wenn die Restsaison nicht mehr reicht", "verbleibende Spieltage"],
    usage: "Priorisiere gefährdete Ziele — sie bestimmen Vertrauen und Budgetfreigabe. Ein Ziel „auf Kurs“ ist kein Freifahrtschein, solange noch Spieltage offen sind.",
  },
  {
    id: "vorstandsfreigabe",
    term: "Vorstandsfreigabe",
    aliases: ["freigabe", "budgetfreigabe", "vorstand-freigabe", "quote", "freigabe-quote", "ausgabe-quote", "vertrauen quote"],
    category: "Finanzen",
    short: "Der Anteil deines Geldes, den der Vorstand für Käufe und Gehälter freigibt.",
    meaning:
      "Der Vorstand nimmt kein Geld weg. Das Geld bleibt auf dem Konto, aber nur ein Teil davon darf für Ablösen und Gehälter (neue Verträge, Gehaltserhöhungen) ausgegeben werden. Wie viel, hängt an seinem Vertrauen: ab 7,5 sind es 100 %, ab 5 meist 90 %, darunter 80 %, unter 3 nur 70 %, unter 1,5 nur 50 %. Die Sperre ist hart; auch Verkaufserlöse unterliegen derselben Quote.",
    factors: ["Stufen nach Vertrauen: 100 / 90 / 80 / 70 / 50 %", "gilt für Ablöse und Gehalt, für Mensch und KI", "Verkaufserlöse unterliegen derselben Quote", "der Pflichtkader von 8 Spielern ist nie gesperrt", "„Alles auf eine Karte“: bis auf 5 % Puffer ausgeben, kostet Vertrauen"],
    usage: "Hohes Vertrauen schafft Spielraum. Wer die Ziele verfehlt, bekommt weniger Budget freigegeben, aber keine Geldstrafe.",
  },
  {
    id: "zwei-toepfe",
    term: "Zwei Töpfe",
    aliases: ["töpfe", "topf", "transfertopf", "investitionstopf", "gehaltstopf", "rücklage", "zwei budgets", "budgets"],
    category: "Finanzen",
    short: "Transfer-/Investitionstopf und Gehaltstopf.",
    meaning:
      "Dein Geld ist in zwei Töpfe aufgeteilt. Aus dem Transfer- und Investitionstopf bezahlst du Ablösen und Gebäude, aus dem Gehaltstopf neue Verträge und Gehaltserhöhungen. Dazu behältst du eine Rücklage.",
    factors: ["Transfer-/Investitionstopf: Ablösen und Gebäude", "Gehaltstopf: Gehälter; der Vorstand kürzt ihn höchstens auf 75 %", "Gehalt eines verkauften Spielers fließt zu 100 % in den Gehaltstopf zurück", "Rücklage nach Finanzwert des Teams (hoher Finanzwert: 15–25 %, niedriger: 5–10 %); in Saison 1 halb so hoch", "ab Saison 2 richtet sich die Rücklage nach den Gehaltskosten"],
    usage: "Plane Käufe und Gehälter getrennt: ein voller Transfertopf hilft nicht, wenn der Gehaltstopf fehlt.",
  },
  {
    id: "finanzen-je-spieltag",
    term: "Finanzen je Spieltag",
    aliases: ["abschlag", "rang-abschlag", "rangprämie", "rang abschlag", "gehalt je spieltag", "je spieltag", "sponsor-abschlag", "schlussausgleich"],
    category: "Finanzen",
    short: "Gehälter, Sponsor-Basis und Gebäude werden je Spieltag gebucht.",
    meaning:
      "Statt einmal am Saisonende fließt das Geld in kleinen Stücken: Gehalt, die garantierte Sponsor-Basis, Gebäude-Einnahmen und Unterhalt zu je 1/20 pro Spieltag. Dazu zahlt der Sponsor je Spieltag einen Rang-Abschlag auf seine Rangprämie, passend zum aktuellen Tabellenplatz; am Saisonende gibt es einen Schlussausgleich.",
    factors: ["Gehälter stehen groß je Saison, klein je Spieltag", "Rang-Abschlag: 80 % der Rangprämie des aktuellen Platzes, auf alle Spieltage verteilt", "Schlussausgleich am Saisonende gleicht Über- oder Unterzahlung aus", "die Pause nach Spieltag 10 ist kein Spieltag und bucht nichts"],
    usage: "Der Kontoauszug zeigt jeden Abschlag mit dem Platz, auf dem er beruht: steigst du in der Tabelle, steigen auch die nächsten Abschläge.",
  },
  {
    id: "delegation",
    term: "Delegation / Halbautomatik",
    aliases: ["delegation", "halbautomatik", "voll ki", "voll selbst", "ki übernimmt", "automatik", "delegieren"],
    category: "System",
    short: "Je Bereich selbst entscheiden oder an die KI geben.",
    meaning:
      "Für jeden Bereich (Einsatzliste und Formkarten, Draft, Käufe/Verkäufe/Verträge, Training, Gebäude, Sponsor) kannst du selbst entscheiden oder die KI machen lassen. Drei Stufen: Voll selbst, Halbautomatik (die KI stellt auf und trainiert, Käufe und Verkäufe machst du selbst) und Voll KI. Was du selbst gesetzt hast, überschreibt die KI nicht.",
    factors: ["Voll selbst · Halbautomatik · Voll KI", "die KI nutzt dieselben Regeln wie die KI-Teams", "sie füllt nur, was du nicht selbst gesetzt hast", "die Freigabe des Vorstands gilt für sie genauso"],
    usage: "Gib Bereiche ab, auf die du keine Lust hast; ein Spieltag wartet nie auf einen abwesenden Mitspieler, dessen Bereich delegiert ist.",
  },
  {
    id: "formkarten",
    term: "Formkarten",
    aliases: ["formkarte", "form-karten", "formcards", "farbregel", "pluskarte", "minuskarte", "pflicht-minuskarte"],
    category: "Spieltag",
    short: "Pro Disziplin-Seite legbare Karten mit Bonus oder Malus für den Spieltag.",
    meaning:
      "Formkarten werden je Disziplin-Seite (D1/D2) gelegt. Eine Karte wirkt auf alle Spieler der Seite und zusätzlich auf die Spieler, deren Klassenfarbe der Kartenfarbe entspricht (Farbträger). Passt die Kartenfarbe zur Farbe der Disziplin, zählt sie voll, sonst nur halb. Pluskarten helfen, Minuskarten schaden.",
    factors: ["Karte passend zur Disziplinfarbe: voller Wert für alle, sonst halber Wert", "Zusatzbonus für Spieler, deren Klassenfarbe = Kartenfarbe (nicht die Rolle, nicht die Disziplinfarbe)", "Spitze: bis +12 je Karte, wenn die Farbe passt und der Spieler Träger ist", "Pflicht-Minuskarten müssen bis Saisonende gelegt sein, sonst gibt es Strafpunkte", "die gelegte Karte zählt in allen zwanzig Disziplinen; die Einsatzliste zeigt vorab, was sie bringt"],
    usage: "Lege Pluskarten dort, wo viele Farbträger spielen, und verteile Minuskarten auf Disziplinen, in denen ein Duell ohnehin entschieden ist.",
  },
  {
    id: "diszi",
    term: "Diszi",
    aliases: ["disziplin", "disziplinen", "diszis", "wettbewerb", "achse"],
    category: "Spieltag",
    short: "Einzelwettbewerb eines Spieltags (z. B. Football, Schach).",
    meaning:
      "Eine Diszi (Disziplin) ist ein einzelner Wettbewerb innerhalb eines Spieltags. Jede Disziplin gewichtet die Achsen POW/SPE/MEN/SOC anders und kann eigene Mutatoren haben.",
    factors: ["Achsengewichtung der Disziplin", "Mutatoren", "Slotrollen", "eingesetzte Spieler"],
    usage: "Verstehe die Diszi-Gewichtung, um die richtigen Spezialisten in die richtige Disziplin zu stellen.",
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
    id: "cash",
    term: "Cash",
    aliases: ["cash", "guthaben", "kasse", "kontostand", "cash total", "budget", "geld"],
    category: "Finanzen",
    short: "Verfügbares Guthaben für Transfers, Gehälter und Gebäude.",
    meaning:
      "Cash ist das liquide Geld deines Teams. Es begrenzt, was du kaufen, halten und ausbauen kannst. Wie viel davon ausgegeben werden darf, bestimmt zusätzlich die Freigabe des Vorstands.",
    factors: ["verfügbares Guthaben für Käufe, Gehälter und Gebäude", "wächst durch Sponsor, Gebäude-Einnahmen (Arena, Fan-Shop) und Verkäufe", "sinkt durch Transferkäufe, Gehälter und Unterhalt", "Gehälter und Einnahmen werden je Spieltag gebucht"],
    usage: "Prüfe Cash vor Transferentscheidungen und halte Reserve für Gehälter und Gebäudeunterhalt zurück.",
  },
  {
    id: "rang",
    term: "Rang",
    aliases: ["rang", "rank", "platz", "tabellenplatz", "feld rang", "feld-rennen-rang", "platzierung", "position"],
    category: "Spieltag",
    short: "Tabellenplatz in der eigenen Liga (1 bis 16); Rang 1 ist immer der beste.",
    meaning:
      "Der Rang ergibt sich aus den Duellpunkten in der eigenen Liga. Rang 1 ist immer der beste: bei Kosten (Gehalt, Ablöse) ist das günstigste Team Erster, bei Kasse, Stärke und Punkten das höchste.",
    factors: ["Position in der eigenen Liga (Liga 1 oder Liga 2, je 16 Teams)", "Sortierung nach Duellpunkten, dann Punkteverhältnis", "bestimmt Aufstieg und Abstieg am Saisonende", "fließt in Sponsor-Rangprämie, Beliebtheit und Kommerz-Rating ein"],
    usage: "Nutze den Rang als Zielmarke: die Linien zum Aufstieg und Abstieg zeigen, wie viele Punkte dir zum nächsten Platz fehlen.",
  },
  {
    id: "papierform",
    term: "Papierform",
    aliases: ["papierform", "vorteil", "nachteil", "stärkevergleich"],
    category: "Spieltag",
    short: "Wer vor dem Duell auf dem Papier vorn liegt: Vorteil, offen oder Nachteil.",
    meaning:
      "Die Papierform vergleicht die Kaderstärke beider Teams in der Disziplin. Hat dein Team mindestens 55 % der gemeinsamen Stärke, steht „Vorteil“, bei höchstens 45 % „Nachteil“, dazwischen „offen“. In Vierergruppen ist Rang 1 der Vorteil, Rang 4 der Nachteil.",
    factors: ["Anteil deiner Kaderstärke an der Summe beider Teams", "ab 55 % Vorteil · bis 45 % Nachteil · dazwischen offen", "Vierergruppe: Rang 1 Vorteil, Rang 4 Nachteil"],
    usage: "Die Papierform ist eine Orientierung, keine Siegchance: Aufstellung, Platzrollen, Karten und Belastung entscheiden, wer wirklich gewinnt.",
  },
  {
    id: "auf-abstieg",
    term: "Auf- und Abstieg",
    aliases: ["aufstieg", "abstieg", "liga 1", "liga 2", "zwei ligen", "liga-split", "ligen", "aufsteiger", "absteiger"],
    category: "System",
    short: "Zwei Ligen mit je 16 Teams; drei steigen auf, drei ab.",
    meaning:
      "Es gibt Liga 1 und Liga 2 mit je 16 Teams. Beide spielen parallel dieselben Disziplinen, jede Liga hat ihre eigene Tabelle. Am Saisonende steigen die drei Besten der Liga 2 auf und die drei Letzten der Liga 1 ab.",
    factors: ["2 × 16 Teams, eigene Tabelle je Liga", "20 Spieltage, je Spieltag zwei Disziplinen", "drei Auf- und drei Absteiger", "Titel (Liga 1), Aufstieg (Liga 2) und Abstieg (Liga 1) sind die drei Rennen der Saison"],
    usage: "Rechne in der zweiten Saisonhälfte mit den Linien: wer bei höchstens 4 Punkten je Spieltag rechnerisch nicht mehr herankommt, ist raus.",
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
    term: "Duellpunkte",
    aliases: ["punkte", "points", "saisonpunkte", "tagespunkte", "season points", "matchday points", "bonuspunkte", "duellpunkte", "duell", "sieg", "remis", "niederlage", "tabellenpunkte", "ergebnisskala", "punkteverhältnis", "7 : 4"],
    category: "Spieltag",
    short: "Sieg 2 Punkte, Remis 1, Niederlage 0 — je Disziplin, zwei Disziplinen je Spieltag.",
    meaning:
      "Die Tabelle zählt Duellpunkte. Je Spieltag trittst du in zwei Disziplinen gegen dein Gegnerteam an; jedes Duell bringt 2 Punkte für den Sieg, 1 für ein Remis, 0 für die Niederlage. Mehr als 4 Punkte sind an einem Spieltag nicht möglich. Bei Punktgleichheit entscheidet das Punkteverhältnis. In den Vierergruppen (z. B. Mini-DM, Battlefield) bekommt Platz 1 zwei Punkte, Platz 2 einen, die übrigen keinen.",
    factors: ["Sieg 2 · Remis 1 · Niederlage 0 je Disziplin", "höchstens 4 Punkte je Spieltag (2 Disziplinen × 2)", "Ergebnisskala: je Seite 0–10, Kantersieg 10:0, ein Median-Sieg etwa 7:4; ein Remis bleibt ein Remis", "S-U-N = Siege, Unentschieden, Niederlagen aus den Duellen, nicht aus Spielen"],
    usage: "Plane je Spieltag zwei Duelle, nicht ein Spiel. Der Abstand auf der Ergebnisskala zählt nur als Tiebreaker, nicht als Extrapunkte.",
  },
  {
    id: "intensität",
    term: "Intensität",
    aliases: ["intensität", "intensity", "leicht", "mittel", "hart", "trainingsintensität"],
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
  return (
    term
      .trim()
      .toLowerCase()
      .replaceAll(".", "")
      .replaceAll("ø", "")
      .replaceAll("Δ", "delta")
      // F5: Umlaute falten, damit „gesamtstärke" und „gesamtstaerke" dasselbe
      // treffen — die Daten führen nur noch die echte Umlaut-Schreibweise,
      // statt jede Schreibweise doppelt als Alias-Chip zu zeigen.
      .replaceAll("ä", "ae")
      .replaceAll("ö", "oe")
      .replaceAll("ü", "ue")
      .replaceAll("ß", "ss")
      .replace(/\s+/g, " ")
  );
}

/** Wortliste eines normalisierten Begriffs ("zins-range" → ["zins", "range"]). */
function gameEncyclopediaWords(value: string): string[] {
  return value.split(/[^a-z0-9]+/).filter(Boolean);
}

export function getGameEncyclopediaEntry(term: string | null | undefined) {
  if (!term) return null;
  const normalized = normalizeGameEncyclopediaTerm(term);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const termWords = new Set(gameEncyclopediaWords(normalized));

  return (
    GAME_ENCYCLOPEDIA_ENTRIES.find((entry) => {
      const values = [entry.id, entry.term, ...entry.aliases].map((value) => normalizeGameEncyclopediaTerm(value));
      return values.some((value) => value === normalized || value.replace(/[^a-z0-9]/g, "") === compact);
    }) ??
    GAME_ENCYCLOPEDIA_ENTRIES.find((entry) =>
      [entry.id, entry.term, ...entry.aliases]
        .map((value) => normalizeGameEncyclopediaTerm(value))
        // Only fuzzy-match values with real length: a 2-char term like "CA"/"PO"
        // would otherwise match unrelated labels ("Cash" → CA). Short terms
        // still resolve exactly via the first find() above.
        .filter((value) => value.replace(/[^a-z0-9]/g, "").length >= 3)
        // Fuzzy = GANZE Wörter, keine Substrings (W1-Befund 2): der alte
        // includes()-Match ließ "Zins-Range" die "Rang"-Erklärung treffen und
        // gab der Disziplin-Spalte "speed-schach" (SCH/Schach) den
        // POW/SPE/MEN/SOC-Achsen-Tooltip, weil "spe" irgendwo im String vorkam.
        // Jetzt matcht ein Alias nur, wenn jedes seiner Wörter als eigenes Wort
        // im gesuchten Begriff steht ("PP POW" → Alias "pow" ✓, "speed-schach"
        // → Alias "spe" ✗).
        .some((value) => {
          const valueWords = gameEncyclopediaWords(value);
          return valueWords.length > 0 && valueWords.every((word) => termWords.has(word));
        }),
    ) ??
    null
  );
}

export function getGameTermTooltip(term: string | null | undefined) {
  const entry = getGameEncyclopediaEntry(term);
  return entry ? `${entry.term}: ${entry.short} Klick öffnet das Lexikon.` : null;
}

/**
 * Kurztooltip ohne Lexikon-Hinweis — für reine Hover-Kontexte (Chips/Badges),
 * die das Lexikon nicht per Klick öffnen. Nutzt dieselbe Enzyklopädie-Quelle.
 */
export function getGameTermShort(term: string | null | undefined) {
  const entry = getGameEncyclopediaEntry(term);
  return entry ? `${entry.term}: ${entry.short}` : null;
}

export type GameEncyclopediaGroup = {
  category: GameEncyclopediaEntry["category"];
  entries: GameEncyclopediaEntry[];
};

/**
 * Gruppiert Lexikon-Einträge nach Kategorie in stabiler Reihenfolge
 * (`GAME_ENCYCLOPEDIA_CATEGORIES`) für einen strukturierten Index mit
 * Kategorie-Headern statt einer flachen Liste. Leere Kategorien werden
 * übersprungen.
 */
export function groupGameEncyclopediaEntriesByCategory(
  entries: GameEncyclopediaEntry[] = GAME_ENCYCLOPEDIA_ENTRIES,
): GameEncyclopediaGroup[] {
  return GAME_ENCYCLOPEDIA_CATEGORIES.map((category) => ({
    category,
    entries: entries.filter((entry) => entry.category === category),
  })).filter((group) => group.entries.length > 0);
}

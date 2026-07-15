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
    short: "Gesamtstaerke als schneller Vergleichswert.",
    meaning:
      "OVR fasst den aktuellen Spielerwert kompakt zusammen. Es ist gut zum Scannen, aber nicht automatisch der beste Spieltagswert.",
    factors: [
      "Kernwerte und Attributprofil",
      "Disziplinprofil und Breite des Spielers",
      "gespeicherte Saisonleistung wie PPs und MVS, sobald vorhanden",
      "Normalisierung gegen den aktuellen Spielerpool",
    ],
    usage: "Nutze OVR zum schnellen Vorsortieren. Fuer Lineups sind Disziplinwert, Slotrolle, Fatigue, Form und Mutatoren wichtiger.",
    caveat: "Ein hoher OVR-Spieler kann in der falschen Disziplin schlechter sein als ein Spezialist mit niedrigerem OVR.",
  },
  {
    id: "pps",
    term: "PPs",
    aliases: ["pps", "pps vs pps", "player points", "season points", "punkte beitrag", "punktebeitrag", "d1 pps", "d2 pps", "total pps", "punkte pro spieltag"],
    category: "Kennzahl",
    short: "Echter Punktebeitrag aus gespielten Wettbewerben; Team-PPs = Summe der Spieler-PPs.",
    meaning:
      "PPs sind die pro Disziplin über die Rank-to-Points-Logik vergebenen Punkte. Sie werden dem Team gutgeschrieben, lassen sich aber genauso auf die einzelnen Spieler herunterbrechen — die Summe der Spieler-PPs eines Teams ergibt exakt die Team-PPs. Es gibt keine getrennte 'PPS'-Kennzahl: PPS und PPs meinen dasselbe.",
    factors: [
      "PPs = Rang→Punkte einer Disziplin (dem Team gutgeschrieben)",
      "erscheinen als D1 PPs, D2 PPs und Total PPs",
      "Summe aller Spieler-PPs eines Teams = die Team-PPs",
      "über die Saison akkumulieren sich die PPs zum Saison-Punktebeitrag",
    ],
    usage: "Nutze PPs sowohl für einen einzelnen Spieltag als auch — aufsummiert — für Saisonimpact und Value.",
    caveat: "PPs hängen auch davon ab, wie oft und wo ein Spieler eingesetzt wurde — früher als 'PPS vs PPs' getrennt geschrieben, ist es dieselbe Kennzahl.",
  },
  {
    id: "mvs",
    term: "MVS",
    aliases: ["matchday value score", "value score", "matchday value"],
    category: "Kennzahl",
    short: "Matchday Value Score fuer praktischen Spieltagsnutzen.",
    meaning:
      "MVS bewertet, wie nuetzlich ein Spieler im Saison- und Spieltagskontext war. Er schaut nicht nur auf reine Staerke, sondern auf verwertbaren Impact.",
    factors: [
      "Disziplin-Rankpunkte und starke Einsaetze",
      "Clutch-Disziplinen und Top-Platzierungen",
      "Vielseitigkeit ueber mehrere Disziplinen",
      "Anzahl und Qualitaet der Einsaetze",
    ],
    usage: "Nutze MVS fuer Value-Fragen: Wer hilft wirklich, wer sieht nur auf dem Papier gut aus, wer ist sein Gehalt wert?",
    caveat: "MVS braucht gespeicherte Saisonleistung. Bei neuen Free Agents ist er bewusst oft nicht sichtbar.",
  },
  {
    id: "mw",
    term: "MW",
    aliases: ["marktwert", "market value", "wert"],
    category: "Finanzen",
    short: "Wirtschaftlicher Spielerwert fuer Kaufen, Verkaufen und Kaderwert.",
    meaning:
      "MW ist die grobe Marktwert-Sicht. Er verbindet sportliche Qualitaet mit Alterung des Saves, Leistung, Nachfrage und wirtschaftlichem Kontext.",
    factors: ["OVR und Leistungsprofil", "MVS/PPs, wenn belegt", "Rolle, Bedarf und Roster-Kontext", "Vertrags- und Gehaltsdruck"],
    usage: "Nutze MW fuer Deal-Gefuehl und Verkaufspotenzial. Vergleiche ihn immer mit Gehalt und Bedarf.",
    caveat: "MW ist keine Kaufempfehlung. Ein billiger Spieler mit perfektem Slotfit kann wertvoller sein.",
  },
  {
    id: "value",
    term: "Value",
    aliases: ["preis leistung", "preis/leistung", "ratio", "pps pro gehalt"],
    category: "Finanzen",
    short: "Sportlicher Nutzen im Verhaeltnis zu Kosten.",
    meaning:
      "Value beantwortet die Managerfrage: Bekomme ich fuer Gehalt, Cash oder Slotverbrauch genug Wirkung zurueck?",
    factors: ["PPs und MVS", "Gehalt und Marktwert", "Kaderbedarf", "Rolle im Team", "Risiko durch Vertrag, Fatigue oder Moral"],
    usage: "Nutze Value bei Verkaufsfragen, Vertragsdruck und Transfermarkt-Vergleichen.",
  },
  {
    id: "push",
    term: "Push",
    aliases: ["boost", "einsatzstufe", "schonen", "normal"],
    category: "Spieltag",
    short: "Teamweite Intensitaet fuer den Spieltag.",
    meaning:
      "Push, Normal und Schonen veraendern die Spieltagsleistung und das Risiko. Der Effekt kommt on top auf den Slotscore.",
    factors: ["Team-Intensitaet", "Fatigue- und Risiko-Modell", "GM-/AI-Entscheidung", "aktuelle Saisonlage"],
    usage: "Push lohnt sich, wenn ein Rang kippen kann oder ein wichtiger Spieltag verteidigt werden muss.",
    caveat: "Mehr Push ist nicht immer besser. Er kann Erschoepfung und Folgerisiken erhoehen.",
  },
  {
    id: "captain",
    term: "Captain",
    aliases: ["kapitaen", "kapitän", "captain bonus"],
    category: "Spieltag",
    short: "Limitierter Bonus fuer einen wichtigen Spieler/Slot.",
    meaning:
      "Captain verstaerkt einen konkreten Einsatz. Weil die Anzahl pro Saison begrenzt ist, ist der Timing-Wert oft wichtiger als der reine Bonus.",
    factors: ["Spieler-Score", "Disziplin-Groesse", "Saisonlimit", "GM-Risikostil", "Rangpotenzial der Disziplin"],
    usage: "Setze Captain dort, wo ein starker Spieler einen Rang wirklich drehen oder absichern kann.",
  },
  {
    id: "mutatoren",
    term: "Mutatoren",
    aliases: ["mutator", "traits", "trait bonus"],
    category: "Spieltag",
    short: "Disziplin-Tags, die passende Spieler im Score belohnen.",
    meaning:
      "Jede Disziplin kann Mutatoren haben. Eingesetzte Spieler mit passenden Traits bekommen zusaetzlichen Score; das macht Teamidentitaet und Spezialisten wichtiger.",
    factors: ["zwei Mutatoren pro Disziplin", "passende positive/negative Trait-Tags", "aktive eingesetzte Spieler", "Scorebonus pro Treffer"],
    usage: "Nutze Mutatoren, um Spezialisten in engen Disziplinen zu finden und AI-Lineups besser zu verstehen.",
  },
  {
    id: "xp",
    term: "XP",
    aliases: ["entwicklung", "progression", "training xp", "netto xp"],
    category: "Training",
    short: "Entwicklungspunkte fuer Wachstum, Erhalt und Rueckschritt.",
    meaning:
      "XP entsteht aus Training und Performance. Netto-XP zeigt, ob ein Spieler eher wachsen, stabil bleiben oder regressieren wird.",
    factors: ["Trainingsmodus", "Einsaetze", "MVS und gedeckelte PPs", "Gebaeude", "Potential", "Trait-Bonus und Trait-Malus"],
    usage: "Nutze XP, um zu entscheiden, wer hart trainiert, wer geschont wird und wo Upgrades sinnvoll sind.",
    caveat: "Baseline und Regression koennen Wachstum auffressen, wenn ein Spieler wenig spielt oder schlecht passt.",
  },
  {
    id: "pow-spe-men-soc",
    term: "POW / SPE / MEN / SOC",
    aliases: ["pow", "spe", "men", "soc", "achsen", "attributes"],
    category: "Kader",
    short: "Vier Hauptachsen fuer Spieler, Teams und Disziplinen.",
    meaning:
      "POW, SPE, MEN und SOC sind die groben Leistungsachsen. Disziplinen gewichten sie unterschiedlich, Slotrollen koennen diese Gewichtung weiter drehen.",
    factors: ["Attribute des Spielers", "Disziplingewichtung", "Slotrolle", "Teamprofil und Powers", "Training und Progression"],
    usage: "Nutze die Achsen, um zu verstehen, warum ein Team in bestimmten Disziplinen stark oder schwach ist.",
  },
  {
    id: "ca",
    term: "CA",
    aliases: ["current ability", "aktuelle staerke", "aktuelle stärke", "ist-staerke", "ca-sterne"],
    category: "Kader",
    short: "Aktuelle Spielstaerke — was der Spieler heute kann.",
    meaning:
      "CA (Current Ability) ist der Ist-Wert eines Spielers, als Sterne oder Score. Im Gegensatz zum Potenzial zeigt CA die heutige Leistungsfaehigkeit, nicht die maximale Ausbaustufe.",
    factors: ["Attributprofil und Achsen", "Disziplinbreite", "Alter und Form", "bisherige Entwicklung"],
    usage: "Nutze CA fuer den direkten Leistungsvergleich zweier Spieler. Fuer die Zukunft zaehlt zusaetzlich das Potenzial (PO).",
    caveat: "Bei unvollstaendigem Scouting ist CA nur geschaetzt (Range).",
  },
  {
    id: "po",
    term: "PO",
    aliases: ["potenzial", "potential", "po-range", "potenzialdecke", "potenzialband"],
    category: "Kader",
    short: "Potenzial — die maximale Ausbaustufe eines Spielers.",
    meaning:
      "PO (Potenzial) ist die Obergrenze, auf die ein Spieler mit Training wachsen kann. Bei unvollstaendigem Scouting als Bereich angezeigt (z. B. 2.5–4.0 Sterne). Je hoeher PO, desto groesser der Trainingsertrag.",
    factors: ["Talent/Anlage", "Alter (Restwachstum)", "Scouting-Sicherheit (Range-Breite)"],
    usage: "Nutze PO, um Entwicklungsspieler zu erkennen. Die Luecke zwischen CA und PO ist der Wachstumsspielraum.",
    caveat: "Ein hohes PO ist kein Versprechen — schlechtes Training oder wenig Einsatz lassen es ungenutzt.",
  },
  {
    id: "fit",
    term: "Fit",
    aliases: ["team-fit", "team fit", "kaderfit", "passung"],
    category: "Finanzen",
    short: "Wie gut ein Marktspieler zum eigenen Kaderprofil passt.",
    meaning:
      "Fit misst, wie gut ein Transferkandidat auf die Achsen- und Bedarfsprofile des eigenen Teams passt. Hoher Fit macht Wechsel und Vertrag guenstiger und wirksamer, negativer Fit teurer und riskanter.",
    factors: ["Achsenprofil vs. Teamluecken", "Slot-/Rollenpassung", "Kaderbedarf (Bedarf)", "Disziplinabdeckung"],
    usage: "Nutze Fit als Schnellsignal im Transfermarkt: Passt der Spieler ueberhaupt zu uns, bevor du auf MW und Gehalt schaust?",
  },
  {
    id: "bedarf",
    term: "Bedarf",
    aliases: ["kaderbedarf", "need", "needmatch", "need match", "bedarfssignal"],
    category: "Kader",
    short: "In welchen Bereichen dem Team Staerke fehlt.",
    meaning:
      "Bedarf markiert Achsen oder Disziplinen, in denen der Kader schwach ist, und wie stark ein Kandidat diese Luecke schliessen wuerde. Als Sortier- und Signal-Chip im Transfermarkt.",
    factors: ["Team-Achsenprofil", "Kadertiefe pro Rolle", "Disziplinabdeckung", "needMatchScore des Kandidaten"],
    usage: "Nutze Bedarf, um gezielt die richtigen Luecken zu fuellen, statt nur den staerksten verfuegbaren Spieler zu holen.",
  },
  {
    id: "tier-badge",
    term: "Tier",
    aliases: ["tier badge", "s+", "buchstaben-tier", "klasse-tier", "abstufung"],
    category: "Kennzahl",
    short: "Buchstaben-Ranking eines Werts (S+ bis F).",
    meaning:
      "Tier-Badges uebersetzen einen Score in eine Schulnoten-artige Klasse: S+ (Spitze) ueber S, A, B, C, D, E bis F (schwach). Fuer schnellen Klassenvergleich von Attributen oder Disziplin-Scores.",
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
      "Intel (Konfidenz) ist die Scouting-Sicherheit in Prozent. Niedrige Intel bedeutet breite Wertebereiche und verdeckte Traits; hohe Intel zeigt echte Werte statt Schaetzungen.",
    factors: ["Scouting-Fortschritt am Spieler", "Facility-Level Scouting", "vergangene Spieltage im Fokus"],
    usage: "Nutze Intel, um zu wissen, wie sehr du den angezeigten CA/PO trauen kannst, bevor du Geld ausgibst.",
  },
  {
    id: "scouting-level",
    term: "Scouting-Level",
    aliases: ["scouting l", "scout level", "erkenntnisstufe", "scouting-stufe"],
    category: "Kader",
    short: "Erkenntnisstufe eines Spielers (Gesichtet bis Vollstaendig).",
    meaning:
      "Das Scouting-Level fasst Facility-Level und Intel zu Stufen zusammen: Gesichtet, Beobachtet, Analysiert, Vertieft, Durchleuchtet, Vollstaendig. Es steuert, wie viel echte Werte statt Ranges du siehst.",
    factors: ["Facility-Level Scouting", "Intel/Konfidenz des Spielers", "Fokus-Scouting ueber Zeit"],
    usage: "Nutze das Level, um zu entscheiden, ob ein Kandidat schon reif fuer eine Kaufentscheidung ist.",
  },
  {
    id: "fatigue",
    term: "Fatigue",
    aliases: ["ermuedung", "ermüdung", "erschoepfung", "erschöpfung", "belastung"],
    category: "Spieltag",
    short: "Angesammelte Belastung, die Leistung senkt und Risiko erhoeht.",
    meaning:
      "Fatigue ist die Ermuedung eines Spielers. Hohe Fatigue senkt die Spieltagsleistung und erhoeht Verletzungs- und Rueckschritt-Risiko. Sie steigt durch Einsaetze und Push und sinkt durch Erholung/Schonen.",
    factors: ["Einsaetze und Minuten", "Push-Intensitaet", "Regeneration und Trainingsmodus", "Alter"],
    usage: "Nutze Fatigue, um Spieler rechtzeitig zu schonen, bevor Leistung faellt oder eine Verletzung droht.",
  },
  {
    id: "netto-forecast",
    term: "Netto-Forecast",
    aliases: ["netto forecast", "netto", "setpoints forecast", "sp-forecast", "entwicklungsforecast"],
    category: "Training",
    short: "Prognostizierte Saison-Attributaenderung in Setpoints.",
    meaning:
      "Der Netto-Forecast ist Training plus Performance minus Regression ueber alle Attribute, gemessen in Setpoints (SP). Er zeigt die Saisonend-Tendenz: ab etwa +2 SP waechst der Spieler, unter 0 faellt er.",
    factors: ["Trainingsmodus und Facility", "Einsatzleistung", "Regressions-Druck", "Potenzial-Multiplikator"],
    usage: "Nutze den Netto-Forecast, um zu sehen, wer sich entwickelt und wo Training oder Einsatz nachgesteuert werden muss.",
    caveat: "Es ist eine Saison-Tendenz, kein Sofort-Upgrade.",
  },
  {
    id: "regression",
    term: "Rueckschritt-Risiko",
    aliases: ["regression", "rückschritt-risiko", "regressions-druck", "regressionspressure", "rueckschritt"],
    category: "Training",
    short: "Druck, der Attribute schrumpfen laesst.",
    meaning:
      "Das Rueckschritt-Risiko (Regression) beschreibt den Druck aus Alterung, Marktwert-Erwartung und Belastung, der Attribute abbauen laesst. Hohes Risiko kann einen positiven Netto-Forecast ins Minus kippen.",
    factors: ["Alter", "Marktwert-/Erwartungsdruck", "Fatigue und Einsatzmangel", "Naehe zur Potenzialdecke"],
    usage: "Nutze das Risiko, um gefaehrdete Spieler frueh mit Training oder Einsatz zu stabilisieren.",
  },
  {
    id: "guv",
    term: "GuV",
    aliases: ["gewinn und verlust", "gewinn/verlust", "profit loss", "transfer-guv", "p/l"],
    category: "Finanzen",
    short: "Gewinn oder Verlust eines Transfers.",
    meaning:
      "GuV (Gewinn und Verlust) ist die Differenz aus Verkaufserloes und Einstands-/Buchwert eines Spielers. Kennzahl der Transfer-Historie und der Saison-Bilanz.",
    factors: ["Verkaufspreis", "Kaufpreis/Buchwert", "Marktwert-Entwicklung", "Vertragsrestwert"],
    usage: "Nutze GuV, um zu sehen, ob deine Transferpolitik ueber die Saison Geld verdient oder verbrennt.",
  },
  {
    id: "setpoints",
    term: "Setpoints",
    aliases: ["sp", "trainingspunkte", "attributpunkte", "setpoint"],
    category: "Training",
    short: "Einheit fuer Trainings- und Attributwachstum (SP).",
    meaning:
      "Setpoints (SP) sind die Einheit, in der Wachstumsbudget, Attributzuwachs und der Netto-Forecast gemessen werden. Mehr SP bedeuten mehr echte Attributentwicklung.",
    factors: ["Trainingsmodus", "Potenzial-Multiplikator", "Facility-Boni", "Einsatzleistung"],
    usage: "Nutze SP als Waehrung der Entwicklung: Wohin fliesst das knappe Wachstumsbudget?",
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
    short: "Vergleichsgruppe fuer den Verkaufspreis.",
    meaning:
      "Ein Bracket ist die Gruppe vergleichbarer Spieler (nach MVS), in die ein Spieler fuer die Preisfindung einsortiert wird. Der Rang innerhalb der Bracket-Gruppe beeinflusst den erzielbaren Preis.",
    factors: ["MVS des Spielers", "Groesse der Bracket-Gruppe", "Rang innerhalb der Gruppe"],
    usage: "Nutze das Bracket, um realistisch einzuschaetzen, was ein Spieler am Markt bringt.",
  },
  {
    id: "board",
    term: "Board",
    aliases: ["vereinsfuehrung", "front office", "board-rating", "vorstand"],
    category: "System",
    short: "Bewertung des Managers durch die Vereinsfuehrung.",
    meaning:
      "Das Board ist die Vereinsfuehrung. Das Board-Rating drueckt aus, wie zufrieden sie mit dir sind. Ein niedriges Rating gefaehrdet den Job.",
    factors: ["Zielerfuellung", "sportliche und wirtschaftliche Lage", "Erwartungen der Saison"],
    usage: "Beobachte das Board-Rating, um zu wissen, wie sicher dein Posten ist.",
  },
  {
    id: "board-druck",
    term: "Druck",
    aliases: ["board-druck", "boardpressure", "erwartungsdruck", "jobsicherheit"],
    category: "System",
    short: "Erwartungsdruck des Boards auf den Manager.",
    meaning:
      "Druck (Board-Druck) misst, wie stark die Vereinsfuehrung auf Ergebnisse draengt. Er steigt, wenn Board-Ziele verfehlt werden, und senkt die Jobsicherheit.",
    factors: ["Status der Board-Ziele", "juengste Ergebnisse", "Saisonerwartung"],
    usage: "Hoher Druck heisst: liefere bei den Board-Zielen, bevor der Job wackelt.",
  },
  {
    id: "board-ziele",
    term: "Board-Ziele",
    aliases: ["board objectives", "saisonziele", "board-ziel", "objectives"],
    category: "System",
    short: "Vom Board gesetzte Saisonziele mit Status.",
    meaning:
      "Board-Ziele sind die Vorgaben der Vereinsfuehrung fuer die Saison, jeweils mit Ist-/Zielwert und Status (u. a. auf Kurs, unter Druck, verfehlt). Ihre Erfuellung steuert Board-Rating und Druck.",
    factors: ["Tabellenplatz/Punkte", "wirtschaftliche Vorgaben", "spezielle Auflagen", "verbleibende Spieltage"],
    usage: "Priorisiere gefaehrdete Board-Ziele — sie entscheiden ueber Jobsicherheit und Boni.",
  },
  {
    id: "formkarten",
    term: "Formkarten",
    aliases: ["formkarte", "form", "form-karten", "formcards"],
    category: "Spieltag",
    short: "Pro Disziplin-Seite zuweisbare Karten, die den Spieltag beeinflussen.",
    meaning:
      "Formkarten werden pro Disziplin-Seite (D1/D2) gesetzt und veraendern die Spieltagsleistung. 'Form offen' bedeutet, dass noch keine Karte zugewiesen ist. Negative Formkarten koennen am Saisonende Strafpunkte kosten, wenn sie ungenutzt bleiben.",
    factors: ["zugewiesene Karten je Seite", "positive vs. negative Karten", "Timing im Spieltag"],
    usage: "Setze Formkarten vor dem Spieltag bewusst — offene oder ungenutzte negative Karten sind verschenkt oder riskant.",
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
        // Only fuzzy-match values with real length: a 2-char term like "CA"/"PO"
        // would otherwise substring-match unrelated labels ("Cash" → CA). Short
        // terms still resolve exactly via the first find() above.
        .filter((value) => value.replace(/[^a-z0-9]/g, "").length >= 3)
        .some((value) => normalized.includes(value) || compact.includes(value.replace(/[^a-z0-9]/g, ""))),
    ) ??
    null
  );
}

export function getGameTermTooltip(term: string | null | undefined) {
  const entry = getGameEncyclopediaEntry(term);
  return entry ? `${entry.term}: ${entry.short} Klick oeffnet das Lexikon.` : null;
}

/**
 * Kurztooltip ohne Lexikon-Hinweis — fuer reine Hover-Kontexte (Chips/Badges),
 * die das Lexikon nicht per Klick oeffnen. Nutzt dieselbe Enzyklopaedie-Quelle.
 */
export function getGameTermShort(term: string | null | undefined) {
  const entry = getGameEncyclopediaEntry(term);
  return entry ? `${entry.term}: ${entry.short}` : null;
}

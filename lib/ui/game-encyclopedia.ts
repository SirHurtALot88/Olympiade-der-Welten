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

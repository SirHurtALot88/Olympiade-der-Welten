/**
 * PIXEL-SZENEN JE DISZIPLIN — die Pixel-Art-Arenen (Spielfeld, Tribüne, HUD) aus der
 * Asset-Runde vom 01./02.11., als Quelldateien unter `public/szenen/<disziplinId>/`.
 *
 * KEINE DEMOS MEHR IM SPIEL (11.11., Chris: „KEINE DEMOS mehr! das soll nicht einfach abgespult
 * werden! das muss sauber simuliert sein durch unsere engine und das in JEDER disziplin").
 * Die selbstlaufenden HTML-Szenen (`demo`) spielen einen festen Ablauf mit den Demo-Figuren der
 * Asset-Runde (Kiti, Wurzelbert, Arlen, Johanna …) und sind NICHT an den Spieltag gekoppelt; ihre
 * Standbilder (`poster`) tragen dieselben Demo-Figuren eingebrannt. Beides bleibt nur noch als
 * QUELLE für die Werkzeuge liegen (scripts/baue-arena-kulissen.py schneidet daraus die sauberen
 * Hintergründe der Battle Arena, die Szenen-Tests prüfen die Varianten) — gezeigt wird im Spiel
 * keins von beiden. Die Pixel-Arena über der Bühne zeigt stattdessen `kulisse`: denselben
 * Hintergrund, den der Motor in der Battle Arena zeichnet (`public/sprites/kulissen/…`, ohne
 * Demo-Figuren, Hindernisse zugemalt), plus die echte eigene Aufstellung. Das eigentliche Spiel
 * mit den echten Figuren läuft in der Battle Arena (Battle Mode) bzw. auf der Bühne darunter.
 *
 * Schluessel = disziplinId wie in `NATIVE_PRIMITIVE` (DisciplineStageArena.tsx).
 */

export type DisciplineSceneVariant = {
  id: string;
  label: string;
  /** Selbstlaufende Demo-Szene (HTML) — nur noch Werkzeug-Quelle, im Spiel nie gezeigt. */
  demo: string | null;
  /** Standbild der Demo-Szene (mit eingebrannten Demo-Figuren) — nur noch Werkzeug-Quelle. */
  poster: string;
  /** Sauberer Hintergrund ohne Demo-Figuren (dieselbe Datei wie in der Battle Arena), `null` = keiner. */
  kulisse: string | null;
};

export type DisciplineScene = {
  disciplineId: string;
  title: string;
  /** Ein Satz, was in der Szene zu sehen ist (aus der Asset-Galerie). */
  note: string;
  variants: DisciplineSceneVariant[];
};

const S = "/szenen";
const K = "/sprites/kulissen";

/** Varianten, fuer die scripts/baue-arena-kulissen.py (noch) keinen sauberen Hintergrund
 *  geschnitten hat — dort zeigt die Pixel-Arena kein Bild statt eines Demo-Standbilds.
 *  tests/discipline-scenes.test.ts haelt die Liste mit public/sprites/kulissen/ deckungsgleich. */
const OHNE_KULISSE = new Set([
  "staffel/stabwechsel",
  "takeshis-castle/burg",
  "takeshis-castle/eisfestung",
  "takeshis-castle/dschungel",
  "speed-schach/turniersaal",
]);

function kulisseVon(disciplineId: string, id: string): string | null {
  return OHNE_KULISSE.has(`${disciplineId}/${id}`) ? null : `${K}/${disciplineId}/${id}.jpg`;
}

function v(disciplineId: string, id: string, label: string, opts?: { demo?: string | null; poster?: string }): DisciplineSceneVariant {
  return {
    id,
    label,
    demo: opts?.demo === undefined ? `${S}/${disciplineId}/${id}.html` : opts.demo,
    poster: opts?.poster ?? `${S}/${disciplineId}/${id}.jpg`,
    kulisse: kulisseVon(disciplineId, id),
  };
}

function zeitfahrenKarte(id: string, label: string): DisciplineSceneVariant {
  return {
    id,
    label,
    demo: `${S}/time-trial/${id}/index.html`,
    poster: `${S}/time-trial/${id}/poster.jpg`,
    kulisse: kulisseVon("time-trial", id),
  };
}

export const DISCIPLINE_SCENES: Record<string, DisciplineScene> = {
  staffel: {
    disciplineId: "staffel",
    title: "Staffel",
    note: "Komplette Laufbahn als ein Asset, Tartan-Korn, Wechselzonen und Stabwechsel in der Zone.",
    variants: [v("staffel", "arena", "Die Runde"), v("staffel", "stabwechsel", "Stabwechsel")],
  },
  spurt: {
    disciplineId: "spurt",
    title: "Spurt (HYROX)",
    note: "Laufschleife mit Stationen, Zuschauern und wartenden Teamkollegen.",
    // Bis 03.11. nur das Standbild hyrox.jpg (demo: null). kurs.html war die erste abspielbare
    // Demo-Szene (scripts/baue-spurt-szene.py); im Spiel steht seit 11.11. nur die Kulisse.
    variants: [v("spurt", "kurs", "HYROX-Kurs")],
  },
  "takeshis-castle": {
    disciplineId: "takeshis-castle",
    title: "Takeshi's Castle",
    note: "14 Fallen von der Wackelbrücke bis zum Schlosstor, Nerven-Meter, „AUS“-Floß im Wassergraben.",
    // Eisfestung + Dschungel: Kulissen-Varianten vom 03.11. (scripts/baue-szenen-varianten-2.py) —
    // dieselben 14 Fallen an denselben Stellen, nur ein anderer Ort rund um die Bahn.
    variants: [
      v("takeshis-castle", "burg", "Burg-Parcours"),
      v("takeshis-castle", "eisfestung", "Eisfestung"),
      v("takeshis-castle", "dschungel", "Dschungeltempel"),
    ],
  },
  "mini-dm": {
    disciplineId: "mini-dm",
    title: "Mini-DM",
    note: "Arenen mit eigener Falle in der Mitte.",
    variants: [
      v("mini-dm", "basis", "Grube"),
      v("mini-dm", "saegewerk", "Sägewerk"),
      v("mini-dm", "strom-kaefig", "Strom-Käfig"),
    ],
  },
  battlefield: {
    disciplineId: "battlefield",
    title: "Battlefield",
    note: "Drei Eroberungspunkte mit eigenen Landmarken (Turm, Altar, Brückenkopf).",
    // Zweiter Schauplatz vom 03.11.: Wüstenruine (Sand statt Wiese, Lehmwege, Sandsteinmauern,
    // ausgetrocknetes Wadi, Kakteen, Säulenstümpfe, Flugsand) — Heimorte, Punkte A/B/C, Wege und
    // die ganze Vierer-Pod-Logik unverändert, nur die Kulisse ist neu.
    variants: [v("battlefield", "eroberung", "Eroberung"), v("battlefield", "wuestenruine", "Wüstenruine")],
  },
  "time-trial": {
    disciplineId: "time-trial",
    title: "Zeitfahren",
    note: "Streckenprofile mit echtem Stamina-Effekt, gestaffelter Start.",
    variants: [
      v("time-trial", "standard", "Standard"),
      zeitfahrenKarte("bergzeitfahren-alpen", "Bergzeitfahren Alpen"),
      zeitfahrenKarte("etappe-pass", "Etappe Pass"),
      zeitfahrenKarte("abfahrt-kamm", "Abfahrt Kamm"),
      zeitfahrenKarte("etappe-kueste", "Etappe Küste"),
      zeitfahrenKarte("flachsprint-kueste", "Flachsprint Küste"),
      zeitfahrenKarte("etappe-mittelgebirge", "Mittelgebirge"),
      zeitfahrenKarte("huegel-weinberge", "Hügel & Weinberge"),
      zeitfahrenKarte("etappe-strade-bianche", "Strade Bianche"),
      zeitfahrenKarte("etappe-vulkan", "Vulkan"),
      zeitfahrenKarte("wueste-hitze", "Wüste & Hitze"),
    ],
  },
  "speed-schach": {
    disciplineId: "speed-schach",
    title: "Speed-Schach",
    note: "Turniersaal mit echtem 8×8-Brett und mechanischer Uhr.",
    // Park + Zug: Kulissen-Varianten vom 03.11. (scripts/baue-szenen-varianten-2.py) — derselbe
    // Zugwechsel an demselben Tisch, nur ein anderer Ort.
    variants: [
      v("speed-schach", "turniersaal", "Turniersaal"),
      v("speed-schach", "park", "Stadtpark"),
      v("speed-schach", "zug", "Speisewagen"),
    ],
  },
  fechten: {
    disciplineId: "fechten",
    title: "Fechten",
    note: "14-m-Piste, Ampellichter, Zeitlupe beim entscheidenden Treffer.",
    // Zweiter Schauplatz vom 03.11.: Gefecht im Burghof (Ringmauer, Bergfried, Ecktürme, Banner in
    // Teamfarben, Kopfsteinpflaster) statt Fechthalle — Piste, Lampen, Bänke und Ablauf unverändert.
    variants: [v("fechten", "piste", "Piste"), v("fechten", "schlosshof", "Schlosshof")],
  },
  tennis: {
    disciplineId: "tennis",
    title: "Tennis",
    note: "Echte ITF-Maße, Ballphysik mit Schwerkraft.",
    // Riviera + Dach: Kulissen-Varianten vom 03.11. (scripts/baue-szenen-varianten-2.py) — derselbe
    // Matchball, dieselben Platzmaße und Ballwege, nur ein anderer Ort.
    variants: [
      v("tennis", "court", "Centre Court"),
      v("tennis", "riviera", "Sandplatz Riviera"),
      v("tennis", "dach", "Hochhausdach"),
    ],
  },
  wettessen: {
    disciplineId: "wettessen",
    title: "Wettessen",
    note: "Jahrmarkt-Bühne mit der echten Wertungstabelle live eingeblendet.",
    // Bierzelt: dritter Ort vom 03.11. (scripts/baue-szenen-varianten-2.py), dieselbe Minute an derselben Tafel.
    variants: [
      v("wettessen", "jahrmarkt", "Jahrmarkt"),
      v("wettessen", "nachtmarkt", "Nachtmarkt"),
      v("wettessen", "bierzelt", "Festzelt"),
    ],
  },
  "i-spy": {
    disciplineId: "i-spy",
    title: "I-Spy",
    note: "Schatzsuche mit Mehrwege-Truhen — zwei Lösungswege führen zur selben Truhe.",
    variants: [
      v("i-spy", "ruinengarten", "Ruinengarten"),
      v("i-spy", "aztec", "Aztekentempel"),
      v("i-spy", "lostplace", "Lost Place"),
      v("i-spy", "horror", "Horror"),
    ],
  },
  basketball: {
    disciplineId: "basketball",
    title: "Basketball",
    note: "Parkett mit Maserung, Ballphysik, voller Boxscore.",
    // Zweiter Schauplatz vom 03.11. (scripts/baue-szenen-schauplaetze.py): dasselbe Feld, derselbe
    // Ablauf, aber draussen im Käfig zwischen Backsteinhäusern statt in der Halle.
    variants: [v("basketball", "parkett", "Parkett"), v("basketball", "streetcourt", "Street-Court")],
  },
  gewichtheben: {
    disciplineId: "gewichtheben",
    title: "Gewichtheben (Sandsack-Rennen)",
    note: "Drei Stationen nach echten Engine-Werten (35/80/115 kg), Silo-Rampe.",
    // Hafen + Oase: Kulissen-Varianten vom 03.11. (scripts/baue-szenen-varianten.py) — dieselbe
    // Schicht, dieselben Stationen und Gewichte, nur eine andere Umgebung.
    variants: [
      v("gewichtheben", "sandsack", "Lagerhalle"),
      v("gewichtheben", "hafen", "Hafenkai bei Nacht"),
      v("gewichtheben", "oase", "Oase"),
    ],
  },
  climbing: {
    disciplineId: "climbing",
    title: "Climbing",
    note: "7-m-Wand im echten Maßstab mit Seilsicherung.",
    // Fels + Eis: Kulissen-Varianten vom 03.11. (scripts/baue-szenen-varianten-2.py) — dieselbe
    // Route, dieselben Griffe und Expressen, nur ein anderes Material und ein anderer Ort.
    variants: [
      v("climbing", "wand", "Kletterhalle"),
      v("climbing", "fels", "Sandsteinschlucht"),
      v("climbing", "eis", "Eisfall"),
    ],
  },
  eiskunstlauf: {
    disciplineId: "eiskunstlauf",
    title: "Eiskunstlauf",
    note: "ISU-Eisfläche, Paarlauf mit Spin, Sprung und Sturz.",
    // Zweiter Schauplatz vom 03.11.: Kür auf dem zugefrorenen Waldsee (Alpenglühen, Nadelwald,
    // Kapelle, Schneewall statt Werbebande) statt Eishalle — Eisfläche, Panel und Ablauf unverändert.
    variants: [v("eiskunstlauf", "kuer", "Kür"), v("eiskunstlauf", "waldsee", "Waldsee")],
  },
  showcase: {
    disciplineId: "showcase",
    title: "Showcase",
    note: "Talentshow-Bühne mit LED-Wand, Jury-Buzzer und Golden-Buzzer-Konfetti.",
    // Festival + Zirkus: Kulissen-Varianten vom 03.11. (scripts/baue-szenen-varianten-2.py) — derselbe
    // Auftritt mit derselben Jury und LED-Wertung, nur ein anderer Auftrittsort (die Vorlage ist das Theater).
    variants: [
      v("showcase", "buehne", "Theater"),
      v("showcase", "festival", "Freiluft-Festival"),
      v("showcase", "zirkus", "Zirkuszelt"),
    ],
  },
  football: {
    disciplineId: "football",
    title: "Football",
    note: "NFL-Feldmaße, First-Down-Catch, Boxscore.",
    // Zweiter Schauplatz vom 03.11.: Beach-Football an der Küste (Meer, Palmen, Strandhütten,
    // Sand statt Rasen) statt Flutlicht-Stadion — Feld, Linien, Endzone und Ablauf unverändert.
    variants: [v("football", "feld", "Feld"), v("football", "strand", "Strand")],
  },
  hockey: {
    disciplineId: "hockey",
    title: "Eishockey",
    note: "Eisbahn nach IIHF-Maßen, Strafbank, Schussgeschwindigkeit.",
    // Zweiter Schauplatz vom 03.11.: Freiluft-Eisfeld zwischen verschneiten Bergen, Wald und
    // Hütten statt der Halle — Bahn, Banden, Strafbank und Ablauf unverändert.
    variants: [v("hockey", "eis", "Eisbahn"), v("hockey", "bergsee", "Bergsee")],
  },
  breaking: {
    disciplineId: "breaking",
    title: "Breaking",
    note: "Ausdauer-Zweikampf (Folter, nicht Breakdance): PEINIGT/ERTRÄGT im Wechsel, bis einer aufgibt.",
    variants: [v("breaking", "brutal", "Gauntlet"), v("breaking", "standard", "Erste Fassung")],
  },
  tdm: {
    disciplineId: "tdm",
    title: "TDM",
    note: "Team-Deathmatch-Arenen.",
    variants: [v("tdm", "basis", "Sandarena"), v("tdm", "lava", "Lava"), v("tdm", "frost", "Frost")],
  },
};

export function getDisciplineScene(disciplineId: string | null | undefined): DisciplineScene | null {
  if (!disciplineId) return null;
  return DISCIPLINE_SCENES[disciplineId] ?? null;
}

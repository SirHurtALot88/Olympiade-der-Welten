/**
 * PIXEL-SZENEN JE DISZIPLIN — die neuen Pixel-Art-Arenen (Spielfeld, Tribüne, HUD) aus der
 * Asset-Runde vom 01./02.11., im Spiel unter `public/szenen/<disziplinId>/`.
 *
 * Jede Szene ist eine eigenstaendige, selbstlaufende HTML-Datei (Bilder eingebettet, nur
 * Zeitfahren laedt seine Ebenen aus dem Nachbarordner). Daneben liegt ein Standbild
 * (`poster`), das die Arena zeigt, bevor die Szene geladen wird — die HTML-Dateien sind
 * 0,2–3,8 MB gross und werden deshalb erst auf Klick geladen.
 *
 * WICHTIG — was die Szene ist und was nicht: Sie spielt einen festen Demo-Ablauf mit den
 * Demo-Figuren der Asset-Runde (Kiti, Wurzelbert, Arlen, Johanna …). Sie ist NICHT an das
 * Ergebnis des Spieltags gekoppelt; das Ergebnis kommt weiter aus der Buehne darunter.
 * `focus` beschreibt, welcher Ausschnitt der Demo-Seite die eigentliche Arena ist (die
 * Demo-Seiten tragen daneben Entwickler-Erklaertexte, die Spieler nicht sehen sollen).
 *
 * Schluessel = disziplinId wie in `NATIVE_PRIMITIVE` (DisciplineStageArena.tsx).
 */

export type DisciplineSceneVariant = {
  id: string;
  label: string;
  /** Selbstlaufende Szene (HTML). `null` = es gibt nur das Standbild. */
  demo: string | null;
  poster: string;
};

export type DisciplineScene = {
  disciplineId: string;
  title: string;
  /** Ein Satz, was in der Szene zu sehen ist (aus der Asset-Galerie). */
  note: string;
  variants: DisciplineSceneVariant[];
};

const S = "/szenen";

function v(disciplineId: string, id: string, label: string, opts?: { demo?: string | null; poster?: string }): DisciplineSceneVariant {
  return {
    id,
    label,
    demo: opts?.demo === undefined ? `${S}/${disciplineId}/${id}.html` : opts.demo,
    poster: opts?.poster ?? `${S}/${disciplineId}/${id}.jpg`,
  };
}

function zeitfahrenKarte(id: string, label: string): DisciplineSceneVariant {
  return {
    id,
    label,
    demo: `${S}/time-trial/${id}/index.html`,
    poster: `${S}/time-trial/${id}/poster.jpg`,
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
    // Bis 03.11. nur das Standbild hyrox.jpg (demo: null). kurs.html ist die erste abspielbare
    // Szene: dasselbe Bild als Kulisse, die eingebrannten Figuren herausgenommen, Demo-Figuren
    // laufen darauf (scripts/baue-spurt-szene.py).
    variants: [v("spurt", "kurs", "HYROX-Kurs")],
  },
  "takeshis-castle": {
    disciplineId: "takeshis-castle",
    title: "Takeshi's Castle",
    note: "14 Fallen von der Wackelbrücke bis zum Schlosstor, Nerven-Meter, „AUS“-Floß im Wassergraben.",
    variants: [v("takeshis-castle", "burg", "Burg-Parcours")],
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
    variants: [v("battlefield", "eroberung", "Eroberung")],
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
    variants: [v("speed-schach", "turniersaal", "Turniersaal")],
  },
  fechten: {
    disciplineId: "fechten",
    title: "Fechten",
    note: "14-m-Piste, Ampellichter, Zeitlupe beim entscheidenden Treffer.",
    variants: [v("fechten", "piste", "Piste")],
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
    variants: [v("wettessen", "jahrmarkt", "Jahrmarkt"), v("wettessen", "nachtmarkt", "Nachtmarkt")],
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
    variants: [v("eiskunstlauf", "kuer", "Kür")],
  },
  showcase: {
    disciplineId: "showcase",
    title: "Showcase",
    note: "Talentshow-Bühne mit LED-Wand, Jury-Buzzer und Golden-Buzzer-Konfetti.",
    variants: [v("showcase", "buehne", "Bühne")],
  },
  football: {
    disciplineId: "football",
    title: "Football",
    note: "NFL-Feldmaße, First-Down-Catch, Boxscore.",
    variants: [v("football", "feld", "Feld")],
  },
  hockey: {
    disciplineId: "hockey",
    title: "Eishockey",
    note: "Eisbahn nach IIHF-Maßen, Strafbank, Schussgeschwindigkeit.",
    variants: [v("hockey", "eis", "Eisbahn")],
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

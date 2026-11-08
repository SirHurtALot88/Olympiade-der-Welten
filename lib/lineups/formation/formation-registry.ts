/**
 * FORMATIONS-GEOMETRIE ALLER ZWANZIG DISZIPLINEN — Einsatzliste-Revamp, Ebene A (Mini-Feld).
 *
 * Architektur: `docs/design/einsatzliste-revamp-architektur-08-11.md` Abschnitt 2 (F3/F4).
 * Bild: `docs/design/einsatzliste-gesamtkonzept-visuell-08-11.md` Abschnitte 2–3 und 9.
 *
 * WARUM ES DIESE DATEI GIBT. `LineupNewLook.tsx` kannte bis hierher keinen einzigen Platz auf
 * dem Feld, nur die Reihenfolge der Slots (`slotIndex`). Die Plätze stehen im Arena-Motor
 * (`public/mockups/battle-mode.engine.js`): `SLOT_ZUSATZ.reihe`, `homeFor()`,
 * `BASKETBALL_ROLLE_SLOT`, `SLOTS`/`SLOTS_HOCKEY`, `TORWART_SLOTS`/`QB_SLOTS`/`KICKER_SLOTS`,
 * die `planJeSlot`-Tabellen der fünf Bahn-Disziplinen, `BFFFA_ROLLEN_ORT` und `HEBEN_ROLLEN`.
 *
 * EINE WAHRHEIT, NICHT ZWEI. Der Motor bleibt die Quelle für die Simulation, diese Datei ist
 * seine Anzeige-Kopie. Jede Tabelle unten mit dem Präfix `MOTOR_` ist Zeichen für Zeichen aus
 * dem Motor abgeschrieben, und `tests/einsatzliste-formation.test.ts` liest den Motor als Text
 * und vergleicht. Ändert jemand den Motor, wird der Test rot — die Einsatzliste kann dann nie
 * einen Platz zeigen, den der Kampf nicht hält (Architektur 2.4, Stufe 1). Den Motor selbst
 * fasst diese Datei NICHT an: `SLOT_ZUSATZ.reihe` ist simulationsrelevant, ihn aus TS zu speisen
 * wäre Mechanik mit Pflichtabnahme rho/Pp.
 *
 * GESCHLÜSSELT ÜBER DIE KURZE ROLLEN-ID, NIE ÜBER DEN INDEX (Architektur 1.3a). Die Rollen-Id
 * liefert `resolveSlotRoleShortId` — dieselbe Funktion, mit der der Arena-Adapter
 * (`lib/foundation/battle-arena/arena-aufstellung-adapter.ts`) `place[name].slot` füllt. Die Marke
 * auf dem Mini-Feld steht damit garantiert für dieselbe Rolle, die die Arena bekommt.
 *
 * WIE VERBINDLICH EIN PLATZ IST (`Verbindlichkeit`):
 *   - "motor":       der Motor hält diesen Platz bzw. diese Reihenfolge nachweislich.
 *   - "start":       nur der Startort; danach entscheidet der Motor dynamisch (Domination).
 *   - "darstellung": reine Anzeige; der Motor liest an dieser Stelle keinen Platz. Die Marke
 *                    wird hohl/gestrichelt gezeichnet und der Tooltip sagt es.
 *
 * BEFUND 08.11. (bei der Extraktion gefunden, nicht behoben — wäre Mechanik): Die Bühnen-
 * Disziplinen paaren bzw. reihen im Motor nach der Listenposition in `inDisc(d)`, und die folgt
 * dem nach TDM-Eignung sortierten Arena-Kader (`arena-kader-adapter.ts`, `kader.sort(... d.tdm)`),
 * NICHT dem Slot. Betroffen: Gewichtheben (`baueHebenDuelle`, auch `HEBEN_ROLLEN[i]` geht nach
 * diesem Index), Fechten, Tennis, Speed-Schach (`art.duell`), Breaking (`baueGauntlet`),
 * Showcase/Eiskunstlauf/Wettessen/I-Spy (Auftrittsreihenfolge). Die Staffel hatte denselben
 * Fehler und hat seit 11.10. `staffelNachSlot`. Bis die Bühnen dasselbe bekommen, sind ihre
 * Plätze hier "darstellung" — die Einsatzliste behauptet keine Paarung, die der Kampf nicht fährt.
 *
 * NUR ANZEIGE. Keine Importe (wie `einsatzliste-anzeige.ts`), damit nichts hieraus versehentlich
 * in Resolve, KI-Vorschlag oder Arena zurückwirkt.
 */

// ================================================================================================
// TYPEN
// ================================================================================================

/** Welcher Hintergrund gezeichnet wird. Ein kleiner, abgeschlossener Satz — der Renderer kennt keine Disziplin. */
export type FeldArt =
  | "reihen" // Arena: eigene Hälfte links, drei Spalten Backrow / Mitte / Front, Gegner gespiegelt
  | "domination" // Battlefield: drei Punkte Nord / Mitte / Süd
  | "halbfeld" // Basketball: Korb links, Zone, Dreierlinie
  | "eis" // Hockey: Tor links, blaue Linie
  | "football" // Football: Scrimmage-Linie, Seitenlinie
  | "strecke" // Bahn: Start links, Ziel rechts
  | "wand" // Climbing: Boden unten, Top-out oben
  | "staffel" // Staffel: Beine hintereinander mit Stabübergaben
  | "leiste" // Bühne: Plätze nebeneinander, Gegner darunter
  | "bogen" // Eiskunstlauf: Startreihenfolge als Bogen auf dem Eis
  | "tafel" // Wettessen: ein Tisch, Heim/Gast verschränkt
  | "ring"; // Breaking: Platz 1 im Ring, die Kette dahinter

export type Verbindlichkeit = "motor" | "start" | "darstellung";

/** Wie der Gegner auf dem Feld steht. */
export type GegnerArt =
  | "spiegel-x" // gegenüberliegende Hälfte (Arena, Ring, Wand)
  | "spiegel-y" // eine Spur tiefer (Bahn, Bühne)
  | "schatten" // Verteidiger-Schatten einen halben Schritt vor der eigenen Marke (Basketball)
  | "verschraenkt" // gleiche Reihe, abwechselnd (Wettessen)
  | "keiner"; // nur der Streifen über dem Feld (Hockey, Football, Domination-Pod)

export type FormationsGruppe = {
  /** Kurzes Etikett im Feld („Front“, „Von vorn“, „Nord“). */
  label: string;
  x: number;
  y: number;
  /** Ein Satz für die Rollenkarte, nur Fakten, die der Motor fährt. */
  text?: string;
  verbindlichkeit: Verbindlichkeit;
  /** Woher die Zahl kommt (Motor-Fundstelle) — steht im Tooltip. */
  beleg: string;
};

export type FormationsRolle = {
  gruppe: string;
  /** Zusatz für die Rollenkarte (überschreibt nichts, ergänzt den Gruppentext). */
  zeile?: string;
  verbindlichkeit?: Verbindlichkeit;
  beleg?: string;
};

export type FormationsDefinition = {
  disziplin: string;
  /** Fehlt = Standardformat. Format-Varianten (Tauziehen-Grube, Sandsack …) bekommen eigene Einträge. */
  variante?: string;
  feld: FeldArt;
  /** Breite / Höhe des Feldes auf dem Desktop. */
  seitenverhaeltnis: number;
  /** Eine Zeile über dem Feld: was der Platz hier bedeutet. */
  kopfzeile: string;
  gegner: GegnerArt;
  /**
   * "gruppen":     jede Rolle hat eine Gruppe mit Ankerpunkt; mehrere Rollen derselben Gruppe
   *                werden entlang `streuung` aufgefächert.
   * "nach-index":  Plätze 1..n gleichmäßig auf `leiste` (Bühne, Staffel, Bogen, Rückfall).
   * "verschraenkt":wie nach-index, aber Heim und Gast abwechselnd auf derselben Reihe.
   * "ring":        Platz 1 auf `ring`, die übrigen als Kette auf `leiste`.
   */
  anordnung: "gruppen" | "nach-index" | "verschraenkt" | "ring";
  gruppen?: Readonly<Record<string, FormationsGruppe>>;
  rollen?: Readonly<Record<string, FormationsRolle>>;
  /** Mehrere Rollen einer Gruppe: entlang `achse` im `abstand`, abwechselnd um `quer` versetzt (Rudel statt Stapel). */
  streuung?: { achse: "x" | "y"; abstand: number; quer?: number };
  /** Gerade von (x0, y) nach (x1, y1 ?? y); `bogen` hebt die Mitte an (negativ = nach oben). */
  leiste?: { x0: number; x1: number; y: number; y1?: number; bogen?: number };
  ring?: { x: number; y: number };
  /** Verbindlichkeit der nach-index-Plätze (Gruppen tragen ihre eigene). */
  indexVerbindlichkeit?: Verbindlichkeit;
  indexBeleg?: string;
  /** Zeile der Rollenkarte je Platz bei nach-index (Platz 1 = Index 0). */
  indexZeile?: (index: number, anzahl: number) => string;
  /** Basketball: die Formation greift erst bei voller, eindeutiger Besetzung. */
  bedingung?: { art: "alle-besetzt"; text: string };
  /** Ziel der Verteidiger-Schatten bzw. Tor/Korb (Hintergrund). */
  ziel?: { x: number; y: number };
};

export type GelegterPlatz = {
  slotIndex: number;
  rolleId: string | null;
  x: number;
  y: number;
  gruppe: string | null;
  gruppenLabel: string | null;
  verbindlichkeit: Verbindlichkeit;
  beleg: string;
  /** Satz für die Rollenkarte (Gruppentext + Rollenzusatz). */
  zeile: string | null;
  /** Gegner-Platz derselben Position, null = Gegner steht hier nicht auf dem Feld. */
  gegner: { x: number; y: number } | null;
};

export type GelegteFormation = {
  definition: FormationsDefinition;
  plaetze: GelegterPlatz[];
  /** Feld-Etiketten (Gruppen-Anker), damit der Hintergrund „Front“, „Von vorn“ … zeigen kann. */
  etiketten: Array<{ label: string; x: number; y: number; gespiegelt: boolean }>;
  /** true, wenn die Definition aus dem generischen Rückfall kommt. */
  rueckfall: boolean;
};

// ================================================================================================
// MOTOR-KOPIEN (Drift-Wächter: tests/einsatzliste-formation.test.ts)
// ================================================================================================

/** `SLOT_ZUSATZ` (Engine Z. ~8201): Reihe 0 = Front, 1 = Mitte, 2 = Backrow; `ord` = Standardbefehl. */
export const MOTOR_SLOT_ZUSATZ: Readonly<Record<string, { reihe: 0 | 1 | 2; ord: string; pos: number }>> = {
  vanguard: { reihe: 0, ord: "mitlinie", pos: 0 },
  holdline: { reihe: 0, ord: "mitlinie", pos: 1 },
  breaker: { reihe: 1, ord: "verfolgen", pos: 2 },
  skirmisher: { reihe: 1, ord: "flanke", pos: 3 },
  shotcaller: { reihe: 2, ord: "mitlinie", pos: 4 },
  rallypoint: { reihe: 2, ord: "mitlinie", pos: 5 },
  blockstart: { reihe: 0, ord: "mitlinie", pos: 0 },
  acceleration: { reihe: 0, ord: "mitlinie", pos: 1 },
  topspeed: { reihe: 1, ord: "verfolgen", pos: 2 },
  lanecontrol: { reihe: 1, ord: "flanke", pos: 3 },
  siegecore: { reihe: 0, ord: "mitlinie", pos: 0 },
  moraleanchor: { reihe: 0, ord: "mitlinie", pos: 1 },
  spotter: { reihe: 1, ord: "flanke", pos: 2 },
  commander: { reihe: 2, ord: "mitlinie", pos: 3 },
  fieldcontrol: { reihe: 1, ord: "mitlinie", pos: 4 },
  disruptor: { reihe: 1, ord: "verfolgen", pos: 5 },
};

/**
 * Mini-DM hat keinen `SLOT_ZUSATZ`-Eintrag; der Motor fällt auf `min(2, floor(SLOT_STELLE/2))`
 * zurück, und `SLOT_STELLE` ist der Index in `SLOTS_JE_DISC["mini-dm"]` — generiert aus
 * `DISCIPLINE_ROLE_THEMES["mini-dm"]` in dieser Reihenfolge.
 */
export const MOTOR_MINI_DM_SLOT_STELLE: readonly string[] = ["frontliner", "finisher", "trickfighter", "ironguard", "chaosdriver", "lasthit"];

/** `homeFor()` (Engine Z. ~38117): Abstand der Spalten Front / Mitte / Backrow zur Mittellinie in px. */
export const MOTOR_REIHEN_X_VERSATZ: readonly [number, number, number] = [140, 300, 460];

/** `BASKETBALL_ROLLE_SLOT` (Engine Z. ~10855): Rolle → Formationsplatz in `SLOTS`. */
export const MOTOR_BASKETBALL_ROLLE_SLOT: Readonly<Record<string, number>> = {
  rimpressure: 0,
  floorgeneral: 1,
  fastbreak: 2,
  helpdefense: 3,
  perimeter: 4,
  clutchshot: 5,
};

/** `SLOTS` (Basketball, Engine Z. ~11259): Abstand zum Korb (px) und Seitenfaktor (×90 px). */
export const MOTOR_BASKETBALL_SLOTS: ReadonlyArray<{ radius: number; seitlich: number }> = [
  { radius: 60, seitlich: 0 },
  { radius: 130, seitlich: 0 },
  { radius: 150, seitlich: 1.05 },
  { radius: 150, seitlich: -1.05 },
  { radius: 145, seitlich: 1.45 },
  { radius: 145, seitlich: -1.45 },
];

/** `SLOTS_HOCKEY` (Engine Z. ~11282): Netfront, Half-Wall l/r, Point l/r, hoher Slot. */
export const MOTOR_HOCKEY_SLOTS: ReadonlyArray<{ radius: number; seitlich: number }> = [
  { radius: 78, seitlich: 0 },
  { radius: 165, seitlich: 1.25 },
  { radius: 165, seitlich: -1.25 },
  { radius: 295, seitlich: 0.62 },
  { radius: 295, seitlich: -0.62 },
  { radius: 215, seitlich: 0 },
];

/** `TORWART_SLOTS` / `QB_SLOTS` / `KICKER_SLOTS` (Engine Z. ~12144 / ~12488 / ~12678). */
export const MOTOR_TORWART_SLOTS: readonly string[] = ["goaltender", "goalie", "torwart", "netminder", "keeper"];
export const MOTOR_QB_SLOTS: readonly string[] = ["quarterback", "qb"];
export const MOTOR_KICKER_SLOTS: readonly string[] = ["kickerpunter", "kicker", "punter", "specialteams"];

export type MotorPlan = { label: string; tempo: number; text: string };

/** Die fünf Bahn-Disziplinen: Rennpläne und `planJeSlot` (Engine Z. ~44749 … ~45862). */
export const MOTOR_RENNPLAENE: Readonly<Record<string, { plaene: Readonly<Record<string, MotorPlan>>; planJeSlot: Readonly<Record<string, string>> }>> = {
  spurt: {
    plaene: {
      vorn: { label: "Von vorn", tempo: 1.0, text: "Geht sofort an die Spitze und diktiert das Rennen. Kostet Kraft — im Wind läuft niemand billig." },
      schatten: { label: "Windschatten", tempo: 0.94, text: "Hängt sich an und spart Kraft, bis der Vordermann leer ist." },
      kick: { label: "Schlusssprint", tempo: 0.9, text: "Hält sich zurück und wirft alles auf das letzte Drittel." },
    },
    planJeSlot: { blockstart: "vorn", acceleration: "vorn", topspeed: "kick", lanecontrol: "schatten", drivephase: "vorn", photofinish: "kick" },
  },
  "time-trial": {
    plaene: {
      gleich: { label: "Gleichmaß", tempo: 0.93, text: "Hält das Tempo konstant und kommt mit der Reserve hin. Der Klassiker im Zeitfahren." },
      negativ: { label: "Negativ-Split", tempo: 0.88, text: "Erste Hälfte verhalten, zweite Hälfte alles. Verlangt Kopf und Reserve." },
      attacke: { label: "Attacke", tempo: 1.0, text: "Von Beginn an über der eigenen Schwelle. Geht auf oder geht schief." },
    },
    planJeSlot: { pacer: "gleich", linereader: "gleich", aerodrive: "attacke", splitcontrol: "negativ", risksegment: "attacke", finishkick: "negativ" },
  },
  climbing: {
    plaene: {
      sparsam: { label: "Sparsam", tempo: 0.86, text: "Klettert unter der Schwelle und hebt sich alles für die Steilstufe auf." },
      stetig: { label: "Stetig", tempo: 0.94, text: "Gleichmäßiger Zug. Kommt an, ohne zu glänzen." },
      angriff: { label: "Durchziehen", tempo: 1.0, text: "Zieht von unten durch. Oben wird es eng — wenn die Reserve reicht." },
    },
    planJeSlot: { routereader: "stetig", gripspecialist: "stetig", paceclimber: "sparsam", endurancewall: "sparsam", dynamicmove: "angriff", summitpush: "angriff" },
  },
  staffel: {
    plaene: {
      halten: { label: "Halten", tempo: 1.0, text: "Bleibt dran und spart für die Übergabe. Kein Abschnitt wird verschenkt." },
      angehen: { label: "Angehen", tempo: 1.0, text: "Geht seinen Abschnitt von vorn an und legt vor." },
      schluss: { label: "Schlussmann", tempo: 1.0, text: "Hängt sich an und wirft alles auf das letzte Stück." },
    },
    planJeSlot: { startrunner: "angehen", tempolink: "halten", batontech: "halten", curverunner: "angehen", chaserunner: "schluss", anchor: "schluss" },
  },
  "takeshis-castle": {
    plaene: {
      vorsicht: { label: "Vorsichtig", tempo: 0.84, text: "Geht jede Falle langsam an. Kommt selten glanzvoll an — aber er kommt an." },
      stetig: { label: "Beherzt", tempo: 0.93, text: "Nimmt die Fallen im Tempo und steht wieder auf, wenn es schiefgeht." },
      wild: { label: "Kopf voran", tempo: 1.0, text: "Rennt durch und hofft. Das Publikum liebt es. Drei Stürze und Schluss." },
    },
    planJeSlot: { gatecrash: "wild", balancerun: "vorsicht", trapreader: "vorsicht", ironwill: "stetig", chaosdodge: "wild", finalwall: "stetig" },
  },
};

/** `BF_ORT_NAMEN` / `BFFFA_ROLLEN_ORT` (Engine Z. ~55534 / ~55539): Startort je Rolle in der Domination. */
export const MOTOR_BF_ORT_NAMEN: readonly string[] = ["Nord", "Mitte", "Süd"];
export const MOTOR_BFFFA_ROLLEN_ORT: Readonly<Record<string, "heim" | "mitte" | "fern">> = {
  moraleanchor: "heim",
  commander: "heim",
  siegecore: "mitte",
  fieldcontrol: "mitte",
  disruptor: "fern",
  spotter: "fern",
};

/** `HEBEN_ROLLEN` (Engine Z. ~20904): Eröffnungshöhe je Hebe-Rolle (Anteil am Tagesmaximum). */
export const MOTOR_HEBEN_ROLLEN: ReadonlyArray<{ rolle: string; eroeffnung: number; sprung1: number; sprung2: number }> = [
  { rolle: "Power Opener", eroeffnung: 0.92, sprung1: 0.04, sprung2: 0.03 },
  { rolle: "Safe Lift", eroeffnung: 0.94, sprung1: 0.03, sprung2: 0.02 },
  { rolle: "Pressure Lift", eroeffnung: 0.89, sprung1: 0.06, sprung2: 0.05 },
  { rolle: "Technical Lift", eroeffnung: 0.91, sprung1: 0.05, sprung2: 0.04 },
  { rolle: "Grip Anchor", eroeffnung: 0.92, sprung1: 0.04, sprung2: 0.04 },
  { rolle: "Final Attempt", eroeffnung: 0.9, sprung1: 0.04, sprung2: 0.06 },
];

// ================================================================================================
// ABGELEITETE GEOMETRIE (aus den Motor-Kopien gerechnet, nicht frei gesetzt)
// ================================================================================================

/** Text zum Standardbefehl aus `SLOT_ZUSATZ.ord` — „Rolle“-Zeile im Verhalten-Befund-Stil. */
export const ORD_TEXT: Readonly<Record<string, string>> = {
  mitlinie: "hält die Linie mit den Nachbarn",
  verfolgen: "verfolgt sein Ziel, ohne Leine",
  flanke: "geht über die Flanke",
  decken: "deckt den Nebenmann",
  hinter: "bleibt hinter der Linie",
};

const REIHEN_NAMEN = ["Front", "Mitte", "Backrow"] as const;

/** x der Reihe auf der eigenen (linken) Hälfte: Mittellinie 0,5, Backrow bei 0,08 — Abstände wie `homeFor()`. */
function reihenX(reihe: 0 | 1 | 2): number {
  const skala = 0.42 / MOTOR_REIHEN_X_VERSATZ[2];
  return 0.5 - MOTOR_REIHEN_X_VERSATZ[reihe] * skala;
}

function reihenGruppen(beleg: string): Record<string, FormationsGruppe> {
  const gruppen: Record<string, FormationsGruppe> = {};
  ([0, 1, 2] as const).forEach((reihe) => {
    gruppen[`reihe-${reihe}`] = {
      label: REIHEN_NAMEN[reihe],
      x: reihenX(reihe),
      y: 0.5,
      text: `Reihe ${reihe + 1} (${REIHEN_NAMEN[reihe]}). Der Motor setzt die Reihe beim Kampfstart und hält sie über die Formationsleine; innerhalb der Reihe ordnet er nach Kader, nicht nach Slot.`,
      verbindlichkeit: "motor",
      beleg,
    };
  });
  return gruppen;
}

/**
 * Feldplatz aus dem Radius/Seitlich-Modell, exakt wie `bewegeSpielerLive`: Querversatz
 * `seitlich·90` px, Längsabstand so, dass `hypot` den Radius trifft. Die Skalierung auf das
 * Mini-Feld ist Anzeige (nicht maßstabsgetreu, damit sechs Marken lesbar nebeneinander passen).
 */
function radiusPlatz(slot: { radius: number; seitlich: number }, ziel: { x: number; y: number }, skalaX: number, skalaY: number) {
  const quer = slot.seitlich * 90;
  const laengs = Math.sqrt(Math.max(0, slot.radius * slot.radius - quer * quer));
  return { x: ziel.x + laengs * skalaX, y: ziel.y + quer * skalaY };
}

const KORB = { x: 0.07, y: 0.5 };
const TOR = { x: 0.055, y: 0.5 };

function basketballGruppen(): Record<string, FormationsGruppe> {
  const namen = ["Zone (Paint)", "Top of Key", "Flügel", "Flügel", "Ecke", "Ecke"];
  const gruppen: Record<string, FormationsGruppe> = {};
  MOTOR_BASKETBALL_SLOTS.forEach((slot, index) => {
    const platz = radiusPlatz(slot, KORB, 0.0034, 0.003);
    gruppen[`platz-${index}`] = {
      label: namen[index]!,
      x: platz.x,
      y: platz.y,
      text: `Formationsplatz ${namen[index]} (${slot.radius} px vom Korb).`,
      verbindlichkeit: "motor",
      beleg: `BASKETBALL_ROLLE_SLOT → SLOTS[${index}]`,
    };
  });
  return gruppen;
}

function hockeyGruppen(): Record<string, FormationsGruppe> {
  const namen = ["Netfront", "Half-Wall", "Half-Wall", "Point", "Point", "Hoher Slot"];
  const gruppen: Record<string, FormationsGruppe> = {};
  MOTOR_HOCKEY_SLOTS.forEach((slot, index) => {
    const platz = radiusPlatz(slot, TOR, 0.0029, 0.0031);
    gruppen[`platz-${index}`] = {
      label: namen[index]!,
      x: platz.x,
      y: platz.y,
      text: `Grundformation ${namen[index]}. Darstellung: der Motor verteilt die Feldspieler nach Nahschuss-Stärke, nicht nach Rolle.`,
      verbindlichkeit: "darstellung",
      beleg: `SLOTS_HOCKEY[${index}] (Zuteilung nach SCHUSS_NAH)`,
    };
  });
  gruppen.tor = {
    label: "Tor",
    x: TOR.x + 0.03,
    y: 0.5,
    text: "Steht im Tor. Der Motor liest diesen Slot (TORWART_SLOTS) und stellt ihn fest ins Tor.",
    verbindlichkeit: "motor",
    beleg: "TORWART_SLOTS",
  };
  return gruppen;
}

function rennplanGruppen(disziplin: string, achse: "x" | "y"): Record<string, FormationsGruppe> {
  const plan = MOTOR_RENNPLAENE[disziplin]!;
  // Position = geplantes Tempo im ersten Renndrittel: wer schneller angeht, liegt weiter vorn.
  // Gleiches Tempo (nur Staffel) kommt hier nicht vor — die Staffel ordnet nach Bein, nicht nach Plan.
  const tempi = Object.values(plan.plaene).map((p) => p.tempo);
  const min = Math.min(...tempi);
  const max = Math.max(...tempi);
  const gruppen: Record<string, FormationsGruppe> = {};
  for (const [id, p] of Object.entries(plan.plaene)) {
    const anteil = max > min ? (p.tempo - min) / (max - min) : 0.5;
    gruppen[id] = {
      label: p.label,
      x: achse === "x" ? 0.42 + anteil * 0.4 : 0.3,
      y: achse === "x" ? 0.24 : 0.74 - anteil * 0.5,
      text: `Rennplan „${p.label}“: ${p.text}`,
      verbindlichkeit: "motor",
      beleg: `planJeSlot → ${id} (Tempo ${p.tempo.toFixed(2)})`,
    };
  }
  return gruppen;
}

function rennplanRollen(disziplin: string): Record<string, FormationsRolle> {
  const rollen: Record<string, FormationsRolle> = {};
  for (const [rolle, plan] of Object.entries(MOTOR_RENNPLAENE[disziplin]!.planJeSlot)) rollen[rolle] = { gruppe: plan };
  return rollen;
}

const BUEHNE_BELEG =
  "Bühne: der Motor paart/reiht heute nach Kaderliste (inDisc, TDM-sortiert), nicht nach Slot — Befund 08.11.";

function buehnenLeiste(
  disziplin: string,
  kopfzeile: string,
  gegner: GegnerArt,
  feld: FeldArt = "leiste",
  indexZeile?: (index: number, anzahl: number) => string,
): FormationsDefinition {
  return {
    disziplin,
    feld,
    seitenverhaeltnis: gegner === "keiner" ? 4.6 : 3.4,
    kopfzeile,
    gegner,
    anordnung: "nach-index",
    leiste:
      feld === "bogen"
        ? { x0: 0.1, x1: 0.9, y: 0.7, bogen: -0.4 }
        : { x0: 0.1, x1: 0.9, y: gegner === "keiner" ? 0.5 : 0.3 },
    indexVerbindlichkeit: "darstellung",
    indexBeleg: BUEHNE_BELEG,
    indexZeile,
  };
}

// ================================================================================================
// REGISTRY: alle zwanzig Disziplinen
// ================================================================================================

const TDM_ROLLEN: Record<string, FormationsRolle> = Object.fromEntries(
  ["vanguard", "holdline", "breaker", "skirmisher", "shotcaller", "rallypoint"].map((id) => [
    id,
    { gruppe: `reihe-${MOTOR_SLOT_ZUSATZ[id]!.reihe}`, zeile: `Standardbefehl: ${ORD_TEXT[MOTOR_SLOT_ZUSATZ[id]!.ord] ?? MOTOR_SLOT_ZUSATZ[id]!.ord}.` },
  ]),
);

const MINI_DM_ROLLEN: Record<string, FormationsRolle> = Object.fromEntries(
  MOTOR_MINI_DM_SLOT_STELLE.map((id, stelle) => [id, { gruppe: `reihe-${Math.min(2, Math.floor(stelle / 2))}`, zeile: "Standardbefehl: hält die Linie mit den Nachbarn." }]),
);

const BF_ORT_Y = { heim: 0.2, mitte: 0.5, fern: 0.8 } as const;
const BF_ORT_INDEX = { heim: 0, mitte: 1, fern: 2 } as const;

const DOMINATION_GRUPPEN: Record<string, FormationsGruppe> = Object.fromEntries(
  (["heim", "mitte", "fern"] as const).map((ort) => [
    ort,
    {
      label: MOTOR_BF_ORT_NAMEN[BF_ORT_INDEX[ort]]!,
      x: 0.5,
      y: BF_ORT_Y[ort],
      text: `Startet am Punkt ${MOTOR_BF_ORT_NAMEN[BF_ORT_INDEX[ort]]}${ort === "heim" ? " (Heimpunkt)" : ort === "fern" ? " (Fernpunkt)" : ""}. Danach wählt der Motor den Punkt dynamisch — kein fester Platz.`,
      verbindlichkeit: "start" as const,
      beleg: `BFFFA_ROLLEN_ORT → ${ort}`,
    },
  ]),
);

const DOMINATION_ROLLEN: Record<string, FormationsRolle> = Object.fromEntries(
  Object.entries(MOTOR_BFFFA_ROLLEN_ORT).map(([rolle, ort]) => {
    const ord = MOTOR_SLOT_ZUSATZ[rolle]?.ord ?? "mitlinie";
    const neigung = ord === "verfolgen" || ord === "flanke" ? "Neigung: eher erobern" : ord === "decken" || ord === "hinter" ? "Neigung: eher halten" : "Neigung: ausgeglichen";
    return [rolle, { gruppe: ort, zeile: `${neigung} (SLOT_ZUSATZ.ord = ${ord}).` }];
  }),
);

const HEBEN_ZEILE = (index: number) => {
  const plan = MOTOR_HEBEN_ROLLEN[index % MOTOR_HEBEN_ROLLEN.length]!;
  return `Duell ${index + 1}: ${plan.rolle}, Eröffnung ${Math.round(plan.eroeffnung * 100)} % des Tagesmaximums — sobald der Motor nach Slot paart (heute nach Kaderliste).`;
};

const FORMATIONEN: readonly FormationsDefinition[] = [
  {
    disziplin: "tdm",
    feld: "reihen",
    seitenverhaeltnis: 2.3,
    kopfzeile: "Drei Reihen je Hälfte. Die Reihe hält der Motor, die Lage in der Reihe nicht.",
    gegner: "spiegel-x",
    anordnung: "gruppen",
    gruppen: reihenGruppen("SLOT_ZUSATZ.reihe + homeFor()"),
    rollen: TDM_ROLLEN,
    streuung: { achse: "y", abstand: 0.42 },
  },
  {
    disziplin: "mini-dm",
    feld: "reihen",
    seitenverhaeltnis: 2.3,
    kopfzeile: "Drei Reihen je Hälfte (Mini-DM ohne Eintrag: je zwei Rollen pro Reihe).",
    gegner: "spiegel-x",
    anordnung: "gruppen",
    gruppen: reihenGruppen("slotReihe() Rückfall floor(SLOT_STELLE/2)"),
    rollen: MINI_DM_ROLLEN,
    streuung: { achse: "y", abstand: 0.42 },
  },
  {
    disziplin: "battlefield",
    feld: "domination",
    seitenverhaeltnis: 2.3,
    kopfzeile: "Domination: Startort je Rolle. Danach läuft jeder dorthin, wo der Motor den Punkt wählt.",
    gegner: "keiner",
    anordnung: "gruppen",
    gruppen: DOMINATION_GRUPPEN,
    rollen: DOMINATION_ROLLEN,
    streuung: { achse: "x", abstand: 0.17 },
  },
  {
    disziplin: "basketball",
    feld: "halbfeld",
    seitenverhaeltnis: 2.2,
    kopfzeile: "Halbfeld: jede Rolle hat ihren Platz — der Motor nimmt ihn nur bei voller, eindeutiger Besetzung.",
    gegner: "schatten",
    anordnung: "gruppen",
    gruppen: basketballGruppen(),
    rollen: Object.fromEntries(Object.entries(MOTOR_BASKETBALL_ROLLE_SLOT).map(([rolle, platz]) => [rolle, { gruppe: `platz-${platz}` }])),
    bedingung: {
      art: "alle-besetzt",
      text: "Formation greift erst, wenn alle Slots besetzt sind — sonst stellt der Motor nach Nahwurf-Stärke auf.",
    },
    ziel: KORB,
  },
  {
    disziplin: "hockey",
    feld: "eis",
    seitenverhaeltnis: 2.2,
    kopfzeile: "Eis: nur der Torwart hat einen festen Platz. Die Feldspieler stellt der Motor nach Nahschuss auf.",
    gegner: "keiner",
    anordnung: "gruppen",
    gruppen: hockeyGruppen(),
    rollen: {
      goaltender: { gruppe: "tor" },
      powerforward: { gruppe: "platz-0" },
      playmaker: { gruppe: "platz-1" },
      transition: { gruppe: "platz-2" },
      defensivewall: { gruppe: "platz-3" },
      captainline: { gruppe: "platz-4" },
      slotfinisher: { gruppe: "platz-5" },
    },
    ziel: TOR,
  },
  {
    disziplin: "football",
    feld: "football",
    seitenverhaeltnis: 2.2,
    kopfzeile: "Football: Quarterback und Kicker/Punter liest der Motor fest. Die übrigen Plätze sind Darstellung.",
    gegner: "keiner",
    anordnung: "gruppen",
    gruppen: {
      linie: { label: "Line", x: 0.6, y: 0.5, text: "An der Scrimmage-Linie. Darstellung.", verbindlichkeit: "darstellung", beleg: "Snap-Formation setzt starteSnap()" },
      tightend: { label: "Tight End", x: 0.6, y: 0.24, text: "Neben der Linie, nah an der Endzone. Darstellung.", verbindlichkeit: "darstellung", beleg: "Snap-Formation setzt starteSnap()" },
      wide: { label: "Wide Out", x: 0.62, y: 0.88, text: "Außen an der Seitenlinie. Darstellung.", verbindlichkeit: "darstellung", beleg: "Snap-Formation setzt starteSnap()" },
      safety: { label: "Safety", x: 0.44, y: 0.76, text: "Hinter der Linie, liest den Ball. Darstellung.", verbindlichkeit: "darstellung", beleg: "Snap-Formation setzt starteSnap()" },
      qb: { label: "Pocket", x: 0.43, y: 0.5, text: "Wirft den Pass — der Motor nimmt ihn als Passgeber (QB_SLOTS).", verbindlichkeit: "motor", beleg: "QB_SLOTS" },
      kicker: { label: "Abseits", x: 0.13, y: 0.18, text: "Kommt bei Field Goal und Punt (KICKER_SLOTS).", verbindlichkeit: "motor", beleg: "KICKER_SLOTS" },
    },
    rollen: {
      linepower: { gruppe: "linie" },
      redzone: { gruppe: "tightend" },
      routeburst: { gruppe: "wide" },
      ballhawk: { gruppe: "safety" },
      quarterback: { gruppe: "qb" },
      kickerpunter: { gruppe: "kicker" },
    },
  },
  {
    disziplin: "spurt",
    feld: "strecke",
    seitenverhaeltnis: 2.0,
    kopfzeile: "Bahn: keine Bahnzuteilung. Gezeigt ist, wo der Rennplan des Slots im ersten Drittel liegt.",
    gegner: "spiegel-y",
    anordnung: "gruppen",
    gruppen: rennplanGruppen("spurt", "x"),
    rollen: rennplanRollen("spurt"),
    streuung: { achse: "y", abstand: 0.19, quer: 0.045 },
  },
  {
    disziplin: "time-trial",
    feld: "strecke",
    seitenverhaeltnis: 2.0,
    kopfzeile: "Zeitfahren gegen die Uhr: Position = geplantes Tempo im ersten Drittel.",
    gegner: "spiegel-y",
    anordnung: "gruppen",
    gruppen: rennplanGruppen("time-trial", "x"),
    rollen: rennplanRollen("time-trial"),
    streuung: { achse: "y", abstand: 0.19, quer: 0.045 },
  },
  {
    disziplin: "takeshis-castle",
    feld: "strecke",
    seitenverhaeltnis: 2.0,
    kopfzeile: "Parcours: Position = wie forsch der Plan des Slots die Fallen angeht.",
    gegner: "spiegel-y",
    anordnung: "gruppen",
    gruppen: rennplanGruppen("takeshis-castle", "x"),
    rollen: rennplanRollen("takeshis-castle"),
    streuung: { achse: "y", abstand: 0.19, quer: 0.045 },
  },
  {
    disziplin: "climbing",
    feld: "wand",
    seitenverhaeltnis: 1.9,
    kopfzeile: "Wand: Höhe = wie früh der Plan des Slots Tempo macht. Oben ist Top-out.",
    gegner: "spiegel-x",
    anordnung: "gruppen",
    gruppen: rennplanGruppen("climbing", "y"),
    rollen: rennplanRollen("climbing"),
    streuung: { achse: "x", abstand: 0.15 },
  },
  {
    disziplin: "staffel",
    feld: "staffel",
    seitenverhaeltnis: 3.4,
    kopfzeile: "Staffel: die Slots laufen hintereinander — Slot 1 läuft das erste Bein, der letzte Slot schließt.",
    gegner: "spiegel-y",
    anordnung: "nach-index",
    leiste: { x0: 0.09, x1: 0.91, y: 0.3 },
    indexVerbindlichkeit: "motor",
    indexBeleg: "staffelNachSlot (Bein = Slot, 11.10.) + planJeSlot",
    rollen: Object.fromEntries(
      Object.entries(MOTOR_RENNPLAENE.staffel!.planJeSlot).map(([rolle, plan]) => {
        const p = MOTOR_RENNPLAENE.staffel!.plaene[plan]!;
        return [rolle, { gruppe: plan, zeile: `Rennplan „${p.label}“: ${p.text}` }];
      }),
    ),
    indexZeile: (index, anzahl) => (index === 0 ? "Bein 1 — läuft los." : index === anzahl - 1 ? `Bein ${index + 1} — Schlussläufer.` : `Bein ${index + 1} — übernimmt den Stab von Bein ${index}.`),
  },
  buehnenLeiste("gewichtheben", "Hantel-Duell: Platz n gegen Platz n. Hier zählt die Reihenfolge, kein Ort.", "spiegel-y", "leiste", HEBEN_ZEILE),
  buehnenLeiste("tennis", "Duelle Platz n gegen Platz n. Hier zählt die Reihenfolge, kein Ort.", "spiegel-y"),
  buehnenLeiste("fechten", "Mannschaftsfechten: Gefecht 1 eröffnet, der letzte Platz ist der Anker.", "spiegel-y", "leiste", (index, anzahl) =>
    index === 0 ? "Gefecht 1 — eröffnet die Staffel." : index === anzahl - 1 ? `Gefecht ${index + 1} — Anker, kann einen Rückstand noch drehen.` : `Gefecht ${index + 1}.`,
  ),
  buehnenLeiste("speed-schach", "Brettfolge: Brett n gegen Brett n.", "spiegel-y", "leiste", (index) => `Brett ${index + 1}.`),
  buehnenLeiste("showcase", "Startreihenfolge auf der Bühne. Kein Gegner auf dem Feld.", "keiner", "leiste", (index) => `Auftritt ${index + 1}.`),
  buehnenLeiste("i-spy", "Suchreihenfolge. Kein Gegner auf dem Feld.", "keiner", "leiste", (index) => `Sucher ${index + 1}.`),
  buehnenLeiste("eiskunstlauf", "Startreihenfolge als Bogen auf dem Eis. Kein Gegner auf dem Feld.", "keiner", "bogen", (index) => `Kür ${index + 1}.`),
  {
    disziplin: "wettessen",
    feld: "tafel",
    seitenverhaeltnis: 3.6,
    kopfzeile: "Ein Tisch, Heim und Gast abwechselnd. Platz n sitzt neben Gegner n.",
    gegner: "verschraenkt",
    anordnung: "verschraenkt",
    leiste: { x0: 0.07, x1: 0.93, y: 0.5 },
    indexVerbindlichkeit: "darstellung",
    indexBeleg: BUEHNE_BELEG,
    indexZeile: (index) => `Platz ${index + 1} am Tisch.`,
  },
  {
    disziplin: "breaking",
    feld: "ring",
    seitenverhaeltnis: 2.6,
    kopfzeile: "Folter-Kette: Platz 1 steht im Ring, die übrigen warten in der Kette, bis einer aufgibt.",
    gegner: "spiegel-x",
    anordnung: "ring",
    ring: { x: 0.36, y: 0.5 },
    leiste: { x0: 0.2, x1: 0.11, y: 0.12, y1: 0.88 },
    indexVerbindlichkeit: "darstellung",
    indexBeleg: BUEHNE_BELEG,
    indexZeile: (index) => (index === 0 ? "Platz 1 — eröffnet im Ring." : `Platz ${index + 1} in der Kette — kommt, wenn der Vordermann aufgibt.`),
  },
];

/** Alle Disziplinen mit eigener Formation (für Tests und die Vollständigkeitsprüfung). */
export const FORMATIONS_DISZIPLINEN: readonly string[] = FORMATIONEN.map((def) => def.disziplin);

/** Die Disziplinen, deren Arena-Chassis Regler liest (`istArena`): nur hier gibt es Ebene C. */
export const FEINJUSTIERUNG_DISZIPLINEN: readonly string[] = ["tdm", "mini-dm", "battlefield"];

export function hatFeinjustierung(disziplinId: string | null | undefined): boolean {
  return disziplinId != null && FEINJUSTIERUNG_DISZIPLINEN.includes(disziplinId);
}

const RUECKFALL: FormationsDefinition = {
  disziplin: "*",
  feld: "leiste",
  seitenverhaeltnis: 4.6,
  kopfzeile: "Für diese Disziplin ist noch keine Feldform hinterlegt — die Slots stehen in ihrer Reihenfolge.",
  gegner: "keiner",
  anordnung: "nach-index",
  leiste: { x0: 0.1, x1: 0.9, y: 0.5 },
  indexVerbindlichkeit: "darstellung",
  indexBeleg: "Rückfall: keine Formation hinterlegt",
};

/** Sucht zuerst (Disziplin, Variante), dann (Disziplin), dann den Rückfall. Bricht nie. */
export function findeFormation(disziplinId: string | null | undefined, variante?: string | null): { definition: FormationsDefinition; rueckfall: boolean } {
  if (disziplinId) {
    if (variante) {
      const genau = FORMATIONEN.find((def) => def.disziplin === disziplinId && def.variante === variante);
      if (genau) return { definition: genau, rueckfall: false };
    }
    const standard = FORMATIONEN.find((def) => def.disziplin === disziplinId && def.variante == null);
    if (standard) return { definition: standard, rueckfall: false };
  }
  return { definition: RUECKFALL, rueckfall: true };
}

const runde = (wert: number) => Math.round(wert * 1000) / 1000;

function indexPlatz(leiste: NonNullable<FormationsDefinition["leiste"]>, index: number, anzahl: number) {
  const anteil = anzahl < 2 ? 0.5 : index / (anzahl - 1);
  const x = leiste.x0 + (leiste.x1 - leiste.x0) * anteil;
  const y = leiste.y + ((leiste.y1 ?? leiste.y) - leiste.y) * anteil;
  const bogen = leiste.bogen ? leiste.bogen * (1 - Math.pow(anteil * 2 - 1, 2)) : 0;
  return { x, y: y + bogen };
}

function gegnerPlatz(def: FormationsDefinition, platz: { x: number; y: number }): { x: number; y: number } | null {
  switch (def.gegner) {
    case "spiegel-x":
      return { x: 1 - platz.x, y: platz.y };
    case "spiegel-y":
      return { x: platz.x, y: 1 - platz.y };
    case "schatten": {
      const ziel = def.ziel ?? { x: 0, y: 0.5 };
      return { x: platz.x + (ziel.x - platz.x) * 0.32, y: platz.y + (ziel.y - platz.y) * 0.32 };
    }
    default:
      return null;
  }
}

/**
 * Legt die Slots einer Disziplin-Seite auf das Feld.
 *
 * `rollen[i]` ist die kurze Rollen-Id von Slot i (aus `resolveSlotRoleShortId`), `null` wenn
 * unbekannt. Jede Rolle ohne Eintrag fällt auf eine Reserve-Leiste am unteren Rand — eine
 * fehlende Geometrie macht eine Marke hohl, aber nie unsichtbar.
 */
export function legeFormation(input: { disziplinId: string | null | undefined; variante?: string | null; rollen: ReadonlyArray<string | null> }): GelegteFormation {
  const { definition: def, rueckfall } = findeFormation(input.disziplinId, input.variante);
  const anzahl = input.rollen.length;
  const plaetze: GelegterPlatz[] = [];
  const etiketten: GelegteFormation["etiketten"] = [];

  if (def.anordnung === "gruppen") {
    const gruppen = def.gruppen ?? {};
    const mitglieder = new Map<string, number[]>();
    const ohneGruppe: number[] = [];
    input.rollen.forEach((rolle, index) => {
      const gruppe = rolle ? def.rollen?.[rolle]?.gruppe : undefined;
      if (gruppe && gruppen[gruppe]) mitglieder.set(gruppe, [...(mitglieder.get(gruppe) ?? []), index]);
      else ohneGruppe.push(index);
    });
    for (const [gruppenId, gruppe] of Object.entries(gruppen)) {
      const indizes = mitglieder.get(gruppenId) ?? [];
      etiketten.push({ label: gruppe.label, x: gruppe.x, y: gruppe.y, gespiegelt: false });
      if (def.gegner === "spiegel-x" || def.gegner === "spiegel-y") {
        const g = gegnerPlatz(def, gruppe)!;
        etiketten.push({ label: gruppe.label, x: g.x, y: g.y, gespiegelt: true });
      }
      indizes.forEach((index, rang) => {
        const versatz = def.streuung ? (rang - (indizes.length - 1) / 2) * def.streuung.abstand : 0;
        const quer = def.streuung?.quer && indizes.length > 1 ? (rang % 2 === 0 ? -1 : 1) * def.streuung.quer : 0;
        const x = gruppe.x + (def.streuung?.achse === "x" ? versatz : quer);
        const y = gruppe.y + (def.streuung?.achse === "y" ? versatz : quer);
        const rolle = input.rollen[index]!;
        const rollenDef = def.rollen?.[rolle];
        const zeile = [gruppe.text, rollenDef?.zeile].filter(Boolean).join(" ") || null;
        plaetze.push({
          slotIndex: index,
          rolleId: rolle,
          x: runde(x),
          y: runde(y),
          gruppe: gruppenId,
          gruppenLabel: gruppe.label,
          verbindlichkeit: rollenDef?.verbindlichkeit ?? gruppe.verbindlichkeit,
          beleg: rollenDef?.beleg ?? gruppe.beleg,
          zeile,
          gegner: null,
        });
      });
    }
    ohneGruppe.forEach((index, rang) => {
      const p = indexPlatz({ x0: 0.12, x1: 0.88, y: 0.93 }, rang, ohneGruppe.length);
      plaetze.push({
        slotIndex: index,
        rolleId: input.rollen[index] ?? null,
        x: runde(p.x),
        y: runde(p.y),
        gruppe: null,
        gruppenLabel: null,
        verbindlichkeit: "darstellung",
        beleg: "keine Geometrie für diese Rolle hinterlegt",
        zeile: null,
        gegner: null,
      });
    });
  } else if (def.anordnung === "verschraenkt") {
    const leiste = def.leiste!;
    input.rollen.forEach((rolle, index) => {
      const eigen = indexPlatz(leiste, index * 2, anzahl * 2);
      const gast = indexPlatz(leiste, index * 2 + 1, anzahl * 2);
      plaetze.push({
        slotIndex: index,
        rolleId: rolle,
        x: runde(eigen.x),
        y: runde(eigen.y),
        gruppe: null,
        gruppenLabel: `Platz ${index + 1}`,
        verbindlichkeit: def.indexVerbindlichkeit ?? "darstellung",
        beleg: def.indexBeleg ?? "",
        zeile: def.indexZeile?.(index, anzahl) ?? null,
        gegner: { x: runde(gast.x), y: runde(gast.y) },
      });
    });
  } else {
    input.rollen.forEach((rolle, index) => {
      let platz: { x: number; y: number };
      if (def.anordnung === "ring" && index === 0 && def.ring) platz = def.ring;
      else if (def.anordnung === "ring") platz = indexPlatz(def.leiste!, index - 1, Math.max(1, anzahl - 1));
      else platz = indexPlatz(def.leiste!, index, anzahl);
      plaetze.push({
        slotIndex: index,
        rolleId: rolle,
        x: runde(platz.x),
        y: runde(platz.y),
        gruppe: null,
        gruppenLabel: def.anordnung === "ring" && index === 0 ? "Ring" : `Platz ${index + 1}`,
        verbindlichkeit: def.indexVerbindlichkeit ?? "darstellung",
        beleg: def.indexBeleg ?? "",
        zeile: [def.indexZeile?.(index, anzahl), rolle ? def.rollen?.[rolle]?.zeile : undefined].filter(Boolean).join(" ") || null,
        gegner: null,
      });
    });
  }

  for (const platz of plaetze) {
    if (platz.gegner == null) {
      const g = gegnerPlatz(def, platz);
      platz.gegner = g ? { x: runde(g.x), y: runde(g.y) } : null;
    }
  }
  plaetze.sort((a, b) => a.slotIndex - b.slotIndex);
  return { definition: def, plaetze, etiketten, rueckfall };
}

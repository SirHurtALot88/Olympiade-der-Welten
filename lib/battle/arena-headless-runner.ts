import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";

import { buildArenaTeam, type ArenaSpieler } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import {
  buildArenaAufstellungBeide,
  type ArenaAufstellung,
} from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import type { GameState, Player } from "@/lib/data/olyDataTypes";

/**
 * HEADLESS-RUNNER FUER window.__arena.spieleFeldspiel() (Plan Abschnitt 3.4, PR 6 von 9).
 *
 * WARUM PLAYWRIGHT UEBERHAUPT: die Arena-Engine (public/mockups/battle-mode.engine.js) ist
 * untrennbar an DOM/Canvas gekoppelt (`new Image()`, `document.createElement("canvas")` schon
 * beim Modul-Laden, s. Plan Fund 5) — ein reiner Node-Import scheitert an
 * "document is not defined", bevor ueberhaupt simuliert wird. Echter Chromium ist deshalb der
 * einzige heute verfuegbare Weg, denselben Simulationskern serverseitig aufzurufen, den PR 5
 * ueber `window.__arena.spieleFeldspiel(fd, saat)` freigelegt hat.
 *
 * ARCHITEKTUR-ENTSCHEIDUNG (Plan Abschnitt 3.4 vs. 5.4 — HIER ENTSCHIEDEN, nicht mehr offen):
 * Der urspruengliche Plan-Entwurf (Abschnitt 3.4) schlug einen dauerhaft warmgehaltenen
 * Browser-Singleton vor (ein `Browser`-Objekt ueber die Lebensdauer des Node-Prozesses). Chris
 * tendierte selbst dazu ("davon habe ich keine Ahnung", bat aber um eine zweite Meinung),
 * Fables Gegen-Empfehlung (Abschnitt 5.4) argumentiert klar fuer ON-DEMAND und wird hier
 * umgesetzt:
 *   - Der Matchday-Resolve laeuft automatisch im Hintergrund (kein Nutzer wartet live davor,
 *     s. das bereits etablierte `kickoffLeagueSetupDraft()`-Muster) — ob er 5 oder 20 Sekunden
 *     braucht, ist irrelevant fuer die UX.
 *   - Ein dauerhaft idler Chromium kostet 200-400 MB RAM rund um die Uhr auf einem Server, der
 *     bereits App + SQLite + Crons traegt, und ist selbst das instabilste Stueck Software dort
 *     (Memory-Leaks, Zombie-Prozesse) — braucht eigene Health-Checks/Neustart-Logik.
 *   - "Prozess existiert nicht" ist der robusteste Ruhezustand.
 * Diese Datei startet also PRO AUFRUF (bzw. pro Batch von Fixtures) einen frischen Browser und
 * schliesst ihn danach hart in einem `finally`-Block, auch bei Fehlern — KEIN modulweiter
 * Singleton, der ueber Aufrufe hinweg warmgehalten wird. Das ist bewusst eine EMPFEHLUNG
 * (Fables, gegen Chris' anfaengliches Bauchgefuehl), keine bereits von Chris abgenommene
 * Entscheidung — siehe PR-Beschreibung. Der Umstieg auf "dauerhaft warm" waere spaeter eine
 * reine Lifecycle-Aenderung an `runArenaFixtures()` (Browser-Erzeugung/-Schliessung nach aussen
 * verlagern), kein struktureller Umbau.
 *
 * BATCHING INNERHALB EINES page.evaluate()-AUFRUFS (Plan Abschnitt 3.4, "nicht 8 einzelne
 * evaluate()-Aufrufe"): die Engine haelt ihren Kader (SQUAD/OPP) als modulinternen Zustand,
 * eingelesen genau EINMAL beim Laden aus `window.__olyArenaKader` (s.
 * battle-mode.engine.js, "BRUECKE ZUR ECHTEN APP") — es gibt keinen exponierten Weg, SQUAD/OPP
 * nach dem Laden von aussen auszutauschen. Fuer mehrere FIXTURES MIT UNTERSCHIEDLICHEN ECHTEN
 * KADERN in einem einzigen Seitenaufruf uebernimmt der Browser-seitige Code deshalb GENAU DAS
 * MUSTER, das `FoundationBattleArenaHost.tsx` fuer einen Team-Wechsel im interaktiven Host
 * bereits einsetzt (nicht neu erfunden): `window.__olyArenaKader` frisch setzen, die alte
 * `window.__arena`-Instanz verwerfen, ein neues `<script src="battle-mode.engine.js">`
 * einhaengen und auf das Fertig-Signal (`window.__arena` erscheint) warten. Das laeuft
 * vollstaendig BROWSERSEITIG in einer Schleife innerhalb EINES `page.evaluate()`-Aufrufs ab —
 * amortisiert den IPC-Overhead zwischen Node und Chromium ueber alle Fixtures eines Batches,
 * genau wie im Plan gefordert. Die ERSTE Aufstellung wird bereits VOR der Navigation per
 * `page.addInitScript()` gesetzt (Plan Abschnitt 3.3b) — die normale, erste Skript-Ausfuehrung
 * beim Seitenaufbau uebernimmt dafuer den ersten Fixture-Durchlauf, ohne ihn zusaetzlich im
 * Browser-Loop neu einzuhaengen.
 */

const STANDARD_CHROMIUM_EXECUTABLE_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const STANDARD_SEITEN_TIMEOUT_MS = 20_000;

/**
 * FUND (nachgemessen, nicht vermutet): `spieleFeldspiel(fd, saat)` reicht `saat` unveraendert an
 * den internen PRNG durch (`seed=(seed*1664525+1013904223)>>>0`, battle-mode.engine.js Z. 7646).
 * Das ist eine Linear-Congruential-Formel, die einen NUMERISCHEN Startwert braucht. Ein
 * nicht-numerischer STRING (z.B. das im Plan Abschnitt 3.3c vorgeschlagene Seed-Schema
 * `${saveId}:${seasonId}:${matchdayId}:arena:${homeTeamId}:${awayTeamId}`) macht `seed*1664525`
 * zu `NaN`, und `NaN>>>0` ist `0` -- JEDER nicht-numerische String-Seed kollabiert also auf
 * denselben internen Startwert 0 und liefert BITGENAU DASSELBE Ergebnis, unabhaengig vom
 * eigentlichen Seed-Text. Nachgemessen: `"seed-eins"` und `"seed-zwei"` ergeben beide `0`.
 *
 * Das ist kein Fehler in diesem Runner, sondern eine Eigenschaft von PR 5's `saat`-Parameter,
 * die PR 7 (Seed-Schema aus Abschnitt 3.3c) sonst still ausgehebelt haette -- deshalb hier
 * geloest, nicht dort wiederholt. `runArenaFixtures()` nimmt weiterhin `string | number` als
 * Seed entgegen (passend zum geplanten Schema), haesht einen String-Seed aber VOR der Uebergabe
 * an `spieleFeldspiel()` deterministisch auf eine 32-Bit-Zahl (FNV-1a -- einfach, stabil,
 * unabhaengig von Laufzeit-/Node-Versionsdetails). Ein bereits numerischer Seed (wie in
 * scripts/miss-arena-spielefeldspiel.mjs, PR 5s eigener Abnahme) bleibt unveraendert
 * durchgereicht.
 */
/**
 * BUEHNEN-DUELL-CHASSIS (Gewichtheben-Produktivierung, S6, docs/design/
 * gewichtheben-produktivierung.md): `window.__arena.spieleFeldspiel()` kennt nur
 * `FELDSPIEL_ART`-Disziplinen (Ballbesitz-Feldspiel, aktuell Basketball) -- es liefert fuer jede
 * andere Disziplin bereits heute `null`, nie einen falschen Wert, weil es `FELDSPIEL_ART[fd]`
 * selbst prueft. Gewichtheben laeuft ueber ein STRUKTURELL ANDERES Chassis (Buehnen-Duelle je
 * Slot, s. `baueHebenDuelle()` in battle-mode.engine.js) und braucht deshalb den eigenen
 * Einstiegspunkt `spieleBuehneHeben()`.
 *
 * NUR DIESE MENGE ENTSCHEIDET, WELCHE BROWSER-FUNKTION AUFGERUFEN WIRD -- keine
 * If/Else-Kette auf einzelne Disziplins-IDs. Eine kuenftige Disziplin mit demselben
 * Buehnen-Duell-Chassis (keine ist aktuell geplant) braucht hier nur einen weiteren Eintrag,
 * keine neue Verzweigung. Bewusst GETRENNT von `ARENA_RESOLVED_DISCIPLINE_IDS`
 * (battle-mode-arena-team-points.ts): jene Menge sagt "wird ueberhaupt arena-aufgeloest", diese
 * hier sagt "mit welchem Chassis" -- zwei unabhaengige Fragen (eine dritte Feldspiel-Disziplin
 * koennte arena-aufgeloest werden, ohne dieses Chassis zu brauchen, und umgekehrt).
 */
export const ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS: ReadonlySet<string> = new Set(["gewichtheben"]);

function seedZuZahl(seed: string | number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed;
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type ArenaFixtureInput = {
  homeTeamId: string;
  awayTeamId: string;
  /** Deterministischer Seed, s. Plan Abschnitt 3.3c: `${saveId}:${seasonId}:${matchdayId}:arena:${homeTeamId}:${awayTeamId}`. */
  seed: string | number;
};

export type ArenaFixtureBoxscoreEintrag = {
  name: string;
  wert: number;
  /**
   * BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md): die echte Spieler-ID, sofern `name`
   * eindeutig einem Kadermitglied aus HEIM ODER GAST dieses Duells zugeordnet werden konnte.
   * `null` bei Namens-Kollision (zwei Spieler desselben Duells mit identischem Namen — der Motor
   * selbst fuehrt Boxscore-Werte NUR nach Namen, s. `battle-mode.engine.js`
   * `wert:()=>{...o[u.n]=...}`, ein kollidierender Name ueberschreibt dort bereits den Wert des
   * anderen Spielers) oder wenn der Name in keinem der beiden geladenen Kader auftaucht. Ein
   * Aufrufer, der `playerId` fuer eine Zuordnung braucht, MUSS mit `null` umgehen, statt zu raten
   * (s. `battle-mode-arena-team-points.ts`, das bei `null` fuer das GANZE Duell auf den
   * PPS-Pfad zurueckfaellt).
   */
  playerId: string | null;
  /** Welche Seite `playerId` gehoert — nur gesetzt, wenn `playerId` gesetzt ist. */
  side: "home" | "away" | null;
  /**
   * TORWART-KENNZEICHNUNG (Hockey-Produktivierung, docs/design/hockey-produktivierung.md):
   * direktes Passthrough von `window.__arena.spieleFeldspiel()`s `torwart`-Feld (s.
   * battle-mode.engine.js), das seinerseits nur fuer Hockey je `true` wird
   * (`bestimmeTorwaerter()` setzt `u.torwart` ausserhalb von Hockey nie). Fuer jede andere
   * Feldspiel-Disziplin (Basketball, Football, ...) bleibt dieses Feld `false` -- unveraendertes
   * Verhalten dort. Grund: Hockeys Torwart hat eine strukturell andere Wertverteilung als seine
   * Feldspieler (gemessen, s. scripts/ziehe-hockey-pps-referenz.ts), `battle-mode-arena-team-
   * points.ts` braucht dieses Feld, um beide Rollen getrennt gegen ihre je eigene PPS-Referenz zu
   * normieren. Optional (statt `boolean`), damit bestehende Test-Fixtures ohne dieses Feld
   * (Basketball/Gewichtheben, vor dieser Aenderung geschrieben) unveraendert kompilieren --
   * `undefined` bedeutet dasselbe wie `false` fuer jeden Aufrufer, der dieses Feld liest.
   */
  torwart?: boolean;
};

export type ArenaFixtureResult = {
  homeTeamId: string;
  awayTeamId: string;
  /** Punktestand [heim, gast] — direkt aus `spieleFeldspiel()`/`spieleBuehneHeben()`s `seiten`-Feld. */
  seiten: [number, number];
  boxscore: ArenaFixtureBoxscoreEintrag[];
  /**
   * NUR fuer das Buehnen-Duell-Chassis gesetzt (s. `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS`): die
   * kumulierte Zweikampf-Kilogrammsumme je Seite [heim, gast] -- Grundlage fuer den Gesamt-kg-
   * Tiebreak bei einem Duellgleichstand (Fable-Empfehlung 9.1, battle-mode-arena-team-points.ts).
   * `undefined` fuer jedes Feldspiel-Chassis (Basketball) — unveraendertes Verhalten dort.
   */
  gesamtKg?: [number, number];
};

/**
 * Ordnet jeden Boxscore-Namen genau einem Spieler zu — NUR, wenn der Name in GENAU EINEM der
 * beiden geladenen Kader (HEIM+GAST zusammen) genau einmal vorkommt. Zwei Spieler mit
 * identischem Namen im selben Duell (theoretisch moeglich, s. `player-generator-service.ts`,
 * das keine Eindeutigkeit erzwingt; nachgemessen an einem echten `live-save`-Abbild kam das nicht
 * vor, s. docs/design/boxscore-an-pps.md) werden ABSICHTLICH auf `null` abgebildet, statt zu
 * raten, wer von beiden gemeint ist.
 */
function baueEindeutigeNamenZuordnung(
  heim: ArenaSpieler[],
  gast: ArenaSpieler[],
): Map<string, { playerId: string; side: "home" | "away" }> {
  const vorkommen = new Map<string, number>();
  for (const spieler of [...heim, ...gast]) {
    vorkommen.set(spieler.n, (vorkommen.get(spieler.n) ?? 0) + 1);
  }
  const zuordnung = new Map<string, { playerId: string; side: "home" | "away" }>();
  for (const spieler of heim) {
    if (vorkommen.get(spieler.n) === 1) zuordnung.set(spieler.n, { playerId: spieler.id, side: "home" });
  }
  for (const spieler of gast) {
    if (vorkommen.get(spieler.n) === 1) zuordnung.set(spieler.n, { playerId: spieler.id, side: "away" });
  }
  return zuordnung;
}

export type RunArenaFixturesOptions = {
  /**
   * s. `buildArenaTeam()` in arena-kader-adapter.ts: die kompakte Initial-Payload streift
   * `attributeSheetStats` bei jedem Spieler ausser dem eigenen Team. Wer echte Kaderdaten aus
   * mehreren Teams braucht (jeder Matchday-Resolve), muss die vollstaendigen Boegen hier
   * durchreichen, sonst faellt fast der ganze Kader fremder Teams aus `buildArenaTeam()` raus.
   */
  attributeSheetOverrides?: ReadonlyMap<string, Player["attributeSheetStats"]>;
  /** Override fuer Tests/andere Umgebungen; Default ist der feste Server-Pfad. */
  chromiumExecutablePath?: string;
  /** Wie lange auf `window.__arena` je Fixture gewartet wird, bevor der Lauf abbricht. */
  seitenTimeoutMs?: number;
};

type VorbereitetesFixture = {
  homeTeamId: string;
  awayTeamId: string;
  /** Bereits durch `seedZuZahl()` normalisiert -- das ist der Wert, der an `spieleFeldspiel()` geht. */
  seed: number;
  heim: ArenaSpieler[];
  gast: ArenaSpieler[];
  /**
   * Die Aufstellung beider Seiten, Spielername -> {d, slot}. Leer, wenn fuer den Spieltag
   * kein Entwurf vorliegt — dann faellt der Motor auf seine Reihum-Vergabe zurueck und
   * verhaelt sich wie vor dieser Aenderung.
   */
  aufstellung: ArenaAufstellung;
};

/**
 * NETZWERK-ABRIEGELUNG (PPS-Skalierung, 03.09., gefunden beim Bau von
 * scripts/ziehe-basketball-pps-referenz.ts): diese Datei simuliert rein rechnerisch (Canvas/DOM
 * nur als Motor-Abhaengigkeit, s. Kopfkommentar), sie braucht KEIN einziges echtes
 * Netzwerk-Request. Chromium selbst versucht trotzdem welche (Google-Hintergrunddienste beim
 * Start, plus `battle-mode.html`s Google-Fonts-Stylesheet) -- in einer Umgebung mit
 * Proxy-Allowlist (s. CLAUDE.md, "Agenten kommen an den Server NICHT heran") liest Chromium
 * `HTTPS_PROXY` aus der Prozessumgebung und haengt an jedem dieser Requests, bis der jeweilige
 * Chromium-interne Timeout greift -- nachgemessen: ein einzelner `runArenaFixtures()`-Aufruf
 * blieb dadurch wiederholt weit ueber 100 s haengen, obwohl die eigentliche Simulation
 * (20 Fixtures) in Sekunden fertig ist. `--proxy-server=direct://` ignoriert die Umgebungs-
 * `HTTPS_PROXY` (kein Warten auf einen Tunnel, der fuer diese Hosts ohnehin abgelehnt wuerde),
 * `--host-resolver-rules=MAP * 0.0.0.0` laesst jeden Hostnamen sofort auf eine tote Adresse
 * aufloesen (sofortiges ECONNREFUSED statt DNS-/Tunnel-Wartezeit). `file://`-Navigation
 * (die einzige, die dieser Runner macht) ist von beidem unberuehrt.
 */
const ARENA_NETZWERK_ABRIEGELUNG_ARGS = ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"];

function ermittleChromiumLaunchOptions(executablePathOverride?: string) {
  const kandidat = executablePathOverride ?? STANDARD_CHROMIUM_EXECUTABLE_PATH;
  if (existsSync(kandidat)) {
    return { headless: true, executablePath: kandidat, args: ARENA_NETZWERK_ABRIEGELUNG_ARGS };
  }
  // Ohne festen Pfad (z.B. auf dem CI-Runner) loest Playwright den Standard-"chromium"-
  // Browsertyp im Headless-Betrieb seit v1.49 auf die separat installierte "Chromium Headless
  // Shell" auf, nicht auf das normale Chromium-Binary. Der CI-Workflow installiert per
  // `npx playwright install chromium` aber nur Letzteres -- ohne `channel: "chromium"` bricht
  // der Launch hier mit "Executable doesn't exist at .../chromium_headless_shell-.../..." ab,
  // obwohl Chromium selbst vorhanden ist. `channel: "chromium"` erzwingt das normale Binary.
  return { headless: true, channel: "chromium" as const, args: ARENA_NETZWERK_ABRIEGELUNG_ARGS };
}

/**
 * Baut fuer jedes Fixture beide Kader ueber den bestehenden, unveraenderten Adapter
 * (`buildArenaTeam`, Plan Fund 12) — server-seitig, VOR dem Browser-Start, damit der Browser
 * selbst nichts vom App-Datenmodell wissen muss.
 *
 * Ein Fixture, bei dem BEIDE Seiten keinen einzigen einsatzfaehigen Spieler stellen, ist ein
 * Datenfehler (nicht die in Plan 5.3 entschiedene "Unterzahl antreten lassen"-Situation, die
 * NUR eine Seite betrifft) — der Lauf bricht dafuer kontrolliert ab, statt ein 0:0 zwischen
 * zwei leeren Feldern zu erzeugen.
 */
function bereiteFixturesVor(
  gameState: GameState,
  fixtures: ArenaFixtureInput[],
  attributeSheetOverrides?: ReadonlyMap<string, Player["attributeSheetStats"]>,
): VorbereitetesFixture[] {
  return fixtures.map((fixture) => {
    const heim = buildArenaTeam(gameState, fixture.homeTeamId, attributeSheetOverrides);
    const gast = buildArenaTeam(gameState, fixture.awayTeamId, attributeSheetOverrides);
    // Die Aufstellung des Spieltags wird hier mit vorbereitet, aus demselben Grund wie die
    // Kader: server-seitig, VOR dem Browser-Start. Ohne Entwurf bleibt sie leer.
    const aufstellung = buildArenaAufstellungBeide(
      gameState,
      fixture.homeTeamId,
      fixture.awayTeamId,
      gameState.matchdayState?.matchdayId ?? null,
    );
    if (heim.length === 0 && gast.length === 0) {
      throw new Error(
        `arena-headless-runner: weder ${fixture.homeTeamId} noch ${fixture.awayTeamId} stellen einen einsatzfaehigen Kader (fehlende Attribut-Boegen?).`,
      );
    }
    return { ...fixture, seed: seedZuZahl(fixture.seed), heim, gast, aufstellung };
  });
}

/**
 * Genau das Format, das `window.__arena.spieleFeldspiel()` im Browser roh liefert — OHNE
 * `playerId`/`side` (s. `ArenaFixtureBoxscoreEintrag`): der Motor selbst kennt nur Namen, die
 * Node-seitige Zuordnung auf echte Spieler-IDs passiert ERST NACH dem `page.evaluate()`-Aufruf
 * (s. `baueEindeutigeNamenZuordnung()` im Aufrufer unten). `torwart` fehlt im rohen Objekt ganz,
 * wenn `false` (s. battle-mode.engine.js, `spieleFeldspiel()`) -- deshalb optional hier.
 */
type RoherBrowserBoxscoreEintrag = { name: string; wert: number; torwart?: boolean };
type RoherBrowserFixtureErgebnis = {
  disziplin: string;
  seiten: [number, number];
  boxscore: RoherBrowserBoxscoreEintrag[];
  gesamtKg?: [number, number];
};

/**
 * Laeuft im Browser-Kontext (per `page.evaluate()` serialisiert) — darf deshalb nur auf seine
 * Argumente und Browser-globale (`window`, `document`) zugreifen, keine Closures aus Node.
 *
 * Fixture 0 nutzt den bereits ueber `page.addInitScript()` gesetzten Kader und die dadurch
 * beim normalen Seitenaufbau geladene Motor-Instanz unveraendert (kein erneutes Einhaengen).
 * Ab Fixture 1 wird nach dem Muster aus `FoundationBattleArenaHost.tsx` neu eingehaengt: alte
 * `window.__arena`-Instanz verwerfen, `window.__olyArenaKader` auf den naechsten Kader setzen,
 * frisches `<script src="battle-mode.engine.js">` anhaengen, auf `window.__arena` warten.
 */
async function simuliereFixturesImBrowser(payload: {
  // `seed` ist hier bereits eine Zahl -- die Normalisierung nicht-numerischer String-Seeds
  // (s. `seedZuZahl()`-Kommentar oben) passiert VOR dem Sprung in den Browser-Kontext.
  fixtures: {
    heim: ArenaSpieler[];
    gast: ArenaSpieler[];
    seed: number;
    aufstellung: ArenaAufstellung;
  }[];
  disziplin: string;
  // Welche Browser-Funktion je Fixture aufgerufen wird -- s. `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS`
  // oben. NUR diese Weiche entscheidet, keine Disziplins-ID-Kenntnis im Browser-Code selbst.
  chassis: "feldspiel" | "buehneHeben";
  timeoutMs: number;
}): Promise<Array<RoherBrowserFixtureErgebnis | null>> {
  const fenster = window as unknown as {
    __arena?: {
      spieleFeldspiel: (fd: string, saat: number) => RoherBrowserFixtureErgebnis | null;
      spieleBuehneHeben: (bd: string, saat: number) => RoherBrowserFixtureErgebnis | null;
    };
    __olyArenaKader?: unknown;
  };

  const wartenAufMotor = async (frist: number) => {
    const start = Date.now();
    while (typeof fenster.__arena === "undefined") {
      if (Date.now() - start > frist) {
        throw new Error("arena-headless-runner: window.__arena wurde nicht rechtzeitig bereit.");
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const haengeMotorNeuEin = (kader: {
    heim: ArenaSpieler[];
    gast: ArenaSpieler[];
    aufstellung: ArenaAufstellung;
  }) => {
    fenster.__olyArenaKader = {
      heim: kader.heim,
      gast: kader.gast,
      aufstellung: kader.aufstellung,
    };
    delete fenster.__arena;
    document.querySelectorAll("script[data-oly-headless-engine]").forEach((el) => el.remove());
    const script = document.createElement("script");
    script.src = "battle-mode.engine.js";
    script.setAttribute("data-oly-headless-engine", "1");
    document.body.appendChild(script);
  };

  await wartenAufMotor(payload.timeoutMs);

  const ergebnisse: Array<RoherBrowserFixtureErgebnis | null> = [];
  for (let i = 0; i < payload.fixtures.length; i += 1) {
    const fixture = payload.fixtures[i];
    if (i > 0) {
      haengeMotorNeuEin(fixture);
      await wartenAufMotor(payload.timeoutMs);
    }
    if (!fenster.__arena) {
      throw new Error(`arena-headless-runner: window.__arena fehlt bei Fixture ${i}.`);
    }
    ergebnisse.push(
      payload.chassis === "buehneHeben"
        ? fenster.__arena.spieleBuehneHeben(payload.disziplin, fixture.seed)
        : fenster.__arena.spieleFeldspiel(payload.disziplin, fixture.seed),
    );
  }
  return ergebnisse;
}

async function schliesseBrowserHart(browser: Browser) {
  // Playwright schliesst den Chromium-Prozess mit `browser.close()` normalerweise sauber;
  // ein zweiter, erzwungener Versuch ist hier bewusst NICHT eingebaut — ein Fehlschlag von
  // `close()` selbst wuerde ohnehin nur denselben Fehler ein zweites Mal werfen. Der
  // `finally`-Block im Aufrufer sorgt dafuer, dass dieser Aufruf auch bei einem Fehler mitten
  // in der Simulation garantiert stattfindet (kein Zombie-Prozess, Plan Abschnitt 5.4).
  await browser.close();
}

/**
 * Fuehrt eine Menge von Arena-Fixtures (typischerweise ein Spieltag/eine Liga, s. Plan
 * Abschnitt 3.3c: 8 Fixtures) headless aus und liefert fuer jedes ein Ergebnis zurueck.
 *
 * NOCH NICHT AN DIE ECHTE RESOLVE-PIPELINE ANGEBUNDEN (das ist PR 7/8) — dieser Service ist
 * bewusst eigenstaendig aufrufbar und testbar, ohne dass ein "Spieltag simulieren"-Klick ihn
 * schon ausloest.
 */
export async function runArenaFixtures(
  gameState: GameState,
  fixtures: ArenaFixtureInput[],
  disziplin: string,
  options: RunArenaFixturesOptions = {},
): Promise<ArenaFixtureResult[]> {
  if (fixtures.length === 0) return [];

  const vorbereitet = bereiteFixturesVor(gameState, fixtures, options.attributeSheetOverrides);
  const seitenPfad = path.resolve(process.cwd(), "public", "mockups", "battle-mode.html");
  if (!existsSync(seitenPfad)) {
    throw new Error(`arena-headless-runner: battle-mode.html nicht gefunden unter ${seitenPfad}.`);
  }
  const timeoutMs = options.seitenTimeoutMs ?? STANDARD_SEITEN_TIMEOUT_MS;

  const browser = await chromium.launch(ermittleChromiumLaunchOptions(options.chromiumExecutablePath));
  try {
    const page: Page = await browser.newPage();
    // TSX/ESBUILD-KOMPATIBILITAET (PPS-Skalierung, 03.09., gefunden beim Bau von
    // scripts/ziehe-basketball-pps-referenz.ts): `tsx` -- der Loader, mit dem JEDES Skript in
    // scripts/ per `npx tsx` laeuft -- transformiert JEDE Datei mit esbuilds `keepNames:true`
    // (fest verdrahtet in tsx selbst, nicht abschaltbar). Das schreibt eine benannte
    // Funktion/Arrow-Const zu `x = /* @__PURE__ */ __name(x, "x")` um -- AUCH innerhalb von
    // `simuliereFixturesImBrowser` unten, deren eigene Hilfsfunktionen (`wartenAufMotor`,
    // `haengeMotorNeuEin`) genau solche benannten Consts sind. `page.evaluate()` uebertraegt die
    // Funktion aber nur als TEXT (`.toString()`) in den Browser -- der `__name`-Aufruf reist mit,
    // die Helper-Definition selbst nicht. Ergebnis: JEDER tsx-getriebene Aufruf von
    // `runArenaFixtures()` schlug mit "ReferenceError: __name is not defined" fehl, bevor auch
    // nur ein Fixture simuliert wurde. Ueber Next.js/Webpack (Produktivpfad) und Vitest (die
    // gesamte bestehende Testsuite) trat das nie auf, weil beide anders buendeln -- weshalb es
    // bislang unbemerkt blieb: keine bestehende Datei ruft diese Funktion ueber `tsx` auf. Ein
    // Identitaets-Shim ist ueberall harmlos, auch dort, wo `__name` nie aufgerufen wird.
    await page.addInitScript(() => {
      const fenster = window as unknown as { __name?: (fn: unknown, name?: string) => unknown };
      if (typeof fenster.__name !== "function") {
        fenster.__name = (fn) => fn;
      }
    });
    // Erstes Fixture VOR der Navigation setzen (Plan Abschnitt 3.3b) — der normale
    // Seitenaufbau (battle-mode.html haengt battle-mode.engine.js selbst per <script src> ein)
    // liest diesen Kader dann beim allerersten Motor-Start, kein zusaetzliches Einhaengen noetig.
    await page.addInitScript((kader) => {
      (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = kader;
    }, {
      heim: vorbereitet[0].heim,
      gast: vorbereitet[0].gast,
      aufstellung: vorbereitet[0].aufstellung,
    });

    await page.goto(pathToFileURL(seitenPfad).href);

    const chassis: "feldspiel" | "buehneHeben" = ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS.has(disziplin)
      ? "buehneHeben"
      : "feldspiel";
    const rohErgebnisse = await page.evaluate(simuliereFixturesImBrowser, {
      fixtures: vorbereitet.map(({ heim, gast, seed, aufstellung }) => ({
        heim,
        gast,
        seed,
        aufstellung,
      })),
      disziplin,
      chassis,
      timeoutMs,
    });

    // Review-Fund (PR #776): die Fehlermeldung unten muss die TATSAECHLICH aufgerufene
    // Browser-Funktion nennen -- vor der Chassis-Weiche stand hier "spieleFeldspiel"
    // hartkodiert, obwohl derselbe Codepfad seit der Gewichtheben-Produktivierung auch
    // "spieleBuehneHeben" aufruft. Ein Fehler im Buehnen-Pfad haette damit faelschlich auf die
    // falsche Funktion gezeigt und beim Debuggen eines echten Produktionsfehlers in die Irre
    // gefuehrt.
    const aufgerufeneFunktion = chassis === "buehneHeben" ? "spieleBuehneHeben" : "spieleFeldspiel";
    return rohErgebnisse.map((ergebnis, index) => {
      if (!ergebnis) {
        throw new Error(
          `arena-headless-runner: ${aufgerufeneFunktion}("${disziplin}", ...) lieferte null fuer Fixture ${index} (${vorbereitet[index].homeTeamId} vs. ${vorbereitet[index].awayTeamId}) — unbekannte Disziplin?`,
        );
      }
      // Namenszuordnung PRO FIXTURE (nicht global): derselbe Name in zwei VERSCHIEDENEN
      // Fixtures desselben Batches ist unproblematisch (jedes Duell hat sein eigenes Kader-Paar),
      // nur eine Kollision INNERHALB dieses einen Duells zaehlt.
      const zuordnung = baueEindeutigeNamenZuordnung(vorbereitet[index].heim, vorbereitet[index].gast);
      const boxscore: ArenaFixtureBoxscoreEintrag[] = ergebnis.boxscore.map((eintrag) => {
        const treffer = zuordnung.get(eintrag.name);
        return {
          name: eintrag.name,
          wert: eintrag.wert,
          playerId: treffer?.playerId ?? null,
          side: treffer?.side ?? null,
          torwart: !!eintrag.torwart,
        };
      });
      return {
        homeTeamId: vorbereitet[index].homeTeamId,
        awayTeamId: vorbereitet[index].awayTeamId,
        seiten: ergebnis.seiten,
        boxscore,
        ...(ergebnis.gesamtKg ? { gesamtKg: ergebnis.gesamtKg } : {}),
      };
    });
  } finally {
    await schliesseBrowserHart(browser);
  }
}

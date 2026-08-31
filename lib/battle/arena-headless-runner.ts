import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";

import { buildArenaTeam, type ArenaSpieler } from "@/lib/foundation/battle-arena/arena-kader-adapter";
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
};

export type ArenaFixtureResult = {
  homeTeamId: string;
  awayTeamId: string;
  /** Punktestand [heim, gast] — direkt aus `spieleFeldspiel()`s `seiten`-Feld. */
  seiten: [number, number];
  boxscore: ArenaFixtureBoxscoreEintrag[];
};

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
};

function ermittleChromiumLaunchOptions(executablePathOverride?: string) {
  const kandidat = executablePathOverride ?? STANDARD_CHROMIUM_EXECUTABLE_PATH;
  return existsSync(kandidat) ? { headless: true, executablePath: kandidat } : { headless: true };
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
    if (heim.length === 0 && gast.length === 0) {
      throw new Error(
        `arena-headless-runner: weder ${fixture.homeTeamId} noch ${fixture.awayTeamId} stellen einen einsatzfaehigen Kader (fehlende Attribut-Boegen?).`,
      );
    }
    return { ...fixture, seed: seedZuZahl(fixture.seed), heim, gast };
  });
}

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
  fixtures: { heim: ArenaSpieler[]; gast: ArenaSpieler[]; seed: number }[];
  disziplin: string;
  timeoutMs: number;
}): Promise<Array<{ disziplin: string; seiten: [number, number]; boxscore: ArenaFixtureBoxscoreEintrag[] } | null>> {
  const fenster = window as unknown as {
    __arena?: { spieleFeldspiel: (fd: string, saat: number) => { disziplin: string; seiten: [number, number]; boxscore: ArenaFixtureBoxscoreEintrag[] } | null };
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

  const haengeMotorNeuEin = (kader: { heim: ArenaSpieler[]; gast: ArenaSpieler[] }) => {
    fenster.__olyArenaKader = { heim: kader.heim, gast: kader.gast };
    delete fenster.__arena;
    document.querySelectorAll("script[data-oly-headless-engine]").forEach((el) => el.remove());
    const script = document.createElement("script");
    script.src = "battle-mode.engine.js";
    script.setAttribute("data-oly-headless-engine", "1");
    document.body.appendChild(script);
  };

  await wartenAufMotor(payload.timeoutMs);

  const ergebnisse: Array<{ disziplin: string; seiten: [number, number]; boxscore: ArenaFixtureBoxscoreEintrag[] } | null> = [];
  for (let i = 0; i < payload.fixtures.length; i += 1) {
    const fixture = payload.fixtures[i];
    if (i > 0) {
      haengeMotorNeuEin(fixture);
      await wartenAufMotor(payload.timeoutMs);
    }
    if (!fenster.__arena) {
      throw new Error(`arena-headless-runner: window.__arena fehlt bei Fixture ${i}.`);
    }
    ergebnisse.push(fenster.__arena.spieleFeldspiel(payload.disziplin, fixture.seed));
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
    // Erstes Fixture VOR der Navigation setzen (Plan Abschnitt 3.3b) — der normale
    // Seitenaufbau (battle-mode.html haengt battle-mode.engine.js selbst per <script src> ein)
    // liest diesen Kader dann beim allerersten Motor-Start, kein zusaetzliches Einhaengen noetig.
    await page.addInitScript((kader) => {
      (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = kader;
    }, { heim: vorbereitet[0].heim, gast: vorbereitet[0].gast });

    await page.goto(pathToFileURL(seitenPfad).href);

    const rohErgebnisse = await page.evaluate(simuliereFixturesImBrowser, {
      fixtures: vorbereitet.map(({ heim, gast, seed }) => ({ heim, gast, seed })),
      disziplin,
      timeoutMs,
    });

    return rohErgebnisse.map((ergebnis, index) => {
      if (!ergebnis) {
        throw new Error(
          `arena-headless-runner: spieleFeldspiel("${disziplin}", ...) lieferte null fuer Fixture ${index} (${vorbereitet[index].homeTeamId} vs. ${vorbereitet[index].awayTeamId}) — unbekannte Disziplin?`,
        );
      }
      return {
        homeTeamId: vorbereitet[index].homeTeamId,
        awayTeamId: vorbereitet[index].awayTeamId,
        seiten: ergebnis.seiten,
        boxscore: ergebnis.boxscore,
      };
    });
  } finally {
    await schliesseBrowserHart(browser);
  }
}

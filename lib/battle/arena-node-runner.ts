import { existsSync } from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";

import {
  baueArenaFixtureErgebnisse,
  baueMiniDmPodErgebnisse,
  bereiteFixturesVor,
  bereiteMiniDmPodsVor,
  waehleArenaChassis,
  type ArenaFixtureInput,
  type ArenaFixtureResult,
  type MiniDmFfaPodFixtureInput,
  type MiniDmFfaPodFixtureResult,
  type RoherBrowserFixtureErgebnis,
  type RoherMiniDmFfaEventErgebnis,
  type RunArenaFixturesOptions,
  type RunMiniDmFfaPodFixturesOptions,
} from "@/lib/battle/arena-headless-runner";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * ARENA-RUNNER OHNE CHROMIUM (Quick-Sim, 27.10.) — dieselbe Schnittstelle wie
 * `runArenaFixtures()`/`runMiniDmFfaPodFixtures()` aus `arena-headless-runner.ts`, dasselbe
 * Ergebnisformat (`ArenaFixtureResult` bzw. `MiniDmFfaPodFixtureResult`), aber der Motor laeuft
 * in einem Node-Worker-Thread (`arena-node-worker.mjs` -> `arena-node-motor.mjs`) statt in einem
 * headless Chromium.
 *
 * WARUM: Chris am 27.10. — "wir wollen ja nicht nach dem man auf Quick Sim drueckt 2 Minuten auf
 * ein Ergebnis warten!" Der Chromium-Pfad kostete je Spieltag 20-110 s (Task #212, gemessen:
 * Browserstart, Seitenaufbau und vor allem das Neu-Einhaengen des 7,7-MB-Motors je Fixture). In
 * Node entfaellt der Browser ganz; Motor-Laden kostet ~15 ms je Fixture statt 500-900 ms.
 *
 * WAS GLEICH BLEIBT (und warum das belastbar ist): Kaderaufbau, Saat-Normalisierung, Chassis-Wahl
 * und die Aufbereitung der Rohdaten sind DIESELBEN exportierten Funktionen wie im Chromium-Runner
 * (`bereiteFixturesVor`, `waehleArenaChassis`, `baueArenaFixtureErgebnisse`, ...), nicht Kopien.
 * Der Motor selbst ist dieselbe Datei. Die einzige Differenz ist die Browser-Nachbildung in
 * `arena-node-motor.mjs`; deren Paritaet zu Chromium prueft `tests/arena-node-runner-paritaet.test.ts`.
 *
 * WAS DIESE DATEI NICHT TUT: sie entscheidet nicht, WANN Node statt Chromium laeuft. Das tut
 * ausschliesslich der Quick-Sim-Pfad (`beschleunigeArenaVorlaufPerQuickSim()`,
 * arena-vorlauf-service.ts); der normale Hintergrund-Vorlauf bleibt beim Chromium-Runner.
 */

/** Wie lange ein einzelner Worker-Lauf (eine Liga-Stufe einer Disziplin) hoechstens dauern darf. */
export function resolveArenaNodeTimeoutMs(): number {
  const parsed = Number(process.env.OLY_ARENA_NODE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

/**
 * Hoechstens so viele Motor-Worker gleichzeitig im ganzen Prozess. Je Worker gemessen einige
 * hundert MB Heap; der CX23 hat 3,8 GB fuer App + SQLite + ggf. einen laufenden Chromium-Vorlauf.
 * 2 deckt die zwei parallelen Liga-Stufen eines Vorlaufs (`runBattleModeArenaMatchday()`) ab.
 */
function resolveArenaNodeParallel(): number {
  const parsed = Number(process.env.OLY_ARENA_NODE_PARALLEL);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 2;
}

/** Heap-Obergrenze je Worker: ein ausufernder Lauf stirbt mit OOM im Worker, nicht im Server. */
function resolveArenaNodeMaxHeapMb(): number {
  const parsed = Number(process.env.OLY_ARENA_NODE_MAX_HEAP_MB);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1024;
}

export type RunArenaFixturesNodeOptions = RunArenaFixturesOptions & {
  /** Uebersteuert `OLY_ARENA_NODE_TIMEOUT_MS` fuer diesen Aufruf. */
  nodeTimeoutMs?: number;
};

export type RunMiniDmFfaPodFixturesNodeOptions = RunMiniDmFfaPodFixturesOptions & {
  nodeTimeoutMs?: number;
};

// ---------------------------------------------------------------------------------------------
// Worker-Verwaltung
// ---------------------------------------------------------------------------------------------

type DuellAuftrag = {
  art: "duelle";
  disziplin: string;
  chassis: ReturnType<typeof waehleArenaChassis>;
  mutatoren: string[];
  buehneFlags?: Record<string, number>;
  fixtures: Array<{ heim: unknown[]; gast: unknown[]; aufstellung: unknown; seed: number }>;
};

type MiniDmAuftrag = {
  art: "miniDm";
  mutatoren: string[];
  bootstrap: { heim: unknown[]; gast: unknown[] };
  pods: Array<{ teams: unknown[][]; seed: number; platzJeTeam: unknown[]; optionen?: { k?: number; formSaat?: number } }>;
};

type WorkerAntwort = { ok: true; ergebnisse: unknown[]; dauerMs: number } | { ok: false; fehler: string };

function ermittlePfade() {
  const workerPfad = path.resolve(process.cwd(), "lib", "battle", "arena-node-worker.mjs");
  const mockupVerzeichnis = path.resolve(process.cwd(), "public", "mockups");
  if (!existsSync(workerPfad)) throw new Error(`arena-node-runner: Worker nicht gefunden unter ${workerPfad}.`);
  if (!existsSync(path.join(mockupVerzeichnis, "battle-mode.engine.js"))) {
    throw new Error(`arena-node-runner: battle-mode.engine.js nicht gefunden unter ${mockupVerzeichnis}.`);
  }
  return { workerPfad, mockupVerzeichnis };
}

let laufendeWorker = 0;
const wartendeWorker: Array<() => void> = [];

async function mitWorkerPlatz<T>(fn: () => Promise<T>): Promise<T> {
  if (laufendeWorker >= resolveArenaNodeParallel()) {
    await new Promise<void>((resolve) => wartendeWorker.push(resolve));
  }
  laufendeWorker += 1;
  try {
    return await fn();
  } finally {
    laufendeWorker -= 1;
    wartendeWorker.shift()?.();
  }
}

/**
 * Startet EINEN Worker fuer EINEN Auftrag und beendet ihn danach immer — auch bei Fehler oder
 * Zeitueberschreitung (`terminate()` stoppt auch eine haengende synchrone Simulation, anders als
 * jedes Timeout im selben Thread).
 */
function fuehreWorkerAus(auftrag: DuellAuftrag | MiniDmAuftrag, timeoutMs: number): Promise<unknown[]> {
  const { workerPfad, mockupVerzeichnis } = ermittlePfade();
  return mitWorkerPlatz(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const worker = new Worker(workerPfad, {
          workerData: { mockupVerzeichnis, auftrag },
          resourceLimits: { maxOldGenerationSizeMb: resolveArenaNodeMaxHeapMb() },
        });
        let erledigt = false;
        const beende = (fehler: Error | null, ergebnisse?: unknown[]) => {
          if (erledigt) return;
          erledigt = true;
          clearTimeout(zeitgrenze);
          void worker.terminate();
          if (fehler) reject(fehler);
          else resolve(ergebnisse ?? []);
        };
        const zeitgrenze = setTimeout(() => {
          beende(new Error(`arena-node-runner: Timeout (${timeoutMs}ms) ueberschritten -- Worker hart beendet.`));
        }, timeoutMs);
        worker.once("message", (antwort: WorkerAntwort) => {
          if (antwort && antwort.ok === true && Array.isArray(antwort.ergebnisse)) beende(null, antwort.ergebnisse);
          else beende(new Error(`arena-node-runner: Motor-Fehler im Worker: ${antwort && antwort.ok === false ? antwort.fehler : "unbekannte Antwort"}`));
        });
        worker.once("error", (fehler) => beende(fehler instanceof Error ? fehler : new Error(String(fehler))));
        worker.once("exit", (code) => beende(new Error(`arena-node-runner: Worker endete ohne Ergebnis (Exit-Code ${code}).`)));
      }),
  );
}

// ---------------------------------------------------------------------------------------------
// Formpruefung der Rohdaten
// ---------------------------------------------------------------------------------------------

const MOMENT_TYPEN = new Set(["fuehrungswechsel", "fuehrungswechselEntscheidend", "entscheidend", "turnover"]);

function istZahlenpaar(wert: unknown): wert is [number, number] {
  return Array.isArray(wert) && wert.length === 2 && wert.every((x) => typeof x === "number" && Number.isFinite(x));
}

/**
 * Prueft ein rohes Duell-Ergebnis auf GENAU die Felder, die `baueArenaFixtureErgebnisse()` und die
 * Wertung danach lesen. Wirft bei jeder Abweichung — der Aufrufer (Quick-Sim) faellt dann auf den
 * Chromium-Pfad zurueck, statt ein halbes Ergebnis zu buchen. `null` bleibt erlaubt: das behandelt
 * `baueArenaFixtureErgebnisse()` selbst (mit derselben Meldung wie im Chromium-Pfad).
 */
export function pruefeRohesDuellErgebnis(roh: unknown, kontext: string): RoherBrowserFixtureErgebnis | null {
  if (roh === null) return null;
  const fehler = (was: string) => new Error(`arena-node-runner: unerwartetes Ergebnisformat (${kontext}): ${was}`);
  if (typeof roh !== "object") throw fehler("kein Objekt");
  const r = roh as Record<string, unknown>;
  if (!istZahlenpaar(r.seiten)) throw fehler("`seiten` ist kein endliches Zahlenpaar");
  if (!Array.isArray(r.boxscore)) throw fehler("`boxscore` ist kein Array");
  for (const eintrag of r.boxscore) {
    const e = eintrag as Record<string, unknown> | null;
    if (!e || typeof e.name !== "string" || typeof e.wert !== "number" || Number.isNaN(e.wert)) {
      throw fehler("Boxscore-Eintrag ohne `name`/`wert`");
    }
  }
  if (r.gesamtKg !== undefined && !istZahlenpaar(r.gesamtKg)) throw fehler("`gesamtKg` ist kein Zahlenpaar");
  if (r.momente !== undefined) {
    if (!Array.isArray(r.momente)) throw fehler("`momente` ist kein Array");
    for (const moment of r.momente) {
      const m = moment as Record<string, unknown> | null;
      if (!m || !MOMENT_TYPEN.has(String(m.typ)) || (m.seite !== 0 && m.seite !== 1)) throw fehler("ungueltiger Moment");
    }
  }
  return roh as RoherBrowserFixtureErgebnis;
}

/** Wie `pruefeRohesDuellErgebnis()`, fuer `miniDmFfaEvent()`. */
export function pruefeRohesMiniDmErgebnis(roh: unknown, kontext: string): RoherMiniDmFfaEventErgebnis | null {
  if (roh === null) return null;
  const fehler = (was: string) => new Error(`arena-node-runner: unerwartetes Mini-DM-Ergebnisformat (${kontext}): ${was}`);
  if (typeof roh !== "object") throw fehler("kein Objekt");
  const r = roh as Record<string, unknown>;
  if (!Array.isArray(r.runden) || !Array.isArray(r.teams)) throw fehler("`runden`/`teams` fehlen");
  for (const runde of r.runden as Array<Record<string, unknown> | null>) {
    if (!runde || typeof runde.slotId !== "string" || !Array.isArray(runde.teams)) throw fehler("ungueltige Runde");
    for (const t of runde.teams as Array<Record<string, unknown> | null>) {
      if (!t || typeof t.n !== "string" || typeof t.side !== "number" || typeof t.rundenPlatz !== "number" || typeof t.rundenPunkte !== "number" || typeof t.beitrag !== "number") {
        throw fehler("ungueltiger Runden-Eintrag");
      }
    }
  }
  for (const t of r.teams as Array<Record<string, unknown> | null>) {
    if (!t || ["side", "rundenPunkteSumme", "beitragSumme", "eventPlatz", "ligaPunkte"].some((k) => typeof t[k] !== "number")) {
      throw fehler("ungueltiger Team-Eintrag");
    }
  }
  return roh as RoherMiniDmFfaEventErgebnis;
}

// ---------------------------------------------------------------------------------------------
// Oeffentliche Runner — Signaturen wie im Chromium-Runner
// ---------------------------------------------------------------------------------------------

/**
 * Node-Gegenstueck zu `runArenaFixtures()` — gleiche Eingaben, gleiches Ergebnis, kein Chromium.
 * Wirft bei jedem Fehler (Worker-Absturz, Timeout, unerwartetes Format); einen Rueckfall auf
 * Chromium entscheidet der Aufrufer.
 */
export async function runArenaFixturesNode(
  gameState: GameState,
  fixtures: ArenaFixtureInput[],
  disziplin: string,
  options: RunArenaFixturesNodeOptions = {},
): Promise<ArenaFixtureResult[]> {
  if (fixtures.length === 0) return [];
  const vorbereitet = bereiteFixturesVor(gameState, fixtures, options.attributeSheetOverrides);
  const chassis = waehleArenaChassis(disziplin);
  const mutatoren = [...(options.mutatoren ?? [])].map((trait) => String(trait).trim()).filter(Boolean);
  const roh = await fuehreWorkerAus(
    {
      art: "duelle",
      disziplin,
      chassis,
      mutatoren,
      ...(options.buehneFlags ? { buehneFlags: { ...options.buehneFlags } } : {}),
      fixtures: vorbereitet.map(({ heim, gast, aufstellung, seed }) => ({ heim, gast, aufstellung, seed })),
    },
    options.nodeTimeoutMs ?? resolveArenaNodeTimeoutMs(),
  );
  if (roh.length !== vorbereitet.length) {
    throw new Error(`arena-node-runner: ${roh.length} Ergebnisse fuer ${vorbereitet.length} Fixtures ("${disziplin}").`);
  }
  const geprueft = roh.map((ergebnis, index) =>
    pruefeRohesDuellErgebnis(ergebnis, `${disziplin} #${index} ${vorbereitet[index].homeTeamId} vs. ${vorbereitet[index].awayTeamId}`),
  );
  return baueArenaFixtureErgebnisse(vorbereitet, geprueft, disziplin, chassis);
}

/** Node-Gegenstueck zu `runMiniDmFfaPodFixtures()` (gleiche `formSaat`-/`k`-Regeln). */
export async function runMiniDmFfaPodFixturesNode(
  gameState: GameState,
  pods: MiniDmFfaPodFixtureInput[],
  options: RunMiniDmFfaPodFixturesNodeOptions = {},
): Promise<Array<MiniDmFfaPodFixtureResult | null>> {
  if (pods.length === 0) return [];
  const { vorbereitet, einsatzfaehig } = bereiteMiniDmPodsVor(gameState, pods, options);
  const laufbarePods = vorbereitet.filter((_, index) => einsatzfaehig[index]);
  if (laufbarePods.length === 0) return vorbereitet.map(() => null);
  const bootstrapPod = laufbarePods[0]!;
  const roh = await fuehreWorkerAus(
    {
      art: "miniDm",
      mutatoren: options.mutatoren ?? [],
      bootstrap: { heim: bootstrapPod.kaderJeTeam[0], gast: bootstrapPod.kaderJeTeam[1] },
      pods: laufbarePods.map((pod) => ({
        teams: pod.kaderJeTeam,
        seed: pod.seed,
        platzJeTeam: pod.platzJeTeam,
        optionen: { ...(options.k != null ? { k: options.k } : {}), formSaat: pod.seed },
      })),
    },
    options.nodeTimeoutMs ?? resolveArenaNodeTimeoutMs(),
  );
  if (roh.length !== laufbarePods.length) {
    throw new Error(`arena-node-runner: ${roh.length} Mini-DM-Ergebnisse fuer ${laufbarePods.length} Pods.`);
  }
  const geprueft = roh.map((ergebnis, index) => pruefeRohesMiniDmErgebnis(ergebnis, `mini-dm ${laufbarePods[index].podId}`));
  return baueMiniDmPodErgebnisse(vorbereitet, einsatzfaehig, geprueft);
}

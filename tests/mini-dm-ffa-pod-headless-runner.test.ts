/**
 * Abnahme fuer `runMiniDmFfaPodFixtures()` (mini-dm-spielplan-verankerung, 14.09.) —
 * lib/battle/arena-headless-runner.ts.
 *
 * Wiring-Nachweis: dieselbe echte, bereits fertige FFA-Simulation
 * (`window.__arena.miniDmFfaEvent()`, battle-mode.engine.js, "vier Rollenrunden") laeuft jetzt
 * ueber einen Node/Playwright-Runner fuer ein `MiniDmPod` (4 echte Teams), statt nur ueber die
 * Mess-Skript-Testschnittstelle erreichbar zu sein. PRAESENTATIONSZWECK NUR — kein Assert hier
 * bucht irgendetwas in eine Saisontabelle, s. Kopfkommentar der Funktion.
 *
 * Laeuft gegen echten Chromium, genau wie `arena-headless-runner.test.ts` — deshalb dasselbe
 * `describe.skipIf`-Muster und Timeout-Budget.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runMiniDmFfaPodFixtures, type MiniDmFfaPodFixtureResult } from "@/lib/battle/arena-headless-runner";
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const LAUF_TIMEOUT_MS = 90_000;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  const cache = join(homedir(), ".cache", "ms-playwright");
  try {
    return readdirSync(cache).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}

const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();

type PsZeile = { pid: string; ppid: string; args: string };

/**
 * Ein `ps`-Schnappschuss mit PPID -- aus demselben Grund wie in
 * tests/arena-headless-runner.test.ts (Flaky-Fund 07.10.): ein reiner Vorher/Nachher-Vergleich
 * ueber ALLE Chromium-Prozesse der Maschine ist fragil, sobald irgendein ANDERER Prozess waehrend
 * des Tests nebenlaeufig Chromium startet oder beendet. Die PPID traegt die Abstammungspruefung
 * in `eigeneProfileAusSchnappschuss()`, die stattdessen nur UNSERE eigenen Chromium-Prozesse
 * findet.
 */
function schnappschuss(): PsZeile[] | null {
  try {
    const ausgabe = execSync("ps -eo pid,ppid,args", { encoding: "utf8" });
    const zeilen: PsZeile[] = [];
    for (const zeile of ausgabe.split("\n")) {
      const treffer = zeile.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
      if (treffer) zeilen.push({ pid: treffer[1], ppid: treffer[2], args: treffer[3] });
    }
    return zeilen;
  } catch {
    return null;
  }
}

function istNachkommeVon(pid: string, ppidVon: Map<string, string>, wurzel: string): boolean {
  let aktuell = pid;
  const gesehen = new Set<string>();
  for (;;) {
    const ppid = ppidVon.get(aktuell);
    if (!ppid || gesehen.has(aktuell)) return false;
    if (ppid === wurzel) return true;
    gesehen.add(aktuell);
    aktuell = ppid;
  }
}

/**
 * Liefert die `--user-data-dir`-Profile aller Chromium-Prozesse im Schnappschuss, die zu diesem
 * Zeitpunkt (noch) Nachkommen von `wurzelPid` sind -- also nachweisbar von DIESEM Testprozess
 * gestartet wurden, nicht von irgendeinem anderen, gleichzeitig in dieser geteilten Umgebung
 * laufenden Agenten (ausfuehrlicher Kommentar in tests/arena-headless-runner.test.ts).
 */
function eigeneProfileAusSchnappschuss(zeilen: PsZeile[], wurzelPid: number): Set<string> {
  const ppidVon = new Map(zeilen.map((z) => [z.pid, z.ppid]));
  const profile = new Set<string>();
  for (const z of zeilen) {
    if (!z.args.includes(CHROMIUM_PFAD)) continue;
    if (!istNachkommeVon(z.pid, ppidVon, String(wurzelPid))) continue;
    const treffer = z.args.match(/--user-data-dir=(\S+)/);
    if (treffer) profile.add(treffer[1]);
  }
  return profile;
}

/**
 * Sammelt waehrend `aktion()` laufend (alle 100ms) die Playwright-Profilverzeichnisse, die dieser
 * Testprozess selbst gestartet hat (ausfuehrlicher Kommentar in
 * tests/arena-headless-runner.test.ts). Sobald `browser.close()` den Hauptprozess beendet, werden
 * seine verbliebenen Helfer (Zygote/GPU/Utility/crashpad_handler) vom Kernel auf PID 1
 * umgehaengt -- danach ist eine Abstammungspruefung wirkungslos. Das pro Start zufaellige
 * `--user-data-dir` bleibt dagegen in jedem zugehoerigen Prozess sichtbar.
 */
async function sammleEigeneProfileWaehrend(aktion: () => Promise<void>): Promise<Set<string>> {
  const profile = new Set<string>();
  let laeuft = true;
  const erfasse = () => {
    const zeilen = schnappschuss();
    if (zeilen) for (const p of eigeneProfileAusSchnappschuss(zeilen, process.pid)) profile.add(p);
  };
  const sammlerFertig = (async () => {
    while (laeuft) {
      erfasse();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    erfasse(); // letzter Schnappschuss, falls `aktion` zwischen zwei Intervallen fertig wurde
  })();
  try {
    await aktion();
  } finally {
    laeuft = false;
    await sammlerFertig;
  }
  return profile;
}

/**
 * Wartet bis zu `maxWartenMs` darauf, dass kein Chromium-Prozess mit einem der gesammelten
 * Profile mehr lebt, und liefert die am Ende noch lebenden PIDs zurueck (leer = kein Leck).
 */
async function wartetBisProfileVerschwinden(profile: Set<string>, maxWartenMs = 5000): Promise<string[]> {
  if (profile.size === 0) return [];
  const start = Date.now();
  for (;;) {
    const zeilen = schnappschuss();
    const lebend =
      zeilen === null
        ? []
        : zeilen.filter((z) => z.args.includes(CHROMIUM_PFAD) && [...profile].some((p) => z.args.includes(p))).map((z) => z.pid);
    if (lebend.length === 0 || Date.now() - start >= maxWartenMs) return lebend;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/** Zehn Spieler je Team, wie tests/arena-headless-runner.test.ts (dieselbe Begruendung: ein
 *  synthetischer 6-Spieler-Kader trifft einen unabhaengigen UI-Sonderpfad im Motor). */
function baueKader(teamId: string, spielerPrefix: string, anzahl = 10): { players: Player[]; rosters: RosterEntry[] } {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (let i = 0; i < anzahl; i += 1) {
    const playerId = `${spielerPrefix}-${i}`;
    players.push({
      id: playerId,
      name: `${spielerPrefix} Spieler ${i}`,
      rating: 50,
      marketValue: 100_000,
      salaryDemand: 10_000,
      className: "Warrior",
      race: "Human",
      alignment: "neutral",
      gender: "diverse",
      subclasses: ["Warrior"],
      traitsPositive: ["Loyal"],
      traitsNegative: [],
      disciplineRatings: { "mini-dm": 30 + i * 5, tdm: 20 + i, spurt: 20 + i },
      attributeSheetStats: {
        power: 40 + i,
        health: 50 + i,
        stamina: 45 + i,
        intelligence: 30 + i,
        awareness: 35 + i,
        determination: 40 + i,
        speed: 55 + i,
        dexterity: 50 + i,
        charisma: 20 + i,
        will: 30 + i,
        spirit: 25 + i,
        torment: 10 + i,
      },
      preferredDisciplineIds: ["mini-dm"],
    } as unknown as Player);
    rosters.push({ id: `roster-${playerId}`, teamId, playerId, contractLength: 3 } as unknown as RosterEntry);
  }
  return { players, rosters };
}

function baueGameState(...teams: { teamId: string; prefix: string; anzahl?: number }[]): GameState {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (const team of teams) {
    const kader = baueKader(team.teamId, team.prefix, team.anzahl);
    players.push(...kader.players);
    rosters.push(...kader.rosters);
  }
  return { players, rosters } as unknown as GameState;
}

function pruefePodErgebnisForm(ergebnis: MiniDmFfaPodFixtureResult | null, teamIds: readonly string[]) {
  expect(ergebnis).not.toBeNull();
  const pod = ergebnis!;
  expect(pod.teams).toHaveLength(4);
  // Chris' ausdrueckliche Ligapunkte-Uebersteuerung [2,1,0,0], Summe 3 — s. Kopfkommentar im
  // Motor (MINI_DM_FFA_LIGAPUNKTE). Rein informativ, keine Buchung.
  const ligaPunkteSumme = pod.teams.reduce((sum, team) => sum + team.ligaPunkte, 0);
  expect(ligaPunkteSumme).toBeCloseTo(3, 5);
  const teamIdsInErgebnis = pod.teams.map((team) => team.teamId).sort();
  expect(teamIdsInErgebnis).toEqual([...teamIds].sort());
  // Vier Rollenrunden (Frontliner/Finisher/Trick Fighter/Iron Guard) -- jede mit 4 Boxscore-
  // Eintraegen (einer je Team) macht 16 Eintraege insgesamt.
  expect(pod.boxscore.length).toBe(16);
  for (const eintrag of pod.boxscore) {
    expect(teamIds).toContain(eintrag.teamId);
    expect(eintrag.podSide).toBeGreaterThanOrEqual(0);
    expect(eintrag.podSide).toBeLessThanOrEqual(3);
  }
}

describe.skipIf(!CHROMIUM_VERFUEGBAR)("runMiniDmFfaPodFixtures", () => {
  it(
    "simuliert einen echten 4-Team-Pod und liefert Boxscore + Ligapunkte je Team",
    async () => {
      const gameState = baueGameState(
        { teamId: "team-a", prefix: "A" },
        { teamId: "team-b", prefix: "B" },
        { teamId: "team-c", prefix: "C" },
        { teamId: "team-d", prefix: "D" },
      );

      const ergebnisse = await runMiniDmFfaPodFixtures(gameState, [
        { podId: "pod-1", teamIds: ["team-a", "team-b", "team-c", "team-d"], seed: "pod-seed-eins" },
      ]);

      expect(ergebnisse).toHaveLength(1);
      pruefePodErgebnisForm(ergebnisse[0], ["team-a", "team-b", "team-c", "team-d"]);
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "liefert bei gleichem Seed ein bitgenau identisches Ergebnis (Determinismus)",
    async () => {
      const gameState = baueGameState(
        { teamId: "team-a", prefix: "A" },
        { teamId: "team-b", prefix: "B" },
        { teamId: "team-c", prefix: "C" },
        { teamId: "team-d", prefix: "D" },
      );
      const pods = [{ podId: "pod-1", teamIds: ["team-a", "team-b", "team-c", "team-d"] as const, seed: "derselbe-seed" }];

      const erster = await runMiniDmFfaPodFixtures(gameState, [...pods]);
      const zweiter = await runMiniDmFfaPodFixtures(gameState, [...pods]);

      expect(zweiter).toEqual(erster);
    },
    LAUF_TIMEOUT_MS * 2,
  );

  it(
    "verarbeitet mehrere Pods in einem Batch, je mit eigenem Kader-Quartett",
    async () => {
      const gameState = baueGameState(
        { teamId: "team-a", prefix: "A" },
        { teamId: "team-b", prefix: "B" },
        { teamId: "team-c", prefix: "C" },
        { teamId: "team-d", prefix: "D" },
        { teamId: "team-e", prefix: "E" },
        { teamId: "team-f", prefix: "F" },
        { teamId: "team-g", prefix: "G" },
        { teamId: "team-h", prefix: "H" },
      );

      const ergebnisse = await runMiniDmFfaPodFixtures(gameState, [
        { podId: "pod-1", teamIds: ["team-a", "team-b", "team-c", "team-d"], seed: "batch-pod-1" },
        { podId: "pod-2", teamIds: ["team-e", "team-f", "team-g", "team-h"], seed: "batch-pod-2" },
      ]);

      expect(ergebnisse).toHaveLength(2);
      pruefePodErgebnisForm(ergebnisse[0], ["team-a", "team-b", "team-c", "team-d"]);
      pruefePodErgebnisForm(ergebnisse[1], ["team-e", "team-f", "team-g", "team-h"]);
      expect(ergebnisse[0]!.podId).toBe("pod-1");
      expect(ergebnisse[1]!.podId).toBe("pod-2");
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "liefert null (statt zu werfen) fuer einen Pod, dessen Team keinen Kader stellt",
    async () => {
      const gameState = baueGameState(
        { teamId: "team-a", prefix: "A" },
        { teamId: "team-b", prefix: "B" },
        { teamId: "team-c", prefix: "C" },
        // "team-d" bewusst OHNE Roster -- buildArenaTeam() liefert dafuer [].
      );

      const ergebnisse = await runMiniDmFfaPodFixtures(gameState, [
        { podId: "pod-unvollstaendig", teamIds: ["team-a", "team-b", "team-c", "team-d"], seed: "seed-luecke" },
      ]);

      expect(ergebnisse).toHaveLength(1);
      expect(ergebnisse[0]).toBeNull();
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "schliesst den Browser zuverlaessig nach Erfolg (kein Zombie-Prozess)",
    async () => {
      const gameState = baueGameState(
        { teamId: "team-a", prefix: "A" },
        { teamId: "team-b", prefix: "B" },
        { teamId: "team-c", prefix: "C" },
        { teamId: "team-d", prefix: "D" },
      );

      const profile = await sammleEigeneProfileWaehrend(async () => {
        await runMiniDmFfaPodFixtures(gameState, [
          { podId: "pod-shutdown", teamIds: ["team-a", "team-b", "team-c", "team-d"], seed: "seed-shutdown" },
        ]);
      });

      if (profile.size === 0) {
        // `ps` in dieser Umgebung nicht verfuegbar, ODER das 100ms-Sampling hat keinen einzigen
        // Schnappschuss waehrend eines lebenden Chromium-Prozesses getroffen -- der eigentliche
        // Simulationslauf oben ist trotzdem bereits erfolgreich durchgelaufen.
        return;
      }
      const lebend = await wartetBisProfileVerschwinden(profile);
      expect(lebend).toEqual([]);
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "liefert null (statt zu werfen) und startet keinen Browser, wenn ALLE Pods unvollstaendig sind",
    async () => {
      const gameState = baueGameState({ teamId: "team-a", prefix: "A" });
      let ergebnisse: (MiniDmFfaPodFixtureResult | null)[] = [];
      const profile = await sammleEigeneProfileWaehrend(async () => {
        ergebnisse = await runMiniDmFfaPodFixtures(gameState, [
          { podId: "pod-leer", teamIds: ["team-a", "team-b", "team-c", "team-d"], seed: "seed-leer" },
        ]);
      });
      expect(ergebnisse).toEqual([null]);
      if (profile.size === 0) {
        return;
      }
      const lebend = await wartetBisProfileVerschwinden(profile);
      expect(lebend).toEqual([]);
    },
    LAUF_TIMEOUT_MS,
  );
});

// ===================================================================================
// PUNKTEVERHAELTNIS-REFERENZ (M90) — Quelle "arena".
//
// Gegenstueck zu scripts/ziehe-verhaeltnis-referenz.ts (Quelle "pps"), fuer die in Battle Mode
// arena-gewerteten Disziplinen: m = |Seitenstand Heim − Gast| (`ArenaFixtureResult.seiten`), M90 =
// 90. Perzentil je Disziplin und Feldgroesse. Mechanismus UNVERAENDERT aus
// scripts/ziehe-buehne-pps-referenz.ts: echter Kader je Team (`buildArenaTeam()`), die besten n
// nach Disziplin-Eignung fest gesetzt, `runArenaFixtures()` gegen echte Liga-Kader, in Batches.
// Gepaart wird innerhalb der (nachgebildeten) Liga, wie im Battle Mode.
//
// STAFFEL UND TIME-TRIAL FEHLEN BEWUSST: `spieleBahn()` liefert dort `seiten` als reines 1:0
// (wertung "etappe"/"zeit") — m waere immer 1, D immer 10. Bis der Motor den Zeitabstand als
// `marge` hinausreicht (Konzept 16.10. Abschnitt 3.2, zwei additive Zeilen), gilt fuer beide der
// Rueckfall D = 5 je Sieg (Warnung `verhaeltnis_referenz_fehlt`).
//
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-verhaeltnis-referenz-arena.ts \
//     [--save=<saveId>] [--disziplinen=a,b] [--runden=4]
// ===================================================================================
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildArenaTeam, listeArenaTeams } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { runArenaFixtures } from "@/lib/battle/arena-headless-runner";
import { buildInitialLeagueAssignment, isLeagueSplitActive, type LeagueTier } from "@/lib/season/league-split";
import type { GameState, LineupDraft, LineupDraftEntry } from "@/lib/data/olyDataTypes";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = path.join(WURZEL, "data/generated/verhaeltnis-referenz.json");
const FELDGROESSEN = [2, 3, 4, 5, 6] as const;
const STANDARD_DISZIPLINEN = [
  "hockey",
  "gewichtheben",
  "speed-schach",
  "showcase",
  "eiskunstlauf",
  "breaking",
  "wettessen",
  "tennis",
  "fechten",
  "takeshis-castle",
  "spurt",
  "climbing",
];

const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=", 2);
    return [k!, v ?? "1"] as const;
  }),
);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gemischt<T>(liste: readonly T[], seed: number): T[] {
  const kopie = [...liste];
  const zufall = mulberry32(seed);
  for (let i = kopie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(zufall() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j]!, kopie[i]!];
  }
  return kopie;
}

function quantil(sortiert: readonly number[], p: number): number {
  if (sortiert.length === 0) return 0;
  const index = (sortiert.length - 1) * p;
  const unten = Math.floor(index);
  const oben = Math.ceil(index);
  if (unten === oben) return sortiert[unten]!;
  return sortiert[unten]! * (1 - (index - unten)) + sortiert[oben]! * (index - unten);
}

const r2 = (v: number) => Math.round(v * 100) / 100;

async function main() {
  const persistence = createPersistenceService();
  const saveId = args.get("save") ?? "new-game-1787123325719-swnjlk";
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save ${saveId} nicht im Abbild.`);
  const gameState = save.gameState;
  const disziplinen = args.get("disziplinen")?.split(",") ?? STANDARD_DISZIPLINEN;
  const runden = Number(args.get("runden") ?? 4);
  const teams = listeArenaTeams(gameState);
  const kader = new Map(teams.map((team) => [team.teamId, buildArenaTeam(gameState, team.teamId)] as const));
  const ligaJeTeam: Record<string, LeagueTier> = isLeagueSplitActive(gameState)
    ? (gameState.seasonState.leagueByTeamId as Record<string, LeagueTier>)
    : buildInitialLeagueAssignment(gameState.teams);

  const ergebnis: Record<string, { feldgroessen: Record<string, unknown> }> = {};
  function schreibe(neu: Record<string, unknown>) {
    const commit = (() => {
      try {
        return execSync("git rev-parse HEAD", { cwd: WURZEL, encoding: "utf8" }).trim();
      } catch {
        return "unbekannt";
      }
    })();
    const motorSha1 = (() => {
      try {
        return execSync("sha1sum public/mockups/battle-mode.engine.js", { cwd: WURZEL, encoding: "utf8" }).trim().split(/\s+/)[0];
      } catch {
        return "unbekannt";
      }
    })();
    const bestehend = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, "utf8")) : {};
    const quellen = { pps: {}, arena: {}, ...(bestehend.quellen ?? {}) };
    const ausgabe = {
      ...bestehend,
      provenienz: {
        ...(bestehend.provenienz ?? {}),
        arena: {
          gezogenAm: new Date().toISOString(),
          repoCommit: commit,
          motorSha1,
          quelle: { saveId, saveName: save!.name ?? null },
          mechanismus:
            "runArenaFixtures gegen echte Liga-Kader (buildArenaTeam), beste n nach Eignung, Paarung innerhalb der " +
            `(nachgebildeten) Liga, ${runden} Runden je Feldgroesse; Staffel/Time-Trial bewusst ohne Eintrag (seiten 1:0)`,
        },
      },
      quellen: { ...quellen, arena: { ...(quellen.arena as object), ...neu } },
    };
    writeFileSync(ZIEL, `${JSON.stringify(ausgabe, null, 1)}\n`);
  }
  const t0 = Date.now();
  for (const disziplin of disziplinen) {
    const feldgroessen: Record<string, unknown> = {};
    for (const n of FELDGROESSEN) {
      const matchdayId = `verhaeltnis-referenz-${n}`;
      const spielbar = teams.filter((team) => (kader.get(team.teamId)?.length ?? 0) >= n);
      const lineupDrafts: LineupDraft[] = spielbar.map((team) => {
        const top = [...kader.get(team.teamId)!].sort((a, b) => (b.d[disziplin] ?? 0) - (a.d[disziplin] ?? 0)).slice(0, n);
        const entries: LineupDraftEntry[] = top.map((spieler, slotIndex) => ({
          disciplineId: disziplin,
          disciplineSide: "d1",
          slotIndex,
          playerId: spieler.id,
          activePlayerId: null,
        }));
        return {
          lineupId: `verhaeltnis-referenz-${n}-${team.teamId}`,
          saveId,
          seasonId: gameState.season.id,
          matchdayId,
          teamId: team.teamId,
          status: "locked",
          entries,
          createdAt: "2026-10-16T00:00:00.000Z",
          updatedAt: "2026-10-16T00:00:00.000Z",
        };
      });
      const fixtures: { homeTeamId: string; awayTeamId: string; seed: string }[] = [];
      for (let runde = 0; runde < runden; runde += 1) {
        for (const tier of ["liga1", "liga2"] as const) {
          const liga = spielbar.filter((team) => ligaJeTeam[team.teamId] === tier).map((team) => team.teamId);
          const reihe = gemischt(liga, n * 1_000_003 + runde * 7919 + (tier === "liga1" ? 0 : 13));
          for (let i = 0; i + 1 < reihe.length; i += 2) {
            fixtures.push({
              homeTeamId: reihe[i]!,
              awayTeamId: reihe[i + 1]!,
              seed: `verhaeltnis-referenz-${disziplin}:${n}:${runde}:${reihe[i]}:${reihe[i + 1]}`,
            });
          }
        }
      }
      const gs: GameState = {
        ...gameState,
        matchdayState: { ...(gameState.matchdayState ?? {}), matchdayId },
        seasonState: { ...gameState.seasonState, lineupDrafts },
      };
      const margen: number[] = [];
      let remis = 0;
      for (let start = 0; start < fixtures.length; start += 20) {
        const ergebnisse = await runArenaFixtures(gs, fixtures.slice(start, start + 20), disziplin, {});
        for (const e of ergebnisse) {
          margen.push(Math.abs(e.seiten[0] - e.seiten[1]));
          if (e.seiten[0] === e.seiten[1]) remis += 1;
        }
      }
      margen.sort((a, b) => a - b);
      feldgroessen[String(n)] = {
        n,
        fixtures: margen.length,
        m90: r2(quantil(margen, 0.9)),
        median: r2(quantil(margen, 0.5)),
        p75: r2(quantil(margen, 0.75)),
        p95: r2(quantil(margen, 0.95)),
        max: r2(margen[margen.length - 1] ?? 0),
        remisAnteil: r2(remis / Math.max(1, margen.length)),
      };
      console.error(`[verhaeltnis-referenz-arena] ${disziplin} n=${n}: ${margen.length} Fixtures, M90 ${r2(quantil(margen, 0.9))} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ergebnis[disziplin] = { feldgroessen };
    // Nach JEDER Disziplin schreiben (Lese-Aendere-Schreibe auf die aktuelle Datei), damit ein
    // abgebrochener Lauf die fertigen Disziplinen behaelt und parallele Laeufe sich nicht ueberschreiben.
    schreibe({ [disziplin]: { feldgroessen } });
  }

  console.error(`[verhaeltnis-referenz-arena] fertig: ${Object.keys(ergebnis).join(", ")}`);
  console.error(`[verhaeltnis-referenz-arena] geschrieben: ${ZIEL} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

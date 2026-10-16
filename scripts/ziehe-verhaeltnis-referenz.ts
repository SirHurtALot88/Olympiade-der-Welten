// ===================================================================================
// PUNKTEVERHAELTNIS-REFERENZ (M90) AUS DEM LIVE-SAVE-ABBILD ZIEHEN — Quelle "pps".
//
// Auftrag: docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md (Konzept:
// docs/design/battle-mode-20-spieltage-liga-mechanik-16-10.md Abschnitt 3.4). Das Punkteverhaeltnis
// eines Duells ist D = max(1, round(10 * min(1, m / M90))) mit m = |Score Heim − Score Gast|. M90 ist
// das 90. Perzentil von m in einer FESTEN Referenz je Disziplin und Feldgroesse — genau das zieht
// dieses Skript, fuer die PPS-Duell-Bruecke (lib/resolve/battle-mode-pps-duell.ts).
//
// MECHANISMUS (dasselbe Muster wie scripts/ziehe-buehne-pps-referenz.ts, nur ohne Browser, weil der
// PPS-Pfad reiner Node-Code ist): echter Kader jedes Teams aus dem Abbild, die besten n nach
// Disziplin-Score fest in den Slot gesetzt, gewertet ueber DIESELBE Funktion, die jeder Spieltag
// nimmt (`buildLegacyMatchdayResolvePreview()` auf `loadLocalLegacyLineupContextFromGameState()`) —
// inklusive Form-Jitter, Spieltags-Mutator, Slot-Rollen und Team-Powers. Je Durchgang laufen ZWEI
// Disziplinen (D1 und D2 desselben Probe-Spieltags), je Feldgroesse 2..6 ueber alle Spieltage der
// Saison (verschiedene Form-/Mutator-Wuerfe). Gepaart wird INNERHALB der Liga, wie im Battle Mode:
// ist der Split im Abbild nicht aktiv (heute bei allen Manager-Saves), wird er ueber
// `buildInitialLeagueAssignment()` nachgebildet — dieselbe Zuordnung, die ein neues Battle-Spiel
// bekommt. Je Spieltag zwei Zufallspaarungen je Liga.
//
// Feldgroesse = `legacyScorePlayerCount` des Slots (fuer Mini-DM der gewuerfelte Rohwert; der
// Kader-/Pod-Wert 1 bleibt `playerCount`) — derselbe Schluessel, mit dem der Resolve die Referenz
// nachschlaegt.
//
// AUFRUF (s. CLAUDE.md "An die Spielstaende kommen"; das Skript SCHREIBT nichts in die SQLite):
//
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-verhaeltnis-referenz.ts \
//     [--save=<saveId>] [--disziplinen=a,b,...] [--spieltage=10]
//
// Schreibt/mergt `data/generated/verhaeltnis-referenz.json` (Quelle "pps"; die Quelle "arena" bleibt
// unangetastet).
// ===================================================================================
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  loadLocalLegacyLineupContextFromGameState,
  resetSharedLineupContextBaseCacheForTests,
} from "@/lib/lineups/legacy-lineup-local-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { buildAiLegacyLineupPreviewWithModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { buildInitialLeagueAssignment, isLeagueSplitActive, type LeagueTier } from "@/lib/season/league-split";
import { MINI_DM_DISCIPLINE_ID } from "@/lib/season/season-discipline-schedule";
import type { Discipline, GameState, SeasonDisciplineScheduleSlot } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = path.join(WURZEL, "data/generated/verhaeltnis-referenz.json");
const FELDGROESSEN = [2, 3, 4, 5, 6] as const;
const PAARUNGEN_JE_SPIELTAG = 2;

const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=", 2);
    return [k!, v ?? "1"] as const;
  }),
);

// `--aufstellung=ki` (Standard): die KI-Aufstellung des Spiels je Team; `--aufstellung=beste-n`: die
// besten n nach Disziplin-Score ohne Modifikatoren (Methode der *-pps-referenz-Skripte). Gemessen
// 16.10.: beste-n unterschaetzt die Raender eines echten Battle-Spieltags (Auto-Run, KI-Aufstellungen)
// etwa um die Haelfte — im Battle-E2E landeten damit 42 % der Siege auf D = 10 statt ~10 %.
const AUFSTELLUNG = (args.get("aufstellung") ?? "ki") as "ki" | "beste-n";

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

function slotFuer(discipline: Discipline, n: number): SeasonDisciplineScheduleSlot {
  const istMiniDm = discipline.id === MINI_DM_DISCIPLINE_ID;
  return {
    disciplineId: discipline.id,
    displayName: discipline.name,
    order: discipline.displayOrder ?? discipline.originalOrder ?? null,
    // Mini-DM: Kader-/Pod-Wert 1, gewertete Feldgroesse n (wie `withMiniDmPlayerCountOverride`).
    playerCount: istMiniDm ? 1 : n,
    category: discipline.category,
    legacyScorePlayerCount: n,
  };
}

function baueDraft(context: LegacyLineupLoadedContext, d1: string, d2: string) {
  const benoetigt = (disciplineId: string, side: "d1" | "d2") =>
    context.disciplineSidePlayerCounts?.[`${disciplineId}::${side}`] ?? context.disciplinePlayerCounts[disciplineId] ?? 0;
  const aktiv = new Map(context.activePlayers.map((eintrag) => [eintrag.playerId, eintrag.id] as const));
  const besteFuer = (disciplineId: string, anzahl: number, belegt: Set<string>) =>
    context.disciplineScores
      .filter((s) => s.disciplineId === disciplineId && aktiv.has(s.playerId) && !belegt.has(s.playerId))
      .sort((a, b) => b.score - a.score)
      .slice(0, anzahl)
      .map((s) => s.playerId);
  const belegt = new Set<string>();
  const d1Spieler = besteFuer(d1, benoetigt(d1, "d1"), belegt);
  d1Spieler.forEach((id) => belegt.add(id));
  const d2Spieler = besteFuer(d2, benoetigt(d2, "d2"), belegt);
  const eintraege = [
    ...d1Spieler.map((playerId, slotIndex) => ({ disciplineId: d1, disciplineSide: "d1" as const, slotIndex, playerId, activePlayerId: aktiv.get(playerId) ?? null })),
    ...d2Spieler.map((playerId, slotIndex) => ({ disciplineId: d2, disciplineSide: "d2" as const, slotIndex, playerId, activePlayerId: aktiv.get(playerId) ?? null })),
  ];
  const leer = { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null };
  return {
    lineupId: `verhaeltnis-referenz-${context.team.id}`,
    saveId: context.saveId,
    seasonId: context.seasonId,
    matchdayId: context.matchdayId,
    teamId: context.team.id,
    status: "locked" as const,
    entries: eintraege,
    modifiers: { d1: { ...leer }, d2: { ...leer } },
    createdAt: "2026-10-16T00:00:00.000Z",
    updatedAt: "2026-10-16T00:00:00.000Z",
  };
}

type Ergebnis = { n: number; fixtures: number; m90: number; median: number; p75: number; p95: number; max: number; remisAnteil: number };

function main() {
  const persistence = createPersistenceService();
  const saves = persistence.listSaves();
  const saveId = args.get("save") ?? "new-game-1787123325719-swnjlk";
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save ${saveId} nicht im Abbild (vorhanden: ${saves.map((s) => s.saveId).join(", ")}).`);
  const basis = save.gameState;
  const seasonId = basis.season.id;
  const spieltage = (basis.season.matchdayIds ?? []).slice(0, Number(args.get("spieltage") ?? 10));
  const disziplinen = (args.get("disziplinen")?.split(",") ?? basis.disciplines.map((d) => d.id))
    .map((id) => basis.disciplines.find((d) => d.id === id))
    .filter((d): d is Discipline => Boolean(d));
  // Disjunkte Paare (D1, D2): Disziplin i mit i + Haelfte, jede Disziplin genau einmal je
  // Feldgroesse und Spieltag. Bei ungerader Anzahl laeuft die letzte gegen die erste als Fueller.
  const haelfte = Math.ceil(disziplinen.length / 2);
  const paare = Array.from({ length: haelfte }, (_, i) => {
    const a = disziplinen[i]!;
    const b = disziplinen[i + haelfte] ?? disziplinen.find((d) => d.id !== a.id) ?? a;
    return [a, b] as const;
  }).filter(([a, b]) => a.id !== b.id);

  const ligaJeTeam: Record<string, LeagueTier> = isLeagueSplitActive(basis)
    ? (basis.seasonState.leagueByTeamId as Record<string, LeagueTier>)
    : buildInitialLeagueAssignment(basis.teams);
  const ligen = (["liga1", "liga2"] as const).map((tier) => basis.teams.filter((t) => ligaJeTeam[t.teamId] === tier).map((t) => t.teamId));

  const margen = new Map<string, number[]>();
  const remis = new Map<string, number>();
  const t0 = Date.now();
  let laeufe = 0;
  for (const n of FELDGROESSEN) {
    for (const [a, b] of paare) {
      for (const [mi, matchdayId] of spieltage.entries()) {
        const gs: GameState = {
          ...basis,
          seasonState: {
            ...basis.seasonState,
            disciplineSchedule: (basis.seasonState.disciplineSchedule ?? []).map((zeile) =>
              zeile.matchdayId === matchdayId ? { ...zeile, discipline1: slotFuer(a, n), discipline2: slotFuer(b, n) } : zeile,
            ),
            lineupDrafts: (basis.seasonState.lineupDrafts ?? []).filter((draft) => draft.matchdayId !== matchdayId),
          },
        };
        // PFLICHT: der geteilte Kontext-Cache schluesselt nicht nach dem Disziplin-Spielplan — ohne
        // Reset kaeme die Score-Map der ZUERST an diesem Spieltag geladenen Disziplinen zurueck (alle
        // anderen Teams haetten Score 0, jedes Duell waere ein Remis). Gefunden an der ersten Ziehung.
        resetSharedLineupContextBaseCacheForTests();
        const contexts = basis.teams
          .map((team) => loadLocalLegacyLineupContextFromGameState(gs, { saveId, seasonId, matchdayId, teamId: team.teamId }))
          .flatMap((r) => (r.ok ? [r.context] : []));
        for (const context of contexts) {
          const besteN = baueDraft(context, a.id, b.id);
          if (AUFSTELLUNG === "ki") {
            // DIE KI-AUFSTELLUNG DES SPIELS (dieselbe Funktion wie der Auto-Run): Schonen/Pushen,
            // Formkarten, Kapitaen, Team-Power — die Ränder eines echten Battle-Spieltags. Der
            // Kontext braucht dafuer KEINEN Entwurf; `existingDraft` wird erst danach gesetzt.
            context.existingDraft = null;
            const { preview, modifiers } = buildAiLegacyLineupPreviewWithModifiers(context);
            context.existingDraft = { ...besteN, entries: preview.entries, modifiers };
          } else {
            context.existingDraft = besteN;
          }
        }
        const preview = buildLegacyMatchdayResolvePreview(contexts);
        laeufe += 1;
        for (const dp of preview.disciplinePreviews) {
          const score = new Map(dp.teamResults.map((tr) => [tr.teamId, tr.score] as const));
          const verschieden = new Set(score.values()).size;
          if (verschieden < 4) {
            throw new Error(`Probe ${dp.disciplineId} n=${n} ${matchdayId}: nur ${verschieden} verschiedene Team-Scores — Aufstellung/Kontext kaputt.`);
          }
          const schluessel = `${dp.disciplineId}::${n}`;
          const liste = margen.get(schluessel) ?? [];
          for (let p = 0; p < PAARUNGEN_JE_SPIELTAG; p += 1) {
            for (const [li, liga] of ligen.entries()) {
              const reihe = gemischt(liga, n * 1_000_003 + mi * 7919 + p * 104_729 + li * 13 + dp.disciplineId.length);
              for (let i = 0; i + 1 < reihe.length; i += 2) {
                const h = score.get(reihe[i]!);
                const g = score.get(reihe[i + 1]!);
                if (h == null || g == null) continue;
                liste.push(Math.abs(h - g));
                if (h === g) remis.set(schluessel, (remis.get(schluessel) ?? 0) + 1);
              }
            }
          }
          margen.set(schluessel, liste);
        }
      }
      console.error(`[verhaeltnis-referenz] n=${n} ${a.id}+${b.id}: ${laeufe} Vorschauen, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }

  const bestehend = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, "utf8")) : {};
  const quellen = { pps: {}, arena: {}, ...(bestehend.quellen ?? {}) } as Record<string, Record<string, unknown>>;
  const pps: Record<string, { feldgroessen: Record<string, Ergebnis> }> = { ...(quellen.pps as object) } as never;
  for (const d of disziplinen) {
    const feldgroessen: Record<string, Ergebnis> = {};
    for (const n of FELDGROESSEN) {
      const schluessel = `${d.id}::${n}`;
      const werte = [...(margen.get(schluessel) ?? [])].sort((x, y) => x - y);
      if (werte.length === 0) continue;
      feldgroessen[String(n)] = {
        n,
        fixtures: werte.length,
        m90: r2(quantil(werte, 0.9)),
        median: r2(quantil(werte, 0.5)),
        p75: r2(quantil(werte, 0.75)),
        p95: r2(quantil(werte, 0.95)),
        max: r2(werte[werte.length - 1]!),
        remisAnteil: r2((remis.get(schluessel) ?? 0) / werte.length),
      };
    }
    pps[d.id] = { feldgroessen };
  }
  const commit = (() => {
    try {
      return execSync("git rev-parse HEAD", { cwd: WURZEL, encoding: "utf8" }).trim();
    } catch {
      return "unbekannt";
    }
  })();
  const ausgabe = {
    hinweis:
      "M90 (90. Perzentil des rohen Duell-Abstands m) je Quelle, Disziplin und Feldgroesse fuer das " +
      "Punkteverhaeltnis D = max(1, round(10*min(1, m/M90))). Gelesen von resolveMargeReferenz() in " +
      "lib/resolve/battle-mode-pps-duell.ts. Quelle 'pps' = |PPS-Score Heim - Gast| ueber " +
      "buildLegacyMatchdayResolvePreview() (scripts/ziehe-verhaeltnis-referenz.ts); Quelle 'arena' = " +
      "|Seitenstand Heim - Gast| des Arena-Duells (scripts/ziehe-verhaeltnis-referenz-arena.ts; Staffel/Time-Trial " +
      "ohne Eintrag, dort gilt D = 5 je Sieg mit Warnung verhaeltnis_referenz_fehlt). Neu ziehen nach jeder Aenderung, die die PPS-Score-Skala " +
      "verschiebt (Eignung/Score-Engine, Form, Mutator, Slot-Rollen, Team-Powers).",
    provenienz: {
      ...(bestehend.provenienz ?? {}),
      pps: {
        gezogenAm: new Date().toISOString(),
        repoCommit: commit,
        quelle: { saveId, saveName: save.name ?? null, seasonId, spieltage: spieltage.length },
        mechanismus:
          `${AUFSTELLUNG === "ki" ? "KI-Aufstellung des Spiels (buildAiLegacyLineupPreviewWithModifiers)" : "beste n je Team nach Disziplin-Score"}, ` +
          "buildLegacyMatchdayResolvePreview(), Paarung innerhalb der Liga " +
          `(${isLeagueSplitActive(basis) ? "Split des Saves" : "buildInitialLeagueAssignment nachgebildet"}), ` +
          `${PAARUNGEN_JE_SPIELTAG} Zufallspaarungen je Liga und Spieltag`,
        vorschauen: laeufe,
      },
    },
    quellen: { ...quellen, pps },
  };
  writeFileSync(ZIEL, `${JSON.stringify(ausgabe, null, 1)}\n`);
  console.error(`[verhaeltnis-referenz] geschrieben: ${ZIEL} (${laeufe} Vorschauen, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

main();

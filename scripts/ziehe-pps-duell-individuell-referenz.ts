// ===================================================================================
// PPS-DUELL-BRUECKE: INDIVIDUELLE-PPS-REFERENZ (iMittel/iKrass) AUS DEM LIVE-SAVE-ABBILD ZIEHEN.
//
// Auftrag: Opus-Befund 18.10. ("Team-Rang-Entkopplung der PPS-Duell-Bruecke", hoechste Prioritaet,
// s. docs/design/pps-duell-bruecke-individuelle-pps-18-10.md). Die individuellen Spieler-PPs der
// ueber die Bruecke (lib/resolve/battle-mode-pps-duell.ts) gewerteten Disziplinen hingen bisher am
// TEAM-RANG (distributeRankPointsToPlayers() mit rankWithinLeagueScope()), nicht an der
// individuellen Eignung relativ zur GANZEN Liga -- exakt das, was fuer die Arena-Disziplinen schon
// durch die Impact-Kurve (ppsAusArenaImpact(), battle-mode-arena-team-points.ts) geloest ist. Dieses
// Skript zieht das Brücken-Analogon zu `scripts/ziehe-basketball-pps-referenz.ts` und
// `scripts/ziehe-verhaeltnis-referenz.ts` (dasselbe Muster, PPS-Score-Kanal statt Arena-Boxscore,
// kein Browser).
//
// WAS GEZOGEN WIRD: `iMittel` (Median) und `iKrass` (99,5.-Perzentil) von
// `PlayerPerformancePreview.finalPlayerScore` -- EXAKT der Kanal, den `distributeRankPointsToPlayers()`
// bisher als `finalPlayerScore` fuer die (kaputte) Team-Rang-Verteilung genutzt hat, jetzt als
// Rohwert fuer `ppsAusDuellWert()` (lib/resolve/battle-mode-pps-duell.ts). JE DISZIPLIN UND
// FELDGROESSE (2..6), UEBER BEIDE LIGEN GEMEINSAM (Chris' Entscheidung 31.08.,
// docs/design/battle-mode-pps-modell-plan.md Abschnitt 7 Punkt 2 -- "gemeinsam ueber beide Ligen",
// kein Liga-Split fuer die Referenz selbst).
//
// MECHANISMUS: identisch zu `ziehe-verhaeltnis-referenz.ts` (echte Kader, echte KI-Aufstellung,
// echte Formkarten/Mutatoren/Team-Powers/Captain/Fatigue -- `buildAiLegacyLineupPreviewWithModifiers()`
// + `buildLegacyMatchdayResolvePreview()`), aber OHNE Fixture-Paarung: die Referenz ist ein
// LIGAWEITER POOL, keine Duell-Differenz -- jeder Spielerwert jedes Teams (beide Ligen) jedes
// Probe-Spieltags fliesst direkt in die Verteilung ein.
//
// UMFANG: standardmaessig alle 20 Disziplinen x Feldgroessen {5,6} (die beiden fuer die Abnahme
// mandatierten Feldgroessen, s. CLAUDE.md -- Feldgroesse 3/4 ist ein separat offener Punkt,
// Task #175, NICHT Teil dieser Ziehung) UEBER `--spieltage` Probe-Spieltage. Je Spieltag laufen
// ZWEI Disziplinen gleichzeitig (D1/D2-Slot), macht `ceil(DISZIPLINEN*FELDGROESSEN/2)` Vorschauen
// je Spieltag.
//
// AUFRUF (s. CLAUDE.md "An die Spielstaende kommen"; das Skript SCHREIBT nichts in die SQLite):
//
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-pps-duell-individuell-referenz.ts \
//     [--save=<saveId>] [--disziplinen=a,b,...] [--feldgroessen=5,6] [--spieltage=6]
// ===================================================================================
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  loadLocalLegacyLineupContextFromGameState,
  resetSharedLineupContextBaseCacheForTests,
} from "@/lib/lineups/legacy-lineup-local-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { buildAiLegacyLineupPreviewWithModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { MINI_DM_DISCIPLINE_ID } from "@/lib/season/season-discipline-schedule";
import type { Discipline, GameState, SeasonDisciplineScheduleSlot } from "@/lib/data/olyDataTypes";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = path.join(WURZEL, "data/generated/pps-duell-bruecke-individuell-referenz.json");

const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=", 2);
    return [k!, v ?? "1"] as const;
  }),
);

const FELDGROESSEN = (args.get("feldgroessen")?.split(",").map(Number) ?? [5, 6]).filter((n) =>
  Number.isFinite(n) && n >= 2 && n <= 6,
);
// ZWEI SAATSTROEME (Opus-Auflage 18.10.): jeder Strom nimmt eine DISJUNKTE Haelfte der
// Probe-Spieltage -- dieselbe Art Unabhaengigkeit wie bei den rho/Pp-Stroemen in
// miss-pps-duell-bruecke-abnahme.ts (dort variiert, was gezogen wird; hier, WELCHE Spieltage
// Form/Mutator/Fatigue fuer diesen Lauf ziehen).
const SAATSTROEME = [0, 1] as const;

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
    playerCount: istMiniDm ? 1 : n,
    category: discipline.category,
    legacyScorePlayerCount: n,
  };
}

type FeldgroessenErgebnis = { n: number; werte: number; iMittel: number; iKrass: number; p75: number; p95: number; max: number };

function main() {
  const persistence = createPersistenceService();
  const saves = persistence.listSaves();
  const saveId = args.get("save") ?? "new-game-1787123325719-swnjlk";
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save ${saveId} nicht im Abbild (vorhanden: ${saves.map((s) => s.saveId).join(", ")}).`);
  const basis = save.gameState;
  const seasonId = basis.season.id;
  const spieltageGesamt = (basis.season.matchdayIds ?? []).slice(0, Number(args.get("spieltage") ?? 6));
  if (spieltageGesamt.length < 2) throw new Error("Zu wenige Spieltage im Save fuer zwei Saatstroeme.");

  const disziplinen = (args.get("disziplinen")?.split(",") ?? basis.disciplines.map((d) => d.id))
    .map((id) => basis.disciplines.find((d) => d.id === id))
    .filter((d): d is Discipline => Boolean(d));

  // Disjunkte Paare (D1, D2) je Feldgroesse: Disziplin i mit i + Haelfte -- jede Disziplin genau
  // einmal je Feldgroesse und Spieltag (dasselbe Muster wie ziehe-verhaeltnis-referenz.ts).
  const haelfte = Math.ceil(disziplinen.length / 2);
  const paare = Array.from({ length: haelfte }, (_, i) => {
    const a = disziplinen[i]!;
    const b = disziplinen[i + haelfte] ?? disziplinen.find((d) => d.id !== a.id) ?? a;
    return [a, b] as const;
  }).filter(([a, b]) => a.id !== b.id);

  // werteJeSchluessel: disziplinId::n -> alle finalPlayerScore-Werte, BEIDE Ligen, je Saatstrom.
  const werteJeSchluesselUndStrom = new Map<string, number[]>();
  const t0 = Date.now();
  let laeufe = 0;

  for (const [si, strom] of SAATSTROEME.entries()) {
    const halbierungsPunkt = Math.ceil(spieltageGesamt.length / SAATSTROEME.length);
    const spieltage = spieltageGesamt.slice(si * halbierungsPunkt, (si + 1) * halbierungsPunkt);
    for (const n of FELDGROESSEN) {
      for (const [a, b] of paare) {
        for (const matchdayId of spieltage) {
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
          // PFLICHT (s. ziehe-verhaeltnis-referenz.ts Kommentar): der geteilte Kontext-Cache
          // schluesselt nicht nach Disziplin-Spielplan -- ohne Reset kaeme die Score-Map des
          // ZUERST geladenen Spieltags zurueck.
          resetSharedLineupContextBaseCacheForTests();
          const contexts = basis.teams
            .map((team) => loadLocalLegacyLineupContextFromGameState(gs, { saveId, seasonId, matchdayId, teamId: team.teamId }))
            .flatMap((r) => (r.ok ? [r.context] : []));
          for (const context of contexts) {
            context.existingDraft = null;
            const { preview, modifiers } = buildAiLegacyLineupPreviewWithModifiers(context);
            context.existingDraft = {
              lineupId: `pps-duell-individuell-referenz-${context.team.id}`,
              saveId, seasonId, matchdayId, teamId: context.team.id,
              status: "locked" as const,
              entries: preview.entries,
              modifiers,
              createdAt: "2026-10-18T00:00:00.000Z",
              updatedAt: "2026-10-18T00:00:00.000Z",
            };
          }
          const preview = buildLegacyMatchdayResolvePreview(contexts);
          laeufe += 1;
          for (const dp of preview.disciplinePreviews) {
            const schluessel = `${dp.disciplineId}::${n}::${strom}`;
            const liste = werteJeSchluesselUndStrom.get(schluessel) ?? [];
            for (const tr of dp.teamResults) {
              for (const entry of tr.entries) {
                if (entry.finalPlayerScore != null && Number.isFinite(entry.finalPlayerScore)) {
                  liste.push(entry.finalPlayerScore);
                }
              }
            }
            werteJeSchluesselUndStrom.set(schluessel, liste);
          }
        }
        console.error(`[pps-duell-individuell-referenz] strom=${strom} n=${n} ${a.id}+${b.id}: ${laeufe} Vorschauen, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
    }
  }

  const disziplinenAusgabe: Record<string, { feldgroessen: Record<string, { stroeme: Record<string, FeldgroessenErgebnis> }> }> = {};
  for (const d of disziplinen) {
    const feldgroessen: Record<string, { stroeme: Record<string, FeldgroessenErgebnis> }> = {};
    for (const n of FELDGROESSEN) {
      const stroeme: Record<string, FeldgroessenErgebnis> = {};
      for (const strom of SAATSTROEME) {
        const schluessel = `${d.id}::${n}::${strom}`;
        const werte = [...(werteJeSchluesselUndStrom.get(schluessel) ?? [])].sort((x, y) => x - y);
        if (werte.length === 0) continue;
        stroeme[String(strom)] = {
          n,
          werte: werte.length,
          iMittel: r2(quantil(werte, 0.5)),
          iKrass: r2(quantil(werte, 0.995)),
          p75: r2(quantil(werte, 0.75)),
          p95: r2(quantil(werte, 0.95)),
          max: r2(werte[werte.length - 1]!),
        };
      }
      if (Object.keys(stroeme).length > 0) feldgroessen[String(n)] = { stroeme };
    }
    if (Object.keys(feldgroessen).length > 0) disziplinenAusgabe[d.id] = { feldgroessen };
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
      "iMittel (Median) und iKrass (99,5.-Perzentil) von PlayerPerformancePreview.finalPlayerScore " +
      "(derselbe Kanal, den distributeRankPointsToPlayers() bisher team-rang-gebunden verteilt hat), " +
      "JE DISZIPLIN UND FELDGROESSE, UEBER BEIDE LIGEN GEMEINSAM (kein Liga-Split, Chris' Entscheidung " +
      "31.08., docs/design/battle-mode-pps-modell-plan.md Abschnitt 7 Punkt 2), ZWEI UNABHAENGIGE " +
      "SAATSTROEME (disjunkte Spieltags-Haelften). Gelesen von resolveDuellIndividualPpsReferenz() in " +
      "lib/resolve/battle-mode-pps-duell.ts fuer ppsAusDuellWert() -- das Bruecken-Analogon zu " +
      "ppsAusArenaImpact()/resolveArenaPpsReferenz() (battle-mode-arena-team-points.ts). Gezogen ueber " +
      "buildAiLegacyLineupPreviewWithModifiers() + buildLegacyMatchdayResolvePreview() (echte KI-" +
      "Aufstellung, Formkarten, Mutatoren, Team-Powers, Kapitaen, Fatigue/Verletzung) -- KEIN Browser, " +
      "der PPS-Pfad ist reiner Node-Code. NUR Feldgroessen {5,6} (CLAUDE.md-Abnahmegroessen); " +
      "Feldgroesse 2..4 bleibt bewusst aussen vor (Task #175, separat offen) -- ANDERS als " +
      "resolveArenaPpsReferenz() OHNE Nearest-Match-Rueckfall: resolveDuellIndividualPpsReferenz() " +
      "liefert fuer 2..4 bewusst `null` statt in ungemessenes Gebiet zu extrapolieren; der Aufrufer " +
      "faellt dann auf den alten, team-rang-gebundenen Pfad zurueck. Neu ziehen nach jeder " +
      "Aenderung, die die PPS-Score-Skala verschiebt (Eignung/Score-Engine, Form, Mutator, " +
      "Slot-Rollen, Team-Powers).",
    gezogenAm: new Date().toISOString(),
    repoCommit: commit,
    quelle: { saveId, saveName: save.name ?? null, seasonId },
    feldgroessen: FELDGROESSEN,
    saatStroeme: SAATSTROEME,
    spieltageJeStrom: Math.ceil(spieltageGesamt.length / SAATSTROEME.length),
    vorschauenGesamt: laeufe,
    dauerS: Number(((Date.now() - t0) / 1000).toFixed(0)),
    disziplinen: disziplinenAusgabe,
  };
  writeFileSync(ZIEL, `${JSON.stringify(ausgabe, null, 1)}\n`);
  console.error(`[pps-duell-individuell-referenz] geschrieben: ${ZIEL} (${laeufe} Vorschauen, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

main();

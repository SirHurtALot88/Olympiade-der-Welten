// ===================================================================================
// LIGA-ABNAHME TAKESHI'S CASTLE + STAFFEL ALS GEBUCHTES VIER-TEAM-RENNEN (02.11.,
// docs/design/bahn-pod-vier-teams-01-11.md Abschnitt 6) -- das Gegenstueck zu
// scripts/miss-battlefield-pod-abnahme.ts, aber mit dem ECHTEN Motor statt des PPS-Pods.
//
// PRODUKTIONSPFAD, NICHT DIE KADERFESTE SONDE: frischer Battle-Save mit Liga-Split
// (tests/helpers/build-battle-mode-league-split-save.ts), je Spieltag D1 = Staffel (k), D2 =
// Takeshi's Castle (k) -- zwei Bahn-Pods am selben Tag, je Disziplin frisch gelost --, echte
// KI-Aufstellung je Team, echtes Headless-Chromium ueber `runBahnPodMatchday()` (dieselbe Funktion,
// die der Arena-Vorlauf ruft), danach die echte Resolve-Engine mit den Rennrohdaten
// (`buildLegacyMatchdayResolvePreview(..., { bahnPodRohdatenByDisciplineId, ... })`). Gruppiert wird
// nach den GEBUCHTEN Pods (`miniDmPod.podId`).
//
// KENNZAHLEN je Pod (= ein Spiel im 4-Team-Format, 4k Spieler):
//  - quellen: wie viele Zeilen mit `quelle: "bahn"` gebucht wurden (Soll: alle).
//  - rhoPod: Spearman Spieler-Eignung (`baseValue`) gegen vergebene Spieler-PP (`pointsAwarded`,
//    aus dem Rennen) ueber alle 4k Spieler -- dieselbe Zahl wie bei der Battlefield-Liga-Abnahme.
//  - Star (eindeutig Eignungsbester) auf PP-Rang 1 / unter den ersten zwei; Paartreue ab 15.
//  - Team: eignungsstaerkstes Team auf Platz 1; Spearman Team-Eignung gegen Pod-Platz.
//  - LIGA-BALANCE: Liga-Punkte je Pod (Soll 3), Verteilung der Plaetze, und wie oft der gebuchte
//    Sieger NICHT der PPS-Pod-Sieger ist (zeigt, dass das Rennen bucht, nicht der Eignungs-Score).
//
// AUFRUF (eigene Scratch-SQLite, nie der echte Spielstand):
//   OLY_APP_SQLITE_PATH=<scratch>/bahn-pod-liga.sqlite npx tsx scripts/miss-bahn-pod-liga-abnahme.ts \
//     [--spieltage=2] [--feldgroessen=2,3,4,5,6] [--ausgabe=data/generated/bahn-pod-liga-abnahme.json]
// ===================================================================================
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadLocalLegacyLineupContextFromGameState,
  resetSharedLineupContextBaseCacheForTests,
} from "@/lib/lineups/legacy-lineup-local-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { buildAiLegacyLineupPreviewWithModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { runBahnPodMatchday } from "@/lib/resolve/bahn-pod-matchday";
import type { BahnPodRohdaten } from "@/lib/resolve/bahn-pod-resolve";
import { resolveMutatorTraitsFromSchedule } from "@/lib/resolve/battle-mode-arena-team-points";
import { buildBattleModeLeagueSplitSave } from "@/tests/helpers/build-battle-mode-league-split-save";
import type { Discipline, GameState, LineupDraft, SeasonDisciplineScheduleSlot } from "@/lib/data/olyDataTypes";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=", 2);
    return [k!, v ?? "1"] as const;
  }),
);
const SPIELTAGE_JE_STROM = Number(args.get("spieltage") ?? 2);
const FELDGROESSEN = (args.get("feldgroessen")?.split(",").map(Number) ?? [2, 3, 4, 5, 6]).filter((n) => Number.isInteger(n) && n >= 2);
const AUSGABE = path.resolve(WURZEL, args.get("ausgabe") ?? "data/generated/bahn-pod-liga-abnahme.json");
const STROEME = [0, 1] as const;
const ZIEL = ["staffel", "takeshis-castle"] as const;

function rang(werte: readonly number[]): number[] {
  const idx = werte.map((wert, index) => ({ wert, index })).sort((a, b) => a.wert - b.wert);
  const r = new Array<number>(werte.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1]!.wert === idx[i]!.wert) j += 1;
    for (let k = i; k <= j; k += 1) r[idx[k]!.index] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function spearman(a: readonly number[], b: readonly number[]): number | null {
  if (a.length !== b.length || a.length < 3) return null;
  const ra = rang(a), rb = rang(b), n = a.length;
  const ma = ra.reduce((s, v) => s + v, 0) / n, mb = rb.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (ra[i]! - ma) * (rb[i]! - mb);
    da += (ra[i]! - ma) ** 2;
    db += (rb[i]! - mb) ** 2;
  }
  return da === 0 || db === 0 ? null : num / Math.sqrt(da * db);
}
const mean = (w: readonly number[]) => (w.length ? w.reduce((s, v) => s + v, 0) / w.length : null);
const median = (w: readonly number[]) => {
  if (!w.length) return null;
  const s = [...w].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const r3 = (x: number | null) => (x == null ? null : Math.round(x * 1000) / 1000);

function slotFuer(discipline: Discipline, n: number): SeasonDisciplineScheduleSlot {
  return {
    disciplineId: discipline.id,
    displayName: discipline.name,
    order: discipline.displayOrder ?? discipline.originalOrder ?? null,
    playerCount: n,
    category: discipline.category,
    legacyScorePlayerCount: n,
    occurrenceInSeason: 1,
  };
}

type Akku = {
  pods: number; zeilen: number; zeilenBahn: number; punkteSummeFalsch: number;
  rhoPod: number[]; star: { n: number; rang1: number; top2: number }; paar15: { n: number; korrekt: number };
  teamStarPlatz1: { n: number; ja: number }; teamRho: number[];
  siegerAnders: number; plaetzeAnders: number;
};
const neuerAkku = (): Akku => ({
  pods: 0, zeilen: 0, zeilenBahn: 0, punkteSummeFalsch: 0, rhoPod: [], star: { n: 0, rang1: 0, top2: 0 },
  paar15: { n: 0, korrekt: 0 }, teamStarPlatz1: { n: 0, ja: 0 }, teamRho: [], siegerAnders: 0, plaetzeAnders: 0,
});

async function main() {
  const gebaut = await buildBattleModeLeagueSplitSave({ logPrefix: "[bahn-pod-liga]" });
  const basis = gebaut.gameState;
  const saveId = gebaut.saveId;
  const seasonId = basis.season.id;
  console.error(`[bahn-pod-liga] Save ${saveId} (sqlite ${gebaut.sqlitePath})`);
  const pool = basis.season.matchdayIds;
  const fenster = new Map(STROEME.map((s) => [s, pool.slice(s * SPIELTAGE_JE_STROM, (s + 1) * SPIELTAGE_JE_STROM)] as const));
  const disz = ZIEL.map((id) => basis.disciplines.find((d) => d.id === id)!);
  const akkus = new Map<string, Akku>();
  let rennMs = 0, rennLaeufe = 0;

  for (const strom of STROEME) {
    for (const n of FELDGROESSEN) {
      for (const matchdayId of fenster.get(strom)!) {
        const t0 = Date.now();
        const gs: GameState = {
          ...basis,
          scenarioMeta: { ...basis.scenarioMeta, gameMode: "battle" } as GameState["scenarioMeta"],
          matchdayState: { ...basis.matchdayState, matchdayId } as GameState["matchdayState"],
          seasonState: {
            ...basis.seasonState,
            disciplineSchedule: (basis.seasonState.disciplineSchedule ?? []).map((z) =>
              z.matchdayId === matchdayId ? { ...z, discipline1: slotFuer(disz[0]!, n), discipline2: slotFuer(disz[1]!, n) } : z,
            ),
            lineupDrafts: (basis.seasonState.lineupDrafts ?? []).filter((d) => d.matchdayId !== matchdayId),
          },
        };
        resetSharedLineupContextBaseCacheForTests();
        const contexts = basis.teams
          .map((team) => loadLocalLegacyLineupContextFromGameState(gs, { saveId, seasonId, matchdayId, teamId: team.teamId }))
          .flatMap((r) => (r.ok ? [r.context] : []));
        const drafts: LineupDraft[] = [];
        for (const context of contexts) {
          context.existingDraft = null;
          const { preview, modifiers } = buildAiLegacyLineupPreviewWithModifiers(context);
          const draft = {
            lineupId: `bahn-pod-liga-${context.team.id}`, saveId, seasonId, matchdayId, teamId: context.team.id,
            status: "locked" as const, entries: preview.entries, modifiers,
            createdAt: "2026-11-02T00:00:00.000Z", updatedAt: "2026-11-02T00:00:00.000Z",
          };
          context.existingDraft = draft;
          drafts.push(draft as unknown as LineupDraft);
        }
        // Der Runner liest die Aufstellung aus dem Spielstand (buildArenaAufstellung) -- dieselben Entwuerfe.
        gs.seasonState = { ...gs.seasonState, lineupDrafts: [...(gs.seasonState.lineupDrafts ?? []), ...drafts] };

        const rohdaten = new Map<string, Map<string, BahnPodRohdaten>>();
        const pp = new Map<string, Map<string, number>>();
        for (const disciplineId of ZIEL) {
          const tr = Date.now();
          const r = await runBahnPodMatchday({
            gameState: gs, saveId, seasonId, matchdayId, disciplineId,
            mutatorTraits: resolveMutatorTraitsFromSchedule({ gameState: gs, saveId, seasonId, matchdayId, disciplineId }),
          });
          rennMs += Date.now() - tr; rennLaeufe += 1;
          if (!r) throw new Error(`kein Bahn-Pod fuer ${disciplineId} an ${matchdayId}`);
          if (r.warnings.length) console.error(`[bahn-pod-liga] ${disciplineId} ${matchdayId}: ${r.warnings.join(", ")}`);
          rohdaten.set(disciplineId, r.rohdatenByPodId);
          pp.set(disciplineId, r.playerPpsByPlayerId);
        }
        const preview = buildLegacyMatchdayResolvePreview(contexts, {
          bahnPodRohdatenByDisciplineId: rohdaten,
          arenaIndividualBoxscorePpsByDisciplineId: pp,
        });
        // Gegenprobe: derselbe Spieltag als PPS-Pod (ohne Rennen).
        const ppsPreview = buildLegacyMatchdayResolvePreview(contexts);

        for (const dp of preview.disciplinePreviews) {
          if (!(ZIEL as readonly string[]).includes(dp.disciplineId)) continue;
          const key = `${dp.disciplineId}::${strom}::${n}`;
          const akku = akkus.get(key) ?? neuerAkku();
          const ppsPlatz = new Map(
            (ppsPreview.disciplinePreviews.find((x) => x.disciplineId === dp.disciplineId)?.teamResults ?? []).map((t) => [t.teamId, t.miniDmPod?.platz ?? null] as const),
          );
          const byPod = new Map<string, typeof dp.teamResults>();
          for (const tr of dp.teamResults) {
            akku.zeilen += 1;
            if (tr.miniDmPod?.quelle === "bahn") akku.zeilenBahn += 1;
            const podId = tr.miniDmPod?.podId;
            if (podId) byPod.set(podId, [...(byPod.get(podId) ?? []), tr]);
          }
          for (const teams of byPod.values()) {
            if (teams.length !== 4) continue;
            akku.pods += 1;
            if (teams.reduce((s, t) => s + (t.teamPoints ?? 0), 0) !== 3) akku.punkteSummeFalsch += 1;
            const sieger = teams.find((t) => t.miniDmPod!.platz === 1)!;
            if (ppsPlatz.get(sieger.teamId) !== 1) akku.siegerAnders += 1;
            if (teams.some((t) => ppsPlatz.get(t.teamId) !== t.miniDmPod!.platz)) akku.plaetzeAnders += 1;
            const jeTeam = teams.map((t) => ({
              platz: t.miniDmPod!.platz,
              spieler: t.entries.filter((e) => e.baseValue != null && e.pointsAwarded != null).map((e) => ({ eig: e.baseValue!, pp: e.pointsAwarded! })),
            }));
            const alle = jeTeam.flatMap((t) => t.spieler);
            const rp = spearman(alle.map((s) => s.eig), alle.map((s) => s.pp));
            if (rp != null) akku.rhoPod.push(rp);
            const maxEig = Math.max(...alle.map((s) => s.eig));
            const stars = alle.filter((s) => s.eig === maxEig);
            if (stars.length === 1) {
              const ppRang = 1 + alle.filter((s) => s.pp > stars[0]!.pp).length;
              akku.star.n += 1;
              if (ppRang === 1) akku.star.rang1 += 1;
              if (ppRang <= 2) akku.star.top2 += 1;
            }
            for (let i = 0; i < alle.length; i += 1) {
              for (let j = i + 1; j < alle.length; j += 1) {
                if (Math.abs(alle[i]!.eig - alle[j]!.eig) < 15 || alle[i]!.pp === alle[j]!.pp) continue;
                akku.paar15.n += 1;
                if ((alle[i]!.eig > alle[j]!.eig) === (alle[i]!.pp > alle[j]!.pp)) akku.paar15.korrekt += 1;
              }
            }
            const teamEig = jeTeam.map((t) => t.spieler.reduce((s, x) => s + x.eig, 0));
            const maxTeam = Math.max(...teamEig);
            if (teamEig.filter((e) => e === maxTeam).length === 1) {
              akku.teamStarPlatz1.n += 1;
              if (jeTeam[teamEig.indexOf(maxTeam)]!.platz === 1) akku.teamStarPlatz1.ja += 1;
            }
            const tr = spearman(teamEig, jeTeam.map((t) => -t.platz));
            if (tr != null) akku.teamRho.push(tr);
          }
          akkus.set(key, akku);
        }
        console.error(`[bahn-pod-liga] strom ${strom} k=${n} ${matchdayId} fertig (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      }
    }
  }

  const ergebnis: Record<string, unknown> = {};
  for (const id of ZIEL) {
    ergebnis[id] = STROEME.map((strom) => ({
      strom,
      jeFeldgroesse: Object.fromEntries(
        FELDGROESSEN.map((n) => {
          const a = akkus.get(`${id}::${strom}::${n}`) ?? neuerAkku();
          return [n, {
            pods: a.pods,
            zeilenMitRennen: `${a.zeilenBahn}/${a.zeilen}`,
            podsMitFalscherPunktesumme: a.punkteSummeFalsch,
            rhoPodMittel: r3(mean(a.rhoPod)), rhoPodMedian: r3(median(a.rhoPod)),
            starRang1Pct: r3(a.star.n ? a.star.rang1 / a.star.n : null), starTop2Pct: r3(a.star.n ? a.star.top2 / a.star.n : null),
            paartreueAb15Pct: r3(a.paar15.n ? a.paar15.korrekt / a.paar15.n : null),
            teamStaerkstesAufPlatz1Pct: r3(a.teamStarPlatz1.n ? a.teamStarPlatz1.ja / a.teamStarPlatz1.n : null),
            teamRhoEignungGegenPlatzMittel: r3(mean(a.teamRho)),
            siegerAndersAlsPpsPodPct: r3(a.pods ? a.siegerAnders / a.pods : null),
            plaetzeAndersAlsPpsPodPct: r3(a.pods ? a.plaetzeAnders / a.pods : null),
          }];
        }),
      ),
    }));
  }
  const ausgabe = {
    datum: new Date().toISOString(), saveId, spieltageJeStrom: SPIELTAGE_JE_STROM, feldgroessen: FELDGROESSEN,
    rennLaufzeitMsJeDisziplinUndSpieltag: rennLaeufe ? Math.round(rennMs / rennLaeufe) : null,
    ergebnis,
  };
  writeFileSync(AUSGABE, `${JSON.stringify(ausgabe, null, 2)}\n`);
  console.log(JSON.stringify(ausgabe, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// ===================================================================================
// ABNAHME BATTLEFIELD ALS 4-TEAM-PPS-POD (01.11.) -- Pflichtmessung nach CLAUDE.md ("Die Abnahme
// jeder Disziplin"): von 2 auf 4 Teams ist eine Mechanikaenderung.
//
// WAS GEMESSEN WIRD. Derselbe Produktionspfad wie im Spiel: frischer Battle-Save mit Liga-Split
// (tests/helpers/build-battle-mode-league-split-save.ts, wie miss-pps-duell-bruecke-abnahme.ts
// --synth-liga-split), echte KI-Aufstellung je Team, echter Resolve
// (buildLegacyMatchdayResolvePreview). D1 = Battlefield (k Spieler), D2 = Mini-DM -- damit laeuft
// zugleich der von Chris erlaubte Fall "zwei Pod-Disziplinen am selben Spieltag" mit. Gruppiert
// wird nach den ECHTEN, gebuchten Pods (`miniDmPod.podId`), nicht nach einer Zufallspaarung.
//
// KENNZAHLEN je Pod (= "ein Spiel" im 4-Team-Format, 4k Spieler):
//  - rhoPod: Spearman zwischen Spieler-Eignung (`baseValue`, matrixgewichtete p.d) und vergebener
//    Spieler-PP (`pointsAwarded`) ueber ALLE 4k Spieler des Pods -- das 4-Team-Analogon zu
//    "fixtureRho" (2k Spieler) der Bruecken-Abnahme und zu Mini-DMs "rhoJeEvent". DIE Abnahmezahl.
//  - rhoSeite: Spearman je Team-Seite (k Spieler), wie "spielerRhoMedian" der Bruecken-Abnahme.
//  - rhoZweier: Vergleich -- dieselben Pods in zwei Zweiergruppen zerlegt (2k Spieler), also die
//    Zahl, die das alte Duell-Format auf denselben Daten gehabt haette.
//  - Star: eindeutig eignungsbester Spieler des Pods auf PP-Rang 1 / unter den ersten zwei.
//  - Paartreue ab 15 Eignungspunkten Abstand (alle Paare im Pod).
//  - Team-Ebene: eignungsstaerkstes Team (Summe baseValue) auf Pod-Platz 1; Spearman Team-Eignung
//    gegen Pod-Platz.
//
// AUFRUF:
//   OLY_APP_SQLITE_PATH=<scratch>/bf-pod.sqlite npx tsx scripts/miss-battlefield-pod-abnahme.ts \
//     [--spieltage=4] [--feldgroessen=3,4,5,6] [--ausgabe=data/generated/battlefield-pod-abnahme.json]
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
import { buildBattleModeLeagueSplitSave } from "@/tests/helpers/build-battle-mode-league-split-save";
import { MINI_DM_DISCIPLINE_ID } from "@/lib/season/season-discipline-schedule";
import type { Discipline, GameState, SeasonDisciplineScheduleSlot } from "@/lib/data/olyDataTypes";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=", 2);
    return [k!, v ?? "1"] as const;
  }),
);
const SPIELTAGE_JE_STROM = Number(args.get("spieltage") ?? 4);
const FELDGROESSEN = (args.get("feldgroessen")?.split(",").map(Number) ?? [3, 4, 5, 6]).filter((n) => Number.isInteger(n) && n >= 2);
const AUSGABE = path.resolve(WURZEL, args.get("ausgabe") ?? "data/generated/battlefield-pod-abnahme.json");
const STROEME = [0, 1] as const; // zwei DISJUNKTE Spieltagsfenster, wie die Bruecken-Abnahme
const ZIEL_DISZIPLINEN = ["battlefield", MINI_DM_DISCIPLINE_ID] as const;

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
    playerCount: discipline.id === MINI_DM_DISCIPLINE_ID ? 1 : n,
    category: discipline.category,
    legacyScorePlayerCount: n,
    occurrenceInSeason: 1,
  };
}

type Spieler = { eig: number; pp: number };
type Akku = {
  rhoPod: number[]; rhoSeite: number[]; rhoZweier: number[];
  star: { n: number; rang1: number; top2: number };
  paar15: { n: number; korrekt: number };
  teamStarPlatz1: { n: number; ja: number };
  teamRho: number[];
  pods: number; quellen: Record<string, number>;
};
const neuerAkku = (): Akku => ({ rhoPod: [], rhoSeite: [], rhoZweier: [], star: { n: 0, rang1: 0, top2: 0 }, paar15: { n: 0, korrekt: 0 }, teamStarPlatz1: { n: 0, ja: 0 }, teamRho: [], pods: 0, quellen: {} });

async function main() {
  const gebaut = await buildBattleModeLeagueSplitSave({ logPrefix: "[bf-pod-abnahme]" });
  const basis = gebaut.gameState;
  const saveId = gebaut.saveId;
  const seasonId = basis.season.id;
  console.error(`[bf-pod-abnahme] Save ${saveId} (sqlite ${gebaut.sqlitePath})`);
  const pool = basis.season.matchdayIds;
  const fenster = new Map(STROEME.map((s) => [s, pool.slice(s * SPIELTAGE_JE_STROM, (s + 1) * SPIELTAGE_JE_STROM)] as const));
  const disz = ZIEL_DISZIPLINEN.map((id) => basis.disciplines.find((d) => d.id === id)!);
  const akkus = new Map<string, Akku>();

  for (const strom of STROEME) {
    for (const n of FELDGROESSEN) {
      for (const matchdayId of fenster.get(strom)!) {
        const t0 = Date.now();
        const gs: GameState = {
          ...basis,
          scenarioMeta: { ...basis.scenarioMeta, gameMode: "battle" } as GameState["scenarioMeta"],
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
        for (const context of contexts) {
          context.existingDraft = null;
          const { preview, modifiers } = buildAiLegacyLineupPreviewWithModifiers(context);
          context.existingDraft = {
            lineupId: `bf-pod-abnahme-${context.team.id}`, saveId, seasonId, matchdayId, teamId: context.team.id,
            status: "locked" as const, entries: preview.entries, modifiers,
            createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z",
          };
        }
        const preview = buildLegacyMatchdayResolvePreview(contexts);
        for (const dp of preview.disciplinePreviews) {
          if (!(ZIEL_DISZIPLINEN as readonly string[]).includes(dp.disciplineId)) continue;
          const key = `${dp.disciplineId}::${strom}::${n}`;
          const akku = akkus.get(key) ?? neuerAkku();
          const byPod = new Map<string, typeof dp.teamResults>();
          for (const tr of dp.teamResults) {
            akku.quellen[tr.resolutionSource ?? "?"] = (akku.quellen[tr.resolutionSource ?? "?"] ?? 0) + 1;
            const spieler = tr.entries.filter((e) => e.baseValue != null && e.pointsAwarded != null);
            const rs = spearman(spieler.map((e) => e.baseValue!), spieler.map((e) => e.pointsAwarded!));
            if (rs != null) akku.rhoSeite.push(rs);
            const podId = tr.miniDmPod?.podId;
            if (!podId) continue;
            byPod.set(podId, [...(byPod.get(podId) ?? []), tr]);
          }
          for (const teams of byPod.values()) {
            if (teams.length !== 4) continue;
            akku.pods += 1;
            const jeTeam = teams.map((tr) => ({
              platz: tr.miniDmPod!.platz,
              spieler: tr.entries.filter((e) => e.baseValue != null && e.pointsAwarded != null).map((e) => ({ eig: e.baseValue!, pp: e.pointsAwarded! }) as Spieler),
            }));
            const alle = jeTeam.flatMap((t) => t.spieler);
            const rp = spearman(alle.map((s) => s.eig), alle.map((s) => s.pp));
            if (rp != null) akku.rhoPod.push(rp);
            // Vergleich: zwei Zweiergruppen aus demselben Pod (Teams 0+1, 2+3 in Pod-Reihenfolge).
            for (const [a, b] of [[0, 1], [2, 3]] as const) {
              const zw = [...jeTeam[a]!.spieler, ...jeTeam[b]!.spieler];
              const rz = spearman(zw.map((s) => s.eig), zw.map((s) => s.pp));
              if (rz != null) akku.rhoZweier.push(rz);
            }
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
        console.error(`[bf-pod-abnahme] strom ${strom} k=${n} ${matchdayId} fertig (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      }
    }
  }

  const ergebnis: Record<string, unknown> = {};
  for (const id of ZIEL_DISZIPLINEN) {
    ergebnis[id] = STROEME.map((strom) => ({
      strom,
      jeFeldgroesse: Object.fromEntries(
        FELDGROESSEN.map((n) => {
          const a = akkus.get(`${id}::${strom}::${n}`) ?? neuerAkku();
          return [n, {
            pods: a.pods,
            quellen: a.quellen,
            rhoPodMittel: r3(mean(a.rhoPod)), rhoPodMedian: r3(median(a.rhoPod)),
            rhoPodAnteilAb08: r3(a.rhoPod.length ? a.rhoPod.filter((r) => r >= 0.8).length / a.rhoPod.length : null),
            rhoZweierMittel: r3(mean(a.rhoZweier)),
            rhoSeiteMedian: r3(median(a.rhoSeite)),
            starRang1Pct: r3(a.star.n ? a.star.rang1 / a.star.n : null), starTop2Pct: r3(a.star.n ? a.star.top2 / a.star.n : null), starN: a.star.n,
            paartreueAb15Pct: r3(a.paar15.n ? a.paar15.korrekt / a.paar15.n : null), paartreueAb15N: a.paar15.n,
            teamStaerkstesAufPlatz1Pct: r3(a.teamStarPlatz1.n ? a.teamStarPlatz1.ja / a.teamStarPlatz1.n : null),
            teamRhoEignungGegenPlatzMittel: r3(mean(a.teamRho)),
          }];
        }),
      ),
    }));
  }
  const ausgabe = { datum: new Date().toISOString(), saveId, spieltageJeStrom: SPIELTAGE_JE_STROM, feldgroessen: FELDGROESSEN, ergebnis };
  writeFileSync(AUSGABE, `${JSON.stringify(ausgabe, null, 2)}\n`);
  console.log(JSON.stringify(ausgabe, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

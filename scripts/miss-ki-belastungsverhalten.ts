/* eslint-disable no-console */
/**
 * KI-BELASTUNGSVERHALTEN — wie schont, rotiert, trainiert und baut die KI, und was kostet sie das an
 * Verletzungen? Reine Messung, schreibt nichts (Chris 21.11.: „KI kann ja auch mehr spieler picken
 * oder schonen statt aggressiv oder normal im einsatz zu nutzen, das könntest du auch mal tracken").
 *
 * Quellen im Spielstand (nur lesen):
 *   seasonState.lineupDrafts      Aufstellung + Intensität je Disziplin-Seite (conserve/normal/push)
 *   seasonState.injuryEvents      je Einsatz: Fatigue am Wurf, Risiko %, Ergebnis (injured/healthy)
 *   seasonState.playerAvailabilityState  aktuelle Fatigue/Verletzung
 *   seasonState.teamFacilities    Gebäude (Recovery Center)
 *   players[].trainingMode        Training leicht/mittel/hart (nur der JETZIGE Stand, kein Verlauf)
 *
 * Teil B rechnet die Fatigue-Konten aus den aufgezeichneten Einsätzen nach (Last 16 x Trait x
 * Intensität, aktive Erholung, Bank-Erholung nach Gebäude/Trainingsmodus) und spielt Szenarien
 * mit GLEICHEN Einsatzmengen durch (Schonschwelle, Reha-Stufe, Rotation, Training). Erwartete
 * Verletzungen = Summe der Risiko-Prozent aller Einsätze; Folgetage einer Verletzung und
 * Verhaltensanpassungen der Gegner sind nicht modelliert (konservative Untergrenze der Wirkung).
 *
 * Nutzung (auf einer KOPIE des Live-Abbilds, nie auf der Server-Datenbank):
 *   OLY_APP_SQLITE_PATH=/pfad/kopie.sqlite npx tsx scripts/miss-ki-belastungsverhalten.ts [saveId]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  BASE_MATCHDAY_RECOVERY,
  INTENSITY_FATIGUE_MULT,
  MATCHDAY_ACTIVE_RECOVERY,
  MATCHDAY_FATIGUE_LOAD,
  isFatigueActiveRecoveryEnabled,
} from "@/lib/fatigue/fatigue-injury-service";
import { getInjuryRiskPercent } from "@/lib/fatigue/fatigue-calibration";
import { TRAINING_RECOVERY_IMPACT } from "@/lib/training/training-recovery-impact";
import { getFacilityLevel, getTeamFacilityState, RECOVERY_FLAT_BONUS_BY_LEVEL } from "@/lib/facilities/facility-effects";
import { getPlayerFatigueLoadMultiplier } from "@/lib/traits/cosmetic-trait-soft-effects";

type Stage = "conserve" | "normal" | "push";
type Mode = "leicht" | "mittel" | "hart";
const RANK: Record<Stage, number> = { conserve: 0, normal: 1, push: 2 };

const SAVE_ID = process.argv[2] ?? "new-game-1795114260527-nzr0z9";
const p = createPersistenceService();
const gs = p.getSaveById(SAVE_ID)?.gameState as GameState | undefined;
if (!gs) {
  console.error(`Spielstand ${SAVE_ID} nicht gefunden`);
  process.exit(1);
}
const ss = gs.seasonState;
const seasonId = gs.season.id;
const mdIds = gs.season.matchdayIds;
const doneMd = mdIds.filter((id) => (ss.injuryEvents ?? []).some((e) => e.seasonId === seasonId && e.matchdayId === id));
const playersById = new Map(gs.players.map((pl) => [pl.id, pl] as const));
const teamIds = gs.teams.map((t) => t.teamId);
const isHuman = (teamId: string) => (ss.teamControlSettings?.[teamId]?.controlMode ?? "ai") !== "ai";
const humanTeams = teamIds.filter(isHuman);
const aiTeams = teamIds.filter((t) => !isHuman(t));
const rosterOf = new Map<string, string[]>();
for (const r of gs.rosters) {
  if (!rosterOf.has(r.teamId)) rosterOf.set(r.teamId, []);
  rosterOf.get(r.teamId)!.push(r.playerId);
}

const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)} %` : "-");
const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);
const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
};
function table(head: string[], rows: Array<Array<string | number>>) {
  console.log(`| ${head.join(" | ")} |`);
  console.log(`|${head.map(() => "---").join("|")}|`);
  for (const r of rows) console.log(`| ${r.join(" | ")} |`);
  console.log("");
}

// ---------------------------------------------------------------- Einsätze aus Entwürfen + Würfen
type Use = {
  teamId: string;
  playerId: string;
  md: number; // 1-basiert
  intensity: Stage;
  sides: Set<string>;
  fatigueAtRoll: number;
  risk: number;
  injured: boolean;
  unavailableFor: number;
};
const mdIndex = new Map(mdIds.map((id, i) => [id, i + 1] as const));
const eventByKey = new Map<string, NonNullable<typeof ss.injuryEvents>[number]>();
for (const e of ss.injuryEvents ?? []) {
  if (e.seasonId !== seasonId) continue;
  eventByKey.set(`${e.matchdayId}::${e.teamId}::${e.playerId}`, e);
}
const uses: Use[] = [];
const sideIntensities: Array<{ teamId: string; md: number; side: string; disciplineId: string; stage: Stage; n: number; captain: boolean }> = [];
for (const d of ss.lineupDrafts ?? []) {
  if (d.seasonId !== seasonId) continue;
  const md = mdIndex.get(d.matchdayId);
  if (!md || !doneMd.includes(d.matchdayId)) continue;
  const bySide = new Map<string, { disc: string; n: number }>();
  const byPlayer = new Map<string, Use>();
  for (const en of d.entries) {
    const stage = ((d.modifiers as any)?.[en.disciplineSide]?.intensity ?? "normal") as Stage;
    const s = bySide.get(en.disciplineSide) ?? { disc: en.disciplineId, n: 0 };
    s.n += 1;
    bySide.set(en.disciplineSide, s);
    const ev = eventByKey.get(`${d.matchdayId}::${d.teamId}::${en.playerId}`);
    if (!ev) continue;
    const u = byPlayer.get(en.playerId);
    if (u) {
      u.sides.add(en.disciplineSide);
      if (RANK[stage] > RANK[u.intensity]) u.intensity = stage;
    } else {
      byPlayer.set(en.playerId, {
        teamId: d.teamId,
        playerId: en.playerId,
        md,
        intensity: stage,
        sides: new Set([en.disciplineSide]),
        fatigueAtRoll: ev.fatigueBefore,
        risk: ev.riskPercent,
        injured: ev.result === "injured",
        unavailableFor: ev.unavailableForMatchdays ?? 0,
      });
    }
  }
  uses.push(...byPlayer.values());
  for (const [side, v] of bySide) {
    sideIntensities.push({
      teamId: d.teamId,
      md,
      side,
      disciplineId: v.disc,
      stage: (((d.modifiers as any)?.[side]?.intensity ?? "normal") as Stage),
      n: v.n,
      captain: d.entries.some((e) => e.disciplineSide === side && e.isCaptain),
    });
  }
}

const plan = (ss.disciplineSchedule ?? []) as Array<{ discipline1?: { playerCount?: number | null }; discipline2?: { playerCount?: number | null } }>;
const slotsPerMd = plan.map((z) => (z.discipline1?.playerCount ?? 0) + (z.discipline2?.playerCount ?? 0));

console.log(`# KI-Belastungsverhalten — ${SAVE_ID}`);
console.log(
  `Saison ${seasonId}, ${doneMd.length} gebuchte Spieltage von ${mdIds.length}, aktuell ${gs.season.currentMatchday}. ` +
    `${aiTeams.length} KI-Teams, menschlich: ${humanTeams.join(", ") || "-"}. ` +
    `Last ${MATCHDAY_FATIGUE_LOAD}, Bank-Erholung ${BASE_MATCHDAY_RECOVERY}, aktive Erholung ${MATCHDAY_ACTIVE_RECOVERY} ` +
    `(Schalter ${isFatigueActiveRecoveryEnabled(gs) ? "AN" : "AUS"}), ${uses.length} Einsätze.\n`,
);

// ---------------------------------------------------------------- 1. Intensität
const groups: Array<[string, (t: string) => boolean]> = [
  ["KI (alle)", (t) => !isHuman(t)],
  ["Mensch", (t) => isHuman(t)],
];
console.log("## 1. Einsatz-Intensität (Disziplin-Seiten und Spieler-Einsätze)\n");
{
  const rows: Array<Array<string | number>> = [];
  for (const [name, sel] of groups) {
    const sides = sideIntensities.filter((s) => sel(s.teamId));
    const us = uses.filter((u) => sel(u.teamId));
    const c = (arr: Array<{ stage?: Stage; intensity?: Stage }>, k: Stage) => arr.filter((x) => (x.stage ?? x.intensity) === k).length;
    rows.push([
      name,
      sides.length,
      pct(c(sides, "conserve"), sides.length),
      pct(c(sides, "normal"), sides.length),
      pct(c(sides, "push"), sides.length),
      us.length,
      pct(c(us, "conserve"), us.length),
      pct(c(us, "normal"), us.length),
      pct(c(us, "push"), us.length),
    ]);
  }
  table(["Gruppe", "Seiten", "Schonen", "Normal", "Pushen", "Einsätze", "Schonen", "Normal", "Pushen"], rows);
}
{
  const ki = sideIntensities.filter((x) => !isHuman(x.teamId) && x.md >= 3);
  const mitK = ki.filter((x) => x.captain);
  const ohneK = ki.filter((x) => !x.captain);
  const push = (a: typeof ki) => a.filter((x) => x.stage === "push").length;
  console.log(
    `Push-Anteil ab MD3 (KI, Seiten): mit Kapitän ${pct(push(mitK), mitK.length)} (${mitK.length} Seiten), ohne Kapitän ${pct(push(ohneK), ohneK.length)} (${ohneK.length} Seiten); ` +
      `Kapitän-Seiten stellen ${pct(push(mitK), push(ki))} aller Push-Seiten.\n`,
  );
}
console.log("Intensität nach Spieltag (KI, Anteil der Seiten):\n");
{
  const rows: Array<Array<string | number>> = [];
  for (let md = 1; md <= doneMd.length; md += 1) {
    const s = sideIntensities.filter((x) => x.md === md && !isHuman(x.teamId));
    const c = (k: Stage) => s.filter((x) => x.stage === k).length;
    rows.push([md, s.length, pct(c("conserve"), s.length), pct(c("normal"), s.length), pct(c("push"), s.length)]);
  }
  table(["MD", "Seiten", "Schonen", "Normal", "Pushen"], rows);
}
console.log("Hängt die Intensität an der Erschöpfung? (KI-Einsätze, Fatigue AM WURF, also nach Last)\n");
{
  const bands: Array<[string, number, number]> = [["<25", 0, 25], ["25-50", 25, 50], ["50-65", 50, 65], ["65-80", 65, 80], [">=80", 80, 101]];
  const rows: Array<Array<string | number>> = [];
  for (const k of ["conserve", "normal", "push"] as Stage[]) {
    const us = uses.filter((u) => !isHuman(u.teamId) && u.intensity === k);
    rows.push([
      k,
      us.length,
      f1(mean(us.map((u) => u.fatigueAtRoll))),
      ...bands.map(([, lo, hi]) => pct(us.filter((u) => u.fatigueAtRoll >= lo && u.fatigueAtRoll < hi).length, us.length)),
      pct(us.filter((u) => u.injured).length, us.length),
      f2(mean(us.map((u) => u.risk))),
    ]);
  }
  table(["Intensität", "Einsätze", "Ø Fatigue am Wurf", ...bands.map((b) => b[0]), "verletzt", "Ø Risiko %"], rows);
}

// ---------------------------------------------------------------- Fatigue-Konten nachrechnen
type Acct = Map<string, number>;
function loadOf(player: Player | undefined, stage: Stage) {
  return Number((MATCHDAY_FATIGUE_LOAD * (player ? getPlayerFatigueLoadMultiplier(player) : 1) * INTENSITY_FATIGUE_MULT[stage]).toFixed(2));
}
const activeOn = isFatigueActiveRecoveryEnabled(gs);
type Sim = {
  rechaLevel?: (teamId: string) => number; // Recovery-Center-Stufe je Team (Standard: aus dem Spielstand)
  schonSchwelle?: number; // Fatigue VOR dem Spieltag über X -> Einsatz auf conserve
  keinPush?: boolean;
  seitenSchonAb?: number; // Seite (Ø Fatigue ihrer Spieler vor dem Spieltag) über X -> ganze Seite conserve (wie die Intensität im Spiel: je Seite)
  seitenPushDeckel?: number; // Seite mit Ø Fatigue über X: Push -> normal
  pushDeckel?: number; // Push nur, wenn Fatigue VOR dem Spieltag <= X, sonst normal
  rotation?: { schwelle: number; vorsprung: number };
  trainingLeichtAb?: number; // Spieler über X Fatigue -> Trainingsmodus leicht
  alleLeicht?: boolean;
};
type SimResult = { erwartet: number; einsaetze: number; tageGespielt: number; ueber65: number; ueber50: number; tausch: number; schonEinsaetze: number; scoreKosten: number };
const STAGE_SCORE: Record<Stage, number> = { conserve: -2.5, normal: 0, push: 4 };
const modeOf = (playerId: string): Mode => ((playersById.get(playerId)?.trainingMode ?? "mittel") as Mode);
function recoveryFor(teamId: string, mode: Mode, level: number) {
  const eff = getTeamFacilityState(gs!, teamId).facilities.recovery_center?.conditionPct;
  void eff;
  const flat = RECOVERY_FLAT_BONUS_BY_LEVEL[Math.max(0, Math.min(5, level))] ?? 0;
  const normal = (BASE_MATCHDAY_RECOVERY + flat) * (TRAINING_RECOVERY_IMPACT[mode]?.recoveryMultiplier ?? 1);
  const active = activeOn ? (normal * MATCHDAY_ACTIVE_RECOVERY) / BASE_MATCHDAY_RECOVERY : 0;
  return { normal, active };
}
const baseLevel = (t: string) => getFacilityLevel(getTeamFacilityState(gs!, t), "recovery_center");
// Unverfügbar (verletzt) nach aufgezeichneten Verletzungen: Spieltage md+1 .. md+n
const outAt = new Map<string, Set<number>>();
for (const u of uses) {
  if (!u.injured) continue;
  const key = `${u.teamId}::${u.playerId}`;
  if (!outAt.has(key)) outAt.set(key, new Set());
  for (let k = 1; k <= Math.max(1, u.unavailableFor); k += 1) outAt.get(key)!.add(u.md + k);
}
function simulate(opt: Sim, restrictTeams: string[], offsetBy: number[], collect?: { preFatigue: Map<string, number> }): SimResult {
  const res: SimResult = { erwartet: 0, einsaetze: 0, tageGespielt: 0, ueber65: 0, ueber50: 0, tausch: 0, schonEinsaetze: 0, scoreKosten: 0 };
  for (const teamId of restrictTeams) {
    const roster = rosterOf.get(teamId) ?? [];
    const acct: Acct = new Map(roster.map((id) => [id, 0] as const));
    const level = opt.rechaLevel ? opt.rechaLevel(teamId) : baseLevel(teamId);
    for (let md = 1; md <= doneMd.length; md += 1) {
      const rec = uses.filter((u) => u.teamId === teamId && u.md === md);
      const starters = new Map(rec.map((u) => [u.playerId, u] as const));
      // Rotation: tausche müde Starter gegen frischere, gesunde Bank-Spieler
      const rot = opt.rotation;
      if (rot) {
        const bench = roster
          .filter((id) => !starters.has(id) && !outAt.get(`${teamId}::${id}`)?.has(md))
          .sort((a, b) => (acct.get(a) ?? 0) - (acct.get(b) ?? 0));
        const tired = [...starters.values()].sort((a, b) => (acct.get(b.playerId) ?? 0) - (acct.get(a.playerId) ?? 0));
        for (const t of tired) {
          const tf = acct.get(t.playerId) ?? 0;
          if (tf <= rot.schwelle) break;
          const idx = bench.findIndex((id) => (acct.get(id) ?? 0) <= tf - rot.vorsprung);
          if (idx < 0) continue;
          const repl = bench.splice(idx, 1)[0]!;
          starters.delete(t.playerId);
          starters.set(repl, { ...t, playerId: repl });
          bench.push(t.playerId);
          bench.sort((a, b) => (acct.get(a) ?? 0) - (acct.get(b) ?? 0));
          res.tausch += 1;
        }
      }
      const sideAvg = new Map<string, number>();
      if (opt.seitenSchonAb != null || opt.seitenPushDeckel != null) {
        const acc = new Map<string, number[]>();
        for (const u of starters.values()) for (const sd of u.sides) acc.set(sd, [...(acc.get(sd) ?? []), acct.get(u.playerId) ?? 0]);
        for (const [sd, v] of acc) sideAvg.set(sd, mean(v));
      }
      const sideStageRec = (sd: string): Stage =>
        sideIntensities.find((x) => x.teamId === teamId && x.md === md && x.side === sd)?.stage ?? "normal";
      for (const id of roster) {
        const pl = playersById.get(id);
        const cur = acct.get(id) ?? 0;
        let mode = modeOf(id);
        if (opt.alleLeicht) mode = "leicht";
        if (opt.trainingLeichtAb != null && cur > opt.trainingLeichtAb) mode = "leicht";
        const r = recoveryFor(teamId, mode, level);
        const u = starters.get(id);
        if (u) {
          let stage: Stage = u.intensity;
          if (opt.seitenSchonAb != null || opt.seitenPushDeckel != null) {
            let best: Stage = "conserve";
            for (const sd of u.sides) {
              let st = sideStageRec(sd);
              const av = sideAvg.get(sd) ?? 0;
              if (opt.seitenPushDeckel != null && st === "push" && av > opt.seitenPushDeckel) st = "normal";
              if (opt.seitenSchonAb != null && av > opt.seitenSchonAb) {
                if (st !== "conserve") res.schonEinsaetze += 1;
                st = "conserve";
              }
              if (RANK[st] > RANK[best]) best = st;
            }
            stage = best;
          }
          if (opt.keinPush && stage === "push") stage = "normal";
          if (opt.pushDeckel != null && stage === "push" && cur > opt.pushDeckel) stage = "normal";
          if (opt.schonSchwelle != null && cur > opt.schonSchwelle) {
            if (stage !== "conserve") res.schonEinsaetze += 1;
            stage = "conserve";
          }
          res.scoreKosten += STAGE_SCORE[stage] - STAGE_SCORE[u.intensity];
          const next = Math.max(0, Math.min(100, cur + loadOf(pl, stage) - r.active));
          const atRoll = Math.max(0, Math.min(100, next + (offsetBy[md] ?? 0)));
          res.erwartet += getInjuryRiskPercent(atRoll) / 100;
          res.einsaetze += 1;
          if (atRoll >= 65) res.ueber65 += 1;
          if (atRoll >= 50) res.ueber50 += 1;
          if (collect) collect.preFatigue.set(`${md}::${teamId}::${id}`, cur);
          acct.set(id, next);
        } else {
          acct.set(id, Math.max(0, cur - r.normal));
        }
      }
    }
  }
  return res;
}

// Kalibrierung: Differenz zwischen aufgezeichneter Fatigue am Wurf und Nachrechnung (Trainings-Schicht)
const pre = { preFatigue: new Map<string, number>() };
const diffsByMd: number[][] = Array.from({ length: doneMd.length + 1 }, () => []);
function offsetCalibration() {
  const diffs: number[] = [];
  const sim = (teamId: string) => {
    const roster = rosterOf.get(teamId) ?? [];
    const acct: Acct = new Map(roster.map((id) => [id, 0] as const));
    const level = baseLevel(teamId);
    for (let md = 1; md <= doneMd.length; md += 1) {
      const starters = new Map(uses.filter((u) => u.teamId === teamId && u.md === md).map((u) => [u.playerId, u] as const));
      for (const id of roster) {
        const pl = playersById.get(id);
        const cur = acct.get(id) ?? 0;
        const r = recoveryFor(teamId, modeOf(id), level);
        const u = starters.get(id);
        if (u) {
          const next = Math.max(0, Math.min(100, cur + loadOf(pl, u.intensity) - r.active));
          diffs.push(u.fatigueAtRoll - next);
          diffsByMd[md]!.push(u.fatigueAtRoll - next);
          acct.set(id, next);
        } else acct.set(id, Math.max(0, cur - r.normal));
      }
    }
  };
  teamIds.forEach(sim);
  return diffs;
}
const diffs = offsetCalibration();
const OFFSET_BY_MD = diffsByMd.map((d) => Math.max(0, median(d)));

// Vor-Spieltags-Fatigue je Einsatz (Nachrechnung ohne Szenario), gebraucht für Rotationsfragen
simulate({}, teamIds, OFFSET_BY_MD, pre);

const benchCache = new Map<string, Acct[]>();
// ---------------------------------------------------------------- 2. Rotation / Erschöpfte im Einsatz
console.log("## 2. Wer spielt — Rotation und erschöpfte Einsätze\n");
console.log(
  `Nachrechnung der Fatigue-Konten aus den aufgezeichneten Einsätzen: Differenz zur aufgezeichneten Fatigue am Wurf ` +
    `Median ${f1(median(diffs))}, Ø ${f1(mean(diffs))} (Trainings-Schicht; als Offset je Spieltag mitgeführt: ${OFFSET_BY_MD.slice(1).map(f1).join("/")}).\n`,
);
{
  const rows: Array<Array<string | number>> = [];
  for (const [name, sel] of groups) {
    const us = uses.filter((u) => sel(u.teamId));
    const ts = teamIds.filter(sel);
    const distinct = ts.map((t) => new Set(uses.filter((u) => u.teamId === t).map((u) => u.playerId)).size);
    const kader = ts.map((t) => rosterOf.get(t)?.length ?? 0);
    const perMd = ts.map((t) => mean(Array.from({ length: doneMd.length }, (_, i) => uses.filter((u) => u.teamId === t && u.md === i + 1).length)));
    const preV = us.map((u) => pre.preFatigue.get(`${u.md}::${u.teamId}::${u.playerId}`) ?? 0);
    const tired = (x: number) => us.filter((_, i) => preV[i]! > x).length;
    // frischerer Ersatz auf der Bank?
    let tired50 = 0;
    let tired50WithFresh = 0;
    let tired65 = 0;
    let tired65WithFresh = 0;
    for (const u of us) {
      const f = pre.preFatigue.get(`${u.md}::${u.teamId}::${u.playerId}`) ?? 0;
      if (f <= 50) continue;
      const usedIds = new Set(uses.filter((v) => v.teamId === u.teamId && v.md === u.md).map((v) => v.playerId));
      const fresher = (rosterOf.get(u.teamId) ?? []).some(
        (id) => !usedIds.has(id) && !outAt.get(`${u.teamId}::${id}`)?.has(u.md) && (pre.preFatigue.get(`${u.md}::${u.teamId}::${id}`) ?? simBench(u.teamId, u.md, id)) <= f - 15,
      );
      tired50 += 1;
      if (fresher) tired50WithFresh += 1;
      if (f > 65) {
        tired65 += 1;
        if (fresher) tired65WithFresh += 1;
      }
    }
    rows.push([
      name,
      f1(mean(kader)),
      f1(mean(distinct)),
      f1(mean(perMd)),
      us.length,
      pct(tired(50), us.length),
      pct(tired(65), us.length),
      pct(tired50WithFresh, tired50),
      pct(tired65WithFresh, tired65),
    ]);
  }
  table(
    ["Gruppe", "Ø Kader", "Ø versch. Spieler eingesetzt", "Ø Spieler je MD", "Einsätze", "Einsatz bei Fatigue >50", "bei >65", ">50 und >=15 frischerer Ersatz frei", ">65 und frischerer Ersatz frei"],
    rows,
  );
}
// Bank-Konten für Rotationsfrage: Konto eines NICHT eingesetzten Spielers zum MD
function simBench(teamId: string, md: number, playerId: string) {
  if (!benchCache.has(teamId)) {
    const roster = rosterOf.get(teamId) ?? [];
    const acct: Acct = new Map(roster.map((id) => [id, 0] as const));
    const snaps: Acct[] = [];
    const level = baseLevel(teamId);
    for (let m = 1; m <= doneMd.length; m += 1) {
      snaps[m] = new Map(acct);
      const starters = new Map(uses.filter((u) => u.teamId === teamId && u.md === m).map((u) => [u.playerId, u] as const));
      for (const id of roster) {
        const cur = acct.get(id) ?? 0;
        const r = recoveryFor(teamId, modeOf(id), level);
        const u = starters.get(id);
        if (u) acct.set(id, Math.max(0, Math.min(100, cur + loadOf(playersById.get(id), u.intensity) - r.active)));
        else acct.set(id, Math.max(0, cur - r.normal));
      }
    }
    benchCache.set(teamId, snaps);
  }
  return benchCache.get(teamId)![md]?.get(playerId) ?? 0;
}

// ---------------------------------------------------------------- 3. Kadergröße
console.log("## 3. Kadergröße und Rotationsspielraum\n");
console.log(
  `Plätze je Spieltag laut Spielplan (Summe beider Disziplinen): min ${Math.min(...slotsPerMd)}, Median ${median(slotsPerMd)}, max ${Math.max(...slotsPerMd)}, Ø ${f1(mean(slotsPerMd))}; ` +
    `Mindestkader 8, Obergrenze 14.\n`,
);
{
  const sizes = new Map<number, { ai: number; human: number }>();
  for (const t of teamIds) {
    const n = rosterOf.get(t)?.length ?? 0;
    const e = sizes.get(n) ?? { ai: 0, human: 0 };
    if (isHuman(t)) e.human += 1;
    else e.ai += 1;
    sizes.set(n, e);
  }
  table(
    ["Kadergröße", "KI-Teams", "Mensch"],
    [...sizes.entries()].sort((a, b) => a[0] - b[0]).map(([n, e]) => [n, e.ai, e.human]),
  );
  const maxSlots = Math.max(...slotsPerMd);
  const aiRoster = aiTeams.map((t) => rosterOf.get(t)?.length ?? 0);
  const avgSlots = mean(slotsPerMd);
  console.log(
    `KI Ø Kader ${f1(mean(aiRoster))}; Einsatzquote bei Ø-Plätzen ${pct(avgSlots, mean(aiRoster))}, bei Spitzen-Plätzen (${maxSlots}) ${pct(maxSlots, mean(aiRoster))}. ` +
      `Rechnerisches Gleichgewicht (Last gleich Erholung) bei q* = ${pct(BASE_MATCHDAY_RECOVERY - MATCHDAY_ACTIVE_RECOVERY, MATCHDAY_FATIGUE_LOAD - MATCHDAY_ACTIVE_RECOVERY + BASE_MATCHDAY_RECOVERY - MATCHDAY_ACTIVE_RECOVERY)} ` +
      `(Netto-Last ${f1(MATCHDAY_FATIGUE_LOAD - MATCHDAY_ACTIVE_RECOVERY)}, Bank -${BASE_MATCHDAY_RECOVERY}).\n`,
  );
  const sl = new Map<number, number>();
  for (const s of slotsPerMd) sl.set(s, (sl.get(s) ?? 0) + 1);
  console.log(`Verteilung der Plätze je Spieltag (Plätze:Anzahl Spieltage): ${[...sl.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join("  ")}\n`);
}

// ---------------------------------------------------------------- 4. Training
console.log("## 4. Training (jetziger Stand `player.trainingMode`, kein Verlauf gespeichert)\n");
{
  const cur = new Map((ss.playerAvailabilityState ?? []).map((a) => [`${a.teamId}::${a.playerId}`, a.fatigue] as const));
  const rows: Array<Array<string | number>> = [];
  for (const [name, sel] of groups) {
    const ids = teamIds.filter(sel).flatMap((t) => (rosterOf.get(t) ?? []).map((id) => [t, id] as const));
    const m = (k: Mode) => ids.filter(([, id]) => modeOf(id) === k).length;
    rows.push([name, ids.length, pct(m("leicht"), ids.length), pct(m("mittel"), ids.length), pct(m("hart"), ids.length)]);
  }
  table(["Gruppe", "Spieler", "leicht", "mittel", "hart"], rows);
  console.log("Trainingsmodus nach aktueller Konto-Fatigue (nur KI; ob die KI unter Erschöpfung auf leicht geht):\n");
  const bands: Array<[string, number, number]> = [["<25", 0, 25], ["25-50", 25, 50], ["50-65", 50, 65], ["65-80", 65, 80], [">=80", 80, 101]];
  const rws: Array<Array<string | number>> = [];
  for (const [label, lo, hi] of bands) {
    const ids = aiTeams.flatMap((t) => (rosterOf.get(t) ?? []).map((id) => [t, id] as const)).filter(([t, id]) => {
      const f = cur.get(`${t}::${id}`) ?? 0;
      return f >= lo && f < hi;
    });
    const m = (k: Mode) => ids.filter(([, id]) => modeOf(id) === k).length;
    rws.push([label, ids.length, pct(m("leicht"), ids.length), pct(m("mittel"), ids.length), pct(m("hart"), ids.length)]);
  }
  table(["Fatigue (Konto)", "Spieler", "leicht", "mittel", "hart"], rws);
  const tc = ss.trainingIntensityConfirmations ?? {};
  console.log(`Team-Trainingsintensität bestätigt (trainingIntensityConfirmations): ${Object.keys(tc).length} Teams, Beispiel ${JSON.stringify(Object.values(tc)[0] ?? null).slice(0, 160)}\n`);
}

// ---------------------------------------------------------------- 5. Gebäude
console.log("## 5. Gebäude (Recovery Center und übrige)\n");
{
  const ids = ["training_center", "recovery_center", "scouting_office", "analytics_room", "fan_shop", "arena_upgrade", "academy", "specialist_wing"] as const;
  const rows: Array<Array<string | number>> = [];
  for (const [name, sel] of groups) {
    const ts = teamIds.filter(sel);
    rows.push([name, ts.length, ...ids.map((fid) => `${ts.filter((t) => getFacilityLevel(getTeamFacilityState(gs, t), fid) > 0).length}`)]);
  }
  table(["Gruppe", "Teams", ...ids.map((x) => `${x}>0`)], rows);
  console.log(`Recovery-Center-Stufen KI: ${[0, 1, 2, 3, 4, 5].map((l) => `${l}:${aiTeams.filter((t) => baseLevel(t) === l).length}`).join(" ")}; facilityEvents ${(ss.facilityEvents ?? []).length}; Leihgaben-Teams ${Object.keys((ss as any).sponsorLeihgabenByTeamId ?? {}).length}.`);
  const cash = aiTeams.map((t) => gs.teams.find((x) => x.teamId === t)!.cash);
  {
    const cost = [0, 7, 13, 22, 35, 54];
    const cum = (l: number) => sum(cost.slice(1, l + 1));
    const cashAi = aiTeams.map((t) => gs.teams.find((x) => x.teamId === t)!.cash);
    console.log(
      `Reha kumulativ: ${[1, 2, 3].map((l) => `L${l} ${cum(l)} C`).join(", ")}. KI-Teams mit Cash >= Kosten: ${[1, 2, 3].map((l) => `L${l} ${cashAi.filter((c) => c >= cum(l)).length}`).join(", ")}; ` +
        `Cash >= Kosten + 10 Puffer: ${[1, 2].map((l) => `L${l} ${cashAi.filter((c) => c >= cum(l) + 10).length}`).join(", ")}.`,
    );
  }
  console.log(`KI-Cash: Median ${f1(median(cash))}, min ${f1(Math.min(...cash))}, max ${f1(Math.max(...cash))}. Reha-Kosten: ${[1, 2, 3, 4, 5].map((l) => `L${l} +${RECOVERY_FLAT_BONUS_BY_LEVEL[l]}`).join(", ")}.\n`);
}

// ---------------------------------------------------------------- 6. Verletzungen je Team
console.log("## 6. Verletzungen je Team\n");
const perTeam = teamIds.map((t) => {
  const us = uses.filter((u) => u.teamId === t);
  const roster = rosterOf.get(t) ?? [];
  const ps = roster.map(modeOf);
  const distinct = new Set(us.map((u) => u.playerId)).size;
  const inj = us.filter((u) => u.injured);
  return {
    t,
    human: isHuman(t),
    kader: roster.length,
    distinct,
    einsaetze: us.length,
    schonen: us.filter((u) => u.intensity === "conserve").length / Math.max(1, us.length),
    push: us.filter((u) => u.intensity === "push").length / Math.max(1, us.length),
    ueber50: us.filter((u) => u.fatigueAtRoll >= 50).length / Math.max(1, us.length),
    ueber65: us.filter((u) => u.fatigueAtRoll >= 65).length / Math.max(1, us.length),
    fatigueMw: mean(us.map((u) => u.fatigueAtRoll)),
    verletzt: inj.length,
    erwartet: sum(us.map((u) => u.risk / 100)),
    ausfallTage: sum(inj.map((u) => Math.max(1, u.unavailableFor))),
    leicht: ps.filter((m) => m === "leicht").length / Math.max(1, ps.length),
    hart: ps.filter((m) => m === "hart").length / Math.max(1, ps.length),
    reha: baseLevel(t),
  };
});
table(
  ["Team", "Mensch", "Kader", "versch. eingesetzt", "Einsätze", "Schonen", "Pushen", "Fat.>=50", "Fat.>=65", "Ø Fat.", "verletzt", "erwartet", "Ausfall-MD", "Train leicht", "Train hart", "Reha"],
  perTeam
    .sort((a, b) => b.verletzt - a.verletzt)
    .map((r) => [r.t, r.human ? "ja" : "", r.kader, r.distinct, r.einsaetze, pct(r.schonen, 1), pct(r.push, 1), pct(r.ueber50, 1), pct(r.ueber65, 1), f1(r.fatigueMw), r.verletzt, f1(r.erwartet), r.ausfallTage, pct(r.leicht, 1), pct(r.hart, 1), r.reha]),
);
{
  const ai = perTeam.filter((r) => !r.human);
  const tot = (k: keyof (typeof ai)[number]) => sum(ai.map((r) => Number(r[k])));
  console.log(
    `KI gesamt: ${tot("verletzt")} Verletzungen bei ${tot("einsaetze")} Einsätzen (${f2((tot("verletzt") / tot("einsaetze")) * 100)} %), erwartet ${f1(tot("erwartet"))}; Ø ${f1(mean(ai.map((r) => r.verletzt)))} je Team in ${doneMd.length} Spieltagen; ` +
      `Hochrechnung auf ${mdIds.length} Spieltage: Ø ${f1((mean(ai.map((r) => r.verletzt)) * mdIds.length) / doneMd.length)} je Team, ${f1((tot("verletzt") * mdIds.length) / doneMd.length)} Liga (nur KI).`,
  );
  const hum = perTeam.filter((r) => r.human);
  for (const h of hum) console.log(`Mensch ${h.t}: ${h.verletzt} Verletzungen bei ${h.einsaetze} Einsätzen, Kader ${h.kader}.`);
  console.log("");
  const corr = (xs: number[], ys: number[]) => {
    const mx = mean(xs);
    const my = mean(ys);
    const cov = sum(xs.map((x, i) => (x - mx) * (ys[i]! - my)));
    const vx = Math.sqrt(sum(xs.map((x) => (x - mx) ** 2)));
    const vy = Math.sqrt(sum(ys.map((y) => (y - my) ** 2)));
    return vx && vy ? cov / (vx * vy) : 0;
  };
  const rate = ai.map((r) => r.verletzt / Math.max(1, r.einsaetze));
  console.log("Korrelation (Pearson, 31 KI-Teams) mit der Verletzungsrate je Einsatz:\n");
  table(
    ["Größe", "r"],
    [
      ["Kadergröße", f2(corr(ai.map((r) => r.kader), rate))],
      ["Anteil Schonen", f2(corr(ai.map((r) => r.schonen), rate))],
      ["Anteil Pushen", f2(corr(ai.map((r) => r.push), rate))],
      ["Ø Fatigue am Wurf", f2(corr(ai.map((r) => r.fatigueMw), rate))],
      ["Anteil Fatigue>=65", f2(corr(ai.map((r) => r.ueber65), rate))],
      ["Anteil Training leicht", f2(corr(ai.map((r) => r.leicht), rate))],
      ["Reha-Stufe", f2(corr(ai.map((r) => r.reha), rate))],
      ["versch. eingesetzte Spieler", f2(corr(ai.map((r) => r.distinct), rate))],
    ],
  );
  const q = (arr: typeof ai, label: string) => `${label}: ${arr.length} Teams, ${sum(arr.map((r) => r.verletzt))} Verletzungen, ${f2((sum(arr.map((r) => r.verletzt)) / Math.max(1, sum(arr.map((r) => r.einsaetze)))) * 100)} % je Einsatz`;
  const byRoster = [...ai].sort((a, b) => a.kader - b.kader);
  const half = Math.floor(byRoster.length / 2);
  console.log(`Gegenüberstellung: ${q(byRoster.slice(0, half), "kleinere Kader")}  |  ${q(byRoster.slice(half), "größere Kader")}`);
  const byS = [...ai].sort((a, b) => a.schonen - b.schonen);
  console.log(`Gegenüberstellung: ${q(byS.slice(0, half), "wenig Schonen")}  |  ${q(byS.slice(half), "viel Schonen")}`);
  const withReha = ai.filter((r) => r.reha >= 2);
  console.log(`Gegenüberstellung: ${q(withReha, "Reha >= 2")}  |  ${q(ai.filter((r) => r.reha < 2), "Reha < 2")}\n`);
}

// ---------------------------------------------------------------- 7. Szenarien
console.log("## 7. Szenarien auf den aufgezeichneten Einsatzmengen (nur KI-Teams)\n");
const base = simulate({}, aiTeams, OFFSET_BY_MD);
const recorded = sum(perTeam.filter((r) => !r.human).map((r) => r.verletzt));
console.log(
  `Baseline-Nachrechnung: erwartet ${f1(base.erwartet)} Verletzungen (aufgezeichnet: ${recorded} tatsächlich, ${f1(sum(perTeam.filter((r) => !r.human).map((r) => r.erwartet)))} erwartet laut Würfen) ` +
    `bei ${base.einsaetze} Einsätzen; Einsätze mit Fatigue >=50: ${pct(base.ueber50, base.einsaetze)}, >=65: ${pct(base.ueber65, base.einsaetze)}.\n`,
);
const scen: Array<[string, Sim]> = [
  ["Baseline", {}],
  ["(a) Schonen ab Fatigue >40", { schonSchwelle: 40 }],
  ["(a) Schonen ab Fatigue >50", { schonSchwelle: 50 }],
  ["(a) Schonen ab Fatigue >60", { schonSchwelle: 60 }],
  ["(a) Schonen ab Fatigue >70", { schonSchwelle: 70 }],
  ["(a*) Seite schonen, wenn Ø Fatigue der Seite >30 (je Seite wie im Spiel)", { seitenSchonAb: 30 }],
  ["(a*) Seite schonen, wenn Ø Fatigue der Seite >40", { seitenSchonAb: 40 }],
  ["(a*) Seite schonen, wenn Ø Fatigue der Seite >50", { seitenSchonAb: 50 }],
  ["(a*) Push-Deckel je Seite: Ø Fatigue der Seite <=30 (heute 65)", { seitenPushDeckel: 30 }],
  ["(a*) Push-Deckel je Seite <=30 und Schonen ab Seiten-Ø >40", { seitenPushDeckel: 30, seitenSchonAb: 40 }],
  ["(a') Kein Pushen mehr", { keinPush: true }],
  ["(a'') Push nur bei Fatigue vor MD <= 25", { pushDeckel: 25 }],
  ["(a'') Push nur bei Fatigue vor MD <= 40", { pushDeckel: 40 }],
  ["(b) Rotation: Starter >50 gegen >=15 Punkte frischeren Ersatz", { rotation: { schwelle: 50, vorsprung: 15 } }],
  ["(b) Rotation: Starter >40 gegen >=10 Punkte frischeren Ersatz", { rotation: { schwelle: 40, vorsprung: 10 } }],
  ["(b) Rotation: Starter >65 gegen >=15 Punkte frischeren Ersatz", { rotation: { schwelle: 65, vorsprung: 15 } }],
  ["(c) Reha Stufe 1 für alle", { rechaLevel: () => 1 }],
  ["(c) Reha Stufe 2 für alle", { rechaLevel: () => 2 }],
  ["(c) Reha Stufe 3 für alle", { rechaLevel: () => 3 }],
  ["(c) Reha Stufe 5 für alle", { rechaLevel: () => 5 }],
  ["(d) Training leicht, sobald Fatigue >50", { trainingLeichtAb: 50 }],
  ["(d) Training leicht für alle", { alleLeicht: true }],
  ["(a+b) Schonen >60 und Rotation >50/15", { schonSchwelle: 60, rotation: { schwelle: 50, vorsprung: 15 } }],
  ["(a+b+c) Schonen >60, Rotation >50/15, Reha 2", { schonSchwelle: 60, rotation: { schwelle: 50, vorsprung: 15 }, rechaLevel: () => 2 }],
  ["(a+c+d) Schonen >60, Reha 2, Training leicht >50", { schonSchwelle: 60, rechaLevel: () => 2, trainingLeichtAb: 50 }],
];
{
  const rows: Array<Array<string | number>> = [];
  for (const [name, opt] of scen) {
    const r = simulate(opt, aiTeams, OFFSET_BY_MD);
    rows.push([
      name,
      f1(r.erwartet),
      `${((r.erwartet / base.erwartet - 1) * 100).toFixed(0)} %`,
      pct(r.ueber65, r.einsaetze),
      r.tausch || "-",
      r.schonEinsaetze || "-",
      r.scoreKosten === 0 ? "-" : `${r.scoreKosten.toFixed(0)} (${(r.scoreKosten / r.einsaetze).toFixed(2)} je Einsatz)`,
    ]);
  }
  table(["Szenario", "erwartete Verletzungen (11 MD)", "gegen Baseline", "Einsätze Fat.>=65", "Tausche", "auf Schonen gesetzt", "Intensitäts-Score-Punkte gesamt"], rows);
  console.log(
    "Hinweis: gleiche Einsatzmengen, keine Folgetage verletzter Spieler, kein Verhalten der Gegner. Intensitäts-Score = Mittel der " +
      "Spanne je Stufe (Schonen -2,5 / Normal 0 / Push +4 je Spieler, `INTENSITY_SCORE_RANGE`); Rotation kostet Eignung (nicht bepreist).\n",
  );
}

// ---------------------------------------------------------------- 7b. Konzentration: dünne Kader mit viel Pushen
{
  const hot = perTeam.filter((r) => !r.human && r.kader <= 10 && r.push >= 0.4).map((r) => r.t);
  const rest = aiTeams.filter((t) => !hot.includes(t));
  console.log("### 7b. Konzentration — dünne Kader (<=10 Spieler) mit Push-Anteil >= 40 %\n");
  const hotInj = sum(perTeam.filter((r) => hot.includes(r.t)).map((r) => r.verletzt));
  const allInj = sum(perTeam.filter((r) => !r.human).map((r) => r.verletzt));
  console.log(`Teams: ${hot.join(", ")} (${hot.length} von ${aiTeams.length}) tragen ${hotInj} von ${allInj} KI-Verletzungen (${pct(hotInj, allInj)}).\n`);
  const rows: Array<Array<string | number>> = [];
  const variants: Array<[string, Sim]> = [
    ["Baseline", {}],
    ["Kein Pushen", { keinPush: true }],
    ["Push nur bei Fatigue vor MD <= 25", { pushDeckel: 25 }],
    ["Schonen ab >50", { schonSchwelle: 50 }],
    ["Schonen ab >40", { schonSchwelle: 40 }],
    ["Reha 1", { rechaLevel: () => 1 }],
    ["Reha 2", { rechaLevel: () => 2 }],
    ["Kein Pushen + Schonen >50", { keinPush: true, schonSchwelle: 50 }],
  ];
  const b1 = simulate({}, hot, OFFSET_BY_MD).erwartet;
  const b2 = simulate({}, rest, OFFSET_BY_MD).erwartet;
  for (const [name, o] of variants) {
    const a = simulate(o, hot, OFFSET_BY_MD);
    const b = simulate(o, rest, OFFSET_BY_MD);
    rows.push([name, f1(a.erwartet), `${((a.erwartet / b1 - 1) * 100).toFixed(0)} %`, f1(b.erwartet), `${((b.erwartet / b2 - 1) * 100).toFixed(0)} %`]);
  }
  table(["Szenario", `dünn+Push (${hot.length} Teams)`, "gegen Baseline", `übrige (${rest.length} Teams)`, "gegen Baseline"], rows);
}

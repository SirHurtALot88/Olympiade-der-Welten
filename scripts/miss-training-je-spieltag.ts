/**
 * MESSLAUF „TRAINING JE SPIELTAG" (Chris, 18.11., docs/design/training-je-spieltag-18-11.md).
 *
 * Gespielt wird auf einer Wegwerf-SQLite (`OLY_APP_SQLITE_PATH`), derselbe Pfad wie das echte Spiel:
 *   Neues Spiel (Battle, solo_1) -> 32 KI-Teams VON ANFANG AN (M-M sofort KI, Sponsor nachgeholt)
 *   -> Liga-Draft der KI (Pick-Engine) -> N Spieltage (Auto-Run + Spieltagswechsel)
 *   -> Saisonabschluss + Saisonende-Kette (Saisonend-Progression), wenn alle Spieltage gespielt sind.
 *
 * VORHER/NACHHER auf derselben Basis (paarweise):
 *   1) Basis:   OLY_APP_SQLITE_PATH=basis.sqlite npx tsx scripts/miss-training-je-spieltag.ts --nur-anlage
 *               (druckt SAVE_ID=..., Datei bleibt liegen)
 *   2) Kopien:  cp basis.sqlite vorher.sqlite; cp basis.sqlite nachher.sqlite
 *   3) Laeufe:  OLY_APP_SQLITE_PATH=vorher.sqlite  OLY_TRAINING_JE_SPIELTAG=0 npx tsx ... --von-anlage <id> --out vorher.json
 *               OLY_APP_SQLITE_PATH=nachher.sqlite                            npx tsx ... --von-anlage <id> --out nachher.json
 *   4) Auswertung: npx tsx scripts/auswerte-training-je-spieltag.ts vorher.json nachher.json
 *
 * Optionen: --spieltage N (Standard: alle), --keep (SQLite nicht loeschen).
 */
import fs from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { advanceSeasonTransitionStep, buildSeasonTransitionPreview } from "@/lib/season/season-transition-service";
import { runLocalSeasonCompletion, SEASON_COMPLETION_CONFIRM_TOKEN } from "@/lib/season/season-completion-service";
import { chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";
import { isTrainingJeSpieltagAktiv, resolveTrainingJeSpieltagFaktor } from "@/lib/training/training-je-spieltag-schalter";
import { resolvePlayerPotentialScoreFromGameState } from "@/lib/scouting/player-attribute-ceiling-service";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const OUT = arg("out", "");
const VON_ANLAGE = arg("von-anlage", "");
/** Abgebrochenen Lauf fortsetzen: bestehende SQLite (mitten in der Saison) + bisherige Rohdaten (--out). */
const FORTSETZEN = process.argv.includes("--fortsetzen");
const NUR_ANLAGE = process.argv.includes("--nur-anlage");
const SPIELTAGE = Number(arg("spieltage", "0")) || 0;
const t0 = Date.now();
const log = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s] ${msg}`);
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

type SpielerSnap = {
  id: string;
  team: string;
  rating: number | null;
  potenzial: number | null;
  attr: number[];
  mw: number;
  fatigue: number;
};

function spielerSnap(gs: GameState): SpielerSnap[] {
  const team = new Map(gs.rosters.map((r) => [r.playerId, r.teamId] as const));
  return gs.players
    .filter((p) => team.has(p.id))
    .map((p) => ({
      id: p.id,
      team: team.get(p.id)!,
      rating: typeof p.rating === "number" ? r2(p.rating) : null,
      potenzial: resolvePlayerPotentialScoreFromGameState({ gameState: gs, playerId: p.id }),
      attr: PROGRESSION_ATTRIBUTE_ORDER.map((a) => r3(Number(p.attributeSheetStats?.[a] ?? NaN))),
      mw: r2(Number(p.marketValue ?? 0)),
      fatigue: r2(Number(p.fatigue ?? 0)),
    }));
}

/** Kaderstaerke: Mittel der Top-6-Eignung je Disziplin (Chris: beste 6), dann Mittel ueber Disziplinen. */
function kaderStaerke(gs: GameState): Record<string, number> {
  const spieler = new Map(gs.players.map((p) => [p.id, p] as const));
  const disziplinen = (gs.disciplines ?? []).map((d) => d.id);
  const jeTeam = new Map<string, string[]>();
  for (const r of gs.rosters) (jeTeam.get(r.teamId) ?? jeTeam.set(r.teamId, []).get(r.teamId)!).push(r.playerId);
  const out: Record<string, number> = {};
  for (const [teamId, ids] of jeTeam) {
    let summe = 0;
    for (const d of disziplinen) {
      const top = ids.map((id) => spieler.get(id)?.disciplineRatings?.[d] ?? 0).sort((a, b) => b - a).slice(0, 6);
      while (top.length < 6) top.push(0);
      summe += top.reduce((a, b) => a + b, 0) / 6;
    }
    out[teamId] = r2(summe / Math.max(1, disziplinen.length));
  }
  return out;
}

/** Je Spieltag gebuchter Trainingsverlauf und Formabzuege (nur Schalter AN). */
function verlaufSnap(gs: GameState) {
  const out: Record<string, unknown> = {};
  const form = new Map((gs.playerFormState ?? []).map((z) => [z.playerId, z] as const));
  const team = new Map(gs.rosters.map((r) => [r.playerId, r.teamId] as const));
  for (const p of gs.players) {
    if (!team.has(p.id)) continue;
    const akku = p.seasonTrainingAccumulator;
    out[p.id] = {
      verlauf: akku?.seasonId === gs.season.id ? akku.verlauf ?? [] : [],
      modi: akku?.seasonId === gs.season.id ? akku.modeByMatchday : {},
      ueberlastung: (form.get(p.id)?.verlauf ?? []).filter((e) => e.u).map((e) => ({ m: e.m, u: e.u })),
      form: form.get(p.id)?.form ?? null,
    };
  }
  return out;
}

function progressionEvents(gs: GameState, seasonId: string) {
  const out: Record<string, Array<{ a: string; t: number; s: number; p: number; r: number; von: number; nach: number }>> = {};
  for (const e of gs.playerProgressionEvents ?? []) {
    if (e.seasonId !== seasonId || e.source !== "organic_season_progression") continue;
    out[e.playerId] = (e.upgrades ?? []).map((u) => ({
      a: u.attribute,
      t: r3(Number(u.originTraining ?? 0)),
      s: r3(Number(u.originSpillover ?? 0)),
      p: r3(Number(u.originPerformance ?? 0)),
      r: r3(Number(u.originRegression ?? 0)),
      von: u.fromValue,
      nach: u.toValue,
    }));
  }
  return out;
}

async function main() {
  if (!process.env.OLY_APP_SQLITE_PATH) throw new Error("OLY_APP_SQLITE_PATH (Wegwerf-Datei!) setzen.");
  if (!VON_ANLAGE) for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${process.env.OLY_APP_SQLITE_PATH}${suffix}`, { force: true });
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();

  let saveId: string;
  if (VON_ANLAGE) {
    saveId = VON_ANLAGE;
    if (!persistence.getSaveById(saveId)) throw new Error(`Save ${saveId} nicht in der SQLite`);
  } else {
    const input = { presetId: "solo_1" as const, gameMode: "battle" as const, sandbox: true };
    const preview = previewNewGameSetup(input);
    const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
    saveId = angelegt.save.saveId;
    const kiState = chooseSponsorOfferForAiTeams(
      applyGameModeOwnership(persistence.getSaveById(saveId)!.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
    );
    persistence.saveSingleplayerState(saveId, kiState);
    const ohneSponsor = kiState.teams.filter((t) => getTeamSponsorContract(kiState, t.teamId) == null).map((t) => t.teamId);
    if (ohneSponsor.length > 0) throw new Error(`Teams ohne Sponsor vor dem Draft: ${ohneSponsor.join(",")}`);
    log(`Save ${saveId}: 32 KI-Teams, alle mit Sponsor`);
    const dr = await fuehreLigaSetupDraftAus({
      persistence, saveId, seasonId: kiState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[miss-training]",
    });
    log(`Liga-Draft: ${dr.status}, Kader ${persistence.getSaveById(saveId)!.gameState.rosters.length}`);
    if (NUR_ANLAGE) {
      console.log(`SAVE_ID=${saveId}`);
      return;
    }
  }
  const get = () => persistence.getSaveById(saveId)!;
  const sid = get().gameState.season.id;
  const lauf: Record<string, unknown> = FORTSETZEN && OUT && fs.existsSync(OUT)
    ? { ...(JSON.parse(fs.readFileSync(OUT, "utf8")) as Record<string, unknown>), fortgesetzt: new Date().toISOString() }
    : {
    saveId,
    schalter: { jeSpieltag: isTrainingJeSpieltagAktiv(), faktor: resolveTrainingJeSpieltagFaktor() },
    gestartet: new Date().toISOString(),
    spieltageGesamt: get().gameState.season.matchdayIds.length,
    start: { spieler: spielerSnap(get().gameState), staerke: kaderStaerke(get().gameState) },
    staerkeJeSpieltag: [] as Array<Record<string, number>>,
    msJeSpieltag: [] as number[],
  };
  const schreibe = () => OUT && fs.writeFileSync(OUT, JSON.stringify(lauf));
  schreibe();

  const md = get().gameState.season.matchdayIds.length;
  const bis = SPIELTAGE > 0 ? Math.min(md, SPIELTAGE) : md;
  const ersterIndex = FORTSETZEN ? Math.max(0, get().gameState.season.matchdayIds.indexOf(get().gameState.matchdayState.matchdayId)) : 0;
  if (FORTSETZEN) log(`Fortsetzung ab Spieltag ${ersterIndex + 1}`);
  for (let i = ersterIndex; i < bis; i += 1) {
    const ts = Date.now();
    const matchdayId = get().gameState.matchdayState.matchdayId;
    const run = await runLocalMatchdayAutoRun(
      { saveId, seasonId: sid, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false } },
      persistence,
    );
    if (!run.ok) { log(`${matchdayId} blockiert: ${run.blockingReasons.slice(0, 3).join(" | ")}`); break; }
    const adv = await executeMatchdayAdvance({ saveId, seasonId: sid, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence);
    if (!adv.ok || !adv.applied) { log(`Wechsel blockiert: ${adv.blockingReasons.join(" | ")}`); break; }
    (lauf.staerkeJeSpieltag as Array<Record<string, number>>)[i] = kaderStaerke(get().gameState);
    (lauf.msJeSpieltag as number[])[i] = Date.now() - ts;
    log(`Spieltag ${i + 1}/${bis} (${((Date.now() - ts) / 1000).toFixed(0)}s)`);
    lauf.gespielt = i + 1;
    if ((i + 1) % 5 === 0 || i + 1 === bis) {
      lauf.nachSpieltagen = { spieler: spielerSnap(get().gameState), verlauf: verlaufSnap(get().gameState) };
      schreibe();
    }
  }
  const vorAbschluss = get().gameState;
  lauf.nachSpieltagen = { spieler: spielerSnap(vorAbschluss), verlauf: verlaufSnap(vorAbschluss) };
  lauf.verletzungen = (vorAbschluss.seasonState.injuryEvents ?? []).filter((e) => e.seasonId === sid && e.result === "injured").length;
  schreibe();

  if (lauf.gespielt === md) {
    const comp = await runLocalSeasonCompletion(
      { saveId, seasonId: sid, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN }, persistence);
    log(`Saisonabschluss: ok=${comp.ok} applied=${comp.applied}`);
    for (let hop = 1; hop <= 12; hop += 1) {
      const aktuell = get();
      if (!isSeasonEndPhase(aktuell.gameState.gamePhase)) break;
      const von = String(buildSeasonTransitionPreview(aktuell).transition.currentStep);
      const erg = await advanceSeasonTransitionStep(aktuell, persistence);
      log(`Kette ${von} -> ${erg.transition.currentStep} (${erg.applied ? "ok" : erg.blockingReasons.join(",")})`);
      if (!erg.applied) break;
      if ((get().gameState.playerProgressionEvents ?? []).some((e) => e.seasonId === sid && e.source === "organic_season_progression")) {
        lauf.nachSaisonende = { spieler: spielerSnap(get().gameState), events: progressionEvents(get().gameState, sid), staerke: kaderStaerke(get().gameState) };
        schreibe();
        break;
      }
    }
  }
  lauf.laufzeitSekunden = Math.round((Date.now() - t0) / 1000);
  schreibe();
  log(`fertig, ${lauf.laufzeitSekunden}s`);
  if (!process.argv.includes("--keep")) for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${process.env.OLY_APP_SQLITE_PATH}${suffix}`, { force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });

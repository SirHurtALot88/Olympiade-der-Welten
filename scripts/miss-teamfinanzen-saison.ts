/* eslint-disable no-console */
/**
 * IST-MESSUNG DER TEAMFINANZEN (18.11., Auftrag Chris: „kannst du das mal messen, wenn die Teams
 * normal mit der Pick-Engine ihre Spieler kaufen, was sie wirklich in der Saison an Kosten fuer
 * Gehaelter haben und ggf. Gebaeude, damit man das andere gut drumherum aufbauen kann").
 *
 * Reine Messung: es wird NICHTS an der Spiellogik geaendert. Gespielt wird auf einer Wegwerf-SQLite
 * (`OLY_APP_SQLITE_PATH`, wird beim Start geloescht und am Ende entfernt), derselbe Pfad wie das
 * echte Spiel:
 *
 *   Neues Spiel (applyNewGameSetup, Battle, solo_1, Liga-Split 2x16)
 *   -> Liga-Draft der KI (fuehreLigaSetupDraftAus = Pick-Engine)
 *   -> 20 Spieltage (runLocalMatchdayAutoRun + executeMatchdayAdvance)
 *   -> Saisonabschluss (runLocalSeasonCompletion) und Saisonende-Kette (advanceSeasonTransitionStep)
 *   -> Saison 2: Kaufphase der KI (fuehreKiPreseasonLaufAus, derselbe Dienst wie die Route
 *      /api/ai/preseason-background)
 *
 * Nach jedem Abschnitt wird je Team ein Schnappschuss genommen (Kasse, Kader, Gehalt, Marktwert,
 * Gebaeude, Kredit, Transfers) und die Roh-GuV der EINEN GuV (lib/finance/season-end-guv.ts)
 * ausgelesen.
 *
 * Aufruf (Wegwerf-Datei!):
 *   OLY_APP_SQLITE_PATH=/pfad/wegwerf.sqlite npx tsx scripts/miss-teamfinanzen-saison.ts \
 *     [--mode battle|manager] [--seasons 2] [--out data/generated/lauf.json] [--label A]
 *
 * Das Auswerteskript (Tabellen + Doku) liegt in `scripts/auswerte-teamfinanzen-saison.ts`.
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { fuehreKiPreseasonLaufAus } from "@/lib/ai/ai-preseason-background-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamFacilityUpkeepTotal, getTeamActualSalaryTotal, getTeamNegotiatedSalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getTeamAnnualLoanInstallment, getTeamAnnualLoanInterest, getTeamOutstandingDebt } from "@/lib/finance/loan-service";
import { buildSeasonGuv } from "@/lib/finance/season-end-guv";
import { resolveSeasonGuvPartsByTeam } from "@/lib/finance/season-guv-resolver";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getLeagueOf } from "@/lib/season/league-split";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { advanceSeasonTransitionStep, buildSeasonTransitionPreview } from "@/lib/season/season-transition-service";
import { runLocalSeasonCompletion, SEASON_COMPLETION_CONFIRM_TOKEN } from "@/lib/season/season-completion-service";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const MODE = arg("mode", "battle") as "battle" | "manager";
const SEASONS = Number(arg("seasons", "2"));
const OUT = arg("out", "");
const LABEL = arg("label", "A");
/** Wiederaufnahme einer abgebrochenen Messung: bestehende Wegwerf-SQLite + bereits geschriebene Rohdaten (--out) weiterverwenden. */
const RESUME = arg("resume", "");
/** "kaufphase": nach der Kaufphase von Saison 2 (und dem Saisonstart-Schnappschuss) aufhoeren. */
const STOP_AFTER = arg("stop-after", "");

const t0 = Date.now();
const log = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s] ${msg}`);
const r2 = (v: number) => Math.round(v * 100) / 100;

type TeamSnap = {
  teamId: string;
  liga: string | null;
  rank: number | null;
  cash: number;
  budget: number;
  kader: number;
  gehaltIst: number;
  gehaltVerhandelt: number;
  marktwert: number;
  gebaeude: { id: string; stufe: number }[];
  gebaeudeUnterhalt: number;
  schuld: number;
  kreditZins: number;
  kreditRate: number;
};

function snap(gs: GameState): Record<string, TeamSnap> {
  const mv = new Map(gs.players.map((p) => [p.id, (p as { marketValue?: number | null }).marketValue ?? 0] as const));
  const out: Record<string, TeamSnap> = {};
  for (const t of gs.teams) {
    const rost = gs.rosters.filter((r) => r.teamId === t.teamId);
    const fac = getTeamFacilityState(gs, t.teamId);
    out[t.teamId] = {
      teamId: t.teamId,
      liga: getLeagueOf(gs, t.teamId),
      rank: gs.seasonState.standings?.[t.teamId]?.rank ?? null,
      cash: r2(t.cash),
      budget: r2(t.budget),
      kader: rost.length,
      gehaltIst: getTeamActualSalaryTotal(gs, t.teamId),
      gehaltVerhandelt: getTeamNegotiatedSalaryTotal(gs, t.teamId),
      marktwert: r2(rost.reduce((s, r) => s + (mv.get(r.playerId) ?? 0), 0)),
      gebaeude: Object.entries(fac.facilities)
        .filter(([, f]) => (f?.level ?? 0) > 0)
        .map(([id, f]) => ({ id, stufe: f.level })),
      gebaeudeUnterhalt: getTeamFacilityUpkeepTotal(gs, t.teamId),
      schuld: r2(getTeamOutstandingDebt(gs, t.teamId)),
      kreditZins: r2(getTeamAnnualLoanInterest(gs, t.teamId)),
      kreditRate: r2(getTeamAnnualLoanInstallment(gs, t.teamId)),
    };
  }
  return out;
}

function transfers(gs: GameState, seasonId: string, nurSeit: number) {
  const byTeam: Record<string, { kaeufe: number; kaufSumme: number; verkaeufe: number; verkaufNetto: number; ablaufErloes: number }> = {};
  const eintraege = gs.transferHistory.slice(nurSeit);
  for (const e of eintraege) {
    if (e.seasonId !== seasonId && seasonId !== "*") continue;
    if (e.transferType === "buy" && e.toTeamId) {
      const b = (byTeam[e.toTeamId] ??= { kaeufe: 0, kaufSumme: 0, verkaeufe: 0, verkaufNetto: 0, ablaufErloes: 0 });
      b.kaeufe += 1;
      b.kaufSumme += e.netCashImpact ?? e.fee;
    }
    if ((e.transferType === "sell" || e.transferType === "contract_exit") && e.fromTeamId) {
      const b = (byTeam[e.fromTeamId] ??= { kaeufe: 0, kaufSumme: 0, verkaeufe: 0, verkaufNetto: 0, ablaufErloes: 0 });
      if (e.transferType === "sell") {
        b.verkaeufe += 1;
        b.verkaufNetto += e.netCashImpact ?? e.fee;
      } else {
        b.ablaufErloes += e.netCashImpact ?? e.fee;
      }
    }
    // Verkauf an die KI-Teams: Gegenbuchung beim Kaeufer steht ebenfalls als "buy" -> hier nicht doppelt
  }
  for (const v of Object.values(byTeam)) {
    v.kaufSumme = r2(v.kaufSumme);
    v.verkaufNetto = r2(v.verkaufNetto);
    v.ablaufErloes = r2(v.ablaufErloes);
  }
  return { anzahlEintraege: eintraege.length, byTeam };
}

function guvSnapshot(gs: GameState) {
  const parts = resolveSeasonGuvPartsByTeam(gs);
  const out: Record<string, unknown> = {};
  for (const [teamId, p] of parts.entries()) {
    const g = buildSeasonGuv(p);
    out[teamId] = { parts: p, guv: g };
  }
  return out;
}

async function main() {
  if (!process.env.OLY_APP_SQLITE_PATH) throw new Error("OLY_APP_SQLITE_PATH (Wegwerf-Datei!) setzen.");
  if (!RESUME) for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${process.env.OLY_APP_SQLITE_PATH}${suffix}`, { force: true });
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();

  let saveId: string;
  let run: Record<string, unknown>;
  if (RESUME) {
    saveId = RESUME;
    run = JSON.parse(fs.readFileSync(OUT, "utf8")) as Record<string, unknown>;
    run.fortgesetzt = [...((run.fortgesetzt as string[] | undefined) ?? []), new Date().toISOString()];
    log(`Wiederaufnahme von ${saveId}`);
  } else {
    const input = { presetId: "solo_1" as const, gameMode: MODE, sandbox: true };
    const preview = previewNewGameSetup(input);
    const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
    saveId = angelegt.save.saveId;
    log(`Save ${saveId} (${MODE}) angelegt`);
    run = { label: LABEL, mode: MODE, saveId, gestartet: new Date().toISOString(), spieltageProSaison: persistence.getSaveById(saveId)!.gameState.season.matchdayIds.length, phasen: {} };
  }
  const get = () => persistence.getSaveById(saveId)!;
  const phasen = run.phasen as Record<string, unknown>;
  const schreibe = () => {
    if (OUT) fs.writeFileSync(OUT, JSON.stringify(run));
  };
  const seasonId1 = get().gameState.season.id;
  let gs: GameState;
  if (!RESUME) {
    phasen["s1_00_nach_anlage"] = { snap: snap(get().gameState) };
    // 1) Pick-Engine / Liga-Draft
    const dr = await fuehreLigaSetupDraftAus({
      persistence, saveId, seasonId: seasonId1, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[miss-finanzen]",
    });
    log(`Liga-Draft: ${dr.status}`);
    gs = get().gameState;
    if (MODE === "battle") {
      persistence.saveSingleplayerState(saveId, applyGameModeOwnership(gs, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }));
    }
    gs = get().gameState;
    run.teamCount = gs.teams.length;
    run.ligaAssignment = Object.fromEntries(gs.teams.map((t) => [t.teamId, getLeagueOf(gs, t.teamId)]));
    phasen["s1_01_nach_draft"] = { snap: snap(gs), transfers: transfers(gs, "*", 0) };
    log(`Nach Draft: Σ Kasse ${r2(gs.teams.reduce((s, t) => s + t.cash, 0))}, Kader Ø ${r2(gs.rosters.length / gs.teams.length)}`);
    schreibe();
  }
  const startSaison = RESUME ? Number(arg("start-season", "1")) : 1;

  for (let saison = startSaison; saison <= SEASONS; saison += 1) {
    const sid = get().gameState.season.id;
    const praefix = `s${saison}`;
    const transferBeginn = get().gameState.transferHistory.length;
    const imMittenDerSaison = RESUME && saison === startSaison && !arg("skip-kauf", "");
    void imMittenDerSaison;
    if (saison > 1 && !arg("skip-kauf", "")) {
      // Kaufphase der KI in der neuen Saison -- derselbe Dienst wie die Route.
      const vorKauf = get().gameState;
      phasen[`${praefix}_00_vor_kaufphase`] = { snap: snap(vorKauf) };
      const sumVor = r2(vorKauf.teams.reduce((s, t) => s + t.cash, 0));
      const ergebnis = await fuehreKiPreseasonLaufAus({ saveId, seasonId: sid, scope: { room: null, participant: null, activeOwnerId: null }, persistence });
      log(`${praefix} Kaufphase: ${ergebnis.body.reason ?? ergebnis.body.run?.status} (skipped=${ergebnis.body.skipped}) Käufe=${ergebnis.body.run?.transferBuysApplied}`);
      const nach = get().gameState;
      phasen[`${praefix}_01_nach_kaufphase`] = {
        snap: snap(nach), transfers: transfers(nach, sid, transferBeginn),
        lauf: ergebnis.body.run, sumKasseVor: sumVor, phase: nach.gamePhase,
      };
      schreibe();
    }
    const mdIds = get().gameState.season.matchdayIds;
    const ersterIdx = RESUME && saison === startSaison ? Math.max(0, mdIds.indexOf(get().gameState.matchdayState.matchdayId)) : 0;
    if (ersterIdx > 0 && !phasen[`${praefix}_02_saisonstart`]) {
      // Fortsetzung mitten in der Saison: Saisonstart-Stand = Stand nach dem Draft (zwischen Draft und Spieltag 1 laeuft keine Buchung).
      phasen[`${praefix}_02_saisonstart`] = { snap: (phasen["s1_01_nach_draft"] as { snap: unknown }).snap, seasonId: sid, hinweis: "aus s1_01_nach_draft uebernommen (Wiederaufnahme)" };
      phasen[`${praefix}_02b_wiederaufnahme_stand`] = { snap: snap(get().gameState), naechsterSpieltagIndex: ersterIdx };
    } else if (!(RESUME && saison === startSaison && phasen[`${praefix}_02_saisonstart`])) {
      phasen[`${praefix}_02_saisonstart`] = { snap: snap(get().gameState), seasonId: sid };
    }
    schreibe();
    if (STOP_AFTER === "kaufphase" && saison === 2) { log("stop-after kaufphase erreicht"); break; }

    // Spieltage
    const md = get().gameState.season.matchdayIds.length;
    const kasseJeSpieltag: Record<string, number[]> = {};
    const ts = Date.now();
    for (let i = ersterIdx; i < md; i += 1) {
      const cur = get();
      const matchdayId = cur.gameState.matchdayState.matchdayId;
      const lauf = await runLocalMatchdayAutoRun(
        { saveId, seasonId: sid, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
          options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false } },
        persistence,
      );
      if (!lauf.ok) { log(`${matchdayId} blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`); break; }
      const adv = await executeMatchdayAdvance({ saveId, seasonId: sid, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence);
      if (!adv.ok || !adv.applied) { log(`Wechsel blockiert: ${adv.blockingReasons.join(" | ")}`); break; }
      for (const t of get().gameState.teams) (kasseJeSpieltag[t.teamId] ??= []).push(r2(t.cash));
      if ((i + 1) % 5 === 0) log(`${praefix} Spieltag ${i + 1}/${md} (${((Date.now() - ts) / 1000).toFixed(0)}s)`);
    }
    const vorAbschluss = get().gameState;
    phasen[`${praefix}_03_nach_spieltagen`] = {
      snap: snap(vorAbschluss), kasseJeSpieltag,
      sponsorEvents: (vorAbschluss.seasonState.sponsorEvents ?? []).filter((e) => (e as { seasonId?: string }).seasonId === sid || true).length,
    };
    schreibe();

    // Saisonabschluss
    const comp = await runLocalSeasonCompletion(
      { saveId, seasonId: sid, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN }, persistence);
    log(`${praefix} Saisonabschluss: ok=${comp.ok} applied=${comp.applied} ${comp.blockingReasons?.join("|") ?? ""}`);
    const hops: { von: string; nach: string; sumKasse: number }[] = [];
    const nachComp = get().gameState;
    phasen[`${praefix}_04_nach_abschluss`] = { snap: snap(nachComp), phase: nachComp.gamePhase, guv: guvSnapshot(nachComp) };
    schreibe();
    // Saisonende-Kette
    for (let hop = 1; hop <= 12; hop += 1) {
      const aktuell = get();
      if (!isSeasonEndPhase(aktuell.gameState.gamePhase)) break;
      const von = String(buildSeasonTransitionPreview(aktuell).transition.currentStep);
      const erg = await advanceSeasonTransitionStep(aktuell, persistence);
      if (!erg.applied) { log(`${praefix} Kette haelt bei ${von}: ${erg.blockingReasons.join(",")}`); break; }
      const g = get().gameState;
      hops.push({ von, nach: String(erg.transition.currentStep), sumKasse: r2(g.teams.reduce((s, t) => s + t.cash, 0)) });
      log(`${praefix} Kette ${von} -> ${erg.transition.currentStep}, Phase ${g.gamePhase}`);
      phasen[`${praefix}_05_kette_${hop}_${von}`] = { snap: snap(g), phase: g.gamePhase, season: g.season.id };
    }
    const ende = get().gameState;
    phasen[`${praefix}_06_ende_kette`] = {
      snap: snap(ende), hops, phase: ende.gamePhase, seasonId: ende.season.id,
      transfers: transfers(ende, sid, transferBeginn),
    };
    schreibe();

    if (saison < SEASONS && ende.season.id === sid) {
      // Wechsel in die neue Saison, falls die Kette ihn nicht schon gemacht hat
      const { applyPreSeasonNextSeasonSetupLightweight, buildPreSeasonNextSeasonSetupToken } = await import("@/lib/season/preseason-workflow-service");
      const tok = buildPreSeasonNextSeasonSetupToken(get()).confirmToken;
      const s = applyPreSeasonNextSeasonSetupLightweight(get(), tok, persistence);
      log(`${praefix} Saisonwechsel: applied=${s.applied} ${s.blockingReasons?.join("|") ?? ""}`);
      if (!s.applied) break;
      phasen[`${praefix}_07_nach_saisonwechsel`] = { snap: snap(get().gameState), season: get().gameState.season.id };
      schreibe();
    }
    if (get().gameState.season.id === sid && saison < SEASONS) { log("Saison hat nicht gewechselt, Abbruch"); break; }
  }

  (run as Record<string, unknown>).fertig = new Date().toISOString();
  run.laufzeitSekunden = ((run.laufzeitSekunden as number | undefined) ?? 0) + Math.round((Date.now() - t0) / 1000);
  schreibe();
  log(`fertig, ${run.laufzeitSekunden}s (dieser Abschnitt ${Math.round((Date.now() - t0) / 1000)}s)`);
  if (!arg("keep", "")) for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${process.env.OLY_APP_SQLITE_PATH}${suffix}`, { force: true });
  void path;
}

main().catch((e) => { console.error(e); process.exit(1); });

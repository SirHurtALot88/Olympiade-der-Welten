/**
 * MESSLAUF „SPIELERENTWICKLUNG BALANCIEREN" (Chris, 22.11., docs/design/entwicklung-balance-22-11.md).
 *
 * Wie `miss-training-je-spieltag.ts` (Wegwerf-SQLite, 32 KI-Teams von Anfang an, Liga-Draft der Pick-Engine, echte Arena-Spieltage),
 * aber ueber MEHRERE Saisons und mit den Kennzahlen der Abnahme je Spieler und Saison:
 *   Liga-Mittel der Netto-Summe aller 12 Attribute, Anteile stark besser / kaum veraendert / stark schlechter,
 *   Anteil „verdient" (PP je Einsatz ueber dem Median UND Trainingsziel gehalten) unter den stark Verbesserten.
 *
 *   OLY_APP_SQLITE_PATH=lauf.sqlite npx tsx scripts/miss-entwicklung.ts --von-anlage <saveId> --saisons 5 --out lauf.json
 *
 * Optionen: --saisons N (Standard 1), --spieltage N (je Saison, Standard alle), --keep, --nur-abschluss (Saison ist schon
 * gespielt: nur Abschluss + Kette, mit --start-json <datei> fuer den Saisonstart), --stop-vor-abschluss (spielt die Saison und
 * haelt vor dem Abschluss an; SQLite + Start-JSON bleiben fuer wiederholte Abschluesse liegen).
 * Schwellen der Verteilung: STARK = Summe >= +8 bzw. <= -8, KAUM = |Summe| <= 2 (Begruendung in der Doku).
 */
import fs from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { advanceSeasonTransitionStep, buildSeasonTransitionPreview } from "@/lib/season/season-transition-service";
import { applyPreSeasonNextSeasonSetupLightweight, buildPreSeasonNextSeasonSetupToken } from "@/lib/season/preseason-workflow-service";
import { runLocalSeasonCompletion, SEASON_COMPLETION_CONFIRM_TOKEN } from "@/lib/season/season-completion-service";
import { chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";
import { ppTagesIndex } from "@/lib/training/entwicklung-tag";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const OUT = arg("out", "");
const VON_ANLAGE = arg("von-anlage", "");
const SAISONS = Number(arg("saisons", "1")) || 1;
const SPIELTAGE = Number(arg("spieltage", "0")) || 0;
const START_JSON = arg("start-json", "");
const t0 = Date.now();
const log = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s] ${msg}`);
const r2 = (v: number) => Math.round(v * 100) / 100;

const STARK = 8;
const KAUM = 2;

type Zeile = {
  id: string;
  team: string;
  start: number;
  vorAbschluss: number;
  nach: number;
  netto: number;
  training: number;
  pp: number;
  einsaetze: number;
  ppEinsatz: number | null;
  halten: boolean;
  /** Anteil des meistgewaehlten Trainingsziels an den Trainingstagen mit Ziel (0..1). */
  dominanz: number;
  trainingstage: number;
  ausfall: number;
  /** Aenderung der Summe der zwoelf Attribut-Decken ueber das Saisonende (Potentialdrift). */
  deckeDelta: number | null;
  /** Aenderung der Decken allein durch die Drift (Stand nach dem Saisonabschluss, vor der Progression). */
  deckeDrift: number | null;
  /** Aenderung des verdeckten Potentialwerts ueber das Saisonende. */
  potDelta: number | null;
  /** Herkunft der Saisonend-Rechnung aus dem Progressions-Ereignis: Training (Rest + Korrektur), Nebenwirkung, Leistung, Abbau. */
  evT: number;
  evS: number;
  evP: number;
  evR: number;
  /** Runde 2: Summen der je Spieltag gebuchten Teile (Training z, Leistung p mit Vorzeichen, Abbau a) und die Teile von p. */
  sumZ: number;
  sumP: number;
  sumPPlus: number;
  sumPMinus: number;
  sumA: number;
  diligent: boolean;
  /** Messfall Bank (`--bank`): zusaetzlich verpflichteter Spieler, der vorwiegend auf der Bank sitzt. */
  bank?: boolean;
  /** Je Spieltag der Saison (Reihenfolge `matchdayIds`): gebuchtes Training, Abbau und PP-Abstand zum Liga-Median (null = kein Einsatz) -- fuer die Offline-Eichung. */
  tagZ?: number[];
  tagA?: number[];
  tagAbstand?: Array<number | null>;
  tagVerletzt?: boolean[];
};

function potWerte(gs: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rec of gs.playerPotential ?? []) if (typeof rec.hiddenPotentialScore === "number") out[rec.playerId] = rec.hiddenPotentialScore;
  return out;
}

function deckenSummen(gs: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rec of gs.playerPotential ?? []) {
    const c = rec.hiddenAttributeCeiling;
    if (!c) continue;
    let s = 0;
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) s += Number(c[a] ?? 0);
    out[rec.playerId] = s;
  }
  return out;
}

function kaderIds(gs: GameState): Map<string, string> {
  return new Map(gs.rosters.map((r) => [r.playerId, r.teamId] as const));
}

function startSnapshot(gs: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  const index = new Map(gs.players.map((p) => [p.id, p] as const));
  for (const id of kaderIds(gs).keys()) {
    const p = index.get(id);
    if (!p?.attributeSheetStats) continue;
    let s = 0;
    let ok = true;
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
      const v = Number(p.attributeSheetStats[a]);
      if (!Number.isFinite(v)) { ok = false; break; }
      s += v;
    }
    if (ok) out[id] = s;
  }
  return out;
}

/** PP, Einsaetze und Trainingsziel-Halten je Spieler vor dem Saisonabschluss. */
function leistungsDaten(gs: GameState) {
  const ledger = buildSeasonPointsLedger(gs, gs.season.id);
  const pp = new Map<string, number>();
  const einsaetze = new Map<string, number>();
  for (const e of ledger.pointEntries as unknown as Array<{ playerId: string; basePoints?: number }>) {
    pp.set(e.playerId, (pp.get(e.playerId) ?? 0) + Number(e.basePoints ?? 0));
    einsaetze.set(e.playerId, (einsaetze.get(e.playerId) ?? 0) + 1);
  }
  const verlauf = new Map<string, { halten: boolean; dominanz: number; tage: number; ausfall: number; training: number; p: number; pPlus: number; pMinus: number; a: number }>();
  for (const p of gs.players) {
    const akku = p.seasonTrainingAccumulator;
    if (!akku || akku.seasonId !== gs.season.id) continue;
    const zeilen = akku.verlauf ?? [];
    const trainiert = zeilen.filter((z) => z.s === "t");
    const jeZiel = new Map<string, number>();
    for (const z of trainiert) if (z.d) jeZiel.set(z.d, (jeZiel.get(z.d) ?? 0) + 1);
    const mitZiel = [...jeZiel.values()].reduce((a, b) => a + b, 0);
    const haupt = Math.max(0, ...jeZiel.values());
    const training = trainiert.reduce((s, z) => s + Object.values(z.z ?? {}).reduce((a, b) => a + (b as number), 0), 0);
    let sumP = 0;
    let sumPPlus = 0;
    let sumPMinus = 0;
    let sumA = 0;
    for (const z of trainiert) {
      for (const w of Object.values(z.p ?? {})) { sumP += w as number; if ((w as number) > 0) sumPPlus += w as number; else sumPMinus += w as number; }
      for (const w of Object.values(z.a ?? {})) sumA += w as number;
    }
    verlauf.set(p.id, {
      p: sumP, pPlus: sumPPlus, pMinus: sumPMinus, a: sumA,
      halten: mitZiel >= 12 && haupt / Math.max(1, mitZiel) >= 0.6,
      dominanz: r2(haupt / Math.max(1, mitZiel)),
      tage: trainiert.length,
      ausfall: zeilen.filter((z) => z.s === "v").length,
      training,
    });
  }
  return { pp, einsaetze, verlauf };
}

function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function kennzahlen(zeilen: Zeile[]) {
  const n = zeilen.length;
  const anteil = (f: (z: Zeile) => boolean) => (n ? r2((zeilen.filter(f).length / n) * 100) : 0);
  const mitEinsatz = zeilen.filter((z) => z.ppEinsatz != null && z.einsaetze >= 4).map((z) => z.ppEinsatz as number);
  const medianPp = median(mitEinsatz);
  const stark = zeilen.filter((z) => z.netto >= STARK);
  const verdient = (z: Zeile) => medianPp != null && z.ppEinsatz != null && z.ppEinsatz > medianPp && z.halten;
  return {
    spieler: n,
    mittel: r2(zeilen.reduce((a, z) => a + z.netto, 0) / Math.max(1, n)),
    median: r2(median(zeilen.map((z) => z.netto)) ?? 0),
    starkBesserPct: anteil((z) => z.netto >= STARK),
    starkSchlechterPct: anteil((z) => z.netto <= -STARK),
    kaumPct: anteil((z) => Math.abs(z.netto) <= KAUM),
    leichtBesserPct: anteil((z) => z.netto > KAUM && z.netto < STARK),
    leichtSchlechterPct: anteil((z) => z.netto < -KAUM && z.netto > -STARK),
    medianPpEinsatz: medianPp != null ? r2(medianPp) : null,
    starkBesserVerdientPct: stark.length ? r2((stark.filter(verdient).length / stark.length) * 100) : null,
    starkBesserN: stark.length,
    trainingMittel: r2(zeilen.reduce((a, z) => a + z.training, 0) / Math.max(1, n)),
    leistungMittel: r2(zeilen.reduce((a, z) => a + z.sumP, 0) / Math.max(1, n)),
    leistungPlusMittel: r2(zeilen.reduce((a, z) => a + z.sumPPlus, 0) / Math.max(1, n)),
    leistungMinusMittel: r2(zeilen.reduce((a, z) => a + z.sumPMinus, 0) / Math.max(1, n)),
    abbauMittel: r2(zeilen.reduce((a, z) => a + z.sumA, 0) / Math.max(1, n)),
    // Anteil Training an den Zuwaechsen (Training / (Training + positive Leistung)); Chris: 60 / 40.
    trainingsAnteilPct: r2((zeilen.reduce((a, z) => a + z.sumZ, 0) / Math.max(1e-9, zeilen.reduce((a, z) => a + z.sumZ + z.sumPPlus, 0))) * 100),
    potDeltaMittel: r2(zeilen.reduce((a, z) => a + (z.potDelta ?? 0), 0) / Math.max(1, zeilen.filter((z) => z.potDelta != null).length)),
    deckeDriftMittel: r2(zeilen.reduce((a, z) => a + (z.deckeDrift ?? 0), 0) / Math.max(1, zeilen.filter((z) => z.deckeDrift != null).length)),
    deckeDeltaMittel: r2(zeilen.reduce((a, z) => a + (z.deckeDelta ?? 0), 0) / Math.max(1, zeilen.filter((z) => z.deckeDelta != null).length)),
  };
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
    await fuehreLigaSetupDraftAus({ persistence, saveId, seasonId: kiState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[miss-entwicklung]" });
    log(`Save ${saveId}: 32 KI-Teams, Kader ${persistence.getSaveById(saveId)!.gameState.rosters.length}`);
    if (flag("nur-anlage")) { console.log(`SAVE_ID=${saveId}`); return; }
  }
  const get = () => persistence.getSaveById(saveId)!;
  // MESSFALL BANK (`--bank K [--bank-teams N]`): N Teams (Standard 8) bekommen K zusaetzliche Spieler (aus den Freien, nach Staerke
  // knapp unter dem eigenen Kader), die ueber den Kader hinaus mittrainieren, aber kaum aufgestellt werden.
  const bankIds = new Set<string>();
  const bankK = Number(arg("bank", "0")) || 0;
  if (bankK > 0 && !flag("nur-abschluss")) {
    const gs0 = get().gameState;
    const imKader = new Set(gs0.rosters.map((r) => r.playerId));
    const frei = gs0.players.filter((p) => !imKader.has(p.id) && p.attributeSheetStats && (gs0.playerPotential ?? []).some((e) => e.playerId === p.id)).sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
    const teamIds = [...new Set(gs0.rosters.map((r) => r.teamId))].sort().slice(0, Number(arg("bank-teams", "8")) || 8);
    const neueRoster = [...gs0.rosters];
    for (const teamId of teamIds) {
      const eigene = gs0.rosters.filter((r) => r.teamId === teamId);
      const werte = eigene.map((r) => gs0.players.find((p) => p.id === r.playerId)?.rating ?? 0).sort((a, b) => a - b);
      const ziel = werte[Math.min(2, werte.length - 1)] ?? 0;
      for (let k = 0; k < bankK; k += 1) {
        let besterIdx = 0;
        for (let i = 0; i < frei.length; i += 1) if (Math.abs((frei[i]!.rating ?? 0) - ziel) < Math.abs((frei[besterIdx]!.rating ?? 0) - ziel)) besterIdx = i;
        const p = frei.splice(besterIdx, 1)[0];
        if (!p) break;
        bankIds.add(p.id);
        neueRoster.push({ ...eigene[0]!, id: `roster-bank-${p.id}`, playerId: p.id, teamId });
      }
    }
    persistence.saveSingleplayerState(saveId, { ...gs0, rosters: neueRoster });
    log(`Bank: ${bankIds.size} Zusatzspieler bei ${teamIds.length} Teams`);
  }
  const ergebnis: { saveId: string; schalter: Record<string, string | undefined>; saisons: Array<{ saison: string; kennzahlen: ReturnType<typeof kennzahlen> & { ertragNachAbstand?: Record<string, { n: number; mittel: number }> }; zeilen: Zeile[] }> } = {
    saveId,
    schalter: { OLY_ENTWICKLUNG: process.env.OLY_ENTWICKLUNG, OLY_TRAINING_JE_SPIELTAG_FAKTOR: process.env.OLY_TRAINING_JE_SPIELTAG_FAKTOR },
    saisons: [],
  };
  const schreibe = () => OUT && fs.writeFileSync(OUT, JSON.stringify(ergebnis));

  if (flag("erst-naechste-saison")) {
    // Ein Lauf, der nach der Saisonend-Progression stehen blieb (vorheriger Aufruf mit --keep): zuerst die neue Saison anlegen.
    const latest = get();
    const setup = buildPreSeasonNextSeasonSetupToken(latest);
    const next = applyPreSeasonNextSeasonSetupLightweight(latest, setup.confirmToken, persistence);
    if (!next.applied) throw new Error(`Naechste Saison blockiert: ${next.blockingReasons.join(" | ")}`);
    log(`Neue Saison ${get().gameState.season.id}`);
  }
  for (let k = 0; k < SAISONS; k += 1) {
    const sid = get().gameState.season.id;
    let start: Record<string, number>;
    if (flag("nur-abschluss") && START_JSON) start = JSON.parse(fs.readFileSync(START_JSON, "utf8")) as Record<string, number>;
    else {
      start = startSnapshot(get().gameState);
      if (START_JSON) fs.writeFileSync(START_JSON, JSON.stringify(start));
    }
    if (!flag("nur-abschluss")) {
      const md = get().gameState.season.matchdayIds.length;
      const bis = SPIELTAGE > 0 ? Math.min(md, SPIELTAGE) : md;
      for (let i = 0; i < bis; i += 1) {
        const ts = Date.now();
        const matchdayId = get().gameState.matchdayState.matchdayId;
        const run = await runLocalMatchdayAutoRun(
          { saveId, seasonId: sid, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
            options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false } },
          persistence,
        );
        if (!run.ok) throw new Error(`${matchdayId} blockiert: ${run.blockingReasons.slice(0, 3).join(" | ")}`);
        const adv = await executeMatchdayAdvance({ saveId, seasonId: sid, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence);
        if (!adv.ok || !adv.applied) throw new Error(`Wechsel blockiert: ${adv.blockingReasons.join(" | ")}`);
        log(`${sid} Spieltag ${i + 1}/${bis} (${((Date.now() - ts) / 1000).toFixed(0)}s)`);
      }
      if (flag("stop-vor-abschluss")) { log("Stop vor Abschluss (SQLite bleibt)"); return; }
    }
    const regelArg = arg("regel", "");
    if (regelArg === "neu" || regelArg === "alt") {
      // Messhebel: Stempel der laufenden Saison setzen (ein vor dem 22.11. angelegter Stand traegt "alt").
      const gs0 = get().gameState;
      persistence.saveSingleplayerState(saveId, { ...gs0, seasonState: { ...gs0.seasonState, entwicklungsRegel: { seasonId: sid, regel: regelArg } } });
    }
    const vor = get().gameState;
    const daten = leistungsDaten(vor);
    const vorSumme = startSnapshot(vor);
    const tagesIndex = ppTagesIndex(vor);
    const tagIds = vor.season.matchdayIds ?? [];
    const deckeVor = deckenSummen(vor);
    const potVor = potWerte(vor);
    const team = kaderIds(vor);

    const comp = await runLocalSeasonCompletion(
      { saveId, seasonId: sid, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN }, persistence);
    log(`Saisonabschluss ${sid}: ok=${comp.ok} applied=${comp.applied}`);
    const deckeNachAbschluss = deckenSummen(get().gameState);
    let fertig = false;
    for (let hop = 1; hop <= 12 && !fertig; hop += 1) {
      const aktuell = get();
      if (!isSeasonEndPhase(aktuell.gameState.gamePhase)) break;
      const von = String(buildSeasonTransitionPreview(aktuell).transition.currentStep);
      const erg = await advanceSeasonTransitionStep(aktuell, persistence);
      log(`Kette ${von} -> ${erg.transition.currentStep} (${erg.applied ? "ok" : erg.blockingReasons.join(",")})`);
      if (!erg.applied) break;
      fertig = (get().gameState.playerProgressionEvents ?? []).some((e) => e.seasonId === sid && e.source === "organic_season_progression");
    }
    if (!fertig) log("Hinweis: kein Progressions-Ereignis (Regel neu bucht am Saisonende keine Attribute mehr)");
    // Abnehmende Ertraege: Mittel der Aenderung je Attribut ueber die Saison nach Abstand zur Decke (Stand Saisonstart).
    const abstandsTabelle: Record<string, { n: number; summe: number }> = {};
    {
      const nachStand = new Map(get().gameState.players.map((p) => [p.id, p] as const));
      const decken = new Map((vor.playerPotential ?? []).map((r) => [r.playerId, r.hiddenAttributeCeiling] as const));
      for (const p of vor.players) {
        const akku = p.seasonTrainingAccumulator;
        const nach = nachStand.get(p.id);
        const deckeP = decken.get(p.id);
        if (!akku || akku.seasonId !== sid || !akku.startAttribute || !nach?.attributeSheetStats || !deckeP || !team.has(p.id)) continue;
        for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
          const v0: number = Number((akku.startAttribute as Record<string, number>)[a]);
          const v1 = Number(nach.attributeSheetStats[a]);
          const c = Number(deckeP[a]);
          if (!Number.isFinite(v0) || !Number.isFinite(v1) || !Number.isFinite(c)) continue;
          const h: number = c - v0;
          const eimer = h <= 2 ? "a: <=2" : h <= 5 ? "b: 2-5" : h <= 10 ? "c: 5-10" : h <= 20 ? "d: 10-20" : "e: >20";
          const z = (abstandsTabelle[eimer] ??= { n: 0, summe: 0 });
          z.n += 1;
          z.summe += v1 - v0;
        }
      }
    }
    const nachSumme = startSnapshot(get().gameState);
    const deckeNach = deckenSummen(get().gameState);
    const potNach = potWerte(get().gameState);
    const zeilen: Zeile[] = [];
    const herkunft = new Map<string, { t: number; s: number; p: number; r: number }>();
    for (const e of get().gameState.playerProgressionEvents ?? []) {
      if (e.seasonId !== sid || e.source !== "organic_season_progression") continue;
      const h = { t: 0, s: 0, p: 0, r: 0 };
      for (const u of e.upgrades ?? []) {
        h.t += Number(u.originTraining ?? 0); h.s += Number(u.originSpillover ?? 0);
        h.p += Number(u.originPerformance ?? 0); h.r += Number(u.originRegression ?? 0);
      }
      herkunft.set(e.playerId, h);
    }
    for (const [id, s0] of Object.entries(start)) {
      const nach = nachSumme[id];
      if (nach == null || !team.has(id)) continue;
      const einsaetze = daten.einsaetze.get(id) ?? 0;
      const pp = daten.pp.get(id) ?? 0;
      const v = daten.verlauf.get(id);
      zeilen.push({
        id, team: team.get(id)!, start: r2(s0), vorAbschluss: r2(vorSumme[id] ?? s0), nach: r2(nach), netto: r2(nach - s0),
        training: r2(v?.training ?? 0), pp: r2(pp), einsaetze, ppEinsatz: einsaetze > 0 ? r2(pp / einsaetze) : null,
        halten: v?.halten ?? false, dominanz: v?.dominanz ?? 0, trainingstage: v?.tage ?? 0, ausfall: v?.ausfall ?? 0,
        deckeDrift: deckeVor[id] != null && deckeNachAbschluss[id] != null ? r2(deckeNachAbschluss[id]! - deckeVor[id]!) : null,
        deckeDelta: deckeVor[id] != null && deckeNach[id] != null ? r2(deckeNach[id]! - deckeVor[id]!) : null,
        evT: r2(herkunft.get(id)?.t ?? 0), evS: r2(herkunft.get(id)?.s ?? 0), evP: r2(herkunft.get(id)?.p ?? 0), evR: r2(herkunft.get(id)?.r ?? 0),
        potDelta: potVor[id] != null && potNach[id] != null ? r2(potNach[id]! - potVor[id]!) : null,
        sumZ: r2(v?.training ?? 0), sumP: r2(v?.p ?? 0), sumPPlus: r2(v?.pPlus ?? 0), sumPMinus: r2(v?.pMinus ?? 0), sumA: r2(v?.a ?? 0),
        bank: bankIds.has(id),
        diligent: Boolean(vor.players.find((p) => p.id === id)?.traitsPositive?.some((t) => String(t).toLowerCase() === "diligent")),
        ...(flag("tage")
          ? (() => {
              const akku = vor.players.find((p) => p.id === id)?.seasonTrainingAccumulator;
              const jeTag = new Map((akku?.verlauf ?? []).map((e) => [e.m, e] as const));
              return {
                tagZ: tagIds.map((m) => Math.round(Object.values(jeTag.get(m)?.z ?? {}).reduce((a, b) => a + (b as number), 0) * 1000) / 1000),
                tagA: tagIds.map((m) => Math.round(Object.values(jeTag.get(m)?.a ?? {}).reduce((a, b) => a + (b as number), 0) * 1000) / 1000),
                tagVerletzt: tagIds.map((m) => jeTag.get(m)?.s === "v"),
                tagAbstand: tagIds.map((m) => {
                  const t = tagesIndex.tage.get(m);
                  const z = t?.spieler.get(id);
                  return z && t ? r2(z.pp - (t.median.get(z.liga) ?? 0)) : null;
                }),
              };
            })()
          : {}),
      });
    }
    const kz = { ...kennzahlen(zeilen), ertragNachAbstand: Object.fromEntries(Object.entries(abstandsTabelle).sort().map(([k, v]) => [k, { n: v.n, mittel: r2(v.summe / v.n) }])) };
    ergebnis.saisons.push({ saison: sid, kennzahlen: kz, zeilen });
    schreibe();
    log(`${sid}: ${JSON.stringify(kz)}`);
    if (k + 1 < SAISONS) {
      const latest = get();
      const setup = buildPreSeasonNextSeasonSetupToken(latest);
      const next = applyPreSeasonNextSeasonSetupLightweight(latest, setup.confirmToken, persistence);
      if (!next.applied) throw new Error(`Naechste Saison blockiert: ${next.blockingReasons.join(" | ")}`);
      log(`Neue Saison ${get().gameState.season.id}`);
    }
  }
  log("fertig");
  if (!flag("keep")) for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${process.env.OLY_APP_SQLITE_PATH}${suffix}`, { force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });

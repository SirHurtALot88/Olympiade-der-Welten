/**
 * KI-PICK-ANALYSE (18.11.): wie pickt die KI im Saison-1-Draft, wo endet sie, spiegeln die Kader die Teamidentität?
 *
 * Auftrag Chris (18.11.): „wenn ein spieler nicht selber pickt soll SINNVOLL gepickt werden als wäre das team richtig AI
 * gesteuert, das soll nicht über so einen NOTFALL weg fahren! … man soll aus ALLEN knapp 3k spielern picken können …
 * und die team identitäten widerspiegelt und man nicht nur minimum picks hat mit einem star drin".
 *
 * Reine Messung auf einer WEGWERF-SQLite (`OLY_APP_SQLITE_PATH`), nie auf dem echten Store:
 *
 *   1) Anlage:   OLY_APP_SQLITE_PATH=/tmp/x.sqlite npx tsx scripts/miss-ki-pick-analyse-18-11.ts --anlage
 *                -> neues Spiel (solo_1, Battle), alle 32 Teams KI mit Sponsor, druckt SAVE_ID, SQLite bleibt liegen
 *   2) Messung:  cp x.sqlite y.sqlite; OLY_APP_SQLITE_PATH=y.sqlite npx tsx ... --von-anlage <saveId>
 *                  --draft block|einzelschritt|keiner --out data/generated/<datei>.json
 *
 * Was je Lauf gemessen wird:
 *   - Pool: Spieler im Spielstand, freie Spieler, kaufbare (Marktwert > 0), Preisverteilung, Brackets.
 *   - Vor dem Draft je Team: Identitaet (Finanzwert, Ambition, Opt, Vorstand, Achsen), GM-Archetyp und Bias, Kasse,
 *     Ruecklage, Opt-Ziel, Superstar-Lizenz, Themen-Strenge.
 *   - SOLO-PLAN je Team: der Plan der KI, als duerfte das Team als ERSTES aus dem vollen Pool waehlen (reiner
 *     In-Memory-Lauf des Greedy-Loops `organicBuyStep`), mit Abbruchgrund (stop / nothing_affordable / roster_full).
 *     Trennt „was die Logik will" von „was der Pool hergibt".
 *   - BLOCK-SIMULATION (bei --draft block): derselbe Blocklauf in Spielstand-Reihenfolge rein im Speicher, mit
 *     Abbruchgrund je Team, und Abgleich gegen den echten Lauf (Treffer-Quote der Spieler).
 *   - Nach dem echten Draft je Team: Kader, Stufen (Superstar/Star/Core/Depth/Backup/Reserve nach Marktwert),
 *     Star-Anteil am Kaderwert, Kasse, Kasse ueber der Ruecklage, Gehalt, Kaderstaerke (Top-6 Ø 20 Disziplinen),
 *     beim Einzelschritt die Ausstiegsgruende und Notkaeufe.
 *
 * Auswertung: `scripts/auswerte-ki-pick-analyse-18-11.mjs`.
 */
import fs from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getLeagueOf } from "@/lib/season/league-split";
import { buildOrganicDraftFrame, toOrganicPlayerView } from "@/lib/ai/organic-squad/draft-adapter";
import { applyOrganicBuyStep, createOrganicPlanStepState, organicBuyStep } from "@/lib/ai/organic-squad/draft-builder";
import { buildLeagueMarketBrackets, classifyMarketBracket } from "@/lib/ai/market-pick-engine/market-brackets";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { buildTeamThemeCompositionRuntimeContext } from "@/lib/ai/team-theme-composition-service";
import { kaderStaerkeFuerReihenfolge } from "@/lib/draft/liga-draft-modell";
import { laufeKiZuege, starteLigaDraft } from "@/lib/draft/liga-draft-dienst";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const ANLAGE = process.argv.includes("--anlage");
const VON_ANLAGE = arg("von-anlage", "");
const DRAFT = arg("draft", "block") as "block" | "einzelschritt" | "keiner";
const OUT = arg("out", "");
const LABEL = arg("label", "");

const t0 = Date.now();
const log = (msg: string) => console.error(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s] ${msg}`);
const r2 = (v: number) => Math.round(v * 100) / 100;

function preisVon(p: Player): number {
  return Math.max(0, p.marketValue ?? p.displayMarketValue ?? 0);
}
function quantil(werte: number[], q: number): number {
  if (werte.length === 0) return 0;
  const s = [...werte].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))));
  return s[i]!;
}
function freieSpieler(gs: GameState): Player[] {
  const vergeben = new Set(gs.rosters.map((r) => r.playerId));
  return gs.players.filter((p) => !vergeben.has(p.id));
}

type StopArt = "buy" | "stop" | "roster_full" | "nothing_affordable";

/**
 * Greedy-Loop eines Teams rein im Speicher (dieselben drei Schritt-Funktionen wie `buildOrganicSquadPlan`), mit dem
 * Abbruchgrund. `gs` ist der Stand, den das Team bei seinem Zug sieht.
 */
function planeTeam(gs: GameState, saveId: string, team: Team) {
  const spielerById = new Map(gs.players.map((p) => [p.id, p]));
  const startKader = gs.rosters
    .filter((r) => r.teamId === team.teamId)
    .map((r) => spielerById.get(r.playerId))
    .filter((p): p is Player => p != null);
  const frame = buildOrganicDraftFrame({
    gameState: gs,
    team,
    identity: gs.teamIdentities.find((i) => i.teamId === team.teamId),
    startingSquad: startKader,
    candidates: freieSpieler(gs),
    draftSeed: `${saveId}:${team.teamId}`,
  });
  const schritt = createOrganicPlanStepState(frame.planInput);
  const picks: string[] = [];
  let art: StopArt = "buy";
  let letzterStop: number | null = null;
  let letzterBest: number | null = null;
  for (let i = 0; i < 20; i += 1) {
    const e = organicBuyStep(frame.planInput, schritt);
    art = e.kind;
    letzterStop = e.stopUtility;
    letzterBest = Number.isFinite(e.bestUtility) ? e.bestUtility : null;
    if (e.kind !== "buy" || !e.best) break;
    applyOrganicBuyStep(frame.planInput, schritt, e.best);
    picks.push(e.best.playerId);
  }
  return {
    picks,
    abbruch: art,
    stopNutzen: letzterStop == null ? null : r2(letzterStop),
    besterKaufNutzen: letzterBest == null ? null : r2(letzterBest),
    kasseEnde: r2(schritt.cash),
    optTarget: frame.optTarget,
    ruecklage: r2(frame.ruecklage),
    cashBuffer: r2(frame.planInput.economy.cashBuffer),
    solvencyFloor: r2(frame.planInput.economy.solvencyFloor ?? 0),
    superstarLizenz: frame.superstarLizenz,
    komposition: frame.planInput.composition?.counts ?? null,
    gewichte: frame.planInput.economy.weights,
    poolGroesse: frame.planInput.candidates.length,
  };
}

/** Kauf im Speicher nachbilden (Kader + Kasse), damit das naechste Team den Stand sieht wie im echten Blocklauf. */
function kaufeImSpeicher(gs: GameState, teamId: string, playerIds: string[]): GameState {
  const spielerById = new Map(gs.players.map((p) => [p.id, p]));
  let kosten = 0;
  const neu = playerIds.map((playerId, i) => {
    const p = spielerById.get(playerId)!;
    kosten += preisVon(p);
    return {
      id: `sim-${teamId}-${i}-${playerId}`,
      teamId,
      playerId,
      contractLength: 2,
      salary: Math.max(0, p.salaryDemand ?? p.displaySalary ?? 0),
    } as GameState["rosters"][number];
  });
  return {
    ...gs,
    rosters: [...gs.rosters, ...neu],
    teams: gs.teams.map((t) => (t.teamId === teamId ? { ...t, cash: (t.cash ?? 0) - kosten } : t)),
  };
}

function teamStammdaten(gs: GameState, team: Team) {
  const id = gs.teamIdentities.find((i) => i.teamId === team.teamId);
  const gm = getTeamGeneralManager(gs, team.teamId)?.profile ?? null;
  const theme = buildTeamThemeCompositionRuntimeContext(gs, team);
  return {
    teamId: team.teamId,
    liga: getLeagueOf(gs, team.teamId),
    startKasse: r2(team.cash ?? 0),
    identitaet: {
      finances: id?.finances ?? null,
      ambition: id?.ambition ?? null,
      boardConfidence: id?.boardConfidence ?? null,
      harmony: id?.harmony ?? null,
      playerOpt: id?.playerOpt ?? null,
      playerMin: (id as { playerMin?: number } | undefined)?.playerMin ?? null,
      pow: id?.pow ?? null,
      spe: id?.spe ?? null,
      men: id?.men ?? null,
      soc: id?.soc ?? null,
    },
    gm: gm
      ? {
          archetype: gm.archetype,
          starPriority: gm.bias?.starPriority ?? null,
          valuePriority: gm.bias?.valuePriority ?? null,
          cashPriority: gm.bias?.cashPriority ?? null,
          riskTolerance: gm.bias?.riskTolerance ?? null,
          rosterDepthPreference: gm.bias?.rosterDepthPreference ?? null,
          eliteSmallRosterPreference: gm.bias?.eliteSmallRosterPreference ?? null,
        }
      : null,
    themaStrenge: theme.target?.strictness ?? null,
  };
}

function kaderBild(gs: GameState, teamId: string, brackets: ReturnType<typeof buildLeagueMarketBrackets>) {
  const spielerById = new Map(gs.players.map((p) => [p.id, p]));
  const kader = gs.rosters
    .filter((r) => r.teamId === teamId)
    .map((r) => spielerById.get(r.playerId))
    .filter((p): p is Player => p != null);
  const mws = kader.map(preisVon).sort((a, b) => b - a);
  const stufen: Record<string, number> = { Superstar: 0, Star: 0, Core: 0, Depth: 0, Backup: 0, Reserve: 0 };
  for (const mw of mws) stufen[classifyMarketBracket(mw, brackets)] += 1;
  const summe = mws.reduce((a, b) => a + b, 0);
  const team = gs.teams.find((t) => t.teamId === teamId)!;
  return {
    kader: kader.length,
    stufen,
    marktwertSumme: r2(summe),
    top1Anteil: summe > 0 ? r2((mws[0] ?? 0) / summe) : 0,
    top2Anteil: summe > 0 ? r2(((mws[0] ?? 0) + (mws[1] ?? 0)) / summe) : 0,
    mwMax: r2(mws[0] ?? 0),
    mwMedian: r2(quantil(mws, 0.5)),
    mwMin: r2(mws[mws.length - 1] ?? 0),
    gehalt: r2(kader.reduce((s, p) => s + Math.max(0, p.salaryDemand ?? p.displaySalary ?? 0), 0)),
    kasse: r2(team.cash ?? 0),
    staerke: r2(kaderStaerkeFuerReihenfolge(gs, teamId)),
    spieler: kader.map((p) => p.id),
  };
}

async function main() {
  if (!process.env.OLY_APP_SQLITE_PATH) throw new Error("OLY_APP_SQLITE_PATH (Wegwerf-Datei!) setzen.");
  if (process.env.OLY_APP_SQLITE_PATH.includes("data/persistence")) throw new Error("Nie auf den echten Store messen.");
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();

  if (ANLAGE) {
    const input = { presetId: "solo_1" as const, gameMode: "battle" as const, sandbox: true };
    const preview = previewNewGameSetup(input);
    const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
    const saveId = angelegt.save.saveId;
    const kiState = chooseSponsorOfferForAiTeams(
      applyGameModeOwnership(persistence.getSaveById(saveId)!.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
    );
    persistence.saveSingleplayerState(saveId, kiState);
    console.log(`SAVE_ID=${saveId}`);
    return;
  }
  if (!VON_ANLAGE) throw new Error("--anlage oder --von-anlage <saveId>");
  const saveId = VON_ANLAGE;
  const gs0 = persistence.getSaveById(saveId)?.gameState;
  if (!gs0) throw new Error(`Save ${saveId} fehlt`);

  // ---- Pool ----
  const frei0 = freieSpieler(gs0);
  const preise = frei0.map(preisVon);
  const kaufbar = preise.filter((p) => p > 0);
  const brackets = buildLeagueMarketBrackets(kaufbar);
  const stufenPool: Record<string, number> = { Superstar: 0, Star: 0, Core: 0, Depth: 0, Backup: 0, Reserve: 0 };
  for (const p of kaufbar) stufenPool[classifyMarketBracket(p, brackets)] += 1;
  const minKasse = Math.min(...gs0.teams.map((t) => t.cash ?? 0));
  const pool = {
    spielerImSpielstand: gs0.players.length,
    frei: frei0.length,
    kaufbarMwGroesser0: kaufbar.length,
    mwNull: preise.length - kaufbar.length,
    preis: { min: r2(Math.min(...kaufbar)), p10: r2(quantil(kaufbar, 0.1)), p25: r2(quantil(kaufbar, 0.25)), median: r2(quantil(kaufbar, 0.5)), p75: r2(quantil(kaufbar, 0.75)), p90: r2(quantil(kaufbar, 0.9)), p97: r2(quantil(kaufbar, 0.97)), max: r2(Math.max(...kaufbar)) },
    stufen: stufenPool,
    brackets: Object.fromEntries(Object.entries(brackets).map(([k, v]) => [k, v.floorMw])),
    billigste8Summe: r2([...kaufbar].sort((a, b) => a - b).slice(0, 8).reduce((a, b) => a + b, 0)),
    leistbarFuerAermstesTeam: kaufbar.filter((p) => p <= minKasse).length,
    aermsteKasse: r2(minKasse),
    kassenSumme: r2(gs0.teams.reduce((s, t) => s + (t.cash ?? 0), 0)),
    poolWertSumme: r2(kaufbar.reduce((a, b) => a + b, 0)),
  };
  log(`Pool: ${pool.spielerImSpielstand} Spieler, frei ${pool.frei}, kaufbar ${pool.kaufbarMwGroesser0}`);

  // ---- Stammdaten + Solo-Plan je Team ----
  const teams: Record<string, Record<string, unknown>> = {};
  for (const team of gs0.teams) {
    const solo = planeTeam(gs0, saveId, team);
    const soloStand = kaufeImSpeicher(gs0, team.teamId, solo.picks);
    teams[team.teamId] = {
      ...teamStammdaten(gs0, team),
      solo: { ...solo, bild: { ...kaderBild(soloStand, team.teamId, brackets), spieler: undefined } },
    };
  }
  log("Solo-Plaene fertig");

  // ---- Block-Simulation (Spielstand-Reihenfolge, wie orderTeamsForDraft ohne Tabelle) ----
  let simulation: Record<string, unknown> | null = null;
  if (DRAFT === "block") {
    let gsSim = gs0;
    // Wie `orderTeamsForDraft` (ai-picks-run-service.ts): hoechster Startrang (= schwaechstes Team) zuerst, ohne Rang hinten.
    const rang = (teamId: string) => gs0.seasonState.standings?.[teamId]?.rank ?? null;
    const reihenfolge = gs0.teams
      .map((t, i) => ({ teamId: t.teamId, i, r: rang(t.teamId) }))
      .sort((a, b) => (a.r != null && b.r != null && a.r !== b.r ? b.r - a.r : a.r != null && b.r == null ? -1 : a.r == null && b.r != null ? 1 : a.i - b.i))
      .map((e) => e.teamId);
    const jeTeam: Record<string, unknown> = {};
    reihenfolge.forEach((teamId, platz) => {
      const team = gsSim.teams.find((t) => t.teamId === teamId)!;
      const plan = planeTeam(gsSim, saveId, team);
      gsSim = kaufeImSpeicher(gsSim, teamId, plan.picks);
      jeTeam[teamId] = { platz: platz + 1, ...plan };
    });
    simulation = { reihenfolge, jeTeam };
    log("Block-Simulation fertig");
  }

  // ---- echter Draft ----
  const draftStart = Date.now();
  let einzelschritt: Record<string, unknown> | null = null;
  if (DRAFT === "block") {
    const dr = await fuehreLigaSetupDraftAus({
      persistence, saveId, seasonId: gs0.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[ki-pick-analyse]",
    });
    log(`Blocklauf: ${dr.status}`);
  } else if (DRAFT === "einzelschritt") {
    starteLigaDraft({ persistence, saveId });
    let halt = "max_picks";
    let zuege = 0;
    while (halt === "max_picks") {
      const s = laufeKiZuege({ persistence, saveId, maxPicks: 8 });
      zuege += s.eintraege.length;
      halt = s.halt;
    }
    const d = persistence.getSaveById(saveId)!.gameState.seasonState.ligaDraft!;
    const grundZaehler: Record<string, number> = {};
    for (const e of d.verlauf) {
      const k = `${e.art}:${e.grund ?? "-"}`;
      grundZaehler[k] = (grundZaehler[k] ?? 0) + 1;
    }
    einzelschritt = {
      zuege,
      halt,
      status: d.status,
      runden: d.runde,
      grundZaehler,
      jeTeam: Object.fromEntries(
        Object.entries(d.teams).map(([teamId, t]) => [
          teamId,
          {
            fertigGrund: t.fertigGrund,
            picks: t.picks,
            platzRunde1: d.verlauf.find((e) => e.runde === 1 && e.teamId === teamId)?.platz ?? null,
            notkaeufe: d.verlauf.filter((e) => e.teamId === teamId && e.grund === "notkauf_mindestkader").length,
            nachruecker: d.verlauf.filter((e) => e.teamId === teamId && e.grund === "platz_1_nicht_kaufbar").length,
          },
        ]),
      ),
    };
    log(`Einzelschritt: ${zuege} Zuege, ${halt}`);
  }
  const draftMs = Date.now() - draftStart;

  const gs1 = persistence.getSaveById(saveId)!.gameState;
  for (const team of gs1.teams) {
    const bild = kaderBild(gs1, team.teamId, brackets);
    const eintrag = teams[team.teamId]!;
    const ruecklage = (eintrag.solo as { ruecklage: number }).ruecklage;
    eintrag.nachDraft = { ...bild, kasseUeberRuecklage: r2(bild.kasse - ruecklage), kasseAnteilStart: r2(bild.kasse / Math.max(1, eintrag.startKasse as number)) };
    if (simulation) {
      const sim = (simulation.jeTeam as Record<string, { picks: string[] }>)[team.teamId]!;
      const echt = new Set(bild.spieler);
      eintrag.simTreffer = { sim: sim.picks.length, echt: echt.size, gleich: sim.picks.filter((id) => echt.has(id)).length };
    }
  }

  const ergebnis = {
    label: LABEL,
    saveId,
    draft: DRAFT,
    draftMs,
    pool,
    simulation: simulation ? { reihenfolge: simulation.reihenfolge, jeTeam: Object.fromEntries(Object.entries(simulation.jeTeam as Record<string, Record<string, unknown>>).map(([k, v]) => [k, { ...v, picks: undefined, pickZahl: (v.picks as string[]).length }])) } : null,
    einzelschritt,
    teams,
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("OLY_"))),
  };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(ergebnis, null, 1));
  log(`fertig (${(draftMs / 1000).toFixed(0)} s Draft)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

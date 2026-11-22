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
 * FINANZKONZEPT V2, STUFE 0 (18.11., Chris): Mess- und Testlaeufe laufen von Anfang an mit 32 KI-Teams.
 * Das neue Spiel braucht technisch mindestens ein Chris-Team (`new_game_requires_at_least_one_chris_team`);
 * deshalb wird M-M DIREKT NACH DER ANLAGE auf KI gestellt und bekommt seinen Sponsor, BEVOR der Draft laeuft
 * (frueher: Umschaltung nach dem Draft, M-M blieb ohne Sponsor — Messartefakt, siehe
 * docs/design/ki-kaufverhalten-analyse-18-11.md Abschnitt 5). Pro Schnappschuss kommen dazu: Kaderstaerke
 * (Top-6-Eignung je Disziplin), Finanzwert, Vorstandsvertrauen, Sponsor-Anker, der Kontoauszug je Team
 * (`lib/finance/kontoauszug.ts`, nur aus vorhandenen Ledgern) und je Spieltag die Kasse.
 *
 * PAARWEISER A/B-VERGLEICH (gleiche Spielstand-Basis, nur der Code/Schalter unterscheidet sich):
 *   1) Basis anlegen:   ... --nur-anlage --out basis.json --keep     (druckt die saveId, SQLite bleibt liegen)
 *   2) SQLite kopieren: cp basis.sqlite lauf-vorher.sqlite; cp basis.sqlite lauf-nachher.sqlite
 *   3) Je Kopie:        OLY_APP_SQLITE_PATH=lauf-vorher.sqlite OLY_KI_RUECKLAGE_V2=0 OLY_KI_FORECAST_SPONSOR=0 \
 *                         OLY_VORSTAND_BUDGET=0 npx tsx scripts/miss-teamfinanzen-saison.ts --von-anlage <saveId> ...
 *                       OLY_APP_SQLITE_PATH=lauf-nachher.sqlite npx tsx ... --von-anlage <saveId> ...
 *
 * Aufruf (Wegwerf-Datei!):
 *   OLY_APP_SQLITE_PATH=/pfad/wegwerf.sqlite npx tsx scripts/miss-teamfinanzen-saison.ts \
 *     [--mode battle|manager] [--seasons 2] [--out data/generated/lauf.json] [--label A]
 *     [--stop-after draft|vorkauf|kaufphase] [--nur-anlage] [--von-anlage <saveId>] [--draft block|einzelschritt]
 *
 * `--draft einzelschritt` (Draft-Neubau, 18.11.): statt des Blocklaufs (`fuehreLigaSetupDraftAus`) laeuft der neue
 * Liga-Draft Pick fuer Pick (`starteLigaDraft` + `laufeKiZuege`, ein Schreibvorgang je Pick wie ueber die Route).
 * Paarweiser Vergleich alt gegen neu: docs/design/draft-neubau-kern-18-11.md, Auswertung
 * `scripts/auswerte-liga-draft-alt-neu.ts`.
 *
 * Das Auswerteskript (Tabellen + Doku) liegt in `scripts/auswerte-teamfinanzen-saison.ts`.
 */
import fs from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { KERN_VERKAUF_LOG } from "@/lib/ai/organic-squad/draft-adapter";
import { fuehreKiPreseasonLaufAus } from "@/lib/ai/ai-preseason-background-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamFacilityUpkeepTotal, getTeamActualSalaryTotal, getTeamNegotiatedSalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getTeamAnnualLoanInstallment, getTeamAnnualLoanInterest, getTeamOutstandingDebt } from "@/lib/finance/loan-service";
import { buildSeasonGuv } from "@/lib/finance/season-end-guv";
import { resolveSeasonGuvPartsByTeam } from "@/lib/finance/season-guv-resolver";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
import { buildKontoauszuege } from "@/lib/finance/kontoauszug";
import { stempleFinanzenJeSpieltagBeimAnlegen } from "@/lib/finance/finanzen-je-spieltag";
import { berechneVorstandBudgetStand, SPERRE_ZAEHLER } from "@/lib/finance/vorstand-budgetfreigabe";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { laufeKiZuege, starteLigaDraft } from "@/lib/draft/liga-draft-dienst";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { baueNachkaufSitzung, ermittleKiTeamIds } from "@/lib/ai/organischer-nachkauf-eingabe";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
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
/** "kaufphase": nach der Kaufphase von Saison 2 (und dem Saisonstart-Schnappschuss) aufhoeren.
 *  "spieltage": nach den Spieltagen von Saison 1, vor dem Saisonabschluss (Basis fuer den Saisonwechsel-Vergleich). */
const STOP_AFTER = arg("stop-after", "");
/** Nur das Spiel anlegen (32 KI, Sponsoren signiert), kein Draft: Basis fuer paarweise A/B-Laeufe. */
const NUR_ANLAGE = process.argv.includes("--nur-anlage");
/** Vorhandene (kopierte) Anlage-SQLite weiterverwenden: saveId, ab dem Draft laufen. */
const VON_ANLAGE = arg("von-anlage", "");
/** "einzelschritt" (Standard seit 22.11., wie die App: Liga-Draft Pick fuer Pick) oder "block" (alter Hintergrund-Draft; setzt seit Befund 9 dieselbe Roster-Kennung `draftPickS1`). */
const DRAFT_ART = arg("draft", "einzelschritt") as "block" | "einzelschritt";

/**
 * S1-KADERBAU-VARIANTEN (18.11., Messung "S1 ohne Draft"):
 *   A  (Standard) Block-Draft wie live: fuehreLigaSetupDraftAus -> runAiPicksExecutePreview.
 *   C  "normal einkaufen": derselbe Dienst wie der Saison-Kaufphase-Lauf der KI (preseason-background,
 *      Season-Market-Modus): applyAiMarketPlanLocally, nur auf leeren S1-Kadern.
 *   C2 "normal einkaufen, organisch": runTransferWindowSession (Phase preseason, derselbe Planer wie der Draft,
 *      aber in der Kauffenster-Sitzung: Zyklen/Ligarunden) -- der Weg, den Skripte/Saisonuebergang nehmen.
 * --mischen <zahl>: vor dem Kaderbau werden die Teams im State mit dieser Saat gemischt (Erstzugriffs-Effekt).
 */
const VARIANTE = arg("variante", "A") as "A" | "C" | "C2";
const MISCHEN = arg("mischen", "");

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
  /** Finanzkonzept V2: Finanzwert (Team-Matrix 1 bis 10), Ambition, Vorstandsvertrauen (1 bis 10), Sponsor-Anker. */
  finanzwert: number | null;
  ambition: number | null;
  vertrauen: number | null;
  sponsorAnker: number | null;
  hatSponsor: boolean;
  /** Kaderstaerke: Mittel der Top-6-Eignung je Disziplin (fehlende Plaetze zaehlen 0). */
  staerke: number;
};

/**
 * Finanzseite (18.11.): Vorstand-Statistik je Team und Liga — Stand der zwei Toepfe, „Alles auf eine Karte“, Umschichten,
 * Ruecklage anzapfen, und wie oft die harte Sperre gegriffen hat (nur mit `OLY_SPERRE_ZAEHLEN=1`, Zaehler = abgelehnte Pruefungen).
 */
function vorstandStatistik(gs: GameState) {
  const jeTeam = gs.teams.map((t) => {
    const st = berechneVorstandBudgetStand(gs, t.teamId);
    const z = st.zustand;
    return {
      teamId: t.teamId,
      stufe: st.stufe,
      anteil: st.anteil,
      wirksamerAnteil: st.wirksamerAnteil,
      gedeckelt: st.gedeckelt,
      transferGesamt: st.investition.gesamt,
      transferAusgegeben: st.investition.ausgegeben,
      transferFrei: st.investition.frei,
      gebaeudeAusgegeben: st.gebaeudeAusgegeben,
      gehaltGesamt: st.gehalt.gesamt,
      gehaltAusgegeben: st.gehalt.ausgegeben,
      gehaltFrei: st.gehalt.frei,
      alleAufEineKarte: z.alleAufEineKarte ? { quelle: z.alleAufEineKarte.quelle, zielRang: z.alleAufEineKarte.zielRang, erwartungsRang: z.alleAufEineKarte.erwartungsRang } : null,
      umschichtung: z.umschichtung,
      ruecklageAngezapft: z.ruecklageAngezapft,
      lockerungAktiv: st.lockerung.aktiv,
    };
  });
  const zaehle = (art: keyof typeof SPERRE_ZAEHLER) => ({
    pruefungen: Object.values(SPERRE_ZAEHLER[art]).reduce((a, b) => a + b, 0),
    teams: Object.keys(SPERRE_ZAEHLER[art]).length,
    jeTeam: { ...SPERRE_ZAEHLER[art] },
  });
  return {
    jeTeam,
    sperre: { kauf: zaehle("kauf"), kaufGehalt: zaehle("kauf_gehalt"), gebaeude: zaehle("gebaeude"), verlaengerung: zaehle("verlaengerung") },
    alleAufEineKarte: jeTeam.filter((t) => t.alleAufEineKarte).length,
    umgeschichtet: jeTeam.filter((t) => Math.abs(t.umschichtung) > 0.004).length,
    angezapft: jeTeam.filter((t) => t.ruecklageAngezapft > 0.004).length,
    gelockert: jeTeam.filter((t) => t.lockerungAktiv).length,
  };
}

const STAERKE_TOP_N = 6;

/** Top-6-Eignung je Disziplin und Team; liefert je Team das Mittel ueber alle Disziplinen und je Disziplin die Werte. */
function kaderStaerke(gs: GameState): { jeTeam: Record<string, number>; jeTeamDisziplin: Record<string, Record<string, number>> } {
  const spieler = new Map(gs.players.map((p) => [p.id, p] as const));
  const disziplinen = (gs.disciplines ?? []).map((d) => d.id);
  const rostersJeTeam = new Map<string, string[]>();
  for (const r of gs.rosters) (rostersJeTeam.get(r.teamId) ?? rostersJeTeam.set(r.teamId, []).get(r.teamId)!).push(r.playerId);
  const jeTeam: Record<string, number> = {};
  const jeTeamDisziplin: Record<string, Record<string, number>> = {};
  for (const t of gs.teams) {
    const ids = rostersJeTeam.get(t.teamId) ?? [];
    const werte: Record<string, number> = {};
    let summe = 0;
    for (const d of disziplinen) {
      const eig = ids
        .map((id) => spieler.get(id)?.disciplineRatings?.[d] ?? 0)
        .sort((a, b) => b - a)
        .slice(0, STAERKE_TOP_N);
      while (eig.length < STAERKE_TOP_N) eig.push(0);
      const m = eig.reduce((x, y) => x + y, 0) / STAERKE_TOP_N;
      werte[d] = r2(m);
      summe += m;
    }
    jeTeam[t.teamId] = r2(summe / Math.max(1, disziplinen.length));
    jeTeamDisziplin[t.teamId] = werte;
  }
  return { jeTeam, jeTeamDisziplin };
}

function snap(gs: GameState): Record<string, TeamSnap> {
  const staerke = kaderStaerke(gs);
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
      finanzwert: gs.teamIdentities.find((i) => i.teamId === t.teamId)?.finances ?? null,
      ambition: gs.teamIdentities.find((i) => i.teamId === t.teamId)?.ambition ?? null,
      vertrauen: gs.seasonState.boardConfidence?.[t.teamId]?.value ?? null,
      sponsorAnker: (() => { const a = getSponsorV3Terms(getTeamSponsorContract(gs, t.teamId))?.anchor; return typeof a === "number" ? r2(a) : null; })(),
      hatSponsor: getTeamSponsorContract(gs, t.teamId) != null,
      staerke: staerke.jeTeam[t.teamId] ?? 0,
    };
  }
  return out;
}

/**
 * Abdeckung der Disziplinen je Team (Draft-Messung alt gegen neu): wie viele Disziplinen mindestens einen bzw. drei
 * „solide“ Spieler (Eignung > 60, `SOLIDE_THRESHOLD` der KI) haben, und die schwaechste Top-6-Staerke.
 */
function abdeckung(gs: GameState) {
  const spieler = new Map(gs.players.map((p) => [p.id, p] as const));
  const disziplinen = (gs.disciplines ?? []).map((d) => d.id);
  const out: Record<string, { mitEinem: number; mitDrei: number; schwaechsteTop6: number; schwaechsteDisziplin: string | null }> = {};
  const top6 = kaderStaerke(gs).jeTeamDisziplin;
  for (const t of gs.teams) {
    const ids = gs.rosters.filter((r) => r.teamId === t.teamId).map((r) => r.playerId);
    let mitEinem = 0;
    let mitDrei = 0;
    for (const d of disziplinen) {
      const solide = ids.filter((id) => (spieler.get(id)?.disciplineRatings?.[d] ?? 0) > 60).length;
      if (solide >= 1) mitEinem += 1;
      if (solide >= 3) mitDrei += 1;
    }
    const werte = Object.entries(top6[t.teamId] ?? {}).sort((a, b) => a[1] - b[1]);
    out[t.teamId] = { mitEinem, mitDrei, schwaechsteTop6: werte[0]?.[1] ?? 0, schwaechsteDisziplin: werte[0]?.[0] ?? null };
  }
  return out;
}

/** Je Disziplin die Top-6-Eignung aller Teams (fuer Median und unterstes Viertel in der Auswertung). */
function staerkeDetail(gs: GameState) {
  return kaderStaerke(gs).jeTeamDisziplin;
}

/** Kontoauszug-Summen je Team und Art, nur Saison `sid` (Stufe 0: aus vorhandenen Ledgern). */
function kontoauszugSummen(gs: GameState, sid: string) {
  const out: Record<string, { saldo: number; jeArt: Record<string, number>; zeilen: number }> = {};
  for (const [teamId, k] of buildKontoauszuege(gs, sid).entries()) {
    out[teamId] = { saldo: k.saldo, jeArt: k.jeArt as Record<string, number>, zeilen: k.zeilen.length };
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
  if (!RESUME && !VON_ANLAGE) for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${process.env.OLY_APP_SQLITE_PATH}${suffix}`, { force: true });
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();

  let saveId: string;
  let run: Record<string, unknown>;
  if (VON_ANLAGE) {
    saveId = VON_ANLAGE;
    const g0 = persistence.getSaveById(saveId)?.gameState;
    if (!g0) throw new Error(`Save ${saveId} nicht in der SQLite (Basis-Kopie?)`);
    run = { label: LABEL, mode: MODE, saveId, gestartet: new Date().toISOString(), spieltageProSaison: g0.season.matchdayIds.length, phasen: {}, vonAnlage: true };
    log(`Start von Anlage ${saveId}`);
  } else if (RESUME) {
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
    // 32 KI-Teams VON ANFANG AN: M-M (das technisch noetige Chris-Team) sofort auf KI, Sponsor nachholen.
    const kiState = chooseSponsorOfferForAiTeams(
      applyGameModeOwnership(persistence.getSaveById(saveId)!.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
    );
    persistence.saveSingleplayerState(saveId, kiState);
    const ohneSponsor = kiState.teams.filter((t) => getTeamSponsorContract(kiState, t.teamId) == null).map((t) => t.teamId);
    if (ohneSponsor.length > 0) throw new Error(`Teams ohne Sponsor vor dem Draft: ${ohneSponsor.join(",")}`);
    log(`32 KI-Teams, alle mit Sponsor`);
    if (NUR_ANLAGE) {
      run = { label: LABEL, mode: MODE, saveId, gestartet: new Date().toISOString(), phasen: {} };
      console.log(`SAVE_ID=${saveId}`);
      if (OUT) fs.writeFileSync(OUT, JSON.stringify(run));
      return;
    }
    run = { label: LABEL, mode: MODE, saveId, gestartet: new Date().toISOString(), spieltageProSaison: persistence.getSaveById(saveId)!.gameState.season.matchdayIds.length, phasen: {} };
  }
  const get = () => persistence.getSaveById(saveId)!;
  // FINANZEN JE SPIELTAG (22.11.): fuer den paarweisen A/B-Lauf desselben Draft-Standes wird der Saison-Stempel gesetzt
  // ("an") oder entfernt ("aus"). Fuer "aus" zusaetzlich OLY_FINANZEN_JE_SPIELTAG=aus setzen, damit auch der Saisonwechsel
  // alt bleibt. Ohne Schalter bleibt der Stempel, den die Anlage gesetzt hat.
  const finanzenStempel = arg("finanzen-stempel", "");
  if (finanzenStempel) {
    const g = get().gameState;
    const ohne = { ...g, seasonState: { ...g.seasonState, finanzenJeSpieltag: null } };
    persistence.saveSingleplayerState(saveId, finanzenStempel === "an" ? stempleFinanzenJeSpieltagBeimAnlegen(ohne) : ohne);
    log(`Finanzen je Spieltag: Stempel ${finanzenStempel}`);
  }
  const phasen = run.phasen as Record<string, unknown>;
  const schreibe = () => {
    run.kernVerkaeufe = [...KERN_VERKAUF_LOG];
    if (OUT) fs.writeFileSync(OUT, JSON.stringify(run));
  };
  const finish = () => {
    run.fertig = new Date().toISOString();
    run.laufzeitSekunden = ((run.laufzeitSekunden as number | undefined) ?? 0) + Math.round((Date.now() - t0) / 1000);
    schreibe();
    log(`fertig, ${run.laufzeitSekunden}s`);
    if (!process.argv.includes("--keep")) for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${process.env.OLY_APP_SQLITE_PATH}${suffix}`, { force: true });
  };
  const seasonId1 = get().gameState.season.id;
  let gs: GameState;
  if (!RESUME) {
    phasen["s1_00_nach_anlage"] = { snap: snap(get().gameState) };
    // 1) Pick-Engine / Liga-Draft
    if (MISCHEN) {
      const g = get().gameState;
      let z = Number(MISCHEN) >>> 0 || 1;
      const rnd = () => { z = (Math.imul(z, 1664525) + 1013904223) >>> 0; return z / 4294967296; };
      const teams = [...g.teams];
      for (let i = teams.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [teams[i], teams[j]] = [teams[j]!, teams[i]!]; }
      persistence.saveSingleplayerState(saveId, { ...g, teams });
      log(`Teams gemischt (Saat ${MISCHEN})`);
    }
    run.variante = VARIANTE;
    run.reihenfolge = get().gameState.teams.map((t) => t.teamId);
    let drStatus = "n/a";
    const draftStart = Date.now();
    if (VARIANTE === "A" && DRAFT_ART === "einzelschritt") {
      // Variante A mit dem Liga-Draft im Einzelschritt (#1619): ein Schreibvorgang je Zug wie ueber die Route.
      starteLigaDraft({ persistence, saveId });
      let halt = "max_picks";
      let zuege = 0;
      while (halt === "max_picks") {
        const schritt = laufeKiZuege({ persistence, saveId, maxPicks: 1 });
        zuege += schritt.eintraege.length;
        halt = schritt.halt;
      }
      drStatus = `Einzelschritt ${zuege} Zuege, Halt ${halt}`;
      run.draftZuege = zuege;
    } else if (VARIANTE === "A") {
      const dr = await fuehreLigaSetupDraftAus({
        persistence, saveId, seasonId: seasonId1, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[miss-finanzen]",
      });
      drStatus = dr.status;
    } else if (VARIANTE === "C") {
      const erg = await applyAiMarketPlanLocally({
        source: "sqlite", saveId, seasonId: seasonId1, teamScope: "ai", dryRun: false, includeWarningTeams: false,
        confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN, transferPhase: LOCAL_TRANSFER_WINDOW_PHASE,
        options: { includeWarningTeams: false, stopOnTeamFailure: false, applySellSteps: false },
      });
      drStatus = `applyAiMarketPlanLocally ${erg.results.length} Ergebnisse`;
      run.cWarnungen = (erg as { warnings?: string[] }).warnings?.slice(0, 20);
      // Warum bleiben Teams leer? Ergebnisart und haeufigste Blockadegruende je Team zaehlen.
      const art: Record<string, number> = {};
      const gruende: Record<string, number> = {};
      for (const r of erg.results as Array<{ result?: string; blockingReasons?: string[] }>) {
        art[r.result ?? "?"] = (art[r.result ?? "?"] ?? 0) + 1;
        for (const b of new Set(r.blockingReasons ?? [])) gruende[b] = (gruende[b] ?? 0) + 1;
      }
      run.cErgebnisArten = art;
      run.cBlockadegruende = Object.fromEntries(Object.entries(gruende).sort((x, y) => y[1] - x[1]).slice(0, 15));
    } else {
      const g = get().gameState;
      const sess = await runTransferWindowSession(baueNachkaufSitzung({ saveId, seasonId: seasonId1, persistence, kiTeamIds: ermittleKiTeamIds(g) }));
      drStatus = `runTransferWindowSession Kaeufe=${sess.appliedBuys}`;
      run.cWarnungen = sess.warnings.slice(0, 20);
    }
    const dr = { status: drStatus };
    log(`Kaderbau ${VARIANTE}: ${dr.status}`);
    run.draftArt = VARIANTE === "A" ? DRAFT_ART : null;
    run.draftLaufzeitMs = Date.now() - draftStart;
    log(`Kaderbau-Laufzeit ${(Number(run.draftLaufzeitMs) / 1000).toFixed(1)}s`);
    gs = get().gameState;
    run.draftAbdeckung = abdeckung(gs);
    run.ligaDraft = gs.seasonState.ligaDraft
      ? {
          status: gs.seasonState.ligaDraft.status,
          runden: gs.seasonState.ligaDraft.runde,
          teams: Object.fromEntries(Object.values(gs.seasonState.ligaDraft.teams).map((t) => [t.teamId, { picks: t.picks, grund: t.fertigGrund }])),
          verlauf: gs.seasonState.ligaDraft.verlauf.map((e) => [e.runde, e.platz, e.teamId, e.art, e.playerId, e.abloese]),
        }
      : null;
    run.teamCount = gs.teams.length;
    run.ligaAssignment = Object.fromEntries(gs.teams.map((t) => [t.teamId, getLeagueOf(gs, t.teamId)]));
    phasen["s1_01_nach_draft"] = { snap: snap(gs), staerkeDetail: staerkeDetail(gs), transfers: transfers(gs, "*", 0) };
    log(`Nach Draft: Σ Kasse ${r2(gs.teams.reduce((s, t) => s + t.cash, 0))}, Kader Ø ${r2(gs.rosters.length / gs.teams.length)}`);
    schreibe();
    if (STOP_AFTER === "draft") { log("stop-after draft erreicht"); finish(); return; }
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
      if (STOP_AFTER === "vorkauf") { schreibe(); log("stop-after vorkauf erreicht (SQLite mit --keep aufheben, dann je Variante --resume <saveId> --start-season 2)"); finish(); return; }
      const ergebnis = await fuehreKiPreseasonLaufAus({ saveId, seasonId: sid, scope: { room: null, participant: null, activeOwnerId: null }, persistence });
      log(`${praefix} Kaufphase: ${ergebnis.body.reason ?? ergebnis.body.run?.status} (skipped=${ergebnis.body.skipped}) Käufe=${ergebnis.body.run?.transferBuysApplied}`);
      const nach = get().gameState;
      phasen[`${praefix}_01_nach_kaufphase`] = {
        snap: snap(nach), staerkeDetail: staerkeDetail(nach), transfers: transfers(nach, sid, transferBeginn),
        lauf: ergebnis.body.run, sumKasseVor: sumVor, phase: nach.gamePhase, vorstand: vorstandStatistik(nach),
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
    // Chris 22.11.: gleichzeitig verletzte Spieler je Team und Spieltag (Verletzt/Genesend laut Verfuegbarkeitsstand) - Entscheidung, ob 14 als Kadergrenze reicht.
    const verletztJeSpieltag: Record<string, number[]> = {};
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
      {
        const g = get().gameState;
        const roster = new Set(g.rosters.map((r) => `${r.teamId}|${r.playerId}`));
        const je: Record<string, number> = {};
        for (const a of g.seasonState.playerAvailabilityState ?? []) {
          if ((a.injuryStatus === "injured" || a.injuryStatus === "recovering") && roster.has(`${a.teamId}|${a.playerId}`)) je[a.teamId] = (je[a.teamId] ?? 0) + 1;
        }
        for (const t of g.teams) (verletztJeSpieltag[t.teamId] ??= []).push(je[t.teamId] ?? 0);
      }
      if ((i + 1) % 5 === 0) log(`${praefix} Spieltag ${i + 1}/${md} (${((Date.now() - ts) / 1000).toFixed(0)}s)`);
    }
    const vorAbschluss = get().gameState;
    phasen[`${praefix}_03_nach_spieltagen`] = {
      snap: snap(vorAbschluss), kasseJeSpieltag, verletztJeSpieltag,
      sponsorEvents: (vorAbschluss.seasonState.sponsorEvents ?? []).filter((e) => (e as { seasonId?: string }).seasonId === sid || true).length,
    };
    schreibe();
    // Basis fuer paarweise Vergleiche des Saisonwechsels (Transferfenster, `scripts/miss-transferfenster-gemeinsam.ts`):
    // nach den Spieltagen von Saison 1 aufhoeren, vor Abschluss und Saisonende-Kette.
    if (STOP_AFTER === "spieltage" && saison === 1) { log("stop-after spieltage erreicht"); finish(); return; }

    // Saisonabschluss
    const comp = await runLocalSeasonCompletion(
      { saveId, seasonId: sid, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN }, persistence);
    log(`${praefix} Saisonabschluss: ok=${comp.ok} applied=${comp.applied} ${comp.blockingReasons?.join("|") ?? ""}`);
    const hops: { von: string; nach: string; sumKasse: number }[] = [];
    const nachComp = get().gameState;
    phasen[`${praefix}_04_nach_abschluss`] = { snap: snap(nachComp), phase: nachComp.gamePhase, guv: guvSnapshot(nachComp), kontoauszug: kontoauszugSummen(nachComp, sid) };
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
      phasen[`${praefix}_07_nach_saisonwechsel`] = { snap: snap(get().gameState), season: get().gameState.season.id, finanzenJeSpieltag: get().gameState.seasonState.finanzenJeSpieltag ?? null };
      schreibe();
    }
    if (get().gameState.season.id === sid && saison < SEASONS) { log("Saison hat nicht gewechselt, Abbruch"); break; }
  }

  finish();
}

main().catch((e) => { console.error(e); process.exit(1); });

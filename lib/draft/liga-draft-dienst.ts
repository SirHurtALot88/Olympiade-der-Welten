/**
 * LIGA-DRAFT IM EINZELSCHRITT — der Dienst: Draft anlegen, KI-Picks fahren, Mensch-Picks buchen, Auslassen, Fertig,
 * Ueberspringen (A/B), Auto-Pick. Draft-Neubau, Stufe Kern (18.11.); Schnittstelle in
 * docs/design/draft-neubau-kern-18-11.md.
 *
 * KEINE ZWEITE KAUFLOGIK. Jeder Pick laeuft ueber `executeLocalTransfermarktBuy` — die KI mit derselben Quelle
 * `ai_roster_fill` wie der Blocklauf (`runOrganicTeamDraftExecute`), der Mensch mit `manual_transfermarkt_buy` wie die
 * Kauf-Route. Die KI-Bewertung ist die organische aus dem Blocklauf (`liga-draft-ki.ts`). Neu ist nur die Reihenfolge.
 *
 * SCHREIBEN: jede Aktion liest den Spielstand frisch, rechnet synchron (keine Unterbrechung zwischen Lesen und
 * Schreiben im selben Prozess) und schreibt Kauf UND Draft-Zustand in EINEM Schreibvorgang
 * (`flushLocalTransfermarktRunContext`). Trifft ein Schreibvorgang den Koop-Riegel, gilt dieselbe Antwort wie im
 * Blocklauf: frisch lesen, nochmal.
 *
 * Seit der Abnahme 19.11. ist dieser Draft der Standard fuer neue Ligen; `OLY_LIGA_DRAFT_MODUS=block` ist der Rueckweg.
 */
import { meldeHintergrundArbeit } from "@/lib/hintergrund/hintergrund-arbeit";
import { istKaderplanAktiv } from "@/lib/ai/organic-squad/draft-adapter";
import { getNextWishlistPriorityRank } from "@/lib/scouting/scouting-wishlist-slots";
import { syncWishlistToScoutingWatchlist } from "@/lib/scouting/scouting-watchlist-service";
import type {
  ContractShape,
  TransferWishlistEntry,
  GameState,
  LeagueSetupTeamWarning,
  LigaDraftFertigGrund,
  LigaDraftTeamZustand,
  LigaDraftZustand,
} from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import type { TransfermarktBuyExecuteResult } from "@/lib/market/transfermarkt-buy-service";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  flushLocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { getTransferWindowStatus } from "@/lib/market/transfer-window-policy";
import { ROSTER_MAX } from "@/lib/ai/organic-squad/types";
import { istKoopSchreibkonflikt } from "@/lib/persistence/koop-schreibkonflikt";
import {
  bricheLigaDraftAb,
  bucheAuslassen,
  bucheAusstieg,
  bucheDraftPick,
  bucheUeberspringen,
  darfAuslassen,
  erzeugeLigaDraft,
  setzeAutoPick,
  waehleKiPlatz,
  werIstDran,
  wartetAufStartWahl,
} from "@/lib/draft/liga-draft-modell";
import { bewerteKiPick, freieSpieler, superstarLizenzZuDraftBeginn, type LigaDraftKiBewertung } from "@/lib/draft/liga-draft-ki";

/**
 * DRAFT-VERTRAG: genau 1 Saison (Chris 19.11.: „im DRAFT also NUR im draft mode, werden alle spieler 1 jahres verträge bekommen
 * und werden direkt gepickt zu den konditionen die angegeben sind, also gehalt und marktwert“). Gilt fuer JEDEN Pick des
 * Liga-Drafts (Mensch, KI, Auto-Pick, Nachzug) und wird NUR hier gesetzt — normale Transfermarkt-Kaeufe, auch „Selbst kaufen“
 * nach dem Draft und spaetere Transferfenster, behalten ihre Laufzeit. Gehalt = angezeigte Forderung, Abloese = Marktwert.
 */
export const LIGA_DRAFT_VERTRAGSLAUFZEIT = 1;

type RunContext = ReturnType<typeof createLocalTransfermarktRunContext>;

export { istEinzelschrittDraftAktiv, ligaDraftLaeuft, ligaDraftSperrtMarktkauf } from "@/lib/draft/liga-draft-modell";

export class LigaDraftFehler extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 = 409,
  ) {
    super(code);
  }
}

function jetztIso(): string {
  return new Date().toISOString();
}

function ladeSave(persistence: PersistenceService, saveId: string): PersistedSaveGame {
  const save = persistence.getSaveById(saveId);
  if (!save) throw new LigaDraftFehler("save_not_found", 404);
  return save;
}

function kaderGroesse(gameState: Pick<GameState, "rosters">, teamId: string): number {
  return gameState.rosters.filter((eintrag) => eintrag.teamId === teamId).length;
}

function rosterMaxFuer(gameState: GameState, teamId: string): number {
  const team = gameState.teams.find((eintrag) => eintrag.teamId === teamId);
  return Math.min(ROSTER_MAX, team?.rosterLimit ?? ROSTER_MAX);
}

function preisVon(spieler: { marketValue?: number | null; displayMarketValue?: number | null }): number {
  return Math.max(0, spieler.marketValue ?? spieler.displayMarketValue ?? 0);
}

/**
 * Ist fuer dieses Team nichts mehr leistbar? Kader voll, oder kein freier Spieler mit Ablöse ≤ Kasse. Grundlage fuer die
 * Ausnahmen der Mindestkader-Regel (Auslassen, „Ich bin fertig“; Review #1619, A5).
 */
export function nichtsLeistbar(gameState: GameState, teamId: string): boolean {
  if (kaderGroesse(gameState, teamId) >= rosterMaxFuer(gameState, teamId)) return true;
  const kasse = gameState.teams.find((eintrag) => eintrag.teamId === teamId)?.cash ?? 0;
  return !freieSpieler(gameState).some((spieler) => {
    const preis = preisVon(spieler);
    return preis > 0 && preis <= kasse;
  });
}

/** Schutz vor Doppelklick/Wettlauf: jede schreibende Aktion nennt den Verlaufsstand, den sie gesehen hat. */
function pruefeStand(draft: LigaDraftZustand, erwarteteNr: number | null | undefined): void {
  if (erwarteteNr != null && draft.verlauf.length !== erwarteteNr) throw new LigaDraftFehler("draft_stand_veraltet");
}

/** Teams unter dem Mindestkader — dieselbe Warnung, die der Blocklauf in `leagueSetupWarnings` schreibt. */
export function ligaDraftWarnungen(gameState: GameState, draft: LigaDraftZustand): LeagueSetupTeamWarning[] {
  return gameState.teams
    .filter((team) => draft.teams[team.teamId] && kaderGroesse(gameState, team.teamId) < draft.regeln.minKader)
    .map((team) => ({
      teamId: team.teamId,
      teamName: team.name,
      rosterAfter: kaderGroesse(gameState, team.teamId),
      targetMin: draft.regeln.minKader,
      status: draft.teams[team.teamId]?.fertigGrund === "nichts_leistbar" ? "blocked" : "below_min",
    }));
}

/** Schreibt den Draft-Zustand in den Spielstand des Laufkontexts (ohne zu speichern). */
function setzeDraftImKontext(ctx: RunContext, draft: LigaDraftZustand): void {
  const gameState = ctx.save.gameState;
  const geordneterTeilVorbei = draft.status !== "laeuft";
  ctx.save = {
    ...ctx.save,
    gameState: {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        ligaDraft: draft,
        // Der Draft sperrt die Liga wie der Blocklauf ("in_progress"); sind die KI-Kader fertig (geordnete Phase vorbei,
        // ggf. Nachzug der Menschen), ist die Liga bereit — genau der Punkt, an dem der Blocklauf "ready" schreibt.
        leagueSetupStatus: geordneterTeilVorbei ? "ready" : "in_progress",
        ...(geordneterTeilVorbei ? { leagueSetupWarnings: ligaDraftWarnungen(gameState, draft) } : {}),
      },
    },
  };
  ctx.deferredWrites += 1;
}

function draftAusKontext(ctx: RunContext): LigaDraftZustand {
  const draft = ctx.save.gameState.seasonState.ligaDraft;
  if (!draft) throw new LigaDraftFehler("liga_draft_fehlt", 404);
  return draft;
}

/**
 * Liest frisch, rechnet `arbeit` auf einem Laufkontext und schreibt einmal. Bei Koop-Schreibkonflikt bis zu drei
 * Anlaeufe mit frischem Stand (die Arbeit ist synchron und idempotent gegen den neu gelesenen Stand).
 */
function mitFrischemStand<T>(persistence: PersistenceService, saveId: string, arbeit: (ctx: RunContext) => T): T {
  for (let versuch = 1; ; versuch += 1) {
    const ctx = createLocalTransfermarktRunContext({ save: ladeSave(persistence, saveId), persistence });
    const ergebnis = arbeit(ctx);
    if (ctx.deferredWrites === 0) return ergebnis;
    try {
      flushLocalTransfermarktRunContext(ctx);
      return ergebnis;
    } catch (error) {
      if (!istKoopSchreibkonflikt(error) || versuch >= 3) throw error;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Anlegen
// ---------------------------------------------------------------------------------------------------------------

export type LigaDraftStartEingabe = {
  persistence: PersistenceService;
  saveId: string;
  /**
   * Menschliche Teams (Sitz `mensch`). Dieselbe Liste, die der Blocklauf als `excludeTeamIds` bekommt; dazu zaehlt jedes
   * Team mit `controlMode: "manual"`. Auto-Pick bekommt ein menschliches Team NUR, wenn sein Draft an die KI delegiert
   * ist (`draft: "ki"`); sonst pickt es selbst — auch Ramonas Halbautomatik (`draft: "selbst"`, PR #1620).
   */
  selbstPickendeTeamIds?: readonly string[] | null;
  seed?: string;
  regeln?: Partial<LigaDraftZustand["regeln"]>;
  /**
   * Menschen ohne Auto-Pick bekommen die Startwahl `offen` (19.11.): der Draft steht bei Pick 1, bis jeder von ihnen
   * „Draft spielen“ oder „Selbst kaufen“ gewaehlt hat. Standard `false` (alter Ablauf).
   */
  wahlOffen?: boolean;
};

/** Baut den Startzustand (Sitze, Anker, Runde 1) aus einem Spielstand. Rein bis auf die Uhrzeit. */
export function baueLigaDraftStart(input: {
  gameState: GameState;
  saveId: string;
  selbstPickendeTeamIds?: readonly string[] | null;
  seed?: string;
  regeln?: Partial<LigaDraftZustand["regeln"]>;
  jetzt?: string;
  wahlOffen?: boolean;
}): LigaDraftZustand {
  const { gameState } = input;
  const selbst = new Set(input.selbstPickendeTeamIds ?? []);
  const settings = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const pool = freieSpieler(gameState);
  const teams: LigaDraftTeamZustand[] = gameState.teams.map((team) => {
    const eintrag = settings[team.teamId];
    const mensch = eintrag?.controlMode === "manual" || selbst.has(team.teamId);
    // Auto-Pick: KI-Teams immer; ein Mensch NUR mit delegiertem Draft (`draft: "ki"`). Ein Mensch mit `draft: "selbst"`
    // pickt selbst, egal ob er in der Ausschlussliste steht (Review #1619, S1: sonst pickte beim `starten` ueber die
    // Route die KI fuer jeden Menschen). Auto-Pick laesst sich jederzeit umschalten.
    const autoPick = mensch ? isBereichDelegiert(eintrag, "draft") : true;
    return {
      teamId: team.teamId,
      art: mensch ? "mensch" : "ki",
      ownerId: mensch ? eintrag?.ownerId ?? null : null,
      autoPick,
      status: "aktiv",
      fertigGrund: null,
      picks: 0,
      auslassungen: 0,
      startKaderIds: gameState.rosters.filter((r) => r.teamId === team.teamId).map((r) => r.playerId),
      startKasse: team.cash ?? 0,
      superstarLizenz: superstarLizenzZuDraftBeginn({ gameState, saveId: input.saveId, teamId: team.teamId, freiePool: pool }),
      ...(input.wahlOffen && mensch && !autoPick ? { startWahl: "offen" as const } : {}),
    };
  });
  return erzeugeLigaDraft({
    gameState,
    teams,
    seed: input.seed ?? `${input.saveId}:${gameState.season.id}:liga-draft`,
    jetzt: input.jetzt ?? jetztIso(),
    regeln: input.regeln,
  });
}

/**
 * Darf in diesem Spielstand ein Liga-Draft ANGELEGT werden? Nur im frischen Saison-1-Aufbau: Saison 1, noch kein
 * Spieltagsergebnis dieser Saison, und die Phase ist der Aufbau — `preseason_management` oder das Saisonstart-Setup
 * (`season_active`, Spieltag 1 offen). Letzteres ist die Phase, in der ein neues Spiel tatsaechlich startet
 * (`new-game-setup-service.ts`: `gamePhase: "season_active"`) und in der allein gekauft werden darf
 * (`transfer-window-policy.ts`). Gibt den Ablehnungsgrund zurueck oder `null`.
 */
export function ligaDraftAnlegenVerboten(gameState: GameState): string | null {
  if (gameState.season.id !== "season-1") return "nur_saison_1";
  if ((gameState.seasonState.matchdayResults ?? []).some((ergebnis) => ergebnis.seasonId === gameState.season.id)) {
    return "saison_laeuft_schon";
  }
  const phase = gameState.gamePhase ?? "season_active";
  if (phase !== "preseason_management" && !getTransferWindowStatus(gameState).isSeasonStartSetup) {
    return "nur_im_saisonaufbau";
  }
  return null;
}

/**
 * Legt den Draft im Spielstand an. Ein laufender Draft (geordnete Phase oder Nachzug) wird zurueckgegeben, ein
 * `fertig`er NIE neu angelegt (sonst zoege ein zweiter Draft ueber fertige Kader). Nur im frischen Saison-1-Aufbau
 * (`ligaDraftAnlegenVerboten`).
 */
export function starteLigaDraft(input: LigaDraftStartEingabe): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const vorhanden = ctx.save.gameState.seasonState.ligaDraft;
    if (vorhanden && vorhanden.saisonId === ctx.save.gameState.season.id) {
      if (vorhanden.status !== "fertig") return vorhanden;
      throw new LigaDraftFehler("draft_schon_fertig");
    }
    const verboten = ligaDraftAnlegenVerboten(ctx.save.gameState);
    if (verboten) throw new LigaDraftFehler(verboten);
    const draft = baueLigaDraftStart({
      gameState: ctx.save.gameState,
      saveId: input.saveId,
      selbstPickendeTeamIds: input.selbstPickendeTeamIds,
      seed: input.seed,
      regeln: input.regeln,
      wahlOffen: input.wahlOffen,
    });
    setzeDraftImKontext(ctx, draft);
    return draft;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// KI-Picks
// ---------------------------------------------------------------------------------------------------------------

export type LigaDraftKiSchrittErgebnis = {
  /** Gebuchte Eintraege dieses Aufrufs (Picks und Ausstiege). */
  eintraege: LigaDraftZustand["verlauf"];
  draft: LigaDraftZustand;
  /** Warum der Lauf stoppte: ein Mensch ist dran, Pick-Grenze des Aufrufs, Draft vorbei. */
  halt: "mensch_am_zug" | "max_picks" | "draft_vorbei" | "wartet_auf_start";
};

function fertigGrundAusKind(kind: string): LigaDraftFertigGrund {
  if (kind === "stop") return "ki_stop";
  if (kind === "roster_full") return "kader_voll";
  return "nichts_leistbar";
}

/** Kaufversuch fuer `kaufeMitNachruecken`: gekauft (mit Ergebnis) oder gescheitert (mit Grund des Kaufwegs). */
export type LigaDraftKaufVersuch<T> = { ok: true; ergebnis: T } | { ok: false; grund: string | null };

/** Hoechstens so viele gescheiterte Kaufversuche je Zug — danach `kauf_blockiert` (Schutz vor einem Lauf ueber ~3000). */
export const LIGA_DRAFT_KI_MAX_KAUFVERSUCHE = 40;
/** Wie weit die Rangliste der KI nach einem gescheiterten Kauf aufgeweitet wird (Top 3, dann 20, dann 200). */
export const LIGA_DRAFT_KI_TOPN_STUFEN: readonly number[] = [3, 20, 200];

/** Gruende des Kaufwegs, die fuer JEDEN Spieler gelten (Team-Ebene) — dann bringt der naechste Kandidat nichts. */
function istTeamweiterKaufgrund(grund: string | null): boolean {
  return grund === "roster_limit_reached" || grund === "team_not_found" || Boolean(grund?.startsWith("phase_blocked:"));
}

/**
 * KI-KAUF MIT NACHRUECKEN (Review #1619, A4). Vorher gab die KI nach drei gescheiterten Kaeufen (ihren Top 3) auf und
 * stieg mit `kauf_blockiert` aus — auch unter dem Mindestkader, obwohl noch Leistbares frei war. Jetzt:
 *  1. die Rangliste der KI der Reihe nach, gescheiterte Spieler ausgeschlossen, Stufe fuer Stufe aufgeweitet
 *     (`LIGA_DRAFT_KI_TOPN_STUFEN`); ist eine Stufe kuerzer als verlangt, ist die Rangliste erschoepft;
 *  2. unter dem Mindestkader danach die `notfall`-Liste (billigste leistbare freie Spieler) — die KI hoert unter 8 nicht
 *     auf, solange noch etwas Leistbares kaufbar ist;
 *  3. erst dann aufgeben: `erschoepft` (wirklich nichts kaufbar) oder `blockiert` (teamweiter Grund des Kaufwegs bzw.
 *     `LIGA_DRAFT_KI_MAX_KAUFVERSUCHE` erreicht).
 * Rein bis auf die Rueckrufe — `kaufe` macht den echten Kauf, deshalb ohne Spielstand testbar.
 */
export function kaufeMitNachruecken<T>(input: {
  rangliste: (topN: number) => readonly string[];
  notfall: () => readonly string[];
  kaufe: (playerId: string) => LigaDraftKaufVersuch<T>;
  maxVersuche?: number;
  topNStufen?: readonly number[];
}):
  | { ok: true; playerId: string; ergebnis: T; ausNotfall: boolean; fehlgeschlagen: string[] }
  | { ok: false; grund: "erschoepft" | "blockiert"; letzterKaufgrund: string | null; fehlgeschlagen: string[] } {
  const maxVersuche = input.maxVersuche ?? LIGA_DRAFT_KI_MAX_KAUFVERSUCHE;
  const versucht = new Set<string>();
  const fehlgeschlagen: string[] = [];
  let letzterKaufgrund: string | null = null;
  type Schritt = { ok: true; playerId: string; ergebnis: T } | { ok: false; abbruch: boolean } | null;
  const probiere = (playerId: string): Schritt => {
    if (versucht.has(playerId)) return null;
    if (fehlgeschlagen.length >= maxVersuche) return { ok: false, abbruch: true };
    versucht.add(playerId);
    const versuch = input.kaufe(playerId);
    if (versuch.ok) return { ok: true, playerId, ergebnis: versuch.ergebnis };
    fehlgeschlagen.push(playerId);
    letzterKaufgrund = versuch.grund;
    return istTeamweiterKaufgrund(versuch.grund) ? { ok: false, abbruch: true } : null;
  };
  const durchlaufe = (ids: readonly string[], ausNotfall: boolean) => {
    for (const playerId of ids) {
      const schritt = probiere(playerId);
      if (!schritt) continue;
      if (schritt.ok) return { ok: true as const, playerId: schritt.playerId, ergebnis: schritt.ergebnis, ausNotfall, fehlgeschlagen };
      return { ok: false as const, grund: "blockiert" as const, letzterKaufgrund, fehlgeschlagen };
    }
    return null;
  };
  for (const topN of input.topNStufen ?? LIGA_DRAFT_KI_TOPN_STUFEN) {
    const ids = input.rangliste(topN);
    const ergebnis = durchlaufe(ids, false);
    if (ergebnis) return ergebnis;
    if (ids.length < topN) break;
  }
  const notfall = durchlaufe(input.notfall(), true);
  if (notfall) return notfall;
  return { ok: false, grund: "erschoepft", letzterKaufgrund, fehlgeschlagen };
}

/**
 * KADERPLAN: den Grund der Kadergroesse an den Ausstieg im Verlauf haengen (Chris: weniger als Opt nur bewusst und begruendet).
 * `fertigGrund` des Teams bleibt der typisierte Grund; nur der Kurzgrund des Verlaufseintrags bekommt den Zusatz, mit den
 * Notwegen des Protokolls (`kaderplan_notwege:a,b`, z. B. `unter_minimum`) und einem Zusatz des Aufrufers (`kauf_gescheitert:…`).
 */
function mitKaderplanGrund(draft: LigaDraftZustand, kaderplan: LigaDraftKiBewertung["kaderplan"], zusatz?: string): LigaDraftZustand {
  if (!kaderplan || draft.verlauf.length === 0) return draft;
  const verlauf = [...draft.verlauf];
  const letzter = verlauf[verlauf.length - 1]!;
  const gm = kaderplan.optEntscheidung?.grund ? `; ${kaderplan.optEntscheidung.grund}` : "";
  const notwege = kaderplan.notwege.length > 0 ? ` kaderplan_notwege:${kaderplan.notwege.join(",")}` : "";
  const extra = zusatz ? ` ${zusatz}` : "";
  verlauf[verlauf.length - 1] = {
    ...letzter,
    grund: `${letzter.grund ?? ""}; kaderplan:${kaderplan.grund}${notwege}${extra} (${kaderplan.text}${gm})`,
  };
  return { ...draft, verlauf };
}

/** Ein automatischer Zug (KI-Team oder Mensch mit Auto-Pick) auf dem Laufkontext. */
function fuehreAutomatischenZugAus(ctx: RunContext, saveId: string): LigaDraftZustand["verlauf"][number] | null {
  const draft = draftAusKontext(ctx);
  const zug = werIstDran(draft);
  if (!zug || !zug.automatisch) return null;
  const team = draft.teams[zug.teamId]!;
  const quelle = team.art === "ki" ? "ki" : "auto";
  const gameState = ctx.save.gameState;
  const jetzt = jetztIso();

  if (kaderGroesse(gameState, zug.teamId) >= rosterMaxFuer(gameState, zug.teamId)) {
    // KADERPLAN: auch der Ausstieg am Kader-Maximum traegt das Protokoll (Grund, Fueller unter Opt als Notweg).
    const kaderplan = istKaderplanAktiv(gameState) ? bewerteKiPick({ gameState, saveId, draft, teamId: zug.teamId, topN: 1 }).kaderplan : undefined;
    const naechster = mitKaderplanGrund(
      bucheAusstieg({ draft, gameState, teamId: zug.teamId, grund: "kader_voll", quelle, jetzt }),
      kaderplan,
    );
    setzeDraftImKontext(ctx, naechster);
    return naechster.verlauf[naechster.verlauf.length - 1]!;
  }

  const bewertung = bewerteKiPick({ gameState, saveId, draft, teamId: zug.teamId, topN: 3 });
  const top3 = bewertung.top.map((eintrag) => ({ playerId: eintrag.playerId, nutzen: eintrag.nutzen }));
  if (bewertung.kind !== "buy") {
    const naechster = mitKaderplanGrund(
      bucheAusstieg({
        draft,
        gameState,
        teamId: zug.teamId,
        grund: fertigGrundAusKind(bewertung.kind),
        quelle,
        top3,
        jetzt,
      }),
      bewertung.kaderplan,
    );
    setzeDraftImKontext(ctx, naechster);
    return naechster.verlauf[naechster.verlauf.length - 1]!;
  }

  // KI-WAHL (19.11.): die KI waehlt unter ihren Top 3 gewichtet nach dem Bewertungsabstand (`waehleKiPlatz`, deterministisch aus
  // Saat und Pick-Nummer); die Anzeige bleibt nach Bewertung sortiert. Scheitert der Kauf (Rennen, Validierung, Vorstand), rueckt der naechste Kandidat nach — erst
  // aus der Rangliste der KI, unter dem Mindestkader zuletzt der billigste leistbare freie Spieler (`kaufeMitNachruecken`).
  const kasse = gameState.teams.find((eintrag) => eintrag.teamId === zug.teamId)?.cash ?? 0;
  const unterMinimum = kaderGroesse(gameState, zug.teamId) < draft.regeln.minKader;
  const spielerById = new Map(gameState.players.map((spieler) => [spieler.id, spieler]));
  // KADERPLAN (Standard im Saison-1-Draft, docs/design/ki-pick-analyse-18-11.md): kein Notweg „billigster Spieler".
  // Scheitert ein Kauf, geht es in der Rangliste der KI weiter — bis ueber den ganzen Pool —, nie nach Preis sortiert.
  const kaderplan = istKaderplanAktiv(gameState);
  const wahlIndex = waehleKiPlatz(
    bewertung.top.map((eintrag) => eintrag.nutzen),
    `${draft.seed}:${saveId}:ki-wahl:${draft.verlauf.length}:${zug.teamId}`,
  );
  const gewaehlt = wahlIndex > 0 ? bewertung.top[wahlIndex]?.playerId ?? null : null;
  const kauf = kaufeMitNachruecken({
    topNStufen: kaderplan ? [...LIGA_DRAFT_KI_TOPN_STUFEN, Number.MAX_SAFE_INTEGER] : undefined,
    rangliste: (topN) => {
      const roh =
        topN <= bewertung.top.length || bewertung.top.length < 3
          ? bewertung.top.slice(0, topN).map((eintrag) => eintrag.playerId)
          : bewerteKiPick({ gameState, saveId, draft, teamId: zug.teamId, topN }).top.map((eintrag) => eintrag.playerId);
      // Der gewaehlte Platz steht vorn, der Rest in Bewertungsreihenfolge (Nachruecken wie bisher).
      return gewaehlt ? [gewaehlt, ...roh.filter((id) => id !== gewaehlt)] : roh;
    },
    notfall: () =>
      unterMinimum && !kaderplan
        ? freieSpieler(gameState)
            .filter((spieler) => preisVon(spieler) > 0 && preisVon(spieler) <= kasse)
            .sort((a, b) => preisVon(a) - preisVon(b))
            .map((spieler) => spieler.id)
        : [],
    kaufe: (playerId) => {
      const ergebnis = executeLocalTransfermarktBuy({
        saveId,
        seasonId: gameState.season.id,
        teamId: zug.teamId,
        playerId,
        transferSource: "ai_roster_fill",
        contractLength: LIGA_DRAFT_VERTRAGSLAUFZEIT,
        draftFestkonditionen: true,
        localRunContext: ctx,
        deferPersist: true,
      });
      return ergebnis.transferCreated && ergebnis.transferId
        ? { ok: true, ergebnis }
        : { ok: false, grund: ergebnis.blockingReasons[0] ?? null };
    },
  });
  if (kauf.ok) {
    const spieler = spielerById.get(kauf.playerId);
    const kandidat = bewertung.top.find((eintrag) => eintrag.playerId === kauf.playerId);
    const naechster = bucheDraftPick({
      draft: draftAusKontext(ctx),
      gameState: ctx.save.gameState,
      teamId: zug.teamId,
      playerId: kauf.playerId,
      quelle,
      abloese: kauf.ergebnis.purchasePrice ?? kandidat?.marketValue ?? (spieler ? preisVon(spieler) : null),
      gehalt: kauf.ergebnis.offeredSalary ?? kauf.ergebnis.salary ?? kandidat?.salary ?? null,
      transferId: kauf.ergebnis.transferId!,
      top3,
      grund:
        kauf.playerId === bewertung.bestPlayerId
          ? bewertung.notweg
            ? `notweg:${bewertung.notweg}`
            : null
          : kauf.ausNotfall
            ? "notkauf_mindestkader"
            : kauf.playerId === gewaehlt
              ? `wahl_platz_${wahlIndex + 1}`
              : "platz_1_nicht_kaufbar",
      jetzt,
    });
    setzeDraftImKontext(ctx, naechster);
    return naechster.verlauf[naechster.verlauf.length - 1]!;
  }
  // Review S4: auch dieser Ausstieg (Kauf gescheitert: 40 Fehlversuche oder ein teamweiter Grund) bekommt das Protokoll, und laut.
  const zusatz = `kauf_gescheitert:${kauf.grund}${kauf.letzterKaufgrund ? `/${kauf.letzterKaufgrund}` : ""}`;
  const naechster = mitKaderplanGrund(
    bucheAusstieg({
      draft,
      gameState,
      teamId: zug.teamId,
      grund: kauf.grund === "erschoepft" ? "nichts_leistbar" : "kauf_blockiert",
      quelle,
      top3,
      jetzt,
    }),
    bewertung.kaderplan,
    zusatz,
  );
  if (bewertung.kaderplan) {
    console.warn(
      `[kaderplan] AUSSTIEG ${zug.teamId} nach gescheitertem Kauf (${zusatz}) bei Kader ${kaderGroesse(gameState, zug.teamId)} ` +
        `(Opt ${bewertung.kaderplan.optTarget}, Notwege ${bewertung.kaderplan.notwege.join(",") || "keine"})`,
    );
  }
  setzeDraftImKontext(ctx, naechster);
  return naechster.verlauf[naechster.verlauf.length - 1]!;
}

/**
 * Faehrt automatische Zuege, bis ein Mensch ohne Auto-Pick dran ist, `maxPicks` Zuege gemacht sind oder die geordnete
 * Phase vorbei ist. `erwarteteNr` (Laenge des Verlaufs, die der Aufrufer sah) schuetzt vor doppeltem Vorspulen.
 */
export function laufeKiZuege(input: {
  persistence: PersistenceService;
  saveId: string;
  maxPicks?: number;
  erwarteteNr?: number | null;
  /**
   * Hoechstens so lange (ms) rechnen, dann den Happen beenden (mindestens ein Pick). Der Hintergrundlauf setzt es, damit er die
   * Event-Loop nie laenger als etwa einen Pick blockiert — s. `laufeKiImHintergrund`.
   */
  zeitBudgetMs?: number;
}): LigaDraftKiSchrittErgebnis {
  const maxPicks = Math.max(1, Math.floor(input.maxPicks ?? 1));
  const frist = input.zeitBudgetMs != null ? Date.now() + Math.max(0, input.zeitBudgetMs) : null;
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    pruefeStand(draftAusKontext(ctx), input.erwarteteNr);
    const eintraege: LigaDraftZustand["verlauf"] = [];
    // Startwahl offen: der Draft steht bei Pick 1, bis jeder Mensch gewaehlt hat (19.11.).
    if (wartetAufStartWahl(draftAusKontext(ctx))) return { eintraege, draft: draftAusKontext(ctx), halt: "wartet_auf_start" as const };
    let halt: LigaDraftKiSchrittErgebnis["halt"] = "max_picks";
    while (eintraege.length < maxPicks && (frist == null || eintraege.length === 0 || Date.now() < frist)) {
      const draft = draftAusKontext(ctx);
      const zug = werIstDran(draft);
      if (!zug) {
        halt = "draft_vorbei";
        break;
      }
      if (!zug.automatisch) {
        halt = "mensch_am_zug";
        break;
      }
      const eintrag = fuehreAutomatischenZugAus(ctx, input.saveId);
      if (!eintrag) break;
      eintraege.push(eintrag);
    }
    const ende = draftAusKontext(ctx);
    if (halt === "max_picks") {
      const zug = werIstDran(ende);
      if (!zug) halt = "draft_vorbei";
      else if (!zug.automatisch) halt = "mensch_am_zug";
    }
    return { eintraege, draft: ende, halt };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Mensch
// ---------------------------------------------------------------------------------------------------------------

/** Was ein Mensch fuer diesen Pick hoechstens ausgeben darf: Kasse minus Reserve fuer die noch fehlenden Pflichtplaetze. */
export function pflichtReserve(gameState: GameState, teamId: string, minKader: number, ohnePlayerId?: string | null): number {
  const fehlenNachPick = Math.max(0, minKader - (kaderGroesse(gameState, teamId) + 1));
  if (fehlenNachPick === 0) return 0;
  const preise = freieSpieler(gameState)
    .filter((spieler) => spieler.id !== ohnePlayerId)
    .map((spieler) => Math.max(0, spieler.marketValue ?? spieler.displayMarketValue ?? 0))
    .filter((preis) => preis > 0)
    .sort((a, b) => a - b);
  return preise.slice(0, fehlenNachPick).reduce((summe, preis) => summe + preis, 0);
}

function pruefeMenschTeam(draft: LigaDraftZustand, teamId: string): LigaDraftTeamZustand {
  const team = draft.teams[teamId];
  if (!team) throw new LigaDraftFehler("team_nicht_im_draft", 404);
  if (team.art !== "mensch") throw new LigaDraftFehler("team_ist_ki", 403);
  return team;
}

export type LigaDraftMenschPickErgebnis = {
  draft: LigaDraftZustand;
  transferId: string;
  abloese: number | null;
  gehalt: number | null;
  /** Das Kaufergebnis (ohne Spielstand), damit die Markt-Route dem Verhandlungstisch dieselbe Antwort geben kann. */
  kauf: Omit<TransfermarktBuyExecuteResult, "gameStateAfter">;
};

/**
 * Verhandelter Vertrag fuer einen Draft-Pick aus dem Verhandlungstisch des Transfermarkts (Chris 19.11.: „beim Picken
 * finde ich es doch gut, wenn man verhandeln kann“). Fehlt er, bucht der Pick wie bisher zu Festkonditionen.
 */
export type LigaDraftVerhandelterVertrag = {
  contractLength?: number;
  contractShape?: ContractShape;
  offeredSalary?: number;
};

/** Mensch-Pick: am eigenen Platz (geordnete Phase) oder im Nachzug. Kauf ueber den Produktionsweg der Kauf-Route. */
export function bucheMenschPick(input: {
  persistence: PersistenceService;
  saveId: string;
  teamId: string;
  playerId: string;
  erwarteteNr?: number | null;
  idempotencyKey?: string;
  vertrag?: LigaDraftVerhandelterVertrag | null;
}): LigaDraftMenschPickErgebnis {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    pruefeStand(draft, input.erwarteteNr);
    if (wartetAufStartWahl(draft)) throw new LigaDraftFehler("draft_wartet_auf_start");
    const team = pruefeMenschTeam(draft, input.teamId);
    const gameState = ctx.save.gameState;
    const imNachzug = team.status === "nachzug";
    if (imNachzug) {
      if (draft.status !== "nachzug") throw new LigaDraftFehler("nachzug_erst_nach_dem_draft");
    } else {
      const zug = werIstDran(draft);
      if (!zug || zug.teamId !== input.teamId) throw new LigaDraftFehler("nicht_am_zug");
      if (team.autoPick) throw new LigaDraftFehler("auto_pick_ist_an");
    }
    if (kaderGroesse(gameState, input.teamId) >= rosterMaxFuer(gameState, input.teamId)) {
      throw new LigaDraftFehler("kader_voll");
    }
    const phase = evaluateGamePhaseAction(gameState, "buy_players");
    if (!phase.allowed) throw new LigaDraftFehler(phase.reason ?? "phase_gesperrt");
    const spieler = gameState.players.find((eintrag) => eintrag.id === input.playerId);
    if (!spieler) throw new LigaDraftFehler("spieler_unbekannt", 404);
    if (gameState.rosters.some((eintrag) => eintrag.playerId === input.playerId)) {
      throw new LigaDraftFehler("spieler_vergeben");
    }
    // Pflichtplaetze: nach dem Pick muss die Kasse die billigsten Spieler fuer die noch fehlenden Pflichtplaetze tragen.
    // Unter dem Minimum bleibt der billigste freie Spieler immer pickbar (Mockup, Abschnitt 3).
    const preis = Math.max(0, spieler.marketValue ?? spieler.displayMarketValue ?? 0);
    const kasse = gameState.teams.find((eintrag) => eintrag.teamId === input.teamId)?.cash ?? 0;
    const reserve = pflichtReserve(gameState, input.teamId, draft.regeln.minKader, input.playerId);
    const billigster = Math.min(
      ...freieSpieler(gameState).map((eintrag) => Math.max(0, eintrag.marketValue ?? eintrag.displayMarketValue ?? 0)),
    );
    if (kasse - preis < reserve && preis > billigster) throw new LigaDraftFehler("reserve_fuer_pflichtplaetze");

    const kauf = executeLocalTransfermarktBuy({
      saveId: input.saveId,
      seasonId: gameState.season.id,
      teamId: input.teamId,
      playerId: input.playerId,
      transferSource: "manual_transfermarkt_buy",
      idempotencyKey: input.idempotencyKey,
      ...(input.vertrag
        ? { contractLength: input.vertrag.contractLength, contractShape: input.vertrag.contractShape, offeredSalary: input.vertrag.offeredSalary }
        : { contractLength: LIGA_DRAFT_VERTRAGSLAUFZEIT, draftFestkonditionen: true }),
      localRunContext: ctx,
      deferPersist: true,
    });
    if (!kauf.transferCreated || !kauf.transferId) {
      throw new LigaDraftFehler(kauf.blockingReasons[0] ?? "kauf_nicht_moeglich");
    }
    const { gameStateAfter: _ohneStand, ...kaufOhneStand } = kauf;
    const naechster = bucheDraftPick({
      draft,
      gameState: ctx.save.gameState,
      teamId: input.teamId,
      playerId: input.playerId,
      quelle: imNachzug ? "nachzug" : "mensch",
      abloese: kauf.purchasePrice ?? preis,
      gehalt: kauf.offeredSalary ?? kauf.salary ?? null,
      transferId: kauf.transferId,
      top3: null,
      jetzt: jetztIso(),
    });
    setzeDraftImKontext(ctx, naechster);
    return {
      draft: naechster,
      transferId: kauf.transferId,
      abloese: kauf.purchasePrice ?? preis,
      gehalt: kauf.offeredSalary ?? kauf.salary ?? null,
      kauf: kaufOhneStand,
    };
  });
}

/**
 * Auslassen am eigenen Zug. Je Pick erlaubt, aber nicht bis unter den Mindestkader (Review #1619, A5): die restlichen
 * Runden muessen noch fuer die fehlenden Pflichtplaetze reichen (`darfAuslassen`), ausser es ist nichts mehr leistbar.
 * Mit Auto-Pick an pickt der GM — Auslassen ist dann nicht moeglich.
 */
export function bucheMenschAuslassen(input: {
  persistence: PersistenceService;
  saveId: string;
  teamId: string;
  erwarteteNr?: number | null;
}): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    pruefeStand(draft, input.erwarteteNr);
    const team = pruefeMenschTeam(draft, input.teamId);
    if (wartetAufStartWahl(draft)) throw new LigaDraftFehler("draft_wartet_auf_start");
    const zug = werIstDran(draft);
    if (!zug || zug.teamId !== input.teamId) throw new LigaDraftFehler("nicht_am_zug");
    if (team.autoPick) throw new LigaDraftFehler("auto_pick_ist_an");
    const gameState = ctx.save.gameState;
    const leer = nichtsLeistbar(gameState, input.teamId);
    if (!darfAuslassen(draft, kaderGroesse(gameState, input.teamId), leer)) {
      throw new LigaDraftFehler("auslassen_unter_mindestkader");
    }
    const naechster = bucheAuslassen({ draft, gameState, teamId: input.teamId, nichtsLeistbar: leer, jetzt: jetztIso() });
    setzeDraftImKontext(ctx, naechster);
    return naechster;
  });
}

/**
 * „Ich bin fertig“: jederzeit (auch ausserhalb des eigenen Zugs) und im Nachzug — aber erst ab dem Mindestkader, oder
 * wenn nichts mehr leistbar ist (dann mit Grund `nichts_leistbar`). Kein Draft-Ende mit 0 Spielern (Review #1619, A5).
 */
export function bucheMenschFertig(input: {
  persistence: PersistenceService;
  saveId: string;
  teamId: string;
  erwarteteNr?: number | null;
}): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    pruefeStand(draft, input.erwarteteNr);
    const team = pruefeMenschTeam(draft, input.teamId);
    if (team.status === "fertig") return draft;
    const gameState = ctx.save.gameState;
    const unterMinimum = kaderGroesse(gameState, input.teamId) < draft.regeln.minKader;
    if (unterMinimum && !nichtsLeistbar(gameState, input.teamId)) {
      throw new LigaDraftFehler("kader_unter_minimum");
    }
    const naechster = bucheAusstieg({
      draft,
      gameState,
      teamId: input.teamId,
      grund: unterMinimum ? "nichts_leistbar" : "mensch_fertig",
      quelle: team.status === "nachzug" ? "nachzug" : "mensch",
      jetzt: jetztIso(),
    });
    setzeDraftImKontext(ctx, naechster);
    return naechster;
  });
}

/** Ueberspringen: A = Nachzug (KI pickt ohne mich fertig), B = eigener GM pickt mit (Auto-Pick an). */
export function bucheMenschUeberspringen(input: {
  persistence: PersistenceService;
  saveId: string;
  teamId: string;
  variante: "A" | "B";
  erwarteteNr?: number | null;
}): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    pruefeStand(draft, input.erwarteteNr);
    const team = pruefeMenschTeam(draft, input.teamId);
    if (draft.status !== "laeuft") throw new LigaDraftFehler("draft_laeuft_nicht");
    if (team.status !== "aktiv") throw new LigaDraftFehler("team_nicht_aktiv");
    const naechster = bucheUeberspringen({
      draft,
      gameState: ctx.save.gameState,
      teamId: input.teamId,
      variante: input.variante,
      jetzt: jetztIso(),
    });
    setzeDraftImKontext(ctx, naechster);
    return naechster;
  });
}

/**
 * STARTWAHL (19.11.): „Draft spielen“ (`spielen`) oder „Selbst kaufen“ (`selbst` = Ueberspringen Variante A, dieselbe
 * Buchung wie der Dialog: das Team geht in den Nachzug, die KI pickt ohne es fertig, danach kauft der Mensch aus dem
 * Rest). Je Sitz; solange ein Mensch noch `offen` hat, faehrt niemand einen Pick (`wartetAufStartWahl`).
 */
export function setzeMenschStartWahl(input: {
  persistence: PersistenceService;
  saveId: string;
  teamId: string;
  wahl: "spielen" | "selbst";
}): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    const team = pruefeMenschTeam(draft, input.teamId);
    if (team.startWahl !== "offen") return draft;
    if (draft.status !== "laeuft") throw new LigaDraftFehler("draft_laeuft_nicht");
    let naechster: LigaDraftZustand = {
      ...draft,
      teams: { ...draft.teams, [input.teamId]: { ...team, startWahl: input.wahl } },
      aktualisiertAm: jetztIso(),
    };
    if (input.wahl === "selbst" && team.status === "aktiv") {
      naechster = bucheUeberspringen({ draft: naechster, gameState: ctx.save.gameState, teamId: input.teamId, variante: "A", jetzt: jetztIso() });
    }
    setzeDraftImKontext(ctx, naechster);
    return naechster;
  });
}

/** Spielt noch irgendein Mensch den geordneten Draft mit (aktiv, ohne Auto-Pick)? Sonst muss die KI selbst durchlaufen. */
export function spieltNochEinMensch(draft: LigaDraftZustand): boolean {
  return Object.values(draft.teams).some((team) => team.art === "mensch" && team.status === "aktiv" && !team.autoPick);
}

/**
 * WUNSCHLISTE IM DRAFT, schmal (19.11.): der Stern schreibt NICHT den ganzen Client-Stand. Der Client haelt waehrend des Drafts
 * einen Stand, den der Server mit jedem Pick ueberholt; sein Auto-Save lief deshalb in „Save-Konflikt erkannt“. Hier laeuft die
 * Aenderung wie jede andere Draft-Aktion: frisch lesen, nur die Wunschliste aendern, einmal schreiben.
 */
export function setzeDraftWunschliste(input: {
  persistence: PersistenceService;
  saveId: string;
  teamId: string;
  playerId: string;
  an: boolean;
  /** Anzeigewerte des Spielers aus dem Brett (Feed); fehlt er, nimmt der Dienst die Spielerdaten des Spielstands. */
  eintrag?: Partial<Pick<TransferWishlistEntry, "playerName" | "className" | "race" | "marketValue" | "salary" | "bracket" | "pow" | "spe" | "men" | "soc">> | null;
}): number {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const gameState = ctx.save.gameState;
    const vorhanden = gameState.seasonState.transferWishlist ?? [];
    const schonDrin = vorhanden.some((e) => e.playerId === input.playerId && e.teamId === input.teamId);
    if (input.an === schonDrin) return vorhanden.length;
    const spieler = gameState.players.find((p) => p.id === input.playerId);
    if (!spieler) throw new LigaDraftFehler("spieler_unbekannt", 404);
    let naechste: TransferWishlistEntry[];
    if (!input.an) {
      naechste = vorhanden.filter((e) => !(e.playerId === input.playerId && e.teamId === input.teamId));
    } else {
      const e = input.eintrag ?? {};
      naechste = [
        {
          id: `wishlist-${input.playerId}-${Date.now()}`,
          saveId: input.saveId,
          seasonId: gameState.season.id,
          playerId: input.playerId,
          playerName: e.playerName ?? spieler.name,
          className: e.className ?? spieler.className ?? "",
          race: e.race ?? spieler.race ?? "",
          marketValue: e.marketValue ?? spieler.marketValue ?? spieler.displayMarketValue ?? null,
          salary: e.salary ?? spieler.salaryDemand ?? spieler.displaySalary ?? null,
          bracket: e.bracket ?? null,
          pow: e.pow ?? null,
          spe: e.spe ?? null,
          men: e.men ?? null,
          soc: e.soc ?? null,
          teamId: input.teamId,
          createdAt: new Date().toISOString(),
          priorityRank: getNextWishlistPriorityRank(gameState, input.teamId),
        },
        ...vorhanden,
      ];
    }
    const mitListe: GameState = { ...gameState, seasonState: { ...gameState.seasonState, transferWishlist: naechste } };
    ctx.save = { ...ctx.save, gameState: syncWishlistToScoutingWatchlist(mitListe, input.teamId) };
    ctx.deferredWrites += 1;
    return naechste.length;
  });
}

export function setzeMenschAutoPick(input: {
  persistence: PersistenceService;
  saveId: string;
  teamId: string;
  an: boolean;
  erwarteteNr?: number | null;
}): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    pruefeStand(draft, input.erwarteteNr);
    pruefeMenschTeam(draft, input.teamId);
    if (draft.status === "fertig") throw new LigaDraftFehler("draft_laeuft_nicht");
    const naechster = setzeAutoPick(draft, input.teamId, input.an, jetztIso());
    setzeDraftImKontext(ctx, naechster);
    return naechster;
  });
}

/**
 * Gastgeber bricht den Draft ab (Review #1619, A2): Draft `fertig` (alle offenen Teams `abgebrochen`), damit
 * `leagueSetupStatus: "ready"` mit den Warnungen fuer Teams unter 8 und die Marktsperre aufgehoben. Ein laufender
 * Hintergrundlauf haelt beim naechsten Happen von selbst an (kein Zug mehr offen).
 */
export function brecheLigaDraftAb(input: {
  persistence: PersistenceService;
  saveId: string;
  erwarteteNr?: number | null;
}): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    pruefeStand(draft, input.erwarteteNr);
    if (draft.status === "fertig") return draft;
    const naechster = bricheLigaDraftAb(draft, jetztIso());
    setzeDraftImKontext(ctx, naechster);
    return naechster;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Hintergrundlauf (Ueberspringen A/B, reine KI-Liga)
// ---------------------------------------------------------------------------------------------------------------

const laufendeHintergrundLaeufe = new Set<string>();
/** Angeforderte Abbrueche laufender Hintergrundlaeufe (s. `meldeHintergrundArbeit`). */
const hintergrundAbbruch = new Set<string>();

/**
 * Zeit je Happen des Hintergrundlaufs. Vorher waren es fest 8 Picks am Stueck (0,1–0,2 s je Pick, auf langsamer Hardware
 * deutlich mehr) — mehrere Ligen im selben Prozess (Raeume, Tests) hielten die Event-Loop damit sekundenlang fest. Gefunden an
 * #1642 (CI): ein 6-ms-Test lief nach sechs Raum-Starts in den 20-s-Timeout (lib/hintergrund/hintergrund-arbeit.ts). Mit
 * Zeitbudget blockiert ein Happen hoechstens etwa einen Pick; schnelle Picks werden weiter gebuendelt geschrieben.
 */
export const LIGA_DRAFT_HAPPEN_BUDGET_MS = 120;

export function istHintergrundLaufAktiv(saveId: string): boolean {
  return laufendeHintergrundLaeufe.has(saveId);
}

/**
 * Faehrt die KI-Zuege im Hintergrund, bis ein Mensch dran ist oder die geordnete Phase vorbei ist. In Haeppchen von
 * `jeHappen` Zuegen mit einer Pause fuer die Event-Loop dazwischen (Statusabfragen und andere Routen kommen dran), je
 * Happen ein Schreibvorgang. Ein Lauf je Spielstand und Prozess.
 */
export async function laufeKiImHintergrund(input: {
  persistence: PersistenceService;
  saveId: string;
  logPrefix: string;
  jeHappen?: number;
  /** Zusaetzliche Abbruchbedingung des Aufrufers (z. B. ein abgebrochener Anstoss), vor jedem Happen gefragt. */
  sollAbbrechen?: () => boolean;
}): Promise<{ halt: LigaDraftKiSchrittErgebnis["halt"] | "laeuft_schon" | "abgebrochen"; picks: number }> {
  if (laufendeHintergrundLaeufe.has(input.saveId)) return { halt: "laeuft_schon", picks: 0 };
  laufendeHintergrundLaeufe.add(input.saveId);
  const lauf = (async () => {
    let picks = 0;
    try {
      for (;;) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (hintergrundAbbruch.has(input.saveId) || input.sollAbbrechen?.()) return { halt: "abgebrochen" as const, picks };
        const ergebnis = laufeKiZuege({
          persistence: input.persistence,
          saveId: input.saveId,
          maxPicks: input.jeHappen ?? 8,
          zeitBudgetMs: LIGA_DRAFT_HAPPEN_BUDGET_MS,
        });
        picks += ergebnis.eintraege.length;
        if (ergebnis.halt !== "max_picks") return { halt: ergebnis.halt, picks };
      }
    } catch (error) {
      console.error(`${input.logPrefix} Liga-Draft (Einzelschritt): Hintergrundlauf abgebrochen:`, error);
      throw error;
    } finally {
      laufendeHintergrundLaeufe.delete(input.saveId);
      hintergrundAbbruch.delete(input.saveId);
    }
  })();
  meldeHintergrundArbeit(lauf, () => hintergrundAbbruch.add(input.saveId));
  return lauf;
}

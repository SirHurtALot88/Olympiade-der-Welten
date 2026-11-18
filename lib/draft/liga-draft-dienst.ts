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
 * Der alte Hintergrund-Draft bleibt der Standard (`OLY_LIGA_DRAFT_MODUS` nicht gesetzt), bis der neue abgenommen ist.
 */
import type {
  GameState,
  LeagueSetupTeamWarning,
  LigaDraftFertigGrund,
  LigaDraftTeamZustand,
  LigaDraftZustand,
} from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  flushLocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { ROSTER_MAX } from "@/lib/ai/organic-squad/types";
import { istKoopSchreibkonflikt } from "@/lib/persistence/koop-schreibkonflikt";
import {
  bucheAuslassen,
  bucheAusstieg,
  bucheDraftPick,
  bucheUeberspringen,
  erzeugeLigaDraft,
  setzeAutoPick,
  werIstDran,
} from "@/lib/draft/liga-draft-modell";
import { bewerteKiPick, freieSpieler, superstarLizenzZuDraftBeginn } from "@/lib/draft/liga-draft-ki";

type RunContext = ReturnType<typeof createLocalTransfermarktRunContext>;

/** Schalter: `OLY_LIGA_DRAFT_MODUS=einzelschritt` startet beim Anlegen einer Liga den neuen Draft statt des alten. */
export function istEinzelschrittDraftAktiv(): boolean {
  return process.env.OLY_LIGA_DRAFT_MODUS === "einzelschritt";
}

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
   * Menschliche Teams, die SELBST picken (Auto-Pick aus). Dieselbe Liste, die der Blocklauf als `excludeTeamIds`
   * bekommt. Ein menschliches Team, das NICHT darin steht (delegierter Draft, Ramonas Halbautomatik), bekommt einen
   * Sitz mit Auto-Pick an — es kann ihn ausschalten und selbst picken.
   */
  selbstPickendeTeamIds?: readonly string[] | null;
  seed?: string;
  regeln?: Partial<LigaDraftZustand["regeln"]>;
};

/** Baut den Startzustand (Sitze, Anker, Runde 1) aus einem Spielstand. Rein bis auf die Uhrzeit. */
export function baueLigaDraftStart(input: {
  gameState: GameState;
  saveId: string;
  selbstPickendeTeamIds?: readonly string[] | null;
  seed?: string;
  regeln?: Partial<LigaDraftZustand["regeln"]>;
  jetzt?: string;
}): LigaDraftZustand {
  const { gameState } = input;
  const selbst = new Set(input.selbstPickendeTeamIds ?? []);
  const settings = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const pool = freieSpieler(gameState);
  const teams: LigaDraftTeamZustand[] = gameState.teams.map((team) => {
    const eintrag = settings[team.teamId];
    const mensch = eintrag?.controlMode === "manual" || selbst.has(team.teamId);
    // Wer nicht selbst pickt, bekommt Auto-Pick: KI-Teams immer, Menschen mit delegiertem Draft (die Aufrufer nehmen sie
    // schon aus der Ausschlussliste, s. app/api/new-game/route.ts), und manuelle Teams eines Laufs ohne Ausschlussliste
    // (fresh-season-1: der Blocklauf draftete auch sie). Der Mensch kann Auto-Pick jederzeit ausschalten.
    const autoPick = mensch ? !selbst.has(team.teamId) || isBereichDelegiert(eintrag, "draft") : true;
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

/** Legt den Draft im Spielstand an (ueberschreibt keinen laufenden). */
export function starteLigaDraft(input: LigaDraftStartEingabe): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const vorhanden = ctx.save.gameState.seasonState.ligaDraft;
    if (vorhanden && vorhanden.saisonId === ctx.save.gameState.season.id && vorhanden.status !== "fertig") {
      return vorhanden;
    }
    const draft = baueLigaDraftStart({
      gameState: ctx.save.gameState,
      saveId: input.saveId,
      selbstPickendeTeamIds: input.selbstPickendeTeamIds,
      seed: input.seed,
      regeln: input.regeln,
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
  halt: "mensch_am_zug" | "max_picks" | "draft_vorbei";
};

function fertigGrundAusKind(kind: string): LigaDraftFertigGrund {
  if (kind === "stop") return "ki_stop";
  if (kind === "roster_full") return "kader_voll";
  return "nichts_leistbar";
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
    const naechster = bucheAusstieg({ draft, gameState, teamId: zug.teamId, grund: "kader_voll", quelle, jetzt });
    setzeDraftImKontext(ctx, naechster);
    return naechster.verlauf[naechster.verlauf.length - 1]!;
  }

  const bewertung = bewerteKiPick({ gameState, saveId, draft, teamId: zug.teamId, topN: 3 });
  const top3 = bewertung.top.map((eintrag) => ({ playerId: eintrag.playerId, nutzen: eintrag.nutzen }));
  if (bewertung.kind !== "buy") {
    const naechster = bucheAusstieg({
      draft,
      gameState,
      teamId: zug.teamId,
      grund: fertigGrundAusKind(bewertung.kind),
      quelle,
      top3,
      jetzt,
    });
    setzeDraftImKontext(ctx, naechster);
    return naechster.verlauf[naechster.verlauf.length - 1]!;
  }

  // Die KI nimmt Platz 1. Scheitert der Kauf (Rennen, Validierung), wie im Blocklauf den naechsten Kandidaten.
  for (const kandidat of bewertung.top) {
    const kauf = executeLocalTransfermarktBuy({
      saveId,
      seasonId: gameState.season.id,
      teamId: zug.teamId,
      playerId: kandidat.playerId,
      transferSource: "ai_roster_fill",
      localRunContext: ctx,
      deferPersist: true,
    });
    if (!kauf.transferCreated || !kauf.transferId) continue;
    const naechster = bucheDraftPick({
      draft: draftAusKontext(ctx),
      gameState: ctx.save.gameState,
      teamId: zug.teamId,
      playerId: kandidat.playerId,
      quelle,
      abloese: kauf.purchasePrice ?? kandidat.marketValue,
      gehalt: kauf.offeredSalary ?? kauf.salary ?? kandidat.salary,
      transferId: kauf.transferId,
      top3,
      grund: kandidat.playerId === bewertung.bestPlayerId ? null : "platz_1_nicht_kaufbar",
      jetzt,
    });
    setzeDraftImKontext(ctx, naechster);
    return naechster.verlauf[naechster.verlauf.length - 1]!;
  }
  const naechster = bucheAusstieg({ draft, gameState, teamId: zug.teamId, grund: "kauf_blockiert", quelle, top3, jetzt });
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
}): LigaDraftKiSchrittErgebnis {
  const maxPicks = Math.max(1, Math.floor(input.maxPicks ?? 1));
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const start = draftAusKontext(ctx);
    if (input.erwarteteNr != null && start.verlauf.length !== input.erwarteteNr) {
      throw new LigaDraftFehler("draft_stand_veraltet");
    }
    const eintraege: LigaDraftZustand["verlauf"] = [];
    let halt: LigaDraftKiSchrittErgebnis["halt"] = "max_picks";
    while (eintraege.length < maxPicks) {
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
};

/** Mensch-Pick: am eigenen Platz (geordnete Phase) oder im Nachzug. Kauf ueber den Produktionsweg der Kauf-Route. */
export function bucheMenschPick(input: {
  persistence: PersistenceService;
  saveId: string;
  teamId: string;
  playerId: string;
  erwarteteNr?: number | null;
  idempotencyKey?: string;
}): LigaDraftMenschPickErgebnis {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    if (input.erwarteteNr != null && draft.verlauf.length !== input.erwarteteNr) {
      throw new LigaDraftFehler("draft_stand_veraltet");
    }
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
      localRunContext: ctx,
      deferPersist: true,
    });
    if (!kauf.transferCreated || !kauf.transferId) {
      throw new LigaDraftFehler(kauf.blockingReasons[0] ?? "kauf_nicht_moeglich");
    }
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
    return { draft: naechster, transferId: kauf.transferId, abloese: kauf.purchasePrice ?? preis, gehalt: kauf.offeredSalary ?? kauf.salary ?? null };
  });
}

export function bucheMenschAuslassen(input: {
  persistence: PersistenceService;
  saveId: string;
  teamId: string;
  erwarteteNr?: number | null;
}): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    if (input.erwarteteNr != null && draft.verlauf.length !== input.erwarteteNr) {
      throw new LigaDraftFehler("draft_stand_veraltet");
    }
    pruefeMenschTeam(draft, input.teamId);
    const zug = werIstDran(draft);
    if (!zug || zug.teamId !== input.teamId) throw new LigaDraftFehler("nicht_am_zug");
    const naechster = bucheAuslassen({ draft, gameState: ctx.save.gameState, teamId: input.teamId, jetzt: jetztIso() });
    setzeDraftImKontext(ctx, naechster);
    return naechster;
  });
}

/** „Ich bin fertig“: ab dem Mindestkader, jederzeit (auch ausserhalb des eigenen Zugs) und im Nachzug. */
export function bucheMenschFertig(input: { persistence: PersistenceService; saveId: string; teamId: string }): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    const team = pruefeMenschTeam(draft, input.teamId);
    if (team.status === "fertig") return draft;
    if (kaderGroesse(ctx.save.gameState, input.teamId) < draft.regeln.minKader) {
      throw new LigaDraftFehler("kader_unter_minimum");
    }
    const naechster = bucheAusstieg({
      draft,
      gameState: ctx.save.gameState,
      teamId: input.teamId,
      grund: "mensch_fertig",
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
}): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
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

export function setzeMenschAutoPick(input: {
  persistence: PersistenceService;
  saveId: string;
  teamId: string;
  an: boolean;
}): LigaDraftZustand {
  return mitFrischemStand(input.persistence, input.saveId, (ctx) => {
    const draft = draftAusKontext(ctx);
    pruefeMenschTeam(draft, input.teamId);
    const naechster = setzeAutoPick(draft, input.teamId, input.an, jetztIso());
    setzeDraftImKontext(ctx, naechster);
    return naechster;
  });
}

export { ligaDraftSperrtMarktkauf } from "@/lib/draft/liga-draft-modell";

// ---------------------------------------------------------------------------------------------------------------
// Hintergrundlauf (Ueberspringen A/B, reine KI-Liga)
// ---------------------------------------------------------------------------------------------------------------

const laufendeHintergrundLaeufe = new Set<string>();

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
}): Promise<{ halt: LigaDraftKiSchrittErgebnis["halt"] | "laeuft_schon"; picks: number }> {
  if (laufendeHintergrundLaeufe.has(input.saveId)) return { halt: "laeuft_schon", picks: 0 };
  laufendeHintergrundLaeufe.add(input.saveId);
  let picks = 0;
  try {
    for (;;) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      const ergebnis = laufeKiZuege({ persistence: input.persistence, saveId: input.saveId, maxPicks: input.jeHappen ?? 8 });
      picks += ergebnis.eintraege.length;
      if (ergebnis.halt !== "max_picks") return { halt: ergebnis.halt, picks };
    }
  } catch (error) {
    console.error(`${input.logPrefix} Liga-Draft (Einzelschritt): Hintergrundlauf abgebrochen:`, error);
    throw error;
  } finally {
    laufendeHintergrundLaeufe.delete(input.saveId);
  }
}

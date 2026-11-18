/**
 * LIGA-DRAFT IM EINZELSCHRITT — die KI-Entscheidung eines Teams für EINEN Pick, plus seine Top 3.
 *
 * Keine zweite Kauflogik: die Bewertung ist die organische KI aus dem Blocklauf (`buildOrganicDraftFrame` +
 * `organicBuyStep`, also `buyUtility`/`stopUtility` unverändert). Der Unterschied zum Blocklauf ist nur, WANN ein Team
 * entscheidet: nicht mehr den ganzen Kader am Stück, sondern einen Pick, wenn es an der Reihe ist.
 *
 * WIE DER ZUSTAND DES BLOCKLAUFS NACHGEBAUT WIRD. Der Blocklauf rechnet seinen Planrahmen (Rücklage, Puffer,
 * Komposition, Themen-Kontext, Vorstand) EINMAL zu Beginn des Teams und führt danach nur Kader, Kasse und Ausgaben
 * fort. Genau das passiert hier: der Rahmen wird aus dem Spielstand ZU DRAFT-BEGINN gebaut (Kader und Kasse aus
 * `startKaderIds`/`startKasse`, die eigenen Draft-Transfers ausgeblendet, Superstar-Lizenz festgehalten), und die
 * bisherigen Draft-Picks des Teams werden als Käufe dieses Plans eingespielt (`applyOrganicBuyStep`). Danach sieht der
 * Schritt denselben Zustand, den die Schleife an dieser Stelle hätte — nur mit dem Pool, den die anderen Teams
 * übriggelassen haben. Das ist der gewollte Unterschied.
 *
 * Kandidaten: alle Spieler ohne Kader in `gameState.players`-Reihenfolge. Das ist im frischen Saison-1-Stand genau der
 * Feed `listLocalTransfermarktFreeAgents({ fullPool: true })` des Blocklaufs (gemessen 18.11.: 2983 Spieler, gleiche
 * Reihenfolge; Test `liga-draft-kern.test.ts`), aber ohne dessen 0,5–0,8 s je Aufruf.
 */
import type { GameState, LigaDraftZustand, Player, Team } from "@/lib/data/olyDataTypes";
import {
  buildOrganicDraftFrame,
  istKaderplanAktiv,
  kaderplanPlatzPreise,
  toOrganicPlayerView,
  type KaderplanOptEntscheidung,
} from "@/lib/ai/organic-squad/draft-adapter";
import { computeDisciplineNeeds } from "@/lib/ai/organic-squad/discipline-need";
import { SOLIDE_THRESHOLD, type OrganicPlayerView } from "@/lib/ai/organic-squad/types";
import { buildLeagueMarketBrackets, type LeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import {
  applyOrganicBuyStep,
  createOrganicPlanStepState,
  istKaderplanStartpoolAktiv,
  kaderplanProtokoll,
  organicBuyStep,
  type KaderplanNotweg,
  type KaderplanProtokoll,
  type OrganicBuyStepResult,
} from "@/lib/ai/organic-squad/draft-builder";

/**
 * Anzeige-Grund einer Top-3-Karte (Mockup: „Star, Bedarf an einer Disziplin, Preis-Leistung, Kadertiefe“). Nur fuer die
 * Anzeige abgeleitet, die Entscheidung trifft allein die Bewertung. `bedarf` nennt eine Disziplin, in der das Team noch
 * keinen soliden Spieler hat und der Kandidat solide ist — das ist ein Marktsignal wie die Top 3 selbst.
 */
export type LigaDraftPickGrund =
  | { art: "star" }
  | { art: "bedarf"; disziplinId: string }
  | { art: "preis_leistung" }
  | { art: "kadertiefe" };

function pickGrund(
  spieler: OrganicPlayerView,
  offeneDisziplinen: readonly string[],
  brackets: LeagueMarketBrackets,
): LigaDraftPickGrund {
  if (spieler.marketValue >= brackets.star.floorMw) return { art: "star" };
  const bedarf = offeneDisziplinen.find((id) => (spieler.disciplineRatings[id] ?? 0) > SOLIDE_THRESHOLD);
  if (bedarf) return { art: "bedarf", disziplinId: bedarf };
  if (spieler.marketValue < brackets.core.floorMw) return { art: "preis_leistung" };
  return { art: "kadertiefe" };
}

export type LigaDraftKiBewertung = {
  teamId: string;
  kind: OrganicBuyStepResult["kind"];
  /** Bester Kandidat (die KI nimmt immer Platz 1). */
  bestPlayerId: string | null;
  top: Array<{ playerId: string; nutzen: number; marketValue: number; salary: number; grund: LigaDraftPickGrund }>;
  stopNutzen: number | null;
  /** Die Rücklage, mit der das Team plant (Saison 1: halb), und sein Zielkader. */
  ruecklage: number;
  optTarget: number;
  /**
   * KADERPLAN: Grund der Kadergroesse beim Stand VOR diesem Schritt (nur mit Kaderplan). Gilt fuer jeden Ausstieg: den, den die
   * KI waehlt (`kind !== "buy"`), und den, bei dem der Kauf selbst scheitert (Review S4).
   */
  kaderplan?: KaderplanProtokoll & { optEntscheidung?: KaderplanOptEntscheidung };
  /** KADERPLAN: Rueckfall, der Platz 1 geliefert hat (soll nie vorkommen; im Verlauf als `notweg:` gezaehlt). Ohne Kaderplan nie. */
  notweg?: KaderplanNotweg;
};

/** KADERPLAN: Platzpreise aus dem Pool zu DRAFT-BEGINN (alle Spieler ohne Startkader eines Draft-Teams). */
function platzPreiseZuDraftBeginn(gameState: GameState, draft: LigaDraftZustand): number[] {
  const startKader = new Set<string>();
  for (const team of Object.values(draft.teams)) for (const id of team.startKaderIds) startKader.add(id);
  return kaderplanPlatzPreise((gameState.players ?? []).filter((spieler) => !startKader.has(spieler.id)));
}

/** Spieler ohne Kader in Spielstand-Reihenfolge (= Feed des Blocklaufs im frischen Saison-1-Stand). */
export function freieSpieler(gameState: Pick<GameState, "players" | "rosters">): Player[] {
  const vergeben = new Set((gameState.rosters ?? []).map((eintrag) => eintrag.playerId));
  return (gameState.players ?? []).filter((spieler) => !vergeben.has(spieler.id));
}

/** Die Draft-Picks eines Teams in Pick-Reihenfolge (nur gebuchte, noch im Kader). */
function draftPickIdsDesTeams(draft: LigaDraftZustand, teamId: string): { playerIds: string[]; transferIds: Set<string> } {
  const playerIds: string[] = [];
  const transferIds = new Set<string>();
  for (const eintrag of draft.verlauf) {
    if (eintrag.teamId !== teamId || eintrag.art !== "pick" || !eintrag.playerId) continue;
    playerIds.push(eintrag.playerId);
    if (eintrag.transferId) transferIds.add(eintrag.transferId);
  }
  return { playerIds, transferIds };
}

/**
 * Der Spielstand, wie er für dieses Team zu Draft-Beginn aussah: eigener Kader = Startkader, Kasse = Startkasse, die
 * eigenen Draft-Transfers nicht in der Historie (sonst zählte der Vorstand sie doppelt). Alle anderen Teams bleiben,
 * wie sie JETZT sind — genau wie im Blocklauf, wo ein späteres Team die Käufe der früheren sah.
 */
function spielstandZuDraftBeginn(gameState: GameState, draft: LigaDraftZustand, teamId: string): GameState {
  const team = draft.teams[teamId]!;
  const startIds = new Set(team.startKaderIds);
  const { transferIds } = draftPickIdsDesTeams(draft, teamId);
  return {
    ...gameState,
    rosters: gameState.rosters.filter((eintrag) => eintrag.teamId !== teamId || startIds.has(eintrag.playerId)),
    teams: gameState.teams.map((eintrag) => (eintrag.teamId === teamId ? { ...eintrag, cash: team.startKasse } : eintrag)),
    transferHistory: (gameState.transferHistory ?? []).filter((eintrag) => !transferIds.has(eintrag.id)),
  };
}

/** KADERPLAN: die Notwege, die die bisherigen Picks des Teams im Verlauf gemeldet haben (`notweg:<art>`). */
function bisherigeNotwege(draft: LigaDraftZustand, teamId: string): KaderplanNotweg[] {
  const notwege: KaderplanNotweg[] = [];
  for (const eintrag of draft.verlauf) {
    if (eintrag.teamId !== teamId || eintrag.art !== "pick") continue;
    const treffer = /^notweg:([a-z_]+)$/.exec(eintrag.grund ?? "");
    if (treffer) notwege.push(treffer[1] as KaderplanNotweg);
  }
  return notwege;
}

export function draftSaatFuerTeam(saveId: string, teamId: string): string {
  // Dieselbe Saat wie im Blocklauf (`runOrganicTeamDraftExecute`: `${saveId}:${teamId}`) — gleicher Jitter je Spieler.
  return `${saveId}:${teamId}`;
}

/**
 * Bewertet den nächsten Pick eines Teams: Top-N der Kandidaten und die Entscheidung (kaufen / aufhören). Rein lesend.
 * `freiePool` kann übergeben werden, wenn mehrere Teams gegen denselben Stand bewertet werden.
 */
export function bewerteKiPick(input: {
  gameState: GameState;
  saveId: string;
  draft: LigaDraftZustand;
  teamId: string;
  topN?: number;
  freiePool?: Player[];
}): LigaDraftKiBewertung {
  const { gameState, draft, teamId } = input;
  const kaderplanAn = istKaderplanAktiv(gameState);
  const draftTeam = draft.teams[teamId];
  if (!draftTeam) throw new Error(`liga_draft_team_unbekannt:${teamId}`);
  const startStand = spielstandZuDraftBeginn(gameState, draft, teamId);
  const team = startStand.teams.find((eintrag) => eintrag.teamId === teamId) as Team | undefined;
  if (!team) throw new Error(`liga_draft_team_nicht_im_spielstand:${teamId}`);
  const spielerById = new Map(gameState.players.map((spieler) => [spieler.id, spieler]));
  const startKader = draftTeam.startKaderIds
    .map((id) => spielerById.get(id))
    .filter((spieler): spieler is Player => spieler != null);

  const frame = buildOrganicDraftFrame({
    gameState: startStand,
    team,
    identity: startStand.teamIdentities.find((eintrag) => eintrag.teamId === teamId),
    startingSquad: startKader,
    candidates: input.freiePool ?? freieSpieler(gameState),
    draftSeed: draftSaatFuerTeam(input.saveId, teamId),
    superstarLizenz: draftTeam.superstarLizenz ?? undefined,
    platzPreise: kaderplanAn && istKaderplanStartpoolAktiv() ? platzPreiseZuDraftBeginn(gameState, draft) : undefined,
    // Wettbewerb um die billigen Plaetze: alle Teams, die noch in der Reihenfolge picken (ohne Nachzug und fertige).
    platzWettbewerb: kaderplanAn
      ? Math.max(1, Object.values(draft.teams).filter((eintrag) => eintrag.status === "aktiv").length)
      : undefined,
  });

  // Bisherige Draft-Picks als Käufe dieses Plans einspielen (gleiche Sicht wie im Rahmen: ohne Theme-Fit, mit Potenzial).
  const schritt = createOrganicPlanStepState(frame.planInput);
  const kaderIds = new Set(gameState.rosters.filter((eintrag) => eintrag.teamId === teamId).map((eintrag) => eintrag.playerId));
  for (const playerId of draftPickIdsDesTeams(draft, teamId).playerIds) {
    const spieler = spielerById.get(playerId);
    if (!spieler || !kaderIds.has(playerId)) continue;
    applyOrganicBuyStep(frame.planInput, schritt, toOrganicPlayerView(spieler, undefined, undefined, undefined, gameState));
  }
  // Die echte Kasse gilt (Ablöse = Marktwert beim Kauf; weicht sie ab, zählt das Konto, nicht die Rechnung).
  schritt.cash = gameState.teams.find((eintrag) => eintrag.teamId === teamId)?.cash ?? schritt.cash;

  const ergebnis = organicBuyStep(frame.planInput, schritt, { topN: Math.max(1, input.topN ?? 3) });
  // Review S4: das Protokoll auch beim Kauf, denn scheitert der Kauf im Dienst (`kaufeMitNachruecken`), ist DAS der Ausstieg.
  // Die Notwege der bisherigen Picks dieses Teams (im Verlauf als `notweg:` gebucht) zaehlen ins Protokoll, damit es dieselbe Liste
  // fuehrt wie der Blocklauf und einen gemeldeten Fueller nicht doppelt zaehlt.
  const kaderplan = kaderplanAn
    ? {
        ...kaderplanProtokoll(frame.planInput, createOrganicPlanStepState(frame.planInput), schritt, bisherigeNotwege(draft, teamId)),
        optEntscheidung: frame.optEntscheidung,
      }
    : undefined;
  const offeneDisziplinen = computeDisciplineNeeds(schritt.squad, frame.planInput.identityAxisWeights, frame.planInput.disciplines)
    .filter((bedarf) => bedarf.coveredCount === 0)
    .sort((a, b) => b.needWeight - a.needWeight)
    .map((bedarf) => bedarf.disciplineId);
  const brackets =
    frame.planInput.composition?.brackets ?? buildLeagueMarketBrackets(frame.planInput.candidates.map((view) => view.marketValue));
  return {
    teamId,
    kind: ergebnis.kind,
    bestPlayerId: ergebnis.best?.playerId ?? null,
    top: ergebnis.top.map((eintrag) => ({
      playerId: eintrag.playerId,
      nutzen: Math.round(eintrag.utility * 100) / 100,
      marketValue: eintrag.player.marketValue,
      salary: eintrag.player.salary,
      grund: pickGrund(eintrag.player, offeneDisziplinen, brackets),
    })),
    stopNutzen: ergebnis.stopUtility == null ? null : Math.round(ergebnis.stopUtility * 100) / 100,
    ruecklage: frame.ruecklage,
    optTarget: frame.optTarget,
    kaderplan,
    // Review K3: nur mit Kaderplan (der Builder setzt `notweg` ohnehin nur dann).
    notweg: kaderplanAn && ergebnis.kind === "buy" ? ergebnis.notweg : undefined,
  };
}

/** Superstar-Lizenzen zu Draft-Beginn (je Team einmal, s. `OrganicDraftPlanInput.superstarLizenz`). */
export function superstarLizenzZuDraftBeginn(input: { gameState: GameState; saveId: string; teamId: string; freiePool: Player[] }): boolean | null {
  const team = input.gameState.teams.find((eintrag) => eintrag.teamId === input.teamId);
  if (!team) return null;
  const spielerById = new Map(input.gameState.players.map((spieler) => [spieler.id, spieler]));
  const startKader = input.gameState.rosters
    .filter((eintrag) => eintrag.teamId === input.teamId)
    .map((eintrag) => spielerById.get(eintrag.playerId))
    .filter((spieler): spieler is Player => spieler != null);
  return buildOrganicDraftFrame({
    gameState: input.gameState,
    team,
    identity: input.gameState.teamIdentities.find((eintrag) => eintrag.teamId === input.teamId),
    startingSquad: startKader,
    candidates: input.freiePool,
    draftSeed: draftSaatFuerTeam(input.saveId, input.teamId),
  }).superstarLizenz;
}

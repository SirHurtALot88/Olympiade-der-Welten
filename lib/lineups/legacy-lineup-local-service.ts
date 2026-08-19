import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { requireLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import type { PersistenceService } from "@/lib/persistence/types";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  buildGeneratedFormCardRecordsForSeason,
  createDefaultLineupDraftModifiers,
  ensureLocalFormCardsForSeason,
  getTeamFormCardOptions,
  buildLegacyMutatorTraitOptionsForRoster,
  normalizeLineupDraftModifiers,
} from "@/lib/lineups/legacy-lineup-modifiers";
import { getLocalModifierSourceBundle } from "@/lib/lineups/legacy-modifier-source-contract";
import { ensureSeasonApronLinesFrozen } from "@/lib/season/apron-settlement-service";
import {
  ensureLocalTeamPowersForSeason,
  getTeamPowerOptions,
} from "@/lib/lineups/team-powers";
import { buildLineupDisciplineContract, buildMatchdayLineupContract, countSeasonCaptains, countSeasonLineupDisciplineSides, createLineupDraftId, formatLineupTeamStatusLabel, getSeasonCaptainDisciplineSideKeys, SEASON_CAPTAIN_SLOTS } from "@/lib/lineups/lineup-discipline-contract";
import { computeTeamDisciplineRankTable, computeTeamDisciplineRanks } from "@/lib/lineups/team-discipline-ranks";
import { getTeamRelationship } from "@/lib/rivalries/team-rivalries";
import type { FormCardPlanRecord, GameState, LineupDraft, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import type {
  LegacyInjuryRiskProjectionRef,
  LegacyLineupContextLoadResult,
  LegacyLineupDraft,
  LegacyLineupEntryInput,
  LegacyLineupKeyParams,
  LegacyLineupLoadedContext,
  LegacyLineupPreviewResult,
  LegacyLineupSaveResult,
  LegacyLineupValidationOptions,
} from "@/lib/lineups/legacy-lineup-types";
import { getImportedPlayerDisplayMarketValue, getImportedPlayerDisplaySalary } from "@/lib/data/player-economy-display";
import { getFatiguePerformanceMultiplier } from "@/lib/fatigue/fatigue-calibration";
import { getInjuryRiskBand, getPlayerAvailabilityView, projectMatchdayInjuryRisk } from "@/lib/fatigue/fatigue-injury-service";
import { resolveLineupStrategyForTeam } from "@/lib/ai/ai-manager-doctrine-service";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import { calculateLocalLegacyLineupPreviewFromContext } from "@/lib/lineups/legacy-lineup-preview-from-context";
import { isTeamMatchdayLineupOperationallyReady } from "@/lib/foundation/matchday-lineup-readiness";
import { officialDisciplineWeightTable, playerGeneratorAttributeKeys, type OfficialDisciplineWeightId } from "@/lib/player-generator/official-discipline-weights";
import { getSeasonDisciplineScheduleEntry, withNormalizedSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { resolvePlayerPotentialScoreFromGameState } from "@/lib/scouting/player-attribute-ceiling-service";
import { DEFAULT_ACTIVE_OWNER_ID, canLocalUserManageTeam } from "@/lib/foundation/team-control-settings";
import { canFoundationLocalUserManageTeam } from "@/lib/foundation/foundation-admin-dev-flags";

function roundScore(value: number) {
  return Number(value.toFixed(2));
}

// Audit S4: legacy lineup drafts/form cards are gameplay writes keyed on `LegacyLineupKeyParams`,
// whose `saveId` is always required — an unresolved id must never silently fall back to "the
// active save" (which, per co-op owner, could be a different player's save entirely).
function resolveLocalSave(saveId?: string, persistence: PersistenceService = createPersistenceService()) {
  return requireLocalPersistedSave(persistence, saveId);
}

function toLegacyDraft(draft: LineupDraft): LegacyLineupDraft {
  return {
    lineupId: draft.lineupId,
    saveId: draft.saveId,
    seasonId: draft.seasonId,
    matchdayId: draft.matchdayId,
    teamId: draft.teamId,
    status: draft.status,
    entries: [...draft.entries].sort((left, right) => {
      if (left.disciplineId !== right.disciplineId) {
        return left.disciplineId.localeCompare(right.disciplineId);
      }
      if (left.disciplineSide !== right.disciplineSide) {
        return left.disciplineSide.localeCompare(right.disciplineSide);
      }
      return left.slotIndex - right.slotIndex;
    }),
    modifiers: normalizeLineupDraftModifiers(draft.modifiers),
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

function getStoredDrafts(gameState: GameState) {
  return gameState.seasonState.lineupDrafts ?? [];
}

function clearMissingFormCardSelections(
  draft: LineupDraft,
  validCardIds: Set<string>,
): LineupDraft {
  const modifiers = normalizeLineupDraftModifiers(draft.modifiers);
  const sanitizeCardId = (value: string | null | undefined) => (value && validCardIds.has(value) ? value : null);

  return {
    ...draft,
    modifiers: {
      d1: {
        ...modifiers.d1,
        primaryFormCardId: sanitizeCardId(modifiers.d1.primaryFormCardId),
        secondaryFormCardId: sanitizeCardId(modifiers.d1.secondaryFormCardId),
      },
      d2: {
        ...modifiers.d2,
        primaryFormCardId: sanitizeCardId(modifiers.d2.primaryFormCardId),
        secondaryFormCardId: sanitizeCardId(modifiers.d2.secondaryFormCardId),
      },
    },
  };
}

function getStoredDraft(gameState: GameState, params: LegacyLineupKeyParams) {
  const draft = getStoredDrafts(gameState).find(
    (entry) =>
      entry.saveId === params.saveId &&
      entry.seasonId === params.seasonId &&
      entry.matchdayId === params.matchdayId &&
      entry.teamId === params.teamId,
  );
  return draft ? toLegacyDraft(draft) : null;
}

function buildDisciplineSidePlayerCounts(context: LegacyLineupLoadedContext) {
  const result: Record<string, number> = {};
  const d1 = context.matchdayContract?.discipline1;
  const d2 = context.matchdayContract?.discipline2;
  if (d1?.requiredPlayers != null) {
    result[`${d1.disciplineId}::d1`] = d1.requiredPlayers;
  }
  if (d2?.requiredPlayers != null) {
    result[`${d2.disciplineId}::d2`] = d2.requiredPlayers;
  }
  return result;
}

function buildTeamStatus(gameState: GameState, teamId: string, seasonId: string) {
  const allDrafts = getStoredDrafts(gameState);
  const captainUsedSides = Array.from(
    getSeasonCaptainDisciplineSideKeys({
      lineups: allDrafts,
      teamId,
      seasonId,
    }),
  );
  return {
    lineupFilledCount: countSeasonLineupDisciplineSides({
      lineups: allDrafts,
      teamId,
      seasonId,
    }),
    captainUsedCount: countSeasonCaptains({
      lineups: allDrafts,
      teamId,
      seasonId,
    }),
    captainUsedSides,
  };
}

function buildLocalFatigueMap(gameState: GameState, params: LegacyLineupKeyParams) {
  const normalizedGameState = withNormalizedSeasonDisciplineSchedule(gameState, params.saveId);
  const season = normalizedGameState.season.id === params.seasonId ? normalizedGameState.season : null;
  if (!season) {
    return null;
  }

  const fatigueMap: Record<string, { count: number; multiplier: number }> = {};
  for (const roster of normalizedGameState.rosters.filter((entry) => entry.teamId === params.teamId)) {
    const player = normalizedGameState.players.find((entry) => entry.id === roster.playerId);
    if (!player) {
      continue;
    }
    const availability = getPlayerAvailabilityView(
      normalizedGameState,
      roster.playerId,
      params.teamId,
      params.matchdayId,
    );
    const fatigue = availability.fatigue ?? player.fatigue ?? 0;
    fatigueMap[roster.playerId] = {
      count: fatigue,
      multiplier: getFatiguePerformanceMultiplier(fatigue),
    };
  }

  return fatigueMap;
}

type SharedLineupContextBase = {
  normalizedGameState: GameState;
  season: GameState["season"];
  matchday: {
    id: string;
    seasonId: string;
    index: number;
    label: string;
    fixtureIds: string[];
    status: string;
  };
  lineupContract: ReturnType<typeof buildLineupDisciplineContract>;
  matchdayContract: ReturnType<typeof buildMatchdayLineupContract>;
  requiredDisciplineIds: string[];
  rankDisciplineIds: string[];
  playersById: Map<string, Player>;
  rosterEntriesByTeamId: Map<string, RosterEntry[]>;
  teamById: Map<string, GameState["teams"][number]>;
  teamIdentityByTeamId: Map<string, NonNullable<GameState["teamIdentities"][number]>>;
  localDisciplineWeights: Array<{
    disciplineId: string;
    attributeKey: string;
    weightPct: number;
  }>;
  scoreByPlayerAndDiscipline: Map<string, number>;
  fatigueByTeamId: Map<string, ReturnType<typeof buildLocalFatigueMap>>;
  teamDisciplineRanksByTeamId: Map<string, ReturnType<typeof computeTeamDisciplineRanks>>;
  disciplineRankTable: ReturnType<typeof computeTeamDisciplineRankTable>;
  teamNameById: Map<string, string>;
};

// Befund B5/3 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Stufe 2.3): der Schluessel enthielt frueher
// zusaetzlich eine `lineupDraftSignature` ueber ALLE gespeicherten Entwuerfe (jedes Team, jeder
// Spieltag). Jedes menschliche Speichern eines EINZELNEN Teams veraenderte damit die Signatur und
// entwertete den Cache GLOBAL — auch fuer Teams, deren Kontext laengst berechnet war. Der Effekt:
// wer nacheinander vier eigene Teams speichert, zahlt den vollen Kaltaufbau viermal, obwohl sich
// an den drei anderen Teams nichts geaendert hat (gemessen: siehe Kommentar an
// `sharedLineupContextBaseCacheStats` unten).
//
// Die TEUREN Teile von `SharedLineupContextBase` (Rangtabelle, Score-Map, Gewichte,
// Spieler-/Kader-Karten) haengen ausschliesslich an Spielern/Kadern/Disziplinen — NICHT an
// `lineupDrafts`, `playerMoraleState` oder sonst einem sich staendig aendernden Feld. Der
// Cache-SCHLUESSEL laesst die Entwurfs-Signatur deshalb weg (siehe
// `buildSharedLineupContextBaseCacheKey`). ABER: `normalizedGameState` selbst — und darueber
// `context.gameState`, `existingDraft`, `teamStatus` — MUESSEN bei jedem Aufruf den AKTUELLEN
// Spielstand zeigen (Moral, Formkarten-Plaene, Aufstellungen, ...), sonst saehe ein
// nachgelagerter Verbraucher (Moral-/Kapitaens-Aufloesung beim Spieltag-Resolve) auf einen
// Spielstand von VOR dem Speichern zurueck. Deshalb wird `normalizedGameState` bei einem
// Cache-TREFFER unten IMMER frisch aus dem aktuellen `gameStateWithPowers` gebaut
// (`withNormalizedSeasonDisciplineSchedule` ist ein O(Spieltage)-Normalisierungsschritt, nicht die
// teure Rangtabellen-Berechnung) — nur die uebrigen, tatsaechlich invarianten Felder kommen aus
// dem Cache. Statt den Schluessel "je Team" zu fuehren (was den geteilten Aufbau erneut N-fach
// vervielfacht haette, nur mit einer anderen Ursache), bleibt so der teure Teil EINMAL gebaut,
// waehrend der Spielstand selbst nie stehen bleibt.
const sharedLineupContextBaseCache = new Map<
  string,
  { value: SharedLineupContextBase; insertedAtMs: number; lastAccessMs: number }
>();

// Unbegrenztes Wachstum (Befund B5/3: "new Map() ohne Verfall") war der zweite Teil des Lochs:
// ein lang laufender Node-Prozess (Server, lange Testsuite) haette hier fuer jeden je gesehenen
// (saveId, seasonId, matchdayId)-Dreiklang einen Eintrag behalten. Bewusst simpel: TTL zuerst
// (raeumt inaktive Saves/Spieltage weg), danach eine harte Obergrenze nach LRU (raeumt auf, falls
// binnen der TTL viele verschiedene Kombinationen aktiv sind, z. B. mehrere Tabs/Tests parallel).
const SHARED_LINEUP_CONTEXT_BASE_CACHE_TTL_MS = 10 * 60 * 1000;
const SHARED_LINEUP_CONTEXT_BASE_CACHE_MAX_ENTRIES = 16;

/**
 * NUR FUER MESSUNG/TESTS (Hausregel „miss, was du behauptest"): zaehlt Treffer/Fehlschlaege des
 * geteilten Kontext-Caches, ohne das Produktionsverhalten zu beeinflussen. Wird von
 * `resetSharedLineupContextBaseCacheForTests` mit zurueckgesetzt.
 */
const sharedLineupContextBaseCacheStats = { hits: 0, misses: 0 };

export function getSharedLineupContextBaseCacheStatsForTests() {
  return { ...sharedLineupContextBaseCacheStats };
}

export function resetSharedLineupContextBaseCacheForTests() {
  sharedLineupContextBaseCache.clear();
  sharedLineupContextBaseCacheStats.hits = 0;
  sharedLineupContextBaseCacheStats.misses = 0;
}

function pruneSharedLineupContextBaseCache(now: number) {
  for (const [key, entry] of sharedLineupContextBaseCache) {
    if (now - entry.insertedAtMs > SHARED_LINEUP_CONTEXT_BASE_CACHE_TTL_MS) {
      sharedLineupContextBaseCache.delete(key);
    }
  }
  while (sharedLineupContextBaseCache.size > SHARED_LINEUP_CONTEXT_BASE_CACHE_MAX_ENTRIES) {
    // Map erhaelt Einfuegereihenfolge — nach jedem Zugriff wird der Eintrag unten neu gesetzt
    // (`delete` + `set`), rueckt also ans Ende. Der erste Key ist damit der am laengsten
    // unbenutzte (LRU), nicht bloss der aelteste eingefuegte.
    const oldestKey = sharedLineupContextBaseCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    sharedLineupContextBaseCache.delete(oldestKey);
  }
}

function buildSharedLineupContextBaseCacheKey(gameState: GameState, params: LegacyLineupKeyParams) {
  const rosterSignature = gameState.rosters
    .map((entry) => `${entry.teamId}:${entry.playerId}:${entry.salary}:${entry.contractLength}`)
    .sort()
    .join("|");
  return [
    params.saveId,
    params.seasonId,
    params.matchdayId,
    gameState.players.length,
    gameState.disciplines.length,
    gameState.rosters.length,
    gameState.seasonState.formCards?.length ?? 0,
    gameState.seasonState.teamPowers?.length ?? 0,
    JSON.stringify(gameState.seasonState.teamFacilities ?? {}),
    rosterSignature,
  ].join("::");
}

/**
 * Loest `season`/`matchday` (inkl. `matchday.status`) und `matchdayContract` aus dem AKTUELLEN
 * `normalizedGameState` auf — die EINE Rechenstelle dafuer, von Cache-Treffer UND Cache-Aufbau
 * gleichermassen benutzt (Befund B4, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Stufe 2.3 nachgezogen).
 *
 * WARUM DIESE DREI FELDER NICHT AUS DEM CACHE-WERT KOMMEN DUERFEN: `buildSharedLineupContextBaseCacheKey`
 * enthaelt weder `matchdayState.status` noch `seasonState.disciplineSchedule` — ein Spieltag, der
 * waehrend die uebrigen Schluessel-Groessen (Roster/Spieler/Disziplinen/Formkarten/Team-Powers/
 * -Einrichtungen) unveraendert bleiben den Status wechselt (z. B. Sperren/Freigeben beim
 * Sammel-Speichern, Stufe 2.1), traf bislang bis zu `SHARED_LINEUP_CONTEXT_BASE_CACHE_TTL_MS` lang
 * auf einen Cache-Treffer, der noch den ALTEN Status/Contract auslieferte — derselbe Fehler wie bei
 * `existingDraft`/`teamStatus`/`context.gameState` (siehe Kommentar an `getSharedLineupContextBase`
 * unten), hier nur uebersehen, weil `matchday`/`matchdayContract` Teil des gecachten WERTS sind,
 * nicht separat nachgeschaerft wurden.
 *
 * `requiredDisciplineIds`/`rankDisciplineIds` (und alles, was darauf aufbaut: Score-Map, Gewichte,
 * Rangtabelle) bleiben BEWUSST aus dem Cache-Wert — die haengen an `disciplineSchedule` nur
 * mittelbar (welche Disziplin an diesem Spieltag laeuft), und diese Zuordnung steht fuer die
 * gesamte Saison fest, sobald sie einmal generiert ist. Sie neu aufzuloesen wuerde den teuren Teil
 * des Caches wieder entwerten, den Stufe 2.3 gerade erst geteilt hat.
 */
function resolveFreshMatchdayContext(
  normalizedGameState: GameState,
  params: LegacyLineupKeyParams,
): Pick<SharedLineupContextBase, "season" | "matchday" | "matchdayContract"> | null {
  const season = normalizedGameState.season.id === params.seasonId ? normalizedGameState.season : null;
  const matchdayIndex = season ? season.matchdayIds.findIndex((matchdayId) => matchdayId === params.matchdayId) : -1;
  const scheduleEntry =
    season && matchdayIndex >= 0 ? getSeasonDisciplineScheduleEntry(normalizedGameState, params.matchdayId) : null;
  const matchday =
    season && matchdayIndex >= 0
      ? {
          id: params.matchdayId,
          seasonId: params.seasonId,
          index: matchdayIndex + 1,
          label: scheduleEntry?.matchdayLabel ?? `Spieltag ${matchdayIndex + 1}`,
          fixtureIds: [],
          status:
            normalizedGameState.matchdayState.matchdayId === params.matchdayId ? normalizedGameState.matchdayState.status : "planning",
        }
      : null;

  if (!season || !matchday) {
    return null;
  }

  const matchdayContract = buildMatchdayLineupContract({
    season,
    matchday,
    disciplines: normalizedGameState.disciplines,
    disciplineSchedule: normalizedGameState.seasonState.disciplineSchedule,
  });

  return { season, matchday, matchdayContract };
}

/**
 * Ein Cache-Treffer teilt sich die TEUREN, tatsaechlich invarianten Teile (Rangtabelle, Score-Map,
 * Spieler-/Kader-Karten, Gewichte) — `normalizedGameState` selbst gehoert NICHT dazu (siehe
 * Kommentar an `sharedLineupContextBaseCache`) und wird deshalb bei JEDEM Treffer frisch gebaut.
 * Ebenso `season`/`matchday`/`matchdayContract` — siehe `resolveFreshMatchdayContext`.
 *
 * Ohne dieses Nachschaerfen wuerde jeder Verbraucher, der ueber `context.gameState` liest
 * (Moral-/Kapitaens-Aufloesung beim Resolve, `existingDraft`, `teamStatus`), nach einem
 * Speichervorgang mit demselben Cache-Schluessel (Roster/Spieler/Disziplinen unveraendert) auf den
 * ALTEN Spielstand zurueckfallen — genau der Fehler, den die fruehere, teure Entwurfs-Signatur nur
 * zufaellig verhinderte, weil sie bei jedem Speichern ohnehin ALLES ungueltig machte.
 * `withNormalizedSeasonDisciplineSchedule` ist ein O(Spieltage)-Schritt, keine Neuberechnung der
 * Rangtabelle — der teure Teil bleibt geteilt.
 */
function getSharedLineupContextBase(gameState: GameState, params: LegacyLineupKeyParams): SharedLineupContextBase | null {
  const gameStateWithFormCards = ensureLocalFormCardsForSeason(gameState, params.saveId, params.seasonId);
  const hasCurrentSeasonPowers = (gameStateWithFormCards.seasonState.teamPowers ?? []).some(
    (power) => power.seasonId === params.seasonId,
  );
  const gameStateWithPowers = hasCurrentSeasonPowers
    ? gameStateWithFormCards
    : ensureLocalTeamPowersForSeason(gameStateWithFormCards, params.saveId, params.seasonId);
  const cacheKey = buildSharedLineupContextBaseCacheKey(gameStateWithPowers, params);
  const now = Date.now();
  pruneSharedLineupContextBaseCache(now);
  const cached = sharedLineupContextBaseCache.get(cacheKey);
  if (cached && now - cached.insertedAtMs <= SHARED_LINEUP_CONTEXT_BASE_CACHE_TTL_MS) {
    sharedLineupContextBaseCacheStats.hits += 1;
    // Ans Ende der Einfuegereihenfolge ruecken (LRU-Verwendung, siehe `pruneSharedLineupContextBaseCache`).
    sharedLineupContextBaseCache.delete(cacheKey);
    cached.lastAccessMs = now;
    sharedLineupContextBaseCache.set(cacheKey, cached);
    const normalizedGameStateOnHit = withNormalizedSeasonDisciplineSchedule(gameStateWithPowers, params.saveId);
    // Befund B4: `matchday`/`matchdayContract` muessen bei JEDEM Treffer neu aufgeloest werden,
    // nicht aus `cached.value` uebernommen — siehe Kommentar an `resolveFreshMatchdayContext`.
    const freshMatchdayContext = resolveFreshMatchdayContext(normalizedGameStateOnHit, params);
    if (!freshMatchdayContext) {
      return null;
    }
    return {
      ...cached.value,
      normalizedGameState: normalizedGameStateOnHit,
      season: freshMatchdayContext.season,
      matchday: freshMatchdayContext.matchday,
      matchdayContract: freshMatchdayContext.matchdayContract,
    };
  }
  sharedLineupContextBaseCacheStats.misses += 1;

  const normalizedGameState = withNormalizedSeasonDisciplineSchedule(gameStateWithPowers, params.saveId);
  const freshMatchdayContext = resolveFreshMatchdayContext(normalizedGameState, params);
  if (!freshMatchdayContext) {
    return null;
  }
  const { season, matchday, matchdayContract } = freshMatchdayContext;

  const playersById = new Map(normalizedGameState.players.map((player) => [player.id, player] as const));
  const rosterEntriesByTeamId = new Map<string, RosterEntry[]>();
  for (const rosterEntry of normalizedGameState.rosters) {
    const existing = rosterEntriesByTeamId.get(rosterEntry.teamId);
    if (existing) {
      existing.push(rosterEntry);
    } else {
      rosterEntriesByTeamId.set(rosterEntry.teamId, [rosterEntry]);
    }
  }

  const lineupContract = buildLineupDisciplineContract(normalizedGameState.disciplines);
  const requiredDisciplineIds = [matchdayContract.discipline1?.disciplineId, matchdayContract.discipline2?.disciplineId].filter(
    (value): value is string => Boolean(value),
  );
  const rankDisciplineIds = Array.from(
    new Set(normalizedGameState.disciplines.map((discipline) => discipline.id).filter((value): value is string => Boolean(value))),
  );
  const scoreDisciplineIds = Array.from(new Set([...requiredDisciplineIds, ...rankDisciplineIds]));

  const scoreByPlayerAndDiscipline = new Map<string, number>();
  for (const player of normalizedGameState.players) {
    for (const disciplineId of scoreDisciplineIds) {
      scoreByPlayerAndDiscipline.set(`${player.id}::${disciplineId}`, roundScore(player.disciplineRatings[disciplineId] ?? 0));
    }
  }

  const localDisciplineWeights = requiredDisciplineIds.flatMap((disciplineId) =>
    playerGeneratorAttributeKeys
      .map((attributeKey) => ({
        disciplineId,
        attributeKey,
        weightPct: officialDisciplineWeightTable[attributeKey][disciplineId as OfficialDisciplineWeightId] ?? 0,
      }))
      .filter((entry) => entry.weightPct > 0)
      .sort((left, right) => right.weightPct - left.weightPct),
  );
  const rosterAssignments = normalizedGameState.rosters.map((entry) => ({
    teamId: entry.teamId,
    playerId: entry.playerId,
  }));
  const disciplineRankTable = computeTeamDisciplineRankTable({
    teamIds: normalizedGameState.teams.map((entry) => entry.teamId),
    disciplineIds: rankDisciplineIds.length > 0 ? rankDisciplineIds : requiredDisciplineIds,
    rosterAssignments,
    scoreByPlayerAndDiscipline,
  });
  const mappedDisciplineRankIds = rankDisciplineIds.length > 0 ? rankDisciplineIds : requiredDisciplineIds;
  const teamDisciplineRanksByTeamId = new Map<string, ReturnType<typeof computeTeamDisciplineRanks>>();
  for (const team of normalizedGameState.teams) {
    teamDisciplineRanksByTeamId.set(
      team.teamId,
      Object.fromEntries(
        mappedDisciplineRankIds.map((disciplineId) => {
          const row = disciplineRankTable.find(
            (entry) => entry.teamId === team.teamId && entry.disciplineId === disciplineId,
          );
          return [
            disciplineId,
            row
              ? {
                  rank: row.rank,
                  score: row.score,
                  sourceStatus: "mapped_with_transform" as const,
                  rankSource: "active_roster_top6_sum_discipline_score",
                }
              : {
                  rank: null,
                  score: null,
                  sourceStatus: "missing_source" as const,
                  rankSource: null,
                },
          ] as const;
        }),
      ),
    );
  }

  const sharedBase: SharedLineupContextBase = {
    normalizedGameState,
    season,
    matchday,
    lineupContract,
    matchdayContract,
    requiredDisciplineIds,
    rankDisciplineIds,
    playersById,
    rosterEntriesByTeamId,
    teamById: new Map(normalizedGameState.teams.map((team) => [team.teamId, team] as const)),
    teamIdentityByTeamId: new Map(normalizedGameState.teamIdentities.map((identity) => [identity.teamId, identity] as const)),
    localDisciplineWeights,
    scoreByPlayerAndDiscipline,
    fatigueByTeamId: new Map(),
    teamDisciplineRanksByTeamId,
    disciplineRankTable,
    teamNameById: new Map(normalizedGameState.teams.map((entry) => [entry.teamId, entry.name] as const)),
  };

  sharedLineupContextBaseCache.set(cacheKey, { value: sharedBase, insertedAtMs: now, lastAccessMs: now });
  pruneSharedLineupContextBaseCache(now);
  return sharedBase;
}

function buildContextFromGameState(gameState: GameState, params: LegacyLineupKeyParams): LegacyLineupContextLoadResult {
  const sharedBase = getSharedLineupContextBase(gameState, params);
  const normalizedGameState = sharedBase?.normalizedGameState ?? withNormalizedSeasonDisciplineSchedule(gameState, params.saveId);
  const season = sharedBase?.season ?? null;
  const matchday = sharedBase?.matchday ?? null;
  const team = sharedBase?.teamById.get(params.teamId) ?? normalizedGameState.teams.find((entry) => entry.teamId === params.teamId) ?? null;
  const teamIdentity =
    sharedBase?.teamIdentityByTeamId.get(params.teamId) ??
    normalizedGameState.teamIdentities.find((entry) => entry.teamId === params.teamId) ??
    null;
  const teamStrategyProfile = getTeamStrategyProfile(normalizedGameState, params.teamId);

  const errors: string[] = [];
  if (!season) errors.push(`Season ${params.seasonId} could not be found in the local save.`);
  if (!matchday) errors.push(`Matchday ${params.matchdayId} could not be found in the local save.`);
  if (!team) errors.push(`Team ${params.teamId} could not be found in the local save.`);
  if (!teamIdentity) errors.push(`Team identity for ${params.teamId} could not be found in the local save.`);

  if (errors.length > 0 || !season || !matchday || !team || !teamIdentity) {
    return {
      ok: false,
      errors,
      warnings: [],
    };
  }

  const lineupContract = sharedBase?.lineupContract ?? buildLineupDisciplineContract(normalizedGameState.disciplines);
  const matchdayContract =
    sharedBase?.matchdayContract ??
    buildMatchdayLineupContract({
      season,
      matchday,
      disciplines: normalizedGameState.disciplines,
      disciplineSchedule: normalizedGameState.seasonState.disciplineSchedule,
    });
  const requiredDisciplineIds = sharedBase?.requiredDisciplineIds ?? [
    matchdayContract.discipline1?.disciplineId,
    matchdayContract.discipline2?.disciplineId,
  ].filter((value): value is string => Boolean(value));
  const rankDisciplineIds =
    sharedBase?.rankDisciplineIds ??
    Array.from(
      new Set(normalizedGameState.disciplines.map((discipline) => discipline.id).filter((value): value is string => Boolean(value))),
    );
  const mappedDisciplineRankIds = rankDisciplineIds.length > 0 ? rankDisciplineIds : requiredDisciplineIds;
  const rosterEntries = sharedBase?.rosterEntriesByTeamId.get(params.teamId) ?? normalizedGameState.rosters.filter((entry) => entry.teamId === params.teamId);
  const playersById = sharedBase?.playersById ?? new Map(normalizedGameState.players.map((player) => [player.id, player]));
  const activePlayers = rosterEntries
    .map((entry) => ({
      entry,
      player: playersById.get(entry.playerId) ?? null,
    }))
    .filter((item): item is { entry: (typeof rosterEntries)[number]; player: NonNullable<ReturnType<typeof playersById.get>> } => Boolean(item.player));
  const availabilityByPlayerId = new Map(
    activePlayers.map(({ entry }) => [
      entry.playerId,
      getPlayerAvailabilityView(normalizedGameState, entry.playerId, params.teamId, params.matchdayId),
    ] as const),
  );
  // Wer NICHT einsatzfaehig ist, darf nicht mehr AUFGESTELLT werden — das ist die Auswahlliste.
  // Die Disziplinwerte (`disciplineScores`) haengen bewusst NICHT daran: eine bereits abgegebene
  // Aufstellung muss wertbar bleiben, auch wenn ein darin stehender Spieler inzwischen verletzt
  // ist. Sonst blockiert eine in D1 zugezogene Verletzung die Wertung von D2 desselben Spieltags
  // (`missing_scores`) — der Spieltag haengt dann dauerhaft. Der Server-Pfad
  // (`legacy-lineup-context-loader.ts`) fuehrt die Werte ebenfalls ungefiltert mit; der
  // Verletzungs-Abschlag kommt getrennt ueber `injuryByPlayerId`.
  const selectableActivePlayers = activePlayers.filter(({ entry }) => !availabilityByPlayerId.get(entry.playerId)?.isUnavailable);
  const existingDraft = getStoredDraft(normalizedGameState, params);
  const existingDraftLineupId = existingDraft?.lineupId ?? null;
  const teamStatus = buildTeamStatus(normalizedGameState, params.teamId, params.seasonId);
  const scoreByPlayerAndDiscipline = sharedBase?.scoreByPlayerAndDiscipline ?? new Map<string, number>();
  let teamDisciplineRanks = sharedBase?.teamDisciplineRanksByTeamId.get(params.teamId);
  if (!teamDisciplineRanks) {
    if (scoreByPlayerAndDiscipline.size === 0) {
      for (const player of normalizedGameState.players) {
        for (const disciplineId of mappedDisciplineRankIds) {
          scoreByPlayerAndDiscipline.set(`${player.id}::${disciplineId}`, roundScore(player.disciplineRatings[disciplineId] ?? 0));
        }
      }
    }
    teamDisciplineRanks = computeTeamDisciplineRanks({
      teamId: params.teamId,
      teamIds: normalizedGameState.teams.map((entry) => entry.teamId),
      disciplineIds: mappedDisciplineRankIds,
      rosterAssignments: normalizedGameState.rosters.map((entry) => ({
        teamId: entry.teamId,
        playerId: entry.playerId,
      })),
      scoreByPlayerAndDiscipline,
    });
    sharedBase?.teamDisciplineRanksByTeamId.set(params.teamId, teamDisciplineRanks);
  }
  const disciplineRankTable =
    sharedBase?.disciplineRankTable ??
    computeTeamDisciplineRankTable({
      teamIds: normalizedGameState.teams.map((entry) => entry.teamId),
      disciplineIds: mappedDisciplineRankIds,
      rosterAssignments: normalizedGameState.rosters.map((entry) => ({
        teamId: entry.teamId,
        playerId: entry.playerId,
      })),
      scoreByPlayerAndDiscipline,
    });
  const teamNameById = sharedBase?.teamNameById ?? new Map(normalizedGameState.teams.map((entry) => [entry.teamId, entry.name] as const));
  const teamPowerWindows = Object.fromEntries(
    requiredDisciplineIds.map((disciplineId) => {
      const top8Rivals = disciplineRankTable
        .filter((row) => row.disciplineId === disciplineId && row.teamId !== params.teamId && row.rank != null && row.rank <= 8)
        .map((row) => ({
          teamId: row.teamId,
          teamName: teamNameById.get(row.teamId) ?? row.teamId,
          rank: row.rank ?? 99,
          relationship: getTeamRelationship(params.teamId, row.teamId)?.value ?? 0,
        }))
        .filter((row) => row.relationship <= -2)
        .sort((left, right) => left.relationship - right.relationship || left.rank - right.rank);
      return [
        disciplineId,
        {
          disciplineId,
          rankSource: "active_roster_top6_sum_discipline_score",
          sourceStatus: "mapped_with_transform",
          top8Rivals,
        },
      ] as const;
    }),
  );
  let fatigueByPlayerId = sharedBase?.fatigueByTeamId.get(params.teamId);
  if (fatigueByPlayerId === undefined) {
    fatigueByPlayerId = buildLocalFatigueMap(normalizedGameState, params);
    sharedBase?.fatigueByTeamId.set(params.teamId, fatigueByPlayerId);
  }
  const localDisciplineWeights = sharedBase?.localDisciplineWeights ?? [];
  const rosterPlayerRefs: LegacyLineupLoadedContext["rosterPlayers"] = activePlayers.map(({ player }) => {
    const availability = availabilityByPlayerId.get(player.id) ?? getPlayerAvailabilityView(normalizedGameState, player.id, params.teamId, params.matchdayId);
    const fatigue = availability.fatigue ?? player.fatigue ?? null;
    const injuryRiskBand = getInjuryRiskBand(fatigue ?? 0);
    // Einsatz-Risiko je Intensitaet VORberechnen (alle drei Stufen), damit die Einsatzliste
    // beim Intensitaets-Umschalten nur nachschlaegt. Bewusst hier im Server-Kontextbau statt
    // im Client: so gelten dieselben ENV-Tunables (OLY_FATIGUE_*) wie beim echten Wurf.
    const injuryRiskProjection = Object.fromEntries(
      (["conserve", "normal", "push"] as const).map((intensity) => [
        intensity,
        projectMatchdayInjuryRisk({ player, currentFatigue: fatigue ?? 0, intensity }),
      ]),
    ) as LegacyInjuryRiskProjectionRef;
    return {
      id: player.id,
      name: player.name,
      portraitUrl: player.portraitUrl ?? null,
      className: player.className,
      race: player.race,
      displayMarketValue: getImportedPlayerDisplayMarketValue(player),
      displaySalary: getImportedPlayerDisplaySalary(player),
      // Eine Quelle: Potenzial aus dem Record statt aus dem Import-Altfeld player.potential.
      potential: resolvePlayerPotentialScoreFromGameState({ gameState: normalizedGameState, playerId: player.id }),
      ovr: player.ovr ?? player.rating ?? null,
      pps: player.pps ?? null,
      fatigue,
      injuryStatus: availability.injuryStatus,
      injuryUntilMatchday: availability.injuryUntilMatchday ?? null,
      injuryRiskPercent: fatigue != null ? injuryRiskBand.riskPercent : null,
      injuryRiskBand: fatigue != null ? injuryRiskBand.label : null,
      injuryRiskLabel: fatigue != null ? injuryRiskBand.uiLabel : null,
      injuryRiskProjection,
      availabilityBlocker: availability.blocker,
      form: player.form ?? null,
      traitsPositive: player.traitsPositive ?? [],
      traitsNegative: player.traitsNegative ?? [],
      attributeStats: player.attributeSheetStats ?? null,
      attributeRatings: {
        power: player.attributeSheetRatings?.powerRating ?? null,
        health: player.attributeSheetRatings?.healthRating ?? null,
        stamina: player.attributeSheetRatings?.staminaRating ?? null,
        intelligence: player.attributeSheetRatings?.intelligenceRating ?? null,
        awareness: player.attributeSheetRatings?.awarenessRating ?? null,
        determination: player.attributeSheetRatings?.determinationRating ?? null,
        speed: player.attributeSheetRatings?.speedRating ?? null,
        dexterity: player.attributeSheetRatings?.dexterityRating ?? null,
        charisma: player.attributeSheetRatings?.charismaRating ?? null,
        will: player.attributeSheetRatings?.willRating ?? null,
        spirit: player.attributeSheetRatings?.spiritRating ?? null,
        torment: player.attributeSheetRatings?.tormentRating ?? null,
      },
      coreStats: {
        pow: player.coreStats.pow,
        spe: player.coreStats.spe,
        men: player.coreStats.men,
        soc: player.coreStats.soc,
      },
    };
  });

  return {
    ok: true,
    warnings: [],
    context: {
      saveId: params.saveId,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      teamId: params.teamId,
      // Attach the (normalized) game state so the resolve engine can compute the
      // player-morale multiplier and captain team-power modifier. Without this the
      // resolve path silently skips both (buildPlayerMoralePerformanceMap and
      // selectTeamCaptain are gated on context.gameState), diverging from the
      // preview path which receives the game state via gameStateOverride.
      gameState: normalizedGameState,
      lineupStrategy: resolveLineupStrategyForTeam(normalizedGameState, params.teamId),
      entries: existingDraft?.entries ?? [],
      disciplinePlayerCounts: Object.fromEntries(
        lineupContract.map((entry) => [entry.disciplineId, entry.requiredPlayers ?? 0]),
      ),
      disciplineSidePlayerCounts: Object.fromEntries(
        [matchdayContract.discipline1, matchdayContract.discipline2]
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .map((entry) => [`${entry.disciplineId}::${entry.disciplineSide}`, entry.requiredPlayers ?? 0] as const),
      ),
      disciplineSideCaptainCounts: Object.fromEntries(
        [matchdayContract.discipline1, matchdayContract.discipline2]
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .map((entry) => [`${entry.disciplineId}::${entry.disciplineSide}`, entry.requiredCaptains] as const),
      ),
      activePlayers: selectableActivePlayers.map(({ entry }) => ({
        id: entry.id,
        saveId: params.saveId,
        seasonId: params.seasonId,
        teamId: params.teamId,
        playerId: entry.playerId,
        contractLength: entry.contractLength,
        salary: entry.salary,
        upkeep: entry.upkeep,
        marketValue: entry.currentValue ?? entry.purchasePrice ?? null,
      })),
      disciplineScores: activePlayers.flatMap(({ player }) =>
        requiredDisciplineIds.map((disciplineId) => ({
          playerId: player.id,
          disciplineId,
          score: roundScore(player.disciplineRatings[disciplineId] ?? 0),
        })),
      ),
      save: {
        id: params.saveId,
        name: `${params.saveId} (local)`,
        status: "active",
      },
      season: {
        id: season.id,
        saveId: params.saveId,
        name: season.name,
        year: season.year,
        currentMatchday: season.currentMatchday,
        status: "active",
      },
      matchday,
      team: {
        id: team.teamId,
        shortCode: team.shortCode,
        name: team.name,
        logoPath: team.logoPath ?? null,
      },
      teamSeasonState: {
        id: `local-team-season-state:${params.saveId}:${params.seasonId}:${params.teamId}`,
        saveId: params.saveId,
        seasonId: params.seasonId,
        teamId: params.teamId,
        cash: team.cash,
        budget: team.budget,
        rosterLimit: team.rosterLimit,
        playerOpt: teamIdentity.playerOpt,
      },
      teamIdentity: {
        pow: teamIdentity.pow,
        spe: teamIdentity.spe,
        men: teamIdentity.men,
        soc: teamIdentity.soc,
      },
      teamStrategyProfile,
      allTeamIdentities: normalizedGameState.teams
        .map((teamEntry) => {
          const identity = normalizedGameState.teamIdentities.find((entry) => entry.teamId === teamEntry.teamId);
          if (!identity) {
            return null;
          }
          return {
            teamId: teamEntry.teamId,
            teamCode: teamEntry.shortCode,
            teamName: teamEntry.name,
            pow: identity.pow,
            spe: identity.spe,
            men: identity.men,
            soc: identity.soc,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      rosterPlayers: rosterPlayerRefs,
      disciplines: normalizedGameState.disciplines.map((discipline) => ({
        id: discipline.id,
        name: discipline.name,
        category: discipline.category,
      })),
      seasonDisciplineSchedule: (normalizedGameState.seasonState.disciplineSchedule ?? []).filter(
        (entry) => entry.seasonId === params.seasonId,
      ),
      disciplineWeights: localDisciplineWeights,
      seasonDisciplineConfigs: lineupContract.map((entry) => ({
        disciplineId: entry.disciplineId,
        originalOrder: entry.order,
        displayOrder: entry.order,
        playerCount: entry.requiredPlayers,
        requiredCaptains: entry.requiredCaptains,
        mutator1: null,
        mutator2: null,
        sourceStatus: entry.sourceStatus,
      })),
      existingDraft,
      contextMeta: {
        ...params,
        d1DisciplineId: matchdayContract.discipline1?.disciplineId ?? null,
        d2DisciplineId: matchdayContract.discipline2?.disciplineId ?? null,
      },
      lineupContract,
      matchdayContract,
      teamStatus: {
        lineupFilledCount: teamStatus.lineupFilledCount,
        totalLineupSides: matchdayContract.totalDisciplineSidesInSeason,
        captainUsedCount: teamStatus.captainUsedCount,
        captainUsedSides: teamStatus.captainUsedSides,
        captainSlots: SEASON_CAPTAIN_SLOTS,
        displayLabel: formatLineupTeamStatusLabel({
          team,
          lineupFilledCount: teamStatus.lineupFilledCount,
          totalLineupSides: matchdayContract.totalDisciplineSidesInSeason,
          captainUsedCount: teamStatus.captainUsedCount,
        }),
      },
      fatigueByPlayerId,
      moraleByPlayerId: null,
      fatigueSourceStatus: fatigueByPlayerId ? "mapped" : "missing_source",
      teamDisciplineRanks: teamDisciplineRanks,
      teamPowerWindows,
      captainRule: {
        seasonCaptainSlots: SEASON_CAPTAIN_SLOTS,
        perDisciplineSideMaxCaptains: 1,
        sourceStatus: "mapped_with_transform",
      },
      ...(() => {
        const modifierSources = getLocalModifierSourceBundle();
        return {
          contextLoadMode: modifierSources.contextLoadMode,
          formCardSource: modifierSources.formCardSource,
          mutatorSource: modifierSources.mutatorSource,
          teamPowerSource: modifierSources.teamPowerSource,
        };
      })(),
      formCards: getTeamFormCardOptions({
        gameState: normalizedGameState,
        seasonId: params.seasonId,
        teamId: params.teamId,
        lineupId: existingDraftLineupId,
      }),
      formCardPlans: (normalizedGameState.seasonState.formCardPlans ?? []).filter(
        (plan) => plan.seasonId === params.seasonId && plan.teamId === params.teamId,
      ),
      teamPowers: getTeamPowerOptions({
        gameState: normalizedGameState,
        seasonId: params.seasonId,
        teamId: params.teamId,
        lineupId: existingDraftLineupId,
      }),
      mutatorTraitOptions: buildLegacyMutatorTraitOptionsForRoster(rosterPlayerRefs),
    },
  };
}

export function loadLocalLegacyLineupContextFromGameState(
  gameState: GameState,
  params: LegacyLineupKeyParams,
): LegacyLineupContextLoadResult {
  return buildContextFromGameState(gameState, params);
}

/**
 * BILLIGE VORPRUEFUNG FUER DEN KI-BATCH — Spielplan/Sollbesetzung EINMAL pro Spieltag, statt den
 * vollen Kontext (Kader, Verfuegbarkeiten, Formkarten, Team-Powers, Manager-Doktrin, ...) fuer
 * JEDES Team aufzubauen, nur um am Ende festzustellen, dass gar nichts zu tun ist.
 *
 * Anlass (Chris, gemessen): `applyAiLegacyLineupBatchLocally` brauchte 2,25s fuer einen Spieltag,
 * an dem alle 32 Teams bereits eine vollstaendige Aufstellung hatten (`overwriteExisting: false`)
 * — reine Verschwendung, denn `isLegacyLineupDraftComplete` braucht davon nur drei Zutaten:
 *  - den vorhandenen Entwurf (steht direkt in `gameState.seasonState.lineupDrafts`),
 *  - die D1/D2-Disziplin des Spieltags (haengt nur am Spielplan, nicht am Team),
 *  - die Sollbesetzung je Disziplin (haengt nur an der Disziplin, nicht am Team).
 * Alle drei sind fuer JEDES Team des Spieltags IDENTISCH — sie muessen nur einmal stehen.
 *
 * Baut die Season-/Spieltag-Aufloesung BEWUSST eigenstaendig auf und ruehrt NICHT den
 * `getSharedLineupContextBase`-Cache des vollen Kontextaufbaus an, obwohl der dieselben Zutaten
 * liefern koennte. Der Grund ist keine Bequemlichkeit: der Cache schluesselt (unter anderem) ueber
 * `saveId`, und Test-Fixtures vergeben `saveId`n teils ueber `Date.now()` — zwei strukturell
 * gleiche, aber INHALTLICH verschiedene Spielstaende koennen denselben Schluessel treffen. Eine
 * zusaetzliche Vorpruefung, die diesen Cache zusaetzlich fuellt/liest, erhoeht genau dieses
 * (seltene, aber beobachtete) Kollisionsrisiko, ohne dass die hier gebrauchten Teile (Spielplan,
 * Sollbesetzung, Kader-Zuordnung) die teuren, gecachten Anteile (Rang-Tabelle, Score-Map,
 * Manager-Doktrin) ueberhaupt brauchen — die eigenstaendige Berechnung ist dafuer billig genug.
 *
 * `ok: false` heisst: Season oder Spieltag liessen sich nicht aufloesen — in diesem Fall (und nur
 * dann) ist die Vorpruefung selbst wertlos, der Aufrufer muss fuer JEDES Team auf den vollen,
 * fehlertragenden Kontextaufbau zurueckfallen (der die richtige Fehlermeldung fuer
 * `skipped_blocked` liefert).
 */
export type LegacyLineupBatchPrecheck = {
  ok: boolean;
  d1DisciplineId: string | null;
  d2DisciplineId: string | null;
  disciplinePlayerCounts: Record<string, number>;
  disciplineSidePlayerCounts: Record<string, number>;
  /**
   * Team UND Team-Identity im Save gefunden? Nur dann ist sicher, dass der volle Kontextaufbau
   * fuer dieses Team `ok: true` liefern wuerde — sonst muss der Aufrufer auf ihn zurueckfallen,
   * damit `skipped_blocked` seine Fehlermeldung bekommt.
   */
  hasTeamAndIdentity: (teamId: string) => boolean;
  /** Derselbe Entwurf, den `context.existingDraft` beim vollen Kontextaufbau liefern wuerde. */
  getExistingDraft: (teamId: string) => LegacyLineupDraft | null;
  /**
   * Kadergroesse (= `context.rosterPlayers.length` beim vollen Kontextaufbau) — MUSS an
   * `findStaleAiLineupEntries({ rosterSize })` durchgereicht werden. Die Frischepruefung bestimmt
   * ihre Schoner-Schwelle sonst ueber `rosterPlayers.length` des uebergebenen Arrays; da
   * `getFreshnessRosterPlayers` bewusst NUR die angefragten (aufgestellten) Spieler liefert, waere
   * dieser Fallback hier ein zu DUENNER Kader und wuerde die Schwelle faelschlich verschaerfen.
   */
  getActiveRosterSize: (teamId: string) => number;
  /**
   * Fatigue/Verletzungsstatus NUR fuer die uebergebenen Spieler-IDs — billige Grundlage fuer
   * `findStaleAiLineupEntries`, ohne den kompletten Kader-Kontext (Marktwert, Potenzial,
   * Verletzungsrisiko je Intensitaet, ...) aufzubauen, den die Frischepruefung gar nicht braucht.
   */
  getFreshnessRosterPlayers: (
    teamId: string,
    playerIds: readonly string[],
  ) => Array<{
    id: string;
    fatigue: number | null;
    injuryStatus: "healthy" | "injured" | "recovering" | null;
    availabilityBlocker: "player_injured_unavailable" | null;
  }>;
};

export function loadLocalLegacyLineupBatchPrecheckFromGameState(
  gameState: GameState,
  params: { saveId: string; seasonId: string; matchdayId: string },
): LegacyLineupBatchPrecheck {
  const emptyResult: LegacyLineupBatchPrecheck = {
    ok: false,
    d1DisciplineId: null,
    d2DisciplineId: null,
    disciplinePlayerCounts: {},
    disciplineSidePlayerCounts: {},
    hasTeamAndIdentity: () => false,
    getExistingDraft: () => null,
    getActiveRosterSize: () => 0,
    getFreshnessRosterPlayers: () => [],
  };

  // Dieselbe Aufloesung wie in `getSharedLineupContextBase` (season/matchday finden,
  // Spieltags-Schedule normalisieren) — absichtlich dupliziert statt geteilt, s. Kommentar oben.
  const normalizedGameState = withNormalizedSeasonDisciplineSchedule(gameState, params.saveId);
  const season = normalizedGameState.season.id === params.seasonId ? normalizedGameState.season : null;
  const matchdayIndex = season ? season.matchdayIds.findIndex((matchdayId) => matchdayId === params.matchdayId) : -1;
  const scheduleEntry =
    season && matchdayIndex >= 0 ? getSeasonDisciplineScheduleEntry(normalizedGameState, params.matchdayId) : null;
  const matchday =
    season && matchdayIndex >= 0
      ? {
          id: params.matchdayId,
          seasonId: params.seasonId,
          index: matchdayIndex + 1,
          label: scheduleEntry?.matchdayLabel ?? `Spieltag ${matchdayIndex + 1}`,
          fixtureIds: [],
          status:
            normalizedGameState.matchdayState.matchdayId === params.matchdayId ? normalizedGameState.matchdayState.status : "planning",
        }
      : null;

  if (!season || !matchday) {
    return emptyResult;
  }

  const lineupContract = buildLineupDisciplineContract(normalizedGameState.disciplines);
  const matchdayContract = buildMatchdayLineupContract({
    season,
    matchday,
    disciplines: normalizedGameState.disciplines,
    disciplineSchedule: normalizedGameState.seasonState.disciplineSchedule,
  });
  const disciplinePlayerCounts = Object.fromEntries(
    lineupContract.map((entry) => [entry.disciplineId, entry.requiredPlayers ?? 0]),
  );
  const disciplineSidePlayerCounts = Object.fromEntries(
    [matchdayContract.discipline1, matchdayContract.discipline2]
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => [`${entry.disciplineId}::${entry.disciplineSide}`, entry.requiredPlayers ?? 0] as const),
  );

  const teamById = new Map(normalizedGameState.teams.map((team) => [team.teamId, team] as const));
  const teamIdentityById = new Map(normalizedGameState.teamIdentities.map((identity) => [identity.teamId, identity] as const));
  const playersById = new Map(normalizedGameState.players.map((player) => [player.id, player] as const));
  const rosterEntriesByTeamId = new Map<string, typeof normalizedGameState.rosters>();
  for (const rosterEntry of normalizedGameState.rosters) {
    const existing = rosterEntriesByTeamId.get(rosterEntry.teamId);
    if (existing) {
      existing.push(rosterEntry);
    } else {
      rosterEntriesByTeamId.set(rosterEntry.teamId, [rosterEntry]);
    }
  }

  return {
    ok: true,
    d1DisciplineId: matchdayContract.discipline1?.disciplineId ?? null,
    d2DisciplineId: matchdayContract.discipline2?.disciplineId ?? null,
    disciplinePlayerCounts,
    disciplineSidePlayerCounts,
    hasTeamAndIdentity: (teamId) => teamById.has(teamId) && teamIdentityById.has(teamId),
    getExistingDraft: (teamId) => getStoredDraft(normalizedGameState, { ...params, teamId }),
    getActiveRosterSize: (teamId) =>
      (rosterEntriesByTeamId.get(teamId) ?? []).filter((entry) => playersById.has(entry.playerId)).length,
    getFreshnessRosterPlayers: (teamId, playerIds) => {
      const rosterByPlayerId = new Map(
        (rosterEntriesByTeamId.get(teamId) ?? []).map((entry) => [entry.playerId, entry] as const),
      );
      const wanted = new Set(playerIds);
      const result: ReturnType<LegacyLineupBatchPrecheck["getFreshnessRosterPlayers"]> = [];
      for (const playerId of wanted) {
        if (!rosterByPlayerId.has(playerId)) continue; // nicht mehr im Kader -> wie im vollen Pfad "unbekannt"
        const player = playersById.get(playerId);
        if (!player) continue;
        const availability = getPlayerAvailabilityView(normalizedGameState, playerId, teamId, params.matchdayId);
        result.push({
          id: playerId,
          fatigue: availability.fatigue ?? player.fatigue ?? null,
          injuryStatus: availability.injuryStatus,
          availabilityBlocker: availability.blocker,
        });
      }
      return result;
    },
  };
}

export function loadAllLocalLegacyLineupContexts(
  input: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
    teamIds?: string[];
  },
  persistence: PersistenceService = createPersistenceService(),
): LegacyLineupContextLoadResult[] {
  const { save } = requireLocalPersistedSave(persistence, input.saveId);
  const teamIds = input.teamIds ?? save.gameState.teams.map((team) => team.teamId);

  return teamIds.map((teamId) =>
    loadLocalLegacyLineupContextFromGameState(save.gameState, {
      saveId: save.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      teamId,
    }),
  );
}

function normalizeEntries(entries: LegacyLineupEntryInput[]) {
  return [...entries]
    .map((entry) => ({
      ...entry,
      disciplineId: entry.disciplineId.trim(),
      playerId: entry.playerId.trim(),
      activePlayerId: entry.activePlayerId?.trim() ?? null,
      isCaptain: Boolean(entry.isCaptain),
    }))
    .sort((left, right) => {
      if (left.disciplineId !== right.disciplineId) {
        return left.disciplineId.localeCompare(right.disciplineId);
      }
      if (left.disciplineSide !== right.disciplineSide) {
        return left.disciplineSide.localeCompare(right.disciplineSide);
      }
      return left.slotIndex - right.slotIndex;
    });
}

function buildValidationOptions(context: LegacyLineupLoadedContext, forSubmit = false): LegacyLineupValidationOptions {
  const previousCaptainKeys = new Set(
    (context.existingDraft?.entries ?? [])
      .filter((entry) => entry.isCaptain)
      .map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
  );
  const captainUsedBeforeCurrentDraftSides = new Set(context.teamStatus?.captainUsedSides ?? []);
  for (const key of previousCaptainKeys) {
    captainUsedBeforeCurrentDraftSides.delete(key);
  }

  return {
    enforceCompleteness: forSubmit,
    seasonCaptainLimit: SEASON_CAPTAIN_SLOTS,
    captainUsedBeforeCurrentDraft: Math.max(0, (context.teamStatus?.captainUsedCount ?? 0) - previousCaptainKeys.size),
    captainUsedBeforeCurrentDraftSides: Array.from(captainUsedBeforeCurrentDraftSides),
  };
}

export function loadLocalLegacyLineupContext(
  params: LegacyLineupKeyParams,
  persistence?: PersistenceService,
): LegacyLineupContextLoadResult {
  const { save } = resolveLocalSave(params.saveId, persistence);
  return buildContextFromGameState(save.gameState, {
    ...params,
    saveId: save.saveId,
  });
}

export function getLocalLegacyLineupDraft(params: LegacyLineupKeyParams, persistence?: PersistenceService) {
  const { save } = resolveLocalSave(params.saveId, persistence);
  return getStoredDraft(save.gameState, { ...params, saveId: save.saveId });
}

export function generateLocalLegacyFormCardsForSeason(
  params: LegacyLineupKeyParams,
  persistence?: PersistenceService,
) {
  const { persistence: resolvedPersistence, save } = resolveLocalSave(params.saveId, persistence);
  const effectiveParams = { ...params, saveId: save.saveId };
  if (save.gameState.season.id !== effectiveParams.seasonId) {
    return {
      ok: false as const,
      errors: ["form_cards_season_is_not_active"],
      warnings: ["Formkarten lassen sich nur fuer die aktive lokale Season erzeugen."],
    };
  }

  const generatedCards = buildGeneratedFormCardRecordsForSeason(
    save.gameState,
    effectiveParams.saveId,
    effectiveParams.seasonId,
  );
  const validCardIds = new Set(generatedCards.map((card) => card.id));
  const existingCards = save.gameState.seasonState.formCards ?? [];
  const replacedCardCount = existingCards.filter(
    (card) => card.seasonId === effectiveParams.seasonId,
  ).length;
  const remainingCards = existingCards.filter(
    (card) => card.seasonId !== effectiveParams.seasonId,
  );
  const teamDrafts = getStoredDrafts(save.gameState);
  let scrubbedSelectionCount = 0;
  const nextDrafts = teamDrafts.map((draft) => {
    if (draft.seasonId !== effectiveParams.seasonId) {
      return draft;
    }

    const normalizedBefore = normalizeLineupDraftModifiers(draft.modifiers);
    const nextDraft = clearMissingFormCardSelections(draft, validCardIds);
    const normalizedAfter = normalizeLineupDraftModifiers(nextDraft.modifiers);
    const beforeIds = [
      normalizedBefore.d1.primaryFormCardId,
      normalizedBefore.d1.secondaryFormCardId,
      normalizedBefore.d2.primaryFormCardId,
      normalizedBefore.d2.secondaryFormCardId,
    ];
    const afterIds = [
      normalizedAfter.d1.primaryFormCardId,
      normalizedAfter.d1.secondaryFormCardId,
      normalizedAfter.d2.primaryFormCardId,
      normalizedAfter.d2.secondaryFormCardId,
    ];
    scrubbedSelectionCount += beforeIds.filter((value, index) => value !== afterIds[index]).length;
    return nextDraft;
  });

  const nextGameState: GameState = {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      formCards: [...remainingCards, ...generatedCards],
      lineupDrafts: nextDrafts,
    },
  };
  resolvedPersistence.saveSingleplayerState(save.saveId, nextGameState);

  const rosterPlayerCount = save.gameState.rosters.length;
  const coveredPlayerCount = new Set(generatedCards.map((card) => card.playerId)).size;
  const coveredTeamCount = new Set(generatedCards.map((card) => card.teamId)).size;
  const warnings: string[] = [];
  if (coveredPlayerCount === 0) {
    warnings.push("In dieser Season hat aktuell kein Team klassengebundene Formkartenquellen.");
  } else if (coveredPlayerCount < rosterPlayerCount) {
    warnings.push("Ein Teil der Season-Kader hat keine Formkartenfarbe aus der Legacy-Klassenlogik.");
  }

  return {
    ok: true as const,
    source: "sqlite" as const,
    seasonId: effectiveParams.seasonId,
    rosterPlayerCount,
    coveredPlayerCount,
    coveredTeamCount,
    generatedCardCount: generatedCards.length,
    replacedCardCount,
    scrubbedSelectionCount,
    warnings,
  };
}

export function ensureLocalLegacyFormCardsForSeason(
  params: LegacyLineupKeyParams,
  persistence?: PersistenceService,
) {
  const { persistence: resolvedPersistence, save } = resolveLocalSave(params.saveId, persistence);
  const effectiveParams = { ...params, saveId: save.saveId };
  if (save.gameState.season.id !== effectiveParams.seasonId) {
    return {
      ok: false as const,
      errors: ["form_cards_season_is_not_active"],
      warnings: ["Formkarten lassen sich nur fuer die aktive lokale Season sicherstellen."],
    };
  }

  const existingSeasonCards = (save.gameState.seasonState.formCards ?? []).filter(
    (card) => card.seasonId === effectiveParams.seasonId,
  );

  // KEIN season-globaler Kurzschluss mehr: früher brach die Funktion ab, sobald IRGENDEIN Team eine Karte für die
  // Season hatte. Dadurch bekam ein Team, das seinen Kader erst NACH der KI fertigstellt (typisch: der Mensch),
  // nie Formkarten. `ensureLocalFormCardsForSeason` arbeitet jetzt pro Spieler additiv, also lassen wir es immer
  // laufen — es fügt genau die noch fehlenden Karten hinzu (z. B. für frisch gekaufte Spieler) und ist bei bereits
  // vollständigem Kader ein reiner No-op.
  const mitKarten = ensureLocalFormCardsForSeason(save.gameState, effectiveParams.saveId, effectiveParams.seasonId);

  /**
   * MIT DEM FINALISIEREN SCHLIESST DAS KAUFFENSTER — also frieren hier die Apron-Linien ein.
   *
   * GEMELDET VON CHRIS: „ich habe nun transfers finalisiert -> apron müsste nun eingefroren werden
   * und hier entsprechend auch angezeigt werden in der GuV und den anderen finanz Seiten!"
   *
   * Der Aufruf steht NACH `ensureLocalFormCardsForSeason` und nicht davor: das Einfrieren prüft
   * über `haveSeasonTransfersBeenFinalized`, ob alle menschlichen Teams ihren Formkarten-Pool
   * haben — vorher wäre die Antwort noch „nein" und der Snapshot bliebe aus.
   *
   * Selbst-sichernd: `ensureSeasonApronLinesFrozen` gibt denselben Zustand zurück, sobald die
   * Linien stehen. Ein zweites Finalisieren (der Endpunkt ist bewusst idempotent) verschiebt die
   * Grenze also nicht.
   */
  const nextGameState = ensureSeasonApronLinesFrozen(mitKarten, "transfers_finalized");
  const cardsChanged = nextGameState !== save.gameState;
  if (cardsChanged) {
    resolvedPersistence.saveSingleplayerState(save.saveId, nextGameState);
  }
  const totalSeasonCardCount = (nextGameState.seasonState.formCards ?? []).filter(
    (card) => card.seasonId === effectiveParams.seasonId,
  ).length;
  const generatedCardCount = totalSeasonCardCount - existingSeasonCards.length;

  return {
    ok: true as const,
    source: "sqlite" as const,
    seasonId: effectiveParams.seasonId,
    generatedCardCount,
    existingCardCount: existingSeasonCards.length,
    // Nur warnen, wenn wirklich GAR keine Karten existieren (weder vorher noch neu) — sonst ist
    // generatedCardCount === 0 der normale „Kader schon vollständig abgedeckt"-No-op.
    warnings: totalSeasonCardCount === 0 ? ["In dieser Season wurden keine Formkartenquellen gefunden."] : [],
  };
}

export type SaveLocalLegacyFormCardPlanInput = LegacyLineupKeyParams & {
  disciplineSide: "d1" | "d2";
  disciplineId?: string | null;
  primaryFormCardId?: string | null;
  secondaryFormCardId?: string | null;
  /**
   * Vorgeplante Intensitaet der Seite (Formplan-Push-Ziele).
   *
   * Dreiwertig und das mit Absicht:
   *  - `undefined` → unveraendert lassen. Das Kartenfeld und das Intensitaets-Feld
   *    schreiben denselben Datensatz; ohne diese Unterscheidung wuerde jedes
   *    Kartenklicken den Push-Plan derselben Seite mitloeschen.
   *  - `null`      → Plan bewusst entfernen ("kein Plan").
   *  - Stufe       → Plan setzen.
   */
  plannedIntensity?: "conserve" | "normal" | "push" | null;
};

export function saveLocalLegacyFormCardPlan(
  input: SaveLocalLegacyFormCardPlanInput,
  persistence?: PersistenceService,
): {
  ok: boolean;
  plans: FormCardPlanRecord[];
  errors: string[];
  warnings: string[];
} {
  const { persistence: resolvedPersistence, save } = resolveLocalSave(input.saveId, persistence);
  const effectiveSaveId = save.saveId;
  // Formkarten VOR der Prüfung selbstheilen — genau wie der Kontext-Ladepfad (getSharedLineupContextBase)
  // und der Draft-Speicherpfad (saveLocalLegacyLineupDraft) es tun. Ohne das prüfte dieser Pfad als
  // einziger gegen den ROHEN gespeicherten Kartenbestand, während die Auswahlliste im UI aus dem
  // geheilten Bestand kam: Für einen Spieler, der erst NACH der ersten Kartengenerierung in den Kader
  // kam (Draft-Reihenfolge, Transfer), bot das UI seine Karte an, das Speichern lehnte sie dann mit
  // `form_card_plan_card_missing` ab — die Formkarten ließen sich in der Einsatzliste nicht auswählen.
  // Die geheilten Karten landen über `nextGameState` mit in der Persistenz.
  const gameState = ensureLocalFormCardsForSeason(
    withNormalizedSeasonDisciplineSchedule(save.gameState, effectiveSaveId),
    effectiveSaveId,
    input.seasonId,
  );
  const scheduleEntry = (gameState.seasonState.disciplineSchedule ?? []).find(
    (entry) => entry.seasonId === input.seasonId && entry.matchdayId === input.matchdayId,
  );
  if (!scheduleEntry) {
    return { ok: false, plans: [], errors: ["form_card_plan_matchday_missing"], warnings: [] };
  }

  const sideSlot = input.disciplineSide === "d1" ? scheduleEntry.discipline1 : scheduleEntry.discipline2;
  const disciplineId = input.disciplineId ?? sideSlot?.disciplineId ?? null;
  if (!sideSlot || (disciplineId && sideSlot.disciplineId !== disciplineId)) {
    return { ok: false, plans: [], errors: ["form_card_plan_discipline_side_missing"], warnings: [] };
  }

  const requestedCardIds = [input.primaryFormCardId ?? null, input.secondaryFormCardId ?? null].filter(
    (value): value is string => Boolean(value),
  );
  const validCards = new Set(
    (gameState.seasonState.formCards ?? [])
      .filter((card) => card.seasonId === input.seasonId && card.teamId === input.teamId)
      .map((card) => card.id),
  );
  const positiveCardIds = new Set(
    (gameState.seasonState.formCards ?? [])
      .filter((card) => card.seasonId === input.seasonId && card.teamId === input.teamId && card.cardValue > 0)
      .map((card) => card.id),
  );
  const invalidCardId = requestedCardIds.find((cardId) => !validCards.has(cardId));
  const teamPlans = (gameState.seasonState.formCardPlans ?? []).filter(
    (plan) => plan.seasonId === input.seasonId && plan.teamId === input.teamId,
  );
  if (invalidCardId) {
    return {
      ok: false,
      plans: teamPlans,
      errors: [`form_card_plan_card_missing:${invalidCardId}`],
      warnings: [],
    };
  }
  if (input.secondaryFormCardId && !positiveCardIds.has(input.secondaryFormCardId)) {
    return {
      ok: false,
      plans: teamPlans,
      errors: [`form_card_plan_secondary_must_be_positive:${input.secondaryFormCardId}`],
      warnings: [],
    };
  }

  const now = new Date().toISOString();
  const planId = `form-card-plan:${effectiveSaveId}:${input.seasonId}:${input.matchdayId}:${input.teamId}:${input.disciplineSide}`;
  const allPlans = gameState.seasonState.formCardPlans ?? [];
  // Der Datensatz traegt zwei unabhaengige Planungen: Formkarten UND Push-Ziel.
  // `plannedIntensity: undefined` heisst "nicht angefasst" — sonst wuerde ein
  // Kartenklick den Push-Plan derselben Seite mitloeschen (und umgekehrt).
  const existingPlan = allPlans.find((plan) => plan.id === planId) ?? null;
  const nextPlannedIntensity =
    input.plannedIntensity === undefined ? existingPlan?.plannedIntensity ?? null : input.plannedIntensity;
  // Ein Datensatz ohne Karten UND ohne Push-Ziel ist leer und wird geloescht —
  // sonst sammelt der Save leere Plaene an.
  const hasPlanContent = requestedCardIds.length > 0 || nextPlannedIntensity != null;
  const nextPlan: FormCardPlanRecord | null = hasPlanContent
    ? {
        id: planId,
        saveId: effectiveSaveId,
        seasonId: input.seasonId,
        teamId: input.teamId,
        matchdayId: input.matchdayId,
        disciplineSide: input.disciplineSide,
        disciplineId,
        primaryFormCardId: input.primaryFormCardId ?? null,
        secondaryFormCardId: input.secondaryFormCardId ?? null,
        plannedIntensity: nextPlannedIntensity,
        updatedAt: now,
      }
    : null;
  const reservedCardIds = new Set(requestedCardIds);
  // Dieselbe Karte darf nur an EINEM Spieltag liegen. Frueher flog der fremde Plan
  // dabei komplett raus; seit er auch ein Push-Ziel tragen kann, wird ihm nur noch
  // die Karte entzogen — das Push-Ziel dieser Seite bleibt bestehen. Erst wenn
  // danach weder Karte noch Push-Ziel uebrig ist, verschwindet der Datensatz.
  const releaseReservedCards = (plan: FormCardPlanRecord): FormCardPlanRecord | null => {
    const primary = plan.primaryFormCardId && reservedCardIds.has(plan.primaryFormCardId) ? null : plan.primaryFormCardId;
    const secondary =
      plan.secondaryFormCardId && reservedCardIds.has(plan.secondaryFormCardId) ? null : plan.secondaryFormCardId;
    if (primary === plan.primaryFormCardId && secondary === plan.secondaryFormCardId) {
      return plan;
    }
    if (!primary && !secondary && plan.plannedIntensity == null) {
      return null;
    }
    return { ...plan, primaryFormCardId: primary, secondaryFormCardId: secondary, updatedAt: now };
  };
  const nextPlans = [
    ...allPlans
      .filter((plan) => plan.id !== planId)
      .map((plan) =>
        plan.seasonId !== input.seasonId || plan.teamId !== input.teamId ? plan : releaseReservedCards(plan),
      )
      .filter((plan): plan is FormCardPlanRecord => plan != null),
    ...(nextPlan ? [nextPlan] : []),
  ].sort(
    (left, right) =>
      left.seasonId.localeCompare(right.seasonId) ||
      left.teamId.localeCompare(right.teamId) ||
      left.matchdayId.localeCompare(right.matchdayId) ||
      left.disciplineSide.localeCompare(right.disciplineSide),
  );

  const nextGameState: GameState = {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      formCardPlans: nextPlans,
    },
  };
  resolvedPersistence.saveSingleplayerState(effectiveSaveId, nextGameState);

  return {
    ok: true,
    plans: nextPlans.filter((plan) => plan.seasonId === input.seasonId && plan.teamId === input.teamId),
    errors: [],
    warnings: reservedCardIds.size > 0 ? ["Doppelte Formkartenplaene wurden fuer diese Karte bereinigt."] : [],
  };
}

export function saveLocalLegacyLineupDraft(
  params: LegacyLineupKeyParams,
  entries: LegacyLineupEntryInput[],
  modifiers = createDefaultLineupDraftModifiers(),
  persistence?: PersistenceService,
  /**
   * `lockMatchday` nagelt die Abgabe fest: der Draft geht als `locked` in den Save und kann
   * danach nicht mehr ueberschrieben werden (die Pruefung dafuer steht weiter unten und gab es
   * laengst — sie wurde nur nie ausgeloest, weil jedes Speichern `submitted` schrieb).
   *
   * Gesetzt wird das NUR von der Spieler-Route, und dort erst nach ausdruecklicher Bestaetigung.
   * Skripte und Simulationen speichern weiterhin ohne Sperre, sonst koennte ein Lauf seinen
   * eigenen zweiten Spieltag nicht mehr schreiben.
   *
   * Warum ueberhaupt: `lib/lineups/matchday-lineup-lock.ts` erklaert den Missbrauch, gegen den
   * das gerichtet ist.
   */
  options?: { lockMatchday?: boolean },
): LegacyLineupSaveResult {
  const { persistence: resolvedPersistence, save } = resolveLocalSave(params.saveId, persistence);
  const effectiveParams = { ...params, saveId: save.saveId };
  if (save.gameState.matchdayState.matchdayId !== effectiveParams.matchdayId) {
    return {
      ok: false,
      errors: ["lineup_matchday_is_not_active"],
      warnings: ["Only the active local matchday can be edited. Older matchdays stay locked after progress."],
    };
  }
  const gameStateWithFormCards = ensureLocalFormCardsForSeason(save.gameState, effectiveParams.saveId, effectiveParams.seasonId);
  const contextResult = buildContextFromGameState(gameStateWithFormCards, effectiveParams);
  if (!contextResult.ok) {
    return { ok: false, errors: contextResult.errors, warnings: contextResult.warnings };
  }

  const normalizedEntries = normalizeEntries(entries);
  const validation = validateLegacyLineupContext(
    {
      ...contextResult.context,
      entries: normalizedEntries,
      disciplineSidePlayerCounts: buildDisciplineSidePlayerCounts(contextResult.context),
      disciplineSideCaptainCounts: contextResult.context.disciplineSideCaptainCounts,
    },
    buildValidationOptions(contextResult.context),
  );

  if (!validation.isValid) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const now = new Date().toISOString();
  const lineupId = createLineupDraftId(effectiveParams);
  const existingDrafts = getStoredDrafts(gameStateWithFormCards);
  const existing = existingDrafts.find((draft) => draft.lineupId === lineupId) ?? null;
  if (existing && ["locked", "resolved"].includes(existing.status)) {
    return {
      ok: false,
      errors: ["lineup_draft_is_locked"],
      warnings: ["This lineup is already locked/resolved and can no longer be overwritten."],
    };
  }
  // Formkarten spielt nur, wer sie spielt. Hier lief bisher `autoFillFormCardModifiers`:
  // Wer beim Speichern KEINE Karte gewaehlt hatte, bekam automatisch die staerkste
  // Positivkarte je Disziplin-Seite eingetragen. Das ist der einzige Schreibpfad der
  // menschlichen Einsatzliste — der Spieler sah anschliessend in der Wertung einen
  // Formbonus aus Karten, die er nie ausgespielt hatte, und der Kartenvorrat leerte sich
  // ohne sein Zutun. Verworfen wurde die kleinere Variante, den Autofill nur fuer
  // `controlMode === "manual"` abzuschalten: die KI setzt ihre Karten ohnehin explizit
  // ueber `buildAiLegacyLineupModifiers` und speichert ueber
  // `saveLocalLegacyLineupDraftBatch`, das nie automatisch gefuellt hat. Ein zweiter
  // Auswahlweg neben der Doktrin waere nur eine zweite Quelle fuer dieselbe Groesse.
  const resolvedModifiers = normalizeLineupDraftModifiers(modifiers);
  const nextDraft: LineupDraft = {
    lineupId,
    saveId: effectiveParams.saveId,
    seasonId: effectiveParams.seasonId,
    matchdayId: effectiveParams.matchdayId,
    teamId: effectiveParams.teamId,
    status: options?.lockMatchday ? "locked" : "submitted",
    entries: normalizedEntries,
    modifiers: normalizeLineupDraftModifiers(resolvedModifiers),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (!isTeamMatchdayLineupOperationallyReady(gameStateWithFormCards, effectiveParams.teamId, nextDraft)) {
    return {
      ok: false,
      errors: ["lineup_not_operationally_ready"],
      warnings: ["Alle Slots fuellen oder den gesamten Kader einsetzen, bevor die Einsatzliste gespeichert wird."],
    };
  }

  const mitEinsatzliste: GameState = {
    ...gameStateWithFormCards,
    seasonState: {
      ...gameStateWithFormCards.seasonState,
      lineupDrafts: [
        ...existingDrafts.filter((draft) => draft.lineupId !== lineupId),
        nextDraft,
      ],
    },
  };

  /**
   * NACHZÜGLER-EINFRIERUNG für Spielstände, die unter einem älteren Build finalisiert haben.
   *
   * Der reguläre Zeitpunkt ist „Transfers finalisieren" (`ensureLocalLegacyFormCardsForSeason`).
   * Wer aber schon VOR diesem Build finalisiert hat, kommt dort nie wieder vorbei — der
   * Flow-Schritt steht auf „erledigt" und feuert den Endpunkt nicht erneut. Ohne diese Zeile bliebe
   * die Anzeige bei solchen Spielständen bis zum ersten Spieltag bei „Linien noch nicht
   * eingefroren", obwohl das Kauffenster längst zu ist.
   *
   * Hier ist es sicher: eine Einsatzliste gibt es erst NACH dem Finalisieren (der Flow blockiert
   * `set_lineup` sonst mit `transfers_not_finalized`). Und `ensureSeasonApronLinesFrozen` gibt
   * denselben Zustand zurück, sobald die Linien stehen — jedes weitere Speichern ist ein No-op.
   */
  const nextGameState = ensureSeasonApronLinesFrozen(mitEinsatzliste, "transfers_finalized");

  resolvedPersistence.saveSingleplayerState(save.saveId, nextGameState);

  return {
    ok: true,
    draft: toLegacyDraft(nextDraft),
    warnings: validation.warnings,
  };
}

export type LegacyLineupBatchTeamResult = {
  teamId: string;
  ok: boolean;
  draft: LegacyLineupDraft | null;
  errors: string[];
  warnings: string[];
};

/**
 * Besitzprüfung je Team (Befund B5/1, Stufe 2.1): dieselbe Regel wie
 * `authorizeLocalSingleplayerTeamWrite` (lib/room/server-authoritative-write-guard.ts) für den
 * NICHT-Raum-Fall — bewusst dieselben Funktionen (`canLocalUserManageTeam`,
 * `canFoundationLocalUserManageTeam`), keine zweite Quelle. `activeOwnerId: undefined/null`
 * bedeutet: der Aufrufer ist bereits anderweitig autorisiert (KI-Stapellauf, Messskript,
 * Raum-Aufrufer, die die Pruefung schon serverseitig via `authorizeServerRoomWrite` je Team
 * durchlaufen haben) — die Pruefung entfaellt dann wie im bisherigen, unbeschraenkten Batch.
 */
function authorizeBatchTeamOwnership(
  gameState: GameState,
  teamId: string,
  activeOwnerId: string | null | undefined,
): { allowed: true } | { allowed: false; reason: string } {
  if (activeOwnerId == null) {
    return { allowed: true };
  }
  const resolvedActiveOwnerId = activeOwnerId.trim() || DEFAULT_ACTIVE_OWNER_ID;
  if (!canFoundationLocalUserManageTeam(canLocalUserManageTeam(gameState, teamId, resolvedActiveOwnerId))) {
    return { allowed: false, reason: "local_team_not_owned_or_ai_controlled" };
  }
  return { allowed: true };
}

/**
 * SAMMEL-SPEICHERN FUER MEHRERE TEAMS — EIN Schreibvorgang (Befund B5/1, Stufe 2.1).
 *
 * Bis eben nahm nur der KI-Stapellauf (`ai-legacy-lineup-batch-apply-service.ts`) und ein
 * Messskript diesen Pfad; der menschliche Weg (`app/api/lineups/legacy/route.ts`) speicherte pro
 * Team einzeln. Diese Funktion war fuer Menschen dabei aus drei Gruenden ungeeignet:
 *  1. Kein `lockMatchday` — der Status stand hart auf "submitted", eine Abgabe liess sich also
 *     nach dem Arena-Blick beliebig oft nachbessern (siehe `matchday-lineup-lock.ts`).
 *  2. Keine Formkarten-/Apron-Absicherung — anders als `saveLocalLegacyLineupDraft` wurden weder
 *     `ensureLocalFormCardsForSeason` noch `ensureSeasonApronLinesFrozen` aufgerufen/persistiert.
 *  3. Keine Besitzpruefung je Team und Alles-oder-nichts: EIN Kaderproblem in einem Team liess
 *     ALLE anderen Teams durchfallen (`if (errors.length > 0) return { savedCount: 0, ... }`).
 *
 * Jetzt: Formkarten werden VOR der Team-Schleife einmal je betroffener Season sichergestellt (in
 * der Reihenfolge, die `ensureLocalLegacyFormCardsForSeason` vorschreibt: Formkarten ZUERST, danach
 * `ensureSeasonApronLinesFrozen` — das prueft ueber `haveSeasonTransfersBeenFinalized`, ob ALLE
 * menschlichen Teams ihren Pool haben, und muesste vorher noch "nein" antworten). Jedes Team
 * bekommt sein EIGENES Ergebnis (`results`); ein abgelehntes Team blockiert die anderen nicht
 * mehr. Genau EIN `saveSingleplayerState`-Aufruf traegt alle erfolgreichen Teams plus die
 * sichergestellten Formkarten/Apron-Linien.
 */
export function saveLocalLegacyLineupDraftBatch(
  drafts: Array<{
    params: LegacyLineupKeyParams;
    entries: LegacyLineupEntryInput[];
    modifiers?: LegacyLineupDraft["modifiers"];
  }>,
  persistence?: PersistenceService,
  options?: {
    /** Siehe Kommentar an `saveLocalLegacyLineupDraft` — nur von der Spieler-Route gesetzt. */
    lockMatchday?: boolean;
    /** Siehe Kommentar an `authorizeBatchTeamOwnership`. */
    activeOwnerId?: string | null;
  },
): {
  ok: boolean;
  savedCount: number;
  errors: string[];
  warnings: string[];
  results: LegacyLineupBatchTeamResult[];
} {
  if (drafts.length === 0) {
    return { ok: true, savedCount: 0, errors: [], warnings: [], results: [] };
  }

  const { persistence: resolvedPersistence, save } = resolveLocalSave(drafts[0]!.params.saveId, persistence);
  const effectiveDrafts = drafts.map((draft) => ({
    ...draft,
    params: {
      ...draft.params,
      saveId: save.saveId,
    },
    modifiers: normalizeLineupDraftModifiers(draft.modifiers ?? createDefaultLineupDraftModifiers()),
  }));

  // Formkarten ZUERST sicherstellen — fuer JEDE betroffene Season einmal, additiv auf demselben
  // GameState aufbauend. In der Praxis ist das fast immer eine einzige Season; die Schleife traegt
  // trotzdem den allgemeinen Fall, ohne eine zweite Auflösung zu erfinden.
  let baseGameState = save.gameState;
  for (const seasonId of new Set(effectiveDrafts.map((entry) => entry.params.seasonId))) {
    baseGameState = ensureLocalFormCardsForSeason(baseGameState, save.saveId, seasonId);
  }

  const now = new Date().toISOString();
  const existingDrafts = getStoredDrafts(baseGameState);
  const nextDrafts: LineupDraft[] = [];
  const nextDraftIds = new Set<string>();
  const results: LegacyLineupBatchTeamResult[] = [];

  for (const draftInput of effectiveDrafts) {
    const teamId = draftInput.params.teamId;
    const pushRejected = (errors: string[], warnings: string[] = []) => {
      results.push({ teamId, ok: false, draft: null, errors, warnings });
    };

    const ownership = authorizeBatchTeamOwnership(baseGameState, teamId, options?.activeOwnerId);
    if (!ownership.allowed) {
      pushRejected([ownership.reason]);
      continue;
    }

    if (baseGameState.matchdayState.matchdayId !== draftInput.params.matchdayId) {
      pushRejected(["lineup_matchday_is_not_active"]);
      continue;
    }

    const contextResult = buildContextFromGameState(baseGameState, draftInput.params);
    if (!contextResult.ok) {
      pushRejected(contextResult.errors, contextResult.warnings);
      continue;
    }

    const normalizedEntries = normalizeEntries(draftInput.entries);
    const validation = validateLegacyLineupContext(
      {
        ...contextResult.context,
        entries: normalizedEntries,
        disciplineSidePlayerCounts: buildDisciplineSidePlayerCounts(contextResult.context),
        disciplineSideCaptainCounts: contextResult.context.disciplineSideCaptainCounts,
      },
      buildValidationOptions(contextResult.context),
    );

    if (!validation.isValid) {
      pushRejected(validation.errors, validation.warnings);
      continue;
    }

    const lineupId = createLineupDraftId(draftInput.params);
    const existing = existingDrafts.find((entry) => entry.lineupId === lineupId) ?? null;
    if (existing && ["locked", "resolved"].includes(existing.status)) {
      pushRejected(
        ["lineup_draft_is_locked"],
        ["This lineup is already locked/resolved and can no longer be overwritten."],
      );
      continue;
    }

    const candidateDraft: LineupDraft = {
      lineupId,
      saveId: draftInput.params.saveId,
      seasonId: draftInput.params.seasonId,
      matchdayId: draftInput.params.matchdayId,
      teamId,
      status: options?.lockMatchday ? "locked" : "submitted",
      entries: normalizedEntries,
      modifiers: draftInput.modifiers,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (!isTeamMatchdayLineupOperationallyReady(baseGameState, teamId, candidateDraft)) {
      pushRejected(
        ["lineup_not_operationally_ready"],
        ["Alle Slots fuellen oder den gesamten Kader einsetzen, bevor die Einsatzliste gespeichert wird."],
      );
      continue;
    }

    nextDraftIds.add(lineupId);
    nextDrafts.push(candidateDraft);
    results.push({ teamId, ok: true, draft: toLegacyDraft(candidateDraft), errors: [], warnings: validation.warnings });
  }

  if (nextDrafts.length === 0) {
    // Nichts zu schreiben: keine Formkarten-/Apron-Persistenz auf Verdacht, exakt wie beim
    // Einzelweg (`saveLocalLegacyLineupDraft` persistiert bei einem fehlgeschlagenen Team auch
    // nichts). Der naechste erfolgreiche Aufruf holt die additive Formkartengenerierung nach.
    const allErrors = Array.from(new Set(results.flatMap((entry) => entry.errors)));
    const allWarnings = Array.from(new Set(results.flatMap((entry) => entry.warnings)));
    return { ok: false, savedCount: 0, errors: allErrors, warnings: allWarnings, results };
  }

  const mitEinsatzlisten: GameState = {
    ...baseGameState,
    seasonState: {
      ...baseGameState.seasonState,
      lineupDrafts: [
        ...existingDrafts.filter((draft) => !nextDraftIds.has(draft.lineupId)),
        ...nextDrafts,
      ],
    },
  };

  // Apron-Einfrierung NACH den Formkarten (siehe Funktionskommentar oben und der Kommentar an
  // `ensureLocalLegacyFormCardsForSeason`, dessen Reihenfolge hier bewusst gespiegelt wird).
  const nextGameState = ensureSeasonApronLinesFrozen(mitEinsatzlisten, "transfers_finalized");

  // GENAU EIN Schreibvorgang fuer n Teams (Stufe 2.1) — unabhaengig davon, wie viele Teams im
  // Aufruf steckten, hier steht nur dieser eine Aufruf.
  resolvedPersistence.saveSingleplayerState(save.saveId, nextGameState);

  const allErrors = Array.from(new Set(results.flatMap((entry) => entry.errors)));
  const allWarnings = Array.from(new Set(results.flatMap((entry) => entry.warnings)));
  return {
    ok: results.every((entry) => entry.ok),
    savedCount: nextDrafts.length,
    errors: allErrors,
    warnings: allWarnings,
    results,
  };
}

export function calculateLocalLegacyLineupPreview(
  params: LegacyLineupKeyParams,
  entries?: LegacyLineupEntryInput[],
  modifiers?: LegacyLineupDraft["modifiers"],
  persistence?: PersistenceService,
): LegacyLineupPreviewResult {
  const persistenceService = persistence ?? createPersistenceService();
  const contextResult = loadLocalLegacyLineupContext(params, persistenceService);
  if (!contextResult.ok) {
    return contextResult;
  }
  const { save } = requireLocalPersistedSave(persistenceService, params.saveId);

  return calculateLocalLegacyLineupPreviewFromContext(
    contextResult.context,
    entries,
    modifiers,
    contextResult.context.fatigueByPlayerId ?? null,
    save.gameState,
  );
}

export { calculateLocalLegacyLineupPreviewFromContext } from "@/lib/lineups/legacy-lineup-preview-from-context";

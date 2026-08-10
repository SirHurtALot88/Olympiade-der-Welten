import type { GameState } from "@/lib/data/olyDataTypes";
import { FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS } from "@/lib/foundation/foundation-admin-dev-flags";
import { projiziereSaisonHistorie } from "@/lib/persistence/foundation-season-history-projection";
import { projiziereFieldRace } from "@/lib/persistence/foundation-field-race-projection";

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function matchesCompactSlice<T>(incoming: T, compactSlice: T) {
  return stableJson(incoming) === stableJson(compactSlice);
}

function preserveIfUnchangedFromCompact<T>(incoming: T, existing: T, compactSlice: T): T {
  return matchesCompactSlice(incoming, compactSlice) ? existing : incoming;
}

/**
 * Roster player-ids of the human-managed team(s).
 *
 * The compact initial payload strips every player's heavy `attributeSheetStats`
 * (fog-of-war + payload slimming) and only re-hydrates a single player on demand
 * when the profile drawer opens. But the whole-roster forecasts of the OWN team
 * (training-SP prognosis, per-intensity/-class gain, season-end preview) need the
 * full attribute sheet up front — without it `normalizePlayerAttributes` returns
 * null and the organic progression collapses to all-zeros (Training/Performance
 * +0, "Weitere Boni" −100%). Opponent sheets stay stripped; the own roster is
 * small (~1 team) so keeping its sheets in the payload is negligible.
 */
function resolveHumanRosterPlayerIds(gameState: GameState): Set<string> {
  const settings = gameState.seasonState.teamControlSettings;
  const humanTeamIds = settings
    ? new Set(
        Object.values(settings)
          .filter((setting) => setting?.controlMode === "manual")
          .map((setting) => setting.teamId),
      )
    : new Set(gameState.teams.filter((team) => team.humanControlled).map((team) => team.teamId));

  if (humanTeamIds.size === 0) {
    // Fallback: any team flagged human-controlled, so a save without control
    // settings still keeps its own-roster sheets rather than zeroing training.
    for (const team of gameState.teams) {
      if (team.humanControlled) humanTeamIds.add(team.teamId);
    }
  }

  return new Set(
    (gameState.rosters ?? [])
      .filter((roster) => humanTeamIds.has(roster.teamId))
      .map((roster) => roster.playerId),
  );
}

/**
 * Append-only archive guard for compact-load round-trips.
 *
 * The Foundation compact load strips `seasonSnapshots`/`standingsApplyLogs` to
 * `undefined`, and the client re-stamps an EMPTY sentinel `[]` (see
 * `apply-compact-season-archive-sentinel`). A naive `incoming ?? existing`
 * (and even `preserveIfUnchangedFromCompact`, whose compact baseline is
 * `undefined` — `"[]" !== undefined`) would let that `[]` clobber the durable
 * DB archive on the next gameplay PUT — wiping every prior-season snapshot.
 *
 * These archives are APPEND-ONLY (they only grow, one entry per completed
 * season / applied matchday). So the safe rule is: only accept the incoming
 * array when it has AT LEAST as many entries as the persisted one; otherwise
 * keep the durable copy. This blocks both the empty sentinel and any partial
 * fetch from shrinking the archive, while still accepting legitimate growth
 * (a freshly-completed season adds a snapshot → incoming is longer → wins).
 */
function preserveAppendOnlyArchive<T extends unknown[] | undefined>(incoming: T, existing: T): T {
  const incomingLength = incoming?.length ?? 0;
  const existingLength = existing?.length ?? 0;
  return incomingLength >= existingLength ? incoming : existing;
}

function mergeKeyedCollection<T>(
  incoming: T[],
  existing: T[],
  compactSlice: T[],
  key: (item: T) => string,
): T[] {
  if (matchesCompactSlice(incoming, compactSlice)) {
    return existing;
  }

  const incomingByKey = new Map(incoming.map((item) => [key(item), item] as const));
  const preservedFromExisting = existing.filter((item) => !incomingByKey.has(key(item)));
  return [...preservedFromExisting, ...incoming];
}

/** Slim initial Foundation payload: strips heavy history and non-active matchday slices. */
export function compactFoundationInitialGameState(gameState: GameState): GameState {
  const activeMatchdayId = gameState.matchdayState.matchdayId;
  const activeMatchdayResults = (gameState.seasonState.matchdayResults ?? []).filter(
    (result) => result.matchdayId === activeMatchdayId,
  );
  const activeMatchdayResultIds = new Set(activeMatchdayResults.map((result) => result.id));

  // Keep the OWN team's attribute sheets in the compact payload so whole-roster
  // forecasts (training-SP, per-intensity/-class gain, season-end preview) work
  // immediately — opponent sheets remain stripped and hydrate on demand.
  const keepSheetPlayerIds = FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS ? null : resolveHumanRosterPlayerIds(gameState);
  const keepSheetsFor = (playerId: string) =>
    FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS || (keepSheetPlayerIds?.has(playerId) ?? false);

  return {
    ...gameState,
    playerBaselines: undefined,
    baselineWriteGuardEvents: undefined,
    transferHistory: gameState.transferHistory,
    logs: [],
    players: gameState.players.map((player) => ({
      ...player,
      attributeSheetStats: keepSheetsFor(player.id) ? player.attributeSheetStats : undefined,
      attributeSheetRatings: keepSheetsFor(player.id) ? player.attributeSheetRatings : undefined,
      flavorEn: "",
      flavorDe: "",
      previousDisciplineRatings: undefined,
      lastSeasonDisciplineValues: undefined,
      currentDisciplineValues: undefined,
      disciplineDelta: undefined,
    })),
    seasonState: {
      ...gameState.seasonState,
      persistedSeasonDerivations: undefined,
      seasonSnapshots: undefined,
      /**
       * Ersatz fuer die gestrichenen Schnappschuesse — siehe
       * `foundation-season-history-projection`. Ohne das zeigte die Saison-Verlauf-Karte fuer jede
       * vergangene Saison „—", weil die Historie mangels Schnappschuss auf Platzhalterzeilen mit
       * `rank: null` zurueckfiel. Die Daten waren nie weg, sie kamen nur nie im Browser an.
       *
       * Landet BEWUSST nicht in `seasonSnapshots`: der Archivschutz vergleicht nur die Anzahl der
       * Eintraege, eine gleich lange Kurzfassung kaeme also durch und wuerde die vollen
       * Schnappschuesse beim naechsten Speichern ueberschreiben.
       */
      foundationSeasonHistory: projiziereSaisonHistorie(gameState.seasonState.seasonSnapshots),
      /**
       * Geschwister-Projektion fuers laufende Feld-Rennen: der Browser kann die gewerteten
       * Spieltage aus dem kompakten Payload nicht mehr selbst zaehlen (matchdayResults/
       * disciplineResults sind hier auf den aktiven Spieltag beschnitten) — Home meldete
       * deshalb mitten in der Saison „erst 0 Spieltage". Die fertige Antwort faehrt mit,
       * gerechnet auf dem vollen Save; zurueckgeschrieben wird sie nie (s. u.).
       */
      foundationFieldRace: projiziereFieldRace(gameState),
      standingsApplyLogs: undefined,
      disciplineResults: (gameState.seasonState.disciplineResults ?? []).filter((result) =>
        activeMatchdayResultIds.has(result.matchdayResultId),
      ),
      matchdayResults: activeMatchdayResults,
      lineupDrafts: (gameState.seasonState.lineupDrafts ?? []).filter(
        (draft) => draft.matchdayId === activeMatchdayId,
      ),
    },
  };
}

function mergePlayerAfterCompactEdit(
  existingPlayer: GameState["players"][number],
  incomingPlayer: GameState["players"][number],
  compactPlayer: GameState["players"][number],
) {
  if (matchesCompactSlice(incomingPlayer, compactPlayer)) {
    return existingPlayer;
  }

  const merged = { ...existingPlayer, ...incomingPlayer };
  const strippedFields = [
    "attributeSheetStats",
    "attributeSheetRatings",
    "flavorEn",
    "flavorDe",
    "previousDisciplineRatings",
    "lastSeasonDisciplineValues",
    "currentDisciplineValues",
    "disciplineDelta",
  ] as const;

  for (const field of strippedFields) {
    if (incomingPlayer[field] === compactPlayer[field]) {
      const preserved = existingPlayer[field];
      if (preserved !== undefined) {
        Object.assign(merged, { [field]: preserved });
      }
    }
  }

  return merged;
}

function lineupDraftMergeKey(draft: NonNullable<GameState["seasonState"]["lineupDrafts"]>[number]) {
  if (draft.lineupId) {
    return draft.lineupId;
  }

  return `${draft.saveId}:${draft.seasonId}:${draft.matchdayId}:${draft.teamId}`;
}

/** Restore compact-stripped slices when the client PUT still reflects the compact load. */
export function rehydrateGameStateAfterCompactPut(existing: GameState, incoming: GameState): GameState {
  const compactFromExisting = compactFoundationInitialGameState(existing);
  const incomingIds = new Set(incoming.players.map((player) => player.id));
  const preservedPlayers = existing.players.filter((player) => !incomingIds.has(player.id));
  const compactPlayersById = new Map(compactFromExisting.players.map((player) => [player.id, player] as const));
  const existingPlayersById = new Map(existing.players.map((player) => [player.id, player] as const));

  const rehydratedPlayers = incoming.players.map((incomingPlayer) => {
    const existingPlayer = existingPlayersById.get(incomingPlayer.id);
    const compactPlayer = compactPlayersById.get(incomingPlayer.id);
    if (!existingPlayer || !compactPlayer) {
      return incomingPlayer;
    }
    return mergePlayerAfterCompactEdit(existingPlayer, incomingPlayer, compactPlayer);
  });

  return {
    ...incoming,
    playerBaselines: incoming.playerBaselines ?? existing.playerBaselines,
    baselineWriteGuardEvents: incoming.baselineWriteGuardEvents ?? existing.baselineWriteGuardEvents,
    transferHistory: preserveIfUnchangedFromCompact(
      incoming.transferHistory,
      existing.transferHistory,
      compactFromExisting.transferHistory,
    ),
    logs: preserveIfUnchangedFromCompact(incoming.logs, existing.logs, compactFromExisting.logs),
    players: [...preservedPlayers, ...rehydratedPlayers],
    seasonState: {
      ...incoming.seasonState,
      persistedSeasonDerivations:
        incoming.seasonState.persistedSeasonDerivations ?? existing.seasonState.persistedSeasonDerivations,
      // Append-only archives: the compact client re-stamps an empty sentinel `[]`,
      // which the old `incoming ?? existing` guard let clobber the durable DB
      // archive (wiping every prior-season snapshot). Only accept incoming when it
      // is at least as long as the persisted copy (see preserveAppendOnlyArchive).
      seasonSnapshots: preserveAppendOnlyArchive(
        incoming.seasonState.seasonSnapshots,
        existing.seasonState.seasonSnapshots,
      ),
      /**
       * FAELLT HIER RAUS, IMMER. Die Kurzfassung der Saisonhistorie faehrt nur zum Browser hinaus
       * (siehe `compactFoundationInitialGameState`); zurueck darf sie nicht. Sie ist eine
       * Projektion aus `seasonSnapshots`, also abgeleitet — im Spielstand haette sie nichts zu
       * suchen ausser Gewicht, und jede Aenderung an den echten Schnappschuessen wuerde sie still
       * veralten lassen. Beim naechsten Ausliefern wird sie ohnehin frisch gebaut.
       */
      foundationSeasonHistory: undefined,
      // Dieselbe Regel wie die Saison-Historie darueber: reine Anzeigefracht, faehrt nur
      // zum Browser hinaus und wird beim naechsten Ausliefern frisch gebaut.
      foundationFieldRace: undefined,
      standingsApplyLogs: preserveAppendOnlyArchive(
        incoming.seasonState.standingsApplyLogs,
        existing.seasonState.standingsApplyLogs,
      ),
      lineupDrafts: mergeKeyedCollection(
        incoming.seasonState.lineupDrafts ?? [],
        existing.seasonState.lineupDrafts ?? [],
        compactFromExisting.seasonState.lineupDrafts ?? [],
        lineupDraftMergeKey,
      ),
      matchdayResults: mergeKeyedCollection(
        incoming.seasonState.matchdayResults ?? [],
        existing.seasonState.matchdayResults ?? [],
        compactFromExisting.seasonState.matchdayResults ?? [],
        (result) => result.id,
      ),
      disciplineResults: mergeKeyedCollection(
        incoming.seasonState.disciplineResults ?? [],
        existing.seasonState.disciplineResults ?? [],
        compactFromExisting.seasonState.disciplineResults ?? [],
        (result) => result.id,
      ),
    },
  };
}

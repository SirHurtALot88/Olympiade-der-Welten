import { loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { DEFAULT_ACTIVE_OWNER_ID, buildTeamControlSettingsMap, canLocalUserManageTeam } from "@/lib/foundation/team-control-settings";
import { readArenaPreviewCache, writeArenaPreviewCache } from "@/lib/foundation/arena-preview-cache";
import { buildMatchdayResolveSignature, readMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import {
  loadSqliteLegacyMatchdayResolvePreview,
  type LegacyMatchdayResolvePreviewPayload,
} from "@/lib/foundation/legacy-matchday-resolve-preview-service";
import {
  buildLineupDisciplineContract,
  countSeasonCaptains,
  countSeasonLineupDisciplineSides,
  formatLineupTeamStatusLabel,
  SEASON_CAPTAIN_SLOTS,
} from "@/lib/lineups/lineup-discipline-contract";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { requireLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";
import { readStandingsPreviewCache, writeStandingsPreviewCache } from "@/lib/standings/standings-preview-cache";

export type ArenaBriefingStandings = {
  items: Array<{ teamId: string; currentRank: number | null; projectedRank: number | null }>;
};

/**
 * Spoilerfreie Ausgangslage fuer das Arena-Briefing: aktueller Liga-Rang je
 * Team direkt aus `seasonState.standings` (Punkte vor diesem Spieltag). Rein
 * lesend, keine Projektion — daher immer guenstig und ohne Ergebnis-Spoiler.
 */
function buildArenaBriefingStandings(save: PersistedSaveGame): ArenaBriefingStandings {
  const standings = save.gameState.seasonState?.standings ?? {};
  const ranked = save.gameState.teams
    .map((team) => {
      const points = standings[team.teamId]?.points;
      return { teamId: team.teamId, teamName: team.name, points: typeof points === "number" ? points : null };
    })
    .filter((entry) => entry.points != null)
    .sort((left, right) => {
      if ((right.points ?? 0) !== (left.points ?? 0)) {
        return (right.points ?? 0) - (left.points ?? 0);
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });
  // Vor dem ersten Spieltag stehen alle bei 0 Punkten — dann ist ein Rang
  // bedeutungslos. Erst ranken, wenn die Liga ueberhaupt Punkte hat.
  const hasLeaguePoints = ranked.some((entry) => (entry.points ?? 0) > 0);
  const rankByTeamId = hasLeaguePoints
    ? new Map(ranked.map((entry, index) => [entry.teamId, index + 1] as const))
    : new Map<string, number>();
  return {
    items: save.gameState.teams.map((team) => ({
      teamId: team.teamId,
      currentRank: rankByTeamId.get(team.teamId) ?? null,
      projectedRank: null,
    })),
  };
}

function countMatchdayLineupDisciplineSides(input: {
  lineups: Array<{
    teamId: string;
    seasonId: string;
    matchdayId: string;
    entries: Array<{ disciplineId: string; disciplineSide: "d1" | "d2" }>;
  }>;
  teamId: string;
  seasonId: string;
  matchdayId: string;
}) {
  const keys = new Set<string>();
  for (const draft of input.lineups) {
    if (draft.teamId !== input.teamId || draft.seasonId !== input.seasonId || draft.matchdayId !== input.matchdayId) {
      continue;
    }
    for (const entry of draft.entries) {
      keys.add(`${entry.disciplineId}::${entry.disciplineSide}`);
    }
  }
  return keys.size;
}

function buildArenaOptions(save: PersistedSaveGame, params: LegacyLineupKeyParams) {
  const contract = buildLineupDisciplineContract(save.gameState.disciplines);
  const lineups = save.gameState.seasonState.lineupDrafts ?? [];
  const totalLineupSides = contract.length;
  const disciplineSchedule = getSeasonDisciplineSchedule(save.gameState, { saveId: save.saveId });
  const disciplineScheduleByMatchdayId = new Map(disciplineSchedule.map((entry) => [entry.matchdayId, entry] as const));
  const controlSettingsMap = buildTeamControlSettingsMap(save.gameState.teams, save.gameState.seasonState.teamControlSettings);
  const totalTeams = save.gameState.teams.length;
  const resultByMatchdayId = new Map(
    (save.gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === save.gameState.season.id && result.status === "preview_applied")
      .map((result) => [result.matchdayId, result] as const),
  );

  return {
    saves: createPersistenceService().listSaves().map((saveItem) => ({ id: saveItem.saveId, name: saveItem.name, status: saveItem.status })),
    seasons: [
      {
        id: save.gameState.season.id,
        name: save.gameState.season.name,
        year: save.gameState.season.year,
        status: "active",
      },
    ],
    matchdays: save.gameState.season.matchdayIds.map((matchdayId, index) => {
      const readyTeams = save.gameState.teams.filter(
        (team) =>
          countMatchdayLineupDisciplineSides({
            lineups,
            teamId: team.teamId,
            seasonId: save.gameState.season.id,
            matchdayId,
          }) >= 2,
      ).length;
      const result = resultByMatchdayId.get(matchdayId) ?? null;
      return {
        id: matchdayId,
        label: disciplineScheduleByMatchdayId.get(matchdayId)?.matchdayLabel ?? `Spieltag ${index + 1}`,
        index: disciplineScheduleByMatchdayId.get(matchdayId)?.matchdayIndex ?? index + 1,
        status: result ? "resolved" : save.gameState.matchdayState.matchdayId === matchdayId ? save.gameState.matchdayState.status : "planning",
        resultApplied: Boolean(result),
        resultId: result?.id ?? null,
        discipline1Label: disciplineScheduleByMatchdayId.get(matchdayId)?.discipline1?.displayName ?? null,
        discipline1RequiredPlayers: disciplineScheduleByMatchdayId.get(matchdayId)?.discipline1?.playerCount ?? null,
        discipline2Label: disciplineScheduleByMatchdayId.get(matchdayId)?.discipline2?.displayName ?? null,
        discipline2RequiredPlayers: disciplineScheduleByMatchdayId.get(matchdayId)?.discipline2?.playerCount ?? null,
        sourceStatus: disciplineScheduleByMatchdayId.get(matchdayId)?.sourceStatus ?? "legacy_seed",
        readyTeams,
        totalTeams,
        isReady: totalTeams > 0 && readyTeams >= totalTeams,
      };
    }),
    teams: save.gameState.teams.map((team) => {
      const activePlayers = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
      const lineupFilledCount = countSeasonLineupDisciplineSides({
        lineups,
        teamId: team.teamId,
        seasonId: save.gameState.season.id,
      });
      const captainUsedCount = countSeasonCaptains({
        lineups,
        teamId: team.teamId,
        seasonId: save.gameState.season.id,
      });
      const currentMatchdayReady =
        countMatchdayLineupDisciplineSides({
          lineups,
          teamId: team.teamId,
          seasonId: save.gameState.season.id,
          matchdayId: params.matchdayId,
        }) >= 2;
      return {
        id: team.teamId,
        name: team.name,
        activePlayers,
        controlMode: controlSettingsMap[team.teamId]?.controlMode ?? "manual",
        aiLineupApplyEnabled: controlSettingsMap[team.teamId]?.aiLineupApplyEnabled ?? false,
        lineupFilledCount,
        totalLineupSides,
        captainUsedCount,
        captainSlots: SEASON_CAPTAIN_SLOTS,
        statusLabel: formatLineupTeamStatusLabel({
          team,
          lineupFilledCount,
          totalLineupSides,
          captainUsedCount,
        }),
        currentMatchdayReady,
      };
    }),
  };
}

export async function loadMatchdayArenaBase(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  activeOwnerId?: string;
  includeDetails?: boolean;
}) {
  // Audit S4: `saveId` is always required by the caller (route 400s otherwise) — resolve strictly
  // so a stale/unknown id never silently shows another save's (possibly another player's) arena
  // briefing instead of failing loudly.
  const persistence = createPersistenceService();
  const { save } = requireLocalPersistedSave(persistence, input.saveId);

  const versionMeta = persistence.getSaveVersionMetadata(save.saveId);
  const contentSignature = versionMeta?.contentSignature ?? null;
  const params: LegacyLineupKeyParams = {
    saveId: save.saveId,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    teamId: input.teamId,
  };
  const contextResult = loadLocalLegacyLineupContextFromGameState(save.gameState, params);

  // Hier lief bis hierher `runMatchdayMvpScoring` als Dry-Run — bei JEDEM Arena-Aufruf,
  // auch ohne Details. Gemessen: 18,6 von 19,3 Sekunden der gesamten Ladezeit. Der Lauf
  // zieht ueber `prepareLegacyMatchdayResultApply` alle 32 Team-Kontexte und baut die
  // volle Ergebnis-Vorschau — nur um ein `scoreSummary` zu liefern, das nachweislich
  // KEIN Aufrufer liest: weder die Buehne (sie nimmt aus der Antwort ausschliesslich
  // `resolvePreview.preview`, `briefingStandings.items` und `standingsPreview.items`)
  // noch der Prefetch. Wer die MVP-Wertung wirklich braucht, ruft weiterhin
  // `/api/season/matchday-mvp-score` — die Route bleibt unveraendert.

  let resolvePreview: LegacyMatchdayResolvePreviewPayload | null = null;
  let standingsPreview: Awaited<ReturnType<typeof buildStandingsPreview>> | null = null;

  if (input.includeDetails === true) {
    const resolveCacheKey = `${save.saveId}:${params.seasonId}:${params.matchdayId}`;
    // Die Save-Content-Signatur allein reicht hier NICHT: sie kennt von den Aufstellungen
    // nur die ANZAHL (`lineupDraftCount`). Wird eine Aufstellung geaendert statt neu
    // angelegt — die eigene Elf umgestellt, ein bestehender Draft vom AI-Batch
    // ueberschrieben — bleibt sie gleich, und die Arena beantwortet die Anfrage aus dem
    // Cache: sie zeigt dann eine andere Aufstellung als die tatsaechlich gespeicherte.
    // Deshalb zusaetzlich die Matchday-Resolve-Signatur, die Slots, Reihenfolge, Kapitaen,
    // Formkarten und den Verfuegbarkeitsstand der eingesetzten Spieler abdeckt.
    const cacheSignature = [
      contentSignature ?? `${versionMeta?.updatedAt ?? save.updatedAt}`,
      buildMatchdayResolveSignature(save.gameState, {
        saveId: save.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
      }),
    ].join("|");
    // Zuerst die EINE Rechnung des Spieltags, die beim Speichern der Aufstellungen
    // entstanden ist. Sie ist dieselbe Quelle, aus der auch gebucht wird — die Buehne
    // zeigt damit exakt das, was am Ende jeder Disziplin in den Saisonstand wandert.
    // Fehlt sie (Feld noch unvollstaendig, Snapshot durch geaenderte Aufstellungen
    // verfallen), wird wie bisher live gerechnet; dann ist es eben nur eine Vorschau.
    const snapshot = readMatchdayResolveSnapshot(save.gameState, {
      saveId: save.saveId,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
    });
    resolvePreview =
      snapshot?.payload ??
      readArenaPreviewCache<LegacyMatchdayResolvePreviewPayload>(resolveCacheKey, cacheSignature) ??
      loadSqliteLegacyMatchdayResolvePreview({
        saveId: save.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
      });
    if (resolvePreview && !snapshot) {
      writeArenaPreviewCache(resolveCacheKey, cacheSignature, resolvePreview);
    }

    const standingsCacheKey = `${save.saveId}:${params.seasonId}:${params.matchdayId}`;
    standingsPreview =
      readStandingsPreviewCache<Awaited<ReturnType<typeof buildStandingsPreview>>>(
        standingsCacheKey,
        cacheSignature,
      ) ??
      (await buildStandingsPreview(
        {
          saveId: save.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          source: "sqlite",
        },
        undefined,
        persistence,
      ));
    writeStandingsPreviewCache(standingsCacheKey, cacheSignature, standingsPreview);
  }

  // Der Lineup-Kontext traegt den kompletten `gameState` mit sich — gemessen 16,2 MB von
  // 16,3 MB der gesamten Antwort. Ueber die Leitung gehoert er nicht: Die Buehne hat den
  // Spielstand ohnehin schon (er kommt als Prop aus der Shell), und beide Aufrufer pruefen
  // `context` nur auf Vorhandensein, ohne je hineinzuschauen. Das Feld bleibt also
  // vorhanden und wahrheitswertig, nur ohne den Spielstand darin.
  const { gameState: _contextGameState, ...contextWithoutGameState } = contextResult.ok
    ? contextResult.context
    : ({ gameState: null } as { gameState: unknown });

  return {
    params,
    source: "sqlite" as const,
    readOnly: !canLocalUserManageTeam(save.gameState, params.teamId, input.activeOwnerId ?? DEFAULT_ACTIVE_OWNER_ID),
    context: contextResult.ok ? contextWithoutGameState : null,
    contextWarnings: contextResult.ok ? contextResult.warnings : contextResult.warnings,
    contextErrors: contextResult.ok ? [] : contextResult.errors,
    options: buildArenaOptions(save, params),
    resolvePreview,
    standingsPreview,
    briefingStandings: buildArenaBriefingStandings(save),
    saveVersion: save.gameState.saveVersion ?? 0,
    contentSignature,
  };
}

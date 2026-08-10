export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import type { GameState } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getSeasonPointsLedger } from "@/lib/foundation/get-season-derivations";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import { resolveSessionOwnerId } from "@/lib/auth/session";
import { readStandingsOverviewCache, writeStandingsOverviewCache } from "@/lib/season/standings-overview-cache";
import { resolveSeasonGuvByTeam } from "@/lib/finance/season-guv-resolver";
import { getLeagueSponsorIncome } from "@/lib/season/prize-money-preview";
import { buildArchivedSeasonStandingsOverviewItems } from "@/lib/season/archived-standings-overview";
import { buildTeamPrizeSummary } from "@/lib/season/prize-money";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";
import {
  extractSeasonStandingsDisciplineValues,
  inspectSeasonStandingsSheet,
  mapSeasonStandingsRowsToTeams,
  SEASON_STANDINGS_DISCIPLINE_COLUMNS,
  type SeasonStandingsSheetRow,
} from "@/lib/standings/season-standings-sheet";
import { respondWithSliceEtag } from "@/lib/foundation/season-slice-http";
import { db } from "@/src/server/db";

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function buildLocalSeasonDisciplineValues(input: {
  gameState: GameState;
  seasonId: string;
  saveId: string;
  contentSignature?: string | null;
}) {
  const ledger = getSeasonPointsLedger({
    gameState: input.gameState,
    saveId: input.saveId,
    seasonId: input.seasonId,
    contentSignature: input.contentSignature ?? null,
  });

  return new Map(
    input.gameState.teams.map((team) => {
      const summary = ledger.teamSummariesByTeamId.get(team.teamId) ?? null;
      const disciplineValues: Record<string, number | null> = {};

      for (const discipline of input.gameState.disciplines) {
        const key = normalizeLineupDisciplineFieldName(discipline.id);
        if (!key) {
          continue;
        }
        const value = summary?.pointsByDiscipline[discipline.id] ?? null;
        disciplineValues[key] = typeof value === "number" && Number.isFinite(value) ? roundValue(value, 1) : null;
      }

      disciplineValues.bonuspunkte =
        summary?.mutatorPpsBonus != null && Number.isFinite(summary.mutatorPpsBonus)
          ? roundValue(summary.mutatorPpsBonus, 1)
          : null;

      return [
        team.teamId,
        {
          disciplineValues,
          warnings: summary?.warnings ?? [],
        },
      ] as const;
    }),
  );
}

function buildStandingsOverviewCacheSignature(input: {
  localSave: NonNullable<ReturnType<ReturnType<typeof createPersistenceService>["getSaveById"]>>;
  seasonId: string;
  sourceKind: "live" | "season_snapshot" | "season_snapshot_missing";
  contentSignature?: string | null;
}) {
  const versionMeta = createPersistenceService().getSaveVersionMetadata(input.localSave.saveId);
  const base = versionMeta
    ? [
        versionMeta.seasonId,
        versionMeta.matchdayId,
        String(versionMeta.saveVersion),
        String(versionMeta.lineupDraftCount),
        String(versionMeta.transferHistoryCount),
        versionMeta.updatedAt,
        input.seasonId,
        input.sourceKind,
        input.contentSignature ?? versionMeta.contentSignature ?? "",
      ].join("|")
    : `${input.localSave.updatedAt}|${input.seasonId}|${input.sourceKind}|${input.contentSignature ?? ""}`;
  return base;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get("saveId")?.trim() || undefined;
    const requestedSeasonId = searchParams.get("seasonId")?.trim() || undefined;
    const requestedContentSignature = searchParams.get("contentSignature")?.trim() || undefined;
    const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
    const ownerId = source === "sqlite" ? await resolveSessionOwnerId() : null;

    const localSave =
      source === "sqlite"
        ? resolveLocalPersistedSave(createPersistenceService(), saveId, ownerId)?.save ?? null
        : null;

    // Audit S5: this used to fall back to `bootstrapSingleplayerSave()` (a write) when no save
    // could be resolved. Reads must never create/activate a save — answer "no save" instead.
    if (source === "sqlite" && !localSave) {
      return NextResponse.json(
        {
          items: [],
          missingMappings: [],
          mappingWarnings: ["save_not_found"],
          source: {
            kind: "season_snapshot_missing",
            access: "local_save",
            detectedColumns: [],
            disciplineColumns: SEASON_STANDINGS_DISCIPLINE_COLUMNS,
          },
          scope: null,
          error: "Save could not be resolved.",
        },
        { status: 404 },
      );
    }

    const seasonId = requestedSeasonId ?? localSave?.gameState.season.id ?? "season-1";
    const contentSignature =
      requestedContentSignature ??
      (localSave ? createPersistenceService().getSaveVersionMetadata(localSave.saveId)?.contentSignature ?? null : null);

    if (source === "sqlite" && localSave) {
      const activeSeasonId = localSave.gameState.season.id;
      const isCurrentSeason = seasonId === activeSeasonId;
      const archivedSnapshot = !isCurrentSeason
        ? (localSave.gameState.seasonState.seasonSnapshots ?? []).find((snapshot) => snapshot.seasonId === seasonId) ?? null
        : null;

      if (!isCurrentSeason && !archivedSnapshot) {
        return NextResponse.json({
          items: [],
          missingMappings: [],
          mappingWarnings: [`season_snapshot_missing:${seasonId}`],
          source: {
            kind: "season_snapshot_missing",
            access: "local_save",
            detectedColumns: [],
            disciplineColumns: SEASON_STANDINGS_DISCIPLINE_COLUMNS,
          },
          scope: {
            saveId: localSave.saveId,
            seasonId,
          },
        });
      }

      const cacheKey = `${localSave.saveId}:${seasonId}`;
      const cacheSignature = buildStandingsOverviewCacheSignature({
        localSave,
        seasonId,
        sourceKind: archivedSnapshot ? "season_snapshot" : "live",
        contentSignature,
      });
      const cached = readStandingsOverviewCache(cacheKey, cacheSignature);
      if (cached) {
        if (contentSignature) {
          return respondWithSliceEtag(request, {
            slice: "standings-overview",
            saveId: localSave.saveId,
            seasonId,
            contentSignature,
            payload: cached as Record<string, unknown>,
          });
        }
        return NextResponse.json(cached);
      }

      if (archivedSnapshot) {
        const archivedPayload = {
          items: buildArchivedSeasonStandingsOverviewItems(archivedSnapshot),
          missingMappings: [],
          mappingWarnings: archivedSnapshot.warnings ?? [],
          source: {
            kind: "season_snapshot",
            access: "local_save",
            detectedColumns: [],
            disciplineColumns: SEASON_STANDINGS_DISCIPLINE_COLUMNS,
          },
          scope: {
            saveId: localSave.saveId,
            seasonId,
          },
        };
        writeStandingsOverviewCache(cacheKey, cacheSignature, archivedPayload);
        if (contentSignature) {
          return respondWithSliceEtag(request, {
            slice: "standings-overview",
            saveId: localSave.saveId,
            seasonId,
            contentSignature,
            payload: archivedPayload,
          });
        }
        return NextResponse.json(archivedPayload);
      }
    }

    const teamStates =
      source === "sqlite"
        ? localSave!.gameState.teams.map((team) => ({
            teamId: team.teamId,
            cash: team.cash,
            team: {
              name: team.name,
              shortCode: team.shortCode,
            },
          }))
        : await db.teamSeasonState.findMany({
            where: {
              saveId,
              seasonId,
            },
            select: {
              teamId: true,
              cash: true,
              team: {
                select: {
                  name: true,
                  shortCode: true,
                },
              },
            },
          });

    const sheet =
      source === "sqlite"
        ? null
        : await inspectSeasonStandingsSheet();
    const sheetRows =
      sheet?.sourceKind === "season_standings"
        ? (sheet.mappedRows as SeasonStandingsSheetRow[])
        : [];
    const mapping =
      source === "sqlite"
        ? {
            rows: [],
            missingInDb: [],
            mappingWarnings: [],
          }
        : mapSeasonStandingsRowsToTeams(
            sheetRows,
            teamStates.map((state) => ({
              teamId: state.teamId,
              shortCode: state.team.shortCode,
              teamName: state.team.name,
            })),
          );
    const teamStateById = new Map(teamStates.map((state) => [state.teamId, state] as const));
    const localSheetRowByTeamId =
      source === "sqlite"
        ? new Map(
            mapping.rows
              .filter((row) => row.resolvedTeamId)
              .map((row) => [row.resolvedTeamId as string, row] as const),
          )
        : null;
    const localSeasonDisciplineValuesByTeamId =
      source === "sqlite"
        ? buildLocalSeasonDisciplineValues({
            gameState: localSave!.gameState,
            seasonId,
            saveId: localSave!.saveId,
            contentSignature: contentSignature ?? null,
          })
        : null;

    const localStartRankByTeamId =
      source === "sqlite"
        ? (() => {
            const sorted = [...localSave!.gameState.teams].sort((left, right) => {
              if (right.budget !== left.budget) {
                return right.budget - left.budget;
              }
              return left.name.localeCompare(right.name, "de");
            });

            const rankByTeamId = new Map<string, number>();
            let previousBudget: number | null = null;
            let previousRank = 0;

            sorted.forEach((team, index) => {
              if (previousBudget != null && team.budget === previousBudget) {
                rankByTeamId.set(team.teamId, previousRank);
                return;
              }

              const nextRank = index + 1;
              previousBudget = team.budget;
              previousRank = nextRank;
              rankByTeamId.set(team.teamId, nextRank);
            });

            return rankByTeamId;
          })()
        : null;

    // Echte Saisonende-Einnahmen je Team (Sponsoren beim aktuellen Rang + Gebaeude netto) —
    // dieselbe Quelle, aus der auch gebucht wird.
    const localSponsorIncome =
      source === "sqlite" ? getLeagueSponsorIncome(localSave!.gameState, localSave!.saveId) : null;
    const localSalaryTotalByTeamId =
      source === "sqlite"
        ? (() => {
            const playerById = new Map(localSave!.gameState.players.map((player) => [player.id, player] as const));
            return new Map(
              localSave!.gameState.teams.map((team) => [
                team.teamId,
                localSave!.gameState.rosters
                  .filter((entry) => entry.teamId === team.teamId)
                  .reduce(
                    (sum, entry) =>
                      sum + (resolvePlayerEconomyContract({ player: playerById.get(entry.playerId), rosterEntry: entry }).salary ?? 0),
                    0,
                  ),
              ] as const),
            );
          })()
        : null;

    /**
     * DIE EINE GuV je Team (`lib/finance/season-end-guv.ts`) — einmal fuer die Liga gerechnet.
     * `sponsorCashByTeamId` kommt aus dem bereits gecachten `getLeagueSponsorIncome`, damit die
     * teure Sponsor-Vorschau nicht ein zweites Mal laeuft.
     */
    const localSeasonGuvByTeamId =
      source === "sqlite"
        ? resolveSeasonGuvByTeam(localSave!.gameState, {
            sponsorCashByTeamId: localSponsorIncome?.sponsorCashByTeamId ?? null,
            salaryTotalByTeamId: localSalaryTotalByTeamId ?? null,
          })
        : null;

    const localPrizeSummaryByTeamId =
      source === "sqlite"
        ? (() => {
            const playerById = new Map(localSave!.gameState.players.map((player) => [player.id, player] as const));
            const transferSummaryByTeamId = new Map<string, number>();

            for (const entry of localSave!.gameState.transferHistory) {
              if (entry.seasonId !== localSave!.gameState.season.id) {
                continue;
              }
              const amount = entry.fee ?? 0;
              if (entry.transferType === "buy" && entry.toTeamId) {
                transferSummaryByTeamId.set(entry.toTeamId, (transferSummaryByTeamId.get(entry.toTeamId) ?? 0) - amount);
              }
              if ((entry.transferType === "sell" || entry.transferType === "contract_exit") && entry.fromTeamId) {
                transferSummaryByTeamId.set(entry.fromTeamId, (transferSummaryByTeamId.get(entry.fromTeamId) ?? 0) + amount);
              }
            }

            const currentSalaryFactor =
              getSeasonEconomyFactorWindow({
                saveId: localSave!.saveId,
                seasonId,
                seasonState: localSave!.gameState.seasonState,
              }).find((row) => row.seasonLabel === "Aktuell")?.factor ?? 1;

            return new Map(
              buildTeamPrizeSummary(
                localSave!.gameState.teams.map((team) => {
                  const roster = localSave!.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
                  const upkeep = roster.reduce((sum, entry) => {
                    const player = playerById.get(entry.playerId);
                    return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0);
                  }, 0);
                  const standing = localSave!.gameState.seasonState.standings[team.teamId] ?? null;
                  const hasCurrentPoints = standing?.points != null && Number.isFinite(standing.points) && standing.points > 0;
                  const budgetStartRank = localStartRankByTeamId?.get(team.teamId) ?? 0;
                  const startRank = hasCurrentPoints ? standing?.startplatz ?? budgetStartRank : budgetStartRank;
                  const derivedRank = hasCurrentPoints ? standing?.rank ?? startRank : budgetStartRank;
                  const transfers = transferSummaryByTeamId.get(team.teamId) ?? 0;
                  return {
                    rank: derivedRank,
                    startPlace: startRank,
                    team: {
                      teamId: team.teamId,
                      name: team.name,
                      cash: team.cash,
                    },
                    upkeep,
                    transfers,
                  };
                }),
                currentSalaryFactor,
                localSave!.gameState.seasonState.adminBalancingConfig,
              ).map((row) => [row.teamId, row] as const),
            );
          })()
        : null;

    const responsePayload = {
      items:
        source === "sqlite"
          ? localSave!.gameState.teams.map((team) => {
              const standing = localSave!.gameState.seasonState.standings[team.teamId] ?? null;
              const row = localSheetRowByTeamId?.get(team.teamId) ?? null;
              const localDiscipline = localSeasonDisciplineValuesByTeamId?.get(team.teamId) ?? null;
              const hasCurrentPoints = standing?.points != null && Number.isFinite(standing.points) && standing.points > 0;
              const budgetStartRank = localStartRankByTeamId?.get(team.teamId) ?? null;
              const startRank = hasCurrentPoints ? standing?.startplatz ?? budgetStartRank : budgetStartRank;
              const displayRank = hasCurrentPoints ? standing?.rank ?? startRank : budgetStartRank;
              const prizeSummary = localPrizeSummaryByTeamId?.get(team.teamId) ?? null;
              const liveSponsorCash = localSponsorIncome?.sponsorCashByTeamId.get(team.teamId) ?? null;
              const liveGuv = localSeasonGuvByTeamId?.get(team.teamId) ?? null;
              return {
                teamId: team.teamId,
                teamName: team.name,
                teamCode: team.shortCode,
                rank: displayRank,
                points: hasCurrentPoints ? standing?.points ?? null : null,
                cash: team.cash,
                cashFc: standing?.cashFc ?? prizeSummary?.cashForecast ?? null,
                startplatz: startRank,
                rankDiff: standing?.rankDiff ?? prizeSummary?.rankDiff ?? null,
                sponsorBasis: standing?.sponsorBasis ?? prizeSummary?.basis ?? null,
                sponsorRank: standing?.sponsorRank ?? prizeSummary?.placementBonus ?? null,
                /**
                 * SPONSOREN UND GUV KOMMEN AUS DER ECHTEN ABRECHNUNG, nicht aus dem
                 * Preisgeld.
                 *
                 * Beide Vorgaenger-Quellen rechneten mit dem Preisgeld-Benchmark, der
                 * nie ausgezahlt wird: der persistierte `standing` (geschrieben vom
                 * Saisonende-Schritt in seiner alten Fassung) und `prizeSummary`
                 * (`buildTeamPrizeSummary` ueber `buildPrizeMoneyTable`). Fuer C-C
                 * standen dort 70,1 Sponsoren und +27,6 GuV, waehrend die Abrechnung
                 * 48,1 gegen 42,5 Gehaelter buchte.
                 *
                 * `getLeagueSponsorIncome` liefert dieselbe Sponsor-Abrechnung beim
                 * aktuellen Rang, die auch `applySponsorSettlement` gutschreibt, plus
                 * die Gebaeude netto. Sie hat Vorrang vor dem gespeicherten Stand —
                 * sonst zeigte ein Spielstand, der den Schritt frueher ausgefuehrt hat,
                 * fuer immer die alten Zahlen.
                 */
                sponsorTotal:
                  liveSponsorCash ?? standing?.sponsorTotal ?? prizeSummary?.sponsorTotal ?? null,
                /**
                 * EINE GuV, ueberall dieselbe (`lib/finance/season-end-guv.ts`). Vorher stand hier
                 * eine eigene Drei-Term-Rechnung (Sponsor + Gebaeude netto − Gehaelter), die den
                 * Apron, die Kreditzinsen und die Vorstandsziele nicht kannte — und damit eine
                 * andere Zahl auswies als der Finanzen-Reiter auf demselben Bildschirm.
                 *
                 * `guvPosten` faehrt die Aufschluesselung gleich mit, damit der Hover jeden Posten
                 * zeigen kann, ohne ihn im Client neu zu rechnen — auch die, die 0 sind.
                 */
                guv: liveGuv?.guv ?? standing?.guv ?? null,
                guvPosten: liveGuv?.posten ?? null,
                cashTotal: standing?.cashTotal ?? prizeSummary?.cashTotal ?? null,
                form: null,
                transfers: prizeSummary?.transfers ?? null,
                rosterCount: null,
                salaryTotal: null,
                marketValueTotal: null,
                disciplineValues: localDiscipline?.disciplineValues ?? (row ? extractSeasonStandingsDisciplineValues(row) : {}),
                warnings: Array.from(new Set([...(row?.warnings ?? []), ...(localDiscipline?.warnings ?? [])])),
              };
            })
          : mapping.rows
              .filter((row) => row.resolvedTeamId)
              .map((row) => ({
                teamId: row.resolvedTeamId,
                teamName: row.resolvedTeamName ?? row.teamName ?? row.rawTeamLabel,
                teamCode: row.teamCode,
                rank: row.rank,
                points: row.points,
                cash: row.resolvedTeamId ? (teamStateById.get(row.resolvedTeamId)?.cash ?? row.cash) : row.cash,
                cashFc: row.cashFc,
                startplatz: row.startplatz,
                rankDiff: row.rankDiff,
                sponsorBasis: row.sponsorBasis,
                sponsorRank: row.sponsorRank,
                sponsorTotal: row.sponsorTotal,
                guv: row.guv,
                cashTotal: row.cashTotal,
                form: row.form,
                transfers: row.transfers,
                rosterCount: null,
                salaryTotal: null,
                marketValueTotal: null,
                disciplineValues: extractSeasonStandingsDisciplineValues(row),
                warnings: row.warnings,
              })),
      missingMappings: mapping.missingInDb,
      mappingWarnings: mapping.mappingWarnings,
      source: {
        kind: source === "sqlite" ? "local_save" : "season_standings_sheet",
        access: sheet?.access ?? "local_save",
        detectedColumns: sheet?.detectedColumns ?? [],
        disciplineColumns: SEASON_STANDINGS_DISCIPLINE_COLUMNS,
      },
      scope: {
        saveId,
        seasonId,
      },
    };

    if (source === "sqlite" && localSave) {
      const cacheKey = `${localSave.saveId}:${seasonId}`;
      const cacheSignature = buildStandingsOverviewCacheSignature({
        localSave,
        seasonId,
        sourceKind: "live",
        contentSignature,
      });
      writeStandingsOverviewCache(cacheKey, cacheSignature, responsePayload);
    }

    if (source === "sqlite" && localSave && contentSignature) {
      return respondWithSliceEtag(request, {
        slice: "standings-overview",
        saveId: localSave.saveId,
        seasonId,
        contentSignature,
        payload: responsePayload,
      });
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Season standings overview could not be loaded.";
    return NextResponse.json(
      {
        items: [],
        missingMappings: [],
        mappingWarnings: [],
        source: {
          kind: "season_standings_sheet",
          access: "missing",
          detectedColumns: [],
          disciplineColumns: SEASON_STANDINGS_DISCIPLINE_COLUMNS,
        },
        scope: null,
        error: message,
      },
      { status: 500 },
    );
  }
}

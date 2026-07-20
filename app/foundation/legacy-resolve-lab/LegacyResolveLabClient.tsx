"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import type { DisciplineCategory } from "@/lib/data/olyDataTypes";
import type { LegacyMatchdayReadinessStatus } from "@/lib/lineups/legacy-matchday-readiness";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import type { PlayerHistoryDisciplineValues } from "@/lib/season/season-discipline-area-groups";
import type { DisciplineHighlightCandidate, LegacyMatchdayResolvePreview, ResolvePreviewStatus } from "@/lib/resolve/legacy-matchday-resolve-types";

// T-075 (Performance): PlayerDetailDrawer ist 3617 Zeilen und chart-schwer —
// per next/dynamic laden statt statisch. Verhalten identisch: PlayerDetailDrawer
// rendert `null`, solange `data` fehlt (hier der Regelfall bis zum ersten
// Player-Klick), daher ist ein `null`-Ladefallback äquivalent.
const PlayerDetailDrawer = dynamic(() => import("@/app/foundation/PlayerDetailDrawer"), {
  ssr: false,
  loading: () => null,
});

type ResolveLabResponse = {
  source: "sqlite" | "prisma";
  params: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  summary: {
    teamsTotal: number;
    teamsWithLineup: number;
    teamsReady: number;
    teamsUnderfilled: number;
    missingLineups: number;
    teamsMissingLineup: number;
    teamsInvalidLineup: number;
    teamsMissingScoreCoverage: number;
    warningsCount: number;
    d1DisciplineId: string | null;
    d1DisciplineName: string | null;
    d2DisciplineId: string | null;
    d2DisciplineName: string | null;
  };
  preview: LegacyMatchdayResolvePreview;
  teamRows: Array<
    LegacyMatchdayResolvePreview["teamResults"][number] & {
      topPlayer: string | null;
      highlightFlag: boolean;
      readinessStatus: LegacyMatchdayReadinessStatus;
      readinessReasonCodes: string[];
      activePlayersCount: number;
      requiredTotalUniquePlayers: number;
      missingPlayersToRequirement: number;
      shortReason: string;
    }
  >;
  teamDetails: Array<{
    teamId: string;
    teamName: string;
    hasLineup: boolean;
    readinessStatus: LegacyMatchdayReadinessStatus;
    readinessReasonCodes: string[];
    readinessExplanation: string;
    activePlayersCount: number;
    requiredTotalUniquePlayers: number;
    missingPlayersToRequirement: number;
    entries: Array<{
      disciplineId: string;
      disciplineName: string;
      disciplineSide: "d1" | "d2";
      slotIndex: number;
      playerId: string;
      activePlayerId: string | null;
      playerName: string;
      baseScore: number | null;
      fatigueAdjustedScore: number | null;
      captainBonus: number | null;
      mutatorBonus: number | null;
      finalPlayerScore: number | null;
      pointsAwarded: number | null;
      isCaptain: boolean;
      warnings: string[];
    }>;
    missingScores: string[];
    validationWarnings: string[];
  }>;
  topPlayers: {
    d1: Array<{
      playerId: string;
      rankInDiscipline: number;
      playerName: string;
      teamId: string;
      teamName: string;
      finalPlayerScore: number;
      pointsAwarded: number | null;
      slotIndex: number;
      isMvpCandidate: boolean;
    }>;
    d2: Array<{
      playerId: string;
      rankInDiscipline: number;
      playerName: string;
      teamId: string;
      teamName: string;
      finalPlayerScore: number;
      pointsAwarded: number | null;
      slotIndex: number;
      isMvpCandidate: boolean;
    }>;
  };
  playerCatalog: Array<{
    playerId: string;
    activePlayerId: string | null;
    teamId: string;
    teamCode: string;
    teamName: string;
    name: string;
    portraitUrl: string | null;
    className: string | null;
    potential: number | null;
    ovr: number | null;
    pps: number | null;
    traitsPositive: string[];
    traitsNegative: string[];
    pow: number | null;
    spe: number | null;
    men: number | null;
    soc: number | null;
    contractLength: number | null;
    salary: number | null;
    marketValue: number | null;
    disciplineValues: Array<{
      id: string;
      label: string;
      category?: DisciplineCategory;
      value: number | null;
    }>;
  }>;
  warnings: string[];
  error?: string;
};

type ApplyResponse = {
  success: boolean;
  source: "sqlite" | "prisma";
  dryRun?: boolean;
  applied?: boolean;
  previewStatus?: ResolvePreviewStatus | null;
  blockingReasons?: string[];
  error?: string;
  summary?: {
    matchdayResultId: string;
    teamsTotal: number;
    resultsWritten: number;
    playerPerformancesWritten: number;
    highlightsWritten: number;
    warningsCount: number;
    replacedExisting: boolean;
  };
};

const defaultParams: {
  source: "sqlite" | "prisma";
  saveId: string;
  seasonId: string;
  matchdayId: string;
} = {
  source: "sqlite",
  saveId: "save-initial",
  seasonId: "season-1",
  matchdayId: "matchday-1",
};

function getReadinessLabel(status: LegacyMatchdayReadinessStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "underfilled_roster":
      return "Underfilled";
    case "missing_lineup":
      return "Missing Draft";
    case "invalid_lineup":
      return "Invalid";
    case "missing_score_coverage":
      return "Missing Scores";
    default:
      return "Unknown";
  }
}

function getResolveStatusLabel(status: ResolvePreviewStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "incomplete_lineups":
      return "Incomplete";
    case "missing_lineups":
      return "Missing Lineup";
    case "missing_scores":
      return "Missing Scores";
    case "missing_sources":
      return "Missing Sources";
    case "blocked":
      return "Blocked";
    default:
      return status;
  }
}

function formatScore(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function flattenHighlights(preview: LegacyMatchdayResolvePreview): DisciplineHighlightCandidate[] {
  return preview.disciplinePreviews.flatMap((discipline) => discipline.highlightCandidates);
}

export default function LegacyResolveLabClient({
  initialParams,
}: {
  initialParams?: Partial<typeof defaultParams>;
}) {
  const resolvedInitialParams = useMemo(
    () => ({
      ...defaultParams,
      ...initialParams,
    }),
    [initialParams],
  );

  const [params, setParams] = useState(resolvedInitialParams);
  const [data, setData] = useState<ResolveLabResponse | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [applyResponse, setApplyResponse] = useState<ApplyResponse | null>(null);
  const [playerDrawerData, setPlayerDrawerData] = useState<PlayerDetailDrawerData | null>(null);

  useEffect(() => {
    setParams(resolvedInitialParams);
  }, [resolvedInitialParams]);

  async function loadPreview(overrides?: Partial<typeof params>) {
    const nextParams = { ...params, ...overrides };
    const query = new URLSearchParams(nextParams);
    setIsBusy(true);
    setErrors([]);

    try {
      const response = await fetch(`/api/resolve/legacy-matchday-preview?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ResolveLabResponse;
      if (!response.ok || payload.error) {
        setErrors([payload.error ?? "Legacy resolve preview could not be loaded."]);
        return;
      }
      setParams({
        ...payload.params,
        source: payload.source ?? nextParams.source,
      });
      setData(payload);
      setSelectedTeamId((current) => current ?? payload.teamRows[0]?.teamId ?? null);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void loadPreview(resolvedInitialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedInitialParams]);

  const selectedTeamDetail = useMemo(
    () => data?.teamDetails.find((team) => team.teamId === selectedTeamId) ?? null,
    [data, selectedTeamId],
  );
  const highlights = useMemo(() => (data ? flattenHighlights(data.preview) : []), [data]);
  const teamRows = data?.teamRows ?? [];
  const topPlayersD1 = data?.topPlayers.d1 ?? [];
  const topPlayersD2 = data?.topPlayers.d2 ?? [];
  const selectedTeamResult = useMemo(
    () => teamRows.find((team) => team.teamId === selectedTeamId) ?? null,
    [teamRows, selectedTeamId],
  );
  const selectedTeamD1Preview = useMemo(
    () =>
      data?.preview.disciplinePreviews
        .find((discipline) => discipline.disciplineSide === "d1")
        ?.teamResults.find((team) => team.teamId === selectedTeamId) ?? null,
    [data, selectedTeamId],
  );
  const selectedTeamD2Preview = useMemo(
    () =>
      data?.preview.disciplinePreviews
        .find((discipline) => discipline.disciplineSide === "d2")
        ?.teamResults.find((team) => team.teamId === selectedTeamId) ?? null,
    [data, selectedTeamId],
  );

  function openPlayerDrawer(playerId: string) {
    const player = data?.playerCatalog.find((entry) => entry.playerId === playerId) ?? null;
    if (!player) {
      return;
    }

    setPlayerDrawerData({
      playerId: player.playerId,
      activePlayerId: player.activePlayerId,
      source: params.source,
      sourceLabel: params.source === "prisma" ? "Prisma / Referenz read-only" : "SQLite / lokal",
      name: player.name,
      portraitUrl: player.portraitUrl,
      teamName: player.teamName,
      teamCode: player.teamCode,
      teamHumanControlled: null,
      transferStatus: player.activePlayerId ? "Active Player" : "Preview / Kontextspieler",
      className: player.className,
      race: null,
      subclasses: [],
      traitsPositive: player.traitsPositive,
      traitsNegative: player.traitsNegative,
      scoutingLevel: null,
      effectiveScoutingLevel: null,
      axisStarsDisplay: null,
      potentialStarsDisplay: null,
      potentialGapStars: null,
      scoutingDisclosure: null,
      hiddenPositiveTraitCount: 0,
      hiddenNegativeTraitCount: 0,
      preferredDisciplineIdsVisible: false,
      pow: player.pow,
      spe: player.spe,
      men: player.men,
      soc: player.soc,
      ovr: player.ovr,
      ovrRank: null,
      ovrDelta: null,
      ovrDeltaSourceLabel: null,
      ovrSourceLabel: "Kontext-OVR aus Preview-Katalog",
      pps: null,
      ppsRank: null,
      ppsDelta: null,
      ppsDeltaSourceLabel: null,
      ppsRating: player.pps,
      ppsSourceLabel: "Kontextansicht ohne gespeicherte Season-PPs",
      mvs: null,
      mvsRank: null,
      mvsDelta: null,
      mvsDeltaSourceLabel: null,
      mvsSourceLabel: "Keine belegte MVS-Quelle",
      marketValue: player.marketValue,
      marketValueSource: player.marketValue == null ? "missing_source" : "preview_catalog",
      salary: player.salary,
      salarySource: player.salary == null ? "missing_source" : "preview_catalog",
      normalSalary: player.salary,
      normalSalarySource: player.salary == null ? "missing_source" : "preview_catalog",
      purchasePrice: player.marketValue,
      purchasePriceSource: player.marketValue == null ? "missing_source" : "preview_catalog",
      contractLength: player.contractLength,
      contractLengthSource: player.contractLength == null ? "missing_source" : "preview_catalog",
      isImportedEconomy: false,
      economyStatus:
        player.marketValue == null
          ? "missing_market_value"
          : player.salary == null
            ? "missing_salary"
            : "imported_ready",
      demands: [],
      fatigue: null,
      availability: {
        injuryStatus: "healthy",
        injuryUntilMatchday: null,
        injuryRiskPercent: 0,
        injuryRiskBand: "none",
        injuryRiskLabel: "kein Risiko",
        performancePenaltyPercent: 0,
        isUnavailable: false,
        blocker: null,
        lastRoll: null,
        normalRecovery: null,
        injuryRecovery: null,
        injuryHistory: [],
      },
      form: null,
      potential: player.potential,
      scoutPotential: null,
      developmentInsight: null,
      organicProgression: null,
      seasonOrganicForecast: null,
      classHistory: [],
      attributeVisibility: "scouted",
      attributeStats: [],
      baselineAttributeDeltas: [],
      axisCards: [
        { id: "pow", label: "POW", tone: "power", value: player.pow, valueRank: null, seasonPoints: null, seasonPointsRank: null, previousSeasonPointsRank: null },
        { id: "spe", label: "SPE", tone: "speed", value: player.spe, valueRank: null, seasonPoints: null, seasonPointsRank: null, previousSeasonPointsRank: null },
        { id: "men", label: "MEN", tone: "mental", value: player.men, valueRank: null, seasonPoints: null, seasonPointsRank: null, previousSeasonPointsRank: null },
        { id: "soc", label: "SOC", tone: "social", value: player.soc, valueRank: null, seasonPoints: null, seasonPointsRank: null, previousSeasonPointsRank: null },
      ],
      disciplineValues: player.disciplineValues.map((entry, index) => ({
        ...entry,
        category: entry.category ?? "power",
        seasonPoints: null,
        seasonPointsRank: null,
        seasonAppearances: null,
        allTimePoints: null,
        allTimePointsRank: null,
        allTimeAppearances: null,
        currentSeasonMutatorPps: null,
        slotLabels: [],
        lastSeasonPoints: null,
        lastSeasonAppearances: null,
        lastSeasonId: null,
        upgradeDelta: null,
        lastSeasonDisciplineValues: null,
        currentDisciplineValues: entry.value,
        disciplineDelta: null,
        rank: entry.value == null ? null : index + 1,
        playerCount: null,
      })),
      boardTrust: null,
      morale: null,
      progressionForecast: null,
      developmentLevelup: null,
      progressionEvents: [],
      progressionEconomyPreview: null,
      seasonPerformance: null,
      transferContext: {
        roleTag: null,
        promisedRole: null,
        joinedSeasonId: null,
        purchasePrice: null,
        currentValue: null,
        expectedSellValue: null,
        lastTransfer: null,
      },
      transferHistory: [],
      seasonHistory: [],
      historyRows: [
        {
          seasonId: params.seasonId,
          seasonName: params.matchdayId,
          isActiveSeason: true,
          sourceLabel: "Resolve-Preview-Kontext",
          teamName: player.teamName,
          teamCode: player.teamCode,
          appearances: null,
          averageFatigue: null,
          totalPoints: null,
          pow: null,
          spe: null,
          men: null,
          soc: null,
          disciplineValues: {} satisfies PlayerHistoryDisciplineValues,
          ovr: player.ovr,
          ovrRank: null,
          pps: null,
          ppsRank: null,
          mvs: null,
          mvsRank: null,
          marketValue: player.marketValue,
          marketValueBaselineDelta: null,
          transferType: null,
          transferFee: null,
          transferMarketValue: null,
          transferDeltaToMarketValue: null,
          transferMarketValueFactor: null,
          projectedSellValue: null,
          projectedSellFactor: null,
          projectedSellSourceLabel: null,
          saleFactorRankInBracket: null,
          saleFactorBracketSize: null,
          salary: player.salary,
          contractLength: player.contractLength,
          averageContribution: null,
          averageFinalScore: null,
          bestDisciplineLabel: player.disciplineValues[0]?.label ?? null,
          injuriesCount: null,
          matchdaysMissed: null,
          warnings: [],
        },
      ],
      economyCompare: null,
      ratingWarnings: ["mvs_source_missing"],
      potentialOverallStars: null,
      currentOverallStars: null,
      potentialOverallDelta: null,
      potentialOverallDeltaSourceLabel: null,
      potentialAxisStatus: [],
      attributeCeilingPreview: [],
      projectedClassPreview: null,
      trainingRouteImpact: null,
    } as unknown as PlayerDetailDrawerData);
  }

  async function runApply(mode: "dry-run" | "execute") {
    setIsApplying(true);
    setApplyResponse(null);

    try {
      const response = await fetch("/api/resolve/legacy-matchday-apply", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          saveId: params.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          source: params.source,
          dryRun: mode !== "execute",
          execute: mode === "execute",
          confirm: mode === "execute" ? "APPLY_MATCHDAY_RESULT" : undefined,
        }),
      });
      const payload = (await response.json()) as ApplyResponse;
      setApplyResponse(payload);
      if (mode === "execute" && payload.success) {
        await loadPreview(params);
      }
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <main className="app-shell foundation-shell">
      <section className="hero">
        <h1>Legacy Resolve Lab</h1>
        <p>
          <Link href="/foundation">Zurück zur Foundation</Link>
        </p>
      </section>

      {errors.length > 0 ? (
        <div className="error-banner">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <div className="stack legacy-resolve-lab-grid">
      <section className="panel">
          <div className="panel-header">
            <h2>Kontext</h2>
          </div>
          <div className="legacy-lineup-lab-controls">
            <label>
              <span>Save</span>
              <input className="input" value={params.saveId} onChange={(event) => setParams((current) => ({ ...current, saveId: event.target.value }))} />
            </label>
            <label>
              <span>Source</span>
              <select
                className="input"
                value={params.source}
                onChange={(event) =>
                  setParams((current) => ({
                    ...current,
                    source: event.target.value === "prisma" ? "prisma" : "sqlite",
                  }))
                }
              >
                <option value="sqlite">Local SQLite</option>
                <option value="prisma">Prisma Read-only</option>
              </select>
            </label>
            <label>
              <span>Season</span>
              <input className="input" value={params.seasonId} onChange={(event) => setParams((current) => ({ ...current, seasonId: event.target.value }))} />
            </label>
            <label>
              <span>Matchday</span>
              <input className="input" value={params.matchdayId} onChange={(event) => setParams((current) => ({ ...current, matchdayId: event.target.value }))} />
            </label>
          </div>
          <div className="legacy-lineup-lab-actions">
            <button className="secondary-button" type="button" onClick={() => void loadPreview(params)} disabled={isBusy}>
              Preview laden
            </button>
          </div>
        </section>

        {data?.summary.warningsCount || data?.preview.incompleteLineups.length ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Hinweise</h2>
          </div>
          <ul className="warning-list compact-list">
            {data.summary.warningsCount > 0 ? <li>{data.summary.warningsCount} Resolve-Warnungen vorhanden.</li> : null}
            {data.preview.incompleteLineups.length > 0 ? <li>{data.preview.incompleteLineups.length} unvollständige Lineups.</li> : null}
          </ul>
        </section>
        ) : null}

        <section className="panel">
          <div className="panel-header">
            <h2>Result Apply</h2>
          </div>
          <p className="muted">
            Local only. Dieser Schritt speichert nur das Resolve-Ergebnis im lokalen Save. Keine Standings-, Cash- oder Prize-Writes.
          </p>
          <div className="legacy-lineup-lab-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => void runApply("dry-run")}
              disabled={isApplying || isBusy || !data}
            >
              Dry Run
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => void runApply("execute")}
              disabled={isApplying || isBusy || !data || params.source === "prisma" || data.preview.status !== "ready"}
            >
              Ergebnis lokal speichern
            </button>
          </div>
          {params.source === "prisma" ? (
            <p className="muted">Prisma ist hier read-only. Result Apply ist nur im lokalen SQLite-Testspielstand erlaubt.</p>
          ) : null}
          {applyResponse ? (
            <div className="stack">
              <p>
                {applyResponse.success
                  ? applyResponse.applied
                    ? "Ergebnis lokal gespeichert."
                    : "Dry Run erfolgreich."
                  : applyResponse.error ?? "Apply fehlgeschlagen."}
              </p>
              {applyResponse.summary ? (
                <p className="muted">
                  Teams {applyResponse.summary.teamsTotal} · Results {applyResponse.summary.resultsWritten} · Player Performances {applyResponse.summary.playerPerformancesWritten} · Highlights {applyResponse.summary.highlightsWritten}
                </p>
              ) : null}
              {applyResponse.blockingReasons && applyResponse.blockingReasons.length > 0 ? (
                <ul className="warning-list">
                  {applyResponse.blockingReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="panel legacy-resolve-table-panel">
          <div className="panel-header">
            <h2>Team Results</h2>
          </div>
          <div className="legacy-resolve-table-wrap">
            <table className="legacy-resolve-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>D1 Status</th>
                  <th>D1</th>
                  <th>D1 PPs</th>
                  <th>D2 Status</th>
                  <th>D2</th>
                  <th>D2 PPs</th>
                  <th>Total</th>
                  <th>Total PPs</th>
                  <th>Warnings</th>
                  <th>Reason</th>
                  <th>Top Player</th>
                  <th>Highlight</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map((team) => (
                  <tr key={team.teamId} className={selectedTeamId === team.teamId ? "is-selected" : ""} onClick={() => setSelectedTeamId(team.teamId)}>
                    <td>{team.rank}</td>
                    <td>{team.teamName}</td>
                    <td>{getResolveStatusLabel(team.status)}</td>
                    <td>{getResolveStatusLabel(team.d1Status)}</td>
                    <td>{formatScore(team.d1Score)}</td>
                    <td>{team.d1Points == null ? "—" : formatScore(team.d1Points)}</td>
                    <td>{getResolveStatusLabel(team.d2Status)}</td>
                    <td>{formatScore(team.d2Score)}</td>
                    <td>{team.d2Points == null ? "—" : formatScore(team.d2Points)}</td>
                    <td>{formatScore(team.totalScore)}</td>
                    <td>{team.totalPoints == null ? "—" : formatScore(team.totalPoints)}</td>
                    <td>{team.warnings.length}</td>
                    <td>{team.shortReason}</td>
                    <td>{team.topPlayer ?? "—"}</td>
                    <td>{team.highlightFlag ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {teamRows.length === 0 ? <p className="muted">Keine Team-Resultate verfügbar.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Team Detail</h2>
          </div>
          {selectedTeamDetail ? (
            <div className="stack">
              <p>
                {selectedTeamDetail.teamName} · {getReadinessLabel(selectedTeamDetail.readinessStatus)}
              </p>
              {selectedTeamResult ? (
                <p className="muted">
                  Preview Status: {getResolveStatusLabel(selectedTeamResult.status)} · D1 {getResolveStatusLabel(selectedTeamResult.d1Status)} · D2 {getResolveStatusLabel(selectedTeamResult.d2Status)}
                </p>
              ) : null}
              <p className="muted">
                Active Players: {selectedTeamDetail.activePlayersCount} / Required Unique Players: {selectedTeamDetail.requiredTotalUniquePlayers}
              </p>
              <p className="muted">{selectedTeamDetail.readinessExplanation}</p>
              {selectedTeamResult?.missingLineup ? (
                <p className="muted">
                  Für dieses Team wurde aktuell kein gespeichertes Legacy-Lineup gefunden. Team-Score bleibt im Preview deshalb auf dem Default-/Warnzustand.
                </p>
              ) : null}
              {selectedTeamDetail.missingPlayersToRequirement > 0 ? (
                <p className="muted">Fehlende Spieler bis Matchday-Anforderung: {selectedTeamDetail.missingPlayersToRequirement}</p>
              ) : null}
              {selectedTeamDetail.readinessReasonCodes.length > 0 ? (
                <p className="muted">Reason Codes: {selectedTeamDetail.readinessReasonCodes.join(", ")}</p>
              ) : null}
              {selectedTeamDetail.validationWarnings.length > 0 ? (
                <ul className="warning-list">
                  {selectedTeamDetail.validationWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              {selectedTeamDetail.missingScores.length > 0 ? (
                <ul className="warning-list">
                  {selectedTeamDetail.missingScores.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              <div className="legacy-resolve-side-grid">
                {([
                  {
                    key: "d1" as const,
                    label: "D1",
                    preview: selectedTeamD1Preview,
                    entries: selectedTeamDetail.entries.filter((entry) => entry.disciplineSide === "d1"),
                  },
                  {
                    key: "d2" as const,
                    label: "D2",
                    preview: selectedTeamD2Preview,
                    entries: selectedTeamDetail.entries.filter((entry) => entry.disciplineSide === "d2"),
                  },
                ]).map((side) => (
                  <section key={side.key} className={`panel legacy-resolve-side-panel legacy-resolve-side-panel-${side.key}`}>
                    <div className="panel-header">
                      <div className="stack">
                        <h3>
                          {side.label} · {side.preview?.disciplineId ?? "—"}
                        </h3>
                        <p className="muted">
                          Status {getResolveStatusLabel(side.preview?.status ?? "blocked")} · Rang {side.preview?.rank ?? "—"} · Spieler{" "}
                          {side.entries.length}/{side.preview?.entries.length ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="legacy-resolve-side-kpis">
                      <span>Base: {side.preview ? formatScore(side.preview.baseScore) : "—"}</span>
                      <span>Fatigue: {side.preview?.fatigueModifier == null ? "—" : formatScore(side.preview.fatigueModifier)}</span>
                      <span>Captain: {side.preview?.captainBonus == null ? "—" : formatScore(side.preview.captainBonus)}</span>
                      <span>Form: {side.preview?.formModifier == null ? "—" : formatScore(side.preview.formModifier)}</span>
                      <span>Mutator: {side.preview?.mutatorModifier == null ? "—" : formatScore(side.preview.mutatorModifier)}</span>
                      <span>Total: {side.preview ? formatScore(side.preview.finalPreviewScore) : "—"}</span>
                      <span>PPs: {side.preview?.teamPoints == null ? "—" : formatScore(side.preview.teamPoints)}</span>
                    </div>
                    {side.preview?.warnings.length ? (
                      <ul className="warning-list compact-list">
                        {side.preview.warnings.map((warning) => (
                          <li key={`${side.key}-preview-warning-${warning}`}>{warning}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="legacy-resolve-detail-list">
                      {side.entries.map((entry) => (
                        <div
                          key={`${entry.disciplineId}-${entry.disciplineSide}-${entry.slotIndex}`}
                          className="legacy-resolve-detail-row legacy-resolve-player-row"
                        >
                          <span>Slot {entry.slotIndex + 1}</span>
                          <button
                            type="button"
                            className="table-link-button legacy-resolve-player-link"
                            onClick={() => openPlayerDrawer(entry.playerId)}
                          >
                            {entry.playerName}
                          </button>
                          <span>Base {entry.baseScore == null ? "—" : formatScore(entry.baseScore)}</span>
                          <span>Fatigue {entry.fatigueAdjustedScore == null ? "—" : formatScore(entry.fatigueAdjustedScore)}</span>
                          <span>Captain {entry.captainBonus == null ? "—" : formatScore(entry.captainBonus)}</span>
                          <span>Mutator {entry.mutatorBonus == null ? "—" : formatScore(entry.mutatorBonus)}</span>
                          <span>Total {entry.finalPlayerScore == null ? "—" : formatScore(entry.finalPlayerScore)}</span>
                          <span>PPs {entry.pointsAwarded == null ? "—" : formatScore(entry.pointsAwarded)}</span>
                          <span>{entry.isCaptain ? "Captain" : "—"}</span>
                        </div>
                      ))}
                    </div>
                    {side.entries.length === 0 ? <p className="muted">Keine eingesetzten Spieler auf dieser Seite vorhanden.</p> : null}
                  </section>
                ))}
              </div>
              {selectedTeamDetail.entries.length === 0 ? <p className="muted">Keine eingesetzten Spieler für dieses Team vorhanden.</p> : null}
            </div>
          ) : (
            <p className="muted">Kein Team ausgewählt.</p>
          )}
        </section>

        <div className="legacy-resolve-side-grid">
          <section className="panel legacy-resolve-side-panel legacy-resolve-side-panel-d1">
            <div className="panel-header">
              <h2>Top Players D1</h2>
            </div>
            <div className="legacy-resolve-detail-list">
              {topPlayersD1.map((player) => (
                <div
                  key={`${player.teamId}-${player.playerName}-${player.rankInDiscipline}`}
                  className="legacy-resolve-detail-row"
                >
                  <span>#{player.rankInDiscipline}</span>
                  <button
                    type="button"
                    className="table-link-button legacy-resolve-player-link"
                    onClick={() => openPlayerDrawer(player.playerId)}
                  >
                    {player.playerName}
                  </button>
                  <span>{player.teamName}</span>
                  <span>{formatScore(player.finalPlayerScore)}</span>
                  <span>PPs {player.pointsAwarded == null ? "—" : formatScore(player.pointsAwarded)}</span>
                  <span>Slot {player.slotIndex + 1}</span>
                  <span>{player.isMvpCandidate ? "MVP" : "—"}</span>
                </div>
              ))}
              {topPlayersD1.length === 0 ? <p className="muted">Keine D1-Spieler vorhanden.</p> : null}
            </div>
          </section>

          <section className="panel legacy-resolve-side-panel legacy-resolve-side-panel-d2">
            <div className="panel-header">
              <h2>Top Players D2</h2>
            </div>
            <div className="legacy-resolve-detail-list">
              {topPlayersD2.map((player) => (
                <div
                  key={`${player.teamId}-${player.playerName}-${player.rankInDiscipline}`}
                  className="legacy-resolve-detail-row"
                >
                  <span>#{player.rankInDiscipline}</span>
                  <button
                    type="button"
                    className="table-link-button legacy-resolve-player-link"
                    onClick={() => openPlayerDrawer(player.playerId)}
                  >
                    {player.playerName}
                  </button>
                  <span>{player.teamName}</span>
                  <span>{formatScore(player.finalPlayerScore)}</span>
                  <span>PPs {player.pointsAwarded == null ? "—" : formatScore(player.pointsAwarded)}</span>
                  <span>Slot {player.slotIndex + 1}</span>
                  <span>{player.isMvpCandidate ? "MVP" : "—"}</span>
                </div>
              ))}
              {topPlayersD2.length === 0 ? <p className="muted">Keine D2-Spieler vorhanden.</p> : null}
            </div>
          </section>
        </div>

        <section className="panel legacy-resolve-highlights-panel">
          <div className="panel-header">
            <h2>Highlight Candidates</h2>
          </div>
          <div className="legacy-resolve-detail-list">
            {highlights.map((highlight, index) => (
              <div key={`${highlight.highlightType}-${highlight.teamId ?? "none"}-${index}`} className="legacy-resolve-detail-row">
                <span>{highlight.highlightType}</span>
                <span>{highlight.teamId ?? "—"}</span>
                <span>{highlight.playerId ?? "—"}</span>
                <span>{formatScore(highlight.importanceScore)}</span>
                <span>{highlight.shortSummary ?? "—"}</span>
              </div>
            ))}
            {highlights.length === 0 ? <p className="muted">Keine Highlight-Kandidaten vorhanden.</p> : null}
          </div>
        </section>

        <PlayerDetailDrawer data={playerDrawerData} onClose={() => setPlayerDrawerData(null)} />
      </div>
    </main>
  );
}

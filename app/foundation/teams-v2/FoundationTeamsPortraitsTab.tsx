// @ts-nocheck
"use client";

import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { formatContractShapeShortLabel, rosterSalariesDifferForDisplay } from "@/lib/foundation/player-economy-contract";
import { formatPlayerIdentitySubMeta } from "@/lib/foundation/player-identity-meta";

export type FoundationTeamsPortraitsTabProps = {
  selectedTeam: unknown;
  selectedTeamViewRow: unknown;
  filteredSelectedRosterTableRows: unknown;
  selectedStandingRow: unknown;
  selectedRoster: unknown;
  teamRosterRoleFilterOptions: unknown;
  teamRosterRoleFilter: unknown;
  setTeamRosterRoleFilter: unknown;
  teamRosterFocusOptions: unknown;
  teamRosterFocusMode: unknown;
  setTeamRosterFocusMode: unknown;
  gameState: unknown;
  leaguePlayerHeatPools: unknown;
  getPlayerPortraitModel: unknown;
  getClassColorClassName: unknown;
  openPlayerDrawerById: unknown;
  formatLocalePoints: unknown;
  formatDisplayMoney: unknown;
  formatMoney: unknown;
  getRosterEntryDisplayMarketValue: unknown;
  getRosterEntryDisplaySalary: unknown;
  getRosterEntryCurrentSeasonSalary: unknown;
  getPlayerDisplayMarketValueDelta: unknown;
  getRosterEntrySalaryDelta: unknown;
  formatWholeNumber: unknown;
  portraitAvgOvr: number | null;
  portraitAvgSalary: number | null;
  contractExpiringCount: number;
};

export default function FoundationTeamsPortraitsTab({
  selectedTeam,
  selectedTeamViewRow,
  filteredSelectedRosterTableRows,
  selectedStandingRow,
  selectedRoster,
  teamRosterRoleFilterOptions,
  teamRosterRoleFilter,
  setTeamRosterRoleFilter,
  teamRosterFocusOptions,
  teamRosterFocusMode,
  setTeamRosterFocusMode,
  gameState,
  leaguePlayerHeatPools,
  getPlayerPortraitModel,
  getClassColorClassName,
  openPlayerDrawerById,
  formatLocalePoints,
  formatDisplayMoney,
  formatMoney,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntryCurrentSeasonSalary,
  getPlayerDisplayMarketValueDelta,
  getRosterEntrySalaryDelta,
  formatWholeNumber,
  portraitAvgOvr,
  portraitAvgSalary,
  contractExpiringCount,
}: FoundationTeamsPortraitsTabProps) {
  const isRosterRoleFiltered = teamRosterRoleFilter !== "all";
  const visibleSalaryTotal = (() => {
    const values = filteredSelectedRosterTableRows
      .map(({ entry, player }) => getRosterEntryCurrentSeasonSalary(entry, player))
      .filter((value) => value != null && Number.isFinite(value));
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
  })();
  const visibleMarketValueTotal = (() => {
    const values = filteredSelectedRosterTableRows
      .map(({ entry, player }) => getRosterEntryDisplayMarketValue(entry, player))
      .filter((value) => value != null && Number.isFinite(value));
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
  })();

  return (
    <>
      <section className="player-drawer-section player-drawer-hero-surface team-drawer-dashboard teams-portraits-dashboard">
        <div className="team-drawer-dashboard-grid">
          <article className="team-drawer-identity-card">
            <h3>{selectedTeam.shortCode}</h3>
            <p>
              {filteredSelectedRosterTableRows.length} Spieler
              {portraitAvgOvr != null ? ` · Ø OVR ${formatLocalePoints(portraitAvgOvr, 1)}` : ""}
            </p>
            <div className="player-drawer-mini-facts">
              <span>Ø Gehalt {portraitAvgSalary != null ? formatDisplayMoney(portraitAvgSalary) : "—"}</span>
              <span>{contractExpiringCount} laufen aus</span>
              <span>{selectedStandingRow?.rank != null ? `Rang #${selectedStandingRow.rank}` : "Rang offen"}</span>
            </div>
          </article>
          <div className="team-drawer-rank-grid">
            {[
              { label: "POW", value: selectedTeamViewRow?.currentPowRank ?? null, tone: "is-pow" },
              { label: "SPE", value: selectedTeamViewRow?.currentSpeRank ?? null, tone: "is-spe" },
              { label: "MEN", value: selectedTeamViewRow?.currentMenRank ?? null, tone: "is-men" },
              { label: "SOC", value: selectedTeamViewRow?.currentSocRank ?? null, tone: "is-soc" },
            ].map((entry) => (
              <article key={entry.label} className={`team-drawer-rank-card ${entry.tone}`}>
                <span>{entry.label}</span>
                <strong>{entry.value != null ? `#${formatWholeNumber(entry.value)}` : "—"}</strong>
              </article>
            ))}
          </div>
          <div className="team-drawer-finance-grid">
            <article className="metric-card">
              <span>Cash</span>
              <strong>{selectedTeamViewRow?.cash != null ? formatMoney(selectedTeamViewRow.cash) : "—"}</strong>
            </article>
            <article className="metric-card">
              <span>Gehalt{isRosterRoleFiltered ? " (Filter)" : ""}</span>
              <strong>{visibleSalaryTotal != null ? formatMoney(visibleSalaryTotal) : "—"}</strong>
            </article>
            <article className="metric-card">
              <span>Marktwert{isRosterRoleFiltered ? " (Filter)" : ""}</span>
              <strong>{visibleMarketValueTotal != null ? formatMoney(visibleMarketValueTotal) : "—"}</strong>
            </article>
          </div>
        </div>
      </section>
      <div className="team-roster-role-filterbar" aria-label="Kaderrollen filtern">
        {teamRosterRoleFilterOptions.map((option) => (
          <button
            key={`team-portraits-role-filter-${option.id}`}
            className={`secondary-button inline-button${teamRosterRoleFilter === option.id ? " is-active" : ""}`}
            type="button"
            onClick={() => setTeamRosterRoleFilter(option.id)}
          >
            {option.label} <span>{option.count}</span>
          </button>
        ))}
      </div>

      <div className="team-roster-focusbar" aria-label="Kaderfokus waehlen">
        {teamRosterFocusOptions.map((option) => (
          <button
            key={`team-portraits-focus-${option.id}`}
            className={`secondary-button inline-button${teamRosterFocusMode === option.id ? " is-active" : ""}`}
            type="button"
            onClick={() => setTeamRosterFocusMode(option.id)}
          >
            {option.label} <span>{option.count}</span>
          </button>
        ))}
      </div>
      <section className="team-portraits-panel" id="team-focus-portraits" aria-label="Kader Portraits">
        <div className="team-portraits-grid" data-testid="team-portraits-grid">
          {filteredSelectedRosterTableRows.length > 0 ? (
            filteredSelectedRosterTableRows.map(({ entry, player, playerOvr, playerMvs, playerPps, ovrRank, mvsRank, ppsRank }) => {
              const portrait = getPlayerPortraitModel(player);
              const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
              const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
              const annualSalary = getRosterEntryDisplaySalary(entry, player);
              const currentSeasonSalary = getRosterEntryCurrentSeasonSalary(entry, player);
              const salaryTitle = rosterSalariesDifferForDisplay(currentSeasonSalary, annualSalary)
                ? `Jahresgehalt ${formatDisplayMoney(annualSalary)}`
                : undefined;
              const portraitSubMeta = formatPlayerIdentitySubMeta(player);
              return (
                <FoundationPlayerPortraitCard
                  key={entry.id}
                  playerId={player.id}
                  name={player.name}
                  portraitUrl={portrait.src}
                  portraitPlaceholderUrl={portrait.previewSrc ?? portrait.thumbSrc}
                  portraitInitials={portrait.initials}
                  playerOvr={playerOvr}
                  playerMvs={playerMvs}
                  playerPps={playerPps}
                  ovrRank={ovrRank}
                  mvsRank={mvsRank}
                  ppsRank={ppsRank}
                  pow={player.coreStats.pow}
                  spe={player.coreStats.spe}
                  men={player.coreStats.men}
                  soc={player.coreStats.soc}
                  leagueHeatPools={leaguePlayerHeatPools}
                  variant="team"
                  roleTag={entry.roleTag}
                  playerClassName={player.className}
                  className={getClassColorClassName(player.className, "player-card-class-frame")}
                  subMeta={portraitSubMeta || null}
                  onOpen={() => void openPlayerDrawerById(player.id, entry.id)}
                  title={`${player.name} öffnen`}
                  economyStats={[
                    {
                      label: "MW",
                      value: formatLocalePoints(getRosterEntryDisplayMarketValue(entry, player), 2),
                      delta:
                        marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01
                          ? `${marketValueDelta > 0 ? "+" : ""}${formatLocalePoints(marketValueDelta, 2)}`
                          : null,
                      deltaClass:
                        marketValueDelta != null && marketValueDelta > 0
                          ? "text-positive"
                          : marketValueDelta != null && marketValueDelta < 0
                            ? "text-negative"
                            : "",
                    },
                    {
                      label: "Gehalt",
                      value: formatDisplayMoney(currentSeasonSalary),
                      title: salaryTitle,
                      delta:
                        salaryDelta != null && Math.abs(salaryDelta) >= 0.01
                          ? `${salaryDelta > 0 ? "+" : ""}${formatDisplayMoney(salaryDelta)}`
                          : null,
                      deltaClass:
                        salaryDelta != null && salaryDelta < 0
                          ? "text-positive"
                          : salaryDelta != null && salaryDelta > 0
                            ? "text-negative"
                            : "",
                    },
                    {
                      label: "LZ",
                      value: `${entry.contractLength ?? "—"}${formatContractShapeShortLabel(entry.contractShape) ? ` · ${formatContractShapeShortLabel(entry.contractShape)}` : ""}`,
                    },
                  ]}
                />
              );
            })
          ) : (
            <p className="muted">Keine Spieler für den aktuellen Filter.</p>
          )}
        </div>
        <p className="muted team-portraits-meta">
          {filteredSelectedRosterTableRows.length} / {selectedStandingRow?.rosterCount ?? selectedRoster.length} Spieler · OVR/MVS relativ zur Liga
        </p>
      </section>
    </>
  );
}

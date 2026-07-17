"use client";

import { useMemo, useState, type CSSProperties } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlBarChart,
  NlCard,
  NlCountUpValue,
  NlDeltaChip,
  NlMedalBadge,
  NlProgressBar,
  StatChip,
  StatChipRow,
  formatNlMoney,
  formatNlNumber,
  useCountUp,
  type NlBarChartBar,
} from "@/components/foundation/new-look";
import type { FoundationPrizeV2PanelProps } from "@/app/foundation/prize-v2/FoundationPrizeV2Panel";
import type { FoundationPrizePreviewItem } from "@/lib/foundation/tabs/cockpit-types";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import { clampValue } from "@/lib/foundation/tabs/prize-v2-ui-helpers";
import { getCockpitStatusPillClass } from "@/lib/foundation/tabs/cockpit-ui-helpers";

/**
 * "Neuer Look" Preisgeld — Verteilung, Forecast-Chart, Champion-Moment
 * und aufgeräumte Preisgeld-Tabelle (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `FoundationPrizeV2Panel` fällt ohne Flag unverändert auf das bestehende
 * Layout zurück. Konsumiert exakt dieselben Props/Daten:
 * - Verteilung: reale Ränge + `prizeMoney` aus `prizePreviewFeed.items`,
 * - Forecast: die bereits berechneten `prizeForecastRows` (Faktor, Preisgeld,
 *   Gehalt, GuV, Cash) — als Chart plus kompakte Tabelle,
 * - Champion: `seasonEndChampionRow` (nur wenn vorhanden),
 * - Tabelle: `displayPrizePreviewRows` mit Bonus/Malus & Cash in good/risk.
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten gibt:
 * - kein Preisgeld-Verlauf pro Spieltag (existiert nicht),
 * - keine Spalten-/Breiten-Verwaltung (bewusst feste, aufgeräumte Spalten;
 *   die konfigurierbare Tabelle bleibt im alten Look unverändert erhalten).
 */

const NL_PRIZE_MAX_RANK = 32;

/** Vorzeichenbehaftetes `formatNlMoney` — hält GuV/Bonus-Malus-Spalten konsistent mit den Mio/k-formatierten Geldzellen in derselben Tabelle. */
function formatSignedNlMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNlMoney(value)}`;
}

function compareByRank(left: FoundationPrizePreviewItem, right: FoundationPrizePreviewItem): number {
  const leftRank = left.rank != null && Number.isFinite(left.rank) ? left.rank : Number.POSITIVE_INFINITY;
  const rightRank = right.rank != null && Number.isFinite(right.rank) ? right.rank : Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return left.teamName.localeCompare(right.teamName, "de-DE");
}

export default function FoundationPrizeV2NewLook({
  gameState,
  activeContextMeta,
  prizePreviewFeed,
  prizePreviewHardBlocked,
  prizePreviewGlobalWarnings,
  prizeApplyState,
  seasonEndChampionRow,
  selectedTeam,
  prizeForecastRank,
  setPrizeForecastRank,
  prizeForecastRankRow,
  prizeForecastRows,
  displayPrizePreviewRows,
  prizeV2Summary,
  prizeV2LeaderRow,
  prizeV2SelectedTeamSummary,
  prizeV2SwingRow,
  prizeV2RiskRow,
  prizeV2FactorRows,
  formatLocalePoints,
  formatNullableMoney,
  formatSignedDisplayMoney,
  getViewSourceBadgeLabel,
  setFoundationView,
  setActiveView,
  openTeamProfileById,
}: FoundationPrizeV2PanelProps) {
  const teamsById = useMemo(() => {
    const map = new Map<string, (typeof gameState.teams)[number]>();
    for (const team of gameState.teams) {
      map.set(team.teamId, team);
    }
    return map;
  }, [gameState.teams]);

  const selectedTeamId = selectedTeam?.teamId ?? null;

  /** Reale Verteilung Rang → Preisgeld aus dem Preview-Feed (Ränge 1–32). */
  const distributionItems = useMemo(() => {
    const items = (prizePreviewFeed?.items ?? [])
      .filter(
        (item) =>
          item.rank != null &&
          Number.isFinite(item.rank) &&
          item.rank >= 1 &&
          item.rank <= NL_PRIZE_MAX_RANK &&
          item.prizeMoney != null &&
          Number.isFinite(item.prizeMoney),
      )
      .sort(compareByRank);
    return items;
  }, [prizePreviewFeed]);

  const maxDistributionMoney = useMemo(
    () =>
      distributionItems.reduce(
        (max, item) => (item.prizeMoney != null && Number.isFinite(item.prizeMoney) && item.prizeMoney > max ? item.prizeMoney : max),
        0,
      ),
    [distributionItems],
  );

  const ownDistributionItem = useMemo(
    () => distributionItems.find((item) => item.teamId === selectedTeamId) ?? null,
    [distributionItems, selectedTeamId],
  );

  /** 5-Seasons-Forecast als Chart: Cash je Season, Ton nach GuV-Vorzeichen. */
  const forecastBars = useMemo<NlBarChartBar[]>(
    () =>
      prizeForecastRows
        .filter((row) => row.cashAfter != null && Number.isFinite(row.cashAfter))
        .map((row) => ({
          label: row.label,
          value: row.cashAfter as number,
          tone: row.guv != null && row.guv < 0 ? "risk" : "good",
        })),
    [prizeForecastRows],
  );

  // Erste (simulierte) Forecast-Zeile: dieselbe Quelle wie Chart + Tabelle, die
  // auf "Platz simulieren" reagieren. Speist Bonus/Malus (GuV) und "Cash nachher"
  // (cashAfter), damit die Eckwert-Chips nicht dem realen Rang, sondern der
  // Simulation folgen. "Cash vorher" bleibt der reale Startwert.
  const firstForecastRow = prizeForecastRows[0] ?? null;

  // Headline-Geldbeträge zählen hoch (#Wave2) — die Haupttabelle und die
  // Verteilungsbalken bleiben unverändert (sortierbar/groß, kein Zähler).
  const animatedSummaryBonusMalus = useCountUp(prizePreviewFeed?.summary.totalRankChangePrize ?? null);
  const animatedForecastCashBefore = useCountUp(prizeV2SelectedTeamSummary?.currentCash ?? null);
  const animatedForecastPrizeMoney = useCountUp(prizeForecastRankRow?.prizeMoney ?? null);
  const animatedForecastBonusMalus = useCountUp(firstForecastRow?.guv ?? null);
  const animatedForecastCashAfter = useCountUp(firstForecastRow?.cashAfter ?? null);

  const sortedTableRows = useMemo(() => [...displayPrizePreviewRows].sort(compareByRank), [displayPrizePreviewRows]);

  const maxPrizeMoney = useMemo(
    () =>
      sortedTableRows.reduce(
        (max, row) => (row.prizeMoney != null && Number.isFinite(row.prizeMoney) && row.prizeMoney > max ? row.prizeMoney : max),
        0,
      ),
    [sortedTableRows],
  );

  const championLogo = seasonEndChampionRow ? getTeamLogoModel(seasonEndChampionRow.team) : null;

  // Champion-/Saisonende-Reveal (D3): überspringbarer Feier-Banner.
  const [championDismissed, setChampionDismissed] = useState(false);
  // Endplatz des eigenen Teams (nur öffentliche Rangdaten) für "Du: #.. von ..".
  const ownFinalRank = (prizeV2SelectedTeamSummary?.rank as number | null | undefined) ?? null;

  // Story-/Champion-Karten sind Portale: nur wenn die Zeile ein Team mit
  // Profil benennt, wird die Karte klickbar (öffnet das Teamprofil).
  const leaderTeamId = prizeV2LeaderRow?.teamId ?? null;
  const outlookTeamId = (prizeV2SelectedTeamSummary?.teamId as string | null | undefined) ?? null;
  // Kredit-Kern (Fog of War, own-team-only — siehe `use-prize-v2-panel-model.ts`):
  // nur für das ausgewählte eigene Team, nicht für Leader/Swing/Risiko-Karten,
  // die auch andere Teams zeigen können.
  const outlookLoanInstallment = (prizeV2SelectedTeamSummary?.loanInstallment as number | null | undefined) ?? null;
  const outlookOutstandingDebt = (prizeV2SelectedTeamSummary?.outstandingDebt as number | null | undefined) ?? null;
  const swingTeamId = prizeV2SwingRow?.teamId ?? null;
  const riskTeamId = prizeV2RiskRow?.teamId ?? null;
  const championTeamId = seasonEndChampionRow?.teamId ?? null;

  return (
    <div className="nl-prize" data-testid="foundation-prize-v2" data-new-look="true">
      {seasonEndChampionRow && !championDismissed ? (
        <section
          className="nl-prize-champion-banner"
          data-testid="nl-prize-champion-banner"
          aria-label="Champion · Saisonende"
        >
          <div className="nl-prize-champion-banner-inner">
            <span
              className="nl-prize-champion-banner-eyebrow nl-reveal"
              style={{ "--nl-reveal-i": 0 } as CSSProperties}
            >
              <NlMedalBadge kind="gold" title="Champion" />
              Saisonende · Champion
            </span>
            <div
              className="nl-prize-champion-banner-main nl-reveal"
              style={{ "--nl-reveal-i": 1 } as CSSProperties}
            >
              <BudgetedMediaImage
                src={championLogo?.src ?? null}
                alt={`${seasonEndChampionRow.team.name} Logo`}
                className="nl-prize-champion-banner-crest"
                width={88}
                height={88}
                loading="lazy"
                fallback={
                  <span className="nl-prize-champion-banner-crest nl-prize-crest-fallback">
                    {championLogo?.initials ?? "?"}
                  </span>
                }
              />
              <div className="nl-prize-champion-banner-copy">
                <button
                  type="button"
                  className="nl-prize-champion-banner-team"
                  onClick={championTeamId ? () => openTeamProfileById(championTeamId) : undefined}
                  disabled={!championTeamId}
                  title={championTeamId ? `${seasonEndChampionRow.team.name} öffnen` : undefined}
                >
                  {seasonEndChampionRow.team.name}
                </button>
                <span className="nl-prize-champion-banner-sub nl-tnum">
                  <span className="nl-prize-champion-banner-rank">
                    {seasonEndChampionRow.rank != null ? `#${seasonEndChampionRow.rank}` : "#1"}
                  </span>
                  {seasonEndChampionRow.points != null ? (
                    <span className="nl-prize-champion-banner-points">
                      <strong>
                        <NlCountUpValue
                          value={seasonEndChampionRow.points}
                          format={(value) => formatLocalePoints(value, 1)}
                        />
                      </strong>{" "}
                      Punkte
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
            {ownFinalRank != null ? (
              <p
                className="nl-prize-champion-banner-you nl-reveal nl-tnum"
                style={{ "--nl-reveal-i": 2 } as CSSProperties}
              >
                Du: <strong>#{ownFinalRank}</strong> von {prizeV2Summary.totalTeams}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="nl-prize-champion-banner-skip"
            onClick={() => setChampionDismissed(true)}
            aria-label="Champion-Banner schließen"
          >
            Schließen
          </button>
        </section>
      ) : null}

      <NlCard
        className="nl-prize-header-card"
        eyebrow={`${getViewSourceBadgeLabel("prize", activeContextMeta)} · ${gameState.season.name}`}
        title="Preisgeld · Saisonende"
        actions={
          <div className="nl-prize-header-actions">
            <span className={getCockpitStatusPillClass(prizeApplyState.status as Parameters<typeof getCockpitStatusPillClass>[0])}>
              {prizeApplyState.label}
            </span>
            <button type="button" className="nl-prize-nav-button" onClick={() => setFoundationView("seasonV2", setActiveView)}>
              Saison v2
            </button>
            <button type="button" className="nl-prize-nav-button" onClick={() => setFoundationView("teams", setActiveView)}>
              Teams
            </button>
          </div>
        }
      >
        <StatChipRow className="nl-prize-summary-chips" aria-label="Preisgeld-Kennzahlen">
          <StatChip
            label="Teams"
            value={`${prizeV2Summary.calculableTeams}/${prizeV2Summary.totalTeams}`}
            sub="berechenbar"
            tone={prizeV2Summary.calculableTeams === prizeV2Summary.totalTeams ? "good" : "warn"}
          />
          <StatChip
            label="Faktor"
            value={formatLocalePoints(prizePreviewFeed?.summary.currentFactor ?? null, 2)}
            sub="Season aktuell"
            tone="accent"
          />
          <StatChip
            label="Zeilen"
            value={formatNlNumber(prizePreviewFeed?.summary.prizeRowsCount ?? 0, 0)}
            sub="Preisgeld-Tabelle"
          />
          <StatChip
            label="Bonus/Malus"
            value={
              prizePreviewFeed?.summary.totalRankChangePrize != null
                ? formatSignedDisplayMoney(animatedSummaryBonusMalus ?? prizePreviewFeed.summary.totalRankChangePrize)
                : "—"
            }
            sub="Liga gesamt"
            tone={
              prizePreviewFeed?.summary.totalRankChangePrize != null && prizePreviewFeed.summary.totalRankChangePrize < 0
                ? "risk"
                : "good"
            }
          />
          <StatChip
            label="Blocker"
            value={formatNlNumber(prizePreviewHardBlocked.length, 0)}
            tone={prizePreviewHardBlocked.length > 0 ? "risk" : "good"}
            sub={prizePreviewHardBlocked.length > 0 ? "offen" : "keine"}
          />
        </StatChipRow>
        {prizeV2FactorRows.length > 0 ? (
          <StatChipRow label="Faktoren" className="nl-prize-factor-chips" aria-label="Saisonfaktoren">
            {prizeV2FactorRows.map((entry) => (
              <StatChip
                key={entry.seasonLabel}
                label={entry.seasonLabel}
                value={formatLocalePoints(entry.factor, 2)}
                tone={entry.factor == null ? "neutral" : entry.factor >= 1 ? "good" : "warn"}
              />
            ))}
          </StatChipRow>
        ) : null}
      </NlCard>

      <div className="nl-prize-story-grid" aria-label="Preisgeld-Fokus">
        <NlCard
          className="nl-prize-story-card"
          eyebrow="Top Auszahlung"
          title={prizeV2LeaderRow?.teamName ?? "—"}
          onClick={leaderTeamId ? () => openTeamProfileById(leaderTeamId) : undefined}
        >
          <p className="nl-prize-story-line nl-tnum">
            {prizeV2LeaderRow
              ? `#${prizeV2LeaderRow.rank ?? "—"} · ${formatNullableMoney(prizeV2LeaderRow.prizeMoney)}`
              : "kein Leader"}
          </p>
        </NlCard>
        <NlCard
          className="nl-prize-story-card"
          eyebrow="Dein Outlook"
          title={prizeV2SelectedTeamSummary?.teamName ?? "—"}
          onClick={outlookTeamId ? () => openTeamProfileById(outlookTeamId) : undefined}
        >
          <p className="nl-prize-story-line nl-tnum">
            {prizeV2SelectedTeamSummary
              ? `#${prizeV2SelectedTeamSummary.rank ?? "—"} · ${formatLocalePoints(prizeV2SelectedTeamSummary.currentCash, 1)} → ${formatLocalePoints(prizeV2SelectedTeamSummary.projectedCash, 1)}`
              : "kein Team aktiv"}
          </p>
          {outlookOutstandingDebt != null ? (
            <p className="nl-prize-story-line nl-tnum">Restschuld {formatLocalePoints(outlookOutstandingDebt, 1)}</p>
          ) : null}
        </NlCard>
        <NlCard
          className="nl-prize-story-card"
          eyebrow="Größter Swing"
          title={prizeV2SwingRow?.teamName ?? "—"}
          onClick={swingTeamId ? () => openTeamProfileById(swingTeamId) : undefined}
        >
          <p className="nl-prize-story-line nl-tnum">
            {prizeV2SwingRow
              ? `${formatSignedDisplayMoney(prizeV2SwingRow.rankDelta)} Plätze · ${formatSignedDisplayMoney(prizeV2SwingRow.bonusMalus)}`
              : "kein Ausschlag"}
          </p>
        </NlCard>
        <NlCard
          className="nl-prize-story-card"
          eyebrow="Finanzrisiko"
          title={prizeV2RiskRow?.teamName ?? "—"}
          onClick={riskTeamId ? () => openTeamProfileById(riskTeamId) : undefined}
        >
          <p className="nl-prize-story-line nl-tnum">
            {prizeV2RiskRow
              ? `Cash danach ${formatLocalePoints(prizeV2RiskRow.projectedCash, 1)} · ${prizeV2RiskRow.warnings.length} Hinweise`
              : "kein Drucksignal"}
          </p>
        </NlCard>
        {/* Champion wird oben als voller Feier-Banner gezeigt (D3) — hier bewusst
            nicht dupliziert. */}
      </div>

      <div className="nl-prize-chart-grid">
        <NlCard
          className="nl-prize-distribution-card"
          eyebrow="Verteilung"
          title="Preisgeld nach Endplatz"
          actions={
            ownDistributionItem ? (
              <StatChip
                label={`Dein Platz #${ownDistributionItem.rank}`}
                value={formatLocalePoints(ownDistributionItem.prizeMoney, 1)}
                tone="accent"
                onClick={() => openTeamProfileById(ownDistributionItem.teamId)}
                title={`${ownDistributionItem.teamName} öffnen`}
              />
            ) : null
          }
        >
          {distributionItems.length > 0 ? (
            <div className="nl-prize-distribution-scroll">
              <ol
                className="nl-prize-dist-bars"
                aria-label="Preisgeld-Verteilung über die Endplätze — Balken öffnen das Teamprofil"
              >
                {distributionItems.map((item) => {
                  const money = item.prizeMoney as number;
                  const heightPct = maxDistributionMoney > 0 ? Math.max(3, (money / maxDistributionMoney) * 100) : 0;
                  const isOwn = item.teamId === selectedTeamId;
                  const clickable = item.teamId != null && teamsById.has(item.teamId);
                  const barTitle = `#${item.rank} ${item.teamName}: ${formatLocalePoints(money, 1)}${clickable ? " · Teamprofil öffnen" : ""}`;
                  const fill = (
                    <span className="nl-prize-dist-fill-wrap" aria-hidden="true">
                      <span className="nl-prize-dist-value nl-tnum">{formatNlNumber(money, 0)}</span>
                      <span className="nl-prize-dist-track">
                        <span className="nl-prize-dist-fill" style={{ height: `${heightPct}%` }} />
                      </span>
                      <span className="nl-prize-dist-label nl-tnum">#{item.rank}</span>
                    </span>
                  );
                  return (
                    <li key={`${item.rank}-${item.teamId ?? "na"}`} className={`nl-prize-dist-bar${isOwn ? " is-own" : ""}`}>
                      {clickable ? (
                        <button
                          type="button"
                          className="nl-prize-dist-hit"
                          onClick={() => openTeamProfileById(item.teamId as string)}
                          title={barTitle}
                        >
                          {fill}
                        </button>
                      ) : (
                        <span className="nl-prize-dist-hit is-static" title={barTitle}>
                          {fill}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <p className="nl-prize-empty">Verteilung wartet auf Preisgeld-Preview mit Rängen.</p>
          )}
        </NlCard>

        <NlCard
          className="nl-prize-forecast-card"
          eyebrow="Eigenes Team"
          title="5-Seasons-Forecast"
          actions={
            <label className="nl-prize-rank-select">
              <span>Platz simulieren</span>
              <select
                value={prizeForecastRank}
                onChange={(event) => setPrizeForecastRank(clampValue(Number(event.target.value), 1, NL_PRIZE_MAX_RANK))}
              >
                {Array.from(
                  { length: Math.max(NL_PRIZE_MAX_RANK, prizePreviewFeed?.summary.prizeRowsCount ?? 0) },
                  (_, index) => index + 1,
                ).map((rank) => (
                  <option key={rank} value={rank}>
                    Platz {rank}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          <StatChipRow className="nl-prize-forecast-chips" aria-label="Forecast-Eckwerte">
            <StatChip
              label="Cash vorher"
              value={
                prizeV2SelectedTeamSummary?.currentCash != null
                  ? formatLocalePoints(animatedForecastCashBefore ?? prizeV2SelectedTeamSummary.currentCash, 1)
                  : "—"
              }
            />
            <StatChip
              label="Preisgeld"
              value={
                prizeForecastRankRow?.prizeMoney != null
                  ? formatLocalePoints(animatedForecastPrizeMoney ?? prizeForecastRankRow.prizeMoney, 1)
                  : "—"
              }
              sub={prizeForecastRankRow ? `bei Platz ${prizeForecastRank}` : "kein Rang-Datum"}
              tone="accent"
            />
            <StatChip
              label="Bonus/Malus"
              value={firstForecastRow?.guv != null ? formatSignedDisplayMoney(animatedForecastBonusMalus ?? firstForecastRow.guv) : "—"}
              tone={firstForecastRow?.guv != null && firstForecastRow.guv < 0 ? "risk" : "good"}
            />
            <StatChip
              label="Cash nachher"
              value={
                firstForecastRow?.cashAfter != null
                  ? formatLocalePoints(animatedForecastCashAfter ?? firstForecastRow.cashAfter, 1)
                  : "—"
              }
            />
            {outlookLoanInstallment != null ? (
              <StatChip
                label="Kreditrate"
                value={formatLocalePoints(outlookLoanInstallment, 1)}
                tone="warn"
                sub={outlookOutstandingDebt != null ? `Restschuld ${formatLocalePoints(outlookOutstandingDebt, 1)}` : undefined}
                title="Jährliche Kreditrate — bereits in Bonus/Malus und Cash nachher eingerechnet"
              />
            ) : null}
          </StatChipRow>
          {forecastBars.length > 0 ? (
            <NlBarChart
              bars={forecastBars}
              format={(value) => formatNlNumber(value, 1)}
              aria-label="Cash-Entwicklung über die nächsten Seasons (Ton nach GuV)"
              className="nl-prize-forecast-chart"
            />
          ) : (
            <p className="nl-prize-empty">Forecast wartet auf Preisgeld-Preview, Team-Cash und Gehaltssumme.</p>
          )}
          {prizeForecastRows.length > 0 ? (
            <div className="nl-prize-forecast-table-shell">
              <table className="nl-prize-forecast-table nl-tnum">
                <thead>
                  <tr>
                    <th>Season</th>
                    <th>Faktor</th>
                    <th>Preisgeld</th>
                    <th>Gehalt</th>
                    {outlookLoanInstallment != null ? <th>Kreditrate</th> : null}
                    <th>GuV</th>
                    <th>Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {prizeForecastRows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{formatLocalePoints(row.factor ?? null, 2)}</td>
                      <td>{row.prizeMoney != null ? formatNlMoney(row.prizeMoney) : "—"}</td>
                      <td>{row.salaryTotal != null ? formatNlMoney(row.salaryTotal) : "—"}</td>
                      {outlookLoanInstallment != null ? (
                        <td>{row.loanInstallment != null ? formatNlMoney(row.loanInstallment) : "—"}</td>
                      ) : null}
                      <td>
                        {row.guv != null ? (
                          <NlDeltaChip
                            value={row.guv}
                            format={(n) => formatSignedNlMoney(n)}
                            title={outlookLoanInstallment != null ? "Gewinn und Verlust — inkl. Kreditrate" : "Gewinn und Verlust"}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{row.cashAfter != null ? formatNlMoney(row.cashAfter) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </NlCard>
      </div>

      <NlCard className="nl-prize-table-card" eyebrow="Haupttabelle" title="Preisgeld-Tabelle">
        {prizePreviewHardBlocked.length > 0 ? (
          <div className="nl-prize-warning-box is-blocked">
            <strong>Blocker</strong>
            <ul>
              {prizePreviewHardBlocked.slice(0, 4).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {prizePreviewGlobalWarnings.length > 0 ? (
          <div className="nl-prize-warning-box">
            <strong>Hinweise</strong>
            <ul>
              {prizePreviewGlobalWarnings.slice(0, 4).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="nl-prize-table-shell">
          <table className="nl-prize-table nl-tnum">
            <thead>
              <tr>
                <th className="nl-prize-th-rank">Rang</th>
                <th className="nl-prize-th-team">Team</th>
                <th>Cash vorher</th>
                <th className="nl-prize-th-money">Preisgeld</th>
                <th>Bonus/Malus</th>
                <th>Cash danach</th>
                <th>Hinweise</th>
              </tr>
            </thead>
            <tbody>
              {sortedTableRows.map((row) => {
                const team = teamsById.get(row.teamId) ?? null;
                const logo = team ? getTeamLogoModel(team) : null;
                const medalKind = row.rank === 1 ? "gold" : row.rank === 2 ? "silver" : row.rank === 3 ? "bronze" : null;
                return (
                  <tr
                    key={row.teamId}
                    className={`nl-prize-table-row${row.teamId === selectedTeamId ? " is-selected" : ""}`}
                    onClick={() => openTeamProfileById(row.teamId)}
                    title={`${row.teamName} öffnen`}
                  >
                    <td className="nl-prize-td-rank">
                      {medalKind ? (
                        <NlMedalBadge kind={medalKind} title={`Rang ${row.rank}`} />
                      ) : (
                        <span>{row.rank ?? "—"}</span>
                      )}
                    </td>
                    <td className="nl-prize-td-team">
                      <span className="nl-prize-team-cell">
                        <BudgetedMediaImage
                          src={logo?.src ?? null}
                          alt={`${row.teamName} Logo`}
                          className="nl-prize-crest"
                          width={24}
                          height={24}
                          loading="lazy"
                          fallback={<span className="nl-prize-crest nl-prize-crest-fallback">{logo?.initials ?? "?"}</span>}
                        />
                        <span className="nl-prize-team-copy">
                          <span className="nl-prize-teamname">{row.teamName}</span>
                          <span className="nl-prize-teamcode">{row.teamCode}</span>
                        </span>
                      </span>
                    </td>
                    <td>{row.currentCash != null ? formatNlMoney(row.currentCash) : "—"}</td>
                    <td className="nl-prize-td-money">
                      <span className="nl-prize-money-value">{row.prizeMoney != null ? formatNlMoney(row.prizeMoney) : "—"}</span>
                      {row.prizeMoney != null && Number.isFinite(row.prizeMoney) ? (
                        <NlProgressBar
                          value={row.prizeMoney}
                          max={maxPrizeMoney > 0 ? maxPrizeMoney : 1}
                          tone="accent"
                          showValue={false}
                          className="nl-prize-money-bar"
                          title={`Preisgeld relativ zur Top-Auszahlung (${formatNlMoney(maxPrizeMoney)})`}
                        />
                      ) : null}
                    </td>
                    <td>
                      {row.rankChangePrize?.bonusMalus != null ? (
                        <NlDeltaChip
                          value={row.rankChangePrize.bonusMalus}
                          format={(n) => formatSignedNlMoney(n)}
                          title="Rank-Bonus/-Malus"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={row.projectedCash != null && row.projectedCash < 0 ? "nl-prize-cash-risk" : undefined}>
                      {row.projectedCash != null ? formatNlMoney(row.projectedCash) : "—"}
                    </td>
                    <td className="nl-prize-td-warnings">{row.warnings.length > 0 ? row.warnings.join(", ") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </NlCard>
    </div>
  );
}

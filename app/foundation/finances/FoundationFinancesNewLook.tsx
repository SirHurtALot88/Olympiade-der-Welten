"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/foundation/EmptyState";
import {
  NL_TONE_VAR,
  NlCard,
  NlEmptyState,
  NlTable,
  StatChip,
  StatChipRow,
  formatNlMoney,
  nlToneClass,
  useCountUp,
  type NlTableColumn,
  type NlTableSortDirection,
  type NlTone,
} from "@/components/foundation/new-look";
import type {
  FinanceLeagueTableRow,
  FinanceSeasonHistoryPoint,
  FinancesViewModel,
  TeamFinancesState,
} from "@/lib/foundation/finances/finances-types";

export type FoundationFinancesNewLookProps = {
  teamName: string;
  model: FinancesViewModel;
  /** Liga-weite Finanzübersicht (#Finanzen-Liga-Tabelle) — siehe `use-finances-league-table.ts`. */
  leagueTable: FinanceLeagueTableRow[];
  /** Active manager's own team id — hebt "Dein Team" in der Liga-Tabelle hervor. */
  activeManagerTeamId: string | null;
};

/** Grün bei GuV ≥ 0, sonst Rot — gleiche binäre Ton-Regel wie andere GuV-Chips im neuen Look. */
function guvTone(value: number): NlTone {
  return value >= 0 ? "good" : "risk";
}

// --- Hover-Tooltips: was steckt hinter der jeweiligen Zeile ------------
// Reine `title`-Strings statt Hover-Cards (siehe Auftrag) — niedrigrisiko
// und konsistent mit den bestehenden `title=`-Erklärungen in FoundationCreditsNewLook.

function buildSponsorTooltip(team: TeamFinancesState): string | undefined {
  const sponsor = team.income.sponsor;
  if (!sponsor) return undefined;
  // T-030: wenn `total` mangels aktueller Vertragskomponenten auf den
  // Payout-Log-Proxy zurückfällt, macht der Hover das explizit statt eine
  // exakte Aufschlüsselung vorzutäuschen, die es in dem Fall nicht gibt.
  if (sponsor.totalIsEstimate) {
    return "Geschätzt aus der letzten abgerechneten Sponsor-Auszahlung — kein aktueller Vertrag mit Komponenten-Aufschlüsselung.";
  }
  if (sponsor.components.length === 0) return undefined;
  return sponsor.components.map((component) => `${component.label}: ${formatNlMoney(component.rewardCash)}`).join(" · ");
}

function buildPrizeTooltip(team: TeamFinancesState): string | undefined {
  const prize = team.income.prizeBenchmark;
  if (!prize) return undefined;
  return [
    `Basis: ${formatNlMoney(prize.basis)}`,
    `Saison-Anteil: ${formatNlMoney(prize.seasonShare)}`,
    `Platzierungsbonus: ${formatNlMoney(prize.placementBonus)}`,
  ].join(" · ");
}

function buildFacilityIncomeTooltip(team: TeamFinancesState): string | undefined {
  const facilities = team.income.facilityIncome?.facilities ?? [];
  if (facilities.length === 0) return undefined;
  return facilities.map((facility) => `${facility.label}: ${formatNlMoney(facility.income)}`).join("\n");
}

function buildTransferTooltip(team: TeamFinancesState): string | undefined {
  const transfer = team.transfer;
  if (!transfer) return undefined;
  return (
    `Verkäufe: ${formatNlMoney(transfer.sellTotal)} (${transfer.sellCount} Spieler) · ` +
    `Käufe: ${formatNlMoney(transfer.buyTotal)} (${transfer.buyCount} Spieler)`
  );
}

/** Mehr Zeilen würden den Tooltip sprengen — Rest wird als "+ N weitere" zusammengefasst. */
const SALARY_TOOLTIP_MAX_ROWS = 12;

function buildSalaryTooltip(team: TeamFinancesState): string | undefined {
  const players = team.expenses.salaries.players;
  if (players.length === 0) return undefined;
  const rows = players.slice(0, SALARY_TOOLTIP_MAX_ROWS).map((player) => `${player.playerName}: ${formatNlMoney(player.salary)}`);
  const rest = players.length - rows.length;
  if (rest > 0) rows.push(`+ ${rest} weitere`);
  return rows.join("\n");
}

function buildFacilityTooltip(team: TeamFinancesState): string | undefined {
  const facilities = team.expenses.facilityUpkeep.facilities;
  if (facilities.length === 0) return undefined;
  return facilities.map((facility) => `${facility.label}: ${formatNlMoney(facility.upkeep)}`).join("\n");
}

function buildLoanTooltip(team: TeamFinancesState): string | undefined {
  const loans = team.expenses.loanInstallments.loans;
  if (loans.length === 0) return undefined;
  return loans
    .map((loan) => `${loan.lenderName}: ${formatNlMoney(loan.installment)} (Restschuld ${formatNlMoney(loan.outstanding)})`)
    .join("\n");
}

/** Eine Zeile der Einnahmen-/Ausgaben-Spalte bzw. ein Segment des Flow-Charts. */
type FinanceLineItem = { key: string; label: string; amount: number; tone: NlTone; title?: string };

function buildIncomeLines(team: TeamFinancesState): FinanceLineItem[] {
  const lines: FinanceLineItem[] = [];
  if (team.income.sponsor) {
    lines.push({
      key: "sponsor",
      label: team.income.sponsor.totalIsEstimate ? "Sponsor (geschätzt)" : "Sponsor",
      amount: team.income.sponsor.total,
      tone: "accent",
      title: buildSponsorTooltip(team),
    });
  }
  if (team.income.facilityIncome) {
    lines.push({
      key: "facilityIncome",
      label: "Gebäude-Einnahmen",
      amount: team.income.facilityIncome.total,
      tone: "good",
      title: buildFacilityIncomeTooltip(team),
    });
  }
  if (team.income.transferSurplus != null) {
    lines.push({
      key: "transfer",
      label: "Transfer-Überschuss",
      amount: team.income.transferSurplus,
      tone: "spe",
      title: buildTransferTooltip(team),
    });
  }
  if (team.income.objectiveReward != null) {
    lines.push({
      key: "objective",
      label: "Vorstandsziele (Prämie)",
      amount: team.income.objectiveReward,
      tone: "accent",
      title: "Netto-Prämie erfüllter Vorstandsziele (Board-Objective-Settlement).",
    });
  }
  return lines;
}

function buildExpenseLines(team: TeamFinancesState): FinanceLineItem[] {
  const lines: FinanceLineItem[] = [];
  if (team.expenses.salaries.total > 0) {
    lines.push({ key: "salaries", label: "Gehälter", amount: team.expenses.salaries.total, tone: "men", title: buildSalaryTooltip(team) });
  }
  if (team.expenses.facilityUpkeep.total > 0) {
    lines.push({
      key: "upkeep",
      label: "Gebäude-Unterhalt",
      amount: team.expenses.facilityUpkeep.total,
      tone: "soc",
      title: buildFacilityTooltip(team),
    });
  }
  if (team.expenses.loanInstallments.total > 0) {
    lines.push({
      key: "loans",
      label: "Kreditraten",
      amount: team.expenses.loanInstallments.total,
      tone: "risk",
      title: buildLoanTooltip(team),
    });
  }
  if (team.expenses.transferDeficit != null) {
    lines.push({
      key: "transfer",
      label: "Transfer-Defizit",
      amount: team.expenses.transferDeficit,
      tone: "warn",
      title: buildTransferTooltip(team),
    });
  }
  if (team.expenses.objectivePenalty != null) {
    lines.push({
      key: "objective",
      label: "Vorstandsziele (Strafe)",
      amount: team.expenses.objectivePenalty,
      tone: "warn",
      title: "Netto-Strafe verfehlter Vorstandsziele (Board-Objective-Settlement).",
    });
  }
  return lines;
}

// --- Cashflow-Balken (Einnahmen- vs. Ausgaben-Bar) ----------------------
// Zwei schlanke gestapelte Balken übereinander, gleiche Bauart wie
// `LoanBurdenChart` in FoundationCreditsNewLook (fixe Höhe,
// preserveAspectRatio="none", nie ein All-Null/NaN-Chart rendern).
const FLOW_W = 320;
const FLOW_H = 60;
const FLOW_PAD_X = 10;
const FLOW_BAR_H = 18;
const FLOW_INCOME_Y = 6;
const FLOW_EXPENSE_Y = 34;

function layoutFlowSegments(lines: FinanceLineItem[], scale: number, barWidth: number) {
  let cursor = FLOW_PAD_X;
  return lines
    .filter((line) => line.amount > 0)
    .map((line) => {
      const width = (line.amount / scale) * barWidth;
      const rect = { ...line, x: cursor, width };
      cursor += width;
      return rect;
    });
}

function FinanceFlowChart({ incomeLines, expenseLines }: { incomeLines: FinanceLineItem[]; expenseLines: FinanceLineItem[] }) {
  const totalIncome = incomeLines.reduce((sum, line) => sum + line.amount, 0);
  const totalExpenses = expenseLines.reduce((sum, line) => sum + line.amount, 0);

  if (totalIncome <= 0 && totalExpenses <= 0) {
    return <NlEmptyState className="nl-fin-flow-empty" title="Keine Finanzdaten für diese Saison bekannt." />;
  }

  const scale = Math.max(totalIncome, totalExpenses, 0.0001);
  const barWidth = FLOW_W - FLOW_PAD_X * 2;
  const incomeRects = layoutFlowSegments(incomeLines, scale, barWidth);
  const expenseRects = layoutFlowSegments(expenseLines, scale, barWidth);
  const ariaLabel = `Einnahmen ${formatNlMoney(totalIncome)}, Ausgaben ${formatNlMoney(totalExpenses)}`;

  return (
    <div className="nl-fin-flow" data-testid="nl-fin-flow-chart">
      <svg
        className="nl-fin-flow-chart"
        viewBox={`0 0 ${FLOW_W} ${FLOW_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        <rect x={FLOW_PAD_X} y={FLOW_INCOME_Y} width={barWidth} height={FLOW_BAR_H} rx={5} className="nl-fin-flow-track" />
        {incomeRects.map((rect) => (
          <rect
            key={`income-${rect.key}`}
            x={rect.x}
            y={FLOW_INCOME_Y}
            width={Math.max(0, rect.width)}
            height={FLOW_BAR_H}
            fill={NL_TONE_VAR[rect.tone]}
            className="nl-fin-flow-seg"
          >
            <title>
              {rect.label}: {formatNlMoney(rect.amount)}
            </title>
          </rect>
        ))}
        <rect x={FLOW_PAD_X} y={FLOW_EXPENSE_Y} width={barWidth} height={FLOW_BAR_H} rx={5} className="nl-fin-flow-track" />
        {expenseRects.map((rect) => (
          <rect
            key={`expense-${rect.key}`}
            x={rect.x}
            y={FLOW_EXPENSE_Y}
            width={Math.max(0, rect.width)}
            height={FLOW_BAR_H}
            fill={NL_TONE_VAR[rect.tone]}
            className="nl-fin-flow-seg"
          >
            <title>
              {rect.label}: {formatNlMoney(rect.amount)}
            </title>
          </rect>
        ))}
      </svg>
      <div className="nl-fin-flow-legend">
        <div className="nl-fin-flow-legend-group">
          <span className="nl-fin-flow-legend-heading">Einnahmen</span>
          {incomeLines.map((line) => (
            <span key={line.key} className="nl-fin-flow-legend-item">
              <span className="nl-fin-flow-legend-dot" style={{ background: NL_TONE_VAR[line.tone] }} aria-hidden="true" />
              <span className="nl-fin-flow-legend-label">{line.label}</span>
              <span className="nl-fin-flow-legend-value nl-tnum">{formatNlMoney(line.amount)}</span>
            </span>
          ))}
        </div>
        <div className="nl-fin-flow-legend-group">
          <span className="nl-fin-flow-legend-heading">Ausgaben</span>
          {expenseLines.map((line) => (
            <span key={line.key} className="nl-fin-flow-legend-item">
              <span className="nl-fin-flow-legend-dot" style={{ background: NL_TONE_VAR[line.tone] }} aria-hidden="true" />
              <span className="nl-fin-flow-legend-label">{line.label}</span>
              <span className="nl-fin-flow-legend-value nl-tnum">{formatNlMoney(line.amount)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Saison-Verlauf (T-107) ---------------------------------------------
// Schlanke GuV-Sparkline über bis zu 4 archivierte Vorsaisons +
// laufende Saison (`team.history`, siehe `use-finances-view-model.ts`) —
// echte Season-End-Werte aus `seasonSnapshots`, KEIN Forecast (anders als
// der 5-Saisons-Ausblick in prize-v2). Gleiche Bauart wie `FinanceFlowChart`
// (fixe Höhe, preserveAspectRatio="none", `title`-Hover statt Tooltip-Card).
// Nutzt bewusst nur bereits vorhandene `.nl-fin-flow*`-Klassen + Inline-
// Styles für die neuen Balken/Labels, statt globals.css anzufassen.
const HISTORY_W = 320;
const HISTORY_H = 96;
const HISTORY_PAD_X = 10;
const HISTORY_PAD_TOP = 8;
const HISTORY_LABEL_H = 20;
const HISTORY_BASELINE_Y = HISTORY_H - HISTORY_LABEL_H;
const HISTORY_BAR_MAX_H = HISTORY_BASELINE_Y - HISTORY_PAD_TOP;

function FinanceHistoryTrend({ history }: { history: FinanceSeasonHistoryPoint[] }) {
  const points = history.filter((point) => point.guv != null);

  if (points.length <= 1) {
    return (
      <NlEmptyState
        className="nl-fin-flow-empty"
        title="Saison-Verlauf ab der zweiten Saison verfügbar."
        message="Für dieses Team liegt noch keine abgeschlossene Vorsaison vor."
      />
    );
  }

  const maxAbsGuv = Math.max(...points.map((point) => Math.abs(point.guv ?? 0)), 0.0001);
  const barSlot = (HISTORY_W - HISTORY_PAD_X * 2) / points.length;
  const barWidth = Math.min(28, barSlot * 0.6);
  const ariaLabel = points
    .map((point) => `${point.seasonName}${point.isCurrent ? " (aktuell)" : ""}: GuV ${formatNlMoney(point.guv ?? 0)}`)
    .join(", ");

  return (
    <div className="nl-fin-flow" data-testid="nl-fin-history-trend">
      <svg
        className="nl-fin-flow-chart"
        viewBox={`0 0 ${HISTORY_W} ${HISTORY_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        <rect
          x={HISTORY_PAD_X}
          y={HISTORY_BASELINE_Y - 1}
          width={HISTORY_W - HISTORY_PAD_X * 2}
          height={1}
          className="nl-fin-flow-track"
        />
        {points.map((point, index) => {
          const guv = point.guv ?? 0;
          const barHeight = Math.max(2, (Math.abs(guv) / maxAbsGuv) * HISTORY_BAR_MAX_H);
          const x = HISTORY_PAD_X + barSlot * index + (barSlot - barWidth) / 2;
          const y = guv >= 0 ? HISTORY_BASELINE_Y - barHeight : HISTORY_BASELINE_Y;
          return (
            <g key={point.seasonId}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill={NL_TONE_VAR[guvTone(guv)]}
                opacity={point.isCurrent ? 1 : 0.65}
              >
                <title>
                  {point.seasonName}
                  {point.isCurrent ? " (aktuell)" : ""}: GuV {formatNlMoney(guv)}
                  {point.cash != null ? ` · Cash ${formatNlMoney(point.cash)}` : ""}
                </title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={HISTORY_H - 6}
                textAnchor="middle"
                fill={NL_TONE_VAR.neutral}
                style={{ fontSize: 9, fontWeight: point.isCurrent ? 700 : 400 }}
              >
                {point.isCurrent ? "Aktuell" : point.seasonName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Eine Zeile in der Einnahmen-/Ausgaben-Liste: Label, Betrag, Anteils-Balken, `title`-Hover mit der Aufschlüsselung. */
function FinanceLine({ label, amount, share, tone, title }: { label: string; amount: number; share: number; tone: NlTone; title?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, share)) * 1000) / 10;
  return (
    <div className="nl-fin-line" role="listitem" title={title} data-testid="nl-fin-line">
      <div className="nl-fin-line-head">
        <span className="nl-fin-line-label">{label}</span>
        <span className="nl-fin-line-value nl-tnum">{formatNlMoney(amount)}</span>
      </div>
      <span className="nl-fin-line-bartrack" aria-hidden="true">
        <span className="nl-fin-line-bar" style={{ width: `${pct}%`, background: NL_TONE_VAR[tone] }} />
      </span>
    </div>
  );
}

// --- Cash-Abgleich (T-031) -----------------------------------------------
// Die GuV oben erklärt NICHT die tatsächliche Cash-Veränderung der Saison
// (Kredit-Auszahlungen/Vorfälligkeitsentschädigung, Baukosten, u. Ä. fehlen).
// Diese Zeile schließt die Lücke sichtbar: Cash Saisonstart + GuV + Sonstige
// Cash-Bewegungen (reine Restdifferenz, siehe `use-finances-view-model.ts`)
// = Cash aktuell — reine Anzeige, reused `StatChip`/`StatChipRow`.
function CashReconciliation({ team }: { team: TeamFinancesState }) {
  if (team.cashSeasonStart == null) {
    return (
      <p className="nl-fin-league-hint muted">
        Cash-Abgleich ab der zweiten Saison verfügbar — für Season 1 ist kein Saison-Start-Cash
        archiviert.
      </p>
    );
  }

  return (
    <StatChipRow className="nl-fin-kpi-hero" aria-label="Cash-Abgleich">
      <StatChip
        label="Cash (Saisonstart)"
        value={formatNlMoney(team.cashSeasonStart)}
        tone="neutral"
        title="Cash-Endstand der Vorsaison (archivierter Season-Snapshot)"
      />
      <StatChip label="+ GuV" value={formatNlMoney(team.guv)} tone={guvTone(team.guv)} />
      <StatChip
        label="+ Sonstige Cash-Bewegungen"
        value={formatNlMoney(team.otherCashMovements ?? 0)}
        tone="neutral"
        title="Rest-Differenz, die die GuV nicht erklärt (Kredit-Auszahlungen/Vorfälligkeitsentschädigung, Baukosten, sonstige Cash-Events dieser Saison)"
      />
      <StatChip label="= Cash aktuell" value={formatNlMoney(team.cash)} tone="neutral" />
    </StatChipRow>
  );
}

// --- Liga · Finanzvergleich (unten in der View) -------------------------
// Sortierbare `NlTable` über `leagueTable` (jede Team-Zeile ist eine reine
// p.a.-Näherung, siehe `use-finances-league-table.ts`). Gleiches
// Sort-Header-Muster wie `LegendaryPlayersPanel` (league-leaders-v2) /
// `AllTimeTableNewLook`: lokaler `sortState`, Klick auf denselben Key
// dreht die Richtung, Klick auf einen neuen Key startet absteigend.

type LeagueSortKey = "cash" | "incomeAnnual" | "expensesAnnual" | "guv" | "marketValue";

const NL_FIN_LEAGUE_COLUMNS: NlTableColumn<FinanceLeagueTableRow>[] = [
  { key: "rank", label: "#", align: "right", width: "36px" },
  { key: "team", label: "Team" },
  { key: "cash", label: "Cash", align: "right", sortable: true },
  {
    key: "incomeAnnual",
    label: "Einnahmen p.a.",
    align: "right",
    sortable: true,
    tooltip: "Sponsor + Preisgeld (Näherungswert)",
  },
  {
    key: "expensesAnnual",
    label: "Ausgaben p.a.",
    align: "right",
    sortable: true,
    tooltip: "Gehälter + Gebäude-Unterhalt + Kreditraten (Näherungswert)",
  },
  { key: "guv", label: "GuV p.a.", align: "right", sortable: true, tooltip: "Einnahmen p.a. minus Ausgaben p.a." },
  { key: "marketValue", label: "MW", align: "right", sortable: true, tooltip: "Kader-Marktwert-Summe" },
];

function renderLeagueCell(
  row: FinanceLeagueTableRow,
  column: NlTableColumn<FinanceLeagueTableRow>,
  rank: number,
  isOwnTeam: boolean,
) {
  switch (column.key) {
    case "rank":
      return rank;
    case "team":
      return (
        <span className="nl-fin-league-team">
          <span className="nl-fin-league-code">{row.teamCode}</span>
          <span className="nl-fin-league-name" title={row.teamName}>
            {row.teamName}
          </span>
          {isOwnTeam ? <span className="nl-fin-league-you">Dein Team</span> : null}
        </span>
      );
    case "cash":
      return formatNlMoney(row.cash);
    case "incomeAnnual":
      return formatNlMoney(row.incomeAnnual);
    case "expensesAnnual":
      return formatNlMoney(row.expensesAnnual);
    case "guv":
      return <span className={nlToneClass(guvTone(row.guv))}>{formatNlMoney(row.guv)}</span>;
    case "marketValue":
      return row.marketValue != null ? formatNlMoney(row.marketValue) : "—";
    default:
      return null;
  }
}

function FinanceLeagueTable({
  leagueTable,
  activeManagerTeamId,
}: {
  leagueTable: FinanceLeagueTableRow[];
  activeManagerTeamId: string | null;
}) {
  const [sort, setSort] = useState<{ key: LeagueSortKey; direction: NlTableSortDirection }>({
    key: "cash",
    direction: "desc",
  });

  const sortedRows = useMemo(() => {
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...leagueTable].sort((left, right) => ((left[sort.key] ?? 0) - (right[sort.key] ?? 0)) * factor);
  }, [leagueTable, sort]);

  function handleSort(key: string) {
    setSort((current) => {
      if (current.key === key) {
        return { key: key as LeagueSortKey, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key: key as LeagueSortKey, direction: "desc" };
    });
  }

  return (
    <NlCard
      className="nl-fin-league-card"
      eyebrow="Liga"
      title={`Finanzvergleich · ${leagueTable.length} Team${leagueTable.length === 1 ? "" : "s"}`}
      data-testid="nl-fin-league-card"
    >
      <p className="nl-fin-league-hint muted">
        Näherungswerte p.a. fürs Balancing/Feeling — wie die anderen Teams der Liga finanziell dastehen. Ohne
        Saison-Transfersaldo (Einmal-Ereignis), gleiche Herleitung wie deine eigene Finanzübersicht oben.
      </p>
      {sortedRows.length > 0 ? (
        <NlTable
          columns={NL_FIN_LEAGUE_COLUMNS}
          rows={sortedRows}
          rowKey={(row) => row.teamId}
          sortState={{ key: sort.key, direction: sort.direction }}
          onSort={handleSort}
          rowClassName={(row) => (row.teamId === activeManagerTeamId ? "is-active-row" : undefined)}
          renderCell={(row, column) => renderLeagueCell(row, column, sortedRows.indexOf(row) + 1, row.teamId === activeManagerTeamId)}
          data-testid="nl-fin-league-table"
          aria-label="Finanzvergleich aller Teams"
        />
      ) : (
        <NlEmptyState title="Aktuell sind keine Teams bekannt." />
      )}
    </NlCard>
  );
}

/**
 * "Neuer Look" Finanzen — Saison-Einnahmen/Ausgaben-Übersicht des eigenen
 * Teams. Read-only: kein Formular, keine Mutation (im Unterschied zu
 * Kredite) — reine Aufschlüsselung der bereits an anderer Stelle real
 * berechneten Cashflow-Quellen (Sponsor-Vertrag, Preisgeld, Gehälter,
 * Gebäude-Unterhalt, Kreditraten, Transfer-Saldo), siehe
 * `use-finances-view-model.ts` für die Herleitung jeder Zeile.
 *
 * Unten zusätzlich die Liga-weite Finanzübersicht (`FinanceLeagueTable`,
 * `use-finances-league-table.ts`) — bewusste Balancing-Transparenz, analog
 * zur Liga-Kreditübersicht in `FoundationCreditsNewLook` (Story Liga-Kredit-
 * übersicht, siehe dort).
 */
export default function FoundationFinancesNewLook({
  teamName,
  model,
  leagueTable,
  activeManagerTeamId,
}: FoundationFinancesNewLookProps) {
  const team = model.status === "ready" ? model.team : null;
  const incomeLines = team ? buildIncomeLines(team) : [];
  const expenseLines = team ? buildExpenseLines(team) : [];

  const animatedCash = useCountUp(team?.cash ?? null);
  const animatedIncome = useCountUp(team?.totalIncome ?? null);
  const animatedExpenses = useCountUp(team?.totalExpenses ?? null);
  const animatedGuv = useCountUp(team?.guv ?? null);

  return (
    <div className="nl-fin" data-testid="foundation-finances" data-new-look="true">
      <NlCard className="nl-fin-header-card" eyebrow="Finanzen" title={teamName}>
        {team ? (
          <StatChipRow className="nl-fin-kpi-hero" aria-label="Finanz-Kennzahlen">
            <StatChip label="Cash" value={formatNlMoney(animatedCash ?? team.cash)} tone="neutral" />
            <StatChip
              label="Einnahmen (Saison)"
              value={formatNlMoney(animatedIncome ?? team.totalIncome)}
              tone="good"
              title="Sponsor + Gebäude-Einnahmen + Transfer-Überschuss + Vorstandsziel-Prämien der laufenden Saison (Preisgeld ist reiner Benchmark, nicht enthalten)"
            />
            <StatChip
              label="Ausgaben (Saison)"
              value={formatNlMoney(animatedExpenses ?? team.totalExpenses)}
              tone="risk"
              title="Gehälter + bezahlter Gebäude-Unterhalt + Kreditraten + Transfer-Defizit + Vorstandsziel-Strafen der laufenden Saison"
            />
            <StatChip
              label="GuV"
              value={formatNlMoney(animatedGuv ?? team.guv)}
              tone={guvTone(team.guv)}
              title="Einnahmen minus Ausgaben der laufenden Saison"
            />
          </StatChipRow>
        ) : null}
      </NlCard>

      {model.status === "not_ready" ? (
        <EmptyState
          className="nl-fin-empty"
          title="Finanzübersicht nicht verfügbar"
          text="Für dieses Team liegen aktuell keine Finanzdaten vor."
        />
      ) : null}

      {team ? (
        <NlCard className="nl-fin-flow-card" eyebrow="Cashflow" title="Einnahmen vs. Ausgaben" data-testid="nl-fin-flow-card">
          <FinanceFlowChart incomeLines={incomeLines} expenseLines={expenseLines} />
        </NlCard>
      ) : null}

      {/* T-031: schließt die Lücke zwischen der GuV oben und dem tatsächlichen Cash-Delta der Saison. */}
      {team ? (
        <NlCard
          className="nl-fin-reconciliation-card"
          eyebrow="Cash-Abgleich"
          title="Saisonstart → Cash aktuell"
          data-testid="nl-fin-reconciliation-card"
        >
          <CashReconciliation team={team} />
        </NlCard>
      ) : null}

      {/* T-107: Saison-für-Saison-Trend statt nur der laufenden Saison. */}
      {team ? (
        <NlCard
          className="nl-fin-history-card"
          eyebrow="Verlauf"
          title="GuV je Saison"
          data-testid="nl-fin-history-card"
        >
          <FinanceHistoryTrend history={team.history} />
        </NlCard>
      ) : null}

      {team ? (
        <div className="nl-fin-columns">
          <NlCard
            className="nl-fin-income-card"
            eyebrow="Einnahmen"
            title={`Summe ${formatNlMoney(team.totalIncome)}`}
            data-testid="nl-fin-income-card"
          >
            {incomeLines.length > 0 ? (
              <div className="nl-fin-col" role="list" aria-label="Einnahmen">
                {incomeLines.map((line) => (
                  <FinanceLine
                    key={line.key}
                    label={line.label}
                    amount={line.amount}
                    share={team.totalIncome > 0 ? line.amount / team.totalIncome : 0}
                    tone={line.tone}
                    title={line.title}
                  />
                ))}
              </div>
            ) : (
              <NlEmptyState title="Keine Einnahmen für diese Saison bekannt." />
            )}
            {team.income.prizeBenchmark ? (
              <p
                className="nl-fin-league-hint muted"
                title={buildPrizeTooltip(team)}
                data-testid="nl-fin-prize-benchmark"
              >
                Benchmark (nicht ausgezahlt): Preisgeld {formatNlMoney(team.income.prizeBenchmark.total)} — reiner
                Vergleichswert, fließt NICHT in Einnahmen/GuV.
              </p>
            ) : null}
          </NlCard>

          <NlCard
            className="nl-fin-expense-card"
            eyebrow="Ausgaben"
            title={`Summe ${formatNlMoney(team.totalExpenses)}`}
            data-testid="nl-fin-expense-card"
          >
            {expenseLines.length > 0 ? (
              <div className="nl-fin-col" role="list" aria-label="Ausgaben">
                {expenseLines.map((line) => (
                  <FinanceLine
                    key={line.key}
                    label={line.label}
                    amount={line.amount}
                    share={team.totalExpenses > 0 ? line.amount / team.totalExpenses : 0}
                    tone={line.tone}
                    title={line.title}
                  />
                ))}
              </div>
            ) : (
              <NlEmptyState title="Keine Ausgaben für diese Saison bekannt." />
            )}
          </NlCard>
        </div>
      ) : null}

      <FinanceLeagueTable leagueTable={leagueTable} activeManagerTeamId={activeManagerTeamId} />
    </div>
  );
}

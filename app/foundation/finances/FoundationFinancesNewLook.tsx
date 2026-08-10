"use client";

import { useMemo, useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { EmptyState } from "@/components/foundation/EmptyState";
import { buildOperatingGuvHoverText } from "@/lib/finance/guv-breakdown";
import { buildSeasonGuvHoverText, seasonGuvFromPosten } from "@/lib/finance/season-end-guv";
import {
  NL_TONE_VAR,
  NlCard,
  NlEmptyState,
  NlTable,
  StatChip,
  StatChipRow,
  formatNlMoney,
  formatNlNumber,
  formatNlSignedMoney,
  nlToneClass,
  type NlTableColumn,
  type NlTableSortDirection,
  type NlTone,
} from "@/components/foundation/new-look";
import { VeloRangeBar } from "@/components/foundation/velo-ui";
import type {
  FinanceApronLeagueRow,
  FinanceApronStatus,
  FinanceLeagueTableRow,
  FinanceLoanCommitments,
  FinanceSeasonHistoryPoint,
  FinancesViewModel,
  TeamFinancesState,
} from "@/lib/foundation/finances/finances-types";
import type { SalaryFactorOutlook } from "@/lib/foundation/finances/salary-factor-outlook";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";

export type FoundationFinancesNewLookProps = {
  teamName: string;
  model: FinancesViewModel;
  /** Liga-weite Finanzübersicht (#Finanzen-Liga-Tabelle) — siehe `use-finances-league-table.ts`. */
  leagueTable: FinanceLeagueTableRow[];
  /** Active manager's own team id — hebt "Dein Team" in der Liga-Tabelle hervor. */
  activeManagerTeamId: string | null;
  /** Salary Factor der laufenden Season + Richtung zur nächsten — siehe `salary-factor-outlook.ts`. */
  salaryFactorOutlook: SalaryFactorOutlook;
  /**
   * Öffnet das Teamprofil aus der Liga-Tabelle heraus. Optional: fehlt der
   * Öffner, bleibt die Team-Spalte reiner Text — ein Knopf, der nichts tut,
   * wäre schlimmer als gar keiner.
   */
  onOpenTeam?: (teamId: string) => void;
};

/** Grün bei GuV ≥ 0, sonst Rot — gleiche binäre Ton-Regel wie andere GuV-Chips im neuen Look. */
function guvTone(value: number): NlTone {
  return value >= 0 ? "good" : "risk";
}

// --- Salary Factor (Saison-Ökonomie) -------------------------------------
// Ton-Wahl bewusst nach Nutzen für den Spieler, nicht mechanisch nach Vorzeichen:
// Ein STEIGENDER Salary Factor ist für den Manager GUT — der Faktor skaliert die
// Einnahmenseite der Liga (Sponsor-Topf ≈ Liga-Gehaltssumme × Faktor, dazu Preis-/
// Meilenstein-Leitern; siehe sponsor-v2-offer-service / prize-money), NICHT die
// Gehälter selbst (die kommen aus den Marktwert-Formeln). Auch die KI spart bei
// Faktor < 1 Cash an (retool-ai2-pick-engine, contract-renewal-service) — unter 1.0
// sind magere Zeiten. Daher: steigt → good, fällt → risk, stabil → neutral.
function salaryFactorDirectionTone(direction: SalaryFactorOutlook["direction"]): NlTone {
  if (direction === "up") return "good";
  if (direction === "down") return "risk";
  return "neutral";
}

function formatSalaryFactor(value: number): string {
  return `${formatLocalePoints(value, 2)}×`;
}

/** Untertitel des Chips: ehrlich nur dann eine Richtung, wenn die nächste Season vorliegt. */
function buildSalaryFactorSub(outlook: SalaryFactorOutlook): string | undefined {
  if (outlook.nextFactor == null || outlook.direction == null) return undefined;
  const arrow = outlook.direction === "up" ? "▲" : outlook.direction === "down" ? "▼" : "±";
  const word = outlook.direction === "up" ? "steigt" : outlook.direction === "down" ? "fällt" : "stabil";
  return `${arrow} ${word} → ${formatSalaryFactor(outlook.nextFactor)} nächste Season`;
}

const SALARY_FACTOR_TOOLTIP =
  "Liga-Ökonomiefaktor der laufenden Season (engl. „Salary Factor“, derselbe Wert wie im Season-Briefing): " +
  "skaliert die Einnahmenseite — der Sponsor-Topf der Liga entspricht ungefähr Liga-Gehaltssumme × Faktor, " +
  "Meilenstein-/Preisleitern skalieren mit. Über 1,0 fließt mehr Geld in die Liga als Gehälter kosten (gute " +
  "Zeiten), unter 1,0 weniger (sparen!). Die nächste Season ist bereits ausgewürfelt — der Pfeil zeigt, wohin " +
  "sich die Ökonomie entwickelt.";

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

// LEGACY: Preisgeld wird nicht mehr ausgezahlt und nicht mehr genutzt — Einnahmen
// laufen ausschließlich über Sponsoren (+ Gebäude). Der frühere `buildPrizeTooltip`
// samt Benchmark-Zeile wurde entfernt; `income.prizeBenchmark` ist nur noch ein
// deprecated Legacy-Feld (siehe finances-types.ts) und wird in der UI nicht gezeigt.

function buildFacilityIncomeTooltip(team: TeamFinancesState): string | undefined {
  const facilities = team.income.facilityIncome?.facilities ?? [];
  if (facilities.length === 0) return undefined;
  return facilities.map((facility) => `${facility.label}: ${formatNlMoney(facility.income)}`).join("\n");
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
    .map((loan) => `${loan.lenderName}: Zins ${formatNlMoney(loan.installment)} (Restschuld ${formatNlMoney(loan.outstanding)})`)
    .join("\n");
}

/**
 * Eine Zeile der Einnahmen-/Ausgaben-Spalte bzw. ein Segment des Flow-Charts.
 *
 * FARBSEMANTIK (Markt-Audit F2): Einnahmen laufen in der Grün-Familie (`good`), Ausgaben in der
 * Rot/Orange-Familie (`risk`/`warn`) — NIE der Team-Akzent (unter rotem Team-Theme las sich der
 * Sponsor-Balken wie eine Blutung) und NIE Achsen-Töne (blau/gelb sind Spiel-Identität, keine
 * Geldsemantik). Mehrere Posten derselben Familie unterscheiden sich per `alpha`, damit die
 * Legende eindeutig bleibt, ohne die Bedeutung zu wechseln.
 */
type FinanceLineItem = {
  key: string;
  label: string;
  /** Kurzform für die Herkunfts-Subzeile der Kopf-Kacheln („= Sponsor 63,5 + Gebäude 0,4"). */
  shortLabel: string;
  amount: number;
  tone: NlTone;
  /** Deckkraft des Segments/Balkens (Familie bleibt, Stufe unterscheidet). Default 1. */
  alpha?: number;
  title?: string;
};

function buildIncomeLines(team: TeamFinancesState): FinanceLineItem[] {
  const lines: FinanceLineItem[] = [];
  if (team.income.sponsor) {
    lines.push({
      key: "sponsor",
      label: team.income.sponsor.totalIsEstimate ? "Sponsor (geschätzt)" : "Sponsor",
      shortLabel: "Sponsor",
      amount: team.income.sponsor.total,
      tone: "good",
      title: buildSponsorTooltip(team),
    });
  }
  if (team.income.facilityIncome) {
    lines.push({
      key: "facilityIncome",
      label: "Gebäude-Einnahmen",
      shortLabel: "Gebäude",
      amount: team.income.facilityIncome.total,
      tone: "good",
      alpha: 0.65,
      title: buildFacilityIncomeTooltip(team),
    });
  }
  // Transfer-Überschuss ist ein Sonderposten (Einmal-Ereignis) und wird NICHT mehr in die laufende
  // Betriebs-GuV/Einnahmen gerechnet — er erscheint in einem eigenen "Transfers (Sonderposten)"-Block
  // (siehe TransferSpecialItem). So bleiben Einnahmen-Summe + Aufschlüsselung + Flow-Chart deckungsgleich
  // mit `team.totalIncome`.
  if (team.income.objectiveReward != null) {
    lines.push({
      key: "objective",
      label: "Vorstandsziele (Prämie)",
      shortLabel: "Prämie",
      amount: team.income.objectiveReward,
      tone: "good",
      alpha: 0.4,
      title: "Netto-Prämie erfüllter Vorstandsziele (Board-Objective-Settlement).",
    });
  }
  return lines;
}

function buildExpenseLines(team: TeamFinancesState): FinanceLineItem[] {
  const lines: FinanceLineItem[] = [];
  if (team.expenses.salaries.total > 0) {
    lines.push({
      key: "salaries",
      label: "Gehälter",
      shortLabel: "Gehälter",
      amount: team.expenses.salaries.total,
      tone: "risk",
      title: buildSalaryTooltip(team),
    });
  }
  if (team.expenses.facilityUpkeep.total > 0) {
    lines.push({
      key: "upkeep",
      label: "Gebäude-Unterhalt",
      shortLabel: "Unterhalt",
      amount: team.expenses.facilityUpkeep.total,
      tone: "warn",
      title: buildFacilityTooltip(team),
    });
  }
  if (team.expenses.loanInstallments.total > 0) {
    lines.push({
      key: "loans",
      // Ehrliches Label: diese Zeile trägt den ZINSANTEIL (die GuV-Ausgabe), nicht die volle
      // Rate — die Tilgung steht in der Verpflichtungs-Karte (Apron & Kredite) daneben.
      label: "Kreditzins",
      shortLabel: "Kreditzins",
      amount: team.expenses.loanInstallments.total,
      tone: "risk",
      alpha: 0.6,
      title: buildLoanTooltip(team),
    });
  }
  // Transfer-Defizit ist ein Sonderposten (Einmal-Ereignis, v. a. der Kaderaufbau in S1) und wird NICHT
  // mehr in die laufende Betriebs-GuV/Ausgaben gerechnet — es erscheint im eigenen "Transfers
  // (Sonderposten)"-Block (siehe TransferSpecialItem), damit Ausgaben-Summe + Aufschlüsselung + Flow-Chart
  // deckungsgleich mit `team.totalExpenses` bleiben.
  if (team.expenses.objectivePenalty != null) {
    lines.push({
      key: "objective",
      label: "Vorstandsziele (Strafe)",
      shortLabel: "Strafe",
      amount: team.expenses.objectivePenalty,
      tone: "warn",
      alpha: 0.6,
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
            fillOpacity={rect.alpha ?? 1}
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
            fillOpacity={rect.alpha ?? 1}
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
              <span
                className="nl-fin-flow-legend-dot"
                style={{ background: NL_TONE_VAR[line.tone], opacity: line.alpha ?? 1 }}
                aria-hidden="true"
              />
              <span className="nl-fin-flow-legend-label">{line.label}</span>
              <span className="nl-fin-flow-legend-value nl-tnum">{formatNlMoney(line.amount)}</span>
            </span>
          ))}
        </div>
        <div className="nl-fin-flow-legend-group">
          <span className="nl-fin-flow-legend-heading">Ausgaben</span>
          {expenseLines.map((line) => (
            <span key={line.key} className="nl-fin-flow-legend-item">
              <span
                className="nl-fin-flow-legend-dot"
                style={{ background: NL_TONE_VAR[line.tone], opacity: line.alpha ?? 1 }}
                aria-hidden="true"
              />
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

function FinanceHistoryTrend({ history, archivePending }: { history: FinanceSeasonHistoryPoint[]; archivePending: boolean }) {
  const points = history.filter((point) => point.guv != null);

  if (points.length <= 1) {
    // Ehrliche Leerzustände (Markt-Audit F4): „keine abgeschlossene Vorsaison" war mitten in
    // Season 2 schlicht falsch. Drei Fälle: Archiv lädt noch / Vorsaison archiviert, aber ohne
    // vergleichbare GuV (alte Formel, bewusst nicht gezeigt) / wirklich keine Vorsaison.
    const hasArchivedSeason = history.some((point) => !point.isCurrent);
    return (
      <NlEmptyState
        className="nl-fin-flow-empty"
        title={
          archivePending
            ? "Saisonarchiv wird geladen …"
            : hasArchivedSeason
              ? "Verlauf beginnt mit dem Abschluss der laufenden Saison."
              : "Saison-Verlauf ab der zweiten Saison verfügbar."
        }
        message={
          archivePending
            ? undefined
            : hasArchivedSeason
              ? "Die Vorsaison ist archiviert, aber noch ohne vergleichbare GuV (alte Rechnung) — ab dem nächsten Saisonende füllt sich der Verlauf."
              : "Für dieses Team liegt noch keine abgeschlossene Vorsaison vor."
        }
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
function FinanceLine({
  label,
  amount,
  share,
  tone,
  alpha,
  title,
}: {
  label: string;
  amount: number;
  share: number;
  tone: NlTone;
  alpha?: number;
  title?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, share)) * 1000) / 10;
  return (
    <div className="nl-fin-line" role="listitem" title={title} data-testid="nl-fin-line">
      <div className="nl-fin-line-head">
        <span className="nl-fin-line-label">{label}</span>
        <span className="nl-fin-line-value nl-tnum">{formatNlMoney(amount)}</span>
      </div>
      <span className="nl-fin-line-bartrack" aria-hidden="true">
        <span className="nl-fin-line-bar" style={{ width: `${pct}%`, background: NL_TONE_VAR[tone], opacity: alpha ?? 1 }} />
      </span>
    </div>
  );
}

// --- Transfers (Sonderposten) -------------------------------------------
// Der Transfersaldo der laufenden Saison ist ein Einmal-Ereignis (v. a. der große Kaderaufbau in S1) und
// gehört bewusst NICHT in die laufende Betriebs-GuV (siehe use-finances-view-model.ts). Er wird hier als
// eigener Sonderposten ausgewiesen, damit er sichtbar bleibt — auch in S1, wo der Cash-Abgleich (der ihn
// sonst über "Sonstige Cash-Bewegungen" absorbiert) mangels archiviertem Saisonstart-Cash ausgeblendet ist.
function TransferSpecialItem({ team }: { team: TeamFinancesState }) {
  const transfer = team.transfer;
  if (!transfer) return null;
  // Konsistente Vorzeichen (Markt-Audit F6): Käufe sind ein Geldabfluss und stehen NEGATIV, Verkäufe
  // positiv — dann stimmt die sichtbare Rechnung Käufe + Verkäufe = Saldo, statt dass „Käufe 84,2"
  // positiv neben einem Saldo von −84,2 steht.
  return (
    <StatChipRow className="nl-fin-kpi-hero" aria-label="Transfers (Sonderposten)">
      <StatChip
        label="Käufe"
        value={formatNlSignedMoney(-transfer.buyTotal)}
        tone="neutral"
        title={`${transfer.buyCount} Spieler gekauft — Geldabfluss, deshalb negativ`}
      />
      <StatChip
        label="Verkäufe"
        value={formatNlSignedMoney(transfer.sellTotal)}
        tone="neutral"
        title={`${transfer.sellCount} Spieler verkauft`}
      />
      <StatChip
        label="Transfersaldo"
        value={formatNlSignedMoney(transfer.net)}
        tone={transfer.net >= 0 ? "good" : "risk"}
        sub={`= ${formatNlSignedMoney(-transfer.buyTotal)} + ${formatNlSignedMoney(transfer.sellTotal)}`}
        title="Verkaufserlöse minus Kaufausgaben der laufenden Saison — Sonderposten, NICHT Teil der Betriebs-GuV."
      />
    </StatChipRow>
  );
}

// --- Verpflichtungen: Apron-Linien & Kredite ------------------------------
// CHRIS (M3): „kannst du bitte auch APRON 1 und 2 bei finanzen … separat noch mal ausweist?
// kredite / tilgungne etc sollen natürlich auch mit rein". Beide Linien einzeln, die eigene
// Position dazu (Abstand in Mio, nicht nur drüber/drunter), die Hochrechnung daneben — und die
// Kreditlast (volle Rate, Zins/Tilgung getrennt) in derselben Karte, damit die Summe der festen
// Verpflichtungen sichtbar wird. EINE Quelle: `team.apron` kommt aus derselben
// `buildApronProjection`, die auch die Apron-Zeile der GuV speist; die Kreditzerlegung aus
// `computeTeamLoanShareRows` (season-end-guv.ts), derselben Liste wie GuV-Posten und Ausgabenzeile.

function apronZoneTone(zone: FinanceApronStatus["zone"]): NlTone {
  if (zone === "unter_linie_1") return "good";
  if (zone === "zwischen_den_linien") return "warn";
  return "risk";
}

function apronZoneLabel(zone: FinanceApronStatus["zone"]): string {
  if (zone === "unter_linie_1") return "unter Linie 1";
  if (zone === "zwischen_den_linien") return "zwischen den Linien";
  return "über Linie 2";
}

function apronRangeTone(zone: FinanceApronStatus["zone"]): "positive" | "warning" | "negative" {
  if (zone === "unter_linie_1") return "positive";
  if (zone === "zwischen_den_linien") return "warning";
  return "negative";
}

/** „+14,7 drüber" / „−4,2 drunter" / „genau auf der Linie" — Abstand als Aussage, nicht nur Vorzeichen. */
function formatApronDistance(distance: number): string {
  if (Math.round(distance * 10) === 0) return "genau auf der Linie";
  return `${formatNlSignedMoney(distance)} ${distance > 0 ? "drüber" : "drunter"}`;
}

function ApronLinesPanel({ apron, actualSalaryTotal }: { apron: FinanceApronStatus | null; actualSalaryTotal: number }) {
  if (!apron) {
    return (
      <NlEmptyState
        className="nl-fin-flow-empty"
        title="Apron-Hochrechnung derzeit nicht verfügbar."
        message="Für diesen Spielstand ließ sich keine Apron-Projektion bauen — es wird nichts geschätzt."
      />
    );
  }

  const projektionLabel = apron.rank != null ? `Hochrechnung auf Platz ${apron.rank}` : "Hochrechnung (Rang unbekannt, letzter Platz angenommen)";

  return (
    <div className="nl-fin-apron" data-testid="nl-fin-apron">
      <div className="nl-fin-apron-rows" role="list" aria-label="Apron-Linien">
        <div className="nl-fin-apron-row" role="listitem" title="1. Apron-Linie = Median-Gehalt der Liga (geglättet) × 1,1. Wer drüber liegt, zahlt auf den Überschuss eine Abgabe.">
          <span className="nl-fin-apron-row-label">Apron-Linie 1</span>
          <span className="nl-fin-apron-row-value nl-tnum">{formatNlMoney(apron.line1)}</span>
          <span className="nl-fin-apron-row-note nl-tnum">{formatApronDistance(apron.distanceLine1)}</span>
        </div>
        <div className="nl-fin-apron-row" role="listitem" title="2. Apron-Linie = Median-Gehalt × 1,25. Überschuss über dieser Linie kostet den höheren Satz.">
          <span className="nl-fin-apron-row-label">Apron-Linie 2</span>
          <span className="nl-fin-apron-row-value nl-tnum">{formatNlMoney(apron.line2)}</span>
          <span className="nl-fin-apron-row-note nl-tnum">{formatApronDistance(apron.distanceLine2)}</span>
        </div>
        <div
          className="nl-fin-apron-row is-basis"
          role="listitem"
          title="Bemessungsgrundlage des Apron: die GEGLÄTTETE Gehaltssumme (Verträge über die Laufzeit verteilt) — bewusst nicht die echte Saisonsumme der GuV, siehe Hinweis unten."
        >
          <span className="nl-fin-apron-row-label">Deine Bemessungsgrundlage</span>
          <span className="nl-fin-apron-row-value nl-tnum">{formatNlMoney(apron.salaryBasis)}</span>
          <span className={`nl-fin-apron-row-note ${nlToneClass(apronZoneTone(apron.zone))}`}>{apronZoneLabel(apron.zone)}</span>
        </div>
      </div>

      <div className="nl-fin-apron-meter" data-testid="nl-fin-apron-meter">
        <VeloRangeBar
          low={apron.line1}
          high={apron.line2}
          point={apron.salaryBasis}
          tone={apronRangeTone(apron.zone)}
          ariaLabel={`Apron-Korridor ${formatNlMoney(apron.line1)} bis ${formatNlMoney(apron.line2)}, deine Bemessungsgrundlage ${formatNlMoney(apron.salaryBasis)} (${apronZoneLabel(apron.zone)})`}
        />
        <span className="nl-fin-apron-meter-caption">Band = Korridor zwischen Linie 1 und 2 · Marker = deine Bemessungsgrundlage</span>
      </div>

      <div className="nl-fin-apron-projection" data-testid="nl-fin-apron-projection">
        <span className="nl-fin-apron-projection-label">{apron.gebucht ? "Abrechnung (gebucht)" : projektionLabel}</span>
        <span className="nl-fin-apron-projection-value nl-tnum">
          {apron.abgabe > 0 ? `Abgabe ${formatNlMoney(apron.abgabe)}` : apron.ausgleich > 0 ? `Ausgleich ${formatNlMoney(apron.ausgleich)}` : "keine Abgabe, kein Ausgleich"}
          {apron.gedeckelt ? " · durch den Deckel begrenzt" : ""}
        </span>
        <span className="nl-fin-apron-projection-netto nl-tnum" title="Netto-Effekt aufs Cash am Saisonende: Ausgleich minus Abgabe — dieselbe Zahl wie die Apron-Zeile im GuV-Hover.">
          Netto {formatNlSignedMoney(apron.nettoDelta)}
        </span>
      </div>

      <p className="nl-fin-apron-league muted nl-tnum" data-testid="nl-fin-apron-league">
        Liga: Median {formatNlMoney(apron.medianSalary)} · {apron.zahlerCount} Zahler · {apron.empfaengerCount} Empfänger · Topf {formatNlMoney(apron.topf)}
      </p>

      <p className="nl-fin-apron-status muted" data-testid="nl-fin-apron-status">
        {apron.gebucht
          ? "Die Apron-Abrechnung dieser Saison ist bereits gebucht."
          : apron.frozenLines
            ? "Linien für diese Saison eingefroren — gegen sie wird am Saisonende abgerechnet. Abgabe/Ausgleich bleiben bis dahin eine Hochrechnung auf den aktuellen Rang."
            : "Linien noch nicht eingefroren — sie wandern bis zum ersten Spieltag mit dem Median mit, solange noch Kader gebaut werden. Alles hier ist eine Hochrechnung."}
        {apron.usedReferenceSalary ? " Frisch-Save: Linien aus dem Referenzgehalt abgeleitet, nicht aus gemessenen Gehältern." : ""}
      </p>

      {/* Der heikelste Punkt der Karte: hier stehen zwei verschiedene Gehaltssummen nebeneinander,
          und beide sind richtig. Ohne diesen Satz sähe das wie der Widerspruch aus, den F4 (Fundament)
          gerade behoben hat — deshalb wird der Unterschied erklärt, nicht versteckt. */}
      <p className="nl-fin-apron-basis-note muted" data-testid="nl-fin-apron-basis-note">
        Der Apron rechnet auf der <b>geglätteten</b> Gehaltssumme ({formatNlMoney(apron.salaryBasis)}): Verträge werden über ihre
        Laufzeit verteilt, Front-/Backloading zählt nicht als Mehrausgabe. Die GuV oben bucht dagegen die <b>echte</b> Saisonsumme
        ({formatNlMoney(actualSalaryTotal)}). Beide Zahlen sind absichtlich verschieden.
      </p>
    </div>
  );
}

// --- Apron liga-weit: wer zahlt, wer bekommt ------------------------------
// CHRIS: „in den finanzen fehlt mir immernoch ein ausweis vom APRON was die teams dadurch zahlen
// müssen oder einnehmen." Die Karte oben nannte 28 Zahler / 3 Empfänger nur als Aggregat — hier
// stehen sie mit Namen. EINE Quelle: `apron.league` sind dieselben Projektionszeilen
// (`buildApronProjection`), aus denen auch Topf/Zahler-/Empfängerzahl stammen — nichts neu
// gerechnet (siehe use-finances-view-model.ts). „Es ist ein Game und kein Excel": kollabiert
// zeigt die Liste nur die Extreme — die größten Zahler, dein Team, alle Empfänger; der Rest
// kommt auf Klick, und der Aufklapp-Knopf trägt die Zwischensumme der verborgenen Zahler,
// damit die Summenprobe auch kollabiert aufgeht.

/** Wie viele der größten Zahler die kollabierte Liste zeigt (plus dein Team plus alle Empfänger). */
const APRON_LEAGUE_TOP_ZAHLER = 5;

const APRON_LEAGUE_COLUMNS: NlTableColumn<FinanceApronLeagueRow>[] = [
  {
    key: "rank",
    label: "#",
    align: "right",
    width: "36px",
    tooltip: "Aktueller Ligarang — der Rang, auf den die Hochrechnung rechnet; bis zum Saisonende kann er sich verschieben",
  },
  { key: "team", label: "Team" },
  {
    key: "basis",
    label: "Bemessung (geglättet)",
    align: "right",
    tooltip:
      "Geglättete Gehaltssumme (Verträge über die Laufzeit verteilt) — die Bemessungsgrundlage des Apron, absichtlich NICHT die echte Gehaltssumme der GuV (siehe Hinweis bei den Apron-Linien)",
  },
  {
    key: "abstand",
    label: "zur 1. Linie",
    align: "right",
    tooltip: "Bemessungsgrundlage minus 1. Linie: wer drüber liegt, zahlt auf den Überschuss — wer drunter liegt, ist empfangsberechtigt",
  },
  {
    key: "netto",
    label: "Zahlt / bekommt",
    align: "right",
    tooltip: "Hochrechnung beim aktuellen Rang: Abgabe (−) in den Topf bzw. Ausgleich (+) aus dem Topf",
  },
];

/** Farb-Wahrheit (Befund aus PR #460): Einnahme grün, Abgabe rot — nie der Team-Akzent. */
function apronLeagueRolleTone(rolle: FinanceApronLeagueRow["rolle"]): NlTone {
  return rolle === "empfaenger" ? "good" : rolle === "zahler" ? "risk" : "neutral";
}

function apronLeagueNettoTitle(row: FinanceApronLeagueRow): string {
  if (row.rolle === "zahler") {
    return `Zahlt bei diesem Rang ${formatNlMoney(row.abgabe)} in den Apron-Topf${
      row.gedeckelt ? " — durch den Deckel begrenzt (höchstens der halbe rangabhängige Wertungsanteil)" : ""
    }.`;
  }
  if (row.rolle === "empfaenger") {
    if (row.ausgleich > 0) {
      return `Bekommt ${formatNlMoney(row.ausgleich)} aus dem Topf — gleicher Kopfanteil für jedes Team unter der 1. Linie, der Topf wird vollständig verteilt.`;
    }
    return "Empfangsberechtigt (unter der 1. Linie), aber der Topf ist leer — es gibt nichts zu verteilen.";
  }
  return "Weder Abgabe noch Ausgleich: liegt nicht unter der 1. Linie (kein Empfänger) und zahlt bei dieser Hochrechnung nichts.";
}

function renderApronLeagueCell(row: FinanceApronLeagueRow, column: NlTableColumn<FinanceApronLeagueRow>, ownTeamId: string) {
  switch (column.key) {
    case "rank":
      return row.rank != null ? row.rank : <span title="Rang unbekannt — letzter Platz angenommen">—</span>;
    case "team":
      return (
        <span className="nl-fin-league-team">
          <span className="nl-fin-league-code">{row.teamCode}</span>
          <span className="nl-fin-league-name" title={row.teamName}>
            {row.teamName}
          </span>
          {row.teamId === ownTeamId ? <span className="nl-fin-league-you">Dein Team</span> : null}
        </span>
      );
    case "basis":
      return formatNlMoney(row.salaryBasis);
    case "abstand":
      return (
        <span className="nl-fin-apron-lg-dist nl-tnum" title={formatApronDistance(row.distanceLine1)}>
          {formatNlSignedMoney(row.distanceLine1)}
        </span>
      );
    case "netto":
      return (
        <span className={`nl-fin-apron-lg-netto ${nlToneClass(apronLeagueRolleTone(row.rolle))}`} title={apronLeagueNettoTitle(row)}>
          <span className="nl-tnum">{formatNlSignedMoney(row.nettoDelta)}</span>
          <span className="nl-fin-apron-lg-role">
            {row.rolle === "zahler" ? "Zahler" : row.rolle === "empfaenger" ? "Empfänger" : "neutral"}
            {row.gedeckelt ? (
              <span className="nl-fin-apron-lg-deckel" title="Abgabe durch den Deckel begrenzt — höchstens der halbe rangabhängige Wertungsanteil.">
                Deckel
              </span>
            ) : null}
          </span>
        </span>
      );
    default:
      return null;
  }
}

function ApronLeagueList({ apron, ownTeamId }: { apron: FinanceApronStatus; ownTeamId: string }) {
  const [alleZeigen, setAlleZeigen] = useState(false);

  const kollabiert = useMemo(() => {
    const topZahler = new Set(
      apron.league
        .filter((row) => row.rolle === "zahler")
        .slice(0, APRON_LEAGUE_TOP_ZAHLER)
        .map((row) => row.teamId),
    );
    return apron.league.filter((row) => row.rolle === "empfaenger" || row.teamId === ownTeamId || topZahler.has(row.teamId));
  }, [apron.league, ownTeamId]);

  const kollabierbar = kollabiert.length < apron.league.length;
  const sichtbareZeilen = alleZeigen || !kollabierbar ? apron.league : kollabiert;

  // Zwischensumme der verborgenen Zahler — Summe genau der Zeilenwerte, die beim Aufklappen
  // erscheinen (dieselbe Quelle, keine zweite Rechnung): sichtbare Abgaben + diese Zwischensumme
  // ergeben zusammen wieder den Topf (bis auf die dokumentierte Anzeigerundung).
  const verborgen = useMemo(() => {
    const sichtbar = new Set(kollabiert.map((row) => row.teamId));
    const zeilen = apron.league.filter((row) => !sichtbar.has(row.teamId));
    const zahler = zeilen.filter((row) => row.rolle === "zahler");
    return {
      zahlerCount: zahler.length,
      zahlerSumme: Number(zahler.reduce((sum, row) => sum + row.abgabe, 0).toFixed(1)),
      neutralCount: zeilen.filter((row) => row.rolle === "neutral").length,
    };
  }, [apron.league, kollabiert]);

  const statusText = apron.gebucht
    ? "Abrechnung dieser Saison bereits gebucht"
    : apron.frozenLines
      ? "Hochrechnung auf die aktuellen Ränge, gegen die eingefrorenen Linien"
      : "Hochrechnung auf die aktuellen Ränge — Linien noch nicht eingefroren";
  // Summenprobe im Klartext: Topf und Kopfanteil kommen als FERTIGE Werte aus dem View-Model
  // (eine Quelle; der Kopfanteil ist der `ausgleich` einer Empfänger-Zeile, keine zweite
  // Rechnung). Der Topf wird VOLLSTÄNDIG zu gleichen Kopfteilen verteilt — kein Deckel auf der
  // Empfängerseite, kein Verfall (apron-service.ts, Nutzer-Entscheidung). Gäbe es keinen einzigen Empfänger,
  // würde auch nichts eingesammelt — dann ist zahlerCount hier 0 und der Text sagt warum.
  const kopfanteil = apron.league.find((row) => row.rolle === "empfaenger")?.ausgleich ?? 0;
  const summenText =
    apron.zahlerCount > 0
      ? `${apron.zahlerCount} Zahler zahlen zusammen ${formatNlMoney(apron.topf)} in den Topf, ` +
        `${apron.empfaengerCount} Empfänger teilen ihn vollständig — je ${formatNlMoney(kopfanteil)}`
      : apron.empfaengerCount === 0
        ? "Kein Team liegt unter der 1. Linie — ohne Empfänger wird keine Abgabe eingesammelt (der Apron verteilt nur um, er vernichtet kein Geld)"
        : "Kein Team zahlt bei dieser Hochrechnung — der Topf ist leer, es gibt nichts zu verteilen";

  return (
    <section className="nl-fin-apron-league-block" aria-label="Apron liga-weit: wer zahlt, wer bekommt" data-testid="nl-fin-apron-league-block">
      <h3 className="nl-fin-commit-section-title">Apron liga-weit — wer zahlt, wer bekommt</h3>
      <p className="nl-fin-apron-lg-summary muted nl-tnum" data-testid="nl-fin-apron-lg-summary">
        {statusText} · {summenText}.
      </p>
      <NlTable
        className="nl-fin-apron-lg-table"
        columns={APRON_LEAGUE_COLUMNS}
        rows={sichtbareZeilen}
        rowKey={(row) => row.teamId}
        rowClassName={(row) => (row.teamId === ownTeamId ? "is-active-row" : undefined)}
        renderCell={(row, column) => renderApronLeagueCell(row, column, ownTeamId)}
        stickyHeader={false}
        data-testid="nl-fin-apron-lg-table"
        aria-label="Apron liga-weit: wer zahlt, wer bekommt"
      />
      {kollabierbar ? (
        <button
          type="button"
          className="nl-fin-apron-lg-more nl-rankdrawer-more"
          data-testid="nl-fin-apron-lg-more"
          onClick={() => setAlleZeigen((current) => !current)}
        >
          {alleZeigen
            ? "Nur die Extreme zeigen — größte Zahler, dein Team, Empfänger"
            : `Alle ${apron.league.length} Teams anzeigen` +
              (verborgen.zahlerCount > 0
                ? ` · ${verborgen.zahlerCount} weitere Zahler zahlen zusammen ${formatNlMoney(verborgen.zahlerSumme)}`
                : "") +
              (verborgen.neutralCount > 0 ? ` · ${verborgen.neutralCount} neutral` : "")}
        </button>
      ) : null}
      <p className="nl-fin-apron-lg-note muted" data-testid="nl-fin-apron-lg-note">
        {apron.gedeckeltCount > 0
          ? `${apron.gedeckeltCount === 1 ? "1 Zahler ist" : `${apron.gedeckeltCount} Zahler sind`} durch den Deckel begrenzt (höchstens der halbe rangabhängige Wertungsanteil): sie zahlen weniger, als ihr Überschuss nach den Linien-Sätzen ergäbe. Der Topf enthält nur die begrenzten Beträge. `
          : ""}
        {(() => {
          // Gedeckelt auf 0,0: das Team steht über den Linien, der Deckel drückt seine
          // Abgabe aber auf null — in der Tabelle "neutral". Die Fußnote benennt den
          // Fall, statt ihn stumm in die Zahler-Zählung zu mischen (vorher "18 Zahler").
          const gedeckeltOhneAbgabe = apron.league.filter((row) => row.gedeckelt && row.rolle !== "zahler").length;
          return gedeckeltOhneAbgabe > 0
            ? gedeckeltOhneAbgabe === 1
              ? "1 weiteres Team trägt das Deckel-Abzeichen, zahlt dank Deckel aber 0,0 und bleibt neutral. "
              : `${formatNlNumber(gedeckeltOhneAbgabe, 0)} weitere Teams tragen das Deckel-Abzeichen, zahlen dank Deckel aber 0,0 und bleiben neutral. `
            : "";
        })()}
        Beträge auf 0,1 Mio gerundet, verteilt wird ungerundet — die Summe der gerundeten Zeilen kann darum minimal von Topf und Ausschüttung abweichen.
      </p>
    </section>
  );
}

function LoanCommitmentsPanel({ loans }: { loans: FinanceLoanCommitments }) {
  return (
    <div className="nl-fin-commit" data-testid="nl-fin-commit">
      {/* Chris-Regel „selbst wenn es 0 ist": die vier Chips stehen immer da — „Kreditrate 0" beantwortet
          die Frage, ob Kredite in den Zahlen stecken; eine fehlende Zeile ließe sie offen. */}
      <StatChipRow className="nl-fin-commit-chips" aria-label="Kredit-Verpflichtungen">
        <StatChip
          label="Kreditrate p. a."
          value={formatNlMoney(loans.installmentTotal)}
          tone={loans.installmentTotal > 0 ? "risk" : "neutral"}
          title="Volle Saisonrate aller laufenden Kredite (Zins + Tilgung) — das, was am Saisonende wirklich vom Cash abgeht."
        />
        <StatChip
          label="davon Zins"
          value={formatNlMoney(loans.interestTotal)}
          tone="neutral"
          sub="GuV-Ausgabe"
          title="Zinsanteil der Raten — der einzige Teil, der als Ausgabe in die GuV zählt (Zeile „Kreditzins“ oben)."
        />
        <StatChip
          label="davon Tilgung"
          value={formatNlMoney(loans.principalTotal)}
          tone="neutral"
          sub="Bilanz: senkt die Restschuld"
          title="Tilgungsanteil der Raten — cash-wirksam, aber keine GuV-Ausgabe: Cash runter, Restschuld runter, Eigenkapital unverändert."
        />
        <StatChip
          label="Restschuld"
          value={formatNlMoney(loans.outstandingTotal)}
          tone={loans.outstandingTotal > 0 ? "warn" : "neutral"}
          title="Offene Restschuld aller laufenden Kredite heute."
        />
      </StatChipRow>
      {loans.rows.length > 0 ? (
        <div className="nl-fin-commit-loans" role="list" aria-label="Laufende Kredite">
          {loans.rows.map((row) => (
            <div key={row.loanId} className="nl-fin-commit-loan" role="listitem">
              <span className="nl-fin-commit-loan-lender">{row.lenderName}</span>
              <span className="nl-fin-commit-loan-values nl-tnum">
                Rate {formatNlMoney(row.installment)} (Zins {formatNlMoney(row.interest)} + Tilgung {formatNlMoney(row.principal)}) ·
                Restschuld {formatNlMoney(row.outstanding)} · noch {row.remainingSeasons} Saison{row.remainingSeasons === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="nl-fin-league-hint muted">Keine laufenden Kredite — Konditionen, Anbieter und Aufnahme stehen im Kredite-Reiter.</p>
      )}
    </div>
  );
}

/**
 * Kopfzeile der Verpflichtungs-Karte: die Summe der festen Zahlungsverpflichtungen der Saison —
 * echte Gehälter + volle Kreditrate + Apron-Abgabe (Hochrechnung). Jeder Teil ist beschriftet,
 * die Summe zeigt ihre Rechnung als Subzeile (keine Zahl ohne Herkunft).
 */
function CommitmentSummary({ team }: { team: TeamFinancesState }) {
  const salary = team.expenses.salaries.total;
  const rate = team.loanCommitments.installmentTotal;
  const apronAbgabe = team.apron?.abgabe ?? 0;
  const total = Number((salary + rate + apronAbgabe).toFixed(1));
  return (
    <StatChipRow className="nl-fin-kpi-hero" aria-label="Feste Verpflichtungen der Saison">
      <StatChip
        label="Gehälter (echt)"
        value={formatNlMoney(salary)}
        tone="neutral"
        title="Echte Gehaltssumme der Saison (contract.salary — das Feld der Season-End-Abbuchung), identisch zur Ausgabenzeile „Gehälter“."
      />
      <StatChip
        label="Kreditrate p. a."
        value={formatNlMoney(rate)}
        tone="neutral"
        title="Volle Saisonrate aller laufenden Kredite (Zins + Tilgung)."
      />
      <StatChip
        label="Apron-Abgabe"
        value={team.apron ? formatNlMoney(apronAbgabe) : "—"}
        tone={apronAbgabe > 0 ? "warn" : "neutral"}
        sub={team.apron && !team.apron.gebucht ? "Hochrechnung" : undefined}
        title="Apron-Abgabe beim aktuellen Rang (siehe Linien-Aufschlüsselung unten) — bis zur Buchung am Saisonende eine Hochrechnung."
      />
      <StatChip
        label="Feste Verpflichtungen"
        value={formatNlMoney(total)}
        tone="risk"
        sub={`= ${formatNlNumber(salary)} + ${formatNlNumber(rate)} + ${formatNlNumber(apronAbgabe)}`}
        title="Gehälter (echt) + volle Kreditrate + Apron-Abgabe (Hochrechnung) — was diese Saison unabhängig vom sportlichen Verlauf fällig wird."
      />
    </StatChipRow>
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
    // ZWEI ehrliche Zustände statt einer falschen Behauptung (Markt-Audit F4): solange das
    // Saisonarchiv noch nachgeladen wird, sagt die Zeile „lädt" — erst wenn es da ist und wirklich
    // keinen Vorsaison-Stand trägt, sagt sie „nicht archiviert". Vorher stand die zweite Aussage
    // auch während des Ladens da, mitten in Season 2 mit existierendem Archiv.
    return (
      <p className="nl-fin-league-hint muted" data-testid="nl-fin-reconciliation-hint">
        {team.archivePending
          ? "Saisonarchiv wird geladen — der Cash-Abgleich erscheint gleich."
          : "Cash-Abgleich ab der zweiten Saison verfügbar — für die Vorsaison ist kein Saison-Start-Cash archiviert."}
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
      <StatChip
        label="+ GuV"
        value={formatNlMoney(team.guv)}
        tone={guvTone(team.guv)}
        // DERSELBE Hover wie im Saisonstand — nicht mehr nur dieselbe Abgrenzung, sondern dieselbe
        // Rechnung und dieselben Zeilen (`lib/finance/season-end-guv.ts`). Jeder Posten steht drin,
        // auch die mit 0. Der alte Kurztext bleibt nur als Rueckfall, falls die Posten fehlen.
        title={
          team.guvPosten && team.guvPosten.length > 0
            ? buildSeasonGuvHoverText(seasonGuvFromPosten(team.teamId, team.guvPosten))
            : buildOperatingGuvHoverText({
                totalIncome: team.totalIncome,
                totalExpenses: team.totalExpenses,
              })
        }
      />
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

// Markt-Audit F3: „GuV p.a." und „Cashflow p.a." waren für 26 von 32 Teams dieselbe Spalte —
// wirkte wie ein Duplikat. Jetzt EINE GuV-Spalte; wo Kreditraten drücken, steht der echte
// Geldabfluss als beschriftete Zusatzzeile („nach Kreditraten −25,9") direkt in der Zelle.
const NL_FIN_LEAGUE_COLUMNS: NlTableColumn<FinanceLeagueTableRow>[] = [
  { key: "rank", label: "#", align: "right", width: "36px" },
  { key: "team", label: "Team" },
  { key: "cash", label: "Cash", align: "right", sortable: true },
  {
    key: "incomeAnnual",
    label: "Einnahmen p.a.",
    align: "right",
    sortable: true,
    tooltip: "Sponsor-Einnahmen + Gebäude-Einnahmen (Näherungswert) — ohne Transfersaldo (Einmal-Ereignis)",
  },
  {
    key: "expensesAnnual",
    label: "Ausgaben p.a.",
    align: "right",
    sortable: true,
    tooltip:
      "Gehälter + Gebäude-Unterhalt + Kredit-ZINS (Näherungswert). Ohne Tilgung — die ist keine GuV-Ausgabe, sondern senkt die Schulden; den echten Geldabfluss zeigt die Zusatzzeile „nach Kreditraten“ in der GuV-Spalte.",
  },
  {
    key: "guv",
    label: "GuV p.a.",
    align: "right",
    sortable: true,
    tooltip:
      "Einnahmen p.a. minus Ausgaben p.a. (kaufmännisches Ergebnis, ohne Tilgung). Bei Teams mit laufenden Krediten zeigt die Zusatzzeile „nach Kreditraten“, was nach Abzug der Tilgung wirklich aufs Konto kommt.",
  },
  { key: "marketValue", label: "MW", align: "right", sortable: true, tooltip: "Kader-Marktwert-Summe" },
];

function renderLeagueCell(
  row: FinanceLeagueTableRow,
  column: NlTableColumn<FinanceLeagueTableRow>,
  rank: number,
  isOwnTeam: boolean,
  onOpenTeam: ((teamId: string) => void) | null,
) {
  switch (column.key) {
    case "rank":
      return rank;
    case "team": {
      const content = (
        <>
          <BudgetedMediaImage
            src={row.logoUrl}
            alt={`${row.teamName} Logo`}
            className="nl-fin-league-crest"
            width={22}
            height={22}
            loading="lazy"
            fallback={<span className="nl-fin-league-crest nl-fin-league-crest-fallback">{row.logoInitials}</span>}
          />
          <span className="nl-fin-league-code">{row.teamCode}</span>
          <span className="nl-fin-league-name" title={row.teamName}>
            {row.teamName}
          </span>
          {isOwnTeam ? <span className="nl-fin-league-you">Dein Team</span> : null}
        </>
      );
      // Ohne Öffner bleibt es der bisherige reine Text: ein Knopf, der nichts tut,
      // wäre schlimmer als gar keiner.
      if (!onOpenTeam) {
        return <span className="nl-fin-league-team">{content}</span>;
      }
      return (
        <button
          type="button"
          className="nl-fin-league-team is-linked"
          onClick={() => onOpenTeam(row.teamId)}
          title={`${row.teamName} — Teamprofil öffnen`}
        >
          {content}
        </button>
      );
    }
    case "cash":
      return formatNlMoney(row.cash);
    case "incomeAnnual":
      return formatNlMoney(row.incomeAnnual);
    case "expensesAnnual":
      return formatNlMoney(row.expensesAnnual);
    case "guv":
      return (
        <span className="nl-fin-league-guv">
          <span className={nlToneClass(guvTone(row.guv))}>{formatNlMoney(row.guv)}</span>
          {/* Nur bei Teams mit laufender Tilgung — sonst wäre die Zeile für 26 von 32 Teams ein Echo. */}
          {row.loanPrincipalAnnual > 0 ? (
            <span
              className="nl-fin-league-guv-sub nl-tnum"
              title={`GuV ${formatNlMoney(row.guv)} − Tilgung ${formatNlMoney(row.loanPrincipalAnnual)} = ${formatNlMoney(row.cashFlowAnnual)} tatsächlicher Geldfluss`}
            >
              nach Kreditraten {formatNlMoney(row.cashFlowAnnual)}
            </span>
          ) : null}
        </span>
      );
    case "marketValue":
      return row.marketValue != null ? formatNlMoney(row.marketValue) : "—";
    default:
      return null;
  }
}

function FinanceLeagueTable({
  leagueTable,
  activeManagerTeamId,
  onOpenTeam,
}: {
  leagueTable: FinanceLeagueTableRow[];
  activeManagerTeamId: string | null;
  onOpenTeam: ((teamId: string) => void) | null;
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
          renderCell={(row, column) =>
            renderLeagueCell(row, column, sortedRows.indexOf(row) + 1, row.teamId === activeManagerTeamId, onOpenTeam)
          }
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
 * berechneten Cashflow-Quellen (Sponsor-Vertrag, Gehälter, Gebäude-Unterhalt,
 * Kreditraten, Transfer-Saldo — Preisgeld ist Legacy und entfällt), siehe
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
  salaryFactorOutlook,
  onOpenTeam,
}: FoundationFinancesNewLookProps) {
  const team = model.status === "ready" ? model.team : null;
  const incomeLines = team ? buildIncomeLines(team) : [];
  const expenseLines = team ? buildExpenseLines(team) : [];

  // BEWUSST KEINE Zähler-Animation auf den Kopfzahlen mehr (Markt-Audit F1): `useCountUp` zeigte
  // sekundenlang Zwischenstände (62,1 statt 63,5) als wären sie endgültig — wer in dem Moment
  // ablas, nahm 1,4 Mio Differenz mit. Geldzahlen stehen ab dem ersten Frame fest.
  const incomeSub = incomeLines.length > 0 ? `= ${incomeLines.map((line) => `${line.shortLabel} ${formatNlNumber(line.amount)}`).join(" + ")}` : undefined;
  const expenseSub =
    expenseLines.length > 0 ? `= ${expenseLines.map((line) => `${line.shortLabel} ${formatNlNumber(line.amount)}`).join(" + ")}` : undefined;

  return (
    <div className="nl-fin" data-testid="foundation-finances" data-new-look="true">
      <NlCard className="nl-fin-header-card" eyebrow="Finanzen" title={teamName}>
        {team ? (
          <StatChipRow className="nl-fin-kpi-hero" aria-label="Finanz-Kennzahlen">
            <StatChip label="Cash" value={formatNlMoney(team.cash)} tone="neutral" sub="Stand heute" />
            <StatChip
              label="Einnahmen (Saison)"
              value={formatNlMoney(team.totalIncome)}
              tone="good"
              sub={incomeSub}
              title="Sponsor + Gebäude-Einnahmen + Vorstandsziel-Prämien der laufenden Saison (Transfersaldo separat als Sonderposten)"
            />
            <StatChip
              label="Ausgaben (Saison)"
              value={formatNlMoney(team.totalExpenses)}
              tone="risk"
              sub={expenseSub}
              title="Gehälter + bezahlter Gebäude-Unterhalt + Kreditzins + Vorstandsziel-Strafen der laufenden Saison (Transfersaldo separat als Sonderposten; Kredit-Tilgung ist Bilanzbewegung, siehe Karte „Apron & Kredite“)"
            />
            <StatChip
              label="GuV"
              value={formatNlMoney(team.guv)}
              tone={guvTone(team.guv)}
              sub={`${formatNlNumber(team.totalIncome)} − ${formatNlNumber(team.totalExpenses)}`}
              title="Einnahmen minus Ausgaben der laufenden Saison"
            />
            {/* Gehaltsfaktor: Wert der laufenden Season + Richtung zur (bereits ausgewürfelten)
                nächsten Season — Tonwahl siehe salaryFactorDirectionTone. Ohne validen Wert
                bewusst gar kein Chip statt "1,00×"-Fake. */}
            {salaryFactorOutlook.currentFactor != null ? (
              <StatChip
                label="Gehaltsfaktor"
                value={formatSalaryFactor(salaryFactorOutlook.currentFactor)}
                tone={salaryFactorDirectionTone(salaryFactorOutlook.direction)}
                sub={buildSalaryFactorSub(salaryFactorOutlook)}
                title={SALARY_FACTOR_TOOLTIP}
                className="nl-fin-salary-factor-chip"
              />
            ) : null}
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

      {/* Chris (M3): Apron-Linien 1 & 2 einzeln + Kredite/Tilgung in EINER Verpflichtungs-Karte. */}
      {team ? (
        <NlCard
          className="nl-fin-commitments-card"
          eyebrow="Verpflichtungen"
          title="Apron & Kredite"
          data-testid="nl-fin-commitments-card"
        >
          <CommitmentSummary team={team} />
          <div className="nl-fin-commit-columns">
            <section className="nl-fin-commit-section" aria-label="Apron-Linien">
              <h3 className="nl-fin-commit-section-title">Apron-Linien</h3>
              <ApronLinesPanel apron={team.apron} actualSalaryTotal={team.expenses.salaries.total} />
            </section>
            <section className="nl-fin-commit-section" aria-label="Kredite und Tilgung">
              <h3 className="nl-fin-commit-section-title">Kredite &amp; Tilgung</h3>
              <LoanCommitmentsPanel loans={team.loanCommitments} />
            </section>
          </div>
          {/* Chris: „…ein ausweis vom APRON was die teams dadurch zahlen müssen oder einnehmen" —
              liga-weit mit Namen; ohne Projektion erklärt das ApronLinesPanel oben bereits, warum nicht. */}
          {team.apron ? <ApronLeagueList apron={team.apron} ownTeamId={team.teamId} /> : null}
        </NlCard>
      ) : null}

      {/* Transfersaldo als Sonderposten — außerhalb der laufenden Betriebs-GuV, aber sichtbar (auch in S1). */}
      {team && team.transfer ? (
        <NlCard
          className="nl-fin-transfer-card"
          eyebrow="Transfers"
          title="Sonderposten (nicht in der GuV)"
          data-testid="nl-fin-transfer-card"
        >
          <TransferSpecialItem team={team} />
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
          <FinanceHistoryTrend history={team.history} archivePending={team.archivePending} />
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
                    alpha={line.alpha}
                    title={line.title}
                  />
                ))}
              </div>
            ) : (
              <NlEmptyState title="Keine Einnahmen für diese Saison bekannt." />
            )}
            {/* LEGACY: Preisgeld-Benchmark entfernt — es gibt nur noch Sponsor-Einnahmen. */}
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
                    alpha={line.alpha}
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

      <FinanceLeagueTable
        leagueTable={leagueTable}
        activeManagerTeamId={activeManagerTeamId}
        onOpenTeam={onOpenTeam ?? null}
      />
    </div>
  );
}

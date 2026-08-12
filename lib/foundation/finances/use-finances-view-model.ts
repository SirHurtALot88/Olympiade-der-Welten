"use client";

import { useMemo } from "react";

import type { GameState, SponsorOfferComponentKind } from "@/lib/data/olyDataTypes";
import { estimateTeamAnnualRevenue, getTeamAnnualLoanInterest } from "@/lib/finance/loan-service";
import { buildApronProjection } from "@/lib/finance/apron-projection";
import { buildSeasonGuv, computeFacilitySeasonCash, computeTeamLoanShareRows } from "@/lib/finance/season-end-guv";
import { roundValue as round1 } from "@/lib/foundation/foundation-number-utils";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import {
  getSeasonSponsorCashByTeam,
  previewSponsorSettlement,
  type SponsorSettlementRow,
} from "@/lib/sponsor/sponsor-settlement-service";
import { getSponsorComponentKindLabel } from "@/lib/sponsor/sponsor-offer-presenter";
import { getObjectiveCashByTeam } from "@/lib/board/objective-settlement-cash-source";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamActualSalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { FINANCE_SPONSOR_INCOME_COMPONENT_KINDS } from "@/lib/foundation/finances/finances-types";
import type {
  FinanceApronLeagueRow,
  FinanceApronStatus,
  FinanceFacilityIncome,
  FinanceFacilityUpkeepRow,
  FinanceLoanCommitments,
  FinancePrizeIncome,
  FinanceSeasonHistoryPoint,
  FinanceSponsorIncome,
  FinanceTransferBalance,
  FinancesViewModel,
  TeamFinancesState,
} from "@/lib/foundation/finances/finances-types";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";

/** Gleiche Rundung wie Cash-Werte im Kredit-/Sponsor-Service (1 Nachkommastelle). */

type FacilitySeasonEndCash = {
  income: FinanceFacilityIncome | null;
  /** Nur die tatsächlich BEZAHLTEN Upkeep-Zeilen (Season-End-Settlement-Semantik). */
  paidUpkeep: { total: number; facilities: FinanceFacilityUpkeepRow[] };
};

/**
 * DER NACHBAU IST WEG. Hier stand bis zum Finanz-Audit (11.08.2026) eine zweite, wortgleiche Kopie
 * der Gebäude-Season-End-Rechnung — im Dateikopf selbst als „bewusster Nachbau" ausgewiesen und
 * damit ein bekannter Fall von zwei Rechenstellen für dieselbe Zahl. Sie ist ersatzlos durch
 * `computeFacilitySeasonCash` (`lib/finance/season-end-guv.ts`) ersetzt, die dieselbe GuV ohnehin
 * schon für die Liga rechnet und client-safe ist. Diese Hülle formt nur noch das Ergebnis in die
 * Anzeige-Typen um.
 */
function computeFacilitySeasonEndCash(gameState: GameState, teamId: string, cashBefore: number | null): FacilitySeasonEndCash {
  const cash = computeFacilitySeasonCash(gameState, teamId, cashBefore);
  return {
    income: cash.income > 0 ? { total: cash.income, facilities: cash.incomeRows } : null,
    paidUpkeep: { total: cash.paidUpkeep, facilities: cash.upkeepRows },
  };
}

/**
 * Anzeige-Reihenfolge der Sponsor-Vertragskomponenten (mirrors `SPONSOR_STACK_SEGMENTS` in
 * FoundationSponsorsNewLook). Kommt aus `finances-types.ts`, damit die Liga-Vergleichstabelle
 * exakt dieselbe Komponenten-Auswahl summiert (kein Auseinanderdriften auf demselben Screen).
 */
const SPONSOR_COMPONENT_KIND_ORDER: SponsorOfferComponentKind[] = FINANCE_SPONSOR_INCOME_COMPONENT_KINDS;

/** Wie viele vergangene (archivierte) Saisons der GuV-/Cash-Verlauf zusätzlich zur laufenden Saison zeigt (T-107). */
const HISTORY_PAST_SEASONS = 4;

/**
 * Builds the Finanzen view model for one human team's current-season
 * income/expense breakdown. Client-safe (no fs/better-sqlite3 imports) —
 * reuses the same read-only services the Kredite/Sponsoren/Preisgeld views
 * already derive from (see `docs/design/kredit-system.md` for the
 * sponsor/salary/upkeep helpers).
 *
 * Fog of war: this must only ever be called with the ACTIVE MANAGER's own
 * team id (`activeManagerTeamId`), same as `buildCreditsViewModel`. Never
 * pass another team's id in here.
 */
export function buildFinancesViewModel(gameState: GameState, teamId: string | null): FinancesViewModel {
  if (!teamId) {
    return { status: "not_ready" };
  }

  const team = gameState.teams.find((candidate) => candidate.teamId === teamId);
  if (!team) {
    return { status: "not_ready" };
  }

  // --- Sponsor (Vertrag) ------------------------------------------------
  // T-030: `total` und die `components`-Aufschlüsselung müssen aus derselben
  // Quelle stammen, sonst laufen Summe und Aufschlüsselung sichtbar
  // auseinander (wirkt wie ein UI-Rechenfehler).
  //
  // FINANZ-AUDIT 11.08.2026: `total` kommt jetzt aus `getSeasonSponsorCashByTeam` — DERSELBEN
  // Funktion, die auch der GuV-Resolver, die Saisonstand-Route und die Liga-Tabelle lesen. Sie
  // trägt gebuchte Logs UND den projizierten Rest. Vorher stand hier nur die Vorschau: sobald die
  // Abrechnung gebucht war, lieferte sie für dieses Team nichts mehr, `sponsorComponentsTotal` fiel
  // auf 0 und der Reiter zeigte statt der echten Einnahme den `estimateTeamAnnualRevenue`-Proxy —
  // am Messkörper (`new-game-1785823388048-1hf25q`, Saison 2 abgerechnet) wich die GuV dieses
  // Reiters dadurch je Team um 46 bis 96 C von der Saisonstand-GuV ab.
  const sponsorContract = getTeamSponsorContract(gameState, teamId);
  // WICHTIG: `component.rewardCash` ist laut `sponsor-offer-service` nur die
  // OBERGRENZE des Vertragsbausteins ("Cap für Anzeige"), nicht der zu erwartende
  // Betrag. Die tatsächlich cash-wirksame Auszahlung hängt am aktuellen Rang bzw.
  // an erfüllten Zielen und wird von `previewSponsorSettlement` genauso berechnet
  // wie im echten Season-End-Settlement (identische Quelle wie die Prize-v2-Ansicht).
  // Vorher summierte diese Ansicht die Caps und zeigte dadurch ein deutlich zu
  // hohes Sponsor-Einkommen (und damit eine zu hohe GuV) an.
  let sponsorSettlementRows: SponsorSettlementRow[] = [];
  try {
    sponsorSettlementRows = previewSponsorSettlement(gameState).rows.filter((row) => row.teamId === teamId);
  } catch {
    // Sponsor-Vorschau ist optional — fehlt sie, greift unten der Estimate-Fallback.
    sponsorSettlementRows = [];
  }
  // SPONSORSYSTEM V3: die Aufschluesselung kommt ZEILENWEISE aus dem Settlement statt ueber `kind`
  // gruppiert. Die Settlement-Zeilen sind Teleskop-Differenzen der eingefrorenen Leiter; gruppiert
  // man sie nach `kind` und summiert die Belohnungsbetraege der Komponenten, entstehen Betraege, die
  // es so nicht gibt. Die SUMME waere zwar dieselbe (Invariante Anzeige == Settlement gewahrt), die
  // Aufschluesselung aber gelogen.
  const isV3Contract = getSponsorV3Terms(sponsorContract) != null;
  const projizierteKomponenten = !sponsorContract
    ? []
    : isV3Contract
      ? sponsorSettlementRows
          // Auch NEGATIVE Zeilen gehoeren dazu: eine verfehlte Achse traegt −G/2 und die
          // Vorschuss-Verrechnung ist immer negativ. Wegzulassen hiesse, dem Team eine Einnahme
          // auszuweisen, die es nie bekommt.
          .filter((row) => Number.isFinite(row.cashDelta) && row.cashDelta !== 0)
          .map((row) => ({ kind: row.kind, label: row.label, rewardCash: round1(row.cashDelta) }))
      : SPONSOR_COMPONENT_KIND_ORDER.flatMap((kind) => {
          const rewardCash = sponsorSettlementRows
            .filter((row) => row.kind === kind)
            .reduce((sum, row) => sum + row.cashDelta, 0);
          if (!Number.isFinite(rewardCash) || rewardCash <= 0) return [];
          return [{ kind, label: getSponsorComponentKindLabel(kind), rewardCash: round1(rewardCash) }];
        });
  // BEREITS GEBUCHTE ZEILEN GEHOEREN IN DIE AUFSCHLUESSELUNG. Nach dem Saisonende-Apply liefert die
  // Vorschau für dieses Team nichts mehr; ohne diesen Block stünde eine Summe über einer leeren
  // Liste. Die Komponenten-Art steckt in der Log-ID (`<offerId>:v3:<kind>`), der Gehaltsabzug und
  // der Gehaltsfaktor-Ausgleich sind ausgenommen — sie sind Ausgaben, keine Sponsoreinnahme.
  const gebuchteKomponenten = (gameState.seasonState.sponsorPayoutLogs ?? [])
    .filter(
      (log) =>
        log.seasonId === gameState.season.id &&
        log.teamId === teamId &&
        log.componentId !== "salary_deduct" &&
        log.componentId !== "salary_factor_repair" &&
        Number.isFinite(log.cashDelta) &&
        log.cashDelta !== 0,
    )
    .map((log) => {
      const componentId = log.componentId ?? "";
      const kind = (SPONSOR_COMPONENT_KIND_ORDER.find((entry) => componentId.endsWith(`:${entry}`)) ??
        "base") as SponsorOfferComponentKind;
      return {
        kind,
        label: `${getSponsorComponentKindLabel(kind)} (bereits gebucht)`,
        rewardCash: round1(log.cashDelta),
      };
    });
  const sponsorComponents = [...gebuchteKomponenten, ...projizierteKomponenten];
  // DIE EINE Sponsor-Einnahme dieser Saison — dieselbe Zahl wie im Saisonstand und in der GuV.
  const sponsorTotal = round1(getSeasonSponsorCashByTeam(gameState).get(teamId) ?? 0);
  // Der Schätz-Proxy greift NUR noch, wenn es überhaupt keine Sponsor-Buchung und keinen Vertrag
  // gibt. Vorher übernahm er auch dann, wenn die echte Abrechnung 0 oder negativ ausfiel — dann
  // stand eine Schätzung in der GuV, wo eine gemessene Null hingehört (und die Cash-Zusage des
  // Reiters, `cashSeasonStart + guv + otherCashMovements == cash`, brach genau daran).
  const kenntSponsorBuchung = sponsorComponents.length > 0;
  const estimatedSponsorRevenue = kenntSponsorBuchung ? 0 : estimateTeamAnnualRevenue(gameState, teamId);
  const sponsorTotalIsEstimate = !kenntSponsorBuchung && estimatedSponsorRevenue > 0;
  const sponsorAnzeigeTotal = kenntSponsorBuchung ? sponsorTotal : estimatedSponsorRevenue;
  const sponsor: FinanceSponsorIncome | null =
    kenntSponsorBuchung || sponsorAnzeigeTotal > 0
      ? { total: round1(sponsorAnzeigeTotal), components: sponsorComponents, totalIsEstimate: sponsorTotalIsEstimate }
      : null;

  // --- Preisgeld (Liga-Pool) ---------------------------------------------
  // Gleiche Herleitung wie die Preisgeld-/Saisonstand-Views (`buildTeamPrizeSummary`
  // über `buildTeamSeasonOverviewRows`, season-scoped by default). Feldnamen im
  // Overview-Row sind historisch "sponsor*" benannt, meinen hier aber das
  // Preisgeld (Rang-Basis + Saison-Anteil + Platzierungsbonus), NICHT den
  // Sponsor-Vertrag oben.
  const overviewRow = buildTeamSeasonOverviewRows({ gameState }).find((row) => row.teamId === teamId) ?? null;
  const prizeTotal = overviewRow?.sponsorTotal;
  const prize: FinancePrizeIncome | null =
    prizeTotal != null && Number.isFinite(prizeTotal)
      ? {
          total: round1(prizeTotal),
          basis: round1(overviewRow?.sponsorBasis ?? 0),
          seasonShare: round1(overviewRow?.sponsorSeason ?? 0),
          placementBonus: round1(overviewRow?.sponsorRank ?? 0),
        }
      : null;

  // --- Transfer-Saldo (laufende Saison) -----------------------------------
  // Direkt aus `transferHistory` statt `collectSeasonTransferPipelineGuv`
  // (das ist eine LIGA-weite Season-Summe, kein Team-Split) oder
  // `TeamManagementSnapshotRow.transferNet` (das ist ALL-TIME, nicht
  // season-scoped) — mirrors `buildTransferFinanceAudit`'s
  // sell-netCashImpact-first-Regel.
  const seasonTransfers = gameState.transferHistory.filter((entry) => entry.seasonId === gameState.season.id);
  const buys = seasonTransfers.filter((entry) => entry.transferType === "buy" && entry.toTeamId === teamId);
  const sells = seasonTransfers.filter((entry) => entry.transferType === "sell" && entry.fromTeamId === teamId);
  const buyTotal = round1(buys.reduce((sum, entry) => sum + (entry.fee ?? 0), 0));
  const sellTotal = round1(sells.reduce((sum, entry) => sum + (entry.netCashImpact ?? entry.fee ?? 0), 0));
  const transfer: FinanceTransferBalance | null =
    buys.length > 0 || sells.length > 0
      ? { net: round1(sellTotal - buyTotal), buyTotal, sellTotal, buyCount: buys.length, sellCount: sells.length }
      : null;
  const transferSurplus = transfer != null && transfer.net > 0 ? round1(transfer.net) : null;
  const transferDeficit = transfer != null && transfer.net < 0 ? round1(-transfer.net) : null;

  // --- Gehälter (Kader) ---------------------------------------------------
  // T-108 (c): Quelle ist `contract.salary` — EXAKT das Feld, das die echte Season-End-Resolution
  // abbucht (`sponsor-settlement-service.ts`: `resolvePlayerEconomyContract(...).salary ?? 0`).
  // NICHT `contract.expectedSalary` (ein abweichender Erwartungswert), sonst laufen angezeigte
  // Gehaltsausgabe und tatsächliche Cash-Belastung auseinander und die GuV stimmt nicht mit dem
  // realen Cash-Delta überein.
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const salaryRows = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => {
      const player = playerById.get(entry.playerId) ?? null;
      const contract = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      const salary = normalizeEconomyMoney(contract.salary) ?? 0;
      return { playerName: player?.name ?? "Unbekannter Spieler", salary: round1(salary) };
    })
    .filter((row) => row.salary > 0)
    .sort((left, right) => right.salary - left.salary);
  // F4: die Summe kommt aus dem geteilten Helper — dieselbe Funktion, die
  // auch der Kredite-Chart zeigt. Die Zeilen oben sind nur die Aufschlüsselung
  // derselben Verträge; ein Test hält fest, dass beide Wege gleich bleiben.
  const salaryTotal = getTeamActualSalaryTotal(gameState, teamId);

  // --- Gebäude: Einnahmen + BEZAHLTER Unterhalt (T-108 b) ------------------
  // Symmetrisch cash-wirksam: der Season-End-Service schreibt sowohl den Facility-INCOME gut als
  // auch NUR den tatsächlich bezahlten Upkeep ab. Vorher fehlte die Einnahmenseite komplett und
  // der Brutto-Upkeep stand asymmetrisch als Ausgabe. `computeFacilitySeasonEndCash` bildet beides
  // client-safe nach (siehe Helfer oben). `cashBefore = team.cash` — identisch zu
  // `previewFacilitySeasonEndFinance`, das ebenfalls den aktuellen Team-Cash als Ausgangswert nimmt.
  const facilityCash = computeFacilitySeasonEndCash(gameState, teamId, team.cash);
  const facilityIncome = facilityCash.income;
  const facilityRows = facilityCash.paidUpkeep.facilities;
  const facilityUpkeepTotal = facilityCash.paidUpkeep.total;

  // --- Kredite: Rate = Zins + Tilgung (EINE Zerlegung) ----------------------
  // Buchhaltungsmodell (siehe unten bei totalExpenses): NUR der Zinsanteil einer Kreditrate ist eine
  // GuV-Ausgabe. Der Tilgungsanteil (principal) ist eine reine Bilanzbewegung (Cash runter, Restschuld
  // runter, Eigenkapital unverändert) und darf NICHT als Ausgabe zählen — genau symmetrisch dazu, dass
  // die Kreditauszahlung KEINE Einnahme ist (beide laufen über `otherCashMovements`, nicht die GuV).
  // Die Zerlegung je Kredit kommt aus `computeTeamLoanShareRows` (season-end-guv.ts) — dieselbe
  // Liste speist die Kreditzins-Ausgabenzeile (Zinsanteil), die GuV-Posten UND die neue
  // Verpflichtungs-Übersicht (volle Rate + Tilgung). Keine zweite Formel für dieselbe Aufteilung.
  const loanShareRows = computeTeamLoanShareRows(gameState, teamId);
  const loanRows = loanShareRows.map((row) => ({
    lenderName: row.lenderName,
    // Die Ausgabenzeile trägt den ZINS, nicht die volle Rate (siehe Kommentar oben).
    installment: row.interest,
    outstanding: row.outstanding,
  }));
  const loanInterestTotal = getTeamAnnualLoanInterest(gameState, teamId);
  const loanPrincipalTotal = round1(loanShareRows.reduce((sum, row) => sum + row.principal, 0));
  const loanCommitments: FinanceLoanCommitments = {
    rows: loanShareRows,
    installmentTotal: round1(loanShareRows.reduce((sum, row) => sum + row.installment, 0)),
    interestTotal: loanInterestTotal,
    principalTotal: loanPrincipalTotal,
    outstandingTotal: round1(loanShareRows.reduce((sum, row) => sum + row.outstanding, 0)),
  };

  // --- Board-Objective-cashDelta (T-108 c) --------------------------------
  // Netto-cashDelta, den die Engine tatsächlich verbucht (Prämien completed − Strafen failed). Wir
  // ZEIGEN nur diesen Netto-Wert und duplizieren die Objective-Logik NICHT.
  //
  // Quelle ist `getObjectiveCashByTeam` — DIESELBE, die auch `resolveSeasonGuvForTeam` liest. Vorher
  // rief diese Stelle `buildTeamSeasonObjectiveSettlement` selbst auf: zwei Rechenstellen für
  // dieselbe Zahl, und beide rechneten für längst gebuchte Saisons neu gegen den inzwischen
  // veränderten Kontostand. Die F2-Parität (`buildFinancesViewModel.guv == resolveSeasonGuvForTeam`)
  // hängt daran, dass hier und dort dieselbe Quelle steht.
  const objectiveCash = getObjectiveCashByTeam(gameState);
  const objectiveCashDelta = round1(objectiveCash.byTeamId.get(teamId) ?? 0);
  const objectiveReward = objectiveCashDelta > 0 ? objectiveCashDelta : null;
  const objectivePenalty = objectiveCashDelta < 0 ? round1(-objectiveCashDelta) : null;

  // Preisgeld ist NIE cash-wirksam (Benchmark) → NICHT in totalIncome. Facility-Income und
  // Objective-Prämie sind es → dazu. Symmetrisch: bezahlter Upkeep + Objective-Strafe als Ausgabe.
  //
  // Buchhaltungsmodell (Kredite): Die GuV ist intern konsistent, indem WEDER die Kreditauszahlung als
  // Einnahme NOCH die Tilgung als Ausgabe zählt — beide sind Bilanzbewegungen und landen in
  // `otherCashMovements`. Als Kredit-Ausgabe geht deshalb NUR der Zinsanteil (`loanInterestTotal`) ein,
  // nicht die volle Rate. (Vorher: volle Rate als Ausgabe, Auszahlung ausgeschlossen → inkonsistent, die
  // Tilgung wurde doppelt bestraft.) Die Cash-Reconciliation `cashSeasonStart + guv + otherCashMovements
  // == cash` bleibt gültig: `otherCashMovements` ist eine reine Differenz und absorbiert den nun nicht
  // mehr in der GuV enthaltenen Tilgungs-Cashabfluss.
  // Transfer-Saldo ist ein Sonderposten (Einmal-Ereignis, v. a. der große Kader-Aufbau in S1), KEINE
  // laufende Betriebs-GuV — er wird separat als Transfer-Zeile (`transfer`) ausgewiesen und über
  // `otherCashMovements` cash-abgeglichen (analog zur Kredit-Tilgung, die ebenfalls eine reine
  // Bilanzbewegung ist). Vorher floss `transferDeficit`/`transferSurplus` in totalIncome/totalExpenses →
  // die GuV war in S1 durch den einmaligen Kaderkauf massiv verzerrt (z. B. -178 statt der laufenden
  // Betriebs-GuV) und lief der bewusst transferfreien Liga-Vergleichstabelle zuwider. Die Cash-
  // Reconciliation `cashSeasonStart + guv + otherCashMovements == cash` bleibt gültig: otherCashMovements
  // ist eine reine Differenz und absorbiert den nun nicht mehr in der GuV enthaltenen Transfer-Cashfluss.
  // --- Apron (GuV-Posten + Linien-Ausweisung) ------------------------------
  // Der Apron zählt mit. Chris: „Sponsoren + Gebäude + Apron sind doch die möglichen Einkünfte."
  // Er wird erst am Saisonende abgerechnet und hängt am ENDrang — die Zahl ist deshalb eine
  // Hochrechnung auf den aktuellen Rang, und der Hover sagt das auch.
  // NEU (Chris): „APRON 1 und 2 … separat noch mal ausweisen" — deshalb wird hier die GANZE
  // Projektion behalten (Linien, Einfrier-Status, Topf), nicht mehr nur das eigene Netto. EIN
  // `buildApronProjection`-Aufruf speist beides: die Apron-Zeile der GuV UND die Linien-Karte.
  const apronProjection = (() => {
    try {
      const rankByTeamId = new Map<string, number | null>(
        gameState.teams.map((entry) => [entry.teamId, gameState.seasonState.standings?.[entry.teamId]?.rank ?? null] as const),
      );
      return buildApronProjection({ gameState, rankByTeamId });
    } catch {
      return null;
    }
  })();
  const apronNettoDelta = apronProjection?.byTeamId.get(teamId) ?? null;
  // Nur der GEBUCHTE Apron zaehlt in die GuV — sonst bricht die Zusage dieses Reiters
  // (`cashSeasonStart + guv + otherCashMovements == cash`) an einer Hochrechnung.
  const apronGebucht = (gameState.seasonState.apronSettlementLogs ?? []).some(
    (log) => log.seasonId === gameState.season.id && log.phase === "season_end",
  );
  // NEU (Chris): „in den finanzen fehlt mir immernoch ein ausweis vom APRON was die teams dadurch
  // zahlen müssen oder einnehmen" — die Karte nannte 28 Zahler / 3 Empfänger nur als Aggregat.
  // Hier werden DIESELBEN Projektionszeilen benannt statt neu gerechnet: jede Zahl ist das
  // round1 der `byTeamId`-Zeile, `distanceLine1` dieselbe Anzeige-Subtraktion wie oben beim
  // eigenen Team. Sortierung erzählt die Richtung: größter Zahler zuerst, dann Neutrale, dann
  // Empfänger. Die Rolle „Empfänger" kommt als Engine-Flag mit (streng unter der 1. Linie),
  // damit sie auch bei leerem Topf benannt bleibt (bei 0 wird erklärt, nicht versteckt).
  const teamIdentityById = new Map(
    gameState.teams.map((entry) => [entry.teamId, { name: entry.name, code: entry.shortCode }] as const),
  );
  const APRON_ROLLE_ORDER: Record<FinanceApronLeagueRow["rolle"], number> = { zahler: 0, neutral: 1, empfaenger: 2 };
  const apronLeague: FinanceApronLeagueRow[] = apronProjection
    ? [...apronProjection.byTeamId.values()]
        .map((row): FinanceApronLeagueRow => {
          const identity = teamIdentityById.get(row.teamId);
          return {
            teamId: row.teamId,
            teamName: identity?.name ?? row.teamId,
            teamCode: identity?.code ?? row.teamId,
            rank: row.rank,
            salaryBasis: round1(row.salary),
            distanceLine1: round1(row.salary - apronProjection.lines.line1),
            abgabe: round1(row.abgabe),
            ausgleich: round1(row.ausgleich),
            nettoDelta: round1(row.nettoDelta),
            gedeckelt: row.gedeckelt,
            // `abgabe > 0` ist exakt die Zahler-Definition der Engine (`zahlerCount`); Empfänger
            // ist das durchgereichte Engine-Flag — beide Rollen ohne zweite Linienrechnung.
            rolle: row.abgabe > 0 ? "zahler" : row.empfaenger ? "empfaenger" : "neutral",
          };
        })
        .sort(
          (left, right) =>
            APRON_ROLLE_ORDER[left.rolle] - APRON_ROLLE_ORDER[right.rolle] ||
            // Zahler: größte Abgabe zuerst · Empfänger teilen den Topf zu gleichen Kopfteilen
            // (Ausgleich identisch) · Rest: höchste Bemessung zuerst.
            right.abgabe - left.abgabe ||
            right.ausgleich - left.ausgleich ||
            right.salaryBasis - left.salaryBasis,
        )
    : [];

  const apron: FinanceApronStatus | null =
    apronProjection && apronNettoDelta
      ? {
          medianSalary: round1(apronProjection.lines.medianSalary),
          line1: round1(apronProjection.lines.line1),
          line2: round1(apronProjection.lines.line2),
          salaryBasis: round1(apronNettoDelta.salary),
          // Reine Anzeige-Subtraktionen auf den Projektionswerten — keine zweite Rechnung.
          distanceLine1: round1(apronNettoDelta.salary - apronProjection.lines.line1),
          distanceLine2: round1(apronNettoDelta.salary - apronProjection.lines.line2),
          zone:
            apronNettoDelta.salary <= apronProjection.lines.line1
              ? "unter_linie_1"
              : apronNettoDelta.salary <= apronProjection.lines.line2
                ? "zwischen_den_linien"
                : "ueber_linie_2",
          abgabe: round1(apronNettoDelta.abgabe),
          ausgleich: round1(apronNettoDelta.ausgleich),
          nettoDelta: round1(apronNettoDelta.nettoDelta),
          gedeckelt: apronNettoDelta.gedeckelt,
          rank: apronNettoDelta.rank,
          gebucht: apronGebucht,
          frozenLines: apronProjection.frozenLines,
          usedReferenceSalary: apronProjection.lines.usedReferenceSalary,
          topf: round1(apronProjection.topf),
          zahlerCount: apronProjection.zahlerCount,
          empfaengerCount: apronProjection.empfaengerCount,
          league: apronLeague,
          // Nur Teams, die WIRKLICH zahlen: die Fußnote formuliert „N Zahler sind durch
          // den Deckel begrenzt" — ein gedeckeltes Team, dessen Abgabe der Deckel auf
          // 0,0 drückt, wird in der Tabelle als „neutral" geführt und darf hier nicht
          // als Zahler mitgezählt werden (vorher: 18 statt 17).
          gedeckeltCount: apronLeague.filter((row) => row.gedeckelt && row.rolle === "zahler").length,
        }
      : null;

  // DIE EINE GuV (`lib/finance/season-end-guv.ts`) — dieselbe Funktion, die auch der Saisonstand und
  // die Buchung benutzen. Vorher stand hier eine eigene Summenbildung; sie kannte den Apron nicht und
  // wich dadurch von der Zahl im Saisonstand ab. Genau das war die Meldung.
  const seasonGuv = buildSeasonGuv({
    teamId,
    sponsorCash: sponsor?.total ?? 0,
    facilityIncome: facilityIncome?.total ?? 0,
    facilityUpkeep: facilityUpkeepTotal,
    apronNetto: apronNettoDelta?.nettoDelta ?? 0,
    apronRank: apronNettoDelta?.rank ?? null,
    apronGedeckelt: apronNettoDelta?.gedeckelt ?? false,
    apronFrozenLines: apronProjection?.frozenLines ?? true,
    apronGebucht,
    objectiveCashDelta,
    boardzieleGebucht: objectiveCash.gebucht && objectiveCash.quelle === "beleg",
    salaryTotal,
    loanInterest: loanInterestTotal,
    loanPrincipal: loanPrincipalTotal,
    transferNet: null,
  });
  const totalIncome = seasonGuv.einnahmen;
  const totalExpenses = seasonGuv.ausgaben;
  const guv = seasonGuv.guv;

  // --- Saison-Verlauf + Cash-Abgleich (T-107, T-031) -----------------------
  // Echte archivierte Season-End-Werte aus `gameState.seasonState.seasonSnapshots`
  // (`SeasonSnapshotTeamRecord.guv`/`.cashTotal`/`.cashEnd`) — KEIN Forecast wie
  // der 5-Saisons-Ausblick in prize-v2, reine Historie, keine neue Persistenz.
  // Cash trägt sich unverändert über den Saisonwechsel fort (siehe
  // `preseason-workflow-service.ts`, kein Cash-Reset), daher ist das Cash-Ende
  // der unmittelbar vorangegangenen Saison zugleich der Season-Start-Wert
  // dieser Saison.
  const pastSeasonPoints: FinanceSeasonHistoryPoint[] = (gameState.seasonState.seasonSnapshots ?? [])
    .map((snapshot): FinanceSeasonHistoryPoint | null => {
      const row = snapshot.finalStandings.find((entry) => entry.teamId === teamId) ?? null;
      if (!row) return null;
      // T-108 (d): reales fortgeschriebenes Cash-Ende BEVORZUGEN (`cashEnd`), NICHT das
      // benchmark-`cashTotal` (= projiziertes `projectedCash` aus `writeLocalCashPrizeApply`,
      // kein reales Cash). Der archivierte `guv` wurde mit der alten prize-als-Einnahme-Formel
      // gebildet und ist nicht mit der korrigierten GuV vergleichbar → bewusst `null`, damit die
      // Sparkline ehrlich in den Empty-State degradiert statt Phantomwerte zu zeigen.
      //
      // `cashEntry` GEHT VOR: Chris' Vorgabe „die snapshots für Cash und Marktwert sollen ja auch
      // erst am anfang der Saison nach den Käufen stattfinden für die ewige Tabelle / Finanzen."
      // Das ist derselbe Zeitpunkt, den die Sparkline ohnehin meint (Cash-Ende von Saison N =
      // Start von N+1) — nur eben NACH Kaeufen, Fuellung und Krediten statt davor. Fehlt das Feld
      // (Altsaves, oder die Folgesaison hat ihr Kauffenster noch vor sich), kommt `cashCarryOver`:
      // der Kontostand an der Saisongrenze, nach der Vertragsalterung und vor den Kaeufen. Genau
      // dieser Rueckfall war die Ursache dafuer, dass `cashSeasonStart` (und damit
      // `otherCashMovements` weiter unten) daneben lag — `cashEnd` liegt VOR den auslaufenden
      // Vertraegen und ist damit nicht das Geld, mit dem die Saison begann.
      // Der Abgleich in `getSnapshotCashByTeam` verankert auf derselben Groesse.
      const cash = row.cashEntry ?? row.cashCarryOver ?? row.cashEnd ?? row.cashTotal ?? null;
      return {
        seasonId: snapshot.seasonId,
        seasonName: snapshot.seasonName,
        isCurrent: false,
        guv: null,
        cash: cash != null && Number.isFinite(cash) ? round1(cash) : null,
      };
    })
    .filter((point): point is FinanceSeasonHistoryPoint => point != null)
    .sort((left, right) => left.seasonId.localeCompare(right.seasonId, "de", { numeric: true }))
    .slice(-HISTORY_PAST_SEASONS);

  const cashSeasonStart = pastSeasonPoints.at(-1)?.cash ?? null;
  const otherCashMovements = cashSeasonStart != null ? round1(team.cash - cashSeasonStart - guv) : null;

  const history: FinanceSeasonHistoryPoint[] = [
    ...pastSeasonPoints,
    { seasonId: gameState.season.id, seasonName: gameState.season.name, isCurrent: true, guv, cash: team.cash },
  ];

  const teamFinances: TeamFinancesState = {
    teamId,
    cash: team.cash,
    income: { sponsor, facilityIncome, transferSurplus, objectiveReward, prizeBenchmark: prize },
    expenses: {
      salaries: { total: salaryTotal, players: salaryRows },
      facilityUpkeep: { total: facilityUpkeepTotal, facilities: facilityRows },
      // `total`/Zeilen = Kredit-ZINS der Saison (GuV-Ausgabe), NICHT die volle Rate — der Tilgungsanteil
      // ist eine Bilanzbewegung, keine Ausgabe (siehe Kommentar bei totalExpenses).
      loanInstallments: { total: loanInterestTotal, loans: loanRows },
      transferDeficit,
      objectivePenalty,
    },
    transfer,
    totalIncome,
    totalExpenses,
    guv,
    guvPosten: seasonGuv.posten,
    cashSeasonStart,
    otherCashMovements,
    history,
    apron,
    loanCommitments,
    // Kompakter Initial-Payload strippt das Archiv auf `undefined`; der Archiv-Load der
    // Finanzen-View (use-foundation-shell-router-body-scope) holt es nach. Solange zeigt die UI
    // „wird geladen" statt der falschen Behauptung „nicht archiviert".
    archivePending: gameState.seasonState.seasonSnapshots === undefined,
  };

  return { status: "ready", team: teamFinances };
}

/**
 * React hook wrapper around `buildFinancesViewModel`. Hosts should prefer
 * this over calling the builder directly so the model is memoized per
 * render the same way `useCreditsViewModel` is.
 */
export function useFinancesViewModel(gameState: GameState, teamId: string | null): FinancesViewModel {
  return useMemo(() => buildFinancesViewModel(gameState, teamId), [gameState, teamId]);
}

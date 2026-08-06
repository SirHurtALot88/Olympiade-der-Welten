/**
 * DIE EINE GuV — eine Rechnung, die überall dieselbe Zahl ausweist.
 *
 * GEMELDET VON CHRIS: „ich will auch endlich dass überall die GuV das gleiche ausweist und nicht hier
 * was anderes steht als im Sponsor-Tab oder dem Finanzen-Tab." Dazu: „Preisgeld gibts doch gar nicht
 * mehr? das ist doch durch Sponsoren ersetzt + Gebäude + Apron sind doch die möglichen Einkünfte?"
 * Und: „bitte aber alles was berechnet wird dann auch in das Hover rein bringen damit man es sieht
 * SELBST WENN ES 0 IST."
 *
 * VORGESCHICHTE. Ein Audit über den Spielstand fand neun verschiedene GuV-Formeln nebeneinander. Die
 * folgenreichste saß in `team-management-overview.ts`: dort gewann `prizeSummary?.profitLoss` — die
 * abgeschaffte PREISGELD-Kurve (`prize-money.ts`, `CASH_PRIZE_BENCHMARK_ONLY = true`, wird nie
 * ausgezahlt) — gegen den echten, gebuchten Wert. Sie kennt weder Gebäude noch Apron noch Kredite
 * noch Vorstandsziele. Deshalb wies die Tabelle dicke Gewinne aus, während Teams mit negativem Cash
 * aus der Saison gingen. Genau dieser Widerspruch war die Meldung.
 *
 * DIE ENTSCHEIDUNG. Es gibt ab hier EINE Definition, und zwar die breite (die des Finanzen-Reiters,
 * plus Apron). Die frühere Entscheidung „zwei Definitionen bleiben und werden erklärt" ist damit
 * überholt — Chris hat sie ausdrücklich aufgehoben.
 *
 *   GuV = Sponsor + Gebäude-Einnahme + Apron + Vorstandsziele
 *         − Gehälter − Gebäude-Unterhalt − Kreditzins
 *
 * WAS BEWUSST NICHT ZÄHLT — und trotzdem im Hover steht:
 *  - TRANSFERS. Einmal-Ereignis (in S1 der komplette Kaderaufbau), keine laufende Betriebs-GuV. Sie
 *    stehen im Saisonstand ohnehin in einer eigenen Spalte.
 *  - KREDIT-TILGUNG. Reine Bilanzbewegung: Cash runter, Restschuld runter, Eigenkapital unverändert.
 *    Symmetrisch dazu ist die Kreditauszahlung keine Einnahme. Als Ausgabe zählt nur der ZINS.
 * Beide sind cash-wirksam und werden deshalb ausgewiesen — nur eben als Abgrenzung, nicht als Posten.
 *
 * JEDER POSTEN IST IMMER DA, AUCH BEI 0. Das ist keine Kosmetik: „Kreditrate 0" beantwortet die
 * Frage, ob Kredite in der Zahl stecken; eine fehlende Zeile lässt sie offen. Genau das hat Chris
 * verlangt („selbst wenn es 0 ist").
 *
 * Diese Datei ist React-frei und client-safe (kein node:crypto, kein better-sqlite3), damit Route,
 * Buchung und beide Oberflächen wirklich dieselbe Rechnung lesen können.
 */

import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import { getTeamAnnualLoanInterest } from "@/lib/finance/loan-service";
import { FACILITY_CATALOG, getFacilityLevelDefinition } from "@/lib/facilities/facility-catalog";
import {
  calculateFacilitySeasonUpkeep,
  getFacilityEfficiency,
  getFacilityLevel,
  getTeamFacilityState,
} from "@/lib/facilities/facility-effects";
import type { GameState } from "@/lib/data/olyDataTypes";

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function num(value: number | null | undefined): number {
  return isNumber(value) ? value : 0;
}

/**
 * Ausgabenseite: als negativer Betrag, aber NIE als `-0`. Ohne das `+ 0` liefert `-Math.abs(0)` ein
 * negatives Null, und der Hover schriebe „Kreditzins: -0" — bei genau dem Posten, den Chris sehen
 * wollte, WEIL er 0 ist.
 */
function ausgabe(value: number | null | undefined): number {
  return round2(-Math.abs(num(value))) + 0;
}

/** Die Posten der GuV, in Anzeigereihenfolge. Reihenfolge = Reihenfolge im Hover. */
export const SEASON_GUV_POSTEN_KEYS = [
  "sponsor",
  "gebaeude_einnahme",
  "apron",
  "boardziele",
  "gehaelter",
  "gebaeude_unterhalt",
  "kreditzins",
  "kredittilgung",
  "transfers",
] as const;

export type SeasonGuvPostenKey = (typeof SEASON_GUV_POSTEN_KEYS)[number];

export type SeasonGuvPosten = {
  key: SeasonGuvPostenKey;
  label: string;
  /** Vorzeichenechter Betrag: Ausgaben sind negativ. */
  amount: number;
  /** `true` = zählt in die GuV, `false` = steht als Abgrenzung daneben (cash-wirksam, aber keine GuV). */
  counted: boolean;
  /** Zusatz, der die Zeile einordnet — z. B. der Rang, auf den hochgerechnet wurde. */
  note?: string | null;
};

export type SeasonGuv = {
  teamId: string;
  posten: SeasonGuvPosten[];
  /** Summe der positiven gezählten Posten. */
  einnahmen: number;
  /** Summe der negativen gezählten Posten, als positive Zahl. */
  ausgaben: number;
  /** einnahmen − ausgaben. Das ist DIE Zahl. */
  guv: number;
};

/**
 * Die Rohgrößen, aus denen die GuV entsteht. Jede ist optional: wer sie nicht kennt, übergibt sie
 * nicht, und der Posten steht mit 0 da — sichtbar, aber ohne Wirkung. Das ist genau der Fall
 * „Kreditraten gab es noch keine".
 */
export type SeasonGuvParts = {
  teamId: string;
  /** Sponsor-Abrechnung beim AKTUELLEN Rang (Summe der vorzeichenechten Settlement-Deltas). */
  sponsorCash?: number | null;
  /** Gebäude-Einnahme brutto (vor Unterhalt). */
  facilityIncome?: number | null;
  /** Tatsächlich bezahlter Gebäude-Unterhalt (Season-End-Semantik), als positive Zahl. */
  facilityUpkeep?: number | null;
  /** Apron-Netto beim aktuellen Rang hochgerechnet: `ausgleich − abgabe`. Negativ = Abgabe. */
  apronNetto?: number | null;
  /** Rang, auf den der Apron hochgerechnet wurde — nur für die Hover-Zeile. */
  apronRank?: number | null;
  /** `false` = die Apron-Linien sind für diese Saison noch nicht eingefroren, die Grenze kann sich verschieben. */
  apronFrozenLines?: boolean;
  /** `true` = der Deckel (halber Wertungsanteil) hat die Abgabe begrenzt. */
  apronGedeckelt?: boolean;
  /**
   * `true` = die Apron-Abrechnung dieser Saison ist BEREITS GEBUCHT (`apronSettlementLogs` trägt
   * einen `season_end`-Eintrag). Nur dann zählt der Apron in die GuV.
   *
   * WARUM DIESE UNTERSCHEIDUNG NÖTIG IST — ich hatte den Apron zuerst bedingungslos mitgezählt, weil
   * er eine der drei Einnahmequellen ist. Das war falsch, und zwei Invarianten-Tests haben es
   * gefangen: der Finanzen-Reiter verspricht `Σ(Einnahmen) − Σ(Ausgaben) == GuV == echte
   * Cash-Veränderung der Saison`, und die Geldfluss-Invariante verlangt `cashVorher + Σ Buchungen ==
   * cashNachher`. Eine HOCHRECHNUNG in der GuV bricht beide: das Geld ist noch nicht geflossen
   * (gemessen: 11,3 bzw. 3,0 Differenz).
   *
   * Beides zusammen geht: vor der Buchung steht der Apron als Hochrechnung DANEBEN (sichtbar, aber
   * nicht gezählt), nach der Buchung zählt er wie jede andere Einnahme. Die Zeile ist in beiden
   * Fällen da — nur ihr Status ändert sich mit der Realität.
   */
  apronGebucht?: boolean;
  /** Netto-Cash aus Vorstandszielen (Prämien − Strafen). */
  objectiveCashDelta?: number | null;
  /** Gehaltssumme der Saison, als positive Zahl. */
  salaryTotal?: number | null;
  /** Kreditzins der Saison (NUR Zins, nicht die Rate), als positive Zahl. */
  loanInterest?: number | null;
  /** Kredit-Tilgung der Saison, als positive Zahl. Abgrenzung, zählt nicht. */
  loanPrincipal?: number | null;
  /** Transfer-Saldo. Abgrenzung, zählt nicht. */
  transferNet?: number | null;
};

const POSTEN_LABEL: Record<SeasonGuvPostenKey, string> = {
  sponsor: "Sponsor",
  gebaeude_einnahme: "Gebäude-Einnahme",
  apron: "Apron",
  boardziele: "Vorstandsziele",
  gehaelter: "Gehälter",
  gebaeude_unterhalt: "Gebäude-Unterhalt",
  kreditzins: "Kreditzins",
  kredittilgung: "Kredit-Tilgung",
  transfers: "Transfers",
};

/**
 * Baut die GuV aus ihren Rohgrößen. Rein, ohne GameState — dadurch ist die Rechnung selbst ohne
 * Spielstand prüfbar, und jede Ansicht kann ihre bereits vorhandenen Zahlen hineinreichen, statt sie
 * neu zu beschaffen.
 */
export function buildSeasonGuv(parts: SeasonGuvParts): SeasonGuv {
  const apronNetto = round2(num(parts.apronNetto));
  const objective = round2(num(parts.objectiveCashDelta));
  const posten: SeasonGuvPosten[] = [
    { key: "sponsor", label: POSTEN_LABEL.sponsor, amount: round2(num(parts.sponsorCash)), counted: true, note: "beim aktuellen Rang" },
    { key: "gebaeude_einnahme", label: POSTEN_LABEL.gebaeude_einnahme, amount: round2(num(parts.facilityIncome)), counted: true },
    {
      key: "apron",
      label: POSTEN_LABEL.apron,
      amount: apronNetto,
      counted: parts.apronGebucht === true,
      // Der Apron wird erst am Saisonende abgerechnet, und Deckel wie Ausschüttung hängen am ENDrang.
      // Die Zeile sagt deshalb, worauf sie sich stützt — sonst läse sie sich wie ein gebuchter Posten.
      note: [
        parts.apronGebucht === true
          ? "gebucht"
          : parts.apronRank != null
            ? `Hochrechnung auf Platz ${parts.apronRank}, noch nicht gebucht`
            : "Hochrechnung, noch nicht gebucht",
        parts.apronGedeckelt ? "durch den Deckel begrenzt" : null,
        parts.apronGebucht !== true && parts.apronFrozenLines === false ? "Linien noch nicht eingefroren" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    { key: "boardziele", label: POSTEN_LABEL.boardziele, amount: objective, counted: true },
    { key: "gehaelter", label: POSTEN_LABEL.gehaelter, amount: ausgabe(parts.salaryTotal), counted: true },
    {
      key: "gebaeude_unterhalt",
      label: POSTEN_LABEL.gebaeude_unterhalt,
      amount: ausgabe(parts.facilityUpkeep),
      counted: true,
    },
    { key: "kreditzins", label: POSTEN_LABEL.kreditzins, amount: ausgabe(parts.loanInterest), counted: true },
    // Ab hier: cash-wirksam, aber KEINE GuV. Siehe Dateikopf.
    {
      key: "kredittilgung",
      label: POSTEN_LABEL.kredittilgung,
      amount: ausgabe(parts.loanPrincipal),
      counted: false,
      note: "Bilanzbewegung, nicht in der GuV",
    },
    {
      key: "transfers",
      label: POSTEN_LABEL.transfers,
      amount: round2(num(parts.transferNet)),
      counted: false,
      note: "eigene Spalte, nicht in der GuV",
    },
  ];

  const counted = posten.filter((entry) => entry.counted);
  const einnahmen = round1(counted.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0));
  const ausgaben = round1(-counted.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0));
  const guv = round1(counted.reduce((sum, entry) => sum + entry.amount, 0));

  return { teamId: parts.teamId, posten, einnahmen, ausgaben, guv };
}

/**
 * Summiert eine bereits gebaute Postenliste wieder auf. Nötig, weil die Liste über den Feed durch
 * die Oberfläche wandert: dort liegen nur noch die Posten vor, nicht die Rohgrößen, und der Hover
 * soll die Summe nicht ein zweites Mal aus anderen Zahlen bilden.
 */
export function seasonGuvFromPosten(teamId: string, posten: SeasonGuvPosten[]): SeasonGuv {
  const counted = posten.filter((entry) => entry.counted);
  return {
    teamId,
    posten,
    einnahmen: round1(counted.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0)),
    ausgaben: round1(-counted.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0)),
    guv: round1(counted.reduce((sum, entry) => sum + entry.amount, 0)),
  };
}

// ── Beschaffung der Rohgrößen aus dem Spielstand ───────────────────────────────────────────────

export type FacilitySeasonCash = {
  /** Bruttoeinnahme aller Gebäude. */
  income: number;
  /** Nur der tatsächlich BEZAHLTE Unterhalt (Season-End-Semantik: reicht das Cash nicht, bleibt er liegen). */
  paidUpkeep: number;
  incomeRows: { label: string; income: number }[];
  upkeepRows: { label: string; upkeep: number }[];
};

/**
 * Client-safer Nachbau von `previewFacilitySeasonEndFinance` — bewusst OHNE dessen
 * node:crypto/better-sqlite3-Importe, die sonst ins Client-Bundle wanderten. Identische Reihenfolge
 * (FACILITY_CATALOG) und identische „bezahlt oder nicht"-Schwelle, damit die Anzeige bit-genau zu dem
 * passt, was am Saisonende wirklich gebucht wird.
 *
 * Vorher lebte diese Funktion privat im Finanzen-View-Model; sie steht jetzt hier, weil sie zur
 * gemeinsamen GuV gehört und nicht zu einer einzelnen Ansicht.
 */
export function computeFacilitySeasonCash(
  gameState: GameState,
  teamId: string,
  cashBefore: number | null,
): FacilitySeasonCash {
  const teamFacilities = getTeamFacilityState(gameState, teamId);
  const seasonId = gameState.season.id;
  const arenaPopularityFactor = computeTeamBeliebtheitFromGameState(gameState, teamId).value;

  const rows = FACILITY_CATALOG.map((facility) => {
    const effectLevel = getFacilityLevel(teamFacilities, facility.facilityId);
    const efficiencyPct = getFacilityEfficiency(teamFacilities, facility.facilityId).efficiencyPct;
    const definition = getFacilityLevelDefinition(facility.facilityId, effectLevel);
    const popularityFactor = facility.facilityId === "arena_upgrade" ? arenaPopularityFactor : 1;
    return {
      label: facility.label,
      income: round2(((definition?.seasonIncome ?? 0) * efficiencyPct * popularityFactor) / 100),
      upkeep: round2(calculateFacilitySeasonUpkeep(facility.facilityId, teamFacilities)),
      alreadyPaid: teamFacilities.facilities[facility.facilityId]?.lastPaidSeasonId === seasonId,
    };
  });

  const incomeTotalRaw = round2(rows.reduce((sum, row) => sum + row.income, 0));
  let cashAvailableForUpkeep = cashBefore == null ? null : round2(cashBefore + incomeTotalRaw);

  const upkeepRows: { label: string; upkeep: number }[] = [];
  let paidUpkeepTotalRaw = 0;
  for (const row of rows) {
    if (row.upkeep <= 0 || row.alreadyPaid) continue;
    if (cashAvailableForUpkeep != null && cashAvailableForUpkeep < row.upkeep) continue; // will_disable_unpaid
    if (cashAvailableForUpkeep != null) cashAvailableForUpkeep = round2(cashAvailableForUpkeep - row.upkeep);
    upkeepRows.push({ label: row.label, upkeep: round1(row.upkeep) });
    paidUpkeepTotalRaw += row.upkeep;
  }

  return {
    income: round1(incomeTotalRaw),
    paidUpkeep: round1(paidUpkeepTotalRaw),
    incomeRows: rows
      .filter((row) => row.income > 0)
      .map((row) => ({ label: row.label, income: round1(row.income) }))
      .sort((left, right) => right.income - left.income),
    upkeepRows: upkeepRows.sort((left, right) => right.upkeep - left.upkeep),
  };
}

/**
 * Zins- und Tilgungsanteil der laufenden Kredite eines Teams — getrennt, weil nur der Zins zählt.
 * Der Zins kommt aus `getTeamAnnualLoanInterest`, damit es auch hier keine zweite Definition gibt.
 */
export function computeTeamLoanShares(gameState: GameState, teamId: string): { interest: number; principal: number } {
  const active = (gameState.seasonState.loans ?? []).filter(
    (loan) => loan.borrowerTeamId === teamId && loan.status === "active",
  );
  const interest = getTeamAnnualLoanInterest(gameState, teamId);
  // Tilgung = Rate − Zins, je Kredit gerundet wie im Season-End-Settlement.
  const principal = round1(
    active.reduce(
      (sum, loan) =>
        sum + Math.max(0, round1(loan.installmentPerSeason ?? 0) - round1(loan.principalOutstanding * loan.interestRatePerSeason)),
      0,
    ),
  );
  return { interest, principal };
}

// ── Hover-Text ────────────────────────────────────────────────────────────────────────────────

function formatSigned(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? "+" : rounded < 0 ? "" : ""}${rounded.toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;
}

/**
 * Der Hover: jeder Posten auf einer Zeile, auch bei 0, danach die Abgrenzung. Genau das war die
 * Forderung — eine Zahl, deren Bestandteile man nicht sieht, muss man nachrechnen, und dann glaubt
 * man ihr trotzdem nicht.
 */
export function buildSeasonGuvHoverText(guv: SeasonGuv): string {
  const zeilen = guv.posten
    .filter((entry) => entry.counted)
    .map((entry) => `${entry.label}${entry.note ? ` (${entry.note})` : ""}: ${formatSigned(entry.amount)}`);
  const abgrenzung = guv.posten
    .filter((entry) => !entry.counted)
    .map((entry) => `${entry.label}: ${formatSigned(entry.amount)} — ${entry.note ?? "nicht in der GuV"}`);
  return [
    `GuV ${formatSigned(guv.guv)} = Einnahmen ${formatSigned(guv.einnahmen)} − Ausgaben ${formatSigned(guv.ausgaben)}`,
    "",
    ...zeilen,
    "",
    ...abgrenzung,
    "",
    "Dieselbe Rechnung im Saisonstand, im Sponsoren-Reiter und im Finanzen-Reiter. Preisgeld gibt es nicht mehr — Einnahmen sind Sponsoren, Gebäude und Apron.",
  ].join("\n");
}

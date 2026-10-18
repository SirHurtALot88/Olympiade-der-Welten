/**
 * APRON-SETTLEMENT-SERVICE — die Verdrahtung um die reine Arithmetik in apron-service.ts: Linien zu
 * Saisonbeginn einfrieren, am Saisonende die Abgaben/Ausgleiche auf `team.cash` buchen.
 *
 * REIHENFOLGE IN DER SAISONENDE-KETTE: läuft NACH der Sponsor-Abrechnung (`applySponsorSettlement`,
 * sponsor-settlement-service.ts) und VOR der Kassenbuchung (dem Persistieren des Saisonend-Cash-
 * Stands, cash-prize-apply-service.ts `writeLocalCashPrizeApply` / season-completion-service.ts).
 * Reihenfolge ist hier nicht kosmetisch: der Deckel dieses Schritts braucht den bereits bekannten
 * Wertungsanteil, und `apronWertungsanteil` ist zwar unabhängig vom SPONSOR-Vertrag selbst (siehe
 * Kommentar dort), der Endrang, den beide Schritte lesen, muss aber in jedem Fall schon feststehen —
 * beide Aufrufer lesen ihn aus derselben, zu diesem Zeitpunkt bereits bestraften/finalen Tabelle
 * (nach der Formkarten-Strafe, siehe season-completion-service.ts). Liefe der Apron VOR der Sponsor-
 * Abrechnung, würde er auf einer Tabelle rechnen, die die Sponsor-Abrechnung selbst noch verändern
 * könnte (Bonus-/Malus-Ranganpassungen) — zwei Schritte, zwei verschiedene "Endränge" im selben
 * Saisonabschluss.
 */
import type { ApronSettlementLogRecord, GameState } from "@/lib/data/olyDataTypes";
import { randomUUID } from "@/lib/utils/random-id";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";

import {
  apronWertungsanteil,
  areSeasonApronLinesFrozen,
  computeApronLines,
  computeApronSettlement,
  resolveApronSalaryFactor,
  type ApronLines,
  type ApronTeamRow,
  getTeamApronSalaryBase,
} from "@/lib/season/apron-service";
import { getLeagueTeamIds, isLeagueSplitActive, type LeagueTier } from "@/lib/season/league-split";

function roundCash(value: number): number {
  return Number(value.toFixed(1));
}

// ── Einfrieren zu Saisonbeginn ────────────────────────────────────────────────────────────────

/**
 * Schreibt die Apron-Linien der AKTUELLEN Saison in den Spielstand — und FÜHRT SIE NACH, solange
 * noch kein Spieltag abgerechnet ist.
 *
 * FRÜHER war diese Funktion streng einmalig: der erste Snapshot einer Saison blieb stehen. Die
 * Begründung — man soll nicht gegen eine Grenze kaufen, die die eigenen Käufe verschieben — ist
 * richtig, aber der Zeitpunkt war falsch. Der einzige Aufruf im Saisonübergang lief, BEVOR der
 * Kaderbau der neuen Saison begann; der Kommentar hier behauptete, das Transferfenster sei
 * „bereits durchlaufen". Auf Chris' Spielstand kamen danach noch alle 106 Zugänge der Saison
 * (717,5 Mio Gehalt, Median 45,0 → 69,8) und rissen 28 von 32 Teams über die eingefrorene Linie.
 *
 * JETZT gilt: solange das Kauffenster offen ist (`isApronBuyWindowClosed` falsch), wird bei jedem
 * Aufruf neu gerechnet. Der letzte Aufruf davor setzt damit den endgültigen Stand. Zwei Aufrufer
 * gibt es dafür, und beide markieren denselben Übergang:
 *
 *   1. „Transfers finalisieren" (`ensureLocalLegacyFormCardsForSeason`) — der REGULÄRE Zeitpunkt,
 *      auf Chris' Meldung hin: mit dem Finalisieren endet der Kaderbau der Saison.
 *   2. der erste gewertete Spieltag (`legacy-matchday-result-apply-service.ts`) — der Rückfall für
 *      Spielstände ohne menschliches Team und für den Fall, dass nie finalisiert wurde.
 *
 * Ab da ist der Snapshot unantastbar. New-Game-Setup und Preseason-Workflow frieren BEWUSST NICHT
 * ein (siehe die dortigen Kommentare) — dadurch bekommt jede Saison ihre Linien aus ihren EIGENEN
 * Kadern: ein Snapshot der Vorsaison überlebt den Übergang zwar im `seasonState`, fällt hier und in
 * `resolveSeasonApronLines` aber am `seasonId`-Abgleich durch und wird spätestens mit dem ersten
 * Spieltag der neuen Saison ersetzt.
 *
 * HERKUNFTSVERMERK: Jeder hier geschriebene Snapshot trägt den Anlass, zu dem er entstand. Ein
 * Snapshot OHNE den Vermerk stammt von einem Alt-Build (Einfrieren vor dem Kaderbau) — genau der
 * Fall, der auf Chris' Save festsaß und von außen nicht von einem gültigen Stand zu unterscheiden
 * war. Ein solcher Altstand in einer bereits gespielten Saison wird BEWUSST NICHT automatisch
 * ersetzt (eine mitten in der Saison wandernde Grenze wäre schlimmer als der einmalige manuelle
 * Eingriff); die Heilung läuft über `scripts/repariere-apron-linien.ts`, das vorher nachweist, dass
 * seit dem ersten gewerteten Spieltag keine Transfers stattfanden.
 */
export function ensureSeasonApronLinesFrozen(
  gameState: GameState,
  /** Anlass für den Herkunftsvermerk — siehe `ApronLinesSnapshot.frozenAtEvent`. */
  frozenAtEvent: "transfers_finalized" | "buy_window_close" = "buy_window_close",
): GameState {
  if (areSeasonApronLinesFrozen(gameState)) {
    return gameState;
  }
  const seasonId = gameState.season.id;
  const frozenAtMatchdayId = gameState.matchdayState?.matchdayId ?? "";
  const createdAt = new Date().toISOString();
  const buildSnapshot = (lines: ApronLines) => ({
    seasonId,
    frozenAtMatchdayId,
    createdAt,
    frozenAtEvent,
    medianSalary: lines.medianSalary,
    line1: lines.line1,
    line2: lines.line2,
    usedReferenceSalary: lines.usedReferenceSalary,
  });

  // TASK #158/#161, Chris' Entscheidung vom 18.10. (liga-split-plan.md 10.4): „Ja, Apron künftig
  // pro Liga rechnen" — je 16er-Liga EIN eigener Median, nicht ein globaler Median ueber alle 32
  // Teams. Ohne aktiven Split (jeder Manager-Mode-/Legacy-Save) bleibt dieser Zweig unbenutzt, der
  // unten stehende globale Pfad bit-identisch zu vor dieser Aenderung.
  if (isLeagueSplitActive(gameState)) {
    const liga1TeamIds = getLeagueTeamIds(gameState, "liga1");
    const liga2TeamIds = getLeagueTeamIds(gameState, "liga2");
    const byLeague: Partial<Record<LeagueTier, ReturnType<typeof buildSnapshot>>> = {};
    if (liga1TeamIds.length > 0) {
      byLeague.liga1 = buildSnapshot(computeApronLines(gameState, liga1TeamIds));
    }
    if (liga2TeamIds.length > 0) {
      byLeague.liga2 = buildSnapshot(computeApronLines(gameState, liga2TeamIds));
    }
    if (byLeague.liga1 || byLeague.liga2) {
      return {
        ...gameState,
        seasonState: {
          ...gameState.seasonState,
          // Liga-1-Scope bleibt zusaetzlich im alten, globalen Feld stehen — fuer Leser, die noch
          // keine Liga kennen (s. `resolveSeasonApronLinesForTeam`-Kommentar in apron-service.ts).
          apronLinesSnapshot: byLeague.liga1 ?? byLeague.liga2,
          apronLinesSnapshotByLeague: byLeague,
        },
      };
    }
  }

  const lines = computeApronLines(gameState);
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      apronLinesSnapshot: buildSnapshot(lines),
    },
  };
}

// ── Vorschau + Abrechnung am Saisonende ───────────────────────────────────────────────────────

export type ApronSettlementPreview = {
  seasonId: string;
  lines: ApronLines | null;
  rows: ApronTeamRow[];
  topf: number;
  zahlerCount: number;
  empfaengerCount: number;
  canApply: boolean;
  blockingReasons: string[];
  warnings: string[];
  alreadyApplied: boolean;
};

function hasSeasonEndApronLog(gameState: GameState, seasonId: string): boolean {
  return (gameState.seasonState.apronSettlementLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.phase === "season_end",
  );
}

/**
 * Baut die Abrechnung EINER Gruppe (eine Liga, oder — ohne Split — die ganze Liga): dieselbe
 * Bemessungsgrundlage (`getTeamApronSalaryBase`) und derselbe `apronWertungsanteil`-Aufruf wie vor
 * dieser Aenderung, nur jetzt mit dem RICHTIGEN `leagueSize` fuer die Gewichtstabelle — ein
 * Liga-2-Team auf Rang 16 (seiner eigenen 16er-Liga) bekam vorher das Gewicht von Rang 16 EINER
 * 32er-Tabelle (spuerbar ungleich null, statt des korrekten "letzter Platz, kein Wertungsanteil").
 */
function buildApronSettlementForGroup(
  gameState: GameState,
  teamIds: readonly string[],
  lines: ApronLines,
  leagueSize: number,
  rankByTeamId: ReadonlyMap<string, number | null>,
  salaryFactor: number,
  warnings: string[],
) {
  const teams = teamIds.map((teamId) => {
    const team = gameState.teams.find((entry) => entry.teamId === teamId);
    const finalRank = rankByTeamId.get(teamId) ?? null;
    if (finalRank == null) {
      warnings.push(`${team?.shortCode ?? teamId}:apron_rank_missing`);
    }
    return {
      teamId,
      // DIE Bemessungsgrundlage — dieselbe Funktion, aus der auch `computeApronLines` den Median
      // zieht. Kein zweiter Direktgriff auf irgendeine Gehaltssumme: Abrechnung, Linien,
      // Hochrechnung und KI MUESSEN dieselbe Zahl lesen, sonst bucht das Saisonende gegen eine
      // andere Basis, als die KI vorher bepreist hat.
      salary: getTeamApronSalaryBase(gameState, teamId),
      rankShare: apronWertungsanteil(finalRank ?? leagueSize, salaryFactor, leagueSize),
    };
  });
  return computeApronSettlement({ lines, salaryFactor, teams });
}

/**
 * Baut die Vorschau der Apron-Abrechnung. Braucht eingefrorene Linien (`ensureSeasonApronLinesFrozen`
 * muss schon gelaufen sein) — ohne Snapshot gibt es keine Grenze, gegen die gemessen werden könnte,
 * und die Vorschau bleibt leer statt eine Grenze ad hoc am Saisonende zu erfinden.
 *
 * TASK #158/#161, Chris' Entscheidung vom 18.10. (liga-split-plan.md 10.4): ohne aktiven Split
 * unveraendert EIN Topf ueber alle Teams (bit-identisch zu vor dieser Aenderung). MIT aktivem Split
 * laeuft die Abrechnung JE LIGA getrennt — eigene Linien, eigener Topf, eigene Rang-Gewichtstabelle
 * (16 statt 32 Sprossen) — und wird danach nur noch zur Anzeige zusammengefuehrt. Ohne diese
 * Trennung wuerde Liga-1-Geld in die Liga-2-Ausschüttung fliessen und umgekehrt, obwohl jede Liga
 * ihre eigenen Linien hat.
 */
export function previewApronSettlement(gameState: GameState): ApronSettlementPreview {
  const seasonId = gameState.season.id;
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  const alreadyApplied = hasSeasonEndApronLog(gameState, seasonId);
  const overviewRows = buildTeamSeasonOverviewRows({ gameState });
  const rankByTeamId = new Map(overviewRows.map((row) => [row.teamId, row.rank] as const));
  const salaryFactor = resolveApronSalaryFactor(gameState);
  const globalLines =
    gameState.seasonState.apronLinesSnapshot?.seasonId === seasonId ? gameState.seasonState.apronLinesSnapshot : null;

  if (!isLeagueSplitActive(gameState)) {
    if (!globalLines) {
      blockingReasons.push("apron_lines_not_frozen");
      return { seasonId, lines: null, rows: [], topf: 0, zahlerCount: 0, empfaengerCount: 0, canApply: false, blockingReasons, warnings, alreadyApplied };
    }
    const settlement = buildApronSettlementForGroup(
      gameState,
      gameState.teams.map((team) => team.teamId),
      globalLines,
      32,
      rankByTeamId,
      salaryFactor,
      warnings,
    );
    return {
      seasonId,
      lines: globalLines,
      rows: settlement.rows,
      topf: settlement.topf,
      zahlerCount: settlement.zahlerCount,
      empfaengerCount: settlement.empfaengerCount,
      canApply: !alreadyApplied && settlement.rows.some((row) => row.nettoDelta !== 0),
      blockingReasons,
      warnings,
      alreadyApplied,
    };
  }

  const byLeague = gameState.seasonState.apronLinesSnapshotByLeague;
  const assignedTeamIds = new Set<string>();
  let rows: ApronTeamRow[] = [];
  let topf = 0;
  let zahlerCount = 0;
  let empfaengerCount = 0;
  let primaryLines: ApronLines | null = null;

  for (const tier of ["liga1", "liga2"] as const) {
    const teamIds = getLeagueTeamIds(gameState, tier);
    teamIds.forEach((teamId) => assignedTeamIds.add(teamId));
    if (teamIds.length === 0) continue;
    const tierLines = byLeague?.[tier]?.seasonId === seasonId ? byLeague[tier]! : null;
    if (!tierLines) {
      blockingReasons.push(`apron_lines_not_frozen:${tier}`);
      continue;
    }
    primaryLines = primaryLines ?? tierLines;
    const settlement = buildApronSettlementForGroup(gameState, teamIds, tierLines, teamIds.length, rankByTeamId, salaryFactor, warnings);
    rows = rows.concat(settlement.rows);
    topf += settlement.topf;
    zahlerCount += settlement.zahlerCount;
    empfaengerCount += settlement.empfaengerCount;
  }

  // Teams ohne Liga-Zuordnung (sollte bei aktivem Split nicht vorkommen, s. Warnung in
  // `saisonstand-punkte-nachbuchung.ts`) fallen auf den alten, globalen Topf zurueck — besser eine
  // Abrechnung nach der alten Regel als gar keine.
  const unassigned = gameState.teams.map((team) => team.teamId).filter((teamId) => !assignedTeamIds.has(teamId));
  if (unassigned.length > 0) {
    if (!globalLines) {
      blockingReasons.push("apron_lines_not_frozen:unassigned");
    } else {
      primaryLines = primaryLines ?? globalLines;
      const settlement = buildApronSettlementForGroup(gameState, unassigned, globalLines, 32, rankByTeamId, salaryFactor, warnings);
      rows = rows.concat(settlement.rows);
      topf += settlement.topf;
      zahlerCount += settlement.zahlerCount;
      empfaengerCount += settlement.empfaengerCount;
    }
  }

  if (!primaryLines) {
    if (blockingReasons.length === 0) blockingReasons.push("apron_lines_not_frozen");
    return { seasonId, lines: null, rows: [], topf: 0, zahlerCount: 0, empfaengerCount: 0, canApply: false, blockingReasons, warnings, alreadyApplied };
  }

  return {
    seasonId,
    // Anzeige-Kompromiss: EIN `lines`-Feld fuer Leser, die noch keine Liga kennen — Liga 1, wenn
    // vorhanden (gleiche Reihenfolge wie `apronLinesSnapshot` oben). Die tatsaechliche Abrechnung
    // je Zeile (`rows`) rechnet immer gegen die LIGA-EIGENEN Linien, unabhaengig von diesem Feld.
    lines: primaryLines,
    rows,
    topf,
    zahlerCount,
    empfaengerCount,
    canApply: !alreadyApplied && blockingReasons.length === 0 && rows.some((row) => row.nettoDelta !== 0),
    blockingReasons,
    warnings,
    alreadyApplied,
  };
}

export function applyApronSettlement(input: {
  gameState: GameState;
  saveId: string;
  execute?: boolean;
}): { gameState: GameState; preview: ApronSettlementPreview; applied: boolean } {
  const preview = previewApronSettlement(input.gameState);
  if (!input.execute || preview.alreadyApplied || preview.lines == null || preview.rows.every((row) => row.nettoDelta === 0)) {
    return { gameState: input.gameState, preview, applied: false };
  }

  const now = new Date().toISOString();
  const logs: ApronSettlementLogRecord[] = [];
  const cashByTeamId = new Map<string, number>();

  // Abgaben werden je Team unabhaengig gerundet — jede ist ein eigener, unverteilter Wert, das
  // rundet nichts weg. Die Ausschüttung dagegen ist EIN Topf, geteilt durch die Empfänger-Anzahl;
  // wuerde jeder Anteil unabhaengig gerundet, koennte die Summe der Ausgleiche um ein paar Zehntel
  // vom (gerundeten) Topf abweichen — die Erhaltung waere nur noch ungefaehr wahr. Deshalb ruendet
  // NUR der letzte Empfaenger den Rest auf: alle anderen bekommen den normal gerundeten Anteil, der
  // letzte bekommt exakt "Topf minus alle anderen", garantiert exakte Gleichheit.
  const payoutRows = preview.rows.filter((row) => row.ausgleich > 0);
  let roundedTopf = 0;
  const levyDeltaByTeamId = new Map<string, number>();
  for (const row of preview.rows) {
    if (row.abgabe > 0) {
      const delta = roundCash(row.abgabe);
      levyDeltaByTeamId.set(row.teamId, delta);
      roundedTopf = roundCash(roundedTopf + delta);
    }
  }
  const payoutDeltaByTeamId = new Map<string, number>();
  let distributed = 0;
  payoutRows.forEach((row, index) => {
    const isLast = index === payoutRows.length - 1;
    const delta = isLast ? roundCash(roundedTopf - distributed) : roundCash(row.ausgleich);
    distributed = roundCash(distributed + delta);
    payoutDeltaByTeamId.set(row.teamId, delta);
  });

  for (const row of preview.rows) {
    const levyDelta = levyDeltaByTeamId.get(row.teamId);
    if (levyDelta != null && levyDelta > 0) {
      cashByTeamId.set(row.teamId, roundCash((cashByTeamId.get(row.teamId) ?? 0) - levyDelta));
      logs.push({
        id: `apron-settlement:${preview.seasonId}:${row.teamId}:levy:${randomUUID()}`,
        saveId: input.saveId,
        seasonId: preview.seasonId,
        teamId: row.teamId,
        phase: "season_end",
        kind: "levy",
        cashDelta: -levyDelta,
        action: "apply",
        createdAt: now,
      });
    }
    const payoutDelta = payoutDeltaByTeamId.get(row.teamId);
    if (payoutDelta != null && payoutDelta !== 0) {
      cashByTeamId.set(row.teamId, roundCash((cashByTeamId.get(row.teamId) ?? 0) + payoutDelta));
      logs.push({
        id: `apron-settlement:${preview.seasonId}:${row.teamId}:payout:${randomUUID()}`,
        saveId: input.saveId,
        seasonId: preview.seasonId,
        teamId: row.teamId,
        phase: "season_end",
        kind: "payout",
        cashDelta: payoutDelta,
        action: "apply",
        createdAt: now,
      });
    }
  }

  if (logs.length === 0) {
    return { gameState: input.gameState, preview, applied: false };
  }

  const nextGameState: GameState = {
    ...input.gameState,
    teams: input.gameState.teams.map((team) => {
      const delta = cashByTeamId.get(team.teamId) ?? 0;
      return delta === 0 ? team : { ...team, cash: roundCash(team.cash + delta) };
    }),
    seasonState: {
      ...input.gameState.seasonState,
      apronSettlementLogs: [...logs, ...(input.gameState.seasonState.apronSettlementLogs ?? [])],
    },
  };

  return { gameState: nextGameState, preview, applied: true };
}

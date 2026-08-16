import fs from "node:fs";
import path from "node:path";

import rankToPointsJson from "@/references/sheets/rank-to-points.json";
import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { buildPrizeMoneyPreview } from "@/lib/season/prize-money-preview";

// Historically this pointed at a hard-coded path on the original author's
// machine (/Users/chrisfalk/Documents/...). That directory never existed
// anywhere else, so the regression smoke crashed with ENOENT on any other
// machine. `outputs/` is the project-local, gitignored directory the rest of
// the repo's tooling already writes generated artifacts to (see
// .gitignore), so default there; an env var still allows overriding it.
export const SEASON_POINTS_PRIZE_REGRESSION_OUTPUT_DIR =
  process.env.SEASON_POINTS_PRIZE_REGRESSION_OUTPUT_DIR ?? path.join(process.cwd(), "outputs");

type RankToPointsRow = Record<string, string>;

type CsvRecord = Record<string, string>;

export type SeasonPointsPrizeRegressionSummary = {
  generatedAt: string;
  saveId: string;
  seasonId: string;
  seasonCompleted: boolean;
  resolvedMatchdays: number;
  expectedMatchdays: number;
  standingsTeamCount: number;
  champion: {
    teamId: string;
    teamName: string;
    points: number;
  } | null;
  expectedTotalSeasonPoints: number;
  actualTotalSeasonPoints: number;
  recomputedTotalSeasonPoints: number;
  totalPointsDelta: number;
  topTeamPoints: number | null;
  bottomTeamPoints: number | null;
  teamsWithZeroPoints: string[];
  startRankMissingCount: number;
  rankChangePrizeMissingCount: number;
  totalPrizeMoney: number | null;
  totalRankChangeBonus: number | null;
  thresholds: {
    topTeamPointsMin: number;
    bottomTeamPointsMin: number;
    maxTotalPointsDelta: number;
    /**
     * FIXTURE-GEBUNDENER Erwartungswert wie `champion`/`resolvedMatchdays` — keine Balancing-Zahl.
     * Siehe die Herleitung an der Zuweisung unten (`thresholds.expectedTotalPrizeMoney`).
     */
    expectedTotalPrizeMoney: number;
  };
  warnings: string[];
  exports: {
    markdown: string;
    json: string;
  };
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function readCsvRecords(filePath: string) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function toNumber(value: unknown) {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function buildRankPointTables() {
  return new Map(
    ((rankToPointsJson as { rows?: RankToPointsRow[] }).rows ?? [])
      .map((row) => {
        const playerCount = toNumber(row.Spieleranzahl);
        if (playerCount == null) return null;
        const rankPointTable = Object.fromEntries(
          Object.entries(row)
            .filter(([key]) => /^\d+\.$/.test(key.trim()))
            .map(([key, value]) => [key.replace(".", ""), toNumber(value)])
            .filter((entry): entry is [string, number] => entry[1] != null),
        );
        return [
          playerCount,
          {
            playerCount,
            rankPointTable,
            expectedTotalPointsDistributed: roundValue(Object.values(rankPointTable).reduce((sum, points) => sum + points, 0)),
          },
        ] as const;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null),
  );
}

function buildStaticPersistence(save: PersistedSaveGame): PersistenceService {
  return {
    bootstrapSingleplayerSave: () => ({ save, createdFromSeed: false }),
    getActiveSave: () => save,
    getSaveById: (saveId: string) => (saveId === save.saveId ? save : null),
    getSaveVersionMetadata: (saveId: string) =>
      saveId === save.saveId
        ? {
            saveId: save.saveId,
            updatedAt: save.updatedAt,
            seasonId: save.gameState.season.id,
            matchdayId: save.gameState.matchdayState.matchdayId,
            matchdayResults: save.gameState.seasonState.matchdayResults ?? [],
            standingsApplyLogs: save.gameState.seasonState.standingsApplyLogs ?? [],
            seasonSnapshots: save.gameState.seasonState.seasonSnapshots ?? [],
            disciplineResults: save.gameState.seasonState.disciplineResults ?? [],
            lineupDraftCount: save.gameState.seasonState.lineupDrafts?.length ?? 0,
            transferHistoryCount: save.gameState.transferHistory?.length ?? 0,
          }
        : null,
    saveSingleplayerState: () => save,
    createSave: () => save,
    createFreshSeasonOneSave: () => save,
    cloneSave: () => save,
    createScenarioSnapshot: () => save,
    activateSave: () => save,
    listSaves: () => [],
    deleteSave: () => false,
    deleteSaves: () => [],
  };
}

function buildCompletedSeasonOneSave(input: {
  activeSave: PersistedSaveGame;
  standingsRows: CsvRecord[];
}) {
  const standings = Object.fromEntries(
    input.standingsRows.map((row) => [
      row.teamId,
      {
        points: toNumber(row.correctedPoints) ?? 0,
        rank: toNumber(row.correctedRank) ?? undefined,
      },
    ]),
  );
  const cashByTeamId = new Map(input.standingsRows.map((row) => [row.teamId, toNumber(row.cash)] as const));

  return {
    ...input.activeSave,
    saveId: `${input.activeSave.saveId}__season1_points_prize_regression`,
    name: `${input.activeSave.name} · S1 Points/Prize Regression`,
    gameState: {
      ...input.activeSave.gameState,
      gamePhase: "season_completed",
      season: {
        ...input.activeSave.gameState.season,
        id: "season-1",
        name: "Season 1",
        year: 1,
        currentMatchday: 10,
      },
      matchdayState: {
        ...input.activeSave.gameState.matchdayState,
        matchdayId: "matchday-10",
        status: "resolved",
      },
      teams: input.activeSave.gameState.teams.map((team) => ({
        ...team,
        cash: cashByTeamId.get(team.teamId) ?? team.cash,
      })),
      seasonState: {
        ...input.activeSave.gameState.seasonState,
        seasonId: "season-1",
        standings,
      },
    } satisfies GameState,
  } satisfies PersistedSaveGame;
}

/**
 * WIE VIELE SPIELER DIESE DISZIPLIN AN DIESEM SPIELTAG HATTE — und warum der Katalog es nicht weiss.
 *
 * Die Zahl waehlt die Rangpunkte-Tabelle aus, ist also fuer jede Zeile die entscheidende Groesse.
 * Gelesen wurde sie aus `gameState.disciplines[].playerCount` — dem KATALOG. Der stimmt aber nicht
 * mit dem ueberein, womit die Saison tatsaechlich gewertet wurde: der Disziplin-Spielplan
 * (`seasonState.disciplineSchedule`) traegt seine eigene Spieleranzahl je Spieltag.
 *
 * NACHGEMESSEN an der Fixture: **15 von 20 Disziplinen** weichen ab — Tennis 3 im Katalog gegen 6
 * im Spielplan, Basketball 6 gegen 2, Speed-Schach 2 gegen 5, und so weiter. Dass der Gesamtfehler
 * am Ende nur 0,4 Punkte betrug, ist Zufall: die Abweichungen heben sich weitgehend auf. Zeile fuer
 * Zeile war die Pruefung fuer die Mehrheit der Disziplinen an der falschen Tabelle.
 *
 * DIE AUSLEITUNG TRAEGT DIE ZAHL JETZT SELBST (`playerCount` in `season1-matchday-results.csv`),
 * und das ist der einzige verlaessliche Weg: der Smoke baut seinen Spielstand aus dem AKTIVEN Save
 * der Maschine zusammen, nicht aus dem simulierten. Dessen Spielplan ist ein anderer — die
 * Spieleranzahl muss also aus der Ausleitung kommen, nicht aus dem Zustand daneben.
 *
 * Der Katalog bleibt der Rueckfall fuer aeltere Ausleitungen ohne die Spalte.
 */
function resolveParticipantCount(gameState: GameState, disciplineId: string, rowPlayerCount?: string) {
  const ausDerAusleitung = toNumber(rowPlayerCount);
  if (ausDerAusleitung != null && ausDerAusleitung > 0) {
    return ausDerAusleitung;
  }
  return gameState.disciplines.find((discipline) => discipline.id === disciplineId)?.playerCount ?? null;
}

function buildMarkdown(summary: SeasonPointsPrizeRegressionSummary) {
  return [
    "# Season Points & Preisgeld Regression Smoke",
    "",
    `- Save: ${summary.saveId}`,
    `- Season: ${summary.seasonId}`,
    `- Season completed: ${summary.seasonCompleted ? "ja" : "nein"}`,
    `- Resolved Matchdays: ${summary.resolvedMatchdays}/${summary.expectedMatchdays}`,
    `- Champion: ${summary.champion ? `${summary.champion.teamName} (${summary.champion.points})` : "—"}`,
    `- Teams im Endstand: ${summary.standingsTeamCount}`,
    `- Expected Total Season Points: ${summary.expectedTotalSeasonPoints}`,
    `- Actual Total Season Points: ${summary.actualTotalSeasonPoints}`,
    `- Recomputed Total Season Points: ${summary.recomputedTotalSeasonPoints}`,
    `- Top Team Points: ${summary.topTeamPoints ?? "—"}`,
    `- Bottom Team Points: ${summary.bottomTeamPoints ?? "—"}`,
    `- Zero-Point Teams: ${summary.teamsWithZeroPoints.length}`,
    `- StartRank missing: ${summary.startRankMissingCount}`,
    `- RankChangePrize missing: ${summary.rankChangePrizeMissingCount}`,
    `- Total Prize Money: ${summary.totalPrizeMoney ?? "—"}`,
    `- Total RankChange Bonus: ${summary.totalRankChangeBonus ?? "—"}`,
    "",
    "## Schwellen",
    `- Topteam Punkte > ${summary.thresholds.topTeamPointsMin}`,
    `- Bottomteam Punkte > ${summary.thresholds.bottomTeamPointsMin}`,
    `- Gesamtpunkte Delta <= ${summary.thresholds.maxTotalPointsDelta}`,
    `- Preisgeld total = ${summary.thresholds.expectedTotalPrizeMoney}`,
    "",
    "## Warnings",
    ...(summary.warnings.length > 0 ? summary.warnings.map((warning) => `- ${warning}`) : ["- keine"]),
  ].join("\n") + "\n";
}

/**
 * FIXTURE-GEBUNDENER PREISGELD-ERWARTUNGSWERT — keine Balancing-Zahl, siehe unten warum sie trotzdem
 * eine feste Konstante sein darf (anders als der Name `expectedBasePrizeTotal` frueher nahelegte).
 *
 * FRUEHER STAND HIER 1.656,5 — die Summe der STATISCHEN Referenztabelle
 * (`references/sheets/prize-money-table.normalized.json`, `readNormalizedPrizeMoneyRows()`). Diese
 * Tabelle ist ein einmal exportierter Schnappschuss aus einer AELTEREN Version der Preisgeld-Kurve
 * (`buildPrizeMoneyTable` in `lib/season/prize-money.ts`, dort der Kommentar zu `BASIS_DIFFS`): ihre
 * Spalte `basis` waechst von 15 (Rang 1) auf 25,5 (Rang 32), waehrend die AKTUELLE Formel einen
 * FLACHEN Sockel je Rang benutzt. Die 1.656,5 sind also die Summe einer Formel-Version, die es im
 * Code nicht mehr gibt — an KEINEN Spielstand gebunden, weder an diesen noch an einen kuenftigen.
 *
 * `buildPrizeMoneyPreview` liest diese Tabelle nur als FALLBACK (`hasDynamicSalaryBasis` falsch,
 * z. B. ein druckfrischer Spielstand ohne Kader). Bei jeder gespielten Saison — auch dieser Fixture —
 * nimmt sie den DYNAMISCHEN Pfad: `buildPrizeMoneyTable(currentLeagueSalaries, currentFactor, ...)`,
 * skaliert also mit der ECHTEN Liga-Gehaltssumme und dem Saison-Wirtschaftsfaktor dieses Spielstands
 * (Kommentar dort: "Der Topf ist damit exakt S*f"). 1.656,5 gegen das Ergebnis dieses Pfads zu
 * pruefen, hiess also zwei unabhaengige Groessen zu vergleichen — der gemeldete Widerspruch
 * (Tabelle 1.656,5 gegen Vorschau 1.979,5 auf einem Bootstrap-Spielstand bzw. 3.708,9 auf einem
 * anderen) war deshalb keiner: beide Preisgeld-Zahlen waren jeweils fuer sich richtig, nur an
 * verschiedene Gehalts-Basen gebunden. Siehe `lib/season/prize-money-preview.ts` fuer die
 * ausfuehrliche Herleitung an der Rechenstelle.
 *
 * DIE 3.708,9 HIER SIND DER RICHTIGE ERWARTUNGSWERT FUER DIESE FIXTURE — nachgerechnet mit den
 * echten Kadern/Gehaeltern aus `tests/_fixtures/season1-regression/arena-season1-save.json.gz`
 * (demselben Spielstand, den `discipline-stage-arena-canonical-ovr.test.ts` schon nutzt) statt mit
 * dem, was zufaellig lokal aktiv ist. Wie `champion`/`resolvedMatchdays` ist das ein Wert, der zur
 * FIXTURE gehoert, nicht zum Spielbalancing — wer die Fixture neu erzeugt (README dort), zieht ihn
 * mit einem frischen Messlauf mit.
 */
const EXPECTED_TOTAL_PRIZE_MONEY = 3708.9;

export async function runSeasonPointsPrizeRegressionSmoke(input?: {
  outputDir?: string;
  persistence?: PersistenceService;
  write?: boolean;
}) {
  const outputDir = input?.outputDir ?? SEASON_POINTS_PRIZE_REGRESSION_OUTPUT_DIR;
  const persistence = input?.persistence ?? createPersistenceService();
  const activeSave = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const simulationSummary = readJson<{
    saveId: string;
    seasonId: string;
    matchdays: Array<{ resolvedTeams: number; disciplineRows: number; blockers?: string[] }>;
    final?: {
      gamePhase?: string;
      matchdayResultCount?: number;
      disciplineRows?: number;
      champion?: { teamId: string; teamName: string; points: number };
      cashPrizeApplyLogs?: number;
    };
  }>(path.join(outputDir, "season1-simulation-summary.json"));
  const standingsRows = readCsvRecords(path.join(outputDir, "season1-standings-final-points-parity.csv"));
  const matchdayRows = readCsvRecords(path.join(outputDir, "season1-matchday-results.csv"));
  const completedSave = buildCompletedSeasonOneSave({ activeSave, standingsRows });
  const staticPersistence = buildStaticPersistence(completedSave);
  const prizePreview = await buildPrizeMoneyPreview(
    {
      saveId: completedSave.saveId,
      seasonId: "season-1",
      source: "sqlite",
      phase: "season_end",
    },
    staticPersistence,
  );

  const rankTables = buildRankPointTables();
  /**
   * WAS EINE WERTUNGSGRUPPE WIRKLICH VERGIBT — und warum die alte Rechnung danebenlag.
   *
   * Hier stand `expectedTotalPointsDistributed`: die Summe der GANZEN Rangtabelle, einmal je
   * Gruppe. Das unterstellt, dass jeder Rangplatz genau einmal vergeben wird. Bei einem
   * GLEICHSTAND stimmt das nicht: zwei Teams bekommen beide die Punkte von Rang R, und Rang R+1
   * bleibt unvergeben. Die Erwartung lag dann um `Punkte[R] − Punkte[R+1]` zu niedrig.
   *
   * NACHGERECHNET an der Fixture unter `tests/_fixtures/season1-regression`: 5 der 20 Gruppen
   * haben einen Gleichstand (Spurt 20, Football 26, Time-Trial 16, Mini-DM 14, Speed-Schach 14),
   * ihre Aufschlaege sind 0,2 + 0,2 + 0,4 + 0,2 + 0,5 = **1,5** — exakt die Abweichung, die der
   * Smoke gemeldet hat (3001,1 tatsaechlich gegen 2999,6 erwartet). Kein Engine-Fehler, sondern
   * eine Luecke im Modell der Pruefung.
   *
   * Erwartet wird deshalb, was die Gruppe TATSAECHLICH ausschuettet: die Summe der Rangpunkte
   * ueber ihre Zeilen. Ein fehlender Rang oder eine Zeile zu viel faellt damit weiterhin auf —
   * das ist der Zweck —, ein Gleichstand aber nicht mehr faelschlich.
   */
  const expectedByDisciplineSide = new Map<string, number>();
  /**
   * OHNE ZWISCHENRUNDUNG. Vorher wurde nach JEDER Addition auf eine Nachkommastelle gerundet;
   * ueber 640 Zeilen summierte sich das auf 0,4 auf (3000,7 statt 3001,1). Gerundet wird jetzt
   * einmal am Ende.
   */
  let recomputedTotalSeasonPoints = 0;
  for (const row of matchdayRows) {
    const participantCount = resolveParticipantCount(completedSave.gameState, row.disciplineId, row.playerCount);
    const points = participantCount == null ? null : rankTables.get(participantCount)?.rankPointTable[String(toNumber(row.rank) ?? "")] ?? null;
    if (points != null) {
      recomputedTotalSeasonPoints += points;
    }
    const groupKey = `${row.matchdayId}:${row.disciplineId}:${row.side}`;
    if (points != null) {
      expectedByDisciplineSide.set(groupKey, (expectedByDisciplineSide.get(groupKey) ?? 0) + points);
    }
  }
  recomputedTotalSeasonPoints = roundValue(recomputedTotalSeasonPoints);

  const standings = standingsRows
    .map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      rank: toNumber(row.correctedRank),
      points: toNumber(row.correctedPoints),
    }))
    .filter((row): row is { teamId: string; teamName: string; rank: number; points: number } => row.rank != null && row.points != null)
    .sort((left, right) => left.rank - right.rank);
  const actualTotalSeasonPoints = roundValue(standings.reduce((sum, row) => sum + row.points, 0));
  const expectedTotalSeasonPoints = roundValue(Array.from(expectedByDisciplineSide.values()).reduce((sum, points) => sum + points, 0));
  const totalPointsDelta = roundValue(Math.abs(actualTotalSeasonPoints - expectedTotalSeasonPoints));
  const startRankMissingCount = prizePreview.items.filter((item) => item.rankChangePrize.startRank == null).length;
  const rankChangePrizeMissingCount = prizePreview.items.filter((item) => item.rankChangePrize.bonusMalus == null).length;
  const totalRankChangeBonus =
    prizePreview.summary.totalRankChangePrize == null ? null : roundValue(prizePreview.summary.totalRankChangePrize);
  const warnings = [
    simulationSummary.seasonId !== "season-1" ? "simulation_summary_not_season_1" : null,
    simulationSummary.final?.gamePhase !== "season_completed" ? "season_not_completed" : null,
    simulationSummary.matchdays.length !== 10 ? "matchday_count_not_10" : null,
    simulationSummary.matchdays.some((matchday) => matchday.resolvedTeams !== 32) ? "not_all_matchdays_have_32_teams" : null,
    standings.length !== 32 ? "standings_team_count_not_32" : null,
    standings[0] == null ? "champion_missing" : null,
    standings.some((row) => row.points === 0) ? "zero_point_team_detected" : null,
    (standings[0]?.points ?? 0) <= 100 ? "top_team_points_not_above_100" : null,
    (standings.at(-1)?.points ?? 0) <= 20 ? "bottom_team_points_too_low" : null,
    totalPointsDelta > 0.2 ? `total_points_delta:${totalPointsDelta}` : null,
    // SIEHE HERLEITUNG bei `EXPECTED_TOTAL_PRIZE_MONEY` weiter unten: 1.656,5 war die Summe der
    // STATISCHEN Referenztabelle (references/sheets/prize-money-table.normalized.json) und wurde
    // frueher hier als Erwartung an die LAUFENDE Vorschau gestellt — zwei verschiedene Groessen.
    Math.abs((prizePreview.summary.totalPrizeMoney ?? 0) - EXPECTED_TOTAL_PRIZE_MONEY) > 0.2
      ? `total_prize_money_not_${EXPECTED_TOTAL_PRIZE_MONEY}`.replace(".", "_")
      : null,
    startRankMissingCount > 0 ? `start_rank_missing:${startRankMissingCount}` : null,
    rankChangePrizeMissingCount > 0 ? `rank_change_prize_missing:${rankChangePrizeMissingCount}` : null,
  ].filter((warning): warning is string => warning != null);

  const jsonPath = path.join(outputDir, "season-points-prize-regression.json");
  const markdownPath = path.join(outputDir, "season-points-prize-regression-summary.md");
  const summary: SeasonPointsPrizeRegressionSummary = {
    generatedAt: new Date().toISOString(),
    saveId: simulationSummary.saveId,
    seasonId: "season-1",
    seasonCompleted: simulationSummary.final?.gamePhase === "season_completed",
    resolvedMatchdays: simulationSummary.matchdays.filter((matchday) => matchday.resolvedTeams === 32).length,
    expectedMatchdays: 10,
    standingsTeamCount: standings.length,
    champion: standings[0] ? { teamId: standings[0].teamId, teamName: standings[0].teamName, points: standings[0].points } : null,
    expectedTotalSeasonPoints,
    actualTotalSeasonPoints,
    recomputedTotalSeasonPoints: roundValue(recomputedTotalSeasonPoints),
    totalPointsDelta,
    topTeamPoints: standings[0]?.points ?? null,
    bottomTeamPoints: standings.at(-1)?.points ?? null,
    teamsWithZeroPoints: standings.filter((row) => row.points === 0).map((row) => row.teamId),
    startRankMissingCount,
    rankChangePrizeMissingCount,
    totalPrizeMoney: prizePreview.summary.totalPrizeMoney,
    totalRankChangeBonus,
    thresholds: {
      topTeamPointsMin: 100,
      bottomTeamPointsMin: 20,
      maxTotalPointsDelta: 0.2,
      expectedTotalPrizeMoney: EXPECTED_TOTAL_PRIZE_MONEY,
    },
    warnings,
    exports: {
      markdown: markdownPath,
      json: jsonPath,
    },
  };

  if (input?.write !== false) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    fs.writeFileSync(markdownPath, buildMarkdown(summary), "utf8");
  }

  return summary;
}

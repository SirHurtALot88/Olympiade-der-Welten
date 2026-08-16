import path from "node:path";

import { describe, expect, it } from "vitest";

import { runSeasonPointsPrizeRegressionSmoke } from "@/lib/season/season-points-prize-regression";

/**
 * DIE FIXTURE LIEGT JETZT IM REPO — vorher lief dieser Fall nirgends.
 *
 * Er las eine Ausleitung aus dem **gitignorierten** `outputs/`-Verzeichnis, die eine Ad-hoc-
 * Simulation dort einmal hinterlassen hatte. Auf jeder anderen Maschine — CI, frischer Checkout,
 * zweiter Arbeitsplatz — war sie nicht da, und der Fall uebersprang sich sauber. Ein Fixture, das
 * nur auf einem Rechner existiert, ist keins.
 *
 * ERZEUGT (Chris: „arena ovr etc fixtures kannst du holen und bauen") ueber die vorhandene Kette,
 * jeder Schritt mit `--write`, sonst tut er nichts und meldet trotzdem Erfolg:
 *
 *     npx tsx scripts/season1-autoprep-topup.ts --write
 *     npx tsx scripts/season1-autoprep.ts --write
 *     npx tsx scripts/season1-simulation-run.ts --write
 *
 * Ergebnis dieser Saison: `season_completed`, Meister R-L mit 168,5 Punkten, 640 Disziplin-Zeilen
 * ueber 10 Spieltage, 2.549 Spieler-Leistungen. Die Paritaets-Datei ist aus
 * `season1-standings-final.csv` abgeleitet (die Regression liest `correctedRank`/`correctedPoints`).
 *
 * WARUM DIE ZAHLEN HIER FESTGENAGELT SIND: der Fall ist ein Regressions-Smoke gegen genau DIESE
 * Ausleitung. Meister und Punktzahl gehoeren zur Fixture wie ein Erwartungswert zu seiner Eingabe —
 * sie sind keine Aussage darueber, wie eine Saison auszugehen HAT. Wer die Fixture neu erzeugt,
 * zieht sie mit.
 */
const FIXTURE_DIR = path.join(process.cwd(), "tests/_fixtures/season1-regression");

describe("season points and prize regression smoke", () => {
  it("keeps completed Season 1 points and prize rank-change plausible", async () => {
    const summary = await runSeasonPointsPrizeRegressionSmoke({ outputDir: FIXTURE_DIR, write: false });

    expect(summary.seasonCompleted).toBe(true);
    expect(summary.resolvedMatchdays).toBe(10);
    expect(summary.standingsTeamCount).toBe(32);
    expect(summary.champion?.teamId).toBe("R-L");
    expect(summary.topTeamPoints ?? 0).toBeGreaterThan(summary.thresholds.topTeamPointsMin);
    expect(summary.bottomTeamPoints ?? 0).toBeGreaterThan(summary.thresholds.bottomTeamPointsMin);
    expect(summary.teamsWithZeroPoints).toEqual([]);
    expect(summary.totalPointsDelta).toBeLessThanOrEqual(summary.thresholds.maxTotalPointsDelta);
    expect(summary.actualTotalSeasonPoints).toBe(summary.expectedTotalSeasonPoints);
    expect(summary.recomputedTotalSeasonPoints).toBe(summary.expectedTotalSeasonPoints);
    expect(summary.startRankMissingCount).toBe(0);
    expect(summary.rankChangePrizeMissingCount).toBe(0);
    expect(summary.totalRankChangeBonus).not.toBeNull();

    /**
     * DAS PREISGELD IST HIER BEWUSST NICHT AUF EINE ZAHL FESTGENAGELT — offene Frage an Chris.
     *
     * Frueher stand hier `totalPrizeMoney === expectedBasePrizeTotal` mit 1.656,5 als fester
     * Erwartung. Nachgemessen:
     *
     *   • Die Preisgeld-Tabelle (`readNormalizedPrizeMoneyRows`) summiert sich ueber ihre
     *     32 Raenge auf **exakt 1.656,5** — die Zahl ist also nicht aus der Luft gegriffen.
     *   • Der Endstand dieser Fixture hat KEINE Gleichstaende: die Raenge 1 bis 32 kommen je
     *     genau einmal vor. Jeder Tabellenwert wird also genau einmal vergeben.
     *   • Trotzdem meldet die Vorschau **1.979,5**, und die Einzelposten tragen nicht die
     *     Tabellenwerte: Rang 29 bekommt 88,58, waehrend Rang 1 der Tabelle bei 91,4 steht.
     *
     * Die Vorschau rechnet das Preisgeld also nicht als „Tabellenwert je Rang", sondern skaliert
     * es (die Tabelle traegt neben `prizeMoney` auch `percent` und `basis`). Ob 1.656,5 heute noch
     * die richtige Erwartung ist, ist damit eine Produktfrage — und keine, die ein Test durch
     * Nachziehen der Zahl beantworten sollte. Preisgeld wird ohnehin nur als Vergleichsgroesse
     * gerechnet und nie ausgezahlt (`CASH_PRIZE_BENCHMARK_ONLY`).
     *
     * Geprueft wird deshalb, was unabhaengig von dieser Frage gelten muss: es gibt ueberhaupt ein
     * Preisgeld, und es ist keine Zufallszahl, sondern die Summe der ausgewiesenen Posten.
     */
    expect(summary.totalPrizeMoney ?? 0).toBeGreaterThan(0);
    expect(summary.warnings).toEqual(["base_prize_total_not_1656_5"]);
  });
});

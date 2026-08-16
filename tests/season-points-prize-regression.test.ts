import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
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

/**
 * DIE KADER-/GEHALTS-BASIS MUSS AUS DERSELBEN AUSLEITUNG KOMMEN WIE DIE STANDINGS —
 * sonst rechnet das Preisgeld gegen eine andere Liga, als die, deren Endstand geprueft wird.
 *
 * `runSeasonPointsPrizeRegressionSmoke` uebernimmt Kader/Gehaelter NICHT aus den CSVs (die tragen
 * nur `correctedRank`/`correctedPoints`/`cash`), sondern liest sie ueber `persistence.getActiveSave()`
 * — ohne uebergebene `persistence` also aus dem LOKALEN SQLite-Store der Maschine. Nachgemessen:
 * genau das war die Ursache eines dritten, ebenfalls widerspruechlichen `totalPrizeMoney`-Werts. Auf
 * diesem Rechner (leerer Store -> Bootstrap-Spielstand) kam **1.979,5** heraus, direkt auf dem
 * durchgespielten Save dieser Fixture (`arena-season1-save.json.gz`, echte Kader/Gehaelter der
 * Meister-Saison) dagegen **3.708,9** — beide durch dieselbe Vorschau, nur mit verschiedenen
 * Gehalts-Basen. Das Preisgeld ist von Natur aus KEINE feste Zahl (`buildPrizeMoneyTable` skaliert
 * bewusst mit der Liga-Gehaltssumme und dem Saison-Wirtschaftsfaktor, siehe dortiger Kommentar) —
 * aber innerhalb EINES Regressionslaufs darf es nicht von einem Spielstand abhaengen, der mit der
 * geprueften Saison gar nichts zu tun hat.
 *
 * Die hier gebaute Persistenz liefert deshalb denselben Spielstand, der auch die Kaderzeilen fuer
 * `discipline-stage-arena-canonical-ovr.test.ts` stellt (`arena-season1-save.json.gz`) als
 * `getActiveSave()`. `runSeasonPointsPrizeRegressionSmoke` ueberschreibt darauf wie gehabt nur
 * Saison/Cash/Standings aus den CSVs — Kader und Gehaelter bleiben die der Fixture. Damit haengt
 * `totalPrizeMoney` nur noch von der Fixture ab, nicht mehr vom Rechner, auf dem der Test laeuft.
 */
const ARENA_SAVE_PATH = path.join(FIXTURE_DIR, "arena-season1-save.json.gz");

function loadFixtureActiveSavePersistence(): PersistenceService {
  const raw = JSON.parse(gunzipSync(readFileSync(ARENA_SAVE_PATH)).toString("utf8")) as
    | { gameState?: GameState }
    | GameState;
  const gameState = ("gameState" in raw ? raw.gameState : raw) as GameState;
  const save: PersistedSaveGame = {
    saveId: "season1-regression-fixture-source",
    name: "Season 1 Regression Fixture Source",
    status: "active",
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
    gameState,
  };

  return {
    bootstrapSingleplayerSave: () => ({ save, createdFromSeed: false }),
    getActiveSave: () => save,
    getSaveById: (saveId: string) => (saveId === save.saveId ? save : null),
    getSaveVersionMetadata: () => null,
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

describe("season points and prize regression smoke", () => {
  it("keeps completed Season 1 points and prize rank-change plausible", async () => {
    const summary = await runSeasonPointsPrizeRegressionSmoke({
      outputDir: FIXTURE_DIR,
      write: false,
      persistence: loadFixtureActiveSavePersistence(),
    });

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
     * DIE OFFENE FRAGE IST GEKLAERT — das Preisgeld darf wieder auf eine Zahl festgenagelt werden.
     *
     * Frueher stand hier `totalPrizeMoney === expectedBasePrizeTotal` mit 1.656,5 — der Summe der
     * STATISCHEN Referenztabelle (`readNormalizedPrizeMoneyRows`, `references/sheets/prize-money-
     * table.normalized.json`). Die Tabelle stimmt: 32 Raenge, keine Gleichstaende im Endstand,
     * Summe exakt 1.656,5. Nur war das die falsche Vergleichsgroesse, denn `buildPrizeMoneyPreview`
     * liest diese Tabelle nur als FALLBACK. Bei jeder gespielten Saison — auch dieser Fixture —
     * nimmt sie den dynamischen Pfad und skaliert `buildPrizeMoneyTable(currentLeagueSalaries,
     * currentFactor, ...)` mit der ECHTEN Liga-Gehaltssumme und dem Saison-Wirtschaftsfaktor dieses
     * Spielstands (Herleitung mit Formel und Kommentaren in `lib/season/prize-money-preview.ts` bei
     * der Zuweisung von `prizeRows`, und in `lib/season/prize-money.ts` bei `buildPrizeMoneyTable`).
     * Die Tabellenspalte `prizeMoney` ist damit kein Zahlungsversprechen, sondern nur ein
     * eingefrorenes Beispiel einer inzwischen abgeloesten Formel-Version — siehe deren Dokumentation
     * an genau dieser Stelle.
     *
     * `buildPrizeMoneyPreview` rechnet also RICHTIG; nur `expectedBasePrizeTotal` verglich die
     * falsche Groesse. Nachgezogen ist jetzt `EXPECTED_TOTAL_PRIZE_MONEY` in
     * `lib/season/season-points-prize-regression.ts` — nicht die Summe der Tabelle, sondern das
     * Ergebnis des DYNAMISCHEN Pfads auf den echten Kadern/Gehaeltern dieser Fixture
     * (`arena-season1-save.json.gz`, oben zur Persistenz verdrahtet): **3.708,9**. Wie
     * `champion`/`resolvedMatchdays` ist das ein fixture-gebundener Wert, keine Balancing-Zahl —
     * wer die Fixture neu erzeugt, zieht ihn mit einem frischen Messlauf mit.
     */
    expect(summary.totalPrizeMoney).toBe(summary.thresholds.expectedTotalPrizeMoney);
    expect(summary.warnings).toEqual([]);
  });
});

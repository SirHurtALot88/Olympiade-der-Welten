/**
 * GEMELDET AUS DEM SPIEL: "in der arena starten die teams teilweise nach ihrer
 * endplatzierung sortiert! DAS IST FALSCH! Es wird von oben nach unten oder links nach
 * rechts immer nach aktueller saisonplatzierung gestartet! sonst spoilert das extrem"
 *
 * Ursache: beide Quellen der Bühne liefern nach ERGEBNIS sortiert.
 * - Engine: `teamResults` kommt aus `rankDescendingSharedTies(..., result.score)`
 *   (`legacy-matchday-resolve-engine.ts`) — also Sieger zuerst.
 * - Modell: `discipline-stage-data.ts` sortiert `b.total - a.total`.
 *
 * Die Arena richtet ihre Bahn-Nummerierung (`laneIdx`) zwar am Saisonrang aus, aber nur ein
 * Teil der rund zwanzig Disziplin-Renderer liest den — die übrigen zeichnen in
 * Array-Reihenfolge. Daher trat der Spoiler nur in EINIGEN Disziplinen auf ("teilweise").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { orderStageTeamsBySeasonRank } from "@/lib/foundation/discipline-stage/discipline-stage-team-order";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Arena-Startreihenfolge folgt dem Saisonstand, nicht dem Ergebnis", () => {
  /** Der gemeldete Fall: die Eingabe kommt in Endplatzierung, heraus muss Saisonstand. */
  it("dreht die vom Ergebnis diktierte Reihenfolge auf den Saisonstand", () => {
    // So liefert die Engine: Sieger zuerst. Die Saisonränge stehen dazu quer.
    const byResult = [
      { code: "Z-Z", teamId: "Z-Z", seasonRank: 30 },
      { code: "A-A", teamId: "A-A", seasonRank: 4 },
      { code: "M-M", teamId: "M-M", seasonRank: 1 },
      { code: "K-K", teamId: "K-K", seasonRank: 12 },
    ];
    expect(orderStageTeamsBySeasonRank(byResult).map((team) => team.code)).toEqual([
      "M-M",
      "A-A",
      "K-K",
      "Z-Z",
    ]);
  });

  it("laesst die Eingabe unveraendert", () => {
    // Die Bühne memoisiert ihr Team-Array; ein In-Place-Sort würde die Identität unter
    // laufender Simulation umstellen und die Arena auf Runde 0 zurückwerfen.
    const input = [
      { code: "B-B", teamId: "B-B", seasonRank: 9 },
      { code: "A-A", teamId: "A-A", seasonRank: 2 },
    ];
    const before = input.map((team) => team.code);
    orderStageTeamsBySeasonRank(input);
    expect(input.map((team) => team.code)).toEqual(before);
  });

  /**
   * Saisonränge haben Lücken (geteilte Ränge, fehlende Zeilen). Sortiert wird nach dem
   * WERT, nicht nach Array-Position — sonst käme die Ergebnis-Reihenfolge zurück.
   */
  it("kommt mit Luecken in den Saisonraengen zurecht", () => {
    const withGaps = [
      { code: "C-C", teamId: "C-C", seasonRank: 31 },
      { code: "A-A", teamId: "A-A", seasonRank: 7 },
      { code: "B-B", teamId: "B-B", seasonRank: 7 },
    ];
    // Gleicher Rang → stabil nach Team-Id, nicht nach Eingangsreihenfolge.
    expect(orderStageTeamsBySeasonRank(withGaps).map((team) => team.code)).toEqual(["A-A", "B-B", "C-C"]);
  });

  /**
   * DER HEIKLE FALL: ohne Saisonrang darf NICHT die Eingangsreihenfolge stehen bleiben —
   * die ist die Endplatzierung. Rangloses geht nach hinten und dort stabil nach Team-Id.
   */
  it("laesst ranglose Teams NICHT in Ergebnis-Reihenfolge stehen", () => {
    const partiallyRanked = [
      { code: "Z-Z", teamId: "Z-Z", seasonRank: null }, // Sieger, aber ohne Rang
      { code: "Y-Y", teamId: "Y-Y", seasonRank: undefined }, // Zweiter, ohne Rang
      { code: "A-A", teamId: "A-A", seasonRank: 5 },
    ];
    expect(orderStageTeamsBySeasonRank(partiallyRanked).map((team) => team.code)).toEqual([
      "A-A",
      "Y-Y",
      "Z-Z",
    ]);
  });

  it("faellt auf den Team-Code zurueck, wenn die Team-Id fehlt", () => {
    const withoutIds = [
      { code: "B-B", teamId: null, seasonRank: null },
      { code: "A-A", teamId: null, seasonRank: null },
    ];
    expect(orderStageTeamsBySeasonRank(withoutIds).map((team) => team.code)).toEqual(["A-A", "B-B"]);
  });
});

describe("Die Buehne wendet die Reihenfolge auch an", () => {
  it("sortiert das Team-Array, bevor es die Arena erreicht", () => {
    const arena = read("app/foundation/discipline-stage/DisciplineStageArena.tsx");
    expect(arena).toContain("orderStageTeamsBySeasonRank(teams)");
    // Und zwar an der Grenze (im `payload`), nicht irgendwo hinter der Arena — sonst
    // greift es nur fuer die Renderer, die ohnehin `laneIdx` lesen.
    expect(arena).toContain("teams: orderStageTeamsBySeasonRank(teams)");
  });

  /**
   * Gegenprobe zur Ursache: die Engine sortiert weiterhin nach Score. Aendert sich das
   * eines Tages, ist die Begruendung oben hinfaellig — dann soll dieser Test auffallen.
   */
  it("die Engine liefert weiterhin nach Score sortiert (die Ursache besteht fort)", () => {
    const engine = read("lib/resolve/legacy-matchday-resolve-engine.ts");
    expect(engine).toContain("const teamResultsRanked = rankDescendingSharedTies(");
    expect(engine).toContain("(result) => result.score,");
  });
});

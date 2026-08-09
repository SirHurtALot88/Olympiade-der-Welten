/**
 * LIGA-KALIBRIERUNG DER VORSTANDSZIELE — die Herleitung ohne GameState.
 *
 * ANLASS (Chris, am Live-Save nachgemessen, Saison 2, Spieltag 4): das Finanzziel stand ligaweit
 * bei 21 „verfehlt", 9 „gefährdet" und 0 „erfüllt". Feste Marken (78% Gehaltsquote, 65% Budget als
 * Cashpuffer, 8 Mio Transferdeckel) trafen einen Zustand, den kein Team der Liga erreichen konnte.
 *
 * Diese Datei prüft den Ersatz an seiner engsten Stelle: vier reine Funktionen ohne Spielstand.
 * Die Ziele selbst (`team-season-objectives-service.ts`) hängen an der Vergabe — dort zeigt der
 * Vorstand je Kategorie die druckvollste Vorgabe, was den Blick auf die Kalibrierung verstellt.
 * Hier steht sie nackt.
 */
import { describe, expect, it } from "vitest";

import {
  buildLeagueMetricStanding,
  capProvisionalObjectiveStatus,
  isCashDistress,
  resolveLeagueRankTarget,
  statusForLeagueRank,
} from "@/lib/board/board-objective-league-calibration";

describe("buildLeagueMetricStanding", () => {
  const liga = [
    { teamId: "A", value: 10 },
    { teamId: "B", value: 20 },
    { teamId: "C", value: 30 },
    { teamId: "D", value: 40 },
  ];

  it("zaehlt bei 'kleiner ist besser' den kleinsten Wert als Rang 1", () => {
    expect(buildLeagueMetricStanding({ teamId: "A", values: liga, direction: "lower_is_better" }).rank).toBe(1);
    expect(buildLeagueMetricStanding({ teamId: "D", values: liga, direction: "lower_is_better" }).rank).toBe(4);
  });

  it("dreht die Reihenfolge bei 'groesser ist besser' um", () => {
    expect(buildLeagueMetricStanding({ teamId: "D", values: liga, direction: "higher_is_better" }).rank).toBe(1);
    expect(buildLeagueMetricStanding({ teamId: "A", values: liga, direction: "higher_is_better" }).rank).toBe(4);
  });

  it("liefert den Median ueber alle bewerteten Teams", () => {
    // Vier Werte: Mittel aus den beiden mittleren (20 und 30).
    expect(buildLeagueMetricStanding({ teamId: "A", values: liga, direction: "lower_is_better" }).median).toBe(25);
    // Ungerade Anzahl: der mittlere Wert selbst.
    expect(
      buildLeagueMetricStanding({ teamId: "A", values: liga.slice(0, 3), direction: "lower_is_better" }).median,
    ).toBe(20);
  });

  /**
   * Gleichstand darf NICHT nach Array-Reihenfolge getrennt werden. Zwei Teams mit exakt derselben
   * Gehaltsquote stehen auf demselben Rang — sonst entschiede die Sortierstabilität darüber, wer
   * sein Saisonziel erfüllt.
   */
  it("gibt Teams mit gleichem Wert denselben Rang", () => {
    const gleichstand = [
      { teamId: "A", value: 10 },
      { teamId: "B", value: 10 },
      { teamId: "C", value: 30 },
    ];
    expect(buildLeagueMetricStanding({ teamId: "A", values: gleichstand, direction: "lower_is_better" }).rank).toBe(1);
    expect(buildLeagueMetricStanding({ teamId: "B", values: gleichstand, direction: "lower_is_better" }).rank).toBe(1);
    // Nach zwei geteilten Ersten folgt Rang 3, nicht Rang 2.
    expect(buildLeagueMetricStanding({ teamId: "C", values: gleichstand, direction: "lower_is_better" }).rank).toBe(3);
  });

  /**
   * Teams ohne Wert zaehlen nicht mit. Sonst verschöbe ein Team, das seine Formkarten noch nicht
   * gespielt hat, den Rang aller anderen — und der Zielrang bezöge sich auf ein Feld, das es so
   * nicht gibt.
   */
  it("laesst Teams ohne Wert aus der Bezugsgroesse heraus", () => {
    const mitLuecken = [
      { teamId: "A", value: 10 },
      { teamId: "B", value: null },
      { teamId: "C", value: 30 },
      { teamId: "D", value: null },
    ];
    const standing = buildLeagueMetricStanding({ teamId: "C", values: mitLuecken, direction: "lower_is_better" });
    expect(standing.teamCount).toBe(2);
    expect(standing.rank).toBe(2);
  });

  it("meldet Rang null fuer ein Team ohne eigenen Wert", () => {
    const standing = buildLeagueMetricStanding({
      teamId: "B",
      values: [
        { teamId: "A", value: 10 },
        { teamId: "B", value: null },
      ],
      direction: "lower_is_better",
    });
    expect(standing.rank).toBeNull();
    expect(standing.value).toBeNull();
  });
});

describe("resolveLeagueRankTarget", () => {
  /**
   * Die Spanne ist nach BEIDEN Seiten begrenzt. Ein Ziel, das nur ein einziges Team erreichen kann,
   * wäre derselbe Fehler wie die alte feste Marke, nur mit anderem Vorzeichen.
   */
  it("bleibt zwischen oberem Viertel und unterem Viertel", () => {
    const streng = resolveLeagueRankTarget({ teamCount: 32, demand: 10 });
    const mittel = resolveLeagueRankTarget({ teamCount: 32, demand: 5 });
    const mild = resolveLeagueRankTarget({ teamCount: 32, demand: 0 });

    expect(streng.targetRank).toBe(8);
    expect(mittel.targetRank).toBe(16);
    expect(mild.targetRank).toBe(24);
    expect(streng.bandLabel).toBe("oberes Viertel");
    expect(mittel.bandLabel).toBe("obere Hälfte");
    expect(mild.bandLabel).toBe("vor dem unteren Viertel");
  });

  it("faengt unsinnige Anspruchswerte ab", () => {
    expect(resolveLeagueRankTarget({ teamCount: 32, demand: 99 }).targetRank).toBe(8);
    expect(resolveLeagueRankTarget({ teamCount: 32, demand: -5 }).targetRank).toBe(24);
    expect(resolveLeagueRankTarget({ teamCount: 32, demand: Number.NaN }).targetRank).toBe(16);
  });

  it("bleibt in sehr kleinen Ligen bei mindestens Rang 1 und hoechstens der Ligagroesse", () => {
    expect(resolveLeagueRankTarget({ teamCount: 1, demand: 10 }).targetRank).toBe(1);
    expect(resolveLeagueRankTarget({ teamCount: 2, demand: 0 }).targetRank).toBe(2);
  });
});

describe("statusForLeagueRank", () => {
  it("erfuellt auf und ueber der Marke, gefaehrdet knapp darunter, verfehlt weit darunter", () => {
    expect(statusForLeagueRank({ rank: 16, targetRank: 16, teamCount: 32 })).toBe("completed");
    expect(statusForLeagueRank({ rank: 1, targetRank: 16, teamCount: 32 })).toBe("completed");
    // Streifen = 10% der Liga, also 3 Plaetze bei 32 Teams.
    expect(statusForLeagueRank({ rank: 19, targetRank: 16, teamCount: 32 })).toBe("at_risk");
    expect(statusForLeagueRank({ rank: 20, targetRank: 16, teamCount: 32 })).toBe("failed");
  });

  it("haelt den Streifen auch in kleinen Ligen bei mindestens zwei Plaetzen", () => {
    expect(statusForLeagueRank({ rank: 4, targetRank: 2, teamCount: 4 })).toBe("at_risk");
    expect(statusForLeagueRank({ rank: 5, targetRank: 2, teamCount: 4 })).toBe("failed");
  });

  it("bleibt offen, solange das Team keinen Rang hat", () => {
    expect(statusForLeagueRank({ rank: null, targetRank: 16, teamCount: 32 })).toBe("open");
  });
});

describe("capProvisionalObjectiveStatus", () => {
  it("macht aus 'verfehlt' ein 'gefaehrdet' und laesst alles andere stehen", () => {
    expect(capProvisionalObjectiveStatus("failed")).toBe("at_risk");
    expect(capProvisionalObjectiveStatus("at_risk")).toBe("at_risk");
    expect(capProvisionalObjectiveStatus("completed")).toBe("completed");
    expect(capProvisionalObjectiveStatus("open")).toBe("open");
  });
});

describe("isCashDistress", () => {
  it("erkennt nur ein echtes Minus", () => {
    expect(isCashDistress(-0.1)).toBe(true);
    expect(isCashDistress(0)).toBe(false);
    expect(isCashDistress(12)).toBe(false);
  });

  it("wertet fehlende oder unsinnige Werte nicht als Notlage", () => {
    expect(isCashDistress(null)).toBe(false);
    expect(isCashDistress(undefined)).toBe(false);
    expect(isCashDistress(Number.NaN)).toBe(false);
  });
});

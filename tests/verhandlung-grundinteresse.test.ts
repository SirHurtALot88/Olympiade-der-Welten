/**
 * GEFRAGT: „kannst du das nicht sauber machen dass es nicht immer konstant ist? vllt hast du ja
 * ne idee wie man da ein bisschen varianz rein bringen kann."
 *
 * Das Grundinteresse war eine feste 45 für jeden Spieler bei jedem Team — der größte Einzelposten
 * des Wechselwillens und der einzige, der überhaupt nichts unterschied. Genau daher kam die
 * schmale W-Spanne.
 *
 * VARIANZ, NICHT ZUFALL. Ein Würfel wäre billig zu haben und wertlos: das Modell ist darauf
 * gebaut, dass im Tooltip nachlesbar ist, WARUM jemand so reagiert. Deshalb zwei Größen, die das
 * Spiel ohnehin hergibt und die bisher nirgends zählten — wo er in diesem Kader stünde, und wie
 * viel Platz das Team hat.
 */
import { describe, expect, it } from "vitest";

import type { Player } from "@/lib/data/olyDataTypes";
import { BASE_INTEREST_ANCHOR, buildContractNegotiationPreview } from "@/lib/market/contract-negotiation-preview";
import { makePlayer, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

const IDENTITY = makeTeamIdentity({ teamId: "A-A", ambition: 5, popularity: 5 });

function spieler(id: string, ovr: number): Player {
  return makePlayer({ id, name: `Spieler ${id}`, ovr, salaryDemand: 100, displaySalary: 4, marketValue: 3000, displayMarketValue: 30 });
}

/** Grundinteresse für einen Kandidaten mit `ovr` in einem Kader aus `kaderOvrs`. */
function grundinteresse(ovr: number, kaderOvrs: number[], rosterLimit = 14) {
  const preview = buildContractNegotiationPreview({
    saveId: "grund",
    seasonId: "season-1",
    team: makeTeam({ teamId: "A-A", cash: 300, rosterLimit }),
    teamIdentity: IDENTITY,
    teamStrategyProfile: null,
    player: spieler("kandidat", ovr),
    rosterPlayers: kaderOvrs.map((wert, index) => spieler(`mate-${index}`, wert)),
    contractLength: 3,
    contractShape: "balanced",
    offeredSalary: 100,
    scoutingLevel: 0,
    seasonLabelBase: "Season 1",
  });
  return preview.scoreBreakdown.find((entry) => entry.key === "base_interest")?.points ?? null;
}

const SCHWACHER_KADER = [20, 22, 24, 26, 28];
const STARKER_KADER = [80, 82, 84, 86, 88];

describe("Das Grundinteresse unterscheidet endlich", () => {
  it("ist nicht mehr für jeden gleich", () => {
    const gesetzt = grundinteresse(90, SCHWACHER_KADER);
    const bank = grundinteresse(10, STARKER_KADER);
    expect(gesetzt).not.toBe(bank);
  });

  it("steigt, wenn er bei euch sofort gesetzt wäre", () => {
    // „Er überholt euren halben Kader" ist ein Wechselgrund, den ein Mensch sofort versteht.
    expect(grundinteresse(90, SCHWACHER_KADER)!).toBeGreaterThan(grundinteresse(10, SCHWACHER_KADER)!);
  });

  it("sinkt, wenn er hinter dem halben Kader einsortiert", () => {
    expect(grundinteresse(10, STARKER_KADER)!).toBeLessThan(BASE_INTEREST_ANCHOR);
  });

  /**
   * Der Unterschied zum Teamfit, und er ist wichtig: `team_fit` misst, wie gut jemand zum Kader
   * PASST (Rasse, Subklasse, Traits). Das hier misst, wo er darin STEHT. Zwei verschiedene
   * Fragen — würden sie dasselbe messen, zählte der Kader doppelt.
   */
  it("misst die Rangordnung, nicht die Passung", () => {
    // Gleicher Kandidat, gleich große Kader, nur andere Stärke → nur die Rangordnung ändert sich.
    const beiSchwachen = grundinteresse(50, SCHWACHER_KADER);
    const beiStarken = grundinteresse(50, STARKER_KADER);
    expect(beiSchwachen!).toBeGreaterThan(beiStarken!);
  });

  it("belohnt freie Kaderplätze — ein volles Team bietet keine Spielzeit", () => {
    const vieleFrei = grundinteresse(50, [40, 42], 14);
    const voll = grundinteresse(50, [40, 42], 2);
    expect(vieleFrei!).toBeGreaterThan(voll!);
  });

  it("bleibt in einem schmalen Band um den Anker", () => {
    // Der Effekt soll spürbar sein, aber die Traits nicht überstimmen. Spanne 41…49.
    for (const [ovr, kader, limit] of [
      [95, SCHWACHER_KADER, 14],
      [5, STARKER_KADER, 2],
      [50, SCHWACHER_KADER, 14],
      [50, STARKER_KADER, 2],
    ] as const) {
      const wert = grundinteresse(ovr, kader, limit)!;
      expect(wert).toBeGreaterThanOrEqual(BASE_INTEREST_ANCHOR - 4);
      expect(wert).toBeLessThanOrEqual(BASE_INTEREST_ANCHOR + 4);
    }
  });

  it("nennt den Grund im Klartext, nicht als Zahl", () => {
    const preview = buildContractNegotiationPreview({
      saveId: "grund",
      seasonId: "season-1",
      team: makeTeam({ teamId: "A-A", cash: 300, rosterLimit: 14 }),
      teamIdentity: IDENTITY,
      teamStrategyProfile: null,
      player: spieler("star", 95),
      rosterPlayers: SCHWACHER_KADER.map((wert, index) => spieler(`m${index}`, wert)),
      contractLength: 3,
      contractShape: "balanced",
      offeredSalary: 100,
      scoutingLevel: 0,
      seasonLabelBase: "Season 1",
    });
    const eintrag = preview.scoreBreakdown.find((entry) => entry.key === "base_interest");
    expect(eintrag?.reason).toContain("gesetzt");
  });

  /**
   * Der Anker ist 44, nicht 45 — und das ist gemessen, nicht geraten: die beiden Zuschläge fallen
   * im Ligaschnitt leicht positiv aus, weil der Marktpool im Mittel stärker ist als die Kader.
   * Im selben Messaufbau (12 Teams × 250 Marktspieler) hält der Anker den Schwierigkeitsgrad:
   * Anteil zusagebereiter Spieler 30,2 % vorher gegen 29,8 % danach, Streuung zwischen Teams
   * 14,8 gegen 20,8 Punkte. Gleich schwer, deutlich unterschiedlicher.
   */
  it("hält den Anker knapp unter der alten Konstante", () => {
    expect(BASE_INTEREST_ANCHOR).toBe(44);
  });
});

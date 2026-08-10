/**
 * HOME · TOP-KADER: DIE BESTEN SECHS SIND DIE MIT DEM HÖCHSTEN OVR.
 *
 * GEMELDET VON CHRIS: „home top 6 sollten doch nach OVR geordnet sein".
 *
 * Sortiert wurde vorher nach Rollen-Tag (`star|core|starter` nach vorn), dann Saison-PPs, dann
 * MVS — OVR war das LETZTE Kriterium und kam praktisch nie zum Zug. Im Live-Save stand deshalb
 * Tahra mit OVR 59,9 auf Platz 4 vor Spineshard mit 74,1, weil sie einen Punkt mehr gesammelt
 * hatte. Unter der Überschrift „Deine besten 6" liest sich das wie ein Fehler.
 *
 * Diese Suite baut genau die gemeldete Konstellation nach.
 */
import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { buildHomePlayerCardsFromRoster, type HomeV2RosterTableRow } from "@/lib/foundation/tabs/home-v2-ui-helpers";

function spieler(id: string, name: string): Player {
  return {
    id,
    name,
    rating: 50,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    pps: null,
    ovr: null,
    className: "Berserker",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  } as Player;
}

function zeile(input: {
  id: string;
  name: string;
  ovr: number | null;
  pps: number | null;
  mvs?: number | null;
  roleTag?: string | null;
}): HomeV2RosterTableRow {
  return {
    entry: { id: `r-${input.id}`, teamId: "S-C", playerId: input.id, roleTag: input.roleTag ?? null } as RosterEntry,
    player: spieler(input.id, input.name),
    playerOvr: input.ovr,
    playerPps: input.pps,
    playerMvs: input.mvs ?? null,
  };
}

function baue(rows: HomeV2RosterTableRow[]) {
  return buildHomePlayerCardsFromRoster({
    gameState: { teams: [], players: rows.map((row) => row.player), rosters: rows.map((row) => row.entry) } as unknown as GameState,
    selectedRosterTableRows: rows,
    playerRatingsById: new Map(),
    playerSeasonPerformanceMap: new Map(),
  }).map((row) => row.player.name);
}

describe("Home · Top-Kader", () => {
  /** Die gemeldete Konstellation, Zahlen aus dem Screenshot. */
  it("stellt den staerkeren Spieler nach vorn, auch wenn der schwaechere mehr Punkte hat", () => {
    const reihenfolge = baue([
      zeile({ id: "tahra", name: "Tahra", ovr: 59.9, pps: 12.6 }),
      zeile({ id: "spineshard", name: "Spineshard", ovr: 74.1, pps: 11.6 }),
    ]);

    // Vorher stand Tahra vorn — 1 PP mehr schlug 14 OVR weniger.
    expect(reihenfolge).toEqual(["Spineshard", "Tahra"]);
  });

  it("ignoriert den Rollen-Tag", () => {
    const reihenfolge = baue([
      zeile({ id: "reserve", name: "Starker Reservist", ovr: 80, pps: 0, roleTag: "reserve" }),
      zeile({ id: "star", name: "Schwacher Stammspieler", ovr: 50, pps: 0, roleTag: "star" }),
    ]);

    expect(reihenfolge).toEqual(["Starker Reservist", "Schwacher Stammspieler"]);
  });

  it("bricht Gleichstand ueber die Saison-PPs, danach ueber MVS", () => {
    expect(
      baue([
        zeile({ id: "a", name: "Wenig PPs", ovr: 70, pps: 3 }),
        zeile({ id: "b", name: "Viel PPs", ovr: 70, pps: 9 }),
      ]),
    ).toEqual(["Viel PPs", "Wenig PPs"]);

    expect(
      baue([
        zeile({ id: "c", name: "Kleiner MVS", ovr: 70, pps: 5, mvs: 4 }),
        zeile({ id: "d", name: "Grosser MVS", ovr: 70, pps: 5, mvs: 22 }),
      ]),
    ).toEqual(["Grosser MVS", "Kleiner MVS"]);
  });

  /** Ein fehlender OVR ist kein Spitzenwert — sonst stuende ein unbewerteter Spieler ganz vorn. */
  it("sortiert Spieler ohne OVR nach hinten", () => {
    const reihenfolge = baue([
      zeile({ id: "ohne", name: "Ohne OVR", ovr: null, pps: 99 }),
      zeile({ id: "mit", name: "Mit OVR", ovr: 40, pps: 0 }),
    ]);

    expect(reihenfolge).toEqual(["Mit OVR", "Ohne OVR"]);
  });

  it("liefert hoechstens sechs Karten, und zwar die sechs staerksten", () => {
    const reihenfolge = baue(
      [82, 55, 91, 63, 78, 47, 88, 70].map((ovr, index) =>
        zeile({ id: `p${index}`, name: `OVR ${ovr}`, ovr, pps: 0 }),
      ),
    );

    expect(reihenfolge).toEqual(["OVR 91", "OVR 88", "OVR 82", "OVR 78", "OVR 70", "OVR 63"]);
  });
});

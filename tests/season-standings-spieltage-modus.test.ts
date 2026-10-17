import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

import SeasonStandingsNewLook, {
  buildStandingsModeItems,
  NL_STANDINGS_MODE_ITEMS,
} from "@/app/foundation/season-v2/SeasonStandingsNewLook";

/**
 * TASK #159 PUNKT 2 — Saisonstand-UI, 4. Modus "Spieltage".
 *
 * SSR-Smoke nach demselben Muster wie tests/season-standings-liga-split.test.ts: die Komponente
 * startet IMMER im Default-Modus "Daten" (SSR/Client-deterministisch, `NL_STANDINGS_DEFAULT_MODE`),
 * daher prüft dieser Test die beiden SSR-sichtbaren Dinge — ob der Reiter überhaupt angeboten wird
 * (die Subtab-Leiste rendert alle Items sofort, unabhängig vom aktiven Modus) und dass sein
 * Vorhandensein den unveränderten "Daten"-Modus nicht berührt. Die reine Zusammenführungslogik
 * selbst (buildSpieltagsUebersicht, resolveSpielquelleLabel) hat ihre eigenen, feingranularen
 * Tests in tests/season-matchday-fixtures-overview.test.ts.
 */

function makeRow(input: { teamId: string; code: string; rank: number }) {
  return {
    teamId: input.teamId,
    teamCode: input.code,
    teamName: `Team ${input.code}`,
    logoUrl: null,
    logoInitials: input.code,
    rank: input.rank,
    rankDiff: null,
    points: 42,
    pow: 5,
    spe: 4,
    men: 3,
    soc: 2,
    disciplineValues: { bonuspunkte: 1.5, gew: 2 },
    marketValueTotal: 100_000_000,
    cash: 1_000_000,
    sponsorTotal: 2_000_000,
    salaryTotal: 10_000_000,
    buildingCost: null,
    transferNet: null,
    guv: null,
    isSelected: false,
    historicalPointsBySeason: [],
    fieldRaceRankDelta: null,
    leagueTier: null,
  };
}

const BASE_ROWS = [makeRow({ teamId: "t1", code: "A-A", rank: 1 }), makeRow({ teamId: "t2", code: "B-B", rank: 2 })];

function render(spieltage: unknown) {
  return renderToString(
    React.createElement(SeasonStandingsNewLook as never, {
      selectedSeasonId: "S1",
      selectedSeasonLabel: "Saison 1",
      sourceLabel: "live",
      sourceBadgeLabel: "Live",
      isArchived: false,
      seasonOptions: [],
      selectedTeamSummary: null,
      leaderTeam: null,
      momentumTeam: null,
      pressureTeam: null,
      topPlayer: null,
      standingsRows: BASE_ROWS,
      topPlayers: [],
      playerRows: [],
      gmRows: [],
      archiveRows: [],
      disciplineLeaders: [],
      onChangeSeason: () => {},
      onOpenTeam: () => {},
      onOpenPlayer: () => {},
      spieltage,
    } as never),
  );
}

describe("buildStandingsModeItems", () => {
  it("ohne Spieltage-Verfuegbarkeit bleibt die Liste unveraendert (bit-identischer Vertrag)", () => {
    expect(buildStandingsModeItems(false)).toBe(NL_STANDINGS_MODE_ITEMS);
    expect(buildStandingsModeItems(false).map((item) => item.id)).toEqual(["daten", "board", "vereine"]);
  });

  it("mit Verfuegbarkeit kommt \"Spieltage\" als VIERTER Reiter dazu, ohne die ersten drei zu verschieben", () => {
    const items = buildStandingsModeItems(true);
    expect(items.map((item) => item.id)).toEqual(["daten", "board", "vereine", "spieltage"]);
    expect(items.map((item) => item.label)).toContain("Spieltage");
    // NL_STANDINGS_MODE_ITEMS selbst bleibt unangetastet (keine Mutation).
    expect(NL_STANDINGS_MODE_ITEMS.map((item) => item.id)).toEqual(["daten", "board", "vereine"]);
  });
});

describe("SeasonStandingsNewLook — Modus 'Spieltage' (Task #159 Punkt 2)", () => {
  it("ohne spieltage-Prop (Manager-Save/kein Fixture-Plan): kein 'Spieltage'-Reiter", () => {
    const html = render(undefined);
    expect(html).not.toContain(">Spieltage<");
  });

  it("spieltage.verfuegbar === false (z. B. explizit durchgereicht): kein Reiter", () => {
    const html = render({ verfuegbar: false, matchdayOptions: [], defaultMatchdayId: null, overviewByMatchdayId: {} });
    expect(html).not.toContain(">Spieltage<");
  });

  it("spieltage.verfuegbar === true: der Reiter wird angeboten", () => {
    const html = render({
      verfuegbar: true,
      matchdayOptions: [{ id: "md1", index: 0, label: "Spieltag 1", gespielt: true }],
      defaultMatchdayId: "md1",
      overviewByMatchdayId: {
        md1: {
          matchdayId: "md1",
          matchdayIndex: 0,
          paarungen: [],
        },
      },
    });
    expect(html).toContain(">Spieltage<");
  });

  it("der neue Prop aendert den SSR-Output des Default-Modus 'Daten' nicht (bit-identisch)", () => {
    const ohne = render(undefined);
    const mit = render({
      verfuegbar: true,
      matchdayOptions: [{ id: "md1", index: 0, label: "Spieltag 1", gespielt: true }],
      defaultMatchdayId: "md1",
      overviewByMatchdayId: { md1: { matchdayId: "md1", matchdayIndex: 0, paarungen: [] } },
    });
    // Beide starten im "Daten"-Modus (SSR-deterministisch) -- der einzige Unterschied darf der
    // zusaetzliche Subtab-Button selbst sein, nicht die Tabelle/das restliche Markup.
    const stripSubtabs = (html: string) => html.replace(/<nav class="nl-subtabs[^"]*"[^>]*>.*?<\/nav>/s, "");
    expect(stripSubtabs(mit)).toBe(stripSubtabs(ohne));
  });
});

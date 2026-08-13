import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

import SeasonStandingsNewLook from "@/app/foundation/season-v2/SeasonStandingsNewLook";

/**
 * SSR-Smoke der Daten-Tabelle des Saisonstands. Deckt die drei Spalten-Zusagen ab,
 * die sonst nur im Browser auffallen würden:
 *  - MW und Gehälter tragen den Liga-Rang KOMPAKT in derselben Spalte,
 *  - die Formkarten-Spalte zeigt die Summe der gespielten Kartenwerte („—" ohne Karte),
 *  - die Komponente rendert überhaupt durch (die Formkarten-Sortierung liest ihre
 *    Karte schon im Render — eine falsch platzierte Deklaration würfe hier).
 */

function makeRow(input: { teamId: string; code: string; mw: number; salary: number }) {
  return {
    teamId: input.teamId,
    teamCode: input.code,
    teamName: `Team ${input.code}`,
    logoUrl: null,
    logoInitials: input.code,
    rank: 1,
    rankDiff: null,
    points: 42,
    pow: 5,
    spe: 4,
    men: 3,
    soc: 2,
    disciplineValues: { bonuspunkte: 1.5, gew: 2 },
    marketValueTotal: input.mw,
    cash: 1_000_000,
    sponsorTotal: 2_000_000,
    salaryTotal: input.salary,
    buildingCost: null,
    transferNet: null,
    guv: null,
    isSelected: false,
    historicalPointsBySeason: [],
    fieldRaceRankDelta: null,
  };
}

function render(extraProps: Record<string, unknown>) {
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
      standingsRows: [
        makeRow({ teamId: "t1", code: "A-A", mw: 300_000_000, salary: 80_000_000 }),
        makeRow({ teamId: "t2", code: "B-B", mw: 200_000_000, salary: 60_000_000 }),
      ],
      topPlayers: [],
      playerRows: [],
      gmRows: [],
      archiveRows: [],
      disciplineLeaders: [],
      onChangeSeason: () => {},
      onOpenTeam: () => {},
      onOpenPlayer: () => {},
      ...extraProps,
    } as never),
  );
}

describe("SeasonStandingsNewLook — Daten-Tabelle", () => {
  const html = render({
    teamFormCardBonusByTeamId: new Map([
      [
        "t1",
        {
          total: 12,
          cards: 3,
          positive: 16,
          negative: -4,
          poolCards: 6,
          poolPositive: 30,
          poolNegative: -18,
          remainingCards: 3,
          remainingPositive: 14,
          remainingNegative: -14,
        },
      ],
    ]),
  });

  it("hängt den Liga-Rang kompakt an MW und Gehälter (kein eigener Spaltenplatz)", () => {
    expect(html).toContain("nl-standings-rank-suffix");
    expect(html).toContain("Marktwert: Rang 1 von 2 — Team A-A");
    expect(html).toContain("Gehaltssumme: Rang 2 von 2 — Team B-B");
    // Die Ränge stehen IN der MW-/Gehälter-Zelle, nicht in einer neuen Spalte.
    expect(html).toMatch(/nl-standings-td-mw[^>]*>[^<]*<span class="nl-standings-rank-suffix/);
  });

  it("zeigt den Formkarten-Tank (30) und daneben den Rest (14)", () => {
    // Chris: „in der formkarten spalte soll generell immer die summe stehen die AM ANFANG der
    // saison den teams zur verfuegung stand ... dann weiss man wie viel luft noch im tank ist".
    // Vorher stand hier die Summe der GESPIELTEN Nennwerte (+12) — eine Zahl, die bauartbedingt
    // fast immer ≤ 0 ist, weil die Karten als Paar +x/−x kommen und man die Minuskarten zuerst
    // abwirft. Jetzt: voller Tank in „Formkarten", Ungespieltes in „Rest".
    expect(html).toContain("Formkarten");
    expect(html).toContain(">Rest<");
    expect(html).toContain(">30<");
    expect(html).toContain(">14<");
    expect(html).toContain("Formkarten-Tank 30");
    expect(html).toContain("davon noch ungespielt 14");
    expect(html).toContain("gespielt 3 von 6 Karten");
    // Offene Minuskarten kosten am Saisonende Punkte — das steht am Wert.
    expect(html).toContain("offene Minuskarten -14");
    expect(html).toContain('title="Keine Formkarten in dieser Saison — Team B-B"');
  });

  it("rendert auch ohne Formkarten-Karte durch", () => {
    const withoutCards = render({});
    expect(withoutCards).toContain("nl-standings-td-formcards");
    expect(withoutCards.length).toBeGreaterThan(500);
  });
});

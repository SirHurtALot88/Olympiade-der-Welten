import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

import SeasonStandingsNewLook from "@/app/foundation/season-v2/SeasonStandingsNewLook";
import { buildTitleRace } from "@/lib/season/title-race";

/**
 * Meisterschaftskampf-Anzeige im "Neuer Look"-Saisonstand: Kopfzeile + Zeilen-Hervorhebung.
 *
 * `titleRace` kommt hier fertig gerechnet rein (wie vom Host) — diese Tests decken NUR die
 * Anzeige-Logik ab (Randfälle aus der Aufgabe), nicht die `buildTitleRace`-Rechnung selbst
 * (die hat ihre eigenen Tests in `tests/meisterschaftskampf-letzter-spieltag.test.ts`).
 *
 * GEGENPROBE (ausgeführt): mit `git stash` die JSX-Änderungen in `SeasonStandingsNewLook.tsx`
 * zurückgenommen (Prop `titleRace` blieb unbenutzt) — jeder Test hier, der auf
 * `nl-standings-titlerace-note` / `is-title-contender` / `Titelchance` prüft, schlug fehl, weil
 * die Strings im HTML gar nicht mehr vorkamen. Nach `git stash pop` wieder grün.
 */

function makeRow(input: { teamId: string; code: string; points: number }) {
  return {
    teamId: input.teamId,
    teamCode: input.code,
    teamName: `Team ${input.code}`,
    logoUrl: null,
    logoInitials: input.code,
    rank: 1,
    rankDiff: null,
    points: input.points,
    pow: 5,
    spe: 4,
    men: 3,
    soc: 2,
    disciplineValues: { bonuspunkte: 1.5 },
    marketValueTotal: 1_000_000,
    cash: 1_000_000,
    sponsorTotal: 2_000_000,
    salaryTotal: 500_000,
    buildingCost: null,
    transferNet: null,
    guv: null,
    isSelected: false,
    historicalPointsBySeason: [],
    fieldRaceRankDelta: null,
  };
}

const CONTENDER_ROWS = [
  makeRow({ teamId: "t1", code: "A-A", points: 144.3 }),
  makeRow({ teamId: "t2", code: "B-B", points: 133.7 }), // 10,6 zurück — noch drin
  makeRow({ teamId: "t3", code: "C-C", points: 50 }), // weit zurück — raus
];

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
      standingsRows: CONTENDER_ROWS,
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

describe("SeasonStandingsNewLook — Meisterschaftskampf-Kopfzeile", () => {
  it("zeigt ohne titleRace (kein Fenster) gar nichts an", () => {
    const html = render({ titleRace: null });
    expect(html).not.toContain("nl-standings-titlerace-note");
    expect(html).not.toContain("is-title-contender");
    expect(html).not.toContain("Titelchance");
    expect(html).not.toContain("Meisterschaftskampf");
  });

  it("zeigt ohne titleRace-Prop (undefined, Altfall) ebenfalls nichts an", () => {
    const html = render({});
    expect(html).not.toContain("nl-standings-titlerace-note");
    expect(html).not.toContain("is-title-contender");
  });

  it("behandelt leaderId == null wie 'kein Fenster' — nichts anzeigen", () => {
    const race = buildTitleRace([]); // leere Liga → leaderId null
    const html = render({ titleRace: race });
    expect(html).not.toContain("nl-standings-titlerace-note");
    expect(html).not.toContain("is-title-contender");
  });

  it("zeigt bei mehreren Kandidaten die Kontest-Kopfzeile, StatChips (sortiert nach Rückstand) und Zeilen-Tags", () => {
    const race = buildTitleRace(CONTENDER_ROWS.map((row) => ({ teamId: row.teamId, points: row.points })));
    expect(race.contenderIds.size).toBe(2); // t1 (führend) + t2, t3 fällt raus

    const html = render({ titleRace: race });

    expect(html).toContain("nl-standings-titlerace-note");
    // JSX-Interpolationen landen als eigene Text-Knoten (SSR trennt sie mit `<!-- -->`) — darum
    // Textstücke statt eines zusammenhängenden Satzes prüfen.
    expect(html).toContain("Letzter Spieltag — Meisterschaftskampf: ");
    expect(html).toContain(">2<");
    expect(html).toContain("Teams können noch Meister werden");
    // Die Obergrenze (39,6) steht in der Kopfzeile — die Herleitung dahinter
    // ("12 Spieler × 3,3") ist NUR im Tooltip der Chips erlaubt, nicht im sichtbaren Fließtext.
    expect(html).toContain("maximal 39,6 Punkte");
    const noteMatch = html.match(/<p class="nl-standings-titlerace-note"[^>]*>(.*?)<\/p>/);
    expect(noteMatch).not.toBeNull();
    expect(noteMatch?.[1] ?? "").not.toContain("Spieler");
    expect(noteMatch?.[1] ?? "").not.toContain("3,3");
    // Im Tooltip der Chips steht die volle Begründung mit Spieleranzahl und Punkten je Spieler.
    expect(html).toContain("12 Spieler × 3,3");

    // Zeilen-Hervorhebung: t1/t2 tragen die Klasse + den Text-Tag, t3 nicht.
    expect(html).toContain("is-title-contender");
    expect(html).toContain("Titelchance");
    expect((html.match(/is-title-contender/g) ?? []).length).toBeGreaterThan(0);

    // StatChip-Werte: Führender "Spitze", Verfolger "−10,6".
    expect(html).toContain("Spitze");
    expect(html).toContain("−10,6");

    // Team C-C (raus) bekommt keinen "Titelchance"-Tag an seinem Namen.
    const teamCIndex = html.indexOf("Team C-C");
    const nextTeamIndex = html.indexOf("Team A-A", teamCIndex) >= 0 ? html.indexOf("Team A-A", teamCIndex) : html.length;
    const teamCSlice = html.slice(teamCIndex, teamCIndex + 400);
    expect(teamCSlice).not.toContain("Titelchance");
    void nextTeamIndex;
  });

  it("sortiert die Kandidaten-Chips nach Rückstand aufsteigend (Führender zuerst)", () => {
    const race = buildTitleRace(CONTENDER_ROWS.map((row) => ({ teamId: row.teamId, points: row.points })));
    const html = render({ titleRace: race });
    const spitzeIndex = html.indexOf("Spitze");
    const gapIndex = html.indexOf("−10,6");
    expect(spitzeIndex).toBeGreaterThan(-1);
    expect(gapIndex).toBeGreaterThan(-1);
    expect(spitzeIndex).toBeLessThan(gapIndex);
  });

  it("bei Gleichstand an der Spitze steht 'Spitze' statt '−0,0' für BEIDE Teams", () => {
    const tiedRows = [
      makeRow({ teamId: "t1", code: "A-A", points: 100 }),
      makeRow({ teamId: "t2", code: "B-B", points: 100 }),
    ];
    const race = buildTitleRace(tiedRows.map((row) => ({ teamId: row.teamId, points: row.points })));
    const html = render({ standingsRows: tiedRows, titleRace: race });
    expect(html).not.toContain("−0,0");
    expect(html).not.toContain("-0,0");
    // Beide Teams zeigen "Spitze" — zweimal im StatChip-Wert.
    const matches = html.match(/>Spitze</g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("Titel entschieden (nur der Führende selbst 'im Rennen'): andere Kopfzeile, KEINE Zeilen-Hervorhebung", () => {
    const decidedRows = [
      makeRow({ teamId: "t1", code: "A-A", points: 200 }),
      makeRow({ teamId: "t2", code: "B-B", points: 50 }),
    ];
    const race = buildTitleRace(decidedRows.map((row) => ({ teamId: row.teamId, points: row.points })));
    expect(race.contenderIds.size).toBe(1);

    const html = render({ standingsRows: decidedRows, titleRace: race });

    expect(html).toContain("nl-standings-titlerace-note");
    expect(html).toContain("Letzter Spieltag — die Meisterschaft ist entschieden");
    expect(html).toContain("Team A-A");
    expect(html).toContain("ist rechnerisch nicht mehr einzuholen");

    // Keine Zeilen-Hervorhebung, auch nicht für den Führenden selbst.
    expect(html).not.toContain("is-title-contender");
    expect(html).not.toContain("Titelchance");
    // Auch keine Kontest-Kopfzeile/Chips.
    expect(html).not.toContain("können noch Meister werden");
  });
});

/**
 * DIE VERLETZUNGS-MARKE MUSS IM SPIELTAGSERGEBNIS ANKOMMEN — NICHT NUR IN DER ARENA.
 *
 * GEWÜNSCHT VON CHRIS: „es wäre gut wenn man in der score tabelle vllt noch sehen kann wenn ein
 * team einen verletzten spieler hat!" — und danach, gereizt: „warum ist das immernoch nicht da".
 *
 * NACHGEMESSEN IM BROWSER (Save `fresh-season-1-1786550453715`, Saison 2, Spieltag 3, zwei
 * Verletzte): auf `view=matchdayResult` gab es NULL Elemente mit einer Verletzungs-Klasse, obwohl
 * `buildMatchdayInjuryMarks` für denselben Spieltag zwei Teams lieferte. Gebaut war die Marke nur
 * für die Arena-Bühne — also für die Minuten, in denen man zusieht; die Tabelle, auf die Chris
 * NACH dem Spieltag schaut, hatte sie nie.
 *
 * DIESE DATEI PRÜFT WERTE UND MARKUP, keine Quelltext-Zeichenketten:
 *  1. `buildMatchdaySummary` trägt die Marke an der ZEILE (nicht als separater Prop) — mit den
 *     Zahlen, die in den `injuryEvents` stehen.
 *  2. `MatchdayResultNewLook` rendert sie tatsächlich, für genau die betroffenen Teams.
 * Punkt 2 ist der eigentliche Grund für diese Datei: die bekannte Fehlerklasse dieses Repos ist
 * „die Rechnung existiert, die Verdrahtung fehlt". Ein reiner Rechen-Test wäre grün geblieben,
 * während die Seite nichts zeigt.
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MatchdayResultNewLook from "@/app/foundation/matchday-result-v2/MatchdayResultNewLook";
import type { FoundationMatchdayResultShellHostProps } from "@/app/foundation/matchday-result-v2/FoundationMatchdayResultShellHost";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import { buildMatchdaySummary, type MatchdaySummary } from "@/lib/foundation/matchday-summary";

const SEASON = "season-2";
const MD_DAVOR = "season-2-matchday-2";
const MD = "season-2-matchday-3";
const RESULT_ID = "matchday-result__test__season-2__season-2-matchday-3";

function wurf(input: {
  teamId: string;
  playerId: string;
  matchdayId: string;
  result: "healthy" | "injured";
  unavailableUntil?: string | null;
}) {
  return {
    eventId: `injury__${SEASON}__${input.matchdayId}__${input.teamId}__${input.playerId}`,
    seasonId: SEASON,
    matchdayId: input.matchdayId,
    teamId: input.teamId,
    playerId: input.playerId,
    fatigueBefore: 40,
    riskPercent: 5,
    roll: 1,
    result: input.result,
    unavailableForMatchdays: 1,
    unavailableUntil: input.result === "injured" ? (input.unavailableUntil ?? null) : null,
    normalRecovery: 20,
    injuryRecovery: input.result === "injured" ? 10 : null,
    fatigueAfterRecovery: null,
    source: "fatigue_injury_risk_v1",
    timestamp: "2026-08-09T06:34:23.355Z",
  };
}

/**
 * Drei Teams, EIN gewerteter Spieltag. D-L hat sich an diesem Spieltag jemanden geholt, N-N fällt
 * wegen einer Verletzung vom VORspieltag aus (`unavailableUntil`), W-W ist unversehrt — die drei
 * Fälle, die die Marke unterscheiden muss.
 */
function baueSpielstand(): GameState {
  const teams = [
    { teamId: "D-L", name: "Dire Legion", shortCode: "D-L" },
    { teamId: "N-N", name: "Nunchuck Ninjas", shortCode: "N-N" },
    { teamId: "W-W", name: "Wicked Wizards", shortCode: "W-W" },
  ];
  const ergebnis = {
    id: RESULT_ID,
    saveId: "save-local",
    seasonId: SEASON,
    matchdayId: MD,
    status: "preview_applied" as const,
    sourceVersion: "test",
    teamsTotal: 3,
    teamsReady: 3,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
    warningsCount: 0,
    createdAt: "2026-08-09T06:00:00.000Z",
    updatedAt: "2026-08-09T06:00:00.000Z",
  };
  const disziplinZeile = (teamId: string, side: "d1" | "d2", score: number, rank: number) => ({
    id: `dr-${teamId}-${side}`,
    matchdayResultId: RESULT_ID,
    teamId,
    disciplineId: side === "d1" ? "hockey" : "basketball",
    disciplineSide: side,
    rank,
    baseScore: score,
    totalScore: score,
    readinessStatus: "ready" as const,
    warnings: [] as string[],
    createdAt: "2026-08-09T06:00:00.000Z",
  });

  return {
    season: { id: SEASON, name: "S2", year: 2, matchdayIds: [MD_DAVOR, MD] },
    matchdayState: { matchdayId: MD, status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    rosters: [],
    players: [
      { id: "p-timantha", name: "Timantha" },
      { id: "p-arlen", name: "King Arlen Morgolor" },
      { id: "p-ornala", name: "Ornala" },
      { id: "p-ceo", name: "CEO-X9" },
    ],
    disciplines: [
      { id: "hockey", name: "Hockey" },
      { id: "basketball", name: "Basketball" },
    ],
    seasonState: {
      injuryEvents: [
        // D-L: an DIESEM Spieltag zugezogen …
        wurf({ teamId: "D-L", playerId: "p-timantha", matchdayId: MD, result: "injured", unavailableUntil: "season-2-matchday-4" }),
        // … und zusätzlich ein Ausfall aus dem Vorspieltag → zwei betroffene Spieler.
        wurf({ teamId: "D-L", playerId: "p-arlen", matchdayId: MD_DAVOR, result: "injured", unavailableUntil: MD }),
        // N-N: nur Ausfall aus dem Vorspieltag.
        wurf({ teamId: "N-N", playerId: "p-ornala", matchdayId: MD_DAVOR, result: "injured", unavailableUntil: MD }),
        // W-W: gesund gewürfelt — darf KEINE Marke bekommen.
        wurf({ teamId: "W-W", playerId: "p-ceo", matchdayId: MD, result: "healthy" }),
      ],
      playerAvailabilityState: [],
      matchdayResults: [ergebnis],
      disciplineResults: [
        disziplinZeile("D-L", "d1", 100, 3),
        disziplinZeile("D-L", "d2", 90, 3),
        disziplinZeile("N-N", "d1", 120, 2),
        disziplinZeile("N-N", "d2", 110, 2),
        disziplinZeile("W-W", "d1", 140, 1),
        disziplinZeile("W-W", "d2", 130, 1),
      ],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      lineupDrafts: [],
      standings: {},
    },
  } as unknown as GameState;
}

function zeile(summary: MatchdaySummary, teamId: string) {
  const treffer = summary.teamRows.find((row) => row.teamId === teamId);
  expect(treffer, `Zeile fuer ${teamId} fehlt`).toBeTruthy();
  return treffer!;
}

function rendere(summary: MatchdaySummary) {
  const props: FoundationMatchdayResultShellHostProps = {
    sourceBadgeLabel: "SQLite",
    matchdaySummary: summary,
    activeMatchdaySummaryId: MD,
    matchdaySummaryOptions: [{ matchdayId: MD, matchdayNumber: 3, resultId: RESULT_ID }],
    activeTeamMatchdaySummaryRow: summary.teamRows.find((row) => row.teamId === "D-L") ?? null,
    activeManagerTeamId: "D-L",
    selectedTeam: { teamId: "D-L", name: "Dire Legion", shortCode: "D-L" } as unknown as Team,
    resolvedTeamControlSettings: {},
    setSelectedMatchdaySummaryId: () => {},
    setActiveView: () => {},
    openTeamProfileById: () => {},
    triggerGlobalNext: () => {},
  };
  return renderToString(<MatchdayResultNewLook {...props} />);
}

describe("Die Spieltags-Zeile traegt ihre Verletzungsbuchung selbst", () => {
  const summary = buildMatchdaySummary(baueSpielstand(), { seasonId: SEASON, matchdayId: MD });

  it("zaehlt betroffene SPIELER — zugezogen und ausgefallen zusammen", () => {
    // D-L: Timantha (heute zugezogen) + King Arlen (heute ausgefallen) = 2 Spieler.
    expect(zeile(summary, "D-L").injury?.betroffeneSpieler).toBe(2);
    // N-N: nur der Ausfall aus dem Vorspieltag = 1 Spieler.
    expect(zeile(summary, "N-N").injury?.betroffeneSpieler).toBe(1);
  });

  it("laesst ein Team ohne Buchung leer statt es mit einer 0 zu markieren", () => {
    expect(zeile(summary, "W-W").injury).toBeNull();
  });

  it("bringt den Klartext mit, aus dem der Tooltip entsteht — mit den Namen aus der Buchung", () => {
    const text = zeile(summary, "D-L").injury?.beschreibung ?? "";
    expect(text).toContain("Timantha");
    expect(text).toContain("King Arlen Morgolor");
  });

  it("haengt NICHT am gewerteten Ergebnis — ein Spieltag ohne Buchung traegt seine Ausfaelle trotzdem", () => {
    const ohneErgebnis = baueSpielstand();
    (ohneErgebnis.seasonState as { matchdayResults: unknown[] }).matchdayResults = [];
    const summaryOhne = buildMatchdaySummary(ohneErgebnis, { seasonId: SEASON, matchdayId: MD });
    expect(summaryOhne.hasResult).toBe(false);
    expect(zeile(summaryOhne, "D-L").injury?.betroffeneSpieler).toBe(2);
  });
});

describe("Die Marke kommt im gerenderten Spieltagsergebnis an", () => {
  const markup = rendere(buildMatchdaySummary(baueSpielstand(), { seasonId: SEASON, matchdayId: MD }));

  it("rendert genau eine Marke je betroffenem Team", () => {
    const treffer = markup.match(/data-testid="matchday-injury-mark"/g) ?? [];
    expect(treffer.length).toBe(2);
  });

  it("nennt die Einheit — in dieser Tabelle stehen daneben Punkte und Scores", () => {
    expect(markup).toContain("2 Spieler");
    expect(markup).toContain("1 Spieler");
  });

  it("traegt die Spieler-Zahl auch maschinenlesbar, damit sie nicht aus dem Text geraten wird", () => {
    expect(markup).toContain('data-team-injured-players="2"');
    expect(markup).toContain('data-team-injured-players="1"');
  });

  it("ohne jede Verletzung bleibt die Tabelle frei von Marken", () => {
    const sauber = baueSpielstand();
    (sauber.seasonState as { injuryEvents: unknown[] }).injuryEvents = [];
    const ohne = rendere(buildMatchdaySummary(sauber, { seasonId: SEASON, matchdayId: MD }));
    expect(ohne).not.toContain('data-testid="matchday-injury-mark"');
  });
});

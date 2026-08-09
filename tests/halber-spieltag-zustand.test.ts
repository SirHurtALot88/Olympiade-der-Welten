/**
 * Nachprüfung „halber Spieltag" (Season 2, Spieltag 4: nur D1/Staffel gebucht, D2/Takeshi offen):
 * Die drei Seiten erzählten drei Geschichten — Spielplan „läuft" (korrekt), Spieltagsergebnis
 * „TAGESSIEGER" (als wäre der Tag fertig), Arena nach Reload „Läuft, sobald die erste Etappe
 * startet" (als wäre nichts gebucht). Außerdem meldete Home mitten in der Saison „erst 0
 * Spieltage", weil der Feld-Rennen-Ledger im Browser auf dem kompakten Payload rechnete.
 *
 * Dieser Test hält die geteilte Zustandsquelle (getMatchdayScoringProgress: none/partial/
 * complete), ihren Durchgriff in die Spieltags-Zusammenfassung (completion + benannte, noch
 * ungewertete Disziplin) und die Feld-Rennen-Projektion des kompakten Payloads fest.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildMatchdaySummary } from "@/lib/foundation/matchday-summary";
import {
  getMatchdayScoringProgress,
  isMatchdayResultFullyCommitted,
} from "@/lib/season/season-discipline-schedule";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import {
  hydriereFieldRaceProjection,
  projiziereFieldRace,
} from "@/lib/persistence/foundation-field-race-projection";
import { countPlayedFieldRaceMatchdays, getFieldRaceSeasonForm } from "@/lib/foundation/build-field-race-ledger";
import { formatMatchdayHighlight } from "@/lib/foundation/matchday-highlight-labels";

function baueHalbenSpieltag() {
  const gameState = createFreshSeasonOneGameState();
  const [teamA, teamB] = gameState.teams;
  const freePlayers = gameState.players.slice(0, 2);
  gameState.rosters = [
    { id: "r-a", teamId: teamA!.teamId, playerId: freePlayers[0]!.id, contractLength: 2, salary: 5, upkeep: 5, roleTag: "starter", joinedSeasonId: gameState.season.id },
    { id: "r-b", teamId: teamB!.teamId, playerId: freePlayers[1]!.id, contractLength: 2, salary: 5, upkeep: 5, roleTag: "starter", joinedSeasonId: gameState.season.id },
  ];
  gameState.season.matchdayIds = ["matchday-1", "matchday-2"];
  gameState.matchdayState.matchdayId = "matchday-2";

  const resultRecord = (matchdayId: string, id: string) => ({
    id,
    saveId: "save-local",
    seasonId: gameState.season.id,
    matchdayId,
    status: "preview_applied" as const,
    sourceVersion: "test",
    teamsTotal: 2,
    teamsReady: 2,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
    warningsCount: 0,
    createdAt: "2026-06-06T12:00:00.000Z",
    updatedAt: "2026-06-06T12:00:00.000Z",
  });
  const disciplineRow = (input: { id: string; resultId: string; teamId: string; side: "d1" | "d2"; score: number; rank: number }) => ({
    id: input.id,
    matchdayResultId: input.resultId,
    teamId: input.teamId,
    disciplineId: input.side === "d1" ? "mini-dm" : "mini-dm-2",
    disciplineSide: input.side,
    rank: input.rank,
    baseScore: input.score,
    totalScore: input.score,
    readinessStatus: "ready" as const,
    warnings: [] as string[],
    createdAt: "2026-06-06T12:01:00.000Z",
  });
  const performanceRow = (input: { id: string; resultId: string; teamId: string; playerId: string; side: "d1" | "d2"; score: number; rank: number }) => ({
    id: input.id,
    matchdayResultId: input.resultId,
    teamId: input.teamId,
    playerId: input.playerId,
    activePlayerId: input.id,
    disciplineId: input.side === "d1" ? "mini-dm" : "mini-dm-2",
    disciplineSide: input.side,
    slotIndex: 0,
    baseValue: input.score,
    finalPlayerScore: input.score,
    scoreContribution: 1,
    rankInTeam: 1,
    rankInDiscipline: input.rank,
    isTop10: true,
    isMvpCandidate: input.rank === 1,
    storyWeight: 1,
    createdAt: "2026-06-06T12:05:00.000Z",
  });

  // Spieltag 1: KOMPLETT (d1 + d2 gebucht). Spieltag 2 (aktiv): NUR d1 — der halbe Spieltag.
  gameState.seasonState.matchdayResults = [resultRecord("matchday-1", "result-1"), resultRecord("matchday-2", "result-2")];
  gameState.seasonState.disciplineResults = [
    disciplineRow({ id: "d-a-1-d1", resultId: "result-1", teamId: teamA!.teamId, side: "d1", score: 47, rank: 1 }),
    disciplineRow({ id: "d-b-1-d1", resultId: "result-1", teamId: teamB!.teamId, side: "d1", score: 31, rank: 2 }),
    disciplineRow({ id: "d-a-1-d2", resultId: "result-1", teamId: teamA!.teamId, side: "d2", score: 20, rank: 2 }),
    disciplineRow({ id: "d-b-1-d2", resultId: "result-1", teamId: teamB!.teamId, side: "d2", score: 25, rank: 1 }),
    disciplineRow({ id: "d-a-2-d1", resultId: "result-2", teamId: teamA!.teamId, side: "d1", score: 24, rank: 2 }),
    disciplineRow({ id: "d-b-2-d1", resultId: "result-2", teamId: teamB!.teamId, side: "d1", score: 56, rank: 1 }),
  ];
  gameState.seasonState.playerDisciplinePerformances = [
    performanceRow({ id: "p-a-1-d1", resultId: "result-1", teamId: teamA!.teamId, playerId: freePlayers[0]!.id, side: "d1", score: 47, rank: 1 }),
    performanceRow({ id: "p-b-1-d1", resultId: "result-1", teamId: teamB!.teamId, playerId: freePlayers[1]!.id, side: "d1", score: 31, rank: 2 }),
    performanceRow({ id: "p-a-1-d2", resultId: "result-1", teamId: teamA!.teamId, playerId: freePlayers[0]!.id, side: "d2", score: 20, rank: 2 }),
    performanceRow({ id: "p-b-1-d2", resultId: "result-1", teamId: teamB!.teamId, playerId: freePlayers[1]!.id, side: "d2", score: 25, rank: 1 }),
    performanceRow({ id: "p-a-2-d1", resultId: "result-2", teamId: teamA!.teamId, playerId: freePlayers[0]!.id, side: "d1", score: 24, rank: 2 }),
    performanceRow({ id: "p-b-2-d1", resultId: "result-2", teamId: teamB!.teamId, playerId: freePlayers[1]!.id, side: "d1", score: 56, rank: 1 }),
  ];
  return { gameState, teamA: teamA!, teamB: teamB! };
}

describe("getMatchdayScoringProgress — die EINE dreiwertige Zustandsfrage", () => {
  it("erkennt den halben Spieltag als partial und den vollen als complete", () => {
    const { gameState } = baueHalbenSpieltag();

    const komplett = getMatchdayScoringProgress(gameState, "matchday-1");
    expect(komplett.completion).toBe("complete");
    expect(komplett.d1.scored).toBe(true);
    expect(komplett.d2.scored).toBe(true);

    const halb = getMatchdayScoringProgress(gameState, "matchday-2");
    expect(halb.hasResult).toBe(true);
    expect(halb.completion).toBe("partial");
    expect(halb.d1.scored).toBe(true);
    expect(halb.d2.scored).toBe(false);
    // Die noch offene Seite steht beim Namen (Spielplan-Fallback), kein stummes "—".
    expect(halb.d2.displayName).toBeTruthy();

    // Gegenprobe: ohne jedes Ergebnis bleibt es "none" — und der Spieltagswechsel
    // (isMatchdayResultFullyCommitted) hält exakt dieselbe Grenze.
    expect(getMatchdayScoringProgress({ ...gameState, seasonState: { ...gameState.seasonState, matchdayResults: [] } }, "matchday-2").completion).toBe("none");
    expect(isMatchdayResultFullyCommitted(gameState, "matchday-1")).toBe(true);
    expect(isMatchdayResultFullyCommitted(gameState, "matchday-2")).toBe(false);
  });

  it("die Spieltags-Zusammenfassung trägt completion und benennt die offene Disziplin", () => {
    const { gameState } = baueHalbenSpieltag();
    const summary = buildMatchdaySummary(gameState, { matchdayId: "matchday-2" });
    expect(summary.hasResult).toBe(true);
    expect(summary.completion).toBe("partial");
    expect(summary.d2.disciplineName).toBeTruthy();

    const komplett = buildMatchdaySummary(gameState, { matchdayId: "matchday-1" });
    expect(komplett.completion).toBe("complete");
  });
});

describe("Spieltagsergebnis benennt den Zwischenstand statt eines Tagessiegers auf halber Strecke", () => {
  const RESULT = readFileSync(join(process.cwd(), "app/foundation/matchday-result-v2/MatchdayResultNewLook.tsx"), "utf8");
  const ARENA = readFileSync(join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageArena.tsx"), "utf8");
  const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  it("partial gated Reveal, Podium und Medaillen — und der Hinweis ist beidseitig (JSX + CSS) abgesichert", () => {
    expect(RESULT).toContain('const isPartial = matchdaySummary.completion === "partial";');
    expect(RESULT).toContain('data-testid="nl-result-partial-note"');
    expect(RESULT).toContain("championRow && !isPartial && !tagessiegerDismissed");
    expect(RESULT).toContain("podiumRows.length > 0 && !isPartial");
    expect(RESULT).toContain('label={isPartial ? "Zwischenführung" : "Tagessieger"}');
    expect(CSS).toMatch(/\.nl-result-partial-note[\s.,:{[>)]/);
  });

  it("die Arena liest denselben Save-Zustand (kein Session-Raten nach dem Reload)", () => {
    expect(ARENA).toContain("getMatchdayScoringProgress(gameState, matchdayId)");
    expect(ARENA).toContain("scoringProgress?.d1.scored ||");
    // Eine bereits gebuchte Seite wird nie erneut gebucht.
    expect(ARENA).toContain("if (scoringProgress && scoringProgress[side].scored) return;");
  });
});

describe("Feld-Rennen-Projektion: gewertete Spieltage kommen im kompakten Payload an", () => {
  it("der kompakte Payload trägt die fertige Antwort, obwohl er die Quellen beschneidet", () => {
    const { gameState, teamB } = baueHalbenSpieltag();
    const compact = compactFoundationInitialGameState(gameState);

    // Die Quellen sind wirklich beschnitten (nur der aktive Spieltag) …
    expect((compact.seasonState.matchdayResults ?? []).map((r) => r.matchdayId)).toEqual(["matchday-2"]);
    // … aber die Projektion zählt beide gewerteten Spieltage.
    const projection = compact.seasonState.foundationFieldRace;
    expect(projection).toBeTruthy();
    const ledger = hydriereFieldRaceProjection(projection!);
    expect(countPlayedFieldRaceMatchdays(ledger)).toBe(2);
    const form = getFieldRaceSeasonForm(ledger, teamB.teamId);
    expect(form).toHaveLength(2);
    expect(form.every((row) => row.played)).toBe(true);
  });

  it("die Projektion fährt nur hinaus — der Compact-PUT-Roundtrip wirft sie weg", () => {
    const quelle = readFileSync(join(process.cwd(), "lib/persistence/foundation-initial-compact-state.ts"), "utf8");
    expect(quelle).toContain("foundationFieldRace: projiziereFieldRace(gameState)");
    expect(quelle).toContain("foundationFieldRace: undefined");
  });

  it("ohne Ergebnisse gibt es keine Projektion (kein leeres Gerüst)", () => {
    const { gameState } = baueHalbenSpieltag();
    gameState.seasonState.matchdayResults = [];
    expect(projiziereFieldRace(gameState)).toBeUndefined();
  });
});

describe("Highlight-Typen erscheinen nie roh", () => {
  it("bekannte Typen werden deutsch, unbekannte fallen auf eine deutsche Karte zurück", () => {
    const bekannt = formatMatchdayHighlight({
      highlightType: "best_player_discipline",
      shortSummary: "Top player in Staffel",
      payload: { playerName: "Veloria Spinblade", finalPlayerScore: 129.6 },
      disciplineName: "Staffel",
    });
    expect(bekannt.label).toBe("Bester Spieler");
    expect(bekannt.value).toContain("Veloria Spinblade");
    expect(bekannt.value).not.toContain("Top player");

    const unbekannt = formatMatchdayHighlight({
      highlightType: "brand_new_type",
      shortSummary: null,
      payload: {},
      disciplineName: null,
    });
    // Nie der rohe Enum-Name — derselbe Vertrag wie formatPreseasonBlockerLabel.
    expect(unbekannt.label).not.toContain("brand_new_type");
    expect(unbekannt.label.length).toBeGreaterThan(0);
  });
});

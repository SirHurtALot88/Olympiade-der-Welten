/**
 * VERLETZT = NICHT EINSETZBAR, UND IN DER VERLETZUNGS-DISZIPLIN NUR 50 % DER BASIS.
 *
 * CHRIS (18.11.), woertlich: „Verletzt ist nicht nur −10, sondern gar nicht einsetzbar! Und IN der
 * Disziplin, wo er sich verletzt hat, hat er nur 50 % seiner Basisleistung bzw. Eignung/Score."
 *
 * Je Regel ein Block (Doku: docs/design/verletzung-regel-18-11.md):
 *   1. Sperre — manuell (Speichern der Einsatzliste), KI-Aufstellung, Auffuellen, Wertung.
 *   2. 50 % der Basis in der Disziplin, in der er sich verletzt — PPS-Score UND Arena-PP.
 *   3. gezeigt = gebucht — Buehne, Vorschau-Zeile und persistierte Zeile tragen dieselbe Zahl.
 */
import { describe, expect, it } from "vitest";

import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  applyFatigueAndInjuryAfterMatchday,
  buildInjuryPerformanceMapForTeam,
  buildMatchdayInjuryRollMap,
  ermittleArenaVerletzungsstand,
  getPlayerAvailabilityView,
  rollInjuryRisk,
} from "@/lib/fatigue/fatigue-injury-service";
import { buildArenaTeam } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import { berechneArenaEingabeHash } from "@/lib/battle/arena-eingabe-hash";
import { bereiteFixturesVor, type RunArenaFixturesOptions } from "@/lib/battle/arena-headless-runner";
import { runBattleModeArenaMatchday } from "@/lib/resolve/battle-mode-arena-team-points";
import { findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";
import { INJURY_PERFORMANCE_MULTIPLIER } from "@/lib/fatigue/fatigue-calibration";
import { buildDisciplineStageTeamsFromPreview } from "@/lib/foundation/discipline-stage/discipline-stage-from-preview";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { berechneVerteilung } from "@/lib/lineups/einsatzliste-modern-logik";
import {
  loadLocalLegacyLineupContext,
  loadLocalLegacyLineupContextFromGameState,
  saveLocalLegacyLineupDraft,
} from "@/lib/lineups/legacy-lineup-local-service";
import { istVerletzungsgesperrtAusVorspieltag, scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import type { LegacyLineupContext, LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { mapLegacyMatchdayResolvePreviewToResultPayload } from "@/lib/resolve/legacy-matchday-result-mapper";
import { ARENA_TEAM_POINTS } from "@/lib/resolve/battle-mode-arena-team-points";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

// ---------------------------------------------------------------------------------------------
// Gemeinsame Bausteine
// ---------------------------------------------------------------------------------------------

const SAVE_ID = "test-save";

function createInMemoryPersistence(gameState: GameState): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: SAVE_ID,
    name: "Test",
    status: "active",
    createdAt: "2026-11-18T00:00:00.000Z",
    updatedAt: "2026-11-18T00:00:00.000Z",
    gameState,
  } as PersistedSaveGame;
  return {
    getOrCreateActiveSave: () => ({ save, createdFromSeed: false }),
    getActiveSave: () => save,
    getSaveById: (saveId: string) => (save.saveId === saveId ? save : null),
    saveSingleplayerState(saveId: string, nextGameState: GameState) {
      if (save.saveId !== saveId) throw new Error(`Unknown save ${saveId}`);
      save = { ...save, gameState: structuredClone(nextGameState) };
      return save;
    },
    listSaves: () => [{ saveId: save.saveId, name: save.name, status: save.status, createdAt: save.createdAt, updatedAt: save.updatedAt }],
    activateSave: (saveId: string) => (save.saveId === saveId ? save : null),
  } as unknown as PersistenceService;
}

/** Kader auf die Pflichtzahl beider Disziplinen auffuellen — sonst greift eine andere Sperre. */
function fuelleKaderAuf(gameState: GameState) {
  const contextResult = loadLocalLegacyLineupContext(
    {
      saveId: SAVE_ID,
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
      teamId: gameState.teams[0]!.teamId,
    },
    createInMemoryPersistence(gameState),
  );
  if (!contextResult.ok) throw new Error(contextResult.errors.join(" | "));
  // Zwei Reservisten mehr als noetig: der Verletzte muss ersetzbar sein.
  const benoetigt =
    (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0) +
    2;
  const belegt = new Set(gameState.rosters.map((entry) => entry.playerId));
  const frei = gameState.players.filter((player) => !belegt.has(player.id));
  let index = 0;
  let zaehler = gameState.rosters.length;
  for (const team of gameState.teams) {
    const kader = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    for (let i = 0; i < Math.max(0, benoetigt - kader.length); i += 1) {
      const player = frei[index];
      if (!player) throw new Error("Zu wenige freie Spieler fuer den Testkader.");
      index += 1;
      zaehler += 1;
      gameState.rosters.push({
        id: `test-roster-${zaehler}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        joinedSeasonId: gameState.season.id,
      });
    }
  }
}

function setzeKiSteuerung(gameState: GameState) {
  const vorhandene = gameState.seasonState.teamControlSettings ?? {};
  gameState.seasonState.teamControlSettings = Object.fromEntries(
    gameState.teams.map((team) => [
      team.teamId,
      {
        ...vorhandene[team.teamId],
        teamId: team.teamId,
        controlMode: "ai" as const,
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: false,
        aiTransferAutoApplyEnabled: false,
        aiSellPreviewEnabled: false,
        aiSellAutoApplyEnabled: false,
        notes: null,
        strategyLock: null,
      },
    ]),
  );
}

/** Spieler gilt AN DIESEM Spieltag als verletzt (Stand nach dem D1-Teil-Commit). */
function verletze(gameState: GameState, teamId: string, playerId: string, matchdayId: string) {
  gameState.seasonState.playerAvailabilityState = [
    ...(gameState.seasonState.playerAvailabilityState ?? []).filter(
      (entry) => !(entry.playerId === playerId && entry.teamId === teamId),
    ),
    {
      playerId,
      teamId,
      fatigue: 62.4,
      injuryStatus: "injured",
      injuredAtSeasonId: gameState.season.id,
      injuredAtMatchdayId: matchdayId,
      injuryReason: "fatigue_over_30_after_matchday_use",
    },
  ];
}

function baueStand() {
  const gameState = createFreshSeasonOneGameState();
  fuelleKaderAuf(gameState);
  setzeKiSteuerung(gameState);
  const persistence = createInMemoryPersistence(gameState);
  const scope = { saveId: SAVE_ID, seasonId: gameState.season.id, matchdayId: gameState.matchdayState.matchdayId };
  applyAiLegacyLineupBatchLocally({ ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: true }, persistence);
  return { persistence, scope };
}

function d1Aufstellung(gameState: GameState, matchdayId: string) {
  const draft = (gameState.seasonState.lineupDrafts ?? []).find(
    (entry) =>
      entry.matchdayId === matchdayId &&
      entry.entries.some((slot) => slot.disciplineSide === "d1") &&
      entry.entries.some((slot) => slot.disciplineSide === "d2"),
  );
  if (!draft) throw new Error("Es muss eine Aufstellung mit D1 und D2 geben, sonst laeuft der Test ins Leere.");
  return { draft, d1Slot: draft.entries.find((slot) => slot.disciplineSide === "d1")! };
}

// ---------------------------------------------------------------------------------------------
// Regel 1: gar nicht einsetzbar
// ---------------------------------------------------------------------------------------------

describe("Regel 1 — ein Verletzter ist nicht einsetzbar", () => {
  it("KI-Aufstellung: stellt den Verletzten nicht mehr auf, auch nicht bei Neuaufbau aller Entwuerfe", () => {
    const { persistence, scope } = baueStand();
    const gameState = persistence.getSaveById(SAVE_ID)!.gameState;
    const { draft, d1Slot } = d1Aufstellung(gameState, scope.matchdayId);
    verletze(gameState, draft.teamId, d1Slot.playerId, scope.matchdayId);
    persistence.saveSingleplayerState(SAVE_ID, gameState);
    expect(getPlayerAvailabilityView(gameState, d1Slot.playerId, draft.teamId, scope.matchdayId).isUnavailable).toBe(true);

    applyAiLegacyLineupBatchLocally({ ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: true }, persistence);

    const neu = (persistence.getSaveById(SAVE_ID)!.gameState.seasonState.lineupDrafts ?? []).find(
      (entry) => entry.teamId === draft.teamId && entry.matchdayId === scope.matchdayId,
    );
    expect(neu, "Die KI muss das Team neu aufgestellt haben").toBeTruthy();
    expect(neu!.entries.length).toBeGreaterThan(0);
    expect(neu!.entries.some((slot) => slot.playerId === d1Slot.playerId)).toBe(false);
  }, 180_000);

  it("Einsatzliste speichern: ein heute in D1 Verletzter kann nicht nach D2 umgesetzt werden", () => {
    const { persistence, scope } = baueStand();
    const gameState = persistence.getSaveById(SAVE_ID)!.gameState;
    const { draft, d1Slot } = d1Aufstellung(gameState, scope.matchdayId);
    verletze(gameState, draft.teamId, d1Slot.playerId, scope.matchdayId);
    persistence.saveSingleplayerState(SAVE_ID, gameState);

    const d2Slot = draft.entries.find((slot) => slot.disciplineSide === "d2")!;
    // Tausch: der Verletzte wandert auf den D2-Platz, der D2-Spieler auf seinen D1-Platz.
    const umgesetzt = draft.entries.map((slot) => {
      if (slot === d1Slot) return { ...slot, playerId: d2Slot.playerId, activePlayerId: d2Slot.activePlayerId, isCaptain: false };
      if (slot === d2Slot) return { ...slot, playerId: d1Slot.playerId, activePlayerId: d1Slot.activePlayerId, isCaptain: false };
      return slot;
    });
    const ergebnis = saveLocalLegacyLineupDraft({ ...scope, teamId: draft.teamId }, umgesetzt, draft.modifiers, persistence);
    expect(ergebnis.ok).toBe(false);
    const fehler: string[] = "errors" in ergebnis ? (ergebnis.errors ?? []) : [];
    expect(fehler.some((error) => error.includes("player_injured_unavailable"))).toBe(true);

    // Gegenprobe: bleibt er auf seinem D1-Platz stehen (dort hat er gespielt), ist der Entwurf gueltig.
    const unveraendert = saveLocalLegacyLineupDraft({ ...scope, teamId: draft.teamId }, draft.entries, draft.modifiers, persistence);
    expect("errors" in unveraendert ? (unveraendert.errors ?? []) : []).not.toContainEqual(expect.stringContaining("player_injured_unavailable"));
  }, 180_000);

  it("Pruefung: Sperre aus einem Vorspieltag ist im offenen Entwurf ein Fehler, ein heute Verletzter nur auf seinem alten Platz erlaubt", () => {
    const kontext = (injuredAtMatchdayId: string, seite: "d1" | "d2"): LegacyLineupContext =>
      ({
        saveId: "s",
        seasonId: "season-1",
        matchdayId: "md-2",
        teamId: "A-A",
        entries: [{ disciplineId: seite === "d1" ? "spurt" : "tdm", disciplineSide: seite, slotIndex: 0, playerId: "verletzt", activePlayerId: "r-verletzt" }],
        disciplinePlayerCounts: { spurt: 1, tdm: 1 },
        activePlayers: [],
        rosterPlayers: [
          {
            id: "verletzt",
            name: "verletzt",
            coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
            injuryStatus: "injured",
            injuredAtMatchdayId,
            availabilityBlocker: "player_injured_unavailable",
          },
        ],
        disciplineScores: [],
      }) as unknown as LegacyLineupContext;
    const bisher = [{ playerId: "verletzt", disciplineId: "spurt", disciplineSide: "d1" }];
    const opts = { enforceCompleteness: false, bisherigeEintraege: bisher };

    expect(validateLegacyLineupContext(kontext("md-1", "d1"), opts).isValid).toBe(false);
    expect(validateLegacyLineupContext(kontext("md-2", "d1"), opts).isValid).toBe(true);
    expect(validateLegacyLineupContext(kontext("md-2", "d2"), opts).isValid).toBe(false);
    // Ohne Liste (Bereitschaft/KI): unveraendert die alte Regel.
    expect(validateLegacyLineupContext(kontext("md-2", "d2"), { enforceCompleteness: false }).isValid).toBe(true);
  });

  it("Auffuellen/Optimieren: ein Verletzter wird nie auf einen freien Platz gesetzt", () => {
    const slots = [
      { key: "d1-0", side: "d1" as const },
      { key: "d1-1", side: "d1" as const },
    ];
    const werte = new Map([
      ["verletzt", [{ slotKey: "d1-0", projectedScore: 99 }, { slotKey: "d1-1", projectedScore: 99 }]],
      ["fit-a", [{ slotKey: "d1-0", projectedScore: 40 }, { slotKey: "d1-1", projectedScore: 40 }]],
      ["fit-b", [{ slotKey: "d1-0", projectedScore: 30 }, { slotKey: "d1-1", projectedScore: 30 }]],
    ]) as unknown as Parameters<typeof berechneVerteilung>[0]["werte"];
    for (const modus of ["auffuellen", "optimieren"] as const) {
      const verteilung = berechneVerteilung({ modus, slots, selections: {}, werte, ausgeschlossen: new Set(["verletzt"]) });
      expect(Object.values(verteilung.neu)).not.toContain("verletzt");
      expect(Object.values(verteilung.neu).filter(Boolean)).toHaveLength(2);
    }
  });

  it("Wertung: wer aus einem Vorspieltag gesperrt ist und trotzdem im (gesperrten) Entwurf steht, wird NICHT gewertet", () => {
    const rosterPlayers = [
      { id: "gesperrt", name: "gesperrt", coreStats: { pow: 1, spe: 1, men: 1, soc: 1 }, injuredAtMatchdayId: "md-1", availabilityBlocker: "player_injured_unavailable" as const },
      { id: "fit", name: "fit", coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } },
    ];
    const ergebnis = scoreLegacyLineupDisciplineSide({
      disciplineId: "tdm",
      disciplineSide: "d2",
      matchdayId: "md-2",
      entries: [
        { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 0, playerId: "gesperrt", activePlayerId: "r-gesperrt" },
        { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 1, playerId: "fit", activePlayerId: "r-fit" },
      ],
      disciplineScores: [
        { playerId: "gesperrt", disciplineId: "tdm", score: 90 },
        { playerId: "fit", disciplineId: "tdm", score: 40 },
      ],
      rosterPlayers,
      requiredPlayers: 2,
      fatigueSourceStatus: "mapped",
    });
    expect(ergebnis.entries.map((entry) => entry.playerId)).toEqual(["fit"]);
    expect(ergebnis.baseScore).toBe(40);
    // Der Platz zaehlt als besetzt — die Seite wird dadurch nicht unvollstaendig und blockiert nichts.
    expect(ergebnis.isComplete).toBe(true);

    // Gegenprobe: an DIESEM Spieltag verletzt -> er ist gelaufen und wird gewertet.
    expect(istVerletzungsgesperrtAusVorspieltag(rosterPlayers[0], "md-1")).toBe(false);
    expect(istVerletzungsgesperrtAusVorspieltag(rosterPlayers[0], "md-2")).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Regel 2: 50 % der Basis in der Verletzungs-Disziplin
// ---------------------------------------------------------------------------------------------

describe("Regel 2 — in der Disziplin, in der er sich verletzt, zaehlt nur 50 % der Basis", () => {
  const scoreMit = (fatigueMultiplier: number, verletzt: boolean) =>
    scoreLegacyLineupDisciplineSide({
      disciplineId: "tdm",
      disciplineSide: "d1",
      matchdayId: "md-1",
      entries: [{ disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p", activePlayerId: "r-p" }],
      disciplineScores: [{ playerId: "p", disciplineId: "tdm", score: 80 }],
      requiredPlayers: 1,
      fatigueByPlayerId: { p: { count: 60, multiplier: fatigueMultiplier } },
      fatigueSourceStatus: "mapped",
      injuryByPlayerId: { p: { injuredThisMatchday: verletzt, multiplier: verletzt ? INJURY_PERFORMANCE_MULTIPLIER : 1 } },
      injurySourceStatus: "mapped",
    }).entries[0]!;

  it("gerechnet auf der Basis — unabhaengig von der Erschoepfung", () => {
    for (const fatigueMultiplier of [1, 0.9, 0.75]) {
      const entry = scoreMit(fatigueMultiplier, true);
      expect(entry.injuryAdjustedScore).toBe(80 * INJURY_PERFORMANCE_MULTIPLIER);
      expect(entry.injuryMultiplier).toBe(INJURY_PERFORMANCE_MULTIPLIER);
    }
  });

  it("ohne Verletzung bleibt es exakt beim Fatigue-Wert (Rechnung unveraendert)", () => {
    expect(scoreMit(0.75, false).injuryAdjustedScore).toBe(60);
    expect(scoreMit(1, false).injuryAdjustedScore).toBe(80);
  });
});

// ---------------------------------------------------------------------------------------------
// Regel 2 + 3 in der Arena: halbe Boxscore-PP, gezeigt = gebucht
// ---------------------------------------------------------------------------------------------

function arenaKontext(teamId: string, d1Scores: number[], gameState: GameState, verletzt?: string): LegacyLineupLoadedContext {
  const entries = d1Scores.map((_, index) => ({
    disciplineId: "basketball",
    disciplineSide: "d1" as const,
    slotIndex: index,
    playerId: `${teamId}-d1-${index}`,
    activePlayerId: `active-${teamId}-d1-${index}`,
  }));
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId,
    gameState,
    entries,
    disciplinePlayerCounts: { basketball: d1Scores.length },
    activePlayers: entries.map((entry) => ({ id: entry.activePlayerId, saveId: "save-1", seasonId: "season-1", teamId, playerId: entry.playerId })),
    disciplineScores: d1Scores.map((score, index) => ({ playerId: `${teamId}-d1-${index}`, disciplineId: "basketball", score })),
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: teamId, shortCode: teamId, name: teamId },
    teamSeasonState: { id: `tss-${teamId}`, saveId: "save-1", seasonId: "season-1", teamId, cash: 100, budget: 100, rosterLimit: 10, playerOpt: 10 },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({ id: entry.playerId, name: entry.playerId, coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } })),
    disciplines: [{ id: "basketball", name: "Basketball", category: "tactics" }],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: "basketball", originalOrder: 1, displayOrder: 1, playerCount: d1Scores.length, mutator1: null, mutator2: null },
    ],
    existingDraft: {
      lineupId: `lineup-${teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId,
      status: "draft",
      entries,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
      createdAt: "2026-11-18T00:00:00.000Z",
      updatedAt: "2026-11-18T00:00:00.000Z",
    },
    contextMeta: { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", teamId, d1DisciplineId: "basketball", d2DisciplineId: null },
    fatigueByPlayerId: null,
    fatigueSourceStatus: "missing_source",
    injuryByPlayerId: verletzt ? { [verletzt]: { injuredThisMatchday: true, multiplier: INJURY_PERFORMANCE_MULTIPLIER } } : null,
    injurySourceStatus: verletzt ? "mapped" : "not_applied",
    contextLoadMode: "sqlite_local",
    formCardSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    mutatorSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    teamPowerSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    formCards: [],
  } as unknown as LegacyLineupLoadedContext;
}

// Seit Luecke D (Wurf VOR dem Motorlauf, s. Block „Luecke D“ unten) traegt der Motor die Verletzung
// selbst: der Verletzte tritt mit 50 % seiner Eignung an, sein Boxscore und das Teamergebnis kommen
// schon so aus dem Lauf. Die Resolve-Engine reicht die Boxscore-PP deshalb UNVERAENDERT durch (vorher
// halbierte `arenaPpsFuer` sie nachtraeglich, weil der Motor nichts wusste — jetzt waere das doppelt).
describe("Regel 2/3 in der Arena — Boxscore-PP aus dem Motor, und gezeigt = gebucht", () => {
  const gameState = { scenarioMeta: { gameMode: "battle" }, rosters: [], players: [], teams: [], seasonState: {} } as unknown as GameState;
  const VERLETZT = "A-A-d1-0";
  const arenaOptionen = {
    arenaTeamPointsByDisciplineId: new Map([
      [
        "basketball",
        new Map([
          ["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "seed" }],
          ["B-B", { teamPoints: ARENA_TEAM_POINTS.loss, arenaMatchSeed: "seed" }],
        ]),
      ],
    ]),
    arenaIndividualBoxscorePpsByDisciplineId: new Map([
      ["basketball", new Map([[VERLETZT, 4.3], ["A-A-d1-1", 2.2], ["B-B-d1-0", 3.1], ["B-B-d1-1", 1.4]])],
    ]),
  };
  const mitVerletzung = buildLegacyMatchdayResolvePreview(
    [arenaKontext("A-A", [50, 40], gameState, VERLETZT), arenaKontext("B-B", [45, 35], gameState)],
    arenaOptionen,
  );
  const basketball = mitVerletzung.disciplinePreviews.find((discipline) => discipline.disciplineId === "basketball")!;

  it("die Arena-PP des Verletzten kommen unveraendert aus dem Motor (kein zweiter Abzug), Mitspieler und Teamergebnis ebenso", () => {
    const alpha = basketball.teamResults.find((team) => team.teamId === "A-A")!;
    expect(alpha.entries.find((entry) => entry.playerId === VERLETZT)!.pointsAwarded).toBe(4.3);
    expect(alpha.entries.find((entry) => entry.playerId === "A-A-d1-1")!.pointsAwarded).toBe(2.2);
    expect(alpha.teamPoints).toBe(ARENA_TEAM_POINTS.win);
  });

  it("Buehne, Vorschau-Zeile und gebuchte Zeile tragen dieselbe Zahl", () => {
    const erwartet = 4.3;
    // Live-Buehne (Team-Zeile der Vorschau)
    const buehne = basketball.teamResults.find((team) => team.teamId === "A-A")!.entries.find((entry) => entry.playerId === VERLETZT)!;
    // Spielerzeile der Vorschau (das, was gebucht wird)
    const zeile = basketball.topPlayers.find((entry) => entry.playerId === VERLETZT)!;
    // Buehnen-Payload (Arena/„Nach dem Spieltag" aus der Vorschau)
    const stage = buildDisciplineStageTeamsFromPreview(basketball, new Map(), new Map())
      .flatMap((team) => team.players)
      .find((player) => player.playerId === VERLETZT)!;
    // Persistierte Leistung (geht so in den Ledger, der Arena-Zeilen vertraut)
    const gebucht = mapLegacyMatchdayResolvePreviewToResultPayload({
      preview: mitVerletzung,
      sourceVersion: "test",
      readinessByTeamId: {},
    }).playerPerformancePayloads.find((performance) => performance.playerId === VERLETZT)!;

    expect(buehne.pointsAwarded).toBe(erwartet);
    expect(zeile.pointsAwarded).toBe(erwartet);
    expect(stage.pointsAwarded).toBe(erwartet);
    expect(gebucht.scoreContribution).toBe(erwartet);
    // Und der Score-Wert: 50 % der Basis, auf der Buehne als eigene Verletzungs-Zeile ausgewiesen.
    expect(zeile.injuryAdjustedValue).toBe(50 * INJURY_PERFORMANCE_MULTIPLIER);
    expect(stage.mods.find((mod) => mod.injury)?.amt).toBeCloseTo(50 * (1 - INJURY_PERFORMANCE_MULTIPLIER), 1);
    expect(gebucht.finalPlayerScore).toBe(zeile.finalPlayerScore);
  });
});

// ---------------------------------------------------------------------------------------------
// Luecke D: der Wurf faellt VOR dem Motorlauf, der Verletzte tritt mit 50 % seiner Eignung an
// ---------------------------------------------------------------------------------------------

/**
 * Erzwingt eine Verletzung im ECHTEN Wurf: ein aufgestellter D1-Spieler, dessen deterministischer
 * Wurf bei Ausdauer 100 (Risiko 33 %) trifft, bekommt diese Ausdauer. Alle anderen bleiben frisch
 * (Risiko 0). Nichts am Wurf selbst wird umgangen.
 */
function erzwingeVerletzungImWurf(gameState: GameState, scope: { saveId: string; seasonId: string; matchdayId: string }) {
  const fixtures = findeSpieltagsFixtures(gameState, scope.matchdayId);
  const mitFixture = new Set(fixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]));
  for (const draft of gameState.seasonState.lineupDrafts ?? []) {
    if (draft.matchdayId !== scope.matchdayId || !mitFixture.has(draft.teamId)) continue;
    for (const slot of draft.entries) {
      if (slot.disciplineSide !== "d1") continue;
      if (rollInjuryRisk({ ...scope, playerId: slot.playerId, fatigueBefore: 100 }).result !== "injured") continue;
      gameState.seasonState.playerAvailabilityState = [
        ...(gameState.seasonState.playerAvailabilityState ?? []).filter(
          (entry) => !(entry.playerId === slot.playerId && entry.teamId === draft.teamId),
        ),
        { playerId: slot.playerId, teamId: draft.teamId, fatigue: 100, injuryStatus: "healthy" },
      ];
      return { teamId: draft.teamId, playerId: slot.playerId, disciplineId: slot.disciplineId };
    }
  }
  throw new Error("Kein D1-Spieler, dessen Wurf bei Ausdauer 100 trifft — der Test liefe ins Leere.");
}

describe("Luecke D — der Wurf faellt vor dem Motorlauf, der Verletzte tritt mit 50 % seiner Eignung an", () => {
  const { persistence, scope } = baueStand();
  const ohneVerletzung = structuredClone(persistence.getSaveById(SAVE_ID)!.gameState);
  const gameState = structuredClone(ohneVerletzung);
  const verletzt = erzwingeVerletzungImWurf(gameState, scope);
  const key = `${verletzt.teamId}::${verletzt.playerId}`;
  const stand = ermittleArenaVerletzungsstand({ gameState, ...scope });

  it("derselbe Wurf wie bei der Buchung: Motor-Stand und Kontext-Verletzung (PPS, Buehne, Ledger) nennen denselben Spieler", () => {
    const rollMap = buildMatchdayInjuryRollMap({ gameState, ...scope });
    const gebuchtVerletzt = [...rollMap.entries()].filter(([, roll]) => roll.result === "injured").map(([k]) => k);
    expect(gebuchtVerletzt).toEqual([key]);
    expect([...stand.heuteVerletzt]).toEqual([key]);
    expect(stand.gesperrt.size).toBe(0);
    // Genau diese Map heften Vorschau, Arena-Kickoff, Auto-Run und Buchung an die Kontexte.
    expect(buildInjuryPerformanceMapForTeam(verletzt.teamId, rollMap)?.[verletzt.playerId]).toEqual({
      injuredThisMatchday: true,
      multiplier: INJURY_PERFORMANCE_MULTIPLIER,
    });
  });

  it("Motor-Eingabe: der Verletzte mit 50 % von Eignung und Attributen, Mitspieler und Reihenfolge unberuehrt", () => {
    const vorher = buildArenaTeam(gameState, verletzt.teamId);
    const nachher = buildArenaTeam(gameState, verletzt.teamId, undefined, stand);
    expect(nachher.map((spieler) => spieler.id)).toEqual(vorher.map((spieler) => spieler.id));
    expect(nachher.map((spieler) => spieler.id)).toContain(verletzt.playerId);
    for (const [index, spieler] of nachher.entries()) {
      const alt = vorher[index]!;
      if (spieler.id !== verletzt.playerId) {
        expect(spieler).toEqual(alt);
        continue;
      }
      for (const [k, wert] of Object.entries(alt.a)) {
        expect(spieler.a[k as keyof typeof spieler.a]).toBe(Math.round(wert * INJURY_PERFORMANCE_MULTIPLIER * 100) / 100);
      }
      for (const [k, wert] of Object.entries(alt.d)) {
        expect(spieler.d[k]).toBe(Math.round(Math.min(100, Math.max(0, wert * INJURY_PERFORMANCE_MULTIPLIER)) * 100) / 100);
      }
    }
    // Die anderen Teams sehen nichts davon.
    const anderesTeam = gameState.teams.find((team) => team.teamId !== verletzt.teamId)!.teamId;
    expect(buildArenaTeam(gameState, anderesTeam, undefined, stand)).toEqual(buildArenaTeam(gameState, anderesTeam));
  });

  it("ohne Verletzung ist der Stand leer und die Motor-Eingabe Zeichen fuer Zeichen die alte", () => {
    const leer = ermittleArenaVerletzungsstand({ gameState: ohneVerletzung, ...scope });
    expect(leer.heuteVerletzt.size).toBe(0);
    expect(leer.gesperrt.size).toBe(0);
    for (const team of ohneVerletzung.teams) {
      expect(buildArenaTeam(ohneVerletzung, team.teamId, undefined, leer)).toEqual(buildArenaTeam(ohneVerletzung, team.teamId));
    }
  });

  it("Vorlauf-Cache: der Arena-Eingabe-Hash sieht die Verletzung (neu gerechnet), bleibt sonst stabil", () => {
    const hash = (state: GameState) =>
      berechneArenaEingabeHash({ gameState: state, ...scope, disciplineId: verletzt.disciplineId, mutatoren: [] });
    expect(hash(gameState)).toBe(hash(structuredClone(gameState)));
    expect(hash(gameState)).not.toBe(hash(ohneVerletzung));
  });

  it("Vorlauf und Hash fuettern den Motor mit derselben Eingabe (Runner bekommt den Stand vom Spieltags-Aufrufer)", async () => {
    let gesehen: RunArenaFixturesOptions | null = null;
    const vorbereitet: ReturnType<typeof bereiteFixturesVor> = [];
    // Der frische Seed-Spielplan traegt keine Liga-Stufe; der Arena-Spieltag laeuft je Stufe.
    const mitLiga = structuredClone(gameState);
    mitLiga.seasonState.schedule = (mitLiga.seasonState.schedule ?? []).map((fixture) =>
      fixture.matchdayId === scope.matchdayId ? { ...fixture, leagueTier: "liga1" as const } : fixture,
    );
    await runBattleModeArenaMatchday({
      gameState: mitLiga,
      ...scope,
      disciplineId: verletzt.disciplineId,
      matchdayMutatorTraits: [],
      tierParallel: false,
      runArenaFixturesImpl: async (state, fixtures, disziplin, options) => {
        gesehen = options ?? null;
        vorbereitet.push(...bereiteFixturesVor(state, fixtures, options?.attributeSheetOverrides, disziplin, options?.verletzungsstand));
        return [];
      },
    });
    expect(gesehen).not.toBeNull();
    expect([...(gesehen!.verletzungsstand?.heuteVerletzt ?? [])]).toEqual([key]);
    const duell = vorbereitet.find((fixture) => fixture.homeTeamId === verletzt.teamId || fixture.awayTeamId === verletzt.teamId)!;
    expect(duell, "Das Team des Verletzten muss an diesem Spieltag ein Duell haben").toBeTruthy();
    const kader = duell.homeTeamId === verletzt.teamId ? duell.heim : duell.gast;
    // Dieselbe Funktion, mit der `berechneArenaEingabeHash` den Kader in den Fingerabdruck nimmt.
    expect(kader).toEqual(buildArenaTeam(gameState, verletzt.teamId, undefined, stand));
    const imMotor = kader.find((spieler) => spieler.id === verletzt.playerId)!;
    const gesund = buildArenaTeam(ohneVerletzung, verletzt.teamId).find((spieler) => spieler.id === verletzt.playerId)!;
    expect(imMotor.a.power).toBe(Math.round(gesund.a.power * INJURY_PERFORMANCE_MULTIPLIER * 100) / 100);
  });

  it("stabil ueber den D1-Teil-Commit: der gebuchte Wurf zaehlt, die offene Seite wird gleich gewuerfelt", () => {
    const nachD1 = applyFatigueAndInjuryAfterMatchday({
      gameState,
      ...scope,
      matchdayResultId: `result-${scope.matchdayId}`,
      timestamp: "2026-11-18T00:00:00.000Z",
      commitThroughSide: "d1",
    }).gameState;
    nachD1.seasonState.matchdayResults = [
      ...(nachD1.seasonState.matchdayResults ?? []),
      { id: `result-${scope.matchdayId}`, saveId: SAVE_ID, seasonId: scope.seasonId, matchdayId: scope.matchdayId } as never,
    ];
    // Der D1-Commit hat ihn wirklich als verletzt eingetragen.
    expect(nachD1.seasonState.playerAvailabilityState?.find((entry) => entry.playerId === verletzt.playerId)?.injuryStatus).toBe("injured");
    const danach = ermittleArenaVerletzungsstand({ gameState: nachD1, ...scope });
    expect([...danach.heuteVerletzt]).toEqual([key]);
    expect(danach.gesperrt.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Luecke B: ein Gesperrter im gesperrten Entwurf tritt in der Arena nicht an
// ---------------------------------------------------------------------------------------------

function arenaSpieler(id: string, wert: number) {
  return {
    id,
    name: id,
    className: "Runner",
    race: "Human",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    marketValue: 10,
    salary: 2,
    fatigue: 20,
    attributes: {},
    disciplineRatings: { tdm: wert, spurt: wert },
    attributeSheetStats: {
      power: wert,
      health: wert,
      stamina: wert,
      intelligence: wert,
      awareness: wert,
      determination: wert,
      speed: wert,
      dexterity: wert,
      charisma: wert,
      will: wert,
      spirit: wert,
      torment: wert,
    },
  };
}

/** md-2: `gesperrt` hat sich an md-1 verletzt (Sperre bis md-2) und steht im gesperrten Entwurf auf D2. */
function gesperrterStand(status: "injured" | "recovering" = "injured"): GameState {
  const teamId = "A-A";
  const ids = ["d1-laeufer", "heute-verletzt", "gesperrt", "d2-partner", "bank"];
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 2, matchdayIds: ["md-1", "md-2", "md-3"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      lineupDrafts: [
        {
          lineupId: "lineup-1",
          saveId: "save-1",
          seasonId: "season-1",
          matchdayId: "md-2",
          teamId,
          status: "submitted",
          entries: [
            { disciplineId: "spurt", disciplineSide: "d1", slotIndex: 0, playerId: "d1-laeufer", activePlayerId: "roster-d1-laeufer" },
            { disciplineId: "spurt", disciplineSide: "d1", slotIndex: 1, playerId: "heute-verletzt", activePlayerId: "roster-heute-verletzt" },
            { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 0, playerId: "gesperrt", activePlayerId: "roster-gesperrt" },
            { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 1, playerId: "d2-partner", activePlayerId: "roster-d2-partner" },
          ],
          createdAt: "2026-11-18T00:00:00.000Z",
          updatedAt: "2026-11-18T00:00:00.000Z",
        },
      ],
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      resultAuditLogs: [],
      playerAvailabilityState: ids.map((playerId) =>
        playerId === "gesperrt"
          ? {
              playerId,
              teamId,
              fatigue: 60,
              injuryStatus: status,
              injuredAtSeasonId: "season-1",
              injuredAtMatchdayId: "md-1",
              injuryUntilMatchday: "md-2",
            }
          : playerId === "heute-verletzt"
            ? {
                playerId,
                teamId,
                fatigue: 62,
                injuryStatus: "injured" as const,
                injuredAtSeasonId: "season-1",
                injuredAtMatchdayId: "md-2",
                injuryUntilMatchday: "md-3",
              }
            : { playerId, teamId, fatigue: 10, injuryStatus: "healthy" as const },
      ),
    },
    matchdayState: { matchdayId: "md-2", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId, shortCode: teamId, name: teamId, budget: 100, cash: 100, identityId: "id", humanControlled: false, rosterLimit: 12 }],
    teamIdentities: [],
    players: ids.map((id, index) => arenaSpieler(id, 90 - index * 5)),
    disciplines: [],
    rosters: ids.map((playerId) => ({ id: `roster-${playerId}`, teamId, playerId, role: "core", joinedSeasonId: "season-1" })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
  } as unknown as GameState;
}

describe("Luecke B — ein Gesperrter im gesperrten Entwurf tritt in der Arena nicht an", () => {
  const scope = { saveId: "save-1", seasonId: "season-1", matchdayId: "md-2" };

  it("kein Platz in der Aufstellung, kein Platz im Kader — der Slot bleibt leer, die Mitspieler stehen", () => {
    const gameState = gesperrterStand();
    const aufstellung = buildArenaAufstellung(gameState, "A-A", "md-2");
    expect(aufstellung.gesperrt).toBeUndefined();
    expect(aufstellung["d2-partner"]?.d).toBe("tdm");
    expect(aufstellung["d1-laeufer"]?.d).toBe("spurt");
    // Wer sich AN diesem Spieltag verletzt hat, ist gelaufen und behaelt seinen Platz.
    expect(aufstellung["heute-verletzt"]?.d).toBe("spurt");

    const stand = ermittleArenaVerletzungsstand({ gameState, ...scope });
    expect([...stand.gesperrt]).toEqual(["A-A::gesperrt"]);
    const kader = buildArenaTeam(gameState, "A-A", undefined, stand);
    expect(kader.map((spieler) => spieler.id)).not.toContain("gesperrt");
    expect(kader.map((spieler) => spieler.id)).toEqual(
      buildArenaTeam(gameState, "A-A")
        .map((spieler) => spieler.id)
        .filter((id) => id !== "gesperrt"),
    );
  });

  it("bleibt auch nach dem Abschluss-Commit gesperrt (recovering bis md-2) — Buehne und Buchung sehen dasselbe", () => {
    const gameState = gesperrterStand("recovering");
    expect(buildArenaAufstellung(gameState, "A-A", "md-2").gesperrt).toBeUndefined();
    expect([...ermittleArenaVerletzungsstand({ gameState, ...scope }).gesperrt]).toEqual(["A-A::gesperrt"]);
    // Am Folgespieltag ist die Sperre vorbei.
    // Am Folgespieltag ist seine Sperre vorbei — gesperrt ist dann nur, wer sich an md-2 verletzt hat.
    expect([...ermittleArenaVerletzungsstand({ gameState, ...scope, matchdayId: "md-3" }).gesperrt]).toEqual(["A-A::heute-verletzt"]);
  });

  it("ohne Sperre steht er wie bisher in Aufstellung und Kader (Arena-Eingabe unveraendert)", () => {
    const ohneSperre = gesperrterStand();
    ohneSperre.seasonState.playerAvailabilityState = ohneSperre.seasonState.playerAvailabilityState!.map((entry) =>
      entry.playerId === "gesperrt" ? { playerId: entry.playerId, teamId: entry.teamId, fatigue: 10, injuryStatus: "healthy" as const } : entry,
    );
    expect(buildArenaAufstellung(ohneSperre, "A-A", "md-2").gesperrt?.d).toBe("tdm");
    const stand = ermittleArenaVerletzungsstand({ gameState: ohneSperre, ...scope });
    expect(stand.gesperrt.size).toBe(0);
    expect(buildArenaTeam(ohneSperre, "A-A", undefined, stand).map((spieler) => spieler.id)).toContain("gesperrt");
  });
});

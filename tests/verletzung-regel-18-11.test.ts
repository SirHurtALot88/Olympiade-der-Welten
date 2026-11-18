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
import { getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
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
        roleTag: "bench",
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
    expect((ergebnis.errors ?? []).some((error) => error.includes("player_injured_unavailable"))).toBe(true);

    // Gegenprobe: bleibt er auf seinem D1-Platz stehen (dort hat er gespielt), ist der Entwurf gueltig.
    const unveraendert = saveLocalLegacyLineupDraft({ ...scope, teamId: draft.teamId }, draft.entries, draft.modifiers, persistence);
    expect(unveraendert.errors ?? []).not.toContainEqual(expect.stringContaining("player_injured_unavailable"));
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
        { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 0, playerId: "gesperrt" },
        { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 1, playerId: "fit" },
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
      entries: [{ disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p" }],
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

describe("Regel 2/3 in der Arena — halbe Boxscore-PP, und gezeigt = gebucht", () => {
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

  it("der Verletzte bekommt die Haelfte seiner Arena-PP, seine Mitspieler und das Teamergebnis bleiben unberuehrt", () => {
    const alpha = basketball.teamResults.find((team) => team.teamId === "A-A")!;
    expect(alpha.entries.find((entry) => entry.playerId === VERLETZT)!.pointsAwarded).toBe(
      Math.round(4.3 * INJURY_PERFORMANCE_MULTIPLIER * 100) / 100,
    );
    expect(alpha.entries.find((entry) => entry.playerId === "A-A-d1-1")!.pointsAwarded).toBe(2.2);
    expect(alpha.teamPoints).toBe(ARENA_TEAM_POINTS.win);
  });

  it("Buehne, Vorschau-Zeile und gebuchte Zeile tragen dieselbe Zahl", () => {
    const erwartet = Math.round(4.3 * INJURY_PERFORMANCE_MULTIPLIER * 100) / 100;
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

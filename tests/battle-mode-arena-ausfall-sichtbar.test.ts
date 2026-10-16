import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import type { ArenaAusfall } from "@/lib/resolve/legacy-matchday-resolve-types";

/**
 * SICHTBARE ARENA-AUSFÄLLE (Plan `docs/design/battle-arena-auto-run-anbindung-plan-16-10.md`
 * Abschnitt 3, PR 1): Typen, Engine-Strukturprüfung, Ledger-Feld -- KEINE Verhaltensänderung an
 * der Arena-Logik oder dem Auto-Run selbst (das ist PR 3).
 *
 * DER WERTVOLLSTE TEIL (laut Projektaufsicht): die Engine-Strukturprüfung weiter unten
 * ("K1-Simulation") stellt GENAU den heutigen Zustand nach, den der Smoke-Test vom 16.10. fand --
 * der Auto-Run liefert in einem Battle-Save NIE eine `arenaTeamPointsByDisciplineId`-Map (K1: die
 * Arena läuft nie im normalen Spielfluss, s. Plan Abschnitt 1.1) -- und zeigt, dass die neue
 * Markierung genau dafür anspringt, statt den Zustand (wie bisher) klaglos als PPS-Duell-Brücke
 * durchlaufen zu lassen.
 */

const D1_ARENA = "gewichtheben"; // Mitglied von ARENA_RESOLVED_DISCIPLINE_IDS
const D2_NICHT_ARENA = "battlefield"; // NICHT arena-aufgelöst

function createContext(input: {
  teamId: string;
  d1Scores: number[];
  d2Scores: number[];
  gameState: GameState;
}): LegacyLineupLoadedContext {
  const entries = [
    ...input.d1Scores.map((_, index) => ({
      disciplineId: D1_ARENA,
      disciplineSide: "d1" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d1-${index}`,
      activePlayerId: `active-${input.teamId}-d1-${index}`,
    })),
    ...input.d2Scores.map((_, index) => ({
      disciplineId: D2_NICHT_ARENA,
      disciplineSide: "d2" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d2-${index}`,
      activePlayerId: `active-${input.teamId}-d2-${index}`,
    })),
  ];
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: input.teamId,
    gameState: input.gameState,
    entries,
    disciplinePlayerCounts: { [D1_ARENA]: input.d1Scores.length, [D2_NICHT_ARENA]: input.d2Scores.length },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: [
      ...input.d1Scores.map((score, index) => ({ playerId: `${input.teamId}-d1-${index}`, disciplineId: D1_ARENA, score })),
      ...input.d2Scores.map((score, index) => ({ playerId: `${input.teamId}-d2-${index}`, disciplineId: D2_NICHT_ARENA, score })),
    ],
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamId },
    teamSeasonState: { id: `tss-${input.teamId}`, saveId: "save-1", seasonId: "season-1", teamId: input.teamId, cash: 100, budget: 100, rosterLimit: 10, playerOpt: 10 },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({ id: entry.playerId, name: entry.playerId, coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } })),
    disciplines: [
      { id: D1_ARENA, name: "Gewichtheben", category: "power" },
      { id: D2_NICHT_ARENA, name: "Battlefield", category: "tactics" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: D1_ARENA, originalOrder: 1, displayOrder: 1, playerCount: input.d1Scores.length, mutator1: null, mutator2: null },
      { disciplineId: D2_NICHT_ARENA, originalOrder: 2, displayOrder: 2, playerCount: input.d2Scores.length, mutator1: null, mutator2: null },
    ],
    existingDraft: {
      lineupId: `lineup-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      status: "draft",
      entries,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
    },
    contextMeta: { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", teamId: input.teamId, d1DisciplineId: D1_ARENA, d2DisciplineId: D2_NICHT_ARENA },
    fatigueByPlayerId: null,
    fatigueSourceStatus: "missing_source",
    injuryByPlayerId: null,
    injurySourceStatus: "not_applied",
    contextLoadMode: "sqlite_local",
    formCardSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    mutatorSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    teamPowerSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    formCards: [],
  } as unknown as LegacyLineupLoadedContext;
}

const FIXTURES = [
  { id: "f1", homeTeamId: "A", awayTeamId: "B", matchdayId: "matchday-1", status: "scheduled", leagueTier: "liga1" },
  { id: "f2", homeTeamId: "C", awayTeamId: "D", matchdayId: "matchday-1", status: "scheduled", leagueTier: "liga2" },
];

function gameState(gameMode: "battle" | "manager"): GameState {
  return {
    scenarioMeta: { gameMode },
    rosters: [],
    players: [],
    teams: [],
    seasonState: { schedule: FIXTURES },
  } as unknown as GameState;
}

function vierTeams(gs: GameState) {
  return [
    createContext({ teamId: "A", d1Scores: [40, 30], d2Scores: [20, 10], gameState: gs }),
    createContext({ teamId: "B", d1Scores: [10, 5], d2Scores: [25, 20], gameState: gs }),
    createContext({ teamId: "C", d1Scores: [50, 45], d2Scores: [5, 5], gameState: gs }),
    createContext({ teamId: "D", d1Scores: [50, 45], d2Scores: [30, 30], gameState: gs }),
  ];
}

describe("Engine-Strukturprüfung · arena-aufgelöste Disziplin ohne Arena-Ergebnis → arenaAusfall", () => {
  it(
    "K1-SIMULATION: heutiger Auto-Run-Zustand (KEINE Arena-Maps überhaupt) markiert jede Zeile der " +
      "arena-aufgelösten Disziplin als nicht_ausgefuehrt — die nicht-arena-aufgelöste Disziplin bleibt unmarkiert",
    () => {
      const preview = buildLegacyMatchdayResolvePreview(vierTeams(gameState("battle")));
      expect(D1_ARENA in Object.fromEntries([[D1_ARENA, 1]]) && ARENA_RESOLVED_DISCIPLINE_IDS.has(D1_ARENA)).toBe(true);
      expect(ARENA_RESOLVED_DISCIPLINE_IDS.has(D2_NICHT_ARENA)).toBe(false);

      const gewichtheben = preview.disciplinePreviews.find((d) => d.disciplineId === D1_ARENA)!;
      for (const team of gewichtheben.teamResults) {
        expect(team.arenaAusfall).toMatchObject({ grund: "nicht_ausgefuehrt" });
        expect(typeof team.arenaAusfall!.zeitpunkt).toBe("string");
        expect(team.warnings).toContain("arena_ausgefallen:nicht_ausgefuehrt");
        // Die Brücke rechnet unveraendert weiter -- NUR die Markierung ist neu.
        expect(team.resolutionSource).toBe("pps_duell");
        expect(team.pointSource).toBe("battle_mode_pps_duell_win_draw_loss");
        expect([0, 1, 2]).toContain(team.teamPoints);
      }

      const battlefield = preview.disciplinePreviews.find((d) => d.disciplineId === D2_NICHT_ARENA)!;
      for (const team of battlefield.teamResults) {
        expect(team.arenaAusfall ?? null).toBeNull();
        expect(team.warnings.some((w) => w.startsWith("arena_ausgefallen"))).toBe(false);
      }
    },
  );

  it("ein echtes Arena-Ergebnis löscht die Markierung (die Arena lief ja)", () => {
    const arena = new Map([
      ["A", { teamPoints: 2, arenaMatchSeed: "s", opponentTeamId: "B", seiten: [10, 2] as const, outcome: "win" as const }],
      ["B", { teamPoints: 0, arenaMatchSeed: "s", opponentTeamId: "A", seiten: [2, 10] as const, outcome: "loss" as const }],
    ]);
    const preview = buildLegacyMatchdayResolvePreview(vierTeams(gameState("battle")), {
      arenaTeamPointsByDisciplineId: new Map([[D1_ARENA, arena]]),
    });
    const gewichtheben = preview.disciplinePreviews.find((d) => d.disciplineId === D1_ARENA)!;
    const a = gewichtheben.teamResults.find((t) => t.teamId === "A")!;
    const b = gewichtheben.teamResults.find((t) => t.teamId === "B")!;
    const c = gewichtheben.teamResults.find((t) => t.teamId === "C")!;
    expect(a.arenaAusfall ?? null).toBeNull();
    expect(b.arenaAusfall ?? null).toBeNull();
    expect(a.resolutionSource).toBe("arena");
    // Das andere Fixture ohne Arena-Ergebnis bleibt markiert.
    expect(c.arenaAusfall).toMatchObject({ grund: "nicht_ausgefuehrt" });
    expect(c.resolutionSource).toBe("pps_duell");
  });

  it("ein EXPLIZIT erklärter Ausfallgrund (künftig: Arena-Vorlauf-Service, PR 3) wird übernommen, nicht nicht_ausgefuehrt", () => {
    const erklaert: ArenaAusfall = { grund: "timeout", detail: "Liga 1 ueber Budget", zeitpunkt: "2026-10-16T00:00:00.000Z", versuch: 1 };
    const preview = buildLegacyMatchdayResolvePreview(vierTeams(gameState("battle")), {
      arenaAusfallByDisciplineId: new Map([[D1_ARENA, erklaert]]),
    });
    const gewichtheben = preview.disciplinePreviews.find((d) => d.disciplineId === D1_ARENA)!;
    for (const team of gewichtheben.teamResults) {
      expect(team.arenaAusfall).toEqual(erklaert);
      expect(team.warnings).toContain("arena_ausgefallen:timeout");
    }
  });

  it("Manager-Save bleibt byte-identisch: arenaAusfall taucht nie auf, auch nicht fuer dieselbe Disziplin", () => {
    const preview = buildLegacyMatchdayResolvePreview(vierTeams(gameState("manager")));
    for (const disziplin of preview.disciplinePreviews) {
      for (const team of disziplin.teamResults) {
        expect(Object.prototype.hasOwnProperty.call(team, "arenaAusfall")).toBe(false);
        expect(team.warnings.some((w) => w.startsWith("arena_ausgefallen"))).toBe(false);
      }
    }
  });
});

describe("Ledger-Feld · arenaAusfall kommt im DisciplineResultWritePayload an", () => {
  it("wird aus der Preview-Zeile additiv in den Schreib-Payload übernommen — NICHT als `null`-Schlüssel auf jeder Zeile", async () => {
    const { mapLegacyMatchdayResolvePreviewToResultPayload } = await import("@/lib/resolve/legacy-matchday-result-mapper");
    const preview = buildLegacyMatchdayResolvePreview(vierTeams(gameState("battle")));
    const bundle = mapLegacyMatchdayResolvePreviewToResultPayload({
      preview,
      sourceVersion: "test",
    });
    const gewichthebenZeilen = bundle.disciplineResultPayloads.filter((p) => p.disciplineId === D1_ARENA);
    expect(gewichthebenZeilen.length).toBeGreaterThan(0);
    for (const zeile of gewichthebenZeilen) {
      expect(zeile.arenaAusfall).toMatchObject({ grund: "nicht_ausgefuehrt" });
    }
    // REGRESSION (Opus-Review): `arenaAusfall: teamResult.arenaAusfall ?? null` hätte den
    // Schlüssel auch auf JEDER Battlefield-Zeile (nicht arena-aufgelöst) als `null` angelegt --
    // additiv heißt: der Schlüssel fehlt dort komplett, nicht nur sein Wert ist null.
    const battlefieldZeilen = bundle.disciplineResultPayloads.filter((p) => p.disciplineId === D2_NICHT_ARENA);
    expect(battlefieldZeilen.length).toBeGreaterThan(0);
    for (const zeile of battlefieldZeilen) {
      expect(Object.prototype.hasOwnProperty.call(zeile, "arenaAusfall")).toBe(false);
    }
  });

  it(
    "Manager-Save: der geschriebene Payload (nicht nur die Preview) bekommt den Schlüssel arenaAusfall nie — " +
      "deckt genau die Stelle ab, die der Bit-Identitäts-Hash (nur Preview/Ledger-Lesung/Nachbuchung) NICHT prüft",
    async () => {
      const { mapLegacyMatchdayResolvePreviewToResultPayload } = await import("@/lib/resolve/legacy-matchday-result-mapper");
      const preview = buildLegacyMatchdayResolvePreview(vierTeams(gameState("manager")));
      const bundle = mapLegacyMatchdayResolvePreviewToResultPayload({ preview, sourceVersion: "test" });
      expect(bundle.disciplineResultPayloads.length).toBeGreaterThan(0);
      for (const zeile of bundle.disciplineResultPayloads) {
        expect(Object.prototype.hasOwnProperty.call(zeile, "arenaAusfall")).toBe(false);
      }
    },
  );
});

describe("K1-SIMULATION über den ECHTEN Spielfluss (Wizard + echter Auto-Run, kein konstruierter Context)", () => {
  it(
    "jede gebuchte Zeile einer arena-aufgelösten Disziplin trägt arenaAusfall:nicht_ausgefuehrt — " +
      "keine unmarkierte Brücken-Zeile für eine gewertete Arena-Disziplin (Opus-Review-Auflage)",
    async () => {
      process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-arena-ausfall-k1-${Math.random().toString(36).slice(2)}.sqlite`;
      const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
      const { applyNewGameSetup, previewNewGameSetup } = await import("@/lib/game/new-game-setup-service");
      const { fuehreLigaSetupDraftAus } = await import("@/lib/game/league-setup-draft-service");
      const { applyGameModeOwnership } = await import("@/lib/foundation/team-control-settings");
      const { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } = await import("@/lib/season/matchday-auto-run-service");

      const persistence = createPersistenceService();
      persistence.bootstrapSingleplayerSave();
      const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
      const preview = previewNewGameSetup(input);
      const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
      const saveId = angelegt.save.saveId;
      await fuehreLigaSetupDraftAus({
        persistence,
        saveId,
        seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
        callerWritableTeamIds: null,
        excludeTeamIds: [],
        logPrefix: "[arena-ausfall-k1]",
      });
      const nachDraft = persistence.getSaveById(saveId)!;
      persistence.saveSingleplayerState(
        saveId,
        applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
      );

      const aktuell = persistence.getSaveById(saveId)!;
      const seasonId = aktuell.gameState.season.id;
      const matchdayId = aktuell.gameState.matchdayState.matchdayId;
      // GENAU der Pfad, den Bühne/Cockpit/Skripte heute nehmen -- OHNE arenaModus-Option, OHNE
      // irgendeinen Arena-Vorlauf (der existiert erst mit PR 3). Das IST die K1-Lücke.
      const lauf = await runLocalMatchdayAutoRun(
        {
          saveId,
          seasonId,
          matchdayId,
          source: "sqlite",
          execute: true,
          dryRun: false,
          confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
          options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false },
        },
        persistence,
      );
      expect(lauf.ok, lauf.blockingReasons.join(" | ")).toBe(true);

      const ende = persistence.getSaveById(saveId)!;
      const zeilen = (ende.gameState.seasonState.disciplineResults ?? []).filter((z) => z.matchdayResultId && z.disciplineId);
      const arenaDisziplinenZeilen = zeilen.filter((z) => ARENA_RESOLVED_DISCIPLINE_IDS.has(z.disciplineId));
      expect(arenaDisziplinenZeilen.length).toBeGreaterThan(0);

      const unmarkiert = arenaDisziplinenZeilen.filter((z) => (z.arenaAusfall as ArenaAusfall | null | undefined)?.grund !== "nicht_ausgefuehrt");
      expect(unmarkiert, JSON.stringify(unmarkiert.slice(0, 3))).toHaveLength(0);
      for (const zeile of arenaDisziplinenZeilen) {
        expect(zeile.warnings).toContain("arena_ausgefallen:nicht_ausgefuehrt");
        // Die Brücke bucht trotzdem gueltige 0/1/2 -- die Markierung aendert keine Punkte.
        expect([0, 1, 2]).toContain(zeile.teamPoints);
        expect(zeile.resolutionSource).toBe("pps_duell");
      }

      // Gegenprobe: eine NICHT arena-aufgeloeste Disziplin desselben Spieltags bleibt unmarkiert.
      const nichtArenaZeilen = zeilen.filter((z) => !ARENA_RESOLVED_DISCIPLINE_IDS.has(z.disciplineId));
      for (const zeile of nichtArenaZeilen) {
        expect(zeile.arenaAusfall ?? null).toBeNull();
      }
    },
    240_000,
  );
});

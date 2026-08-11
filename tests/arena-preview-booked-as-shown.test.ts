import { describe, expect, it } from "vitest";

import {
  buildMatchdayArenaBaseSessionKey,
  buildMatchdayLineupRevision,
} from "@/lib/foundation/matchday-arena-session-cache";
import {
  buildResolvePreviewLineupFingerprint,
  decideResolvePreviewToBook,
} from "@/lib/resolve/resolve-preview-submission";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * „Wichtig ist, dass das Ergebnis, das man sieht, auch das ist, was in den Saisonstand
 * geschrieben wird."
 *
 * DIESE SUITE HAT FRUEHER QUELLTEXT GEPRUEFT — fuenf `expect(DATEI).toContain("…")` ueber die
 * Kette Buehne → Scope → Handler → Route → Dienst. Solche Zusicherungen bleiben gruen, wenn
 * jemand die Zeile stehen laesst und die Bedeutung aendert, und sie werden rot, wenn jemand
 * nur umformatiert. Beides ist falsch herum. Geprueft werden jetzt WERTE: die Entscheidung
 * selbst und, einmal ganz durch, die Zahl, die am Ende im Spielstand steht.
 */

const scope = { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-3" } as const;

function previewWith(input: {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  players?: string[];
  score?: number;
}): LegacyMatchdayResolvePreview {
  return {
    saveId: input.saveId ?? scope.saveId,
    seasonId: input.seasonId ?? scope.seasonId,
    matchdayId: input.matchdayId ?? scope.matchdayId,
    status: "ready",
    disciplinePreviews: [
      {
        disciplineId: "spurt",
        teamResults: [
          {
            teamId: "A-A",
            score: input.score ?? 100,
            entries: (input.players ?? ["p1", "p2"]).map((playerId) => ({ playerId })),
          },
        ],
      },
    ],
  } as never;
}

describe("Fingerabdruck einer Preview", () => {
  it("ignoriert die Zahlen und haelt sich an die Aufstellung", () => {
    const links = buildResolvePreviewLineupFingerprint(previewWith({ score: 100 }));
    const rechts = buildResolvePreviewLineupFingerprint(previewWith({ score: 137.4 }));
    expect(rechts).toBe(links);
  });

  it("sieht einen Spielertausch", () => {
    const links = buildResolvePreviewLineupFingerprint(previewWith({ players: ["p1", "p2"] }));
    const rechts = buildResolvePreviewLineupFingerprint(previewWith({ players: ["p1", "p9"] }));
    expect(rechts).not.toBe(links);
  });

  it("sieht auch eine reine Umstellung der Reihenfolge — die Etappe haengt daran", () => {
    const links = buildResolvePreviewLineupFingerprint(previewWith({ players: ["p1", "p2"] }));
    const rechts = buildResolvePreviewLineupFingerprint(previewWith({ players: ["p2", "p1"] }));
    expect(rechts).not.toBe(links);
  });
});

describe("Welche Preview gebucht wird", () => {
  it("bucht die eingereichte, wenn sie dieselbe Aufstellung beschreibt", () => {
    const entscheidung = decideResolvePreviewToBook({
      submitted: previewWith({ score: 137.4 }),
      serverPreview: previewWith({ score: 100 }),
      scope,
    });
    expect(entscheidung.source).toBe("arena");
    expect(entscheidung.rejectedReason).toBeNull();
    expect(entscheidung.preview.disciplinePreviews[0]!.teamResults[0]!.score).toBe(137.4);
  });

  it("bucht die frisch gerechnete, wenn gar nichts eingereicht wurde", () => {
    const entscheidung = decideResolvePreviewToBook({
      submitted: null,
      serverPreview: previewWith({ score: 100 }),
      scope,
    });
    expect(entscheidung.source).toBe("server");
    expect(entscheidung.preview.disciplinePreviews[0]!.teamResults[0]!.score).toBe(100);
  });

  it("weist eine Einreichung aus einem anderen Spieltag zurueck — und sagt warum", () => {
    const entscheidung = decideResolvePreviewToBook({
      submitted: previewWith({ matchdayId: "matchday-9", score: 137.4 }),
      serverPreview: previewWith({ score: 100 }),
      scope,
    });
    expect(entscheidung.source).toBe("server");
    expect(entscheidung.rejectedReason).toBe("submitted_preview_scope_mismatch");
    expect(entscheidung.preview.disciplinePreviews[0]!.teamResults[0]!.score).toBe(100);
  });

  it("weist eine Einreichung zurueck, deren Aufstellung ueberholt ist", () => {
    const entscheidung = decideResolvePreviewToBook({
      submitted: previewWith({ players: ["p1", "p2"], score: 137.4 }),
      serverPreview: previewWith({ players: ["p1", "p9"], score: 100 }),
      scope,
    });
    expect(entscheidung.source).toBe("server");
    expect(entscheidung.rejectedReason).toBe("submitted_preview_lineups_changed");
    expect(entscheidung.preview.disciplinePreviews[0]!.teamResults[0]!.score).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Einmal ganz durch: was eingereicht wird, steht danach im Spielstand.
// ---------------------------------------------------------------------------

function createInMemoryPersistence(gameState: GameState, cloneOnRead = false): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: "test-save",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  return {
    bootstrapSingleplayerSave() {
      return { save: cloneOnRead ? structuredClone(save) : save, createdFromSeed: false };
    },
    getActiveSave() {
      return cloneOnRead ? structuredClone(save) : save;
    },
    getSaveById(saveId) {
      if (save.saveId !== saveId) return null;
      return cloneOnRead ? structuredClone(save) : save;
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (save.saveId !== saveId) throw new Error(`Unknown save ${saveId}`);
      save = { ...save, updatedAt: "2026-06-06T00:00:01.000Z", gameState: structuredClone(nextGameState) };
      return save;
    },
    createSave() {
      throw new Error("Not implemented in test persistence.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    cloneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    activateSave(saveId) {
      if (save.saveId !== saveId) return null;
      return cloneOnRead ? structuredClone(save) : save;
    },
    listSaves() {
      return [
        {
          saveId: save.saveId,
          name: save.name,
          status: save.status,
          createdAt: save.createdAt,
          updatedAt: save.updatedAt,
        },
      ];
    },
  } as PersistenceService;
}

function topUpRostersForLineupMinimum(gameState: GameState, saveId = "test-save") {
  const persistence = createInMemoryPersistence(gameState);
  const contextResult = loadLocalLegacyLineupContext(
    {
      saveId,
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
      teamId: gameState.teams[0]!.teamId,
    },
    persistence,
  );
  if (!contextResult.ok) throw new Error(contextResult.errors.join(" | "));

  const requiredUniquePlayers =
    (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);
  const usedPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = gameState.rosters.length;

  for (const team of gameState.teams) {
    const teamRoster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) throw new Error("Not enough free players to top up lineup test rosters.");
      poolIndex += 1;
      gameState.rosters.push({
        id: `test-auto-roster-${rosterCounter}`,
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
      rosterCounter += 1;
    }
  }
}

function makeAllAiGameState(): GameState {
  const gameState = createFreshSeasonOneGameState();
  topUpRostersForLineupMinimum(gameState);
  const existingSettings = gameState.seasonState.teamControlSettings ?? {};
  gameState.seasonState.teamControlSettings = Object.fromEntries(
    gameState.teams.map((team) => [
      team.teamId,
      {
        ...existingSettings[team.teamId],
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
  return gameState;
}

describe("Die abgespielte Preview landet als ZAHL im Spielstand", () => {
  it("bucht den eingereichten Team-Score, nicht den einer zweiten Aufloesung", async () => {
    const gameState = makeAllAiGameState();
    const persistence = createInMemoryPersistence(gameState, true);
    const runScope = {
      saveId: "test-save",
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
    };

    // Aufstellungen festschreiben, damit die eingereichte Preview dieselben Bahnen
    // beschreibt wie der Server sie gleich vorfindet.
    applyAiLegacyLineupBatchLocally(
      { ...runScope, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );

    // Ein Trockenlauf liefert die Preview, die die Buehne zeigen wuerde.
    const trocken = await runLocalMatchdayAutoRun(
      {
        ...runScope,
        source: "sqlite",
        execute: false,
        dryRun: true,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: false,
          stopOnTie: false,
          advanceAfterCashApply: false,
        },
      },
      persistence,
    );
    expect(trocken.summary.resolveReady).toBe(true);

    const { buildLegacyMatchdayResolvePreview } = await import("@/lib/resolve/legacy-matchday-resolve-engine");
    const { loadLocalLegacyLineupContextFromGameState } = await import("@/lib/lineups/legacy-lineup-local-service");
    const stand = persistence.getSaveById("test-save")!.gameState;
    const contexts = stand.teams.map((team) => {
      const ergebnis = loadLocalLegacyLineupContextFromGameState(stand, { ...runScope, teamId: team.teamId });
      if (!ergebnis.ok) throw new Error(ergebnis.errors.join(" | "));
      return ergebnis.context;
    });
    const gezeigt = buildLegacyMatchdayResolvePreview(contexts);
    const disziplin = gezeigt.disciplinePreviews[0]!;
    const teamZeile = disziplin.teamResults[0]!;

    // Genau die Marke, an der man das Gebuchte wiedererkennt: ein Score, den keine
    // zweite Aufloesung von selbst treffen wuerde.
    //
    // ACHTUNG, GEMESSEN: die Preview traegt DIESELBE Zahl in ZWEI Feldern. Die Buehne liest
    // `teamResult.score`, die Buchung `teamResult.finalPreviewScore`
    // (`legacy-matchday-result-mapper.ts:201`). Die Engine setzt beide gemeinsam
    // (`legacy-matchday-resolve-engine.ts:569/570`), sie koennen also nur auseinanderlaufen,
    // wenn jemand eines davon anfasst. Ein erster Anlauf dieses Tests aenderte nur `score` —
    // gebucht wurde 356,5 statt der eingereichten 363,8. Deshalb hier beide, und der Test
    // haelt damit zugleich fest, dass Anzeige und Buchung dieselbe Zahl meinen muessen.
    const markierterScore = Number((teamZeile.score + 7.3).toFixed(1));
    const eingereicht = {
      ...gezeigt,
      disciplinePreviews: gezeigt.disciplinePreviews.map((dp, dpIndex) =>
        dpIndex !== 0
          ? dp
          : {
              ...dp,
              teamResults: dp.teamResults.map((tr, trIndex) =>
                trIndex !== 0 ? tr : { ...tr, score: markierterScore, finalPreviewScore: markierterScore },
              ),
            },
      ),
    } as LegacyMatchdayResolvePreview;
    // Beide Felder tragen im Engine-Ergebnis wirklich dieselbe Zahl — sonst ist die
    // Marke oben schon in sich falsch.
    expect(teamZeile.finalPreviewScore).toBe(teamZeile.score);

    const lauf = await runLocalMatchdayAutoRun(
      {
        ...runScope,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: false,
          stopOnTie: false,
          advanceAfterCashApply: false,
          submittedPreview: eingereicht,
        },
      },
      persistence,
    );
    expect(lauf.summary.resultApplyAllowed).toBe(true);
    // Angenommen heisst: keine Ablehnungs-Warnung.
    expect(lauf.warnings).not.toContain("submitted_preview_lineups_changed");
    expect(lauf.warnings).not.toContain("submitted_preview_scope_mismatch");

    const nachher = persistence.getSaveById("test-save")!.gameState.seasonState;
    const gebucht = (nachher.disciplineResults ?? []).find(
      (row) => row.disciplineId === disziplin.disciplineId && row.teamId === teamZeile.teamId,
    );
    expect(gebucht).toBeDefined();
    expect(gebucht!.totalScore).toBe(markierterScore);
  }, 120_000);
});

/**
 * Ohne diesen Teil waere die Einreichung ein Rueckschritt: die Buehne haette eine VERALTETE
 * Preview gezeigt, und die wuerde nun auch noch gebucht. Der Session-Cache der Arena hielt die
 * Resolve-Preview unter einem Schluessel aus Save/Saison/Spieltag/Team/Quelle — die
 * AUFSTELLUNGEN kamen darin nicht vor.
 */
describe("Preview-Cache der Arena", () => {
  const cacheScope = { seasonId: "season-1", matchdayId: "matchday-3" };
  const baseKeyParams = {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-3",
    teamId: "A-A",
    source: "sqlite" as const,
    includeDetails: true,
  };

  it("ein neuer Aufstellungsstand trifft den alten Cache-Eintrag nicht mehr", () => {
    const before = buildMatchdayLineupRevision(
      [{ ...cacheScope, teamId: "A-A", updatedAt: "2026-07-30T10:00:00.000Z" }],
      cacheScope,
    );
    const after = buildMatchdayLineupRevision(
      [
        { ...cacheScope, teamId: "A-A", updatedAt: "2026-07-30T10:00:00.000Z" },
        { ...cacheScope, teamId: "B-B", updatedAt: "2026-07-30T10:05:00.000Z" },
      ],
      cacheScope,
    );

    expect(before).not.toBe(after);
    expect(buildMatchdayArenaBaseSessionKey({ ...baseKeyParams, lineupRevision: before })).not.toBe(
      buildMatchdayArenaBaseSessionKey({ ...baseKeyParams, lineupRevision: after }),
    );
  });

  it("bemerkt auch eine geaenderte Aufstellung ohne neue Teams", () => {
    // Formkarte/Intensitaet/Kapitaen aendern die Eintraege nicht, das Ergebnis aber sehr wohl —
    // deshalb haengt die Revision am Zeitstempel und nicht an der Spielerauswahl.
    const before = buildMatchdayLineupRevision([{ ...cacheScope, teamId: "A-A", updatedAt: "10:00" }], cacheScope);
    const after = buildMatchdayLineupRevision([{ ...cacheScope, teamId: "A-A", updatedAt: "10:07" }], cacheScope);
    expect(before).not.toBe(after);
  });

  it("ignoriert Aufstellungen anderer Spieltage", () => {
    const withForeign = buildMatchdayLineupRevision(
      [
        { ...cacheScope, teamId: "A-A", updatedAt: "10:00" },
        { seasonId: "season-1", matchdayId: "matchday-4", teamId: "B-B", updatedAt: "11:00" },
      ],
      cacheScope,
    );
    expect(withForeign).toBe(
      buildMatchdayLineupRevision([{ ...cacheScope, teamId: "A-A", updatedAt: "10:00" }], cacheScope),
    );
  });
});

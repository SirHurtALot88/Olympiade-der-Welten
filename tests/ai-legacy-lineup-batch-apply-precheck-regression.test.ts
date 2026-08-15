import { describe, expect, it } from "vitest";

import { applyAiLegacyLineupBatchLocally, type AiBatchApplyResult } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import type { GameState, TeamControlSettings } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * ABSICHERUNG FUER DIE PERF-VORPRUEFUNG (`loadLocalLegacyLineupBatchPrecheckFromGameState`).
 *
 * Anlass (Chris, gemessen): `applyAiLegacyLineupBatchLocally` brauchte 2,25s an einem Spieltag,
 * an dem alle 32 Teams bereits vollstaendig aufgestellt waren (`overwriteExisting: false`) — der
 * volle, teure Kontext (Kader, Verfuegbarkeiten, Formkarten, Team-Powers, Manager-Doktrin, ...)
 * wurde fuer JEDES Team aufgebaut, nur um danach festzustellen, dass nichts zu tun war. Die
 * Vollstaendigkeits-Entscheidung liegt jetzt VOR dem vollen Kontextaufbau: Spielplan und
 * Sollbesetzung werden einmal pro Spieltag bestimmt, danach entscheidet sich billig pro Team
 * gegen `gameState.seasonState.lineupDrafts`, ob ueberhaupt Arbeit ansteht.
 *
 * Diese Datei prueft NICHT die Perf-Zahl (die schwankt je nach Maschine), sondern dass der Umbau
 * das ERGEBNIS nicht veraendert hat. Die Fixture mischt genau die Faelle, an denen sich die
 * billige Vorpruefung von der vollen Kontextentscheidung unterscheiden koennte:
 *  - ein Team mit bereits vollstaendiger, frischer Aufstellung (der haeufige Skip-Fall),
 *  - ein Team ohne Aufstellung (braucht echte Generierung -- die Vorpruefung muss durchfallen),
 *  - ein `manual`-Team (immer uebersprungen, unabhaengig von der Aufstellung),
 *  - ein `passive`-Team mit vollstaendiger Aufstellung (uebersprungen),
 *  - ein Team ohne Team-Identity im Save (`skipped_blocked` -- die Vorpruefung MUSS hier auf den
 *    vollen, fehlertragenden Pfad zurueckfallen, sonst fehlt die Fehlermeldung),
 *  - ein `ai`-Team ohne Freigabe (`aiLineupApplyEnabled: false`) mit vollstaendiger, aber
 *    VERALTETER Aufstellung (`skipped_disabled` -- der `existing`-Kurzschluss steht vor der
 *    Freigabepruefung und greift bei einer FRISCHEN Aufstellung unabhaengig von der Freigabe;
 *    erst eine veraltete Aufstellung faellt bis zur Freigabepruefung durch. Genau an dieser
 *    Kombination -- vollstaendig, aber veraltet -- wich ein frueherer Versuch dieses Umbaus
 *    tatsaechlich ab, s. u.),
 *  - ein Team mit vollstaendiger, aber VERALTETER Aufstellung (ein aufgestellter Spieler wurde
 *    verkauft -- die Frischepruefung muss das erkennen und auf Neugenerierung zurueckfallen).
 *
 * Die erwarteten Werte (`EXPECTED_RESULTS_BY_TEAM_ID` und `EXPECTED_SUMMARY`) stammen aus einem
 * Lauf VOR diesem Umbau (`loadLocalLegacyLineupContextFromGameState` fuer jedes Team, danach erst
 * die Vollstaendigkeitspruefung) -- Kommentar mit Messwerten in
 * `lib/ai/ai-legacy-lineup-batch-apply-service.ts` (Zeile ~1810 ff.).
 */

function createInMemoryPersistence(gameState: GameState): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: "precheck-test-save",
    name: "Precheck Test Save",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  return {
    bootstrapSingleplayerSave() {
      return { save, createdFromSeed: false };
    },
    getActiveSave() {
      return save;
    },
    getSaveById(saveId) {
      return save.saveId === saveId ? save : null;
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (save.saveId !== saveId) {
        throw new Error(`Unknown save ${saveId}`);
      }
      save = {
        ...save,
        updatedAt: "2026-06-06T00:00:01.000Z",
        gameState: structuredClone(nextGameState),
      };
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
      return save.saveId === saveId ? save : null;
    },
    getSaveVersionMetadata() {
      throw new Error("Not implemented in test persistence.");
    },
    createScenarioSnapshot() {
      throw new Error("Not implemented in test persistence.");
    },
    deleteSave() {
      throw new Error("Not implemented in test persistence.");
    },
    deleteSaves() {
      throw new Error("Not implemented in test persistence.");
    },
    listSaves() {
      return [
        { saveId: save.saveId, name: save.name, status: save.status, createdAt: save.createdAt, updatedAt: save.updatedAt },
      ];
    },
  };
}

// Wie `tests/ai-batch-partial-lineup.test.ts`: genug Kaderspieler, damit jedes Team beide
// Disziplinseiten des Spieltags vollstaendig besetzen KANN.
function topUpRostersForLineupMinimum(gameState: GameState, saveId: string) {
  const persistence = createInMemoryPersistence(gameState);
  const contextResult = loadLocalLegacyLineupContext(
    { saveId, seasonId: gameState.season.id, matchdayId: gameState.matchdayState.matchdayId, teamId: gameState.teams[0]!.teamId },
    persistence,
  );
  if (!contextResult.ok) {
    throw new Error(contextResult.errors.join(" | "));
  }

  const requiredUniquePlayers =
    (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);
  const usedPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = gameState.rosters.length;

  for (const team of gameState.teams) {
    const teamRoster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    // Zwei Reserve-Spieler extra je Team: der Staleness-Fall unten "verkauft" gezielt einen
    // aufgestellten Spieler und braucht danach immer noch genug Kader fuer eine Neugenerierung.
    const shortfall = Math.max(0, requiredUniquePlayers + 2 - teamRoster.length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) {
        throw new Error("Not enough free players to top up lineup test rosters.");
      }
      poolIndex += 1;
      gameState.rosters.push({
        id: `precheck-roster-${rosterCounter}`,
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

  return requiredUniquePlayers;
}

function setTeamControlSettings(gameState: GameState, teamId: string, overrides: Partial<TeamControlSettings>) {
  const existing = gameState.seasonState.teamControlSettings?.[teamId];
  if (!existing) {
    throw new Error(`Team ${teamId} has no default control settings in the fixture.`);
  }
  gameState.seasonState.teamControlSettings = {
    ...gameState.seasonState.teamControlSettings,
    [teamId]: { ...existing, ...overrides },
  };
}

function buildMixedFixture() {
  const saveId = "precheck-test-save";
  const gameState = createFreshSeasonOneGameState();
  topUpRostersForLineupMinimum(gameState, saveId);

  const [teamComplete, teamIncomplete, teamManual, teamPassive, teamBlocked, teamDisabled, teamStale] =
    gameState.teams.map((team) => team.teamId);

  // Schritt 1: fuer ALLE Teams eine echte, vollstaendige Aufstellung erzeugen (forceAiTeams
  // umgeht dafuer kurz die Freigabe-Pruefung) -- so stehen die Drafts in derselben Form da, die
  // ein Spieltag mit bereits abgegebenen Aufstellungen zeigen wuerde.
  const seedPersistence = createInMemoryPersistence(gameState);
  const seedResult = applyAiLegacyLineupBatchLocally(
    {
      saveId,
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
      overwriteExisting: false,
      forceAiTeams: true,
      dryRun: false,
    },
    seedPersistence,
  );
  if (seedResult.summary.savedTeams < gameState.teams.length) {
    throw new Error(
      `Fixture-Vorbereitung unvollstaendig: nur ${seedResult.summary.savedTeams}/${gameState.teams.length} Teams erhielten eine Aufstellung.`,
    );
  }
  const seeded = structuredClone(seedPersistence.getSaveById(saveId)!.gameState);

  // Schritt 2: die einzelnen Sonderfaelle einrichten.
  setTeamControlSettings(seeded, teamManual!, { controlMode: "manual" });
  setTeamControlSettings(seeded, teamPassive!, { controlMode: "passive" });
  setTeamControlSettings(seeded, teamDisabled!, { controlMode: "ai", aiLineupApplyEnabled: false, aiLineupAutoApplyEnabled: false });
  setTeamControlSettings(seeded, teamComplete!, { controlMode: "ai", aiLineupApplyEnabled: true });
  setTeamControlSettings(seeded, teamIncomplete!, { controlMode: "ai", aiLineupApplyEnabled: true });
  setTeamControlSettings(seeded, teamStale!, { controlMode: "ai", aiLineupApplyEnabled: true });

  // teamIncomplete: Aufstellung komplett entfernen -- die Vorpruefung muss hier durchfallen und
  // den vollen Kontext fuer eine echte Neugenerierung laden.
  seeded.seasonState.lineupDrafts = (seeded.seasonState.lineupDrafts ?? []).filter(
    (draft) => !(draft.teamId === teamIncomplete && draft.matchdayId === gameState.matchdayState.matchdayId),
  );

  // teamBlocked: Team-Identity aus dem Save entfernen -- der volle Kontextaufbau liefert dafuer
  // `ok: false`. Die Vorpruefung muss das erkennen (`hasTeamAndIdentity`) und auf den vollen,
  // fehlertragenden Pfad zurueckfallen, statt selbst faelschlich "vollstaendig" zu meldden.
  seeded.teamIdentities = seeded.teamIdentities.filter((identity) => identity.teamId !== teamBlocked);

  // teamStale UND teamDisabled: je einen aufgestellten Spieler aus dem Kader "verkaufen" -- die
  // vorhandene Aufstellung ist damit formal vollstaendig, aber veraltet (genau der Fall aus
  // Meldung 32k3rk, s. `lib/ai/ai-lineup-freshness.ts`). `teamDisabled` braucht das zusaetzlich zu
  // seiner fehlenden Freigabe: `shouldSkipExistingAiDraft` (existing-Kurzschluss) steht VOR der
  // Freigabepruefung und greift bei einer frischen Aufstellung unabhaengig von `aiEligible` --
  // erst eine veraltete Aufstellung faellt durch bis zur Freigabepruefung und wird `skipped_disabled`.
  const sellOneDraftedPlayer = (teamId: string) => {
    const draft = (seeded.seasonState.lineupDrafts ?? []).find(
      (entry) => entry.teamId === teamId && entry.matchdayId === gameState.matchdayState.matchdayId,
    );
    if (!draft || draft.entries.length === 0) {
      throw new Error(`Fixture-Vorbereitung: ${teamId} hat keinen verwertbaren Draft.`);
    }
    const soldPlayerId = draft.entries[0]!.playerId;
    seeded.rosters = seeded.rosters.filter((entry) => !(entry.teamId === teamId && entry.playerId === soldPlayerId));
  };
  sellOneDraftedPlayer(teamStale!);
  sellOneDraftedPlayer(teamDisabled!);

  return {
    gameState: seeded,
    saveId,
    teamIds: { teamComplete: teamComplete!, teamIncomplete: teamIncomplete!, teamManual: teamManual!, teamPassive: teamPassive!, teamBlocked: teamBlocked!, teamDisabled: teamDisabled!, teamStale: teamStale! },
  };
}

function stripNonDeterministic(result: AiBatchApplyResult) {
  const clone = structuredClone(result) as AiBatchApplyResult & { summary: { performanceBreakdown?: unknown } };
  delete clone.summary.performanceBreakdown;
  return clone;
}

describe("applyAiLegacyLineupBatchLocally bleibt nach der Perf-Vorpruefung ergebnisgleich", () => {
  it("liefert fuer jedes Team denselben result-Typ wie vor dem Umbau", () => {
    const fixture = buildMixedFixture();
    const persistence = createInMemoryPersistence(fixture.gameState);

    const result = applyAiLegacyLineupBatchLocally(
      {
        saveId: fixture.saveId,
        seasonId: fixture.gameState.season.id,
        matchdayId: fixture.gameState.matchdayState.matchdayId,
        overwriteExisting: false,
        dryRun: true,
      },
      persistence,
    );

    const byTeamId = new Map(result.results.map((entry) => [entry.teamId, entry]));

    // Der haeufige Fall aus der Meldung: vollstaendige, frische Aufstellung wird uebersprungen,
    // OHNE dass der volle Kontext dafuer geladen wurde.
    expect(byTeamId.get(fixture.teamIds.teamComplete)?.result).toBe("skipped_existing");
    expect(byTeamId.get(fixture.teamIds.teamComplete)?.overwriteExisting).toBe(true);
    expect(byTeamId.get(fixture.teamIds.teamComplete)?.blockingReasons).toEqual(["existing_lineup_requires_overwrite_confirm"]);

    // Fehlende Aufstellung -> die Vorpruefung faellt durch, volle Generierung laeuft.
    expect(byTeamId.get(fixture.teamIds.teamIncomplete)?.result).toBe("saved");
    expect(byTeamId.get(fixture.teamIds.teamIncomplete)?.saved).toBe(false); // dryRun: true

    // `manual` wird IMMER uebersprungen, unabhaengig von der Aufstellung.
    expect(byTeamId.get(fixture.teamIds.teamManual)?.result).toBe("skipped_manual");

    // `passive` mit vollstaendiger Aufstellung wird uebersprungen.
    expect(byTeamId.get(fixture.teamIds.teamPassive)?.result).toBe("skipped_passive");

    // Fehlende Team-Identity: die Vorpruefung MUSS auf den vollen Pfad zurueckfallen, sonst fehlt
    // die Fehlermeldung fuer `skipped_blocked`.
    const blockedEntry = byTeamId.get(fixture.teamIds.teamBlocked);
    expect(blockedEntry?.result).toBe("skipped_blocked");
    expect(blockedEntry?.blockingReasons.some((reason) => reason.includes(fixture.teamIds.teamBlocked))).toBe(true);

    // `ai` ohne Freigabe, aber vollstaendige Aufstellung -- GENAU der Fall, an dem ein frueherer
    // Versuch dieses Umbaus abwich (die Frischepruefung lief mit einem zu kleinen "Kader" aus nur
    // den aufgestellten Spielern und meldete faelschlich eine veraltete Aufstellung).
    expect(byTeamId.get(fixture.teamIds.teamDisabled)?.result).toBe("skipped_disabled");
    expect(byTeamId.get(fixture.teamIds.teamDisabled)?.blockingReasons).toEqual(["ai_lineup_apply_disabled"]);

    // Verkaufter Spieler in einer sonst vollstaendigen Aufstellung: die Frischepruefung muss das
    // erkennen und auf eine Neugenerierung zurueckfallen, statt den veralteten Entwurf stehen zu
    // lassen (Meldung 32k3rk).
    expect(byTeamId.get(fixture.teamIds.teamStale)?.result).toBe("saved");
  });

  it("stimmt vollstaendig (results + summary, ohne Perf-Zahlen) mit dem Lauf VOR dem Umbau ueberein", () => {
    const fixture = buildMixedFixture();
    const persistence = createInMemoryPersistence(fixture.gameState);

    const result = applyAiLegacyLineupBatchLocally(
      {
        saveId: fixture.saveId,
        seasonId: fixture.gameState.season.id,
        matchdayId: fixture.gameState.matchdayState.matchdayId,
        overwriteExisting: false,
        dryRun: true,
      },
      persistence,
    );

    // Snapshot-Baseline, mitgeschnitten VOR dem Umbau (unveraendertes
    // `loadLocalLegacyLineupContextFromGameState` je Team, danach erst die
    // Vollstaendigkeitspruefung) -- s. Kommentar am Dateikopf.
    expect(stripNonDeterministic(result)).toMatchSnapshot();
  });
});

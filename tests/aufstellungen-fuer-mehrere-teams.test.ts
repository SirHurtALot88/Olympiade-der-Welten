import { beforeEach, describe, expect, it } from "vitest";

import type { LegacyLineupEntryInput } from "@/lib/lineups/legacy-lineup-types";
import {
  getSharedLineupContextBaseCacheStatsForTests,
  loadLocalLegacyLineupContext,
  resetSharedLineupContextBaseCacheForTests,
  saveLocalLegacyLineupDraft,
  saveLocalLegacyLineupDraftBatch,
} from "@/lib/lineups/legacy-lineup-local-service";
import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import type { PersistenceService } from "@/lib/persistence/types";

/**
 * Stufe 2 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Befund B5): Aufstellungen fuer mehrere eigene
 * Teams. Pinnt vier Eigenschaften des Sammel-Speicherns (`saveLocalLegacyLineupDraftBatch`):
 *
 *  1. n Teams in einem Aufruf ⇒ GENAU EIN Schreibvorgang.
 *  2. Ein Kaderproblem in einem Team blockiert die anderen nicht mehr (statt Alles-oder-nichts).
 *  3. Ein fremdes Team im Stapel wird abgelehnt, die eigenen laufen durch.
 *  4. Der geteilte Kontext-Cache wird durch mehrere Speichervorgaenge nicht mehr global entwertet.
 */

// Dieselbe Hilfsfunktion wie in legacy-lineup-local-service.test.ts (dort nicht exportiert) — baut
// eine vollstaendige, gueltige Einsatzliste aus dem geladenen Kontext.
function buildEntriesFromContext(
  input: ReturnType<typeof loadLocalLegacyLineupContext>,
  options?: { d1Captain?: boolean; d2Captain?: boolean },
) {
  if (!input.ok) {
    throw new Error(input.errors.join(" | "));
  }

  const { context } = input;
  const d1 = context.matchdayContract?.discipline1;
  const d2 = context.matchdayContract?.discipline2;
  if (!d1 || !d2 || !d1.requiredPlayers || !d2.requiredPlayers) {
    throw new Error("Missing matchday discipline contract.");
  }

  const entries: LegacyLineupEntryInput[] = [];
  let cursor = 0;
  for (let index = 0; index < d1.requiredPlayers; index += 1) {
    const activePlayer = context.activePlayers[cursor];
    if (!activePlayer) {
      throw new Error("Not enough active players for d1.");
    }
    entries.push({
      disciplineId: d1.disciplineId,
      disciplineSide: "d1",
      slotIndex: index,
      playerId: activePlayer.playerId,
      activePlayerId: activePlayer.id,
      isCaptain: index === 0 && (options?.d1Captain ?? true),
    });
    cursor += 1;
  }

  for (let index = 0; index < d2.requiredPlayers; index += 1) {
    const activePlayer = context.activePlayers[cursor];
    if (!activePlayer) {
      throw new Error("Not enough active players for d2.");
    }
    entries.push({
      disciplineId: d2.disciplineId,
      disciplineSide: "d2",
      slotIndex: index,
      playerId: activePlayer.playerId,
      activePlayerId: activePlayer.id,
      isCaptain: index === 0 && (options?.d2Captain ?? false),
    });
    cursor += 1;
  }

  return entries;
}

function topUpRosterCoverage(saveId: string, requiredUniquePlayers = 12) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} could not be loaded for roster top-up.`);
  }

  const usedPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = save.gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let freeIndex = 0;
  let rosterCounter = save.gameState.rosters.length;
  let changed = false;

  for (const team of save.gameState.teams) {
    const roster = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - roster.length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[freeIndex];
      if (!player) {
        throw new Error("Not enough free players to top up lineup roster coverage.");
      }
      freeIndex += 1;
      save.gameState.rosters.push({
        id: `mehrere-teams-topup-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: save.gameState.season.id,
      });
      rosterCounter += 1;
      changed = true;
    }
  }

  if (changed) {
    persistence.saveSingleplayerState(saveId, save.gameState);
  }
}

/** Setzt Besitz/Steuerung fuer die genannten Teams; alle anderen bleiben unveraendert. */
function setTeamOwnership(saveId: string, ownerByTeamId: Record<string, string>) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} could not be loaded for ownership setup.`);
  }
  const existing = save.gameState.seasonState.teamControlSettings ?? {};
  const next = { ...existing };
  for (const [teamId, ownerId] of Object.entries(ownerByTeamId)) {
    next[teamId] = {
      teamId,
      controlMode: "manual",
      ownerId,
      aiLineupPreviewEnabled: false,
      aiLineupAutoApplyEnabled: false,
      aiTransferPreviewEnabled: false,
      aiTransferAutoApplyEnabled: false,
      aiSellPreviewEnabled: false,
      aiSellAutoApplyEnabled: false,
    };
  }
  persistence.saveSingleplayerState(saveId, {
    ...save.gameState,
    seasonState: { ...save.gameState.seasonState, teamControlSettings: next },
  });
}

function setUpThreeTeamSave(name: string) {
  const persistence = createPersistenceService();
  const save = persistence.createFreshSeasonOneSave({ name });
  topUpRosterCoverage(save.saveId);
  const [teamA, teamB, teamC] = save.gameState.teams;
  if (!teamA || !teamB || !teamC) {
    throw new Error("Expected at least three teams in the fresh season-one save.");
  }
  return {
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    matchdayId: save.gameState.matchdayState.matchdayId,
    teamAId: teamA.teamId,
    teamBId: teamB.teamId,
    teamCId: teamC.teamId,
  };
}

function loadValidEntries(scope: { saveId: string; seasonId: string; matchdayId: string; teamId: string }) {
  const context = loadLocalLegacyLineupContext(scope);
  return buildEntriesFromContext(context);
}

/** Zaehlt Schreibvorgaenge, ohne die echte Persistenz zu ersetzen — delegiert an sie weiter. */
function countingPersistence(): { persistence: PersistenceService; writeCount: () => number } {
  const real = createPersistenceService();
  let writeCount = 0;
  const persistence: PersistenceService = {
    ...real,
    saveSingleplayerState(saveId, gameState, input) {
      writeCount += 1;
      return real.saveSingleplayerState(saveId, gameState, input);
    },
  };
  return { persistence, writeCount: () => writeCount };
}

describe("Aufstellungen fuer mehrere eigene Teams", { timeout: 120_000 }, () => {
  beforeEach(() => {
    resetDatabaseForTests();
    resetSharedLineupContextBaseCacheForTests();
  });

  it("speichert n Teams in einem Aufruf ueber GENAU EINEN Schreibvorgang", () => {
    const scope = setUpThreeTeamSave("Batch Ein-Schreibvorgang");
    const entriesA = loadValidEntries({ ...scope, teamId: scope.teamAId });
    const entriesB = loadValidEntries({ ...scope, teamId: scope.teamBId });

    const { persistence, writeCount } = countingPersistence();
    const result = saveLocalLegacyLineupDraftBatch(
      [
        { params: { ...scope, teamId: scope.teamAId }, entries: entriesA },
        { params: { ...scope, teamId: scope.teamBId }, entries: entriesB },
      ],
      persistence,
      { lockMatchday: true },
    );

    expect(result.ok).toBe(true);
    expect(result.savedCount).toBe(2);
    expect(result.results.every((entry) => entry.ok)).toBe(true);
    // Der eigentliche Beleg: nicht "einer pro Team" (2), sondern GENAU einer fuer den ganzen Stapel.
    expect(writeCount()).toBe(1);

    // Zum Vergleich, aus derselben Messung: der bisherige menschliche Weg (Einzelroute, ein PUT je
    // Team) braucht fuer dieselben zwei Teams zwei Schreibvorgaenge — das IST das Loch aus Befund
    // B5/1 ("vier eigene Teams -> vier Voll-Schreibvorgaenge"), hier an zwei Teams nachgemessen.
    const scope2 = setUpThreeTeamSave("Einzelweg Vergleich");
    const entriesA2 = loadValidEntries({ ...scope2, teamId: scope2.teamAId });
    const entriesB2 = loadValidEntries({ ...scope2, teamId: scope2.teamBId });
    const { persistence: singlePersistence, writeCount: singleWriteCount } = countingPersistence();
    const singleResultA = saveLocalLegacyLineupDraft(
      { ...scope2, teamId: scope2.teamAId },
      entriesA2,
      undefined,
      singlePersistence,
      { lockMatchday: true },
    );
    const singleResultB = saveLocalLegacyLineupDraft(
      { ...scope2, teamId: scope2.teamBId },
      entriesB2,
      undefined,
      singlePersistence,
      { lockMatchday: true },
    );
    expect(singleResultA.ok).toBe(true);
    expect(singleResultB.ok).toBe(true);
    expect(singleWriteCount()).toBe(2);
  });

  it("laesst ein Kaderproblem in einem Team die anderen nicht blockieren (statt Alles-oder-nichts)", () => {
    const scope = setUpThreeTeamSave("Kaderproblem blockiert nicht");
    const entriesA = loadValidEntries({ ...scope, teamId: scope.teamAId });
    const entriesB = loadValidEntries({ ...scope, teamId: scope.teamBId });
    // Team C: absichtlich KEINE Eintraege -> "lineup_not_operationally_ready" (das Kaderproblem).
    const brokenEntriesC: LegacyLineupEntryInput[] = [];

    const { persistence, writeCount } = countingPersistence();
    const result = saveLocalLegacyLineupDraftBatch(
      [
        { params: { ...scope, teamId: scope.teamAId }, entries: entriesA },
        { params: { ...scope, teamId: scope.teamBId }, entries: entriesB },
        { params: { ...scope, teamId: scope.teamCId }, entries: brokenEntriesC },
      ],
      persistence,
    );

    // A und B laufen durch, obwohl C ein Kaderproblem hat.
    expect(result.savedCount).toBe(2);
    expect(writeCount()).toBe(1);

    const resultA = result.results.find((entry) => entry.teamId === scope.teamAId);
    const resultB = result.results.find((entry) => entry.teamId === scope.teamBId);
    const resultC = result.results.find((entry) => entry.teamId === scope.teamCId);
    expect(resultA?.ok).toBe(true);
    expect(resultB?.ok).toBe(true);
    expect(resultC?.ok).toBe(false);
    // Der Grund steht im Ergebnis dieses einen Teams, nicht als globaler Fehlschlag.
    expect(resultC?.errors).toContain("lineup_not_operationally_ready");

    // A und B sind tatsaechlich im Save gelandet (nicht nur im Ergebnis behauptet) — UND ueber
    // denselben (gecachten) Kontextaufbau sichtbar, nicht nur beim ersten (kalten) Aufruf.
    const draftA = loadLocalLegacyLineupContext({ ...scope, teamId: scope.teamAId });
    if (!draftA.ok) {
      throw new Error(`draftA not ok: ${draftA.errors.join(" | ")}`);
    }
    expect(draftA.context.existingDraft?.entries.length).toBe(entriesA.length);
  });

  it("lehnt ein fremdes Team im Stapel ab und laesst die eigenen durchlaufen", () => {
    const scope = setUpThreeTeamSave("Fremdes Team im Stapel");
    // Team A und B gehoeren dem lokalen Standard-Besitzer (Chris), Team C gehoert Franky.
    setTeamOwnership(scope.saveId, {
      [scope.teamAId]: DEFAULT_ACTIVE_OWNER_ID,
      [scope.teamBId]: DEFAULT_ACTIVE_OWNER_ID,
      [scope.teamCId]: FRANKY_OWNER_ID,
    });

    const entriesA = loadValidEntries({ ...scope, teamId: scope.teamAId });
    const entriesB = loadValidEntries({ ...scope, teamId: scope.teamBId });
    const entriesC = loadValidEntries({ ...scope, teamId: scope.teamCId });

    const { persistence, writeCount } = countingPersistence();
    const result = saveLocalLegacyLineupDraftBatch(
      [
        { params: { ...scope, teamId: scope.teamAId }, entries: entriesA },
        { params: { ...scope, teamId: scope.teamBId }, entries: entriesB },
        { params: { ...scope, teamId: scope.teamCId }, entries: entriesC },
      ],
      persistence,
      { activeOwnerId: DEFAULT_ACTIVE_OWNER_ID },
    );

    expect(result.savedCount).toBe(2);
    expect(writeCount()).toBe(1);

    const resultA = result.results.find((entry) => entry.teamId === scope.teamAId);
    const resultB = result.results.find((entry) => entry.teamId === scope.teamBId);
    const resultC = result.results.find((entry) => entry.teamId === scope.teamCId);
    expect(resultA?.ok).toBe(true);
    expect(resultB?.ok).toBe(true);
    expect(resultC?.ok).toBe(false);
    expect(resultC?.errors).toContain("local_team_not_owned_or_ai_controlled");

    // Franky's Team C wurde NICHT gespeichert.
    const draftC = loadLocalLegacyLineupContext({ ...scope, teamId: scope.teamCId });
    expect(draftC.ok && draftC.context.existingDraft).toBeNull();
  });

  it("entwertet den geteilten Kontext-Cache nicht mehr global bei vier aufeinanderfolgenden Speichervorgaengen", () => {
    const scope = setUpThreeTeamSave("Cache je Team");
    const persistence = createPersistenceService();
    const teamIds = [scope.teamAId, scope.teamBId, scope.teamCId];
    // Braucht ein viertes Team fuer "vier Spieltag-Speichervorgaenge" — nimm ein weiteres aus dem
    // Save (Season-1-Fixture hat deutlich mehr als drei Teams).
    const save = persistence.getSaveById(scope.saveId);
    const fourthTeamId = save?.gameState.teams.find((team) => !teamIds.includes(team.teamId))?.teamId;
    if (!fourthTeamId) {
      throw new Error("Expected a fourth team for the four-save cache measurement.");
    }
    const fourTeamIds = [...teamIds, fourthTeamId];

    // Entwuerfe vorab bauen (das ist die Rolle der Oberflaeche: sie hat die Auswahl schon lokal,
    // bevor der Spieler auf "Speichern" klickt) — NUR die vier eigentlichen Speichervorgaenge
    // sollen in der Messung stehen, nicht das Vorbereiten der Testdaten.
    const entriesByTeamId = new Map(fourTeamIds.map((teamId) => [teamId, loadValidEntries({ ...scope, teamId })] as const));

    resetSharedLineupContextBaseCacheForTests();
    for (const teamId of fourTeamIds) {
      const scopedParams = { ...scope, teamId };
      const entries = entriesByTeamId.get(teamId)!;
      const saveResult = saveLocalLegacyLineupDraft(scopedParams, entries, undefined, persistence);
      expect(saveResult.ok).toBe(true);
    }

    const stats = getSharedLineupContextBaseCacheStatsForTests();
    // VORHER (Befund B5/3, nachgezogen ueber die alte Schluessel-Bildung mit
    // `lineupDraftSignature` ueber ALLE Entwuerfe): jedes der vier Speichern haette eine andere
    // Signatur erzeugt -> 4 Fehlschlaege, 0 Treffer (siehe Kommentar an
    // `buildSharedLineupContextBaseCacheKey`). NACHHER: der Kontext haengt nicht an den
    // Entwuerfen, also EIN Kaltaufbau fuer alle vier Speichervorgaenge, die restlichen drei
    // treffen auf den bereits gebauten Kontext.
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(3);
  });
});

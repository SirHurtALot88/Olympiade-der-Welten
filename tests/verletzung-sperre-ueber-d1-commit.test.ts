/**
 * Saisontest-Fund 02.11. (Battle Mode VW, `new-game-1793629096917-sjsiu9`):
 *  (1) Am Vortag Verletzte wurden in D2 ihres Sperr-Spieltags gewertet — der D1-Teil-Commit stellte
 *      sie schon auf `recovering` und gab sie damit fuer D2 frei.
 *  (2) D2-Zeilen trugen `invalid_lineup`, weil sich ein Teamkollege in der bereits gebuchten D1
 *      verletzt hatte.
 *  (3) Netz darunter: ein eingefrorener KI-Entwurf mit gesperrtem Spieler auf der offenen Seite wird
 *      gezielt nachbesetzt.
 */
import { describe, expect, it } from "vitest";

import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import { applyFatigueAndInjuryAfterMatchday, getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import type { LegacyLineupContext } from "@/lib/lineups/legacy-lineup-types";
import { repairFrozenAiDraftsWithBlockedPlayers } from "@/lib/ai/ai-frozen-draft-blocked-repair";

const SCOPE = { saveId: "save-1", seasonId: "season-1", matchdayId: "md-2" };

function spieler(id: string, rating: number) {
  return {
    id,
    name: id,
    className: "Runner",
    race: "Human",
    marketValue: 10,
    salary: 2,
    fatigue: 20,
    attributes: {},
    disciplineRatings: { tdm: rating, spurt: rating },
  };
}

/**
 * Team A-A an md-2: `gesperrt` hat sich an md-1 verletzt (Sperre bis einschliesslich md-2) und steht
 * im Entwurf auf D2. D1 laeuft mit `d1-laeufer`, auf der Bank sitzen `bank-stark` und `bank-schwach`.
 */
function createState(options?: { d1Gebucht?: boolean; teamId?: string }): GameState {
  const teamId = options?.teamId ?? "A-A";
  const draft: LineupDraft = {
    lineupId: "lineup-1",
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "md-2",
    teamId,
    status: "submitted",
    entries: [
      { disciplineId: "spurt", disciplineSide: "d1", slotIndex: 0, playerId: "d1-laeufer", activePlayerId: "roster-d1-laeufer" },
      { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 0, playerId: "gesperrt", activePlayerId: "roster-gesperrt", isCaptain: true },
    ],
    createdAt: "2026-11-02T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
  };
  const ids = ["d1-laeufer", "gesperrt", "bank-stark", "bank-schwach"];
  const ratings: Record<string, number> = { "d1-laeufer": 70, gesperrt: 90, "bank-stark": 80, "bank-schwach": 40 };
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 2, matchdayIds: ["md-1", "md-2", "md-3"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      lineupDrafts: [draft],
      matchdayResults: options?.d1Gebucht
        ? [{ id: "result-md-2", saveId: "save-1", seasonId: "season-1", matchdayId: "md-2" }]
        : [],
      disciplineResults: options?.d1Gebucht
        ? [{ id: "dr-1", matchdayResultId: "result-md-2", teamId, disciplineId: "spurt", disciplineSide: "d1" }]
        : [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      resultAuditLogs: [],
      playerAvailabilityState: ids.map((playerId) =>
        playerId === "gesperrt"
          ? {
              playerId,
              teamId,
              fatigue: 60,
              injuryStatus: "injured" as const,
              injuredAtSeasonId: "season-1",
              injuredAtMatchdayId: "md-1",
              injuryUntilMatchday: "md-2",
            }
          : { playerId, teamId, fatigue: 20, injuryStatus: "healthy" as const },
      ),
    },
    matchdayState: { matchdayId: "md-2", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId, shortCode: teamId, name: teamId, budget: 100, cash: 100, identityId: "id", humanControlled: false, rosterLimit: 12 }],
    teamIdentities: [],
    players: ids.map((id) => spieler(id, ratings[id]!)),
    disciplines: [],
    rosters: ids.map((playerId) => ({ id: `roster-${playerId}`, teamId, playerId, role: "core", joinedSeasonId: "season-1" })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
  } as unknown as GameState;
}

describe("Sperre ueber den D1-Teil-Commit", () => {
  it("gibt einen am Vortag Verletzten nach dem D1-Commit NICHT fuer D2 frei", () => {
    const gameState = createState();
    expect(getPlayerAvailabilityView(gameState, "gesperrt", "A-A", "md-2").isUnavailable).toBe(true);

    const nachD1 = applyFatigueAndInjuryAfterMatchday({
      gameState,
      ...SCOPE,
      matchdayResultId: "result-md-2",
      timestamp: "2026-11-02T00:00:00.000Z",
      commitThroughSide: "d1",
    });
    const eintrag = nachD1.gameState.seasonState.playerAvailabilityState?.find((entry) => entry.playerId === "gesperrt");
    // Vorher: `recovering` — und damit fuer D2 einsatzfaehig.
    expect(eintrag?.injuryStatus).toBe("injured");
    expect(getPlayerAvailabilityView(nachD1.gameState, "gesperrt", "A-A", "md-2").isUnavailable).toBe(true);
  });

  it("stellt erst der abschliessende Commit auf recovering, am Folgespieltag ist er wieder da", () => {
    const nachD1 = applyFatigueAndInjuryAfterMatchday({
      gameState: createState(),
      ...SCOPE,
      matchdayResultId: "result-md-2",
      timestamp: "2026-11-02T00:00:00.000Z",
      commitThroughSide: "d1",
    });
    const mitD1Ergebnis = {
      ...nachD1.gameState,
      seasonState: {
        ...nachD1.gameState.seasonState,
        matchdayResults: [{ id: "result-md-2", saveId: "save-1", seasonId: "season-1", matchdayId: "md-2" }],
        disciplineResults: [{ id: "dr-1", matchdayResultId: "result-md-2", teamId: "A-A", disciplineId: "spurt", disciplineSide: "d1" }],
      },
    } as unknown as GameState;
    const nachD2 = applyFatigueAndInjuryAfterMatchday({
      gameState: mitD1Ergebnis,
      ...SCOPE,
      matchdayResultId: "result-md-2",
      timestamp: "2026-11-02T00:00:00.000Z",
      commitThroughSide: "d2",
      isMatchdayReplay: true,
    });
    const eintrag = nachD2.gameState.seasonState.playerAvailabilityState?.find((entry) => entry.playerId === "gesperrt");
    expect(eintrag?.injuryStatus).toBe("recovering");
    // Kein Verletzungswurf fuer den Gesperrten am Sperr-Spieltag.
    expect(nachD2.injuryEvents.some((event) => event.playerId === "gesperrt")).toBe(false);
    expect(getPlayerAvailabilityView(nachD2.gameState, "gesperrt", "A-A", "md-3").isUnavailable).toBe(false);
  });
});

describe("Aufstellungspruefung: Verletzung waehrend des Spieltags ist kein Aufstellungsfehler", () => {
  function context(injuredAtMatchdayId: string): LegacyLineupContext {
    return {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-2",
      teamId: "A-A",
      entries: [
        { disciplineId: "spurt", disciplineSide: "d1", slotIndex: 0, playerId: "verletzt", activePlayerId: "roster-verletzt" },
        { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 0, playerId: "fit", activePlayerId: "roster-fit" },
      ],
      disciplinePlayerCounts: { spurt: 1, tdm: 1 },
      disciplineSidePlayerCounts: { "spurt::d1": 1, "tdm::d2": 1 },
      // Wie im Kontext-Loader: der Gesperrte faellt aus der Auswahlliste.
      activePlayers: [{ id: "roster-fit", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "fit" }],
      rosterPlayers: [
        {
          id: "verletzt",
          name: "verletzt",
          coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
          injuryStatus: "injured",
          injuryUntilMatchday: "md-3",
          injuredAtMatchdayId,
          availabilityBlocker: "player_injured_unavailable",
        },
        { id: "fit", name: "fit", coreStats: { pow: 10, spe: 10, men: 10, soc: 10 }, injuryStatus: "healthy" },
      ],
      disciplineScores: [],
    } as LegacyLineupContext;
  }

  it("in D1 desselben Spieltags verletzt: Warnung, Entwurf bleibt gueltig (vorher invalid_lineup auf D2)", () => {
    const validation = validateLegacyLineupContext(context("md-2"));
    expect(validation.isValid).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes("player_injured_unavailable"))).toBe(true);
  });

  it("Sperre aus einem Vorspieltag bleibt ein Fehler", () => {
    const validation = validateLegacyLineupContext(context("md-1"));
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((error) => error.includes("player_injured_unavailable"))).toBe(true);
  });
});

describe("eingefrorener KI-Entwurf mit gesperrtem Spieler", () => {
  it("besetzt die offene Seite mit dem besten freien Kaderspieler nach, die gebuchte Seite bleibt stehen", () => {
    const gameState = createState({ d1Gebucht: true });
    const { gameState: repariert, repairs } = repairFrozenAiDraftsWithBlockedPlayers({
      gameState,
      scope: SCOPE,
      repairableTeamIds: new Set(["A-A"]),
      now: "2026-11-02T01:00:00.000Z",
    });
    expect(repairs).toEqual([
      {
        teamId: "A-A",
        disciplineId: "tdm",
        disciplineSide: "d2",
        slotIndex: 0,
        blockedPlayerId: "gesperrt",
        replacementPlayerId: "bank-stark",
      },
    ]);
    const entries = repariert.seasonState.lineupDrafts?.[0]?.entries ?? [];
    expect(entries).toEqual([
      { disciplineId: "spurt", disciplineSide: "d1", slotIndex: 0, playerId: "d1-laeufer", activePlayerId: "roster-d1-laeufer" },
      // Slot und Kapitaensbinde wandern mit.
      { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 0, playerId: "bank-stark", activePlayerId: "roster-bank-stark", isCaptain: true },
    ]);
  });

  it("laesst den Eintrag ersatzlos weg, wenn der Kader niemanden mehr hergibt", () => {
    const gameState = createState({ d1Gebucht: true });
    gameState.rosters = gameState.rosters.filter((roster) => !roster.playerId.startsWith("bank-"));
    const { gameState: repariert, repairs } = repairFrozenAiDraftsWithBlockedPlayers({
      gameState,
      scope: SCOPE,
      repairableTeamIds: new Set(["A-A"]),
    });
    expect(repairs[0]?.replacementPlayerId).toBeNull();
    expect(repariert.seasonState.lineupDrafts?.[0]?.entries.map((entry) => entry.playerId)).toEqual(["d1-laeufer"]);
  });

  it("fasst nichts an, solange der Spieltag nicht laeuft, und keine menschlichen Teams", () => {
    const nichtGestartet = createState();
    expect(
      repairFrozenAiDraftsWithBlockedPlayers({ gameState: nichtGestartet, scope: SCOPE, repairableTeamIds: new Set(["A-A"]) }).gameState,
    ).toBe(nichtGestartet);

    const mensch = createState({ d1Gebucht: true });
    expect(
      repairFrozenAiDraftsWithBlockedPlayers({ gameState: mensch, scope: SCOPE, repairableTeamIds: new Set() }).gameState,
    ).toBe(mensch);
  });
});

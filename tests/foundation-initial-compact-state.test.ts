import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  compactFoundationInitialGameState,
  rehydrateGameStateAfterCompactPut,
} from "@/lib/persistence/foundation-initial-compact-state";
import { buildSeasonFormCardBonusByTeamId } from "@/lib/foundation/season-form-card-bonus";

function createGameState(): GameState {
  return {
    saveVersion: 3,
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 2, matchdayIds: ["md-1", "md-2"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      seasonSnapshots: [{ id: "snap-1" } as never],
      standingsApplyLogs: [{ id: "standings-log-1" } as never],
      matchdayResults: [
        { id: "result-md-1", matchdayId: "md-1" } as never,
        { id: "result-md-2", matchdayId: "md-2" } as never,
      ],
      disciplineResults: [
        { id: "disc-md-1", matchdayResultId: "result-md-1" } as never,
        { id: "disc-md-2", matchdayResultId: "result-md-2" } as never,
      ],
      lineupDrafts: [
        { lineupId: "lineup-md-1", matchdayId: "md-1", teamId: "H-R", saveId: "save-1", seasonId: "season-1" } as never,
        { lineupId: "lineup-md-2", matchdayId: "md-2", teamId: "H-R", saveId: "save-1", seasonId: "season-1" } as never,
      ],
    },
    matchdayState: { matchdayId: "md-2", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    transferHistory: [{ id: "transfer-1" } as never],
    logs: [{ id: "log-1", message: "hello" } as never],
    playerBaselines: [
      {
        playerId: "p-1",
        marketValue: 12.5,
        salary: 2.5,
        seasonZeroEconomy: { source: "season_0_computed", marketValue: 12.5, salary: 2.5 },
        // Die schwere Fracht, die der kompakte Payload NICHT mitnimmt.
        attributes: { power: 50 },
        disciplineRatings: { basketball: 70 },
      } as never,
    ],
    baselineWriteGuardEvents: [{ id: "guard-1" } as never],
    players: [
      {
        id: "p-1",
        name: "Hero",
        rating: 60,
        marketValue: 10,
        salaryDemand: 2,
        className: "Hero",
        race: "Human",
        alignment: "N",
        gender: "x",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "Lore EN",
        flavorDe: "Lore DE",
        attributeSheetStats: { power: 70 },
        fatigue: 0,
        form: 0,
        potential: 70,
      },
    ],
    teams: [],
    teamIdentities: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-26T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 0,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as GameState;
}

describe("foundation initial compact state", () => {
  it("keeps transfer history on compact initial load", () => {
    const existing = createGameState();
    const compact = compactFoundationInitialGameState(existing);
    expect(compact.transferHistory).toEqual(existing.transferHistory);
  });

  it("keeps the human roster's attribute sheets on compact initial load, strips others", () => {
    // Own-team whole-roster forecasts (training-SP, per-intensity/-class gain,
    // season-end preview) need the full attribute sheet up front, so the compact
    // payload must retain the human-controlled team's sheets while still stripping
    // opponent sheets (which hydrate on demand).
    const existing = createGameState();
    existing.teams = [
      { teamId: "H-R", name: "Home", humanControlled: true } as never,
      { teamId: "A-A", name: "Away", humanControlled: false } as never,
    ];
    existing.seasonState.teamControlSettings = {
      "H-R": { teamId: "H-R", controlMode: "manual" } as never,
      "A-A": { teamId: "A-A", controlMode: "ai" } as never,
    };
    existing.players = [
      { ...existing.players[0]!, id: "p-1", attributeSheetStats: { power: 70 } },
      { ...existing.players[0]!, id: "p-2", attributeSheetStats: { power: 40 } },
    ];
    existing.rosters = [
      { id: "r-1", teamId: "H-R", playerId: "p-1" } as never,
      { id: "r-2", teamId: "A-A", playerId: "p-2" } as never,
    ];

    const compact = compactFoundationInitialGameState(existing);
    const byId = new Map(compact.players.map((player) => [player.id, player]));
    expect(byId.get("p-1")?.attributeSheetStats).toEqual({ power: 70 });
    expect(byId.get("p-2")?.attributeSheetStats).toBeUndefined();
  });

  it("keeps every matchday result AND every discipline result in the compact payload", () => {
    // Die schmale Verzeichniszeile je Spieltag muss mitfahren: an ihr erkennt
    // `getCurrentSeasonMatchdayResultIds`, welche Ergebnisse zur laufenden Saison
    // gehoeren. Beschnitten kannte der Browser nur den aktiven Spieltag und die
    // Saisonziele zaehlten alles Vorherige nicht mit.
    //
    // FRUEHER STAND HIER: `disciplineResults` seien auf den aktiven Spieltag beschnitten
    // (erwartet wurde genau `["disc-md-2"]`). Das gilt nicht mehr. Am Live-Save gemessen
    // trug diese Beschneidung 245 KB zur Ersparnis bei — bezahlt mit sechs Fehlern, in
    // denen der Browser nicht etwa leere Felder, sondern FALSCHE ZAHLEN zeigte
    // (Rekordbuch, Spieltags-Ergebnis, Meilensteine, PP-Formbonus, Formkarten-Alarm,
    // Saisonziele). Seither faehrt die Liste vollstaendig mit, siehe die Herleitung in
    // `compactFoundationInitialGameState`.
    const existing = createGameState();
    const compact = compactFoundationInitialGameState(existing);

    expect(compact.seasonState.matchdayResults).toEqual(existing.seasonState.matchdayResults);
    expect(compact.seasonState.disciplineResults?.map((result) => result.id)).toEqual([
      "disc-md-1",
      "disc-md-2",
    ]);
    expect(compact.seasonState.disciplineResults).toEqual(existing.seasonState.disciplineResults);
    // Der Berg bleibt beschnitten — das ist die andere Haelfte der Wahrheit.
    expect(compact.seasonState.seasonSnapshots).toBeUndefined();
    expect(compact.seasonState.persistedSeasonDerivations).toBeUndefined();
  });

  it("ships the baselines SLIM — Wirtschaftsbezug ja, Attribute nein", () => {
    /**
     * FRUEHER WAREN `playerBaselines` GANZ GESTRICHEN (`toBeUndefined()`). Das war der
     * gemessene Fehler: `getPlayerSeasonMarketValueReference` und
     * `getPlayerSeasonZeroMarketValueReference` nehmen zuerst den Basislinien-Bezugswert und
     * fallen ohne ihn auf den Katalogwert zurueck — eine ANDERE ZAHL, kein Leerzustand. Am
     * Live-Abbild ueber 540 Spieler: 498 bzw. 165 abweichend, und bei 136 wurde aus einem
     * echten Marktwert-Delta ein `null`.
     */
    const existing = createGameState();
    const compact = compactFoundationInitialGameState(existing);
    const baseline = compact.playerBaselines?.[0] as Record<string, unknown> | undefined;

    expect(baseline?.playerId).toBe("p-1");
    expect(baseline?.marketValue).toBe(12.5);
    expect(baseline?.salary).toBe(2.5);
    expect(baseline?.seasonZeroEconomy).toEqual({ source: "season_0_computed", marketValue: 12.5, salary: 2.5 });
    // Das Gewicht bleibt draussen.
    expect(baseline?.attributes).toBeUndefined();
    expect(baseline?.disciplineRatings).toBeUndefined();
    expect(compact.baselineWriteGuardEvents).toBeUndefined();
  });

  it("die schlanke Fassung darf die vollen Basislinien im Spielstand NIE ersetzen", () => {
    /**
     * Der gefaehrliche Teil der Umstellung: `incoming.playerBaselines ?? existing` genuegt
     * nicht mehr, seit `incoming` nicht mehr `undefined` ist. Ohne diese Wache loeschte der
     * naechste Speichervorgang Attribute, Disziplinwerte und Herkunft aller Basislinien.
     */
    const existing = createGameState();
    const compact = compactFoundationInitialGameState(existing);
    const rehydrated = rehydrateGameStateAfterCompactPut(existing, compact);

    expect(rehydrated.playerBaselines).toEqual(existing.playerBaselines);
    expect((rehydrated.playerBaselines?.[0] as Record<string, unknown>)?.attributes).toEqual({ power: 50 });
  });

  it("counts the whole season's form cards on the compact payload", () => {
    // Die Saisonstand-Spalte "Formkarten" zaehlt die gespielten Karten ueber die
    // Modifier-Slots der Aufstellungen.
    //
    // FRUEHER STAND HIER: die Aufstellungen seien auf den aktiven Spieltag beschnitten
    // (erwartet wurde `toHaveLength(1)`), und die richtige Zahl komme nur ueber die
    // mitfahrende Projektion `foundationFormCardBonus` an. Am Live-Save gemessen war das
    // teuer bezahlt: voll 32 von 32 Teams mit Bilanz, kompakt 14 von 32 — und diese 14 mit
    // den Karten nur EINES von zehn Spieltagen. Die 589 KB Ersparnis stehen jetzt nicht
    // mehr dafuer ein; die Aufstellungen fahren vollstaendig mit.
    //
    // Geprueft wird weiterhin dasselbe, was zaehlt: beide Seiten nennen dieselbe Zahl, und
    // die Zahl steht ausgeschrieben da (ein Test, der nur "beide gleich" prueft, winkt
    // "beide gleich falsch" durch).
    const existing = createGameState();
    existing.seasonState.formCards = [
      { id: "c-alt", seasonId: "season-1", teamId: "H-R", cardValue: 8 } as never,
      { id: "c-aktiv", seasonId: "season-1", teamId: "H-R", cardValue: -3 } as never,
    ];
    existing.seasonState.lineupDrafts = [
      {
        lineupId: "lineup-md-1",
        matchdayId: "md-1",
        teamId: "H-R",
        saveId: "save-1",
        seasonId: "season-1",
        modifiers: { d1: { primaryFormCardId: "c-alt" } },
      } as never,
      {
        lineupId: "lineup-md-2",
        matchdayId: "md-2",
        teamId: "H-R",
        saveId: "save-1",
        seasonId: "season-1",
        modifiers: { d1: { primaryFormCardId: "c-aktiv" } },
      } as never,
    ];

    const compact = compactFoundationInitialGameState(existing);

    // Die Quelle faehrt vollstaendig mit — beide Spieltage, nicht nur der aktive md-2.
    expect(compact.seasonState.lineupDrafts?.map((draft) => draft.lineupId)).toEqual([
      "lineup-md-1",
      "lineup-md-2",
    ]);
    expect(
      buildSeasonFormCardBonusByTeamId(compact, compact.season.id).get("H-R"),
    ).toEqual(buildSeasonFormCardBonusByTeamId(existing, existing.season.id).get("H-R"));
    expect(buildSeasonFormCardBonusByTeamId(compact, compact.season.id).get("H-R")).toMatchObject({
      total: 5,
      cards: 2,
      positive: 8,
      negative: -3,
      poolPositive: 8,
      remainingPositive: 0,
    });

    // Die Projektion ist entfernt — der Payload traegt sie nicht mehr, und ein alter
    // Browser-Tab, der sie noch mitschickt, bekommt sie nicht in den Spielstand.
    expect((compact.seasonState as Record<string, unknown>).foundationFormCardBonus).toBeUndefined();
    const altesTab = {
      ...compact,
      seasonState: {
        ...compact.seasonState,
        foundationFormCardBonus: { seasonId: "season-1", byTeamId: {}, unusedCardIds: [] },
      },
    } as unknown as typeof existing;
    const rehydrated = rehydrateGameStateAfterCompactPut(existing, altesTab);
    expect((rehydrated.seasonState as Record<string, unknown>).foundationFormCardBonus).toBeUndefined();
  });

  it("strips persisted season derivations from compact payloads", () => {
    const existing = createGameState();
    existing.seasonState.persistedSeasonDerivations = {
      seasonId: existing.season.id,
      contentSignature: "sig-test",
      updatedAt: new Date().toISOString(),
      ledger: {
        hasResultSource: false,
        pointEntries: [],
        warnings: [],
        teamSummariesByTeamId: {},
        playerSummariesByPlayerId: {},
      },
      ratingsByPlayerId: {},
      performanceByPlayerId: {},
    };
    const compact = compactFoundationInitialGameState(existing);
    expect(compact.seasonState.persistedSeasonDerivations).toBeUndefined();

    const rehydrated = rehydrateGameStateAfterCompactPut(existing, compact);
    expect(rehydrated.seasonState.persistedSeasonDerivations).toEqual(existing.seasonState.persistedSeasonDerivations);
  });

  it("rehydrates compact PUT payloads without wiping archived save slices", () => {
    const existing = createGameState();
    const compactClientState = compactFoundationInitialGameState(existing);
    const rehydrated = rehydrateGameStateAfterCompactPut(existing, compactClientState);

    expect(rehydrated.transferHistory).toEqual(existing.transferHistory);
    expect(rehydrated.logs).toEqual(existing.logs);
    expect(rehydrated.playerBaselines).toEqual(existing.playerBaselines);
    expect(rehydrated.baselineWriteGuardEvents).toEqual(existing.baselineWriteGuardEvents);
    expect(rehydrated.seasonState.seasonSnapshots).toEqual(existing.seasonState.seasonSnapshots);
    expect(rehydrated.seasonState.standingsApplyLogs).toEqual(existing.seasonState.standingsApplyLogs);
    expect(rehydrated.seasonState.matchdayResults).toEqual(existing.seasonState.matchdayResults);
    expect(rehydrated.seasonState.disciplineResults).toEqual(existing.seasonState.disciplineResults);
    expect(rehydrated.seasonState.lineupDrafts).toEqual(existing.seasonState.lineupDrafts);
    expect(rehydrated.players[0]?.flavorDe).toBe("Lore DE");
    expect(rehydrated.players[0]?.attributeSheetStats).toEqual({ power: 70 });
  });

  it("does not let the empty season-archive sentinel [] wipe the durable archive", () => {
    // The compact client re-stamps seasonSnapshots/standingsApplyLogs to an EMPTY
    // sentinel [] (apply-compact-season-archive-sentinel), NOT undefined. A naive
    // `incoming ?? existing` guard kept that [] and wiped every prior-season snapshot.
    const existing = createGameState();
    const compactClientState = compactFoundationInitialGameState(existing);
    const sentinelClientState: GameState = {
      ...compactClientState,
      seasonState: {
        ...compactClientState.seasonState,
        seasonSnapshots: [],
        standingsApplyLogs: [],
      },
    };

    const rehydrated = rehydrateGameStateAfterCompactPut(existing, sentinelClientState);
    expect(rehydrated.seasonState.seasonSnapshots).toEqual(existing.seasonState.seasonSnapshots);
    expect(rehydrated.seasonState.standingsApplyLogs).toEqual(existing.seasonState.standingsApplyLogs);
  });

  it("accepts a legitimately grown season archive on PUT", () => {
    // A freshly completed season appends a snapshot → incoming is longer → it wins.
    const existing = createGameState();
    const grownClientState: GameState = {
      ...compactFoundationInitialGameState(existing),
      seasonState: {
        ...compactFoundationInitialGameState(existing).seasonState,
        seasonSnapshots: [{ id: "snap-1" } as never, { id: "snap-2" } as never],
        standingsApplyLogs: [{ id: "standings-log-1" } as never, { id: "standings-log-2" } as never],
      },
    };

    const rehydrated = rehydrateGameStateAfterCompactPut(existing, grownClientState);
    expect(rehydrated.seasonState.seasonSnapshots).toHaveLength(2);
    expect(rehydrated.seasonState.standingsApplyLogs).toHaveLength(2);
  });

  it("keeps intentional client edits to compact-visible slices", () => {
    const existing = createGameState();
    const compactClientState = compactFoundationInitialGameState(existing);
    const editedClientState = {
      ...compactClientState,
      logs: [{ id: "log-new", message: "edited" } as never],
      players: compactClientState.players.map((player) =>
        player.id === "p-1" ? { ...player, name: "Edited Hero" } : player,
      ),
      seasonState: {
        ...compactClientState.seasonState,
        // Der Client bearbeitet die Aufstellung des AKTIVEN Spieltags. Frueher war das
        // schlicht `lineupDrafts[0]`, weil der kompakte Payload nur diesen einen Entwurf
        // enthielt. Jetzt fahren alle Spieltage mit, also wird der gemeinte Entwurf beim
        // Namen genannt statt ueber seine Position erraten.
        lineupDrafts: [
          {
            ...(compactClientState.seasonState.lineupDrafts?.find(
              (draft) => draft.lineupId === "lineup-md-2",
            ) ?? {
              lineupId: "lineup-md-2",
              matchdayId: "md-2",
              teamId: "H-R",
              saveId: "save-1",
              seasonId: "season-1",
              status: "draft",
            }),
            status: "submitted",
          } as never,
        ],
      },
    };

    const rehydrated = rehydrateGameStateAfterCompactPut(existing, editedClientState);

    expect(rehydrated.logs).toEqual(editedClientState.logs);
    expect(rehydrated.players.find((player) => player.id === "p-1")?.name).toBe("Edited Hero");
    expect(rehydrated.players.find((player) => player.id === "p-1")?.attributeSheetStats).toEqual({ power: 70 });
    expect(rehydrated.seasonState.lineupDrafts?.map((draft) => draft.lineupId)).toEqual(["lineup-md-1", "lineup-md-2"]);
    expect(rehydrated.seasonState.lineupDrafts?.find((draft) => draft.lineupId === "lineup-md-2")?.status).toBe("submitted");
  });

  it("preserves lineup drafts for other teams on the same matchday during compact PUT", () => {
    const existing = createGameState();
    existing.seasonState.lineupDrafts = [
      { lineupId: "lineup-md-1", matchdayId: "md-1", teamId: "H-R", saveId: "save-1", seasonId: "season-1" } as never,
      { lineupId: "lineup-md-2-hr", matchdayId: "md-2", teamId: "H-R", saveId: "save-1", seasonId: "season-1" } as never,
      { lineupId: "lineup-md-2-aa", matchdayId: "md-2", teamId: "A-A", saveId: "save-1", seasonId: "season-1" } as never,
    ];

    const compactClientState = compactFoundationInitialGameState(existing);
    // FRUEHER STAND HIER: nur die beiden Entwuerfe des aktiven Spieltags md-2. Die
    // Beschneidung ist entfallen (siehe `compactFoundationInitialGameState`), also faehrt
    // auch der Entwurf des zurueckliegenden md-1 mit.
    expect(compactClientState.seasonState.lineupDrafts?.map((draft) => draft.lineupId)).toEqual([
      "lineup-md-1",
      "lineup-md-2-hr",
      "lineup-md-2-aa",
    ]);

    const rehydrated = rehydrateGameStateAfterCompactPut(existing, compactClientState);

    expect(rehydrated.seasonState.lineupDrafts?.map((draft) => draft.lineupId)).toEqual([
      "lineup-md-1",
      "lineup-md-2-hr",
      "lineup-md-2-aa",
    ]);
  });
});

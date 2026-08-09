/**
 * DIE REPARATUR-SCHRANKE DES APRON-LINIEN-SKRIPTS.
 *
 * `scripts/repariere-apron-linien.ts` heilt einen Alt-Build-Snapshot, der in einer bereits
 * gespielten Saison festsitzt (Chris' Save: Median 45,0 eingefroren vor dem Kaderbau, real 69,8 —
 * die Selbstheilung aus #467 greift ab dem ersten abgerechneten Spieltag bewusst nicht mehr).
 *
 * Die Neuberechnung ist dabei NUR dann der Stand vom Fensterschluss, wenn seit dem ersten
 * gewerteten Spieltag keine Transfers stattfanden — sonst wäre sie eine mitten in der Saison
 * verschobene Grenze. Genau diese Schranke (und die übrigen Abbruchgründe) hält dieser Test fest,
 * damit das Skript beim nächsten Einsatz nicht gefährlich wird.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { planeApronLinienReparatur } from "@/lib/season/apron-lines-repair";
import { computeApronLines } from "@/lib/season/apron-service";

/**
 * Liegt bewusst WEIT in der Zukunft: der Seed-Spielstand stempelt seine Transferhistorie mit der
 * Laufzeit-Uhr, und alle diese Zugänge gehören zum Kaderbau VOR dem Fensterschluss.
 */
const STICHZEIT = "2030-01-01T00:00:00.000Z";

/** Wertet den ersten Spieltag zur Stichzeit — der Fensterschluss-Zeitpunkt. */
function mitGespieltemSpieltag(gs: GameState): GameState {
  return {
    ...gs,
    seasonState: {
      ...gs.seasonState,
      matchdayResults: [
        ...(gs.seasonState.matchdayResults ?? []),
        {
          id: "md-1-result",
          seasonId: gs.season.id,
          matchdayId: gs.matchdayState.matchdayId,
          status: "preview_applied",
          createdAt: STICHZEIT,
        },
      ],
    },
  } as GameState;
}

/** Ein veralteter Snapshot ohne Herkunftsvermerk — wie ihn ein Alt-Build hinterlassen hat. */
function mitAltemSnapshot(gs: GameState): GameState {
  return {
    ...gs,
    seasonState: {
      ...gs.seasonState,
      apronLinesSnapshot: {
        seasonId: gs.season.id,
        frozenAtMatchdayId: gs.matchdayState.matchdayId,
        createdAt: "2026-08-08T06:05:23.116Z",
        medianSalary: 45,
        line1: 49.4,
        line2: 56.2,
        usedReferenceSalary: false,
      },
    },
  } as GameState;
}

function mitTransferNachStichzeit(gs: GameState): GameState {
  return {
    ...gs,
    transferHistory: [
      ...gs.transferHistory,
      {
        id: "transfer-nach-fensterschluss",
        playerId: "player-x",
        playerName: "Spieler X",
        seasonId: gs.season.id,
        seasonLabel: gs.season.id,
        transferType: "buy",
        fromTeamId: null,
        toTeamId: gs.teams[0]!.teamId,
        fee: 10,
        salary: 12,
        marketValue: 15,
        remainingContractLength: 3,
        happenedAt: "2030-01-01T01:00:00.000Z",
      },
    ],
  } as GameState;
}

describe("Apron-Linien-Reparatur — Erfolgsfall", () => {
  it("ersetzt den Alt-Snapshot durch die Neuberechnung und vermerkt die Herkunft", () => {
    const gs = mitAltemSnapshot(mitGespieltemSpieltag(structuredClone(createSingleplayerGameState())));
    const plan = planeApronLinienReparatur(gs, { jetzt: "2026-08-09T12:00:00.000Z" });

    expect(plan.blockiert).toBe(false);
    expect(plan.blockGruende).toEqual([]);
    expect(plan.transfersNachErstemSpieltag).toBe(0);
    expect(plan.ersterGewerteterSpieltag?.createdAt).toBe(STICHZEIT);

    // DIESELBE Funktion wie der Live-Pfad — keine zweite Rechnung.
    const erwartet = computeApronLines(gs);
    expect(plan.neuerSnapshot?.medianSalary).toBeCloseTo(erwartet.medianSalary, 9);
    expect(plan.neuerSnapshot?.line1).toBeCloseTo(erwartet.line1, 9);
    expect(plan.neuerSnapshot?.line2).toBeCloseTo(erwartet.line2, 9);

    // Herkunftsvermerk: Quelle + Notiz mit Zeitpunkt und Grund.
    expect(plan.neuerSnapshot?.frozenAtEvent).toBe("recompute_repair");
    expect(plan.neuerSnapshot?.note).toContain("2026-08-09T12:00:00.000Z");
    expect(plan.neuerSnapshot?.note).toContain("repariere-apron-linien");
    expect(plan.neuerSnapshot?.frozenAtMatchdayId).toBe(gs.matchdayState.matchdayId);

    // Der reparierte Zustand ändert NUR den Snapshot — Teams, Kader, Historie bleiben dieselben Referenzen.
    expect(plan.gameStateRepariert?.teams).toBe(gs.teams);
    expect(plan.gameStateRepariert?.rosters).toBe(gs.rosters);
    expect(plan.gameStateRepariert?.seasonState.matchdayResults).toBe(gs.seasonState.matchdayResults);
    expect(plan.gameStateRepariert?.seasonState.apronLinesSnapshot).toBe(plan.neuerSnapshot);

    // Vorher/Nachher kommen aus demselben Live-Pfad (previewApronSettlement) und tragen die Linien.
    expect(plan.vorher?.lines?.line2).toBeCloseTo(56.2, 9);
    expect(plan.nachher?.lines?.line2).toBeCloseTo(erwartet.line2, 9);
  });
});

describe("Apron-Linien-Reparatur — Abbruchgründe", () => {
  it("blockiert, wenn nach dem ersten gewerteten Spieltag Transfers stattfanden", () => {
    const gs = mitTransferNachStichzeit(
      mitAltemSnapshot(mitGespieltemSpieltag(structuredClone(createSingleplayerGameState()))),
    );
    const plan = planeApronLinienReparatur(gs);

    expect(plan.transfersNachErstemSpieltag).toBe(1);
    expect(plan.blockiert).toBe(true);
    expect(plan.blockGruende).toContain("transfers_nach_erstem_spieltag");
    expect(plan.neuerSnapshot).toBeNull();
    expect(plan.gameStateRepariert).toBeNull();
  });

  it("blockiert, wenn die Saison noch gar nicht gespielt ist (Selbstheilung greift dann von selbst)", () => {
    const gs = mitAltemSnapshot(structuredClone(createSingleplayerGameState()));
    const plan = planeApronLinienReparatur(gs);

    expect(plan.blockiert).toBe(true);
    expect(plan.blockGruende).toContain("saison_noch_nicht_gespielt");
    expect(plan.gameStateRepariert).toBeNull();
  });

  it("blockiert, wenn der Snapshot bereits vom korrigierten Fensterschluss-Einfrieren stammt", () => {
    const basis = mitAltemSnapshot(mitGespieltemSpieltag(structuredClone(createSingleplayerGameState())));
    const gs = {
      ...basis,
      seasonState: {
        ...basis.seasonState,
        apronLinesSnapshot: {
          ...basis.seasonState.apronLinesSnapshot!,
          frozenAtEvent: "buy_window_close" as const,
        },
      },
    } as GameState;
    const plan = planeApronLinienReparatur(gs);

    expect(plan.blockiert).toBe(true);
    expect(plan.blockGruende).toContain("snapshot_bereits_vom_fensterschluss");
    expect(plan.gameStateRepariert).toBeNull();
  });

  it("blockiert, wenn die Apron-Saisonende-Abrechnung dieser Saison schon gelaufen ist", () => {
    const basis = mitAltemSnapshot(mitGespieltemSpieltag(structuredClone(createSingleplayerGameState())));
    const gs = {
      ...basis,
      seasonState: {
        ...basis.seasonState,
        apronSettlementLogs: [
          {
            id: "apron-settlement:test",
            saveId: "test-save",
            seasonId: basis.season.id,
            teamId: basis.teams[0]!.teamId,
            phase: "season_end" as const,
            kind: "levy" as const,
            cashDelta: -1,
            action: "apply" as const,
            createdAt: STICHZEIT,
          },
        ],
      },
    } as GameState;
    const plan = planeApronLinienReparatur(gs);

    expect(plan.blockiert).toBe(true);
    expect(plan.blockGruende).toContain("saison_bereits_abgerechnet");
    expect(plan.gameStateRepariert).toBeNull();
  });

  it("blockiert, wenn alte und neue Linien ohnehin identisch sind (Schreiben wäre Leerlauf)", () => {
    const basis = mitGespieltemSpieltag(structuredClone(createSingleplayerGameState()));
    const aktuell = computeApronLines(basis);
    const gs = {
      ...basis,
      seasonState: {
        ...basis.seasonState,
        apronLinesSnapshot: {
          seasonId: basis.season.id,
          frozenAtMatchdayId: basis.matchdayState.matchdayId,
          createdAt: "2026-08-08T06:05:23.116Z",
          medianSalary: aktuell.medianSalary,
          line1: aktuell.line1,
          line2: aktuell.line2,
          usedReferenceSalary: aktuell.usedReferenceSalary,
        },
      },
    } as GameState;
    const plan = planeApronLinienReparatur(gs);

    expect(plan.blockiert).toBe(true);
    expect(plan.blockGruende).toContain("linien_bereits_identisch");
    expect(plan.gameStateRepariert).toBeNull();
  });
});

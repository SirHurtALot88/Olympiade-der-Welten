/**
 * MIGRATION M1 — die einmalige, versionierte Neuberechnung noch nicht abgerechneter Sponsorleitern.
 *
 * Was hier bewiesen wird (docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md, Abschnitt 5):
 *  1. Ein Vertrag aus dem alten System bekommt die V3-BASISLEITER — er landet damit auf der
 *     Benchmark-Spalte, statt seine eingefrorenen Ausreisser noch einmal auszuzahlen.
 *  2. Die VERTRAGSIDENTITAET bleibt: Marke, Rarity und Sonderziel-Schluessel sind unveraendert.
 *  3. Sie laeuft GENAU EINMAL. Der zweite Aufruf ist ein No-op — sonst waere sie genau die stille
 *     Drift, vor der die Regel "unterschriebene Vertraege werden nie nachtraeglich geaendert"
 *     schuetzen soll.
 *  4. BEREITS ABGERECHNETE Vertraege bleiben unberuehrt: wo Geld geflossen ist, wird nichts gedreht.
 */
import { describe, expect, it } from "vitest";

import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  migrateSponsorLaddersToV3,
  SPONSOR_LADDER_MIGRATION_VERSION,
} from "@/lib/sponsor/sponsor-v3-migration";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";

function legacyContract(teamId: string, seasonId: string): TeamSponsorContract {
  return {
    seasonId,
    teamId,
    offerId: "legacy-offer",
    archetype: "performance",
    name: "Alt-Sponsor",
    chosenAt: new Date().toISOString(),
    startRank: 24,
    rarity: "selten",
    components: [
      { componentId: "base-cash", kind: "base", label: "Basis", targetValue: 0, rewardCash: 59.6 },
      { componentId: "rank-target", kind: "rank", label: "Gewinnstufen", targetValue: 1, rewardCash: 21 },
      {
        componentId: "special-solvency",
        kind: "special",
        label: "Solvenz",
        targetValue: "solvency",
        rewardCash: 9,
        specialKey: "solvency_series",
      },
    ],
    payouts: {},
    // Die eingefrorene V2-Leiter des alten Systems — flach und weit weg vom Benchmark.
    sponsorV2: { version: 2, rankLadder: Array.from({ length: 32 }, () => 59.63), rarity: "selten" },
  } as TeamSponsorContract;
}

function stateWithLegacyContract(): { gameState: GameState; teamId: string } {
  const gameState = structuredClone(createSingleplayerGameState());
  const teamId = gameState.teams[0]!.teamId;
  gameState.seasonState.sponsorContractsByTeamId = {
    ...(gameState.seasonState.sponsorContractsByTeamId ?? {}),
    [teamId]: legacyContract(teamId, gameState.season.id),
  };
  return { gameState, teamId };
}

describe("Sponsor-Leiter-Migration M1", () => {
  it("hebt einen Altvertrag auf die V3-Basisleiter und behaelt seine Identitaet", () => {
    const { gameState, teamId } = stateWithLegacyContract();
    const result = migrateSponsorLaddersToV3(gameState);
    expect(result.applied).toBe(true);
    expect(result.migratedTeamIds).toContain(teamId);

    const migrated = result.gameState.seasonState.sponsorContractsByTeamId![teamId]!;
    const terms = getSponsorV3Terms(migrated);
    expect(terms).not.toBeNull();
    // BASISLEITER: kein Tilt. Der Spieler hat seinerzeit keine Risiko-Entscheidung getroffen, die
    // man ihm jetzt unterschieben duerfte.
    expect(terms!.tilt).toBe(0);
    expect(terms!.rankLadder).toEqual(terms!.baseLadder);
    expect(terms!.startRank).toBe(24);
    // IDENTITAET: Marke, Rarity und Sonderziel-Schluessel unveraendert.
    expect(migrated.name).toBe("Alt-Sponsor");
    expect(migrated.rarity).toBe("selten");
    expect(terms!.goalKey).toBe("solvency_series");
    // Das Ziel ist nach NEUER Regel bepreist: Praemie nach Rarity, p im bepreisbaren Band.
    expect(terms!.goalSize).toBe(9);
    expect(terms!.goalP).toBeGreaterThanOrEqual(0.15);
    expect(terms!.goalP).toBeLessThanOrEqual(0.72);
    // Die alte, flache V2-Leiter ist weg — nicht auskommentiert, sondern entfernt.
    expect((migrated as { sponsorV2?: unknown }).sponsorV2).toBeUndefined();
    // Und die neue Leiter ist keine flache Linie mehr.
    expect(terms!.rankLadder[0]! - terms!.rankLadder[31]!).toBeGreaterThan(20);
  });

  it("laeuft genau einmal — der zweite Aufruf ist ein No-op", () => {
    const { gameState } = stateWithLegacyContract();
    const first = migrateSponsorLaddersToV3(gameState);
    expect(first.gameState.seasonState.sponsorLadderMigrationVersion).toBe(SPONSOR_LADDER_MIGRATION_VERSION);

    const second = migrateSponsorLaddersToV3(first.gameState);
    expect(second.applied).toBe(false);
    expect(second.migratedTeamIds).toHaveLength(0);
    expect(second.gameState).toBe(first.gameState);
  });

  it("laesst bereits abgerechnete Vertraege unberuehrt", () => {
    const { gameState, teamId } = stateWithLegacyContract();
    gameState.seasonState.sponsorPayoutLogs = [
      {
        id: "already-paid",
        saveId: "s",
        seasonId: gameState.season.id,
        teamId,
        phase: "season_end",
        componentId: "base",
        cashDelta: 59.6,
        action: "apply",
        createdAt: new Date().toISOString(),
      },
    ];
    const result = migrateSponsorLaddersToV3(gameState);
    // Der Stempel wird trotzdem gesetzt (sonst laeuft die Pruefung bei jedem Laden erneut) …
    expect(result.applied).toBe(true);
    expect(result.gameState.seasonState.sponsorLadderMigrationVersion).toBe(SPONSOR_LADDER_MIGRATION_VERSION);
    // … aber der abgerechnete Vertrag bleibt, wie er war.
    expect(result.migratedTeamIds).not.toContain(teamId);
    const untouched = result.gameState.seasonState.sponsorContractsByTeamId![teamId]!;
    expect(getSponsorV3Terms(untouched)).toBeNull();
    expect((untouched as { sponsorV2?: unknown }).sponsorV2).not.toBeUndefined();
  });
});

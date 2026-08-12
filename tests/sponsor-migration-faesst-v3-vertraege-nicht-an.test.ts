/**
 * DIE LEITER-MIGRATION DARF EINEN FRISCH UNTERSCHRIEBENEN V3-VERTRAG NICHT UEBERSCHREIBEN.
 *
 * BEFUND, gemessen am Live-Abbild vom 11.08.2026 20:00 (Save `new-game-1786465783606-0kalpx`,
 * Saison 1, Spieltag 2): 31 der 32 Vertraege trugen eine ABRECHNUNGSLEITER, die mit der auf ihrer
 * Karte angezeigten nichts mehr zu tun hatte. A-A: Karte 34,7 C, Abrechnung 55,8 C. R-C: 41,4
 * gegen 95,3. Ueber die Liga 1 997,6 gegen 2 310,1 C, also +15,6 % zugunsten der KI — der Mensch
 * war als Einziger verschont, weil er erst nach dem ersten Ladevorgang unterschreibt.
 *
 * MECHANIK: `new-game-setup-service.ts` laesst die KI beim Anlegen sofort unterschreiben. Der erste
 * Ladevorgang findet einen Spielstand ohne Migrationsstempel vor, und M1 baute JEDEM noch nicht
 * abgerechneten Vertrag neue Konditionen — auch dem, der gerade erst welche bekommen hatte.
 *
 * DIESER TEST PRUEFT WERTE, KEINE QUELLTEXT-STRINGS: er baut einen echten Vertrag ueber den
 * Live-Pfad (`buildSponsorV3Terms` mit Kurvenform, Raritaet und Gebaeude-Verzicht), laesst die
 * Migration darueberlaufen und vergleicht ALLE 32 Sprossen sowie die Kartenfelder, die den
 * Verzicht tragen. Er zaehlt seine Vergleiche mit, damit er nicht gruen sein kann, weil er nichts
 * geprueft hat.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { migrateSponsorLaddersToV3, SPONSOR_LADDER_MIGRATION_VERSION } from "@/lib/sponsor/sponsor-v3-migration";
import {
  buildSponsorV3Terms,
  getSponsorV3Terms,
  sponsorV3GuaranteedLadder,
} from "@/lib/sponsor/sponsor-v3-offer-service";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { readLockedRankPayout } from "@/lib/sponsor/sponsor-economy-calibration";

/** Ein Angebot in der Form, die `buildSponsorV3Terms` erwartet — Rohling ohne Konditionen. */
function rohAngebot(rarity: SponsorOffer["rarity"]): SponsorOffer {
  return {
    id: "offer-unter-test",
    seasonId: "season-1",
    teamId: "T-1",
    archetype: "performance",
    name: "Testsponsor",
    rarity,
    components: [
      { componentId: "base-cash", kind: "base", label: "Basis", targetValue: 0, rewardCash: 0 },
      { componentId: "rank-target", kind: "rank", label: "Gewinnstufen", targetValue: 1, rewardCash: 0 },
    ],
  } as unknown as SponsorOffer;
}

/**
 * Ein Vertrag mit ECHTEN, ueber den Live-Pfad eingefrorenen V3-Konditionen: legendaere
 * Gebaeude-Karte mit Cash-Verzicht — genau die Kombination, bei der das Ueberschreiben am
 * teuersten ist (der Verzicht steckt ausschliesslich in der Kartenleiter).
 */
function frischUnterschriebenerVertrag(gameState: GameState, teamId: string): TeamSponsorContract {
  const terms = buildSponsorV3Terms({
    gameState,
    offer: rohAngebot("legendär"),
    startRank: 24,
    cardKey: "basis",
    curveShape: "europapokal",
    teamId,
    leihVerzicht: 15.8,
  });
  const ladder = sponsorV3GuaranteedLadder(terms);
  return {
    seasonId: gameState.season.id,
    teamId,
    offerId: "offer-unter-test",
    archetype: "performance",
    curveShape: "europapokal",
    name: "Testsponsor",
    chosenAt: new Date().toISOString(),
    startRank: 24,
    rarity: "legendär",
    components: [
      { componentId: "base-cash", kind: "base", label: "Basis", targetValue: 0, rewardCash: ladder[31]! },
      { componentId: "rank-target", kind: "rank", label: "Gewinnstufen", targetValue: 1, rewardCash: ladder[0]! - ladder[31]! },
    ],
    payouts: {},
    lockedRankPayoutLadder: ladder,
    sponsorV3: terms,
  } as unknown as TeamSponsorContract;
}

function stateMitFrischemVertrag(): { gameState: GameState; teamId: string; vertrag: TeamSponsorContract } {
  const gameState = structuredClone(createSingleplayerGameState());
  const teamId = gameState.teams[0]!.teamId;
  const vertrag = frischUnterschriebenerVertrag(gameState, teamId);
  gameState.seasonState.sponsorContractsByTeamId = { [teamId]: vertrag };
  delete gameState.seasonState.sponsorLadderMigrationVersion;
  return { gameState, teamId, vertrag };
}

describe("M1 fasst V3-Vertraege nicht an", () => {
  it("laesst jede der 32 Sprossen eines frisch unterschriebenen Vertrags unveraendert", () => {
    const { gameState, teamId, vertrag } = stateMitFrischemVertrag();
    const vorher = getSponsorV3Terms(vertrag)!;
    const leiterVorher = sponsorV3GuaranteedLadder(vorher);

    const ergebnis = migrateSponsorLaddersToV3(gameState);

    // Der Stempel wird trotzdem gesetzt — sonst liefe die Pruefung bei jedem Laden erneut.
    expect(ergebnis.gameState.seasonState.sponsorLadderMigrationVersion).toBe(SPONSOR_LADDER_MIGRATION_VERSION);
    expect(ergebnis.migratedTeamIds).not.toContain(teamId);

    const nachher = getSponsorV3Terms(ergebnis.gameState.seasonState.sponsorContractsByTeamId![teamId]!)!;
    const leiterNachher = sponsorV3GuaranteedLadder(nachher);

    let verglichen = 0;
    for (let index = 0; index < 32; index += 1) {
      expect(leiterNachher[index]).toBeCloseTo(leiterVorher[index]!, 6);
      verglichen += 1;
    }
    expect(verglichen).toBe(32);

    // Die Felder, die den Unterschied zwischen Karte und Benchmark ausmachen — sie waren es, die
    // beim Ueberschreiben verloren gingen.
    expect(nachher.leihVerzicht).toBe(15.8);
    expect(nachher.curveShape).toBe("europapokal");
    expect(nachher.rarity).toBe("legendär");
    expect(nachher.floor).toBeCloseTo(vorher.floor, 6);
    expect(nachher.anchor).toBeCloseTo(vorher.anchor, 6);
  });

  it("Karte und Abrechnung zeigen nach der Migration auf jedem Endrang dieselbe Zahl", () => {
    const { gameState, teamId } = stateMitFrischemVertrag();
    const migriert = migrateSponsorLaddersToV3(gameState).gameState;
    const vertrag = migriert.seasonState.sponsorContractsByTeamId![teamId]!;
    const abrechnungsleiter = sponsorV3GuaranteedLadder(getSponsorV3Terms(vertrag)!);

    let verglichen = 0;
    for (let rang = 1; rang <= 32; rang += 1) {
      // Was die Karte zeigt (die bei Unterschrift gespeicherte Leiter) …
      const karte = readLockedRankPayout(vertrag.lockedRankPayoutLadder!, rang);
      // … gegen das, woraus das Settlement rechnet.
      expect(abrechnungsleiter[rang - 1]).toBeCloseTo(karte, 6);
      verglichen += 1;
    }
    expect(verglichen).toBe(32);

    // Und die Basiszeile der Abrechnung ist zeichengleich der Sockel der Karte.
    const zeilen = previewSponsorSettlement(migriert).rows.filter((zeile) => zeile.teamId === teamId);
    const basis = zeilen.find((zeile) => zeile.kind === "base");
    expect(basis).toBeDefined();
    expect(basis!.cashDelta).toBeCloseTo(Math.round(vertrag.lockedRankPayoutLadder![31]! * 10) / 10, 6);
  });

  it("ein ALTVERTRAG ohne V3-Konditionen wird weiterhin gehoben", () => {
    const gameState = structuredClone(createSingleplayerGameState());
    const teamId = gameState.teams[0]!.teamId;
    gameState.seasonState.sponsorContractsByTeamId = {
      [teamId]: {
        seasonId: gameState.season.id,
        teamId,
        offerId: "legacy-offer",
        archetype: "performance",
        name: "Alt-Sponsor",
        chosenAt: new Date().toISOString(),
        startRank: 24,
        rarity: "selten",
        components: [
          { componentId: "base-cash", kind: "base", label: "Basis", targetValue: 0, rewardCash: 59.6 },
        ],
        payouts: {},
        sponsorV2: { version: 2, rankLadder: Array.from({ length: 32 }, () => 59.63), rarity: "selten" },
      } as unknown as TeamSponsorContract,
    };
    delete gameState.seasonState.sponsorLadderMigrationVersion;

    const ergebnis = migrateSponsorLaddersToV3(gameState);
    expect(ergebnis.migratedTeamIds).toContain(teamId);
    const terms = getSponsorV3Terms(ergebnis.gameState.seasonState.sponsorContractsByTeamId![teamId]!);
    expect(terms).not.toBeNull();
    // Keine flache Linie mehr: der Altvertrag steht jetzt auf der Benchmark-Spalte.
    expect(terms!.rankLadder[0]! - terms!.rankLadder[31]!).toBeGreaterThan(20);
  });
});

import { describe, expect, it } from "vitest";

import type { GameState, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  buildSponsorOffersForTeam,
  chooseSponsorOffer,
  chooseSponsorOfferForAiTeams,
  ensureSeasonSponsorOffers,
  getTeamSponsorContract,
} from "@/lib/sponsor/sponsor-offer-service";
import { applySponsorSettlement, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { buildTeamObjectiveOverview } from "@/lib/board/team-season-objectives-service";
import { estimateExpectedPayout } from "@/lib/sponsor/sponsor-economy-calibration";
import { SPONSOR_RARITY_KEYS } from "@/lib/sponsor/sponsor-curve-shapes";
import { SPONSOR_V3_CARDS } from "@/lib/sponsor/sponsor-v3-model";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";

function createTeam(partial: Partial<Team> = {}): Team {
  return {
    teamId: partial.teamId ?? "M-M",
    name: partial.name ?? "Mayhem Mavericks",
    shortCode: partial.shortCode ?? "M-M",
    cash: partial.cash ?? 50,
    rosterLimit: partial.rosterLimit ?? 14,
    humanControlled: partial.humanControlled ?? true,
  } as Team;
}

function createIdentity(teamId: string, partial: Partial<TeamIdentity> = {}): TeamIdentity {
  return {
    teamId,
    ambition: partial.ambition ?? 8,
    finances: partial.finances ?? 5,
    pow: partial.pow ?? 5,
    spe: partial.spe ?? 5,
    men: partial.men ?? 5,
    soc: partial.soc ?? 5,
    playerMin: partial.playerMin ?? 7,
    playerOpt: partial.playerOpt ?? 10,
  } as TeamIdentity;
}

function createGameState(partial?: Partial<GameState>): GameState {
  const teams = Array.from({ length: 12 }, (_, index) =>
    createTeam({
      teamId: index === 0 ? "M-M" : `T-${index + 1}`,
      name: index === 0 ? "Mayhem Mavericks" : `Team ${index + 1}`,
      shortCode: index === 0 ? "M-M" : `T${index + 1}`,
      cash: index === 0 ? 50 : 20 + index * 4,
    }),
  );
  const teamIdentities = teams.map((team, index) =>
    createIdentity(team.teamId, {
      ambition: index === 0 ? 8 : 5,
      finances: index === 0 ? 5 : 4,
    }),
  );
  const standings = Object.fromEntries(
    teams.map((team, index) => [
      team.teamId,
      {
        points: index === 0 ? 80 : 120 - index * 5,
        rank: index === 0 ? 8 : index + 1,
        startplatz: index === 0 ? 12 : index + 1,
      },
    ]),
  );

  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings,
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities,
    players: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-25T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: teams.length,
      unmappedPlayers: [],
    },
    disciplines: [],
    ...partial,
  } as GameState;
}

describe("sponsor offer service", () => {
  it("generates a five-card slate per team — one card each, rarity-varied, no legacy curve shape", () => {
    const gameState = ensureSeasonSponsorOffers(createGameState());
    const offers = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
    expect(offers).toHaveLength(5);

    // Jedes Angebot trägt den Rarity-Layer …
    expect(offers.every((offer) => offer.rarity != null && SPONSOR_RARITY_KEYS.includes(offer.rarity))).toBe(true);
    // … und die V3-Konditionen, aus denen seine Auszahlung stammt.
    expect(offers.every((offer) => getSponsorV3Terms(offer) != null)).toBe(true);
    // Das Slate ist NICHT gewuerfelt: jedes Team sieht dieselben fuenf Entscheidungen.
    expect(offers.map((offer) => getSponsorV3Terms(offer)!.cardKey)).toEqual(
      SPONSOR_V3_CARDS.map((card) => card.key),
    );

    // KEINE Legacy-Kurvenform mehr: die elf alten Formen sind aus der Erzeugung entfernt und leben nur
    // noch als Lese-Pfad fuer Altangebote/-vertraege weiter.
    expect(offers.every((offer) => offer.curveShape === undefined)).toBe(true);

    // Legacy-Ableitungen bleiben konsistent gefüllt (Marken-/Sonderziel-Infrastruktur läuft weiter).
    expect(offers.every((offer) => offer.demandProfile != null)).toBe(true);
  });

  it("never emits duplicate componentIds within a single offer", () => {
    // Regression: die Immer-an Fan-Infrastruktur-Klausel wurde zusätzlich zum gezogenen Sonderziel
    // angehängt — zog dieses Sonderziel selbst `fan_infrastructure`, tauchte `special-fan-infrastructure`
    // ZWEIMAL im Offer auf (doppelter React-Key in der Reward-Liste + doppelt gezählter rewardCash in
    // totalUpsideEstimate). Angebote über mehrere Teams/Slots prüfen, damit der fan_infrastructure-Fall
    // aus dem deterministischen Bonus-Pool sicher getroffen wird.
    const gameState = ensureSeasonSponsorOffers(createGameState());
    for (const team of gameState.teams) {
      const offers = buildSponsorOffersForTeam({ gameState, teamId: team.teamId });
      for (const offer of offers) {
        const ids = offer.components.map((component) => component.componentId);
        expect(new Set(ids).size, `Duplicate componentIds in offer ${offer.offerId}: ${ids.join(", ")}`).toBe(ids.length);
      }
    }
  });

  it("persists sponsor choice WITHOUT paying anything before season end", () => {
    const gameState = ensureSeasonSponsorOffers(createGameState());
    // Bewusst die GESPEICHERTEN Angebote — genau die, die dem Spieler angezeigt werden und aus denen
    // `chooseSponsorOffer` den Vertrag baut. Ein erneutes `buildSponsorOffersForTeam` liefert eine
    // frisch gezogene Liste: die Markenwahl haengt an der ligaweiten Marken-Nutzung, die nach dem
    // Speichern eine andere ist als davor. Der Test verglich dadurch zwei verschiedene Listen.
    const offers = gameState.seasonState.sponsorOffersByTeamId?.["M-M"] ?? [];
    const chosen = offers[0]!;
    const result = chooseSponsorOffer({ gameState, teamId: "M-M", offerId: chosen.offerId });
    const contract = getTeamSponsorContract(result.gameState, "M-M");
    expect(contract?.name).toBe(chosen.name);
    // Der Vertrag friert den neuen Rarity+Kurvenform-Layer ein (nicht mehr über den Archetyp gewählt).
    expect(contract?.rarity).toBe(chosen.rarity);
    expect(contract?.curveShape).toBe(chosen.curveShape);
    expect(contract?.archetype).toBe(chosen.archetype);
    // Sponsorengeld flieszt ausschliesslich am Saisonende (sponsor-settlement-service). Frueher zahlte
    // das Unterschreiben sofort die halbe Basisrate aus — dadurch sackte die angezeigte Saison-Summe
    // im Moment des Abschlusses ab, und am Saisonende kam entsprechend wenig nach, obwohl genau dann
    // Gehaelter und Transfers faellig sind.
    expect(contract?.payouts.baseFirstPaid).toBeUndefined();
    expect(result.gameState.teams[0]?.cash).toBe(50);
    expect(
      (result.gameState.seasonState.sponsorPayoutLogs ?? []).filter((log) => log.teamId === "M-M"),
      "Unterschreiben darf keine Sponsor-Auszahlung buchen",
    ).toHaveLength(0);
  });

  it("auto-selects sponsor contracts for ai teams", () => {
    const gameState = createGameState({
      teams: [createTeam({ humanControlled: false, teamId: "A-A", shortCode: "A-A", name: "AI Team" })],
      teamIdentities: [createIdentity("A-A", { ambition: 9 })],
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: { "A-A": { points: 40, rank: 20, startplatz: 22 } },
        teamControlSettings: {
          "A-A": {
            teamId: "A-A",
            controlMode: "ai",
            ownerId: "ai",
            ownerSlot: "ai",
            aiLineupPreviewEnabled: true,
          },
        },
      },
    });
    const next = chooseSponsorOfferForAiTeams(ensureSeasonSponsorOffers(gameState));
    expect(getTeamSponsorContract(next, "A-A")).not.toBeNull();
  });
});

describe("ai sponsor choice — oekonomisch kann sie nichts falsch machen", () => {
  // DIE ZENTRALE ZUSAGE DES ENTWURFS, an der ECHTEN Angebotserzeugung gemessen: alle fuenf Karten
  // eines Slates haben denselben Erwartungswert. Die Wahl ist eine Risiko-Entscheidung, nie ein
  // Etat-Upgrade — und deshalb kann die KI-Wahl (und die des Spielers) den Etat nicht verschieben.
  it("alle Karten eines Slates haben denselben Erwartungswert (bis auf Rundung)", () => {
    const gameState = ensureSeasonSponsorOffers(createGameState());
    for (const team of gameState.teams) {
      const offers = buildSponsorOffersForTeam({ gameState, teamId: team.teamId });
      const values = offers.map((offer) => estimateExpectedPayout(offer));
      const spread = Math.max(...values) - Math.min(...values);
      expect(spread, `${team.teamId}: EV-Spreizung ${spread.toFixed(3)} — ${values.join(" / ")}`).toBeLessThanOrEqual(0.1);
    }
  });
});

describe("sponsor settlement service", () => {
  it("settles rank and improvement components at season end", () => {
    let gameState = ensureSeasonSponsorOffers(createGameState());
    // Jedes Angebot trägt eine Rang-Komponente; das erste genügt, um Rang+Improvement zu settlen.
    const offer = buildSponsorOffersForTeam({ gameState, teamId: "M-M" })[0];
    gameState = chooseSponsorOffer({ gameState, teamId: "M-M", offerId: offer!.offerId }).gameState;
    const preview = previewSponsorSettlement(gameState, "season_end");
    expect(preview.rows.some((row) => row.kind === "rank")).toBe(true);
    const applied = applySponsorSettlement({ gameState, saveId: "save-1", execute: true });
    expect(applied.applied).toBe(true);
    expect(applied.gameState.seasonState.sponsorPayoutLogs?.some((log) => log.phase === "season_end")).toBe(true);
  });
});

describe("sponsor board objectives", () => {
  it("adds sponsor objectives after contract selection", () => {
    let gameState = ensureSeasonSponsorOffers(createGameState());
    const offer = buildSponsorOffersForTeam({ gameState, teamId: "M-M" })[0]!;
    gameState = chooseSponsorOffer({ gameState, teamId: "M-M", offerId: offer.offerId }).gameState;
    const overview = buildTeamObjectiveOverview(gameState);
    const sponsorObjectives = overview.objectives.filter((objective) => objective.teamId === "M-M" && objective.category === "sponsor");
    // Angebot 0 ist die SICHERHEITS-Karte: sie traegt kein Sonderziel, also genau zwei Cash-Komponenten
    // (Basis, Gewinnstufen) und damit zwei Vertragsziele. Die Tabellenziel- und Ueberperformance-
    // Komponenten des alten Systems gibt es nicht mehr.
    expect(sponsorObjectives.length).toBeGreaterThanOrEqual(2);
  });

  it("shows sponsor choice pending objective without contract", () => {
    const overview = buildTeamObjectiveOverview(ensureSeasonSponsorOffers(createGameState()));
    expect(
      overview.objectives.some(
        (objective) => objective.teamId === "M-M" && objective.objectiveId === "sponsor-choice-pending",
      ),
    ).toBe(true);
  });

  it("gives every team a distinct sponsor brand across the whole league (no shared sponsors)", () => {
    // 32 Teams x 5 Angebote = 160 Angebote. Der Markenpool hat 200 Eintraege, und
    // GLOBAL_PARENT_MAX_TEAMS steht auf 1 -> jede Dachmarke darf ligaweit hoechstens einmal
    // auftauchen. Damit ist ausgeschlossen, dass zwei Teams denselben Sponsor angeboten bekommen
    // oder unter Vertrag nehmen.
    //
    // Frueher scheiterte das an zwei Stellen: der Cap stand auf 4, UND `ensureSeasonSponsorOffers`
    // baute alle Teams gegen denselben unveraenderten gameState, sodass die Marken-Nutzung nur den
    // Stand VOR dem Lauf kannte und Teams desselben Durchgangs einander gar nicht sahen.
    const gameState = ensureSeasonSponsorOffers(createGameState());
    const offersByTeam = gameState.seasonState.sponsorOffersByTeamId ?? {};

    const parentIdsByTeam = new Map<string, string[]>();
    for (const team of gameState.teams) {
      const offers = offersByTeam[team.teamId] ?? [];
      expect(offers.length, `Team ${team.teamId} ohne Angebote`).toBe(5);
      parentIdsByTeam.set(
        team.teamId,
        offers.map((offer) => offer.sponsorParentBrandId).filter((id): id is string => Boolean(id)),
      );
    }

    const ownerByParentId = new Map<string, string>();
    for (const [teamId, parentIds] of parentIdsByTeam) {
      for (const parentId of parentIds) {
        const previousOwner = ownerByParentId.get(parentId);
        expect(
          previousOwner,
          `Marke ${parentId} liegt bei Team ${teamId} UND bei Team ${previousOwner}`,
        ).toBeUndefined();
        ownerByParentId.set(parentId, teamId);
      }
    }

    // Gegenprobe, dass der Lauf ueberhaupt die volle Liga abgedeckt hat und nicht bloss wenige
    // Marken vergeben wurden (sonst waere die Eindeutigkeit oben trivial erfuellt).
    expect(ownerByParentId.size).toBe(gameState.teams.length * 5);
  });
});

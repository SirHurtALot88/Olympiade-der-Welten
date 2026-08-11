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
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
import { sponsorV3WertFaktorFor } from "@/lib/sponsor/sponsor-v3-model";

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
  it("stellt eine Basis-Karte plus je eine Achsenkarte ins Slate", () => {
    const gameState = ensureSeasonSponsorOffers(createGameState());
    const offers = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
    // Diese Fixture hat KEINE Spieler: ohne Kader gibt es weder Kaderwert noch Frische, beide Achsen
    // waeren also unerfuellbar und werden gar nicht erst angeboten. Ein echtes Team traegt alle fuenf
    // und bekommt damit die vollen fuenf Slots (Basis + vier Achsen).
    expect(offers.length).toBeGreaterThanOrEqual(4);
    expect(offers.length).toBeLessThanOrEqual(5);

    // Jedes Angebot trägt den Rarity-Layer …
    expect(offers.every((offer) => offer.rarity != null && SPONSOR_RARITY_KEYS.includes(offer.rarity))).toBe(true);
    // … und die V3-Konditionen, aus denen seine Auszahlung stammt.
    expect(offers.every((offer) => getSponsorV3Terms(offer) != null)).toBe(true);
    // Slot 0 ist der risikofreie Anker, jeder weitere Slot eine ANDERE Achse.
    const terms = offers.map((offer) => getSponsorV3Terms(offer)!);
    expect(terms[0]!.cardKey).toBe("basis");
    expect(terms[0]!.axis).toBeUndefined();
    const axisKeys = terms.slice(1).map((entry) => entry.axis?.key);
    expect(axisKeys.every((key) => key != null)).toBe(true);
    expect(new Set(axisKeys).size).toBe(axisKeys.length);
    // Die Achse ist FIX bepreist — kein Schaetzwert mehr, der zum Etatfehler werden koennte.
    expect(terms.slice(1).every((entry) => entry.goalP === 0.5)).toBe(true);

    // GEAENDERT MIT DEM LIGALEITER-UMBAU: die Kurvenform ist wieder ein Erzeugungs-Feld (sie
    // entscheidet ueber `sponsorKurvenLeiter`, WO auf der Sponsor-Ligaleiter das Angebot sein Geld
    // hat) statt nur ein Lese-Pfad fuer Altangebote — jedes Angebot traegt jetzt eine der 11 Formen,
    // und weil der Slate ohne Zuruecklegen zieht, sind sie innerhalb eines Teams paarweise verschieden.
    expect(offers.every((offer) => offer.curveShape != null)).toBe(true);
    expect(new Set(offers.map((offer) => offer.curveShape)).size).toBe(offers.length);

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
  /**
   * DIE ZENTRALE ZUSAGE DES ENTWURFS — und sie ist SCHWAECHER GEWORDEN, an zwei Stellen, beide auf
   * ausdrückliche Ansage von Chris. Das gehört hierher und nicht in eine Fußnote.
   *
   * Bis hierher galt: alle fünf Karten haben denselben Cash-Erwartungswert, die Wahl ist reine
   * Risiko-Entscheidung, die KI kann ökonomisch nichts falsch machen. Zwei Entscheidungen haben das
   * aufgehoben:
   *
   *   E1 — die Gebäude-Karte zahlt weniger Cash und stellt dafür ein Gebäude.
   *   „nicht die seltenheiten vergessen" — die Rarität skaliert die ganze Leiter, eine legendäre
   *   Karte zahlt schlicht mehr als eine gewöhnliche.
   *
   * Roh gemessen spreizen die Erwartungswerte eines Slates deshalb um zweistellige Beträge, und
   * eine Wahl KANN jetzt objektiv falsch sein. Das ist gewollt: eine Wahl ohne falsche Antwort ist
   * keine Wahl.
   *
   * WAS BLEIBT, ist die schwächere und ehrlichere Zusage, und genau die misst dieser Test: rechnet
   * man beide Regler heraus — den Cash-Verzicht hinzu, durch den Raritäts-Wertfaktor geteilt —, ist
   * die Spreizung gemessen 0,076 C, also Rundung. Es gibt keinen DRITTEN, versteckten Regler. Der
   * Wert einer Karte ist vollständig durch „wie selten" und „wie viel Gebäude" erklärt.
   */
  it("erklaert den Wert jeder Karte vollstaendig aus Raritaet und Gebaeude — kein dritter Regler", () => {
    const gameState = ensureSeasonSponsorOffers(createGameState());
    for (const team of gameState.teams) {
      const offers = buildSponsorOffersForTeam({ gameState, teamId: team.teamId });
      const values = offers.map((offer) => {
        const terms = getSponsorV3Terms(offer)!;
        return (estimateExpectedPayout(offer) + (terms.leihVerzicht ?? 0)) / sponsorV3WertFaktorFor(terms.rarity);
      });
      const spread = Math.max(...values) - Math.min(...values);
      expect(spread, `${team.teamId}: EV-Spreizung ${spread.toFixed(3)} — ${values.join(" / ")}`).toBeLessThanOrEqual(0.2);

      // Und die Gegenprobe im selben Test: OHNE die beiden Regler spreizen sie sehr wohl — sonst
      // wäre die Gebäude-Karte gratis und die Rarität wieder folgenlos.
      const rohe = offers.map((offer) => estimateExpectedPayout(offer));
      if (offers.some((offer) => offer.sponsorLeihe != null)) {
        expect(Math.max(...rohe) - Math.min(...rohe), `${team.teamId}: Gebäude-Karte kostet nichts`).toBeGreaterThan(1);
      }
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
      // Ohne Kader faellt in dieser Fixture eine Achse aus dem Slate (siehe oben) — die Aussage
      // dieses Tests ist die Marken-Verteilung, nicht die Slot-Zahl.
      expect(offers.length, `Team ${team.teamId} ohne Angebote`).toBeGreaterThanOrEqual(4);
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
    const offerTotal = gameState.teams.reduce((sum, team) => sum + (offersByTeam[team.teamId]?.length ?? 0), 0);
    expect(ownerByParentId.size).toBe(offerTotal);
  });
});

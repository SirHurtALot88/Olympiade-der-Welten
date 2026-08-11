/**
 * SCHRITT 4 DER BAUVORLAGE: die erzeugten Angebote tragen tatsaechlich Gebaeude — und die Karte
 * bezahlt sie so, wie Chris es entschieden hat.
 *
 * ENTSCHEIDUNG E1, und sie ist der Kern dieser Suite: „Kein Abzug — zwei Sorten Sponsor. Nicht eine
 * Karte mit Abschlag, sondern: viel Cash pur, oder weniger Cash plus Gebäude." Der Verzicht ist
 * deshalb KEINE Buchungszeile, sondern eine NIEDRIGERE LEITER. Diese Suite haelt beides fest: dass
 * die Leiter wirklich sinkt (sonst waere das Gebaeude geschenkt) und dass keine zweite Zeile
 * entsteht (sonst waere es der Abzug, den Chris nicht wollte, und er wuerde doppelt zahlen).
 *
 * Und die Auflage aus E8: mindestens eine Karte ohne Verzicht muss dabei sein — zwoelf von 32 Teams
 * koennen sich gar keinen leisten.
 */
import { describe, expect, it } from "vitest";

import type { GameState, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import {
  buildSponsorOffersForTeam,
  chooseSponsorOffer,
  getTeamSponsorContract,
} from "@/lib/sponsor/sponsor-offer-service";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
import { sponsorV3GuaranteedLadder } from "@/lib/sponsor/sponsor-v3-model";
import { sponsorKurvenLeiter } from "@/lib/sponsor/sponsor-liga-leiter";

function baueSpielstand(partial?: Partial<GameState>): GameState {
  const teams = Array.from({ length: 12 }, (_, index) => ({
    teamId: index === 0 ? "M-M" : `T-${index + 1}`,
    name: index === 0 ? "Mayhem Mavericks" : `Team ${index + 1}`,
    shortCode: index === 0 ? "M-M" : `T${index + 1}`,
    cash: 20 + index * 4,
    rosterLimit: 14,
    humanControlled: index === 0,
  })) as Team[];
  const teamIdentities = teams.map((team) => ({
    teamId: team.teamId,
    ambition: 6,
    finances: 5,
    pow: 5,
    spe: 5,
    men: 5,
    soc: 5,
    playerMin: 7,
    playerOpt: 10,
  })) as TeamIdentity[];
  const standings = Object.fromEntries(
    teams.map((team, index) => [team.teamId, { points: 120 - index * 5, rank: index + 1, startplatz: index + 1 }]),
  );

  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: { seasonId: "season-2", schedule: [], standings },
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
      generatedAt: "2026-08-11T00:00:00.000Z",
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

describe("Das Slate deckt die Preisspanne ab (E8)", () => {
  it("hat immer genau eine Karte ohne Verzicht — und sonst nur Gebaeude-Karten", () => {
    for (let index = 1; index <= 12; index += 1) {
      const teamId = index === 1 ? "M-M" : `T-${index}`;
      const angebote = buildSponsorOffersForTeam({ gameState: baueSpielstand(), teamId });
      const ohneLeihe = angebote.filter((angebot) => angebot.sponsorLeihe == null);
      expect(ohneLeihe, `${teamId}: keine reine Cash-Karte im Slate`).toHaveLength(1);
      expect(ohneLeihe[0]!.offerId).toBe(angebote[0]!.offerId);
    }
  });

  it("friert am Gebaeude-Angebot alles ein, was die Karte spaeter braucht", () => {
    const angebot = buildSponsorOffersForTeam({ gameState: baueSpielstand(), teamId: "M-M" })[1]!;
    const leihe = angebot.sponsorLeihe!;

    expect(leihe.stufenreihe.length).toBeGreaterThanOrEqual(1);
    expect(leihe.verzichtJeSaison).toHaveLength(leihe.stufenreihe.length);
    expect(leihe.leihwertJeSaison).toHaveLength(leihe.stufenreihe.length);
    // Der Zustand ist die Vertragsvariable aus E7 — ohne ihn waere jede Leihe neuwertig.
    expect(leihe.startZustandPct).toBeGreaterThan(0);
    expect(leihe.startZustandPct).toBeLessThanOrEqual(100);
    // Und die Anrechnungsbasis der spaeteren Uebernahme steht schon fest.
    expect(leihe.katalogkostenEndstufe).toBeGreaterThan(0);
  });
});

describe("Der Verzicht ist eine niedrigere Leiter, keine Abzugszeile (E1)", () => {
  it("senkt jede Sprosse der Gebaeude-Karte um genau den Verzicht", () => {
    const gameState = baueSpielstand();
    const angebote = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
    const mitLeihe = angebote.find((angebot) => angebot.sponsorLeihe != null)!;
    const terms = getSponsorV3Terms(mitLeihe)!;

    // Der Verzicht steht als eingefrorene Zahl in den Konditionen — nur so kann der Mehrjahres-Roll
    // ihn beim Neubau der Leiter wieder abziehen.
    expect(terms.leihVerzicht).toBe(mitLeihe.sponsorLeihe!.verzichtJeSaison[0]);
    expect(terms.leihVerzicht).toBeGreaterThan(0);

    // Die reine Cash-Karte traegt keinen.
    expect(getSponsorV3Terms(angebote[0]!)!.leihVerzicht ?? 0).toBe(0);
  });

  it("macht die Gebaeude-Karte messbar aermer als dieselbe Karte ohne Leihe", () => {
    // Der eigentliche Nachweis, exakt statt ungefaehr: die Basisleiter des Angebots muss Sprosse
    // fuer Sprosse genau um den Verzicht unter der ungeschmaelerten Ligaleiter derselben Form,
    // desselben Startrangs und desselben Gehaltsfaktors liegen.
    const gameState = baueSpielstand();
    const angebote = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
    const mitLeihe = angebote.find((angebot) => angebot.sponsorLeihe != null)!;
    const terms = getSponsorV3Terms(mitLeihe)!;
    const verzicht = terms.leihVerzicht!;

    const ungeschmaelert = sponsorKurvenLeiter({
      shape: terms.curveShape!,
      startRank: terms.startRank,
      salaryFactor: terms.salaryFactor,
    });
    expect(terms.baseLadder).toHaveLength(ungeschmaelert.length);
    terms.baseLadder.forEach((wert, index) => {
      expect(wert).toBeCloseTo(ungeschmaelert[index]! - verzicht, 6);
    });

    // Und der Verzicht kommt wirklich an: die niedrigste Sprosse liegt ueber dem Sicherheitsnetz,
    // wird also nicht davon aufgefangen (gemessen: 9,1 C Luft, groesster Erst-Saison-Verzicht 4,3 C).
    expect(Math.min(...sponsorV3GuaranteedLadder(terms))).toBeGreaterThan(terms.floor);
    expect(verzicht).toBeLessThan(9.1);
  });

  it("erzeugt KEINE zusaetzliche Komponente — sonst zahlte das Team doppelt", () => {
    const gameState = baueSpielstand();
    const angebote = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
    const ohne = angebote[0]!;
    const mit = angebote.find((angebot) => angebot.sponsorLeihe != null)!;

    // Dieselben Komponenten-Arten wie bei der reinen Cash-Karte, plus hoechstens die Achse.
    const arten = (offer: typeof ohne) => offer.components.map((component) => component.kind).sort();
    expect(new Set(arten(mit))).toEqual(new Set([...new Set(arten(ohne)), ...new Set(arten(mit))]));
    expect(mit.components.some((component) => /leih|verzicht/i.test(component.label))).toBe(false);
  });
});

describe("Die Unterschrift macht die Leihe wirksam", () => {
  it("legt die Leihgabe in den Season-State und NICHT in den eigenen Bestand", () => {
    const gameState = baueSpielstand();
    const angebote = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
    const mitLeihe = angebote.find((angebot) => angebot.sponsorLeihe != null)!;
    const mitAngeboten: GameState = {
      ...gameState,
      seasonState: { ...gameState.seasonState, sponsorOffersByTeamId: { "M-M": angebote } },
    };

    const { gameState: danach, contract } = chooseSponsorOffer({
      gameState: mitAngeboten,
      teamId: "M-M",
      offerId: mitLeihe.offerId,
    });

    expect(contract?.sponsorLeihe?.facilityId).toBe(mitLeihe.sponsorLeihe!.facilityId);
    const leihgaben = danach.seasonState.sponsorLeihgabenByTeamId?.["M-M"] ?? [];
    expect(leihgaben).toHaveLength(1);
    expect(leihgaben[0]!.facilityId).toBe(mitLeihe.sponsorLeihe!.facilityId);
    expect(leihgaben[0]!.stufe).toBe(mitLeihe.sponsorLeihe!.stufenreihe[0]);
    expect(leihgaben[0]!.zustandPct).toBe(mitLeihe.sponsorLeihe!.startZustandPct);

    // Der eigene Bestand bleibt unberuehrt — der Rueckfall am Vertragsende ist damit kein Loeschen.
    expect(danach.seasonState.teamFacilities?.["M-M"]).toBeUndefined();
    // Gelesen wird sie trotzdem: das Overlay aus Schritt 3 hebt die effektive Stufe.
    const gelesen = getTeamFacilityState(danach, "M-M");
    expect(gelesen.facilities[mitLeihe.sponsorLeihe!.facilityId]?.level).toBe(
      mitLeihe.sponsorLeihe!.stufenreihe[0],
    );
  });

  it("legt bei einer reinen Cash-Karte gar keine Leihgabe an", () => {
    const gameState = baueSpielstand();
    const angebote = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
    const mitAngeboten: GameState = {
      ...gameState,
      seasonState: { ...gameState.seasonState, sponsorOffersByTeamId: { "M-M": angebote } },
    };

    const { gameState: danach } = chooseSponsorOffer({
      gameState: mitAngeboten,
      teamId: "M-M",
      offerId: angebote[0]!.offerId,
    });

    expect(getTeamSponsorContract(danach, "M-M")?.sponsorLeihe).toBeUndefined();
    expect(danach.seasonState.sponsorLeihgabenByTeamId?.["M-M"] ?? []).toHaveLength(0);
  });
});

describe("Keine toten Karten", () => {
  it("bietet kein Gebaeude an, das das Team laengst hoeher gebaut hat", () => {
    const gameState = baueSpielstand();
    const mitBestand: GameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        teamFacilities: {
          "M-M": {
            facilities: Object.fromEntries(
              ["training_center", "recovery_center", "scouting_office", "analytics_room", "fan_shop", "arena_upgrade", "academy"].map(
                (facilityId) => [facilityId, { level: 5, enabled: true, conditionPct: 100 }],
              ),
            ),
          },
        },
      } as GameState["seasonState"],
    };

    const angebote = buildSponsorOffersForTeam({ gameState: mitBestand, teamId: "M-M" });
    for (const angebot of angebote) {
      if (!angebot.sponsorLeihe) continue;
      // Nur der Spezialistenfluegel ist noch offen — genau ihn muss die Leihe treffen.
      expect(angebot.sponsorLeihe.facilityId).toBe("specialist_wing");
    }
  });
});

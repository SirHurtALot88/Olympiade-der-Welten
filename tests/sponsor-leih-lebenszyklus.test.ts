/**
 * SCHRITT 7: EINE LEIHE HAT EIN ENDE — und dazwischen ein Leben.
 *
 * DIE LUECKE, DIE DIESE SUITE ABSICHERT, war nicht theoretisch: `sponsorLeihgabenByTeamId` wurde an
 * genau zwei Stellen beruehrt — geschrieben bei der Unterschrift, gelesen im Overlay. Nichts liess
 * eine Leihgabe altern, zog ihre Stufe hoch oder entfernte sie am Vertragsende. Eine unterschriebene
 * Leihe blieb auf ewig auf Anfangsstufe und in Anfangszustand stehen, waehrend der Cash-Verzicht
 * jede Saison neu faellig wurde. In einer Testsaison unsichtbar; in einem Mehrsaison-Spiel ein Loch.
 *
 * Geprueft werden deshalb die drei Uebergaenge und ihre Grenzen, nicht einzelne Zahlen.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorOfferLeihe, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import {
  baueUebernahmeAngebot,
  lehneUebernahmeAb,
  nimmUebernahmeAn,
  rolleLeihgabe,
  vertragsjahrAus,
} from "@/lib/sponsor/sponsor-leih-lifecycle";
import { berechneKatalogkosten } from "@/lib/sponsor/sponsor-leihe";

const LEIHE: SponsorOfferLeihe = {
  facilityId: "recovery_center",
  raritaet: "magisch",
  kurs: 1.8,
  stufenreihe: [2, 3, 4],
  verzichtJeSaison: [2.9, 5.8, 10.4],
  leihwertJeSaison: [5.2, 10.5, 18.7],
  startZustandPct: 85,
  katalogkostenEndstufe: 77,
};

function baueSpielstand(input: { seasonsRemaining: number; termSeasons: number; zustandPct?: number; stufe?: number }): GameState {
  const contract: TeamSponsorContract = {
    seasonId: "season-1",
    teamId: "M-M",
    offerId: "angebot-1",
    archetype: "identity",
    name: "Testsponsor",
    chosenAt: "2026-08-11T00:00:00.000Z",
    startRank: 8,
    components: [],
    payouts: {},
    termSeasons: input.termSeasons as TeamSponsorContract["termSeasons"],
    seasonsRemaining: input.seasonsRemaining,
    sponsorLeihe: LEIHE,
  };

  return {
    season: { id: "season-1" },
    teams: [{ teamId: "M-M", name: "Mayhem", shortCode: "M-M", cash: 60, rosterLimit: 14 }],
    seasonState: {
      seasonId: "season-1",
      sponsorContractsByTeamId: { "M-M": contract },
      sponsorOffersByTeamId: {},
      sponsorLeihgabenByTeamId: {
        "M-M": [
          {
            facilityId: LEIHE.facilityId,
            stufe: input.stufe ?? LEIHE.stufenreihe[0]!,
            zustandPct: input.zustandPct ?? LEIHE.startZustandPct,
            seasonId: "season-1",
            offerId: "angebot-1",
          },
        ],
      },
    },
  } as unknown as GameState;
}

describe("Vertragsjahr", () => {
  it("zaehlt von der Unterschrift an, nicht rueckwaerts", () => {
    expect(vertragsjahrAus({ termSeasons: 3, seasonsRemaining: 3 })).toBe(1);
    expect(vertragsjahrAus({ termSeasons: 3, seasonsRemaining: 2 })).toBe(2);
    expect(vertragsjahrAus({ termSeasons: 3, seasonsRemaining: 1 })).toBe(3);
  });
});

describe("Die Leihe rollt", () => {
  it("steigt eine Stufe und altert dabei", () => {
    const { leihgabe, verzicht } = rolleLeihgabe({
      leihgabe: { facilityId: "recovery_center", stufe: 2, zustandPct: 85, seasonId: "season-1" },
      leihe: LEIHE,
      naechstesVertragsjahr: 2,
      naechsteSeasonId: "season-2",
      verschleissSaat: "season-2:M-M:leihe",
    });

    expect(leihgabe.stufe).toBe(3);
    expect(leihgabe.seasonId).toBe("season-2");
    expect(leihgabe.zustandPct).toBeLessThan(85);
    // Und der Preis waechst mit der Stufe — sonst stiege das Gebaeude jedes Jahr zum Preis von Jahr 1.
    expect(verzicht).toBe(LEIHE.verzichtJeSaison[1]);
  });

  it("waechst nicht ueber die eigene Leiter hinaus", () => {
    const { leihgabe, verzicht } = rolleLeihgabe({
      leihgabe: { facilityId: "recovery_center", stufe: 4, zustandPct: 60, seasonId: "season-3" },
      leihe: LEIHE,
      naechstesVertragsjahr: 9,
      naechsteSeasonId: "season-4",
    });
    expect(leihgabe.stufe).toBe(4);
    expect(verzicht).toBe(LEIHE.verzichtJeSaison[2]);
  });
});

describe("Der Saisonwechsel", () => {
  it("zieht die Leihe eines laufenden Vertrags hoch und verteuert sie", () => {
    const vorher = baueSpielstand({ seasonsRemaining: 3, termSeasons: 3 });
    const nachher = advanceSponsorContractsForNewSeason(vorher, "season-2");

    const leihgabe = nachher.seasonState.sponsorLeihgabenByTeamId?.["M-M"]?.[0];
    expect(leihgabe?.stufe).toBe(3);
    expect(leihgabe?.zustandPct).toBeLessThan(85);
    expect(leihgabe?.seasonId).toBe("season-2");
    // Kein Uebernahmeangebot, solange der Vertrag laeuft.
    expect(nachher.seasonState.sponsorUebernahmeAngeboteByTeamId).toBeUndefined();
  });

  it("nimmt die Leihe am Vertragsende WEG und legt ein Uebernahmeangebot hin", () => {
    const vorher = baueSpielstand({ seasonsRemaining: 1, termSeasons: 3, stufe: 4, zustandPct: 55 });
    const nachher = advanceSponsorContractsForNewSeason(vorher, "season-2");

    // Der Vertrag ist weg, die Leihe auch.
    expect(nachher.seasonState.sponsorContractsByTeamId?.["M-M"]).toBeUndefined();
    expect(nachher.seasonState.sponsorLeihgabenByTeamId?.["M-M"] ?? []).toHaveLength(0);
    // Und das Team steht wieder auf seinem eigenen Bestand — hier also auf nichts.
    expect(getTeamFacilityState(nachher, "M-M").facilities.recovery_center?.level ?? 0).toBe(0);

    const angebot = nachher.seasonState.sponsorUebernahmeAngeboteByTeamId?.["M-M"]?.[0];
    expect(angebot?.facilityId).toBe("recovery_center");
    expect(angebot?.stufe).toBe(4);
    expect(angebot?.zustandPct).toBe(55);
    expect(angebot?.preis).toBeGreaterThan(0);
    // Guenstiger als der Selbstbau — sonst waere die ganze Leihe sinnlos gewesen.
    expect(angebot!.preis).toBeLessThan(berechneKatalogkosten("recovery_center", 4));
  });

  it("laesst Spielstaende ohne Leihgaben unveraendert", () => {
    const ohne = baueSpielstand({ seasonsRemaining: 3, termSeasons: 3 });
    const blank: GameState = {
      ...ohne,
      seasonState: {
        ...ohne.seasonState,
        sponsorLeihgabenByTeamId: undefined,
        sponsorContractsByTeamId: {
          "M-M": { ...ohne.seasonState.sponsorContractsByTeamId!["M-M"]!, sponsorLeihe: undefined },
        },
      },
    };
    const nachher = advanceSponsorContractsForNewSeason(blank, "season-2");
    expect(nachher.seasonState.sponsorLeihgabenByTeamId).toEqual({});
    expect(nachher.seasonState.sponsorUebernahmeAngeboteByTeamId).toBeUndefined();
  });
});

describe("Der Uebernahmepreis", () => {
  it("rechnet den bereitgestellten Leihwert an und zieht die geerbte Reparatur ab", () => {
    const neu = baueUebernahmeAngebot({
      teamId: "M-M",
      seasonId: "season-2",
      contract: { offerId: "angebot-1", sponsorLeihe: LEIHE },
      leihgabe: { facilityId: "recovery_center", stufe: 4, zustandPct: 100, seasonId: "season-1" },
    });
    const gebraucht = baueUebernahmeAngebot({
      teamId: "M-M",
      seasonId: "season-2",
      contract: { offerId: "angebot-1", sponsorLeihe: LEIHE },
      leihgabe: { facilityId: "recovery_center", stufe: 4, zustandPct: 40, seasonId: "season-1" },
    });

    // Ein abgenutztes Gebaeude ist guenstiger — aber nicht dramatisch, man kauft die Stufen.
    expect(gebraucht!.preis).toBeLessThan(neu!.preis);
    expect(gebraucht!.preis).toBeGreaterThan(neu!.preis * 0.7);
  });

  it("rechnet nur die Saisons an, die auch gelaufen sind", () => {
    // Vertrag nach Jahr 2 beendet: nur die Stufen 2 und 3 wurden bereitgestellt, nicht 4.
    const frueh = baueUebernahmeAngebot({
      teamId: "M-M",
      seasonId: "season-2",
      contract: { offerId: "angebot-1", sponsorLeihe: LEIHE },
      leihgabe: { facilityId: "recovery_center", stufe: 3, zustandPct: 100, seasonId: "season-1" },
    });
    // Angerechnet: 5,2 + 10,5 = 15,7 auf Katalog 42 -> 26,3 minus Reparatur 0.
    expect(frueh!.preis).toBeCloseTo(berechneKatalogkosten("recovery_center", 3) - 15.7, 1);
  });
});

describe("Die Uebernahme selbst", () => {
  it("schreibt das Gebaeude in den EIGENEN Bestand und bucht den Preis ab", () => {
    const nachSaison = advanceSponsorContractsForNewSeason(
      baueSpielstand({ seasonsRemaining: 1, termSeasons: 3, stufe: 4, zustandPct: 55 }),
      "season-2",
    );
    const preis = nachSaison.seasonState.sponsorUebernahmeAngeboteByTeamId!["M-M"]![0]!.preis;
    const kasseVorher = nachSaison.teams[0]!.cash;

    const { gameState: danach, angebot } = nimmUebernahmeAn({
      gameState: nachSaison,
      teamId: "M-M",
      facilityId: "recovery_center",
    });

    expect(angebot).not.toBeNull();
    expect(danach.teams[0]!.cash).toBeCloseTo(kasseVorher - preis, 1);
    // JETZT steht es im eigenen Bestand — vorher war es nie dort.
    const eigen = danach.seasonState.teamFacilities?.["M-M"]?.facilities.recovery_center;
    expect(eigen?.level).toBe(4);
    // Der Zustand wird uebernommen, nicht zurueckgesetzt: die Reparatur steckt schon im Preis.
    expect(eigen?.conditionPct).toBe(55);
    // Und das Angebot ist verbraucht.
    expect(danach.seasonState.sponsorUebernahmeAngeboteByTeamId).toBeUndefined();
  });

  it("laesst ein Team ins Minus gehen, wenn es zugreifen will (E5 — keine Sperre)", () => {
    const nachSaison = advanceSponsorContractsForNewSeason(
      baueSpielstand({ seasonsRemaining: 1, termSeasons: 3, stufe: 4, zustandPct: 100 }),
      "season-2",
    );
    const klamm: GameState = { ...nachSaison, teams: [{ ...nachSaison.teams[0]!, cash: 1 }] };
    const { gameState: danach, error } = nimmUebernahmeAn({
      gameState: klamm,
      teamId: "M-M",
      facilityId: "recovery_center",
    });
    expect(error).toBeUndefined();
    expect(danach.teams[0]!.cash).toBeLessThan(0);
  });

  it("macht aus einem Kauf keinen Rueckschritt, wenn das Team selbst hoeher gebaut hat", () => {
    const nachSaison = advanceSponsorContractsForNewSeason(
      baueSpielstand({ seasonsRemaining: 1, termSeasons: 3, stufe: 4, zustandPct: 40 }),
      "season-2",
    );
    const mitBestand: GameState = {
      ...nachSaison,
      seasonState: {
        ...nachSaison.seasonState,
        teamFacilities: { "M-M": { facilities: { recovery_center: { level: 5, enabled: true, conditionPct: 95 } } } },
      },
    } as GameState;

    const { gameState: danach } = nimmUebernahmeAn({
      gameState: mitBestand,
      teamId: "M-M",
      facilityId: "recovery_center",
    });
    const eigen = danach.seasonState.teamFacilities?.["M-M"]?.facilities.recovery_center;
    expect(eigen?.level).toBe(5);
    expect(eigen?.conditionPct).toBe(95);
  });

  it("meldet ein Angebot, das es nicht gibt, statt still nichts zu tun", () => {
    const { error } = nimmUebernahmeAn({
      gameState: baueSpielstand({ seasonsRemaining: 3, termSeasons: 3 }),
      teamId: "M-M",
      facilityId: "training_center",
    });
    expect(error).toBe("uebernahme_angebot_nicht_gefunden");
  });

  it("laesst beim Ablehnen nichts zurueck", () => {
    const nachSaison = advanceSponsorContractsForNewSeason(
      baueSpielstand({ seasonsRemaining: 1, termSeasons: 3, stufe: 4, zustandPct: 70 }),
      "season-2",
    );
    const danach = lehneUebernahmeAb({ gameState: nachSaison, teamId: "M-M", facilityId: "recovery_center" });
    expect(danach.seasonState.sponsorUebernahmeAngeboteByTeamId).toBeUndefined();
    expect(danach.seasonState.teamFacilities?.["M-M"]).toBeUndefined();
    expect(danach.teams[0]!.cash).toBe(nachSaison.teams[0]!.cash);
  });
});

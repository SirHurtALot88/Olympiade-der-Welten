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
import { sponsorV3GuaranteedLadder, sponsorV3WertFaktorFor } from "@/lib/sponsor/sponsor-v3-model";
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
    // fuer Sprosse genau um den Verzicht unter der Ligaleiter derselben Form, desselben Startrangs
    // und desselben Gehaltsfaktors liegen — nachdem der Raritaets-Wertfaktor angewandt ist. Die
    // beiden Regler sind hier in ihrer Reihenfolge festgenagelt: erst skaliert die Rarität die ganze
    // Leiter, dann geht der Verzicht als ABSOLUTER Betrag ab. Andersherum haenge der Preis eines
    // Gebaeudes an der Rarität der Karte, obwohl das Gebaeude dasselbe ist.
    const gameState = baueSpielstand();
    const angebote = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
    const mitLeihe = angebote.find((angebot) => angebot.sponsorLeihe != null)!;
    const terms = getSponsorV3Terms(mitLeihe)!;
    const verzicht = terms.leihVerzicht!;

    // Eine Gebäude-Karte traegt IMMER den untersten Wertfaktor, egal wie selten sie ist — ihre
    // Rarität steckt vollstaendig im Kurs und damit im Verzicht. Waere es die magische Mitte (1,0),
    // haette eine gewoehnliche Gebäude-Karte eine HOEHERE Leiter als eine gewoehnliche Cash-Karte:
    // mehr Geld UND ein Gebäude, also derselbe doppelte Zugriff in die andere Richtung.
    const wertFaktor = sponsorV3WertFaktorFor("gewöhnlich");
    const ungeschmaelert = sponsorKurvenLeiter({
      shape: terms.curveShape!,
      startRank: terms.startRank,
      salaryFactor: terms.salaryFactor,
    });
    expect(terms.baseLadder).toHaveLength(ungeschmaelert.length);
    terms.baseLadder.forEach((wert, index) => {
      expect(wert).toBeCloseTo(ungeschmaelert[index]! * wertFaktor - verzicht, 6);
    });

    // UND DAS NETZ FRISST DEN VERZICHT NICHT AUF. Das ist keine Formalie: das feste Netz lag bei
    // 43 C, die niedrigste Sprosse ueberhaupt bei 52,1 — es gab also nur 9,1 C Luft. Solange die
    // Karten hoechstens 4,3 C kosteten, fiel das nicht auf; mit Gebaeuden bis Stufe 5 kosten sie bis
    // 25,4 C, und ein festes Netz haette dem Team am Tabellenende das Gebaeude geschenkt. Das Netz
    // sinkt deshalb mit der Karte, und genau das wird hier gemessen.
    for (const angebot of angebote) {
      const kartenTerms = getSponsorV3Terms(angebot)!;
      const kartenVerzicht = kartenTerms.leihVerzicht ?? 0;
      expect(
        Math.min(...sponsorV3GuaranteedLadder(kartenTerms)),
        `Verzicht ${kartenVerzicht} vom Netz aufgefangen`,
      ).toBeGreaterThan(kartenTerms.floor);
    }
  });

  it("spannt die Preisspanne wirklich auf — kleine und grosse Gebaeude im selben Slate", () => {
    // Chris: „manche wollen zb 30 für die gebäude manche nur 5 dafür sind manche stärker manche
    // schwächer." Die erste Fassung koppelte die Stufe an die Rarität und lag damit ueber ALLE
    // Karten zwischen 0,5 und 4,3 C — fuenf Karten, die praktisch dasselbe kosteten. Groesse und
    // Rarität sind jetzt getrennte Regler; gemessen ueber eine ganze Liga: 0,8 bis 25,4 C.
    const gameState = baueSpielstand();
    const verzichte: number[] = [];
    for (let index = 1; index <= 12; index += 1) {
      const teamId = index === 1 ? "M-M" : `T-${index}`;
      for (const angebot of buildSponsorOffersForTeam({ gameState, teamId })) {
        if (angebot.sponsorLeihe) verzichte.push(getSponsorV3Terms(angebot)!.leihVerzicht ?? 0);
      }
    }
    // Der billigste Einstieg bleibt bezahlbar, die teuerste Karte tut wirklich weh.
    expect(Math.min(...verzichte)).toBeLessThan(2.5);
    expect(Math.max(...verzichte)).toBeGreaterThan(12);
    // Und die Stufen kommen tatsaechlich vor, nicht nur die Preise.
    const stufen = new Set<number>();
    for (let index = 1; index <= 12; index += 1) {
      const teamId = index === 1 ? "M-M" : `T-${index}`;
      for (const angebot of buildSponsorOffersForTeam({ gameState, teamId })) {
        if (angebot.sponsorLeihe) stufen.add(angebot.sponsorLeihe.stufenreihe[0]!);
      }
    }
    expect(stufen).toContain(1);
    expect(stufen).toContain(3);
    expect(stufen).toContain(5);
  });

  it("bietet dasselbe Gebaeude nicht zweimal im selben Slate an", () => {
    // Zwei Karten mit demselben Reha-Zentrum auf verschiedenen Stufen sind zwei Preise fuer
    // dieselbe Sache, keine Auswahl zwischen zweien.
    const gameState = baueSpielstand();
    for (let index = 1; index <= 12; index += 1) {
      const teamId = index === 1 ? "M-M" : `T-${index}`;
      const gebaeude = buildSponsorOffersForTeam({ gameState, teamId })
        .map((angebot) => angebot.sponsorLeihe?.facilityId)
        .filter((facilityId): facilityId is string => facilityId != null);
      expect(new Set(gebaeude).size, `${teamId}: ${gebaeude.join(", ")}`).toBe(gebaeude.length);
    }
  });

  it("greift bei Gebaeude-Karten NICHT doppelt zu — mehr Cash UND dickeres Gebaeude gibt es nicht", () => {
    // Chris: „achte darauf dass bei gebäude deals dann nicht MEHR cash UND dicke gebäude angebote
    // rein kommen." Gemessen war es genau das: bei praktisch gleichem Gebaeudewert (Ø 12,4 gegen
    // 12,8) trug die legendäre Gebäude-Karte 69,3 C Erwartungswert, die gewöhnliche 48,9. Die
    // Rarität hob die Leiter UND verbilligte das Gebäude.
    //
    // Der Nachweis hier ist strukturell statt statistisch: die Leiter einer Gebäude-Karte darf den
    // Wertfaktor gar nicht tragen. Was der Rarität bleibt, ist der Kurs — dieselbe Stufe kostet
    // weniger Verzicht, und mehr ist es nicht.
    const gameState = baueSpielstand();
    for (let index = 1; index <= 12; index += 1) {
      const teamId = index === 1 ? "M-M" : `T-${index}`;
      for (const angebot of buildSponsorOffersForTeam({ gameState, teamId })) {
        if (!angebot.sponsorLeihe) continue;
        const terms = getSponsorV3Terms(angebot)!;
        const roh = sponsorKurvenLeiter({
          shape: terms.curveShape!,
          startRank: terms.startRank,
          salaryFactor: terms.salaryFactor,
        });
        expect(terms.baseLadder[0], `${teamId}/${angebot.rarity}: Leiter traegt den Raritaets-Faktor`).toBeCloseTo(
          roh[0]! * sponsorV3WertFaktorFor("gewöhnlich") - (terms.leihVerzicht ?? 0),
          6,
        );
      }
    }
  });

  it("laesst die Rarität den reinen Cash-Wert bewegen — nicht nur die Risikoform", () => {
    // Chris: „ein legendärer cash sponsor der nur cash gibt kann teils mehr wert haben als ein guter
    // magischer sponsor mit nem top gebäude angebot an reinem wert." Vorher waren alle Karten eines
    // Slates auf denselben Erwartungswert normiert — eine legendäre Karte verteilte ihr Geld nur
    // anders, sie zahlte nicht mehr. Jetzt skaliert die Rarität die ganze Leiter.
    const gameState = baueSpielstand();
    const angebot = buildSponsorOffersForTeam({ gameState, teamId: "M-M" })[0]!;
    const terms = getSponsorV3Terms(angebot)!;

    const roh = sponsorKurvenLeiter({
      shape: terms.curveShape!,
      startRank: terms.startRank,
      salaryFactor: terms.salaryFactor,
    });
    const faktor = sponsorV3WertFaktorFor(terms.rarity);
    expect(terms.baseLadder[0]).toBeCloseTo(roh[0]! * faktor, 6);
    // Und die Regler zeigen in die richtige Richtung.
    expect(sponsorV3WertFaktorFor("legendär")).toBeGreaterThan(sponsorV3WertFaktorFor("selten"));
    expect(sponsorV3WertFaktorFor("selten")).toBeGreaterThan(sponsorV3WertFaktorFor("magisch"));
    expect(sponsorV3WertFaktorFor("magisch")).toBeGreaterThan(sponsorV3WertFaktorFor("gewöhnlich"));
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

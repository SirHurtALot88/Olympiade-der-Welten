import { describe, expect, it } from "vitest";

import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { buildSponsorV3Terms, getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
import type { SponsorV4AxisKey } from "@/lib/sponsor/sponsor-v4-axes";

/**
 * DIE KI MUSS DIE ACHSE BEWERTEN, NICHT DAS RISIKO.
 *
 * Bis V3 war die KI-Wahl bewusst trivial: alle Karten hatten denselben Erwartungswert und
 * unterschieden sich nur im Risikoprofil, oekonomisch konnte die KI also nichts falsch machen.
 * Mit Achsenkarten gilt der gleiche Erwartungswert nur noch fuer ein DURCHSCHNITTLICHES Team.
 * Wer seine Achse trifft, holt bis zu +G/2; wer sie verfehlt, verliert ebenso viel. Eine KI, die
 * weiter nur ihre Risikopraeferenz bewertet, verliert damit systematisch gegen jeden Menschen,
 * der seine eigene Spielweise kennt — deshalb ist dieser Test das Release-Gate der Achsen.
 */
describe("KI-Sponsorwahl: bewertet Passung statt Risiko", () => {
  it("unterschreibt fuer jedes KI-Team genau einen Vertrag", () => {
    const gameState = ensureSeasonSponsorOffers(createSingleplayerGameState());
    const after = chooseSponsorOfferForAiTeams(gameState);
    for (const team of after.teams) {
      const contract = getTeamSponsorContract(after, team.teamId);
      expect(contract, `${team.shortCode} ohne Vertrag`).not.toBeNull();
    }
  });

  it("waehlt nicht liga-weit dasselbe Gebaeude und dieselbe Kartengroesse — sonst waere die Bewertung blind", () => {
    // GEAENDERT: die fuenf V4-Zielachsen werden bei neu erzeugten Angeboten nicht mehr vergeben
    // (siehe Kopfkommentar `lib/sponsor/sponsor-leih-ziele.ts`) — `terms.axis` ist bei keinem neuen
    // Vertrag mehr gesetzt, die alte Messgroesse dieses Tests ist damit tot. Die Passungsfrage
    // steckt jetzt in der Gebaeude-Leihe: WELCHES Gebaeude und WIE GROSS. Der Nachweis, dass die
    // Bewertung nicht blind ist, bleibt derselbe wie vorher — nur an der neuen Stelle gemessen: die
    // 32 Teams haben unterschiedliche Profile, also muessen sie auch unterschiedliche Gebaeude und
    // unterschiedliche Kartengroessen waehlen. Eine KI, die nur nach Rarity oder Slot-Reihenfolge
    // griffe, landete bei allen auf demselben.
    const after = chooseSponsorOfferForAiTeams(ensureSeasonSponsorOffers(createSingleplayerGameState()));
    const gewaehlteGebaeude = after.teams
      .map((team) => getTeamSponsorContract(after, team.teamId)?.sponsorLeihe?.facilityId)
      .filter((facilityId): facilityId is string => facilityId != null);
    const gewaehlteGroessen = after.teams
      .map((team) => getTeamSponsorContract(after, team.teamId)?.sponsorLeihe?.stufenreihe?.[0])
      .filter((stufe): stufe is number => stufe != null);

    expect(gewaehlteGebaeude.length).toBeGreaterThan(0);
    expect(new Set(gewaehlteGebaeude).size, "alle Teams auf demselben Gebaeude — die Wahl ist blind").toBeGreaterThan(1);
    expect(gewaehlteGroessen.length).toBeGreaterThan(0);
    expect(new Set(gewaehlteGroessen).size, "alle Teams auf derselben Kartengroesse — die Wahl ist blind").toBeGreaterThan(1);
  });

  it("greift bei Geldnot zur Liquiditaet — und seit den Gebaeude-Karten vor allem zur reinen Cash-Karte", () => {
    // DIESER TEST HAT SEINEN MASSSTAB GEWECHSELT, und der Grund ist eine Aenderung am System, nicht
    // an der KI: bis zu den Gebaeude-Karten war der Vorschuss die EINZIGE Liquiditaetsoption im
    // Slate, also musste er der Massstab sein. Seit E1 gibt es eine zweite und bessere — die reine
    // Cash-Karte, die gar keinen Verzicht verlangt. `scoreOfferForAi` ist dafuer nicht angefasst
    // worden; die Verschiebung entsteht allein daraus, dass die Gebaeude-Karten eine niedrigere
    // Leiter haben und ein klammes Team deshalb die volle Leiter waehlt.
    //
    // GEMESSEN ueber dieselben 32 Teams, nur die Kasse unterschiedlich — Stand, nachdem die KI den
    // Gebaeudewert UND die absolute Kartenhoehe bewertet (beides fehlte ihr zwischenzeitlich):
    //
    //   Kasse −30: 11 von 32 nehmen die reine Cash-Karte, nur 6 die groesste Gebaeude-Karte
    //   Kasse 100:  0 von 32 nehmen die reine Cash-Karte, 22 eine mittlere Gebaeude-Karte
    //
    // Die Richtung ist eindeutig. Dass auch klamme Teams zugreifen, ist ausdruecklich gewollt —
    // Chris: „das bedeutet nicht dass M-M es konsequent nicht picken darf. sie muessen sich
    // ueberlegen ob es das wert ist.“
    const base = ensureSeasonSponsorOffers(createSingleplayerGameState());
    const mitKasse = (cash: number): GameState => ({ ...base, teams: base.teams.map((team) => ({ ...team, cash })) });
    const zaehle = (state: GameState) => {
      let reineCash = 0;
      for (const team of state.teams) {
        if (getTeamSponsorContract(state, team.teamId)?.sponsorLeihe == null) reineCash += 1;
      }
      return { reineCash };
    };

    const klamm = zaehle(chooseSponsorOfferForAiTeams(mitKasse(-30)));
    const entspannt = zaehle(chooseSponsorOfferForAiTeams(mitKasse(60)));

    // Die Kernaussage: die Kassenlage entscheidet, nicht eine feste Rangfolge.
    expect(klamm.reineCash, "kein klammes Team nimmt die volle Auszahlung").toBeGreaterThan(base.teams.length / 8);
    expect(entspannt.reineCash, "entspannte Teams greifen trotzdem zur reinen Cash-Karte").toBeLessThan(klamm.reineCash);
    // FRUEHER STAND HIER AUSSERDEM, dass klamme Teams zum VORSCHUSS greifen. Diese zweite
    // Wahldimension gibt es nicht mehr (sponsor-v3-model.ts): Sponsorgeld kommt ausnahmslos am
    // Saisonende. Die Kassenlage wirkt seither ausschliesslich ueber die Kartenhoehe und den
    // Gebaeude-Verzicht — genau das, was die beiden Zusicherungen oben messen.
  });

  /**
   * DIESER TEST HAT FRUEHER DEN QUELLTEXT GELESEN (`expect(source).toContain("terms.goalSize * (fit
   * - SPONSOR_V4_AXIS_PBAR)")`). Das ist genau die Bauart, die in diesem Projekt schon einmal ueber
   * toter Logik gruen geblieben ist: der String kann stehen, waehrend der Term nichts mehr bewirkt —
   * und umgekehrt faerbt jede harmlose Umbenennung den Test rot, ohne dass sich etwas geaendert
   * haette. Geprueft wird deshalb jetzt das VERHALTEN.
   *
   * DIE MESSUNG: zwei ansonsten IDENTISCHE Karten, die sich nur in ihrer Achse unterscheiden.
   * `estimateAxisFitForAi` bewertet die Achse "ausbau" ausschliesslich nach der Kasse (>= 40 ⇒ 0,9;
   * < 20 ⇒ 0,2), die Achse "soliditaet" dagegen gar nicht nach der Kasse. Bei gleicher Achsengroesse
   * G ist der Term `G · (Erfuellung − 0,5)` fuer "ausbau" also einmal deutlich positiv und einmal
   * deutlich negativ — die KI MUSS die Karte wechseln, allein weil sich die Kasse geaendert hat.
   * Beide Male steht die erwartete Karte an LETZTER Slate-Position: eine Wahl nach Reihenfolge oder
   * nach Rarity koennte den Test nicht bestehen.
   */
  it("die Achse entscheidet die Wahl — dieselben Karten, andere Kasse, andere Karte", () => {
    const basis = createSingleplayerGameState();
    const teamId = basis.teams.find((team) => team.teamId !== "P-S")?.teamId ?? basis.teams[0]!.teamId;

    const rohling = (offerId: string): SponsorOffer =>
      ({
        offerId,
        seasonId: basis.season.id,
        teamId,
        archetype: "performance",
        name: "Achsenprobe",
        flavor: "",
        rarity: "selten",
        curveShape: "stetig",
        totalUpsideEstimate: 0,
        components: [
          { componentId: "base-cash", kind: "base", label: "Basis", targetValue: 0, rewardCash: 0 },
          { componentId: "rank-target", kind: "rank", label: "Gewinnstufen", targetValue: 1, rewardCash: 0 },
        ],
      }) as unknown as SponsorOffer;

    const karte = (axisKey: SponsorV4AxisKey, offerId: string): SponsorOffer => {
      const offer = rohling(offerId);
      return {
        ...offer,
        termSeasons: 1,
        sponsorV3: buildSponsorV3Terms({
          gameState: basis,
          offer,
          startRank: 16,
          cardKey: "basis",
          curveShape: "stetig",
          teamId,
          axisKey,
        }),
      } as SponsorOffer;
    };

    // Voraussetzung, gemessen statt behauptet: beide Achsen haben dieselbe Groesse G und dieselbe
    // Leiter — sonst entschiede etwas anderes als die Passung.
    const ausbauTerms = getSponsorV3Terms(karte("ausbau", "probe"))!;
    const soliditaetTerms = getSponsorV3Terms(karte("soliditaet", "probe"))!;
    expect(ausbauTerms.goalSize).toBe(soliditaetTerms.goalSize);
    expect(ausbauTerms.goalSize).toBeGreaterThan(0);
    expect(ausbauTerms.anchor).toBeCloseTo(soliditaetTerms.anchor, 9);

    const waehle = (cash: number, slate: SponsorOffer[]): string | null => {
      const gameState: GameState = {
        ...basis,
        teams: basis.teams.map((team) => (team.teamId === teamId ? { ...team, cash } : team)),
        seasonState: {
          ...basis.seasonState,
          sponsorContractsByTeamId: {},
          // `ensureSeasonSponsorOffers` ersetzt jedes Slate, das nicht genau fuenf V3-Karten hat.
          sponsorOffersByTeamId: { [teamId]: slate },
        },
      };
      return getTeamSponsorContract(chooseSponsorOfferForAiTeams(gameState), teamId)?.offerId ?? null;
    };

    // ALLE ANGEBOTS-IDS SIND GLEICH LANG — Absicht, kein Zufall: `scoreOfferForAi` schliesst mit
    // `score += (offer.offerId.length % 7) * 0.01` als Tie-Break. Bei ungleich langen IDs entschiede
    // bei Gleichstand diese Stellschraube und nicht die Achse; der Test waere dann gruen, auch wenn
    // der Achsen-Term gar nichts mehr tut (genau so ist er beim Bauen einmal durchgerutscht).
    const IDS_GLEICH_LANG = ["sol-aaa1", "sol-aaa2", "sol-aaa3", "sol-aaa4", "aus-ziel"];
    expect(new Set(IDS_GLEICH_LANG.map((id) => id.length)).size).toBe(1);

    // VOLLE KASSE: "ausbau" ist so gut wie sicher (Erfuellung 0,9) — die Karte steht hinten und muss
    // trotzdem gewinnen.
    expect(
      waehle(200, [
        karte("soliditaet", "sol-aaa1"),
        karte("soliditaet", "sol-aaa2"),
        karte("soliditaet", "sol-aaa3"),
        karte("soliditaet", "sol-aaa4"),
        karte("ausbau", "aus-ziel"),
      ]),
    ).toBe("aus-ziel");

    // LEERE KASSE: dieselbe "ausbau"-Karte ist jetzt ein Minusgeschaeft (Erfuellung 0,2) — die
    // Solidaritaets-Karte gewinnt, ebenfalls von der letzten Position aus.
    expect(
      waehle(-30, [
        karte("ausbau", "aus-aaa1"),
        karte("ausbau", "aus-aaa2"),
        karte("ausbau", "aus-aaa3"),
        karte("ausbau", "aus-aaa4"),
        karte("soliditaet", "sol-ziel"),
      ]),
    ).toBe("sol-ziel");
  }, 120_000);
});

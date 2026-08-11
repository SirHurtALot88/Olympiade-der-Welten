import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

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
      let vorschuss = 0;
      let reineCash = 0;
      for (const team of state.teams) {
        const contract = getTeamSponsorContract(state, team.teamId);
        if (getSponsorV3Terms(contract)?.advance != null) vorschuss += 1;
        if (contract?.sponsorLeihe == null) reineCash += 1;
      }
      return { vorschuss, reineCash };
    };

    const klamm = zaehle(chooseSponsorOfferForAiTeams(mitKasse(-30)));
    const entspannt = zaehle(chooseSponsorOfferForAiTeams(mitKasse(60)));

    // Die Kernaussage: die Kassenlage entscheidet, nicht eine feste Rangfolge.
    expect(klamm.reineCash, "kein klammes Team nimmt die volle Auszahlung").toBeGreaterThan(base.teams.length / 8);
    expect(entspannt.reineCash, "entspannte Teams greifen trotzdem zur reinen Cash-Karte").toBeLessThan(klamm.reineCash);
    // Und der Vorschuss bleibt eine lebende Option — sonst waere die zweite Wahldimension tot.
    expect(klamm.vorschuss, "kein klammes Team nimmt den Vorschuss").toBeGreaterThan(0);
    expect(entspannt.vorschuss).toBeGreaterThan(base.teams.length / 4);
  });

  it("rechnet mit dem erwarteten Cash-Beitrag der Achse, nicht mit einem Archetyp-Bonus", () => {
    const source = read("lib/sponsor/sponsor-offer-service.ts");
    // Der frueher dominante Archetyp-Term (+22 / −25) ist weg: er bewertete eine Markenkategorie,
    // waehrend das Geld an der Achse haengt.
    expect(source).not.toContain("score += 22;");
    expect(source).not.toContain("score -= 25;");
    // Stattdessen der echte Erwartungswert-Term `G * (Erfuellung − 0,5)`.
    expect(source).toContain("terms.goalSize * (fit - SPONSOR_V4_AXIS_PBAR)");
  });
});

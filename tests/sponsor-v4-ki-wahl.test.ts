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

  it("waehlt nicht liga-weit dieselbe Achse — sonst waere die Bewertung blind", () => {
    // Der eigentliche Nachweis, dass die Passungs-Schaetzung wirkt: die 32 Teams haben
    // unterschiedliche Profile, also muessen sie auch unterschiedliche Achsen waehlen. Eine KI, die
    // nur nach Rarity oder nach Slot-Reihenfolge griffe, landete bei allen auf derselben.
    const after = chooseSponsorOfferForAiTeams(ensureSeasonSponsorOffers(createSingleplayerGameState()));
    const gewaehlteAchsen = after.teams
      .map((team) => getSponsorV3Terms(getTeamSponsorContract(after, team.teamId))?.axis?.key)
      .filter((key) => key != null);
    expect(gewaehlteAchsen.length).toBeGreaterThan(0);
    expect(new Set(gewaehlteAchsen).size, "alle Teams auf derselben Achse — die Wahl ist blind").toBeGreaterThan(1);
  });

  it("greift bei Geldnot zum Vorschuss", () => {
    // Ein Team mit leerer Kasse soll die Liquiditaetsoption nehmen, wenn sie im Slate liegt. Das ist
    // der Sinn der zweiten Wahldimension: die Lage entscheidet, nicht eine feste Rangfolge.
    const base = ensureSeasonSponsorOffers(createSingleplayerGameState());
    const klamm: GameState = {
      ...base,
      teams: base.teams.map((team) => ({ ...team, cash: -30 })),
    };
    const after = chooseSponsorOfferForAiTeams(klamm);
    const mitVorschuss = after.teams.filter(
      (team) => getSponsorV3Terms(getTeamSponsorContract(after, team.teamId))?.advance != null,
    ).length;
    // Nicht jedes Team muss — die Achsenpassung darf ueberwiegen —, aber ein klarer Teil soll.
    expect(mitVorschuss, "kein klammes Team nimmt den Vorschuss").toBeGreaterThan(after.teams.length / 4);
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

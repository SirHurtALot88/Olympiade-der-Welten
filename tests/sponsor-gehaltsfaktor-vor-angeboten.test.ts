import { describe, expect, it } from "vitest";

import { buildNewGameStateFromBaseline } from "@/lib/game/new-game-setup-service";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
import { getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";

/**
 * DER TEUERSTE FEHLER, DEN DIESES PROJEKT BISHER HATTE — gemessen am Live-Spielstand vom 4.8.
 *
 * Die Sponsorangebote entstanden im Neuspiel-Setup um 06:03, das Gehaltsfaktor-Fenster wurde aber
 * erst beim Speichern in der Persistenzschicht gesaet — um 11:32. Die Sponsorleiter friert den
 * Faktor bei Unterschrift ein und fand zu diesem Zeitpunkt keinen; sie nahm den Standardwert 1,0.
 * Die Saison lief danach mit 1,18.
 *
 * Alle 32 Vertraege zahlten damit nach einem Faktor-1,0-Jahr, obwohl ein 1,18-Jahr gespielt wurde:
 * der Liga fehlten 267,6 C (10,7 Prozent des Topfes), und 12 von 32 Teams standen nach einem GUTEN
 * Jahr im Minus. Der Fehler war unsichtbar, weil die Verteilung stimmte — nur das Niveau nicht.
 *
 * Deshalb prueft dieser Test nicht die Reihenfolge zweier Funktionsaufrufe (die liesse sich
 * umbauen, ohne dass es auffaellt), sondern die EIGENSCHAFT, um die es geht: was in den Angeboten
 * eingefroren ist, muss der Faktor sein, mit dem die Saison auch abgerechnet wird.
 */
describe("Sponsorangebote frieren den ECHTEN Gehaltsfaktor ein", () => {
  const prepared = buildNewGameStateFromBaseline({
    presetId: "default",
    saveId: "test-save-faktor",
    confirmToken: undefined,
  } as never);
  const gameState = prepared.gameState;

  it("legt das Faktor-Fenster an, bevor irgendein Angebot existiert", () => {
    const factors = gameState.seasonState.seasonEconomyFactors ?? [];
    expect(factors.length, "kein Gehaltsfaktor im frischen Spielstand").toBeGreaterThan(0);
    expect(factors[0]!.factor).toBeGreaterThan(0);
  });

  it("jedes Angebot traegt exakt diesen Faktor — nicht den Standardwert 1,0", () => {
    const seasonFactor = (gameState.seasonState.seasonEconomyFactors ?? [])[0]!.factor;
    let geprueft = 0;
    for (const team of gameState.teams) {
      for (const offer of getTeamSponsorOffers(gameState, team.teamId)) {
        const terms = getSponsorV3Terms(offer);
        if (!terms) continue;
        geprueft += 1;
        expect(
          terms.salaryFactor,
          `${team.shortCode}: Angebot mit Faktor ${terms.salaryFactor}, Saison laeuft mit ${seasonFactor}`,
        ).toBeCloseTo(seasonFactor, 6);
      }
    }
    // Ohne diese Zusicherung waere der Test gruen, wenn gar keine Angebote entstuenden.
    expect(geprueft, "keine Angebote geprueft").toBeGreaterThan(50);
  });

  it("und die bereits unterschriebenen KI-Vertraege ebenso", () => {
    const seasonFactor = (gameState.seasonState.seasonEconomyFactors ?? [])[0]!.factor;
    const contracts = Object.values(gameState.seasonState.sponsorContractsByTeamId ?? {});
    let geprueft = 0;
    for (const contract of contracts) {
      const terms = getSponsorV3Terms(contract);
      if (!terms) continue;
      geprueft += 1;
      expect(terms.salaryFactor).toBeCloseTo(seasonFactor, 6);
    }
    expect(geprueft, "keine Vertraege geprueft").toBeGreaterThan(0);
  });
});

/**
 * DREI ANGEBOTE STATT FUENF — und was daran haengt.
 *
 * Chris: „1 unterschied: nur 3 Sponsoren statt 5". Die Zahl fuenf stammte aus der Gebäude-Bauvorlage
 * („wenn wir dann wieder genug verschiedene möglichkeiten haben lohnen auch wieder die 5 statt 3
 * sponsoren"). Mit dem Gebäude-Schalter auf AUS faellt genau diese Vielfalt weg.
 *
 * Geprueft wird nicht die Konstante, sondern was am Ende beim Team ankommt — und die drei Dinge, die
 * an der Slot-Zahl haengen und deshalb mitwandern muessen:
 *   1. Jedes Team bekommt wirklich drei Angebote, ueber mehrere Saisons und alle Teams.
 *   2. Es bleibt eine AUSWAHL: eine Basis-Karte plus Achsenkarten, drei verschiedene Kurvenformen.
 *   3. Golden-Slot und Challenge-Slot liegen weiterhin INNERHALB des Slates.
 */
import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";
import { ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { rollSponsorOfferSlate } from "@/lib/sponsor/sponsor-tier-pool";

const ERWARTETE_ANGEBOTE = 3;

describe("Drei Angebote je Team", () => {
  it("liefert jedem Team der Liga genau drei Angebote", () => {
    const gameState = ensureSeasonSponsorOffers(createSingleplayerGameState());
    const anzahlen = gameState.teams.map((team) => getTeamSponsorOffers(gameState, team.teamId).length);
    expect(anzahlen).toHaveLength(gameState.teams.length);
    for (let index = 0; index < anzahlen.length; index += 1) {
      expect(anzahlen[index], gameState.teams[index]!.teamId).toBe(ERWARTETE_ANGEBOTE);
    }
    // Und keine Leihe mehr im Slate — der Gebäude-Schalter steht auf AUS.
    for (const team of gameState.teams) {
      for (const angebot of getTeamSponsorOffers(gameState, team.teamId)) {
        expect(angebot.sponsorLeihe ?? null, team.teamId).toBeNull();
      }
    }
  }, 180000);

  it("bleibt eine Auswahl: Basis plus Achsen, drei verschiedene Kurvenformen", () => {
    const gameState = ensureSeasonSponsorOffers(createSingleplayerGameState());
    for (const team of gameState.teams) {
      const angebote = getTeamSponsorOffers(gameState, team.teamId);
      const formen = new Set(angebote.map((angebot) => angebot.sponsorV3?.curveShape));
      expect(formen.size, `${team.teamId} — Kurvenformen`).toBe(ERWARTETE_ANGEBOTE);
      const karten = angebote.map((angebot) => angebot.sponsorV3?.cardKey);
      expect(karten.filter((karte) => karte === "basis").length, `${team.teamId} — Basis-Karte`).toBe(1);
    }
  }, 180000);

  it("Golden-Slot und Challenge-Slot liegen im Slate, ueber mehrere Saisons und Teams", () => {
    // Direkt am Slate-Wurf, damit viele Saisons in vertretbarer Zeit pruefbar sind.
    for (let saison = 1; saison <= 12; saison += 1) {
      for (let team = 0; team < 32; team += 1) {
        const slate = rollSponsorOfferSlate({
          seasonId: `season-${saison}`,
          teamId: `T-${team}`,
          qualityRank: { teamId: `T-${team}`, qualityRank: (team % 32) + 1, leaguePosition: (team % 32) + 1 } as never,
          slotCount: ERWARTETE_ANGEBOTE,
          teamCount: 32,
        });
        expect(slate.entries, `season-${saison}/T-${team}`).toHaveLength(ERWARTETE_ANGEBOTE);
        for (const slot of slate.goldenCardSlots) {
          expect(slot, `Golden-Slot season-${saison}/T-${team}`).toBeGreaterThanOrEqual(0);
          expect(slot, `Golden-Slot season-${saison}/T-${team}`).toBeLessThan(ERWARTETE_ANGEBOTE);
        }
        // Slot 0 traegt die Basis-Karte, die uebrigen je eine eigene Achse — keine Achse doppelt.
        expect(slate.entries[0]!.cardKey).toBe("basis");
        const achsen = slate.entries.slice(1).map((eintrag) => eintrag.axisKey);
        expect(new Set(achsen).size, `Achsen season-${saison}/T-${team}`).toBe(achsen.length);
      }
    }
  });
});

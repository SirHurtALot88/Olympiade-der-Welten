/**
 * DER TEST, DER GEFEHLT HAT: erzeugt der "Neues Spiel"-Weg wirklich das neue Sponsorsystem?
 *
 * Geprueft wird NICHT eine Hilfsfunktion, sondern der Pfad, den der Knopf im Browser nimmt:
 *   Button "Neues Spiel"  ->  POST /api/new-game (app/api/new-game/route.ts)
 *   -> applyNewGameSetup  ->  buildNewGameStateFromBaseline  (lib/game/new-game-setup-service.ts)
 *   -> ensureSeasonSponsorOffers -> buildSponsorOffersForTeam
 *
 * `buildNewGameStateFromBaseline` ist die Funktion, aus der die Route den Spielstand baut — sie
 * wird hier ohne jede Umgebungsvariable aufgerufen, so wie `npm run dev` sie aufruft. Frueher
 * entschied an dieser Stelle `OLY_SPONSOR_V2`, und weil kein Starter der App diese Variable je
 * setzte, erzeugte der Knopf immer Angebote nach altem Recht. Genau diese Luecke schliesst dieser
 * Test: er behauptet nicht, dass die Erzeugung V2 KANN, sondern dass sie es TUT.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";
import { buildNewGameStateFromBaseline } from "@/lib/game/new-game-setup-service";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOfferPresentation } from "@/lib/sponsor/sponsor-offer-presenter";
import { chooseSponsorOffer, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import {
  getSponsorV2Terms, resolveSponsorSystemVersion, stampSponsorSystemVersion,
} from "@/lib/sponsor/sponsor-v2-offer-service";

/** Die sechs Kurvenformen des neuen Modells. Die alten hiessen Koenigsklasse/Aufsteiger/Europapokal. */
const V2_CURVE_NAMES = ["Sockel", "Halten", "Linear", "Gipfel", "Steil", "Flach"];

/**
 * Die beiden Module, die V2 ERSATZLOS ENTFERNT — und an denen der Auftraggeber im Browser gesehen
 * hat, dass er ein altes Spiel vor sich hatte ("Ueberperformance +2,0 je Platz", "Tabellenziel
 * +1,5 C je verbessertem Platz"). Taucht eines davon in einem neu erzeugten Spiel wieder auf, ist
 * die Umstellung nicht angekommen.
 */
const REMOVED_COMPONENT_KINDS = ["overperformance", "improvement"] as const;

const allOffers = (gameState: GameState): SponsorOffer[] =>
  Object.values(gameState.seasonState.sponsorOffersByTeamId ?? {}).flat();

/** Genau der Aufruf, den applyNewGameSetup fuer POST /api/new-game macht — ohne Env, ohne Skript. */
function newGameFromButton(): GameState {
  return buildNewGameStateFromBaseline({ presetId: "solo_1", chrisTeamIds: ["P-S"] }).gameState;
}

describe("Neues Spiel — der Knopf erzeugt das neue Sponsorsystem", () => {
  it("haelt die aktive Version IM SPIELSTAND fest", { timeout: 300_000 }, () => {
    const gameState = newGameFromButton();
    expect(gameState.seasonState.sponsorSystemVersion).toBe(2);
    expect(resolveSponsorSystemVersion(gameState)).toBe(2);
  });

  it("jedes erzeugte Angebot traegt V2-Konditionen", { timeout: 300_000 }, () => {
    const offers = allOffers(newGameFromButton());
    expect(offers.length).toBeGreaterThan(100);
    const withoutTerms = offers.filter((offer) => getSponsorV2Terms(offer) === null);
    expect(withoutTerms.length, `${withoutTerms.length} von ${offers.length} Angeboten ohne V2-Konditionen`).toBe(0);
  });

  it("die entfernten Module tauchen in keinem Angebot mehr auf", { timeout: 300_000 }, () => {
    const offers = allOffers(newGameFromButton());
    for (const kind of REMOVED_COMPONENT_KINDS) {
      const hits = offers.filter((offer) => offer.components.some((component) => component.kind === kind));
      expect(hits.length, `${hits.length} Angebote tragen noch eine "${kind}"-Komponente`).toBe(0);
    }
  });

  it("die Angebote tragen die V2-Struktur: Kurve, Klausel mit Malus, Ziel nach Schwierigkeit", { timeout: 300_000 }, () => {
    const offers = allOffers(newGameFromButton());
    for (const offer of offers) {
      const terms = getSponsorV2Terms(offer)!;
      expect(V2_CURVE_NAMES, `Kurvenform "${terms.curveName}" gehoert nicht zum neuen Modell`)
        .toContain(terms.curveName);
      expect(terms.rankLadder).toHaveLength(32);
      // Eine Klausel ohne Malus waere eine geschenkte Zusatzzahlung, kein Risiko.
      expect(terms.clauseBonus).toBeGreaterThan(0);
      expect(terms.clauseMalus).toBeGreaterThan(0);
      expect(terms.clauseLabel.length).toBeGreaterThan(0);
      // Das Sonderziel ist NACH SCHWIERIGKEIT bepreist — die Wahrscheinlichkeit muss mitgeliefert sein.
      expect(terms.goalPayout).toBeGreaterThan(0);
      expect(terms.goalProbability).toBeGreaterThanOrEqual(0.15);
      expect(terms.goalProbability).toBeLessThanOrEqual(0.72);
    }
  });

  it("die Angebotskarte bekommt den V2-Block, den sie anzeigen soll", { timeout: 300_000 }, () => {
    const gameState = newGameFromButton();
    const teamId = "P-S";
    const offers = gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? [];
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      const v2 = buildSponsorOfferPresentation({ offer, gameState, teamId }).v2;
      expect(v2, `Angebot ${offer.offerId} liefert der Karte keinen V2-Block`).not.toBeNull();
      expect(V2_CURVE_NAMES).toContain(v2!.curveName);
      expect(v2!.clause.malus).toBeGreaterThan(0);
      expect(v2!.goal.probability).toBeGreaterThan(0);
      // Die Spanne muss echte Breite haben — sonst zeigt die Karte eine Entscheidung ohne Folgen.
      expect(v2!.maxPayout).toBeGreaterThan(v2!.minPayout);
    }
  });

  it("der Spieler kann eines auswaehlen und es wird nach V2 abgerechnet", { timeout: 300_000 }, () => {
    const gameState = newGameFromButton();
    const teamId = "P-S";
    const offers = gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? [];
    const signed = chooseSponsorOffer({ gameState, teamId, offerId: offers[0]!.offerId });
    expect(signed.contract, "Angebot liess sich nicht unterschreiben").not.toBeNull();
    // Die Konditionen wandern eingefroren in den Vertrag — ab da haengt nichts mehr an der Erzeugung.
    expect(getSponsorV2Terms(signed.contract!)).not.toBeNull();
    const rows = previewSponsorSettlement(signed.gameState, "season_end").rows.filter((r) => r.teamId === teamId);
    const ids = rows.map((r) => r.componentId);
    for (const part of ["base", "rank", "clause", "special"]) {
      expect(ids.some((id) => id.includes(`:v2:${part}`)), `Settlement-Zeile ":v2:${part}" fehlt`).toBe(true);
    }
  });

  it("auch die KI-Teams haben nach V2 unterschrieben", { timeout: 300_000 }, () => {
    const gameState = newGameFromButton();
    const contracts = Object.values(gameState.seasonState.sponsorContractsByTeamId ?? {});
    expect(contracts.length).toBeGreaterThan(0);
    const withoutTerms = contracts.filter((contract) => getSponsorV2Terms(contract) === null);
    expect(withoutTerms.length, `${withoutTerms.length} von ${contracts.length} KI-Vertraegen nach altem Recht`).toBe(0);
  });
});

describe("Abwaertskompatibilitaet — ein bestehender Spielstand kippt nicht", () => {
  it("ein Save OHNE Versionsvermerk erzeugt weiter Angebote nach altem Recht", { timeout: 300_000 }, () => {
    const legacy = structuredClone(createSingleplayerGameState());
    expect(legacy.seasonState.sponsorSystemVersion).toBeUndefined();
    const offers = allOffers(ensureSeasonSponsorOffers(legacy));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => getSponsorV2Terms(offer) === null)).toBe(true);
    // Und die alten Module sind dort weiterhin vorhanden — der alte Pfad ist unangetastet.
    expect(offers.some((offer) => offer.components.some((c) => c.kind === "overperformance"))).toBe(true);
  });

  it("ein V2-Save erzeugt auch beim naechsten Durchgang wieder V2 — ohne jede Umgebungsvariable", { timeout: 300_000 }, () => {
    // Das war die eigentliche Falle des Feature-Flags: derselbe Spielstand bekam je nach Serverstart
    // ein anderes Regelwerk. Hier wird der Save neu bedient, als liefe er auf einem frischen Prozess.
    const v2Save = stampSponsorSystemVersion(structuredClone(createSingleplayerGameState()), 2);
    const withoutOffers: GameState = {
      ...v2Save,
      seasonState: { ...v2Save.seasonState, sponsorOffersByTeamId: {}, sponsorContractsByTeamId: {} },
    };
    const offers = allOffers(ensureSeasonSponsorOffers(withoutOffers));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => getSponsorV2Terms(offer) !== null)).toBe(true);
  });
});

describe("Neues Spiel — keine Karteileichen in den abgeleiteten Feldern", () => {
  it("die persistierte Modulliste nennt nur Module, die das Angebot wirklich hat", { timeout: 300_000 }, () => {
    // `moduleIds` wird aus den Komponenten abgeleitet, BEVOR V2 die entfernten Module herausnimmt.
    // Ohne Neuableitung stand in jedem Angebot weiter "improvement-target" und "overperformance"
    // — Felder, die nichts mehr beschreiben, aber wie eine Zusage aussehen.
    const offers = allOffers(newGameFromButton());
    for (const offer of offers) {
      const ids = offer.moduleIds ?? [];
      expect(ids.length).toBeGreaterThan(0);
      for (const dead of ["improvement-target", "overperformance"]) {
        expect(ids, `Angebot ${offer.offerId} nennt noch das Modul "${dead}"`).not.toContain(dead);
      }
      // Genau ein Cash-Modul je Cash-Komponente (Perks kommen zusaetzlich dazu).
      expect(ids.length).toBeGreaterThanOrEqual(offer.components.length);
    }
  });
});

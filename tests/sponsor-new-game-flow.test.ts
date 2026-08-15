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
  getSponsorV3Terms, resolveSponsorSystemVersion, stampSponsorSystemVersion,
} from "@/lib/sponsor/sponsor-v3-offer-service";
import { SPONSOR_V3_CARDS } from "@/lib/sponsor/sponsor-v3-model";
import { LEIH_ZIEL_ACHSENRANG, LEIH_ZIEL_FRISCHE, SPONSOR_LEIH_BONUS } from "@/lib/sponsor/sponsor-leih-ziele";
import { SPONSOR_GEBAEUDE_LEIHE_AKTIV } from "@/lib/sponsor/sponsor-leih-slate";

/**
 * V3: aus den Kurvenformen sind die fuenf Risikokarten geworden. Sie sind fuer JEDES Team
 * dieselben — gewuerfelt werden nur noch Marke, Rarity (Groesse des Hebels) und Sonderziel.
 */
const V3_CARD_KEYS = SPONSOR_V3_CARDS.map((card) => card.key);

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
    expect(gameState.seasonState.sponsorSystemVersion).toBe(3);
    expect(resolveSponsorSystemVersion(gameState)).toBe(3);
  });

  it("jedes erzeugte Angebot traegt V2-Konditionen", { timeout: 300_000 }, () => {
    const gameState = newGameFromButton();
    const offers = allOffers(gameState);
    // Gerechnet, nicht festgenagelt: hier stand `> 100`, weil 32 Teams x 5 Karten = 160 anfielen.
    // Seit #512 sind es drei Karten je Team, also 96 — gemeint ist „jedes Team der Liga".
    expect(offers.length).toBeGreaterThanOrEqual(gameState.teams.length);
    const withoutTerms = offers.filter((offer) => getSponsorV3Terms(offer) === null);
    expect(withoutTerms.length, `${withoutTerms.length} von ${offers.length} Angeboten ohne V2-Konditionen`).toBe(0);
  });

  it("die entfernten Module tauchen in keinem Angebot mehr auf", { timeout: 300_000 }, () => {
    const offers = allOffers(newGameFromButton());
    for (const kind of REMOVED_COMPONENT_KINDS) {
      const hits = offers.filter((offer) => offer.components.some((component) => component.kind === kind));
      expect(hits.length, `${hits.length} Angebote tragen noch eine "${kind}"-Komponente`).toBe(0);
    }
  });

  it("die Angebote tragen die V3-Struktur: Karte, Tilt, Ziel nach Schwierigkeit", { timeout: 300_000 }, () => {
    // GEAENDERT: die fuenf V4-Zielachsen werden bei neu erzeugten Angeboten nicht mehr vergeben
    // (siehe Kopfkommentar `lib/sponsor/sponsor-leih-ziele.ts`). An ihre Stelle treten die zwei
    // Leih-Ziele auf den Gebaeude-Karten — fest bepreist (`goalP = 0`, `goalSize = 6`), OHNE
    // Sockelabzug und OHNE Schwierigkeitsband. Die reine Cash-Karte (Platz 0) traegt weiterhin
    // gar kein Ziel.
    const offers = allOffers(newGameFromButton());
    for (const offer of offers) {
      const terms = getSponsorV3Terms(offer)!;
      expect(V3_CARD_KEYS, `Karte "${terms.cardKey}" gehoert nicht zum neuen Modell`)
        .toContain(terms.cardKey);
      expect(terms.rankLadder).toHaveLength(32);
      // V3: die Klausel ist ersatzlos entfallen — ihre Risikofunktion uebernimmt der
      // Kurven-Tilt der Karte. Sicherheit kippt nach unten, Ambition nach oben, Basis flach.
      expect(Math.abs(terms.tilt)).toBeLessThanOrEqual(0.3);
      expect(terms.baseLadder).toHaveLength(32);
      /**
       * WOFUER EINE KARTE AUSSER GELD ZAHLT — und das haengt am Gebaeude-Schalter.
       *
       * MIT Gebaeuden: die Gebaeude-Karten tragen eines der zwei Leih-Ziele, fest bepreist
       * (`goalSize = SPONSOR_LEIH_BONUS`, `goalP = 0`, kein Sockelabzug), und KEINE Karte traegt
       * eine der fuenf Zielachsen.
       *
       * OHNE Gebaeude (#512, heutige Stellung): es gibt keine Gebaeude-Karten, und die Achse ist
       * wieder der Weg, auf dem eine Karte fuer etwas anderes als reines Geld zahlt. Sie traegt
       * dann eine echte Erfolgswahrscheinlichkeit — der Sockelabzug ist bei ihr Teil des Modells.
       *
       * Die reine Cash-Karte traegt in BEIDEN Stellungen gar kein Ziel.
       */
      if (SPONSOR_GEBAEUDE_LEIHE_AKTIV) {
        expect(terms.axis, `Angebot ${offer.offerId} traegt eine Achse trotz Gebaeude-Karten`).toBeUndefined();
      }
      if (terms.goalSize > 0) {
        expect(terms.goalKey).not.toBeNull();
        if (terms.axis) {
          // Achsen-Karte: die Wahrscheinlichkeit ist geschaetzt und muss eine echte sein.
          expect(terms.goalP).toBeGreaterThanOrEqual(0);
          expect(terms.goalP).toBeLessThanOrEqual(1);
        } else {
          expect([LEIH_ZIEL_FRISCHE, LEIH_ZIEL_ACHSENRANG]).toContain(terms.goalKey);
          expect(terms.goalSize).toBe(SPONSOR_LEIH_BONUS);
          // Kein Sockelabzug: wer das Leih-Ziel verfehlt, verliert nichts.
          expect(terms.goalP).toBe(0);
        }
      } else {
        expect(terms.goalKey).toBeNull();
        expect(terms.goalSize).toBe(0);
        expect(terms.goalP).toBe(0);
      }
    }
  });

  it("die Angebotskarte bekommt den V3-Block, den sie anzeigen soll", { timeout: 300_000 }, () => {
    const gameState = newGameFromButton();
    const teamId = "P-S";
    const offers = gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? [];
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      const v2 = buildSponsorOfferPresentation({ offer, gameState, teamId }).v3;
      expect(v2, `Angebot ${offer.offerId} liefert der Karte keinen V3-Block`).not.toBeNull();
      expect(V3_CARD_KEYS).toContain(v2!.cardKey);
      // Klausel entfallen; stattdessen traegt die Karte ihren Tilt.
      expect(Number.isFinite(v2!.tiltPercent)).toBe(true);
      // Ziel nur bei den Gebaeude-Karten — und GEAENDERT: die zwei Leih-Ziele sind ohne
      // Sockelabzug bepreist (p = 0, siehe `lib/sponsor/sponsor-leih-ziele.ts`), anders als
      // die frueheren Zielachsen mit geschaetzter Erfolgswahrscheinlichkeit.
      if (v2!.goal) {
        // Ohne Gebaeude-Karten zahlt die Karte wieder ueber eine Achse (siehe der Fall darueber);
        // deren Wahrscheinlichkeit ist geschaetzt statt fest 0. Was in beiden Stellungen gilt:
        // die Karte kostet nichts im Voraus und ihr Ziel zahlt etwas aus.
        expect(v2!.goal.probability).toBeGreaterThanOrEqual(0);
        expect(v2!.goal.probability).toBeLessThanOrEqual(1);
        expect(v2!.goal.payout).toBeGreaterThan(0);
        // Der Sockelabzug ist −p·G und wird IMMER faellig — die Karte darf ihn nicht anders
        // ausweisen, als sie ihn abrechnet. Bei p = 0 (Leih-Ziel) ist er damit zwingend 0.
        expect(v2!.goal.upfrontCost).toBeCloseTo(v2!.goal.probability * v2!.goal.payout, 1);
        if (SPONSOR_GEBAEUDE_LEIHE_AKTIV) {
          expect(v2!.goal.probability).toBe(0);
          expect(v2!.goal.upfrontCost).toBe(0);
          expect(v2!.goal.payout).toBe(SPONSOR_LEIH_BONUS);
        }
      }
      // Die Spanne muss echte Breite haben — sonst zeigt die Karte eine Entscheidung ohne Folgen.
      expect(v2!.maxPayout).toBeGreaterThan(v2!.minPayout);
    }
  });

  it("der Spieler kann eines auswaehlen und es wird nach V3 abgerechnet", { timeout: 300_000 }, () => {
    const gameState = newGameFromButton();
    const teamId = "P-S";
    const offers = gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? [];
    const signed = chooseSponsorOffer({ gameState, teamId, offerId: offers[0]!.offerId });
    expect(signed.contract, "Angebot liess sich nicht unterschreiben").not.toBeNull();
    // Die Konditionen wandern eingefroren in den Vertrag — ab da haengt nichts mehr an der Erzeugung.
    expect(getSponsorV3Terms(signed.contract!)).not.toBeNull();
    const rows = previewSponsorSettlement(signed.gameState, "season_end").rows.filter((r) => r.teamId === teamId);
    const ids = rows.map((r) => r.componentId);
    // V3: base + rank IMMER. `special` nur bei den beiden Karten, die ein Sonderziel tragen —
    // die Klausel-Zeile ist mit der Klausel selbst ersatzlos entfallen.
    for (const part of ["base", "rank"]) {
      expect(ids.some((id) => id.includes(`:v3:${part}`)), `Settlement-Zeile ":v3:${part}" fehlt`).toBe(true);
    }
  });

  it("auch die KI-Teams haben nach V2 unterschrieben", { timeout: 300_000 }, () => {
    const gameState = newGameFromButton();
    const contracts = Object.values(gameState.seasonState.sponsorContractsByTeamId ?? {});
    expect(contracts.length).toBeGreaterThan(0);
    const withoutTerms = contracts.filter((contract) => getSponsorV3Terms(contract) === null);
    expect(withoutTerms.length, `${withoutTerms.length} von ${contracts.length} KI-Vertraegen nach altem Recht`).toBe(0);
  });
});

describe("Abwaertskompatibilitaet — ein bestehender Spielstand kippt nicht", () => {
  it("ein Save OHNE Versionsvermerk bekommt NEUE Angebote — der alte Erzeugungspfad existiert nicht mehr", { timeout: 300_000 }, () => {
    // GEAENDERT MIT DEM AUFRAEUMEN: Bis dahin bediente ein Spielstand ohne Versionsvermerk sich weiter
    // aus der alten Erzeugung. Die ist entfernt — es gibt keinen zweiten Pfad mehr, in den ein Save
    // zurueckfallen koennte. Was ein Altspielstand BEHAELT, ist seine Vertragsseite: ein bereits
    // unterschriebener Vertrag ohne `sponsorV2`-Block wird unveraendert nach altem Recht abgerechnet
    // (siehe tests/sponsor-v2-display-settlement-parity.test.ts).
    const legacy = structuredClone(createSingleplayerGameState());
    expect(legacy.seasonState.sponsorSystemVersion).toBeUndefined();
    const offers = allOffers(ensureSeasonSponsorOffers(legacy));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => getSponsorV3Terms(offer) !== null)).toBe(true);
    expect(offers.some((offer) => offer.components.some((c) => c.kind === "overperformance"))).toBe(false);
    expect(offers.some((offer) => offer.components.some((c) => c.kind === "improvement"))).toBe(false);
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
    expect(offers.every((offer) => getSponsorV3Terms(offer) !== null)).toBe(true);
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

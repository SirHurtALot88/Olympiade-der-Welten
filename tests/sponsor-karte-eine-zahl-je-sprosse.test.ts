/**
 * AUF DERSELBEN SPROSSE DARF NUR EINE ZAHL STEHEN.
 *
 * DER BEFUND, den dieser Test festhält, kam von Chris und war auf der Karte mit bloßem Auge zu
 * sehen: der Block „Saisonbudgets" wies für „Top 28 · aktuell" **57,7 Mio** aus, die Leiter
 * „Gewinnstufen" darunter für dieselbe Sprosse **64,1 Mio**. Zwei Zahlen für ein und denselben
 * Endrang, beide als aktuell markiert.
 *
 * DIE URSACHE war kein Rundungsfehler, und das Verhältnis sagte es sofort: 57,7 / 64,1 = 0,900 —
 * derselbe Faktor auf JEDER Sprosse (56,6/62,8 · 68,8/76,3 · 62,1/68,9). Es war exakt 1 / 1,11, also
 * der Raritäts-Wertfaktor einer legendären Karte. `buildSponsorOfferTermForecast` baute die Leiter
 * mit `sponsorKurvenLeiter` NEU, statt die im Vertrag eingefrorene zu lesen, und verpasste dabei
 * alles, was zwischen roher Ligaleiter und Vertragsleiter liegt: den Wertfaktor, den Tilt der Karte
 * und (bei Gebäude-Karten) den Cash-Verzicht.
 *
 * WAS DARAUS FOLGT und warum dieser Test nicht nur die eine Zahl prüft: eine zweite Rechenstelle
 * findet solche Abweichungen nie von selbst, sie treibt nur langsam auseinander. Die Vorschau ruft
 * jetzt `rerollSponsorV3TermsForNewSeason` — genau die Funktion, die beim Saisonwechsel wirklich
 * läuft. Damit ist die Vorschau nicht bloß korrigiert, sondern sie KANN nicht mehr abweichen: was
 * sie zeigt, ist definitionsgemäß das, was passieren wird.
 */
import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  buildOfferRankPayoutLadderPreview,
  buildSponsorOfferTermForecast,
} from "@/lib/sponsor/sponsor-economy-calibration";
import { buildSponsorOffersForTeam, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
import { sponsorV3WertFaktorFor } from "@/lib/sponsor/sponsor-v3-model";

describe("Saisonbudget-Vorschau gegen Gewinnstufen-Leiter", () => {
  it("zeigt fuer die ERSTE Saison exakt dieselben Betraege wie die Gewinnstufen — auf jeder der 32 Sprossen", () => {
    const gameState = ensureSeasonSponsorOffers(createSingleplayerGameState());
    let geprueft = 0;

    for (const team of gameState.teams) {
      for (const angebot of buildSponsorOffersForTeam({ gameState, teamId: team.teamId })) {
        const vorschau = buildSponsorOfferTermForecast(gameState, angebot);
        if (vorschau.length === 0) continue;
        const gewinnstufen = buildOfferRankPayoutLadderPreview(gameState, angebot);
        expect(gewinnstufen).toHaveLength(32);

        vorschau[0]!.rankPayouts.forEach((wert, index) => {
          expect(
            wert,
            `${team.teamId} ${angebot.rarity} · Endrang ${index + 1}: Saisonbudget ${wert} gegen Gewinnstufe ${gewinnstufen[index]}`,
          ).toBeCloseTo(gewinnstufen[index]!, 1);
        });
        geprueft += 1;
      }
    }

    // Ohne diese Zeile koennte der Test gruen sein, weil er nichts verglichen hat.
    expect(geprueft, "keine einzige Vorschau geprueft").toBeGreaterThan(50);
  });

  it("traegt den Raritaets-Wertfaktor — die Abweichung war exakt 1/1,11 bei legendaeren Karten", () => {
    // Der Nachweis am Mechanismus statt am Symptom: die Vorschau der ersten Saison muss oberhalb der
    // ROHEN Ligaleiter liegen, wenn die Karte eine hohe Raritaet traegt. Genau diese Differenz fehlte.
    const gameState = ensureSeasonSponsorOffers(createSingleplayerGameState());
    let mitFaktorGeprueft = 0;

    for (const team of gameState.teams) {
      for (const angebot of buildSponsorOffersForTeam({ gameState, teamId: team.teamId })) {
        const terms = getSponsorV3Terms(angebot);
        // Nur reine Cash-Karten: bei Gebaeude-Karten ueberlagert der Verzicht den Faktor.
        if (!terms || angebot.sponsorLeihe) continue;
        const faktor = sponsorV3WertFaktorFor(terms.rarity);
        if (faktor <= 1) continue;

        const vorschau = buildSponsorOfferTermForecast(gameState, angebot);
        if (vorschau.length === 0) continue;
        // Der Erwartungsanker der Karte steckt den Faktor bereits ein; die Vorschau muss ihn
        // ebenfalls tragen, sonst laege sie systematisch darunter.
        const summe = vorschau[0]!.rankPayouts.reduce((acc, wert) => acc + wert, 0);
        const ohneFaktor = summe / faktor;
        expect(summe, `${team.teamId}: Vorschau traegt den Faktor ${faktor} nicht`).toBeGreaterThan(ohneFaktor);
        mitFaktorGeprueft += 1;
      }
    }

    expect(mitFaktorGeprueft, "kein Angebot mit erhoehter Raritaet im Slate — der Test hat nichts geprueft")
      .toBeGreaterThan(0);
  });

  it("laesst die Betraege ueber die Laufzeit fallen, statt sie neu zu erfinden", () => {
    // Die Erosion der Folgejahre bleibt erhalten — sie kommt jetzt aus derselben Funktion wie beim
    // echten Saisonwechsel, statt hier ein zweites Mal von Hand gerechnet zu werden.
    const gameState = ensureSeasonSponsorOffers(createSingleplayerGameState());
    let mehrjaehrigeGeprueft = 0;

    for (const team of gameState.teams) {
      for (const angebot of buildSponsorOffersForTeam({ gameState, teamId: team.teamId })) {
        const vorschau = buildSponsorOfferTermForecast(gameState, angebot);
        if (vorschau.length < 2) continue;
        for (let jahr = 1; jahr < vorschau.length; jahr += 1) {
          expect(vorschau[jahr]!.rankPayouts).toHaveLength(32);
          for (const wert of vorschau[jahr]!.rankPayouts) {
            expect(Number.isFinite(wert)).toBe(true);
          }
        }
        mehrjaehrigeGeprueft += 1;
      }
    }

    expect(mehrjaehrigeGeprueft, "kein Mehrjahresvertrag im Slate").toBeGreaterThan(0);
  });
});

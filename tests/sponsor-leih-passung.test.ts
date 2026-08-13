/**
 * PASST DAS GELIEHENE GEBÄUDE ZU DIESEM TEAM?
 *
 * Chris: „und es muss ja auch zum team passen wenn L-R nur kurze verträge macht und seine spieler
 * nicht behalten will, was machen die mit ner academy? ob das dann was bringt ist ja auch fraglich."
 *
 * Was hier bewiesen wird — an WERTEN, nicht an Quelltext:
 *  1. Die vier Gebäudegruppen werden verschieden bewertet, und zwar in der Richtung, die ihr in
 *     lib/facilities NACHGELESENER Effekt vorgibt.
 *  2. Ein Team, das seine Spieler durchreicht, bekommt fuer ein ENTWICKLUNGSGEBÄUDE weniger
 *     angerechnet als eines, das sie bindet — bei sonst identischen Zahlen.
 *  3. Die Passung gewichtet, sie dreht nie das Vorzeichen (harte Klammer).
 *  4. Am ECHTEN Auswahlpfad: Informationsgebäude, die ein KI-Team mechanisch nicht abrufen kann,
 *     werden seltener unterschrieben, als sie angeboten werden.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import {
  LEIH_INFO_OHNE_WIRKUNG,
  LEIH_PASSUNG_MAX,
  LEIH_PASSUNG_MIN,
  LEIH_SCOUTING_GRUNDWERT,
  sponsorLeihPassungFuerTeam,
  type SponsorLeihPassungEingabe,
} from "@/lib/sponsor/sponsor-leih-passung";

/** Ein Median-Team, wie es die Messung an 32 Teams gezeigt hat: lang 6, kurz 5, Verkauf 5, Tiefe 5. */
const MEDIAN_TEAM = {
  stufe: 3,
  entwicklerGrad: 0.18,
  langeVertraege: 6,
  kurzeVertraege: 5,
  verkaufsneigung: 5,
  kaderTiefeNeigung: 5,
  beliebtheit: 1,
  academyBerechtigtAnteil: null,
  kaderLuecke: 0,
} satisfies Omit<SponsorLeihPassungEingabe, "facilityId">;

const passung = (ueberschreibung: Partial<SponsorLeihPassungEingabe> & { facilityId: string }) =>
  sponsorLeihPassungFuerTeam({ ...MEDIAN_TEAM, ...ueberschreibung });

const ALLE_TYPEN = [
  "training_center", "recovery_center", "scouting_office", "analytics_room",
  "fan_shop", "arena_upgrade", "academy", "specialist_wing",
] as const;

describe("Gebäude-Passung: die vier Gruppen", () => {
  it("Einnahmegebäude: der Fan Shop ist teamunabhaengig, die Arena traegt die Beliebtheit", () => {
    // Katalog: Fan Shop „flach, verlässlich — nicht beliebtheitsskaliert"; die Arena bucht
    // „Basis × Beliebtheit" (facility-season-end-service.ts). `berechneLeihwert` kennt nur die Basis.
    expect(passung({ facilityId: "fan_shop", beliebtheit: 0.6 })).toBeCloseTo(1, 9);
    expect(passung({ facilityId: "fan_shop", beliebtheit: 1.4 })).toBeCloseTo(1, 9);
    expect(passung({ facilityId: "arena_upgrade", beliebtheit: 0.75 })).toBeCloseTo(0.75, 9);
    expect(passung({ facilityId: "arena_upgrade", beliebtheit: 1.25 })).toBeCloseTo(1.25, 9);
    // Gemessene Spanne einer frischen Liga: 0,75 … 1,25 — also ein realer Unterschied von einem Drittel
    // zwischen dem beliebtesten und dem unbeliebtesten Team bei identischer Karte.
    expect(passung({ facilityId: "arena_upgrade", beliebtheit: 1.25 }))
      .toBeGreaterThan(passung({ facilityId: "arena_upgrade", beliebtheit: 0.75 }) * 1.3);
  });

  it("Informationsgebäude sind fuer ein KI-Team die schwaechste Gruppe — der Analytics Room am schwaechsten", () => {
    const werte = ALLE_TYPEN.map((facilityId) => ({ facilityId, wert: passung({ facilityId }) }));
    const analytics = werte.find((eintrag) => eintrag.facilityId === "analytics_room")!.wert;
    const scouting = werte.find((eintrag) => eintrag.facilityId === "scouting_office")!.wert;
    expect(analytics).toBeCloseTo(LEIH_INFO_OHNE_WIRKUNG, 9);
    expect(scouting).toBeCloseTo(LEIH_SCOUTING_GRUNDWERT, 9);
    // Kein anderer Typ liegt fuer das Median-Team so tief.
    for (const eintrag of werte) {
      if (eintrag.facilityId === "analytics_room") continue;
      expect(eintrag.wert, eintrag.facilityId).toBeGreaterThan(analytics);
    }
  });

  it("Rotation: wer duenn faehrt, holt mehr aus dem Reha-Zentrum", () => {
    const duenn = passung({ facilityId: "recovery_center", kaderTiefeNeigung: 3 });
    const tief = passung({ facilityId: "recovery_center", kaderTiefeNeigung: 8 });
    expect(duenn).toBeGreaterThan(tief);
    // Und eine offene Kaderluecke (ab Saison 2 messbar) hebt zusaetzlich.
    expect(passung({ facilityId: "recovery_center", kaderTiefeNeigung: 5, kaderLuecke: 3 }))
      .toBeGreaterThan(passung({ facilityId: "recovery_center", kaderTiefeNeigung: 5, kaderLuecke: 0 }));
  });

  it("Specialist Wing: Stufe 1 ist fast wertlos, weil es den 8-%-Routenbonus auch ohne das Gebäude gibt", () => {
    const stufe1 = passung({ facilityId: "specialist_wing", stufe: 1 });
    const stufe5 = passung({ facilityId: "specialist_wing", stufe: 5 });
    expect(stufe5).toBeGreaterThan(stufe1 * 3);
    // Zum Vergleich: das Trainingszentrum wirkt auf Stufe 1 sehr wohl (+14 % gegen 0 ohne Gebäude).
    expect(passung({ facilityId: "training_center", stufe: 1 })).toBeGreaterThan(stufe1);
  });
});

describe("Gebäude-Passung: Chris' Fall — kurze Vertraege gegen Academy", () => {
  const durchreicher = { langeVertraege: 3, kurzeVertraege: 8, verkaufsneigung: 10, entwicklerGrad: 0.05 };
  const binder = { langeVertraege: 8, kurzeVertraege: 3, verkaufsneigung: 3, entwicklerGrad: 0.4 };

  it("ein Team mit kurzen Vertraegen und hoher Verkaufsneigung bekommt fuer Entwicklungsgebäude weniger angerechnet", () => {
    for (const facilityId of ["training_center", "academy", "specialist_wing"] as const) {
      expect(passung({ facilityId, stufe: 5, ...binder }), facilityId)
        .toBeGreaterThan(passung({ facilityId, stufe: 5, ...durchreicher }));
    }
    // Konkret: die Academy des Binders ist mindestens ein Drittel mehr wert als die des Durchreichers.
    expect(passung({ facilityId: "academy", stufe: 5, ...binder }))
      .toBeGreaterThan(passung({ facilityId: "academy", stufe: 5, ...durchreicher }) * 1.3);
  });

  it("…waehrend ein EINNAHMEgebäude davon voellig unberuehrt bleibt — die Passung wirkt nur, wo der Effekt sitzt", () => {
    expect(passung({ facilityId: "fan_shop", ...binder })).toBeCloseTo(passung({ facilityId: "fan_shop", ...durchreicher }), 9);
    expect(passung({ facilityId: "arena_upgrade", ...binder })).toBeCloseTo(passung({ facilityId: "arena_upgrade", ...durchreicher }), 9);
  });

  it("ohne einen einzigen berechtigten Spieler ist die Academy wertlos — mit lauter berechtigten voll", () => {
    // `getAcademyDevelopmentBoostPct` gibt fuer Rating >= 45 exakt 0 zurueck.
    const ohne = passung({ facilityId: "academy", stufe: 5, academyBerechtigtAnteil: 0 });
    const voll = passung({ facilityId: "academy", stufe: 5, academyBerechtigtAnteil: 1 });
    expect(ohne).toBeCloseTo(LEIH_PASSUNG_MIN, 9);
    expect(voll).toBeGreaterThan(ohne * 4);
    // Ohne Kader (Saison 1 vor dem Draft) gibt es dazu kein Urteil: der Anteil bleibt neutral und
    // die Academy wird wie ein normales Entwicklungsgebäude bewertet.
    expect(passung({ facilityId: "academy", stufe: 5, academyBerechtigtAnteil: null }))
      .toBeCloseTo(passung({ facilityId: "training_center", stufe: 5 }), 9);
  });
});

describe("Gebäude-Passung: die Klammer haelt", () => {
  it("keine Kombination faellt aus [MIN, MAX] — die Passung gewichtet, sie dreht nichts um", () => {
    for (const facilityId of ALLE_TYPEN) {
      for (const stufe of [1, 3, 5]) {
        for (const entwicklerGrad of [0, 0.3, 1]) {
          for (const wert of [3, 10]) {
            for (const beliebtheit of [0.4, 1, 2]) {
              for (const academyBerechtigtAnteil of [null, 0, 1]) {
                const ergebnis = passung({
                  facilityId, stufe, entwicklerGrad, beliebtheit, academyBerechtigtAnteil,
                  langeVertraege: wert, kurzeVertraege: 13 - wert, verkaufsneigung: wert,
                  kaderTiefeNeigung: wert, kaderLuecke: 6,
                });
                expect(ergebnis, `${facilityId}/${stufe}`).toBeGreaterThanOrEqual(LEIH_PASSUNG_MIN);
                expect(ergebnis, `${facilityId}/${stufe}`).toBeLessThanOrEqual(LEIH_PASSUNG_MAX);
              }
            }
          }
        }
      }
    }
  });
});

describe("Gebäude-Passung am echten Auswahlpfad", () => {
  it("Informationsgebäude werden seltener unterschrieben, als sie angeboten werden", () => {
    const basis: GameState = ensureSeasonSponsorOffers(createSingleplayerGameState());
    const nachher = chooseSponsorOfferForAiTeams(basis);

    const angebotenInfo = basis.teams.reduce((summe, team) => {
      const angebote = getTeamSponsorOffers(basis, team.teamId);
      return summe + angebote.filter((angebot) => istInfo(angebot.sponsorLeihe?.facilityId)).length;
    }, 0);
    const angebotenGesamt = basis.teams.reduce(
      (summe, team) => summe + getTeamSponsorOffers(basis, team.teamId).filter((angebot) => angebot.sponsorLeihe != null).length,
      0,
    );
    let unterschriebenInfo = 0;
    let unterschriebenGesamt = 0;
    for (const team of nachher.teams) {
      const leihe = getTeamSponsorContract(nachher, team.teamId)?.sponsorLeihe;
      if (!leihe) continue;
      unterschriebenGesamt += 1;
      if (istInfo(leihe.facilityId)) unterschriebenInfo += 1;
    }

    expect(angebotenInfo, "die Liga bietet ueberhaupt Informationsgebäude an").toBeGreaterThan(0);
    expect(unterschriebenGesamt, "es werden ueberhaupt Gebäude unterschrieben").toBeGreaterThan(0);
    const angebotsAnteil = angebotenInfo / angebotenGesamt;
    const wahlAnteil = unterschriebenInfo / unterschriebenGesamt;
    expect(wahlAnteil, `Angebot ${angebotsAnteil.toFixed(2)} gegen Wahl ${wahlAnteil.toFixed(2)}`)
      .toBeLessThan(angebotsAnteil);
  });
});

function istInfo(facilityId: string | null | undefined): boolean {
  return facilityId === "analytics_room" || facilityId === "scouting_office";
}

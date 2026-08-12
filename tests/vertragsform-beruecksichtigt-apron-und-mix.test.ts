/**
 * DIE APRON-LAGE FLIESST IN DIE VERTRAGSFORM EIN — SIE ENTSCHEIDET SIE NICHT.
 *
 * GEMELDET VON CHRIS: „Top Teams sollten wenn es geht evtl mehr die Mechanik nutzen Front und Back
 * Loaded verträge zu gestalten um die Apron probleme ggf. umgehen zu können - das muss die AI
 * berücksichtigen." Nachgeschoben als Grenze: „es sollen ja nicht alle top teams dann nur back
 * loaded nehmen […] dann hast du irgendwann nen sehr teuren gehaltspeak das muss auch vermieden
 * werden, der mix machts."
 *
 * WAS AM CODE BELEGT WAR, BEVOR HIER ETWAS ENTSTAND:
 *   - Die KI WÄHLT die Form sehr wohl (`contract-negotiation-preview.ts`, Cash-Regeln) — die
 *     Vorarbeit hatte offen gelassen, ob sie nur durchreicht. Sie wählt, aber ohne Apron-Bezug.
 *   - Beide Kaufwege enden in derselben Funktion: der Marktplan gibt die Form ausdrücklich mit,
 *     der Füll-Lauf (`ai_roster_fill`, 195 der 234 Verträge im Live-Abbild) übergibt keine und
 *     fällt auf `recommendContractOfferForPlayer` zurück (`transfermarkt-local-service.ts:1172`).
 *
 * WAS DIE FORM NICHT KANN, UND DESHALB HIER AUCH NICHT VERSPROCHEN WIRD: die Apron-Abgabe umgehen.
 * Sie bemisst sich absichtlich an der GEGLÄTTETEN Gehaltszahl, damit niemand sich per Ratenplan
 * über oder unter die Linie schiebt (Kopfkommentar `apron-service.ts`, kalibriert in PR #368).
 * Bewegt wird die ECHTE Zahlung dieser Saison — und die fällt bei einem Team über der Linie sonst
 * zusätzlich zur Abgabe an. Am Abbild gemessen taten das fünf von acht Teams über Linie 1
 * (M-M: geglättet 81,6 gegen echt 95,9).
 */
import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { recommendContractOfferForPlayer } from "@/lib/market/contract-negotiation-preview";
import { MIX_RIEGEL_MINDESTZAHL, wendeApronUndMixAn } from "@/lib/market/contract-shape-context";
import type { Player } from "@/lib/data/olyDataTypes";

const gameState = createFreshSeasonOneGameState();

/** Ein teurer Spieler — bei billigen Ergänzungen ist die Form ohnehin bedeutungslos. */
const teurerSpieler: Player = [...gameState.players].sort(
  (left, right) => (right.marketValue ?? 0) - (left.marketValue ?? 0),
)[0]!;

/**
 * Eine Lage, in der die heutige Cash-Regel front-loaded empfiehlt: viel Cash gegenüber dem
 * Marktwert, langer Kerndeal, offensives Profil. Ohne diesen Aufbau prüfte der Test nichts —
 * die Apron-Regel greift ausschliesslich dort, wo sonst front-geloadet würde.
 */
function frontLoadLage(extra?: {
  apronHeadroom?: number;
  backLoadedShare?: number;
  mehrjahresVertraege?: number;
}) {
  const marktwert = 40;
  return {
    player: teurerSpieler,
    teamStrategyProfile: {
      bias: { starPriority: 9, riskTolerance: 8, longContractPreference: 8 },
    } as never,
    teamCash: marktwert * 4,
    marketValue: marktwert,
    currentTeamSalary: 30,
    dealRole: "core",
    isFirstSeason: false,
    ...extra,
  };
}

describe("Vertragsform: Apron-Lage und Vertragsmix fliessen ein", () => {
  it("ohne die Angaben bleibt alles wie bisher — front-loaded bei dickem Cashpuffer", () => {
    const ohne = recommendContractOfferForPlayer(frontLoadLage() as never);
    expect(ohne.contractLength).toBeGreaterThanOrEqual(2);
    expect(ohne.contractShape).toBe("front_loaded");
  });

  it("ueber der Apron-Linie wird nicht mehr front-geloadet", () => {
    // Negativer Spielraum = das Team liegt ueber der ersten Linie.
    const drueber = recommendContractOfferForPlayer(frontLoadLage({ apronHeadroom: -9.9 }) as never);
    expect(drueber.contractShape).not.toBe("front_loaded");
    // AUSGEGLICHEN, nicht back-loaded: die Regel nimmt die teure Rate aus der Abgabe-Saison heraus,
    // schiebt sie aber nicht gesammelt nach hinten. „der mix machts."
    expect(drueber.contractShape).toBe("balanced");
  });

  it("unter der Linie bleibt front-loaded erlaubt — die Regel greift nicht flaechendeckend", () => {
    const drunter = recommendContractOfferForPlayer(frontLoadLage({ apronHeadroom: 12.5 }) as never);
    expect(drunter.contractShape).toBe("front_loaded");
  });

  it("die Apron-Regel erzeugt NIE back-loaded — auch nicht bei leerem Back-Load-Anteil", () => {
    // Chris: „achtung deine messwerte schieben alles extrem richtung backloaded das gefaellt mir
    // gar nicht." Die Regel darf die Liga nicht in eine Richtung kippen.
    for (const anteil of [0, 0.2, 0.6, 0.9]) {
      const ergebnis = recommendContractOfferForPlayer(
        frontLoadLage({ apronHeadroom: -9.9, backLoadedShare: anteil }) as never,
      );
      expect(ergebnis.contractShape, `backLoadedShare=${anteil}`).toBe("balanced");
    }
  });

  it("der Mix-Riegel greift auch ohne Apron-Druck", () => {
    // Cash eng → die bestehende Regel empfiehlt back-loaded …
    const engOhneRiegel = recommendContractOfferForPlayer({
      player: teurerSpieler,
      teamCash: 5,
      marketValue: 40,
      currentTeamSalary: 60,
      dealRole: "core",
      isFirstSeason: false,
    } as never);
    expect(engOhneRiegel.contractShape).toBe("back_loaded");

    // … und mit ueberwiegend back-loaded Kader wird daraus ausgeglichen.
    const engMitRiegel = recommendContractOfferForPlayer({
      player: teurerSpieler,
      teamCash: 5,
      marketValue: 40,
      currentTeamSalary: 60,
      dealRole: "core",
      isFirstSeason: false,
      backLoadedShare: 0.75,
      mehrjahresVertraege: 8,
    } as never);
    expect(engMitRiegel.contractShape).toBe("balanced");
  });

  it("der Mix-Riegel braucht einen Mindestnenner — 2 von 2 ist kein Gehaltsberg", () => {
    // Fables Befund: ohne Mindestnenner triggerte der Riegel am Abbild real bei D-P (2/2) und
    // A-A (4/4). Bei so wenigen Vertraegen sagt der Anteil nichts ueber eine Zukunftslast aus.
    const knapp = wendeApronUndMixAn({
      form: "back_loaded",
      laufzeit: 3,
      backLoadedShare: 1,
      mehrjahresVertraege: MIX_RIEGEL_MINDESTZAHL - 1,
    });
    expect(knapp.form).toBe("back_loaded");

    const genug = wendeApronUndMixAn({
      form: "back_loaded",
      laufzeit: 3,
      backLoadedShare: 1,
      mehrjahresVertraege: MIX_RIEGEL_MINDESTZAHL,
    });
    expect(genug.form).toBe("balanced");
  });

  it("die gemeinsame Regel verschiebt nur — sie erzeugt aus keiner Eingabe back_loaded", () => {
    // Die Zusicherung, auf die es Chris ankommt, an der Regel selbst statt nur ueber die Vorschau.
    for (const form of ["front_loaded", "back_loaded", "balanced"] as const) {
      for (const headroom of [-30, -0.1, 0, 5, 50]) {
        for (const anteil of [0, 0.49, 0.5, 1]) {
          const ergebnis = wendeApronUndMixAn({
            form,
            laufzeit: 3,
            apronHeadroom: headroom,
            backLoadedShare: anteil,
            mehrjahresVertraege: 10,
          });
          if (form !== "back_loaded") {
            expect(ergebnis.form, `${form}/${headroom}/${anteil}`).not.toBe("back_loaded");
          }
        }
      }
    }
  });

  it("bei Einjahresvertraegen aendert die Lage nichts — dort gibt es keine Verteilung", () => {
    const einJahr = {
      player: teurerSpieler,
      teamStrategyProfile: { bias: { shortContractPreference: 9 } } as never,
      teamCash: 5,
      marketValue: 8,
      currentTeamSalary: 60,
      dealRole: "depth",
      isFirstSeason: false,
    };
    const ohne = recommendContractOfferForPlayer(einJahr as never);
    const mit = recommendContractOfferForPlayer({
      ...einJahr,
      apronHeadroom: -20,
      backLoadedShare: 0.9,
    } as never);
    // Der Aufbau MUSS einen Einjahresvertrag liefern, sonst prueft der Fall nichts. Fable hatte
    // zurecht bemaengelt, dass die Zusicherung vorher konditional war und leer durchlaufen konnte.
    expect(ohne.contractLength).toBe(1);
    expect(mit.contractLength).toBe(1);
    expect(mit.contractShape).toBe(ohne.contractShape);
  });
});

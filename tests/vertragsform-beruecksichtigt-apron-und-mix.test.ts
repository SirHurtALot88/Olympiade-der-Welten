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
import {
  MIX_RIEGEL_QUOTE,
  getContractShapeTeamContext,
  wendeApronUndMixAn,
} from "@/lib/market/contract-shape-context";
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
function frontLoadLage(extra?: { apronHeadroom?: number; gehaltsbergQuote?: number }) {
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
        frontLoadLage({ apronHeadroom: -9.9, gehaltsbergQuote: anteil }) as never,
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
      gehaltsbergQuote: 0.3,
    } as never);
    expect(engMitRiegel.contractShape).toBe("balanced");
  });

  it("der Riegel misst GELD, nicht Formen — knapp unter der Quote greift er nicht", () => {
    // Chris: „Ja miss es an zukunftslast." Die Quote ist der gebundene Mehrbetrag spaeterer
    // Vertragsjahre, an der heutigen Gehaltssumme gemessen.
    const knapp = wendeApronUndMixAn({
      form: "back_loaded",
      laufzeit: 3,
      gehaltsbergQuote: MIX_RIEGEL_QUOTE - 0.01,
    });
    expect(knapp.form).toBe("back_loaded");

    const drueber = wendeApronUndMixAn({
      form: "back_loaded",
      laufzeit: 3,
      gehaltsbergQuote: MIX_RIEGEL_QUOTE,
    });
    expect(drueber.form).toBe("balanced");
  });

  it("ohne Angabe der Quote bleibt das Verhalten unveraendert", () => {
    expect(wendeApronUndMixAn({ form: "back_loaded", laufzeit: 3 }).form).toBe("back_loaded");
  });

  it("die gemeinsame Regel verschiebt nur — sie erzeugt aus keiner Eingabe back_loaded", () => {
    // Die Zusicherung, auf die es Chris ankommt, an der Regel selbst statt nur ueber die Vorschau.
    for (const form of ["front_loaded", "back_loaded", "balanced"] as const) {
      for (const headroom of [-30, -0.1, 0, 5, 50]) {
        for (const quote of [0, 0.14, 0.15, 0.5]) {
          const ergebnis = wendeApronUndMixAn({
            form,
            laufzeit: 3,
            apronHeadroom: headroom,
            gehaltsbergQuote: quote,
          });
          if (form !== "back_loaded") {
            expect(ergebnis.form, `${form}/${headroom}/${quote}`).not.toBe("back_loaded");
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
      gehaltsbergQuote: 0.9,
    } as never);
    // Der Aufbau MUSS einen Einjahresvertrag liefern, sonst prueft der Fall nichts. Fable hatte
    // zurecht bemaengelt, dass die Zusicherung vorher konditional war und leer durchlaufen konnte.
    expect(ohne.contractLength).toBe(1);
    expect(mit.contractLength).toBe(1);
    expect(mit.contractShape).toBe(ohne.contractShape);
  });
});

describe("Die Gehaltsberg-Quote misst gebundenes Geld", () => {
  const TEAM = gameState.teams[0]!.teamId;

  /** Baut einen Kader aus Vertraegen mit vorgegebenen Jahresraten. */
  function mitVertraegen(...plaene: number[][]) {
    return getContractShapeTeamContext(
      {
        ...gameState,
        rosters: plaene.map((raten, index) => ({
          id: `r-${index}`,
          teamId: TEAM,
          playerId: gameState.players[index]!.id,
          contractLength: raten.length,
          salary: raten[0],
          yearlySalarySchedule: raten.map((salary, yearIndex) => ({
            yearIndex,
            seasonOffset: yearIndex,
            label: `J${yearIndex + 1}`,
            salary,
          })),
        })),
      } as never,
      TEAM,
    );
  }

  it("ein back-loaded Vertrag erzeugt genau seinen Aufschlag", () => {
    // Jetzt 10, spaeter 16 → Mehrbetrag 6 auf Basis 10.
    expect(mitVertraegen([10, 16]).gehaltsbergQuote).toBe(0.6);
  });

  it("front-loaded zaehlt NICHT negativ — nur der Anstieg ist ein Berg", () => {
    expect(mitVertraegen([16, 10]).gehaltsbergQuote).toBe(0);
  });

  it("ein front-loaded Vertrag kann einen back-loaded nicht wegrechnen", () => {
    // Basis 26, Aufschlag nur aus dem zweiten Vertrag: 6/26.
    expect(mitVertraegen([16, 10], [10, 16]).gehaltsbergQuote).toBe(0.231);
  });

  it("auslaufende Einjahresvertraege verwaessern die Quote nicht kuenstlich", () => {
    // Sie erhoehen die Basis, tragen aber keinen Aufschlag — genau wie im echten Kader.
    const ohne = mitVertraegen([10, 16]).gehaltsbergQuote;
    const mit = mitVertraegen([10, 16], [10]).gehaltsbergQuote;
    expect(mit).toBeLessThan(ohne);
    expect(mit).toBe(0.3);
  });

  it("die teuerste kuenftige Rate zaehlt, nicht die letzte", () => {
    // Spitze in Jahr 2, danach wieder billiger — der Berg steht trotzdem.
    expect(mitVertraegen([10, 20, 12]).gehaltsbergQuote).toBe(1);
  });

  it("ein leerer Kader ergibt 0 statt einer Division durch null", () => {
    expect(mitVertraegen().gehaltsbergQuote).toBe(0);
  });
});

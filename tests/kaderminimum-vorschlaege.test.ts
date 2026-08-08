/**
 * GEMELDET: „warum blockieren überhaupt teams? Beim Verkauf gibts keine minimum was man nicht
 * unterschreiten darf wo ist dann das problem"
 *
 * Chris hatte recht: es ist KEIN Verkaufs-Minimum. `roster_after_market_plan_below_player_min`
 * feuert nur, wenn Kaeufe geplant sind und der Kader DANACH noch unter dem Minimum liegt — genau
 * die Regel, die er nennt („teams müssen erst NACH DEM KAUFEN genügend spieler haben").
 *
 * Am Spielstand gemessen blieben sieben von 32 Teams darunter, der kleinste Kader hatte drei
 * Spieler bei 164.81 Mio auf dem Konto. Die Ursache liegt in einer Kette; hier sind die beiden
 * Glieder, die dieser Test festhaelt.
 *
 * GLIED 1 — `ai-transfermarkt-preview-service.ts`: die Vorschlagsliste war auf `.slice(0, 3)`
 * fest verdrahtet. Drei Vorschlaege, immer, egal wie leer der Kader ist. Ein Team mit drei
 * Spielern konnte damit selbst im besten Fall nur auf sechs kommen und fiel anschliessend in den
 * Blocker. Am Angebot lag es nicht: 2696 Spieler im Spielstand haben gar keinen Kader.
 * Gemessen: N-N bekam vorher 3 Vorschlaege, jetzt 10.
 *
 * GLIED 2 — `unified-pick-planner-service.ts`: `if (legacyCount > 0) return legacyCount;` nahm die
 * Anzahl des alten Pfads unbesehen, ohne je zu pruefen, ob sie bis zum Minimum reicht. Die
 * Bedarfsrechnung darunter war nur erreichbar, wenn der alte Pfad NICHTS geliefert hatte.
 *
 * GLIED 3 ist NICHT in diesem PR und auch nicht hier getestet: die Pick-Engine liefert weniger
 * Picks als angefordert, weil `season1_draft_spend_budget` fuer manche Teams 0 ergibt — gemessen
 * bei A-A (2 angefordert, 1 geliefert, Budget 0) und P-C, obwohl beide nach den Verkaeufen
 * desselben Plans 94 bzw. 160 Mio haetten. Das ist eine Budget-Frage und gehoert getrennt
 * entschieden.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveUnifiedMarketPickSteps } from "@/lib/ai/unified-pick-planner-service";

const schritte = (input: {
  kader: number | null;
  min: number | null;
  opt: number | null;
  verkaeufe: number;
  legacyKaeufe: number;
}) =>
  resolveUnifiedMarketPickSteps({
    currentState: { rosterCount: input.kader, playerMin: input.min, playerOpt: input.opt },
    sellPlan: { candidates: new Array(input.verkaeufe).fill(null) },
    buyPlan: { candidates: new Array(input.legacyKaeufe).fill(null) },
  });

describe("Kader-Minimum: die Schrittzahl darf es nie unterbieten", () => {
  it("hebt eine zu kleine Legacy-Anzahl auf den Bedarf an", () => {
    // Der gemeldete Fall: Kader 3, Minimum 8 — der alte Pfad wollte zwei Kaeufe, das Team braucht
    // fuenf. Vorher gewann die 2 und das Team blieb bei fuenf Spielern stehen.
    expect(schritte({ kader: 3, min: 8, opt: 9, verkaeufe: 0, legacyKaeufe: 2 })).toBe(5);
  });

  it("laesst eine groessere Legacy-Anzahl unangetastet", () => {
    // Die Qualitaetsauswahl darf MEHR wollen als das Minimum verlangt — nur nie weniger.
    expect(schritte({ kader: 3, min: 8, opt: 9, verkaeufe: 0, legacyKaeufe: 6 })).toBe(6);
  });

  it("rechnet die geplanten Verkaeufe mit ein", () => {
    // Kader 9, drei Verkaeufe -> 6 nach Verkauf, Minimum 8, also zwei Kaeufe noetig. Genau das
    // Muster von A-A und B-P im Spielstand (9 -> 6 bzw. 7 nach Plan).
    expect(schritte({ kader: 9, min: 8, opt: 10, verkaeufe: 3, legacyKaeufe: 1 })).toBe(2);
  });

  it("verlangt nichts, wenn der Kader schon ueber dem Optimum liegt", () => {
    expect(schritte({ kader: 12, min: 8, opt: 10, verkaeufe: 0, legacyKaeufe: 0 })).toBe(0);
  });

  it("fuellt bis zum Optimum, wenn das Minimum bereits steht", () => {
    // Unveraendertes Verhalten: zwischen Minimum und Optimum bleibt die alte Regel.
    expect(schritte({ kader: 8, min: 8, opt: 10, verkaeufe: 0, legacyKaeufe: 0 })).toBe(2);
  });

  it("kommt mit unbekannten Kaderzahlen klar, statt zu raten", () => {
    expect(schritte({ kader: null, min: 8, opt: 10, verkaeufe: 0, legacyKaeufe: 0 })).toBe(0);
  });
});

describe("Vorschlagsliste: so viele wie der Kader braucht", () => {
  it("ist nicht mehr auf drei fest verdrahtet", () => {
    const quelle = readFileSync(
      join(process.cwd(), "lib/ai/ai-transfermarkt-preview-service.ts"),
      "utf8",
    );
    // Die feste Kappung war die Ursache — sie darf nicht zurueckkommen.
    expect(quelle).not.toContain("rankedAffordableCandidates\n        .slice(0, 3)");
    expect(quelle).toContain("empfehlungsAnzahl");
    // Untergrenze bleibt bei drei, damit ein voller Kader genauso viel sieht wie vorher.
    expect(quelle).toContain("Math.max(3, kaderLuecke + 2)");
  });
});

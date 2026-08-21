/**
 * DER FORMWUNSCH HATTE FUER DIE KI KEINEN PREIS.
 *
 * Aufgabe war „Preisgewicht fuer den Spielerwunsch bei der Vertragsform, als Aufschlag bei
 * Nichtuebereinstimmung". Beim Nachmessen stellte sich heraus: im MENSCHLICHEN Verhandlungspfad
 * gibt es dieses Gewicht laengst. `buildPlayerContractPreference` legt bei Formabweichung +0,02
 * auf `salaryAdjustmentPct` (plus +0,015, wenn die Abweichung `matchQuality` von „preferred" auf
 * „acceptable" kippt), und `buildContractNegotiationPreview` reicht das an
 * `deriveRetoolContractSalarySignal` durch. Am Abbild vom 21.08. gemessen: ueber 285 abweichende
 * Mehrjahresvertraege ein Median von 6,51 % Aufschlag.
 *
 * Die Luecke lag woanders — im KI-Schnellkauf-Pfad. `transfermarkt-local-service.ts` rief
 *
 *     resolveContractLengthSalaryFactor({ player, contractLength, teamFit })
 *
 * ohne `salaryPreferenceAdjustmentPct`. Ueber genau diesen Aufruf laufen alle KI-Kaeufe und der
 * organische Setup-Draft der Saison 1. Die KI durfte die Form also frei gegen den Spielerwunsch
 * drehen (Kassenstand, Gehaltsberg, Apron-Lage entscheiden sie in
 * `recommendContractOfferForPlayer`) und zahlte dafuer nichts.
 *
 * Eingepreist wird NUR der Formanteil. `salaryAdjustmentPct` mischt Laufzeit und Form; wuerde man
 * die Summe durchreichen, bepreiste dieser Pfad nebenbei auch die Laufzeit neu — eine ganz andere
 * Aenderung als die gemeldete. `resolveContractShapeSalarySurcharge` zieht deshalb die Preference
 * mit der Wunschform bei identischer Laufzeit ab.
 */
import { describe, expect, it } from "vitest";

import type { ContractShape, Player, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import {
  buildPlayerContractPreference,
  resolveContractLengthSalaryFactor,
  resolveContractShapeSalarySurcharge,
} from "@/lib/market/contract-negotiation-preview";

const ALLE_FORMEN: ContractShape[] = ["front_loaded", "balanced", "back_loaded"];

function spieler(id: string, traitsPositive: string[] = [], traitsNegative: string[] = []): Player {
  return {
    id,
    name: `Spieler ${id}`,
    traitsPositive,
    traitsNegative,
  } as unknown as Player;
}

function andereForm(wunsch: ContractShape): ContractShape {
  return ALLE_FORMEN.find((form) => form !== wunsch)!;
}

const KEIN_PROFIL: TeamStrategyProfile | null = null;

describe("Die Vertragsform gegen den Spielerwunsch kostet", () => {
  it("verlangt einen Aufschlag, wenn die Form nicht die gewuenschte ist", () => {
    const p = spieler("form-1");
    const wunsch = buildPlayerContractPreference(p, KEIN_PROFIL)!.shapePreference;
    const aufschlag = resolveContractShapeSalarySurcharge({
      player: p,
      teamStrategyProfile: KEIN_PROFIL,
      contractLength: 3,
      contractShape: andereForm(wunsch),
    });
    expect(aufschlag).toBeGreaterThan(0);
  });

  it("verlangt bei getroffenem Wunsch NICHTS — kein Aufschlag, aber auch kein Rabatt", () => {
    // Chris' Vorgabe zu dieser Aufgabe: „Standard bleibt der Normalpreis, Abweichen kostet."
    // Ein Rabatt bei Treffer waere dieselbe Zahl, aber die andere Erzaehlung.
    for (const id of ["treffer-1", "treffer-2", "treffer-3", "treffer-4"]) {
      const p = spieler(id);
      const wunsch = buildPlayerContractPreference(p, KEIN_PROFIL)!.shapePreference;
      expect(
        resolveContractShapeSalarySurcharge({
          player: p,
          teamStrategyProfile: KEIN_PROFIL,
          contractLength: 3,
          contractShape: wunsch,
        }),
      ).toBe(0);
    }
  });

  it("traegt bei KEINER Laufzeit einen Laufzeit-Anteil mit hinein", () => {
    // Die eigentliche Probe darauf, dass nur die Form drinsteckt: bei getroffener Form ist der
    // Aufschlag 0 — und zwar auch dann, wenn die LAUFZEIT weit danebenliegt und
    // `salaryAdjustmentPct` deshalb dick im Plus steht. Wuerde die Summe roh durchgereicht,
    // stuende hier bei 1 und 5 Jahren eine Zahl.
    const p = spieler("nur-form");
    const wunsch = buildPlayerContractPreference(p, KEIN_PROFIL)!.shapePreference;
    const rohe: number[] = [];
    for (const jahre of [1, 2, 3, 4, 5]) {
      rohe.push(buildPlayerContractPreference(p, KEIN_PROFIL, { contractLength: jahre, contractShape: wunsch })!.salaryAdjustmentPct);
      expect(
        resolveContractShapeSalarySurcharge({
          player: p,
          teamStrategyProfile: KEIN_PROFIL,
          contractLength: jahre,
          contractShape: wunsch,
        }),
      ).toBe(0);
    }
    // Gegenprobe zur Gegenprobe: der rohe Wert schwankt ueber die Laufzeiten wirklich — sonst
    // waeren die Nullen darueber trivial und die Zeile pruefte nichts.
    expect(new Set(rohe).size).toBeGreaterThan(1);
    expect(rohe.some((wert) => wert !== 0)).toBe(true);
  });

  it("kostet bei jeder Laufzeit etwas, wenn die Form abweicht", () => {
    // Die Hoehe ist nicht konstant, und das ist die bestehende Regel, nicht mein Zutun: weicht die
    // Form ab, kippt `matchQuality` je nach Laufzeitlage von „preferred" auf „acceptable" (oder
    // bleibt „mismatch"). Daraus werden 0,02 / 0,035 / 0,06. Festgenagelt wird deshalb, DASS es
    // kostet — nicht die Stufe.
    const p = spieler("nur-form");
    const gegen = andereForm(buildPlayerContractPreference(p, KEIN_PROFIL)!.shapePreference);
    for (const jahre of [1, 2, 3, 4, 5]) {
      expect(
        resolveContractShapeSalarySurcharge({
          player: p,
          teamStrategyProfile: KEIN_PROFIL,
          contractLength: jahre,
          contractShape: gegen,
        }),
      ).toBeGreaterThan(0);
    }
  });

  it("schlaegt auf den Gehaltsfaktor des KI-Kaufpfads durch", () => {
    // Der Faktor, mit dem `transfermarkt-local-service.ts` das Basisgehalt multipliziert. Ohne
    // den Aufschlag ist er fuer beide Formen gleich — das war der Fehler.
    const p = spieler("faktor-1");
    const wunsch = buildPlayerContractPreference(p, KEIN_PROFIL)!.shapePreference;
    const gegen = andereForm(wunsch);
    const faktor = (form: ContractShape) =>
      resolveContractLengthSalaryFactor({
        player: p,
        contractLength: 3,
        salaryPreferenceAdjustmentPct: resolveContractShapeSalarySurcharge({
          player: p,
          teamStrategyProfile: KEIN_PROFIL,
          contractLength: 3,
          contractShape: form,
        }),
      });
    expect(faktor(gegen)).toBeGreaterThan(faktor(wunsch));
  });
});

describe("Der KI-Kaufpfad reicht den Aufschlag auch wirklich durch", () => {
  /**
   * Das ist der Kern der Meldung, und er laesst sich nicht ueber die oeffentliche API pruefen:
   * `buildFastLocalBuy` braucht einen kompletten GameState. Geprueft wird deshalb die Verdrahtung
   * im Quelltext — dieselbe Bauart wie `tests/vertragsform-alle-kaufwege-verdrahtet.test.ts`.
   *
   * Nicht die Schreibweise wird festgenagelt, sondern die Zusage: der Faktor-Aufruf dieses Pfads
   * kennt den Formaufschlag, und die Form wird VOR dem Gehalt bestimmt (vorher stand sie
   * darunter — deshalb konnte das Gehalt sie gar nicht kennen).
   */
  const quelle = new URL("../lib/market/transfermarkt-local-service.ts", import.meta.url).pathname;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const text: string = require("node:fs").readFileSync(quelle, "utf8");

  it("berechnet den Formaufschlag und gibt ihn an den Gehaltsfaktor weiter", () => {
    expect(text).toContain("resolveContractShapeSalarySurcharge");
    expect(text).toContain("salaryPreferenceAdjustmentPct: contractShapeSalarySurcharge");
  });

  it("bestimmt die Vertragsform VOR dem Gehalt", () => {
    const formPos = text.indexOf("const contractShape =");
    const gehaltPos = text.indexOf("const contractShapeSalarySurcharge =");
    expect(formPos).toBeGreaterThanOrEqual(0);
    expect(gehaltPos).toBeGreaterThan(formPos);
  });
});

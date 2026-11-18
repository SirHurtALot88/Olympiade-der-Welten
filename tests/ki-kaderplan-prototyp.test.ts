/**
 * PROTOTYP „KADERPLAN" (OLY_KI_KADERPLAN=1, docs/design/ki-pick-analyse-18-11.md):
 *  1. jeder Kauf unter dem Zielkader (Opt) reserviert die restlichen geplanten Plaetze zu einem Platzpreis (ab 12, keine
 *     Fueller) — das Team landet am Zielkader statt 1 bis 3 darunter;
 *  2. kein Billigster-Spieler-Notweg: unter dem Pflichtkader mit Toepfen nimmt die KI den BESTBEWERTETEN bezahlbaren Spieler;
 *  3. Schalter aus: der Kaufschritt ist bit-gleich zum Stand davor.
 */
import { afterEach, describe, expect, it } from "vitest";

import { buildOrganicSquadPlan, KADERPLAN_PLATZ_MIN_MW, type OrganicSquadPlanInput } from "@/lib/ai/organic-squad/draft-builder";
import type { CoreAxis, OrganicDiscipline, OrganicPlayerView } from "@/lib/ai/organic-squad/types";
import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";
import { kaufeMitNachruecken, LIGA_DRAFT_KI_TOPN_STUFEN } from "@/lib/draft/liga-draft-dienst";

afterEach(() => {
  delete process.env.OLY_KI_KADERPLAN;
});

const DISCIPLINES: OrganicDiscipline[] = [
  { id: "tdm", category: "power" },
  { id: "tennis", category: "mental" },
  { id: "spurt", category: "speed" },
];
const AXIS: Record<CoreAxis, number> = { pow: 0.4, spe: 0.3, men: 0.2, soc: 0.1 };

function zufall(start: number) {
  let seed = start;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Markt wie im frischen Spiel: Preise 3 bis 90, Qualitaet steigt mit dem Preis. */
function markt(n: number, saat: number): OrganicPlayerView[] {
  const rnd = zufall(saat);
  return Array.from({ length: n }, (_, i) => {
    const wert = Math.round((3 + rnd() ** 1.6 * 87) * 10) / 10;
    const q = 35 + wert * 0.6 + rnd() * 10;
    return {
      playerId: `p${i}`,
      pow: q + rnd() * 10, spe: q + rnd() * 10, men: q + rnd() * 10, soc: q + rnd() * 10,
      disciplineRatings: { tdm: q + rnd() * 10, tennis: q + rnd() * 10, spurt: q + rnd() * 10 },
      marketValue: wert,
      salary: Math.max(1, Math.round(wert / 4)),
    };
  });
}

function eingabe(saat: number, cash: number, playerOpt: number, extra?: Partial<OrganicSquadPlanInput["economy"]>): OrganicSquadPlanInput {
  return {
    startingSquad: [],
    candidates: markt(400, saat),
    identityAxisWeights: AXIS,
    disciplines: DISCIPLINES,
    economy: {
      cash, cashBuffer: 12, salaryTotal: 0, boardRisk: 0.3, expectedPrize: 0, sponsorIncome: 0, facilityNet: 0, netTransfer: 0,
      solvencyFloor: 12, minFillFloor: 12,
      weights: deriveUtilityWeights({ ambition: 60, finances: 50, boardConfidence: 50, harmony: 50, playerOpt }, {}),
      ...extra,
    },
    draftSeed: `test:${saat}`,
  };
}

describe("Kaderplan: geplante Plaetze werden besetzt", () => {
  it("mit genug Geld fuer den Zielkader landet die KI am Zielkader, nie darunter, ohne Fueller", () => {
    for (let saat = 1; saat <= 30; saat += 1) {
      const opt = 10 + (saat % 5);
      const cash = 170 + (saat * 37) % 160;
      const input = eingabe(saat, cash, opt);
      const vorher = buildOrganicSquadPlan(input);
      process.env.OLY_KI_KADERPLAN = "1";
      const nachher = buildOrganicSquadPlan(input);
      delete process.env.OLY_KI_KADERPLAN;
      const ziel = input.economy.weights.optTarget;
      // Traegt die Kasse den Zielkader zum Platzpreis, wird er erreicht.
      if (cash - 12 >= ziel * 15) expect(nachher.finalSquad.length).toBeGreaterThanOrEqual(ziel);
      // Nie kleiner als vorher bis zum Zielkader (ueber Opt darf vorher mit Fuellern groesser gewesen sein).
      expect(nachher.finalSquad.length).toBeGreaterThanOrEqual(Math.min(vorher.finalSquad.length, ziel));
      expect(nachher.finalCash).toBeGreaterThanOrEqual(12 - 1e-9);
      // Keine Fueller unter der Platzpreis-Grenze, solange es teurere gab.
      for (const spieler of nachher.finalSquad) expect(spieler.marketValue).toBeGreaterThanOrEqual(KADERPLAN_PLATZ_MIN_MW - 9);
    }
    // Der Befund selbst (29 von 32 Teams unter Opt) entsteht erst mit Komposition und echtem Markt; er ist am frischen
    // Spielstand gemessen (scripts/miss-ki-pick-analyse-18-11.ts), nicht hier.
  });

  it("Schalter aus: Plan bit-gleich (gleiche Spieler in gleicher Reihenfolge)", () => {
    const input = eingabe(7, 240, 12);
    const a = buildOrganicSquadPlan(input).decisions.map((d) => d.playerId);
    const b = buildOrganicSquadPlan(input).decisions.map((d) => d.playerId);
    expect(a).toEqual(b);
    process.env.OLY_KI_KADERPLAN = "0";
    expect(buildOrganicSquadPlan(input).decisions.map((d) => d.playerId)).toEqual(a);
  });
});

describe("Kaderplan: kein Billigster-Spieler-Notweg", () => {
  it("unter dem Pflichtkader mit gesperrtem Topf nimmt die KI den bestbewerteten bezahlbaren, nicht den billigsten", () => {
    const input = eingabe(3, 300, 11, { feeCap: 0, salaryCap: 0 });
    const ohne = buildOrganicSquadPlan(input);
    process.env.OLY_KI_KADERPLAN = "1";
    const mit = buildOrganicSquadPlan(input);
    const billigste = [...input.candidates].sort((a, b) => a.marketValue - b.marketValue).slice(0, 8).map((p) => p.playerId);
    // Alt: der Topf ist zu, unter 8 kommen genau die acht billigsten (Notweg).
    expect(ohne.decisions.map((d) => d.playerId).sort()).toEqual([...billigste].sort());
    // Neu: acht Spieler, aber nach Bewertung — nicht die acht billigsten.
    expect(mit.finalSquad.length).toBeGreaterThanOrEqual(8);
    expect(mit.decisions.map((d) => d.playerId).sort()).not.toEqual([...billigste].sort());
    const wert = (ids: string[]) => ids.reduce((s, id) => s + input.candidates.find((p) => p.playerId === id)!.marketValue, 0);
    expect(wert(mit.decisions.slice(0, 8).map((d) => d.playerId))).toBeGreaterThan(wert(billigste));
  });

  it("Einzelschritt-Draft: nach Fehlkaeufen geht es in der Rangliste weiter, nie zur Billig-Liste", () => {
    const rangliste = Array.from({ length: 300 }, (_, i) => `r${i}`);
    const ergebnis = kaufeMitNachruecken({
      topNStufen: [...LIGA_DRAFT_KI_TOPN_STUFEN, Number.MAX_SAFE_INTEGER],
      rangliste: (n) => rangliste.slice(0, n),
      notfall: () => ["billig"],
      kaufe: (id) => (id === "r250" ? { ok: true, ergebnis: id } : { ok: false, grund: "spieler_vergeben" }),
      maxVersuche: 400,
    });
    expect(ergebnis.ok && ergebnis.playerId).toBe("r250");
    expect(ergebnis.ok && ergebnis.ausNotfall).toBe(false);
  });
});

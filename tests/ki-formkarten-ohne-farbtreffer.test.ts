import { describe, expect, it } from "vitest";

import {
  buildAiFormCardSeasonPlan,
  formCardSlotValue,
  type FormCardSeasonPlanCard,
  type FormCardSeasonPlanSlot,
} from "@/lib/ai/ai-form-card-season-plan";

/**
 * GEMELDET VON CHRIS (19.08., In-Game, Ansicht matchdayArena): „AI Teams dürfen ihre Formkarten wenn
 * sie eine Rote haben auch in grünen Diszis zum Boostne einsetzen, da bekomen sie zwar keinen x2
 * boost, aber manchmal kann sihc das lohnen! bitte einbauen"
 *
 * DIE FARBE IST EIN FAKTOR, KEIN SCHLOSS — und das war sie hier auch schon. Am Live-Abbild
 * nachgemessen (Saison 1, Spieltag 8): von 213 Pluskarten-Einsaetzen der KI lagen 49 auf einer
 * Disziplin OHNE Farbtreffer, also knapp ein Viertel. Der Wunsch ist damit erfuellt, bevor er
 * gestellt wurde.
 *
 * WOFUER DIESER TEST TROTZDEM DA IST: die Eigenschaft steht nirgends geschrieben, sie faellt nur
 * daraus ab, dass `formCardSlotValue` den Farbtreffer als Faktor 2 einpreist statt als Bedingung zu
 * pruefen. Eine spaetere „Optimierung", die Karten nach Farbe vorfiltert, wuerde niemandem
 * auffallen — der Plan waere weiterhin plausibel, nur aermer. Der Test haelt die Regel fest.
 */
function slot(input: {
  matchdayIndex: number;
  disciplineId: string;
  color: "green" | "red" | null;
  playerCount: number;
  side?: "d1" | "d2";
}): FormCardSeasonPlanSlot {
  return {
    matchdayIndex: input.matchdayIndex,
    matchdayId: `matchday-${input.matchdayIndex}`,
    disciplineSide: input.side ?? "d1",
    disciplineId: input.disciplineId,
    color: input.color,
    playerCount: input.playerCount,
  };
}

describe("KI-Formkarten ohne Farbtreffer", () => {
  it("preist den Farbtreffer ein, statt ihn zu verlangen", () => {
    const rot: FormCardSeasonPlanCard = { id: "rot-8", value: 8, color: "red" };
    const gruen6 = slot({ matchdayIndex: 1, disciplineId: "gruen-gross", color: "green", playerCount: 6 });
    const rot2 = slot({ matchdayIndex: 1, disciplineId: "rot-klein", color: "red", playerCount: 2 });

    // 8 x 1 x 6 = 48 gegen 8 x 2 x 2 = 32: die groessere Disziplin schlaegt den Farbtreffer.
    expect(formCardSlotValue(rot, gruen6)).toBe(48);
    expect(formCardSlotValue(rot, rot2)).toBe(32);
    expect(formCardSlotValue(rot, gruen6)).toBeGreaterThan(formCardSlotValue(rot, rot2));
  });

  it("legt eine rote Karte in eine grüne Disziplin, wenn dort mehr herauskommt", () => {
    const plan = buildAiFormCardSeasonPlan({
      cards: [{ id: "rot-8", value: 8, color: "red" }],
      slots: [
        slot({ matchdayIndex: 1, disciplineId: "gruen-gross", color: "green", playerCount: 6 }),
        slot({ matchdayIndex: 1, disciplineId: "rot-klein", color: "red", playerCount: 2, side: "d2" }),
      ],
    });
    const eintrag = plan.entryByCardId.get("rot-8");
    expect(eintrag, "die Karte darf nicht liegen bleiben").toBeDefined();
    expect(eintrag!.slot.disciplineId).toBe("gruen-gross");
  });

  it("spielt eine rote Karte auch dann, wenn es überhaupt keine rote Disziplin gibt", () => {
    const plan = buildAiFormCardSeasonPlan({
      cards: [{ id: "rot-8", value: 8, color: "red" }],
      slots: [slot({ matchdayIndex: 1, disciplineId: "nur-gruen", color: "green", playerCount: 4 })],
    });
    expect(plan.entryByCardId.has("rot-8")).toBe(true);
    expect(plan.unplacedCardIds).not.toContain("rot-8");
  });

  it("nimmt den Farbtreffer, wenn sonst alles gleich ist", () => {
    const plan = buildAiFormCardSeasonPlan({
      cards: [{ id: "rot-8", value: 8, color: "red" }],
      slots: [
        slot({ matchdayIndex: 1, disciplineId: "gruen-4", color: "green", playerCount: 4 }),
        slot({ matchdayIndex: 1, disciplineId: "rot-4", color: "red", playerCount: 4, side: "d2" }),
      ],
    });
    expect(plan.entryByCardId.get("rot-8")!.slot.disciplineId).toBe("rot-4");
  });
});

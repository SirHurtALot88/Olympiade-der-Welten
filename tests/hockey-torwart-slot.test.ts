/**
 * HOCKEY-TORWART-SLOT — Chris' Ansage aus `docs/design/hockey-torwart-puck-tore-plan.md`
 * Abschnitt 3.4, wörtlich: „einer der spieler soll natürlich einen torwart slot haben und
 * entsprechend im tor stehen! außer im 2er spiel da gibts nur verteiger und angreifer".
 *
 * Zwei Dinge haelt dieser Test fest, beide Teil der Abnahme:
 *
 *  1. DEGRADATIONSREGEL: bei 3..6 Spielern erscheint genau EIN Torwart-Slot (an dritter
 *     Stelle, weil `buildGeneratedSlotRoles` auf `slice(0, slotCount)` klemmt), bei 2 Spielern
 *     KEINER.
 *  2. INVARIANTE: das Mittel aller Slot-Profile trifft die Disziplinmatrix weiter auf <=0,2 Pp
 *     — Chris' „in Summe mit den andren Slots wieder der Diszi Gewichtung entspricht" — und der
 *     Torwart selbst ist "sehr defensiv": sein health/awareness-Profil liegt klar ueber jeder
 *     Feldrolle und ueber der Basis-Matrix.
 */
import { describe, expect, it } from "vitest";

import { resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";
import { officialDisciplineWeightMatrix, playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";

const GOALTENDER_LABEL = "Goaltender";

function mittelwertProAttribut(rollen: ReturnType<typeof resolveSlotRolesForDiscipline>) {
  const mittel: Partial<Record<(typeof playerGeneratorAttributeKeys)[number], number>> = {};
  for (const attribut of playerGeneratorAttributeKeys) {
    mittel[attribut] =
      rollen.reduce((summe, rolle) => summe + (rolle.slotWeightProfile?.[attribut] ?? 0), 0) / rollen.length;
  }
  return mittel;
}

describe("Hockey-Torwart-Slot", () => {
  it("bei 2 Spielern gibt es KEINEN Torwart — Chris' ausdrueckliche Ausnahme", () => {
    const rollen = resolveSlotRolesForDiscipline("hockey", "Hockey", 2);
    expect(rollen).toHaveLength(2);
    expect(rollen.map((rolle) => rolle.label)).toEqual(["Power Forward", "Defensive Wall"]);
    expect(rollen.some((rolle) => rolle.label === GOALTENDER_LABEL)).toBe(false);
  });

  it.each([3, 4, 5, 6])("bei %i Spielern erscheint GENAU EIN Torwart-Slot, an dritter Stelle", (spielerzahl) => {
    const rollen = resolveSlotRolesForDiscipline("hockey", "Hockey", spielerzahl);
    expect(rollen).toHaveLength(spielerzahl);

    const torwartSlots = rollen.filter((rolle) => rolle.label === GOALTENDER_LABEL);
    expect(torwartSlots).toHaveLength(1);
    expect(rollen[2]?.label).toBe(GOALTENDER_LABEL);
  });

  it("Captain Line faellt bei 6 Spielern aus der Liste — der Torwart hat ihren Platz verdraengt", () => {
    // `buildGeneratedSlotRoles` klemmt auf `slice(0, 6)`; das siebte Thema (Captain Line) wird
    // nie ausgegeben, seit der Torwart an dritter Stelle steht (Plan 3.4, Punkt 1+2).
    const rollen = resolveSlotRolesForDiscipline("hockey", "Hockey", 6);
    expect(rollen.map((rolle) => rolle.label)).toEqual([
      "Power Forward",
      "Defensive Wall",
      "Goaltender",
      "Playmaker",
      "Transition Runner",
      "Slot Finisher",
    ]);
    expect(rollen.some((rolle) => rolle.label === "Captain Line")).toBe(false);
  });

  it.each([3, 4, 5, 6])(
    "der Torwart ist 'sehr defensiv': health und awareness klar ueber jeder Feldrolle und ueber der Basis-Matrix (n=%i)",
    (spielerzahl) => {
      const rollen = resolveSlotRolesForDiscipline("hockey", "Hockey", spielerzahl);
      const torwart = rollen.find((rolle) => rolle.label === GOALTENDER_LABEL);
      expect(torwart).toBeDefined();

      const basisHealth = officialDisciplineWeightMatrix.hockey.health ?? 0;
      const basisAwareness = officialDisciplineWeightMatrix.hockey.awareness ?? 0;
      const torwartHealth = torwart!.slotWeightProfile?.health ?? 0;
      const torwartAwareness = torwart!.slotWeightProfile?.awareness ?? 0;

      expect(torwartHealth).toBeGreaterThan(basisHealth);
      expect(torwartAwareness).toBeGreaterThan(basisAwareness);

      for (const feldrolle of rollen.filter((rolle) => rolle.label !== GOALTENDER_LABEL)) {
        expect(torwartHealth).toBeGreaterThan(feldrolle.slotWeightProfile?.health ?? 0);
        expect(torwartAwareness).toBeGreaterThanOrEqual(feldrolle.slotWeightProfile?.awareness ?? 0);
      }
    },
  );

  it.each([1, 2, 3, 4, 5, 6])(
    "das Mittel aller Slot-Profile trifft die Hockey-Matrix weiter auf <=0,2 Pp (n=%i)",
    (spielerzahl) => {
      const rollen = resolveSlotRolesForDiscipline("hockey", "Hockey", spielerzahl);
      const mittel = mittelwertProAttribut(rollen);

      for (const attribut of playerGeneratorAttributeKeys) {
        const basis = officialDisciplineWeightMatrix.hockey[attribut] ?? 0;
        const abweichung = Math.abs((mittel[attribut] ?? 0) - basis);
        expect(abweichung).toBeLessThanOrEqual(0.2);
      }
    },
  );
});

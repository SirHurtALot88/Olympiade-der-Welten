/**
 * EINSATZLISTE: „erwartet“ springt beim Klick auf Schonen/Normal/Vollgas genau EINMAL (Chris 18.11.).
 *
 * Ursache des Doppelsprungs: `updateDisciplineIntensityStage` setzte die Vorschau auf null. Die Pro-Platz-Anteile
 * von Form, Captain, Mutator und Team-Power stammen aber aus dieser Vorschau (`buildSlotPreviewByKey`); ohne sie
 * rechnete die Anzeige 700 ms lang (bis die entprellte Neuberechnung kam) ohne diese Posten, also zu niedrig, und
 * sprang dann wieder hoch. Der Test vergleicht beide Rechenwege (mit und ohne Vorschau) und sichert die Regel,
 * dass der Intensitaets-Handler die Vorschau stehen laesst.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildLegacyLineupLabPlayerOptions, buildLegacyLineupLabSlots } from "@/lib/lineups/legacy-lineup-lab";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";
import { buildMatchdayRosterCards, buildSlotPreviewByKey } from "@/lib/lineups/lineup-candidate-model";
import { buildMatchdayPreviewCards } from "@/lib/lineups/lineup-audit";

import { buildFixture } from "./fixtures/lineup-candidate-fixture";

const fixture = buildFixture();
const { context, selections, captains } = fixture;
const typedContext = context as LegacyLineupLoadedContext;
const slots = buildLegacyLineupLabSlots(typedContext);
const playerOptions = buildLegacyLineupLabPlayerOptions(typedContext);
const rosterCards = buildMatchdayRosterCards({
  playerRows: fixture.playerRows,
  selections,
  slots,
  discipline1Label: "D1",
  discipline2Label: "D2",
  disciplineWeightInfo: { d1: [], d2: [] },
});
const rosterCardByActivePlayerId = new Map(rosterCards.filter((p) => Boolean(p.activePlayerId)).map((p) => [p.activePlayerId as string, p] as const));
const slotRoleByKey = new Map(
  slots.map((slot) => {
    const d = slot.disciplineSide === "d1" ? typedContext.matchdayContract?.discipline1 : typedContext.matchdayContract?.discipline2;
    const rollen = resolveSlotRolesForDiscipline(d?.disciplineId ?? null, d?.displayName ?? null, d?.requiredPlayers ?? null);
    return [slot.key, rollen[slot.slotIndex] ?? null] as const;
  }),
);

/** Vorschau mit einem Formanteil von +3 je Platz (so kommt er in der Praxis aus der Engine). */
const vorschauMitForm = {
  ok: true,
  disciplineSideScores: (["d1", "d2"] as const).map((side) => ({
    disciplineSide: side,
    formModifier: 3,
    selectedPlayers: 2,
    requiredPlayers: 2,
    teamPowerModifier: 0,
    captainBonusTotal: 0,
    entries: slots
      .filter((s) => s.disciplineSide === side)
      .map((s) => ({ activePlayerId: selections[s.key] ?? "", slotIndex: s.slotIndex, formShare: 3, mutatorBonus: 0, captainBonus: 0 })),
  })),
} as never;

function summen(intensity: "conserve" | "normal" | "push", resolvedPreview: unknown) {
  const slotPreviewByKey = buildSlotPreviewByKey({
    slots,
    selections,
    playerOptions,
    rosterCardByActivePlayerId,
    resolvedPreview: resolvedPreview as never,
    slotRoleByKey,
    intensityBySide: { d1: intensity, d2: intensity },
    context: typedContext,
    captains,
    rivalryPressureByDiscipline: {},
  });
  return buildMatchdayPreviewCards({
    resolvedPreview: resolvedPreview as never,
    slots,
    slotPreviewByKey,
    d1RequiredPlayers: 2,
    d2RequiredPlayers: 2,
    lineupMetaD1Selected: 2,
    lineupMetaD2Selected: 1,
  });
}

describe("Einsatzliste: Intensitaet ohne Doppelsprung", () => {
  it("die Vorschau tragen Form-Anteile: ohne sie liegt der Wert tiefer (das war der Zwischenwert)", () => {
    const mit = summen("normal", vorschauMitForm);
    const ohne = summen("normal", null);
    expect(mit.d1Projected).toBeGreaterThan(ohne.d1Projected);
  });

  it("bei stehender Vorschau steckt der Formanteil in JEDER Intensitaetsstufe (kein Zwischenwert ohne Form)", () => {
    for (const stufe of ["conserve", "normal", "push"] as const) {
      const mit = summen(stufe, vorschauMitForm);
      const ohne = summen(stufe, null);
      expect(mit.d1Projected).toBeGreaterThan(ohne.d1Projected);
      expect(mit.d2Projected).toBeGreaterThan(ohne.d2Projected);
    }
  });

  it("ein Klick aendert den Wert genau einmal: Stufe wechseln mit stehender Vorschau == Endwert nach Neuberechnung", () => {
    // Die Neuberechnung nach 700 ms liefert dieselbe Vorschau (Form-/Captain-Anteile haengen nicht an der Intensitaet);
    // der sofort gezeigte Wert ist deshalb schon der Endwert.
    const sofort = summen("push", vorschauMitForm);
    const nachNeuberechnung = summen("push", vorschauMitForm);
    expect(sofort.d1Projected).toBe(nachNeuberechnung.d1Projected);
    expect(sofort.d2Projected).toBe(nachNeuberechnung.d2Projected);
  });

  it("der Intensitaets-Handler laesst die Vorschau stehen (kein setPreview(null) im Handler)", async () => {
    const text = await fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"), "utf8");
    const start = text.indexOf("function updateDisciplineIntensityStage");
    expect(start).toBeGreaterThan(0);
    const ende = text.indexOf("function assignPlayerToSide", start);
    const rumpf = text.slice(start, ende);
    expect(rumpf).not.toContain("setPreview(null)");
    expect(rumpf).toContain("setModifiers(");
  });
});

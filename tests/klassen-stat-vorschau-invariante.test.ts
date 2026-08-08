/**
 * T6 · Klassen-Stat-Vorschau (Chris: „kann man dort auch noch wenn man zb mage als klasse
 * auwählt ne stat vorschau bekommen welche sich dann verbessern?").
 *
 * Die Rechnung existierte schon: `estimateClassTrainingGains` berechnet die Beiträge pro
 * Attribut je Klasse — und summierte sie nur. Die Vorschau greift dieselben Summanden VOR
 * der Summierung ab (`attributeGains`), es gibt keine zweite Formel.
 *
 * DIE INVARIANTE dieses Tests: Die Summe der Einzelbeiträge IST der `estimatedGain`
 * (auf die Anzeigerundung genau). Bricht sie, laufen Anzeige („Mage verbessert
 * Intelligence/Will/…") und Gesamtwert („Mage ≈ +4,2 SP") auseinander — genau das
 * Muster-4-Loch, gegen das die Vorschau abgesichert sein muss.
 */
import { describe, expect, it } from "vitest";

import type { Player, PlayerGeneratorAttributeName, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import type { AttributeHeadroomState } from "@/lib/scouting/player-attribute-ceiling-service";
import { estimateClassTrainingGains } from "@/lib/training/class-training-gain-estimate";
import {
  getClassTrainingProfile,
  PROGRESSION_ATTRIBUTE_ORDER,
  PROGRESSION_CLASS_ORDER,
} from "@/lib/training/class-progression-config";

const baseAttrs: PlayerGeneratorAttributes = {
  power: 50,
  health: 50,
  stamina: 50,
  intelligence: 50,
  awareness: 50,
  determination: 50,
  speed: 50,
  dexterity: 50,
  charisma: 50,
  will: 50,
  spirit: 50,
  torment: 50,
};

function player(partial: Partial<Player> & { attributeSheetStats?: PlayerGeneratorAttributes } = {}): Player {
  return {
    id: partial.id ?? "p-1",
    name: partial.name ?? "Test Player",
    rating: partial.rating ?? 70,
    marketValue: partial.marketValue ?? 20,
    salaryDemand: partial.salaryDemand ?? 5,
    className: partial.className ?? "Charger",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "x",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats: partial.attributeSheetStats ?? baseAttrs,
    preferredDisciplineIds: [],
    disciplineRatings: partial.disciplineRatings ?? {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: partial.fatigue ?? 0,
    form: partial.form ?? 0,
    potential: partial.potential ?? 70,
    trainingMode: partial.trainingMode ?? "mittel",
    trainingClass: partial.trainingClass ?? null,
  } as Player;
}

const OPEN_CEILINGS: Partial<Record<PlayerGeneratorAttributeName, AttributeHeadroomState>> =
  Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((key) => [key, "open"]));

function roundTo1(value: number) {
  return Math.round(value * 10) / 10;
}

/** Die Szenarien decken alle Zweige der Attribut-Multiplikator-Wahl ab. */
const SCENARIOS = [
  {
    name: "offene Decken, Signature/Weak-Profil",
    input: () => ({
      player: player({ className: "Mage", attributeSheetStats: { ...baseAttrs, intelligence: 90, will: 88, torment: 5 } }),
      currentClassName: "Mage",
      trainingSetpoints: 10,
      ceilingStateByAttribute: OPEN_CEILINGS,
      adminBalancingConfig: null,
    }),
  },
  {
    name: "gemischte Decken (capped/closing)",
    input: () => ({
      player: player({ className: "Warlord" }),
      currentClassName: "Warlord",
      trainingSetpoints: 12.5,
      ceilingStateByAttribute: { ...OPEN_CEILINGS, power: "capped", health: "closing", charisma: "capped" } as Partial<
        Record<PlayerGeneratorAttributeName, AttributeHeadroomState>
      >,
      adminBalancingConfig: null,
    }),
  },
  {
    name: "echter Engine-Multiplikator pro Attribut (wie im View)",
    input: () => ({
      player: player({ className: "Rogue" }),
      currentClassName: "Rogue",
      trainingSetpoints: 8.4,
      ceilingStateByAttribute: OPEN_CEILINGS,
      engineTrainingMultiplierByAttribute: Object.fromEntries(
        PROGRESSION_ATTRIBUTE_ORDER.map((key, index) => [key, 0.35 + (index % 5) * 0.2]),
      ) as Partial<Record<PlayerGeneratorAttributeName, number>>,
      adminBalancingConfig: null,
    }),
  },
  {
    name: "Route-Bonus aktiv (Fokusachse POW)",
    input: () => ({
      player: player({ className: "Tank" }),
      currentClassName: "Rogue",
      trainingSetpoints: 10,
      ceilingStateByAttribute: OPEN_CEILINGS,
      adminBalancingConfig: null,
      trainingFocusAxis: "pow" as const,
    }),
  },
] as const;

describe("T6-Invariante: Summe der Attribut-Beiträge === estimatedGain", () => {
  it.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))("%s", (_name, scenario) => {
    const results = estimateClassTrainingGains(scenario.input());
    expect(results).toHaveLength(PROGRESSION_CLASS_ORDER.length);
    for (const result of results) {
      const sum = result.attributeGains.reduce((total, entry) => total + entry.gain, 0);
      // Auf Anzeigerundung genau: estimatedGain wird aus exakt dieser Summe gerundet.
      expect(roundTo1(sum), `${result.className}: Σ Beiträge weicht vom estimatedGain ab`).toBe(result.estimatedGain);
    }
  });

  it("nur Attribute mit positivem Klassengewicht tauchen auf — negative Gewichte heißen: trainiert nicht", () => {
    const results = estimateClassTrainingGains(SCENARIOS[0].input());
    for (const result of results) {
      const profile = getClassTrainingProfile(result.className, null);
      for (const entry of result.attributeGains) {
        expect(profile[entry.attribute], `${result.className}/${entry.attribute}`).toBeGreaterThan(0);
      }
      // Gegenprobe: kein positiv gewichtetes Attribut fehlt.
      const listed = new Set(result.attributeGains.map((entry) => entry.attribute));
      for (const key of PROGRESSION_ATTRIBUTE_ORDER) {
        if (profile[key] > 0) {
          expect(listed.has(key), `${result.className}: ${key} fehlt in der Vorschau`).toBe(true);
        }
      }
    }
    // Konkret (Chris' Beispiel): Mage trainiert kein Speed (Gewicht −0,35).
    const mage = results.find((result) => result.className === "Mage")!;
    expect(mage.attributeGains.some((entry) => entry.attribute === "speed")).toBe(false);
    expect(mage.attributeGains.some((entry) => entry.attribute === "intelligence")).toBe(true);
  });

  it("die Beiträge sind absteigend sortiert — die UI zeigt die Top-Attribute zuerst", () => {
    for (const scenario of SCENARIOS) {
      for (const result of estimateClassTrainingGains(scenario.input())) {
        for (let index = 1; index < result.attributeGains.length; index += 1) {
          expect(result.attributeGains[index - 1]!.gain).toBeGreaterThanOrEqual(result.attributeGains[index]!.gain);
        }
      }
    }
  });

  it("bei leerem Budget bleibt die Vorschau leer statt erfundener Zahlen", () => {
    const results = estimateClassTrainingGains({
      player: player({ className: "Hero" }),
      currentClassName: "Hero",
      trainingSetpoints: 0,
      ceilingStateByAttribute: OPEN_CEILINGS,
      adminBalancingConfig: null,
    });
    for (const result of results) {
      expect(result.estimatedGain).toBe(0);
      expect(result.attributeGains).toHaveLength(0);
    }
  });
});

describe("Die UI-Rangliste reicht die Beiträge 1:1 durch (keine zweite Quelle)", () => {
  it("buildTrainingClassGainRanking übernimmt attributeGains unverändert aus dem Service", () => {
    // Statische Absicherung: der Adapter darf die Beiträge nur durchreichen,
    // nie neu berechnen — sonst gäbe es zwei Formeln für dieselbe Vorschau.
    const shared = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "app/foundation/training-facilities-v2/training-view-shared.tsx"),
      "utf8",
    ) as string;
    expect(shared).toContain("attributeGains: gain?.attributeGains ?? []");
  });
});

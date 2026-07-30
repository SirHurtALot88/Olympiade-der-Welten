import { describe, expect, it } from "vitest";

import {
  buildAiFormCardSeasonPlan,
  formCardSlotValue,
  getPlannedCardIdsForSlot,
  getPlannedClaimValue,
  type FormCardSeasonPlanCard,
  type FormCardSeasonPlanSlot,
} from "@/lib/ai/ai-form-card-season-plan";
import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

function slot(
  matchdayIndex: number,
  disciplineSide: "d1" | "d2",
  playerCount: number | null,
  color: FormCardSeasonPlanSlot["color"],
  disciplineId = `disc-${matchdayIndex}-${disciplineSide}`,
): FormCardSeasonPlanSlot {
  return {
    matchdayIndex,
    matchdayId: `matchday-${matchdayIndex}`,
    disciplineSide,
    disciplineId,
    color,
    playerCount,
  };
}

function card(id: string, value: number, color: FormCardSeasonPlanCard["color"]): FormCardSeasonPlanCard {
  return { id, value, color };
}

/** Wo hat der Plan diese Karte hingelegt? — als kompakter, lesbarer Vergleichswert. */
function placementOf(plan: ReturnType<typeof buildAiFormCardSeasonPlan>, cardId: string) {
  const entry = plan.entryByCardId.get(cardId);
  if (!entry) return null;
  return `MD${entry.slot.matchdayIndex}/${entry.slot.disciplineSide}/${entry.role}`;
}

describe("KI-Saisonplanung der Formkarten", () => {
  it("legt die dicke Karte in die grosse farbgleiche Disziplin statt in die kleine von heute", () => {
    // Chris' Ausgangsfall: eine starke Karte am ersten Spieltag in einer kleinen Disziplin
    // verheizt — obwohl vier Spieltage spaeter eine 6er-Disziplin derselben Farbe ansteht.
    const plan = buildAiFormCardSeasonPlan({
      cards: [card("rot-8", 8, "red")],
      slots: [
        slot(1, "d1", 2, "red"), // heute, klein: 8 x 2 x 2 = 32
        slot(1, "d2", 3, "green"),
        slot(5, "d1", 6, "red"), // spaeter, gross + farbgleich: 8 x 2 x 6 = 96
        slot(5, "d2", 4, "blue"),
      ],
    });

    expect(placementOf(plan, "rot-8")).toBe("MD5/d1/primary");
    expect(plan.expectedTotalFormModifier).toBe(96);
  });

  it("laesst zwei starke Karten NICHT um denselben Slot konkurrieren", () => {
    // Der eigentliche Konstruktionsfehler der alten Heuristik: jede Karte wurde einzeln gegen
    // den besten kommenden Slot bewertet, also reklamierten beide Achten denselben 6er.
    // Der Plan vergibt den Slot genau einmal.
    const plan = buildAiFormCardSeasonPlan({
      cards: [card("rot-8", 8, "red"), card("gruen-8", 8, "green")],
      slots: [
        slot(3, "d1", 6, "red"), // rot: 8x2x6 = 96 | gruen: 8x1x6 = 48
        slot(3, "d2", 6, "green"), // gruen: 96 | rot: 48
        slot(4, "d1", 2, "blue"),
      ],
    });

    // Frueher nahm die erste Seite beide Achten mit (96 + 48 = 144) und die farbgleiche
    // Disziplin daneben ging leer aus. Jeder Slot wird jetzt genau einmal vergeben: 96 + 96.
    expect(placementOf(plan, "rot-8")).toBe("MD3/d1/primary");
    expect(placementOf(plan, "gruen-8")).toBe("MD3/d2/primary");
    expect(plan.expectedTotalFormModifier).toBe(192);
  });

  it("versteckt die groesste Minuskarte im billigsten Slot statt in der grossen Disziplin", () => {
    // Minuskarten MUESSEN gespielt werden (sonst Punktabzug am Saisonende). Der Schaden
    // skaliert genauso mit Kadergroesse und Farbe wie der Bonus — die dickste Minuskarte
    // gehoert deshalb in die kleinste, farbfremde Disziplin.
    const plan = buildAiFormCardSeasonPlan({
      cards: [card("rot-minus-8", -8, "red"), card("rot-minus-2", -2, "red")],
      slots: [
        slot(1, "d1", 2, "green"), // -8 hier: -8 x 1 x 2 = -16
        slot(1, "d2", 6, "red"), // -2 hier: -2 x 2 x 6 = -24
      ],
    });

    expect(placementOf(plan, "rot-minus-8")).toBe("MD1/d1/primary");
    expect(placementOf(plan, "rot-minus-2")).toBe("MD1/d2/primary");
    // Die umgekehrte Zuordnung waere -8x2x6 = -96 plus -2x1x2 = -4, also -100 statt -40.
    expect(plan.expectedTotalFormModifier).toBe(-40);
  });

  it("zieht einen starken Sekundaerplatz einem schwachen Primaerplatz vor", () => {
    // Die Rolle ist kein Rang: neben der 8 in der farbgleichen 6er-Disziplin ist der
    // Sekundaerplatz 84 wert, der freie 3er-Primaerplatz nur 21.
    const plan = buildAiFormCardSeasonPlan({
      cards: [card("rot-8", 8, "red"), card("rot-7", 7, "red")],
      slots: [
        slot(6, "d1", 6, "red"), // primaer 96, sekundaer 84
        slot(7, "d2", 3, "blue"), // 7 x 1 x 3 = 21
      ],
    });

    expect(placementOf(plan, "rot-8")).toBe("MD6/d1/primary");
    expect(placementOf(plan, "rot-7")).toBe("MD6/d1/secondary");
    expect(plan.expectedTotalFormModifier).toBe(180);
  });

  it("erlaubt eine Pluskarte neben einer Minuskarte, wenn die Primaerplaetze knapp sind", () => {
    // Jeder Spieler erzeugt eine Plus- UND eine Minuskarte; alle Minuskarten muessen fallen.
    // Ohne die Paarung auf einer Seite bliebe die Pluskarte ungespielt.
    const plan = buildAiFormCardSeasonPlan({
      cards: [card("minus-4", -4, "blue"), card("plus-8", 8, "red")],
      slots: [slot(9, "d1", 5, "red")],
    });

    expect(placementOf(plan, "minus-4")).toBe("MD9/d1/primary");
    expect(placementOf(plan, "plus-8")).toBe("MD9/d1/secondary");
    expect(plan.unplacedCardIds).toEqual([]);
  });

  it("meldet Karten ohne Platz als ungeplant statt sie still zu verschlucken", () => {
    const plan = buildAiFormCardSeasonPlan({
      cards: [card("minus-8", -8, "red"), card("minus-4", -4, "red"), card("minus-2", -2, "red")],
      slots: [slot(10, "d1", 4, "green")],
    });

    // Ein Slot, eine Primaerkarte — Minuskarten duerfen nicht auf den Sekundaerplatz.
    expect(plan.entryByCardId.size).toBe(1);
    expect(plan.unplacedCardIds).toEqual(["minus-2", "minus-4"]);
  });

  it("rechnet mit einer unbekannten Kadergroesse als 4 statt als 0", () => {
    // "Nichts erfinden" heisst hier NICHT "0 annehmen": mit 0 waere jeder Einsatz wertlos und
    // alle Karten wuerden in den unbekannten Slot gespuelt.
    const unknown = slot(2, "d1", null, null);
    expect(formCardSlotValue(card("x", 8, "red"), unknown)).toBe(32);
  });

  it("ist deterministisch und unabhaengig von der Reihenfolge der Eingabe", () => {
    const cards = [card("a-8", 8, "red"), card("b-4", 4, "green"), card("c-minus-8", -8, "blue")];
    const slots = [slot(1, "d1", 6, "red"), slot(2, "d2", 2, "yellow"), slot(3, "d1", 4, "green")];

    const first = buildAiFormCardSeasonPlan({ cards, slots });
    const second = buildAiFormCardSeasonPlan({ cards: [...cards].reverse(), slots: [...slots].reverse() });

    for (const entry of cards) {
      expect(placementOf(second, entry.id)).toBe(placementOf(first, entry.id));
    }
    expect(second.expectedTotalFormModifier).toBe(first.expectedTotalFormModifier);
  });

  it("zinst den Anspruch einer Karte auf spaetere Spieltage ab und meldet ungeplante mit null", () => {
    const plan = buildAiFormCardSeasonPlan({
      cards: [card("rot-8", 8, "red")],
      slots: [slot(5, "d1", 6, "red")],
    });

    // Am Spieltag des Plans zaehlt der volle Wert ...
    expect(getPlannedClaimValue({ plan, cardId: "rot-8", currentMatchdayIndex: 5 })).toBe(96);
    // ... zwei Spieltage vorher weniger (0.93^2), damit ferne Traum-Slots nicht ewig blockieren.
    expect(getPlannedClaimValue({ plan, cardId: "rot-8", currentMatchdayIndex: 3 })).toBeCloseTo(96 * 0.93 ** 2, 6);
    // Eine Karte ohne Planplatz hat keinen Anspruch — sie darf sofort fallen.
    expect(getPlannedClaimValue({ plan, cardId: "gibt-es-nicht", currentMatchdayIndex: 3 })).toBeNull();
  });

  it("liefert die geplanten Karten je Seite und Rolle", () => {
    const plan = buildAiFormCardSeasonPlan({
      cards: [card("rot-8", 8, "red"), card("rot-4", 4, "red")],
      slots: [slot(2, "d2", 6, "red")],
    });

    expect(getPlannedCardIdsForSlot(plan, 2, "d2")).toEqual(new Set(["rot-8", "rot-4"]));
    expect(getPlannedCardIdsForSlot(plan, 2, "d2", "primary")).toEqual(new Set(["rot-8"]));
    expect(getPlannedCardIdsForSlot(plan, 2, "d2", "secondary")).toEqual(new Set(["rot-4"]));
    expect(getPlannedCardIdsForSlot(plan, 2, "d1")).toEqual(new Set());
  });
});

// --- Durchgriff auf die Aufstellungs-KI ------------------------------------------------------

function buildContextWithSchedule(input: {
  matchdayIndex: number;
  formCards: NonNullable<LegacyLineupLoadedContext["formCards"]>;
  schedule: Array<{ index: number; d1: [number, string]; d2: [number, string] }>;
}): LegacyLineupLoadedContext {
  const current = input.schedule.find((entry) => entry.index === input.matchdayIndex)!;
  const disciplineId = (index: number, side: "d1" | "d2") => `disc-${index}-${side}`;

  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: `matchday-${input.matchdayIndex}`,
    teamId: "A-A",
    entries: [],
    disciplinePlayerCounts: {},
    activePlayers: [],
    rosterPlayers: [],
    formCards: input.formCards,
    matchday: { index: input.matchdayIndex },
    season: { currentMatchday: input.matchdayIndex },
    seasonDisciplineSchedule: input.schedule.map((entry) => ({
      seasonId: "season-1",
      matchdayId: `matchday-${entry.index}`,
      matchdayIndex: entry.index,
      matchdayLabel: `MD${entry.index}`,
      discipline1: {
        disciplineId: disciplineId(entry.index, "d1"),
        displayName: "D1",
        order: entry.index,
        playerCount: entry.d1[0],
        category: entry.d1[1],
      },
      discipline2: {
        disciplineId: disciplineId(entry.index, "d2"),
        displayName: "D2",
        order: entry.index,
        playerCount: entry.d2[0],
        category: entry.d2[1],
      },
      sourceStatus: "season_seed",
      sourceNote: null,
    })),
    // Beide Seiten klar konkurrenzfaehig, damit die Wettbewerbslogik nichts blockiert und
    // wirklich die Kartenplanung gemessen wird.
    teamDisciplineRanks: {
      [disciplineId(input.matchdayIndex, "d1")]: { disciplineId: disciplineId(input.matchdayIndex, "d1"), teamId: "A-A", rank: 6, score: 420 },
      [disciplineId(input.matchdayIndex, "d2")]: { disciplineId: disciplineId(input.matchdayIndex, "d2"), teamId: "A-A", rank: 6, score: 420 },
    },
    disciplineScores: [
      { playerId: "p1", disciplineId: disciplineId(input.matchdayIndex, "d1"), score: 84 },
      { playerId: "p2", disciplineId: disciplineId(input.matchdayIndex, "d2"), score: 84 },
    ],
    matchdayContract: {
      matchdayId: `matchday-${input.matchdayIndex}`,
      matchdayLabel: `MD${input.matchdayIndex}`,
      matchdayIndex: input.matchdayIndex,
      discipline1: {
        disciplineId: disciplineId(input.matchdayIndex, "d1"),
        displayName: "D1",
        requiredPlayers: current.d1[0],
        requiredCaptains: 0,
        category: current.d1[1],
        rankSource: null,
        rankSourceStatus: "mapped",
        sourceStatus: "season_seed",
        disciplineSide: "d1",
      },
      discipline2: {
        disciplineId: disciplineId(input.matchdayIndex, "d2"),
        displayName: "D2",
        requiredPlayers: current.d2[0],
        requiredCaptains: 0,
        category: current.d2[1],
        rankSource: null,
        rankSourceStatus: "mapped",
        sourceStatus: "season_seed",
        disciplineSide: "d2",
      },
      seasonCaptainSlots: 0,
      totalDisciplineSidesInSeason: 20,
    },
  } as unknown as LegacyLineupLoadedContext;
}

describe("Aufstellungs-KI folgt der Saisonplanung", () => {
  const SCHEDULE = [
    { index: 1, d1: [2, "power"] as [number, string], d2: [3, "speed"] as [number, string] },
    { index: 2, d1: [4, "mental"] as [number, string], d2: [4, "social"] as [number, string] },
    { index: 3, d1: [6, "power"] as [number, string], d2: [6, "speed"] as [number, string] },
  ];

  const entriesFor = (matchdayIndex: number) => [
    { disciplineId: `disc-${matchdayIndex}-d1`, disciplineSide: "d1" as const, slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
    { disciplineId: `disc-${matchdayIndex}-d2`, disciplineSide: "d2" as const, slotIndex: 0, playerId: "p2", activePlayerId: "a2" },
  ];

  it("spielt die starke Karte NICHT am ersten Spieltag in der kleinen Disziplin", () => {
    // Spieltag 1 ist eine 2er-Disziplin (rot): die rote 8 braechte dort 8x2x2 = 32.
    // Spieltag 3 bietet dieselbe Farbe in einer 6er-Disziplin: 8x2x6 = 96.
    const modifiers = buildAiLegacyLineupModifiers(
      buildContextWithSchedule({
        matchdayIndex: 1,
        schedule: SCHEDULE,
        formCards: [
          { id: "rot-8", playerId: "p1", playerName: "P1", color: "red", value: 8, isUsed: false, usedByLineupId: null },
        ],
      }),
      entriesFor(1),
    );

    expect(modifiers.d1.primaryFormCardId).toBeNull();
    expect(modifiers.d1.secondaryFormCardId).toBeNull();
    expect(modifiers.d2.primaryFormCardId).toBeNull();
  });

  it("spielt dieselbe Karte am grossen farbgleichen Spieltag aus", () => {
    const modifiers = buildAiLegacyLineupModifiers(
      buildContextWithSchedule({
        matchdayIndex: 3,
        schedule: SCHEDULE,
        formCards: [
          { id: "rot-8", playerId: "p1", playerName: "P1", color: "red", value: 8, isUsed: false, usedByLineupId: null },
        ],
      }),
      entriesFor(3),
    );

    expect(modifiers.d1.primaryFormCardId).toBe("rot-8");
  });

  it("verteilt zwei starke Karten farbrichtig auf BEIDE Seiten desselben Spieltags", () => {
    // Der teuerste Einzelfehler der alten Heuristik: d1 griff zuerst zu und nahm beide Karten
    // mit, die gruene 8 landete auf der roten 6er-Disziplin (48 statt 96) und die gruene
    // 6er-Disziplin daneben ging leer aus.
    const modifiers = buildAiLegacyLineupModifiers(
      buildContextWithSchedule({
        matchdayIndex: 3,
        schedule: SCHEDULE,
        formCards: [
          { id: "rot-8", playerId: "p1", playerName: "P1", color: "red", value: 8, isUsed: false, usedByLineupId: null },
          { id: "gruen-8", playerId: "p2", playerName: "P2", color: "green", value: 8, isUsed: false, usedByLineupId: null },
        ],
      }),
      entriesFor(3),
    );

    expect(modifiers.d1.primaryFormCardId).toBe("rot-8");
    expect(modifiers.d2.primaryFormCardId).toBe("gruen-8");
  });

  it("opfert auf einer schwachen Seite die BILLIGSTE Minuskarte statt der dicksten", () => {
    // Auf einer schwachen Seite wird weiter entsorgt (jede frueh abgeladene Minuskarte macht
    // spaeter einen Primaerplatz fuer eine Pluskarte frei). Geaendert hat sich, WELCHE faellt:
    // frueher griff `takeDumpNegativeFormCard` zur groessten Karte — hier waere das die gruene
    // -8 in einer farbgleichen 6er-Disziplin, also -8x2x6 = -96. Der Plan haelt die dicke Karte
    // fuer ihr Versteck zurueck und opfert die -2 (-2x2x6 = -24).
    const schedule = [
      { index: 1, d1: [6, "speed"] as [number, string], d2: [6, "power"] as [number, string] },
      { index: 2, d1: [2, "mental"] as [number, string], d2: [2, "social"] as [number, string] },
    ];
    const context = buildContextWithSchedule({
      matchdayIndex: 1,
      schedule,
      formCards: [
        { id: "gruen-minus-8", playerId: "p1", playerName: "P1", color: "green", value: -8, isUsed: false, usedByLineupId: null },
        { id: "gruen-minus-2", playerId: "p2", playerName: "P2", color: "green", value: -2, isUsed: false, usedByLineupId: null },
      ],
    });
    // d1 (gruene 6er-Disziplin) ist die schwache Seite, d2 bleibt konkurrenzfaehig.
    context.teamDisciplineRanks = {
      "disc-1-d1": { disciplineId: "disc-1-d1", teamId: "A-A", rank: 28, score: 300 },
      "disc-1-d2": { disciplineId: "disc-1-d2", teamId: "A-A", rank: 6, score: 420 },
    } as typeof context.teamDisciplineRanks;
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "disc-1-d1", score: 60 },
      { playerId: "p2", disciplineId: "disc-1-d2", score: 84 },
    ] as typeof context.disciplineScores;

    const modifiers = buildAiLegacyLineupModifiers(context, entriesFor(1));

    expect(modifiers.d1.primaryFormCardId).toBe("gruen-minus-2");
  });
});

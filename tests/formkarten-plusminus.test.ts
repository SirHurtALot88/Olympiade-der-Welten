/**
 * FORMKARTEN PLUS/MINUS (22.11., Schalter OLY_FORMKARTEN_PLUSMINUS, Standard AUS).
 * Konzept: docs/design/formkarten-plusminus-22-11.md.
 *  - Schalter aus: Werte, Zerlegung und Regelstand bit-identisch zu vorher (kein `gegen`-Feld, keine 0er-Aenderung).
 *  - Schalter an: Spieler der Gegenfarbe tragen den spiegelbildlichen Anteil; Karten ohne 0.
 *  - Gezeigt = gebucht: Einsatzliste (berechneKartenWirkung), Arena-Adapter und Legacy-Funktion rechnen dieselbe Zahl.
 *  - KI-Plan deterministisch, Duell-Gewicht verschiebt den Slot, nie ohne Schalter.
 */
import { afterEach, describe, expect, it } from "vitest";

import { buildAiFormCardSeasonPlan, duellGewicht, formCardSlotValue } from "@/lib/ai/ai-form-card-season-plan";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import {
  FARBREGEL_PM,
  FARBREGEL_PM_PLUSMINUS,
  GEGENFARBE,
  formkartenHinweis,
  formkartenZerlegungFuerSpieler,
  isFormkartenPlusMinusEnabled,
  kartenWertFuerSpieler,
} from "@/lib/lineups/formkarten-farbregel";
import { berechneKartenWirkung, kartenEffekt, kartenEffektText } from "@/lib/lineups/formkarten-wirkung";
import { vergleichAuswahl } from "@/app/foundation/legacy-lineup-lab/FormMoralBausteine";
import {
  buildGeneratedFormCardRecordsForTeam,
  computePositiveFormCardValueForTests,
  getTeamFormCardOptions,
} from "@/lib/lineups/legacy-lineup-modifiers";
import { farbregelAusRegeln, resolveFormMoralRegeln } from "@/lib/morale/form-moral-regeln";

const SPIELER = [
  { id: "kati", name: "Kati", className: "Bard" },
  { id: "ferdinand", name: "Ferdinand Lionfist", className: "Warlord" },
  { id: "wildfire", name: "Wildfire", className: "Tactician" },
  { id: "dusk", name: "Duskwhisper", className: "Mage" },
];

function spielstand(wert: number, farbe: string, aufgestellt: string[]) {
  return {
    scenarioMeta: { gameMode: "battle" },
    players: SPIELER,
    rosters: SPIELER.map((s) => ({ id: `roster-${s.id}`, teamId: "t1", playerId: s.id })),
    disciplines: [{ id: "battlefield", name: "battlefield", category: "social" }],
    seasonState: {
      formCards: [{ id: "fc", saveId: "s1", seasonId: "season-1", teamId: "t1", playerId: "dusk", playerName: "Duskwhisper", cardColor: farbe, cardValue: wert, createdAt: "x" }],
      formCardPlans: [],
      lineupDrafts: [
        {
          lineupId: "l1", saveId: "s1", seasonId: "season-1", matchdayId: "md-1", teamId: "t1", status: "draft",
          modifiers: { d2: { primaryFormCardId: "fc", secondaryFormCardId: null, intensity: "normal" } },
          entries: aufgestellt.map((id, i) => ({ disciplineId: "battlefield", disciplineSide: "d2", slotIndex: i, playerId: id, activePlayerId: `roster-${id}` })),
        },
      ],
    },
  } as unknown as GameState;
}

function wirkung(gs: GameState, aufgestellt: string[], regeln?: ReturnType<typeof resolveFormMoralRegeln>) {
  return berechneKartenWirkung({
    gameState: gs, side: "d2", disciplineId: "battlefield", disciplineCategory: "social",
    formCards: getTeamFormCardOptions({ gameState: gs, seasonId: "season-1", teamId: "t1", lineupId: "l1" }),
    primaryCardId: "fc", secondaryCardId: null, playerIds: aufgestellt, regeln,
  });
}

afterEach(() => { delete process.env.OLY_FORMKARTEN_PLUSMINUS; });

describe("Plus/Minus: Schalter aus = unveraendert", () => {
  it("Standard AUS, nur 1/an/on/true schalten ein", () => {
    expect(isFormkartenPlusMinusEnabled({})).toBe(false);
    expect(isFormkartenPlusMinusEnabled({ OLY_FORMKARTEN_PLUSMINUS: "0" })).toBe(false);
    expect(isFormkartenPlusMinusEnabled({ OLY_FORMKARTEN_PLUSMINUS: "1" })).toBe(true);
  });

  it("ohne Gegenfarb-Faktor keine Aenderung und kein neues Feld in der Zerlegung", () => {
    const z = formkartenZerlegungFuerSpieler({ karten: [{ wert: 8, farbe: "red" }], disziplinFarbe: "blue", spielerFarbe: "blue", regel: FARBREGEL_PM });
    expect(z).toEqual({ alle: 4, traeger: 0, form: 0, summe: 4, istTraeger: false });
    expect("gegen" in z).toBe(false);
  });

  it("Regelstand ohne Schalter hat kein plusMinus-Feld", () => {
    expect(resolveFormMoralRegeln({})).not.toHaveProperty("plusMinus");
    expect(farbregelAusRegeln(resolveFormMoralRegeln({}))).toBe(FARBREGEL_PM);
  });

  it("Kartenwerte ohne Schalter weiter mit 0 (Bestand der Saves)", () => {
    const werte = new Set<number>();
    for (let i = 0; i < 400; i++) werte.add(computePositiveFormCardValueForTests("s", "season-1", "t", `p${i}`));
    expect([...werte].sort((a, b) => a - b)).toEqual([0, 2, 4, 8]);
  });
});

describe("Plus/Minus: Schalter an", () => {
  it("Regelstand traegt plusMinus und liefert die Gegenfarb-Regel", () => {
    const r = resolveFormMoralRegeln({ OLY_FORMKARTEN_PLUSMINUS: "1" });
    expect(r.plusMinus).toBe(true);
    expect(farbregelAusRegeln(r)).toBe(FARBREGEL_PM_PLUSMINUS);
    expect(resolveFormMoralRegeln({ OLY_FORMKARTEN_PLUSMINUS: "1", OLY_FORMKARTEN_FARBREGEL: "alt" })).not.toHaveProperty("plusMinus");
  });

  it("Gegenfarben sind paarweise gespiegelt", () => {
    for (const [a, b] of Object.entries(GEGENFARBE)) expect(GEGENFARBE[b]).toBe(a);
  });

  it("Pluskarte kostet die Gegenfarbe, Minuskarte bringt ihr etwas (v x 0,25)", () => {
    const plus = { wert: 8, farbe: "red" };
    expect(kartenWertFuerSpieler({ karte: plus, disziplinFarbe: "blue", spielerFarbe: "blue", regel: FARBREGEL_PM_PLUSMINUS })).toBe(4 - 2);
    expect(kartenWertFuerSpieler({ karte: plus, disziplinFarbe: "blue", spielerFarbe: "green", regel: FARBREGEL_PM_PLUSMINUS })).toBe(4);
    expect(kartenWertFuerSpieler({ karte: plus, disziplinFarbe: "blue", spielerFarbe: "red", regel: FARBREGEL_PM_PLUSMINUS })).toBe(8);
    const minus = { wert: -8, farbe: "red" };
    expect(kartenWertFuerSpieler({ karte: minus, disziplinFarbe: "blue", spielerFarbe: "blue", regel: FARBREGEL_PM_PLUSMINUS })).toBe(-4 + 2);
  });

  it("Zerlegung nennt den Gegenfarb-Anteil getrennt und summiert ihn ein", () => {
    const z = formkartenZerlegungFuerSpieler({ karten: [{ wert: 8, farbe: "red" }], disziplinFarbe: "blue", spielerFarbe: "blue", regel: FARBREGEL_PM_PLUSMINUS });
    expect(z).toMatchObject({ alle: 4, traeger: 0, gegen: -2, summe: 2 });
  });

  it("Hinweis und Effekttext nennen den Abzug", () => {
    expect(formkartenHinweis({ karte: { wert: 8, farbe: "red" }, disziplinFarbe: "blue", traegerAnzahl: 1, regel: FARBREGEL_PM_PLUSMINUS })).toContain("-2 für Spieler der Gegenfarbe");
    process.env.OLY_FORMKARTEN_PLUSMINUS = "1";
    expect(kartenEffekt({ value: 8, color: "red" }, "blue").gegenZusatz).toBe(-2);
    expect(kartenEffektText({ value: 8, color: "red" }, "blue")).toContain("-2 für MEN-Spieler");
  });

  it("Karten ohne 0: jeder Wert aus [2,3,5,8], je Spieler zwei echte Karten", () => {
    process.env.OLY_FORMKARTEN_PLUSMINUS = "1";
    const werte = new Set<number>();
    for (let i = 0; i < 400; i++) werte.add(computePositiveFormCardValueForTests("s", "season-1", "t", `p${i}`));
    expect([...werte].sort((a, b) => a - b)).toEqual([2, 3, 5, 8]);
    const gs = { players: [{ id: "a", name: "A", className: "Mage" }], rosters: [{ id: "r", teamId: "t", playerId: "a" }], teams: [{ teamId: "t" }] } as unknown as GameState;
    const karten = buildGeneratedFormCardRecordsForTeam(gs, "s", "season-1", "t");
    expect(karten).toHaveLength(2);
    expect(karten.every((k) => k.cardValue !== 0)).toBe(true);
    expect(karten.some((k) => k.cardValue < 0) && karten.some((k) => k.cardValue > 0)).toBe(true);
  });

  for (const [wert, farbe] of [[8, "red"], [-4, "red"], [8, "blue"]] as const) {
    it(`gezeigt = gebucht (Einsatzliste = Arena-Adapter) fuer Karte ${wert} ${farbe}`, () => {
      process.env.OLY_FORMKARTEN_PLUSMINUS = "1";
      const aufgestellt = ["kati", "ferdinand", "wildfire", "dusk"];
      const gs = spielstand(wert, farbe, aufgestellt);
      const w = wirkung(gs, aufgestellt, resolveFormMoralRegeln({ OLY_FORMKARTEN_PLUSMINUS: "1" }));
      const motor = buildArenaAufstellung(gs, "t1", "md-1");
      for (const s of w.spieler) {
        const name = SPIELER.find((x) => x.id === s.playerId)!.name;
        expect(motor[name]).toMatchObject({ form: s.zerlegung.summe });
      }
      if (farbe === "red") {
        const dusk = w.spieler.find((s) => s.playerId === "dusk")!;
        expect(dusk.zerlegung.gegen).toBe(-wert * 0.25);
        expect(dusk.farbGrund).toContain("Gegenfarbe");
      }
    });
  }

  it("Vergleichsliste kappt nicht mehr die Minuskarten", () => {
    const liste = [9, 8, 7, 6, 5, 4, 3, 2, 1, -1, -2, -3, -4].map((teamSumme) => ({ teamSumme }));
    const sicht = vergleichAuswahl(liste);
    expect(sicht).toHaveLength(8);
    expect(sicht.filter((v) => v.teamSumme < 0).map((v) => v.teamSumme)).toEqual([-2, -3, -4]);
  });
});

describe("Plus/Minus: KI-Plan", () => {
  const karte = { id: "k", value: 8, color: "red" as const };
  const slot = (matchdayIndex: number, color: "red" | "blue" | null, gewicht?: number) => ({
    matchdayIndex, matchdayId: `m${matchdayIndex}`, disciplineSide: "d1" as const, disciplineId: `d${matchdayIndex}`, color, playerCount: 4,
    ...(gewicht != null ? { gewicht } : {}),
  });

  it("Gewicht 1 / fehlend aendert den Slot-Wert nicht", () => {
    expect(formCardSlotValue(karte, { ...slot(1, "blue"), farbregel: FARBREGEL_PM })).toBe(formCardSlotValue(karte, { ...slot(1, "blue", 1), farbregel: FARBREGEL_PM }));
  });

  it("Gegenfarbe wird eingepreist: Team mit vielen MEN-Spielern entwertet die rote Karte", () => {
    const viele = { ...slot(1, "blue"), farbregel: FARBREGEL_PM_PLUSMINUS, farbAnteile: { blue: 0.6 } };
    const wenige = { ...slot(1, "blue"), farbregel: FARBREGEL_PM_PLUSMINUS, farbAnteile: { blue: 0 } };
    expect(formCardSlotValue(karte, viele)).toBeLessThan(formCardSlotValue(karte, wenige));
  });

  it("Duell-Gewicht: knapp > klar vorn > klar hinten, Rivalen zaehlen bis +0,2", () => {
    expect(duellGewicht({ competitiveness: "neutral", rivalryCount: 0 })).toBe(1.25);
    expect(duellGewicht({ competitiveness: "strong", rivalryCount: 0 })).toBe(1);
    expect(duellGewicht({ competitiveness: "weak", rivalryCount: 0 })).toBe(0.8);
    expect(duellGewicht({ competitiveness: "neutral", rivalryCount: 5 })).toBe(1.45);
  });

  it("Pluskarte geht auf den schweren Slot, Minuskarte dorthin, wo es billig ist; deterministisch", () => {
    const plus = { id: "p", value: 8, color: "red" as const };
    const minus = { id: "m", value: -8, color: "red" as const };
    const slots = [slot(1, "red", 1.45), slot(2, "red", 0.8)];
    const a = buildAiFormCardSeasonPlan({ cards: [plus, minus], slots, farbregel: FARBREGEL_PM_PLUSMINUS });
    const b = buildAiFormCardSeasonPlan({ cards: [plus, minus], slots, farbregel: FARBREGEL_PM_PLUSMINUS });
    expect(a.entryByCardId.get("p")!.slot.matchdayIndex).toBe(1);
    expect(a.entryByCardId.get("m")!.slot.matchdayIndex).toBe(2);
    expect([...a.entryByCardId.entries()].map(([id, e]) => [id, e.slot.matchdayIndex])).toEqual(
      [...b.entryByCardId.entries()].map(([id, e]) => [id, e.slot.matchdayIndex]),
    );
  });
});

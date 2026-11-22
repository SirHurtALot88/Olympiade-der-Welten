/**
 * FORMKARTEN PLUS/MINUS (22.11., Spielstand-Stempel `seasonState.formkartenRegel`, lib/resolve/formkarten-regel.ts).
 * Konzept: docs/design/formkarten-plusminus-22-11.md.
 *  - Regel "alt" (kein/fremder Stempel): Werte, Zerlegung und Regelstand bit-identisch zu vorher (kein `gegen`-Feld, Werte 0/2/4/8).
 *  - Regel "plusminus": Spieler der Gegenfarbe tragen den spiegelbildlichen Anteil; Karten 2/4/6/8 ohne 0.
 *  - Stempel: neues Spiel / bestehender Spielstand / Saisonwechsel / Rueckweg / Notbremse.
 *  - Gezeigt = gebucht: Einsatzliste (berechneKartenWirkung), Arena-Adapter und Legacy-Funktion rechnen dieselbe Zahl.
 *  - KI-Plan deterministisch, Duell-Gewicht verschiebt den Slot.
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
  kartenWertFuerSpieler,
} from "@/lib/lineups/formkarten-farbregel";
import { berechneKartenWirkung, kartenEffekt, kartenEffektText } from "@/lib/lineups/formkarten-wirkung";
import { vergleichAuswahl } from "@/app/foundation/legacy-lineup-lab/FormMoralBausteine";
import {
  buildGeneratedFormCardRecordsForTeam,
  computePositiveFormCardValueForTests,
  ensureLocalFormCardsForSeason,
  getTeamFormCardOptions,
} from "@/lib/lineups/legacy-lineup-modifiers";
import { farbregelAusRegeln, resolveFormMoralRegeln } from "@/lib/morale/form-moral-regeln";
import {
  formkartenRegelFuer,
  formkartenRegelFuerSpielmodus,
  stempleFormkartenRegelBeimAnlegen,
  stempleFormkartenRegelNachLaden,
} from "@/lib/resolve/formkarten-regel";

const SPIELER = [
  { id: "kati", name: "Kati", className: "Bard" },
  { id: "ferdinand", name: "Ferdinand Lionfist", className: "Warlord" },
  { id: "wildfire", name: "Wildfire", className: "Tactician" },
  { id: "dusk", name: "Duskwhisper", className: "Mage" },
];

function spielstand(wert: number, farbe: string, aufgestellt: string[], regel: "alt" | "plusminus" = "plusminus") {
  return {
    scenarioMeta: { gameMode: "battle" },
    players: SPIELER,
    rosters: SPIELER.map((s) => ({ id: `roster-${s.id}`, teamId: "t1", playerId: s.id })),
    disciplines: [{ id: "battlefield", name: "battlefield", category: "social" }],
    seasonState: {
      seasonId: "season-1",
      formkartenRegel: { seasonId: "season-1", regel },
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

const PM = { scenarioMeta: { gameMode: "battle" }, seasonState: { seasonId: "season-1", formkartenRegel: { seasonId: "season-1", regel: "plusminus" as const } } };
const ALT = { scenarioMeta: { gameMode: "battle" }, seasonState: { seasonId: "season-1", formkartenRegel: { seasonId: "season-1", regel: "alt" as const } } };

describe("Plus/Minus: Regel alt = unveraendert", () => {
  it("ohne Stempel, mit fremdem Stempel und mit alt gilt die Regel von 18.11.", () => {
    expect(formkartenRegelFuer(undefined)).toBe("alt");
    expect(formkartenRegelFuer({ seasonState: { seasonId: "season-1" } })).toBe("alt");
    expect(formkartenRegelFuer({ seasonState: { seasonId: "season-2", formkartenRegel: { seasonId: "season-1", regel: "plusminus" } } })).toBe("alt");
    expect(formkartenRegelFuer(ALT)).toBe("alt");
  });

  it("ohne Gegenfarb-Faktor keine Aenderung und kein neues Feld in der Zerlegung", () => {
    const z = formkartenZerlegungFuerSpieler({ karten: [{ wert: 8, farbe: "red" }], disziplinFarbe: "blue", spielerFarbe: "blue", regel: FARBREGEL_PM });
    expect(z).toEqual({ alle: 4, traeger: 0, form: 0, summe: 4, istTraeger: false });
    expect("gegen" in z).toBe(false);
  });

  it("Regelstand ohne Stempel hat kein plusMinus-Feld, auch wenn der Schalter an ist", () => {
    process.env.OLY_FORMKARTEN_PLUSMINUS = "an";
    expect(resolveFormMoralRegeln({})).not.toHaveProperty("plusMinus");
    expect(resolveFormMoralRegeln({}, ALT)).not.toHaveProperty("plusMinus");
    expect(farbregelAusRegeln(resolveFormMoralRegeln({}, ALT))).toBe(FARBREGEL_PM);
  });

  it("Kartenwerte der Regel alt weiter mit 0 (Bestand der Saves)", () => {
    const werte = new Set<number>();
    for (let i = 0; i < 400; i++) werte.add(computePositiveFormCardValueForTests("s", "season-1", "t", `p${i}`));
    expect([...werte].sort((a, b) => a - b)).toEqual([0, 2, 4, 8]);
  });
});

describe("Plus/Minus: Stempel im Spielstand", () => {
  const neu = () => ({ scenarioMeta: { gameMode: "battle" }, season: { id: "season-1" }, seasonState: { seasonId: "season-1" } }) as unknown as GameState;

  it("neues Spiel: plusminus ab Saison 1, idempotent", () => {
    const gs = stempleFormkartenRegelBeimAnlegen(neu());
    expect(gs.seasonState.formkartenRegel).toEqual({ seasonId: "season-1", regel: "plusminus" });
    expect(formkartenRegelFuer(gs)).toBe("plusminus");
    expect(stempleFormkartenRegelBeimAnlegen(gs)).toBe(gs);
  });

  it("Manager-Spielstand bekommt keinen Stempel und bleibt alt", () => {
    const manager = { scenarioMeta: { gameMode: "manager" }, season: { id: "season-1" }, seasonState: { seasonId: "season-1" } } as unknown as GameState;
    expect(stempleFormkartenRegelBeimAnlegen(manager)).toBe(manager);
    expect(formkartenRegelFuerSpielmodus(manager, "season-2")).toBeUndefined();
  });

  it("bestehender Spielstand: Lade-Migration schreibt alt fest, naechster Saisonwechsel bringt plusminus", () => {
    const geladen = stempleFormkartenRegelNachLaden(neu());
    expect(geladen.seasonState.formkartenRegel).toEqual({ seasonId: "season-1", regel: "alt" });
    expect(stempleFormkartenRegelNachLaden(geladen)).toBe(geladen);
    expect(formkartenRegelFuer(geladen)).toBe("alt");
    const saisonwechsel = {
      ...geladen,
      season: { id: "season-2" },
      seasonState: { ...geladen.seasonState, seasonId: "season-2", formkartenRegel: formkartenRegelFuerSpielmodus(geladen, "season-2") },
    } as GameState;
    expect(formkartenRegelFuer(saisonwechsel)).toBe("plusminus");
  });

  it("Rueckweg aus: neue Saison bekommt alt; Notbremse aus-sofort uebersteuert jeden Stempel", () => {
    process.env.OLY_FORMKARTEN_PLUSMINUS = "aus";
    expect(formkartenRegelFuerSpielmodus(neu(), "season-2")).toEqual({ seasonId: "season-2", regel: "alt" });
    expect(formkartenRegelFuer(PM)).toBe("plusminus");
    process.env.OLY_FORMKARTEN_PLUSMINUS = "aus-sofort";
    expect(formkartenRegelFuer(PM)).toBe("alt");
    expect(resolveFormMoralRegeln({}, PM)).not.toHaveProperty("plusMinus");
  });

  it("Karten der Saison folgen dem Stempel, nicht der Umgebung", () => {
    const basis = { players: [{ id: "a", name: "A", className: "Mage" }], rosters: [{ id: "r", teamId: "t", playerId: "a" }], teams: [{ teamId: "t" }] };
    process.env.OLY_FORMKARTEN_PLUSMINUS = "an";
    const alt = buildGeneratedFormCardRecordsForTeam({ ...basis, ...ALT } as unknown as GameState, "s", "season-1", "t");
    expect(Math.abs(alt[0].cardValue)).toBe(computePositiveFormCardValueForTests("s", "season-1", "t", "a"));
    process.env.OLY_FORMKARTEN_PLUSMINUS = "aus";
    const pm = buildGeneratedFormCardRecordsForTeam({ ...basis, ...PM } as unknown as GameState, "s", "season-1", "t");
    expect(pm.every((k) => [2, 4, 6, 8].includes(Math.abs(k.cardValue)))).toBe(true);
  });
});

describe("Plus/Minus: Notbremse aendert keine Karten", () => {
  it("aus-sofort schaltet nur die Wirkung ab; Kartenwerte und geplante Karten eines Menschen bleiben", () => {
    const basis = { players: [{ id: "a", name: "A", className: "Mage" }, { id: "b", name: "B", className: "Tank" }], rosters: [{ id: "r1", teamId: "t", playerId: "a" }, { id: "r2", teamId: "t", playerId: "b" }], teams: [{ teamId: "t" }] };
    const gs = { ...basis, ...PM } as unknown as GameState;
    const karten = buildGeneratedFormCardRecordsForTeam(gs, "s", "season-1", "t");
    const mitKarten = { ...gs, seasonState: { ...gs.seasonState, formCards: karten } } as unknown as GameState;
    process.env.OLY_FORMKARTEN_PLUSMINUS = "aus-sofort";
    expect(formkartenRegelFuer(mitKarten)).toBe("alt");
    const neuGezogen = buildGeneratedFormCardRecordsForTeam(mitKarten, "s", "season-1", "t");
    expect(neuGezogen.map((k) => k.cardValue)).toEqual(karten.map((k) => k.cardValue));
    expect(ensureLocalFormCardsForSeason(mitKarten, "s", "season-1")).toBe(mitKarten);
    expect(resolveFormMoralRegeln({}, mitKarten)).not.toHaveProperty("plusMinus");
  });
});

describe("Plus/Minus: Regel plusminus", () => {
  it("Regelstand traegt plusMinus und liefert die Gegenfarb-Regel", () => {
    const r = resolveFormMoralRegeln({}, PM);
    expect(r.plusMinus).toBe(true);
    expect(farbregelAusRegeln(r)).toBe(FARBREGEL_PM_PLUSMINUS);
    expect(resolveFormMoralRegeln({ OLY_FORMKARTEN_FARBREGEL: "alt" }, PM)).not.toHaveProperty("plusMinus");
  });

  it("Gegenfarben sind paarweise gespiegelt", () => {
    for (const [a, b] of Object.entries(GEGENFARBE)) expect(GEGENFARBE[b]).toBe(a);
  });

  it("Pluskarte kostet die Gegenfarbe, Minuskarte bringt ihr etwas (v x 0,25), die Farbe selbst bleibt negativ", () => {
    const plus = { wert: 8, farbe: "red" };
    expect(kartenWertFuerSpieler({ karte: plus, disziplinFarbe: "blue", spielerFarbe: "blue", regel: FARBREGEL_PM_PLUSMINUS })).toBe(4 - 2);
    expect(kartenWertFuerSpieler({ karte: plus, disziplinFarbe: "blue", spielerFarbe: "green", regel: FARBREGEL_PM_PLUSMINUS })).toBe(4);
    expect(kartenWertFuerSpieler({ karte: plus, disziplinFarbe: "blue", spielerFarbe: "red", regel: FARBREGEL_PM_PLUSMINUS })).toBe(8);
    const minus = { wert: -8, farbe: "red" };
    expect(kartenWertFuerSpieler({ karte: minus, disziplinFarbe: "blue", spielerFarbe: "blue", regel: FARBREGEL_PM_PLUSMINUS })).toBe(-4 + 2);
    expect(kartenWertFuerSpieler({ karte: minus, disziplinFarbe: "blue", spielerFarbe: "red", regel: FARBREGEL_PM_PLUSMINUS })).toBe(-8);
  });

  it("Zerlegung nennt den Gegenfarb-Anteil getrennt und summiert ihn ein", () => {
    const z = formkartenZerlegungFuerSpieler({ karten: [{ wert: 8, farbe: "red" }], disziplinFarbe: "blue", spielerFarbe: "blue", regel: FARBREGEL_PM_PLUSMINUS });
    expect(z).toMatchObject({ alle: 4, traeger: 0, gegen: -2, summe: 2 });
  });

  it("Hinweis und Effekttext nennen den Abzug", () => {
    expect(formkartenHinweis({ karte: { wert: 8, farbe: "red" }, disziplinFarbe: "blue", traegerAnzahl: 1, regel: FARBREGEL_PM_PLUSMINUS })).toContain("-2 für Spieler der Gegenfarbe");
    const regeln = resolveFormMoralRegeln({}, PM);
    expect(kartenEffekt({ value: 8, color: "red" }, "blue", regeln).gegenZusatz).toBe(-2);
    expect(kartenEffektText({ value: 8, color: "red" }, "blue", regeln)).toContain("-2 für MEN-Spieler");
    expect(kartenEffekt({ value: 8, color: "red" }, "blue").gegenZusatz).toBeUndefined();
  });

  it("Karten ohne 0: jeder Wert aus [2,4,6,8], je Spieler zwei echte Karten", () => {
    const werte = new Set<number>();
    for (let i = 0; i < 400; i++) werte.add(computePositiveFormCardValueForTests("s", "season-1", "t", `p${i}`, true));
    expect([...werte].sort((a, b) => a - b)).toEqual([2, 4, 6, 8]);
    const gs = { players: [{ id: "a", name: "A", className: "Mage" }], rosters: [{ id: "r", teamId: "t", playerId: "a" }], teams: [{ teamId: "t" }], ...PM } as unknown as GameState;
    const karten = buildGeneratedFormCardRecordsForTeam(gs, "s", "season-1", "t");
    expect(karten).toHaveLength(2);
    expect(karten.every((k) => k.cardValue !== 0)).toBe(true);
    expect(karten.some((k) => k.cardValue < 0) && karten.some((k) => k.cardValue > 0)).toBe(true);
  });

  for (const [wert, farbe] of [[8, "red"], [-4, "red"], [8, "blue"]] as const) {
    it(`gezeigt = gebucht (Einsatzliste = Arena-Adapter) fuer Karte ${wert} ${farbe}`, () => {
      const aufgestellt = ["kati", "ferdinand", "wildfire", "dusk"];
      const gs = spielstand(wert, farbe, aufgestellt);
      const w = wirkung(gs, aufgestellt, resolveFormMoralRegeln({}, gs));
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

  it("Stempel alt: Einsatzliste und Arena-Adapter rechnen ohne Gegenfarbe, weiter gleich (auch bei Schalter an)", () => {
    process.env.OLY_FORMKARTEN_PLUSMINUS = "an";
    const aufgestellt = ["kati", "ferdinand", "wildfire", "dusk"];
    const gs = spielstand(8, "red", aufgestellt, "alt");
    const w = wirkung(gs, aufgestellt, resolveFormMoralRegeln({}, gs));
    const motor = buildArenaAufstellung(gs, "t1", "md-1");
    for (const s of w.spieler) {
      expect(s.zerlegung.gegen).toBeUndefined();
      expect(motor[SPIELER.find((x) => x.id === s.playerId)!.name]).toMatchObject({ form: s.zerlegung.summe });
    }
  });

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
    expect(a.farbregel).toBe(FARBREGEL_PM_PLUSMINUS);
    expect([...a.entryByCardId.entries()].map(([id, e]) => [id, e.slot.matchdayIndex])).toEqual(
      [...b.entryByCardId.entries()].map(([id, e]) => [id, e.slot.matchdayIndex]),
    );
  });
});

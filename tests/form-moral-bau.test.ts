import { describe, expect, it } from "vitest";
import type { GameState, PlayerFormState } from "@/lib/data/olyDataTypes";
import {
  FARBREGEL_PM,
  formkartenSummeFuerSpieler,
  formkartenZerlegungFuerSpieler,
} from "@/lib/lineups/formkarten-farbregel";
import {
  buildFormkartenPlayers,
  calculateFormModifierForSide,
  distributePerPlayerFormShares,
} from "@/lib/lineups/legacy-lineup-modifiers";
import type { LegacyFormCardOption } from "@/lib/lineups/legacy-lineup-types";
import { berechneKartenWirkung, formkartenBuchung } from "@/lib/lineups/formkarten-wirkung";
import { baueFormMeldungen, baueFormMoralAnzeige, formBegruendung } from "@/lib/lineups/form-moral-anzeige";
import {
  FORM_VERLAUF_MAX,
  advancePlayerFormDetail,
  advancePlayerFormState,
  buildFormWirkungMap,
  buildMatchdayLeistungDetails,
  resetPlayerFormForNewSeason,
} from "@/lib/morale/form-moral-modifikator";
import { moralFarbe, moralMund, moralStufe } from "@/lib/morale/moral-anzeige";

const KARTEN: LegacyFormCardOption[] = [
  { id: "k1", playerId: "x", playerName: "X", color: "yellow", value: 8, isUsed: false, usedByLineupId: null },
  { id: "k2", playerId: "y", playerName: "Y", color: "red", value: -4, isUsed: false, usedByLineupId: null },
];
const MODS = { d1: { primaryFormCardId: "k1", secondaryFormCardId: "k2" } } as never;
const SPIELER = [
  { playerId: "a", className: "Bard", formStufe: 0 },
  { playerId: "b", className: "Bard", formStufe: 2 },
  { playerId: "c", className: "Tank", formStufe: 0 },
];

describe("Formkarten-Farbregel: eine Wahrheit", () => {
  it("calculateFormModifierForSide rechnet je Spieler und stimmt mit der Regel-Funktion überein", () => {
    const r = calculateFormModifierForSide({
      modifiers: MODS,
      disciplineSide: "d1",
      disciplineColor: "yellow",
      playerCount: 3,
      formCards: KARTEN,
      players: SPIELER,
      farbregel: FARBREGEL_PM,
    });
    expect(r.formByPlayerId).not.toBeNull();
    for (const s of SPIELER) {
      const erwartet = formkartenSummeFuerSpieler({
        karten: [{ wert: 8, farbe: "yellow" }, { wert: -4, farbe: "red" }],
        disziplinFarbe: "yellow",
        spielerFarbe: s.className === "Bard" ? "yellow" : "red",
        formStufe: s.formStufe,
        regel: FARBREGEL_PM,
      });
      expect(r.formByPlayerId![s.playerId].summe).toBe(erwartet);
    }
    // Bard in Form 2: 8 (alle, passend) + 4 (Farbe) + 4*0,25 (Form-Hebel) = 13, dazu -4*0,5 = -2 (fremde Minuskarte, kein Träger)
    expect(r.formByPlayerId!.b.summe).toBe(11);
    expect(r.formModifier).toBeCloseTo(SPIELER.reduce((x, s) => x + r.formByPlayerId![s.playerId].summe, 0), 1);
  });

  it("alte Regel (farbregel: null) bleibt x2 für alle und liefert keine Je-Spieler-Zerlegung", () => {
    const r = calculateFormModifierForSide({
      modifiers: MODS,
      disciplineSide: "d1",
      disciplineColor: "yellow",
      playerCount: 3,
      formCards: KARTEN,
      players: SPIELER,
      farbregel: null,
    });
    expect(r.formByPlayerId).toBeNull();
    expect(r.formPerPlayer).toBe(12);
    expect(r.formModifier).toBe(36);
  });

  it("ohne Eingriff gilt die neue Regel (Standard seit 18.11.)", () => {
    const r = calculateFormModifierForSide({
      modifiers: MODS,
      disciplineSide: "d1",
      disciplineColor: "yellow",
      playerCount: 3,
      formCards: KARTEN,
      players: SPIELER,
    });
    expect(r.formByPlayerId).not.toBeNull();
  });

  it("Wertung: der Form-Anteil je Spieler folgt der Je-Spieler-Zahl (nicht dem Seitenmittel)", () => {
    const shares = distributePerPlayerFormShares({
      formPerPlayer: 6,
      seeds: ["s1", "s2"],
      jitterMax: 0,
      flatBySeedIndex: [12, 0],
    });
    expect(shares).toEqual([12, 0]);
    // Spieler ohne eigene Zahl fällt auf den Seitenwert zurück
    expect(distributePerPlayerFormShares({ formPerPlayer: 6, seeds: ["s1"], jitterMax: 0, flatBySeedIndex: [null] })).toEqual([6]);
  });

  it("Anzeige (berechneKartenWirkung) liefert dieselben Zahlen wie die Wertung", () => {
    const w = berechneKartenWirkung({
      side: "d1",
      disciplineId: "basketball",
      disciplineCategory: "social",
      formCards: KARTEN,
      primaryCardId: "k1",
      secondaryCardId: "k2",
      playerIds: ["a", "b", "c"],
      rosterPlayers: [{ id: "a", name: "A", className: "Bard" }, { id: "b", name: "B", className: "Bard" }, { id: "c", name: "C", className: "Tank" }] as never,
    });
    const direkt = calculateFormModifierForSide({
      modifiers: MODS,
      disciplineSide: "d1",
      disciplineColor: "yellow",
      playerCount: 3,
      formCards: KARTEN,
      players: buildFormkartenPlayers({
        playerIds: ["a", "b", "c"],
        rosterPlayers: [{ id: "a", className: "Bard" }, { id: "b", className: "Bard" }, { id: "c", className: "Tank" }],
      }),
    });
    expect(w.teamSumme).toBe(direkt.formModifier);
    expect(w.traegerAnzahl).toBe(3);
    expect(w.karten.map((k) => k.passt)).toEqual([true, false]);
  });

  it("Zerlegung: alle + Farbe + Form ergibt die Summe", () => {
    const z = formkartenZerlegungFuerSpieler({
      karten: [{ wert: 8, farbe: "yellow" }],
      disziplinFarbe: "yellow",
      spielerFarbe: "yellow",
      formStufe: 2,
    });
    expect(z).toEqual({ alle: 8, traeger: 4, form: 1, summe: 13, istTraeger: true });
  });
});

describe("Formkarten: gezeigt = gebucht", () => {
  const battle = { scenarioMeta: { gameMode: "battle" } } as unknown as GameState;
  const manager = { scenarioMeta: { gameMode: "manager" } } as unknown as GameState;
  it("Battle-Modus: nur Disziplinen mit echten Karten buchen, die übrigen Arena-Disziplinen nicht", () => {
    expect(formkartenBuchung(battle, "time-trial").gebucht).toBe(true);
    expect(formkartenBuchung(battle, "spurt").gebucht).toBe(true);
    const basketball = formkartenBuchung(battle, "basketball");
    expect(basketball.gebucht).toBe(false);
    expect(basketball.grund).toMatch(/Ersatzkarte/);
  });
  it("Manager-Modus (Legacy-Wertung): überall gebucht", () => {
    expect(formkartenBuchung(manager, "basketball").gebucht).toBe(true);
    expect(formkartenBuchung(manager, "hockey").gebucht).toBe(true);
  });
});

function mini(overrides: Partial<GameState> = {}): GameState {
  const ids = ["p1", "p2", "p3", "p4"];
  return {
    season: { id: "s1" },
    players: ids.map((id) => ({ id, name: id.toUpperCase(), fatigue: id === "p4" ? 90 : 10, className: "Bard" })),
    rosters: ids.map((id) => ({ id: `r-${id}`, playerId: id, teamId: "t1" })),
    playerMoraleState: [{ playerId: "p1", teamId: "t1", morale: 75 }],
    seasonState: {
      matchdayResults: [{ id: "mr1", seasonId: "s1", matchdayId: "md1" }],
      playerDisciplinePerformances: [
        { matchdayResultId: "mr1", playerId: "p1", disciplineId: "tennis", baseValue: 50, finalPlayerScore: 90 },
        { matchdayResultId: "mr1", playerId: "p2", disciplineId: "tennis", baseValue: 60, finalPlayerScore: 60 },
        { matchdayResultId: "mr1", playerId: "p3", disciplineId: "tennis", baseValue: 70, finalPlayerScore: 40 },
        { matchdayResultId: "mr1", playerId: "p4", disciplineId: "tennis", baseValue: 40, finalPlayerScore: 20 },
      ],
      playerAvailabilityState: [],
    },
    disciplines: [{ id: "tennis", name: "Tennis", category: "mental" }],
    ...overrides,
  } as unknown as GameState;
}

describe("Form-Verlauf", () => {
  it("schreibt je Spieler und Spieltag Wert, Perzentile, Bremse und Einsatz", () => {
    const liste = advancePlayerFormState(mini(), "md1");
    const p1 = liste.find((z) => z.playerId === "p1")!;
    expect(p1.verlauf).toHaveLength(1);
    expect(p1.verlauf![0]).toMatchObject({ seasonId: "s1", matchdayId: "md1", eingesetzt: true, disziplinId: "tennis", vorher: 50 });
    expect(p1.verlauf![0].leistungPerz).toBeGreaterThan(p1.verlauf![0].erwartungPerz!);
    expect(p1.form).toBeGreaterThan(50);
    const p4 = liste.find((z) => z.playerId === "p4")!;
    expect(p4.verlauf![0].bremse?.art).toBe("erschoepfung");
    expect(p4.verlauf![0].bremse!.punkte).toBeGreaterThan(0);
  });

  it("Spieler ohne Einsatz: Eintrag mit eingesetzt=false, kein Perzentil", () => {
    const gs = mini();
    gs.rosters.push({ id: "r-p5", playerId: "p5", teamId: "t1" } as never);
    const p5 = advancePlayerFormState(gs, "md1").find((z) => z.playerId === "p5")!;
    expect(p5.verlauf![0]).toMatchObject({ eingesetzt: false, leistungPerz: null, bremse: null });
  });

  it("idempotent je Spieltag und hängt an einen vorhandenen Verlauf an; alte Stände ohne Feld laden", () => {
    const gs = mini();
    const einmal = advancePlayerFormState(gs, "md1");
    const zweimal = advancePlayerFormState({ ...gs, playerFormState: einmal }, "md1");
    expect(zweimal.find((z) => z.playerId === "p1")!.verlauf).toHaveLength(1);
    const alt: PlayerFormState[] = [{ playerId: "p1", teamId: "t1", form: 60, lastSeasonId: "s1", lastMatchdayId: "md0", appearances: 2 }];
    const neu = advancePlayerFormState({ ...gs, playerFormState: alt }, "md1").find((z) => z.playerId === "p1")!;
    expect(neu.verlauf).toHaveLength(1);
    expect(neu.verlauf![0].vorher).toBe(60);
    expect(neu.appearances).toBe(3);
  });

  it("Verlauf ist auf FORM_VERLAUF_MAX begrenzt und enthält nur die laufende Saison", () => {
    let gs = mini();
    const viele = Array.from({ length: FORM_VERLAUF_MAX + 5 }, (_, i) => ({
      seasonId: i < 3 ? "s0" : "s1", matchdayId: `m${i}`, form: 50, vorher: 50, eingesetzt: false,
    }));
    gs = { ...gs, playerFormState: [{ playerId: "p1", teamId: "t1", form: 50, lastSeasonId: "s1", lastMatchdayId: "mx", appearances: 0, verlauf: viele }] };
    const p1 = advancePlayerFormState(gs, "md1").find((z) => z.playerId === "p1")!;
    expect(p1.verlauf!.length).toBe(FORM_VERLAUF_MAX);
    expect(p1.verlauf!.every((v) => v.seasonId === "s1")).toBe(true);
  });

  it("Saisonwechsel: Form zur Mitte, Verlauf leer, Einsatzzähler bleibt", () => {
    const reset = resetPlayerFormForNewSeason([
      { playerId: "p1", teamId: "t1", form: 85, lastSeasonId: "s1", lastMatchdayId: "m9", appearances: 7, verlauf: [{ seasonId: "s1", matchdayId: "m9", form: 85, vorher: 80, eingesetzt: true }] },
    ])!;
    expect(reset[0]).toMatchObject({ form: 50, verlauf: [], appearances: 7 });
    expect(resetPlayerFormForNewSeason(undefined)).toBeUndefined();
  });

  it("Bremse in der Detail-Fortschreibung: Verletzung und Erschöpfung benannt", () => {
    expect(advancePlayerFormDetail({ form: 50, eingesetzt: true, residuum: 0, erschoepfung: 100 }).bremse).toEqual({ art: "erschoepfung", punkte: 15 });
    expect(advancePlayerFormDetail({ form: 50, eingesetzt: false, verletzt: true }).bremse?.art).toBe("verletzung");
    expect(advancePlayerFormDetail({ form: 50, eingesetzt: true, residuum: 0.1, erschoepfung: 20 }).bremse).toBeNull();
  });

  it("Leistungs-Details: Perzentile 0..100 der Disziplin mit dem größeren Abstand", () => {
    const d = buildMatchdayLeistungDetails(mini().seasonState.playerDisciplinePerformances as never);
    expect(d.get("p1")).toMatchObject({ disziplinId: "tennis" });
    expect(d.get("p1")!.leistungPerz).toBe(100);
  });

  it("Begründung und Meldungen: größte Bewegung zuerst, vier Satzbausteine", () => {
    const gs = mini();
    const mitForm = { ...gs, playerFormState: advancePlayerFormState(gs, "md1") } as GameState;
    const meld = baueFormMeldungen(mitForm, "t1", "md1", (id) => (id === "tennis" ? "Tennis" : null));
    expect(meld.length).toBe(4);
    expect(Math.abs(meld[0].delta)).toBeGreaterThanOrEqual(Math.abs(meld[meld.length - 1].delta));
    expect(meld.find((m) => m.playerId === "p1")!.richtung).toBe("gestiegen");
    expect(meld.find((m) => m.playerId === "p1")!.grund).toMatch(/Tennis: Leistung 100 gegen erwartete/);
    expect(formBegruendung({ seasonId: "s1", matchdayId: "m", form: 40, vorher: 50, eingesetzt: false })).toMatch(/Kein Einsatz/);
    expect(formBegruendung({ seasonId: "s1", matchdayId: "m", form: 40, vorher: 50, eingesetzt: false, bremse: { art: "verletzung", punkte: 10 } })).toMatch(/Verletzt/);
  });

  it("Anzeige: Moral und Form aus dem Spielstand, ohne Form-Zeile keine erfundene Form", () => {
    const gs = mini();
    const ohne = baueFormMoralAnzeige(gs, "p1");
    expect(ohne.formVerfuegbar).toBe(false);
    expect(ohne.moral).toBe(75);
    expect(ohne.moralWort).toBe("zufrieden");
    const mit = baueFormMoralAnzeige({ ...gs, playerFormState: advancePlayerFormState(gs, "md1") } as GameState, "p1");
    expect(mit.formVerfuegbar).toBe(true);
    expect(mit.letzteEinsaetze).toHaveLength(1);
    expect(mit.gesamtPct).toBeCloseTo(mit.formPct + mit.moralPct, 2);
  });

  it("Legacy-Wertung: Form-Multiplikator nur mit gespeicherter Form", () => {
    const gs = mini();
    expect(buildFormWirkungMap(gs, ["p1"])).toBeNull();
    const map = buildFormWirkungMap({ ...gs, playerFormState: advancePlayerFormState(gs, "md1") } as GameState, ["p1", "p2"]);
    expect(map!.p1.multiplier).toBeGreaterThan(1);
  });
});

describe("Moral als Gesicht: Stufen und Farbe folgen dem Wert", () => {
  it("fünf Stufen an 80/60/40/20", () => {
    expect([100, 80, 79.9, 60, 59.9, 40, 39.9, 20, 19.9, 0].map((w) => moralStufe(w).wort)).toEqual([
      "sehr zufrieden", "sehr zufrieden", "zufrieden", "zufrieden", "neutral", "neutral", "unzufrieden", "unzufrieden", "verärgert", "verärgert",
    ]);
  });
  it("Farbe läuft rot (0) - bernstein (50) - grün (100) und Mund steigt mit dem Wert", () => {
    expect(moralFarbe(0)).toBe("#ff6058");
    expect(moralFarbe(50)).toBe("#f3b54a");
    expect(moralFarbe(100)).toBe("#62d394");
    expect(moralMund(0)).toBe(-1);
    expect(moralMund(50)).toBe(0);
    expect(moralMund(100)).toBe(1);
    expect(moralMund(70)).toBeGreaterThan(moralMund(40));
  });
});

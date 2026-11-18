import { describe, expect, it } from "vitest";
import {
  advancePlayerForm,
  buildMatchdayResiduals,
  calculateFormMoralSignal,
  formToStufe,
  isFormMoralEnabled,
  resolveFormMoralDosisPct,
  scaleArenaPlayerByMultiplier,
} from "@/lib/morale/form-moral-modifikator";

describe("Form + Moral Modifikator (Prototyp, Standard AUS)", () => {
  it("ist ohne Umgebungsvariable aus und akzeptiert 1/an/on/true", () => {
    expect(isFormMoralEnabled({})).toBe(false);
    expect(isFormMoralEnabled({ OLY_FORM_MORAL: "0" })).toBe(false);
    expect(isFormMoralEnabled({ OLY_FORM_MORAL: "1" })).toBe(true);
    expect(isFormMoralEnabled({ OLY_FORM_MORAL: "an" })).toBe(true);
  });

  it("Dosis: Standard 1,5 und Deckel 4", () => {
    expect(resolveFormMoralDosisPct({})).toBe(1.5);
    expect(resolveFormMoralDosisPct({ OLY_FORM_MORAL_DOSIS: "2.5" })).toBe(2.5);
    expect(resolveFormMoralDosisPct({ OLY_FORM_MORAL_DOSIS: "99" })).toBe(4);
  });

  it("neutral = Multiplikator 1; fehlende Werte zählen neutral", () => {
    expect(calculateFormMoralSignal({}).multiplier).toBe(1);
    expect(calculateFormMoralSignal({ form: 50, morale: 50 }).modifierPct).toBe(0);
  });

  it("Stufen -2..+2 aus der Form", () => {
    expect([0, 20, 35, 50, 65, 80, 100].map(formToStufe)).toEqual([-2, -2, -1, 0, 1, 2, 2]);
  });

  it("Höchstwirkung bei Dosis 1,5: Form +-3 %, Moral +-1 %, zusammen +-4 %", () => {
    const hoch = calculateFormMoralSignal({ form: 100, morale: 100 });
    expect(hoch.formPct).toBeCloseTo(3, 5);
    expect(hoch.moralePct).toBeCloseTo(1, 5);
    expect(hoch.modifierPct).toBeCloseTo(4, 5);
    const tief = calculateFormMoralSignal({ form: 0, morale: 0 });
    expect(tief.modifierPct).toBeCloseTo(-4, 5);
    expect(tief.multiplier).toBeCloseTo(0.96, 5);
  });

  it("Dosis 0 ist Multiplikator 1", () => {
    expect(calculateFormMoralSignal({ form: 100, morale: 0, dosisPct: 0 }).multiplier).toBe(1);
  });

  it("Fortschreibung: besser als erwartet hebt, schlechter senkt, Ruhe fällt zur Mitte zurück", () => {
    const rauf = advancePlayerForm({ form: 50, eingesetzt: true, residuum: 0.3 });
    const runter = advancePlayerForm({ form: 50, eingesetzt: true, residuum: -0.3 });
    expect(rauf).toBeGreaterThan(50);
    expect(runter).toBeLessThan(50);
    const ruhe = advancePlayerForm({ form: 80, eingesetzt: false });
    expect(ruhe).toBeLessThan(80);
    expect(ruhe).toBeGreaterThan(50);
  });

  it("Dauer-Hoch gibt es nicht: nach 3 Ruhetagen verliert +2 mindestens eine halbe Stufe", () => {
    let form = 80;
    for (let i = 0; i < 3; i++) form = advancePlayerForm({ form, eingesetzt: false });
    expect(form).toBeLessThan(72.5);
  });

  it("Erschöpfung und Verletzung bremsen", () => {
    const frisch = advancePlayerForm({ form: 60, eingesetzt: true, residuum: 0.2, erschoepfung: 10 });
    const muede = advancePlayerForm({ form: 60, eingesetzt: true, residuum: 0.2, erschoepfung: 95 });
    expect(muede).toBeLessThan(frisch);
    const verletzt = advancePlayerForm({ form: 60, eingesetzt: false, verletzt: true });
    expect(verletzt).toBeLessThan(advancePlayerForm({ form: 60, eingesetzt: false }));
  });

  it("Residuum: Rang der Leistung gegen Rang der Erwartung, nur ab drei Teilnehmern", () => {
    const zeilen = [
      { playerId: "a", disciplineId: "d", baseValue: 90, finalPlayerScore: 10 },
      { playerId: "b", disciplineId: "d", baseValue: 50, finalPlayerScore: 50 },
      { playerId: "c", disciplineId: "d", baseValue: 10, finalPlayerScore: 90 },
      { playerId: "x", disciplineId: "klein", baseValue: 1, finalPlayerScore: 2 },
      { playerId: "y", disciplineId: "klein", baseValue: 2, finalPlayerScore: 1 },
    ];
    const r = buildMatchdayResiduals(zeilen);
    expect(r.get("a")).toBe(-1);
    expect(r.get("b")).toBe(0);
    expect(r.get("c")).toBe(1);
    expect(r.has("x")).toBe(false);
  });

  it("Arena-Spieler: Multiplikator 1 gibt dieselbe Referenz, sonst skaliert Eignung und Attribute gedeckelt", () => {
    const s = { n: "A", d: { hockey: 80, tdm: 99 }, a: { power: 50, speed: 100 } };
    expect(scaleArenaPlayerByMultiplier(s, 1)).toBe(s);
    const t = scaleArenaPlayerByMultiplier(s, 1.04);
    expect(t.d.hockey).toBeCloseTo(83.2, 5);
    expect(t.d.tdm).toBe(100);
    expect(t.a.power).toBeCloseTo(52, 5);
    expect(t.a.speed).toBe(100);
    expect(s.d.hockey).toBe(80);
  });
});

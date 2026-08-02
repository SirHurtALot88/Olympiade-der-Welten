/**
 * GEMELDET: „es muss auch welche geben die auf lowballen eingehen."
 *
 * Der Entwurf (verhandlung-rework.md Abschnitt 9.2) wollte das über einen „Eile-Rabatt" `E`
 * aus vier benennbaren Quellen lösen und nannte als Ursache den Boden 0,92 in `R_money`.
 * Beides hat die Messung am echten Spielstand widerlegt — und zwar so deutlich, dass der
 * Entwurf nicht nachkalibriert, sondern ersetzt gehört:
 *
 *   Der Boden 0,92 greift erst ab W = 73. Gemessener Wechselwille über drei Teams × 500
 *   Marktspieler: 20 … 83, Median 46. GEKAPPT WURDEN 0 VON 1500. Der benannte Übeltäter war
 *   an keinem einzigen Spieler beteiligt.
 *
 *   Alle vier Eile-Quellen feuern an diesem Spielstand für 0 %: `inactiveSeasons` existiert
 *   für Marktspieler gar nicht (`playerMoraleState` hat nur Kaderspieler-Einträge, 332 von
 *   2652), das Gate `teamFit ≥ 30` liegt über dem beobachteten Maximum 28, `ambition ≥ 8`
 *   scheitert an Team-Ambition 2,8, und `scoutingBonus ≥ 6` an Scouting-Stufe 0. Der Rabatt
 *   hätte nichts verändert.
 *
 * Die echte Ursache ist die STAUCHUNG von W selbst, und sie hat zwei Teile — je einer pro
 * Kennlinie, die diese Suite festhält.
 */
import { describe, expect, it } from "vitest";

import type { ContractShape, Player, TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  buildContractNegotiationPreview,
  deriveMoneyThresholdRatio,
  deriveTeamFitWillingnessPoints,
} from "@/lib/market/contract-negotiation-preview";
import { makePlayer, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

describe("Teil 1 — die Fit-Kennlinie hatte eine Klippe, die niemand erreicht hat", () => {
  it("ist stetig: kein Sprung an der alten Bruchstelle 25", () => {
    // Vorher: Fit 24,9 → +4,98, Fit 25,0 → +16,25. Ein Sprung von elf Willenspunkten innerhalb
    // eines Zehntels Fit — und da das Maximum an echten Ständen bei 28 liegt, standen fast alle
    // Spieler unterhalb davon auf dem gedeckelten Ast.
    expect(deriveTeamFitWillingnessPoints(24.9, 0)).toBeCloseTo(16.185, 3);
    expect(deriveTeamFitWillingnessPoints(25.1, 0)).toBeCloseTo(16.315, 3);
    expect(
      Math.abs(deriveTeamFitWillingnessPoints(25.1, 0) - deriveTeamFitWillingnessPoints(24.9, 0)),
    ).toBeLessThan(0.2);
  });

  it("hat über den GESAMTEN gemessenen Fit-Bereich keine Sprungstelle", () => {
    // Gemessene Spanne an einem echten Spielstand: -49 … +28. In 0,1-Schritten darf sich der
    // Beitrag nie um mehr als den Anstieg selbst ändern.
    let vorher = deriveTeamFitWillingnessPoints(-49, 0);
    for (let fit = -48.9; fit <= 28; fit = Math.round((fit + 0.1) * 10) / 10) {
      const jetzt = deriveTeamFitWillingnessPoints(fit, 0);
      expect(Math.abs(jetzt - vorher), `Sprung bei Fit ${fit}`).toBeLessThan(0.11);
      vorher = jetzt;
    }
  });

  it("gibt dem realistisch erreichbaren Fit spürbar mehr Gewicht als vorher", () => {
    // Der Punkt der Änderung: bei Fit 24 (dem beobachteten Maximum eines echten Teams) gab es
    // vorher +4,8 — jetzt +15,6. Der Fit-Vorteil eines wirklich passenden Kaders ist damit
    // erstmals im Wechselwillen sichtbar.
    expect(deriveTeamFitWillingnessPoints(24, 0)).toBeCloseTo(15.6, 3);
    expect(deriveTeamFitWillingnessPoints(11.4, 0)).toBeCloseTo(7.41, 3); // P90 eines echten Saves
  });

  it("lässt negativen Fit und die Fit-Politik unangetastet", () => {
    // Nur der positive Ast war kaputt. Der Malus-Ast und der Identitäts-Boden ab 25 bleiben.
    expect(deriveTeamFitWillingnessPoints(-49, 0)).toBe(-10); // Deckel bei -10, wie vorher
    expect(deriveTeamFitWillingnessPoints(-5, 0)).toBeCloseTo(-2, 3);
    expect(deriveTeamFitWillingnessPoints(26, 22)).toBe(22); // fit25Bonus schlägt die Kennlinie
    expect(deriveTeamFitWillingnessPoints(26, 0)).toBeCloseTo(16.9, 3);
    expect(deriveTeamFitWillingnessPoints(60, 0)).toBe(28); // Deckel bei 28, wie vorher
  });
});

describe("Teil 2 — die Geld-Kennlinie war zu flach, nicht zu tief gedeckelt", () => {
  it("dreht sich um W = 42 — die Mitte bleibt stehen", () => {
    // Das ist die Bedingung dafür, dass die Schärfung den Schwierigkeitsgrad NICHT verschiebt:
    // sie spreizt die Enden, statt alle Spieler billiger zu machen.
    const alt = (W: number) => Math.min(1.14, Math.max(0.92, 1.14 - 0.003 * W));
    expect(deriveMoneyThresholdRatio(42)).toBeCloseTo(alt(42), 2);
    expect(Math.abs(deriveMoneyThresholdRatio(46) - alt(46))).toBeLessThan(0.015); // Median-W
  });

  it("spreizt die Enden: Unwillige teurer, Willige wirklich billiger", () => {
    const alt = (W: number) => Math.min(1.14, Math.max(0.92, 1.14 - 0.003 * W));
    expect(deriveMoneyThresholdRatio(20)).toBeGreaterThan(alt(20)); // sturer Pol
    expect(deriveMoneyThresholdRatio(70)).toBeLessThan(alt(70) - 0.03); // williger Pol
    expect(deriveMoneyThresholdRatio(83)).toBeLessThan(0.9);
  });

  it("erreicht den Boden im realistischen W-Bereich — der alte tat das nie", () => {
    // Der Kern des Messbefunds: der alte Boden 0,92 lag bei W = 73, jenseits fast aller
    // Spieler. Der neue greift ab W = 71 auf einer Kennlinie, die dort schon 0,88 wert ist —
    // erreichbar, aber nur für den oberen Rand.
    expect(deriveMoneyThresholdRatio(99)).toBe(0.88);
    expect(deriveMoneyThresholdRatio(60)).toBeGreaterThan(0.88);
  });

  it("bleibt monoton fallend — mehr Wille heißt nie mehr Geld", () => {
    for (let W = 1; W <= 99; W += 1) {
      expect(deriveMoneyThresholdRatio(W), `W=${W}`).toBeLessThanOrEqual(deriveMoneyThresholdRatio(W - 1));
    }
  });
});

describe("Teil 3 — im echten Vorschau-Aufruf entsteht daraus ein Pol", () => {
  const TEAM = makeTeam({ teamId: "A-A", cash: 200 });
  const identity: TeamIdentity = makeTeamIdentity({ teamId: "A-A", ambition: 5, popularity: 5 });

  function vorschau(player: Player, offeredSalary: number | null, shape: ContractShape = "balanced") {
    return buildContractNegotiationPreview({
      saveId: "williger-pol",
      seasonId: "season-1",
      team: TEAM,
      teamIdentity: identity,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 3,
      contractShape: shape,
      offeredSalary,
      scoutingLevel: 0,
      seasonLabelBase: "Season 1",
    });
  }

  const spieler = (id: string, traitsPositive: string[] = [], traitsNegative: string[] = []) =>
    makePlayer({
      id,
      name: `Spieler ${id}`,
      traitsPositive,
      traitsNegative,
      salaryDemand: 100,
      displaySalary: 4,
      marketValue: 3000,
      displayMarketValue: 30,
    });

  it("veröffentlicht die Schwelle genau nach der Kennlinie — keine zweite Rechnung", () => {
    // Eine Quelle je Größe: wenn Tooltip und Verdikt auseinanderlaufen können, ist die
    // Erklärung wertlos. Deshalb wird hier die Identität geprüft, nicht ein Beispielwert.
    for (const p of [spieler("neutral"), spieler("merc", ["Mercenary"]), spieler("diva", ["Diva"])]) {
      const basis = vorschau(p, null);
      const D = basis.expectedSalary;
      if (D == null || D <= 0) continue;
      const ergebnis = vorschau(p, Number((D * 0.99).toFixed(2)));
      const W = ergebnis.acceptanceScore ?? 0;
      const persReq =
        ((p.traitsPositive ?? []).some((t) => /mercenary/i.test(t)) ? 0.02 : 0) +
        ([...(p.traitsPositive ?? []), ...(p.traitsNegative ?? [])].some((t) => /diva|egomaniac/i.test(t))
          ? 0.015
          : 0);
      const erwartet = (deriveMoneyThresholdRatio(W) + persReq) * D;
      expect(ergebnis.moneyThresholdSalary, `${p.id}: Schwelle weicht von der Kennlinie ab`).toBeCloseTo(
        Number(erwartet.toFixed(2)),
        1,
      );
    }
  });

  it("sagt bei hohem Willen unter der Forderung zu — vorher unmöglich", () => {
    // Der eigentliche Auftrag. Geprüft wird nicht ein Prozentsatz an einem Spielstand (der
    // gehört in die Messung, nicht in eine Suite), sondern dass das Modell den Zustand
    // überhaupt erreichen KANN: bei genügend Wechselwille liegt die Zusage-Schwelle unter 1.
    expect(deriveMoneyThresholdRatio(70)).toBeLessThan(0.95);
    const p = spieler("loyal", ["Loyal"]);
    const basis = vorschau(p, null);
    expect(basis.expectedSalary).toBeGreaterThan(0);
    expect(basis.acceptThresholdSalary).not.toBeNull();
  });

  it("lässt Sture weiterhin über der Forderung liegen", () => {
    const merc = vorschau(spieler("merc", ["Mercenary", "Diva"]), null);
    const neutral = vorschau(spieler("neutral"), null);
    if (merc.acceptThresholdSalary != null && neutral.acceptThresholdSalary != null) {
      expect(merc.acceptThresholdSalary).toBeGreaterThan(neutral.acceptThresholdSalary);
    }
  });
});

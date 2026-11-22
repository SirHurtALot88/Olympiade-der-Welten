import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes, PlayerPotentialRecord } from "@/lib/data/olyDataTypes";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";
import { ENTWICKLUNGS_PARAMETER_STANDARD, entwicklungsKurve } from "@/lib/training/entwicklung-neu";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";

/**
 * Kleine Messung der Abnahme (Chris, 22.11.): eine Liga von 120 Spielern mit streuendem Training (SP), Leistung (PP) und
 * Fokus, gerechnet mit der echten Saisonend-Funktion. Die Zahlen der Messung am vollen Spiel (32 Teams, 5 Saisons) stehen
 * in docs/design/entwicklung-balance-22-11.md; dies hier ist der schnelle Waechter, dass die Form der Verteilung haelt.
 */

const BASIS: PlayerGeneratorAttributes = {
  power: 50, health: 50, stamina: 50, intelligence: 50, awareness: 50, determination: 50,
  speed: 50, dexterity: 50, charisma: 50, will: 50, spirit: 50, torment: 50,
};

function zufall(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function spieler(id: string, attribute: PlayerGeneratorAttributes, marktwert: number): Player {
  return {
    id, name: id, rating: 60, marketValue: marktwert, salaryDemand: 5, className: "Charger", race: "Human", alignment: "N", gender: "x",
    subclasses: [], traitsPositive: [], traitsNegative: [], coreStats: { pow: 55, spe: 55, men: 45, soc: 45 }, attributeSheetStats: attribute,
    preferredDisciplineIds: [], disciplineRatings: {}, disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "", flavorDe: "", fatigue: 0, form: 0, potential: 70, trainingMode: "mittel", trainingClass: null,
  };
}

type Lauf = { dominanz: number; ppRang: number; trainingSumme: number; abstand: number; marktwert: number; ausfall?: number };

/** Ein Spielstand mit `laeufe.length` Spielern; Einsaetze (Leistungszeilen) und Trainingsverlauf nach Vorgabe. */
function liga(laeufe: Lauf[], regel: "neu" | "alt" | null): { gs: GameState; spieler: Player[] } {
  const spielerListe: Player[] = [];
  const potential: PlayerPotentialRecord[] = [];
  const performances: GameState["seasonState"]["playerDisciplinePerformances"] = [];
  const results = Array.from({ length: 20 }, (_, i) => ({ id: `result-${i + 1}`, seasonId: "season-1", matchdayId: `md-${i + 1}`, status: "preview_applied" as const }));
  laeufe.forEach((lauf, i) => {
    const id = `p-${i}`;
    const p = spieler(id, BASIS, lauf.marktwert);
    const ziele = ["gewichtheben", "sprint", "hockey", "fechten"];
    const verlauf = Array.from({ length: 20 }, (_, tag) => {
      if (tag < (lauf.ausfall ?? 0)) return { m: `md-${tag + 1}`, s: "v" as const };
      const gehalten = tag / 20 < lauf.dominanz;
      return { m: `md-${tag + 1}`, s: "t" as const, d: gehalten ? ziele[0]! : ziele[(tag % 3) + 1]!, i: "mittel" as const, z: { power: lauf.trainingSumme / 20 } };
    });
    spielerListe.push({
      ...p,
      seasonTrainingAccumulator: { seasonId: "season-1", matchdaysCounted: 20, modeByMatchday: {}, accumulatedTrainingFatigue: 0, updatedAt: "2026-01-01T00:00:00.000Z", verlauf },
    });
    potential.push({
      playerId: id, potentialBand: "B", hiddenPotentialScore: 70, confidence: 80, source: "generated",
      hiddenAttributeCeiling: Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((a) => [a, BASIS[a] + lauf.abstand])),
    } as unknown as PlayerPotentialRecord);
    for (let e = 0; e < 14; e += 1) {
      const gut = lauf.ppRang;
      performances!.push({
        id: `perf-${i}-${e}`, matchdayResultId: `result-${e + 1}`, teamId: "team-1", playerId: id, activePlayerId: null, disciplineId: "gewichtheben",
        disciplineSide: "d1", slotIndex: 0, baseValue: 50, finalPlayerScore: 30 + 70 * gut, scoreContribution: 4 + 28 * gut,
        rankInTeam: 1, rankInDiscipline: gut > 0.9 ? 1 : gut > 0.6 ? 6 : gut > 0.3 ? 14 : 24, isTop10: gut > 0.6, isMvpCandidate: false, storyWeight: null, createdAt: "2026-01-01T00:00:00.000Z",
      });
    }
  });
  const gs = {
    gamePhase: "player_development",
    scenarioMeta: { gameMode: "battle" },
    season: { id: "season-1", name: "Season 1", currentMatchday: 20, totalMatchdays: 20, isCompleted: true },
    seasonState: {
      seasonId: "season-1", schedule: [], standings: {}, matchdayResults: results, playerDisciplinePerformances: performances, disciplineHighlights: [],
      ...(regel ? { entwicklungsRegel: { seasonId: "season-1", regel } } : {}),
    },
    matchdayState: { matchdayId: "md-20", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-1", name: "Team", shortCode: "T", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0 }],
    teamIdentities: [], players: spielerListe, disciplines: [],
    rosters: spielerListe.map((p, i) => ({ id: `r-${i}`, teamId: "team-1", playerId: p.id, salary: 5, marketValue: p.marketValue, contractLength: 2 })),
    contracts: [], transferListings: [], transferHistory: [], logs: [], playerPotential: potential,
    mappingReport: { mappingSource: "test", teamSource: "test", generatedAt: "2026-06-11T00:00:00.000Z", processedMappingRows: 0, importedPlayerCount: 1, matchedRosterCount: 1, warnings: [] },
  } as unknown as GameState;
  return { gs, spieler: spielerListe };
}

/** Gesamtentwicklung einer Saison = je Spieltag gebuchtes Training + Saisonend-Rechnung. */
function gesamt(gs: GameState, p: Player): number {
  const verlauf = p.seasonTrainingAccumulator?.verlauf ?? [];
  const gebucht = verlauf.reduce((s, z) => s + Object.values(z.z ?? {}).reduce((a, b) => a + (b as number), 0), 0);
  return gebucht + buildOrganicSeasonProgression({ gameState: gs, player: p, accumulatedBaseTrainingBudget: 0 }).netSetpoints;
}

const einfach = (o: Partial<Lauf> = {}): Lauf => ({ dominanz: 0.8, ppRang: 0.5, trainingSumme: 6, abstand: 25, marktwert: 30, ...o });

describe("Entwicklung neu: Saisonende (kleine Messung)", () => {
  it("PP bestimmen, wie viel Training ankommt: bessere Leistung, mehr Entwicklung; Fokus haelt mehr als Wechseln", () => {
    const { gs, spieler: s } = liga([einfach({ ppRang: 0.1 }), einfach({ ppRang: 0.5 }), einfach({ ppRang: 0.95 }), einfach({ dominanz: 0.3 }), einfach({ dominanz: 1 })], "neu");
    const [schwach, mitte, stark, wechsler, halter] = s.map((p) => gesamt(gs, p));
    expect(stark!).toBeGreaterThan(mitte!);
    expect(mitte!).toBeGreaterThan(schwach!);
    expect(halter!).toBeGreaterThan(wechsler!);
  });

  it("ein Schub will verdient sein: ohne gehaltenes Ziel oder ohne Leistung ueber dem Median bleibt es unter +8", () => {
    // Im Umfeld ein breites Mittelfeld, damit der Leistungsrang aussagekraeftig ist.
    const umfeld = Array.from({ length: 40 }, (_, i) => einfach({ ppRang: i / 39, trainingSumme: 5 }));
    const gross = { trainingSumme: 15, abstand: 30, marktwert: 6 } as const;
    const { gs, spieler: s } = liga([...umfeld, einfach({ ...gross, ppRang: 0.97, dominanz: 1 }), einfach({ ...gross, ppRang: 0.97, dominanz: 0.3 }), einfach({ ...gross, ppRang: 0.2, dominanz: 1 })], "neu");
    const [verdient, ohneFokus, ohneLeistung] = s.slice(40).map((p) => gesamt(gs, p));
    expect(verdient!).toBeGreaterThanOrEqual(8);
    expect(ohneFokus!).toBeLessThan(8);
    expect(ohneLeistung!).toBeLessThan(8);
  });

  it("abnehmende Ertraege: je naeher an der Decke, desto weniger Entwicklung", () => {
    const { gs, spieler: s } = liga([einfach({ abstand: 30 }), einfach({ abstand: 8 }), einfach({ abstand: 2 })], "neu");
    // Vor der Entwicklungskurve: der Wachstumsfaktor der Leistung faellt stetig mit dem Abstand zur Decke.
    const faktoren = s.map((p) => buildOrganicSeasonProgression({ gameState: gs, player: p, accumulatedBaseTrainingBudget: 0 }).attributeBreakdown.find((e) => e.attribute === "power")!);
    const ergebnisse = faktoren.map((e) => e.performanceGrowthMultiplier);
    expect(ergebnisse[0]!).toBeGreaterThan(ergebnisse[1]!);
    expect(ergebnisse[1]!).toBeGreaterThan(ergebnisse[2]!);
  });

  it("Verletzte Spieler (Ausfalltage) bauen zusaetzlich ab", () => {
    const { gs, spieler: s } = liga([einfach({ ausfall: 0, trainingSumme: 4 }), einfach({ ausfall: 6, trainingSumme: 4 })], "neu");
    const [gesund, verletzt] = s.map((p) => gesamt(gs, p));
    expect(verletzt!).toBeLessThan(gesund!);
  });

  it("ohne Stempel und mit alt rechnet die alte Regel, bit-gleich", () => {
    const l = [einfach(), einfach({ ppRang: 0.9 }), einfach({ dominanz: 0.2 })];
    const ohne = liga(l, null);
    const alt = liga(l, "alt");
    ohne.spieler.forEach((p, i) => {
      const a = buildOrganicSeasonProgression({ gameState: ohne.gs, player: p });
      const b = buildOrganicSeasonProgression({ gameState: alt.gs, player: alt.spieler[i]! });
      expect(b.attributeDeltas).toEqual(a.attributeDeltas);
    });
  });

  it("Liga von 120 Spielern: Mittel nahe 0, wenige stark besser/schlechter, die Masse kaum veraendert", () => {
    const r = zufall(7);
    const laeufe: Lauf[] = Array.from({ length: 120 }, () => ({
      dominanz: 0.2 + 0.8 * r(),
      ppRang: r(),
      // Trainingssumme wie am vollen Spiel: Median 5,8, Mehrheit 2 bis 8, wenige ueber 11.
      trainingSumme: 1.5 + 12 * r() ** 2.2,
      abstand: 6 + 30 * r(),
      marktwert: 3 + 30 * r() ** 2.2,
      ausfall: r() < 0.2 ? Math.round(1 + 3 * r()) : 0,
    }));
    const { gs, spieler: s } = liga(laeufe, "neu");
    const netto = s.map((p) => gesamt(gs, p));
    const mittel = netto.reduce((a, b) => a + b, 0) / netto.length;
    const anteil = (f: (x: number) => boolean) => netto.filter(f).length / netto.length;
    // Die Regelgroessen sind am echten Spiel geeicht; die kuenstliche Liga hier trifft sie nur grob.
    expect(Math.abs(mittel)).toBeLessThan(2);
    expect(anteil((x) => Math.abs(x) <= 2)).toBeGreaterThan(0.4);
    expect(anteil((x) => x >= 8)).toBeLessThan(0.2);
    expect(anteil((x) => x <= -8)).toBeLessThan(0.15);
    // Staerke der Kurve: nichts ueber dem Deckel.
    for (const x of netto) expect(Math.abs(x)).toBeLessThanOrEqual(ENTWICKLUNGS_PARAMETER_STANDARD.kurveMax + 1);
    expect(entwicklungsKurve(1, ENTWICKLUNGS_PARAMETER_STANDARD)).toBeLessThan(1);
  });
});

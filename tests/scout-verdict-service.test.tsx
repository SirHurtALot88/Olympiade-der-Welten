/**
 * Scout-Urteil (Note 1+ bis 6, Empfehlung, Bericht) und seine Anzeige (FM27-Bewertungskreis).
 * Konzept: docs/design/scouting-ausbau-konzept-11-11.md, Abschnitte 1–3.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ScoutGradeRing from "@/app/foundation/scouting-center-v2/ScoutGradeRing";
import ScoutVerdictReport from "@/app/foundation/scouting-center-v2/ScoutVerdictReport";
import ScoutingPriorityQueue, { type ScoutingQueueRow } from "@/app/foundation/scouting-center-v2/ScoutingPriorityQueue";
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import {
  buildScoutVerdict,
  formatScoutGradeDisplay,
  getScoutGradeVisibility,
  getScoutRecommendation,
  scoreToScoutGrade,
  type ScoutVerdict,
} from "@/lib/scouting/scout-verdict-service";

const TEAM = "M-M";

function player(id: string, axes: { pow: number; spe: number; men: number; soc: number }, marketValue: number): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue,
    salaryDemand: 2,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: axes,
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 70,
    trainingMode: null,
  } as Player;
}

/**
 * Kader: acht solide, aber auf SOC schwache Spieler. Markt: Vergleichsspieler aller Stärken zu
 * einem Preis, der mit der Stärke steigt (Ø-Achse 40 → 10 Mio, 60 → 30 Mio).
 */
function buildState(candidates: Player[], certaintyByPlayerId: Record<string, number> = {}): GameState {
  const roster = Array.from({ length: 8 }, (_, index) => player(`r-${index}`, { pow: 50, spe: 48, men: 46, soc: 30 }, 15));
  const market = Array.from({ length: 30 }, (_, index) => {
    const level = 35 + index; // Ø-Achse 35..64
    return player(`m-${index}`, { pow: level, spe: level, men: level, soc: level }, Math.max(1, level - 30));
  });
  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      transferWishlist: [],
      scoutIntelByTeamId: {
        [TEAM]: Object.entries(certaintyByPlayerId).map(([playerId, certainty]) => ({
          playerId,
          teamId: TEAM,
          seasonId: "season-2",
          source: "wishlist_mirror" as const,
          certainty,
          startedAt: "2026-06-25T00:00:00.000Z",
          lastTickAt: null,
          ticksCompleted: 0,
        })),
      },
      teamFacilities: { [TEAM]: { facilities: { scouting_office: { level: 1, enabled: true } } } },
    },
    teams: [{ teamId: TEAM, name: "Mayhem", shortCode: TEAM, budget: 100, cash: 500, identityId: TEAM, humanControlled: true, rosterLimit: 14 }],
    teamIdentities: [{ teamId: TEAM, playerMin: 7, playerOpt: 10 }],
    players: [...roster, ...market, ...candidates],
    rosters: roster.map((entry) => ({ id: entry.id, teamId: TEAM, playerId: entry.id })),
    disciplines: [],
  } as unknown as GameState;
}

describe("Scout-Note: Skala 1+ bis 6", () => {
  it("legt 16 Stufen gleichmäßig auf den Empfehlungswert 0..100", () => {
    expect(scoreToScoutGrade(100).label).toBe("1+");
    expect(scoreToScoutGrade(92).label).toBe("1+");
    expect(scoreToScoutGrade(91.9).label).toBe("1");
    expect(scoreToScoutGrade(74).label).toBe("2+");
    expect(scoreToScoutGrade(50)).toEqual({ label: "3", whole: 3 });
    expect(scoreToScoutGrade(8).label).toBe("5−");
    expect(scoreToScoutGrade(7.9)).toEqual({ label: "6", whole: 6 });
  });

  it("ordnet jeder ganzen Note eine Empfehlung zu, unbekannt bleibt ohne Urteil", () => {
    expect(getScoutRecommendation(1)).toEqual({ label: "Sofort holen", tone: "elite" });
    expect(getScoutRecommendation(2).label).toBe("Klare Empfehlung");
    expect(getScoutRecommendation(3).label).toBe("Solide Option");
    expect(getScoutRecommendation(4).label).toBe("Nur als Ergänzung");
    expect(getScoutRecommendation(6).label).toBe("Finger weg");
    expect(getScoutRecommendation(null).label).toBe("Noch kein Urteil");
  });

  it("zeigt die Note erst mit dem Scouting-Fortschritt schärfer: ? → Spanne → ≈ → genau", () => {
    expect(getScoutGradeVisibility(10)).toBe("unknown");
    expect(getScoutGradeVisibility(30)).toBe("range");
    expect(getScoutGradeVisibility(70)).toBe("approx");
    expect(getScoutGradeVisibility(100)).toBe("exact");
    expect(getScoutGradeVisibility(5, true)).toBe("exact");

    const base = { exactGrade: "2+", wholeGrade: 2, playerId: "x" };
    expect(formatScoutGradeDisplay({ ...base, visibility: "unknown" })).toEqual({ display: "?", wholeForLabel: null });
    expect(formatScoutGradeDisplay({ ...base, visibility: "approx" }).display).toBe("≈2");
    expect(formatScoutGradeDisplay({ ...base, visibility: "exact" }).display).toBe("2+");
    // Spanne: enthält die echte Note, bleibt in 1..6 und ist je Spieler stabil.
    for (const wholeGrade of [1, 2, 3, 4, 5, 6]) {
      for (const playerId of ["a", "b", "c", "d"]) {
        const first = formatScoutGradeDisplay({ exactGrade: String(wholeGrade), wholeGrade, playerId, visibility: "range" });
        const again = formatScoutGradeDisplay({ exactGrade: String(wholeGrade), wholeGrade, playerId, visibility: "range" });
        expect(first).toEqual(again);
        const [low, high] = first.display.split("–").map(Number);
        expect(low).toBeGreaterThanOrEqual(1);
        expect(high).toBeLessThanOrEqual(6);
        expect(high - low).toBe(1);
        expect([low, high]).toContain(wholeGrade);
      }
    }
  });
});

describe("buildScoutVerdict", () => {
  const star = player("star", { pow: 52, spe: 50, men: 50, soc: 72 }, 6);
  const dud = player("dud", { pow: 36, spe: 34, men: 33, soc: 22 }, 25);

  it("empfiehlt einen günstigen Spieler, der die SOC-Lücke schließt — mit Begründung", () => {
    const verdict = buildScoutVerdict({ gameState: buildState([star, dud]), teamId: TEAM, playerId: "star", forceVisible: true })!;
    expect(verdict.visibility).toBe("exact");
    expect(verdict.displayWholeGrade).toBeLessThanOrEqual(2);
    expect(["Sofort holen", "Klare Empfehlung"]).toContain(verdict.recommendation);
    const byId = Object.fromEntries(verdict.criteria.map((entry) => [entry.id, entry]));
    expect(byId.gap?.tone).toBe("positive");
    expect(byId.gap?.text).toContain("SOC");
    expect(byId.price?.tone).toBe("positive");
    expect(byId.skill?.tone).toBe("positive");
    expect(verdict.summary).toMatch(/^Ich würde ihn holen/);
    // Einordnung wie im Transfermarkt: Rang im Kader je Achse, SOC wäre die Nr. 1.
    const soc = verdict.axisComparison.find((row) => row.axis === "soc")!;
    expect(soc.rankLabel).toBe("#1/9");
    expect(soc.value).toBe(72);
  });

  it("rät von einem teuren, schwachen Spieler ab", () => {
    const verdict = buildScoutVerdict({ gameState: buildState([star, dud]), teamId: TEAM, playerId: "dud", forceVisible: true })!;
    expect(verdict.displayWholeGrade).toBeGreaterThanOrEqual(4);
    const byId = Object.fromEntries(verdict.criteria.map((entry) => [entry.id, entry]));
    expect(byId.price?.tone).toBe("negative");
    expect(byId.skill?.tone).toBe("negative");
    expect(verdict.summary).toMatch(/^Ich rate ab/);
  });

  it("verrät unter Nebel weder Note noch Achswerte — aber der Empfehlungswert ist derselbe", () => {
    const state = buildState([star]);
    const hidden = buildScoutVerdict({ gameState: state, teamId: TEAM, playerId: "star", forceVisible: false })!;
    const open = buildScoutVerdict({ gameState: state, teamId: TEAM, playerId: "star", forceVisible: true })!;
    expect(hidden.scoutingPercent).toBe(0);
    expect(hidden.gradeDisplay).toBe("?");
    expect(hidden.recommendation).toBe("Noch kein Urteil");
    expect(hidden.axisComparison.every((row) => row.value == null && row.rankLabel == null)).toBe(true);
    expect(hidden.criteria.find((entry) => entry.id === "skill")?.tone).toBe("neutral");
    expect(hidden.score).toBe(open.score);

    // Halb gescoutet (Level 1: voll ab 100 Certainty): Spanne, Ränge als Schätzung.
    const half = buildScoutVerdict({ gameState: buildState([star], { star: 40 }), teamId: TEAM, playerId: "star", forceVisible: false })!;
    expect(half.scoutingPercent).toBe(40);
    expect(half.visibility).toBe("range");
    expect(half.gradeDisplay).toMatch(/^\d–\d$/);
    expect(half.axisComparison.every((row) => row.value == null)).toBe(true);
    expect(half.axisComparison.find((row) => row.axis === "soc")?.rankLabel).toMatch(/^ca\. #/);
  });
});

describe("Bewertungskreis und Scout-Bericht (Render)", () => {
  const verdict = buildScoutVerdict({
    gameState: buildState([player("star", { pow: 52, spe: 50, men: 50, soc: 72 }, 6)], { star: 64 }),
    teamId: TEAM,
    playerId: "star",
    forceVisible: false,
  }) as ScoutVerdict;

  it("zeigt Ring-Fortschritt = Scouting-%, Note in der Mitte und die Empfehlung", () => {
    const html = renderToStaticMarkup(<ScoutGradeRing verdict={verdict} size="md" showLabel onClick={() => {}} />);
    expect(html).toContain('data-percent="64"');
    expect(html).toContain(`>${verdict.gradeDisplay}<`);
    expect(verdict.gradeDisplay).toMatch(/^≈\d$/);
    expect(html).toContain("64%");
    expect(html).toContain(verdict.recommendation);
    expect(html).toContain("Scout-Bericht öffnen");
    expect(html).toContain("<button");
  });

  it("der Bericht zeigt Fazit, alle Kriterien und die POW/SPE/MEN/SOC-Einordnung", () => {
    const html = renderToStaticMarkup(<ScoutVerdictReport verdict={verdict} playerName="Star" />);
    expect(html).toContain('data-testid="scout-verdict-summary"');
    for (const id of ["skill", "gap", "complement", "fit", "price"]) {
      expect(html).toContain(`data-testid="scout-verdict-criterion-${id}"`);
    }
    expect(html).toContain("Einordnung im Kader");
    for (const axis of ["POW", "SPE", "MEN", "SOC"]) {
      expect(html).toContain(`<b>${axis}</b>`);
    }
  });

  it("die Warteschlange trägt je Zeile einen Kreis und trennt die Wartenden ab", () => {
    const row = (playerId: string, queueState: ScoutingQueueRow["queueState"]): ScoutingQueueRow => ({
      playerId,
      playerName: playerId,
      className: "Hero",
      race: "Human",
      certainty: 40,
      effectiveScoutingLevel: 2,
      isActiveSlot: queueState === "active",
      isFocusTarget: false,
      isFullyScouted: queueState === "completed",
      queueState,
      verdict: { ...verdict, playerId },
    });
    const html = renderToStaticMarkup(
      <ScoutingPriorityQueue
        entries={[row("a", "active"), row("b", "completed"), row("c", "waiting"), row("d", "waiting")]}
        slotLimit={10}
        onReorder={() => {}}
        onOpenPlayer={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(html.match(/data-testid="scout-grade-ring"/g)).toHaveLength(4);
    expect(html.match(/data-testid="scouting-queue-divider-waiting"/g)).toHaveLength(1);
    expect(html).toContain("Wartet auf freien Scout-Slot — 10 werden gleichzeitig gescoutet");
    expect(html).toContain("is-completed");
  });
});

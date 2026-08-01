import { describe, expect, it } from "vitest";

import {
  buildAiLegacyLineupModifiers,
  buildAiLegacyLineupPreviewWithModifiers,
  resolveNegativeFormCardSides,
} from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

// ===========================================================================================
// Kapitaen vs. negative Formkarte (Meldung Chris, 31.07.)
// -------------------------------------------------------------------------------------------
// „Es gibt immer noch mehrere Teams, die wenn sie schlechter in einer Diszi sind korrekt eine
// negative Formkarte reinschmeissen, aber dann dennoch den Captain auswaehlen."
//
// Der Fixture baut genau diese Konstellation: d1 ist die Seite mit dem staerksten Einzelspieler
// (also der Kapitaens-Favorit) UND zugleich der billigste Platz fuer die Minuskarte (kleinste
// Diszi im Restspielplan). Ohne Kopplung faellt beides zusammen auf d1.
// ===========================================================================================

function createCaptainVsFormCardContext(): LegacyLineupLoadedContext {
  // Restspielplan: nur der aktuelle Spieltag hat kleine 3er-Disziplinen, alles Spaetere ist
  // gross (6er). Damit ist MD1/d1 der billigste Platz fuer eine Minuskarte — der Saisonplan
  // legt sie dorthin, ohne dass der Test die Wahl von Hand setzen muesste.
  const laterMatchdays = Array.from({ length: 9 }, (_, index) => ({
    matchdayIndex: index + 2,
    matchdayId: `matchday-${index + 2}`,
    discipline1: { disciplineId: `later-a-${index}`, category: "mental", playerCount: 6 },
    discipline2: { disciplineId: `later-b-${index}`, category: "social", playerCount: 6 },
  }));

  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: "A-A",
    entries: [],
    disciplinePlayerCounts: { tdm: 3, spurt: 3 },
    disciplineSidePlayerCounts: { "tdm::d1": 3, "spurt::d2": 3 },
    activePlayers: Array.from({ length: 6 }, (_, index) => ({
      id: `a${index + 1}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: `p${index + 1}`,
      upkeep: 10,
    })),
    // d1 traegt den staerksten Einzelspieler (79) — dort will die Kapitaenswahl hin.
    // d2 ist als Seite geschlossener (76/75/74) und damit "strong" in der Wettbewerbslage,
    // wird also von der Minuskarte verschont.
    disciplineScores: [
      { playerId: "p1", disciplineId: "tdm", score: 79 },
      { playerId: "p2", disciplineId: "tdm", score: 70 },
      { playerId: "p3", disciplineId: "tdm", score: 69 },
      { playerId: "p4", disciplineId: "spurt", score: 76 },
      { playerId: "p5", disciplineId: "spurt", score: 75 },
      { playerId: "p6", disciplineId: "spurt", score: 74 },
      { playerId: "p1", disciplineId: "spurt", score: 20 },
      { playerId: "p2", disciplineId: "spurt", score: 19 },
      { playerId: "p3", disciplineId: "spurt", score: 18 },
      { playerId: "p4", disciplineId: "tdm", score: 20 },
      { playerId: "p5", disciplineId: "tdm", score: 19 },
      { playerId: "p6", disciplineId: "tdm", score: 18 },
    ],
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: "A-A", shortCode: "A-A", name: "Alpha" },
    teamSeasonState: {
      id: "tss-1",
      saveId: "save-1",
      seasonId: "season-1",
      teamId: "A-A",
      cash: 500,
      budget: 1000,
      rosterLimit: 8,
      playerOpt: 6,
    },
    teamIdentity: { pow: 60, spe: 60, men: 60, soc: 60 },
    rosterPlayers: Array.from({ length: 6 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Player ${index + 1}`,
      coreStats: { pow: 60, spe: 60, men: 60, soc: 60 },
      fatigue: 0,
    })),
    disciplines: [
      { id: "tdm", name: "TDM", category: "power" },
      { id: "spurt", name: "Spurt", category: "speed" },
    ],
    disciplineWeights: [
      { disciplineId: "tdm", attributeKey: "power", weightPct: 40 },
      { disciplineId: "spurt", attributeKey: "speed", weightPct: 40 },
    ],
    seasonDisciplineConfigs: [
      { disciplineId: "tdm", originalOrder: 1, displayOrder: 1, playerCount: 3, mutator1: null, mutator2: null },
      { disciplineId: "spurt", originalOrder: 2, displayOrder: 2, playerCount: 3, mutator1: null, mutator2: null },
    ],
    // d1 im umkaempften Mittelfeld (hoher Kapitaens-Hebel), aber nur "neutral" in der
    // Wettbewerbslage; d2 ist "strong" (Rang <= 12 und bester Score >= 76) und damit gegen
    // Minuskarten geschuetzt.
    teamDisciplineRanks: {
      tdm: { rank: 14, score: 300, sourceStatus: "mapped" },
      spurt: { rank: 10, score: 320, sourceStatus: "mapped" },
    },
    teamStatus: {
      lineupFilledCount: 0,
      totalLineupSides: 20,
      captainUsedCount: 0,
      captainSlots: 3,
      displayLabel: "A-A · Captain 0/3",
    },
    captainRule: {
      seasonCaptainSlots: 3,
      perDisciplineSideMaxCaptains: 1,
      sourceStatus: "mapped_with_transform",
    },
    formCards: [
      {
        id: "neg-1",
        playerId: "p1",
        playerName: "Player 1",
        // Gelb trifft weder power (rot) noch speed (blau) — kein Farb-Doppelmalus, die Karte
        // ist also die harmloseste denkbare Variante und trotzdem eine Abwertung.
        color: "yellow" as const,
        value: -6,
        isUsed: false,
        usedByLineupId: null,
      },
    ],
    seasonDisciplineSchedule: [
      {
        matchdayIndex: 1,
        matchdayId: "matchday-1",
        discipline1: { disciplineId: "tdm", category: "power", playerCount: 3 },
        discipline2: { disciplineId: "spurt", category: "speed", playerCount: 3 },
      },
      ...laterMatchdays,
    ],
    matchdayContract: {
      matchdayId: "matchday-1",
      matchdayLabel: "MD1",
      matchdayIndex: 1,
      discipline1: {
        disciplineId: "tdm",
        displayName: "TDM",
        requiredPlayers: 3,
        requiredCaptains: 1,
        category: "power",
        rankSource: null,
        rankSourceStatus: "mapped",
        sourceStatus: "season_seed",
        disciplineSide: "d1",
      },
      discipline2: {
        disciplineId: "spurt",
        displayName: "Spurt",
        requiredPlayers: 3,
        requiredCaptains: 1,
        category: "speed",
        rankSource: null,
        rankSourceStatus: "mapped",
        sourceStatus: "season_seed",
        disciplineSide: "d2",
      },
      seasonCaptainSlots: 3,
      totalDisciplineSidesInSeason: 20,
    },
    existingDraft: null,
    contextMeta: {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "A-A",
      d1DisciplineId: "tdm",
      d2DisciplineId: "spurt",
    },
  } as unknown as LegacyLineupLoadedContext;
}

describe("Kapitaen und negative Formkarte schliessen sich aus", () => {
  // Vorbedingung: Der Fixture reproduziert die gemeldete Konstellation ueberhaupt. Ohne diese
  // Zusicherung koennte der Kerntest gruen sein, weil gar keine Minuskarte faellt.
  it("legt die Minuskarte auf d1 und laesst d2 sauber (Vorbedingung der Meldung)", () => {
    const context = createCaptainVsFormCardContext();
    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 1, playerId: "p2", activePlayerId: "a2" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 2, playerId: "p3", activePlayerId: "a3" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 0, playerId: "p4", activePlayerId: "a4" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 1, playerId: "p5", activePlayerId: "a5" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 2, playerId: "p6", activePlayerId: "a6" },
    ]);

    expect(modifiers.d1.primaryFormCardId).toBe("neg-1");
    expect(resolveNegativeFormCardSides(context, modifiers)).toEqual(new Set(["d1"]));
  });

  // Der eigentliche Befund: ohne Kopplung waehlt die Kapitaenswahl genau die Seite, die der
  // Formkarten-Zug gerade abwertet. Dieser Test pinnt die ALTE Reihenfolge (Kapitaen ohne
  // Formkarten-Wissen) — er belegt, dass der Fixture den Fehler wirklich ausloest.
  it("wuerde den Kapitaen ohne Kopplung auf die Minuskarten-Seite setzen", () => {
    const preview = buildAiLegacyLineupPreview(createCaptainVsFormCardContext(), "sqlite");
    const captain = preview.entries.find((entry) => entry.isCaptain);

    expect(captain?.disciplineSide).toBe("d1");
  });

  it("setzt den Kapitaen nicht in die Disziplin, in der die Minuskarte faellt", () => {
    const { preview, modifiers } = buildAiLegacyLineupPreviewWithModifiers(createCaptainVsFormCardContext(), "sqlite");
    const negativeSides = resolveNegativeFormCardSides(createCaptainVsFormCardContext(), modifiers);
    const captainSides = preview.entries.filter((entry) => entry.isCaptain).map((entry) => entry.disciplineSide);

    // Die Konstellation tritt ein ...
    expect([...negativeSides]).toEqual(["d1"]);
    // ... und der Kapitaen ist trotzdem nicht dort.
    expect(captainSides).not.toContain("d1");
    // Der Slot wird auch nicht verschenkt: die saubere Seite bekommt ihn.
    expect(captainSides).toEqual(["d2"]);
    expect(preview.captainDecisions.join(" | ")).toContain("negative Formkarte");
  });

  it("laesst die Kapitaenswahl unveraendert, wenn die Seite unterm Strich AUFGEWERTET wird", () => {
    // Grenzfall: Minuskarte plus groessere Pluskarte auf derselben Seite. Die Netto-Formbilanz
    // ist positiv — das Team schreibt hier nichts ab und darf den Kapitaen behalten.
    const context = createCaptainVsFormCardContext();
    const modifiers = buildAiLegacyLineupModifiers(context, []);
    modifiers.d1.primaryFormCardId = "neg-1";
    modifiers.d1.secondaryFormCardId = "pos-1";
    context.formCards = [
      ...(context.formCards ?? []),
      {
        id: "pos-1",
        playerId: "p2",
        playerName: "Player 2",
        color: "yellow" as const,
        value: 8,
        isUsed: false,
        usedByLineupId: null,
      },
    ] as typeof context.formCards;

    expect(resolveNegativeFormCardSides(context, modifiers).has("d1")).toBe(false);
  });
});

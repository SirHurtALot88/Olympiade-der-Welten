/**
 * CHRIS AM 23.08.2026: „eigentlich gibts aktuell keine team power die darf auch nicht im scoring
 * vorkommen."
 *
 * ES GAB SCHON EINEN RIEGEL — UND ER SASS AN DER FALSCHEN STELLE.
 * `tests/team-powers-disabled.test.ts` prueft das Modul `lib/lineups/team-powers.ts`: der Schalter
 * steht aus, es werden keine Optionen angeboten, der Modifier ist 0, der Passivbonus ist 0. Alles
 * richtig — und alles ueber Funktionen, die der Score-Engine nur ZULIEFERN.
 *
 * Die Wertung selbst rechnet in `lib/lineups/legacy-score-engine.ts`:
 *
 *   const totalScore = roundPreviewScore(prePowerScore + (teamPowerModifier ?? 0));
 *
 * `teamPowerModifier` ist dort ein EINGABEWERT. Die Engine fragt den Schalter nicht; sie addiert,
 * was der Aufrufer ihr reicht. Kein Test lief bisher ueber die ganze Kette — Kontext mit Powers,
 * Entwurf mit gespeicherter `teamPowerId`, echte Vorschau — und hielt fest, dass am Ende NICHTS
 * ankommt.
 *
 * AM LIVE-ABBILD VOM 23.08. GEMESSEN (`scripts/messe-team-power-im-scoring.ts`): ueber alle sieben
 * Spielstaende und 224 Teams werden 0 Power-Optionen angeboten. Es liegen aber 2131 gespeicherte
 * `teamPowers` in den Spielstaenden, und in `n90y4m` tragen 13 Aufstellungs-Entwuerfe weiter eine
 * `teamPowerId`. Sie sind heute wirkungslos — dieser Test haelt fest, dass sie es bleiben.
 *
 * GEGENPROBE IST TEIL DES TESTS, nicht nur der Notiz: der letzte Fall legt den Schalter kurz um
 * und prueft, dass der Score sich DANN sehr wohl aendert. Ohne ihn wuesste niemand, ob die
 * Nullmessung vom Schalter kommt oder von einem Fixture, in dem ohnehin nichts steht.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __setTeamPowersEnabledForTests,
  areTeamPowersEnabled,
  calculatePassiveTeamPowerBonus,
  calculateTeamPowerModifierForSide,
  type LegacyTeamPowerOption,
} from "@/lib/lineups/team-powers";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";

/** Eine Power, wie sie in einem Spielstand liegt — modelliert nach den 2131 gemessenen. */
function power(partial?: Partial<LegacyTeamPowerOption>): LegacyTeamPowerOption {
  return {
    id: "power-1",
    label: "Warpath Power Surge",
    description: "Test",
    category: "flex",
    effectType: "self_boost",
    targetMode: "self",
    targetLimit: 0,
    conditionalBonusPct: 0,
    conditionalTrigger: null,
    conditionalDescription: null,
    source: "team_identity",
    sourceFacilityId: null,
    modifier: 6,
    positiveAttributeTags: ["power", "torment"],
    negativeAttributeTag: "awareness",
    chargesTotal: 4,
    chargesUsed: 0,
    chargesRemaining: 4,
    selectedForSeason: true,
    isUsedUp: false,
    isPassive: false,
    ...partial,
  };
}

/**
 * Faehrt die Score-Engine GENAU SO, wie die Vorschau sie faehrt: die Team-Power-Terme kommen aus
 * `calculateTeamPowerModifierForSide` und `calculatePassiveTeamPowerBonus`, nicht von Hand gesetzt.
 * Damit laeuft der Schalter wirklich mit — an ihm haengt der ganze Fall.
 */
function scoreMitPowers(powers: LegacyTeamPowerOption[]) {
  const teamPowerResult = calculateTeamPowerModifierForSide({
    modifiers: { d1: { teamPowerId: "power-1" }, d2: {} } as never,
    disciplineSide: "d1",
    disciplineCategory: "power",
    teamPowers: powers,
  });
  const passiverBonus = calculatePassiveTeamPowerBonus(powers, "power");

  return scoreLegacyLineupDisciplineSide({
    disciplineId: "disziplin-1",
    disciplineSide: "d1",
    matchdayId: "md-1",
    // `disciplineId`/`disciplineSide` MUESSEN dranstehen: die Engine filtert die Eintraege genau
    // darauf. Ohne sie ist `allSideEntries` leer, der Score 0 — und jede Null in diesem Test waere
    // eine Null aus einer leeren Menge statt ein Beleg. Genau so war meine erste Fassung.
    entries: [
      { disciplineId: "disziplin-1", disciplineSide: "d1", playerId: "spieler-1", activePlayerId: "aktiv-1", slotIndex: 0, isCaptain: true },
      { disciplineId: "disziplin-1", disciplineSide: "d1", playerId: "spieler-2", activePlayerId: "aktiv-2", slotIndex: 1, isCaptain: false },
    ],
    disciplineScores: [
      { playerId: "spieler-1", disciplineId: "disziplin-1", score: 80 },
      { playerId: "spieler-2", disciplineId: "disziplin-1", score: 70 },
    ],
    activePlayers: [
      { id: "aktiv-1", saveId: "s", seasonId: "season-1", teamId: "T-1", playerId: "spieler-1" },
      { id: "aktiv-2", saveId: "s", seasonId: "season-1", teamId: "T-1", playerId: "spieler-2" },
    ],
    // `rosterPlayers` wird nach `player.id` indiziert, nicht nach `playerId`.
    rosterPlayers: [
      { id: "spieler-1", name: "Erster" },
      { id: "spieler-2", name: "Zweiter" },
    ],
    requiredPlayers: 2,
    intensity: "normal",
    // Die Quelle steht ausdruecklich auf „ready" — sonst gaebe es einen zweiten, falschen Grund
    // fuer eine Null, und der Fall belegte wieder nichts.
    teamPowerStatus: "ready",
    teamPowerSelected: teamPowerResult.teamPowerSelected,
    teamPowerLabel: teamPowerResult.teamPowerLabel,
    teamPowerModifier: teamPowerResult.teamPowerModifier,
    teamPowerImpact: teamPowerResult.teamPowerImpact,
    passiveTeamPowerImpactPct: passiverBonus,
    teamPowerEffectType: powers[0]?.effectType ?? null,
    teamPowerTargetMode: powers[0]?.targetMode ?? null,
    teamPowerTargetLimit: powers[0]?.targetLimit ?? null,
  } as never);
}

const AUSGANGSZUSTAND = areTeamPowersEnabled();

beforeEach(() => {
  __setTeamPowersEnabledForTests(AUSGANGSZUSTAND);
});

afterEach(() => {
  __setTeamPowersEnabledForTests(AUSGANGSZUSTAND);
});

describe("Team-Power kommt nicht im Scoring vor", () => {
  it("steht der Schalter im ausgelieferten Zustand auf aus", () => {
    // Der Ausgangszustand ist das, womit das Spiel laeuft — nicht das, was ein frueherer Fall
    // gesetzt hat.
    expect(AUSGANGSZUSTAND).toBe(false);
  });

  it("addiert nichts, obwohl der Entwurf eine Power nennt und der Spielstand welche fuehrt", () => {
    const ergebnis = scoreMitPowers([power(), power({ id: "power-2", isPassive: true })]);
    // 0, nicht null: die Quelle steht auf „ready", also rechnet die Engine
    // `prePowerScore * 0 / 100` und schreibt eine echte Null hin. Addiert wird trotzdem nichts.
    expect(ergebnis.teamPowerModifier).toBe(0);
    expect(ergebnis.teamPowerImpact).toBe(0);
    expect(ergebnis.teamPowerSelected).toBe(0);
    expect(ergebnis.teamPowerLabel).toBeNull();
  });

  it("wertet ueberhaupt etwas — sonst waere jede Gleichheit unten geschenkt", () => {
    // DIESER FALL STEHT HIER, WEIL MEINE ERSTE FASSUNG IHN GEBRAUCHT HAETTE. Sie liess
    // `disciplineId`/`disciplineSide` an den Eintraegen weg; die Engine filterte alles heraus und
    // lieferte `entries: []` und Score 0. Alle Nullen darunter waren gruen — und belegten nichts.
    const ergebnis = scoreMitPowers([power()]);
    expect(ergebnis.entries.length).toBe(2);
    expect(ergebnis.finalPreviewScore).toBeGreaterThan(0);
  });

  it("laesst den Endscore gleich, ob Powers im Spielstand liegen oder nicht", () => {
    const mitPowers = scoreMitPowers([power(), power({ id: "power-2", isPassive: true })]);
    const ohnePowers = scoreMitPowers([]);
    // DAS ist Chris' Satz in einer Zusage: die Zahl, die am Ende in die Wertung geht, kennt
    // Team-Powers nicht.
    expect(mitPowers.finalPreviewScore).toBe(ohnePowers.finalPreviewScore);
    expect(mitPowers.finalPreviewScore).toBeGreaterThan(0);
  });

  it("meldet die abgeschaltete Mechanik nicht als fehlende Quelle", () => {
    // Eine abgeschaltete Mechanik ist kein Fehlerfall. Eine Warnung hier waere Rauschen in einer
    // Liste, die der Spieler ernst nehmen soll.
    const ergebnis = scoreMitPowers([power()]);
    expect(ergebnis.warnings ?? []).not.toContain(
      "Team-Power source is missing for disziplin-1/d1.",
    );
  });

  it("GEGENPROBE: mit umgelegtem Schalter aendert sich der Score sehr wohl", () => {
    const aus = scoreMitPowers([power(), power({ id: "power-2", isPassive: true })]);
    __setTeamPowersEnabledForTests(true);
    const an = scoreMitPowers([power(), power({ id: "power-2", isPassive: true })]);
    // Ohne diesen Fall koennte das Fixture schlicht leer sein und alle Nullen oben waeren
    // bedeutungslos. Er belegt, dass die Powers wirken WUERDEN — und nur der Schalter sie haelt.
    expect(an.finalPreviewScore).not.toBe(aus.finalPreviewScore);
    expect(an.teamPowerModifier).not.toBeNull();
  });
});

/**
 * VERLETZUNGEN DÜRFEN EINE GESPERRTE AUFSTELLUNG NICHT UNGÜLTIG MACHEN.
 *
 * CHRIS: „verletzungen dürfen ein lineup niemals blockieren erst recht nicht beim scoring da ist
 * der spieltag ja schon gelaufen und spieler aus D1 sind eh nie in D2 drin! deswegen ist der
 * blocker einfach quatsch" — und: „wenn 5 eingesetzt werden und sich 1 oder 2 verletzen ist es ja
 * quatsch zu sagen hey das sind nicht mehr 5!"
 *
 * Gemessen an seinem Spielstand (season-1, matchday-10): genau EIN Team blockierte den Spieltag,
 * V-W. Zwei aufgestellte Spieler hatten sich in D1 verletzt — der bereits GEBUCHTEN Disziplin —
 * und blockierten damit D2, in dem beide gar nicht antraten (D1 und D2 laufen parallel und sind
 * disjunkt besetzt).
 *
 * DER WIDERSPRUCH, DEN DAS AUFDECKTE: `legacy-matchday-partial-lineup-rule.ts` verlangt
 * ausdrücklich, dass die Namen der Ausgefallenen im Entwurf STEHEN BLEIBEN (die gebuchte D1 rechnet
 * mit ihnen weiter, #505). Diese Prüfung erklärte den Entwurf für ungültig, WEIL sie drin stehen.
 *
 * Beim AUFSTELLEN bleibt die Sperre — dort hat sie einen Ausweg (man stellt jemand anderen auf).
 */
import { describe, expect, it } from "vitest";

import type { LegacyLineupContext } from "@/lib/lineups/legacy-lineup-types";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";

const SAVE = "save-1";
const SEASON = "season-1";
const MATCHDAY = "matchday-10";
const TEAM = "V-W";

/** Fünf aufgestellte Spieler in D1, davon zwei inzwischen verletzt. */
function kontextMitZweiVerletzten(): LegacyLineupContext {
  const ids = ["p1", "p2", "p3", "p4", "p5"];
  const verletzt = new Set(["p3", "p5"]);
  return {
    saveId: SAVE,
    seasonId: SEASON,
    matchdayId: MATCHDAY,
    teamId: TEAM,
    entries: ids.map((playerId, slotIndex) => ({
      disciplineId: "eiskunstlauf",
      disciplineSide: "d1" as const,
      slotIndex,
      playerId,
      activePlayerId: `roster-${playerId}`,
      isCaptain: false,
    })),
    disciplinePlayerCounts: { eiskunstlauf: 5 },
    disciplineSidePlayerCounts: { "eiskunstlauf::d1": 5 },
    activePlayers: ids
      .filter((id) => !verletzt.has(id))
      .map((playerId) => ({
        id: `roster-${playerId}`,
        playerId,
        saveId: SAVE,
        seasonId: SEASON,
        teamId: TEAM,
      })) as never,
    // `LegacyRosterPlayerRef.id` ist die SPIELER-Id — der Validator schlaegt mit `entry.playerId`
    // nach. Eine Roster-Id hier laesst die Verletzungspruefung stillschweigend ins Leere greifen.
    rosterPlayers: ids.map((playerId) => ({
      id: playerId,
      name: playerId,
      injuryStatus: verletzt.has(playerId) ? "injured" : "healthy",
      availabilityBlocker: verletzt.has(playerId) ? "player_injured_unavailable" : null,
      injuryUntilMatchday: verletzt.has(playerId) ? "matchday-11" : null,
    })) as never,
    disciplineScores: [],
  };
}

describe("Verletzung in einer gesperrten Aufstellung", () => {
  it("macht die Aufstellung NICHT ungueltig — der Spieltag laeuft bereits", () => {
    const ergebnis = validateLegacyLineupContext(kontextMitZweiVerletzten(), { lineupIsLocked: true });
    expect(ergebnis.errors.filter((e) => e.includes("player_injured_unavailable"))).toHaveLength(0);
    expect(ergebnis.isValid).toBe(true);
  });

  it("der Slot bleibt besetzt — 'das sind nicht mehr 5' gilt nicht", () => {
    // Chris: „wenn 5 eingesetzt werden und sich 1 oder 2 verletzen ist es ja quatsch zu sagen hey
    // das sind nicht mehr 5!" — die Sollbesetzung von 5 muss also weiter als erfuellt gelten,
    // obwohl nur noch 3 der 5 spielfaehig sind.
    const ergebnis = validateLegacyLineupContext(kontextMitZweiVerletzten(), {
      lineupIsLocked: true,
      enforceCompleteness: true,
    });
    expect(ergebnis.errors.filter((e) => e.includes("expects 5 entries"))).toHaveLength(0);
    expect(ergebnis.isValid).toBe(true);
  });

  it("die Verletzung bleibt sichtbar — als Warnung, nicht als Fehler", () => {
    const ergebnis = validateLegacyLineupContext(kontextMitZweiVerletzten(), { lineupIsLocked: true });
    expect(ergebnis.warnings.filter((w) => w.includes("player_injured_unavailable"))).toHaveLength(2);
  });

  it("beim AUFSTELLEN bleibt die Sperre — dort gibt es einen Ausweg", () => {
    const ergebnis = validateLegacyLineupContext(kontextMitZweiVerletzten(), { lineupIsLocked: false });
    expect(ergebnis.errors.filter((e) => e.includes("player_injured_unavailable"))).toHaveLength(2);
    expect(ergebnis.isValid).toBe(false);
  });
});

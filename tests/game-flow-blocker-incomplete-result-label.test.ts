import { describe, expect, it } from "vitest";

import { formatGameFlowBlocker, formatGameFlowBlockerList } from "@/lib/foundation/game-flow-blocker-labels";

/**
 * Hintergrund: Der Spieltag im Save `new-game-1785476771457-e4yvyl` (Saison 1, MD1) liess sich nicht
 * abschliessen. `previewStandingsApply` nannte den Grund praezise — `incomplete_result:H-R` und
 * `incomplete_result:P-C`, zwei KI-Teams mit je einem verletzten Spieler in der abgegebenen
 * Aufstellung. Auf dem Bildschirm stand davon nichts: nur "Standings Apply fehlt noch fuer diesen
 * Spieltag".
 *
 * Ein Teil davon war, dass es fuer diese beiden Codes ueberhaupt kein Label gab. Sie fielen auf
 * `reason.replaceAll("_", " ")` zurueck — aus `incomplete_result:H-R` wurde "incomplete result:H-R".
 * Die Tests halten fest, dass der Grund lesbar ist UND das betroffene Team benennt: Ohne den Teamnamen
 * weiss niemand, wo er nachsehen soll, und die Sperre bleibt so undurchsichtig wie vorher.
 */
describe("Blocker-Labels fuer blockierte Ergebniszeilen", () => {
  it("nennt bei incomplete_result das betroffene Team und den wahrscheinlichen Grund", () => {
    const label = formatGameFlowBlocker("incomplete_result:H-R");

    expect(label).toContain("H-R");
    expect(label).toMatch(/verletzt/i);
    // Der rohe Code darf nicht durchschlagen — genau das war der Zustand vorher.
    expect(label).not.toContain("incomplete_result");
    expect(label).not.toContain("incomplete result");
  });

  it("nennt bei missing_result das betroffene Team", () => {
    const label = formatGameFlowBlocker("missing_result:P-C");

    expect(label).toContain("P-C");
    expect(label).not.toContain("missing_result");
    expect(label).not.toContain("missing result");
  });

  it("haelt beide blockierenden Teams des gemeldeten Spieltags auseinander", () => {
    // Genau die Liste, die `previewStandingsApply` fuer den gemeldeten Save zurueckgab.
    const label = formatGameFlowBlockerList(["incomplete_result:H-R", "incomplete_result:P-C"]);

    expect(label).toContain("H-R");
    expect(label).toContain("P-C");
  });

  it("laesst bekannte Codes ohne Teamsuffix unveraendert", () => {
    // Absicherung gegen einen zu gierigen Praefix-Treffer: Der generische Spieltags-Blocker hat
    // seinen eigenen Text und darf davon nicht eingefangen werden.
    expect(formatGameFlowBlocker("standings_apply_missing_for_current_matchday")).toBe(
      "Standings Apply fehlt noch für diesen Spieltag.",
    );
  });
});

/**
 * TASK #155 — Liga 2 komplett KI-gesteuert (Wizard-Filter). Opus-Review zu PR #1272: der New-
 * Game-Wizard liess ein herausgefiltertes Liga-2-Team bisher nur als Rohcode
 * ("battle_mode_liga2_team_not_selectable:R-R") in `preview.warnings` auftauchen — sichtbar in der
 * UI, aber nicht erklärend. Derselbe Nachweis-Stil wie bei `incomplete_result` oben: lesbar UND
 * das betroffene Team benannt.
 */
describe("Blocker-Label fuer den Liga-2-Filter im New-Game-Wizard", () => {
  it("nennt das betroffene Team und erklärt, warum es bei der Neuanlage nicht wählbar ist", () => {
    const label = formatGameFlowBlocker("battle_mode_liga2_team_not_selectable:R-R");

    expect(label).toContain("R-R");
    expect(label).toMatch(/liga 2/i);
    expect(label).not.toContain("battle_mode_liga2_team_not_selectable");
    expect(label).not.toContain("battle mode liga2 team not selectable");
  });

  it("haelt mehrere betroffene Teams (z.B. Frankys komplette Preset-Auswahl) auseinander", () => {
    const label = formatGameFlowBlockerList([
      "battle_mode_liga2_team_not_selectable:D-P",
      "battle_mode_liga2_team_not_selectable:V-W",
    ]);

    expect(label).toContain("D-P");
    expect(label).toContain("V-W");
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { previewNewGameSetup } from "@/lib/game/new-game-setup-service";

// FoundationPageClient.tsx is now a 25-line wrapper; the New Game wizard and
// team-settings markup live in FoundationTeamSettingsNewLook.tsx, and the
// handlers/state live in use-foundation-shell-router-body-scope.tsx /
// FoundationShellRouterBody.tsx.
const teamSettingsNewLookPath = path.join(
  process.cwd(),
  "app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx",
);
const shellRouterBodyScopePath = path.join(
  process.cwd(),
  "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx",
);
const shellRouterBodyPath = path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx");
const foundationPageTypesPath = path.join(process.cwd(), "lib/foundation/tabs/foundation-page-types.ts");

describe("new game setup UI contract", () => {
  it("exposes the New Game wizard with preview/confirm controls", () => {
    const newLookSource = fs.readFileSync(teamSettingsNewLookPath, "utf8");
    const scopeSource = fs.readFileSync(shellRouterBodyScopePath, "utf8");
    const source = `${newLookSource}\n${scopeSource}`;

    expect(source).toContain('data-testid="new-game-setup-wizard"');
    expect(source).toContain("Neues Spiel starten");
    // "Setup pruefen" -> "Setup prüfen": ASCII placeholder replaced by the real umlaut.
    expect(source).toContain("Setup prüfen");
    expect(source).toContain("Neues Spiel erstellen");
    expect(source).toContain("Online 4v4");
    expect(source).toContain("/api/new-game");
    expect(source).toContain("NEW_GAME_VISIBLE_PRESET_IDS");
    /*
     * NACHGEZOGEN (P1 / „String nirgends"): hier stand
     * `data-testid="new-game-solo-team-select"`. Nachgemessen: das war ein zweites,
     * SEPARATES Einzel-Dropdown, das nur bei `newGamePresetId === "solo_1"` erschien; es ist
     * in Commit `170b0b4b` mit dem Umbau auf den einheitlichen Klub-Raster entfallen. Die
     * FÄHIGKEIT (genau ein Team selbst steuern) ist NICHT weg — sie steckt im Raster
     * `new-game-ownership-picker` (`toggleNewGameTeam("chris", …)`, „Dieses Team steuerst du
     * selbst (bis zu 4 Teams)"). Zwei Bedienelemente für dieselbe Auswahl wären zwei
     * Zustandsquellen; die Konsolidierung ist die Reparatur, nicht der Verlust.
     * Der Nachweis läuft unten am WERT statt an einer Zeichenkette.
     */
    expect(source).toContain('data-testid="new-game-ownership-picker"');
    expect(source).toContain('toggleNewGameTeam("chris"');
  });

  it("ein Solo-Spielstand mit GENAU EINEM eigenen Team ist weiterhin möglich", () => {
    // Der Wert-Nachweis zur Konsolidierung oben: der Aufbau akzeptiert eine Ein-Team-Auswahl,
    // stellt genau ein Team unter eigene Steuerung und überlässt den Rest der KI.
    const vorschau = previewNewGameSetup({ presetId: "custom", chrisTeamIds: ["M-M"], frankyTeamIds: [] });

    expect(vorschau.chrisTeamIds).toEqual(["M-M"]);
    expect(vorschau.counts.chris).toBe(1);
    expect(vorschau.counts.franky).toBe(0);
    expect(vorschau.blockers).toEqual([]);
    // "manual" = vom Menschen gesteuert (die KI-Teams tragen "ai") — gemessen, nicht angenommen.
    expect(vorschau.teams.find((team) => team.teamId === "M-M")?.controlMode).toBe("manual");
    expect(vorschau.teams.find((team) => team.teamId === "M-M")?.ownerLabel).toBe("Chris");
    expect(vorschau.aiTeamIds).toHaveLength(vorschau.counts.total - 1);
    expect(vorschau.aiTeamIds).not.toContain("M-M");

    // Und die Mehrfachauswahl desselben Rasters funktioniert genauso (1–4 Teams).
    const vier = previewNewGameSetup({ presetId: "custom", chrisTeamIds: ["M-M", "D-P", "P-S", "V-W"], frankyTeamIds: [] });
    expect(vier.counts.chris).toBe(4);
    expect(vier.blockers).toEqual([]);
  });

  /**
   * Dieser Fall hiess frueher „uses game mode as the single ownership UI" und pinnte damit den
   * KI-Reiter als Ort der Zuordnung. Genau das ist nicht mehr wahr — und zwar auf Ansage.
   *
   * GEMELDET VON CHRIS: „ich will keine spielstände mehr reparieren, hau es raus mach mir nur
   * einen sauber verknüpften weg für die zukunft damit ich sauber bin!"
   *
   * Wem ein Team gehoert, wird ab jetzt GENAU EINMAL entschieden: beim Anlegen des Spielstands
   * unter „Spielstaende & Start". Der KI-Reiter zeigt es nur noch an. Siehe
   * `tests/ein-weg-zum-neuen-spielstand.test.ts` fuer den vollstaendigen Vertrag.
   */
  it("entscheidet die Zuordnung nur noch beim Anlegen — der KI-Reiter zeigt sie an", () => {
    const newLookSource = fs.readFileSync(teamSettingsNewLookPath, "utf8");
    const scopeSource = fs.readFileSync(shellRouterBodyScopePath, "utf8");
    const source = `${newLookSource}\n${scopeSource}`;

    expect(source).not.toContain('data-testid="current-save-ownership-cards"');
    expect(source).toContain('data-testid="foundation-active-game-mode"');
    // Beide Bedienungen im KI-Reiter sind weg — Dropdown wie Raster.
    expect(source).not.toContain('data-testid="solo-player-team-select"');
    expect(source).not.toContain('data-testid="game-mode-ownership-picker"');
    expect(source).not.toContain('data-testid="game-mode-ownership-panel"');
    // Was bleibt: die Anzeige, und der Klub-Picker des einen Anlege-Wegs.
    expect(newLookSource).toContain('data-testid="game-mode-ownership-readonly"');
    expect(newLookSource).toContain("nl-newgame-clubgrid");
  });

  it("keeps Online 4v4 ownership preset visible in the client", () => {
    const source = fs.readFileSync(teamSettingsNewLookPath, "utf8");
    const pageTypesSource = fs.readFileSync(foundationPageTypesPath, "utf8");

    // Der Modus lebt jetzt im Anlege-Assistenten (dort werden die Klubs verteilt), nicht mehr im
    // KI-Reiter — die Voreinstellungen selbst sind unveraendert.
    expect(`${source}\n${pageTypesSource}`).toContain('online_4v4');
    expect(pageTypesSource).toContain('["P-S", "D-P", "M-M", "V-W"]');
    expect(pageTypesSource).toContain('["M-S", "P-C", "C-S", "G-G"]');
  });

  it("lets the season briefing complete and continue the setup flow", () => {
    const shellRouterBodyText = fs.readFileSync(shellRouterBodyPath, "utf8");
    const scopeSource = fs.readFileSync(shellRouterBodyScopePath, "utf8");
    const persistSource = fs.readFileSync(
      path.join(process.cwd(), "lib/foundation/tabs/use-foundation-persist.ts"),
      "utf8",
    );
    const source = `${shellRouterBodyText}\n${scopeSource}\n${persistSource}`;

    expect(source).toContain("completeSeasonBriefingAndContinue");
    expect(source).toMatch(/onClick=\{completeSeasonBriefingAndContinue\}[\s\S]*?>\s*Erledigt\s*<\/button>/);
    expect(source).toContain('closeSeasonBriefing(false)');
    expect(source).toContain("seasonBriefingDismissedRef");
    expect(source).toContain("writeSeasonBriefingDismissedToStorage");
    expect(source).toContain("readSeasonBriefingDismissedFromStorage");
    expect(source).toContain("shouldSuppressSeasonBriefingReopen");
    expect(source).toContain("shouldAutoOpenSeasonBriefing");
    expect(source).not.toContain("closeFoundationDrilldownPanel();\n    }\n  };\n  const completeSeasonBriefingAndContinue");
    expect(source).toContain('data-testid="season-briefing-backdrop"');
    expect(source).toContain("seasonBriefingScheduleReady");
    expect(source).toContain('data-testid="season-briefing-loading"');
    expect(source).toContain("foundation-modal-backdrop");
    // Moved into its own hook (use-foundation-persist.ts) during the perf
    // split; `gameState` param renamed to `input.gameState` with a `?? 0`
    // fallback added, same underlying value.
    expect(source).toContain("expectedSaveVersion: input.gameState.saveVersion ?? 0");
  });
});

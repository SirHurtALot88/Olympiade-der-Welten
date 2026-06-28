import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const foundationClientPath = path.join(process.cwd(), "app/foundation/FoundationPageClient.tsx");

describe("new game setup UI contract", () => {
  it("exposes the New Game wizard with preview/confirm controls", () => {
    const source = fs.readFileSync(foundationClientPath, "utf8");

    expect(source).toContain('data-testid="new-game-setup-wizard"');
    expect(source).toContain("Neues Spiel starten");
    expect(source).toContain("Setup pruefen");
    expect(source).toContain("Neues Spiel erstellen");
    expect(source).toContain("Online 4v4");
    expect(source).toContain("/api/new-game");
    expect(source).toContain("NEW_GAME_VISIBLE_PRESET_IDS");
    expect(source).toContain('data-testid="new-game-solo-team-select"');
    expect(source).toContain('data-testid="new-game-ownership-picker"');
  });

  it("uses game mode as the single ownership UI in team settings", () => {
    const source = fs.readFileSync(foundationClientPath, "utf8");

    expect(source).not.toContain('data-testid="current-save-ownership-cards"');
    expect(source).toContain('data-testid="foundation-active-game-mode"');
    expect(source).toContain('data-testid="game-mode-ownership-panel"');
    expect(source).toContain('data-testid="solo-player-team-select"');
    expect(source).toContain('data-testid="game-mode-ownership-picker"');
    expect(source).toContain("applyGameModeOwnership");
  });

  it("keeps Online 4v4 ownership preset visible in the client", () => {
    const source = fs.readFileSync(foundationClientPath, "utf8");

    expect(source).toContain('online_4v4');
    expect(source).toContain('["P-S", "D-P", "M-M", "V-W"]');
    expect(source).toContain('["M-S", "P-C", "C-S", "G-G"]');
  });

  it("lets the season briefing complete and continue the setup flow", () => {
    const source = fs.readFileSync(foundationClientPath, "utf8");

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
    expect(source).toContain("expectedSaveVersion: nextGameState.saveVersion");
  });
});

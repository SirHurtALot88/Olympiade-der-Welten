import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// FoundationPageClient.tsx is now a 25-line wrapper; the New Game wizard and
// team-settings markup live in FoundationTeamSettingsNewLook.tsx, and the
// handlers/state live in use-foundation-shell-router-body-scope.tsx /
// FoundationShellRouterBody.tsx.
const foundationClientPath = path.join(process.cwd(), "app/foundation/FoundationPageClient.tsx");
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
    // NOTE: "new-game-solo-team-select" no longer exists anywhere in the repo.
    // The wizard's only team-select control now is the unified multi-select
    // "new-game-ownership-picker" clubgrid (1-4 teams) — there's no separate
    // "solo" single-team variant anymore. This looks like an intentional
    // consolidation (matches the "single ownership UI" theme of the next test
    // below) rather than a hard loss, but left red rather than guessed at —
    // see final report.
    expect(source).toContain('data-testid="new-game-solo-team-select"');
    expect(source).toContain('data-testid="new-game-ownership-picker"');
  });

  it("uses game mode as the single ownership UI in team settings", () => {
    const newLookSource = fs.readFileSync(teamSettingsNewLookPath, "utf8");
    const scopeSource = fs.readFileSync(shellRouterBodyScopePath, "utf8");
    const source = `${newLookSource}\n${scopeSource}`;

    expect(source).not.toContain('data-testid="current-save-ownership-cards"');
    expect(source).toContain('data-testid="foundation-active-game-mode"');
    expect(source).toContain('data-testid="game-mode-ownership-panel"');
    expect(source).toContain('data-testid="solo-player-team-select"');
    expect(source).toContain('data-testid="game-mode-ownership-picker"');
    expect(source).toContain("applyGameModeOwnership");
  });

  it("keeps Online 4v4 ownership preset visible in the client", () => {
    const source = fs.readFileSync(teamSettingsNewLookPath, "utf8");
    const pageTypesSource = fs.readFileSync(foundationPageTypesPath, "utf8");

    expect(source).toContain('online_4v4');
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

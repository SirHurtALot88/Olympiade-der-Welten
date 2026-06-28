import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("foundation lineup v2 ui contract", () => {
  it("exposes focus mode board, toolbar, candidate tabs, and captain select", async () => {
    const [boardText, clientText, panelText, cssText, routingText] = await Promise.all([
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab-v2/LegacyLineupFocusV2Board.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/FoundationLineupPanel.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/foundation-view-routing.ts", "utf8"),
    ]);

    expect(boardText).toContain('data-testid="legacy-lineup-v2-board"');
    expect(boardText).toContain('data-testid="lineup-v2-candidate-tabs"');
    expect(boardText).toContain('data-testid="lineup-v2-save-button"');
    expect(boardText).toContain('data-testid="lineup-v2-clear-slot"');
    expect(boardText).toContain('id={`lineup-slot-${slot.key}`}');
    expect(boardText).toContain("legacy-lineup-v2-toolbar");
    expect(boardText).toContain("legacy-lineup-v2-captain-strip");
    expect(boardText).toContain("legacy-lineup-v2-keyboard-hint");
    expect(boardText).toContain("Rank {rank ??");
    expect(boardText).toContain("Slots");
    expect(boardText).toContain("Sofort");
    expect(boardText).toContain("Blockiert");

    expect(clientText).toContain('uiVariant === "focusV2"');
    expect(clientText).toContain("slotRoleAttributesByKey={slotRoleAttributesByKey}");
    expect(clientText).toContain("candidateGroups={teamdeckCandidateGroups}");
    expect(clientText).toContain('uiVariant !== "focusV2"');
    expect(clientText).toContain('event.code === "ArrowUp"');
    expect(clientText).toContain('event.code === "ArrowDown"');

    const v2ControlsStart = clientText.indexOf("controlsSlot={");
    const v2ControlsEnd = clientText.indexOf("tacticsSlot={", v2ControlsStart);
    const v2ControlsBlock = clientText.slice(v2ControlsStart, v2ControlsEnd);
    expect(v2ControlsBlock).not.toContain("updateTeamIntensityStage");
    expect(v2ControlsBlock).not.toContain("Beide Diszis setzen");

    expect(panelText).toContain('"foundation-lineup-v2"');
    expect(panelText).toContain('uiVariant === "focusV2"');

    expect(cssText).toContain(".legacy-lineup-v2-toolbar");
    expect(cssText).toContain(".legacy-lineup-v2-candidate-tabs");
    expect(cssText).toContain(".legacy-lineup-v2-top-pick-chip");
    expect(cssText).toContain(".legacy-lineup-v2-slot-clear");
    expect(cssText).toContain(".legacy-lineup-v2-intensity.is-push");

    expect(routingText).toContain("lineupV2");
  });
});

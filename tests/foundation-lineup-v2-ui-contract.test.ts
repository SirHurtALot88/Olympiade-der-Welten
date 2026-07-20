import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("foundation lineup v2 ui contract", () => {
  it("exposes focus mode board, toolbar, candidate tabs, and captain select", async () => {
    const [boardText, clientText, panelText, cssText, routingText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab-v2/LegacyLineupFocusV2Board.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/FoundationLineupPanel.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
      fs.readFile(path.join(process.cwd(), "lib/foundation/foundation-view-routing.ts"), "utf8"),
    ]);

    expect(boardText).toContain('data-testid="legacy-lineup-v2-board"');
    expect(boardText).toContain('data-testid="lineup-v2-candidate-tabs"');
    expect(boardText).toContain('data-testid="lineup-v2-save-button"');
    expect(boardText).toContain('data-testid="lineup-v2-clear-slot"');
    expect(boardText).toContain('id={`lineup-slot-${slot.key}`}');
    expect(boardText).toContain("legacy-lineup-v2-toolbar");
    expect(boardText).toContain("legacy-lineup-v2-toolbar-hero-metrics");
    expect(boardText).toContain('data-testid="lineup-v2-hero-metrics"');
    expect(boardText).toContain("legacy-lineup-v2-toolbar-details");
    expect(boardText).toContain("Bester Pick");
    expect(boardText).toContain("legacy-lineup-v2-form-mini-chips");
    expect(boardText).toContain('data-testid="lineup-v2-captain-cards"');
    expect(boardText).toContain("legacy-lineup-v2-captain-card");
    expect(boardText).toContain("legacy-lineup-v2-slot-micro-hint");
    expect(boardText).toContain('data-testid="lineup-v2-wizard-toggle"');
    expect(boardText).toContain('data-testid="lineup-v2-compare-toggle"');
    expect(boardText).toContain("Spieltag-Vorbereitung");
    expect(boardText).not.toContain("<select");
    expect(boardText).toContain("legacy-lineup-v2-keyboard-hints-wrap");
    expect(boardText).toContain("is-next-target");
    expect(boardText).toContain("mobileAssignCandidateId");
    expect(boardText).toContain("lineup-v2-hints-seen");
    expect(boardText).not.toContain('className="legacy-lineup-v2-keyboard-hint"');
    expect(boardText).not.toContain('setKeyboardHintsOpen(true)');
    expect(boardText).toContain("FoundationPlayerPortraitPreview");
    expect(boardText).toContain("wrapLineupV2PortraitPreview");
    expect(boardText).toContain("Slots");
    expect(boardText).toContain("Sofort");
    expect(boardText).toContain("Blockiert");

    expect(boardText).toContain("Punkte");
    expect(boardText).toContain("Automatisch füllen");
    expect(boardText).toContain("Assistent");
    expect(boardText).toContain("lineupFinishItems");
    expect(boardText).toContain("lineup-v2-save-help");
    expect(boardText).toContain("aria-live");
    expect(boardText).toContain("next.length > 3");
    expect(boardText).toContain('data-testid="lineup-v2-form-mini-popover"');
    expect(boardText).toContain("lineupCandidate");

    expect(clientText).toContain('uiVariant === "focusV2"');
    expect(clientText).toContain('data-testid="lineup-v2-trainer-tip"');
    expect(clientText).toContain("Vorschlag übernehmen");
    expect(clientText).toContain("legacy-lineup-ready-panel");
    expect(clientText).toContain('data-testid="lineup-v2-handoff-overlay"');
    expect(clientText).toContain("Formkarten");
    expect(clientText).toContain("assignFormCardToCell");
    expect(clientText).toContain("nextOpenSlotKey");
    expect(clientText).toContain("slotRoleAttributesByKey={slotRoleAttributesByKey}");
    expect(clientText).toContain("candidateGroups={teamdeckCandidateGroups}");
    expect(clientText).toContain('uiVariant !== "focusV2"');
    expect(clientText).toContain('event.code === "ArrowUp"');
    expect(clientText).toContain('event.code === "ArrowDown"');
    expect(clientText).toContain("focusV2FormMiniChipsBySide");
    expect(clientText).toContain("lineup-v2-arena-handoff");

    const v2ControlsStart = clientText.indexOf("controlsSlot={");
    const v2ControlsEnd = clientText.indexOf("tacticsSlot={", v2ControlsStart);
    const v2ControlsBlock = clientText.slice(v2ControlsStart, v2ControlsEnd);
    expect(v2ControlsBlock).not.toContain("updateTeamIntensityStage");
    expect(v2ControlsBlock).not.toContain("Beide Diszis setzen");

    expect(panelText).toContain('"foundation-lineup-v2"');
    expect(panelText).toContain("Einsatzliste");
    expect(panelText).not.toContain("Einsatzliste v2");

    expect(cssText).toContain(".legacy-lineup-v2-toolbar-hero-metrics");
    expect(cssText).toContain(".legacy-lineup-v2-wizard-portraits");
    expect(cssText).toContain(".legacy-lineup-v2-form-mini-chips");
    expect(cssText).toContain(".legacy-lineup-v2-candidate-tabs");
    expect(cssText).toContain(".legacy-lineup-v2-top-pick-chip");
    expect(cssText).toContain(".legacy-lineup-v2-slot-row.is-empty.is-next-target");
    expect(cssText).toContain(".legacy-lineup-v2-keyboard-hints-wrap");
    expect(cssText).toContain(".legacy-lineup-v2-trainer-tip");
    expect(cssText).toContain(".legacy-lineup-v2-save-help");
    expect(cssText).toContain(".legacy-lineup-v2-handoff-overlay");

    expect(routingText).toContain('return "lineup"');
    expect(routingText).toContain("lineup-v2");
  });

  it("exposes sprint I sticky toolbar, discipline progress, tactic preview, and gated arena CTA", async () => {
    const [boardText, clientText, cssText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab-v2/LegacyLineupFocusV2Board.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
    ]);

    expect(boardText).toContain('data-testid="lineup-v2-sticky-toolbar"');
    expect(boardText).toContain("legacy-lineup-v2-toolbar is-sticky");
    expect(boardText).toContain('data-testid="lineup-v2-discipline-progress"');
    expect(boardText).toContain("legacy-lineup-v2-toolbar-progress-chip");
    expect(boardText).toContain("lineup-v2-tactic-preview-");
    expect(boardText).toContain("disciplineTacticPreviewBySide");
    expect(boardText).toContain('data-testid="lineup-v2-arena-cta"');
    expect(boardText).toContain("arenaReady");
    expect(boardText).toContain("onNavigateArena");
    expect(boardText).toContain("Zur Arena");
    expect(boardText).toContain("legacy-lineup-v2-candidate-tabs is-");
    expect(boardText).toContain("legacy-lineup-v2-toolbar-progress-chip is-");
    expect(boardText).toContain("LegacyLineupSlotMicroSteps");
    expect(boardText).toContain("LegacyLineupCandidateReasonChips");
    expect(boardText).toContain("legacy-lineup-v2-wizard-fit");
    expect(boardText).toContain("Warum passt er?");

    expect(clientText).toContain("focusV2ArenaReady");
    expect(clientText).toContain("focusV2DisciplineTacticPreviewBySide");
    expect(clientText).toContain("lineup-v2-return-focus");

    expect(cssText).toContain(".legacy-lineup-v2-toolbar.is-sticky");
    expect(cssText).toContain(".legacy-lineup-v2-toolbar-progress-chip.is-d1");
    expect(cssText).toContain(".legacy-lineup-v2-tactic-preview-chip");
    expect(cssText).toContain(".legacy-lineup-v2-arena-cta.is-ready");
    expect(cssText).toContain(".legacy-lineup-v2-wizard-fit");
    expect(cssText).toContain(".legacy-lineup-v2-slot-micro-steps");
  });
});

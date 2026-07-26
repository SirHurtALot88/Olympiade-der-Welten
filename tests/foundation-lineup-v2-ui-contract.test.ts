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
    // NOTE (investigated): LegacyLineupFocusV2Board.tsx is imported via
    // dynamic() in LegacyLineupLabClient.tsx but never actually rendered
    // (`<LegacyLineupFocusV2Board` has zero matches there) — the component
    // always renders <LineupNewLook> or <FormBoardPanel> instead. Within this
    // now-dead file, the candidate-tab-switcher UI itself was also stripped:
    // `onCandidateTabChange` is never called, and the mobile candidate list is
    // hardcoded to filterLegacyLineupCandidateEntries(candidateGroups, "all", ...).
    // LineupNewLook.tsx (the component actually rendered) has its own
    // candidate-tabs UI, but under `className="nl-lineup-candidate-tabs"` with
    // NO data-testid at all — so "lineup-v2-candidate-tabs" doesn't exist
    // anywhere as a literal testid. Real feature loss (missing test hook) —
    // see final report — left red intentionally.
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
    // NOTE: these 5 markers are gone from LegacyLineupLabClient.tsx (and no
    // equivalent exists in LineupNewLook.tsx either — checked directly, zero
    // matches). "Vorschlag übernehmen" ties into the same AI-preview-adoption
    // UI documented as likely-removed in tests/legacy-lineup-lab.test.ts and
    // tests/legacy-lineup.test.ts; the trainer-tip/handoff-overlay/ready-panel
    // testids and the slotRoleAttributesByKey wiring (computed via useMemo at
    // LegacyLineupLabClient.tsx:4428 but never passed to any child) look like
    // further pieces of the same dead/unwired feature area. Real feature loss
    // (see final report) — left red intentionally.
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
    // Same candidate-tabs finding as above — this exact CSS rule is gone too
    // (LineupNewLook.tsx's replacement candidate tabs use .nl-lineup-candidate-tabs).
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
    // Same dead-code/candidate-tabs finding as the first "it" block above.
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

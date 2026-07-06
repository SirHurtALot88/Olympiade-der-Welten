import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("matchday arena ui contract", () => {
  it("wires a dedicated foundation arena view with reveal controls and score lanes", async () => {
    const [foundationPageClientText, shellRouterBodyText, shellRouterBodyScopeText, shellRouterText, routingText, arenaText, arenaPanelText, arenaHostText, resultHostText, arenaRevealPanelText, arenaTimelineText, legacyLineupText, presenterText, cssText, moduleHelpersText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationShellRouterBody.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationShellRouter.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/foundation-view-routing.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/MatchdayArenaV2Client.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/FoundationMatchdayArenaPanel.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/FoundationMatchdayArenaShellHost.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-result-v2/FoundationMatchdayResultShellHost.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/ArenaRevealPlaybackPanel.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/components/matchday-arena/MatchdayArenaTimeline.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/season/matchday-arena-presenter.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/tabs/foundation-page-module-helpers.tsx",
        "utf8",
      ),
    ]);

    // Home/router logic was split off FoundationPageClient into a shell-router body + scope
    // hook during the V2 monolith split; the wiring these assertions guard now lives across
    // all three files, so we check the combined text to keep the original contract intent.
    const foundationText = `${foundationPageClientText}\n${shellRouterBodyText}\n${shellRouterBodyScopeText}\n${shellRouterText}`;

    expect(foundationText).toContain('"matchdayArena"');
    expect(foundationText).toContain('"matchdayResult"');
    expect(moduleHelpersText).toContain('{ id: "matchdayArena", label: "Arena"');
    expect(moduleHelpersText).not.toContain('{ id: "matchdayArenaV2", label: "Arena v2"');
    expect(routingText).toContain('view === "matchday-arena-v2"');
    expect(routingText).toContain('return "matchdayArena"');
    expect(foundationText).not.toContain('{ id: "matchdayResult", label: "Result" }');
    const secondaryViewsBlock = moduleHelpersText.slice(
      moduleHelpersText.indexOf("const foundationSecondaryViews"),
      moduleHelpersText.indexOf("const foundationInternalViews"),
    );
    expect(secondaryViewsBlock).not.toContain('{ id: "matchdayResult"');
    expect(moduleHelpersText).toContain("const foundationInternalViews");
    expect(moduleHelpersText).toContain('{ id: "matchdayResult", label: "Spieltagsergebnis" }');
    expect(foundationText).toContain("FoundationShellRouterMatchdayArena");
    expect(foundationText).toContain("FoundationShellRouterMatchdayResult");
    expect(foundationText).toContain("buildMatchdaySummary");
    expect(resultHostText).toContain('id="foundation-matchday-result"');
    expect(arenaHostText).toContain('id="arena-result-summary"');
    expect(arenaHostText).toContain('data-testid="arena-result-summary"');
    expect(arenaHostText).toContain("arena-result-empty-state");
    expect(arenaHostText).toContain("Noch kein Spieltagsergebnis vorhanden");
    expect(arenaHostText).toContain("Spieltagsergebnis");
    expect(arenaHostText).toContain("Saisonstand ansehen");
    expect(resultHostText).toContain("Saisonstand anzeigen");
    expect(arenaHostText).toContain("onOpenPlayerDetails: (payload) => openPlayerDrawerById(payload.playerId, payload.activePlayerId)");
    expect(foundationText).toContain("foundation-global-next-button");
    expect(foundationText).toContain("triggerGlobalNext");
    expect(foundationText).toContain('activeView === "matchdayArena"');
    expect(arenaPanelText).toContain('data-testid="arena-lineup-blocker"');
    expect(foundationText).toContain("lineup_not_submitted");
    expect(foundationText).toContain("homeNextMatchdayStatus");
    expect(foundationText).toContain("isTeamMatchdayLineupSubmitted");
    expect(foundationText).toContain("Leertaste");
    expect(foundationText).toContain("event.code !== \"Space\"");
    expect(foundationText).toContain("tagName === \"input\"");
    expect(foundationText).toContain("tagName === \"textarea\"");
    expect(foundationText).toContain("tagName === \"select\"");
    expect(foundationText).toContain("targetPanel");
    expect(arenaText).toContain("Arena v2");
    expect(arenaText).toContain("resolveArenaTeamId");
    expect(arenaText).toContain("teamId: resolveArenaTeamId(props.teams, props.defaultTeamId)");
    expect(arenaText).toContain("Arena v2 braucht noch Input");
    expect(arenaText).toContain("32 Teams");
    expect(arenaText).toContain("Reveal-Fortschritt");
    expect(arenaText).toContain("onClick={props.onOpenMatchdayResult}");
    expect(arenaText).toContain("Top Player");
    expect(arenaText).not.toContain("Fokus-Team");
    expect(arenaText).not.toContain("Aktives Team");
    expect(arenaText).toContain("arena-v2-timeline-controls");
    expect(arenaText).not.toContain("arena-v2-control-summary");
    expect(arenaText).toContain("Was Arena v2 gerade zeigt");
    expect(arenaText).toContain("onOpenMatchdayResult");
    expect(arenaText).toContain("Play");
    expect(arenaText).toContain("Pause");
    expect(arenaText).toContain("Weiter");
    expect(arenaText).not.toMatch(/>\s*Step\s*<\/button>/);
    expect(arenaText).toContain("Ergebnis");
    expect(arenaText).toContain("activeDisciplinePhase");
    expect(arenaText).toContain("revealedSlotCountByDiscipline");
    expect(arenaText).toContain("revealEventActive");
    expect(arenaText).toContain("is-reveal-event");
    expect(arenaText).toContain("isArenaEventMode");
    expect(arenaText).toContain("is-event-mode");
    expect(arenaText).toContain("ArenaAnimatedScore");
    expect(arenaText).toContain("mvpSpotlightActive");
    expect(arenaText).toContain('data-testid="arena-v2-mvp-spotlight"');
    expect(arenaText).toContain('data-testid="arena-reveal-timeline"');
    expect(arenaText).toContain("completedDisciplinePhases");
    expect(arenaRevealPanelText).toContain("MatchdayArenaTimeline");
    expect(arenaTimelineText).toContain("matchday-arena-timeline-rail");
    expect(arenaText).toContain("ArenaRevealPlaybackPanel");
    expect(arenaText).toContain("MatchdayArenaPlayerCard");
    expect(arenaText).toContain("handleAdvanceArenaStep");
    expect(arenaText).toContain("scrollArenaTeamIntoView");
    expect(arenaText).toContain("requestScrollToActiveTeamAfterRevealStep");
    expect(arenaText).toContain("rewindArenaStep");
    expect(arenaText).toContain("MATCHDAY_ARENA_REVEAL_SESSION_STORAGE_PREFIX");
    expect(arenaText).toContain('"matchday-arena-reveal-session-v1"');
    expect(arenaText).toContain("buildMatchdayArenaRevealSessionStorageKey");
    expect(arenaText).toContain("readStoredMatchdayArenaRevealSession(canonicalParams)");
    expect(arenaText).toContain("persistMatchdayArenaRevealSession");
    expect(arenaText).toContain("removeStoredMatchdayArenaRevealSession(params)");
    expect(arenaText).toContain("activeDisciplinePhase");
    expect(arenaText).toContain("phaseId: displayPhase");
    expect(arenaText).toContain("revealedSlotCountByDiscipline");
    expect(arenaText).toContain("focusTeamId");
    expect(arenaText).toContain("toggleFocusTeam");
    expect(arenaText).toContain("boardListRef");
    expect(arenaText).toContain("arena-v2-board-sticky-stack");
    expect(arenaText).toContain("listElement.scrollTo");
    expect(arenaText).toContain("is-active-team");
    expect(arenaText).toContain("currentTeamId === teamId ? null : teamId");
    expect(arenaText).toContain("arena-v2-board-mutators");
    expect(arenaText).toContain("matchdayMutatorLabelsBySide");
    expect(arenaText).toContain("onOpenTeam");
    expect(arenaText).toContain("handleTeamProfileOpen");
    expect(arenaHostText).toContain("onOpenTeam: openTeamDrawerById");
    expect(arenaText).toContain("Team-Fokus aufheben");
    expect(arenaText).toContain("Fortgesetzt bei");
    expect(arenaText).toContain("arena-v2-board-step-nav");
    expect(arenaText).toContain("Zurück");
    expect(arenaText).toContain("Weiter");
    expect(arenaText).toContain('useState<ArenaDisciplinePhase>("d1")');
    expect(arenaText).toContain("canSwitchToD2");
    expect(arenaText).toContain("canShowTotalResults");
    expect(arenaText).toContain("canShowResultLayer");
    expect(arenaText).toContain("disabled={!canShowResultLayer}");
    expect(arenaText).toContain('setActiveDisciplinePhase("d1")');
    expect(arenaText).toContain('setActiveDisciplinePhase("d2")');
    expect(arenaText).toContain('setActiveDisciplinePhase("total")');
    expect(arenaText).toContain('displayPhase === "slots" ? items.filter((entry) => entry.slotIndex < revealedSlotCount) : items');
    expect(arenaText).toContain("PPs im Result");
    expect(arenaText).toContain("D2, Gesamtwertung, PPs und Saisonrang bleiben verborgen.");
    expect(arenaText).toContain("Finale Tageswerte werden im Result freigeschaltet.");
    expect(arenaText).toContain('fetch("/api/season/matchday-mvp-score"');
    expect(arenaText).toContain('fetch(`/api/matchday/arena-base?${contextQuery.toString()}`');
    expect(arenaText).toContain('includeDetails: "0"');
    expect(arenaText).toContain("arena-v2-broadcast-panel");
    expect(arenaText).toContain("arena-v2-board-skeleton-row");
    expect(arenaText).toContain("Promise.allSettled");
    expect(arenaText).toContain("loadResolvePreview");
    expect(arenaText).toContain("formatArenaLoadStageLabel");
    expect(arenaText).toContain("arena-v2-panel-loading");
    expect(arenaText).toContain('fetch(`/api/resolve/legacy-matchday-preview?${canonicalContextQuery.toString()}`');
    expect(arenaText).toContain('fetch(`/api/standings/preview?${query.toString()}`');
    expect(arenaText).toContain('fetch(`/api/lineups/legacy/lab-context?${contextQuery.toString()}`');
    expect(arenaText).toContain('props.onOpenPlayerDetails?.({');
    expect(legacyLineupText).toContain("isScoreboardResultRevealed");
    expect(legacyLineupText).toContain("lineup-v2-arena-handoff");
    expect(legacyLineupText).toContain("Base-Rang");
    expect(legacyLineupText).toContain(": { form: false, mutators: false },");
    expect(arenaText).toContain("Fokus · 10 Teams");
    expect(arenaText).toContain("arena-v2-act-board");
    expect(arenaText).toContain("arena-v2-act-reveal");
    expect(arenaText).toContain("arena-v2-act-result");
    expect(arenaText).toContain("isFocusedBoardMode");
    expect(arenaText).toContain('data-testid="arena-v2-focused-board"');
    expect(arenaText).toContain("is-act-");
    expect(arenaText).toContain("arenaGuidedState");
    expect(arenaText).toContain('data-testid="arena-guided-empty-state"');
    expect(arenaText).toContain('data-testid="arena-v2-score-ticker"');
    expect(arenaText).toContain('data-testid="arena-lineup-handoff-banner"');
    expect(arenaTimelineText).toContain("PHASE_RAIL_SHORT_LABELS");
    expect(arenaTimelineText).toContain("is-labels-visible");
    expect(arenaTimelineText).toContain("matchday-arena-timeline-short-label");
    expect(presenterText).toContain('"Intensität"');
    expect(presenterText).toContain('"Kapitän"');
    expect(presenterText).toContain('"Ergebnis"');
    expect(presenterText).toContain('"slots"');
    expect(presenterText).toContain('"push"');
    expect(presenterText).not.toContain('id: "base"');
    expect(presenterText).not.toContain('id: "fatigue"');
    expect(presenterText).toContain('"result"');
    expect(presenterText).toContain("getMatchdayArenaPhaseScore");
    expect(presenterText).toContain("buildArenaTeamRankMap");
    expect(presenterText).toContain("buildArenaPlayerRankLookup");
    expect(arenaText).toContain("formatArenaRankDelta");
    expect(arenaText).toContain("arena-v2-board-rank-delta");
    expect(arenaText).toContain("arena-v2-board-track-rank");
    expect(arenaText).toContain("ARENA_PLAYER_RANK_TOOLTIPS");
    expect(arenaText).toContain("S# · Slot-Rang");
    expect(arenaText).toContain("G# · Gesamtrang");
    expect(arenaText).toContain("G+#");
    expect(arenaText).toContain("rankInSlotBase");
    expect(arenaText).toContain("arena-v2-slot-stack is-compact");
    expect(arenaText).toContain("arena-v2-rank-tag-row");
    expect(arenaText).toContain("buildArenaRankPoolSizes");
    expect(arenaText).toContain("resolveArenaEntryRankPools");
    expect(cssText).toContain(".arena-v2-rank-tag");
    expect(cssText).toContain(".arena-v2-board-track-wrap");
    expect(cssText).toContain(".arena-v2-panel-loading");
    expect(cssText).toContain(".arena-v2-timeline-panel.is-reveal-event");
    expect(cssText).toContain(".arena-v2-shell.is-event-mode");
    expect(cssText).toContain(".arena-v2-mvp-spotlight");
    expect(cssText).toContain(".matchday-arena-timeline-rail");
    expect(cssText).toContain("@keyframes arena-v2-reveal-event");
    expect(cssText).toContain("--arena-v2-board-visible-rows");
    expect(cssText).toContain(".arena-v2-board-list.is-focused-board");
    expect(cssText).toContain(".arena-v2-score-ticker");
    expect(cssText).toContain(".arena-v2-shell.is-act-prep");
    expect(cssText).toContain(".legacy-lineup-v2-handoff-overlay");
    expect(cssText).toContain(".legacy-lineup-form-board-pick.is-drag-over");
    expect(cssText).toContain(".matchday-arena-timeline-short-label");
    expect(presenterText).toContain("MATCHDAY_ARENA_PHASES");
    expect(cssText).toContain(".pill.is-loading");
    expect(cssText).toContain(".matchday-arena-lane");
    expect(cssText).toContain(".matchday-arena-timeline");
    expect(cssText).toContain(".matchday-arena-player-card");
    expect(cssText).toContain(".matchday-result-player-card");
    expect(cssText).toContain(".matchday-result-table");
    expect(cssText).toContain(".arena-v2-board-step-nav");
    expect(arenaText).toContain("arena-v2-main-grid is-full-stage");
    expect(arenaText).toContain('data-virtualized="true"');
    expect(arenaText).toContain("ArenaBoardRow");
    expect(arenaText).toContain("arena-v2-board-row-velo-strip");
    expect(arenaText).toContain("handleBoardScroll");
    expect(arenaText).toContain("matchdayWinnerByTeamId");
    expect(arenaText).toContain("VeloStatOrbitRow");
    expect(arenaText).toContain("arena-v2-breakdown-velo-strip");
    expect(arenaText).toContain("Teams links, Fokus-Spieler rechts");
    expect(cssText).toContain(".arena-v2-main-grid.is-full-stage");
    expect(cssText).toContain(".arena-v2-main-grid.is-single-discipline");
    expect(cssText).toContain("transition: width 920ms");
  });

  it("wires Spieltag-abschliessen button and lineup blocker in arena view", async () => {
    const [shellRouterBodyText, shellRouterBodyScopeText, arenaPanelText, arenaHostText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationShellRouterBody.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/FoundationMatchdayArenaPanel.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/FoundationMatchdayArenaShellHost.tsx",
        "utf8",
      ),
    ]);
    const foundationText = `${shellRouterBodyText}\n${shellRouterBodyScopeText}`;

    expect(arenaHostText).toContain('data-testid="arena-finish-matchday-button"');
    expect(foundationText).toContain("runFinishMatchdaySimple");
    expect(arenaHostText).toContain("Spieltag abschliessen");
    expect(arenaHostText).toContain("matchday-auto-run-execute");
    expect(arenaPanelText).toContain('data-testid="arena-lineup-blocker"');
    expect(foundationText).toContain("lineup_not_submitted");
  });

  it("exposes sprint J broadcast mode, result reasons, training hint, and return focus handoff", async () => {
    const [arenaText, arenaHostText, legacyLineupText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/MatchdayArenaV2Client.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/FoundationMatchdayArenaShellHost.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx",
        "utf8",
      ),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8"),
    ]);

    expect(arenaText).toContain("broadcastFocusMode");
    expect(arenaText).toContain('data-testid="arena-v2-broadcast-toggle"');
    expect(arenaText).toContain("is-broadcast-mode");
    expect(arenaText).toContain("is-arena-slot-pulse");
    expect(arenaText).toContain("is-slot-winner");
    expect(arenaText).toContain('data-testid="arena-v2-result-reasons"');
    expect(arenaText).toContain("arena-v2-result-reason-chip is-taktik");
    expect(arenaText).toContain("arena-v2-result-reason-chip is-form");
    expect(arenaText).toContain("arena-v2-result-reason-chip is-fatigue");
    expect(arenaText).toContain('data-testid="arena-v2-training-hint"');
    expect(arenaText).toContain("lineup-v2-return-focus");
    expect(arenaHostText).toContain("onOpenTraining");

    expect(legacyLineupText).toContain("lineup-v2-return-focus");

    expect(cssText).toContain("@keyframes arena-v2-slot-pulse");
    expect(cssText).toContain(".arena-v2-shell.is-broadcast-mode");
    expect(cssText).toContain(".arena-v2-training-hint");
    expect(cssText).toContain("prefers-reduced-motion");
    expect(cssText).toContain(".legacy-lineup-v2-handoff-overlay");
  });
});

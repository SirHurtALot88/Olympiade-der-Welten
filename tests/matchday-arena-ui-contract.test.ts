import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("matchday arena ui contract", () => {
  it("wires a dedicated foundation arena view with reveal controls and score lanes", async () => {
    const [foundationText, arenaText, legacyLineupText, presenterText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/MatchdayArenaV2Client.tsx",
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
    ]);

    expect(foundationText).toContain('"matchdayArena"');
    expect(foundationText).toContain('"matchdayResult"');
    expect(foundationText).toContain('{ id: "matchdayArena", label: "Arena"');
    expect(foundationText).not.toContain('{ id: "matchdayArenaV2", label: "Arena v2"');
    expect(foundationText).toContain('if (view === "matchday-arena-v2")');
    expect(foundationText).toContain('return "matchdayArena";');
    expect(foundationText).not.toContain('{ id: "matchdayResult", label: "Result" }');
    const secondaryViewsBlock = foundationText.slice(
      foundationText.indexOf("const foundationSecondaryViews"),
      foundationText.indexOf("const foundationInternalViews"),
    );
    expect(secondaryViewsBlock).not.toContain('{ id: "matchdayResult"');
    expect(foundationText).toContain("const foundationInternalViews");
    expect(foundationText).toContain('{ id: "matchdayResult", label: "Spieltagsergebnis" }');
    expect(foundationText).toContain("<MatchdayArenaV2Client");
    expect(foundationText).toContain("buildMatchdaySummary");
    expect(foundationText).toContain('id="foundation-matchday-result"');
    expect(foundationText).toContain('id="arena-result-summary"');
    expect(foundationText).toContain('data-testid="arena-result-summary"');
    expect(foundationText).toContain("arena-result-empty-state");
    expect(foundationText).toContain("Noch kein Spieltagsergebnis vorhanden");
    expect(foundationText).toContain("Spieltagsergebnis");
    expect(foundationText).toContain("Saisonstand anzeigen");
    expect(foundationText).toContain("Saisonstand ansehen");
    expect(foundationText).toContain("openPlayerDrawerById(entry.playerId, entry.activePlayerId)");
    expect(foundationText).toContain("foundation-global-next-button");
    expect(foundationText).toContain("triggerGlobalNext");
    expect(foundationText).toContain('activeView === "matchdayArena"');
    expect(foundationText).toContain("homeNextMatchdayStatus.openSlots > 0");
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
    expect(arenaText).toContain("completedDisciplinePhases");
    expect(arenaText).toContain("MatchdayArenaTimeline");
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
    expect(arenaText).toContain("handleTeamRowDoubleClick");
    expect(foundationText).toContain("onOpenTeam={openTeamDrawerById}");
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
    expect(arenaText).toContain("Promise.allSettled");
    expect(arenaText).toContain("loadResolvePreview");
    expect(arenaText).toContain("formatArenaLoadStageLabel");
    expect(arenaText).toContain("arena-v2-panel-loading");
    expect(arenaText).toContain('fetch(`/api/resolve/legacy-matchday-preview?${canonicalContextQuery.toString()}`');
    expect(arenaText).toContain('fetch(`/api/standings/preview?${query.toString()}`');
    expect(arenaText).toContain('fetch(`/api/lineups/legacy/lab-context?${contextQuery.toString()}`');
    expect(arenaText).toContain('props.onOpenPlayerDetails?.({');
    expect(legacyLineupText).toContain("isScoreboardResultRevealed");
    expect(legacyLineupText).toContain("Base-Rang");
    expect(legacyLineupText).toContain(": { form: false, mutators: false },");
    expect(presenterText).toContain("MATCHDAY_ARENA_PHASES");
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
    expect(cssText).toContain("--arena-v2-board-visible-rows");
    expect(cssText).toContain(".pill.is-loading");
    expect(cssText).toContain(".matchday-arena-lane");
    expect(cssText).toContain(".matchday-arena-timeline");
    expect(cssText).toContain(".matchday-arena-player-card");
    expect(cssText).toContain(".matchday-result-player-card");
    expect(cssText).toContain(".matchday-result-table");
    expect(cssText).toContain(".arena-v2-board-step-nav");
    expect(arenaText).toContain("arena-v2-main-grid is-full-stage");
    expect(arenaText).toContain("Teams links, Fokus-Spieler rechts");
    expect(cssText).toContain(".arena-v2-main-grid.is-full-stage");
    expect(cssText).toContain(".arena-v2-main-grid.is-single-discipline");
    expect(cssText).toContain("transition: width 920ms");
  });
});

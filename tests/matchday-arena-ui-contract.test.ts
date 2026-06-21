import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("matchday arena ui contract", () => {
  it("wires a dedicated foundation arena view with reveal controls and score lanes", async () => {
    const [foundationText, arenaText, presenterText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/MatchdayArenaV2Client.tsx",
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
    expect(arenaText).toContain("Fokus-Team");
    expect(arenaText).toContain("Was Arena v2 gerade zeigt");
    expect(arenaText).toContain("onOpenMatchdayResult");
    expect(arenaText).toContain("Play");
    expect(arenaText).toContain("Pause");
    expect(arenaText).toContain("Step");
    expect(arenaText).toContain("Ergebnis");
    expect(arenaText).toContain("slotRevealIndex");
    expect(arenaText).toContain("MatchdayArenaTimeline");
    expect(arenaText).toContain("MatchdayArenaPlayerCard");
    expect(arenaText).toContain("advanceArenaStep");
    expect(arenaText).toContain('fetch("/api/season/matchday-mvp-score"');
    expect(arenaText).toContain("const canonicalParams = contextPayload.params");
    expect(arenaText).toContain("const canonicalContextQuery = new URLSearchParams");
    expect(arenaText).toContain("seasonId: canonicalParams.seasonId");
    expect(arenaText).toContain('fetch(`/api/resolve/legacy-matchday-preview?${canonicalContextQuery.toString()}`');
    expect(arenaText).toContain('fetch(`/api/lineups/legacy/lab-context?${contextQuery.toString()}`');
    expect(arenaText).toContain('props.onOpenPlayerDetails?.({');
    expect(presenterText).toContain("MATCHDAY_ARENA_PHASES");
    expect(presenterText).toContain('"slots"');
    expect(presenterText).toContain('"push"');
    expect(presenterText).not.toContain('id: "base"');
    expect(presenterText).not.toContain('id: "fatigue"');
    expect(presenterText).toContain('"result"');
    expect(presenterText).toContain("getMatchdayArenaPhaseScore");
    expect(cssText).toContain(".matchday-arena-shell");
    expect(cssText).toContain(".matchday-arena-lane");
    expect(cssText).toContain(".matchday-arena-timeline");
    expect(cssText).toContain(".matchday-arena-player-card");
    expect(cssText).toContain(".matchday-result-player-card");
    expect(cssText).toContain(".matchday-result-table");
    expect(cssText).toContain("transition: width 920ms");
  });
});

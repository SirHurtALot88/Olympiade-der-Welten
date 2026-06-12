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
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena/MatchdayArenaClient.tsx",
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
    expect(foundationText).toContain('{ id: "matchdayArena", label: "Arena" }');
    expect(foundationText).not.toContain('{ id: "matchdayResult", label: "Result" }');
    expect(foundationText).toContain('{ id: "matchdayResult", label: "Spieltagsergebnis" }');
    expect(foundationText).toContain("<MatchdayArenaClient");
    expect(foundationText).toContain("buildMatchdaySummary");
    expect(foundationText).toContain('id="foundation-matchday-result"');
    expect(foundationText).toContain('id="arena-result-summary"');
    expect(foundationText).toContain('data-testid="arena-result-summary"');
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
    expect(arenaText).toContain("Matchday Arena");
    expect(arenaText).toContain("resolveArenaTeamId");
    expect(arenaText).toContain("teamId: resolveArenaTeamId(props.teams, props.defaultTeamId)");
    expect(arenaText).toContain("Score-Race");
    expect(arenaText).toContain("Live Top Players");
    expect(arenaText).toContain("Slot Spotlight");
    expect(arenaText).toContain("Result Board");
    expect(arenaText).toContain("Spieltagsergebnis anzeigen");
    expect(arenaText).toContain("onOpenMatchdayResult");
    expect(arenaText).toContain("Play");
    expect(arenaText).toContain("Pause");
    expect(arenaText).toContain("Step");
    expect(arenaText).toContain("Skip to Result");
    expect(arenaText).toContain("slotRevealIndex");
    expect(arenaText).toContain("Aktiver Slot");
    expect(arenaText).toContain("MatchdayArenaTimeline");
    expect(arenaText).toContain("MatchdayArenaLane");
    expect(arenaText).toContain("MatchdayArenaPlayerCard");
    expect(arenaText).toContain("advanceArenaStep");
    expect(arenaText).toContain('fetch("/api/season/matchday-mvp-score"');
    expect(arenaText).toContain('fetch(`/api/resolve/legacy-matchday-preview?${contextQuery.toString()}`');
    expect(arenaText).toContain('fetch(`/api/lineups/legacy/lab-context?${contextQuery.toString()}`');
    expect(arenaText).toContain('props.onOpenPlayerDetails?.({');
    expect(presenterText).toContain("MATCHDAY_ARENA_PHASES");
    expect(presenterText).toContain('"slots"');
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

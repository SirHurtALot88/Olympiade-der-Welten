import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { FoundationStateProvider } from "@/lib/foundation/foundation-state-context";
import FoundationDisciplineStageHost from "@/app/foundation/discipline-stage/FoundationDisciplineStageHost";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

function render(gs: any) {
  const value: any = {
    gameState: gs, setGameState: () => {}, activeSaveId: "s", activeSaveName: "s",
    foundationSaveMode: "local", readMeta: {}, readOnly: false,
    selectedTeamId: gs?.teams?.[0]?.teamId ?? "", activeManagerTeamId: gs?.teams?.[0]?.teamId ?? null,
    isFoundationBootstrapState: false, foundationManageableTeamIds: [],
    loadSave: async () => null, reloadLiveSeasonState: async () => {},
  };
  return renderToString(React.createElement(FoundationStateProvider as any, { value, children: React.createElement(FoundationDisciplineStageHost) }));
}

describe("discipline-stage render robustness", () => {
  it("full save renders the board", () => {
    const html = render(createSingleplayerGameState());
    expect(html.length).toBeGreaterThan(100);
  });
  it("bootstrap/partial state (empty object) does NOT throw", () => {
    const html = render({});                 // gameState with no arrays at all
    expect(html).toContain("Disziplin-Bühne");
  });
  it("undefined-ish arrays do NOT throw", () => {
    const html = render({ disciplines: undefined, teams: undefined, players: undefined, rosters: undefined });
    expect(html).toContain("Disziplin-Bühne");
  });
});

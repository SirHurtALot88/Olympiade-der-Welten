import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import FoundationDisciplineStageHost from "@/app/foundation/discipline-stage/FoundationDisciplineStageHost";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

// Der Host bekommt GameState + Team-Auswahl über Props (er liegt ausserhalb des
// FoundationStateProvider), also genau so rendern wie der Router-Body es tut.
function render(gs: any) {
  const teamId = gs?.teams?.[0]?.teamId ?? "";
  return renderToString(
    React.createElement(FoundationDisciplineStageHost as any, {
      gameState: gs,
      selectedTeamId: teamId,
      activeManagerTeamId: teamId || null,
    }),
  );
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

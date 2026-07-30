import { readFileSync } from "node:fs";
import { join } from "node:path";

import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DisciplineStageMatchdayPanel, {
  type MatchdayPanelPlayerRow,
} from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";

/**
 * "Ich finde auch hier in der Spieltagstabelle sollten die Top-Spieler ihre
 * Diamant/Gold/Silber/Bronze-Rahmen bekommen nach den Top 50 OVR, damit man die
 * besten Spieler hier auch direkt erkennt."
 *
 * Die Portraits in Kader, Arena und Drawer tragen die ligaweite Top-Riege laengst
 * (`lib/foundation/player-star-tier.ts`); die Spieler-Chips der Spieltags-Wertung
 * waren die letzte Stelle ohne. Der Test rendert das Panel wirklich (SSR) statt den
 * Quelltext zu lesen — die Zusage ist "am Chip steht die richtige Stufe", nicht
 * "im Code steht ein Aufruf".
 *
 * Die Schwellen selbst werden hier bewusst NICHT nachgebaut: sie gehoeren in
 * `player-star-tier.ts` und werden dort geprueft (tests/player-star-tier.test.ts).
 * Geprueft wird nur, dass der Chip den OVR-RANG durchreicht und die Stufe daraus
 * entsteht.
 */

const PANEL_SOURCE = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx"),
  "utf8",
);

function player(over: Partial<MatchdayPanelPlayerRow> & { playerId: string }): MatchdayPanelPlayerRow {
  return {
    name: over.playerId.toUpperCase(),
    pp: 3,
    score: 80,
    mutatorPp: null,
    ovrRank: null,
    ...over,
  };
}

function render(d1Players: MatchdayPanelPlayerRow[]): string {
  return renderToString(
    React.createElement(DisciplineStageMatchdayPanel as never, {
      teamResults: [
        { teamId: "t1", d1DisciplineId: "ispy", d1Points: 6.6, d2DisciplineId: "basket", d2Points: 4.4, totalPoints: 11 },
      ],
      standings: [
        { teamId: "t1", currentRank: 1, projectedRank: 1, currentPoints: 10, projectedPoints: 21, pointsDelta: 11 },
      ],
      d1: { disciplineId: "ispy", displayName: "I Spy" },
      d2: { disciplineId: "basket", displayName: "Basketball" },
      d1Revealed: true,
      d2Revealed: false,
      teamMetaById: new Map([["t1", { code: "AAA", name: "Team A", logoUrl: null }]]),
      ownTeamId: "t1",
      mutatorByTeam: null,
      playersByTeam: new Map([["t1", { d1: d1Players, d2: [] }]]),
      modifiersByTeam: null,
    }),
  );
}

/** Das `class`-Attribut des Chips eines Spielers aus dem gerenderten HTML ziehen. */
function chipClass(html: string, name: string): string {
  const marker = `<strong style="font-weight:700">${name}</strong>`;
  const end = html.indexOf(marker);
  expect(end, `Chip fuer ${name} nicht gerendert`).toBeGreaterThan(-1);
  const chipStart = html.lastIndexOf("<span class=", end);
  const match = /^<span class="([^"]*)"/.exec(html.slice(chipStart));
  return match?.[1] ?? "";
}

/** Der `title` des Chips eines Spielers. */
function chipTitle(html: string, name: string): string {
  const end = html.indexOf(`<strong style="font-weight:700">${name}</strong>`);
  const chipStart = html.lastIndexOf("<span class=", end);
  const match = /title="([^"]*)"/.exec(html.slice(chipStart, end));
  return match?.[1] ?? "";
}

describe("Spieltags-Wertung: Star-Tier-Rahmen an den Spieler-Chips", () => {
  it("gibt jeder Top-50-Stufe ihre Klasse — und allem darunter keine", () => {
    const html = render([
      player({ playerId: "top1", name: "Top1", ovrRank: 1, pp: 9 }),
      player({ playerId: "top9", name: "Top9", ovrRank: 9, pp: 8 }),
      player({ playerId: "top20", name: "Top20", ovrRank: 20, pp: 7 }),
      player({ playerId: "top44", name: "Top44", ovrRank: 44, pp: 6 }),
      player({ playerId: "top51", name: "Top51", ovrRank: 51, pp: 5 }),
    ]);
    expect(chipClass(html, "Top1")).toContain("is-star-tier-diamond");
    expect(chipClass(html, "Top9")).toContain("is-star-tier-gold");
    expect(chipClass(html, "Top20")).toContain("is-star-tier-silver");
    expect(chipClass(html, "Top44")).toContain("is-star-tier-bronze");
    // Kein Rang ohne Stufe: Platz 51 ist kein Bronze-Fallback.
    expect(chipClass(html, "Top51")).not.toContain("is-star-tier");
  });

  it("laesst Spieler ohne Rang rahmenlos", () => {
    // Spieler ohne Roster-Eintrag haben keinen ligaweiten Rang. Ein Fallback auf
    // Bronze wuerde jedem von ihnen einen Rahmen anhaengen.
    const html = render([player({ playerId: "ohne", name: "Ohne", ovrRank: null })]);
    expect(chipClass(html, "Ohne")).not.toContain("is-star-tier");
  });

  it("macht die Heat-Faerbung der PP nicht kaputt", () => {
    // Beide Aussagen stehen nebeneinander: "wie stark heute" (Heat-Band, Hintergrund)
    // und "Top N der Liga" (Star-Tier, Ring). Der Chip traegt daher BEIDE Klassen.
    const html = render([
      player({ playerId: "stark", name: "Stark", ovrRank: 2, pp: 9 }),
      player({ playerId: "schwach", name: "Schwach", ovrRank: 3, pp: 1 }),
    ]);
    const stark = chipClass(html, "Stark");
    expect(stark).toContain("matchday-panel-player");
    expect(stark).toMatch(/heat-band-\d/);
    expect(stark).toContain("is-star-tier-diamond");
    // Unterschiedliche PP → unterschiedliches Heat-Band, gleiche Stufe.
    expect(chipClass(html, "Schwach")).toContain("is-star-tier-diamond");
    expect(chipClass(html, "Schwach")).not.toBe(stark);
  });

  it("nennt Stufe und OVR-Rang im Tooltip", () => {
    // Sonst raet man, warum ein Chip leuchtet.
    const html = render([player({ playerId: "gold", name: "Gold", ovrRank: 7, pp: 4 })]);
    const title = chipTitle(html, "Gold");
    expect(title).toContain("Gold · Liga-Top-10");
    expect(title).toContain("OVR #7");
    // Der bisherige Inhalt bleibt vorne stehen.
    expect(title.startsWith("Gold · 4.0 PP")).toBe(true);
  });

  it("holt Stufen und Schwellen aus dem gemeinsamen Begriff", () => {
    // Keine zweite Tier-/Farbliste neben `player-star-tier.ts`.
    expect(PANEL_SOURCE).toContain('from "@/lib/foundation/player-star-tier"');
    expect(PANEL_SOURCE).toContain("getPlayerStarTier(entry.ovrRank)");
    for (const tier of ["diamond", "gold", "silver", "bronze"]) {
      expect(PANEL_SOURCE).not.toContain(`is-star-tier-${tier}`);
    }
  });
});

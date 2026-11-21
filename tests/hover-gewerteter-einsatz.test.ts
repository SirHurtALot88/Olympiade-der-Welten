/**
 * TEAM-HOVER DER SPIELTAGSWERTUNG (21.11., Chris: „Eingesetzt — noch offen“, obwohl der Spieltag
 * gewertet war). Die Karte bekommt je Team die gewerteten Seiten aus derselben Quelle wie die
 * Spieltagswertung (`playersByTeam`) — nur aufgedeckte Seiten, kein Spoiler.
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GewerteterEinsatz } from "@/app/foundation/discipline-stage/DisciplineStageHoverPreview";
import type { MatchdayPanelPlayerRow } from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";
import { baueGewertetenEinsatz, zeigeLiveEinsatz } from "@/app/foundation/discipline-stage/hover-gewerteter-einsatz";
import type { GameState } from "@/lib/data/olyDataTypes";

const spieler = (playerId: string, pp: number | null, score: number | null): MatchdayPanelPlayerRow => ({
  playerId,
  name: `Spieler ${playerId}`,
  pp,
  score,
  mutatorPp: null,
});

const playersByTeam = new Map([
  ["a", { d1: [spieler("a1", 1.4, 68.7), spieler("a2", 0.6, 52.2)], d2: [spieler("a3", 0.9, 44.4)] }],
  ["b", { d1: [spieler("b1", 0.2, 30)], d2: [] }],
]);
const d1 = { disciplineId: "tennis", displayName: "Tennis" };
const d2 = { disciplineId: "i-spy", displayName: "I-Spy" };

describe("baueGewertetenEinsatz", () => {
  it("beide Seiten aufgedeckt: je Team D1 und D2 mit Spielern", () => {
    const map = baueGewertetenEinsatz({ playersByTeam, d1, d2, d1Revealed: true, d2Revealed: true });
    expect(map.get("a")!.map((b) => [b.seite, b.titel, b.spieler.length])).toEqual([
      ["d1", "Tennis", 2],
      ["d2", "I-Spy", 1],
    ]);
    // Leere Seite entfällt.
    expect(map.get("b")!.map((b) => b.seite)).toEqual(["d1"]);
  });

  it("verdeckte Seite liefert nichts (Anti-Spoiler)", () => {
    const map = baueGewertetenEinsatz({ playersByTeam, d1, d2, d1Revealed: true, d2Revealed: false });
    expect(map.get("a")!.map((b) => b.seite)).toEqual(["d1"]);
    expect(baueGewertetenEinsatz({ playersByTeam, d1, d2, d1Revealed: false, d2Revealed: false }).size).toBe(0);
  });

  it("Live-Liste nur für eine noch nicht gewertete laufende Disziplin", () => {
    const map = baueGewertetenEinsatz({ playersByTeam, d1, d2, d1Revealed: true, d2Revealed: false });
    expect(zeigeLiveEinsatz(map.get("a"), "i-spy")).toBe(true);
    expect(zeigeLiveEinsatz(map.get("a"), "tennis")).toBe(false);
    expect(zeigeLiveEinsatz(null, "tennis")).toBe(true);
  });
});

describe("Hover-Karte: gewerteter Block statt „noch offen“", () => {
  it("zeigt je Spieler Score und PP der gewerteten Disziplin", () => {
    const block = baueGewertetenEinsatz({ playersByTeam, d1, d2, d1Revealed: true, d2Revealed: true }).get("a")![0]!;
    const gameState = { players: [] } as unknown as GameState;
    const html = renderToString(React.createElement(GewerteterEinsatz, { block, gameState, fallbackColor: "red" }));
    expect(html).toContain("Eingesetzt · <!-- -->Tennis");
    expect(html).toContain("Spieler a1");
    expect(html).toContain("1,4 PP");
    expect(html).toContain("68,7");
    expect(html).not.toContain("noch offen");
  });
});

import { describe, expect, it } from "vitest";

import {
  computeSlotOrder,
  computeStageCrown,
  isInjuryMod,
  resolveStageHighlight,
  type NativeStagePlayer,
  type StageSlotTeam,
} from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";

/**
 * Etappen-Kür (Owner-Wunsch): die Highlights der Arena sind Verletzungen UND der
 * beste Spieler jeder Etappe. Die Top 3 der Etappe werden mit Gold/Silber/Bronze
 * gekürt (Spielerkarten + Rahmen am Token), der Zoom fährt auf den Etappenbesten;
 * bei einer Verletzung zeigt der Zoom weiterhin die Betroffenen. Diese Suite testet
 * die puren Helfer, aus denen der Host (advance + rAF) diesen Moment baut — die
 * Arena selbst braucht dafür keinen Mount.
 */

function player(over: Partial<NativeStagePlayer> & { val: number; name: string }): NativeStagePlayer {
  return {
    playerId: over.playerId ?? `p-${over.name}`,
    portraitUrl: null,
    mods: [],
    pointsAwarded: null,
    ...over,
  };
}

function team(over: Partial<StageSlotTeam> & { idx: number; code: string; players: NativeStagePlayer[] }): StageSlotTeam {
  return {
    name: `Team ${over.code}`,
    logoUrl: null,
    isOwn: false,
    seasonRank: over.idx + 1,
    ...over,
  };
}

describe("Arena · Verletzungs-Erkennung (isInjuryMod)", () => {
  it("erkennt den typisierten Flag und die Text-Fallbacks, aber keine normalen Mali", () => {
    // Bevorzugt der echte Flag (discipline-stage-from-preview.ts) …
    expect(isInjuryMod({ k: "Sturz", sign: -1, amt: 5, injury: true })).toBe(true);
    // … Regex bleibt Fallback für Datenpfade ohne Flag (Random-/Modell-Modus).
    expect(isInjuryMod({ k: "Verletzung", sign: -1, amt: 8 })).toBe(true);
    expect(isInjuryMod({ k: "injury risk", sign: -1, amt: 3 })).toBe(true);
    // Ein gewöhnlicher Malus ist KEINE Verletzung — sonst zöge jede Fatigue den Zoom.
    expect(isInjuryMod({ k: "Fatigue", sign: -1, amt: 4 })).toBe(false);
  });
});

describe("Arena · Etappen-Reihenfolge (computeSlotOrder)", () => {
  it("sortiert nach Netto des Slot-Spielers absteigend, Tiebreak Season-Rang", () => {
    const teams = [
      team({ idx: 0, code: "AAA", seasonRank: 5, players: [player({ val: 40, name: "A1" })] }),
      // 50 − 20 = 30 netto → trotz höherem Rohwert hinter AAA.
      team({ idx: 1, code: "BBB", seasonRank: 1, players: [player({ val: 50, name: "B1", mods: [{ k: "Form", sign: -1, amt: 20 }] })] }),
      // Gleiche 40 wie AAA, aber besserer Season-Rang → vor AAA.
      team({ idx: 2, code: "CCC", seasonRank: 2, players: [player({ val: 40, name: "C1" })] }),
    ];
    const order = computeSlotOrder(teams, 0);
    expect(order.map((o) => o.t.code)).toEqual(["CCC", "AAA", "BBB"]);
    expect(order.map((o) => o.net)).toEqual([40, 40, 30]);
  });

  it("führt Teams ohne Spieler im Slot als has=false (fehlender Wert, keine erfundene 0)", () => {
    const teams = [
      team({ idx: 0, code: "AAA", players: [player({ val: 10, name: "A1" })] }),
      team({ idx: 1, code: "LEER", players: [] }),
    ];
    const order = computeSlotOrder(teams, 0);
    const leer = order.find((o) => o.t.code === "LEER")!;
    expect(leer.has).toBe(false);
  });
});

describe("Arena · Etappen-Kür (computeStageCrown)", () => {
  const teams = [
    team({ idx: 0, code: "GLD", isOwn: true, seasonRank: 4, logoUrl: "/gld.png", players: [player({ val: 90, name: "Goldjunge", ovrRank: 3 })] }),
    team({ idx: 1, code: "SLB", seasonRank: 2, players: [player({ val: 70, name: "Silberling" })] }),
    team({ idx: 2, code: "BRZ", seasonRank: 3, players: [player({ val: 60, name: "Bronzo", mods: [{ k: "Verletzung", sign: -1, amt: 5 }] })] }),
    team({ idx: 3, code: "VIER", seasonRank: 1, players: [player({ val: 10, name: "Vierter" })] }),
    // Kein Auftritt in diesem Slot → darf NICHT gekürt werden.
    team({ idx: 4, code: "LEER", seasonRank: 5, players: [] }),
  ];

  it("kürt genau die 3 besten echten Auftritte mit Gold/Silber/Bronze", () => {
    const crown = computeStageCrown(computeSlotOrder(teams, 0), 0);
    expect(crown.map((c) => [c.teamCode, c.medal])).toEqual([
      ["GLD", 1],
      ["SLB", 2],
      ["BRZ", 3],
    ]);
    // Karten-Daten tragen Spieler UND Team-Kontext (Logo fürs Overlay).
    expect(crown[0]).toMatchObject({ name: "Goldjunge", isOwn: true, logoUrl: "/gld.png", net: 90, ovrRank: 3 });
    // Verletzung des Bronze-Manns wandert mit auf die Karte (roter Ring am Portrait).
    expect(crown[2]!.injured).toBe(true);
    expect(crown[1]!.injured).toBe(false);
  });

  it("überspringt Teams ohne Spieler im Slot — keine leere Karte mit erfundener 0", () => {
    const crown = computeStageCrown(computeSlotOrder(teams, 0), 0);
    expect(crown.some((c) => c.teamCode === "LEER")).toBe(false);
  });

  it("kürt bei weniger als 3 Auftritten entsprechend weniger Plätze", () => {
    const two = [teams[0]!, teams[1]!, team({ idx: 9, code: "OHNE", players: [] })];
    const crown = computeStageCrown(computeSlotOrder(two, 0), 0);
    expect(crown).toHaveLength(2);
    expect(crown.map((c) => c.medal)).toEqual([1, 2]);
  });
});

describe("Arena · Highlight-Anlass (resolveStageHighlight)", () => {
  const crown = computeStageCrown(
    computeSlotOrder(
      [
        team({ idx: 0, code: "GLD", players: [player({ val: 90, name: "Goldjunge" })] }),
        team({ idx: 1, code: "SLB", players: [player({ val: 70, name: "Silberling" })] }),
        team({ idx: 2, code: "BRZ", players: [player({ val: 60, name: "Bronzo" })] }),
      ],
      0,
    ),
    0,
  );

  it("Kür-Etappe: Trio = alle drei Gekürten, Zoom NUR auf den Etappenbesten, Karten an", () => {
    const focus = resolveStageHighlight({ injuredIdxs: [], crown });
    expect(focus.cause).toBe("kuer");
    expect(focus.trioIdxs).toEqual([0, 1, 2]);
    // „auf den soll dann auch der zoom kommen" — der beste Spieler der Etappe.
    expect(focus.zoomIdxs).toEqual([0]);
    expect(focus.showCards).toBe(true);
  });

  it("Verletzung schlägt Kür: Zoom auf die Betroffenen, Karten treten zurück", () => {
    const focus = resolveStageHighlight({ injuredIdxs: [7, 3], crown });
    expect(focus.cause).toBe("injury");
    expect(focus.trioIdxs).toEqual([7, 3]);
    expect(focus.zoomIdxs).toEqual([7, 3]);
    // Das Verletzungs-Spotlight trägt diesen Moment — zwei Overlays wären Lärm.
    expect(focus.showCards).toBe(false);
  });

  it("deckelt den Verletzungs-Fokus auf 3 Teams (Zoom-Schwerpunkt bleibt eng)", () => {
    const focus = resolveStageHighlight({ injuredIdxs: [1, 2, 3, 4, 5], crown });
    expect(focus.trioIdxs).toEqual([1, 2, 3]);
  });

  it("ohne Verletzung und ohne echte Auftritte gibt es keinen Highlight-Moment", () => {
    const focus = resolveStageHighlight({ injuredIdxs: [], crown: [] });
    expect(focus.cause).toBeNull();
    expect(focus.trioIdxs).toEqual([]);
    expect(focus.showCards).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  resolveSpieltagTeamHighlight,
  splitSpieltagItemsByLeague,
} from "@/app/foundation/season-v2/SeasonStandingsNewLook";

/**
 * TASK #159 PUNKT 2, Folgeauftrag — Spieltage: Liga 1/Liga 2 nebeneinander statt Umschalter,
 * plus Hervorhebung des eigenen Teams und Frankys Team.
 *
 * Chris, wörtlich (Spieltage-Screenshot): „hier kannst du links liga 1 und rechts liga 2
 * matchups machen. Bitte hier das eigene team hervorheben und das von franky bzw alle
 * menschlich gesteuerten".
 *
 * Reiner Unit-Test der beiden EXPORTIERTEN Pure-Funktionen, die diese zwei Zusagen tragen
 * (`splitSpieltagItemsByLeague`, `resolveSpieltagTeamHighlight`) — kein Component-Mounting: diese
 * Suite hat keine @testing-library/react-/jsdom-Abhängigkeit (s. Kommentar in
 * tests/season-spieltage-performance-contract.test.ts), und `SeasonStandingsNewLook` startet in
 * jedem `renderToString`-SSR-Smoke deterministisch im Default-Modus "Daten"
 * (`NL_STANDINGS_DEFAULT_MODE`) — der "Spieltage"-Modus selbst ist damit über `renderToString`
 * gar nicht erreichbar. Die beiden Funktionen sind aber genau das, was `renderSpieltageMode()`
 * tatsächlich aufruft, kein Parallel-Stub.
 */

describe("splitSpieltagItemsByLeague", () => {
  it("teilt Paarungen nach leagueTier in liga1/liga2/unassigned", () => {
    const items = [
      { id: "a", leagueTier: "liga1" as const },
      { id: "b", leagueTier: "liga2" as const },
      { id: "c", leagueTier: "liga1" as const },
      { id: "d", leagueTier: null },
    ];
    const result = splitSpieltagItemsByLeague(items);
    expect(result.liga1.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result.liga2.map((item) => item.id)).toEqual(["b"]);
    expect(result.unassigned.map((item) => item.id)).toEqual(["d"]);
  });

  it("Legacy-32er (kein Split, jedes leagueTier null): alles landet in unassigned, nichts verschwindet", () => {
    const items = [
      { id: "a", leagueTier: null },
      { id: "b", leagueTier: null },
    ];
    const result = splitSpieltagItemsByLeague(items);
    expect(result.liga1).toEqual([]);
    expect(result.liga2).toEqual([]);
    expect(result.unassigned.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("leere Liste bleibt leer in allen drei Eimern", () => {
    const result = splitSpieltagItemsByLeague([]);
    expect(result).toEqual({ liga1: [], liga2: [], unassigned: [] });
  });
});

describe("resolveSpieltagTeamHighlight", () => {
  it("eigenes Team (isSelected) -> 'self'", () => {
    expect(resolveSpieltagTeamHighlight({ isSelected: true, isFrankyTeam: false })).toBe("self");
  });

  it("Frankys Team (isFrankyTeam, nicht eigenes) -> 'franky'", () => {
    expect(resolveSpieltagTeamHighlight({ isSelected: false, isFrankyTeam: true })).toBe("franky");
  });

  it("weder eigenes noch Frankys Team -> null (KI-/neutrales Team)", () => {
    expect(resolveSpieltagTeamHighlight({ isSelected: false, isFrankyTeam: false })).toBeNull();
  });

  it("fehlende Zeile (kein Eintrag in standingsRowByTeamId) -> null, kein Crash", () => {
    expect(resolveSpieltagTeamHighlight(undefined)).toBeNull();
    expect(resolveSpieltagTeamHighlight(null)).toBeNull();
  });

  it("Präzedenz 'self' vor 'franky', falls je beide Felder zugleich gesetzt wären", () => {
    expect(resolveSpieltagTeamHighlight({ isSelected: true, isFrankyTeam: true })).toBe("self");
  });

  it("fehlende Felder (älterer Host ohne isFrankyTeam) -> null statt Crash", () => {
    expect(resolveSpieltagTeamHighlight({})).toBeNull();
  });
});

/**
 * Die Wiring-Frage "wird `isFrankyTeam` auf dem TATSAECHLICH gerenderten Pfad echt berechnet,
 * nicht nur im nirgends gerenderten Zweitmodell" hat bereits einen eigenen, vom Quelltext-
 * Wächter (`scripts/fahre-quelltext-waechter.ts`) automatisch eingesammelten Test —
 * `tests/saisonstand-zeilen-beide-bauer-gleich.test.ts` (`PFLICHTFELDER`). `isFrankyTeam:` steht
 * dort jetzt in der Liste statt hier ein zweites, driftendes Mal.
 */

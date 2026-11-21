import { describe, expect, it } from "vitest";

import { computeArenaTeamPointsFromFixtureResults } from "@/lib/resolve/battle-mode-arena-team-points";
import { pruefeRohesDuellErgebnis } from "@/lib/battle/arena-node-runner";

/**
 * Die Anzeige-Zahl (Zeit bzw. besiegte Gegner, 21.11.) reist vom Motor-Ergebnis zu beiden Teams eines Duells:
 * Heim bekommt `[heim, gast]`, Gast die vertauschten Werte. `seiten` und Punkte bleiben unberuehrt.
 */
describe("Ergebnis-Anzeige durchreichen", () => {
  const fixture = {
    homeTeamId: "h",
    awayTeamId: "g",
    seiten: [1, 0] as [number, number],
    boxscore: [],
    anzeige: { art: "zeit" as const, werte: [325.4, 415.1] as [number, number] },
  };

  it("vertauscht die Werte fuer das Gastteam und aendert Punkte und Seitenstand nicht", () => {
    const aus = computeArenaTeamPointsFromFixtureResults([fixture], new Map());
    expect(aus.get("h")?.anzeige).toEqual({ art: "zeit", werte: [325.4, 415.1] });
    expect(aus.get("g")?.anzeige).toEqual({ art: "zeit", werte: [415.1, 325.4] });
    expect(aus.get("h")?.seiten).toEqual([1, 0]);
    expect(aus.get("g")?.seiten).toEqual([0, 1]);
    expect(aus.get("h")?.teamPoints).toBeGreaterThan(aus.get("g")!.teamPoints);
  });

  it("ohne Anzeige-Zahl bleibt der Schluessel weg", () => {
    const { anzeige: _weg, ...ohne } = fixture;
    const aus = computeArenaTeamPointsFromFixtureResults([ohne], new Map());
    expect("anzeige" in (aus.get("h") ?? {})).toBe(false);
  });

  it("der Node-Runner prueft die Form der Anzeige-Zahl", () => {
    const roh = { disziplin: "time-trial", seiten: [1, 0], boxscore: [], anzeige: { art: "zeit", werte: [1, 2] } };
    expect(pruefeRohesDuellErgebnis(roh, "test")).toBe(roh);
    expect(() => pruefeRohesDuellErgebnis({ ...roh, anzeige: { art: "zeit", werte: [1] } }, "test")).toThrow(/anzeige/);
    expect(() => pruefeRohesDuellErgebnis({ ...roh, anzeige: { art: "quatsch", werte: [1, 2] } }, "test")).toThrow(/anzeige/);
  });
});

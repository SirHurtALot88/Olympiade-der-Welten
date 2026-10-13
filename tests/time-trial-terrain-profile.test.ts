import { describe, expect, it } from "vitest";

import { buildTimeTrialTerrainProfile, type TerrainZoneKind } from "@/lib/matchday-arena/time-trial-terrain";

/**
 * ZF1.1 (`docs/design/fable-konzept-broadcast-vorbilder-13-10.md` Abschnitt 3.1): das
 * Geländeprofil der Spieltags-Bühne ist "ein deterministisch aus der Matchday-ID gezogenes
 * Profil" — rein informativ, Klasse A. Die einzige Garantie, die ein A-Baustein braucht: gleiche
 * Matchday-ID → immer dasselbe Profil, über beliebig viele Aufrufe/Sessions hinweg.
 */
describe("buildTimeTrialTerrainProfile", () => {
  it("liefert für dieselbe Matchday-ID immer dieselben Zonen", () => {
    const a = buildTimeTrialTerrainProfile("save-42:season-3:matchday-7");
    const b = buildTimeTrialTerrainProfile("save-42:season-3:matchday-7");
    expect(a.zones).toEqual(b.zones);
  });

  it("liefert für dieselbe Matchday-ID dieselbe Höhenfunktion (an mehreren Stichproben)", () => {
    const a = buildTimeTrialTerrainProfile("save-7:season-1:matchday-1");
    const b = buildTimeTrialTerrainProfile("save-7:season-1:matchday-1");
    for (let i = 0; i <= 10; i += 1) {
      const frac = i / 10;
      expect(a.elevationAt(frac)).toBe(b.elevationAt(frac));
    }
  });

  it("deckt die Strecke lückenlos und überlappungsfrei ab (3 oder 4 Zonen)", () => {
    const ids = ["m-1", "m-2", "m-3", "m-4", "m-5", "m-6", "m-7", "m-8", "m-9", "m-10"];
    for (const id of ids) {
      const { zones } = buildTimeTrialTerrainProfile(id);
      expect(zones.length === 3 || zones.length === 4).toBe(true);
      expect(zones[0]!.from).toBe(0);
      expect(zones[zones.length - 1]!.to).toBe(1);
      for (let i = 1; i < zones.length; i += 1) {
        expect(zones[i]!.from).toBe(zones[i - 1]!.to);
      }
      // Erste Zone ist nie "abfahrt" — ein Zeitfahren startet nicht im Sturz bergab.
      expect(zones[0]!.kind).not.toBe("abfahrt");
      // Keine zwei gleichen Zonenarten direkt hintereinander (sonst wäre die Grenze unsichtbar).
      for (let i = 1; i < zones.length; i += 1) {
        expect(zones[i]!.kind).not.toBe(zones[i - 1]!.kind);
      }
    }
  });

  it("elevationAt bleibt für jede Streckenposition in [0,1]", () => {
    const { elevationAt } = buildTimeTrialTerrainProfile("matchday-xyz");
    for (let i = 0; i <= 50; i += 1) {
      const h = elevationAt(i / 50);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
      expect(Number.isFinite(h)).toBe(true);
    }
    // Außerhalb [0,1] wird geklemmt statt zu extrapolieren.
    expect(elevationAt(-1)).toBe(elevationAt(0));
    expect(elevationAt(2)).toBe(elevationAt(1));
  });

  it("verschiedene Matchday-IDs ergeben i.d.R. verschiedene Profile (keine Konstante)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 24; i += 1) {
      const { zones } = buildTimeTrialTerrainProfile(`probe-${i}`);
      seen.add(zones.map((z) => `${z.kind}:${z.from.toFixed(3)}-${z.to.toFixed(3)}`).join("|"));
    }
    // Nicht alle 24 Saaten duerfen auf denselben Kartensatz fallen (das war genau der Bug, den
    // CLAUDE.md fuer `zieheFormkarten` beschreibt — untere statt obere Bits eines LCG).
    expect(seen.size).toBeGreaterThan(1);
  });

  it("jede Zone ist eine gültige TerrainZoneKind", () => {
    const valid: TerrainZoneKind[] = ["steigung", "abfahrt", "flach"];
    const { zones } = buildTimeTrialTerrainProfile("kind-check");
    for (const z of zones) expect(valid).toContain(z.kind);
  });
});

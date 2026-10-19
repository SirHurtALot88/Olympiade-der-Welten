import { describe, expect, it } from "vitest";

import {
  berechneErgebnisNormiertNTeam,
  berechneMiniDmPodOverride,
  berechneMiniDmPodOverrides,
  MINI_DM_POD_TEAM_PUNKTE,
} from "@/lib/resolve/mini-dm-pod-resolve";
import { resolveNiveauReferenz } from "@/lib/resolve/battle-mode-pps-duell";
import type { MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPod(teamIds: readonly [string, string, string, string]): MiniDmPod {
  return {
    id: "pod-test",
    seasonId: "season-test",
    matchdayId: "matchday-test",
    leagueTier: "liga1",
    occurrenceInSeason: 1,
    teamIds,
  };
}

describe("berechneErgebnisNormiertNTeam (N-Team-0-10-Normierung, Property-Test)", () => {
  const FELDGROESSEN = [2, 3, 4, 5, 6] as const;

  it("Ordnungsgarantie: wert[0] >= wert[1] >= ... >= wert[n-1] IMMER, bounded [0,10] -- ueber " +
    "4000 zufaellige Scores, M90-Referenzen (inkl. fehlend/0) und Pod-Groessen 1..6", () => {
    const zufall = mulberry32(191_019);
    let geprueft = 0;
    for (let i = 0; i < 4000; i += 1) {
      const n = 1 + Math.floor(zufall() * 6); // 1..6, ein Mini-DM-Pod hat immer 4, die Funktion ist aber generisch
      const teams = Array.from({ length: n }, (_, index) => ({ teamId: `team-${index}`, score: 0 }));
      // Zufaellige Scores, absteigend sortiert (wie `sortierePodTeams()` es liefert) -- inklusive
      // exakter Gleichstaende (Luecke 0) und stark negativer Werte.
      const roheScores = Array.from({ length: n }, () => (zufall() - 0.3) * 400);
      roheScores.sort((a, b) => b - a);
      teams.forEach((team, index) => {
        team.score = zufall() < 0.15 && index > 0 ? teams[index - 1]!.score : roheScores[index]!;
      });

      const m90Roll = zufall();
      const m90 = m90Roll < 0.15 ? null : m90Roll < 0.3 ? 0 : zufall() * 200;
      const referenzRoll = zufall();
      const niveauReferenz =
        referenzRoll < 0.3
          ? null
          : resolveNiveauReferenz("pps", FELDGROESSEN[Math.floor(zufall() * FELDGROESSEN.length)]! === 2 ? "tennis" : "mini-dm", FELDGROESSEN[Math.floor(zufall() * FELDGROESSEN.length)]!);

      const werte = berechneErgebnisNormiertNTeam({ sortiert: teams, m90, niveauReferenz });
      geprueft += 1;

      expect(werte.length, `#${i} n=${n}`).toBe(n);
      for (const wert of werte) {
        expect(wert).toBeGreaterThanOrEqual(0);
        expect(wert).toBeLessThanOrEqual(10);
        expect(Number.isInteger(wert)).toBe(true);
      }
      for (let k = 0; k < werte.length - 1; k += 1) {
        expect(werte[k]!, `#${i} n=${n} k=${k} werte=${JSON.stringify(werte)} scores=${JSON.stringify(teams.map((t) => t.score))}`).toBeGreaterThanOrEqual(
          werte[k + 1]!,
        );
      }
    }
    expect(geprueft).toBe(4000);
  });

  it("vier klar getrennte Scores -> vier STRIKT absteigende Werte (keine Ties, wenn die Luecken > 0 sind)", () => {
    const werte = berechneErgebnisNormiertNTeam({
      sortiert: [
        { teamId: "a", score: 100 },
        { teamId: "b", score: 70 },
        { teamId: "c", score: 40 },
        { teamId: "d", score: 10 },
      ],
      m90: 50,
      niveauReferenz: null,
    });
    expect(werte).toHaveLength(4);
    expect(werte[0]!).toBeGreaterThan(werte[1]!);
    expect(werte[1]!).toBeGreaterThan(werte[2]!);
    expect(werte[2]!).toBeGreaterThan(werte[3]!);
  });

  it("vier exakt gleiche Scores -> vier gleiche Werte (Luecke 0 ueberall)", () => {
    const werte = berechneErgebnisNormiertNTeam({
      sortiert: [
        { teamId: "a", score: 50 },
        { teamId: "b", score: 50 },
        { teamId: "c", score: 50 },
        { teamId: "d", score: 50 },
      ],
      m90: 50,
      niveauReferenz: null,
    });
    expect(new Set(werte).size).toBe(1);
  });

  it("eine riesige Spanne (weit ueber M90) wird kollektiv auf [0,10] gestaucht, bleibt aber geordnet", () => {
    const werte = berechneErgebnisNormiertNTeam({
      sortiert: [
        { teamId: "a", score: 10_000 },
        { teamId: "b", score: 5_000 },
        { teamId: "c", score: 1_000 },
        { teamId: "d", score: 0 },
      ],
      m90: 10,
      niveauReferenz: null,
    });
    expect(werte[0]!).toBeLessThanOrEqual(10);
    expect(werte[0]! - werte[3]!).toBeLessThanOrEqual(10);
    expect(werte[0]!).toBeGreaterThanOrEqual(werte[1]!);
    expect(werte[1]!).toBeGreaterThanOrEqual(werte[2]!);
    expect(werte[2]!).toBeGreaterThanOrEqual(werte[3]!);
  });
});

describe("berechneMiniDmPodOverride (ein Pod -> vier Team-Overrides)", () => {
  it("vergibt 2-1-0-0 nach Platz, Platz 1 = hoechster Score", () => {
    const scoreByTeamId = new Map([
      ["team-c", 10],
      ["team-a", 90],
      ["team-d", 5],
      ["team-b", 50],
    ]);
    const pod = buildPod(["team-a", "team-b", "team-c", "team-d"]);
    const overrides = berechneMiniDmPodOverride({ pod, scoreByTeamId, disciplineId: "mini-dm", playerCount: 2 });
    expect(overrides).not.toBeNull();
    expect(overrides!.get("team-a")!.platz).toBe(1);
    expect(overrides!.get("team-a")!.teamPoints).toBe(MINI_DM_POD_TEAM_PUNKTE[0]);
    expect(overrides!.get("team-b")!.platz).toBe(2);
    expect(overrides!.get("team-b")!.teamPoints).toBe(MINI_DM_POD_TEAM_PUNKTE[1]);
    expect(overrides!.get("team-c")!.platz).toBe(3);
    expect(overrides!.get("team-c")!.teamPoints).toBe(MINI_DM_POD_TEAM_PUNKTE[2]);
    expect(overrides!.get("team-d")!.platz).toBe(4);
    expect(overrides!.get("team-d")!.teamPoints).toBe(MINI_DM_POD_TEAM_PUNKTE[3]);
    // Chris' Sonderregel, woertlich (mini-dm-nachtkonzept-03-10.md:62): "Rundenpunkte 4-3-2-1, Liga 2-1-0-0".
    expect(MINI_DM_POD_TEAM_PUNKTE).toEqual([2, 1, 0, 0]);
  });

  it("Zero-Sum-Verhaeltnis: Summe der vier `verhaeltnis`-Werte ist IMMER exakt 0", () => {
    const zufall = mulberry32(21_091_9);
    for (let i = 0; i < 500; i += 1) {
      const scoreByTeamId = new Map([
        ["team-a", zufall() * 300],
        ["team-b", zufall() * 300],
        ["team-c", zufall() * 300],
        ["team-d", zufall() * 300],
      ]);
      const pod = buildPod(["team-a", "team-b", "team-c", "team-d"]);
      const overrides = berechneMiniDmPodOverride({ pod, scoreByTeamId, disciplineId: "mini-dm", playerCount: 2 });
      const summe = [...overrides!.values()].reduce((sum, override) => sum + override.verhaeltnis, 0);
      expect(summe, `#${i}`).toBe(0);
    }
  });

  it("liefert `null`, wenn fuer ein Team im Pod kein PPS-Score vorliegt -- kein Teil-Ergebnis", () => {
    const scoreByTeamId = new Map([
      ["team-a", 90],
      ["team-b", 50],
      ["team-c", 10],
      // "team-d" fehlt bewusst.
    ]);
    const pod = buildPod(["team-a", "team-b", "team-c", "team-d"]);
    const overrides = berechneMiniDmPodOverride({ pod, scoreByTeamId, disciplineId: "mini-dm", playerCount: 2 });
    expect(overrides).toBeNull();
  });

  it("exakter Score-Gleichstand wird deterministisch per Team-ID geordnet, nicht insertion-order-abhaengig", () => {
    const scoreByTeamId = new Map([
      ["team-x", 50],
      ["team-y", 50],
      ["team-a", 90],
      ["team-z", 10],
    ]);
    const pod = buildPod(["team-x", "team-y", "team-a", "team-z"]);
    const overrides = berechneMiniDmPodOverride({ pod, scoreByTeamId, disciplineId: "mini-dm", playerCount: 2 });
    // "team-x" < "team-y" alphabetisch -> team-x bekommt bei Gleichstand den besseren Platz.
    expect(overrides!.get("team-x")!.platz).toBeLessThan(overrides!.get("team-y")!.platz);
  });
});

describe("berechneMiniDmPodOverrides (alle Pods eines Spieltags)", () => {
  it("ein Pod ohne vollstaendigen Score traegt KEINE Eintraege, andere Pods bleiben unberuehrt", () => {
    const scoreByTeamId = new Map([
      ["a1", 90],
      ["a2", 50],
      ["a3", 10],
      // "a4" fehlt -> Pod A faellt komplett aus.
      ["b1", 80],
      ["b2", 60],
      ["b3", 40],
      ["b4", 20],
    ]);
    const pods = [buildPod(["a1", "a2", "a3", "a4"]), { ...buildPod(["b1", "b2", "b3", "b4"]), id: "pod-b" }];
    const overrides = berechneMiniDmPodOverrides({ pods, scoreByTeamId, disciplineId: "mini-dm", playerCount: 2 });
    expect(overrides.has("a1")).toBe(false);
    expect(overrides.has("b1")).toBe(true);
    expect(overrides.get("b1")!.platz).toBe(1);
    expect(overrides.size).toBe(4);
  });
});

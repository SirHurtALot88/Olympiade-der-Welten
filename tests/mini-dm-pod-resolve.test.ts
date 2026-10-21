import { describe, expect, it } from "vitest";

import {
  berechneErgebnisNormiertNTeam,
  berechneMiniDmFfaPodOverride,
  berechneMiniDmPodOverride,
  berechneMiniDmPodOverrides,
  MINI_DM_FFA_ROLLEN6,
  MINI_DM_FFA_RUNDENPUNKTE,
  MINI_DM_POD_TEAM_PUNKTE,
  ppAusMiniDmFfaBeitrag,
  verteilePlatzierungspunkte,
  type MiniDmFfaPodRohdaten,
  type MiniDmFfaRundeRohdaten,
} from "@/lib/resolve/mini-dm-pod-resolve";
import { berechneErgebnisNormiert, berechneVerhaeltnisBetrag, resolveNiveauReferenz } from "@/lib/resolve/battle-mode-pps-duell";
import { resolveSlotRoleShortId } from "@/lib/lineups/matchday-slot-roles";
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

function buildPod(teamIds: [string, string, string, string]): MiniDmPod {
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
        const meldung = `#${i} n=${n} k=${k} werte=${JSON.stringify(werte)} scores=${JSON.stringify(teams.map((t) => t.score))}`;
        // OPUS-REVIEW PR #1297: SIEGER-GARANTIE wie beim 2-Team-Duell -- verschiedener Score =>
        // STRIKT verschiedener Wert, exakt gleicher Score => gleicher Wert.
        if (teams[k]!.score > teams[k + 1]!.score) {
          expect(werte[k]!, meldung).toBeGreaterThan(werte[k + 1]!);
        } else {
          expect(werte[k]!, meldung).toBe(werte[k + 1]!);
        }
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

describe("berechneErgebnisNormiertNTeam -- Opus-Review PR #1297", () => {
  it("Regression: Platz 1 und 2 mit verschiedenem Score fallen bei gestauchter Spanne NICHT mehr auf denselben Wert", () => {
    // Vorher: Luecken 1/10/10 -> Leiter 21/20/10/0 * 10/21 -> gerundet 10/10/5/0 (Platz 1 = Platz 2,
    // obwohl 2 vs 1 Liga-Punkte).
    const werte = berechneErgebnisNormiertNTeam({
      sortiert: [
        { teamId: "a", score: 100 },
        { teamId: "b", score: 99.5 },
        { teamId: "c", score: 50 },
        { teamId: "d", score: 0 },
      ],
      m90: 10,
      niveauReferenz: null,
    });
    expect(werte[0]!).toBeGreaterThan(werte[1]!);
    expect(werte[1]!).toBeGreaterThan(werte[2]!);
    expect(werte[2]!).toBeGreaterThan(werte[3]!);
    expect(werte[0]! - werte[3]!).toBeLessThanOrEqual(10);
  });

  it("n = 2 ist exakt die 2-Team-Normierung (`berechneErgebnisNormiert`) -- ueber 2000 Zufallsfaelle", () => {
    const zufall = mulberry32(201_020);
    const referenz = resolveNiveauReferenz("pps", "mini-dm", 4);
    for (let i = 0; i < 2000; i += 1) {
      const a = (zufall() - 0.3) * 200;
      const b = zufall() < 0.1 ? a : (zufall() - 0.3) * 200;
      const [hoch, tief] = a >= b ? [a, b] : [b, a];
      const m90 = zufall() < 0.1 ? null : zufall() * 100;
      const nTeam = berechneErgebnisNormiertNTeam({
        sortiert: [
          { teamId: "x", score: hoch },
          { teamId: "y", score: tief },
        ],
        m90,
        niveauReferenz: referenz,
      });
      const outcome = hoch > tief ? "win" : "draw";
      const zweiTeam = berechneErgebnisNormiert({
        outcome,
        betrag: berechneVerhaeltnisBetrag({ outcome, marge: hoch - tief, m90 }),
        niveauEigen: hoch,
        niveauGegner: tief,
        referenz,
      });
      expect(nTeam, `#${i} ${hoch}/${tief} m90=${m90}`).toEqual(zweiTeam);
    }
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

  it("OHNE `ffaRohdatenByPodId` (JEDER heutige Aufrufer, PR 4 hat keinen produktiven FFA-" +
    "Lieferanten) ist das Ergebnis byte-identisch zum Aufruf ohne dieses Feld ueberhaupt", () => {
    const scoreByTeamId = new Map([
      ["a1", 90],
      ["a2", 50],
      ["a3", 10],
      ["a4", 5],
    ]);
    const pods = [buildPod(["a1", "a2", "a3", "a4"])];
    const ohneFeld = berechneMiniDmPodOverrides({ pods, scoreByTeamId, disciplineId: "mini-dm", playerCount: 4 });
    const mitUndefinedFeld = berechneMiniDmPodOverrides({
      pods,
      scoreByTeamId,
      disciplineId: "mini-dm",
      playerCount: 4,
      ffaRohdatenByPodId: null,
    });
    expect([...mitUndefinedFeld.entries()]).toEqual([...ohneFeld.entries()]);
  });

  it("FFA-VORRANG: liegen fuer einen Pod Rohdaten vor, wird DIESER Pod ueber `quelle: \"ffa\"` " +
    "gebucht, ein Pod OHNE Eintrag im `ffaRohdatenByPodId` faellt unveraendert auf PPS zurueck", () => {
    const scoreByTeamId = new Map([
      ["a1", 90],
      ["a2", 50],
      ["a3", 10],
      ["a4", 5],
      ["b1", 80],
      ["b2", 60],
      ["b3", 40],
      ["b4", 20],
    ]);
    const podA = buildPod(["a1", "a2", "a3", "a4"]);
    const podB = { ...buildPod(["b1", "b2", "b3", "b4"]), id: "pod-b" };
    const rohdatenA = buildRohdaten(podA, 3, () => true, (teamIndex, runde) => 10 - teamIndex + runde);
    const overrides = berechneMiniDmPodOverrides({
      pods: [podA, podB],
      scoreByTeamId,
      disciplineId: "mini-dm",
      playerCount: 3,
      ffaRohdatenByPodId: new Map([["pod-test", rohdatenA]]),
    });
    expect(overrides.get("a1")!.quelle).toBe("ffa");
    expect(overrides.get("b1")!.quelle).toBeUndefined();
  });
});

/** Baut vollstaendige FFA-Rohdaten fuer EINEN Pod -- `teilnahme(teamIndex, runde)` und
 *  `beitrag(teamIndex, runde)` je nach Testfall austauschbar (`teamIndex` 0..3, `runde` 0..k-1). */
function buildRohdaten(
  pod: MiniDmPod,
  k: number,
  teilnahme: (teamIndex: number, runde: number) => boolean,
  beitrag: (teamIndex: number, runde: number) => number,
): MiniDmFfaPodRohdaten {
  const runden: MiniDmFfaRundeRohdaten[] = Array.from({ length: k }, (_unused, runde) => ({
    runde: runde + 1,
    rolle: MINI_DM_FFA_ROLLEN6[runde],
    teams: pod.teamIds.map((teamId, teamIndex) => ({
      teamId,
      teilnahme: teilnahme(teamIndex, runde),
      beitrag: beitrag(teamIndex, runde),
    })),
  }));
  return { podId: pod.id, teamIds: pod.teamIds, playerCount: k, runden };
}

describe("verteilePlatzierungspunkte (TS-Port von battle-mode.engine.js)", () => {
  it("vergibt [4,3,2,1] nach absteigendem Wert, Platz 1 = hoechster Wert", () => {
    const { punkte, platz } = verteilePlatzierungspunkte([10, 40, 30, 20], MINI_DM_FFA_RUNDENPUNKTE);
    expect(punkte).toEqual([1, 4, 3, 2]);
    expect(platz).toEqual([4, 1, 2, 3]);
  });

  it("teilt bei Gleichstand gleichmaessig, Platz ist der BESTE der geteilten Plaetze", () => {
    // Zwei gleichauf fuer Platz 1 -> (4+3)/2 = 3,5 je Platz, beide Platz 1 ("gleichauf Erster").
    const { punkte, platz } = verteilePlatzierungspunkte([50, 50, 20, 10], MINI_DM_FFA_RUNDENPUNKTE);
    expect(punkte).toEqual([3.5, 3.5, 2, 1]);
    expect(platz).toEqual([1, 1, 3, 4]);
  });

  it("funktioniert mit einer gekuerzten Punktetabelle (weniger als vier Anwesende)", () => {
    const { punkte, platz } = verteilePlatzierungspunkte([5, 15, 10], MINI_DM_FFA_RUNDENPUNKTE.slice(0, 3));
    expect(punkte).toEqual([2, 4, 3]);
    expect(platz).toEqual([3, 1, 2]);
  });
});

describe("MINI_DM_FFA_ROLLEN6 -- Spiegel-Test gegen DISCIPLINE_ROLE_THEMES[\"mini-dm\"]", () => {
  it("Reihenfolge und Inhalt stimmen exakt mit matchday-slot-roles.ts ueberein", () => {
    const ausMatchdaySlotRoles = Array.from({ length: 6 }, (_unused, slotIndex) =>
      resolveSlotRoleShortId("mini-dm", "Mini-DM", slotIndex),
    );
    expect(ausMatchdaySlotRoles).toEqual(MINI_DM_FFA_ROLLEN6);
  });
});

describe("berechneErgebnisNormiertNTeam -- PR 4 (niveauScore/mindestLuecke, Opus-Plan 21.10.)", () => {
  it("byte-identisch ohne die neuen Parameter -- Regression gegen PR #1297 (Hash-Vergleich ueber " +
    "6000 deterministische Faelle, VOR dieser PR mit derselben Erzeugung aufgenommen)", () => {
    function hashString(s: string): string {
      let h1 = 0xdeadbeef ^ 0;
      let h2 = 0x41c6ce57 ^ 0;
      for (let i = 0; i < s.length; i += 1) {
        const ch = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
    }

    const FELDGROESSEN = [2, 3, 4, 5, 6] as const;
    const zufall = mulberry32(191_019);
    const ausgaben: number[][] = [];
    for (let i = 0; i < 4000; i += 1) {
      const n = 1 + Math.floor(zufall() * 6);
      const teams = Array.from({ length: n }, (_unused, index) => ({ teamId: `team-${index}`, score: 0 }));
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
          : resolveNiveauReferenz(
              "pps",
              FELDGROESSEN[Math.floor(zufall() * FELDGROESSEN.length)]! === 2 ? "tennis" : "mini-dm",
              FELDGROESSEN[Math.floor(zufall() * FELDGROESSEN.length)]!,
            );
      ausgaben.push(berechneErgebnisNormiertNTeam({ sortiert: teams, m90, niveauReferenz }));
    }
    const zweiterZufall = mulberry32(201_020);
    for (let i = 0; i < 2000; i += 1) {
      const a = (zweiterZufall() - 0.3) * 200;
      const b = zweiterZufall() < 0.1 ? a : (zweiterZufall() - 0.3) * 200;
      const [hoch, tief] = a >= b ? [a, b] : [b, a];
      const m90 = zweiterZufall() < 0.1 ? null : zweiterZufall() * 100;
      const referenz = resolveNiveauReferenz("pps", "mini-dm", 4);
      ausgaben.push(
        berechneErgebnisNormiertNTeam({
          sortiert: [
            { teamId: "x", score: hoch },
            { teamId: "y", score: tief },
          ],
          m90,
          niveauReferenz: referenz,
        }),
      );
    }

    expect(ausgaben.length).toBe(6000);
    expect(hashString(JSON.stringify(ausgaben))).toBe("28wa1bm2uvf");
  });

  it("mindestLuecke erzwingt wert(i) > wert(i+1), auch bei EXAKT gleichem Score", () => {
    const werte = berechneErgebnisNormiertNTeam({
      sortiert: [
        { teamId: "a", score: 50, mindestLuecke: 1 },
        { teamId: "b", score: 50 },
      ],
      m90: 50,
      niveauReferenz: null,
    });
    expect(werte[0]!).toBeGreaterThan(werte[1]!);
  });

  it("mindestLuecke senkt NIEMALS eine bereits groessere Luecke (reiner Floor, kein Deckel)", () => {
    const ohneMindestLuecke = berechneErgebnisNormiertNTeam({
      sortiert: [
        { teamId: "a", score: 100 },
        { teamId: "b", score: 0 },
      ],
      m90: 10,
      niveauReferenz: null,
    });
    const mitMindestLuecke = berechneErgebnisNormiertNTeam({
      sortiert: [
        { teamId: "a", score: 100, mindestLuecke: 1 },
        { teamId: "b", score: 0 },
      ],
      m90: 10,
      niveauReferenz: null,
    });
    expect(mitMindestLuecke).toEqual(ohneMindestLuecke);
  });

  it("niveauScore (statt score) bestimmt die Mitte -- messbar unterschiedliches Ergebnis bei " +
    "gleichem score aber verschiedenem niveauScore", () => {
    const referenz = { p: [0, 0.5, 1] as const, w: [0, 50, 100] as const };
    const mitNiveauScore = berechneErgebnisNormiertNTeam({
      sortiert: [
        { teamId: "a", score: 10, niveauScore: 0 },
        { teamId: "b", score: 10, niveauScore: 100 },
      ],
      m90: 50,
      niveauReferenz: referenz,
    });
    const ohneNiveauScore = berechneErgebnisNormiertNTeam({
      sortiert: [
        { teamId: "a", score: 10 },
        { teamId: "b", score: 10 },
      ],
      m90: 50,
      niveauReferenz: referenz,
    });
    // Score ist in beiden Faellen gleich (Luecke 0) -- OHNE niveauScore bestimmt `score` (10) die
    // Mitte (niedrig, nah an w[0]), MIT niveauScore bestimmt der Mittelwert von 0 und 100 (0,5) sie.
    expect(mitNiveauScore).not.toEqual(ohneNiveauScore);
    expect(mitNiveauScore[0]!).toBeGreaterThan(ohneNiveauScore[0]!);
  });
});

describe("berechneMiniDmFfaPodOverride -- Property-Test der Ordnungsgarantie (Plan: R, dann B, " +
  "dann PPS-Teamscore, dann teamId; mindestLuecke bei verschiedenen Liga-Punkten)", () => {
  it("1500 zufaellige Pods, k=2..6, mit und ohne abwesende Teams -- Platzierung UND 0-10-Werte " +
    "respektieren die lexikografische Ordnung IMMER, strikt bei unterschiedlichen Liga-Punkten", () => {
    const zufall = mulberry32(2110_04);
    let geprueft = 0;
    for (let fall = 0; fall < 1500; fall += 1) {
      const k = 2 + Math.floor(zufall() * 5); // 2..6
      const pod = buildPod(["t-a", "t-b", "t-c", "t-d"]);
      const ppsScoreByTeamId = new Map(pod.teamIds.map((teamId) => [teamId, (zufall() - 0.5) * 200] as const));

      // Zufaellige Teilnahme/Beitrag je (Team, Runde) -- ~20% Abwesenheit, inklusive dem
      // Sonderfall "ein Team ist IN KEINER Runde dabei" (~10% der Faelle, erzwungen). Runde 0 ist
      // fuer jedes NICHT betroffene Team IMMER `teilnahme: true`, damit es garantiert R > 0 hat --
      // sonst koennten durch puren Zufall ZWEI Teams gleichzeitig auf R = 0 landen, und nur das
      // schlechtere der beiden (nach B/PPS-Score/teamId) waere wirklich Platz 4 -- ein eigener,
      // unten separat erwaehnenswerter Randfall, den dieser Test (ein einziges erzwungenes Team)
      // bewusst nicht gegen Platz 4 prueft.
      const teamOhneAufstellungIndex = zufall() < 0.1 ? Math.floor(zufall() * 4) : -1;
      const teilnahmeMatrix = Array.from({ length: 4 }, (_unused, teamIndex) =>
        Array.from({ length: k }, (_unused2, runde) =>
          teamIndex === teamOhneAufstellungIndex ? false : runde === 0 ? true : zufall() > 0.2,
        ),
      );
      const beitragMatrix = Array.from({ length: 4 }, () => Array.from({ length: k }, () => zufall() * 100));

      const rohdaten = buildRohdaten(
        pod,
        k,
        (teamIndex, runde) => teilnahmeMatrix[teamIndex]![runde]!,
        (teamIndex, runde) => beitragMatrix[teamIndex]![runde]!,
      );
      const overrides = berechneMiniDmFfaPodOverride({ pod, rohdaten, ppsScoreByTeamId, disciplineId: "mini-dm", playerCount: k });
      expect(overrides, `#${fall}`).not.toBeNull();
      geprueft += 1;

      // UNABHAENGIGE Referenzrechnung von R_t/B_t direkt aus den Rohdaten (nicht die Funktion
      // selbst), um Platzierung/teamPoints gegenzuprüfen.
      const rByTeam = new Map<string, number>();
      const bByTeam = new Map<string, number>();
      for (const teamId of pod.teamIds) {
        rByTeam.set(teamId, 0);
        bByTeam.set(teamId, 0);
      }
      for (let runde = 0; runde < k; runde += 1) {
        const anwesendeIndizes = [0, 1, 2, 3].filter((teamIndex) => teilnahmeMatrix[teamIndex]![runde]);
        const werteRunde = anwesendeIndizes.map((teamIndex) => beitragMatrix[teamIndex]![runde]!);
        const { punkte } = verteilePlatzierungspunkte(werteRunde, MINI_DM_FFA_RUNDENPUNKTE.slice(0, anwesendeIndizes.length));
        anwesendeIndizes.forEach((teamIndex, i) => {
          const teamId = pod.teamIds[teamIndex]!;
          rByTeam.set(teamId, rByTeam.get(teamId)! + punkte[i]!);
          bByTeam.set(teamId, bByTeam.get(teamId)! + beitragMatrix[teamIndex]![runde]!);
        });
      }
      const erwartetePlatzierung = [...pod.teamIds].sort((a, b) => {
        if (rByTeam.get(b)! !== rByTeam.get(a)!) return rByTeam.get(b)! - rByTeam.get(a)!;
        if (bByTeam.get(b)! !== bByTeam.get(a)!) return bByTeam.get(b)! - bByTeam.get(a)!;
        if (ppsScoreByTeamId.get(b)! !== ppsScoreByTeamId.get(a)!) return ppsScoreByTeamId.get(b)! - ppsScoreByTeamId.get(a)!;
        return a.localeCompare(b);
      });

      const meldung = `#${fall} k=${k} R=${JSON.stringify([...rByTeam])} B=${JSON.stringify([...bByTeam])}`;
      for (let platzIndex = 0; platzIndex < 4; platzIndex += 1) {
        const teamId = erwartetePlatzierung[platzIndex]!;
        const override = overrides!.get(teamId)!;
        expect(override.platz, `${meldung} teamId=${teamId}`).toBe(platzIndex + 1);
        expect(override.teamPoints, meldung).toBe(MINI_DM_POD_TEAM_PUNKTE[platzIndex]);
        expect(override.rundenPunkteSumme).toBeCloseTo(rByTeam.get(teamId)!, 9);
        expect(override.quelle).toBe("ffa");
      }

      // 0-10-Ordnungsgarantie, Bounds, ganzzahlig -- UND strikt verschieden bei verschiedenen
      // Liga-Punkten (mindestLuecke), unabhaengig davon, wie nah R/B beieinander lagen.
      const werteByPlatz = [1, 2, 3, 4].map(
        (platz) => [...overrides!.values()].find((o) => o.platz === platz)!.wert,
      );
      for (const wert of werteByPlatz) {
        expect(wert, meldung).toBeGreaterThanOrEqual(0);
        expect(wert, meldung).toBeLessThanOrEqual(10);
        expect(Number.isInteger(wert), meldung).toBe(true);
      }
      for (let i = 0; i < 3; i += 1) {
        expect(werteByPlatz[i]!, meldung).toBeGreaterThanOrEqual(werteByPlatz[i + 1]!);
        if (MINI_DM_POD_TEAM_PUNKTE[i] !== MINI_DM_POD_TEAM_PUNKTE[i + 1]) {
          expect(werteByPlatz[i]!, meldung).toBeGreaterThan(werteByPlatz[i + 1]!);
        }
      }

      // Zero-Sum-Verhaeltnis gilt unveraendert auch fuer den FFA-Pfad.
      const verhaeltnisSumme = [...overrides!.values()].reduce((summe, o) => summe + o.verhaeltnis, 0);
      expect(verhaeltnisSumme, meldung).toBe(0);

      // "Team ohne Aufstellung" -- erzwungener Sonderfall diesen Laufs: Platz 4, 0 Punkte, Warnung.
      if (teamOhneAufstellungIndex >= 0) {
        const teamId = pod.teamIds[teamOhneAufstellungIndex]!;
        const override = overrides!.get(teamId)!;
        expect(override.platz, meldung).toBe(4);
        expect(override.teamPoints, meldung).toBe(0);
        expect(override.warnings, meldung).toContain("mini_dm_ffa_team_ohne_aufstellung");
        expect(override.rundenPunkteSumme, meldung).toBe(0);
      }
    }
    expect(geprueft).toBe(1500);
  });

  it("mehr Teilnahme hilft IMMER: ein Team, das zusaetzlich an einer Runde teilnimmt, hat NIE eine " +
    "niedrigere Rundenpunkte-Summe als wenn es dort gefehlt haette (alles andere gleich)", () => {
    const zufall = mulberry32(55_019);
    for (let fall = 0; fall < 300; fall += 1) {
      const k = 2 + Math.floor(zufall() * 5);
      const pod = buildPod(["t-a", "t-b", "t-c", "t-d"]);
      const ppsScoreByTeamId = new Map(pod.teamIds.map((teamId) => [teamId, zufall() * 100] as const));
      const teilnahmeAndererTeams = Array.from({ length: 3 }, () =>
        Array.from({ length: k }, () => zufall() > 0.3),
      );
      const beitragMatrix = Array.from({ length: 4 }, () => Array.from({ length: k }, () => zufall() * 100));
      const teilnahmeA = Array.from({ length: k }, () => zufall() > 0.3);
      const abwesendeRunde = Math.floor(zufall() * k);

      function teilnahme(teamIndex: number, runde: number, aNimmtAbwesendeRundeTeil: boolean): boolean {
        if (teamIndex === 0) {
          return runde === abwesendeRunde ? aNimmtAbwesendeRundeTeil : teilnahmeA[runde]!;
        }
        return teilnahmeAndererTeams[teamIndex - 1]![runde]!;
      }

      const rohdatenOhne = buildRohdaten(pod, k, (ti, r) => teilnahme(ti, r, false), (ti, r) => beitragMatrix[ti]![r]!);
      const rohdatenMit = buildRohdaten(pod, k, (ti, r) => teilnahme(ti, r, true), (ti, r) => beitragMatrix[ti]![r]!);

      const ohne = berechneMiniDmFfaPodOverride({ pod, rohdaten: rohdatenOhne, ppsScoreByTeamId, disciplineId: "mini-dm", playerCount: k });
      const mit = berechneMiniDmFfaPodOverride({ pod, rohdaten: rohdatenMit, ppsScoreByTeamId, disciplineId: "mini-dm", playerCount: k });
      expect(mit!.get("t-a")!.rundenPunkteSumme ?? 0, `#${fall}`).toBeGreaterThanOrEqual(ohne!.get("t-a")!.rundenPunkteSumme ?? 0);
    }
  });

  it("liefert `null` bei strukturell kaputten Rohdaten (falsche Rundenzahl) -- Aufrufer faellt auf PPS zurueck", () => {
    const pod = buildPod(["t-a", "t-b", "t-c", "t-d"]);
    const rohdaten = buildRohdaten(pod, 3, () => true, () => 10);
    const kaputt: MiniDmFfaPodRohdaten = { ...rohdaten, playerCount: 4 }; // 4 angegeben, nur 3 Runden
    const ppsScoreByTeamId = new Map(pod.teamIds.map((teamId) => [teamId, 1] as const));
    expect(berechneMiniDmFfaPodOverride({ pod, rohdaten: kaputt, ppsScoreByTeamId, disciplineId: "mini-dm", playerCount: 4 })).toBeNull();
  });

  it("liefert `null`, wenn eine Runde nicht genau die vier Pod-Team-IDs traegt", () => {
    const pod = buildPod(["t-a", "t-b", "t-c", "t-d"]);
    const rohdaten = buildRohdaten(pod, 2, () => true, () => 10);
    const kaputt: MiniDmFfaPodRohdaten = {
      ...rohdaten,
      runden: [rohdaten.runden[0]!, { ...rohdaten.runden[1]!, teams: rohdaten.runden[1]!.teams.slice(0, 3) }],
    };
    const ppsScoreByTeamId = new Map(pod.teamIds.map((teamId) => [teamId, 1] as const));
    expect(berechneMiniDmFfaPodOverride({ pod, rohdaten: kaputt, ppsScoreByTeamId, disciplineId: "mini-dm", playerCount: 2 })).toBeNull();
  });

  it("liefert `null`, wenn fuer ein Pod-Team kein PPS-Score vorliegt (Tiebreak/Niveau brauchen ihn)", () => {
    const pod = buildPod(["t-a", "t-b", "t-c", "t-d"]);
    const rohdaten = buildRohdaten(pod, 2, () => true, () => 10);
    const ppsScoreByTeamId = new Map([
      ["t-a", 1],
      ["t-b", 1],
      ["t-c", 1],
      // "t-d" fehlt bewusst.
    ]);
    expect(berechneMiniDmFfaPodOverride({ pod, rohdaten, ppsScoreByTeamId, disciplineId: "mini-dm", playerCount: 2 })).toBeNull();
  });
});

describe("ppAusMiniDmFfaBeitrag (Spieler-PP-Formel, Plan Abschnitt 3)", () => {
  it("liefert 0 ohne gezogene Referenz (PR 4: data/generated/mini-dm-ffa-referenz.json ist noch " +
    "ein Platzhalter) -- nie NaN, nie ein Fehler", () => {
    expect(ppAusMiniDmFfaBeitrag(42, null)).toBe(0);
    expect(ppAusMiniDmFfaBeitrag(null, null)).toBe(0);
    expect(ppAusMiniDmFfaBeitrag(undefined, null)).toBe(0);
  });

  it("nutzt dieselbe Impact-Kurve wie `ppAusSpielerScore()` (Arena/PPS-Duell) -- identisches " +
    "Ergebnis bei identischer Referenz, kein eigenes Kurvenverhalten", () => {
    const referenz = { p50: 20, p995: 80 };
    // p50 selbst liegt per Konstruktion der Kurve bei ANTEIL_MITTE * MAX (0,25 * 5,5 = 1,375).
    expect(ppAusMiniDmFfaBeitrag(20, referenz)).toBeCloseTo(1.375, 2);
    expect(ppAusMiniDmFfaBeitrag(80, referenz)).toBeCloseTo(5.5, 2);
    expect(ppAusMiniDmFfaBeitrag(0, referenz)).toBe(0);
  });
});

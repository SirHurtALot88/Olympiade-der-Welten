import { describe, expect, it } from "vitest";

import type { ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import { computeIndividualBoxscorePpsFromFixtureResults, resolveArenaPpsReferenz } from "@/lib/resolve/battle-mode-arena-team-points";
import { wendeErgebnisSkalaE1An } from "@/lib/resolve/ergebnis-skala-anwenden";
import { ppVorTagesanker, verteilePpNachTagesanker } from "@/lib/resolve/pp-tagesanker";
import type { DisciplineTeamResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

// PP-TAGESANKER und E1 (Review PR #1690, Variante a): die Ergebnisskala E1 rechnet auf den C2-PP VOR dem
// Tagesanker (so sind die Anker gezogen). Die gebuchten Spieler-PP bleiben die Tagesanker-PP. Geprueft je
// Rechenstelle (Duell, Zeitfahren, Breaking-Gauntlet, Bahn-Pod, Battlefield-Pod, Mini-DM-Pod): gleicher
// Spieltag mit und ohne Tagesanker -> ergebnisNormiert, Pod-Wert, verhaeltnis, teamPoints identisch.

type Zeile = DisciplineTeamResolvePreview;
const zeile = (z: Record<string, unknown>) => z as unknown as Zeile;

/** Spieler-PP, die der Tagesfaktor verschiebt: ohne Anker `u`, mit Anker `faktor * u` (gleiche Reihenfolge). */
function spieler(teams: string[], pp: number[], faktor: number) {
  const vor = new Map<string, number>();
  const zeilen: { teamId: string; playerId: string; disciplineSide: string; pointsAwarded: number }[] = [];
  teams.forEach((teamId, t) => {
    for (let i = 0; i < 3; i += 1) {
      const playerId = `${teamId}-p${i}`;
      const u = pp[(t * 3 + i) % pp.length];
      vor.set(playerId, u);
      zeilen.push({ teamId, playerId, disciplineSide: "A", pointsAwarded: Math.round(u * faktor * 100) / 100 });
    }
  });
  return { vor, zeilen };
}

function duell(): Zeile[] {
  return [
    zeile({ teamId: "t1", opponentTeamId: "t2", disciplineSide: "A", verhaeltnis: 1.4, marge: 14, duellSeiten: [58, 44], teamPoints: 2, ergebnisNormiert: 0 }),
    zeile({ teamId: "t2", opponentTeamId: "t1", disciplineSide: "A", verhaeltnis: -1.4, marge: 14, duellSeiten: [44, 58], teamPoints: 0, ergebnisNormiert: 0 }),
  ];
}
function pod(): Zeile[] {
  return ["t1", "t2", "t3", "t4"].map((teamId, i) =>
    zeile({ teamId, disciplineSide: "A", verhaeltnis: 0, marge: i === 0 ? 0 : 3 + i, teamPoints: 3 - i, miniDmPod: { podId: "pod-1", platz: i + 1, wert: 0 } }),
  );
}
const klon = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const sicht = (zeilen: Zeile[]) =>
  zeilen.map((z) => ({ t: z.teamId, v: z.verhaeltnis, e: z.ergebnisNormiert, w: z.miniDmPod?.wert, tp: z.teamPoints, m: z.margeM90 }));

const FAKTOR = 1.37;
const PP = [4.2, 3.6, 2.9, 3.1, 2.2, 1.8, 3.9, 2.6, 1.1, 0.9, 1.5, 2.0];

const faelle: { name: string; disziplin: string; teams: string[]; zeilen: () => Zeile[]; playerCount: number; variante?: "gauntletAlt" | "standard"; leistung?: boolean }[] = [
  { name: "Duell (Basketball)", disziplin: "basketball", teams: ["t1", "t2"], zeilen: duell, playerCount: 3 },
  { name: "Zeitfahren (margeQuelle leistung)", disziplin: "time-trial", teams: ["t1", "t2"], zeilen: duell, playerCount: 3, leistung: true },
  { name: "Breaking Gauntlet (leistung)", disziplin: "breaking", teams: ["t1", "t2"], zeilen: duell, playerCount: 2, variante: "gauntletAlt", leistung: true },
  { name: "Bahn-Pod (Staffel)", disziplin: "staffel", teams: ["t1", "t2", "t3", "t4"], zeilen: pod, playerCount: 4 },
  { name: "Battlefield-Pod", disziplin: "battlefield", teams: ["t1", "t2", "t3", "t4"], zeilen: pod, playerCount: 4 },
  { name: "Mini-DM-Pod", disziplin: "mini-dm", teams: ["t1", "t2", "t3", "t4"], zeilen: pod, playerCount: 4 },
];

describe("E1 liest die C2-PP vor dem Tagesanker", () => {
  for (const f of faelle) {
    it(`${f.name}: mit und ohne Tagesanker identisch (ergebnisNormiert, Pod-Wert, verhaeltnis, teamPoints)`, () => {
      const ohne = spieler(f.teams, PP, 1);
      const mit = spieler(f.teams, PP, FAKTOR);
      expect(mit.zeilen[0].pointsAwarded).not.toBe(ohne.zeilen[0].pointsAwarded);

      const a = f.zeilen();
      wendeErgebnisSkalaE1An({ teamResults: a, spielerZeilen: ohne.zeilen, disciplineId: f.disziplin, playerCount: f.playerCount, podVariante: f.variante });
      const b = f.zeilen();
      wendeErgebnisSkalaE1An({ teamResults: b, spielerZeilen: mit.zeilen, disciplineId: f.disziplin, playerCount: f.playerCount, podVariante: f.variante, ppVorAnkerByPlayerId: mit.vor });

      expect(sicht(b)).toEqual(sicht(a));
      // Gegenprobe: ohne die Map (alter Stand) verschiebt der Tagesfaktor, wo D aus den PP kommt.
      if (f.leistung) {
        const c = f.zeilen();
        wendeErgebnisSkalaE1An({ teamResults: c, spielerZeilen: klon(mit.zeilen), disciplineId: f.disziplin, playerCount: f.playerCount, podVariante: f.variante });
        expect(sicht(c)).not.toEqual(sicht(a));
      }
    });
  }

  it("ohne Eintrag in der Map (pps_duell-Rueckfall) bleibt es bei pointsAwarded", () => {
    const s = spieler(["t1", "t2"], PP, 1);
    const a = duell();
    wendeErgebnisSkalaE1An({ teamResults: a, spielerZeilen: s.zeilen, disciplineId: "basketball", playerCount: 3 });
    const b = duell();
    wendeErgebnisSkalaE1An({ teamResults: b, spielerZeilen: s.zeilen, disciplineId: "basketball", playerCount: 3, ppVorAnkerByPlayerId: new Map() });
    expect(sicht(b)).toEqual(sicht(a));
  });
});

describe("PP vor dem Anker an der Rechenstelle der Arena-Boxscore-PP", () => {
  const disziplin = "eiskunstlauf";
  const { referenz } = resolveArenaPpsReferenz(disziplin, 6, "feld");
  const werte = [0.3, 0.6, 0.9, 1.1, 1.3, 1.6, 1.9, 2.4, 2.9, 3.3, 3.8, 4.4].map((x) => x * referenz.iKrass);
  const fixtures: ArenaFixtureResult[] = [0, 1].map((n) => ({
    homeTeamId: `heim-${n}`,
    awayTeamId: `gast-${n}`,
    seiten: [0, 0],
    boxscore: werte.slice(n * 6, n * 6 + 6).map((wert, i) => ({ name: `s-${n}-${i}`, wert, playerId: `p-${n}-${i}`, side: i < 3 ? ("home" as const) : ("away" as const) })),
  }));

  it("entspricht genau der C2-PP ohne Tagesanker (gedeckelt, gerundet), die gebuchten PP bleiben die Anker-PP", () => {
    const ohne = computeIndividualBoxscorePpsFromFixtureResults(fixtures, 6, disziplin, "an", "neu", false);
    const halter: { ppVorAnker?: Map<string, number> } = {};
    const mit = computeIndividualBoxscorePpsFromFixtureResults(fixtures, 6, disziplin, "an", "neu", true, halter);
    expect(halter.ppVorAnker).toBeDefined();
    for (const [id, pp] of ohne) expect(halter.ppVorAnker!.get(id)).toBe(pp);
    expect(Math.max(...mit.values())).toBeLessThan(5);
    expect([...mit.values()]).not.toEqual([...ohne.values()]);
    const leer: { ppVorAnker?: Map<string, number> } = {};
    computeIndividualBoxscorePpsFromFixtureResults(fixtures, 6, disziplin, "an", "neu", false, leer);
    expect(leer.ppVorAnker).toBeUndefined();
  });

  it("ppVorTagesanker deckelt bei 5 und rundet auf zwei Stellen", () => {
    const roh = new Map([["a", 7.123], ["b", 3.14159], ["c", 0]]);
    expect([...ppVorTagesanker(roh)]).toEqual([["a", 5], ["b", 3.14], ["c", 0]]);
    expect(Math.max(...verteilePpNachTagesanker(roh).values())).toBeLessThan(5);
  });
});

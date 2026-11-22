/**
 * KI-NEBEL (Chris, 21.11., Option A): die KI bewertet Kandidaten nach ihrem Wissensstand. Geprueft: Schalter aus = wahre Werte,
 * deterministisch, nie genauer als der Bereich, den der Mensch auf dieser Stufe sieht (10er unbekannt, 5er beobachtet), eigene
 * und gescoutete Spieler exakt, Potenzial in der Spanne des Menschen, und die Spielersicht ruehrt nur Disziplinwerte und
 * Potenzial an.
 */
import { afterEach, describe, expect, it } from "vitest";

import { baueKiSichtKontext, kiNebelBreite, kiSichtAufSpieler, kiWissensStufe } from "@/lib/ai/ki-nebel";
import { toOrganicPlayerView } from "@/lib/ai/organic-squad/draft-adapter";
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { getScoutingUncertainty } from "@/lib/progression/player-potential-service";

function spieler(id: string, wert: number): Player {
  const rating: Record<string, number> = {};
  for (let i = 0; i < 20; i += 1) rating[`d-${i}`] = Math.max(1, Math.min(99, wert + ((i * 7) % 23) - 11));
  return {
    id,
    name: id,
    marketValue: 10,
    salaryDemand: 2,
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    disciplineRatings: rating,
  } as unknown as Player;
}

function zustand(opts?: { eigene?: string[]; intel?: Record<string, number>; nebelAus?: boolean }): GameState {
  return {
    season: { id: "S1" },
    rosters: (opts?.eigene ?? []).map((playerId) => ({ teamId: "T-1", playerId })),
    players: [],
    playerPotential: [],
    scenarioMeta: opts?.nebelAus ? { scoutingNebelAus: true } : undefined,
    seasonState: {
      scoutIntelByTeamId: {
        "T-1": Object.entries(opts?.intel ?? {}).map(([playerId, certainty]) => ({ seasonId: "S1", playerId, certainty })),
      },
    },
  } as unknown as GameState;
}

const spielerListe = Array.from({ length: 120 }, (_, i) => spieler(`p${i}`, 30 + (i % 60)));
const umgebung = { ...process.env };
afterEach(() => {
  process.env = { ...umgebung };
});

function mittlereAbweichung(sicht: Record<string, number>, wahr: Record<string, number>): number {
  const ids = Object.keys(wahr);
  return ids.reduce((summe, id) => summe + Math.abs(sicht[id]! - wahr[id]!), 0) / ids.length;
}

describe("KI-Nebel", () => {
  it("ist deterministisch und liegt im Bereich, den der Mensch auf der Stufe sieht", () => {
    const kontext = baueKiSichtKontext(zustand(), "T-1")!;
    expect(kontext).not.toBeNull();
    let verschieden = 0;
    for (const p of spielerListe) {
      const a = kiSichtAufSpieler(kontext, p, 70);
      expect(kiSichtAufSpieler(kontext, p, 70)).toEqual(a);
      expect(a.stufe).toBe(0);
      const breite = kiNebelBreite(a.stufe);
      for (const [id, wahr] of Object.entries(p.disciplineRatings)) {
        const von = Math.floor(wahr / breite) * breite;
        expect(a.disciplineRatings[id]).toBeGreaterThanOrEqual(von);
        expect(a.disciplineRatings[id]).toBeLessThanOrEqual(von + breite - 1);
        if (a.disciplineRatings[id] !== wahr) verschieden += 1;
      }
      expect(Math.abs((a.potential ?? 0) - 70)).toBeLessThanOrEqual(getScoutingUncertainty(a.stufe));
    }
    expect(verschieden).toBeGreaterThan(spielerListe.length * 5);
  });

  it("zeigt in der naechsten Saison eine andere Sicht", () => {
    const k1 = baueKiSichtKontext(zustand(), "T-1")!;
    const k2 = { ...k1, saisonId: "S2" };
    const p = spielerListe[10]!;
    expect(kiSichtAufSpieler(k2, p, null).disciplineRatings).not.toEqual(kiSichtAufSpieler(k1, p, null).disciplineRatings);
  });

  it("kennt eigene Spieler exakt, beobachtete im 5er-Bereich und weiss mit Scouting mehr", () => {
    const kontext = baueKiSichtKontext(zustand({ eigene: ["p1"], intel: { p2: 100, p3: 30 } }), "T-1")!;
    expect(kiWissensStufe(kontext, "p1")).toBe(5);
    const eigener = kiSichtAufSpieler(kontext, spielerListe[1]!, 66);
    expect(eigener.disciplineRatings).toBe(spielerListe[1]!.disciplineRatings);
    expect(eigener.potential).toBe(66);
    // Sicherheit 100 bei Buero 0 = Stufe 4, 30 = Stufe 1 (dieselbe Rechnung wie getEffectiveScoutingLevel des Menschen).
    expect(kiWissensStufe(kontext, "p2")).toBe(4);
    expect(kiWissensStufe(kontext, "p3")).toBe(1);
    const sicht = kiSichtAufSpieler(kontext, spielerListe[2]!, 66);
    for (const [id, wahr] of Object.entries(spielerListe[2]!.disciplineRatings)) {
      expect(Math.abs(sicht.disciplineRatings[id]! - wahr)).toBeLessThanOrEqual(4);
    }
    let unbekannt = 0;
    let beobachtet = 0;
    for (let i = 4; i < 120; i += 1) {
      const p = spielerListe[i]!;
      unbekannt += mittlereAbweichung(kiSichtAufSpieler(kontext, p, null).disciplineRatings, p.disciplineRatings);
      const mitIntel = { ...kontext, sicherheitJeSpieler: new Map([[p.id, 60]]) };
      beobachtet += mittlereAbweichung(kiSichtAufSpieler(mitIntel, p, null).disciplineRatings, p.disciplineRatings);
    }
    expect(beobachtet).toBeLessThan(unbekannt);
  });

  it("Nebel aus per Spielstand-Einstellung oder Schalter: keine Sicht, wahre Werte", () => {
    expect(baueKiSichtKontext(zustand({ nebelAus: true }), "T-1")).toBeNull();
    process.env.OLY_KI_NEBEL = "0";
    expect(baueKiSichtKontext(zustand(), "T-1")).toBeNull();
    process.env.OLY_KI_NEBEL = "1";
    process.env.OLY_KI_NEBEL_STAERKE = "0";
    expect(baueKiSichtKontext(zustand(), "T-1")).toBeNull();
  });

  it("ohne Sicht bit-identisch wie bisher; mit Sicht aendern sich nur Disziplinwerte und Potenzial", () => {
    const p = spielerListe[7]!;
    const gs = zustand();
    const ohne = toOrganicPlayerView(p, undefined, undefined, undefined, gs);
    expect(toOrganicPlayerView(p, undefined, undefined, undefined, gs, null)).toEqual(ohne);
    expect(ohne.disciplineRatings).toBe(p.disciplineRatings);
    const mit = toOrganicPlayerView(p, undefined, undefined, undefined, gs, baueKiSichtKontext(gs, "T-1"));
    expect({ ...mit, disciplineRatings: null, potential: null }).toEqual({ ...ohne, disciplineRatings: null, potential: null });
    expect(mit.disciplineRatings).not.toEqual(ohne.disciplineRatings);
  });

  it("die Staerke vergroessert die Abweichung", () => {
    const abweichung = (staerke: string) => {
      process.env.OLY_KI_NEBEL_STAERKE = staerke;
      const kontext = baueKiSichtKontext(zustand(), "T-1")!;
      return spielerListe.reduce((s, p) => s + mittlereAbweichung(kiSichtAufSpieler(kontext, p, null).disciplineRatings, p.disciplineRatings), 0);
    };
    expect(abweichung("0.25")).toBeLessThan(abweichung("1"));
  });
});

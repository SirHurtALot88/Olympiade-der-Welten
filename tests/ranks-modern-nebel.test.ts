/**
 * RANKS MODERN (22.11.) — Nebel-Wächter und Rangregeln.
 *
 * Chris, 18.11.: „Sortieren und Filtern dürfen keine verdeckten Werte verraten.“ Der Wächter fährt das Modell zweimal,
 * einmal mit anderen ROHWERTEN innerhalb derselben sichtbaren Stufe, und verlangt, dass alles, was die Seite zeigt,
 * sortiert oder rankt, byte-gleich bleibt. Dazu: Rang 1 = bester, gleiche Werte teilen den Rang, „Fog of War aus“
 * macht alles exakt, die Stärke je Team kommt aus der kanonischen Rangfunktion (Mittel der besten sechs).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildTeamDisciplineRankRowsFromGameState } from "@/lib/foundation/team-discipline-rank-engine";
import {
  baueRanksModell,
  baueSpielerListe,
  baueSpielerProfil,
  sichtWert,
  stufenText,
  teamRangTabelle,
  teamWertText,
  vergibRaenge,
  type RanksModell,
  type RanksSpieler,
  type RanksTeam,
} from "@/lib/foundation/ranks-modern";

function spieler(id: string, name: string, teamId: string, breite: 1 | 5 | 10, ges: number, eig: number): RanksSpieler {
  return {
    id,
    name,
    teamId,
    klasse: "Bard",
    klasseAchse: "soc",
    rasse: "Human",
    portraitSrc: null,
    initials: name.slice(0, 2),
    verletzt: false,
    pp: 3.2,
    ppJe: {},
    breite,
    roh: { ges, achsen: breite === 1 ? { pow: ges - 3, spe: ges, men: ges + 3, soc: ges + 6 } : { pow: ges, spe: ges, men: ges, soc: ges }, eignung: { hockey: eig, tdm: eig - 10 } },
  };
}
function team(id: string, liga: 1 | 2, st: number): RanksTeam {
  return { teamId: id, name: `Team ${id}`, kuerzel: id, logoSrc: null, initials: id, liga, mensch: id === "A-A", kaderGroesse: 8, staerke: { ges: st, hockey: st }, punkte: { ges: null, hockey: null } };
}
function modell(hidden: number): RanksModell {
  return {
    seasonLabel: "season-1",
    gebuchteSpieltage: 3,
    nebel: true,
    ownTeamId: "A-A",
    hatDuell: false,
    disziplinen: [
      { id: "hockey", name: "Hockey", achse: "pow", spielerJeTeam: 5 },
      { id: "tdm", name: "TDM", achse: "pow", spielerJeTeam: 3 },
    ],
    gespielt: {},
    teams: [team("A-A", 1, 50), team("B-B", 1, 47.3 + hidden / 100), team("C-C", 2, 44)],
    spieler: [
      spieler("p1", "Zora", "A-A", 1, 61.7, 66.4),
      // Fremde, unbekannt (10er): alle drei in derselben Stufe 70..80, die Rohwerte unterscheiden sich um `hidden`.
      spieler("p2", "Maru", "B-B", 10, 72 + hidden, 78 - hidden),
      spieler("p3", "Alma", "B-B", 10, 74, 71 + hidden),
      spieler("p4", "Bero", "B-B", 10, 78 - hidden, 75),
      // Beobachtet (5er).
      spieler("p5", "Cyra", "C-C", 5, 62 + hidden / 2, 67 + hidden / 3),
    ],
  };
}
const opt = { disziplin: "hockey", liga: "alle" as const, nurKader: false, klasseAchse: null, sort: { k: "eig" as const, d: -1 as const } };

describe("Nebel: verdeckte Werte gehen nie in Anzeige, Sortierung oder Rang", () => {
  it("Rohwerte innerhalb derselben Stufe ändern die Liste nicht (Sortierung, Rang, Text)", () => {
    const a = baueSpielerListe(modell(0), opt);
    const b = baueSpielerListe(modell(4), opt);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("dasselbe für jede Sortierspalte und das Profil", () => {
    for (const k of ["name", "kl", "ra", "team", "ges", "pow", "spe", "men", "soc", "eig", "pp"] as const) {
      for (const d of [1, -1] as const) {
        const a = baueSpielerListe(modell(0), { ...opt, sort: { k, d } });
        const b = baueSpielerListe(modell(4), { ...opt, sort: { k, d } });
        expect(JSON.stringify(b), `${k}/${d}`).toBe(JSON.stringify(a));
      }
    }
    expect(JSON.stringify(baueSpielerProfil(modell(4), "p2"))).toBe(JSON.stringify(baueSpielerProfil(modell(0), "p2")));
  });

  it("Gleichstand der Stufe entscheidet der Name, nicht der Wert", () => {
    const l = baueSpielerListe(modell(0), { ...opt, disziplin: "tdm", sort: { k: "eig", d: -1 } });
    const fremd = l.zeilen.filter((z) => ["p2", "p3", "p4"].includes(z.id));
    // Stufe von p3 ist 60..70 (eig 71 -> 71-10 = 61), die der anderen 60..70 oder 65..? — gleiche Stufe -> alphabetisch.
    const gleiche = fremd.filter((z) => z.eig.text === fremd[0]!.eig.text).map((z) => z.name);
    expect(gleiche).toEqual([...gleiche].sort((x, y) => x.localeCompare(y, "de")));
  });

  it("Rang ist der Rang der Stufe und wird geteilt", () => {
    const l = baueSpielerListe(modell(0), opt);
    const fremd = l.zeilen.filter((z) => ["p2", "p3", "p4"].includes(z.id));
    expect(new Set(fremd.map((z) => z.rang)).size).toBe(1);
  });

  it("fremde Spieler zeigen feste Stufen, eigene exakt, beobachtete 5er", () => {
    const m = modell(0);
    expect(sichtWert(m.spieler[1]!, "hockey")).toMatchObject({ exakt: false, text: "70–80", sort: 70 });
    expect(sichtWert(m.spieler[0]!, "hockey")).toMatchObject({ exakt: true, text: "66" });
    expect(sichtWert(m.spieler[4]!, "hockey")).toMatchObject({ exakt: false, text: "65–70" });
    expect(sichtWert(m.spieler[0]!, "ges").text).toBe("61,7");
  });

  it("Teams: Rang öffentlich, Wert fremder Teams nur als 5er-Stufe, eigenes Team exakt, Punkte ohne Nebel", () => {
    const m = modell(0);
    const eigen = m.teams[0]!;
    const fremd = m.teams[1]!;
    expect(teamWertText(m, eigen, "ges", "staerke")).toBe("50,0");
    expect(teamWertText(m, fremd, "ges", "staerke")).toBe(stufenText(47.3, 5));
    expect(stufenText(47.3, 5)).toBe("45–50");
    const raenge = teamRangTabelle(m, m.teams, "staerke");
    expect(raenge.ges!.get("A-A")).toBe(1);
    expect(raenge.ges!.get("B-B")).toBe(2);
    expect(raenge.ges!.get("C-C")).toBe(3);
  });

  it("Fog of War aus: alles exakt", () => {
    const m = modell(0);
    const offen: RanksModell = { ...m, nebel: false, spieler: m.spieler.map((s) => ({ ...s, breite: 1 as const })) };
    const l = baueSpielerListe(offen, opt);
    expect(l.zeilen.every((z) => z.eig.exakt)).toBe(true);
    expect(teamWertText(offen, offen.teams[1]!, "ges", "staerke")).toBe("47,3");
  });

  it("die Komponente liest keine Rohfelder (nur sichtWert, Liste, Profil)", () => {
    const quelle = readFileSync(join(process.cwd(), "app/foundation/ranks-v2/RanksModern.tsx"), "utf8");
    expect(quelle).not.toMatch(/\.roh\b/);
  });
});

describe("Rangregeln", () => {
  it("Rang 1 ist der beste, gleiche Werte teilen, fehlende Werte bekommen keinen Rang", () => {
    const r = vergibRaenge([
      { id: "a", wert: 10 },
      { id: "b", wert: 12 },
      { id: "c", wert: 12 },
      { id: "d", wert: 3 },
      { id: "e", wert: null },
    ]);
    expect([r.get("b"), r.get("c"), r.get("a"), r.get("d")]).toEqual([1, 1, 3, 4]);
    expect(r.has("e")).toBe(false);
  });
});

describe("Stärke kommt aus der kanonischen Rangfunktion", () => {
  /** Minimaler GameState: zwei Teams, zwei Disziplinen, je acht Spieler. */
  function gs(): GameState {
    const disciplines = [
      { id: "hockey", name: "Hockey", category: "power", weight: 1, displayOrder: 2 },
      { id: "tdm", name: "TDM", category: "power", weight: 1, displayOrder: 1 },
    ];
    const players: unknown[] = [];
    const rosters: unknown[] = [];
    const teams = [
      { teamId: "A-A", shortCode: "A-A", name: "Alpha", humanControlled: true },
      { teamId: "B-B", shortCode: "B-B", name: "Beta", humanControlled: false },
    ];
    for (const [ti, t] of teams.entries()) {
      for (let i = 0; i < 8; i += 1) {
        const id = `${t.teamId}-${i}`;
        const basis = ti === 0 ? 40 : 55;
        players.push({ id, name: `S${id}`, rating: basis + i, className: "Bard", race: "Human", coreStats: { pow: 10, spe: 10, men: 10, soc: 10 }, disciplineRatings: { hockey: basis + i, tdm: basis - i }, form: 0 });
        rosters.push({ id: `r-${id}`, playerId: id, teamId: t.teamId });
      }
    }
    return {
      season: { id: "season-1", matchdayIds: [] },
      disciplines,
      teams,
      players,
      rosters,
      seasonState: { playerAvailabilityState: [], leagueByTeamId: { "A-A": "liga1", "B-B": "liga1" } },
      scenarioMeta: {},
    } as unknown as GameState;
  }

  it("Teamwert = Summe der besten sechs / 6 aus der Rangfunktion, Rang stimmt mit ihr überein", () => {
    const g = gs();
    const m = baueRanksModell({ gameState: g, ownTeamId: "A-A", duell: null });
    const kern = buildTeamDisciplineRankRowsFromGameState(g, g.disciplines, "combined");
    const kernB = kern.find((z) => z.teamId === "B-B")!;
    const b = m.teams.find((t) => t.teamId === "B-B")!;
    expect(b.staerke.hockey).toBeCloseTo(kernB.scorePack.disciplines.hockey! / 6, 6);
    expect(b.staerke.ges).toBeCloseTo(kernB.scorePack.total / (6 * 2), 6);
    const ranks = teamRangTabelle(m, m.teams, "staerke");
    expect(ranks.hockey!.get("B-B")).toBe(kernB.disciplineRanks.hockey);
    expect(ranks.ges!.get("B-B")).toBe(kernB.totalRank);
    expect(m.disziplinen.map((d) => d.id)).toEqual(["tdm", "hockey"]);
  });

  it("das eigene Team kommt aus dem Parameter, nie fest: Nebel trifft alle anderen", () => {
    const g = gs();
    const a = baueRanksModell({ gameState: g, ownTeamId: "A-A", duell: null });
    const b = baueRanksModell({ gameState: g, ownTeamId: "B-B", duell: null });
    expect(a.spieler.filter((s) => s.teamId === "A-A").every((s) => s.breite === 1)).toBe(true);
    expect(a.spieler.filter((s) => s.teamId === "B-B").every((s) => s.breite !== 1)).toBe(true);
    expect(b.spieler.filter((s) => s.teamId === "B-B").every((s) => s.breite === 1)).toBe(true);
    expect(b.spieler.filter((s) => s.teamId === "A-A").every((s) => s.breite !== 1)).toBe(true);
  });

  it("Fog-of-War-Einstellung aus (`scenarioMeta.scoutingNebelAus`): kein Nebel", () => {
    const g = gs();
    (g as unknown as { scenarioMeta: Record<string, unknown> }).scenarioMeta = { scoutingNebelAus: true };
    const m = baueRanksModell({ gameState: g, ownTeamId: "A-A", duell: null });
    expect(m.nebel).toBe(false);
    expect(m.spieler.every((s) => s.breite === 1)).toBe(true);
  });
});

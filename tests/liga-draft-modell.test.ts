/**
 * LIGA-DRAFT IM EINZELSCHRITT — die Regeln (Draft-Neubau, Stufe Kern, 18.11.).
 *
 * Chris (18.11. abends): jede Runde beginnt beim schwaechsten Team; hoechstens 16 Runden und 14 Picks je Team; ein Team
 * darf einen Pick auslassen; der Draft wartet auf Menschen, Auto-Pick je Mensch einschaltbar; Ueberspringen A (Nachzug)
 * und B (eigener GM pickt mit). Reine Funktionen, kein Spielstand auf der Platte.
 */
import { describe, expect, it } from "vitest";

import type { GameState, LigaDraftTeamZustand, LigaDraftZustand } from "@/lib/data/olyDataTypes";
import {
  berechneRundenReihenfolge,
  bucheAuslassen,
  bucheAusstieg,
  bucheDraftPick,
  bucheUeberspringen,
  erzeugeLigaDraft,
  naechsteZuege,
  setzeAutoPick,
  werIstDran,
} from "@/lib/draft/liga-draft-modell";

type MiniStand = Pick<GameState, "rosters" | "players" | "disciplines" | "teams" | "season">;

const JETZT = "2026-11-18T18:00:00.000Z";

function stand(teams: Array<{ teamId: string; cash: number }>, kader: Record<string, number[]> = {}): MiniStand {
  const disciplines = [
    { id: "d1", category: "power" },
    { id: "d2", category: "speed" },
  ] as unknown as GameState["disciplines"];
  const players: GameState["players"] = [];
  const rosters: GameState["rosters"] = [];
  for (const [teamId, werte] of Object.entries(kader)) {
    werte.forEach((wert, index) => {
      const id = `${teamId}-p${index}`;
      players.push({ id, name: id, disciplineRatings: { d1: wert, d2: wert } } as unknown as GameState["players"][number]);
      rosters.push({ id: `r-${id}`, teamId, playerId: id } as unknown as GameState["rosters"][number]);
    });
  }
  return {
    disciplines,
    players,
    rosters,
    teams: teams.map((team) => ({ teamId: team.teamId, name: team.teamId, cash: team.cash })) as unknown as GameState["teams"],
    season: { id: "season-1" } as GameState["season"],
  };
}

function sitz(teamId: string, art: "ki" | "mensch" = "ki", autoPick = art === "ki"): LigaDraftTeamZustand {
  return {
    teamId,
    art,
    ownerId: art === "mensch" ? `owner-${teamId}` : null,
    autoPick,
    status: "aktiv",
    fertigGrund: null,
    picks: 0,
    auslassungen: 0,
    startKaderIds: [],
    startKasse: 0,
    superstarLizenz: null,
  };
}

function pick(draft: LigaDraftZustand, gs: MiniStand, teamId: string, playerId = `${teamId}-neu-${draft.verlauf.length}`) {
  return bucheDraftPick({ draft, gameState: gs, teamId, playerId, quelle: "ki", abloese: 1, gehalt: 1, transferId: null, top3: null, jetzt: JETZT });
}

describe("Reihenfolge: jede Runde beginnt beim schwaechsten Team", () => {
  it("ordnet nach Kaderstaerke aufsteigend, Gleichstand: weniger Kasse zuerst", () => {
    const gs = stand(
      [
        { teamId: "A", cash: 100 },
        { teamId: "B", cash: 300 },
        { teamId: "C", cash: 200 },
        { teamId: "D", cash: 50 },
      ],
      { A: [90, 90], B: [40] },
    );
    // C und D: leer (Staerke 20). B: ein schwacher Spieler. A: zwei starke.
    expect(berechneRundenReihenfolge({ gameState: gs, teamIds: ["A", "B", "C", "D"], seed: "s", runde: 1 })).toEqual(["D", "C", "B", "A"]);
  });

  it("bei vollem Gleichstand entscheidet die Saat, reproduzierbar", () => {
    const gs = stand([
      { teamId: "A", cash: 100 },
      { teamId: "B", cash: 100 },
      { teamId: "C", cash: 100 },
    ]);
    const eins = berechneRundenReihenfolge({ gameState: gs, teamIds: ["A", "B", "C"], seed: "x", runde: 1 });
    const zwei = berechneRundenReihenfolge({ gameState: gs, teamIds: ["C", "B", "A"], seed: "x", runde: 1 });
    expect(eins).toEqual(zwei);
    expect([...eins].sort()).toEqual(["A", "B", "C"]);
  });

  it("die zweite Runde wird neu nach Staerke berechnet (wer stark gepickt hat, pickt spaeter)", () => {
    let gs = stand([
      { teamId: "A", cash: 10 },
      { teamId: "B", cash: 20 },
    ]);
    let draft = erzeugeLigaDraft({ gameState: gs, teams: [sitz("A"), sitz("B")], seed: "s", jetzt: JETZT });
    expect(draft.reihenfolge).toEqual(["A", "B"]);
    // A pickt einen Star, B einen schwachen Spieler.
    gs = stand(
      [
        { teamId: "A", cash: 10 },
        { teamId: "B", cash: 20 },
      ],
      { A: [95], B: [30] },
    );
    draft = pick(draft, gs, "A", "A-p0");
    draft = pick(draft, gs, "B", "B-p0");
    expect(draft.runde).toBe(2);
    expect(draft.reihenfolge).toEqual(["B", "A"]);
  });
});

describe("Regeln: Runden, Picks, Auslassen, Aussteigen", () => {
  it("hoechstens 14 Picks je Team, danach ist es fertig", () => {
    const gs = stand([{ teamId: "A", cash: 0 }]);
    let draft = erzeugeLigaDraft({ gameState: gs, teams: [sitz("A")], seed: "s", jetzt: JETZT });
    for (let i = 0; i < 14; i += 1) draft = pick(draft, gs, "A");
    expect(draft.teams.A!.picks).toBe(14);
    expect(draft.teams.A!.status).toBe("fertig");
    expect(draft.teams.A!.fertigGrund).toBe("max_picks");
    expect(draft.status).toBe("fertig");
    expect(werIstDran(draft)).toBeNull();
  });

  it("hoechstens 16 Runden — wer zweimal auslaesst, kommt trotzdem auf 14 Picks", () => {
    const gs = stand([{ teamId: "M", cash: 0 }]);
    let draft = erzeugeLigaDraft({ gameState: gs, teams: [sitz("M", "mensch")], seed: "s", jetzt: JETZT });
    draft = bucheAuslassen({ draft, gameState: gs, teamId: "M", jetzt: JETZT });
    draft = bucheAuslassen({ draft, gameState: gs, teamId: "M", jetzt: JETZT });
    expect(draft.runde).toBe(3);
    for (let i = 0; i < 14; i += 1) draft = pick(draft, gs, "M");
    expect(draft.teams.M!.picks).toBe(14);
    expect(draft.teams.M!.auslassungen).toBe(2);
    expect(draft.runde).toBe(16);
    expect(draft.status).toBe("fertig");
  });

  it("nach Runde 16 endet der Draft auch fuer Teams unter 14 Picks", () => {
    const gs = stand([{ teamId: "M", cash: 0 }]);
    let draft = erzeugeLigaDraft({ gameState: gs, teams: [sitz("M", "mensch")], seed: "s", jetzt: JETZT });
    for (let i = 0; i < 16; i += 1) draft = bucheAuslassen({ draft, gameState: gs, teamId: "M", jetzt: JETZT });
    expect(draft.status).toBe("fertig");
    expect(draft.teams.M!.fertigGrund).toBe("draft_ende");
    expect(draft.verlauf.filter((e) => e.art === "auslassen")).toHaveLength(16);
  });

  it("ein Ausstieg am Zug gibt den Platz weiter; fertige Teams werden uebersprungen", () => {
    const gs = stand([
      { teamId: "A", cash: 1 },
      { teamId: "B", cash: 2 },
      { teamId: "C", cash: 3 },
    ]);
    let draft = erzeugeLigaDraft({ gameState: gs, teams: [sitz("A"), sitz("B"), sitz("C")], seed: "s", jetzt: JETZT });
    expect(werIstDran(draft)?.teamId).toBe("A");
    draft = bucheAusstieg({ draft, gameState: gs, teamId: "A", grund: "ki_stop", quelle: "ki", jetzt: JETZT });
    expect(werIstDran(draft)?.teamId).toBe("B");
    draft = pick(draft, gs, "B");
    draft = pick(draft, gs, "C");
    // Runde 2 ohne A.
    expect(draft.runde).toBe(2);
    expect(draft.reihenfolge).not.toContain("A");
  });

  it("Pick-Nummern zaehlen nur Picks, nicht Auslassen oder Ausstieg", () => {
    const gs = stand([
      { teamId: "A", cash: 1 },
      { teamId: "M", cash: 2 },
    ]);
    let draft = erzeugeLigaDraft({ gameState: gs, teams: [sitz("A"), sitz("M", "mensch")], seed: "s", jetzt: JETZT });
    draft = pick(draft, gs, "A");
    draft = bucheAuslassen({ draft, gameState: gs, teamId: "M", jetzt: JETZT });
    draft = pick(draft, gs, "A");
    expect(draft.verlauf.map((e) => [e.art, e.pickNr])).toEqual([
      ["pick", 1],
      ["auslassen", null],
      ["pick", 2],
    ]);
  });
});

describe("Mehrspieler: der Draft wartet, Auto-Pick, Ueberspringen", () => {
  it("ein Mensch ohne Auto-Pick haelt den Draft an; mit Auto-Pick ist sein Zug automatisch", () => {
    const gs = stand([
      { teamId: "M", cash: 1 },
      { teamId: "A", cash: 2 },
    ]);
    let draft = erzeugeLigaDraft({ gameState: gs, teams: [sitz("M", "mensch"), sitz("A")], seed: "s", jetzt: JETZT });
    expect(werIstDran(draft)).toMatchObject({ teamId: "M", automatisch: false });
    draft = setzeAutoPick(draft, "M", true, JETZT);
    expect(werIstDran(draft)).toMatchObject({ teamId: "M", automatisch: true });
  });

  it("Variante A: das Team verlaesst die Reihenfolge, nach dem geordneten Teil folgt der Nachzug", () => {
    const gs = stand([
      { teamId: "M", cash: 1 },
      { teamId: "A", cash: 2 },
    ]);
    let draft = erzeugeLigaDraft({ gameState: gs, teams: [sitz("M", "mensch"), sitz("A")], seed: "s", jetzt: JETZT, regeln: { maxRunden: 2 } });
    draft = bucheUeberspringen({ draft, gameState: gs, teamId: "M", variante: "A", jetzt: JETZT });
    expect(draft.teams.M!.status).toBe("nachzug");
    expect(werIstDran(draft)?.teamId).toBe("A");
    draft = pick(draft, gs, "A");
    draft = pick(draft, gs, "A");
    expect(draft.status).toBe("nachzug");
    // Nachzug: Picks ohne Reihenfolge, „fertig“ schliesst den Draft.
    draft = pick(draft, gs, "M");
    expect(draft.verlauf.at(-1)).toMatchObject({ teamId: "M", platz: null });
    draft = bucheAusstieg({ draft, gameState: gs, teamId: "M", grund: "mensch_fertig", quelle: "nachzug", jetzt: JETZT });
    expect(draft.status).toBe("fertig");
  });

  it("Variante B: das Team bleibt in der Reihenfolge, der GM pickt (Auto-Pick an)", () => {
    const gs = stand([
      { teamId: "M", cash: 1 },
      { teamId: "A", cash: 2 },
    ]);
    let draft = erzeugeLigaDraft({ gameState: gs, teams: [sitz("M", "mensch"), sitz("A")], seed: "s", jetzt: JETZT });
    draft = bucheUeberspringen({ draft, gameState: gs, teamId: "M", variante: "B", jetzt: JETZT });
    expect(draft.teams.M).toMatchObject({ status: "aktiv", autoPick: true });
    expect(werIstDran(draft)).toMatchObject({ teamId: "M", automatisch: true });
  });

  it("naechsteZuege zeigt die laufende Runde und die Vorschau der naechsten", () => {
    const gs = stand([
      { teamId: "A", cash: 1 },
      { teamId: "B", cash: 2 },
      { teamId: "M", cash: 3 },
    ]);
    const draft = erzeugeLigaDraft({ gameState: gs, teams: [sitz("A"), sitz("B"), sitz("M", "mensch")], seed: "s", jetzt: JETZT });
    const zuege = naechsteZuege(draft, gs, 5);
    expect(zuege.map((z) => [z.teamId, z.runde, z.automatisch])).toEqual([
      ["A", 1, true],
      ["B", 1, true],
      ["M", 1, false],
      ["A", 2, true],
      ["B", 2, true],
    ]);
  });
});

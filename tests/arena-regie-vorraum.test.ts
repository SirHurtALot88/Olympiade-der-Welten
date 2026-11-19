import { describe, expect, it } from "vitest";

import { baueRegieSchritte, ordneRegieMitspieler, teamfarbeInGruppe } from "@/lib/foundation/battle-arena/arena-regie";
import {
  baueLadeSchritte,
  baueVorraumTeams,
  groberMarke,
  mittelBeste6,
  punkteSchema,
} from "@/lib/foundation/battle-arena/arena-vorraum";

/**
 * Arena-Screens 18.11. (Mockup arena-spieltag-modern-18-11): Regieleiste, Vorraum (Laden/Vorstellung).
 * Geprueft wird die Logik hinter der Anzeige -- vor allem "kein Spoiler" und "eigenes Team immer orange".
 */
const seite = (id: string, gewertet: boolean, geplant = true) => ({ disciplineId: id, name: id, gewertet, geplant });

describe("Regieleiste: drei Schritte aus dem Buchungsstand", () => {
  it("D1 laeuft: D1 aktuell, D2 und Wertung offen", () => {
    const s = baueRegieSchritte({ d1: seite("basketball", false), d2: seite("battlefield", false), aktiveSeite: "d1" });
    expect(s.map((x) => [x.id, x.status])).toEqual([["d1", "aktuell"], ["d2", "offen"], ["wertung", "offen"]]);
  });
  it("D1 gebucht, D2 gezeigt: Haken bei D1, D2 aktuell", () => {
    const s = baueRegieSchritte({ d1: seite("basketball", true), d2: seite("battlefield", false), aktiveSeite: "d2" });
    expect(s.map((x) => x.status)).toEqual(["erledigt", "aktuell", "offen"]);
  });
  it("beide gebucht: die Wertung ist der aktuelle Schritt", () => {
    const s = baueRegieSchritte({ d1: seite("a", true), d2: seite("b", true), aktiveSeite: "d2" });
    expect(s.map((x) => x.status)).toEqual(["erledigt", "erledigt", "aktuell"]);
  });
  it("Ein-Disziplin-Spieltag: nur ein Disziplin-Schritt", () => {
    const s = baueRegieSchritte({ d1: seite("a", false), d2: null, aktiveSeite: "d1" });
    expect(s.map((x) => x.id)).toEqual(["d1", "wertung"]);
  });
  it("Mitspieler: eigenes Team zuerst", () => {
    const m = ordneRegieMitspieler([
      { teamId: "b", teamName: "Bär", spielerName: null, istEigen: false },
      { teamId: "a", teamName: "Adler", spielerName: null, istEigen: false },
      { teamId: "z", teamName: "Zebra", spielerName: "Chris", istEigen: true },
    ]);
    expect(m.map((x) => x.teamId)).toEqual(["z", "a", "b"]);
  });
});

describe("Teamfarben: eigenes Team immer orange, die anderen tuerkis/violett/rosa", () => {
  it("eigenes Team an beliebiger Gruppenstelle", () => {
    const f = teamfarbeInGruppe(["A", "N", "B", "C"], "N");
    expect(f.N).toBe("#F2A03D");
    expect(new Set([f.A, f.B, f.C]).size).toBe(3);
    expect(f.A).not.toBe("#F2A03D");
  });
});

describe("Vorraum: kein Spoiler, eigenes Team zuerst", () => {
  const spieler = (id: string, wert: number) => ({ id, currentDisciplineValues: { basketball: wert } });
  const gameState = {
    teams: [
      { teamId: "N", name: "Nunchuck Ninjas", shortCode: "NN" },
      { teamId: "G", name: "Gegner", shortCode: "GEG" },
    ],
    players: [...[90, 80, 70, 60, 50, 40, 10, 5].map((w, i) => spieler(`n${i}`, w)), ...[50, 50, 50, 50, 50, 50, 99].map((w, i) => spieler(`g${i}`, w))],
    rosters: [
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ playerId: `n${i}`, teamId: "N" })),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ playerId: `g${i}`, teamId: "G" })),
    ],
    seasonState: { standings: { N: { rank: 3, points: 4 }, G: { rank: 9, points: 1 } } },
  } as never;

  it("Kaderstaerke ueber die BESTEN 6, nicht ueber alle", () => {
    expect(mittelBeste6([90, 80, 70, 60, 50, 40, 10, 5])).toBe(65);
    expect(mittelBeste6([])).toBeNull();
  });
  it("eigenes Team zuerst, orange, mit Platz und gerundeter Staerke", () => {
    const teams = baueVorraumTeams({ gameState, teamIds: ["G", "N"], ownTeamId: "N", disciplineId: "basketball" });
    expect(teams.map((t) => t.teamId)).toEqual(["N", "G"]);
    expect(teams[0]).toMatchObject({ eigen: true, farbe: "#F2A03D", rang: 3, kaderStaerke: 65 });
    expect(teams[1].eigen).toBe(false);
    // Gegner: nur Zahl ueber die besten 6 (die 99 des Ersatzspielers zaehlt mit, die Aufstellung nicht).
    expect(teams[1].kaderStaerke).toBe(Math.round((99 + 50 * 5) / 6));
  });
  it("grobe Marke 1..5, ohne Wert keine", () => {
    expect(groberMarke(null, [1, 2])).toBeNull();
    expect(groberMarke(10, [10, 50])).toBe(1);
    expect(groberMarke(50, [10, 50])).toBe(5);
  });
  it("Punkteschema: Duell 2/1/0, Vierergruppe 2-1-0-0", () => {
    expect(punkteSchema("duell").map((x) => x.punkte)).toEqual([2, 1, 0]);
    expect(punkteSchema("pod").map((x) => x.punkte)).toEqual([2, 1, 0, 0]);
  });
  it("Ladeschritte: genau einer laeuft, der Rest davor ist fertig", () => {
    expect(baueLadeSchritte({ kaderGeladen: false, aufstellungDa: false, motorBereit: false }).map((s) => s.status)).toEqual(["laeuft", "offen", "offen", "offen"]);
    expect(baueLadeSchritte({ kaderGeladen: true, aufstellungDa: true, motorBereit: false }).map((s) => s.status)).toEqual(["fertig", "fertig", "fertig", "laeuft"]);
    expect(baueLadeSchritte({ kaderGeladen: true, aufstellungDa: true, motorBereit: true }).every((s) => s.status === "fertig")).toBe(true);
  });
});

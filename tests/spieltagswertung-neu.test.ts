import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DisciplineStageSpieltagswertung from "@/app/foundation/discipline-stage/DisciplineStageSpieltagswertung";
import {
  baueWertungsZeilen,
  beschreibeWertungsErgebnis,
  filtereWertungsZeilen,
  gruppiereNachLiga,
  startFilter,
  wertungsMarke,
  type WertungsEingabe,
} from "@/app/foundation/discipline-stage/spieltagswertung-zeilen";

/**
 * Spieltagswertung neu (18.11.): gezeigt = gebucht. Die Zeilen übernehmen die Werte der Preview-Props und
 * folgen der Aufdeck-Regel der alten Tabelle; Form und Captain laufen getrennt von den Punkten.
 */

const GRUPPE = ["a", "b", "c", "d"];

function eingabe(over: Partial<WertungsEingabe> = {}): WertungsEingabe {
  return {
    teamResults: [
      {
        teamId: "a",
        d1DisciplineId: "basket",
        d1Points: 2.3,
        d2DisciplineId: "bf",
        d2Points: 1,
        totalPoints: 3,
        d1Ergebnis: { art: "duell", eigen: 78, gegner: 71, gegnerTeamId: "b" },
        d2Ergebnis: { art: "gruppe", platz: 2, wert: 88, podId: "p1", teamIds: GRUPPE },
      },
      {
        teamId: "b",
        d1DisciplineId: "basket",
        d1Points: 0,
        d2DisciplineId: "bf",
        d2Points: 2,
        totalPoints: 2,
        d1Ergebnis: { art: "duell", eigen: 71, gegner: 78, gegnerTeamId: "a" },
        d2Ergebnis: { art: "gruppe", platz: 1, wert: 112, podId: "p1", teamIds: GRUPPE },
      },
      { teamId: "e", d1DisciplineId: "basket", d1Points: 1, d2DisciplineId: "bf", d2Points: 0, totalPoints: 1 },
    ],
    standings: [
      { teamId: "a", currentRank: 3, projectedRank: 2, currentPoints: 4, projectedPoints: 7, pointsDelta: 3 },
      { teamId: "b", currentRank: 2, projectedRank: 3, currentPoints: 5, projectedPoints: 7, pointsDelta: 2 },
      { teamId: "e", currentRank: 1, projectedRank: 1, currentPoints: 6, projectedPoints: 7, pointsDelta: 1 },
    ],
    d1: { disciplineId: "basket", displayName: "Basketball" },
    d2: { disciplineId: "bf", displayName: "Battlefield" },
    d1Revealed: true,
    d2Revealed: true,
    teamMetaById: new Map([
      ["a", { code: "AAA", name: "Team A", logoUrl: null }],
      ["b", { code: "BBB", name: "Team B", logoUrl: null }],
      ["e", { code: "EEE", name: "Team E", logoUrl: null }],
    ]),
    ownTeamId: "a",
    mutatorByTeam: new Map([["a", { d1Pp: 0.3, d2Pp: 0, d1Players: [{ name: "P1", pp: 0.3 }], d2Players: [] }]]),
    modifiersByTeam: new Map([
      [
        "a",
        {
          d1: { formCardLabel: "R+3", formModifier: 3, formTone: "positive", captainUsed: true, captainName: "P1", captainBonus: 1.5 },
          d2: { formCardLabel: "B-2", formModifier: -2, formTone: "negative", captainUsed: false, captainName: null, captainBonus: null },
        },
      ],
    ]),
    leagueByTeam: new Map([
      ["a", "liga2"],
      ["b", "liga2"],
      ["e", "liga1"],
    ]),
    humanLabelByTeam: new Map([["a", "Chris"]]),
    ...over,
  };
}

describe("Spieltagswertung neu: Zeilen", () => {
  it("zählt den Mutator einmal: die Arena liefert d1Points/d2Points schon MIT Mutator", () => {
    const zeile = baueWertungsZeilen(eingabe()).find((z) => z.teamId === "a")!;
    expect(zeile.gesamt).toBeCloseTo(3.3);
    expect(zeile.mutator).toBeCloseTo(0.3);
    expect(zeile.punkte).toBeCloseTo(3);
    expect(zeile.d1.punkte).toBeCloseTo(2);
  });

  it("Gesamt ist genau das gebuchte pointsDelta der Saisontabelle (Platzierung + Team-Mutator)", () => {
    // Buchung (`standings-preview-engine.ts`): pointsDelta = d1Points + d2Points (Platzierung) + Team-Mutator.
    // Die Arena addiert den Mutator je Seite in d1Points/d2Points; die Summe muss dasselbe ergeben.
    const platzierung = { a: [2, 1], b: [0, 2], e: [1, 0] } as const;
    const mutator = { a: [0.3, 0.3], b: [0, 0], e: [0.6, 0] } as const;
    const gebuchtesDelta = (id: "a" | "b" | "e") =>
      Math.round((platzierung[id][0] + platzierung[id][1] + mutator[id][0] + mutator[id][1]) * 10) / 10;
    const teamResults = (["a", "b", "e"] as const).map((id) => ({
      teamId: id,
      d1DisciplineId: "basket",
      d1Points: platzierung[id][0] + mutator[id][0],
      d2DisciplineId: "bf",
      d2Points: platzierung[id][1] + mutator[id][1],
      totalPoints: 0,
    }));
    const standings = (["a", "b", "e"] as const).map((id, i) => ({
      teamId: id,
      currentRank: i + 1,
      projectedRank: i + 1,
      currentPoints: 10,
      projectedPoints: 10 + gebuchtesDelta(id),
      pointsDelta: gebuchtesDelta(id),
    }));
    const mutatorByTeam = new Map(
      (["a", "b", "e"] as const).map((id) => [id, { d1Pp: mutator[id][0], d2Pp: mutator[id][1], d1Players: [], d2Players: [] }]),
    );
    const zeilen = baueWertungsZeilen(eingabe({ teamResults, standings, mutatorByTeam }));
    for (const z of zeilen) {
      const s = standings.find((x) => x.teamId === z.teamId)!;
      expect(z.gesamt).toBeCloseTo(s.pointsDelta);
      expect(z.punkte + z.mutator).toBeCloseTo(s.pointsDelta);
      expect(z.nachPunkte! - z.vorPunkte!).toBeCloseTo(z.gesamt);
    }
  });

  it("hält Form und Captain getrennt von Punkten und Gesamt", () => {
    const zeile = baueWertungsZeilen(eingabe()).find((z) => z.teamId === "a")!;
    expect(zeile.form).toBe(1);
    expect(zeile.captain).toBe(1.5);
    expect(zeile.gesamt).toBeCloseTo(zeile.punkte + zeile.mutator);
    expect(zeile.hatForm).toBe(true);
    expect(zeile.hatCaptain).toBe(true);
  });

  it("zeigt bei verdeckter Disziplin 2 keinen Wert aus ihr", () => {
    const zeile = baueWertungsZeilen(eingabe({ d2Revealed: false })).find((z) => z.teamId === "a")!;
    expect(zeile.d2.aufgedeckt).toBe(false);
    expect(zeile.d2.punkte).toBeNull();
    expect(zeile.d2.ergebnis).toBeNull();
    expect(zeile.punkte).toBe(2);
    expect(zeile.gesamt).toBeCloseTo(2.3);
    expect(zeile.form).toBe(3);
  });

  it("ordnet standardmäßig nach Gesamt und vergibt den Tagesrang daraus", () => {
    const zeilen = baueWertungsZeilen(eingabe());
    expect(zeilen.map((z) => z.teamId)).toEqual(["a", "b", "e"]);
    expect(zeilen.map((z) => z.tagesRang)).toEqual([1, 2, 3]);
  });

  it("liest die Rangbewegung aus vorher und nachher", () => {
    const zeilen = baueWertungsZeilen(eingabe());
    expect(zeilen.find((z) => z.teamId === "a")!.bewegung).toBe(1);
    expect(zeilen.find((z) => z.teamId === "b")!.bewegung).toBe(-1);
    expect(zeilen.find((z) => z.teamId === "e")!.bewegung).toBe(0);
  });
});

describe("Spieltagswertung neu: Filter und Worte", () => {
  it("filtert nach Liga, Gruppe und Menschen", () => {
    const zeilen = baueWertungsZeilen(eingabe());
    expect(filtereWertungsZeilen(zeilen, "liga1", "a").map((z) => z.teamId)).toEqual(["e"]);
    expect(filtereWertungsZeilen(zeilen, "liga2", "a").map((z) => z.teamId).sort()).toEqual(["a", "b"]);
    expect(filtereWertungsZeilen(zeilen, "gruppe", "a").map((z) => z.teamId).sort()).toEqual(["a", "b"]);
    expect(filtereWertungsZeilen(zeilen, "mensch", "a").map((z) => z.teamId)).toEqual(["a"]);
    expect(filtereWertungsZeilen(zeilen, "beide", "a")).toHaveLength(3);
    expect(startFilter(zeilen)).toBe("beide");
  });

  it("startet ohne Ligatrennung mit allen Teams", () => {
    const zeilen = baueWertungsZeilen(eingabe({ leagueByTeam: null }));
    expect(startFilter(zeilen)).toBe("alle");
  });

  it("beschreibt Duell und Gruppe in Worten", () => {
    const zeile = baueWertungsZeilen(eingabe()).find((z) => z.teamId === "a")!;
    const name = (id: string) => (id === "b" ? "Team B" : null);
    expect(beschreibeWertungsErgebnis(zeile.d1.ergebnis, name)).toBe("Sieg 78 : 71 gegen Team B");
    expect(beschreibeWertungsErgebnis(zeile.d2.ergebnis, name)).toBe("Platz 2 von 4 · Gruppenwert 88");
    expect(wertungsMarke(zeile.d1.ergebnis)).toEqual({ text: "S", ton: "s" });
    expect(wertungsMarke(zeile.d2.ergebnis)).toEqual({ text: "2.", ton: "z" });
  });
});

describe("Spieltagswertung neu: Ligen getrennt", () => {
  it("zählt den Rang je Liga von 1 und teilt gleiche Gesamtwerte", () => {
    const zeilen = baueWertungsZeilen(eingabe());
    const rang = (id: string) => zeilen.find((z) => z.teamId === id)!.ligaRang;
    expect(rang("e")).toBe(1);
    expect([rang("a"), rang("b")].sort()).toEqual([1, 2]);
  });

  it("gruppiert: eigene Liga zuerst, jedes Team genau in seiner Liga, Rang je Block 1..n", () => {
    const zeilen = baueWertungsZeilen(eingabe());
    const bloecke = gruppiereNachLiga(zeilen, "a");
    expect(bloecke.map((b) => b.titel)).toEqual(["Liga 2", "Liga 1"]);
    expect(bloecke[0].istEigene).toBe(true);
    for (const b of bloecke) {
      expect(b.zeilen.every((z) => z.liga === b.liga)).toBe(true);
      expect(b.zeilen.map((z) => z.ligaRang)).toEqual(b.zeilen.map((_, i) => i + 1));
    }
    expect(bloecke.flatMap((b) => b.zeilen.map((z) => z.teamId)).sort()).toEqual(["a", "b", "e"]);
  });

  it("zeigt ohne Ligatrennung keine Blöcke, sondern Alle", () => {
    expect(startFilter(baueWertungsZeilen(eingabe({ leagueByTeam: null })))).toBe("alle");
  });
});

describe("Spieltagswertung neu: Anzeige", () => {
  function render(over: Partial<WertungsEingabe> = {}) {
    return renderToString(React.createElement(DisciplineStageSpieltagswertung as never, eingabe(over) as never));
  }

  it("zeigt eine Zeile je Team und Form/Captain in eigener Spaltengruppe", () => {
    const html = render();
    expect(html).toContain('data-testid="spieltagswertung-zeile-a"');
    expect(html).toContain("Du");
    // Start ist „Beide Ligen“: zwei Blöcke, keine gemeinsame Liste.
    expect(html).toContain('data-testid="spieltagswertung-liga-liga1"');
    expect(html).toContain('data-testid="spieltagswertung-liga-liga2"');
    expect(html).not.toContain('data-testid="spieltagswertung-tabelle"');
  });

  it("zeigt ohne Ligatrennung die volle Tabelle mit Form/Captain in eigener Spaltengruppe", () => {
    const html = render({ leagueByTeam: null });
    expect(html).toContain('data-testid="spieltagswertung-tabelle"');
    expect(html).toContain("Wirkung im Score · keine Punkte");
    expect(html).not.toContain("spieltagswertung-ligen");
  });

  it("steckt jedes Team nur im Block seiner Liga, die eigene Liga steht zuerst", () => {
    const html = render();
    const liga2 = html.slice(html.indexOf('spieltagswertung-liga-liga2'));
    const liga1Start = html.indexOf('spieltagswertung-liga-liga1');
    const liga2Start = html.indexOf('spieltagswertung-liga-liga2');
    expect(liga2Start).toBeLessThan(liga1Start);
    const block2 = html.slice(liga2Start, liga1Start);
    const block1 = html.slice(liga1Start);
    expect(block2).toContain("spieltagswertung-zeile-a");
    expect(block2).toContain("spieltagswertung-zeile-b");
    expect(block2).not.toContain("spieltagswertung-zeile-e");
    expect(block1).toContain("spieltagswertung-zeile-e");
    expect(block1).not.toContain("spieltagswertung-zeile-a");
    expect(liga2).toContain("Deine Liga");
    expect(html).toContain("<h2>Spieltagswertung</h2>");
  });

  it("verschließt Gesamt und Rang nach dem Spieltag, solange Disziplin 2 fehlt", () => {
    const html = render({ d2Revealed: false });
    expect(html).not.toContain("3,3");
    expect(html).toContain("Noch nicht gespielt");
  });

  it("rechnet im Blatt D1 + D2 + Mutator = Gesamt", () => {
    const html = render();
    expect(html).toContain("= Gesamt");
    expect(html).toContain("3,3");
  });
});

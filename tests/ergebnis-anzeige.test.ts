import { readFileSync } from "node:fs";
import path from "node:path";

import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DisciplineStageSpieltagswertung from "@/app/foundation/discipline-stage/DisciplineStageSpieltagswertung";
import { baueBegegnungen } from "@/app/foundation/discipline-stage/spieltagswertung-begegnungen";
import {
  baueWertungsZeilen,
  beschreibeWertungsErgebnis,
  type WertungsEingabe,
} from "@/app/foundation/discipline-stage/spieltagswertung-zeilen";
import {
  STAFFEL_ZEIT_DEHNUNG,
  duellErgebnisAnzeige,
  duellErgebnisText,
  gruppenWertText,
  zeitKurz,
  zeitText,
} from "@/lib/foundation/ergebnis-anzeige";

/**
 * Ergebnis-Anzeige (21.11.): Summen-/Zeit-Disziplinen zeigen die Summe bzw. Zeit, Breaking die besiegten Gegner,
 * nie den Siegmarker "1 : 0". Gezeigt = gebucht: alle Zahlen kommen aus den gebuchten Feldern.
 */

describe("Ergebnis-Anzeige: Format", () => {
  it("formatiert Zeiten wie der Motor-HUD", () => {
    expect(zeitKurz(325.434)).toBe("5:25,4");
    expect(zeitText(325.434)).toBe("5:25,4 min");
    expect(zeitText(24.44)).toBe("24,4 s");
    expect(zeitKurz(119.96)).toBe("2:00,0");
    expect(zeitKurz(59.96)).toBe("60,0");
  });

  it("Punkte-Disziplin: nativer Seitenstand, Differenz, E1-Skala", () => {
    const a = duellErgebnisAnzeige({ disciplineId: "basketball", seiten: [87, 79], skala: [7, 4] });
    expect(a.nativ).toBe("87 : 79");
    expect(a.diff).toBe("+8");
    expect(a.diffTon).toBe("plus");
    expect(a.ausgang).toBe("sieg");
    expect(duellErgebnisText(a)).toBe("87 : 79 → 7 : 4");
    const v = duellErgebnisAnzeige({ disciplineId: "basketball", seiten: [71, 78.5] });
    expect(v.diff).toBe("−7,5");
    expect(v.ausgang).toBe("niederlage");
  });

  it("Zeitfahren zeigt die Zeitsummen statt 1 : 0 und die Differenz als Vorsprung", () => {
    const a = duellErgebnisAnzeige({
      disciplineId: "time-trial",
      seiten: [1, 0],
      anzeige: { art: "zeit", werte: [325.4, 415.1] },
      skala: [9, 1],
    });
    expect(a.nativ).toBe("5:25,4 : 6:55,1");
    expect(a.nativ).not.toContain("1 : 0");
    expect(a.diff).toBe("+1:29,7");
    expect(a.diffTon).toBe("plus");
    expect(a.ausgang).toBe("sieg");
    expect(duellErgebnisText(a)).toBe("5:25,4 : 6:55,1 Zeitsumme → 9 : 1");
    // Der Verlierer sieht dieselben Zeiten aus seiner Sicht, mit negativer Differenz.
    const v = duellErgebnisAnzeige({ disciplineId: "time-trial", seiten: [0, 1], anzeige: { art: "zeit", werte: [415.1, 325.4] } });
    expect(v.diff).toBe("−1:29,7");
    expect(v.ausgang).toBe("niederlage");
  });

  it("Staffel nennt Zielzeit", () => {
    const a = duellErgebnisAnzeige({ disciplineId: "staffel", seiten: [0, 1], anzeige: { art: "zeit", werte: [212.4, 170.2] } });
    expect(a.einheit).toBe("Zielzeit");
    expect(duellErgebnisText(a)).toBe("3:32,4 : 2:50,2 Zielzeit");
  });

  it("Breaking zaehlt besiegte Gegner, nicht Ueberlebende", () => {
    const a = duellErgebnisAnzeige({ disciplineId: "breaking", seiten: [1, 0], anzeige: { art: "besiegt", werte: [6, 5] }, skala: [10, 2] });
    expect(a.nativ).toBe("6 : 5");
    expect(a.diff).toBe("+1");
    expect(duellErgebnisText(a)).toBe("6 : 5 besiegte Gegner → 10 : 2");
  });

  it("aeltere Zeilen ohne Zeiten/Besiegte zeigen keine erfundene Zahl", () => {
    for (const id of ["time-trial", "staffel", "breaking"]) {
      const a = duellErgebnisAnzeige({ disciplineId: id, seiten: [1, 0], skala: [9, 1] });
      expect(a.nativ).toBeNull();
      expect(a.hinweis).toContain("nicht gespeichert");
      expect(a.ausgang).toBe("sieg");
      expect(duellErgebnisText(a)).toBe("9 : 1");
    }
  });

  it("Staffel-Gruppenwert ist die Zielzeit in angezeigten Sekunden", () => {
    expect(gruppenWertText("staffel", 12)).toBe(zeitKurz(12 * STAFFEL_ZEIT_DEHNUNG));
    expect(gruppenWertText("takeshis-castle", 82.7)).toBe("82,7");
    expect(gruppenWertText("battlefield", null)).toBeNull();
  });

  it("die Staffel-Dehnung stimmt mit dem Motor ueberein", () => {
    const motor = readFileSync(path.join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");
    const treffer = motor.match(/const ZEIT_DEHNUNG=\{[^}]*staffel:([0-9.]+)/);
    expect(treffer).not.toBeNull();
    expect(Number(treffer![1])).toBe(STAFFEL_ZEIT_DEHNUNG);
  });
});

const GRUPPE = ["a", "b", "c", "d"];

function eingabe(): WertungsEingabe {
  return {
    teamResults: [
      {
        teamId: "a", d1DisciplineId: "time-trial", d1Points: 2, d2DisciplineId: "battlefield", d2Points: 2, totalPoints: 4,
        d1Ergebnis: { art: "duell", eigen: 1, gegner: 0, gegnerTeamId: "b", skala: [9, 1], verhaeltnis: 8, zahl: { art: "zeit", werte: [325.4, 415.1] } },
        d2Ergebnis: { art: "gruppe", platz: 1, wert: 112, podId: "p1", teamIds: GRUPPE, skala: 10 },
      },
      {
        teamId: "b", d1DisciplineId: "time-trial", d1Points: 0, d2DisciplineId: "battlefield", d2Points: 1, totalPoints: 1,
        d1Ergebnis: { art: "duell", eigen: 0, gegner: 1, gegnerTeamId: "a", skala: [1, 9], verhaeltnis: -8, zahl: { art: "zeit", werte: [415.1, 325.4] } },
        d2Ergebnis: { art: "gruppe", platz: 2, wert: 88, podId: "p1", teamIds: GRUPPE, skala: 4 },
      },
      {
        teamId: "c", d1DisciplineId: "time-trial", d1Points: 1, d2DisciplineId: "battlefield", d2Points: 0, totalPoints: 1,
        d1Ergebnis: { art: "duell", eigen: 0, gegner: 0, gegnerTeamId: "d", skala: [5, 5], verhaeltnis: 0 },
        d2Ergebnis: { art: "gruppe", platz: 3, wert: 70, podId: "p1", teamIds: GRUPPE, skala: 2 },
      },
      {
        teamId: "d", d1DisciplineId: "time-trial", d1Points: 1, d2DisciplineId: "battlefield", d2Points: 0, totalPoints: 1,
        d1Ergebnis: { art: "duell", eigen: 0, gegner: 0, gegnerTeamId: "c", skala: [5, 5], verhaeltnis: 0 },
        d2Ergebnis: { art: "gruppe", platz: 4, wert: 50, podId: "p1", teamIds: GRUPPE, skala: 0 },
      },
    ],
    standings: ["a", "b", "c", "d"].map((teamId, i) => ({ teamId, currentRank: i + 1, projectedRank: i + 1, currentPoints: 5, projectedPoints: 6, pointsDelta: 1 })),
    d1: { disciplineId: "time-trial", displayName: "Zeitfahren" },
    d2: { disciplineId: "battlefield", displayName: "Battlefield" },
    d1Revealed: true,
    d2Revealed: true,
    teamMetaById: new Map(GRUPPE.map((id) => [id, { code: id.toUpperCase(), name: `Team ${id.toUpperCase()}`, logoUrl: null }])),
    ownTeamId: "b",
    modifiersByTeam: new Map([
      ["b", {
        d1: { formCardLabel: "R+3", formModifier: 3, formTone: "positive", captainUsed: true, captainName: "P1", captainBonus: 1.5 },
        d2: { formCardLabel: "B-2", formModifier: -2, formTone: "negative", captainUsed: false, captainName: null, captainBonus: null },
      }],
    ]),
    leagueByTeam: null,
    humanLabelByTeam: new Map([["b", "Chris"]]),
  };
}

describe("Spieltagswertung: Begegnungen", () => {
  it("bildet jedes Duell genau einmal, Sieger links, und jede Gruppe einmal nach Platz", () => {
    const zeilen = baueWertungsZeilen(eingabe());
    const d1 = baueBegegnungen(zeilen, "d1", "b");
    expect(d1).toHaveLength(2);
    const eigenes = d1[0];
    expect(eigenes.art).toBe("duell");
    if (eigenes.art !== "duell") throw new Error("duell erwartet");
    // Eigenes Team (b) hat verloren: der Sieger a steht links, die Zeiten aus Sicht von a.
    expect(eigenes.a.teamId).toBe("a");
    expect(eigenes.b.teamId).toBe("b");
    expect(eigenes.istEigen).toBe(true);
    expect(eigenes.anzeige.nativ).toBe("5:25,4 : 6:55,1");
    expect(eigenes.anzeige.diff).toBe("+1:29,7");
    expect(eigenes.a.skala).toBe(9);
    expect(eigenes.b.skala).toBe(1);
    expect(eigenes.verhaeltnis).toBe(8);
    expect(eigenes.b.form).toBe(3);
    expect(eigenes.b.captain).toBe(1.5);
    // Remis c : d bleibt ein Eintrag, Zeiten nicht gespeichert -> kein erfundenes "0 : 0".
    const remis = d1[1];
    if (remis.art !== "duell") throw new Error("duell erwartet");
    expect(remis.anzeige.nativ).toBeNull();

    const d2 = baueBegegnungen(zeilen, "d2", "b");
    expect(d2).toHaveLength(1);
    const gruppe = d2[0];
    if (gruppe.art !== "gruppe") throw new Error("gruppe erwartet");
    expect(gruppe.plaetze.map((p) => p.teamId)).toEqual(["a", "b", "c", "d"]);
    expect(gruppe.plaetze.map((p) => p.skala)).toEqual([10, 4, 2, 0]);
  });

  it("liefert keine Begegnung fuer eine verdeckte Disziplin", () => {
    const e = eingabe();
    const zeilen = baueWertungsZeilen({ ...e, d2Revealed: false });
    expect(baueBegegnungen(zeilen, "d2", "b")).toEqual([]);
    expect(baueBegegnungen(zeilen, "d1", "b")).toHaveLength(2);
  });

  it("beschreibt das Blatt-Ergebnis mit Zeit, Differenz und Skala", () => {
    const zeilen = baueWertungsZeilen(eingabe());
    const a = zeilen.find((z) => z.teamId === "a")!;
    const name = (id: string) => (id === "b" ? "Team B" : null);
    expect(beschreibeWertungsErgebnis(a.d1.ergebnis, name, "time-trial")).toBe(
      "Sieg 5:25,4 : 6:55,1 Zeitsumme (+1:29,7) gegen Team B → 9 : 1",
    );
    expect(beschreibeWertungsErgebnis(a.d2.ergebnis, name, "battlefield")).toBe("Platz 1 von 4 · Gruppenwert 112 → 10");
  });
});

describe("Spieltagswertung: Anzeige", () => {
  const render = () => renderToString(React.createElement(DisciplineStageSpieltagswertung as never, eingabe() as never));

  it("zeigt Zeit statt 1:0, die Differenz und Form/Captain je Disziplin, aber keine Mutator-Spalte", () => {
    const html = render();
    expect(html).toContain("5:25,4 : 6:55,1");
    expect(html).not.toContain("1 : 0");
    expect(html).toContain("+1:29,7");
    expect(html).toContain("Form D1 · D2");
    expect(html).toContain("Captain D1 · D2");
    expect(html).not.toContain("Mutator");
    expect(html).toContain('data-testid="spieltagswertung-ansicht-begegnungen"');
  });

  it("das Blatt nennt Differenz und Skala statt Mutator-Bonus", () => {
    const html = render();
    expect(html).toContain("Differenz");
    expect(html).not.toContain("Mutator-Bonus");
  });
});

describe("Spieltagswertung: Breaking aelterer Spieltage", () => {
  it("leitet besiegte Gegner aus Ueberlebenden und Einsatzlisten ab, nicht aus dem Siegmarker", () => {
    const spieler = (n: number) => Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, name: `S${i}`, pp: null, isCaptain: false, portraitUrl: null, mutatorPp: 0 }));
    const e = eingabe();
    const zeilen = baueWertungsZeilen({
      ...e,
      d1: { disciplineId: "breaking", displayName: "Breaking" },
      teamResults: e.teamResults.map((r) =>
        r.teamId === "a"
          ? { ...r, d1DisciplineId: "breaking", d1Ergebnis: { art: "duell" as const, eigen: 3, gegner: 0, gegnerTeamId: "b" } }
          : r.teamId === "b"
            ? { ...r, d1DisciplineId: "breaking", d1Ergebnis: { art: "duell" as const, eigen: 0, gegner: 3, gegnerTeamId: "a" } }
            : r,
      ),
      playersByTeam: new Map([
        ["a", { d1: spieler(5), d2: [] }],
        ["b", { d1: spieler(5), d2: [] }],
      ]) as never,
    });
    const a = zeilen.find((z) => z.teamId === "a")!;
    // a hat 3 Ueberlebende von 5, b keinen: a besiegte 5 Gegner, b besiegte 2.
    expect(a.d1.anzeige?.nativ).toBe("5 : 2");
    expect(a.d1.anzeige?.diff).toBe("+3");
    const b = zeilen.find((z) => z.teamId === "b")!;
    expect(b.d1.anzeige?.nativ).toBe("2 : 5");
    // Ohne Einsatzlisten: keine erfundene Zahl.
    const ohne = baueWertungsZeilen({ ...e, d1: { disciplineId: "breaking", displayName: "Breaking" } });
    expect(ohne.find((z) => z.teamId === "a")!.d1.anzeige?.nativ ?? null).toBeNull();
  });
});

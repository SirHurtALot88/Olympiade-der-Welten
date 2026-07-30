import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DisciplineStageMatchdayPanel from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";

/**
 * "In den Disziplin-Zeilen (D1 · D2) stehen keine Zahlen — Punkte, Form, Mutator und
 * Gesamt fehlen komplett, obwohl die Spieler-Chips derselben Zeile klare PP zeigen."
 *
 * Die Zeile rendert IMMER Text; leer kann eine Zelle gar nicht sein. Was sie tat, war
 * schlimmer: Fand die Zuordnung ueber `d1DisciplineId`/`d2DisciplineId` kein Ergebnis
 * — oder fehlte das Team in `teamResults` ganz —, dann machte `d1Pts ?? 0` daraus eine
 * erfundene NULL. Die Zeile behauptete "0 Punkte · 0 Form · kein Mutator · 0 gesamt"
 * neben Chips mit echten PP. Genau dieser Widerspruch ist der gemeldete Bug: die Zahlen
 * sagen nichts aus, obwohl sie dastehen.
 *
 * Jetzt ist unbekannt gleich unbekannt ("–"). Die Trennung bleibt dreifach:
 *   • verdeckt        → gar keine Zeile (Spoiler-Schutz),
 *   • kein Ergebnis   → "–",
 *   • null Punkte     → "0".
 */

type Case = {
  teamResults?: unknown;
  d1?: unknown;
};

function render(over: Case) {
  return renderToString(
    React.createElement(DisciplineStageMatchdayPanel as never, {
      teamResults: [
        { teamId: "t1", d1DisciplineId: "ispy", d1Points: 6.6, d2DisciplineId: "basket", d2Points: 4.4, totalPoints: 11 },
      ],
      standings: [
        { teamId: "t1", currentRank: 1, projectedRank: 1, currentPoints: 10, projectedPoints: 21, pointsDelta: 11 },
      ],
      d1: { disciplineId: "ispy", displayName: "I Spy" },
      d2: { disciplineId: "basket", displayName: "Basketball" },
      d1Revealed: true,
      d2Revealed: true,
      teamMetaById: new Map([["t1", { code: "AAA", name: "Team A", logoUrl: null }]]),
      ownTeamId: "t1",
      mutatorByTeam: new Map([["t1", { d1Pp: 0.3, d2Pp: 0, d1Players: [{ name: "P1", pp: 0.3 }], d2Players: [] }]]),
      playersByTeam: new Map([
        ["t1", { d1: [{ playerId: "p1", name: "P1", pp: 3.3, score: 88, mutatorPp: 0.3, ovrRank: null }], d2: [] }],
      ]),
      modifiersByTeam: null,
      ...over,
    }),
  );
}

/** Punkte · Form · Mutator · Gesamt einer Disziplin-Zeile aus dem SSR-HTML lesen. */
function sideValues(html: string, side: "d1" | "d2"): string[] | null {
  const start = html.indexOf(`matchday-panel-side-t1-${side}`);
  if (start < 0) return null;
  const rest = html.slice(start);
  return [5, 6, 7, 8].map((column) => {
    const match = new RegExp(`grid-column:${column}[^"]*">([^<]*)<`).exec(rest);
    return match?.[1] ?? "FEHLT";
  });
}

describe("Spieltags-Wertung: Zahlen der Disziplin-Zeile", () => {
  it("zeigt die zugeordneten Werte, wenn die Disziplin aufgedeckt ist", () => {
    expect(sideValues(render({}), "d1")).toEqual(["+6.6", "0", "◆ +0.3", "+6.9"]);
  });

  it("sagt '–' statt '0', wenn die Disziplin-Zuordnung kein Ergebnis findet", () => {
    // Der Kern des Bugs: hier stand vorher "0 · 0 · – · +0.3" — eine Zahl, die niemand
    // berechnet hat, direkt neben Chips mit echten PP.
    const html = render({
      teamResults: [
        { teamId: "t1", d1DisciplineId: "eine-andere", d1Points: 6.6, d2DisciplineId: "basket", d2Points: 4.4, totalPoints: 11 },
      ],
    });
    const values = sideValues(html, "d1");
    expect(values?.[0]).toBe("–");
    expect(values?.[3]).toBe("–");
    // Die andere Disziplin bleibt davon unberuehrt.
    expect(sideValues(html, "d2")?.[0]).toBe("+4.4");
  });

  it("sagt '–', wenn das Team in den Ergebnissen gar nicht vorkommt", () => {
    const values = sideValues(render({ teamResults: [] }), "d1");
    expect(values?.[0]).toBe("–");
    expect(values?.[3]).toBe("–");
  });

  it("unterscheidet 'kein Ergebnis' von 'null Punkte'", () => {
    // 0 Punkte sind ein Ergebnis und muessen als 0 dastehen — sonst waere die
    // Korrektur nur eine Verschiebung des Problems in die andere Richtung.
    const html = render({
      teamResults: [
        { teamId: "t1", d1DisciplineId: "ispy", d1Points: 0, d2DisciplineId: "basket", d2Points: 4.4, totalPoints: 4.4 },
      ],
    });
    expect(sideValues(html, "d1")?.[0]).toBe("0");
    // Mutator bleibt eine echte 0-Aussage: "kein Bonus geholt", nicht "unbekannt".
    expect(sideValues(html, "d1")?.[3]).toBe("+0.3");
  });

  it("verrät über eine verdeckte Disziplin weiterhin gar nichts", () => {
    // Kein "–" und keine 0: die Zeile existiert schlicht nicht.
    const html = renderToString(
      React.createElement(DisciplineStageMatchdayPanel as never, {
        teamResults: [
          { teamId: "t1", d1DisciplineId: "ispy", d1Points: 6.6, d2DisciplineId: "basket", d2Points: 4.4, totalPoints: 11 },
        ],
        standings: [
          { teamId: "t1", currentRank: 1, projectedRank: 1, currentPoints: 10, projectedPoints: 21, pointsDelta: 11 },
        ],
        d1: { disciplineId: "ispy", displayName: "I Spy" },
        d2: { disciplineId: "basket", displayName: "Basketball" },
        d1Revealed: true,
        d2Revealed: false,
        teamMetaById: new Map([["t1", { code: "AAA", name: "Team A", logoUrl: null }]]),
        ownTeamId: "t1",
        mutatorByTeam: null,
        playersByTeam: new Map([
          ["t1", { d1: [], d2: [{ playerId: "p2", name: "Geheim", pp: 2.2, score: 70, mutatorPp: null, ovrRank: 1 }] }],
        ]),
        modifiersByTeam: null,
      }),
    );
    expect(sideValues(html, "d2")).toBeNull();
    expect(html).not.toContain("Geheim");
    expect(html).not.toContain("+4.4");
  });

  it("legt die Tönung der Disziplin-Zeile über die volle Zeilenhöhe", () => {
    // Das Raster steht auf `align-items: center`; ein leeres div erbt daraus die
    // Inhaltshoehe 0. Die Toenung war deshalb nie zu sehen und die Disziplin-Zeilen
    // lasen sich als Fortsetzung der Teamzeile.
    expect(render({})).toContain("grid-column:1 / -1;grid-row:2;align-self:stretch");
  });
});

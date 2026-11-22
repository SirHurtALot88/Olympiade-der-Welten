/**
 * ANKER JE BREAKING-FORMAT (22.11., docs/design/breaking-tagteam-22-11.md): die C2- und E1-Anker und die PP-Referenz des
 * Tag-Teams sind aus dem Tag-Team-Motor abgeleitet; im alten Gauntlet-Format gebuchte Spieltage rechnen mit den alten,
 * unveraenderten Werten weiter (gezeigt = gebucht).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import { computeIndividualBoxscorePpsFromFixtureResults, resolveArenaPpsReferenz } from "@/lib/resolve/battle-mode-arena-team-points";
import { berechneDuellErgebnisE1, ergebnisSkalaAnker } from "@/lib/resolve/ergebnis-skala";
import { ppSkalaAnker } from "@/lib/resolve/pp-skala";

describe("Breaking-Anker je Format", () => {
  it("PP: 'gauntletAlt' behaelt die alten Anker (rTop 3,55 / rMed 0,79), das Tag-Team hat eigene", () => {
    const alt = ppSkalaAnker("breaking", null, "gauntletAlt")!;
    const neu = ppSkalaAnker("breaking", null)!;
    expect(alt.rTop).toBe(3.55);
    expect(alt.rMed).toBe(0.79);
    expect(neu.rTop).not.toBe(alt.rTop);
    expect(neu.rMed).not.toBe(alt.rMed);
    expect(ppSkalaAnker("tennis", 4, "gauntletAlt")).toEqual(ppSkalaAnker("tennis", 4));
  });

  it("E1: 'gauntletAlt' liefert die alten Duell-Knoten, Standard die neuen", () => {
    const alt = ergebnisSkalaAnker("breaking", "duell", null, "gauntletAlt")!;
    const neu = ergebnisSkalaAnker("breaking", "duell", null)!;
    expect(alt.knoten).toEqual([-0.875, -0.473, -0.15, 0.1, 0.23, 0.305, 0.422, 0.525, 0.657, 0.865, 1.158, 1.509, 1.669]);
    expect(neu.knoten).not.toEqual(alt.knoten);
    expect(ergebnisSkalaAnker("hockey", "duell", null, "gauntletAlt")).toEqual(ergebnisSkalaAnker("hockey", "duell", null));
  });

  it("PP-Referenz: 'alt' liest die Gauntlet-Referenz, 'neu' die Tag-Team-Referenz", () => {
    const alt = resolveArenaPpsReferenz("breaking", 4, "feld", "alt").referenz;
    const neu = resolveArenaPpsReferenz("breaking", 4, "feld", "neu").referenz;
    const gauntlet = JSON.parse(readFileSync("data/generated/breaking-pps-referenz-gauntlet.json", "utf8"));
    expect(alt.iMittel).toBe(gauntlet.feldgroessen["4"].iMittel);
    expect(neu.iMittel).toBeGreaterThan(alt.iMittel);
    // Andere Disziplinen kennen keine alte Referenz: "alt" aendert dort nichts.
    expect(resolveArenaPpsReferenz("tennis", 3, "feld", "alt").referenz).toEqual(resolveArenaPpsReferenz("tennis", 3, "feld", "neu").referenz);
  });

  it("Verdrahtung PP: ein Breaking-Eintrag eines 'alt'-Spieltags rechnet mit Gauntlet-Referenz und -Ankern", () => {
    const fx: ArenaFixtureResult[] = [
      { homeTeamId: "a", awayTeamId: "b", seiten: [4, 0], boxscore: [{ name: "S", wert: 3000, playerId: "s", side: "home" }] },
    ];
    const alt = computeIndividualBoxscorePpsFromFixtureResults(fx, 4, "breaking", "an", "alt").get("s")!;
    const neu = computeIndividualBoxscorePpsFromFixtureResults(fx, 4, "breaking", "an", "neu").get("s")!;
    expect(alt).not.toBe(neu);
  });

  it("Verdrahtung E1: Variante 'gauntletAlt' liefert das alte Duell-Ergebnis; die Resolve-Engine waehlt sie bei gestempeltem Gauntlet-Spieltag", () => {
    const eingabe = { disciplineId: "breaking", playerCount: 4, outcome: "win" as const, marge: 3, leistungEigen: 1.4, leistungGegner: 1.2, seiten: [4, 1] as [number, number] };
    const alt = berechneDuellErgebnisE1({ ...eingabe, variante: "gauntletAlt" });
    const neu = berechneDuellErgebnisE1(eingabe);
    expect(JSON.stringify(alt.bezug)).not.toBe(JSON.stringify(neu.bezug));
    const quelle = readFileSync("lib/resolve/legacy-matchday-resolve-engine.ts", "utf8");
    expect(quelle).toMatch(/disciplineId === "breaking" && breakingFormatFuer\(base\.gameState, base\.matchdayId\) === "gauntlet"\s*\?\s*"gauntletAlt"/);
  });
});

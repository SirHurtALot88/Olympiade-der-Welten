import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const hookPath = path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const panelPath = path.join(process.cwd(), "app/foundation/season-v2/FoundationSeasonV2Panel.tsx");
const newLookPath = path.join(process.cwd(), "app/foundation/season-v2/SeasonStandingsNewLook.tsx");

function readHookSource() {
  return fs.readFileSync(hookPath, "utf8");
}

/**
 * TASK #159 PUNKT 2 — Spieltage-Modus: Performance-Auflage (Opus-Review zu PR #1276, 17.10.).
 *
 * GEMESSENES PROBLEM (vor diesem Fix): `seasonV2Spieltage` baute in einem `useMemo([gameState])`
 * die VOLLE Paarungs-Übersicht (`buildSpieltagsUebersicht`, inkl. der Rückspiel-Suche über den
 * gesamten Spielplan) für ALLE 20 Spieltage auf einmal — und das Memo hängt am zentralen
 * Shell-Hook, der bei JEDER `gameState`-Änderung läuft, auch wenn der Saisonstand gar nicht
 * offen ist (Speichern, Polling-Reload, Koop-Benachrichtigung). Gegen Saisonende also bis zu
 * 20×16 Paarungen / 1280 Ergebniszeilen pro Aufruf umsonst.
 *
 * Die Zusage jetzt: `matchdayOptions`/`defaultMatchdayId` kommen aus einem billigen Index (ein
 * Durchlauf über `disciplineResults`), die teure volle Übersicht wird NIE für alle Spieltage
 * vorgebaut, sondern LAZY über `getUebersicht(matchdayId)` erst auf Abruf für GENAU EINEN
 * Spieltag geliefert — und dieser Abruf passiert nur innerhalb von SeasonStandingsNewLook.tsx,
 * das wiederum nur gemountet ist, wenn der Saisonstand-Panel aktiv ist (`FoundationSeasonV2Panel`s
 * `active`-Gate). Reiner Text-/Strukturvertrag nach dem Muster von
 * tests/transfermarkt-v2-performance-contract.test.ts — kein Component-Mounting nötig, da dieses
 * Repo keine @testing-library/react-Abhängigkeit hat.
 */
describe("Spieltage-Modus — Performance-Vertrag (Task #159 Punkt 2)", () => {
  it("baut die teure Paarungs-Uebersicht NICHT mehr fuer alle 20 Spieltage auf einmal", () => {
    const source = readHookSource();
    // Das alte, gemessene Problem: buildSpieltagsUebersicht() lief fuer jeden Spieltag innerhalb
    // der matchdayIds.map(...)-Schleife (einmal je Eintrag). Die neue Fassung ruft den Builder
    // ueberhaupt nur EINMAL im ganzen Hook auf -- innerhalb der lazy `getUebersicht`-Funktion.
    const builderCalls = source.match(/buildSpieltagsUebersicht\(gameState/g) ?? [];
    expect(builderCalls.length).toBe(1);
    expect(source).toContain("getUebersicht: (matchdayId: string) => buildSpieltagsUebersicht(gameState, matchdayId");
    // Das alte eager-gebaute Lookup-Objekt darf nicht wiederkommen.
    expect(source).not.toContain("overviewByMatchdayId");
  });

  it("die billige 'gespielt ja/nein'-Liste kommt aus einem eigenen Index, nicht aus der vollen Uebersicht", () => {
    const source = readHookSource();
    expect(source).toContain("gespieltByMatchdayId");
    expect(source).toContain("matchdayIdByResultId");
    // matchdayOptions liest NUR aus dem billigen Set, nicht aus einem paarungen-Array.
    expect(source).toContain("gespielt: gespieltByMatchdayId.has(matchdayId)");
  });

  it("der Spieltage-Builder wird nur aufgerufen, waehrend der Saisonstand ueberhaupt gemountet ist", () => {
    // FoundationSeasonV2Panel rendert SeasonStandingsV2Client (und damit SeasonStandingsNewLook)
    // erst, wenn `active` true ist -- sonst `return null` VOR jedem Kind-Render. Der einzige Ort,
    // der `getUebersicht(...)` tatsaechlich AUFRUFT, liegt in SeasonStandingsNewLook.tsx selbst.
    const panelSource = fs.readFileSync(panelPath, "utf8");
    expect(panelSource).toContain("if (!active) {\n    return null;\n  }");
    const newLookSource = fs.readFileSync(newLookPath, "utf8");
    expect(newLookSource).toContain("spieltage.getUebersicht(spieltagMatchdayId)");
    // Kein zweiter Aufrufort irgendwo sonst im UI-Baum dieser Datei.
    expect(newLookSource.match(/\.getUebersicht\(/g)?.length).toBe(1);
  });
});

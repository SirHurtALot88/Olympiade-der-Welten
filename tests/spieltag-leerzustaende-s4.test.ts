/**
 * S4 · disciplineStage-Redirect + matchdayResult-Leerzustand (Audit Spieltag A4/A5).
 *
 * A4: der Standalone-View `disciplineStage` war seit dem Arena-Umbau (S3, PR #? —
 * die Bühne rendert seither im `matchdayArena`-View) eine leere Content-Fläche ohne
 * Text, ohne Hinweis, ohne Weg zurück — eine echte Sackgasse für alte Links/Lesezeichen.
 *
 * A5: `matchdayResult` rendierte vor dem ersten gebuchten Ergebnis ein volles
 * Ergebnis-Gerüst — 32 "—"-Zeilen, "Du: — von 32" und einen ERFUNDENEN Tagessieger
 * (weil `championRow` ohne Ergebnis auf die alphabetisch erste `teamRows`-Zeile
 * zurückfiel — derselbe Alphabet-Bug wie A1/A2 in der Arena vor S3).
 *
 * Beide Stellen nutzen jetzt dieselbe Zustandserkennung wie die Arena (S3) und
 * dasselbe geteilte Primitive `VeloPendingRanking` — kein neuer Leerzustands-Look.
 * Der Test hält die Struktur-Aussagen fest UND dass jede benutzte CSS-Klasse
 * wirklich in globals.css existiert (CSS fällt still durch).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const SHELL = quelle("app/foundation/FoundationShellRouterBody.tsx");
const RESULT = quelle("app/foundation/matchday-result-v2/MatchdayResultNewLook.tsx");
const KATALOG = quelle("components/foundation/velo-ui/index.ts");
const CSS = quelle("app/globals.css");

describe("A4: disciplineStage-Redirect statt leerer Fläche", () => {
  it("die Ansicht nutzt VeloPendingRanking statt still `null` zu rendern", () => {
    expect(SHELL).toContain('activeView === "disciplineStage"');
    const start = SHELL.indexOf('activeView === "disciplineStage"');
    const block = SHELL.slice(start, start + 1200);
    expect(block).toContain("<VeloPendingRanking");
    expect(block).toContain("Diese Ansicht ist umgezogen");
  });

  it("es gibt einen echten Weg zurück (CTA in die Arena, kein toter Link)", () => {
    const start = SHELL.indexOf('activeView === "disciplineStage"');
    const block = SHELL.slice(start, start + 1200);
    expect(block).toContain('setFoundationView("matchdayArena", setActiveView, { push: true })');
    expect(block).toContain("Zur Arena");
  });

  it("beide neu benutzten Klassen sind in globals.css definiert", () => {
    expect(SHELL).toContain("foundation-discipline-stage-redirect");
    expect(CSS).toMatch(/\.foundation-discipline-stage-redirect[\s.,:{[>)]/);
  });
});

describe("A5: matchdayResult ohne gebuchtes Ergebnis behauptet keinen Tagessieger", () => {
  it("`hasResult` (aus matchdaySummary, derselben Quelle wie Arena/S3) gated den Tagessieger", () => {
    expect(RESULT).toContain("const hasResult = matchdaySummary.hasResult;");
    expect(RESULT).toContain(
      "const championRow = hasResult ? (matchdaySummary.topTeams[0] ?? boardRows[0] ?? null) : null;",
    );
  });

  it("ohne Ergebnis rendert die Tageswertung VeloPendingRanking statt der 32-Zeilen-Tabelle", () => {
    expect(RESULT).toContain("{!hasResult ? (");
    expect(RESULT).toContain('data-testid="nl-result-pending-ranking"');
    expect(RESULT).toContain("<VeloPendingRanking");
    expect(RESULT).toContain("Wertung folgt");
  });

  it("die Hero-Kacheln (D1/D2/Tagesrang/Tagespunkte) rendern nur mit Ergebnis — sonst ein Satz", () => {
    expect(RESULT).toContain("{hasResult ? (");
    expect(RESULT).toContain('data-testid="nl-result-pending-note"');
  });

  it("die neu benutzte Klasse ist beidseitig abgesichert", () => {
    expect(RESULT).toContain("nl-result-pending-note");
    expect(CSS).toMatch(/\.nl-result-pending-note[\s.,:{[>)]/);
  });
});

describe("VeloPendingRanking bleibt eine geteilte Katalog-Komponente (S3 → S4)", () => {
  it("beide Stellen importieren aus dem Katalog, keine eigene Nachbau-Komponente", () => {
    expect(SHELL).toContain('import { VeloPendingRanking } from "@/components/foundation/velo-ui"');
    expect(RESULT).toContain('import { VeloPendingRanking } from "@/components/foundation/velo-ui"');
    expect(KATALOG).toContain("VeloPendingRanking");
  });
});

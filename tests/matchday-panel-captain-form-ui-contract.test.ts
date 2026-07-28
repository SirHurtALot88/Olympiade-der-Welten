import { describe, expect, it } from "vitest";

import fs from "node:fs/promises";
import path from "node:path";

// Der Helfer alleine bringt nichts, solange ihn niemand aufruft — genau dieser Fehler
// ist in diesem Repo schon einmal passiert (Regel lag ungenutzt im Code, Verhalten
// unveraendert). Diese Tests halten die Verdrahtung fest.

async function read(relativePath: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), relativePath), "utf8");
}

describe("Captain/Form in der Spieltags-Wertung", () => {
  it("wird in der Arena aus der Resolve-Preview gebaut und durchgereicht", async () => {
    const source = await read("app/foundation/discipline-stage/DisciplineStageArena.tsx");

    expect(source).toContain("buildMatchdayTeamModifiers({");
    // Quelle muss die Preview sein — kein zweiter Rechenweg, kein Neu-Bestimmen.
    expect(source).toContain("disciplinePreviews: preview.disciplinePreviews");
    expect(source).toContain("modifiersByTeam={matchdayPanel.modifiersByTeam}");
  });

  it("rendert Captain- und Form-Chips im Panel", async () => {
    const source = await read("app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx");

    expect(source).toContain("modifiersByTeam");
    expect(source).toContain("SideModifierChips");
    expect(source).toContain("describeMatchdaySideModifiers");
  });

  it("haelt den Spoiler-Schutz fuer d2 ein", async () => {
    const source = await read("app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx");
    const block = source.slice(source.indexOf("const mods = modifiersByTeam?.get(row.teamId)"));
    const chipBlock = block.slice(0, block.indexOf("</div>"));

    // Die Aufstellung ist selbst ein Spoiler: d2-Chips erst nach Aufdeckung.
    expect(chipBlock).toContain("d1Revealed");
    expect(chipBlock).toContain("d2Revealed");
  });

  it("berechnet den Captain nicht selbst neu", async () => {
    const helper = await read("lib/foundation/matchday-team-modifiers.ts");
    // selectTeamCaptain/suggestCaptainForSide wuerden im Nachhinein etwas anderes
    // liefern koennen als das, was der Spieltag tatsaechlich angewandt hat.
    const code = helper
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
      .join("\n");
    expect(code).not.toContain("selectTeamCaptain");
    expect(code).not.toContain("suggestCaptainForSide");
    expect(code).not.toContain("calculateFormModifierForSide");
  });
});

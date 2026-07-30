import { describe, expect, it } from "vitest";

import fs from "node:fs/promises";
import path from "node:path";

// Der Spieltagsabschluss war aus dem normalen Spielverlauf schon einmal unerreichbar:
// #224 entfernte den Knopf, der Ersatz lag nur im Cockpit — man hing auf dem Spieltag
// fest. Diese Tests halten fest, dass der Weg in der Arena liegt und dort bleibt.

async function read(relativePath: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), relativePath), "utf8");
}

describe("Spieltagsabschluss ist aus der Arena erreichbar", () => {
  it("reicht den Spieltagswechsel an die Buehne durch statt ihn abzuschalten", async () => {
    const source = await read("app/foundation/FoundationShellRouterBody.tsx");
    const host = source.slice(source.indexOf("<FoundationDisciplineStageHost"));
    const props = host.slice(0, host.indexOf("/>"));

    expect(props).not.toContain("onAdvanceMatchday={null}");
    expect(props).toContain("canAdvanceMatchdayFromStep(matchdayAdvanceStep)");
    expect(props).toContain("runCockpitMatchdayAdvance");
    // Die Buchung pro Disziplin bleibt daneben bestehen.
    expect(props).toContain("onCommitDiscipline={commitArenaDiscipline}");
  });

  it("hat die Spieltagsergebnis-Sektion nicht mehr", async () => {
    const source = await read("app/foundation/FoundationShellRouterBody.tsx");
    expect(source).not.toContain('data-testid="arena-result-summary"');
    expect(source).not.toContain('className="panel arena-result-summary"');
  });

  it("rendert den Abschluss-Knopf in der Buehne", async () => {
    const source = await read("app/foundation/discipline-stage/DisciplineStageArena.tsx");
    expect(source).toContain("onAdvanceMatchday");
    expect(source).toContain("Spieltag abschließen");
  });
});

describe("Wechsel zu Disziplin 2 scrollt nach oben", () => {
  it("springt beim Weiter-Klick zurueck an die Buehne", async () => {
    const source = await read("app/foundation/discipline-stage/DisciplineStageArena.tsx");
    const handler = source.slice(source.indexOf("setDisciplineId(secondDisciplineId)"));

    // Der Knopf sitzt unter der Arena — ohne Sprung stand man in der Spieltags-Wertung.
    expect(handler.slice(0, 400)).toContain("scrollArenaIntoView()");
    expect(source).toContain('document.getElementById("foundation-matchday-arena")');
    // Fallback, falls der Container fehlt.
    expect(source).toContain("window.scrollTo({ top: 0");
  });
});

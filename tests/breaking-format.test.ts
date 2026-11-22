/**
 * BREAKING-FORMAT-REGEL JE SPIELTAG (22.11., lib/resolve/breaking-format.ts).
 *
 * Gebuchte Spieltage behalten ihr Format (gezeigt = gebucht auch in der Wiedergabe), der Schalter
 * OLY_BREAKING_FORMAT wirkt ab dem naechsten gewerteten Spieltag, die Lade-Migration ist rein und idempotent.
 */
import { afterEach, describe, expect, it } from "vitest";

import { arenaFormatByDisciplineId } from "@/lib/resolve/climbing-format";
import { breakingFormatFuer, breakingFormatSchalter, stempleBreakingFormat } from "@/lib/resolve/breaking-format";

const IDS = ["md-1", "md-2", "md-3", "md-4"];

function spielstand(gebucht: string[], breakingFormat?: unknown, gameMode = "battle") {
  return {
    scenarioMeta: { gameMode },
    season: { id: "s1", matchdayIds: IDS },
    seasonState: {
      seasonId: "s1",
      matchdayResults: gebucht.map((matchdayId) => ({ seasonId: "s1", matchdayId })),
      ...(breakingFormat !== undefined ? { breakingFormat } : {}),
    },
  } as never;
}

const alt = { schalter: process.env.OLY_BREAKING_FORMAT, browser: process.env.NEXT_PUBLIC_OLY_BREAKING_FORMAT };
afterEach(() => {
  if (alt.schalter === undefined) delete process.env.OLY_BREAKING_FORMAT;
  else process.env.OLY_BREAKING_FORMAT = alt.schalter;
  if (alt.browser === undefined) delete process.env.NEXT_PUBLIC_OLY_BREAKING_FORMAT;
  else process.env.NEXT_PUBLIC_OLY_BREAKING_FORMAT = alt.browser;
});

describe("Breaking-Format: Schalter", () => {
  it("Vorgabe ist Tag-Team; 'alt'/'aus' schaltet ab", () => {
    delete process.env.OLY_BREAKING_FORMAT;
    delete process.env.NEXT_PUBLIC_OLY_BREAKING_FORMAT;
    expect(breakingFormatSchalter()).toBe("tagteam");
    for (const w of ["gauntlet", "aus", "0", "false", "ALT"]) {
      process.env.OLY_BREAKING_FORMAT = w;
      expect(breakingFormatSchalter(), w).toBe("gauntlet");
    }
    process.env.OLY_BREAKING_FORMAT = "tagteam";
    expect(breakingFormatSchalter()).toBe("tagteam");
  });
});

describe("Breaking-Format: Stempel beim Laden", () => {
  it("neue Saison: ganze Saison Tag-Team", () => {
    delete process.env.OLY_BREAKING_FORMAT;
    const g = stempleBreakingFormat(spielstand([])) as unknown as { seasonState: { breakingFormat: unknown } };
    expect(g.seasonState.breakingFormat).toEqual({ seasonId: "s1", wechsel: [{ ab: null, format: "tagteam" }] });
    for (const id of IDS) expect(breakingFormatFuer(g as never, id)).toBe("tagteam");
  });

  it("laufende Saison ohne Stempel: gewertete Spieltage bleiben 'alt', ab dem naechsten Tag-Team", () => {
    delete process.env.OLY_BREAKING_FORMAT;
    const g = stempleBreakingFormat(spielstand(["md-1", "md-2"]));
    expect((g as unknown as { seasonState: { breakingFormat: unknown } }).seasonState.breakingFormat).toEqual({
      seasonId: "s1",
      wechsel: [{ ab: null, format: "gauntlet" }, { ab: "md-3", format: "tagteam" }],
    });
    expect(breakingFormatFuer(g, "md-1")).toBe("gauntlet");
    expect(breakingFormatFuer(g, "md-2")).toBe("gauntlet");
    expect(breakingFormatFuer(g, "md-3")).toBe("tagteam");
    expect(breakingFormatFuer(g, "md-4")).toBe("tagteam");
    // Ohne Stempel liest die Funktion denselben Stempel, den die Migration setzen wuerde.
    expect(breakingFormatFuer(spielstand(["md-1", "md-2"]), "md-2")).toBe("gauntlet");
    expect(breakingFormatFuer(spielstand(["md-1", "md-2"]), "md-3")).toBe("tagteam");
  });

  it("idempotent: ein zweites Laden aendert nichts (dasselbe Objekt)", () => {
    delete process.env.OLY_BREAKING_FORMAT;
    const g = stempleBreakingFormat(spielstand(["md-1"]));
    expect(stempleBreakingFormat(g)).toBe(g);
  });

  it("Abschalt-Schalter: ab dem naechsten Spieltag 'alt', gebuchte Tag-Team-Spieltage bleiben Tag-Team; wieder an haengt erneut an", () => {
    delete process.env.OLY_BREAKING_FORMAT;
    let g: any = stempleBreakingFormat(spielstand([]));
    // md-1 und md-2 im Tag-Team gebucht
    g = { ...g, seasonState: { ...g.seasonState, matchdayResults: [{ seasonId: "s1", matchdayId: "md-1" }, { seasonId: "s1", matchdayId: "md-2" }] } } as never;
    process.env.OLY_BREAKING_FORMAT = "gauntlet";
    g = stempleBreakingFormat(g);
    expect(breakingFormatFuer(g, "md-1")).toBe("tagteam");
    expect(breakingFormatFuer(g, "md-2")).toBe("tagteam");
    expect(breakingFormatFuer(g, "md-3")).toBe("gauntlet");
    // md-3 im Standard gebucht, dann wieder an
    g = { ...g, seasonState: { ...g.seasonState, matchdayResults: [...g.seasonState.matchdayResults, { seasonId: "s1", matchdayId: "md-3" }] } } as never;
    delete process.env.OLY_BREAKING_FORMAT;
    g = stempleBreakingFormat(g);
    expect(["md-1", "md-2", "md-3", "md-4"].map((id) => breakingFormatFuer(g, id))).toEqual(["tagteam", "tagteam", "gauntlet", "tagteam"]);
  });

  it("Schalter hin und her ohne gewerteten Spieltag dazwischen stapelt keine Wechsel", () => {
    delete process.env.OLY_BREAKING_FORMAT;
    let g = stempleBreakingFormat(spielstand(["md-1"]));
    process.env.OLY_BREAKING_FORMAT = "gauntlet";
    g = stempleBreakingFormat(g);
    delete process.env.OLY_BREAKING_FORMAT;
    g = stempleBreakingFormat(g);
    expect((g as unknown as { seasonState: { breakingFormat: { wechsel: unknown[] } } }).seasonState.breakingFormat.wechsel).toEqual([
      { ab: null, format: "gauntlet" },
      { ab: "md-2", format: "tagteam" },
    ]);
  });

  it("Stempel einer anderen Saison zaehlt nicht (Saisonwechsel beginnt neu)", () => {
    delete process.env.OLY_BREAKING_FORMAT;
    const g = stempleBreakingFormat(spielstand([], { seasonId: "s0", wechsel: [{ ab: null, format: "gauntlet" }] }));
    expect(breakingFormatFuer(g, "md-1")).toBe("tagteam");
  });

  it("Manager-Spielstaende bekommen keinen Stempel", () => {
    const g = spielstand([], undefined, "manager");
    expect(stempleBreakingFormat(g)).toBe(g);
  });

  it("Umschlag-Teil: Breaking traegt das Format, 'alle' alle vier, andere nichts", () => {
    delete process.env.OLY_BREAKING_FORMAT;
    delete process.env.OLY_HOCKEY_TORWART;
    delete process.env.OLY_BASKETBALL_PUSTE;
    delete process.env.OLY_CLIMBING_FORMAT;
    expect(arenaFormatByDisciplineId(spielstand([]), "md-1", "tennis")).toBeUndefined();
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-1", "breaking")).toEqual({ breaking: "gauntlet" });
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-2", "breaking")).toEqual({ breaking: "tagteam" });
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-2", "alle")).toEqual({ climbing: "canyon", hockey: "neu", basketball: "neu", breaking: "tagteam" });
  });
});

describe("Breaking-Format: mehrere Spieltage ohne Neuladen (Review 22.11.)", () => {
  // legacy-matchday-result-apply-service.ts schreibt den Stempel VOR dem Ergebnis fest; derselbe Ablauf in einem Prozess.
  function buche(g: any, id: string) {
    const gestempelt: any = stempleBreakingFormat(g);
    return {
      ...gestempelt,
      seasonState: {
        ...gestempelt.seasonState,
        matchdayResults: [...gestempelt.seasonState.matchdayResults, { seasonId: "s1", matchdayId: id }],
      },
    };
  }

  it("Saisonwechsel + Spieltag 1 + 2 ohne Neuladen: die gebuchten Spieltage behalten die Tag-Team", () => {
    delete process.env.OLY_BREAKING_FORMAT;
    delete process.env.NEXT_PUBLIC_OLY_BREAKING_FORMAT;
    let g: any = spielstand([]);
    const neu = breakingFormatFuer(g, "md-1");
    g = buche(g, "md-1");
    g = buche(g, "md-2");
    const geladen: any = stempleBreakingFormat(g);
    for (const id of IDS) expect(breakingFormatFuer(geladen, id)).toBe(neu);
  });

  it("ohne Festschreiben fiele ein gebuchter Spieltag auf die alte Regel zurück (Beleg)", () => {
    delete process.env.OLY_BREAKING_FORMAT;
    delete process.env.NEXT_PUBLIC_OLY_BREAKING_FORMAT;
    const neu = breakingFormatFuer(spielstand([]) as any, "md-1");
    expect(breakingFormatFuer(spielstand(["md-1", "md-2"]) as any, "md-1")).not.toBe(neu);
  });

  it("der Buchungsdienst schreibt den Breaking-Stempel fest", async () => {
    const { readFileSync } = await import("node:fs");
    const quelle = readFileSync("lib/resolve/legacy-matchday-result-apply-service.ts", "utf8");
    expect(quelle).toMatch(/stempleBreakingFormat\(stempleBasketballPuste\(stempleHockeyTorwart\(stempleClimbingFormat\(stempleBattlefieldFormat\(/);
  });
});

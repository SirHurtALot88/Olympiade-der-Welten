/**
 * CLIMBING-FORMAT JE SPIELTAG (neue Regel live, 18.11., lib/resolve/hockey-torwart.ts).
 *
 * Gebuchte Spieltage behalten ihr Format (gezeigt = gebucht auch in der Wiedergabe), der Schalter
 * OLY_HOCKEY_TORWART wirkt ab dem naechsten gewerteten Spieltag, die Lade-Migration ist rein und idempotent.
 */
import { afterEach, describe, expect, it } from "vitest";

import { arenaFormatByDisciplineId } from "@/lib/resolve/climbing-format";
import { hockeyTorwartFuer, hockeyTorwartSchalter, stempleHockeyTorwart } from "@/lib/resolve/hockey-torwart";

const IDS = ["md-1", "md-2", "md-3", "md-4"];

function spielstand(gebucht: string[], hockeyTorwart?: unknown, gameMode = "battle") {
  return {
    scenarioMeta: { gameMode },
    season: { id: "s1", matchdayIds: IDS },
    seasonState: {
      seasonId: "s1",
      matchdayResults: gebucht.map((matchdayId) => ({ seasonId: "s1", matchdayId })),
      ...(hockeyTorwart !== undefined ? { hockeyTorwart } : {}),
    },
  } as never;
}

const alt = { schalter: process.env.OLY_HOCKEY_TORWART, browser: process.env.NEXT_PUBLIC_OLY_HOCKEY_TORWART };
afterEach(() => {
  if (alt.schalter === undefined) delete process.env.OLY_HOCKEY_TORWART;
  else process.env.OLY_HOCKEY_TORWART = alt.schalter;
  if (alt.browser === undefined) delete process.env.NEXT_PUBLIC_OLY_HOCKEY_TORWART;
  else process.env.NEXT_PUBLIC_OLY_HOCKEY_TORWART = alt.browser;
});

describe("Hockey-Torwart: Schalter", () => {
  it("Vorgabe ist neue Regel; 'alt'/'aus' schaltet ab", () => {
    delete process.env.OLY_HOCKEY_TORWART;
    delete process.env.NEXT_PUBLIC_OLY_HOCKEY_TORWART;
    expect(hockeyTorwartSchalter()).toBe("neu");
    for (const w of ["alt", "aus", "0", "false", "ALT"]) {
      process.env.OLY_HOCKEY_TORWART = w;
      expect(hockeyTorwartSchalter(), w).toBe("alt");
    }
    process.env.OLY_HOCKEY_TORWART = "neu";
    expect(hockeyTorwartSchalter()).toBe("neu");
  });
});

describe("Hockey-Torwart: Stempel beim Laden", () => {
  it("neue Saison: ganze Saison neue Regel", () => {
    delete process.env.OLY_HOCKEY_TORWART;
    const g = stempleHockeyTorwart(spielstand([])) as unknown as { seasonState: { hockeyTorwart: unknown } };
    expect(g.seasonState.hockeyTorwart).toEqual({ seasonId: "s1", wechsel: [{ ab: null, format: "neu" }] });
    for (const id of IDS) expect(hockeyTorwartFuer(g as never, id)).toBe("neu");
  });

  it("laufende Saison ohne Stempel: gewertete Spieltage bleiben 'alt', ab dem naechsten neue Regel", () => {
    delete process.env.OLY_HOCKEY_TORWART;
    const g = stempleHockeyTorwart(spielstand(["md-1", "md-2"]));
    expect((g as unknown as { seasonState: { hockeyTorwart: unknown } }).seasonState.hockeyTorwart).toEqual({
      seasonId: "s1",
      wechsel: [{ ab: null, format: "alt" }, { ab: "md-3", format: "neu" }],
    });
    expect(hockeyTorwartFuer(g, "md-1")).toBe("alt");
    expect(hockeyTorwartFuer(g, "md-2")).toBe("alt");
    expect(hockeyTorwartFuer(g, "md-3")).toBe("neu");
    expect(hockeyTorwartFuer(g, "md-4")).toBe("neu");
    // Ohne Stempel liest die Funktion denselben Stempel, den die Migration setzen wuerde.
    expect(hockeyTorwartFuer(spielstand(["md-1", "md-2"]), "md-2")).toBe("alt");
    expect(hockeyTorwartFuer(spielstand(["md-1", "md-2"]), "md-3")).toBe("neu");
  });

  it("idempotent: ein zweites Laden aendert nichts (dasselbe Objekt)", () => {
    delete process.env.OLY_HOCKEY_TORWART;
    const g = stempleHockeyTorwart(spielstand(["md-1"]));
    expect(stempleHockeyTorwart(g)).toBe(g);
  });

  it("Abschalt-Schalter: ab dem naechsten Spieltag 'alt', gebuchte neue Regel-Spieltage bleiben neue Regel; wieder an haengt erneut an", () => {
    delete process.env.OLY_HOCKEY_TORWART;
    let g = stempleHockeyTorwart(spielstand([]));
    // md-1 und md-2 im neue Regel gebucht
    g = { ...g, seasonState: { ...(g as never as { seasonState: object }).seasonState, matchdayResults: [{ seasonId: "s1", matchdayId: "md-1" }, { seasonId: "s1", matchdayId: "md-2" }] } } as never;
    process.env.OLY_HOCKEY_TORWART = "alt";
    g = stempleHockeyTorwart(g);
    expect(hockeyTorwartFuer(g, "md-1")).toBe("neu");
    expect(hockeyTorwartFuer(g, "md-2")).toBe("neu");
    expect(hockeyTorwartFuer(g, "md-3")).toBe("alt");
    // md-3 im Standard gebucht, dann wieder an
    g = { ...g, seasonState: { ...(g as never as { seasonState: { matchdayResults: object[] } }).seasonState, matchdayResults: [...(g as never as { seasonState: { matchdayResults: object[] } }).seasonState.matchdayResults, { seasonId: "s1", matchdayId: "md-3" }] } } as never;
    delete process.env.OLY_HOCKEY_TORWART;
    g = stempleHockeyTorwart(g);
    expect(["md-1", "md-2", "md-3", "md-4"].map((id) => hockeyTorwartFuer(g, id))).toEqual(["neu", "neu", "alt", "neu"]);
  });

  it("Schalter hin und her ohne gewerteten Spieltag dazwischen stapelt keine Wechsel", () => {
    delete process.env.OLY_HOCKEY_TORWART;
    let g = stempleHockeyTorwart(spielstand(["md-1"]));
    process.env.OLY_HOCKEY_TORWART = "alt";
    g = stempleHockeyTorwart(g);
    delete process.env.OLY_HOCKEY_TORWART;
    g = stempleHockeyTorwart(g);
    expect((g as unknown as { seasonState: { hockeyTorwart: { wechsel: unknown[] } } }).seasonState.hockeyTorwart.wechsel).toEqual([
      { ab: null, format: "alt" },
      { ab: "md-2", format: "neu" },
    ]);
  });

  it("Stempel einer anderen Saison zaehlt nicht (Saisonwechsel beginnt neu)", () => {
    delete process.env.OLY_HOCKEY_TORWART;
    const g = stempleHockeyTorwart(spielstand([], { seasonId: "s0", wechsel: [{ ab: null, format: "alt" }] }));
    expect(hockeyTorwartFuer(g, "md-1")).toBe("neu");
  });

  it("Manager-Spielstaende bekommen keinen Stempel", () => {
    const g = spielstand([], undefined, "manager");
    expect(stempleHockeyTorwart(g)).toBe(g);
  });

  it("Umschlag-Teil: Hockey traegt die Torwart-Regel, 'alle' beide, andere nichts", () => {
    delete process.env.OLY_HOCKEY_TORWART;
    delete process.env.OLY_CLIMBING_FORMAT;
    expect(arenaFormatByDisciplineId(spielstand([]), "md-1", "tennis")).toBeUndefined();
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-1", "hockey")).toEqual({ hockey: "alt" });
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-2", "hockey")).toEqual({ hockey: "neu" });
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-2", "alle")).toEqual({ climbing: "canyon", hockey: "neu", basketball: "neu", breaking: "tagteam" });
  });
});

describe("Hockey-Torwart: mehrere Spieltage ohne Neuladen (Review 22.11.)", () => {
  // legacy-matchday-result-apply-service.ts schreibt den Stempel VOR dem Ergebnis fest; derselbe Ablauf in einem Prozess.
  function buche(g: any, id: string) {
    const gestempelt: any = stempleHockeyTorwart(g);
    return {
      ...gestempelt,
      seasonState: {
        ...gestempelt.seasonState,
        matchdayResults: [...gestempelt.seasonState.matchdayResults, { seasonId: "s1", matchdayId: id }],
      },
    };
  }

  it("Saisonwechsel + Spieltag 1 + 2 ohne Neuladen: die gebuchten Spieltage behalten die neue Regel", () => {
    delete process.env.OLY_HOCKEY_TORWART;
    delete process.env.NEXT_PUBLIC_OLY_HOCKEY_TORWART;
    let g: any = spielstand([]);
    const neu = hockeyTorwartFuer(g, "md-1");
    g = buche(g, "md-1");
    g = buche(g, "md-2");
    const geladen: any = stempleHockeyTorwart(g);
    for (const id of IDS) expect(hockeyTorwartFuer(geladen, id)).toBe(neu);
  });

  it("ohne Festschreiben fiele ein gebuchter Spieltag auf die alte Regel zurück (Beleg)", () => {
    delete process.env.OLY_HOCKEY_TORWART;
    delete process.env.NEXT_PUBLIC_OLY_HOCKEY_TORWART;
    const neu = hockeyTorwartFuer(spielstand([]) as any, "md-1");
    expect(hockeyTorwartFuer(spielstand(["md-1", "md-2"]) as any, "md-1")).not.toBe(neu);
  });

  it("der Buchungsdienst schreibt den Hockey-Stempel fest", async () => {
    const { readFileSync } = await import("node:fs");
    const quelle = readFileSync("lib/resolve/legacy-matchday-result-apply-service.ts", "utf8");
    expect(quelle).toMatch(/stempleHockeyTorwart\(stempleClimbingFormat\(stempleBattlefieldFormat\(/);
  });
});

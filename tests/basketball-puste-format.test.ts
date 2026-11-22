/**
 * BASKETBALL-PUSTE-REGEL JE SPIELTAG (22.11., lib/resolve/basketball-puste.ts).
 *
 * Gebuchte Spieltage behalten ihr Format (gezeigt = gebucht auch in der Wiedergabe), der Schalter
 * OLY_BASKETBALL_PUSTE wirkt ab dem naechsten gewerteten Spieltag, die Lade-Migration ist rein und idempotent.
 */
import { afterEach, describe, expect, it } from "vitest";

import { arenaFormatByDisciplineId } from "@/lib/resolve/climbing-format";
import { basketballPusteFuer, basketballPusteSchalter, stempleBasketballPuste } from "@/lib/resolve/basketball-puste";

const IDS = ["md-1", "md-2", "md-3", "md-4"];

function spielstand(gebucht: string[], basketballPuste?: unknown, gameMode = "battle") {
  return {
    scenarioMeta: { gameMode },
    season: { id: "s1", matchdayIds: IDS },
    seasonState: {
      seasonId: "s1",
      matchdayResults: gebucht.map((matchdayId) => ({ seasonId: "s1", matchdayId })),
      ...(basketballPuste !== undefined ? { basketballPuste } : {}),
    },
  } as never;
}

const alt = { schalter: process.env.OLY_BASKETBALL_PUSTE, browser: process.env.NEXT_PUBLIC_OLY_BASKETBALL_PUSTE };
afterEach(() => {
  if (alt.schalter === undefined) delete process.env.OLY_BASKETBALL_PUSTE;
  else process.env.OLY_BASKETBALL_PUSTE = alt.schalter;
  if (alt.browser === undefined) delete process.env.NEXT_PUBLIC_OLY_BASKETBALL_PUSTE;
  else process.env.NEXT_PUBLIC_OLY_BASKETBALL_PUSTE = alt.browser;
});

describe("Basketball-Puste: Schalter", () => {
  it("Vorgabe ist neue Regel; 'alt'/'aus' schaltet ab", () => {
    delete process.env.OLY_BASKETBALL_PUSTE;
    delete process.env.NEXT_PUBLIC_OLY_BASKETBALL_PUSTE;
    expect(basketballPusteSchalter()).toBe("neu");
    for (const w of ["alt", "aus", "0", "false", "ALT"]) {
      process.env.OLY_BASKETBALL_PUSTE = w;
      expect(basketballPusteSchalter(), w).toBe("alt");
    }
    process.env.OLY_BASKETBALL_PUSTE = "neu";
    expect(basketballPusteSchalter()).toBe("neu");
  });
});

describe("Basketball-Puste: Stempel beim Laden", () => {
  it("neue Saison: ganze Saison neue Regel", () => {
    delete process.env.OLY_BASKETBALL_PUSTE;
    const g = stempleBasketballPuste(spielstand([])) as unknown as { seasonState: { basketballPuste: unknown } };
    expect(g.seasonState.basketballPuste).toEqual({ seasonId: "s1", wechsel: [{ ab: null, format: "neu" }] });
    for (const id of IDS) expect(basketballPusteFuer(g as never, id)).toBe("neu");
  });

  it("laufende Saison ohne Stempel: gewertete Spieltage bleiben 'alt', ab dem naechsten neue Regel", () => {
    delete process.env.OLY_BASKETBALL_PUSTE;
    const g = stempleBasketballPuste(spielstand(["md-1", "md-2"]));
    expect((g as unknown as { seasonState: { basketballPuste: unknown } }).seasonState.basketballPuste).toEqual({
      seasonId: "s1",
      wechsel: [{ ab: null, format: "alt" }, { ab: "md-3", format: "neu" }],
    });
    expect(basketballPusteFuer(g, "md-1")).toBe("alt");
    expect(basketballPusteFuer(g, "md-2")).toBe("alt");
    expect(basketballPusteFuer(g, "md-3")).toBe("neu");
    expect(basketballPusteFuer(g, "md-4")).toBe("neu");
    // Ohne Stempel liest die Funktion denselben Stempel, den die Migration setzen wuerde.
    expect(basketballPusteFuer(spielstand(["md-1", "md-2"]), "md-2")).toBe("alt");
    expect(basketballPusteFuer(spielstand(["md-1", "md-2"]), "md-3")).toBe("neu");
  });

  it("idempotent: ein zweites Laden aendert nichts (dasselbe Objekt)", () => {
    delete process.env.OLY_BASKETBALL_PUSTE;
    const g = stempleBasketballPuste(spielstand(["md-1"]));
    expect(stempleBasketballPuste(g)).toBe(g);
  });

  it("Abschalt-Schalter: ab dem naechsten Spieltag 'alt', gebuchte neue Regel-Spieltage bleiben neue Regel; wieder an haengt erneut an", () => {
    delete process.env.OLY_BASKETBALL_PUSTE;
    let g = stempleBasketballPuste(spielstand([]));
    // md-1 und md-2 im neue Regel gebucht
    g = { ...g, seasonState: { ...(g as never as { seasonState: object }).seasonState, matchdayResults: [{ seasonId: "s1", matchdayId: "md-1" }, { seasonId: "s1", matchdayId: "md-2" }] } } as never;
    process.env.OLY_BASKETBALL_PUSTE = "alt";
    g = stempleBasketballPuste(g);
    expect(basketballPusteFuer(g, "md-1")).toBe("neu");
    expect(basketballPusteFuer(g, "md-2")).toBe("neu");
    expect(basketballPusteFuer(g, "md-3")).toBe("alt");
    // md-3 im Standard gebucht, dann wieder an
    g = { ...g, seasonState: { ...(g as never as { seasonState: { matchdayResults: object[] } }).seasonState, matchdayResults: [...(g as never as { seasonState: { matchdayResults: object[] } }).seasonState.matchdayResults, { seasonId: "s1", matchdayId: "md-3" }] } } as never;
    delete process.env.OLY_BASKETBALL_PUSTE;
    g = stempleBasketballPuste(g);
    expect(["md-1", "md-2", "md-3", "md-4"].map((id) => basketballPusteFuer(g, id))).toEqual(["neu", "neu", "alt", "neu"]);
  });

  it("Schalter hin und her ohne gewerteten Spieltag dazwischen stapelt keine Wechsel", () => {
    delete process.env.OLY_BASKETBALL_PUSTE;
    let g = stempleBasketballPuste(spielstand(["md-1"]));
    process.env.OLY_BASKETBALL_PUSTE = "alt";
    g = stempleBasketballPuste(g);
    delete process.env.OLY_BASKETBALL_PUSTE;
    g = stempleBasketballPuste(g);
    expect((g as unknown as { seasonState: { basketballPuste: { wechsel: unknown[] } } }).seasonState.basketballPuste.wechsel).toEqual([
      { ab: null, format: "alt" },
      { ab: "md-2", format: "neu" },
    ]);
  });

  it("Stempel einer anderen Saison zaehlt nicht (Saisonwechsel beginnt neu)", () => {
    delete process.env.OLY_BASKETBALL_PUSTE;
    const g = stempleBasketballPuste(spielstand([], { seasonId: "s0", wechsel: [{ ab: null, format: "alt" }] }));
    expect(basketballPusteFuer(g, "md-1")).toBe("neu");
  });

  it("Manager-Spielstaende bekommen keinen Stempel", () => {
    const g = spielstand([], undefined, "manager");
    expect(stempleBasketballPuste(g)).toBe(g);
  });

  it("Umschlag-Teil: Basketball traegt die Puste-Regel, 'alle' alle drei, andere nichts", () => {
    delete process.env.OLY_BASKETBALL_PUSTE;
    delete process.env.OLY_HOCKEY_TORWART;
    delete process.env.OLY_CLIMBING_FORMAT;
    expect(arenaFormatByDisciplineId(spielstand([]), "md-1", "tennis")).toBeUndefined();
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-1", "basketball")).toEqual({ basketball: "alt" });
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-2", "basketball")).toEqual({ basketball: "neu" });
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-2", "alle")).toEqual({ climbing: "canyon", hockey: "neu", basketball: "neu", breaking: "tagteam" });
  });
});

describe("Basketball-Puste: mehrere Spieltage ohne Neuladen (Review 22.11.)", () => {
  // legacy-matchday-result-apply-service.ts schreibt den Stempel VOR dem Ergebnis fest; derselbe Ablauf in einem Prozess.
  function buche(g: any, id: string) {
    const gestempelt: any = stempleBasketballPuste(g);
    return {
      ...gestempelt,
      seasonState: {
        ...gestempelt.seasonState,
        matchdayResults: [...gestempelt.seasonState.matchdayResults, { seasonId: "s1", matchdayId: id }],
      },
    };
  }

  it("Saisonwechsel + Spieltag 1 + 2 ohne Neuladen: die gebuchten Spieltage behalten die neue Regel", () => {
    delete process.env.OLY_BASKETBALL_PUSTE;
    delete process.env.NEXT_PUBLIC_OLY_BASKETBALL_PUSTE;
    let g: any = spielstand([]);
    const neu = basketballPusteFuer(g, "md-1");
    g = buche(g, "md-1");
    g = buche(g, "md-2");
    const geladen: any = stempleBasketballPuste(g);
    for (const id of IDS) expect(basketballPusteFuer(geladen, id)).toBe(neu);
  });

  it("ohne Festschreiben fiele ein gebuchter Spieltag auf die alte Regel zurück (Beleg)", () => {
    delete process.env.OLY_BASKETBALL_PUSTE;
    delete process.env.NEXT_PUBLIC_OLY_BASKETBALL_PUSTE;
    const neu = basketballPusteFuer(spielstand([]) as any, "md-1");
    expect(basketballPusteFuer(spielstand(["md-1", "md-2"]) as any, "md-1")).not.toBe(neu);
  });

  it("der Buchungsdienst schreibt den Basketball-Stempel fest", async () => {
    const { readFileSync } = await import("node:fs");
    const quelle = readFileSync("lib/resolve/legacy-matchday-result-apply-service.ts", "utf8");
    expect(quelle).toMatch(/stempleBasketballPuste\(stempleHockeyTorwart\(stempleClimbingFormat\(stempleBattlefieldFormat\(/);
  });
});

/**
 * CLIMBING-FORMAT JE SPIELTAG (Canyon live, 18.11., lib/resolve/climbing-format.ts).
 *
 * Gebuchte Spieltage behalten ihr Format (gezeigt = gebucht auch in der Wiedergabe), der Schalter
 * OLY_CLIMBING_FORMAT wirkt ab dem naechsten gewerteten Spieltag, die Lade-Migration ist rein und idempotent.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  arenaFormatByDisciplineId,
  climbingFormatFuer,
  climbingFormatSchalter,
  stempleClimbingFormat,
} from "@/lib/resolve/climbing-format";

const IDS = ["md-1", "md-2", "md-3", "md-4"];

function spielstand(gebucht: string[], climbingFormat?: unknown, gameMode = "battle") {
  return {
    scenarioMeta: { gameMode },
    season: { id: "s1", matchdayIds: IDS },
    seasonState: {
      seasonId: "s1",
      matchdayResults: gebucht.map((matchdayId) => ({ seasonId: "s1", matchdayId })),
      ...(climbingFormat !== undefined ? { climbingFormat } : {}),
    },
  } as never;
}

const alt = { schalter: process.env.OLY_CLIMBING_FORMAT, browser: process.env.NEXT_PUBLIC_OLY_CLIMBING_FORMAT };
afterEach(() => {
  if (alt.schalter === undefined) delete process.env.OLY_CLIMBING_FORMAT;
  else process.env.OLY_CLIMBING_FORMAT = alt.schalter;
  if (alt.browser === undefined) delete process.env.NEXT_PUBLIC_OLY_CLIMBING_FORMAT;
  else process.env.NEXT_PUBLIC_OLY_CLIMBING_FORMAT = alt.browser;
});

describe("Climbing-Format: Schalter", () => {
  it("Vorgabe ist Canyon; 'standard'/'aus' schaltet ab", () => {
    delete process.env.OLY_CLIMBING_FORMAT;
    delete process.env.NEXT_PUBLIC_OLY_CLIMBING_FORMAT;
    expect(climbingFormatSchalter()).toBe("canyon");
    for (const w of ["standard", "aus", "0", "false", "STANDARD"]) {
      process.env.OLY_CLIMBING_FORMAT = w;
      expect(climbingFormatSchalter(), w).toBe("standard");
    }
    process.env.OLY_CLIMBING_FORMAT = "canyon";
    expect(climbingFormatSchalter()).toBe("canyon");
  });
});

describe("Climbing-Format: Stempel beim Laden", () => {
  it("neue Saison: ganze Saison Canyon", () => {
    delete process.env.OLY_CLIMBING_FORMAT;
    const g = stempleClimbingFormat(spielstand([])) as unknown as { seasonState: { climbingFormat: unknown } };
    expect(g.seasonState.climbingFormat).toEqual({ seasonId: "s1", wechsel: [{ ab: null, format: "canyon" }] });
    for (const id of IDS) expect(climbingFormatFuer(g as never, id)).toBe("canyon");
  });

  it("laufende Saison ohne Stempel: gewertete Spieltage bleiben 'standard', ab dem naechsten Canyon", () => {
    delete process.env.OLY_CLIMBING_FORMAT;
    const g = stempleClimbingFormat(spielstand(["md-1", "md-2"]));
    expect((g as unknown as { seasonState: { climbingFormat: unknown } }).seasonState.climbingFormat).toEqual({
      seasonId: "s1",
      wechsel: [{ ab: null, format: "standard" }, { ab: "md-3", format: "canyon" }],
    });
    expect(climbingFormatFuer(g, "md-1")).toBe("standard");
    expect(climbingFormatFuer(g, "md-2")).toBe("standard");
    expect(climbingFormatFuer(g, "md-3")).toBe("canyon");
    expect(climbingFormatFuer(g, "md-4")).toBe("canyon");
    // Ohne Stempel liest die Funktion denselben Stempel, den die Migration setzen wuerde.
    expect(climbingFormatFuer(spielstand(["md-1", "md-2"]), "md-2")).toBe("standard");
    expect(climbingFormatFuer(spielstand(["md-1", "md-2"]), "md-3")).toBe("canyon");
  });

  it("idempotent: ein zweites Laden aendert nichts (dasselbe Objekt)", () => {
    delete process.env.OLY_CLIMBING_FORMAT;
    const g = stempleClimbingFormat(spielstand(["md-1"]));
    expect(stempleClimbingFormat(g)).toBe(g);
  });

  it("Abschalt-Schalter: ab dem naechsten Spieltag 'standard', gebuchte Canyon-Spieltage bleiben Canyon; wieder an haengt erneut an", () => {
    delete process.env.OLY_CLIMBING_FORMAT;
    let g = stempleClimbingFormat(spielstand([]));
    // md-1 und md-2 im Canyon gebucht
    g = { ...g, seasonState: { ...(g as never as { seasonState: object }).seasonState, matchdayResults: [{ seasonId: "s1", matchdayId: "md-1" }, { seasonId: "s1", matchdayId: "md-2" }] } } as never;
    process.env.OLY_CLIMBING_FORMAT = "standard";
    g = stempleClimbingFormat(g);
    expect(climbingFormatFuer(g, "md-1")).toBe("canyon");
    expect(climbingFormatFuer(g, "md-2")).toBe("canyon");
    expect(climbingFormatFuer(g, "md-3")).toBe("standard");
    // md-3 im Standard gebucht, dann wieder an
    g = { ...g, seasonState: { ...(g as never as { seasonState: { matchdayResults: object[] } }).seasonState, matchdayResults: [...(g as never as { seasonState: { matchdayResults: object[] } }).seasonState.matchdayResults, { seasonId: "s1", matchdayId: "md-3" }] } } as never;
    delete process.env.OLY_CLIMBING_FORMAT;
    g = stempleClimbingFormat(g);
    expect(["md-1", "md-2", "md-3", "md-4"].map((id) => climbingFormatFuer(g, id))).toEqual(["canyon", "canyon", "standard", "canyon"]);
  });

  it("Schalter hin und her ohne gewerteten Spieltag dazwischen stapelt keine Wechsel", () => {
    delete process.env.OLY_CLIMBING_FORMAT;
    let g = stempleClimbingFormat(spielstand(["md-1"]));
    process.env.OLY_CLIMBING_FORMAT = "standard";
    g = stempleClimbingFormat(g);
    delete process.env.OLY_CLIMBING_FORMAT;
    g = stempleClimbingFormat(g);
    expect((g as unknown as { seasonState: { climbingFormat: { wechsel: unknown[] } } }).seasonState.climbingFormat.wechsel).toEqual([
      { ab: null, format: "standard" },
      { ab: "md-2", format: "canyon" },
    ]);
  });

  it("Stempel einer anderen Saison zaehlt nicht (Saisonwechsel beginnt neu)", () => {
    delete process.env.OLY_CLIMBING_FORMAT;
    const g = stempleClimbingFormat(spielstand([], { seasonId: "s0", wechsel: [{ ab: null, format: "standard" }] }));
    expect(climbingFormatFuer(g, "md-1")).toBe("canyon");
  });

  it("Manager-Spielstaende bekommen keinen Stempel", () => {
    const g = spielstand([], undefined, "manager");
    expect(stempleClimbingFormat(g)).toBe(g);
  });

  it("Umschlag-Teil nur fuer Climbing", () => {
    delete process.env.OLY_CLIMBING_FORMAT;
    expect(arenaFormatByDisciplineId(spielstand([]), "md-1", "tennis")).toBeUndefined();
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-1", "climbing")).toEqual({ climbing: "standard" });
    expect(arenaFormatByDisciplineId(spielstand(["md-1"]), "md-2", "climbing")).toEqual({ climbing: "canyon" });
  });
});

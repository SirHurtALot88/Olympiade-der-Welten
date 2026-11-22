/**
 * BATTLEFIELD-FORMAT JE SPIELTAG (Fuenf Punkte live, 22.11., lib/resolve/battlefield-format.ts).
 *
 * Gebuchte Spieltage behalten ihr Format (gezeigt = gebucht auch in der Wiedergabe), der Schalter
 * OLY_BATTLEFIELD_FORMAT wirkt ab dem naechsten gewerteten Spieltag, die Lade-Migration ist rein und idempotent.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  battlefieldFormatFuer,
  battlefieldFormatSchalter,
  stempleBattlefieldFormat,
} from "@/lib/resolve/battlefield-format";
import { battlefieldPodFormatOption } from "@/lib/battle/arena-resolved-disciplines";

const IDS = ["md-1", "md-2", "md-3", "md-4"];

function spielstand(gebucht: string[], battlefieldFormat?: unknown, gameMode = "battle") {
  return {
    scenarioMeta: { gameMode },
    season: { id: "s1", matchdayIds: IDS },
    seasonState: {
      seasonId: "s1",
      matchdayResults: gebucht.map((matchdayId) => ({ seasonId: "s1", matchdayId })),
      ...(battlefieldFormat !== undefined ? { battlefieldFormat } : {}),
    },
  } as never;
}

const alt = { schalter: process.env.OLY_BATTLEFIELD_FORMAT, browser: process.env.NEXT_PUBLIC_OLY_BATTLEFIELD_FORMAT };
afterEach(() => {
  if (alt.schalter === undefined) delete process.env.OLY_BATTLEFIELD_FORMAT;
  else process.env.OLY_BATTLEFIELD_FORMAT = alt.schalter;
  if (alt.browser === undefined) delete process.env.NEXT_PUBLIC_OLY_BATTLEFIELD_FORMAT;
  else process.env.NEXT_PUBLIC_OLY_BATTLEFIELD_FORMAT = alt.browser;
});

describe("Climbing-Format: Schalter", () => {
  it("Vorgabe ist domination5; 'orte3'/'alt' schaltet ab", () => {
    delete process.env.OLY_BATTLEFIELD_FORMAT;
    delete process.env.NEXT_PUBLIC_OLY_BATTLEFIELD_FORMAT;
    expect(battlefieldFormatSchalter()).toBe("domination5");
    for (const w of ["orte3", "alt", "aus", "0", "false", "ALT"]) {
      process.env.OLY_BATTLEFIELD_FORMAT = w;
      expect(battlefieldFormatSchalter(), w).toBe("orte3");
    }
    process.env.OLY_BATTLEFIELD_FORMAT = "domination5";
    expect(battlefieldFormatSchalter()).toBe("domination5");
  });
});

describe("Climbing-Format: Stempel beim Laden", () => {
  it("neue Saison: ganze Saison Fuenf Punkte", () => {
    delete process.env.OLY_BATTLEFIELD_FORMAT;
    const g = stempleBattlefieldFormat(spielstand([])) as unknown as { seasonState: { battlefieldFormat: unknown } };
    expect(g.seasonState.battlefieldFormat).toEqual({ seasonId: "s1", wechsel: [{ ab: null, format: "domination5" }] });
    for (const id of IDS) expect(battlefieldFormatFuer(g as never, id)).toBe("domination5");
  });

  it("laufende Saison ohne Stempel: gewertete Spieltage bleiben 'orte3', ab dem naechsten Fuenf Punkte", () => {
    delete process.env.OLY_BATTLEFIELD_FORMAT;
    const g = stempleBattlefieldFormat(spielstand(["md-1", "md-2"]));
    expect((g as unknown as { seasonState: { battlefieldFormat: unknown } }).seasonState.battlefieldFormat).toEqual({
      seasonId: "s1",
      wechsel: [{ ab: null, format: "orte3" }, { ab: "md-3", format: "domination5" }],
    });
    expect(battlefieldFormatFuer(g, "md-1")).toBe("orte3");
    expect(battlefieldFormatFuer(g, "md-2")).toBe("orte3");
    expect(battlefieldFormatFuer(g, "md-3")).toBe("domination5");
    expect(battlefieldFormatFuer(g, "md-4")).toBe("domination5");
    // Ohne Stempel liest die Funktion denselben Stempel, den die Migration setzen wuerde.
    expect(battlefieldFormatFuer(spielstand(["md-1", "md-2"]), "md-2")).toBe("orte3");
    expect(battlefieldFormatFuer(spielstand(["md-1", "md-2"]), "md-3")).toBe("domination5");
  });

  it("idempotent: ein zweites Laden aendert nichts (dasselbe Objekt)", () => {
    delete process.env.OLY_BATTLEFIELD_FORMAT;
    const g = stempleBattlefieldFormat(spielstand(["md-1"]));
    expect(stempleBattlefieldFormat(g)).toBe(g);
  });

  it("Abschalt-Schalter: ab dem naechsten Spieltag 'orte3', gebuchte Fuenf Punkte-Spieltage bleiben Fuenf Punkte; wieder an haengt erneut an", () => {
    delete process.env.OLY_BATTLEFIELD_FORMAT;
    let g = stempleBattlefieldFormat(spielstand([]));
    // md-1 und md-2 im Fuenf Punkte gebucht
    g = { ...g, seasonState: { ...(g as never as { seasonState: object }).seasonState, matchdayResults: [{ seasonId: "s1", matchdayId: "md-1" }, { seasonId: "s1", matchdayId: "md-2" }] } } as never;
    process.env.OLY_BATTLEFIELD_FORMAT = "orte3";
    g = stempleBattlefieldFormat(g);
    expect(battlefieldFormatFuer(g, "md-1")).toBe("domination5");
    expect(battlefieldFormatFuer(g, "md-2")).toBe("domination5");
    expect(battlefieldFormatFuer(g, "md-3")).toBe("orte3");
    // md-3 im Standard gebucht, dann wieder an
    g = { ...g, seasonState: { ...(g as never as { seasonState: { matchdayResults: object[] } }).seasonState, matchdayResults: [...(g as never as { seasonState: { matchdayResults: object[] } }).seasonState.matchdayResults, { seasonId: "s1", matchdayId: "md-3" }] } } as never;
    delete process.env.OLY_BATTLEFIELD_FORMAT;
    g = stempleBattlefieldFormat(g);
    expect(["md-1", "md-2", "md-3", "md-4"].map((id) => battlefieldFormatFuer(g, id))).toEqual(["domination5", "domination5", "orte3", "domination5"]);
  });

  it("Schalter hin und her ohne gewerteten Spieltag dazwischen stapelt keine Wechsel", () => {
    delete process.env.OLY_BATTLEFIELD_FORMAT;
    let g = stempleBattlefieldFormat(spielstand(["md-1"]));
    process.env.OLY_BATTLEFIELD_FORMAT = "orte3";
    g = stempleBattlefieldFormat(g);
    delete process.env.OLY_BATTLEFIELD_FORMAT;
    g = stempleBattlefieldFormat(g);
    expect((g as unknown as { seasonState: { battlefieldFormat: { wechsel: unknown[] } } }).seasonState.battlefieldFormat.wechsel).toEqual([
      { ab: null, format: "orte3" },
      { ab: "md-2", format: "domination5" },
    ]);
  });

  it("Stempel einer anderen Saison zaehlt nicht (Saisonwechsel beginnt neu)", () => {
    delete process.env.OLY_BATTLEFIELD_FORMAT;
    const g = stempleBattlefieldFormat(spielstand([], { seasonId: "s0", wechsel: [{ ab: null, format: "orte3" }] }));
    expect(battlefieldFormatFuer(g, "md-1")).toBe("domination5");
  });

  it("Manager-Spielstaende bekommen keinen Stempel", () => {
    const g = spielstand([], undefined, "manager");
    expect(stempleBattlefieldFormat(g)).toBe(g);
  });

  it("Optionen fuer den Motor sind immer ausdruecklich (Buchung = Anzeige, nie die Motor-Vorgabe)", () => {
    delete process.env.OLY_BATTLEFIELD_FORMAT;
    expect(battlefieldPodFormatOption(battlefieldFormatFuer(spielstand(["md-1"]), "md-1"))).toEqual({ format: "orte3" });
    expect(battlefieldPodFormatOption(battlefieldFormatFuer(spielstand(["md-1"]), "md-2"))).toEqual({ format: "domination5" });
  });
});

describe("Battlefield-Referenz je Format", () => {
  it("Fuenf Punkte und Gefecht je Ort haben je eine eigene Referenz; ohne Format gilt der Standard", async () => {
    const { resolveBattlefieldPodMargeReferenz, resolveBattlefieldPodSpielerPpReferenz } = await import("@/lib/resolve/mini-dm-pod-resolve");
    for (const k of [2, 3, 4, 5, 6]) {
      const neu = resolveBattlefieldPodMargeReferenz(k);
      const alt = resolveBattlefieldPodMargeReferenz(k, "orte3");
      expect(neu).toEqual(resolveBattlefieldPodMargeReferenz(k, "domination5"));
      expect(neu!.m90).toBeGreaterThan(0);
      expect(alt!.m90).toBeGreaterThan(0);
      expect(resolveBattlefieldPodSpielerPpReferenz(k)!.p995).not.toBe(resolveBattlefieldPodSpielerPpReferenz(k, "orte3")!.p995);
    }
    // k=2: 78 (fuenf Punkte) gegen 104 (Gefecht je Ort)
    expect(resolveBattlefieldPodMargeReferenz(2)!.m90).not.toBe(resolveBattlefieldPodMargeReferenz(2, "orte3")!.m90);
  });
});

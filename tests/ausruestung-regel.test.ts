/**
 * AUSRUESTUNGS-REGEL JE SPIELTAG (22.11., lib/ausruestung/ausruestung-regel.ts). Dasselbe Muster wie tests/breaking-format.test.ts.
 *
 * Gebuchte Spieltage behalten ihre Stufe, der Schalter OLY_AUSRUESTUNG wirkt ab dem naechsten gewerteten Spieltag, die Notbremse
 * sofort, die Lade-Migration ist rein und idempotent, der Manager-Modus bekommt keine Ausruestung.
 */
import { describe, expect, it } from "vitest";

import {
  ausruestungBesitzAktiv,
  ausruestungNotbremse,
  ausruestungRegelFuer,
  ausruestungRegelFuerNeueSaison,
  ausruestungRegelStempelNachLaden,
  ausruestungSchalter,
  regelAusSchalter,
  stempleAusruestungRegel,
} from "@/lib/ausruestung/ausruestung-regel";

const IDS = ["md-1", "md-2", "md-3", "md-4"];

function spielstand(gebucht: string[], ausruestungRegel?: unknown, gameMode = "battle") {
  return {
    scenarioMeta: { gameMode },
    season: { id: "s1", matchdayIds: IDS },
    seasonState: {
      seasonId: "s1",
      matchdayResults: gebucht.map((matchdayId) => ({ seasonId: "s1", matchdayId })),
      ...(ausruestungRegel !== undefined ? { ausruestungRegel } : {}),
    },
  } as never;
}

const AN = regelAusSchalter("besitz");
const AUS = regelAusSchalter("aus");

describe("Ausruestungs-Regel: Schalter", () => {
  it("Vorgabe ist Besitz; aus/0/false/off schalten ab; Phase-2-Werte wirken in Phase 1a wie Besitz (Wirkung bleibt keine)", () => {
    expect(ausruestungSchalter({})).toBe("besitz");
    for (const w of ["aus", "0", "false", "OFF", "nein", "aus-sofort"]) expect(ausruestungSchalter({ OLY_AUSRUESTUNG: w }), w).toBe("aus");
    for (const w of ["attribute", "schmiede", "effekte"]) {
      expect(ausruestungSchalter({ OLY_AUSRUESTUNG: w }), w).toBe(w);
      // Phase 1a beruehrt die Wertung nicht: jede Stufe liefert Wirkung "keine".
      expect(regelAusSchalter(ausruestungSchalter({ OLY_AUSRUESTUNG: w }))).toEqual({ besitz: true, wirkung: "keine", schmiede: 0, effekte: "aus" });
    }
    expect(AUS).toEqual({ besitz: false, wirkung: "keine", schmiede: 0, effekte: "aus" });
  });

  it("Notbremse nur bei aus-sofort", () => {
    expect(ausruestungNotbremse({ OLY_AUSRUESTUNG: "aus-sofort" })).toBe(true);
    expect(ausruestungNotbremse({ OLY_AUSRUESTUNG: "aus" })).toBe(false);
    expect(ausruestungNotbremse({})).toBe(false);
  });
});

describe("Ausruestungs-Regel: Stempel beim Laden", () => {
  it("neue Saison: ganze Saison Besitz", () => {
    const g = stempleAusruestungRegel(spielstand([])) as unknown as { seasonState: { ausruestungRegel: unknown } };
    expect(g.seasonState.ausruestungRegel).toEqual({ seasonId: "s1", wechsel: [{ ab: null, ...AN }] });
    for (const id of IDS) expect(ausruestungRegelFuer(g as never, id, {})).toEqual(AN);
  });

  it("laufende Saison ohne Stempel: gewertete Spieltage bleiben aus, ab dem naechsten Besitz", () => {
    const g = stempleAusruestungRegel(spielstand(["md-1", "md-2"]));
    expect((g as unknown as { seasonState: { ausruestungRegel: unknown } }).seasonState.ausruestungRegel).toEqual({
      seasonId: "s1",
      wechsel: [{ ab: null, ...AUS }, { ab: "md-3", ...AN }],
    });
    expect(ausruestungRegelFuer(g as never, "md-1", {})).toEqual(AUS);
    expect(ausruestungRegelFuer(g as never, "md-2", {})).toEqual(AUS);
    expect(ausruestungRegelFuer(g as never, "md-3", {})).toEqual(AN);
    expect(ausruestungRegelFuer(g as never, "md-4", {})).toEqual(AN);
  });

  it("der Schalter 'aus' wirkt ab dem naechsten gewerteten Spieltag; gebuchte Spieltage behalten ihre Stufe", () => {
    const stempel = { seasonId: "s1", wechsel: [{ ab: null, ...AN }] };
    const g = ausruestungRegelStempelNachLaden(spielstand(["md-1", "md-2"], stempel), "aus");
    expect(g).toEqual({ seasonId: "s1", wechsel: [{ ab: null, ...AN }, { ab: "md-3", ...AUS }] });
    const gs = spielstand(["md-1", "md-2"], g);
    expect(ausruestungRegelFuer(gs, "md-2", {})).toEqual(AN);
    expect(ausruestungRegelFuer(gs, "md-3", {})).toEqual(AUS);
  });

  it("ohne gewerteten Spieltag wird der letzte Wechsel ersetzt statt gestapelt", () => {
    const stempel = { seasonId: "s1", wechsel: [{ ab: null, ...AN }] };
    expect(ausruestungRegelStempelNachLaden(spielstand([], stempel), "aus")).toEqual({ seasonId: "s1", wechsel: [{ ab: null, ...AUS }] });
  });

  it("rein und idempotent: ein zweiter Lauf liefert dasselbe Objekt", () => {
    const einmal = stempleAusruestungRegel(spielstand(["md-1"]));
    expect(stempleAusruestungRegel(einmal)).toBe(einmal);
  });

  it("ein Stempel einer anderen Saison zaehlt nicht; die neue Saison bekommt ihren eigenen", () => {
    const alt = { seasonId: "s0", wechsel: [{ ab: null, ...AUS }] };
    const g = stempleAusruestungRegel(spielstand([], alt)) as unknown as { seasonState: { ausruestungRegel: { seasonId: string } } };
    expect(g.seasonState.ausruestungRegel.seasonId).toBe("s1");
    expect(ausruestungRegelFuerNeueSaison({ scenarioMeta: { gameMode: "battle" } }, "s2")).toEqual({ seasonId: "s2", wechsel: [{ ab: null, ...AN }] });
  });

  it("Manager-Modus: kein Stempel, immer aus", () => {
    const m = spielstand([], undefined, "manager");
    expect(stempleAusruestungRegel(m)).toBe(m);
    expect(ausruestungRegelFuer(m, "md-1", {})).toEqual(AUS);
    expect(ausruestungRegelFuerNeueSaison({ scenarioMeta: { gameMode: "manager" } }, "s2")).toBeNull();
  });

  it("Notbremse: aus fuer jeden Spieltag, auch mit Stempel", () => {
    const g = stempleAusruestungRegel(spielstand([]));
    expect(ausruestungRegelFuer(g, "md-1", { OLY_AUSRUESTUNG: "aus-sofort" })).toEqual(AUS);
    expect(ausruestungBesitzAktiv(g, {})).toBe(true);
    expect(ausruestungBesitzAktiv(g, { OLY_AUSRUESTUNG: "aus-sofort" })).toBe(false);
  });
});

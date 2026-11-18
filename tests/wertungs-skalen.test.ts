import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { ppSkalaModus } from "@/lib/resolve/pp-skala";
import {
  ergebnisSkalaVersionFuer,
  ppSkalaVersionFuer,
  stempleWertungsSkalen,
  stempleWertungsSkalenBeimAnlegen,
  wertungsSkalenFuerNeueSaison,
} from "@/lib/resolve/wertungs-skalen";

// WERTUNGSSKALEN JE SAISON (lib/resolve/wertungs-skalen.ts): die Skala haengt am Spielstand, nicht am Serverstart.
const mitStempel = (seasonId: string, stempel?: { seasonId: string; pp: "alt" | "c2"; ergebnis: "alt" | "e1" }) =>
  ({ season: { id: seasonId }, seasonState: { seasonId, ...(stempel ? { wertungsSkalen: stempel } : {}) } }) as unknown as GameState;

describe("Wertungsskalen je Saison", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("neue Saisons bekommen standardmaessig C2 und E1", () => {
    vi.stubEnv("OLY_PP_SKALA", "");
    vi.stubEnv("NEXT_PUBLIC_OLY_PP_SKALA", "");
    vi.stubEnv("OLY_ERGEBNIS_SKALA", "");
    vi.stubEnv("NEXT_PUBLIC_OLY_ERGEBNIS_SKALA", "");
    expect(wertungsSkalenFuerNeueSaison("season-2")).toEqual({ seasonId: "season-2", pp: "c2", ergebnis: "e1" });
  });

  it("Rueckweg-Schalter: aus -> neue Saisons alt", () => {
    vi.stubEnv("OLY_PP_SKALA", "aus");
    vi.stubEnv("OLY_ERGEBNIS_SKALA", "aus");
    expect(wertungsSkalenFuerNeueSaison("season-3")).toEqual({ seasonId: "season-3", pp: "alt", ergebnis: "alt" });
  });

  it("bestehender Save ohne Stempel rechnet seine laufende Saison alt zu Ende", () => {
    vi.stubEnv("OLY_PP_SKALA", "");
    vi.stubEnv("OLY_ERGEBNIS_SKALA", "");
    const alt = mitStempel("season-4");
    expect(ppSkalaVersionFuer(alt)).toBe("alt");
    expect(ergebnisSkalaVersionFuer(alt)).toBe("alt");
    expect(ppSkalaModus(alt)).toBe("aus");
  });

  it("ein Stempel einer anderen Saison zaehlt nicht", () => {
    const fremd = mitStempel("season-5", { seasonId: "season-4", pp: "c2", ergebnis: "e1" });
    expect(ppSkalaVersionFuer(fremd)).toBe("alt");
    expect(ergebnisSkalaVersionFuer(fremd)).toBe("alt");
  });

  it("gestempelte Saison rechnet wie gestempelt, auch wenn der Schalter inzwischen aus steht", () => {
    const neu = mitStempel("season-6", { seasonId: "season-6", pp: "c2", ergebnis: "e1" });
    vi.stubEnv("OLY_PP_SKALA", "aus");
    vi.stubEnv("OLY_ERGEBNIS_SKALA", "aus");
    expect(ppSkalaModus(neu)).toBe("an");
    expect(ergebnisSkalaVersionFuer(neu)).toBe("e1");
  });

  it("Notbremse aus-sofort und Messmodus roh stehen ueber dem Stempel", () => {
    const neu = mitStempel("season-7", { seasonId: "season-7", pp: "c2", ergebnis: "e1" });
    vi.stubEnv("OLY_PP_SKALA", "aus-sofort");
    vi.stubEnv("OLY_ERGEBNIS_SKALA", "aus-sofort");
    expect(ppSkalaModus(neu)).toBe("aus");
    expect(ergebnisSkalaVersionFuer(neu)).toBe("alt");
    vi.stubEnv("OLY_PP_SKALA", "roh");
    expect(ppSkalaModus(neu)).toBe("roh");
    expect(ppSkalaModus(mitStempel("season-7"))).toBe("roh");
  });

  it("Stempeln: beim Anlegen idempotent, beim Saisonwechsel neu", () => {
    vi.stubEnv("OLY_PP_SKALA", "");
    vi.stubEnv("OLY_ERGEBNIS_SKALA", "");
    const angelegt = stempleWertungsSkalenBeimAnlegen(mitStempel("season-1"));
    expect(angelegt.seasonState.wertungsSkalen).toEqual({ seasonId: "season-1", pp: "c2", ergebnis: "e1" });
    vi.stubEnv("OLY_PP_SKALA", "aus");
    expect(stempleWertungsSkalenBeimAnlegen(angelegt)).toBe(angelegt);
    const naechste = stempleWertungsSkalen({ ...angelegt.seasonState, seasonId: "season-2" });
    expect(naechste.wertungsSkalen).toEqual({ seasonId: "season-2", pp: "alt", ergebnis: "e1" });
  });
});

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildFixtureResultLabel } from "@/lib/foundation/battle-arena/arena-live-panels";
import { beschreibeGebuchtesArenaErgebnis } from "@/lib/foundation/battle-arena/arena-spieltag-ansicht";
import { baueSpieltagsDisziplinen } from "@/lib/lineups/nach-dem-spieltag";
import { ppSkalaUmrechnung } from "@/lib/resolve/pp-skala";
import {
  ppSkalaVersionFuer,
  stempleWertungsSkalenBeimAnlegen,
  wertungsSkalenFuerSpielmodus,
} from "@/lib/resolve/wertungs-skalen";

// Review-Nachtraege 18.11. zu PR #1609 (docs/design/pp-skala-18-11.md Abschnitt 8.5).
const spiel = (modus: "battle" | "manager", stempel?: Record<string, unknown>, matchdayIds?: string[]) =>
  ({
    scenarioMeta: { gameMode: modus },
    season: { id: "s1", matchdayIds },
    seasonState: { seasonId: "s1", ...(stempel ? { wertungsSkalen: stempel } : {}) },
  }) as unknown as GameState;

describe("M1: Schalter erreichen den Container", () => {
  const compose = readFileSync("deploy/hetzner/docker-compose.yml", "utf8");
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const envBeispiel = readFileSync("deploy/hetzner/.env.example", "utf8");

  it("compose reicht beide Server-Schalter durch, leer = Standard", () => {
    expect(compose).toMatch(/^\s+OLY_PP_SKALA: \$\{OLY_PP_SKALA:-\}$/m);
    expect(compose).toMatch(/^\s+OLY_ERGEBNIS_SKALA: \$\{OLY_ERGEBNIS_SKALA:-\}$/m);
  });
  it("compose gibt die NEXT_PUBLIC-Schalter als Build-Argument mit, Dockerfile nimmt sie als ARG/ENV", () => {
    expect(compose).toMatch(/NEXT_PUBLIC_OLY_PP_SKALA: \$\{NEXT_PUBLIC_OLY_PP_SKALA:-\$\{OLY_PP_SKALA:-\}\}/);
    expect(compose).toMatch(/NEXT_PUBLIC_OLY_ERGEBNIS_SKALA: /);
    expect(dockerfile).toMatch(/ARG NEXT_PUBLIC_OLY_PP_SKALA=""/);
    expect(dockerfile).toMatch(/ENV NEXT_PUBLIC_OLY_PP_SKALA=\$NEXT_PUBLIC_OLY_PP_SKALA/);
  });
  it(".env.example nennt beide Schalter leer", () => {
    expect(envBeispiel).toMatch(/^OLY_PP_SKALA=$/m);
    expect(envBeispiel).toMatch(/^OLY_ERGEBNIS_SKALA=$/m);
  });
});

describe("N1: nur Battle-Saves", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("Stempel beim Anlegen: Battle ja, Manager nein", () => {
    expect(stempleWertungsSkalenBeimAnlegen(spiel("battle")).seasonState.wertungsSkalen?.pp).toBe("c2");
    expect(stempleWertungsSkalenBeimAnlegen(spiel("manager")).seasonState.wertungsSkalen).toBeUndefined();
  });
  it("Stempel beim Saisonwechsel: Manager keiner", () => {
    expect(wertungsSkalenFuerSpielmodus(spiel("manager"), "s2")).toBeUndefined();
    expect(wertungsSkalenFuerSpielmodus(spiel("battle"), "s2")).toMatchObject({ seasonId: "s2", pp: "c2", ergebnis: "e1" });
  });
  it("Umrechnung: Battle mit Stempel skaliert, Manager und gemischte Saison (ppAb) nicht", () => {
    const stempel = { seasonId: "s1", pp: "c2", ergebnis: "e1" };
    const u = ppSkalaUmrechnung(spiel("battle", stempel));
    expect(u.einsatz !== 1 || u.spielerSaison !== 1 || u.teamSaison !== 1).toBe(true);
    expect(ppSkalaUmrechnung(spiel("manager", stempel))).toEqual({ einsatz: 1, spielerSaison: 1, teamSaison: 1 });
    expect(ppSkalaUmrechnung(spiel("battle", { ...stempel, ergebnis: "alt", ppAb: "m2" }, ["m1", "m2"]))).toEqual({
      einsatz: 1,
      spielerSaison: 1,
      teamSaison: 1,
    });
  });
});

describe("N2: ppAb nicht aufloesbar", () => {
  it("ohne Spieltagsliste oder mit unbekannter ID rechnet der Spieltag alt", () => {
    const stempel = { seasonId: "s1", pp: "c2", ergebnis: "alt", ppAb: "m2" };
    expect(ppSkalaVersionFuer(spiel("battle", stempel), "m3")).toBe("alt");
    expect(ppSkalaVersionFuer(spiel("battle", stempel, ["m1", "m2", "m3"]), "unbekannt")).toBe("alt");
    expect(ppSkalaVersionFuer(spiel("battle", stempel, ["m1", "m2", "m3"]), "m1")).toBe("alt");
    expect(ppSkalaVersionFuer(spiel("battle", stempel, ["m1", "m2", "m3"]), "m3")).toBe("c2");
  });
});

describe("N3: E1 nur mit C2", () => {
  it("die Engine koppelt E1 an die C2-Skala der Zeile", () => {
    const quelle = readFileSync("lib/resolve/legacy-matchday-resolve-engine.ts", "utf8");
    expect(quelle).toMatch(/isBattleModeArenaEligible && ppSkalaFuerDieseSaison === "an" && ergebnisSkalaVersionFuer\(base\.gameState\) === "e1"/);
  });
});

describe("Info: Anzeige der laufenden (alten) Saison bleibt wie vor E1", () => {
  const zeile = (teamId: string, extra: Record<string, unknown> = {}) => ({
    id: `z-${teamId}`,
    matchdayResultId: "mr1",
    disciplineId: "climbing",
    disciplineSide: "A",
    teamId,
    opponentTeamId: teamId === "T1" ? "T2" : "T1",
    rank: 1,
    teamPoints: teamId === "T1" ? 2 : 0,
    duellSeiten: teamId === "T1" ? [10, 0] : [0, 10],
    ergebnisNormiert: teamId === "T1" ? [2, 0] : [0, 2],
    ...extra,
  });
  const stand = (extra: Record<string, unknown>) =>
    ({
      teams: [],
      disciplines: [],
      season: { id: "s1" },
      seasonState: {
        seasonId: "s1",
        matchdayResults: [{ id: "mr1", seasonId: "s1", matchdayId: "m1", status: "preview_applied" }],
        disciplineResults: [zeile("T1", extra), zeile("T2", extra)],
      },
    }) as unknown as GameState;

  it("Nach dem Spieltag: ohne ergebnisSkala nur die native Zahl, mit e1 native Zahl und Skala", () => {
    expect(baueSpieltagsDisziplinen(stand({}), "T1", "m1")[0].detail).toBe("10 : 0");
    expect(baueSpieltagsDisziplinen(stand({ ergebnisSkala: "e1" }), "T1", "m1")[0].detail).toBe("10 : 0 → 2 : 0");
  });

  it("Gebuchte Arena-Zeile: ohne ergebnisSkala nur native Zahl, Pod ohne Wert", () => {
    const eigen = zeile("T1") as never;
    const gegner = zeile("T2") as never;
    const alt = beschreibeGebuchtesArenaErgebnis({ art: "duell", eigeneZeile: eigen, gegnerZeile: gegner }, (id) => id);
    expect(alt.text).toBe("Sieg gegen T2 10 : 0 · 2 Pkt.");
    const neu = beschreibeGebuchtesArenaErgebnis(
      { art: "duell", eigeneZeile: zeile("T1", { ergebnisSkala: "e1" }) as never, gegnerZeile: gegner },
      (id) => id,
    );
    expect(neu.text).toContain("→ 2 : 0");
    const pod = (extra: Record<string, unknown>) =>
      beschreibeGebuchtesArenaErgebnis(
        { art: "pod", eigeneZeile: zeile("T1", { miniDmPod: { platz: 1, wert: 7 }, ...extra }) as never, gegnerZeile: null },
        (id) => id,
      ).text;
    expect(pod({})).not.toContain("→");
    expect(pod({ ergebnisSkala: "e1" })).toContain("→ 7");
  });

  it("Arena-Paarungsliste: 0-10-Skala nur bei e1", () => {
    const paarung = (ergebnisSkala: "e1" | null) =>
      ({
        gespielt: true,
        disziplinen: [
          {
            disciplineName: "Climbing",
            gespielt: true,
            punkteHeim: 2,
            punkteGast: 0,
            ergebnisNormiert: [9, 1],
            ergebnisSkala,
            miniDmPodIdHeim: null,
            miniDmPodIdGast: null,
          },
        ],
      }) as never;
    expect(buildFixtureResultLabel(paarung(null))).toBe("Climbing 2:0");
    expect(buildFixtureResultLabel(paarung("e1"))).toBe("Climbing 9:1");
  });
});

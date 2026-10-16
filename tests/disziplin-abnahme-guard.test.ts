import { describe, expect, it } from "vitest";

import abnahme from "@/data/generated/disziplin-abnahme.json";
import {
  ARENA_ABNAHME_AUSNAHMEN,
  ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS,
  ARENA_RESOLVED_DISCIPLINE_IDS,
} from "@/lib/battle/arena-resolved-disciplines";

/**
 * PFLICHTABNAHME ALS WAECHTER (Projektaufsicht 16.10., docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md).
 *
 * CLAUDE.md: rho je Spiel > 0,80 UND Pp-Abweichung ≤ 25 (zwei Saatstroeme) — „genauso verbindlich"
 * fuer jede Disziplin. Eine Disziplin, deren Arena-Ergebnis in Battle Mode zaehlt
 * (`ARENA_RESOLVED_DISCIPLINE_IDS`), MUSS laut eingecheckter Tabelle bestehen — ausser sie steht auf
 * Chris' ausdruecklicher Ausnahmeliste. Faellt eine Neumessung durch, wird dieser Test rot, und die
 * Disziplin gehoert aus der Menge genommen: sie zahlt dann ueber die PPS-Duell-Bruecke weiter 2/1/0.
 */

type Eintrag = {
  rhoJeSpiel: number | null;
  pp: number[];
  datum: string;
  commit: string;
  rhoMessung?: { spiele?: number; befehl?: string };
  ppMessung?: { laeufe?: number; befehl?: string };
};

const TABELLE = abnahme as unknown as {
  schranken: { rhoJeSpielUeber: number; ppHoechstens: number; ppSaatstroemeMindestens: number };
  disziplinen: Record<string, Eintrag>;
};

function besteht(eintrag: Eintrag): boolean {
  const { rhoJeSpielUeber, ppHoechstens, ppSaatstroemeMindestens } = TABELLE.schranken;
  return (
    eintrag.rhoJeSpiel != null &&
    eintrag.rhoJeSpiel > rhoJeSpielUeber &&
    eintrag.pp.length >= ppSaatstroemeMindestens &&
    eintrag.pp.every((wert) => wert <= ppHoechstens)
  );
}

describe("Disziplin-Abnahmetabelle", () => {
  it("haelt die Schranken aus CLAUDE.md", () => {
    expect(TABELLE.schranken).toEqual({ rhoJeSpielUeber: 0.8, ppHoechstens: 25, ppSaatstroemeMindestens: 2 });
  });

  it("fuehrt fuer jede angeschlossene Disziplin rho, Pp, Datum, Commit und Messumfang", () => {
    for (const id of ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS) {
      const eintrag = TABELLE.disziplinen[id];
      expect(eintrag, id).toBeDefined();
      expect(eintrag!.datum, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(eintrag!.commit, id).toMatch(/^[0-9a-f]{7,40}$/);
      expect(eintrag!.rhoMessung?.spiele, id).toBeGreaterThan(0);
    }
  });
});

describe("ARENA_RESOLVED_DISCIPLINE_IDS gegen die Abnahmetabelle", () => {
  it("jede gewertete Arena-Disziplin ist angeschlossen", () => {
    for (const id of ARENA_RESOLVED_DISCIPLINE_IDS) {
      expect(ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS.has(id), id).toBe(true);
    }
  });

  it("jede gewertete Arena-Disziplin besteht rho > 0,80 UND Pp ≤ 25 — oder ist eine Chris-Ausnahme", () => {
    const verletzt: string[] = [];
    for (const id of ARENA_RESOLVED_DISCIPLINE_IDS) {
      if (ARENA_ABNAHME_AUSNAHMEN.has(id)) continue;
      const eintrag = TABELLE.disziplinen[id];
      if (!eintrag || !besteht(eintrag)) {
        verletzt.push(`${id} (rho ${eintrag?.rhoJeSpiel ?? "?"}, Pp ${eintrag?.pp.join("/") ?? "?"})`);
      }
    }
    expect(verletzt).toEqual([]);
  });

  it("die Ausnahmeliste ist klein und begruendet (aktuell nur Hockey)", () => {
    expect([...ARENA_ABNAHME_AUSNAHMEN.keys()]).toEqual(["hockey"]);
    for (const begruendung of ARENA_ABNAHME_AUSNAHMEN.values()) {
      expect(begruendung.length).toBeGreaterThan(40);
    }
  });

  it("Mini-DM ist NICHT arena-gewertet (Pod-Resolve fehlt, Abnahme nicht klar bestanden — Folge-Task)", () => {
    expect(ARENA_RESOLVED_DISCIPLINE_IDS.has("mini-dm")).toBe(false);
  });

  it("eine angeschlossene Disziplin, die besteht, aber fehlt, ist nur erlaubt, wenn die Tabelle es begruendet", () => {
    for (const id of ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS) {
      const eintrag = TABELLE.disziplinen[id]!;
      if (besteht(eintrag) && !ARENA_RESOLVED_DISCIPLINE_IDS.has(id)) {
        throw new Error(`${id} besteht laut Tabelle, ist aber nicht gewertet — Menge oder Tabelle nachziehen.`);
      }
    }
  });
});

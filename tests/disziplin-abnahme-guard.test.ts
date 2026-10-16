import { describe, expect, it } from "vitest";

import abnahme from "@/data/generated/disziplin-abnahme.json";
import {
  type AbnahmeKriterium,
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
  rhoFrisch: boolean;
  pp: number[];
  ppFrisch: boolean;
  datum: string;
  commit: string;
  rhoMessung?: { spiele?: number; befehl?: string };
  ppMessung?: { laeufe?: number; befehl?: string };
};

const TABELLE = abnahme as unknown as {
  schranken: { rhoJeSpielUeber: number; ppHoechstens: number; ppSaatstroemeMindestens: number };
  beobachtungsliste?: Record<string, string>;
  disziplinen: Record<string, Eintrag>;
};

/**
 * JE KRITERIUM (Projektaufsicht 16.10.): nur FRISCH gemessene Werte zaehlen, und eine
 * Chris-Ausnahme deckt nur die Kriterien, die sie ausdruecklich nennt — alles uebrige wird normal
 * geprueft. Liefert die verfehlten, nicht gedeckten Kriterien (leer = besteht).
 */
function verfehlteKriterien(eintrag: Eintrag, gedeckt: readonly AbnahmeKriterium[] = []): AbnahmeKriterium[] {
  const { rhoJeSpielUeber, ppHoechstens, ppSaatstroemeMindestens } = TABELLE.schranken;
  const rhoOk = eintrag.rhoFrisch && eintrag.rhoJeSpiel != null && eintrag.rhoJeSpiel > rhoJeSpielUeber;
  const ppOk =
    eintrag.ppFrisch && eintrag.pp.length >= ppSaatstroemeMindestens && eintrag.pp.every((wert) => wert <= ppHoechstens);
  const verfehlt: AbnahmeKriterium[] = [];
  if (!rhoOk && !gedeckt.includes("rho")) verfehlt.push("rho");
  if (!ppOk && !gedeckt.includes("pp")) verfehlt.push("pp");
  return verfehlt;
}

function besteht(eintrag: Eintrag): boolean {
  return verfehlteKriterien(eintrag).length === 0;
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
      expect(typeof eintrag!.rhoFrisch, id).toBe("boolean");
      expect(typeof eintrag!.ppFrisch, id).toBe("boolean");
    }
  });

  it("Breaking steht auf der Beobachtungsliste (rho 0,801 genau auf der Schranke)", () => {
    expect(Object.keys(TABELLE.beobachtungsliste ?? {})).toContain("breaking");
  });
});

describe("ARENA_RESOLVED_DISCIPLINE_IDS gegen die Abnahmetabelle", () => {
  it("jede gewertete Arena-Disziplin ist angeschlossen", () => {
    for (const id of ARENA_RESOLVED_DISCIPLINE_IDS) {
      expect(ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS.has(id), id).toBe(true);
    }
  });

  it("jede gewertete Arena-Disziplin besteht rho > 0,80 UND Pp ≤ 25 (frisch) — Ausnahmen decken nur ihr Kriterium", () => {
    const verletzt: string[] = [];
    for (const id of ARENA_RESOLVED_DISCIPLINE_IDS) {
      const eintrag = TABELLE.disziplinen[id];
      if (!eintrag) {
        verletzt.push(`${id} (kein Tabelleneintrag)`);
        continue;
      }
      const offen = verfehlteKriterien(eintrag, ARENA_ABNAHME_AUSNAHMEN.get(id)?.deckt ?? []);
      if (offen.length > 0) {
        verletzt.push(`${id}: ${offen.join("+")} (rho ${eintrag.rhoJeSpiel}${eintrag.rhoFrisch ? "" : " nicht frisch"}, Pp ${eintrag.pp.join("/")}${eintrag.ppFrisch ? "" : " nicht frisch"})`);
      }
    }
    expect(verletzt).toEqual([]);
  });

  it("die Ausnahmeliste ist klein, begruendet und je Kriterium (aktuell nur Hockey, nur rho)", () => {
    expect([...ARENA_ABNAHME_AUSNAHMEN.keys()]).toEqual(["hockey"]);
    expect(ARENA_ABNAHME_AUSNAHMEN.get("hockey")?.deckt).toEqual(["rho"]);
    for (const ausnahme of ARENA_ABNAHME_AUSNAHMEN.values()) {
      expect(ausnahme.deckt.length).toBeGreaterThan(0);
      expect(ausnahme.begruendung.length).toBeGreaterThan(40);
    }
  });

  it("Hockey ist ohne frische Pp-Messung NICHT gewertet (die Ausnahme deckt nur rho)", () => {
    const hockey = TABELLE.disziplinen.hockey!;
    expect(verfehlteKriterien(hockey, ARENA_ABNAHME_AUSNAHMEN.get("hockey")?.deckt ?? [])).toEqual(
      hockey.ppFrisch ? [] : ["pp"],
    );
    if (!hockey.ppFrisch) expect(ARENA_RESOLVED_DISCIPLINE_IDS.has("hockey")).toBe(false);
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

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
 * CLAUDE.md: rho je Spiel > 0,75 UND Pp-Abweichung ≤ 25 (zwei Saatstroeme) — „genauso verbindlich"
 * fuer jede Disziplin. Die rho-Mindestschranke steht seit 17.11. auf 0,75 (Chris, woertlich: „Rangtreue
 * auf 0,75 als min legen"; vorher 0,80). Ziel bleibt > 0,80, angestrebt 0,85 — rot wird dieser
 * Waechter aber erst unter 0,75. Eine Disziplin, deren Arena-Ergebnis in Battle Mode zaehlt
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
    expect(TABELLE.schranken).toEqual({ rhoJeSpielUeber: 0.75, ppHoechstens: 25, ppSaatstroemeMindestens: 2 });
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

  it("die Beobachtungsliste fuehrt die Disziplinen nahe der Mindestschranke 0,75 (Showcase, I-Spy, Climbing)", () => {
    // Bis 17.11. stand hier Breaking (rho 0,801 genau auf der alten 0,80-Schranke, zuletzt 0,860).
    // Mit der Mindestschranke 0,75 hat Breaking mehr Abstand als jede verbliebene Disziplin und ist
    // heruntergenommen; die drei knappsten (unter oder genau auf dem Ziel 0,80) bleiben beobachtet.
    const liste = Object.keys(TABELLE.beobachtungsliste ?? {});
    expect(liste).toEqual(expect.arrayContaining(["showcase", "i-spy", "climbing"]));
    for (const id of liste) expect(TABELLE.disziplinen[id], id).toBeDefined();
  });
});

describe("ARENA_RESOLVED_DISCIPLINE_IDS gegen die Abnahmetabelle", () => {
  it("jede gewertete Arena-Disziplin ist angeschlossen", () => {
    for (const id of ARENA_RESOLVED_DISCIPLINE_IDS) {
      expect(ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS.has(id), id).toBe(true);
    }
  });

  it("jede gewertete Arena-Disziplin besteht rho > 0,75 UND Pp ≤ 25 (frisch) — Ausnahmen decken nur ihr Kriterium", () => {
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

  it("die Ausnahmeliste ist klein, begruendet und je Kriterium (Hockey/Showcase/I-Spy, alle nur rho)", () => {
    expect([...ARENA_ABNAHME_AUSNAHMEN.keys()]).toEqual(["hockey", "showcase", "i-spy"]);
    expect(ARENA_ABNAHME_AUSNAHMEN.get("hockey")?.deckt).toEqual(["rho"]);
    expect(ARENA_ABNAHME_AUSNAHMEN.get("showcase")?.deckt).toEqual(["rho"]);
    expect(ARENA_ABNAHME_AUSNAHMEN.get("i-spy")?.deckt).toEqual(["rho"]);
    for (const ausnahme of ARENA_ABNAHME_AUSNAHMEN.values()) {
      expect(ausnahme.deckt.length).toBeGreaterThan(0);
      expect(ausnahme.begruendung.length).toBeGreaterThan(40);
    }
  });

  it("Hockey ist jetzt gewertet -- Pp besteht regulaer (richtig gepoolt gemessen), rho bleibt durch Chris' Ausnahme gedeckt (15.11.)", () => {
    // Vorgaenger-Fassung dieses Tests pinnte Hockey auf "durchgefallen" (38,5 / 81,5) -- das war
    // selbst ein Messfehler: zwei einzelne, UNGEPOOLTE n=24-Stroeme bei einem fuer Hockey
    // dokumentierten Rauschboden von 35-40 Pp je Einzelstrom (docs/design/
    // hockey-pp-messbasis-10-11.md). Richtig gemessen (zwei unabhaengige GEPOOLTE Stroeme, je drei
    // Roh-Saatstroeme a n=48) besteht Pp klar unter der Schranke. rho (0,700) bleibt auch unter der
    // seit 17.11. auf 0,75 gesenkten Mindestschranke und wird weiterhin NUR durch Chris' Ausnahme gedeckt -- deshalb hier gegen
    // das tatsaechliche Ergebnis gepinnt statt nur gegen die Frische-Flagge.
    const hockey = TABELLE.disziplinen.hockey!;
    expect(hockey.ppFrisch).toBe(true);
    expect(hockey.pp.length).toBeGreaterThanOrEqual(TABELLE.schranken.ppSaatstroemeMindestens);
    expect(hockey.pp.every((wert) => wert <= TABELLE.schranken.ppHoechstens)).toBe(true);
    expect(hockey.rhoFrisch).toBe(true);
    expect(hockey.rhoJeSpiel).toBeLessThanOrEqual(TABELLE.schranken.rhoJeSpielUeber);
    // Ohne die Ausnahme wuerde rho allein weiterhin fehlschlagen -- die Ausnahme ist nach wie vor
    // tragend, nur nicht mehr fuer Pp.
    expect(verfehlteKriterien(hockey, [])).toEqual(["rho"]);
    expect(verfehlteKriterien(hockey, ARENA_ABNAHME_AUSNAHMEN.get("hockey")?.deckt ?? [])).toEqual([]);
    expect(ARENA_RESOLVED_DISCIPLINE_IDS.has("hockey")).toBe(true);
  });

  it.each(["showcase", "i-spy"] as const)(
    "%s besteht rho seit der Mindestschranke 0,75 (17.11.) regulaer -- die rho-Ausnahme ist nicht mehr tragend",
    (id) => {
      // Kurzzeitig (PR #1481) aus ARENA_RESOLVED_DISCIPLINE_IDS genommen, weil eine frische
      // Neumessung rho unter 0,80 fand (Showcase 0,781, I-Spy 0,776, n=48). Ein A/B-Test (derselbe
      // Code, alte vs. aktuelle Kaderfamilie) zeigte reines Roster-Rauschen -- Chris gab am 15.11.
      // eine rho-Ausnahme analog Hockey frei. Seit 17.11. liegt die harte Mindestschranke bei 0,75
      // (Chris: "Rangtreue auf 0,75 als min legen"); beide bestehen damit BEIDE Kriterien ohne
      // Ausnahme. Der Eintrag in ARENA_ABNAHME_AUSNAHMEN bleibt vorerst stehen, ist aber nicht mehr
      // tragend. Beide bleiben unter dem Ziel 0,80 (Beobachtungsliste).
      const eintrag = TABELLE.disziplinen[id]!;
      expect(eintrag.ppFrisch).toBe(true);
      expect(eintrag.rhoFrisch).toBe(true);
      expect(eintrag.rhoJeSpiel).toBeGreaterThan(TABELLE.schranken.rhoJeSpielUeber);
      expect(eintrag.rhoJeSpiel).toBeLessThan(0.8);
      expect(verfehlteKriterien(eintrag, [])).toEqual([]);
      expect(ARENA_RESOLVED_DISCIPLINE_IDS.has(id)).toBe(true);
    },
  );

  it("Football ist gewertet und besteht BEIDE Kriterien OHNE Ausnahme (NFL-Motorrunde 15.11.)", () => {
    // Football war bis 15.11. nie gewertet (rho 0,525 nach fuenf verworfenen Rezeptrunden). Die
    // NFL-Motorrunde (docs/design/football-opus-review-nfl-15-11.md: Linien-Duelle, Tackling,
    // Ballsicherheit, Money Downs) hebt rho auf 0,854 bei Pp 15,3/16,0 -- regulaer bestanden. Chris
    // hatte fuer Football eine 0,75er-Mindestschranke erlaubt; sie wird NICHT gebraucht, und dieser
    // Test haelt fest, dass sich keine stille rho-/Pp-Ausnahme dazwischenschiebt.
    const football = TABELLE.disziplinen.football!;
    expect(football.rhoFrisch).toBe(true);
    expect(football.ppFrisch).toBe(true);
    expect(verfehlteKriterien(football, [])).toEqual([]);
    expect(ARENA_ABNAHME_AUSNAHMEN.has("football")).toBe(false);
    expect(ARENA_RESOLVED_DISCIPLINE_IDS.has("football")).toBe(true);
    expect(ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS.has("football")).toBe(true);
  });

  it("Mini-DM ist NICHT Teil des generischen Chassis-Sets (eigener Pod-Resolve-Pfad, eigener Schalter)", () => {
    // Mini-DM hat seit PR 4/PR 5 des 6-PR-Opus-Plans (21.10.) einen eigenen Pod-Resolve-Pfad
    // (lib/resolve/mini-dm-pod-resolve.ts, vier Teams statt eines Zweier-Duells, 2-1-0-0 statt
    // Sieg/Unentschieden/Niederlage) und einen eigenen Rollout-Schalter (MINI_DM_FFA_VORLAUF_AKTIV,
    // arena-resolved-disciplines.ts) -- es gehoert deshalb NIE in dieses generische Chassis-Set,
    // unabhaengig davon, ob die FFA-Verdrahtung an oder aus ist. Diese Pruefung bleibt bewusst
    // unveraendert bestehen, nicht weil die Frage noch offen ist, sondern weil die Antwort fuer
    // Mini-DM dauerhaft "falsches Set" lautet.
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

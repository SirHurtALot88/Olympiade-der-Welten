import { describe, expect, it } from "vitest";

import abnahme from "@/data/generated/pps-duell-bruecke-abnahme.json";

/**
 * ABNAHME DER PPS-DUELL-BRUECKE SELBST, FINALER WAECHTER (docs/design/
 * pps-duell-bruecke-punkteverhaeltnis-16-10.md Abschnitt 8, final nach vier
 * Opus-Praezisierungsrunden 17.-18.10.).
 *
 * Misst: scripts/miss-pps-duell-bruecke-abnahme.ts. Dieser Wächter liest NUR die eingecheckte,
 * frisch gemessene Ausgabe (`data/generated/pps-duell-bruecke-abnahme.json`) — er führt die
 * Simulation nicht selbst aus (die braucht ein echtes Live-Save-Abbild per
 * `OLY_APP_SQLITE_PATH`, insgesamt mehrere Stunden fuer Teil A + Teil B zusammen). Das ist dasselbe
 * Prinzip wie `tests/disziplin-abnahme-guard.test.ts` gegen `data/generated/disziplin-abnahme.json`:
 * neu messen und committen, bevor sich am Score-Kanal/den Modifikatoren etwas ändert, das die Zahl
 * bewegen könnte.
 *
 * WARUM EIN EIGENER WAECHTER, NICHT tests/disziplin-abnahme-guard.test.ts: jener prüft
 * Mitgliedschaft einzelner Disziplinen in `ARENA_RESOLVED_DISCIPLINE_IDS` — ein Kippschalter mit
 * Alternative (Arena-Ergebnis vs. Brücke). Die Brücke hat keine Alternative; sie ist der
 * unbedingte Rückfall für jede Disziplin ohne Arena-Ergebnis UND dauerhaft für mindestens fünf
 * Disziplinen (Football, I-Spy, Battlefield, TDM, Mini-DM — nie arena-angeschlossen). Dieser
 * Wächter schaltet nichts ab; er ist ein Regressions-Wächter auf den von der Brücke konsumierten
 * Kanal (ausführlicher begründet in tests/pps-duell-bruecke-score-kanal.test.ts).
 *
 * WARUM NUR FELDGROESSE 6 GEPRUEFT WIRD (rho): Spearman bei n=3/4 kennt nur wenige diskrete Werte
 * (n=3: {1,0; 0,5; -0,5; -1,0}; n=4: {1,0; 0,8; 0,6; ...}) -- ein einziger Rangtausch landet bei
 * n=4 exakt AUF der 0,80-Schranke, nie "darüber". "Über 0,80" ist dort keine zulässige Aussage
 * (Opus, Abschnitt 8.2 der Doku). Feldgröße 6 ist robust und frei von diesem Artefakt.
 *
 * WARUM DIE FIXTURE-EBENE / "ÜBER SEITEN"-PAARTREUE HIER NICHT GEPRÜFT WIRD: beide spiegeln einen
 * vorbestehenden, strukturellen Befund am legacy-PPS-Pfad (Team-Rang-Topf statt individueller
 * Liga-Relation, s. Task #176 und Abschnitt 8.2 der Doku) -- nicht die Qualität der Brücke selbst.
 * Ein Wächter darauf wäre bis zur Behebung von Task #176 dauerhaft rot oder bräuchte eine
 * willkürliche Schranke. Die "selbe Seite"-Paartreue (reiner Eignungsvergleich, ohne den
 * Team-Rang-Topf-Effekt) wird dagegen geprüft -- sie zeigt an, ob der Kanal grundsätzlich noch
 * funktioniert.
 *
 * Pp (Teil B, echte Bedingungen): eine erste Fassung dieser Messung hatte einen Baseline-Mismatch-
 * Fehler (Basiswert aus der SQLite vs. frisch neu hergeleiteter Wert verglichen), der Football
 * fälschlich auf 64,4/55,8 Pp las. Nach dem Fix (Basislinie und Anhebung über denselben Rechenweg,
 * s. tests/pps-duell-bruecke-score-kanal.test.ts) liest Football 5,9/12,5 -- kein eigenständiger
 * Befund mehr. PP_BEKANNTE_AUSNAHMEN hält nur noch Mini-DM (30,5/30,5, kleine Grundgesamtheit,
 * playerCount 1 je Seite, s. Abschnitt 8.4 der Doku).
 */

type TeilAZeile = {
  strom: number;
  spielerRhoJeFeldgroesse: Record<string, {
    median: number | null;
    n: number;
    paartreueAb15SelbeSeitePct: number | null;
    paartreueAb15SelbeSeiteN: number;
  }>;
};

type TeilBZeile = { strom: number; laeufe: number; ppAbweichung: number };

const TABELLE = abnahme as unknown as {
  teilA: Record<string, TeilAZeile[]>;
  teilB: Record<string, TeilBZeile[] | { hinweis: string }>;
};

const RHO_SCHRANKE = 0.8;
const PP_SCHRANKE = 25;
const ROBUSTE_FELDGROESSE = "6";

/** Disziplinen, deren Teil-A-rho auf Seiten-/selbe-Seite-Ebene hier strukturell nicht gemessen werden kann. */
const RHO_NICHT_MESSBAR = new Set(["mini-dm"]);

/** Begründete, benannte Ausnahmen von der Pp-Schranke -- je eine, s. Doku-Abschnitt 8.3/8.4. */
const PP_BEKANNTE_AUSNAHMEN: ReadonlyMap<string, string> = new Map([
  [
    "mini-dm",
    "Pp 30,5/30,5 -- NICHT belastbar, nicht einfach 'durchgefallen': zwei eigentlich unabhaengige " +
      "Saatstroeme liefern exakt denselben Wert, dasselbe Rotflaggen-Muster wie der fruehere " +
      "Bit-identische-Mediane-Bug (Abschnitt 8.1 Punkt 2 der Doku) -- Hinweis auf playerCount 1 " +
      "je Seite und nur 8 Ziehungen, nicht auf eine praezise Zahl. Offen bis Chris' " +
      "Pod-Format-Entscheidung (Abschnitt 8.4); Mini-DMs echte Abnahme ist bis dahin die " +
      "Event-/Pod-Messung (scripts/miss-mini-dm-ffa-abnahme.mjs, data/generated/disziplin-abnahme.json).",
  ],
]);

describe("PPS-Duell-Brücke, Teil A: rho bei Feldgröße 6 (robust, ohne Diskretisierungsartefakte)", () => {
  it("jede messbare Disziplin besteht Seiten-rho > 0,80 bei Feldgröße 6 (Median, beide Ströme)", () => {
    const verfehlte: string[] = [];
    for (const [disziplin, zeilen] of Object.entries(TABELLE.teilA)) {
      if (RHO_NICHT_MESSBAR.has(disziplin)) continue;
      for (const zeile of zeilen) {
        const v = zeile.spielerRhoJeFeldgroesse[ROBUSTE_FELDGROESSE];
        if (!v || v.median == null || v.median <= RHO_SCHRANKE) {
          verfehlte.push(`${disziplin}/Strom ${zeile.strom}: rho=${v?.median}`);
        }
      }
    }
    expect(verfehlte).toEqual([]);
  });

  it("jede messbare Disziplin hat bei Feldgröße 6 genug Team-Seiten für eine belastbare Aussage (n >= 30 je Strom)", () => {
    for (const [disziplin, zeilen] of Object.entries(TABELLE.teilA)) {
      if (RHO_NICHT_MESSBAR.has(disziplin)) continue;
      for (const zeile of zeilen) {
        const v = zeile.spielerRhoJeFeldgroesse[ROBUSTE_FELDGROESSE];
        expect(v?.n, `${disziplin}/Strom ${zeile.strom}`).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("Paartreue ab 15 Punkten DERSELBEN Seite bleibt nahe am Ideal (>=0,90) -- reiner Eignungsvergleich funktioniert", () => {
    const verfehlte: string[] = [];
    for (const [disziplin, zeilen] of Object.entries(TABELLE.teilA)) {
      if (RHO_NICHT_MESSBAR.has(disziplin)) continue;
      for (const zeile of zeilen) {
        const v = zeile.spielerRhoJeFeldgroesse[ROBUSTE_FELDGROESSE];
        if (!v || v.paartreueAb15SelbeSeitePct == null || v.paartreueAb15SelbeSeitePct < 0.9) {
          verfehlte.push(`${disziplin}/Strom ${zeile.strom}: selbeSeite=${v?.paartreueAb15SelbeSeitePct}`);
        }
      }
    }
    expect(verfehlte).toEqual([]);
  });

  it("Mini-DM bleibt auf Seiten-Ebene strukturell nicht messbar (playerCount 1 je Seite, n=0)", () => {
    for (const disziplin of RHO_NICHT_MESSBAR) {
      const zeilen = TABELLE.teilA[disziplin];
      expect(zeilen, disziplin).toBeDefined();
      for (const zeile of zeilen!) {
        const v = zeile.spielerRhoJeFeldgroesse[ROBUSTE_FELDGROESSE];
        expect(v?.n, disziplin).toBe(0);
        expect(v?.median, disziplin).toBeNull();
      }
    }
  });
});

describe("PPS-Duell-Brücke, Teil B: Pp unter echten Bedingungen (nach dem Baseline-Mismatch-Fix)", () => {
  it("jede Disziplin OHNE begründete Ausnahme besteht Pp <= 25 (beide Ströme) -- Football eingeschlossen", () => {
    const verfehlte: string[] = [];
    for (const [disziplin, eintrag] of Object.entries(TABELLE.teilB)) {
      if (PP_BEKANNTE_AUSNAHMEN.has(disziplin)) continue;
      if (!Array.isArray(eintrag)) continue; // Disziplin ohne Gewichte -- nichts zu prüfen.
      for (const zeile of eintrag) {
        if (zeile.ppAbweichung > PP_SCHRANKE) {
          verfehlte.push(`${disziplin}/Strom ${zeile.strom}: Pp=${zeile.ppAbweichung}`);
        }
      }
    }
    expect(verfehlte).toEqual([]);
  });

  it("Football ist NICHT mehr in der Ausnahmeliste (bestanden nach dem Fix)", () => {
    expect(PP_BEKANNTE_AUSNAHMEN.has("football")).toBe(false);
    const zeilen = TABELLE.teilB.football;
    expect(Array.isArray(zeilen)).toBe(true);
    for (const zeile of zeilen as TeilBZeile[]) {
      expect(zeile.ppAbweichung, `Strom ${zeile.strom}`).toBeLessThanOrEqual(PP_SCHRANKE);
    }
  });

  it("die Ausnahmeliste ist klein, begründet und wächst nicht unbemerkt (aktuell nur: Mini-DM)", () => {
    expect([...PP_BEKANNTE_AUSNAHMEN.keys()]).toEqual(["mini-dm"]);
    for (const begruendung of PP_BEKANNTE_AUSNAHMEN.values()) {
      expect(begruendung.length).toBeGreaterThan(40);
    }
  });

  it("Mini-DM liegt heute über der Schranke, aber NICHT belastbar (kein Platzhalter, aber ein unsicherer Wert)", () => {
    const zeilen = TABELLE.teilB["mini-dm"];
    expect(Array.isArray(zeilen)).toBe(true);
    for (const zeile of zeilen as TeilBZeile[]) {
      expect(zeile.ppAbweichung, `Strom ${zeile.strom}`).toBeGreaterThan(PP_SCHRANKE);
    }
  });
});

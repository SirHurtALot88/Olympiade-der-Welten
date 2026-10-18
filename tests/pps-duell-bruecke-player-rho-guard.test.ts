import { describe, expect, it } from "vitest";

import abnahme from "@/data/generated/pps-duell-bruecke-abnahme.json";

/**
 * ABNAHME DER PPS-DUELL-BRUECKE SELBST, TEIL A/B ALS WAECHTER (docs/design/
 * pps-duell-bruecke-punkteverhaeltnis-16-10.md Abschnitt 8, Projektaufsicht-Korrektur 17.10.).
 *
 * Misst: scripts/miss-pps-duell-bruecke-abnahme.ts. Dieser Wächter liest NUR die eingecheckte,
 * frisch gemessene Ausgabe (`data/generated/pps-duell-bruecke-abnahme.json`) — er führt die
 * Simulation nicht selbst aus (die braucht ein echtes Live-Save-Abbild per
 * `OLY_APP_SQLITE_PATH`, ~2h Laufzeit, s. Skript-Header). Das ist dasselbe Prinzip wie
 * `tests/disziplin-abnahme-guard.test.ts` gegen `data/generated/disziplin-abnahme.json`: neu
 * messen und committen, bevor sich am Score-Kanal/den Modifikatoren etwas ändert, das die Zahl
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
 * rho (Teil A, Spieler-Ebene): bekommt einen vollen Wächter -- besteht heute klar und stabil für
 * alle sieben messbaren Disziplinen (0,829–0,900, zwei Saatströme). Mini-DM liefert hier
 * STRUKTURELL keine Zahl (playerCount 1 je Seite, Spearman braucht n>=3 -- Abschnitt 8.4 der Doku)
 * und wird deshalb explizit als "nicht messbar", nicht als "bestanden" oder "durchgefallen",
 * geführt.
 *
 * Pp (Teil B, echte Bedingungen): KEIN blinder "<=25 für alle"-Wächter -- Football verfehlt die
 * Schranke heute klar und eigenständig (64,4/55,8, Abschnitt 8.3 der Doku), und ein Wächter, der
 * das stillschweigend akzeptiert, würde den Befund verschlucken. PPS_BEKANNTE_AUSNAHMEN hält genau
 * die zwei begründeten Sonderfälle (Football: Pp-Befund, Mini-DM: Methode nicht übertragbar) --
 * jede andere Disziplin in der Tabelle MUSS die Schranke in beiden Strömen bestehen, und die
 * Ausnahmeliste selbst wird gegen unbemerktes Wachsen geprüft (dasselbe Muster wie
 * `ARENA_ABNAHME_AUSNAHMEN`, lib/battle/arena-resolved-disciplines.ts).
 */

type TeilAZeile = {
  strom: number;
  spielerRhoMedian: number | null;
  spielerRhoSpannweite: number | null;
  spielerRhoSpiele: number;
};

type TeilBZeile = { strom: number; laeufe: number; ppAbweichung: number };

const TABELLE = abnahme as unknown as {
  teilA: Record<string, TeilAZeile[]>;
  teilB: Record<string, TeilBZeile[] | { hinweis: string }>;
};

const RHO_SCHRANKE = 0.8;
const PP_SCHRANKE = 25;

/** Disziplinen, deren Teil-A-rho hier strukturell nicht gemessen werden kann (nicht "bestanden"/"durchgefallen"). */
const RHO_NICHT_MESSBAR = new Set(["mini-dm"]);

/** Begründete, benannte Ausnahmen von der Pp-Schranke -- je eine, s. Doku-Abschnitt 8.3/8.4. */
const PP_BEKANNTE_AUSNAHMEN: ReadonlyMap<string, string> = new Map([
  [
    "football",
    "Pp 64,4/55,8 unter echten Bedingungen (Slot-Rolle/Formkarte/Mutator überdecken die Matrix bzw. " +
      "den Override) -- eigenständiger, neuer Befund am legacy-PPS-Kanal, nicht an der Brücke selbst " +
      "(docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md Abschnitt 8.3). Ungelöst; an das " +
      "Hauptprojekt weitergegeben, nicht Teil dieses Auftrags.",
  ],
  [
    "mini-dm",
    "Methode nicht übertragbar: playerCount 1 je Seite, jeder Lauf zeigte 0 messbare Änderung von " +
      "pointsAwarded (Abschnitt 8.4). Mini-DMs echte Abnahme ist die Event-/Pod-Messung " +
      "(scripts/miss-mini-dm-ffa-abnahme.mjs, data/generated/disziplin-abnahme.json).",
  ],
]);

describe("PPS-Duell-Brücke, Teil A: Spieler-rho je Disziplin (die Abnahmezahl)", () => {
  it("jede gemessene Disziplin besteht rho > 0,80 (Median, beide Ströme)", () => {
    const verfehlte: string[] = [];
    for (const [disziplin, zeilen] of Object.entries(TABELLE.teilA)) {
      if (RHO_NICHT_MESSBAR.has(disziplin)) continue;
      for (const zeile of zeilen) {
        if (zeile.spielerRhoMedian == null || zeile.spielerRhoMedian <= RHO_SCHRANKE) {
          verfehlte.push(`${disziplin}/Strom ${zeile.strom}: rho=${zeile.spielerRhoMedian}`);
        }
      }
    }
    expect(verfehlte).toEqual([]);
  });

  it("jede gemessene Disziplin hat genug Team-Seiten für eine belastbare Aussage (n >= 30 je Strom)", () => {
    for (const [disziplin, zeilen] of Object.entries(TABELLE.teilA)) {
      if (RHO_NICHT_MESSBAR.has(disziplin)) continue;
      for (const zeile of zeilen) {
        expect(zeile.spielerRhoSpiele, `${disziplin}/Strom ${zeile.strom}`).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("Mini-DM ist als 'strukturell nicht messbar' geführt, nicht als bestanden", () => {
    for (const disziplin of RHO_NICHT_MESSBAR) {
      const zeilen = TABELLE.teilA[disziplin];
      expect(zeilen, disziplin).toBeDefined();
      for (const zeile of zeilen!) {
        expect(zeile.spielerRhoSpiele, disziplin).toBe(0);
        expect(zeile.spielerRhoMedian, disziplin).toBeNull();
      }
    }
  });
});

describe("PPS-Duell-Brücke, Teil B: Pp unter echten Bedingungen", () => {
  it("jede Disziplin OHNE begründete Ausnahme besteht Pp <= 25 (beide Ströme)", () => {
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

  it("die Ausnahmeliste ist klein, begründet und wächst nicht unbemerkt (aktuell: Football, Mini-DM)", () => {
    expect([...PP_BEKANNTE_AUSNAHMEN.keys()].sort()).toEqual(["football", "mini-dm"]);
    for (const begruendung of PP_BEKANNTE_AUSNAHMEN.values()) {
      expect(begruendung.length).toBeGreaterThan(40);
    }
  });

  it("Football verfehlt die Schranke heute nachweislich (kein Platzhalter-Eintrag, sondern ein echter Befund)", () => {
    const zeilen = TABELLE.teilB.football;
    expect(Array.isArray(zeilen)).toBe(true);
    for (const zeile of zeilen as TeilBZeile[]) {
      expect(zeile.ppAbweichung, `Strom ${zeile.strom}`).toBeGreaterThan(PP_SCHRANKE);
    }
  });
});

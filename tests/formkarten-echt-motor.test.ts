/**
 * P4 — ECHTE FORMKARTEN UND INTENSITAET IM MOTOR (docs/design/formkarten-motor-p4-11-11.md).
 *
 * Haelt fest:
 *   1. Fuer eine freigeschaltete Disziplin (FORMKARTEN_ECHT_DISCIPLINE_IDS: time-trial, Pilot
 *      11.11.; spurt, Welle 1 erste Disziplin, 14.11.) traegt der Aufstellungseintrag die
 *      GESPIELTE Form (Kartenwerte, x2 bei Farbgleichheit, wie
 *      `calculateFormModifierForSide`) und die Intensitaet der Seite.
 *   2. "Plan schlaegt Entwurf" gilt auch hier (dieselbe Funktion wie die Wertung).
 *   3. Jede NICHT freigeschaltete Disziplin bekommt die Felder nicht — der Eintrag bleibt exakt
 *      `{d, slot}`, der Motor faellt auf die Ersatzkarte zurueck (bit-identisch).
 *   4. Der Motor liest die Werte an genau einer Stelle (`breitPunkteVon`) in jeder Baufunktion,
 *      die `formVon(p.n)+stufenWert()` verwendet; der alte Ausdruck steht nur noch als Rueckfall
 *      im Helfer. Beim Merge mit main (14.11.) kam `tdmKaempfer()` (TDM-Gefecht, PR #1387, nach
 *      dem Branch-Punkt dieser PR auf main gewandert) mit genau diesem alten Ausdruck dazu —
 *      ebenfalls auf `breitPunkteVon()` umgestellt, bit-identisch, da "tdm" NICHT in
 *      `FORMKARTEN_ECHT_DISCIPLINE_IDS` steht (Abschnitt 1.5 der Doku: TDM/Hockey/Football
 *      bleiben PPS-Duell-Bruecke). Deshalb acht, nicht sieben, Treffer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FORMKARTEN_ECHT_DISCIPLINE_IDS } from "@/lib/battle/formkarten-echt-disziplinen";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";

function spielstand(opts: {
  disciplineId: string;
  category: string;
  klassen?: Record<string, string>;
  modifiers?: Record<string, unknown>;
  plans?: unknown[];
}) {
  const spieler = ["a", "b"].map((id) => ({ id, name: `Name ${id}`, className: opts.klassen?.[id] }));
  return {
    players: spieler,
    rosters: spieler.map((s) => ({ id: `roster-${s.id}`, teamId: "t1", playerId: s.id })),
    disciplines: [{ id: opts.disciplineId, name: opts.disciplineId, category: opts.category }],
    seasonState: {
      formCards: [
        { id: "fc-a-pos", saveId: "s1", seasonId: "season-1", teamId: "t1", playerId: "a", playerName: "Name a", cardColor: "green", cardValue: 4, createdAt: "x" },
        { id: "fc-b-pos", saveId: "s1", seasonId: "season-1", teamId: "t1", playerId: "b", playerName: "Name b", cardColor: "yellow", cardValue: 2, createdAt: "x" },
        { id: "fc-b-neg", saveId: "s1", seasonId: "season-1", teamId: "t1", playerId: "b", playerName: "Name b", cardColor: "yellow", cardValue: -8, createdAt: "x" },
      ],
      formCardPlans: opts.plans ?? [],
      lineupDrafts: [
        {
          lineupId: "l1",
          saveId: "s1",
          seasonId: "season-1",
          matchdayId: "md-1",
          teamId: "t1",
          status: "draft",
          modifiers: opts.modifiers,
          entries: spieler.map((s, i) => ({
            disciplineId: opts.disciplineId,
            disciplineSide: "d1",
            slotIndex: i,
            playerId: s.id,
            activePlayerId: `roster-${s.id}`,
          })),
        },
      ],
    },
  } as unknown as GameState;
}

// Die Zahlen unten sind die der ALTEN Regel (x2 bei Farbgleichheit, gleich fuer alle). Seit 18.11. gilt
// standardmaessig die neue Farbregel; hier wird die alte per Schalter festgehalten (Abschalt-Pfad).
// Die neue Regel prueft der Block darunter.
describe("P4: echte Formkarte im Aufstellungs-Rohr (alte Regel, OLY_FORMKARTEN_FARBREGEL=alt)", () => {
  beforeEach(() => {
    process.env.OLY_FORMKARTEN_FARBREGEL = "alt";
  });
  afterEach(() => {
    delete process.env.OLY_FORMKARTEN_FARBREGEL;
  });

  it("Pilot time-trial ist freigeschaltet", () => {
    expect(FORMKARTEN_ECHT_DISCIPLINE_IDS.has("time-trial")).toBe(true);
  });

  it("Welle 1, erste Disziplin spurt ist freigeschaltet (14.11.)", () => {
    expect(FORMKARTEN_ECHT_DISCIPLINE_IDS.has("spurt")).toBe(true);
  });

  it("spurt: gespielte Karten (+4 farbgleich x2, +2) und Push landen bei JEDEM Spieler der Seite", () => {
    const a = buildArenaAufstellung(
      spielstand({
        disciplineId: "spurt",
        category: "speed",
        modifiers: { d1: { primaryFormCardId: "fc-a-pos", secondaryFormCardId: "fc-b-pos", intensity: "push" } },
      }),
      "t1",
      "md-1",
    );
    expect(a["Name a"]).toMatchObject({ d: "spurt", form: 10, intensitaet: "push" });
    expect(a["Name b"]).toMatchObject({ d: "spurt", form: 10, intensitaet: "push" });
  });

  it("time-trial: gespielte Karten (+4 farbgleich x2, +2) und Push landen bei JEDEM Spieler der Seite", () => {
    const a = buildArenaAufstellung(
      spielstand({
        disciplineId: "time-trial",
        category: "speed",
        modifiers: { d1: { primaryFormCardId: "fc-a-pos", secondaryFormCardId: "fc-b-pos", intensity: "push" } },
      }),
      "t1",
      "md-1",
    );
    expect(a["Name a"]).toMatchObject({ d: "time-trial", form: 10, intensitaet: "push" });
    expect(a["Name b"]).toMatchObject({ d: "time-trial", form: 10, intensitaet: "push" });
  });

  it("time-trial: negative Karte und Schonen werden durchgereicht", () => {
    const a = buildArenaAufstellung(
      spielstand({
        disciplineId: "time-trial",
        category: "speed",
        modifiers: { d1: { primaryFormCardId: "fc-b-neg", intensity: "conserve" } },
      }),
      "t1",
      "md-1",
    );
    expect(a["Name a"]).toMatchObject({ form: -8, intensitaet: "schonen" });
  });

  it("time-trial: ohne Karte steht Form 0 / normal da (ersetzt die Ersatzkarte, statt sie stehen zu lassen)", () => {
    const a = buildArenaAufstellung(spielstand({ disciplineId: "time-trial", category: "speed" }), "t1", "md-1");
    expect(a["Name a"]).toMatchObject({ form: 0, intensitaet: "normal" });
  });

  it("Plan schlaegt Entwurf (dieselbe Regel wie die Wertung)", () => {
    const a = buildArenaAufstellung(
      spielstand({
        disciplineId: "time-trial",
        category: "speed",
        modifiers: { d1: { primaryFormCardId: "fc-b-neg" } },
        plans: [{ seasonId: "season-1", teamId: "t1", matchdayId: "md-1", disciplineSide: "d1", primaryFormCardId: "fc-a-pos", secondaryFormCardId: null }],
      }),
      "t1",
      "md-1",
    );
    expect(a["Name a"]).toMatchObject({ form: 8 });
  });

  it("nicht freigeschaltete Disziplin (climbing): Eintrag bleibt exakt {d, slot}", () => {
    const a = buildArenaAufstellung(
      spielstand({
        disciplineId: "climbing",
        category: "speed",
        modifiers: { d1: { primaryFormCardId: "fc-a-pos", intensity: "push" } },
      }),
      "t1",
      "md-1",
    );
    for (const eintrag of Object.values(a)) {
      expect(Object.keys(eintrag).sort()).toEqual(["d", "slot"]);
    }
  });
});

describe("P4: neue Farbregel im Aufstellungs-Rohr (Standard seit 18.11.)", () => {
  it("time-trial: Kartenwert je SPIELER, gleich wie calculateFormModifierForSide (alle + Farbtraeger)", () => {
    // a = Sprinter (gruen), b = Bard (gelb); Disziplin speed = gruen. Karte a: gruen +4 (passend), Karte b: gelb +2 (fremd).
    const a = buildArenaAufstellung(
      spielstand({
        disciplineId: "time-trial",
        category: "speed",
        klassen: { a: "Sprinter", b: "Bard" },
        modifiers: { d1: { primaryFormCardId: "fc-a-pos", secondaryFormCardId: "fc-b-pos" } },
      }),
      "t1",
      "md-1",
    );
    // a: gruen 4 x1,0 + Traeger 4 x0,5 = 6; gelb 2 x0,5 = 1  -> 7.  b: gruen 4 (alle) ; gelb 2 x0,5 + Traeger 2 x0,5 = 2 -> 6.
    expect(a["Name a"]).toMatchObject({ form: 7 });
    expect(a["Name b"]).toMatchObject({ form: 6 });
  });
});

describe("P4: der Motor liest die echte Form an einer Stelle", () => {
  const motor = readFileSync(
    join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "mockups", "battle-mode.engine.js"),
    "utf8",
  );

  it("alle Baufunktionen, die die Ersatzkarte lasen, nehmen breitPunkteVon()", () => {
    // 7 aus dieser PR + tdmKaempfer() (TDM-Gefecht, seit dem Merge mit main, s. Klassenkommentar).
    expect(motor.match(/=breitPunkteVon\(p,/g)?.length).toBe(8);
  });

  it("der alte Ausdruck steht nur noch als Rueckfall im Helfer", () => {
    // (Code-Zuweisungen; die zwei Erwaehnungen im Kommentar ueber dem Helfer zaehlen nicht)
    expect(motor.match(/=formVon\(p\.n\)\+stufenWert\(\)/g)).toBeNull();
    expect(motor.match(/:formVon\(p\.n\)\+stufenWert\(\);/g)?.length).toBe(1);
    expect(motor).toContain("return e?e.form+INTENSITAET[e.int].wert:formVon(p.n)+stufenWert();");
  });

  it("place uebernimmt form/intensitaet nur typrichtig", () => {
    expect(motor).toContain('if(typeof e.form==="number"&&Number.isFinite(e.form)){');
  });
});

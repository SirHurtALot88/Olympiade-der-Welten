/**
 * P4 — ECHTE FORMKARTEN UND INTENSITAET IM MOTOR (docs/design/formkarten-motor-p4-11-11.md).
 *
 * Haelt fest:
 *   1. Fuer eine freigeschaltete Disziplin (FORMKARTEN_ECHT_DISCIPLINE_IDS, Pilot: time-trial)
 *      traegt der Aufstellungseintrag die GESPIELTE Form (Kartenwerte, x2 bei Farbgleichheit, wie
 *      `calculateFormModifierForSide`) und die Intensitaet der Seite.
 *   2. "Plan schlaegt Entwurf" gilt auch hier (dieselbe Funktion wie die Wertung).
 *   3. Jede NICHT freigeschaltete Disziplin bekommt die Felder nicht — der Eintrag bleibt exakt
 *      `{d, slot}`, der Motor faellt auf die Ersatzkarte zurueck (bit-identisch).
 *   4. Der Motor liest die Werte an genau einer Stelle (`breitPunkteVon`) in allen sieben
 *      Baufunktionen; der alte Ausdruck steht nur noch als Rueckfall im Helfer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FORMKARTEN_ECHT_DISCIPLINE_IDS } from "@/lib/battle/formkarten-echt-disziplinen";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";

function spielstand(opts: {
  disciplineId: string;
  category: string;
  modifiers?: Record<string, unknown>;
  plans?: unknown[];
}) {
  const spieler = ["a", "b"].map((id) => ({ id, name: `Name ${id}` }));
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

describe("P4: echte Formkarte im Aufstellungs-Rohr", () => {
  it("Pilot time-trial ist freigeschaltet", () => {
    expect(FORMKARTEN_ECHT_DISCIPLINE_IDS.has("time-trial")).toBe(true);
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

describe("P4: der Motor liest die echte Form an einer Stelle", () => {
  const motor = readFileSync(
    join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "mockups", "battle-mode.engine.js"),
    "utf8",
  );

  it("alle sieben Baufunktionen nehmen breitPunkteVon()", () => {
    expect(motor.match(/=breitPunkteVon\(p,/g)?.length).toBe(7);
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

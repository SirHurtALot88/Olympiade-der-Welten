import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { leiteTrainingsVorliebenAb } from "@/lib/training/trainings-vorlieben";
import {
  nebelStufeFuer,
  sortiereNachNebelStufe,
  vorliebenSicht,
  vorliebenSichtFuerStufe,
} from "@/lib/training/trainings-vorlieben-sicht";

/** Sichtbarkeit der Trainingsvorlieben unter Scouting-Nebel (Chris, 18.11.): feste Stufen, nie nach Verdecktem sortieren. */

const spieler = { id: "p-fremd", className: "Mage" };
const vorlieben = leiteTrainingsVorliebenAb(spieler);

function spiel(opts: { eigenerKader?: string[]; confidence?: number; nebelAus?: boolean } = {}): GameState {
  return {
    season: { id: "season-1" },
    scenarioMeta: opts.nebelAus ? { scoutingNebelAus: true } : {},
    rosters: (opts.eigenerKader ?? []).map((id) => ({ teamId: "ME", playerId: id })),
    seasonState: { scoutIntelByTeamId: opts.confidence != null ? { ME: [{ playerId: spieler.id, seasonId: "season-1", certainty: opts.confidence }] } : {} },
    playerPotential: [],
    teams: [],
    players: [],
  } as unknown as GameState;
}

describe("Vorlieben unter Scouting-Nebel", () => {
  it("unbekannt zeigt nichts, beobachtet eine Lieblingsdisziplin, gescoutet alle drei", () => {
    expect(vorliebenSichtFuerStufe(vorlieben, 0)).toEqual({ stufe: 0, lieblinge: [null, null], ungeliebt: null });
    expect(vorliebenSichtFuerStufe(vorlieben, 1)).toEqual({ stufe: 1, lieblinge: [vorlieben.lieblinge[0], null], ungeliebt: null });
    expect(vorliebenSichtFuerStufe(vorlieben, 2)).toEqual({ stufe: 2, lieblinge: [...vorlieben.lieblinge], ungeliebt: vorlieben.ungeliebt });
  });

  it("die Stufe folgt der Aufdeckung: unter 40 unbekannt, ab 40 beobachtet, 100 gescoutet", () => {
    expect(nebelStufeFuer(spiel({ confidence: 0 }), "ME", spieler.id)).toBe(0);
    expect(nebelStufeFuer(spiel({ confidence: 39 }), "ME", spieler.id)).toBe(0);
    expect(nebelStufeFuer(spiel({ confidence: 40 }), "ME", spieler.id)).toBe(1);
    expect(nebelStufeFuer(spiel({ confidence: 99 }), "ME", spieler.id)).toBe(1);
    expect(nebelStufeFuer(spiel({ confidence: 100 }), "ME", spieler.id)).toBe(2);
  });

  it("eigenes Team immer alle drei; Fog of War aus zeigt alles", () => {
    expect(nebelStufeFuer(spiel({ eigenerKader: [spieler.id] }), "ME", spieler.id)).toBe(2);
    expect(nebelStufeFuer(spiel({ nebelAus: true }), "ME", spieler.id)).toBe(2);
    const sicht = vorliebenSicht(spiel({ eigenerKader: [spieler.id] }), "ME", spieler);
    expect(sicht.ungeliebt).toBe(vorlieben.ungeliebt);
  });

  it("sortiert nach Stufe, bei Gleichstand nach Name, nie nach verdecktem Inhalt", () => {
    const zeilen = [
      { n: "Cora", s: 0 as const },
      { n: "Anna", s: 2 as const },
      { n: "Bert", s: 0 as const },
      { n: "Dora", s: 1 as const },
      { n: "Emil", s: 2 as const },
    ];
    const ab = sortiereNachNebelStufe(zeilen, (z) => z.s, (z) => z.n, "ab").map((z) => z.n);
    expect(ab).toEqual(["Anna", "Emil", "Dora", "Bert", "Cora"]);
    const auf = sortiereNachNebelStufe(zeilen, (z) => z.s, (z) => z.n, "auf").map((z) => z.n);
    expect(auf).toEqual(["Bert", "Cora", "Dora", "Anna", "Emil"]);
  });
});

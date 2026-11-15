import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  GEGNER_MENSCH_TREFFSICHERHEIT_MAX,
  GEGNER_STUFE_KI_MUSTER,
  gegnerSpanne,
  schaetzeGegnerAufstellung,
} from "@/lib/lineups/gegner-schaetzung";
import { getOpponentOf } from "@/lib/season/season-fixture-schedule";

/**
 * Einsatzliste-Revamp, Gegner-Schätzung Iteration 1 (Chris 08.11.): nie exakt, Präzision nach
 * Scouting-Stufe, KI-Muster erst ab guter Stufe, menschliche Gegner nur als Prognose, fehlender
 * Gegner = „unbekannt" statt Absturz.
 */
const gs = createSingleplayerGameState();
const matchdayId = gs.season.matchdayIds[0]!;
const eigenesTeamId = gs.seasonState.schedule!.find((entry) => entry.matchdayId === matchdayId)!.homeTeamId;
const gegnerTeamId = getOpponentOf(gs, eigenesTeamId, matchdayId)!;
const disziplinen = gs.disciplines.slice(0, 2).map((discipline) => discipline.id);
const seiten = [
  { seite: "d1" as const, disciplineId: disziplinen[0]!, slotCount: 4 },
  { seite: "d2" as const, disciplineId: disziplinen[1]!, slotCount: 4 },
];

function mitScoutingBuero(state: GameState, level: number): GameState {
  return {
    ...state,
    seasonState: {
      ...state.seasonState,
      teamFacilities: {
        ...(state.seasonState.teamFacilities ?? {}),
        [eigenesTeamId]: {
          ...(state.seasonState.teamFacilities?.[eigenesTeamId] ?? {}),
          facilities: {
            ...(state.seasonState.teamFacilities?.[eigenesTeamId]?.facilities ?? {}),
            scouting_office: { level, enabled: true, conditionPct: 100 },
          },
        },
      } as GameState["seasonState"]["teamFacilities"],
    },
  };
}

function schaetze(state: GameState) {
  return schaetzeGegnerAufstellung({ gameState: state, eigenesTeamId, seasonId: state.season.id, matchdayId, seiten });
}

describe("Gegner-Schätzung (Iteration 1)", () => {
  it("ohne Spielplan-Eintrag: 'unbekannt', kein Absturz", () => {
    const ohnePlan = { ...gs, seasonState: { ...gs.seasonState, schedule: [] } };
    expect(schaetze(ohnePlan).status).toBe("unbekannt");
    expect(schaetzungOhneState().status).toBe("unbekannt");
  });

  it("Spanne enthält immer den wahren Wert und ist nie exakt", () => {
    for (let stufe = 0; stufe <= 5; stufe += 1) {
      for (let i = 0; i < 50; i += 1) {
        const wahr = 30 + i;
        const spanne = gegnerSpanne({ wahr, stufe, schluessel: `p${i}|${stufe}` });
        expect(spanne.min).toBeLessThanOrEqual(wahr);
        expect(spanne.max).toBeGreaterThanOrEqual(wahr);
        expect(spanne.max - spanne.min).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it("schwache Stufe: Gegner bekannt, Werte nur als Spanne; Stufe 0 verdeckt Namen", () => {
    const ergebnis = schaetze(mitScoutingBuero(gs, 0));
    expect(ergebnis.status).toBe("geschaetzt");
    if (ergebnis.status !== "geschaetzt") return;
    expect(ergebnis.gegnerTeamId).toBe(gegnerTeamId);
    expect(ergebnis.quelle).not.toBe("ki-muster");
    if (ergebnis.stufe === 0) {
      expect(ergebnis.quelle).toBe("verdeckt");
      for (const slot of ergebnis.seiten.d1!.slots) expect(slot.spielerName).toBeNull();
    }
    expect(ergebnis.seiten.d1!.schnitt).not.toBeNull();
  });

  it("KI-Gegner bei guter Stufe: Slots aus dem KI-Entwurf, aber weiter als Spanne", () => {
    const kader = gs.rosters.filter((entry) => entry.teamId === gegnerTeamId);
    const entwurf = {
      lineupId: "test",
      saveId: "s",
      seasonId: gs.season.id,
      matchdayId,
      teamId: gegnerTeamId,
      status: "draft" as const,
      entries: kader.slice(0, 8).map((entry, index) => ({
        disciplineId: disziplinen[index < 4 ? 0 : 1]!,
        disciplineSide: (index < 4 ? "d1" : "d2") as "d1" | "d2",
        slotIndex: index % 4,
        playerId: entry.playerId,
        activePlayerId: entry.id,
      })),
      createdAt: "",
      updatedAt: "",
    };
    const state = mitScoutingBuero({ ...gs, seasonState: { ...gs.seasonState, lineupDrafts: [entwurf] } }, 5);
    const ergebnis = schaetze(state);
    expect(ergebnis.status).toBe("geschaetzt");
    if (ergebnis.status !== "geschaetzt") return;
    expect(ergebnis.stufe).toBeGreaterThanOrEqual(GEGNER_STUFE_KI_MUSTER);
    expect(ergebnis.steuerung).toBe("ki");
    expect(ergebnis.quelle).toBe("ki-muster");
    expect(ergebnis.treffsicherheitPct).toBeLessThan(100);
    const name0 = gs.players.find((player) => player.id === kader[0]!.playerId)!.name;
    expect(ergebnis.seiten.d1!.slots[0]!.spielerName).toBe(name0);
    expect(ergebnis.seiten.d1!.slots[0]!.spanne).not.toBeNull();
  });

  it("menschlicher Gegner: nie der Entwurf, immer Prognose, Treffsicherheit gedeckelt", () => {
    const manuell = {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        teamControlSettings: {
          ...(gs.seasonState.teamControlSettings ?? {}),
          [gegnerTeamId]: { ...(gs.seasonState.teamControlSettings?.[gegnerTeamId] ?? {}), controlMode: "manual" as const, ownerId: "franky" },
        },
      },
    } as GameState;
    const ergebnis = schaetze(mitScoutingBuero(manuell, 5));
    expect(ergebnis.status).toBe("geschaetzt");
    if (ergebnis.status !== "geschaetzt") return;
    expect(ergebnis.steuerung).toBe("mensch");
    expect(ergebnis.quelle).toBe("prognose");
    expect(ergebnis.treffsicherheitPct).toBeLessThanOrEqual(GEGNER_MENSCH_TREFFSICHERHEIT_MAX);
    // Prognose = optimale Zuteilung: jeder Spieler höchstens einmal über beide Seiten.
    const namen = [...ergebnis.seiten.d1!.slots, ...ergebnis.seiten.d2!.slots].map((slot) => slot.spielerName).filter(Boolean);
    expect(new Set(namen).size).toBe(namen.length);
  });
});

function schaetzungOhneState() {
  return schaetzeGegnerAufstellung({ gameState: null, eigenesTeamId, seasonId: "x", matchdayId, seiten });
}

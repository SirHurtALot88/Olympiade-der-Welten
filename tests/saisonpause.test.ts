/**
 * SAISONPAUSE nach Spieltag 10 (21.11., Welle 4): Postfach-Bericht, Spielplan-Marke, Schalter OLY_SAISONPAUSE=0.
 * Die Buchung selbst (genau einmal, idempotent, Verletzte, Stempel) deckt tests/belastung-resistenz.test.ts ab;
 * hier die Kommunikation und der Rückweg. Doku: docs/design/saisonpause-21-11.md.
 */
import { afterEach, describe, expect, it } from "vitest";

import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import { buildKorridorLeague, realSchedule } from "@/lib/fatigue/erholungskorridor-simulation";
import {
  applyFatigueAndInjuryAfterMatchday,
  buildBelastungsPauseRef,
  getBelastungsPauseMatchdayId,
  getPlayerAvailabilityView,
} from "@/lib/fatigue/fatigue-injury-service";
import { baueSaisonpauseBericht, formatSaisonpauseBericht } from "@/lib/fatigue/saisonpause-bericht";
import { buildGameInboxItems } from "@/lib/foundation/game-inbox-service";

const SAAT = "belastung-test";

function v2Liga(opts: { stempel?: boolean } = {}): GameState {
  const spielplan = realSchedule(SAAT, 2);
  const gs = buildKorridorLeague(spielplan.length, {
    gameMode: "battle",
    spielplan,
    mitAttributen: true,
    ...(opts.stempel === false ? {} : { belastungsRegel: "v2" as const }),
  });
  return gs;
}

function waehle(gs: GameState, teamId: string, matchdayId: string, n: number) {
  return gs.rosters
    .filter((r) => r.teamId === teamId)
    .map((r) => ({ id: r.playerId, v: getPlayerAvailabilityView(gs, r.playerId, teamId, matchdayId) }))
    .filter((x) => !x.v.isUnavailable)
    .sort((a, b) => a.v.fatigue - b.v.fatigue || a.id.localeCompare(b.id))
    .slice(0, n)
    .map((x) => x.id);
}

function setzeEntwuerfe(gs: GameState, mdIndex: number): GameState {
  const md = gs.seasonState.disciplineSchedule![mdIndex]!;
  const n1 = md.discipline1?.playerCount ?? 0;
  const n2 = md.discipline2?.playerCount ?? 0;
  const drafts: LineupDraft[] = gs.teams.map((team) => {
    const ids = waehle(gs, team.teamId, md.matchdayId, n1 + n2);
    return {
      lineupId: `l-${team.teamId}-${md.matchdayId}`,
      saveId: SAAT,
      seasonId: "season-1",
      matchdayId: md.matchdayId,
      teamId: team.teamId,
      status: "submitted",
      entries: [
        ...ids.slice(0, n1).map((playerId, slotIndex) => ({ disciplineId: md.discipline1!.disciplineId, disciplineSide: "d1" as const, slotIndex, playerId, activePlayerId: playerId })),
        ...ids.slice(n1).map((playerId, slotIndex) => ({ disciplineId: md.discipline2!.disciplineId, disciplineSide: "d2" as const, slotIndex, playerId, activePlayerId: playerId })),
      ],
      modifiers: { d1: { intensity: "normal" }, d2: { intensity: "push" } },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as LineupDraft;
  });
  return { ...gs, seasonState: { ...gs.seasonState, lineupDrafts: drafts } };
}

function bucheSpieltag(gs: GameState, mdIndex: number, extra: Partial<Parameters<typeof applyFatigueAndInjuryAfterMatchday>[0]> = {}) {
  const matchdayId = gs.season.matchdayIds[mdIndex]!;
  return applyFatigueAndInjuryAfterMatchday({
    gameState: gs,
    saveId: SAAT,
    seasonId: "season-1",
    matchdayId,
    matchdayResultId: `res-${matchdayId}`,
    timestamp: "2026-01-01T00:00:00.000Z",
    ...extra,
  });
}


function spieleBis(gs: GameState, bisIndex: number) {
  let stand = gs;
  for (let i = 0; i <= bisIndex; i += 1) {
    stand = bucheSpieltag(setzeEntwuerfe(stand, i), i).gameState;
  }
  return stand;
}

afterEach(() => {
  delete process.env.OLY_SAISONPAUSE;
});

describe("Saisonpause: Bericht im Postfach", () => {
  it("jedes Team (Mensch wie KI) bekommt denselben Bericht aus den gebuchten Zahlen; vorher keiner", () => {
    const vorher = spieleBis(v2Liga(), 8);
    const vorItems = buildGameInboxItems({ gameState: vorher, saveId: "s", hostMode: true, now: "2026-01-01T00:00:00.000Z" });
    expect(vorItems.some((i) => i.source === "saisonpause")).toBe(false);

    const nach = spieleBis(vorher, 9);
    // Nach dem Abschluss von Spieltag 10 ist die Pause gebucht; der Spieltag 11 ist noch nicht gespielt.
    const items = buildGameInboxItems({ gameState: nach, saveId: "s", hostMode: true, now: "2026-01-01T00:00:00.000Z" })
      .filter((i) => i.source === "saisonpause");
    expect(items.length).toBe(nach.teams.length);
    expect(new Set(items.map((i) => i.itemId)).size).toBe(items.length);
    for (const item of items) {
      expect(item).toMatchObject({ title: "Saisonpause: alle Spieler erholen sich", category: "news", severity: "info", targetView: "lineup" });
      const bericht = baueSaisonpauseBericht(nach, item.teamId!)!;
      expect(item.description).toBe(formatSaisonpauseBericht(bericht));
      expect(bericht.fatigueNachher).toBeLessThan(bericht.fatigueVorher);
    }
    // Nur das eigene Team: ein anderer Besitzer sieht nur seine Teams, nie das fremde
    const nurEins = buildGameInboxItems({ gameState: nach, saveId: "s", activeTeamId: "T-0", now: "2026-01-01T00:00:00.000Z" })
      .filter((i) => i.source === "saisonpause");
    expect(nurEins.every((i) => i.teamId === "T-0" || i.teamId == null)).toBe(true);
  }, 240_000);

  it("Bericht: Zahlen stimmen mit dem Pausen-Eintrag überein", () => {
    const nach = spieleBis(v2Liga(), 9);
    const b = baueSaisonpauseBericht(nach, "T-0")!;
    const e = nach.seasonState.belastungsPause!.eintraege.filter((x) => x.teamId === "T-0");
    expect(b.anzahl).toBe(e.length);
    expect(b.rotVorher).toBe(e.filter((x) => x.fatigueVorher >= 65).length);
    expect(b.ausDemRotenBereich).toBeLessThanOrEqual(b.rotVorher);
    expect(formatSaisonpauseBericht(b)).toContain("Nach Spieltag 10");
    expect(baueSaisonpauseBericht(spieleBis(v2Liga(), 8), "T-0")).toBeNull();
  }, 240_000);
});

describe("Saisonpause: Marke und Schalter", () => {
  it("die Marke kennt Spieltag und Buchungsstand (Referenz für Spielplan und Einsatzliste)", () => {
    const vor = spieleBis(v2Liga(), 8);
    expect(getBelastungsPauseMatchdayId(vor)).toBe("md-10");
    expect(buildBelastungsPauseRef(vor, "T-0")).toMatchObject({ nachSpieltag: 10, gebucht: false });
    expect(buildBelastungsPauseRef(spieleBis(vor, 9), "T-0")).toMatchObject({ nachSpieltag: 10, gebucht: true });
  }, 240_000);

  it("OLY_SAISONPAUSE=0: keine Pause, keine Marke, das Konto bleibt auf dem Stand vor der Pause", () => {
    const vor = spieleBis(v2Liga(), 8);
    const mitPause = bucheSpieltag(setzeEntwuerfe(vor, 9), 9).gameState;
    process.env.OLY_SAISONPAUSE = "0";
    const ohne = bucheSpieltag(setzeEntwuerfe(vor, 9), 9).gameState;
    expect(ohne.seasonState.belastungsPause ?? null).toBeNull();
    expect(getBelastungsPauseMatchdayId(ohne)).toBeNull();
    expect(buildBelastungsPauseRef(ohne, "T-0")).toBeNull();
    for (const e of mitPause.seasonState.belastungsPause!.eintraege) {
      const konto = ohne.seasonState.playerAvailabilityState!.find((x) => x.playerId === e.playerId && x.teamId === e.teamId)!;
      expect(konto.fatigue).toBe(e.fatigueVorher);
    }
    expect(buildGameInboxItems({ gameState: ohne, saveId: "s", hostMode: true }).some((i) => i.source === "saisonpause")).toBe(false);
    // Verletzungen und Wertungsstände bleiben gleich: die Pause ändert nur das Konto
    expect(ohne.seasonState.injuryEvents).toEqual(mitPause.seasonState.injuryEvents);
  }, 240_000);

  it("die Pause ist nach Spieltag 11 nicht erneut gebucht (genau einmal je Saison)", () => {
    const nach11 = spieleBis(v2Liga(), 10);
    const pause = nach11.seasonState.belastungsPause!;
    expect(pause.nachMatchdayId).toBe("md-10");
    expect(getPlayerAvailabilityView(nach11, nach11.rosters[0]!.playerId, nach11.rosters[0]!.teamId, "md-12")).toBeTruthy();
  }, 240_000);
});

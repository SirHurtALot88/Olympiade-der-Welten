/**
 * SAISONTEST-FUND 02.11. (Battle Mode, VW-Spielstand): nach dem Saisonwechsel ueber
 * `/api/season/preseason-workflow` (`next_season_setup`, derselbe Weg wie der Knopf „Neue Saison
 * starten") stand Saison 2 mit 8-11 Spielern je KI-Kader und null KI-Kaeufen da. Der einzige
 * Ausloeser fuer den Kauflauf der Folgesaison sass im Browser; war die Shell danach nicht offen,
 * lief er nie.
 *
 * Seitdem stoesst der Server ihn beim Saisonwechsel selbst an
 * (`starteKiSaisonstartKaufLaufImHintergrund`). Dieser Test haelt die Entscheidungsregel fest —
 * DIESELBE wie beim Browser-Ausloeser: nicht in Saison 1 (dort laeuft der Setup-Draft), nur im
 * Saisonstart-Fenster, und nie ein zweiter Lauf neben einem laufenden oder fertigen. Gemessen am
 * echten Spielstand (Kopie vor Saison 2): 0 -> 45 KI-Kaeufe, Kader Ø 9,3 -> 10,7, Teams mit
 * hoechstens 9 Spielern 21 -> 4.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { starteKiSaisonstartKaufLaufImHintergrund } from "@/lib/ai/ai-preseason-background-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";

function spielstand(teil: {
  seasonId: string;
  gamePhase?: string;
  currentMatchday?: number;
  matchdayStatus?: string;
  runs?: Record<string, unknown>;
}): GameState {
  return {
    gamePhase: teil.gamePhase ?? "season_active",
    season: { id: teil.seasonId, name: teil.seasonId.replace("season-", "Season "), currentMatchday: teil.currentMatchday ?? 1 },
    matchdayState: { matchdayId: `${teil.seasonId}-matchday-1`, status: teil.matchdayStatus ?? "planning" },
    teams: [],
    rosters: [],
    seasonState: { matchdayResults: [], aiPreseasonAutomationRuns: teil.runs ?? {} },
  } as unknown as GameState;
}

function ablage(gameState: GameState | null): PersistenceService {
  return { getSaveById: () => (gameState ? { saveId: "s", gameState } : null) } as unknown as PersistenceService;
}

const scope = { room: null, participant: null, activeOwnerId: null };
const entscheide = (gameState: GameState | null) =>
  starteKiSaisonstartKaufLaufImHintergrund({ saveId: "s", scope, logPrefix: "[test]", persistence: ablage(gameState) });

describe("KI-Kauflauf der Folgesaison wird serverseitig angestossen", () => {
  it("Saison 1: nein — dort baut der Setup-Draft die Kader", () => {
    expect(entscheide(spielstand({ seasonId: "season-1" }))).toMatchObject({ gestartet: false, grund: "saison_1_hat_setup_draft" });
  });

  it("ausserhalb des Saisonstart-Fensters (Spieltag 2 laeuft): nein", () => {
    expect(entscheide(spielstand({ seasonId: "season-2", currentMatchday: 2 }))).toMatchObject({ gestartet: false, grund: "kein_saisonstart_fenster" });
  });

  it("in der Saisonende-Kette der alten Saison: nein — dort wird nur verkauft", () => {
    expect(entscheide(spielstand({ seasonId: "season-2", gamePhase: "transfer_sell_phase" }))).toMatchObject({ gestartet: false });
  });

  it("ein fertiger oder frisch laufender Lauf dieser Saison sperrt einen zweiten", () => {
    const fertig = spielstand({ seasonId: "season-2", runs: { "season-2": { status: "completed", startedAt: new Date().toISOString() } } });
    expect(entscheide(fertig)).toMatchObject({ gestartet: false, grund: "lauf_completed" });
    const laeuft = spielstand({ seasonId: "season-2", runs: { "season-2": { status: "running", startedAt: new Date().toISOString() } } });
    expect(entscheide(laeuft)).toMatchObject({ gestartet: false, grund: "lauf_running" });
  });

  it("fehlender Spielstand: nein, ohne Wurf", () => {
    expect(entscheide(null)).toMatchObject({ gestartet: false, grund: "save_nicht_gefunden" });
  });

  it("die Preseason-Workflow-Route stoesst ihn nach next_season_setup an", () => {
    const route = readFileSync(join(process.cwd(), "app/api/season/preseason-workflow/route.ts"), "utf8");
    const aufruf = route.indexOf("starteKiSaisonstartKaufLaufImHintergrund(");
    expect(aufruf, "Route ruft den serverseitigen Ausloeser nicht mehr auf").toBeGreaterThan(-1);
    expect(route.slice(Math.max(0, aufruf - 400), aufruf)).toContain('body.stepId === "next_season_setup"');
  });
});

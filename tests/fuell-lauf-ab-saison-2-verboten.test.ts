/**
 * GEMELDET: „keine filler mehr! VERBOT" · „Du sollst auf den Organic Lauf umschalten und der soll
 * picken" · „bitte füll lauf deaktivieren und remark machen dass der verboten ist! wir picken nur
 * noch organic!"
 *
 * BEFUND: `scoreRosterFillCandidate` hat KEINEN Qualitaetsterm. `valueScore` belohnt ein gutes
 * Marktwert-Gehalt-Verhaeltnis, `pricePenalty` bestraft teure Spieler — ein 9-Mio-Fueller schlaegt
 * damit einen 40-Mio-Star. Am Live-Spielstand gemessen, Saison 2:
 *
 *     ai_preseason_market_buy (organisch)  33 Kaeufe, 1013.8 Mio,  0 unter 12 Mio
 *     ai_roster_fill (Fuell-Lauf)          74 Kaeufe,  826.9 Mio, 52 unter 12 Mio
 *
 * Die Sperre sitzt IM DIENST, nicht nur beim Aufrufer: einen Aufruf aus der Preseason-Kette zu
 * entfernen haelt nur so lange, bis jemand einen neuen Aufruf schreibt. Saison 1 bleibt erlaubt —
 * dort baut der Dienst die Kader ueberhaupt erst auf.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

const store: { gameState: Record<string, unknown> } = { gameState: {} };

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: () => ({ saveId: "save-1", name: "Test", gameState: store.gameState }),
    listSaves: () => [{ saveId: "save-1" }],
    saveSingleplayerState: (_id: string, next: Record<string, unknown>) => {
      store.gameState = next;
      return { saveId: "save-1", gameState: next };
    },
  }),
}));

function baueSave(seasonId: string) {
  return {
    season: { id: seasonId, name: seasonId },
    matchdayState: { matchdayId: null },
    teams: [{ teamId: "C-C", shortCode: "C-C", name: "Test", cash: 200, budget: 200 }],
    teamIdentities: [{ teamId: "C-C", playerMin: 8, playerOpt: 12, playerMax: 14 }],
    players: [],
    rosters: [],
    transferHistory: [],
    logs: [],
    // Der Saison-1-Fall laeuft absichtlich in die ECHTE Fuell-Logik (nur so ist belegt, dass die
    // Sperre ihn durchlaesst) — die braucht diese Listen, auch wenn sie leer bleiben.
    disciplines: [],
    activePlayers: [],
    teamStrategyProfiles: [],
    standings: {},
    schedule: [],
    seasonState: { teamControlSettings: {} },
  };
}

describe("Fuell-Lauf ist ab Saison 2 verboten", () => {
  // Der Modul-Import zieht den halben Markt-Stack nach und braucht beim ERSTEN Mal mehrere
  // Sekunden. Einmal hier vorziehen, sonst laeuft der erste Testfall in den Timeout und misst
  // die Ladezeit statt der Sperre.
  let runAutoRosterFillForMatchdaySetup: typeof import("@/lib/ai/auto-roster-fill-service")["runAutoRosterFillForMatchdaySetup"];
  beforeAll(async () => {
    ({ runAutoRosterFillForMatchdaySetup } = await import("@/lib/ai/auto-roster-fill-service"));
  }, 60_000);

  it("liefert in Saison 2 ein leeres Ergebnis mit klarem Grund", async () => {
    store.gameState = baueSave("season-2") as never;
    const ergebnis = await runAutoRosterFillForMatchdaySetup({ saveId: "save-1", seasonId: "season-2" });

    expect(ergebnis.status).toBe("blocked");
    expect(ergebnis.executed).toBe(false);
    expect(ergebnis.summary.appliedBuys).toBe(0);
    expect(ergebnis.teams).toHaveLength(0);
    expect(ergebnis.blockingReasons).toContain("roster_fill_nur_in_season_1_erlaubt");
  });

  it("gilt auch fuer spaetere Saisons", async () => {
    store.gameState = baueSave("season-6") as never;
    const ergebnis = await runAutoRosterFillForMatchdaySetup({ saveId: "save-1", seasonId: "season-6" });
    expect(ergebnis.status).toBe("blocked");
  });

  it("bricht die aufrufende Kette NICHT ab", async () => {
    // Bewusst kein Wurf: der Dienst hat mehrere Aufrufer. Eine Ausnahme wuerde einen laufenden
    // Saisonstart mittendrin abbrechen statt ihn sauber ohne Fuell-Kaeufe weiterlaufen zu lassen.
    store.gameState = baueSave("season-3") as never;
    await expect(runAutoRosterFillForMatchdaySetup({ saveId: "save-1", seasonId: "season-3" })).resolves.toBeTruthy();
  });

  it("Saison 1 bleibt erlaubt — dort baut der Dienst die Kader auf", async () => {
    store.gameState = baueSave("season-1") as never;
    const ergebnis = await runAutoRosterFillForMatchdaySetup({ saveId: "save-1", seasonId: "season-1" });
    // Ohne Kandidaten kauft er nichts, aber er ist eben NICHT gesperrt.
    expect(ergebnis.blockingReasons).not.toContain("roster_fill_nur_in_season_1_erlaubt");
  });
});

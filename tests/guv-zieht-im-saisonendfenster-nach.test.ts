/**
 * DIE GESPEICHERTE GuV ZIEHT IM SAISONENDE-FENSTER NACH — an drei Stellen, und nur dort.
 *
 * GEMELDET VON CHRIS (`1rh8lx`): „Die GuV im Saisonstand und die im Finanzen-Reiter weichen
 * voneinander ab! […] die zuletzt bearbeitete müsste die korrekte sein - die sollen nicht
 * unterschiedlich sein."
 *
 * DIE DEFINITION WAR NIE DAS PROBLEM. Beide Seiten rechnen nach `season-end-guv.ts` (Sponsor +
 * Gebäude + Apron + Vorstandsziele − Gehälter − Unterhalt − Kreditzins), Apron also inklusive, und
 * der Hover mit allen Posten steht auf beiden Seiten. Unterschiedlich war die FRISCHE: der
 * Saisonstand leitet live ab, der Finanzen-Reiter liest den gespeicherten `standing.guv` — und der
 * wird von `writeLocalCashPrizeApply` geschrieben, BEVOR Sponsor, Apron und Vorstandsziele gebucht
 * sind.
 *
 * WARUM NICHT BEIM LESEN NEU RECHNEN — der Grund, warum dieser Weg gewählt wurde und nicht der
 * naheliegende. `resolveSeasonGuvByTeam` kostet auf einem warmen Spielstand ~85 ms für 32 Teams,
 * auf einem FRISCHEN beim ersten Aufruf 334 Sekunden (die Sponsor-Angebote entstehen dabei
 * erstmalig). Ein Versuch, im Tabellenaufbau live abzuleiten, trieb `analytics-live-fortschritt`
 * von 17,58 s auf über 180 s und `team-management-overview` von 1,30 s auf 12,13 s; ein Memo pro
 * `gameState` half nicht, weil je Aufruf ein neuer entsteht. Deshalb: einmal je BUCHUNG statt
 * einmal je ANZEIGE.
 *
 * DREI HAKEN, weil das Fenster drei Eingänge hat (Chris' Wahl: „mach 3"):
 *   1. Phasenwechsel — wer die Phase betritt, ohne etwas zu tun, sähe sonst weiter die
 *      eingefrorene Hochrechnung; keine Buchung hätte je ausgelöst.
 *   2. Transfermarkt-Schreibpfad — Kauf wie Verkauf verschieben Gehälter.
 *   3. Vertrags-Schreibpfad — Verlängerung, Auflösung, Saisonende-Tick ebenso.
 *
 * Am Live-Abbild nachgemessen, vorher → nachher:
 *   `hwz8fk` (season_end_management): 1 abweichendes Team → 0   (82 ms)
 *   `1hf25q` (season_completed):     32 abweichende Teams → 0   (47 ms)
 *   `0kalpx` (season_active):         0 → 0                     ( 0 ms — Riegel greift)
 * Zweiter Durchlauf ändert in allen drei nichts.
 *
 * Dass im gemeldeten Save GENAU EIN Team abwich — S-C, das von Chris geführte — ist der Beleg für
 * die Ursache: die 31 KI-Teams hatten dort nicht gehandelt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { zieheSaisonstandGuvNachImSaisonendfenster } from "@/lib/finance/season-guv-nachbuchung";
import { SEASON_END_ROSTER_PHASES } from "@/lib/season/season-end-roster-window";

const MARKT = readFileSync(join(process.cwd(), "lib/market/transfermarkt-local-service.ts"), "utf8");
const VERTRAG = readFileSync(join(process.cwd(), "lib/contracts/contract-renewal-service.ts"), "utf8");
const UEBERGANG = readFileSync(join(process.cwd(), "lib/season/season-transition-service.ts"), "utf8");
const UEBERSICHT = readFileSync(join(process.cwd(), "lib/foundation/team-management-overview.ts"), "utf8");

/** Minimalzustand — genug für den Riegel, bewusst ohne Liga-Daten. */
function zustand(gamePhase: string, standings: Record<string, unknown> = {}): GameState {
  return {
    gamePhase,
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 10, matchdayIds: [] },
    seasonState: { seasonId: "season-1", schedule: [], standings },
    matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
  } as unknown as GameState;
}

describe("Der Riegel: nachgezogen wird NUR im Saisonende-Fenster", () => {
  it("in der laufenden Saison passiert nichts — derselbe Zustand kommt zurück", () => {
    // Identität, nicht Gleichheit: das beweist, dass die teure Ableitung gar nicht erst lief.
    const vorher = zustand("season_active", { "A-A": { guv: 99, guvPosten: [{ key: "x", value: 1 }] } });
    expect(zieheSaisonstandGuvNachImSaisonendfenster(vorher)).toBe(vorher);
  });

  it("auch im Spieltags-Setup und im Kaufmarkt nicht", () => {
    for (const phase of ["lineup_setup", "transfer_buy_phase", "next_season_ready"]) {
      const vorher = zustand(phase, { "A-A": { guv: 99, guvPosten: [{ key: "x", value: 1 }] } });
      expect(zieheSaisonstandGuvNachImSaisonendfenster(vorher)).toBe(vorher);
    }
  });

  it("die gemeldete Phase liegt IM Fenster — sonst liefe der Fix an der Meldung vorbei", () => {
    expect(SEASON_END_ROSTER_PHASES.has("season_end_management")).toBe(true);
    expect(SEASON_END_ROSTER_PHASES.has("transfer_sell_phase")).toBe(true);
    expect(SEASON_END_ROSTER_PHASES.has("season_active")).toBe(false);
  });

  it("ohne Saisonstand-Zeilen bleibt alles, wie es ist", () => {
    const vorher = zustand("season_end_management", {});
    expect(zieheSaisonstandGuvNachImSaisonendfenster(vorher).seasonState.standings).toEqual({});
  });

  it("eine scheiternde Ableitung reisst die Buchung nicht mit", () => {
    // Unvollständiger Zustand im Fenster: der Resolver kann daran scheitern. Die Buchung darf
    // daran NICHT hängen — sonst wäre aus einem Anzeigefehler ein Datenverlust geworden.
    const vorher = zustand("season_end_management", { "A-A": { guv: 5, guvPosten: [{ key: "x", value: 1 }] } });
    expect(() => zieheSaisonstandGuvNachImSaisonendfenster(vorher)).not.toThrow();
  });
});

describe("Die drei Haken sitzen an den gemeinsamen Schreibpunkten", () => {
  it("Transfermarkt: am gebündelten Schreibpunkt, nicht an den Aufrufern", () => {
    // Entscheidend für die Kosten: Einzelaktionen schreiben direkt (eine Nachbuchung je Aktion),
    // KI-Läufe sammeln über den Run-Context und schreiben einmal am Ende — an den Aufrufern
    // verteilt wäre diese Bündelung verlorengegangen.
    expect(MARKT).toContain("function persistTransfermarktGameState");
    expect(MARKT).toMatch(/persistence\.saveSingleplayerState\(\s*saveId,\s*zieheSaisonstandGuvNachImSaisonendfenster\(materialized\)/);
  });

  it("Verträge: ebenfalls am gemeinsamen Schreibpunkt", () => {
    // `applyContractRenewalAction` (Spieler wie KI) und `applySeasonEndContractTick` laufen beide
    // durch `saveGameStateWithContractEvents`.
    expect(VERTRAG).toContain("function saveGameStateWithContractEvents");
    expect(VERTRAG).toContain("zieheSaisonstandGuvNachImSaisonendfenster({");
  });

  it("Phasenwechsel: beim Betreten, damit auch ohne Buchung nachgezogen wird", () => {
    // Der Aufruf steht seit Meldung `j53iox` nicht mehr direkt auf dem Objektliteral — dazwischen
    // liegt `applyDefaultTrainingFieldsToRosteredPlayers`, das am selben Phasenwechsel haengt.
    // Gemessen wird deshalb die AUSSAGE (`nextGameState` entsteht durch die Nachbuchung), nicht
    // die eine Textzeile: sonst faellt dieser Waechter bei jedem weiteren Schritt an derselben
    // Stelle, obwohl die Nachbuchung unveraendert laeuft.
    expect(UEBERGANG).toContain("const nextGameState: GameState = zieheSaisonstandGuvNachImSaisonendfenster(");
    const stelle = UEBERGANG.slice(
      UEBERGANG.indexOf("const nextGameState: GameState = zieheSaisonstandGuvNachImSaisonendfenster("),
    ).slice(0, 400);
    expect(stelle).toContain("...progressionSave.gameState");
    expect(stelle).toContain("gamePhase: nextPhase");
  });

  it("der Tabellenaufbau rechnet NICHT live — genau das war zu teuer", () => {
    // Der Riegel gegen den Rückfall in den 334-Sekunden-Weg. Stünde hier wieder eine
    // Live-Ableitung, wäre die Anzeige zwar richtig und das Spiel unbenutzbar.
    expect(UEBERSICHT).not.toContain("resolveSeasonGuvByTeam");
  });
});

/**
 * GEMELDET VON CHRIS: „xelara steht aktuell dann immernoch auf vertrag läuft aus und ist im
 * vertrags auslauf center!"
 *
 * Ihr Vertrag war zu dem Zeitpunkt schon richtig — gespeichert stand Endsaison 2, Status „active".
 * Gelogen hat das Etikett. Die Verträge-Tabelle las an rund zehn Stellen direkt
 * `row.contractLength <= 1`, und dieser Countdown wird am ENDE einer Saison gesenkt, während
 * diese noch die laufende ist. Danach heißt eine 1 nicht mehr „letzte Saison", sondern „noch eine
 * volle". An Chris' Spielstand betraf das 129 von 269 Verträgen: alle standen auf „läuft aus",
 * alle hatten in Wahrheit noch eine ganze Saison.
 *
 * Die Zeile trägt deshalb jetzt die ABGELEITETE Restlaufzeit mit. Sie kommt aus derselben
 * Endsaison-Rechnung wie der Status, und die Tabelle fragt nur noch sie.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SEASON_END_CONTRACT_TICK_STEP_ID } from "@/lib/contracts/contract-renewal-service";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildTeamContractSeasonTable } from "@/lib/market/contract-negotiation-preview";

const panel = readFileSync(join(process.cwd(), "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx"), "utf8");

/** Ein Spielstand in Saison 1, bei dem die Vertragsalterung bereits gelaufen ist. */
function saisonendeNachDerAlterung() {
  const gameState = structuredClone(createSingleplayerGameState());
  gameState.gamePhase = "season_end_management";
  gameState.seasonState.preSeasonWorkflowLogs = [
    ...(gameState.seasonState.preSeasonWorkflowLogs ?? []),
    {
      logId: "season-end-contract-tick__test",
      saveId: "test",
      fromSeasonId: gameState.season.id,
      toSeasonId: gameState.season.id,
      stepId: SEASON_END_CONTRACT_TICK_STEP_ID,
      status: "applied",
      createdAt: new Date(0).toISOString(),
    } as NonNullable<typeof gameState.seasonState.preSeasonWorkflowLogs>[number],
  ];
  return gameState;
}

describe("Verträge-Tabelle: die Restlaufzeit kommt aus der Endsaison", () => {
  it("nach der Alterung heißt Laufzeit 1 „noch eine volle Saison“ — und nicht „läuft aus“", () => {
    const gameState = saisonendeNachDerAlterung();
    const teamId = gameState.teams[0].teamId;
    const eintrag = gameState.rosters.find((row) => row.teamId === teamId)!;
    eintrag.contractLength = 1;
    delete (eintrag as { contractEndSeasonNumber?: number }).contractEndSeasonNumber;

    const zeile = buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" }).rows.find(
      (row) => row.playerId === eintrag.playerId,
    )!;

    expect(zeile.contractLength).toBe(1);
    expect(zeile.restlaufzeitSaisons).toBe(2);
    expect(zeile.laeuftAus).toBe(false);
  });

  it("eine gespeicherte Endsaison schlägt den Countdown", () => {
    const gameState = saisonendeNachDerAlterung();
    const teamId = gameState.teams[0].teamId;
    const eintrag = gameState.rosters.find((row) => row.teamId === teamId)!;
    // Genau Xelaras Fall nach der Verlängerung: Countdown 1, Endsaison 2.
    eintrag.contractLength = 1;
    eintrag.contractEndSeasonNumber = 2;

    const zeile = buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" }).rows.find(
      (row) => row.playerId === eintrag.playerId,
    )!;

    expect(zeile.restlaufzeitSaisons).toBe(2);
    expect(zeile.laeuftAus).toBe(false);
  });

  it("ein Vertrag, der wirklich mit dieser Saison endet, läuft aus", () => {
    const gameState = saisonendeNachDerAlterung();
    const teamId = gameState.teams[0].teamId;
    const eintrag = gameState.rosters.find((row) => row.teamId === teamId)!;
    eintrag.contractLength = 1;
    eintrag.contractEndSeasonNumber = 1;

    const zeile = buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" }).rows.find(
      (row) => row.playerId === eintrag.playerId,
    )!;

    expect(zeile.restlaufzeitSaisons).toBe(1);
    expect(zeile.laeuftAus).toBe(true);
  });

  it("während der laufenden Saison bleibt der Countdown die Restlaufzeit", () => {
    // Ohne Alterung gibt es keinen Versatz — sonst wäre jeder Vertrag mitten in der Saison zu lang.
    const gameState = structuredClone(createSingleplayerGameState());
    const teamId = gameState.teams[0].teamId;
    const eintrag = gameState.rosters.find((row) => row.teamId === teamId)!;
    eintrag.contractLength = 3;
    delete (eintrag as { contractEndSeasonNumber?: number }).contractEndSeasonNumber;

    const zeile = buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" }).rows.find(
      (row) => row.playerId === eintrag.playerId,
    )!;

    expect(zeile.restlaufzeitSaisons).toBe(3);
    expect(zeile.laeuftAus).toBe(false);
  });
});

describe("Die Tabelle fragt nicht mehr den rohen Countdown", () => {
  it("keine Zeile der Verträge-Karte entscheidet über `contractLength <= 1`", () => {
    // Das war die eigentliche Fehlerquelle: dieselbe Bedingung an rund zehn Stellen, jede für sich
    // im Saisonende-Fenster um eine Saison daneben.
    expect(panel).not.toContain("row.contractLength <= 1");
    expect(panel).not.toContain("left.row.contractLength <= 1");
    expect(panel).not.toContain("right.row.contractLength <= 1");
  });

  it("das Restlaufzeiten-Fach zählt die abgeleitete Laufzeit", () => {
    expect(panel).toContain("Number.isFinite(row.restlaufzeitSaisons) ? row.restlaufzeitSaisons : null");
  });

  it("der LZ-Chip zeigt die abgeleitete Laufzeit", () => {
    expect(panel).toContain("{formatWholeNumber(row.restlaufzeitSaisons)}");
  });
});

/**
 * DER BUILD-BRUCH, DEN DIESE ZEILE FAST GEKOSTET HAT.
 *
 * `contract-negotiation-preview.ts` liegt im CLIENT-Bundle (über
 * `use-foundation-shell-router-body-scope` → `FoundationPageClient`). Der erste Anlauf holte
 * `hasSeasonEndContractTickApplied` aus `contract-renewal-service` — und das Modul zieht
 * `node:crypto` herein. Webpack brach ab:
 *
 *     UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins
 *       node:crypto → contract-renewal-service.ts → contract-negotiation-preview.ts
 *       → use-foundation-shell-router-body-scope.tsx → FoundationPageClient.tsx
 *
 * Die Prüfung ist reines Lesen aus dem GameState und liegt deshalb jetzt in
 * `saisonende-alterung-marke.ts`, wo auch der Browser sie stellen darf. Der Wächter hält den
 * kurzen Weg zurück in den Server-Pfad zu — `npx tsc --noEmit` merkt davon nichts, erst der
 * Produktions-Build.
 */
describe("Das Client-Bundle bleibt frei von node:crypto", () => {
  const vorschau = readFileSync(join(process.cwd(), "lib/market/contract-negotiation-preview.ts"), "utf8");

  it("die Vorschau importiert nicht den Verlängerungs-Service", () => {
    expect(vorschau).not.toContain('from "@/lib/contracts/contract-renewal-service"');
  });

  it("sie holt den Alterungs-Marker aus dem client-sicheren Modul", () => {
    expect(vorschau).toContain('from "@/lib/contracts/saisonende-alterung-marke"');
  });

  it("das client-sichere Modul zieht selbst nichts aus node: herein", () => {
    const marke = readFileSync(join(process.cwd(), "lib/contracts/saisonende-alterung-marke.ts"), "utf8");
    // Nur echte Import-Zeilen, nicht die Fehlermeldung im Kommentar darueber.
    const importZeilen = marke.split("\n").filter((zeile) => /^\s*(import|export)\b.*\bfrom\b/.test(zeile));
    expect(importZeilen.filter((zeile) => zeile.includes('"node:'))).toEqual([]);
    expect(marke).not.toContain('require("node:');
  });
});

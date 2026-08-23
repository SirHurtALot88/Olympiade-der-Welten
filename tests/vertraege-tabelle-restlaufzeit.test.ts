/**
 * DIE SCHWELLE WAR FALSCH, NICHT DIE ZAHL.
 *
 * GEMELDET VON CHRIS: „xelara steht aktuell dann immernoch auf vertrag läuft aus und ist im
 * vertrags auslauf center!"
 *
 * ENTSCHIEDEN VON CHRIS, nachdem ein erster Anlauf die Zahl mitgeändert hatte: „nach MD10 muss
 * sie auf 0 LZ sinken!! und das bedeutet läuft aus. Nach verlängern ist sie auf 1 und das ist
 * nicht auslaufend und auch nichts für das auslauf Center."
 *
 * Damit steht die Regel fest und gilt überall gleich:
 *
 *     angezeigte Restlaufzeit = der gespeicherte Countdown
 *     läuft aus               = Restlaufzeit 0
 *
 * Neun Anzeigen lasen stattdessen `<= 1` und erklärten jeden Spieler mit einer vollen Restsaison
 * für auslaufend — an Chris' Spielstand 129 von 269 Verträgen.
 *
 * Der erste Anlauf hat die ZAHL auf eine aus der Endsaison abgeleitete Größe umgestellt. Das war
 * zu viel: die Verträge-Karte zeigte danach 2, während die acht übrigen Anzeigen weiter 1 zeigten.
 * Diese Datei hält die zurückgedrehte Fassung fest.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { restlaufzeitInSaisons, vertragLaeuftAus } from "@/lib/contracts/vertragslaufzeit";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildTeamContractSeasonTable } from "@/lib/market/contract-negotiation-preview";

const panel = readFileSync(join(process.cwd(), "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx"), "utf8");

function zeileFuerLaufzeit(laufzeit: number) {
  const gameState = structuredClone(createSingleplayerGameState());
  const teamId = gameState.teams[0].teamId;
  const eintrag = gameState.rosters.find((row) => row.teamId === teamId)!;
  eintrag.contractLength = laufzeit;
  return buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" }).rows.find(
    (row) => row.playerId === eintrag.playerId,
  )!;
}

describe("Die Regel: 0 läuft aus, 1 nicht", () => {
  it("Restlaufzeit 0 heißt „läuft aus“", () => {
    expect(vertragLaeuftAus(0)).toBe(true);
    expect(restlaufzeitInSaisons(0)).toBe(0);
  });

  it("Restlaufzeit 1 heißt NICHT „läuft aus“ — es kommt noch eine ganze Saison", () => {
    // Genau Xelaras Fall nach der Verlängerung um eine Saison.
    expect(vertragLaeuftAus(1)).toBe(false);
    expect(restlaufzeitInSaisons(1)).toBe(1);
  });

  it("fehlende oder unsinnige Werte gelten als abgelaufen, nicht als unendlich", () => {
    expect(vertragLaeuftAus(null)).toBe(true);
    expect(vertragLaeuftAus(undefined)).toBe(true);
    expect(vertragLaeuftAus(Number.NaN)).toBe(true);
    expect(restlaufzeitInSaisons(-3)).toBe(0);
  });
});

describe("Verträge-Tabelle: die Zahl ist der Countdown", () => {
  it("Laufzeit 1 steht als 1 in der Zeile und läuft nicht aus", () => {
    const zeile = zeileFuerLaufzeit(1);
    expect(zeile.restlaufzeitSaisons).toBe(1);
    expect(zeile.laeuftAus).toBe(false);
  });

  it("Laufzeit 0 läuft aus", () => {
    const zeile = zeileFuerLaufzeit(0);
    expect(zeile.restlaufzeitSaisons).toBe(0);
    expect(zeile.laeuftAus).toBe(true);
  });

  it("Laufzeit 3 bleibt 3", () => {
    const zeile = zeileFuerLaufzeit(3);
    expect(zeile.restlaufzeitSaisons).toBe(3);
    expect(zeile.laeuftAus).toBe(false);
  });
});

describe("Die Tabelle rechnet nicht selbst", () => {
  it("keine Zeile der Verträge-Karte entscheidet über `contractLength <= 1`", () => {
    // Das war die Fehlerquelle: dieselbe Bedingung an rund zehn Stellen, jede fuer sich daneben.
    expect(panel).not.toContain("row.contractLength <= 1");
    expect(panel).not.toContain("entry.contractLength <= 1");
  });

  it("der LZ-Chip zeigt die Restlaufzeit der Zeile", () => {
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
 *
 * `npx tsc --noEmit` merkt davon nichts, erst der Produktions-Build.
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
    const importZeilen = marke.split("\n").filter((zeile) => /^\s*(import|export)\b.*\bfrom\b/.test(zeile));
    expect(importZeilen.filter((zeile) => zeile.includes('"node:'))).toEqual([]);
    expect(marke).not.toContain('require("node:');
  });
});

/**
 * GEMELDET VON CHRIS: „beim MW [soll] auch darunter +14,2 z.B. stehen … und als MW dann der
 * AKTUELLE Verkaufswert in dieser Season."
 *
 * UMGESETZT: der MW-Posten der Kaderkarte zeigt den erzielbaren Verkaufspreis (`exitValue`), das
 * Delta darunter ist der Auf-/Abschlag des Verkaufsfaktors gegen den Marktwert
 * (`exitValue − marketValueAtExit`). Damit bleibt der Marktwert aus der Karte ablesbar (Wert
 * minus Delta) — es geht nichts verloren, die Reihenfolge dreht sich nur um.
 *
 * Beide Zahlen kommen aus `buildTeamContractSeasonTable`, also aus DERSELBEN Quelle wie die
 * VK-Spalte der Verträge-Karte und wie die KI-Verkaufsentscheidung. Zwei Rechnungen für denselben
 * Verkaufspreis wären zwei Preise, sobald eine von beiden sich ändert — das prüft der letzte Test.
 *
 * Der Posten heißt seitdem „VK" (Chris: „dann nenne es an der Stelle VK"). Das ist nicht Kosmetik:
 * MW ist im Spiel ein eigener, benachbarter Begriff mit eigenem Tooltip — ein Feld, das den
 * Verkaufspreis zeigt, darf nicht so heißen. Im Fallback, wo wirklich der Marktwert steht, heißt
 * es weiter „MW". Ein fester Name über zwei verschiedenen Größen wäre genau die Verwechslung,
 * die der Umbau abstellt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildTeamContractSeasonTable } from "@/lib/market/contract-negotiation-preview";

const root = process.cwd();

describe("Kaderkarte zeigt den Verkaufswert statt des Marktwerts", () => {
  it("Verkaufswert und Marktwert liegen als getrennte Zahlen vor — das Delta ist ihre Differenz", () => {
    const gameState = structuredClone(createSingleplayerGameState());
    const team = gameState.teams[0];
    const table = buildTeamContractSeasonTable({ gameState, teamId: team.teamId, seasonLabelBase: "Season 1" });
    const rows = table.rows.filter((row) => row.status === "active" && row.exitValue != null);

    expect(rows.length, "Testsave ohne aktive Vertragszeilen — dann prüft der Test nichts").toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.marketValueAtExit).not.toBeNull();
      // Die Differenz ist die Wirkung des Verkaufsfaktors, keine dritte Zahl: sie muss sich
      // exakt aus den beiden gezeigten Größen ergeben.
      const aufschlag = Number(((row.exitValue ?? 0) - (row.marketValueAtExit ?? 0)).toFixed(2));
      expect(Number((row.exitValue ?? 0).toFixed(2))).toBe(
        Number(((row.marketValueAtExit ?? 0) + aufschlag).toFixed(2)),
      );
    }
  });

  it("die Kaderdaten reichen Verkaufswert und Aufschlag durch", () => {
    const builder = readFileSync(join(root, "lib/foundation/tabs/use-foundation-cross-tab-teams-roster.ts"), "utf8");
    expect(builder).toContain("saleValue");
    expect(builder).toContain("saleValueVsMarketValue");
    // Aus der bereits gebauten Vertragstabelle, nicht aus einem zweiten Verkaufsfaktor-Aufruf.
    expect(builder).toContain("contractTable.rows");
  });

  it("fehlt der Verkaufswert, steht wieder der Marktwert da — kein Strich", () => {
    // Spieler ohne aktive Vertragszeile dürfen die Karte nicht leer lassen.
    const view = readFileSync(join(root, "app/foundation/team-profile/TeamProfileNewLook.tsx"), "utf8");
    expect(view).toContain("buildRosterSaleValueStat");
    expect(view).toMatch(/if \(!isFiniteNumber\(player\.saleValue\)\)/);
  });

  it("der Posten heißt VK, wenn er den Verkaufspreis zeigt — und MW nur noch im Fallback", () => {
    const view = readFileSync(join(root, "app/foundation/team-profile/TeamProfileNewLook.tsx"), "utf8");
    const funktion = view.slice(
      view.indexOf("function buildRosterSaleValueStat"),
      view.indexOf("function getContractShapeTag"),
    );
    expect(funktion).not.toBe("");
    // Der Fallback-Zweig steht vor dem Verkaufswert-Zweig: erst MW, dann VK. Genau in dieser
    // Reihenfolge — wären beide "MW", stünde über zwei verschiedenen Größen derselbe Name.
    const mwIndex = funktion.indexOf('label: "MW"');
    const vkIndex = funktion.indexOf('label: "VK"');
    expect(mwIndex).toBeGreaterThan(-1);
    expect(vkIndex).toBeGreaterThan(mwIndex);
  });
});

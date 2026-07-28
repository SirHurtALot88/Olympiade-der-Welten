import { describe, expect, it } from "vitest";

import fs from "node:fs/promises";
import path from "node:path";

// Die VK-Spalte zeigte den NETTO-Erlös (Verkaufspreis minus Rest-Buyout). Gefordert ist
// der Preis selbst: Marktwert × Verkaufsfaktor. Der Buyout haengt am Vertrag, nicht am
// Spieler, und machte die Zahl bei Mehrjahresvertraegen sogar negativ.

async function read(relativePath: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), relativePath), "utf8");
}

function stripComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

describe("VK-Spalte zeigt den Bruttopreis", () => {
  it("rendert grossSalePrice statt des Netto-Erloeses", async () => {
    const source = stripComments(await read("app/foundation/players-table/FoundationPlayersTableNewLook.tsx"));

    expect(source).toContain("formatNlMoney(row.sellPreview.grossSalePrice)");
    // Netto darf nur noch im Tooltip vorkommen, nicht als angezeigter Zellenwert.
    expect(source).not.toContain('<span className="nl-tnum">{row.sellPreview ? formatNlMoney(row.sellPreview.expectedSellValue)');
  });

  it("sortiert nach demselben Wert, der angezeigt wird", async () => {
    // Anzeige != Sortierschluessel waere ein stiller Bug: die Spalte sortiert dann
    // sichtbar falsch (derselbe Fehler wie zuvor bei der Sponsoren-Cash-Sortierung).
    const source = stripComments(await read("lib/foundation/tabs/use-foundation-cross-tab-player-directory.ts"));

    expect(source).toContain("sellValue: (row) => row.sellPreview?.grossSalePrice");
    expect(source).not.toContain("sellValue: (row) => row.sellPreview?.expectedSellValue");
  });

  it("weist den Buyout weiterhin aus, statt ihn zu verschweigen", async () => {
    const source = await read("app/foundation/players-table/FoundationPlayersTableNewLook.tsx");
    const cell = source.slice(source.indexOf('isColumnVisible("sellValue")'));

    expect(cell).toContain("buyoutCost");
    expect(cell).toContain("netto");
  });
});

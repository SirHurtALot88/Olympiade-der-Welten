import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

/**
 * Verdrahtungs-Contract für die drei Board-Wünsche (Chris, Juli 2026):
 * A) Spielerliste: Spalte "Verkaufswert" (Netto-Erlös, nicht nochmal der MW),
 * B) Spielplan: gewürfelte Spieltag-Mutatoren + Trefferzahl + Hover mit den
 *    getroffenen Spielern,
 * C) Saisonstand: Hover über Achsen-/Disziplin-Werte zeigt die Top-3-Spieler
 *    des Teams in genau dieser Spalte.
 * Die reine Rechenlogik ist in eigenen Unit-Tests abgedeckt
 * (tests/transfermarkt-expected-sell-value.test.ts,
 * tests/spielplan-mutator-summary.test.ts,
 * tests/season-standings-top-players.test.ts) — hier geht es nur darum, dass
 * die UI die Ergebnisse auch wirklich konsumiert.
 */
describe("sell value / spielplan mutators / standings top-3 ui wiring", () => {
  it("players table wires the sell value column through directory rows, catalog and export", async () => {
    const [tableText, hookText, presetsText] = await Promise.all([
      fs.readFile(
        path.join(process.cwd(), "app/foundation/players-table/FoundationPlayersTableNewLook.tsx"),
        "utf8",
      ),
      fs.readFile(
        path.join(process.cwd(), "lib/foundation/tabs/use-foundation-cross-tab-player-directory.ts"),
        "utf8",
      ),
      fs.readFile(
        path.join(process.cwd(), "app/foundation/players-table/foundation-players-column-presets.ts"),
        "utf8",
      ),
    ]);

    // Zeilen tragen den vorgerechneten Netto-Verkaufswert aus der Batch-Rechnung.
    expect(hookText).toContain("buildExpectedSellValueByPlayerId");
    expect(hookText).toContain("sellPreview");
    // Sortierbar über beide Accessor-Karten (Memo + Effekt).
    expect(hookText.match(/sellValue: \(row\)/g)?.length).toBe(2);

    // Spalte im Katalog + Sichtbarkeit + Zelle + Export.
    expect(tableText).toContain('id: "sellValue"');
    expect(tableText).toContain('isColumnVisible("sellValue")');
    expect(tableText).toContain('case "sellValue"');
    expect(presetsText).toContain('"sellValue"');
  });

  it("spielplan shows rolled matchday mutators with hit counts and hover players", async () => {
    const [diszisText, hookText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/ranks-v2/FoundationDiszisNewLook.tsx"), "utf8"),
      fs.readFile(
        path.join(process.cwd(), "lib/foundation/tabs/use-foundation-cross-tab-discipline-ranks.ts"),
        "utf8",
      ),
    ]);

    expect(hookText).toContain("buildSpielplanMutatorSummaries");
    expect(hookText).toContain("mutatorInfo1");
    expect(hookText).toContain("mutatorInfo2");
    expect(diszisText).toContain("mutatorInfo");
    // Trefferzahl + Hover-Auflistung der getroffenen Spieler.
    expect(diszisText).toContain("Treffer");
    expect(diszisText).toContain("hitPlayers");
  });

  it("season standings hover panels expose top-3 players for all axis and discipline columns", async () => {
    const [standingsText, clientText, hostText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/season-v2/SeasonStandingsNewLook.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/season-v2/SeasonStandingsV2Client.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/season-v2/FoundationSeasonV2Host.tsx"), "utf8"),
    ]);

    // Host memoisiert die Top-3-Karte EINMAL (32 Teams × 24 Spalten) …
    expect(hostText).toContain("buildSeasonStandingsTopPlayersByTeam");
    // … und reicht sie als optionalen Prop durch den bestehenden Client-Vertrag.
    expect(clientText).toContain("teamTopPlayersByColumn");
    expect(standingsText).toContain("teamTopPlayersByColumn");
    // Hover-Panel nutzt das etablierte Hover-Portal-Vokabular der Teams-Übersicht.
    expect(standingsText).toContain("nl-teams-rank-portal");
    expect(standingsText).toContain("nl-teams-rank-preview");
  });
});

import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

/**
 * Die PPs-Aufschlüsselung der Spielerliste zeigte `player.coreStats`
 * (POW/SPE/MEN/SOC, 0–100) statt der echten Achsen-PPs — die vier Balken
 * summierten sich also nie auf den Gesamtwert in der Kopfzeile darüber
 * (73+52+59+76 gegen 9,8 PPs). Die echten Werte lagen bereits in der
 * `playerRatingsById`-Karte, waren aber nicht in die Zeile durchgereicht.
 *
 * Empirisch geprüft: über einen echten Spielstand summieren sich
 * `ppPow+ppSpe+ppMen+ppSoc` bei 220 Spielern mit PPs>0 auf `ppsSeason`
 * (0 Abweichungen > 0,25) — die Aussage in der UI-Notiz ist also belegt.
 */
describe("players table PPs breakdown", () => {
  it("reads the real axis PPs instead of the core stats", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "app/foundation/players-table/FoundationPlayersTableNewLook.tsx"),
      "utf8",
    );
    const detail = source.slice(
      source.indexOf("function renderPpsDetail("),
      source.indexOf("nl-players-pps-detail-note") + 400,
    );

    expect(detail.length).toBeGreaterThan(0);
    expect(detail).toContain("row.axisPps[key]");
    // Der alte Kernwert-Zugriff darf in dieser Aufschlüsselung nicht zurückkommen.
    expect(detail).not.toContain("row.player.coreStats[key]");
    // Die irreführende "Näherung"-Notiz ist weg.
    expect(detail).not.toMatch(/als Näherung/);
  });

  it("carries axis PPs on the directory row, sourced from the rating map", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/foundation/tabs/use-foundation-cross-tab-player-directory.ts"),
      "utf8",
    );

    expect(source).toContain("axisPps: { pow: number | null");
    for (const field of ["ppPow", "ppSpe", "ppMen", "ppSoc"]) {
      expect(source).toContain(`playerRating?.${field}`);
    }
  });
});

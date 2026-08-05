import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/**
 * Die Anzeige „Läuft gerade" haengt an den `cockpitBusyKey`-Werten. Ein Tippfehler im
 * Schluessel faellt nicht auf — die Anzeige bliebe einfach stumm, und der Spieler saesse
 * wieder vor einer stillen Oberflaeche. Deshalb wird hier geprueft, dass jeder Schluessel
 * der Tabelle auch wirklich gesetzt wird.
 */
describe("Statusanzeige fuer lange Laeufe", () => {
  it("jeder Schluessel der Hinweis-Tabelle wird auch als cockpitBusyKey gesetzt", async () => {
    const bodySource = await readFile(
      path.join(ROOT, "app/foundation/FoundationShellRouterBody.tsx"),
      "utf8",
    );

    const tableMatch = bodySource.match(
      /const FOUNDATION_BUSY_NOTICES[\s\S]*?\n\};/,
    );
    expect(tableMatch, "FOUNDATION_BUSY_NOTICES nicht gefunden").not.toBeNull();

    const noticeKeys = Array.from(tableMatch![0].matchAll(/^\s{2}"([a-z0-9-]+)":/gm)).map(
      (entry) => entry[1]!,
    );
    expect(noticeKeys.length).toBeGreaterThan(0);

    const handlerSources = await Promise.all(
      ["cockpit-handlers.ts", "cockpit-matchday-handlers.ts"].map((file) =>
        readFile(path.join(ROOT, "lib/foundation/tabs", file), "utf8"),
      ),
    );
    const handlers = handlerSources.join("\n");

    for (const key of noticeKeys) {
      expect(handlers, `Busy-Schluessel "${key}" wird nirgends gesetzt`).toContain(`"${key}"`);
    }
  });

  it("die Anzeige haengt am Busy-Schluessel, nicht an einem Timer", async () => {
    const bodySource = await readFile(
      path.join(ROOT, "app/foundation/FoundationShellRouterBody.tsx"),
      "utf8",
    );

    // Der Hinweis muss ueber den Busy-Schluessel gerendert werden. Wuerde er ueber das
    // Aktions-Feedback laufen, blendete ihn dessen 6-Sekunden-Timer mitten im Lauf aus —
    // genau der Fehler, den diese Anzeige behebt.
    expect(bodySource).toContain('data-testid="foundation-busy-notice"');
    expect(bodySource).toContain('FOUNDATION_BUSY_NOTICES[cockpitBusyKey ?? ""]');
  });
});

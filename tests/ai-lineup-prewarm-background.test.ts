import { describe, expect, it } from "vitest";

import fs from "node:fs/promises";
import path from "node:path";

/**
 * DAS AUFWAERMEN DER KI-AUFSTELLUNGEN LAEUFT IM HINTERGRUND.
 *
 * Der Spieltagswechsel schreibt nur noch den Spieltag; die Aufstellungen fuer den neuen
 * Spieltag (gemessen 15-21 s fuer 32 Teams) holt das Cockpit nach, sobald der Spieler
 * wieder im Saisonstand steht.
 *
 * Die beiden tragenden Eigenschaften lassen sich nicht sinnvoll ueber einen gerenderten
 * Client pruefen — diese Suite laeuft ohne DOM, und der Ablauf haengt an einem
 * nicht-abgewarteten `fetch`. Festgehalten werden sie deshalb an der Quelle, wie es in
 * diesem Projekt fuer Oberflaechen-Vertraege ueblich ist.
 */

async function readSource(relativePath: string) {
  return fs.readFile(path.join(process.cwd(), relativePath), "utf8");
}

describe("KI-Aufstellungen werden im Hintergrund aufgewaermt", () => {
  it("stoesst das Cockpit nach dem Spieltags-Lauf an, ohne darauf zu warten", async () => {
    const source = await readSource("lib/foundation/tabs/cockpit-matchday-handlers.ts");

    expect(source).toContain("startAiLineupPrewarm");
    expect(source).toContain("/api/lineups/legacy/ai-batch-prewarm");

    // NICHT abgewartet: ein `await` hier wuerde die Wartezeit nur verschieben statt
    // nehmen — der Auto-Run liefe dann wieder 15-21 s laenger.
    const aufruf = source.slice(source.indexOf("function startAiLineupPrewarm"));
    expect(aufruf).toContain("void (async () =>");

    // Und der Anstoss darf die Oberflaeche nicht sperren: `cockpitBusyKey` deaktiviert
    // die Schalter, gesperrt werden soll hier gerade nichts.
    const koerper = aufruf.slice(0, aufruf.indexOf("\n  async function"));
    expect(koerper).not.toContain("setCockpitBusyKey");
  });

  it("erzeugt die Aufstellungen NICHT mehr im Spieltagswechsel", async () => {
    const source = await readSource("lib/season/matchday-progress-service.ts");

    // Der teure Batch ist hier vollstaendig raus — auch der Import.
    expect(source).not.toContain("applyAiLegacyLineupBatchLocally");
    // Die Trainingsmodi bleiben, sie sind billig und ordnungskritisch.
    expect(source).toContain("reevaluateAiTrainingModesForMatchday");
  });

  it("leitet den Spieltag serverseitig ab, statt ihn den Client raten zu lassen", async () => {
    const source = await readSource("app/api/lineups/legacy/ai-batch-prewarm/route.ts");

    // Der Client haelt nach dem Wechsel noch den ALTEN Spieltag in der Hand — der Server
    // liest den jetzt gueltigen aus dem Spielstand.
    expect(source).toContain("save.gameState.matchdayState?.matchdayId");
    // Vorhandene Aufstellungen bleiben stehen: der Lauf ist idempotent.
    expect(source).toContain("overwriteExisting: false");
    // Kein Schreiben am Saisonende oder in einer anderen Saison.
    expect(source).toContain("no_active_matchday_for_season");
  });

  it("laesst das Sicherheitsnetz unangetastet: der Spieltags-Lauf stellt selbst auf", async () => {
    const source = await readSource("lib/season/matchday-auto-run-service.ts");

    // Faellt der Hintergrundlauf aus, holt dieser Aufruf die Aufstellungen nach. Ohne ihn
    // waere die Auslagerung nicht nur langsamer, sondern falsch.
    expect(source).toContain("applyAiLegacyLineupBatchLocally(");
  });
});

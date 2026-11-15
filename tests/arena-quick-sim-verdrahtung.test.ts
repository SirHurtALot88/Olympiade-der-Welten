import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * QUICK-SIM-VERDRAHTUNG (27.10.): NUR der "⏩ Quick-Sim"-Knopf darf den Node-Vorlauf ausloesen —
 * vom Knopf ueber die Buchung bis in den Auto-Run. Jeder andere Weg (Zuschauen bis zum Ende,
 * Cockpit, Lineup-Routen, Skripte) bleibt beim Chromium-Vorlauf. Quelltext-Pruefung im Stil von
 * `arena-buchung-ohne-state-umweg.test.ts`: die Kette ist ueber vier Dateien verteilt, und jede
 * fehlende Stelle wuerde lautlos auf den langsamen Pfad zurueckfallen.
 */

const root = process.cwd();
const lies = (datei: string) => readFileSync(join(root, datei), "utf8");
const ohneKommentare = (quelle: string) => quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("Quick-Sim-Verdrahtung", () => {
  it("die Buehne meldet Quick-Sim VOR dem Endstand und bucht dann mit quickSim", () => {
    const nativ = ohneKommentare(lies("app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx"));
    const quickSimRumpf = nativ.slice(nativ.indexOf("const quickSim = useCallback("), nativ.indexOf("function causeKick("));
    expect(quickSimRumpf.indexOf("onQuickSim?.()")).toBeGreaterThanOrEqual(0);
    expect(quickSimRumpf.indexOf("onQuickSim?.()")).toBeLessThan(quickSimRumpf.indexOf("later(showPodium"));

    const arena = ohneKommentare(lies("app/foundation/discipline-stage/DisciplineStageArena.tsx"));
    expect(arena).toContain("quickSimDisziplinenRef.current.add(disciplineId)");
    expect(arena).toMatch(/onCommitDiscipline\(side, preview, perQuickSim \? \{ quickSim: true \} : undefined\)/);
  });

  it("die Buchung schickt arenaQuickSim nur beim ersten Versuch, Folge-Polls ohne", () => {
    const scope = ohneKommentare(lies("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"));
    const rumpf = scope.slice(scope.indexOf("async function commitArenaDiscipline("), scope.indexOf("async function finishMatchdayAndAdvance"));
    expect(rumpf).toContain("...(optionen.quickSim && pollVersuch === 0 ? { arenaQuickSim: true } : {})");
    expect(rumpf).toContain("return commitArenaDiscipline(side, shownPreview, optionen, pollVersuch + 1)");
  });

  it("Handler und Route reichen das Flag durch, ohne es zum Standard zu machen", () => {
    const handler = ohneKommentare(lies("lib/foundation/tabs/cockpit-matchday-handlers.ts"));
    expect(handler).toContain("...(optionOverrides.arenaQuickSim ? { arenaQuickSim: true } : {})");
    const route = ohneKommentare(lies("app/api/season/matchday-auto-run/route.ts"));
    expect(route).toContain('arenaModus: body.options?.arenaQuickSim === true ? "quick-sim" : "hintergrund"');
  });

  it("nur der Modus quick-sim nimmt den Node-Runner; der Vorlauf-Default bleibt Chromium", () => {
    const autoRun = ohneKommentare(lies("lib/season/matchday-auto-run-service.ts"));
    expect(autoRun).toMatch(/arenaModus === "quick-sim"\)\s*\{\s*const quickSim = await beschleunigeArenaVorlaufPerQuickSim\(/);
    const vorlauf = ohneKommentare(lies("lib/battle/arena-vorlauf-service.ts"));
    // Genau zwei Vorkommen: der Import und die eine Verwendung im Quick-Sim-Rumpf.
    expect(vorlauf.match(/runArenaFixturesNode\b/g)?.length).toBe(2);
    const quickSimRumpf = vorlauf.slice(vorlauf.indexOf("export async function beschleunigeArenaVorlaufPerQuickSim"));
    expect(quickSimRumpf).toContain("options.runArenaFixturesNodeImpl ?? runArenaFixturesNode");
  });
});

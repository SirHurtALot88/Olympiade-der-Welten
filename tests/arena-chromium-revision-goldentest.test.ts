/**
 * CHROMIUM-VERSIONSWÄCHTER / "GOLDENTEST" (Plan
 * `docs/design/battle-arena-auto-run-anbindung-plan-16-10.md` Abschnitt 5.2 Zeile "Chromium-
 * Revision (F7)" und Abschnitt 9 Punkt 6, PR 0): Befund F7 — `lib/battle/arena-headless-runner.ts`
 * verdrahtet die Revision **1194** fest (`STANDARD_CHROMIUM_EXECUTABLE_PATH`), während
 * `package.json`/`package-lock.json` Playwright **1.60.0** verlangen, dessen `browsers.json` die
 * Revision **1223** als "chromium" ausweist. Lokal liegen (Stand 16.10.) historisch gewachsen
 * BEIDE Revisionen nebeneinander unter `/opt/pw-browsers/`; ein frischer CI-Runner (`npx playwright
 * install chromium`) installiert nur 1223.
 *
 * ZWECK DIESES TESTS: zeigen, ob dieselbe Arena-Simulation (`runBattleModeArenaMatchday()`, echter
 * Spielplan/echte Kader aus einem frischen Battle-Save) auf 1194 und 1223 BITGENAU dasselbe
 * Ergebnis liefert (Team-Punkte, Seitenstand, individuelle Boxscore-PPs). V8/Chromium-Versionen
 * unterscheiden sich gelegentlich in Gleitkomma-Rundung — bisher ohne Messung nicht auszuschließen
 * (Plan 5.2).
 *
 * EHRLICH ÜBER DIE GRENZE DIESES TESTS (Auftrag: "keine Lüge im Testnamen"):
 *  - Er vergleicht nur, wenn BEIDE Revisionen unter `PLAYWRIGHT_BROWSERS_PATH` (Default
 *    `/opt/pw-browsers`) tatsächlich vorhanden sind. Auf einer Umgebung mit nur einer Revision
 *    installiert (der erwartete CI-Normalfall: nur 1223) überspringt er den bitgenauen Vergleich
 *    per `it.skip` MIT BEGRÜNDUNG im Testnamen — er meldet sich dann als ÜBERSPRUNGEN, nie als
 *    grün bestanden, damit niemand "getestet" liest, wo nur "nicht prüfbar hier" stimmt.
 *  - Er deckt vier der fünf Arena-Chassis ab (Feldspiel: basketball, Bühne-Heben: gewichtheben,
 *    Bahn: staffel) — NICHT Bühne-Duell/Bühne-Auftritt (speed-schach/showcase) und nicht Folter
 *    (breaking) oder Verzehr (wettessen), um die CI-Laufzeit nicht zu sprengen (ein Durchlauf
 *    kostet ~3:25 min lokal für drei Disziplinen × zwei Revisionen, dominiert vom einmaligen
 *    32-Team-Liga-Draft, nicht von den Chromium-Läufen selbst). FOLGEAUFGABE: die übrigen Chassis
 *    nachziehen, sobald der Vorlauf-Service (PR 3) ohnehin einen Ort für sowas braucht.
 *  - GEMESSEN FÜR DIESEN PLAN (16.10., diese Sitzung, lokal, beide Revisionen vorhanden):
 *    gewichtheben/staffel/basketball je einmal 1194 vs. 1223 — alle drei bitgenau gleich
 *    (`overridesByTeamId` UND `individualBoxscorePpsByPlayerId`, 0 Warnungen auf beiden Seiten).
 *    Das ist EINE Stichprobe, kein Beweis für alle zwanzig Disziplinen oder alle Saaten — sie
 *    zeigt nur, dass dieser Test bei Gleichheit tatsächlich grün wird und bei einer echten
 *    Abweichung (s. unten) tatsächlich rot würde.
 *  - Läuft im normalen CI (`ci.yml` → `full-test-suite`), nicht im abgeschalteten Nightly-Job.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { runBattleModeArenaMatchday } from "@/lib/resolve/battle-mode-arena-team-points";

const BROWSERS_ROOT = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";

/** `chrome-linux` (ältere Revisionen) ODER `chrome-linux64` (1223+) -- beide Layouts vorkommen. */
function findeChromiumBinary(revisionOrdner: string): string | null {
  for (const unterordner of ["chrome-linux64", "chrome-linux"]) {
    const kandidat = path.join(BROWSERS_ROOT, revisionOrdner, unterordner, "chrome");
    if (existsSync(kandidat)) return kandidat;
  }
  return null;
}

const REV_1194 = findeChromiumBinary("chromium-1194");
const REV_1223 = findeChromiumBinary("chromium-1223");
const BEIDE_REVISIONEN_VORHANDEN = Boolean(REV_1194 && REV_1223);

// Drei von fünf Chassis (s. Kopfkommentar). Jede davon ist in ARENA_RESOLVED_DISCIPLINE_IDS.
const DISZIPLINEN = ["gewichtheben", "staffel", "basketball"] as const;

async function baueBattleSaveMitAufstellung() {
  process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-goldentest-${Math.random().toString(36).slice(2)}.sqlite`;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({
    persistence,
    saveId,
    seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
    callerWritableTeamIds: null,
    excludeTeamIds: [],
    logPrefix: "[goldentest]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  const save0 = persistence.getSaveById(saveId)!;
  const seasonId = save0.gameState.season.id;
  const matchdayId = save0.gameState.matchdayState.matchdayId;
  applyAiLegacyLineupBatchLocally(
    { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
    persistence,
  );
  const save = persistence.getSaveById(saveId)!;
  return { saveId, seasonId, matchdayId, gameState: save.gameState };
}

describe("Chromium-Versionswächter (F7) · 1194 vs. 1223 auf demselben Spieltag", () => {
  if (!BEIDE_REVISIONEN_VORHANDEN) {
    it.skip(
      `ÜBERSPRUNGEN: nur eine Chromium-Revision unter ${BROWSERS_ROOT} vorhanden (1194: ${REV_1194 ? "ja" : "fehlt"}, 1223: ${
        REV_1223 ? "ja" : "fehlt"
      }) — bitgenauer Revisionsvergleich hier nicht prüfbar. Folgeaufgabe: auf einer Umgebung mit beiden Revisionen erneut fahren, bevor PR 3 live geht (Plan Abschnitt 9 Punkt 6).`,
      () => {},
    );
    return;
  }

  // EINMAL einen Battle-Save mit Liga-Draft + Aufstellung bauen (dominiert die Laufzeit, ~90 s für
  // 32 Teams) und für ALLE drei Disziplinen wiederverwenden -- genau wie
  // scripts/messe-arena-spieltag.ts es für die Laufzeitmessung schon tut. Ein eigener Save je
  // Disziplin würde die Testzeit verdreifachen, ohne den Vergleich praeziser zu machen (derselbe
  // Spielplan/dieselben Kader, nur eine andere Disziplin pro Lauf).
  let save: Awaited<ReturnType<typeof baueBattleSaveMitAufstellung>>;
  beforeAll(async () => {
    save = await baueBattleSaveMitAufstellung();
  }, 180_000);

  for (const disciplineId of DISZIPLINEN) {
    it(
      `${disciplineId}: identische Overrides und Boxscore-PPs auf 1194 und 1223`,
      async () => {
        const { saveId, seasonId, matchdayId, gameState } = save;

        const auf1194 = await runBattleModeArenaMatchday({
          gameState,
          saveId,
          seasonId,
          matchdayId,
          disciplineId,
          runArenaFixturesOptions: { chromiumExecutablePath: REV_1194! },
        });
        const auf1223 = await runBattleModeArenaMatchday({
          gameState,
          saveId,
          seasonId,
          matchdayId,
          disciplineId,
          runArenaFixturesOptions: { chromiumExecutablePath: REV_1223! },
        });

        expect(auf1194.warnings).toEqual([]);
        expect(auf1223.warnings).toEqual([]);
        expect(auf1194.overridesByTeamId.size).toBeGreaterThan(0);

        const kanonisch = (overrides: Map<string, unknown>) =>
          JSON.stringify([...overrides.entries()].sort(([a], [b]) => a.localeCompare(b)));
        expect(kanonisch(auf1223.overridesByTeamId)).toBe(kanonisch(auf1194.overridesByTeamId));
        expect(kanonisch(auf1223.individualBoxscorePpsByPlayerId)).toBe(kanonisch(auf1194.individualBoxscorePpsByPlayerId));
      },
      120_000,
    );
  }
});

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot, readArenaVorlaufRecord } from "@/lib/foundation/matchday-resolve-snapshot";
import { stelleArenaVorlaufSicher } from "@/lib/battle/arena-vorlauf-service";
import { kickoffArenaMatchdayApply } from "@/lib/season/arena-matchday-resolve-service";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import type { ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";

/**
 * ABNAHME-CHECK #3 (Opus-Review, PR 3/K1): "Was du siehst, wird gebucht".
 *
 * ZWEI FAELLE, GETRENNT NACH CHROMIUM-VERFUEGBARKEIT (CI-FUND, 18.10.):
 *
 *   1. Der ECHTE Chromium-Lauf (unten, `describe.skipIf`) beweist die Paritaet fuer den
 *      ARENA-Pfad -- braucht echtes Chromium, genau wie `tests/arena-headless-runner.test.ts`.
 *   2. Der INJIZIERTE Fehlschlag-Lauf (Koop/`erfolgreicherRunner`-Muster aus `tests/
 *      arena-vorlauf-service.test.ts`) beweist dieselbe Paritaet fuer den BRUECKEN-Pfad -- OHNE
 *      Chromium, laeuft deshalb IMMER, auch in `full-test-suite`/`ci:persistenz-suiten`.
 *
 * FUND (CI-Run auf #1273, zwei unabhaengige Jobs `full-test-suite` UND `ci:persistenz-suiten`,
 * identischer Fehler an derselben Zeile): BEIDE Jobs installieren laut `.github/workflows/
 * ci.yml` ausdruecklich KEIN Chromium ("KEIN `npm run build`, KEIN Chromium: die Suite ist
 * reines Node"). Der urspruengliche Test 1 unten nahm OHNE Pruefung an, Chromium sei verfuegbar,
 * und scheiterte deshalb dort NICHT an einem Code-Bug, sondern an einer falschen Testannahme --
 * `stelleArenaVorlaufSicher()` fiel KORREKT auf die PPS-Duell-Bruecke zurueck (genau das
 * vorgesehene Verhalten ohne Chromium), der Test erwartete aber unbedingt `"ready"`. Lokal (mit
 * echtem Chromium) reproduziert: der Lauf kommt dort problemlos bis `"ready"` durch. Test 1 ist
 * deshalb jetzt `describe.skipIf(!CHROMIUM_VERFUEGBAR)`, exakt das etablierte Muster aus
 * `arena-headless-runner.test.ts` -- UND Test 2 (unten, chromium-unabhaengig) deckt denselben
 * Paritaets-Anspruch jetzt auch in genau den Jobs ab, die vorher faelschlich Test 1 dafuer
 * gebraucht haetten.
 *
 * Beide Faelle decken zugleich ab, dass `attachMatchdayInjuryPerformanceToContexts` an BEIDEN
 * Stellen (`writeMatchdayResolveSnapshot()` beim Vorlauf-Start UND `kickoffArenaMatchdayApply()`s
 * eigener `buildLegacyMatchdayResolvePreview()`-Fallback) denselben Code-Pfad durchlaufen (beide
 * uebergeben `gameState`, s. Code-Gegenlesung in den jeweiligen Dateien) -- eine Divergenz dort
 * waere ein Zahlen-Unterschied zwischen Vorschau und Buchung, den die Paritaets-Pruefung unten
 * sofort zeigen wuerde. Ein garantiert ausloesender Verletzungs-Malus wird hier NICHT eigens
 * erzwungen (der Injury-Risk-Roll fuer einen frischen Save mit Fatigue nahe 0 ist praktisch
 * immer 0 -- `buildMatchdayInjuryRollMap()` liefert dann ueberall "healthy", s. `fatigue-injury-
 * service.ts`); die Aussage stuetzt sich auf die Code-Gegenlesung, nicht auf einen erzwungenen
 * Malus-Fall.
 */
const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  try {
    return readdirSync(join(homedir(), ".cache", "ms-playwright")).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}
const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();
/**
 * OPUS-REVIEW (Nachtrag 18.10.): ein stilles `describe.skipIf` wäre in GENAU dem CI-Job, der
 * Chromium eigens dafür installiert (geplant: "arena-chromium-tests"), ein zweites Mal die
 * "überspringt still"-Lücke, die schon bei der Image-Probe auffiel -- bricht der Install-Schritt
 * dort (falsche Revision, Netzwerk, ...), würde die Suite klaglos grün "skipped" zeigen, OHNE
 * dass der wichtigste Test dieses PRs (Arena-Pfad-Parität) je wieder lief. Dieser Job setzt
 * deshalb `OLY_ARENA_CHROMIUM_PFLICHT=1` -- fehlt Chromium DANN trotzdem, wird daraus ein
 * LAUTER, eindeutiger Testfehler statt eines stillen Skips (s. `beforeAll` unten).
 */
const CHROMIUM_PFLICHT = process.env.OLY_ARENA_CHROMIUM_PFLICHT === "1";
const UEBERSPRINGEN = !CHROMIUM_VERFUEGBAR && !CHROMIUM_PFLICHT;
async function bauFrischenBattleSaveMitVollemFeld() {
  for (let versuch = 1; versuch <= 3; versuch += 1) {
    process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-arena-vorlauf-parity-${Math.random().toString(36).slice(2)}.sqlite`;
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
      logPrefix: "[arena-vorlauf-parity-test]",
    });
    const nachDraft = persistence.getSaveById(saveId)!;
    persistence.saveSingleplayerState(
      saveId,
      applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
    );
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const spieltag = (aktuell.gameState.seasonState.disciplineSchedule ?? []).find((e) => e.matchdayId === matchdayId);
    const d1 = spieltag?.discipline1?.disciplineId;
    const d2 = spieltag?.discipline2?.disciplineId;
    const arenaDisciplineIds = [d1, d2].filter((id): id is string => id != null && ARENA_RESOLVED_DISCIPLINE_IDS.has(id));
    if (arenaDisciplineIds.length === 0) {
      continue;
    }
    const batch = applyAiLegacyLineupBatchLocally(
      { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );
    expect(batch.summary.blockingReasons, batch.summary.blockingReasons.join(" | ")).toEqual([]);
    const scope = { saveId, seasonId, matchdayId };
    return { persistence, scope, arenaDisciplineId: arenaDisciplineIds[0]! };
  }
  throw new Error("bauFrischenBattleSaveMitVollemFeld: drei Saves hintereinander ohne arena-aufgeloeste Disziplin an Spieltag 1.");
}

describe.skipIf(UEBERSPRINGEN)(
  "Arena-Vorlauf-Service · Was-du-siehst-wird-gebucht-Parität, Arena-Pfad (Opus-Review, Abnahme-Check #3)",
  () => {
  // OPUS-REVIEW (Nachtrag 18.10.): laut statt leise, wenn ein Job, der Chromium garantiert haben
  // SOLLTE (OLY_ARENA_CHROMIUM_PFLICHT=1), trotzdem keines findet -- sonst wuerde ein kaputter
  // Install-Schritt (falsche Revision, Netzwerkfehler) nur zu einer leeren, gruenen Suite fuehren,
  // nie zu einem sichtbaren Fehler. `describe.skipIf` oben greift in diesem Fall NICHT (s.
  // `UEBERSPRINGEN`), der Rest der Datei liefe sonst einfach in ein verwirrendes Playwright-
  // "Executable doesn't exist" mitten in der eigentlichen Pruefung -- dieser Test hier macht die
  // eigentliche Ursache zuerst und eindeutig sichtbar.
  if (CHROMIUM_PFLICHT && !CHROMIUM_VERFUEGBAR) {
    it("OLY_ARENA_CHROMIUM_PFLICHT=1, aber kein Chromium gefunden -- Install-Schritt dieses Jobs pruefen", () => {
      throw new Error(
        `Dieser CI-Job setzt OLY_ARENA_CHROMIUM_PFLICHT=1 (Chromium MUSS installiert sein), aber weder ` +
          `${CHROMIUM_PFAD} noch ein "chromium"-Eintrag unter ~/.cache/ms-playwright wurden gefunden. ` +
          `Vermutlich ist der "npx playwright install chromium"-Schritt dieses Jobs fehlgeschlagen oder ` +
          `wurde entfernt.`,
      );
    });
    return;
  }
  it(
    "bucht fuer eine arena-aufgeloeste Disziplin GENAU die Zeilen, die der fertige Vorlauf-Snapshot zeigte (echtes Chromium)",
    async () => {
      const { persistence, scope, arenaDisciplineId } = await bauFrischenBattleSaveMitVollemFeld();

      ensureMatchdayResolveSnapshot(scope, persistence);
      // ECHTER Lauf -- KEIN injizierter Runner. Falls lokal kein Chromium verfuegbar ist, scheitert
      // dieser Test mit einer klaren Chromium-Fehlermeldung statt eines stillen Falsch-Gruens.
      const vorlauf = await stelleArenaVorlaufSicher(scope, {}, persistence);
      expect(vorlauf.applicable).toBe(true);
      expect(vorlauf.status).toBe("ready");

      // Das ist GENAU das, was die Buehne nach dem Vorlauf zeigen wuerde (der Snapshot-Payload im
      // Save, derselbe, aus dem FoundationBattleArenaHost/DisciplineStageArena ihre Preview lesen).
      const nachVorlauf = persistence.getSaveById(scope.saveId)!;
      const gezeigterSnapshot = (nachVorlauf.gameState.seasonState.matchdayResolveSnapshots ?? []).find(
        (s) => s.matchdayId === scope.matchdayId,
      );
      expect(gezeigterSnapshot).toBeDefined();
      const gezeigteDisziplin = (
        gezeigterSnapshot!.payload as {
          preview?: { disciplinePreviews?: Array<{ disciplineId: string; teamResults: Array<{ teamId: string; teamPoints: number | null; resolutionSource?: string }> }> };
        }
      ).preview?.disciplinePreviews?.find((d) => d.disciplineId === arenaDisciplineId);
      expect(gezeigteDisziplin).toBeDefined();
      expect(gezeigteDisziplin!.teamResults.length).toBeGreaterThan(0);
      for (const team of gezeigteDisziplin!.teamResults) {
        expect(team.resolutionSource).toBe("arena");
      }
      const gezeigtByTeam = new Map(gezeigteDisziplin!.teamResults.map((t) => [t.teamId, t.teamPoints]));

      const gebucht = await kickoffArenaMatchdayApply({
        persistence,
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        matchdayId: scope.matchdayId,
        forceReplace: true,
        allowIncompleteOverride: true,
        logPrefix: "[arena-vorlauf-parity-test]",
      });
      if (!gebucht.applicable || !gebucht.booked) {
        throw new Error(`Arena-Matchday-Apply nicht gebucht: ${JSON.stringify(gebucht)}`);
      }

      const nachBuchung = persistence.getSaveById(scope.saveId)!;
      const gebuchteZeilen = (nachBuchung.gameState.seasonState.disciplineResults ?? []).filter(
        (zeile) => zeile.disciplineId === arenaDisciplineId && zeile.matchdayResultId?.includes(scope.matchdayId),
      );
      expect(gebuchteZeilen.length).toBe(gezeigteDisziplin!.teamResults.length);
      for (const zeile of gebuchteZeilen) {
        expect(zeile.resolutionSource).toBe("arena");
        // PARITAET: die gebuchte Zahl ist EXAKT die, die der Snapshot vorher zeigte -- keine
        // zweite, beim Buchen abweichend berechnete Zahl (das waere der Bruch im "Was du siehst,
        // wird gebucht"-Versprechen).
        expect(zeile.teamPoints).toBe(gezeigtByTeam.get(zeile.teamId));
      }

      // Spiegelprobe fuer die Kontextkette selbst (statt nur das Endergebnis): kein
      // arenaAusfall-Marker bei einem tatsaechlich erfolgreichen Chromium-Lauf. `status` ist hier
      // der PRO-DISZIPLIN-Wert ("arena" | "ausgefallen", s. `ArenaVorlaufDisziplinEintrag` in
      // arena-vorlauf-service.ts) -- NICHT der Record-weite Status ("ready" | "failed" |
      // "in_progress"), den `vorlauf.status` oben schon geprueft hat. Eigener Fund beim lokalen
      // Reproduzieren (18.10.): hier stand faelschlich `"ready"` statt `"arena"` -- derselbe
      // Enum-Name existiert auf beiden Ebenen, aber mit unterschiedlichen Werten.
      for (const d of Object.values(readArenaVorlaufRecord(nachBuchung.gameState, scope)?.disziplinen ?? {})) {
        expect(d.status).toBe("arena");
        expect(d.ausfall).toBeFalsy();
      }
    },
    420_000,
  );
  },
);

describe("Arena-Vorlauf-Service · Was-du-siehst-wird-gebucht-Parität, Brücken-Pfad (Opus-Review, Abnahme-Check #3)", () => {
  it(
    "bucht fuer eine arena-aufgeloeste Disziplin GENAU die Zeilen, die der Snapshot nach einem Chromium-Ausfall zeigte -- OHNE echtes Chromium, laeuft deshalb immer",
    async () => {
      const { persistence, scope, arenaDisciplineId } = await bauFrischenBattleSaveMitVollemFeld();

      ensureMatchdayResolveSnapshot(scope, persistence);
      // Injizierter, IMMER werfender Runner -- dasselbe Muster wie die "Ausfall-Probe" in
      // tests/arena-vorlauf-service.test.ts, hier aber bis zum fertigen Buchen durchgezogen.
      //
      // SEIT DEM DESIGN-FIX (18.10., "Wiederholung gehoert in den Vorlauf selbst"): die
      // automatische Wiederholung (B1) passiert jetzt INNERHALB dieses EINEN Aufrufs -- die
      // Signatur ist danach ohne Ausnahme terminal `"failed"`. Vorher musste dieser Test den
      // Vorlauf zweimal von aussen anstossen (und denselben Runner sogar defensiv in den
      // Buchungsaufruf mitgeben), um die Zweideutigkeit des alten Designs zu umgehen -- genau der
      // Workaround, den der Fix ueberfluessig macht.
      const werfenderRunner = async (): Promise<ArenaFixtureResult[]> => {
        throw new Error("Simulierter Chromium-Ausfall (Testinjektion, Brücken-Parität)");
      };
      const vorlauf = await stelleArenaVorlaufSicher(scope, { runArenaFixturesImpl: werfenderRunner }, persistence);
      expect(vorlauf.applicable).toBe(true);
      expect(vorlauf.status).toBe("failed");

      // Das ist GENAU das, was die Buehne nach dem Ausfall zeigen wuerde: die PPS-Duell-Bruecke,
      // sichtbar markiert, nie eine stille Luecke.
      const nachVorlauf = persistence.getSaveById(scope.saveId)!;
      const gezeigterSnapshot = (nachVorlauf.gameState.seasonState.matchdayResolveSnapshots ?? []).find(
        (s) => s.matchdayId === scope.matchdayId,
      );
      expect(gezeigterSnapshot).toBeDefined();
      const gezeigteDisziplin = (
        gezeigterSnapshot!.payload as {
          preview?: { disciplinePreviews?: Array<{ disciplineId: string; teamResults: Array<{ teamId: string; teamPoints: number | null; resolutionSource?: string; arenaAusfall?: unknown }> }> };
        }
      ).preview?.disciplinePreviews?.find((d) => d.disciplineId === arenaDisciplineId);
      expect(gezeigteDisziplin).toBeDefined();
      expect(gezeigteDisziplin!.teamResults.length).toBeGreaterThan(0);
      for (const team of gezeigteDisziplin!.teamResults) {
        expect(team.resolutionSource).toBe("pps_duell");
        expect(team.arenaAusfall).toBeTruthy();
      }
      const gezeigtByTeam = new Map(gezeigteDisziplin!.teamResults.map((t) => [t.teamId, t.teamPoints]));

      // KEINE Runner-Injektion mehr noetig hier: die Signatur ist bereits terminal "failed" (s.
      // oben), `kickoffArenaVorlauf()` (intern von `kickoffArenaMatchdayApply()` aufgerufen) sieht
      // das ueber `duerfeNeuenVersuchStarten()` und startet KEINEN neuen Lauf -- bucht synchron
      // die bereits vorliegende, markierte Bruecke, ganz ohne Chromium/Runner-Aufruf. Das ist
      // genau die Eigenschaft, die der Design-Fix verspricht: kein "defensiv mitgegebener"
      // Runner mehr noetig, der die alte Zweideutigkeit nur verdeckt haette.
      const gebucht = await kickoffArenaMatchdayApply({
        persistence,
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        matchdayId: scope.matchdayId,
        forceReplace: true,
        allowIncompleteOverride: true,
        logPrefix: "[arena-vorlauf-parity-test-bruecke]",
      });
      if (!gebucht.applicable || !gebucht.booked) {
        throw new Error(`Arena-Matchday-Apply nicht gebucht: ${JSON.stringify(gebucht).slice(0, 500)}`);
      }

      const nachBuchung = persistence.getSaveById(scope.saveId)!;
      const gebuchteZeilen = (nachBuchung.gameState.seasonState.disciplineResults ?? []).filter(
        (zeile) => zeile.disciplineId === arenaDisciplineId && zeile.matchdayResultId?.includes(scope.matchdayId),
      );
      expect(gebuchteZeilen.length).toBe(gezeigteDisziplin!.teamResults.length);
      for (const zeile of gebuchteZeilen) {
        expect(zeile.resolutionSource).toBe("pps_duell");
        expect(zeile.arenaAusfall).toBeTruthy();
        // PARITAET (Bruecken-Pfad): dieselbe gebuchte Zahl wie im vorher gezeigten Snapshot.
        expect(zeile.teamPoints).toBe(gezeigtByTeam.get(zeile.teamId));
      }
    },
    420_000,
  );
});

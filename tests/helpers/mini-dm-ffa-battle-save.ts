/**
 * GETEILTER TESTHELFER (nicht selbst eine `.test.ts`-Datei!): baut einen frischen Battle-Save,
 * lässt den echten Liga-/KI-Lineup-Pfad einmal durchlaufen und ERZWINGT danach Mini-DM an D1 von
 * Spieltag 1 -- statt auf einen zufälligen Treffer zu warten (s. Begründung im Funktionskommentar
 * unten). Ursprünglich lokal in `tests/arena-vorlauf-mini-dm-ffa.test.ts` definiert; ausgelagert
 * (OPUS-REVIEW, PR 5, Pflicht-Fix 3), weil `tests/mini-dm-ffa-e2e-real-chromium.test.ts` denselben
 * Aufbau braucht.
 *
 * WARUM EINE EIGENE DATEI STATT EINES IMPORTS AUS DER `.test.ts`-DATEI: ein Import aus einer
 * `.test.ts`-Datei fuehrt beim Laden auch deren Modul-Top-Level-Code aus -- inklusive jedem
 * `describe()`/`it()`-Aufruf. Vitest registriert diese dann ZUSAETZLICH unter der importierenden
 * Datei, die betroffenen Tests laufen also ZWEIMAL (einmal in ihrer eigenen Datei, einmal
 * "huckepack" in der importierenden) und koennen sich dabei gegenseitig stoeren (z. B. ueber
 * `process.env.OLY_APP_SQLITE_PATH`, das beide Kopien parallel setzen). Genau das geschah beim
 * ersten Versuch dieses Fixes: `tests/mini-dm-ffa-e2e-real-chromium.test.ts` importierte die
 * Bau-Funktion direkt aus der Geschwisterdatei, worauf deren GESAMTE Testsuite ein zweites Mal
 * (als Teil der E2E-Datei) lief und ein Test darin ("Mini-DM-Pod-Teams werden ueber die ECHTEN
 * FFA-Rohdaten gebucht") sporadisch mit einem falschen `platz` fehlschlug -- ein Testartefakt
 * dieser falschen Import-Struktur, kein Produktionsfehler. Diese Datei (ohne `describe`/`it`,
 * reiner Helfer) behebt das strukturell: beide Testdateien importieren von HIER, keine importiert
 * von der anderen.
 */
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { getMiniDmPodsForMatchday } from "@/lib/season/mini-dm-pod-schedule";
import { expect } from "vitest";

/** Default-Kadergroesse fuer Tests, die die VERDRAHTUNG pruefen (laeuft der FFA-Pfad ueberhaupt
 *  an, wird sein Ergebnis gebucht), nicht die k-Abhaengigkeit selbst (die deckt
 *  `tests/mini-dm-ffa-matchday.test.ts` unit-genau ab). */
export const TEST_K = 4;

/**
 * Baut einen frischen Battle-Save, laesst den echten Liga-/KI-Lineup-Pfad einmal durchlaufen und
 * ERZWINGT danach Mini-DM an D1 von Spieltag 1 mit `k` Spielern.
 *
 * WARUM NICHT EINE ZUFALLS-SUCHE: Mini-DM ist GENAU EINE von 20 Disziplinen mit (bei
 * Battle-Mode-Repeat 2) zwei Vorkommen auf 20 Spieltagen -- die Trefferquote fuer "steht an
 * Spieltag 1" liegt bei ~10 %, eine zufallsbasierte Suche haette unzumutbar viele (und
 * unzumutbar teure, je ein voller 32-Team-Liga-Draft) Versuche gebraucht. Das direkte
 * Ueberschreiben des Spielplan-Slots ist deterministisch UND kostet nur EINEN Liga-Draft.
 *
 * Das Ueberschreiben passiert NACH `fuehreLigaSetupDraftAus()` (Liga-/Team-Zuordnung steht schon,
 * `getMiniDmPodsForMatchday()` braucht nur diese, nicht den urspruenglichen Spielplan-Inhalt) und
 * VOR `applyAiLegacyLineupBatchLocally()` (die KI liest den Spielplan-Slot erst beim Aufstellen).
 */
export async function bauFrischenBattleSaveMitMiniDmAnSpieltag1(k: number = TEST_K) {
  process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-arena-vorlauf-mini-dm-ffa-${Math.random().toString(36).slice(2)}.sqlite`;
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
    logPrefix: "[arena-vorlauf-mini-dm-ffa-test]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  const vorUeberschreiben = persistence.getSaveById(saveId)!;
  const seasonId = vorUeberschreiben.gameState.season.id;
  const matchdayId = vorUeberschreiben.gameState.matchdayState.matchdayId;
  const bisherigerSpieltag = (vorUeberschreiben.gameState.seasonState.disciplineSchedule ?? []).find((e) => e.matchdayId === matchdayId);
  const andereArenaDisziplinPraesent = bisherigerSpieltag?.discipline2?.disciplineId != null && ARENA_RESOLVED_DISCIPLINE_IDS.has(bisherigerSpieltag.discipline2.disciplineId);

  if (!bisherigerSpieltag) {
    throw new Error("bauFrischenBattleSaveMitMiniDmAnSpieltag1: Spieltag 1 hat gar keinen Spielplan-Eintrag -- Setup pruefen.");
  }
  // NUR `discipline1` wird ersetzt -- der Rest des bestehenden, typkorrekten Eintrags (inklusive
  // `discipline2`, s. `andereArenaDisziplinPraesent` oben) bleibt unveraendert, statt ihn hier per
  // Objektliteral neu (und fehleranfaellig gegenueber `SeasonDisciplineScheduleSourceStatus`) nachzubauen.
  const erzwungenerSpieltag = {
    ...bisherigerSpieltag,
    discipline1: {
      disciplineId: "mini-dm",
      displayName: "Mini DM",
      order: bisherigerSpieltag.discipline1?.order ?? 1,
      playerCount: k,
      legacyScorePlayerCount: k,
      category: bisherigerSpieltag.discipline1?.category ?? "power",
      occurrenceInSeason: 1 as const,
    },
  };
  const neuerSpielplan = [
    ...(vorUeberschreiben.gameState.seasonState.disciplineSchedule ?? []).filter((e) => e.matchdayId !== matchdayId),
    erzwungenerSpieltag,
  ];
  persistence.saveSingleplayerState(saveId, {
    ...vorUeberschreiben.gameState,
    seasonState: { ...vorUeberschreiben.gameState.seasonState, disciplineSchedule: neuerSpielplan },
  });

  const pods = getMiniDmPodsForMatchday(persistence.getSaveById(saveId)!.gameState, matchdayId, { saveId });
  if (pods.length === 0) {
    throw new Error(
      "bauFrischenBattleSaveMitMiniDmAnSpieltag1: erzwungener Mini-DM-Slot lieferte trotzdem keine Pods -- " +
        "Annahme ueber den Spielplan-Aufbau (getSeasonDisciplineSchedule()) stimmt nicht mehr, Setup pruefen.",
    );
  }

  const batch = applyAiLegacyLineupBatchLocally(
    { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
    persistence,
  );
  expect(batch.summary.blockingReasons, batch.summary.blockingReasons.join(" | ")).toEqual([]);

  return {
    persistence,
    scope: { saveId, seasonId, matchdayId },
    k,
    pods,
    andereArenaDisziplinPraesent,
  };
}

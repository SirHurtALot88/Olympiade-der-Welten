/**
 * BEFUND (16.10., Battle-Mode-Untersuchung): `gameMode: "battle"` steht korrekt im frisch
 * gebauten `GameState` (`buildNewGameStateFromBaseline()`, s. `new-game-setup-service.test.ts`),
 * ging aber beim ERSTEN Schreiben auf die echte SQLite wieder verloren. Live nachgestellt: drei
 * über den New-Game-Wizard angelegte Battle-Mode-Saves trugen nach dem Anlegen alle
 * `scenarioMeta.gameMode === undefined`, `leagueByTeamId` blieb leer.
 *
 * Ursache: `saveGameState()` (lib/persistence/save-repository.ts) ruft bei JEDEM Schreiben
 * unbedingt `buildScenarioMeta({ gameState })` auf und ERSETZT `scenarioMeta` komplett durch deren
 * Rückgabewert — `buildScenarioMeta()` (lib/persistence/scenario-meta.ts) kannte `gameMode` bisher
 * nicht und liess es beim Zusammenbauen des neuen Objekts einfach weg.
 *
 * Dieser Test geht bewusst NICHT über `buildNewGameStateFromBaseline()` allein (das deckt nur das
 * In-Memory-Objekt ab, nie den Schreibweg), sondern über `applyNewGameSetup()` + einen echten
 * `createPersistenceService()` auf einer frischen SQLite-Datei — derselbe Pfad, den
 * `app/api/new-game/route.ts` im Produktivbetrieb nimmt — und liest den Save danach frisch aus der
 * Datenbank zurück (`getSaveById`), nicht aus dem Rückgabewert von `applyNewGameSetup()` selbst.
 */
import { describe, expect, it } from "vitest";

import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { isBattleModeSave } from "@/lib/season/game-mode";
import { isLeagueSplitActive } from "@/lib/season/league-split";

function frischerDienst() {
  process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-battle-mode-persist-${Math.random().toString(36).slice(2)}.sqlite`;
  return createPersistenceService();
}

describe("Battle-Mode-Save · gameMode übersteht einen echten Schreib-/Lese-Zyklus", () => {
  it("bleibt 'battle' nach dem Anlegen UND nach jedem weiteren Schreiben, frisch aus der DB gelesen", () => {
    const persistence = frischerDienst();
    persistence.bootstrapSingleplayerSave();

    const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
    const preview = previewNewGameSetup(input);
    expect(preview.blockers).toEqual([]);

    const result = applyNewGameSetup(
      { ...input, confirmToken: preview.confirmToken },
      persistence,
      { ownerId: null },
    );

    // Die eigentliche Regression: nicht das Rückgabeobjekt von applyNewGameSetup prüfen (das baut
    // sein `preview` aus derselben In-Memory-Konstruktion, an der der Fehler nie auftrat), sondern
    // frisch aus der Datenbank nachladen — genau der Pfad, über den die App den Save beim nächsten
    // Request wieder einliest.
    const reloaded = persistence.getSaveById(result.save.saveId);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.gameState.scenarioMeta?.gameMode).toBe("battle");
    expect(isBattleModeSave(reloaded!.gameState)).toBe(true);
    expect(isLeagueSplitActive(reloaded!.gameState)).toBe(true);
    expect(Object.keys(reloaded!.gameState.seasonState.leagueByTeamId ?? {})).toHaveLength(32);

    // Und: ein zweites, unabhängiges Schreiben (wie es z.B. ein Spieltagsabschluss auslöst) darf
    // `gameMode` nicht erneut verlieren — `saveGameState()` läuft bei jedem Save-Schreibvorgang.
    const nochmalGeschrieben = persistence.saveSingleplayerState(result.save.saveId, reloaded!.gameState);
    expect(nochmalGeschrieben.gameState.scenarioMeta?.gameMode).toBe("battle");
    const zweitesLaden = persistence.getSaveById(result.save.saveId);
    expect(zweitesLaden!.gameState.scenarioMeta?.gameMode).toBe("battle");
  }, 120_000);

  it("bleibt bei Manager Mode weiterhin 'manager' (keine Regression für den Default-Fall)", () => {
    const persistence = frischerDienst();
    persistence.bootstrapSingleplayerSave();

    const input = { presetId: "solo_1" as const };
    const preview = previewNewGameSetup(input);
    const result = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });

    const reloaded = persistence.getSaveById(result.save.saveId);
    expect(reloaded!.gameState.scenarioMeta?.gameMode).toBe("manager");
    expect(isBattleModeSave(reloaded!.gameState)).toBe(false);
  }, 120_000);
});

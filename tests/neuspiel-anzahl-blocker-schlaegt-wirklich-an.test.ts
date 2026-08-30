/**
 * F5: DER ANZAHL-BLOCKER — GREIFT ER UEBERHAUPT?
 *
 * `new_game_preset_team_count_mismatch` (lib/game/new-game-setup-service.ts) ist die Zusage
 * „ein Preset liefert die Anzahl, die es verspricht". Alle bestehenden Tests dazu zeigen nur, dass
 * er NICHT anschlaegt — und das koennen sie auch gar nicht anders: die echten Pools sind 16 oder
 * 32 Teams gross, jedes Preset verlangt hoechstens 4+4, die Bedingung ist im Betrieb also nie
 * erfuellbar. Ein vertipptes `!==`, eine vertauschte Seite oder ein `chrisCount` gegen die falsche
 * Liste waere damit UNSICHTBAR: der Blocker schwiege weiter, und alles bliebe gruen.
 *
 * Diese Datei ist die Gegenprobe. Sie verkleinert den Team-Satz eines frischen Spielstands
 * kuenstlich auf drei — dieselbe Bauart wie der 3-Team-Pool in
 * `tests/raum-preset-zuteilungstabelle.test.ts` — und misst, dass der Blocker dann WIRKLICH kommt,
 * mit der richtigen Seite, dem richtigen Preset und den richtigen Zahlen darin.
 *
 * VERKLEINERT WIRD NUR BEI EINER SAVE-ID MIT DEM PRAEFIX `pool-3-`. So faehrt dieselbe Datei die
 * Gegenprobe (voller Pool, kein Blocker) durch die ECHTE Kette, statt sie nur zu behaupten.
 */
import { describe, expect, it, vi } from "vitest";

const KLEIN_POOL_PRAEFIX = "pool-3-";
const KLEIN_POOL_GROESSE = 3;

vi.mock("@/lib/game-state/singleplayer-state", async (importOriginal) => {
  const echt = await importOriginal<typeof import("@/lib/game-state/singleplayer-state")>();
  return {
    ...echt,
    createFreshSeasonOneGameState: (...args: Parameters<typeof echt.createFreshSeasonOneGameState>) => {
      const gameState = echt.createFreshSeasonOneGameState(...args);
      const [saveId] = args;
      if (!saveId || !saveId.startsWith(KLEIN_POOL_PRAEFIX)) {
        return gameState;
      }
      return { ...gameState, teams: gameState.teams.slice(0, KLEIN_POOL_GROESSE) };
    },
  };
});

const { NEW_GAME_PRESETS, buildNewGameStateFromBaseline } = await import("@/lib/game/new-game-setup-service");

const JETZT = "2026-01-01T00:00:00.000Z";

describe("Anzahl-Blocker: er schlaegt an, wenn das Preset seine Zusage NICHT halten kann", () => {
  it("solo_4 in einem 3-Team-Pool: Blocker mit Seite, Preset, Soll und Ist", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "solo_4",
      saveId: `${KLEIN_POOL_PRAEFIX}solo-4`,
      now: JETZT,
    });

    // Drei Teams sind da, vier waren versprochen.
    expect(preview.chrisTeamIds).toHaveLength(KLEIN_POOL_GROESSE);
    expect(preview.blockers).toContain("new_game_preset_team_count_mismatch:chris:solo_4:4:3");
  });

  it("online_4v4 in einem 3-Team-Pool: BEIDE Seiten melden sich, keine verschluckt die andere", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "online_4v4",
      saveId: `${KLEIN_POOL_PRAEFIX}online-4v4`,
      now: JETZT,
    });

    const mismatches = preview.blockers.filter((eintrag) => eintrag.startsWith("new_game_preset_team_count_mismatch:"));
    expect(mismatches).toHaveLength(2);
    expect(mismatches.some((eintrag) => eintrag.startsWith("new_game_preset_team_count_mismatch:chris:online_4v4:4:"))).toBe(true);
    expect(mismatches.some((eintrag) => eintrag.startsWith("new_game_preset_team_count_mismatch:franky:online_4v4:4:"))).toBe(true);
    // Der 3er-Pool reicht fuer 4+4 nicht -- zusammen koennen es nur die drei vorhandenen sein.
    expect(preview.chrisTeamIds.length + preview.frankyTeamIds.length).toBe(KLEIN_POOL_GROESSE);
  });

  it("solo_1 im selben 3-Team-Pool blockiert NICHT — ein Team ist aus dreien lieferbar", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      saveId: `${KLEIN_POOL_PRAEFIX}solo-1`,
      now: JETZT,
    });

    expect(preview.chrisTeamIds).toHaveLength(1);
    expect(preview.blockers.filter((eintrag) => eintrag.startsWith("new_game_preset_team_count_mismatch:"))).toEqual([]);
  });

  it("eine AUSDRUECKLICHE Auswahl blockiert auch im 3-Team-Pool nicht — wer selbst waehlt, bestimmt die Anzahl", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "solo_4",
      saveId: `${KLEIN_POOL_PRAEFIX}ausdruecklich`,
      chrisTeamIds: ["A-A"],
      now: JETZT,
    });

    expect(preview.chrisTeamIds).toEqual(["A-A"]);
    expect(preview.blockers.filter((eintrag) => eintrag.startsWith("new_game_preset_team_count_mismatch:"))).toEqual([]);
  });

  /**
   * DIE GEGENPROBE, DURCH DIESELBE KETTE: ohne den Praefix greift die Verkleinerung nicht, der Pool
   * ist der echte — und dann darf kein einziges Preset blockieren. Ohne diesen Test bewiese die
   * Datei oben nur, dass die Verkleinerung wirkt, nicht dass der Blocker die richtige Frage stellt.
   */
  it("voller Pool: kein Preset blockiert, die Zusage ist ueberall erfuellbar", () => {
    for (const preset of NEW_GAME_PRESETS) {
      const { preview } = buildNewGameStateFromBaseline({
        presetId: preset.presetId,
        saveId: `voller-pool-${preset.presetId}`,
        now: JETZT,
      });
      expect(preview.chrisTeamIds, preset.presetId).toHaveLength(preset.chrisCount);
      expect(preview.frankyTeamIds, preset.presetId).toHaveLength(preset.frankyCount);
      expect(preview.blockers, preset.presetId).toEqual([]);
    }
  }, 120_000);
});

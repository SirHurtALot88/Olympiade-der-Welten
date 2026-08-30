/**
 * F7: DIE ZWEITE KOPIE DER PRESET-TABELLE — festgenagelt, solange sie noch existiert.
 *
 * `NEW_GAME_PRESET_DEFAULTS` (lib/foundation/tabs/foundation-page-types.ts) traegt dieselben
 * Beschriftungen und Team-Listen wie `NEW_GAME_PRESETS` (lib/game/new-game-setup-service.ts) ein
 * zweites Mal. Warum sie noch da ist und nicht zusammengelegt wurde, steht ausfuehrlich am Feld
 * selbst — kurz: die Typen-Datei traegt bewusst NUR `import type` und darf den Service (und damit
 * `better-sqlite3`) nicht ins Client-Bundle ziehen.
 *
 * Eine Kopie ist ertraeglich, solange sie nicht STILL auseinanderlaeuft. Genau das misst diese
 * Datei: aendert jemand die eine Tabelle und die andere nicht, faellt es hier auf statt spaeter im
 * Spiel. `lib/game/preset-team-pool.ts` warnt in seinem Kopfkommentar ausdruecklich vor solchen
 * mitgeschleppten absoluten Team-Listen — dieser Test ist der Riegel dagegen, bis die Tabelle
 * einmal in ein importfreies Blatt-Modul wandert.
 */
import { describe, expect, it } from "vitest";

import { NEW_GAME_PRESETS } from "@/lib/game/new-game-setup-service";
import { NEW_GAME_PRESET_DEFAULTS, NEW_GAME_VISIBLE_PRESET_IDS } from "@/lib/foundation/tabs/foundation-page-types";

describe("NEW_GAME_PRESET_DEFAULTS ist eine Kopie von NEW_GAME_PRESETS — und muss es bleiben", () => {
  it("dieselben Preset-IDs, keine mehr und keine weniger", () => {
    expect(Object.keys(NEW_GAME_PRESET_DEFAULTS).sort()).toEqual(NEW_GAME_PRESETS.map((preset) => preset.presetId).sort());
  });

  it("dieselbe Beschriftung, dieselben Team-Listen, dieselbe Online-Kennzeichnung", () => {
    for (const preset of NEW_GAME_PRESETS) {
      const kopie = NEW_GAME_PRESET_DEFAULTS[preset.presetId];
      expect(kopie, preset.presetId).toBeDefined();
      expect(kopie.label, preset.presetId).toBe(preset.label);
      expect(kopie.chrisTeamIds, preset.presetId).toEqual(preset.chrisTeamIds);
      expect(kopie.frankyTeamIds, preset.presetId).toEqual(preset.frankyTeamIds);
      // `isOnline` heisst in der Client-Kopie `online` — der einzige erlaubte Unterschied.
      expect(kopie.online, preset.presetId).toBe(preset.isOnline);
    }
  });

  /**
   * DER GRUND, WARUM DIE STALE `P-S`/`V-W`-LISTEN HEUTE NIEMANDEM WEHTUN: der Assistent liest nur
   * `custom` (er normalisiert beim Aufklappen darauf) und den Startwert `solo_1`. Beide sagen
   * `["M-M"]`, und `M-M` existiert in BEIDEN Team-Poolen. Faellt diese Zusicherung, ist die Kopie
   * nicht mehr harmlos und muss zusammengelegt werden.
   */
  it("die Eintraege, die der Assistent wirklich liest, sind pool-unabhaengig", () => {
    expect(NEW_GAME_PRESET_DEFAULTS.custom.chrisTeamIds).toEqual(["M-M"]);
    expect(NEW_GAME_PRESET_DEFAULTS.custom.frankyTeamIds).toEqual([]);
    expect(NEW_GAME_PRESET_DEFAULTS.solo_1.chrisTeamIds).toEqual(["M-M"]);
    expect(NEW_GAME_PRESET_DEFAULTS.solo_1.frankyTeamIds).toEqual([]);
    // Die sichtbaren Presets stammen aus derselben ID-Menge -- kein dritter Satz IDs.
    for (const presetId of NEW_GAME_VISIBLE_PRESET_IDS) {
      expect(NEW_GAME_PRESET_DEFAULTS[presetId], presetId).toBeDefined();
    }
  });
});

/**
 * Spalten-Sichtbarkeit + Saved Views ("FM-Stil") für das Spieler-Verzeichnis
 * (additiv, "Neuer Look", Phase 3). Reine Client-Logik: welche Datenspalten der
 * Verzeichnis-Tabelle sichtbar sind plus ein aktives, benanntes Preset.
 *
 * Persistenz spiegelt EXAKT die try/catch-Lese-/Schreib-Form der bestehenden
 * Query-Chip-Presets (`readQueryChipPresets`/`writeQueryChipPresets` in
 * `foundation-players-query-chips.ts`) — gleicher `PREFIX:<saveId>`-Schlüssel,
 * gleiche Version-Hülle, gleicher SSR-Guard, gleiche geteilte
 * `getActiveSaveIdFromLocation`-Save-ID-Quelle. Keine neue Speichermechanik.
 *
 * Strukturspalten (Vergleichs-Checkbox, Portrait/Bild, Name inkl. Wishlist-
 * Stern) sind bewusst NICHT abschaltbar — sie tragen die Zeilen-Identität und
 * interaktive Kern-Affordanzen. Nur die Datenspalten sind umschaltbar.
 */

import { getActiveSaveIdFromLocation } from "@/app/foundation/players-table/foundation-players-query-chips";

/** Immer sichtbare Strukturspalten (nicht abschaltbar) — Identität + Kern-Interaktion. */
export const NL_PLAYERS_STRUCTURAL_COLUMN_IDS: ReadonlyArray<string> = ["compare", "image", "name"];

/** Umschaltbare Datenspalten — Reihenfolge = Anzeige-Reihenfolge im "Spalten"-Menü. */
export const NL_PLAYERS_HIDEABLE_COLUMN_IDS: ReadonlyArray<string> = [
  "team",
  "class",
  "race",
  "abilityStars",
  "axes",
  "pps",
  "ovr",
  "mvs",
  "mw",
  "salary",
  "contract",
  "appearances",
  "bestDiscipline",
  "careerLeague",
  "traits",
];

export type NlPlayersColumnVisibility = Record<string, boolean>;

/** Aktives Preset — die 4 benannten Views plus "custom" für händisch abgewichene Auswahl. */
export type NlPlayersColumnPresetId = "kompakt" | "scouting" | "finanzen" | "alles" | "custom";

export type NlPlayersColumnPreset = {
  id: Exclude<NlPlayersColumnPresetId, "custom">;
  label: string;
  /** Sichtbare abschaltbare Spalten dieses Presets (Strukturspalten sind immer sichtbar). */
  visible: ReadonlyArray<string>;
};

/**
 * Benannte Views. "Alles" ist die Vorgabe (alle Datenspalten sichtbar =
 * bisheriges Verhalten). Die anderen drei blenden je eine sinnvolle Teilmenge
 * ein: Kompakt = nackte Kennzahlen, Scouting = Fähigkeit/Achsen/Talent,
 * Finanzen = Marktwert/Gehalt/Vertrag.
 */
export const NL_PLAYERS_COLUMN_PRESETS: ReadonlyArray<NlPlayersColumnPreset> = [
  {
    id: "kompakt",
    label: "Kompakt",
    visible: ["pps", "ovr", "mvs", "mw"],
  },
  {
    id: "scouting",
    label: "Scouting",
    visible: ["class", "race", "abilityStars", "axes", "pps", "ovr", "mvs", "bestDiscipline", "traits"],
  },
  {
    id: "finanzen",
    label: "Finanzen",
    visible: ["ovr", "mvs", "mw", "salary", "contract", "careerLeague"],
  },
  {
    id: "alles",
    label: "Alles",
    visible: NL_PLAYERS_HIDEABLE_COLUMN_IDS,
  },
];

export const NL_PLAYERS_DEFAULT_PRESET_ID: NlPlayersColumnPreset["id"] = "alles";

/** Vollständige Sichtbarkeitskarte über alle abschaltbaren Spalten für eine Sichtbar-Liste. */
function buildVisibility(visibleIds: ReadonlyArray<string>): NlPlayersColumnVisibility {
  const set = new Set(visibleIds);
  const visibility: NlPlayersColumnVisibility = {};
  for (const id of NL_PLAYERS_HIDEABLE_COLUMN_IDS) {
    visibility[id] = set.has(id);
  }
  return visibility;
}

/** Sichtbarkeitskarte eines benannten Presets (unbekannte ID → Vorgabe "Alles"). */
export function resolvePresetVisibility(presetId: string): NlPlayersColumnVisibility {
  const preset =
    NL_PLAYERS_COLUMN_PRESETS.find((entry) => entry.id === presetId) ??
    NL_PLAYERS_COLUMN_PRESETS.find((entry) => entry.id === NL_PLAYERS_DEFAULT_PRESET_ID)!;
  return buildVisibility(preset.visible);
}

export type NlPlayersColumnPreferences = {
  preset: NlPlayersColumnPresetId;
  visibility: NlPlayersColumnVisibility;
};

const COLUMN_STORAGE_PREFIX = "nl-players-column-presets";
const COLUMN_STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getColumnStorageKey(saveId: string | null | undefined): string {
  return `${COLUMN_STORAGE_PREFIX}:${saveId || "global"}`;
}

/**
 * Gespeicherte Spalten-Präferenzen lesen — `null`, wenn nichts (valides)
 * gespeichert ist (dann greift die Vorgabe im Host). Nur bekannte,
 * abschaltbare Spalten-IDs werden übernommen; unbekannte werden ignoriert und
 * fehlende auf sichtbar gesetzt (vorwärtskompatibel, wenn später Spalten
 * dazukommen). Gleiche defensive try/catch-Form wie `readQueryChipPresets`.
 */
export function readColumnPreferences(saveId: string | null | undefined): NlPlayersColumnPreferences | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getColumnStorageKey(saveId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.visibility)) {
      return null;
    }
    const storedVisibility = parsed.visibility as Record<string, unknown>;
    const visibility: NlPlayersColumnVisibility = {};
    for (const id of NL_PLAYERS_HIDEABLE_COLUMN_IDS) {
      // Fehlender/nicht-boolescher Eintrag → sichtbar (kein stiller Datenverlust bei neuen Spalten).
      visibility[id] = storedVisibility[id] === false ? false : true;
    }
    const presetRaw = parsed.preset;
    const preset: NlPlayersColumnPresetId =
      presetRaw === "kompakt" ||
      presetRaw === "scouting" ||
      presetRaw === "finanzen" ||
      presetRaw === "alles" ||
      presetRaw === "custom"
        ? presetRaw
        : "custom";
    return { preset, visibility };
  } catch {
    return null;
  }
}

/** Spalten-Präferenzen schreiben — gleiche Version-Hülle/try/catch wie `writeQueryChipPresets`. */
export function writeColumnPreferences(
  saveId: string | null | undefined,
  preferences: NlPlayersColumnPreferences,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      getColumnStorageKey(saveId),
      JSON.stringify({
        version: COLUMN_STORAGE_VERSION,
        preset: preferences.preset,
        visibility: preferences.visibility,
      }),
    );
  } catch {
    // Storage kann voll/deaktiviert sein — Spalten-Views sind reiner Client-Komfort, kein Datenverlust.
  }
}

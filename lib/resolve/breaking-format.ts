/**
 * BREAKING-FORMAT JE SPIELTAG (Tag-Team-1v1, 22.11., docs/design/breaking-tagteam-22-11.md).
 *
 * Arbeitsliste 21.11., Welle 4: „Breaking: Tag-Team-1v1 (Tekken/Street-Fighter-Art, Ein- und Auswechseln, jeder kommt dran),
 * HP/DMG je Spieler und Waffe unterschiedlich.“ Seitdem rechnet der Arena-Motor Breaking im Format "tagteam" (`baueTagTeam()`
 * in public/mockups/battle-mode.engine.js: 6 gegen 6, je Team einer im Ring, Gang = A peinigt / B haelt aus und umgekehrt,
 * danach verdeckter Wechsel; Waffe frei waehlbar, genau eine je Gang). Das alte Format "gauntlet" (Slot 1 gegen Slot 1, der
 * Sieger bleibt stehen) bleibt als Rueckweg.
 *
 * GEZEIGT = GEBUCHT, AUCH FUER SCHON GEWERTETE SPIELTAGE -- dasselbe Muster wie `basketball-puste.ts`, `hockey-torwart.ts`
 * und `climbing-format.ts`: die Arena spielt einen gebuchten Spieltag aus Saat und Kader nach; haette der Motor einfach das
 * Format gewechselt, liefe ein im Gauntlet gebuchter Breaking-Spieltag in der Wiedergabe als Tag-Team. Deshalb steht das
 * Format IM SPIELSTAND als Wechselliste der laufenden Saison (`seasonState.breakingFormat`): `wechsel[0]` gilt ab Saisonbeginn,
 * jeder weitere ab seinem Spieltag `ab`; gebuchte Spieltage behalten ihr Format fuer immer.
 *
 * EINE QUELLE FUER ALLE WEGE: Host, Chromium-Runner und Node-Motor lesen `breakingFormatFuer(gameState, matchdayId)` und reichen
 * es im Kader-Umschlag als `formatByDisciplineId.breaking` an den Motor; der Wert steht ausserdem im Eingabe-Hash des Vorlaufs
 * (lib/battle/arena-eingabe-hash.ts). Die frei gewaehlten Waffen reisen je Spieler im Aufstellungseintrag (`waffen`).
 *
 * SCHALTER `OLY_BREAKING_FORMAT` (Server; im Browser `NEXT_PUBLIC_OLY_BREAKING_FORMAT`):
 *   nicht gesetzt | "tagteam" | "an"                neues Format (Standard seit 22.11.)
 *   "alt" | "gauntlet" | "aus" | "0" | "false"      ab dem naechsten gewerteten Spieltag wieder der Gauntlet;
 *                                                   schon im Tag-Team gebuchte Spieltage bleiben so.
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";

export type BreakingFormat = "gauntlet" | "tagteam";

export type BreakingFormatWechsel = { ab: string | null; format: BreakingFormat };

export type BreakingFormatStempel = {
  /** Die Saison, fuer die der Stempel gilt. Ein Stempel einer anderen Saison zaehlt nicht. */
  seasonId: string;
  /** `wechsel[0].ab` ist null (ab Saisonbeginn); jeder weitere Eintrag gilt ab seinem Spieltag. */
  wechsel: BreakingFormatWechsel[];
};

export const BREAKING_FORMAT_VORGABE: BreakingFormat = "tagteam";

function leseSchalter(wert: string | undefined): BreakingFormat | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "alt" || w === "gauntlet" || w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off" || w === "standard") return "gauntlet";
  return "tagteam";
}

/** Das Format, das der Schalter fuer kuenftige Spieltage verlangt. Browser-Variante zuerst, dann Server. */
export function breakingFormatSchalter(): BreakingFormat {
  return (
    leseSchalter(process.env.NEXT_PUBLIC_OLY_BREAKING_FORMAT) ??
    leseSchalter(process.env.OLY_BREAKING_FORMAT) ??
    BREAKING_FORMAT_VORGABE
  );
}

type FormatQuelle =
  | {
      seasonState?: (Pick<SeasonState, "seasonId" | "matchdayResults"> & { breakingFormat?: BreakingFormatStempel | null }) | null;
      season?: { id?: string; matchdayIds?: readonly string[] } | null;
      scenarioMeta?: { gameMode?: string | null } | null;
    }
  | null
  | undefined;

function saisonIdVon(gameState: FormatQuelle): string | null {
  return gameState?.seasonState?.seasonId ?? gameState?.season?.id ?? null;
}

function gueltigerStempel(gameState: FormatQuelle): BreakingFormatStempel | null {
  const stempel = gameState?.seasonState?.breakingFormat;
  const seasonId = saisonIdVon(gameState);
  if (!stempel || !seasonId || stempel.seasonId !== seasonId || !Array.isArray(stempel.wechsel) || stempel.wechsel.length === 0) {
    return null;
  }
  return stempel;
}

/**
 * Der Stempel, den der Spielstand nach dem Laden traegt: vorhandener Stempel plus (falls der Schalter etwas
 * anderes verlangt) ein Wechsel ab dem ersten noch nicht gewerteten Spieltag. Rein; `null`, wenn es fuer diese
 * Saison nichts zu stempeln gibt (keine Saison bekannt).
 */
export function breakingFormatStempelNachLaden(gameState: FormatQuelle, schalter: BreakingFormat = breakingFormatSchalter()): BreakingFormatStempel | null {
  const seasonId = saisonIdVon(gameState);
  if (!seasonId) return null;
  const gebucht = new Set(
    (gameState?.seasonState?.matchdayResults ?? []).filter((r) => r.seasonId === seasonId).map((r) => r.matchdayId),
  );
  const ids = gameState?.season?.matchdayIds ?? [];
  const naechster = ids.find((id) => !gebucht.has(id)) ?? null;
  const vorhanden = gueltigerStempel(gameState);
  if (!vorhanden) {
    // Neue Saison (nichts gewertet) oder Spielstand von vor dem 22.11.: gebuchte Spieltage liefen "alt".
    if (gebucht.size === 0 || schalter === "gauntlet") return { seasonId, wechsel: [{ ab: null, format: gebucht.size === 0 ? schalter : "gauntlet" }] };
    if (!naechster) return { seasonId, wechsel: [{ ab: null, format: "gauntlet" }] };
    return { seasonId, wechsel: [{ ab: null, format: "gauntlet" }, { ab: naechster, format: schalter }] };
  }
  const letzter = vorhanden.wechsel[vorhanden.wechsel.length - 1];
  if (letzter.format === schalter || !naechster) return vorhanden;
  // Kein gewerteter Spieltag seit dem letzten Wechsel: der letzte Wechsel wird ersetzt statt gestapelt.
  if (letzter.ab === naechster || (letzter.ab === null && gebucht.size === 0)) {
    return { seasonId, wechsel: [...vorhanden.wechsel.slice(0, -1), { ab: letzter.ab, format: schalter }] };
  }
  return { seasonId, wechsel: [...vorhanden.wechsel, { ab: naechster, format: schalter }] };
}

/**
 * LADE-MIGRATION (save-repository.ts): setzt bzw. ergaenzt `seasonState.breakingFormat`. Rein und idempotent;
 * gibt dasselbe Objekt zurueck, wenn sich nichts aendert. Nur Battle-Spielstaende.
 */
export function stempleBreakingFormat<T extends Pick<GameState, "seasonState" | "season"> & { scenarioMeta?: { gameMode?: string | null } | null }>(
  gameState: T,
): T {
  if (!gameState?.seasonState) return gameState;
  if (gameState.scenarioMeta?.gameMode !== "battle") return gameState;
  const neu = breakingFormatStempelNachLaden(gameState as FormatQuelle);
  if (!neu) return gameState;
  const alt = gameState.seasonState.breakingFormat;
  if (alt && JSON.stringify(alt) === JSON.stringify(neu)) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, breakingFormat: neu } };
}

/**
 * DAS BREAKING-FORMAT EINES SPIELTAGS. Mit gueltigem Stempel: der letzte Wechsel, dessen Spieltag nicht nach
 * `matchdayId` liegt (unbekannter Spieltag: der zuletzt gueltige). Ohne Stempel (ein Spielstand, der noch
 * nicht durch die Lade-Migration ging, oder ein Manager-Spielstand): dieselbe Regel auf dem Stempel, den die
 * Migration setzen wuerde.
 */
export function breakingFormatFuer(gameState: FormatQuelle, matchdayId?: string | null): BreakingFormat {
  const stempel = gueltigerStempel(gameState) ?? breakingFormatStempelNachLaden(gameState);
  if (!stempel) return breakingFormatSchalter();
  const ids = gameState?.season?.matchdayIds ?? [];
  const hier = matchdayId ? ids.indexOf(matchdayId) : -1;
  let format = stempel.wechsel[0].format;
  for (const w of stempel.wechsel.slice(1)) {
    const ab = w.ab ? ids.indexOf(w.ab) : -1;
    if (hier < 0 || (ab >= 0 && hier >= ab)) format = w.format;
  }
  return format;
}

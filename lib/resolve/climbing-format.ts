/**
 * CLIMBING-FORMAT JE SPIELTAG (Canyon live, 18.11., docs/design/climbing-canyon-live-18-11.md).
 *
 * Chris am 18.11.: „Ja, Canyon soll live gehen.“ Seitdem rechnet der Arena-Motor Climbing im Format
 * "canyon" (Wand mit drei Wegen, Engstelle, Rangeln, Seilschaften; `baueCanyon()` in
 * public/mockups/battle-mode.engine.js). Das alte Format "standard" bleibt als Rueckweg.
 *
 * GEZEIGT = GEBUCHT, AUCH FUER SCHON GEWERTETE SPIELTAGE. Die Arena spielt einen gebuchten Spieltag aus
 * Saat und Kader nach (Host, Spieltags-Ansicht). Haette der Motor einfach die Vorgabe gewechselt, liefe ein
 * schon im alten Format gebuchter Climbing-Spieltag in der Wiedergabe als Canyon -- mit anderen Zeiten
 * und Raengen als gebucht. Deshalb steht das Format IM SPIELSTAND, als Wechselliste der laufenden Saison
 * (`seasonState.climbingFormat`): `wechsel[0]` gilt ab Saisonbeginn, jeder weitere ab seinem Spieltag
 * `ab`. Ein Wechsel wird nur fuer den ERSTEN NOCH NICHT GEWERTETEN Spieltag angehaengt; gebuchte Spieltage
 * behalten ihr Format fuer immer.
 *
 * EINE QUELLE FUER ALLE WEGE: Host (Anzeige), Chromium-Runner und Node-Motor (Vorlauf, Buchung) lesen
 * `climbingFormatFuer(gameState, matchdayId)` und reichen das Ergebnis im Kader-Umschlag als
 * `formatByDisciplineId.climbing` an den Motor (`climbingFormatWaehlen()`). Das Format steht ausserdem im
 * Eingabe-Hash des Vorlaufs (lib/battle/arena-eingabe-hash.ts): ein Wechsel nach dem Vorlauf verwirft ihn.
 *
 * SCHALTER `OLY_CLIMBING_FORMAT` (Server; im Browser `NEXT_PUBLIC_OLY_CLIMBING_FORMAT`, nur fuer Spielstaende
 * ohne Stempel, s. unten), Muster `OLY_PP_SKALA`:
 *   nicht gesetzt | "canyon" | "an"     Canyon (Standard seit 18.11.)
 *   "standard" | "aus" | "0" | "false"  Abschalten: ab dem naechsten gewerteten Spieltag wieder "standard";
 *                                       schon gebuchte Canyon-Spieltage bleiben Canyon (gezeigt = gebucht).
 *                                       Wieder einschalten haengt den naechsten Wechsel an, ebenso sauber.
 *
 * WANN DER STEMPEL GESETZT WIRD: beim Laden eines Spielstands (`stempleClimbingFormat()` in
 * save-repository.ts, neben den anderen Lade-Migrationen), rein und idempotent. Ein laufender Spielstand
 * ohne Stempel bekommt `standard` fuer alle schon gewerteten Spieltage und ab dem naechsten das Format des
 * Schalters; eine neue Saison (Stempel einer anderen Saison) beginnt mit dem Format des Schalters. Nur
 * Battle-Spielstaende (der Manager-Modus kennt die Arena nicht).
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";
import { hockeyTorwartFuer, type HockeyTorwart } from "@/lib/resolve/hockey-torwart";

export type ClimbingFormat = "standard" | "canyon";

export type ClimbingFormatWechsel = { ab: string | null; format: ClimbingFormat };

export type ClimbingFormatStempel = {
  /** Die Saison, fuer die der Stempel gilt. Ein Stempel einer anderen Saison zaehlt nicht. */
  seasonId: string;
  /** `wechsel[0].ab` ist null (ab Saisonbeginn); jeder weitere Eintrag gilt ab seinem Spieltag. */
  wechsel: ClimbingFormatWechsel[];
};

export const CLIMBING_FORMAT_VORGABE: ClimbingFormat = "canyon";

function leseSchalter(wert: string | undefined): ClimbingFormat | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "standard" || w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off" || w === "alt") return "standard";
  return "canyon";
}

/** Das Format, das der Schalter fuer kuenftige Spieltage verlangt. Browser-Variante zuerst, dann Server. */
export function climbingFormatSchalter(): ClimbingFormat {
  return (
    leseSchalter(process.env.NEXT_PUBLIC_OLY_CLIMBING_FORMAT) ??
    leseSchalter(process.env.OLY_CLIMBING_FORMAT) ??
    CLIMBING_FORMAT_VORGABE
  );
}

type FormatQuelle =
  | {
      seasonState?: (Pick<SeasonState, "seasonId" | "matchdayResults"> & { climbingFormat?: ClimbingFormatStempel | null }) | null;
      season?: { id?: string; matchdayIds?: readonly string[] } | null;
      scenarioMeta?: { gameMode?: string | null } | null;
    }
  | null
  | undefined;

function saisonIdVon(gameState: FormatQuelle): string | null {
  return gameState?.seasonState?.seasonId ?? gameState?.season?.id ?? null;
}

function gueltigerStempel(gameState: FormatQuelle): ClimbingFormatStempel | null {
  const stempel = gameState?.seasonState?.climbingFormat;
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
export function climbingFormatStempelNachLaden(gameState: FormatQuelle, schalter: ClimbingFormat = climbingFormatSchalter()): ClimbingFormatStempel | null {
  const seasonId = saisonIdVon(gameState);
  if (!seasonId) return null;
  const gebucht = new Set(
    (gameState?.seasonState?.matchdayResults ?? []).filter((r) => r.seasonId === seasonId).map((r) => r.matchdayId),
  );
  const ids = gameState?.season?.matchdayIds ?? [];
  const naechster = ids.find((id) => !gebucht.has(id)) ?? null;
  const vorhanden = gueltigerStempel(gameState);
  if (!vorhanden) {
    // Neue Saison (nichts gewertet) oder Spielstand von vor dem 18.11.: gebuchte Spieltage liefen "standard".
    if (gebucht.size === 0 || schalter === "standard") return { seasonId, wechsel: [{ ab: null, format: gebucht.size === 0 ? schalter : "standard" }] };
    if (!naechster) return { seasonId, wechsel: [{ ab: null, format: "standard" }] };
    return { seasonId, wechsel: [{ ab: null, format: "standard" }, { ab: naechster, format: schalter }] };
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
 * LADE-MIGRATION (save-repository.ts): setzt bzw. ergaenzt `seasonState.climbingFormat`. Rein und idempotent;
 * gibt dasselbe Objekt zurueck, wenn sich nichts aendert. Nur Battle-Spielstaende.
 */
export function stempleClimbingFormat<T extends Pick<GameState, "seasonState" | "season"> & { scenarioMeta?: { gameMode?: string | null } | null }>(
  gameState: T,
): T {
  if (!gameState?.seasonState) return gameState;
  if (gameState.scenarioMeta?.gameMode !== "battle") return gameState;
  const neu = climbingFormatStempelNachLaden(gameState as FormatQuelle);
  if (!neu) return gameState;
  const alt = gameState.seasonState.climbingFormat;
  if (alt && JSON.stringify(alt) === JSON.stringify(neu)) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, climbingFormat: neu } };
}

/**
 * DAS CLIMBING-FORMAT EINES SPIELTAGS. Mit gueltigem Stempel: der letzte Wechsel, dessen Spieltag nicht nach
 * `matchdayId` liegt (unbekannter Spieltag: der zuletzt gueltige). Ohne Stempel (ein Spielstand, der noch
 * nicht durch die Lade-Migration ging, oder ein Manager-Spielstand): dieselbe Regel auf dem Stempel, den die
 * Migration setzen wuerde.
 */
export function climbingFormatFuer(gameState: FormatQuelle, matchdayId?: string | null): ClimbingFormat {
  const stempel = gueltigerStempel(gameState) ?? climbingFormatStempelNachLaden(gameState);
  if (!stempel) return climbingFormatSchalter();
  const ids = gameState?.season?.matchdayIds ?? [];
  const hier = matchdayId ? ids.indexOf(matchdayId) : -1;
  let format = stempel.wechsel[0].format;
  for (const w of stempel.wechsel.slice(1)) {
    const ab = w.ab ? ids.indexOf(w.ab) : -1;
    if (hier < 0 || (ab >= 0 && hier >= ab)) format = w.format;
  }
  return format;
}

/**
 * Der Teil des Kader-Umschlags fuer den Motor (`formatByDisciplineId`): fuer Climbing das Format, fuer Hockey die
 * Torwart-Regel (22.11., lib/resolve/hockey-torwart.ts); "alle" (Host, der die Disziplin je Spieltag wechselt)
 * traegt beide. Jede andere Disziplin: kein Umschlag.
 */
export type ArenaFormatByDisciplineId = { climbing?: ClimbingFormat; hockey?: HockeyTorwart };

export function arenaFormatByDisciplineId(
  gameState: FormatQuelle & Parameters<typeof hockeyTorwartFuer>[0],
  matchdayId: string | null | undefined,
  disziplin: string | null | undefined,
): ArenaFormatByDisciplineId | undefined {
  if (disziplin === "climbing") return { climbing: climbingFormatFuer(gameState, matchdayId) };
  if (disziplin === "hockey") return { hockey: hockeyTorwartFuer(gameState, matchdayId) };
  if (disziplin === "alle") return { climbing: climbingFormatFuer(gameState, matchdayId), hockey: hockeyTorwartFuer(gameState, matchdayId) };
  return undefined;
}

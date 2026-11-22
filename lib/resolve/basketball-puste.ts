/**
 * BASKETBALL-PUSTE-REGEL JE SPIELTAG (22.11., docs/design/basketball-puste-22-11.md).
 *
 * Arbeitsliste 21.11., Welle 4: „Basketball: Puste; Maru-Fall ST7 (fast null Beteiligung) pruefen.“ Seitdem fuehrt jeder
 * Basketball-Spieler einen Puste-Vorrat (aus AUSDAUER), verbraucht ihn beim Laufen und beim Ballfuehren und wird mit
 * leerer Puste etwas langsamer, schwaecher im Rebound-Gerangel, seltener angespielt und etwas unsicherer im Wurf; dazu
 * kommt ein Beteiligungsboden in der Pass-Lotterie (`BB_PUSTE_KONSTANTE` in public/mockups/battle-mode.engine.js).
 * Die alte Regel ("alt": keine Puste, keine Beteiligungsboden) bleibt als Rueckweg.
 *
 * GEZEIGT = GEBUCHT, AUCH FUER SCHON GEWERTETE SPIELTAGE -- dasselbe Muster wie `hockey-torwart.ts` und `climbing-format.ts`:
 * die Arena spielt einen gebuchten Spieltag aus Saat und Kader nach; haette der Motor einfach die Regel gewechselt, liefe ein
 * schon mit der alten Regel gebuchtes Basketball-Spiel in der Wiedergabe mit anderen Wuerfen und Pass-Zielen. Deshalb steht
 * die Regel IM SPIELSTAND als Wechselliste der laufenden Saison (`seasonState.basketballPuste`): `wechsel[0]` gilt ab
 * Saisonbeginn, jeder weitere ab seinem Spieltag `ab`; gebuchte Spieltage behalten ihre Regel fuer immer.
 *
 * EINE QUELLE FUER ALLE WEGE: Host, Chromium-Runner und Node-Motor lesen `basketballPusteFuer(gameState, matchdayId)`
 * und reichen es im Kader-Umschlag als `formatByDisciplineId.basketball` an den Motor; der Wert steht ausserdem im
 * Eingabe-Hash des Vorlaufs (lib/battle/arena-eingabe-hash.ts).
 *
 * SCHALTER `OLY_BASKETBALL_PUSTE` (Server; im Browser `NEXT_PUBLIC_OLY_BASKETBALL_PUSTE`):
 *   nicht gesetzt | "neu" | "an"         neue Regel (Standard seit 22.11.)
 *   "alt" | "aus" | "0" | "false"        ab dem naechsten gewerteten Spieltag wieder die alte Regel;
 *                                        schon mit der neuen Regel gebuchte Spieltage bleiben so.
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";

export type BasketballPuste = "alt" | "neu";

export type BasketballPusteWechsel = { ab: string | null; format: BasketballPuste };

export type BasketballPusteStempel = {
  /** Die Saison, fuer die der Stempel gilt. Ein Stempel einer anderen Saison zaehlt nicht. */
  seasonId: string;
  /** `wechsel[0].ab` ist null (ab Saisonbeginn); jeder weitere Eintrag gilt ab seinem Spieltag. */
  wechsel: BasketballPusteWechsel[];
};

export const BASKETBALL_PUSTE_VORGABE: BasketballPuste = "neu";

function leseSchalter(wert: string | undefined): BasketballPuste | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "alt" || w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off" || w === "standard") return "alt";
  return "neu";
}

/** Das Format, das der Schalter fuer kuenftige Spieltage verlangt. Browser-Variante zuerst, dann Server. */
export function basketballPusteSchalter(): BasketballPuste {
  return (
    leseSchalter(process.env.NEXT_PUBLIC_OLY_BASKETBALL_PUSTE) ??
    leseSchalter(process.env.OLY_BASKETBALL_PUSTE) ??
    BASKETBALL_PUSTE_VORGABE
  );
}

type FormatQuelle =
  | {
      seasonState?: (Pick<SeasonState, "seasonId" | "matchdayResults"> & { basketballPuste?: BasketballPusteStempel | null }) | null;
      season?: { id?: string; matchdayIds?: readonly string[] } | null;
      scenarioMeta?: { gameMode?: string | null } | null;
    }
  | null
  | undefined;

function saisonIdVon(gameState: FormatQuelle): string | null {
  return gameState?.seasonState?.seasonId ?? gameState?.season?.id ?? null;
}

function gueltigerStempel(gameState: FormatQuelle): BasketballPusteStempel | null {
  const stempel = gameState?.seasonState?.basketballPuste;
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
export function basketballPusteStempelNachLaden(gameState: FormatQuelle, schalter: BasketballPuste = basketballPusteSchalter()): BasketballPusteStempel | null {
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
    if (gebucht.size === 0 || schalter === "alt") return { seasonId, wechsel: [{ ab: null, format: gebucht.size === 0 ? schalter : "alt" }] };
    if (!naechster) return { seasonId, wechsel: [{ ab: null, format: "alt" }] };
    return { seasonId, wechsel: [{ ab: null, format: "alt" }, { ab: naechster, format: schalter }] };
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
 * LADE-MIGRATION (save-repository.ts): setzt bzw. ergaenzt `seasonState.basketballPuste`. Rein und idempotent;
 * gibt dasselbe Objekt zurueck, wenn sich nichts aendert. Nur Battle-Spielstaende.
 */
export function stempleBasketballPuste<T extends Pick<GameState, "seasonState" | "season"> & { scenarioMeta?: { gameMode?: string | null } | null }>(
  gameState: T,
): T {
  if (!gameState?.seasonState) return gameState;
  if (gameState.scenarioMeta?.gameMode !== "battle") return gameState;
  const neu = basketballPusteStempelNachLaden(gameState as FormatQuelle);
  if (!neu) return gameState;
  const alt = gameState.seasonState.basketballPuste;
  if (alt && JSON.stringify(alt) === JSON.stringify(neu)) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, basketballPuste: neu } };
}

/**
 * DIE PUSTE-REGEL EINES SPIELTAGS. Mit gueltigem Stempel: der letzte Wechsel, dessen Spieltag nicht nach
 * `matchdayId` liegt (unbekannter Spieltag: der zuletzt gueltige). Ohne Stempel (ein Spielstand, der noch
 * nicht durch die Lade-Migration ging, oder ein Manager-Spielstand): dieselbe Regel auf dem Stempel, den die
 * Migration setzen wuerde.
 */
export function basketballPusteFuer(gameState: FormatQuelle, matchdayId?: string | null): BasketballPuste {
  const stempel = gueltigerStempel(gameState) ?? basketballPusteStempelNachLaden(gameState);
  if (!stempel) return basketballPusteSchalter();
  const ids = gameState?.season?.matchdayIds ?? [];
  const hier = matchdayId ? ids.indexOf(matchdayId) : -1;
  let format = stempel.wechsel[0].format;
  for (const w of stempel.wechsel.slice(1)) {
    const ab = w.ab ? ids.indexOf(w.ab) : -1;
    if (hier < 0 || (ab >= 0 && hier >= ab)) format = w.format;
  }
  return format;
}

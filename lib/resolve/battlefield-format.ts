/**
 * BATTLEFIELD-FORMAT JE SPIELTAG (Fuenf-Punkte-Domination live, 22.11., docs/design/battlefield-5punkte-22-11.md).
 *
 * Arbeitsliste 21.11., Welle 4: „Battlefield: 5-Punkte-Domination als Standard + Respawns mit sinkenden HP.“
 * Seitdem bucht und zeigt Battlefield im Vier-Team-Pod das Format "domination5" (fuenf Orte, 1 Punkt je Sekunde und
 * gehaltenem Ort, Respawn mit sinkenden HP; `bfd5Gefecht()` in public/mockups/battle-mode.engine.js). Das alte
 * "Gefecht je Ort" ("orte3", drei Orte, Ausscheiden) bleibt als Rueckweg.
 *
 * GEZEIGT = GEBUCHT, AUCH FUER SCHON GEWERTETE SPIELTAGE -- dasselbe Muster wie `climbing-format.ts` (Canyon): ein
 * schon im alten Format gebuchter Battlefield-Spieltag wird in der Arena aus Saat und Kader nachgespielt; haette der
 * Motor einfach die Vorgabe gewechselt, liefe die Wiedergabe in einem anderen Format als gebucht. Deshalb steht das
 * Format IM SPIELSTAND, als Wechselliste der laufenden Saison (`seasonState.battlefieldFormat`): `wechsel[0]` gilt
 * ab Saisonbeginn, jeder weitere ab seinem Spieltag `ab`. Ein Wechsel wird nur fuer den ERSTEN NOCH NICHT GEWERTETEN
 * Spieltag angehaengt; gebuchte Spieltage behalten ihr Format fuer immer.
 *
 * WANN GILT DIE UMSTELLUNG (Entscheidung wie bei Canyon): AB DEM NAECHSTEN GEWERTETEN SPIELTAG, nicht erst zum
 * Saisonwechsel. Begruendung: das Format aendert nur, WIE ein Pod-Kampf ausgespielt wird, nicht die Wertungsskala
 * (anders als PP-Skala C2/E1, die die Vergleichbarkeit der Saison beruehren); der Pod bucht weiter Platz 1..4 und
 * 2-1-0-0 Ligapunkte, und schon gebuchte Spieltage bleiben unangetastet. Wer lieber zum Saisonwechsel umstellen
 * will, setzt den Schalter erst dann.
 *
 * EINE QUELLE FUER ALLE WEGE: Host (Anzeige, `echterKader.battlefieldPod.format`), Chromium-Runner und Node-Runner
 * (Vorlauf, Buchung) lesen `battlefieldFormatFuer(gameState, matchdayId)` und reichen das Ergebnis als
 * `optionen.format` an `spieleBattlefieldPod()`. Das Format steht ausserdem im Eingabe-Hash des Vorlaufs
 * (lib/battle/arena-eingabe-hash.ts): ein Wechsel nach dem Vorlauf verwirft ihn.
 *
 * SCHALTER `OLY_BATTLEFIELD_FORMAT` (Server; im Browser `NEXT_PUBLIC_OLY_BATTLEFIELD_FORMAT`, nur fuer Spielstaende
 * ohne Stempel, s. unten), Muster `OLY_CLIMBING_FORMAT`:
 *   nicht gesetzt | "domination5" | "an"   Fuenf Punkte (Standard seit 22.11.)
 *   "alt" | "orte3" | "aus" | "0" | "false"  Abschalten: ab dem naechsten gewerteten Spieltag wieder "orte3";
 *                                       schon gebuchte Fuenf-Punkte-Spieltage bleiben so (gezeigt = gebucht).
 *                                       Wieder einschalten haengt den naechsten Wechsel an, ebenso sauber.
 *
 * WANN DER STEMPEL GESETZT WIRD: beim Laden eines Spielstands (`stempleBattlefieldFormat()` in save-repository.ts,
 * neben den anderen Lade-Migrationen), rein und idempotent. Ein laufender Spielstand ohne Stempel bekommt "orte3"
 * fuer alle schon gewerteten Spieltage und ab dem naechsten das Format des Schalters; eine neue Saison (Stempel einer
 * anderen Saison) beginnt mit dem Format des Schalters. Nur Battle-Spielstaende (der Manager-Modus kennt die Arena nicht).
 *
 * DUELL: Das Fuenf-Punkte-Gefecht ist ein Vier-Team-Format (3 oder 4 Teams im Pod). Das Zweier-Duell
 * (`spieleArenaDomination`, Kontrollpunkt-Regel) wird in der Liga nicht gebucht -- ein Spieltag ohne Pods faellt
 * auf den PPS-Pod -- und bleibt deshalb unveraendert.
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";

export type BattlefieldFormat = "orte3" | "domination5";

export type BattlefieldFormatWechsel = { ab: string | null; format: BattlefieldFormat };

export type BattlefieldFormatStempel = {
  /** Die Saison, fuer die der Stempel gilt. Ein Stempel einer anderen Saison zaehlt nicht. */
  seasonId: string;
  /** `wechsel[0].ab` ist null (ab Saisonbeginn); jeder weitere Eintrag gilt ab seinem Spieltag. */
  wechsel: BattlefieldFormatWechsel[];
};

export const BATTLEFIELD_FORMAT_VORGABE: BattlefieldFormat = "domination5";

function leseSchalter(wert: string | undefined): BattlefieldFormat | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "orte3" || w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off" || w === "alt") return "orte3";
  return "domination5";
}

/** Das Format, das der Schalter fuer kuenftige Spieltage verlangt. Browser-Variante zuerst, dann Server. */
export function battlefieldFormatSchalter(): BattlefieldFormat {
  return (
    leseSchalter(process.env.NEXT_PUBLIC_OLY_BATTLEFIELD_FORMAT) ??
    leseSchalter(process.env.OLY_BATTLEFIELD_FORMAT) ??
    BATTLEFIELD_FORMAT_VORGABE
  );
}

type FormatQuelle =
  | {
      seasonState?: (Pick<SeasonState, "seasonId" | "matchdayResults"> & { battlefieldFormat?: BattlefieldFormatStempel | null }) | null;
      season?: { id?: string; matchdayIds?: readonly string[] } | null;
      scenarioMeta?: { gameMode?: string | null } | null;
    }
  | null
  | undefined;

function saisonIdVon(gameState: FormatQuelle): string | null {
  return gameState?.seasonState?.seasonId ?? gameState?.season?.id ?? null;
}

function gueltigerStempel(gameState: FormatQuelle): BattlefieldFormatStempel | null {
  const stempel = gameState?.seasonState?.battlefieldFormat;
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
export function battlefieldFormatStempelNachLaden(gameState: FormatQuelle, schalter: BattlefieldFormat = battlefieldFormatSchalter()): BattlefieldFormatStempel | null {
  const seasonId = saisonIdVon(gameState);
  if (!seasonId) return null;
  const gebucht = new Set(
    (gameState?.seasonState?.matchdayResults ?? []).filter((r) => r.seasonId === seasonId).map((r) => r.matchdayId),
  );
  const ids = gameState?.season?.matchdayIds ?? [];
  const naechster = ids.find((id) => !gebucht.has(id)) ?? null;
  const vorhanden = gueltigerStempel(gameState);
  if (!vorhanden) {
    // Neue Saison (nichts gewertet) oder Spielstand von vor dem 22.11.: gebuchte Spieltage liefen "orte3".
    if (gebucht.size === 0 || schalter === "orte3") return { seasonId, wechsel: [{ ab: null, format: gebucht.size === 0 ? schalter : "orte3" }] };
    if (!naechster) return { seasonId, wechsel: [{ ab: null, format: "orte3" }] };
    return { seasonId, wechsel: [{ ab: null, format: "orte3" }, { ab: naechster, format: schalter }] };
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
 * LADE-MIGRATION (save-repository.ts): setzt bzw. ergaenzt `seasonState.battlefieldFormat`. Rein und idempotent;
 * gibt dasselbe Objekt zurueck, wenn sich nichts aendert. Nur Battle-Spielstaende.
 */
export function stempleBattlefieldFormat<T extends Pick<GameState, "seasonState" | "season"> & { scenarioMeta?: { gameMode?: string | null } | null }>(
  gameState: T,
): T {
  if (!gameState?.seasonState) return gameState;
  if (gameState.scenarioMeta?.gameMode !== "battle") return gameState;
  const neu = battlefieldFormatStempelNachLaden(gameState as FormatQuelle);
  if (!neu) return gameState;
  const alt = gameState.seasonState.battlefieldFormat;
  if (alt && JSON.stringify(alt) === JSON.stringify(neu)) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, battlefieldFormat: neu } };
}

/**
 * DAS CLIMBING-FORMAT EINES SPIELTAGS. Mit gueltigem Stempel: der letzte Wechsel, dessen Spieltag nicht nach
 * `matchdayId` liegt (unbekannter Spieltag: der zuletzt gueltige). Ohne Stempel (ein Spielstand, der noch
 * nicht durch die Lade-Migration ging, oder ein Manager-Spielstand): dieselbe Regel auf dem Stempel, den die
 * Migration setzen wuerde.
 */
export function battlefieldFormatFuer(gameState: FormatQuelle, matchdayId?: string | null): BattlefieldFormat {
  const stempel = gueltigerStempel(gameState) ?? battlefieldFormatStempelNachLaden(gameState);
  if (!stempel) return battlefieldFormatSchalter();
  const ids = gameState?.season?.matchdayIds ?? [];
  const hier = matchdayId ? ids.indexOf(matchdayId) : -1;
  let format = stempel.wechsel[0].format;
  for (const w of stempel.wechsel.slice(1)) {
    const ab = w.ab ? ids.indexOf(w.ab) : -1;
    if (hier < 0 || (ab >= 0 && hier >= ab)) format = w.format;
  }
  return format;
}

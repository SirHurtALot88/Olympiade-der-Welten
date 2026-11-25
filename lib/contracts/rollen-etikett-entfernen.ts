/**
 * ROLLEN-ETIKETT ENTFERNT (Chris 25.11., docs/design/vertragswert-bau-25-11.md): „Stammspieler / Bank / Nachwuchs“ am Kadereintrag
 * ist raus — „Lösch das mal und guck mal, dass da auch keine Code-Rückstände sind.“ Jeder Kaufweg schrieb „Nachwuchs“, nichts setzte
 * je „Stammspieler“; damit sperrte das Etikett unter anderem 5-Jahres-Verlaengerungen fuer alle.
 *
 * Bestehende Spielstaende tragen das Feld noch. Beim Laden wird es entfernt (nicht abstuerzen, nicht weiterschleppen). Das gilt
 * SOFORT, ohne Regel-Stempel: es war ein Fehler, keine Spielregel. Einzige Stelle im Code, die den alten Feldnamen noch kennt.
 */
import type { GameState, RosterEntry } from "@/lib/data/olyDataTypes";

const ALTER_FELDNAME = "roleTag";

export function entferneRollenEtikettNachLaden(gameState: GameState): GameState {
  const rosters = gameState.rosters ?? [];
  if (!rosters.some((entry) => Object.prototype.hasOwnProperty.call(entry, ALTER_FELDNAME))) return gameState;
  return {
    ...gameState,
    rosters: rosters.map((entry) => {
      if (!Object.prototype.hasOwnProperty.call(entry, ALTER_FELDNAME)) return entry;
      const kopie = { ...entry } as RosterEntry & Record<string, unknown>;
      delete kopie[ALTER_FELDNAME];
      return kopie as RosterEntry;
    }),
  };
}

/**
 * FORMKARTEN-WIRKUNG FUER DIE ANZEIGE (18.11.) — "gezeigt = gebucht".
 *
 * Die Zahlen kommen aus `calculateFormModifierForSide` (dieselbe Funktion wie Wertung, Arena-
 * Aufstellungsadapter und KI), nur mit einer Kartenauswahl, die der Aufrufer vorgibt. Zusaetzlich sagt
 * `formkartenBuchung`, ob die Punkte in dieser Disziplin ueberhaupt gebucht werden:
 *
 *  - Manager-Modus (Legacy-Wertung): ueberall.
 *  - Battle-Modus, Disziplin arena-aufgeloest: nur wenn der Motor die echte Karte liest
 *    (`FORMKARTEN_ECHT_DISCIPLINE_IDS`, heute time-trial und spurt). In den uebrigen arena-aufgeloesten
 *    Disziplinen zieht der Motor eine Ersatzkarte; die gespielte Karte zaehlt dort nicht — die
 *    Vorschau darf dann keine Punkte versprechen.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { nutztEchteFormkarten } from "@/lib/battle/formkarten-echt-disziplinen";
import {
  buildFormkartenPlayers,
  calculateFormModifierForSide,
  getFormCardColorForDisciplineCategory,
  normalizeLineupDraftModifiers,
} from "@/lib/lineups/legacy-lineup-modifiers";
import { isFormkartenFarbregelEnabled, type FormkartenZerlegung } from "@/lib/lineups/formkarten-farbregel";
import type { LegacyFormCardOption, LegacyRosterPlayerRef } from "@/lib/lineups/legacy-lineup-types";
import { isBattleModeSave } from "@/lib/season/game-mode";

export type FormkartenBuchung = { gebucht: boolean; grund: string | null };

export function formkartenBuchung(gameState: GameState | null | undefined, disciplineId: string | null | undefined): FormkartenBuchung {
  if (!gameState || !disciplineId) return { gebucht: true, grund: null };
  if (isBattleModeSave(gameState) && ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId) && !nutztEchteFormkarten(disciplineId)) {
    return {
      gebucht: false,
      grund: "In dieser Arena-Disziplin zählt die gespielte Karte noch nicht — der Motor nimmt eine Ersatzkarte. Die Punkte hier sind kein Versprechen.",
    };
  }
  return { gebucht: true, grund: null };
}

export type KartenWirkung = {
  regelNeu: boolean;
  karten: Array<{ id: string; wert: number; farbe: string; passt: boolean }>;
  spieler: Array<{ playerId: string; zerlegung: FormkartenZerlegung }>;
  teamSumme: number;
  alleAnteil: number;
  traegerAnzahl: number;
  buchung: FormkartenBuchung;
};

export function berechneKartenWirkung(input: {
  gameState?: GameState | null;
  side: "d1" | "d2";
  disciplineId: string | null;
  disciplineCategory: string | null | undefined;
  formCards: LegacyFormCardOption[];
  primaryCardId: string | null;
  secondaryCardId: string | null;
  playerIds: string[];
  rosterPlayers?: LegacyRosterPlayerRef[] | null;
}): KartenWirkung {
  const farbe = getFormCardColorForDisciplineCategory(input.disciplineCategory);
  const modifiers = normalizeLineupDraftModifiers({
    [input.side]: { primaryFormCardId: input.primaryCardId, secondaryFormCardId: input.secondaryCardId },
  } as never);
  const ergebnis = calculateFormModifierForSide({
    modifiers,
    disciplineSide: input.side,
    disciplineColor: farbe,
    playerCount: input.playerIds.length,
    formCards: input.formCards,
    players: buildFormkartenPlayers({ playerIds: input.playerIds, rosterPlayers: input.rosterPlayers, gameState: input.gameState }),
  });
  const gewaehlt = [input.primaryCardId, input.secondaryCardId]
    .map((id) => (id ? input.formCards.find((c) => c.id === id && !c.isUsed) ?? null : null))
    .filter((c): c is LegacyFormCardOption => c != null);
  const spieler = Object.entries(ergebnis.formByPlayerId ?? {}).map(([playerId, zerlegung]) => ({ playerId, zerlegung }));
  return {
    regelNeu: isFormkartenFarbregelEnabled(),
    karten: gewaehlt.map((c) => ({ id: c.id, wert: c.value, farbe: c.color, passt: farbe != null && c.color === farbe })),
    spieler,
    teamSumme: ergebnis.formModifier,
    alleAnteil: spieler.length ? Math.min(...spieler.map((s) => s.zerlegung.alle)) : 0,
    traegerAnzahl: spieler.filter((s) => s.zerlegung.istTraeger).length,
    buchung: formkartenBuchung(input.gameState, input.disciplineId),
  };
}

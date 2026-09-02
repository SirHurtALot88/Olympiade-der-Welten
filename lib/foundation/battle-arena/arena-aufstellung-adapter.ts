import type { GameState } from "@/lib/data/olyDataTypes";
import { resolveSlotRoleShortId } from "@/lib/lineups/matchday-slot-roles";

/**
 * DAS ROHR VON DER AUFSTELLUNG ZUR ARENA.
 *
 * Chris' Fund: „den Slot in den ich einen Spieler einsetze wuerde ich gerne quasi auf dem
 * Feld wieder erkennen, im Basketball ist ein Center auch eher unterm Korb als an der
 * 3P Linie zu finden".
 *
 * Nachgesehen, warum das bisher nicht ging: der Motor FRAGT laengst nach der Aufstellung.
 * `slotFuer(p,i)` in `bauFeldspiel` (battle-mode.engine.js) liest `place[p.n].slot` und
 * faellt nur dann auf Reihum zurueck, wenn dort nichts steht — und `place` wurde
 * ausschliesslich von der Aufstellungstafel des Mockups selbst gefuellt. Der
 * Produktivpfad (`buildArenaTeam` in arena-kader-adapter.ts) reichte NUR den Kader durch;
 * die Datei enthaelt kein einziges Vorkommen von `place` oder `slot`. Es fehlte also das
 * Rohr, nicht die Buchse.
 *
 * Diese Datei baut das Rohr: aus dem `LineupDraft` des Spieltags wird die Zuordnung
 * `Spielername -> {d: Disziplin, slot: Rollenkennung}`, in genau der Form, die der Motor
 * ohnehin erwartet.
 *
 * ZWEI KENNUNGEN, EINE ABBILDUNG. Produktionsseitig heisst eine Rolle
 * `hockey-6-powerforward`, im Motor kurz `powerforward`. Die Umrechnung steht bewusst
 * NICHT hier, sondern als `resolveSlotRoleShortId` in `matchday-slot-roles.ts` — dort
 * liegt die Themenliste, aus der beide Kennungen entstehen, und dort gehoert das Wissen
 * ueber ihre Form hin. Diese Datei bleibt reine Verdrahtung.
 */

/** Was der Motor als `place`-Eintrag erwartet: Disziplin plus kurze Rollenkennung. */
export type ArenaAufstellungEintrag = { d: string; slot: string };

/** Spielername -> Platzierung. Der Motor schluesselt `place` ueber den NAMEN, nicht die ID. */
export type ArenaAufstellung = Record<string, ArenaAufstellungEintrag>;

/**
 * Baut die Zuordnung fuer EIN Team aus dem Aufstellungsentwurf des Spieltags.
 *
 * Gibt ein leeres Objekt zurueck, wenn es keinen Entwurf gibt oder keine Eintraege
 * passen. Das ist der wichtige Fall: ohne Aufstellung muss sich die Arena verhalten wie
 * bisher, sonst waere jede bestehende Messung entwertet. Der Motor faellt dann auf seine
 * Reihum-Vergabe zurueck, genau wie vorher.
 */
export function buildArenaAufstellung(
  gameState: GameState,
  teamId: string,
  matchdayId: string | null | undefined,
): ArenaAufstellung {
  if (!matchdayId) return {};
  const entwuerfe = gameState.seasonState?.lineupDrafts ?? [];
  const entwurf = entwuerfe.find(
    (draft) => draft.teamId === teamId && draft.matchdayId === matchdayId,
  );
  if (!entwurf || entwurf.entries.length === 0) return {};

  const nameVon = new Map(gameState.players.map((player) => [player.id, player.name]));
  const aufstellung: ArenaAufstellung = {};

  for (const eintrag of entwurf.entries) {
    // `activePlayerId` gewinnt: er traegt den tatsaechlich eingewechselten Spieler,
    // `playerId` den urspruenglich gesetzten. Wer auf dem Feld steht, gehoert auf den
    // Slot — nicht, wer dafuer vorgesehen war.
    const spielerId = eintrag.activePlayerId ?? eintrag.playerId;
    const name = nameVon.get(spielerId);
    if (!name) continue;

    const slot = resolveSlotRoleShortId(eintrag.disciplineId, null, eintrag.slotIndex);
    if (!slot) continue;

    aufstellung[name] = { d: eintrag.disciplineId, slot };
  }
  return aufstellung;
}

/**
 * Beide Seiten zusammen, so wie der Umschlag sie transportiert. Heim und Gast landen in
 * EINEM Objekt, weil der Motor `place` als eine einzige Tabelle ueber Spielernamen fuehrt
 * — dieselbe Bauform, die die Aufstellungstafel des Mockups schon benutzt. Namen sind
 * ueber beide Kader eindeutig, weil ein Spieler nur in einem Team steht.
 */
export function buildArenaAufstellungBeide(
  gameState: GameState,
  heimTeamId: string,
  gastTeamId: string,
  matchdayId: string | null | undefined,
): ArenaAufstellung {
  return {
    ...buildArenaAufstellung(gameState, heimTeamId, matchdayId),
    ...buildArenaAufstellung(gameState, gastTeamId, matchdayId),
  };
}

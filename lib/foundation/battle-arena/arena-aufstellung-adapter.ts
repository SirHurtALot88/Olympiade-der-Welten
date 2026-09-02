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
  // `activePlayerId` ist die Id der KADER-ZEILE, nicht die des Spielers.
  //
  // Das ist die Falle, in die ein erster Entwurf dieser Datei voll hineingelaufen ist: er
  // las `activePlayerId ?? playerId` und schlug damit eine Kader-Eintrags-Id
  // (`season-loop-roster-7`) in der Spieler-Tabelle nach. Am echten Spielstand gemessen
  // kamen dadurch NULL von 480 Eintraegen an — alle 64 Aufstellungen blieben leer, und
  // zwar lautlos: der Motor faellt bei leerem `place` auf sein Reihum zurueck und sieht
  // voellig gesund aus. Aufgefallen ist es erst, weil ein Review gegen einen echten Export
  // gemessen hat statt gegen den Beispielkader des Mockups, wo `activePlayerId` null ist.
  //
  // Die Semantik ist im Rest des Codes eindeutig (`legacy-lineup-lab.ts:97`,
  // `ai-legacy-lineup-engine.ts:587`): `activePlayerId` zeigt auf die Roster-Zeile
  // DESSELBEN Spielers, es ist kein „Eingewechselter". Der Umweg ueber `rosters` ist
  // deshalb kein Zusatz, sondern die einzige richtige Aufloesung.
  const spielerZuKaderzeile = new Map(gameState.rosters.map((zeile) => [zeile.id, zeile.playerId]));
  const aufstellung: ArenaAufstellung = {};

  for (const eintrag of entwurf.entries) {
    const spielerId = eintrag.activePlayerId
      ? spielerZuKaderzeile.get(eintrag.activePlayerId) ?? eintrag.playerId
      : eintrag.playerId;
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
 * — dieselbe Bauform, die die Aufstellungstafel des Mockups schon benutzt.
 *
 * NAMENSGLEICHHEIT IST MOEGLICH, nur selten. Ein frueherer Kommentar hier behauptete,
 * Namen seien ueber beide Kader eindeutig, „weil ein Spieler nur in einem Team steht" —
 * das begruendet das Falsche: die Frage ist nicht, ob derselbe Spieler zweimal antritt,
 * sondern ob ZWEI Spieler denselben Namen tragen. Der Namensgenerator baut aus 280
 * Kombinationen ohne Eindeutigkeitspruefung (`buildGeneratedName`); entdoppelt wird nur
 * die Id. Im echten Export war kein Doppel, aber ab einigen Dutzend generierten Spielern
 * wird eines wahrscheinlich.
 *
 * Deshalb: HEIM GEWINNT, ausdruecklich statt zufaellig. Bei einer Kollision behaelt der
 * Heim-Eintrag seinen Slot, der Gast faellt fuer diesen einen Spieler auf Reihum zurueck.
 * Ein blosses Zusammenfuegen haette dem Gast den Vorrang gegeben (Spread-Reihenfolge) und
 * dem Heimteam still seine Aufstellung genommen.
 */
export function buildArenaAufstellungBeide(
  gameState: GameState,
  heimTeamId: string,
  gastTeamId: string,
  matchdayId: string | null | undefined,
): ArenaAufstellung {
  const heim = buildArenaAufstellung(gameState, heimTeamId, matchdayId);
  const gast = buildArenaAufstellung(gameState, gastTeamId, matchdayId);
  return { ...gast, ...heim };
}

/**
 * WIE VIELE ETAPPEN HAT EINE DISZIPLIN — die eine Stelle, die das entscheidet.
 *
 * URSPRÜNGLICHE MELDUNG: „Ziel nach 3 von 5 Etappen erreicht, danach passiert nichts mehr."
 * Die Etappenzahl kam aus `model.slotCount`, und das ist `discipline.playerCount` — die
 * ANFORDERUNG der Disziplin, nicht die tatsächliche Aufstellung. Stellt ein Spieltag weniger
 * Spieler als gefordert (bei Staffel und Takeshi vorgekommen), lief die Arena trotzdem über die
 * geforderte Zahl: in den überzähligen Etappen ist `players[r]` `undefined`, es wird nichts
 * addiert, im Feld bewegt sich nichts. Die Ziellinie ist dagegen der Endstand des besten Teams
 * über DESSEN Spieler und war nach der letzten echten Etappe erreicht.
 *
 * WARUM DIE RECHNUNG JETZT HIER STEHT und nicht mehr in `DisciplineStageArena.tsx`: seit
 * Befund B3 (`docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md`) braucht sie ein ZWEITER Aufrufer — der
 * Arena-Gleichlauf meldet dem Mitspieler damit, wie viele Etappen es zu enthüllen gibt. Vorher
 * sendete er dort hart eine 0, wodurch der Gast dauerhaft vor Etappe 1 stehen blieb. Anzeige und
 * Gleichlauf MÜSSEN dieselbe Zahl nehmen: zählte der Host anders, als der Gast als Ziel bekommt,
 * hielte der Gast zu früh an oder wartete auf eine Etappe, die nie kommt.
 *
 * Vorher hielt ein Test diese Rechnung als TEXT fest (`toContain` auf den Ausdruck im Bauteil).
 * Das ging beim Herausziehen kaputt, obwohl die Eigenschaft unverändert galt — genau der Grund,
 * warum Tests die Eigenschaft pinnen sollen und nicht die Schreibweise. Als eigene Funktion ist
 * sie ohne Rendering prüfbar.
 */

export type DisciplineStageSlotCountInput = {
  /**
   * Wie viele Spieler jedes Team in dieser Disziplin tatsächlich aufgestellt hat. Leer, solange
   * weder Vorschau noch gebuchtes Ergebnis vorliegen.
   */
  playerCountsByTeam: readonly number[];
  /**
   * Rückfall: die Slot-Zahl des Disziplin-Modells (= `discipline.playerCount`, die Anforderung).
   * Gilt NUR, wenn gar keine Aufstellung vorliegt — sonst wäre man wieder beim ursprünglichen
   * Fehler.
   */
  fallbackSlotCount: number;
};

/**
 * MAXIMUM, nicht Minimum: Teams dürfen unterschiedlich viele Spieler haben, und wer mehr hat, muss
 * sie auch alle zeigen dürfen. Ein Minimum unterschlüge Etappen.
 *
 * NIE UNTER 1: eine Arena ohne eine einzige Etappe hätte nichts zu enthüllen und liefe sofort ins
 * Ziel — für den Gleichlauf hieße das dieselbe Sackgasse wie die alte 0.
 */
export function resolveDisciplineStageSlotCount(input: DisciplineStageSlotCountInput): number {
  const maxFielded = input.playerCountsByTeam.reduce(
    (max, count) => Math.max(max, Number.isFinite(count) ? count : 0),
    0,
  );
  return Math.max(1, maxFielded || input.fallbackSlotCount);
}

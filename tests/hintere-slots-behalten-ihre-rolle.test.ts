/**
 * SPIELER IN DEN HINTEREN SLOTS BEHALTEN IHRE SLOT-ROLLE — auch wenn davor alles leer ist.
 *
 * GEMELDET VON CHRIS: „Bitte überprüfen, dass wenn z.B. nur 2 Spieler in einer 6er eingesetzt
 * werden, dass diese Spieler auch weiter in ihrem Slot mit ihren Werten bleiben! Also wenn ich in
 * 5 + 6 Slot die spieler einsetze, sollen sie auch dann starten auch wenn davor dann alle slots
 * leer sind!"
 *
 * WAS DIE PRÜFUNG ERGAB — zwei getrennte Fragen, zwei getrennte Antworten:
 *
 *  1. STARTEN SIE? Ja, und das war nie anders. `scoreLegacyLineupDisciplineSide` nimmt alle
 *     Einträge der Seite, nach `slotIndex` sortiert, und wertet sie; es gibt kein Zusammenrücken
 *     auf die vorderen Plätze. Der `slotIndex` wird unverändert bis ins Ergebnis durchgereicht.
 *
 *  2. BEHALTEN SIE IHRE WERTE? Das konnte kippen. Die Rollenliste war auf die Zahl der EINTRÄGE
 *     dimensioniert (`requiredPlayers ?? entries.length`). Fiel `requiredPlayers` weg, entstanden
 *     bei zwei Einträgen genau zwei Rollen — und `roles[4]`/`roles[5]` waren `undefined`. Beide
 *     Spieler rechneten dann OHNE Rolle. Am Live-Abbild gemessen (Basketball, zwei echte Spieler):
 *     mit bekannter Slotzahl −5,1 (ihre echten Rollen clutchshot/fastbreak), ohne sie 0.
 *
 * DIE REPARATUR ist bewusst klein: die Liste reicht jetzt mindestens bis zum höchsten BESETZTEN
 * Slot. Bei einer lückenlosen Aufstellung 1..n ist das exakt die alte Zahl — dort ändert sich
 * nichts, und genau das hält der letzte Fall hier fest.
 */
import { describe, expect, it } from "vitest";

import {
  calculateSideSlotRoleModifierTotal,
  resolveSlotRolesForDiscipline,
} from "@/lib/lineups/matchday-slot-roles";

const DISZIPLIN = "basketball";

/** Zwei Spieler mit UNTERSCHIEDLICHEN Attributen — bei gleichen kann keine Rolle etwas bewegen. */
const SPIELER = [
  {
    id: "p-a",
    attributeStats: {
      power: 78, speed: 42, stamina: 55, health: 60, dexterity: 48,
      intelligence: 71, awareness: 44, determination: 66, will: 52, spirit: 80, charisma: 39,
    } as never,
  },
  {
    id: "p-b",
    attributeStats: {
      power: 41, speed: 79, stamina: 68, health: 51, dexterity: 74,
      intelligence: 45, awareness: 77, determination: 43, will: 70, spirit: 46, charisma: 72,
    } as never,
  },
];

const SCORES = SPIELER.map((spieler) => ({ playerId: spieler.id, disciplineId: DISZIPLIN, score: 60 }));

function modifier(slots: number[], requiredPlayers: number | null) {
  return calculateSideSlotRoleModifierTotal({
    disciplineId: DISZIPLIN,
    disciplineSide: "d1",
    entries: slots.map((slotIndex, index) => ({ playerId: SPIELER[index]!.id, slotIndex })),
    rosterPlayers: SPIELER,
    disciplineScores: SCORES,
    requiredPlayers,
  });
}

describe("Hintere Slots behalten ihre Rolle", () => {
  it("die Disziplin hat je Slot eine EIGENE Rolle — sonst prueft der Test nichts", () => {
    const rollen = resolveSlotRolesForDiscipline(DISZIPLIN, DISZIPLIN, 6) as Array<{ roleId: string } | null>;
    expect(rollen).toHaveLength(6);
    const ids = new Set(rollen.map((rolle) => rolle?.roleId));
    expect(ids.size).toBe(6);
  });

  it("Slot 5+6 ohne bekannte Slotzahl verlieren ihre Rolle NICHT mehr", () => {
    // Das war der Fehler: hier stand vorher 0.
    expect(modifier([4, 5], null)).not.toBe(0);
  });

  it("die Rolle der hinteren Slots ist dieselbe, ob die Slotzahl bekannt ist oder nicht", () => {
    expect(modifier([4, 5], null)).toBe(modifier([4, 5], 6));
  });

  it("hintere und vordere Slots ergeben verschiedene Werte — die Rolle wirkt wirklich", () => {
    expect(modifier([4, 5], 6)).not.toBe(modifier([0, 1], 6));
  });

  it("eine lueckenlose Aufstellung 1..n bleibt unveraendert", () => {
    // Der Sicherheitsgurt: `hoechsterSlot + 1` ist dort exakt `entries.length`.
    expect(modifier([0, 1], null)).toBe(modifier([0, 1], 2));
  });
});

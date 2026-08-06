/**
 * GEMELDET: „anscheinend kann man verletzte spieler noch einsetzen" und
 *           „verletzungen müssen im ui direkt erkennbar sein".
 *
 * Die Untersuchung hat die erste Vermutung WIDERLEGT: Jeder Weg, der Aufstellungs-Eintraege
 * schreibt, laeuft durch `validateLegacyLineupContext`, und die Liste, gegen die dort geprueft
 * wird, enthaelt die verletzten Spieler sehr wohl. Gesperrt wird korrekt.
 *
 * Was tatsaechlich kaputt war, ist die ERKLAERUNG — und die war so kaputt, dass sie das Gefuehl
 * "das System sperrt nicht" gut erklaert:
 *
 *   1. `formatLegacyLineupDragBlockReason` gab fuer die Verletzung den ROHEN Code-String zurueck.
 *      Jeder andere Sperrgrund daneben hatte deutschen Text. Der Spieler las woertlich
 *      "player_injured_unavailable" — als Hinweis an der Kandidatenliste und als Meldung nach
 *      einem verhinderten Zug.
 *   2. In der Auswahlliste stand fuer JEDEN Sperrgrund dasselbe Wort "blockiert". Warum ein
 *      Spieler nicht ging, sah man erst im Hovertext.
 */
import { describe, expect, it } from "vitest";

import { formatLegacyLineupDragBlockReason, resolveLegacyLineupDragBlockReason } from "@/lib/lineups/legacy-lineup-drag-drop";

describe("Verletzung — die Sperre greift", () => {
  it("ein verletzter Spieler ist nicht einsetzbar", () => {
    expect(resolveLegacyLineupDragBlockReason({ availabilityBlocker: "player_injured_unavailable" })).toBe(
      "player_injured_unavailable",
    );
  });

  it("ohne Sperre bleibt der Spieler einsetzbar", () => {
    expect(resolveLegacyLineupDragBlockReason({ availabilityBlocker: null })).not.toBe("player_injured_unavailable");
  });
});

describe("Verletzung — die Erklaerung ist lesbar", () => {
  /**
   * DER GEMELDETE FEHLER. Ein Text, den der Nutzer sieht, darf kein Bezeichner aus dem Quelltext
   * sein. Die Gegenprobe auf den Unterstrich ist der eigentliche Test: sie faellt auch dann, wenn
   * jemand spaeter einen anderen internen Code durchreicht.
   */
  it("liefert deutschen Text statt des internen Codes", () => {
    const text = formatLegacyLineupDragBlockReason("player_injured_unavailable");
    expect(text).not.toBe("player_injured_unavailable");
    expect(text).not.toMatch(/_/);
    expect(text).toContain("Verletzt");
  });

  /** Die Nachbarfaelle hatten immer schon Text — sie duerfen ihn nicht verlieren. */
  it("die uebrigen Sperrgruende bleiben unveraendert lesbar", () => {
    expect(formatLegacyLineupDragBlockReason("already_assigned_other_discipline")).toBe(
      "bereits in anderer Diszi eingesetzt",
    );
    expect(formatLegacyLineupDragBlockReason("captain_not_allowed")).toBe("Captain nicht erlaubt");
    expect(formatLegacyLineupDragBlockReason("slot_rule_not_fulfilled")).toBe("Slot-Regel nicht erfüllt");
    expect(formatLegacyLineupDragBlockReason(null)).toBeNull();
  });

  /**
   * KEIN Sperrgrund darf je wieder als roher Bezeichner durchgehen. Diese Zusicherung faengt den
   * naechsten vergessenen Fall ab, statt nur den einen bekannten festzuhalten.
   */
  it("kein Sperrgrund gibt einen Bezeichner aus", () => {
    const reasons = [
      "player_injured_unavailable",
      "already_assigned_other_discipline",
      "captain_not_allowed",
      "slot_rule_not_fulfilled",
    ] as const;
    for (const reason of reasons) {
      const text = formatLegacyLineupDragBlockReason(reason);
      expect(text, `Sperrgrund ${reason} ohne lesbaren Text`).toBeTruthy();
      expect(text, `Sperrgrund ${reason} gibt einen Bezeichner aus`).not.toMatch(/^[a-z]+(_[a-z]+)+$/);
    }
  });
});

/**
 * Die Auswahlliste zeigt jetzt "Verletzt" statt "blockiert". Der Rechenkern
 * (`buildTeamdeckCandidateEntries`) lag frueher inline in einem 7000-Zeilen-Client, der sich ohne
 * halbe Foundation-Shell nicht rendern laesst — deshalb wurde hier am Quelltext geprueft statt am
 * Verhalten. Nach dem Umzug nach lib/lineups/lineup-candidate-model.ts (reine Funktion, keine
 * React-Abhaengigkeit) ist die eigentliche Verhaltenspruefung jetzt in
 * tests/lineup-candidate-model.test.ts moeglich; diese Quelltext-Kontrolle bleibt zusaetzlich
 * bestehen und zeigt jetzt auf den neuen Ort.
 */
describe("Verletzung — in der Auswahlliste erkennbar, bevor man klickt", () => {
  it("die Kandidatenliste unterscheidet Verletzung von sonstigen Sperren", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "lib/lineups/lineup-candidate-model.ts"),
      "utf8",
    );
    expect(source).toContain('activeSlotCandidate.blockReason === "player_injured_unavailable" ? "Verletzt"');
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { advanceRoomArenaReveal, createRoomArenaState } from "@/lib/room/arena-sync-state";

// Befund B3 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Stufe 3.1): `DisciplineStageArena.tsx`
// sandte die Zählgrenze des Arena-Gleichlaufs an ZWEI Stellen hart als `{ d1: 0, d2: 0 }`.
// Damit ist `revealedSlotCount < maxSlotRevealCount` in `advanceFoundationArenaReveal`
// (lib/foundation/matchday-arena-reveal-sync.ts:139) für IMMER `0 < 0` — nie wahr — und
// `slotRevealIndex` (lib/room/arena-sync-state.ts:60) bleibt für die gesamte Disziplin bei 0.
// Der Gast liest genau diesen Wert als `syncedRound` und bleibt dauerhaft vor Etappe 1 stehen
// (DisciplineStageNativeArena.tsx:2853), waehrend der Host durchlaeuft.
//
// Diese Suite haelt die EIGENSCHAFT fest, nicht die Implementierung von DisciplineStageArena.tsx
// selbst — die reinen Funktionen aus `lib/room/arena-sync-state.ts` reichen aus, kein React,
// kein DOM.
describe("Arena-Gleichlauf: der Gast zieht nach", () => {
  it("FALLE: bei Zählgrenze 0 bleibt slotRevealIndex bei 0, egal wie oft weitergeschaltet wird", () => {
    // Genau der Zustand, den die beiden hart codierten `{ d1: 0, d2: 0 }`-Aufrufstellen erzeugt
    // haben. `revealedSlotCount(0) < maxSlotRevealCount(0)` ist nie wahr — die Etappen-Phase wird
    // deshalb bei JEDEM Weiterschalten übersprungen, ohne dass `slotRevealIndex` je über 0 steigt.
    let state = createRoomArenaState({ saveId: "save-fall-B3" });
    expect(state.slotRevealIndex).toBe(0);

    for (let i = 0; i < 10; i += 1) {
      state = advanceRoomArenaReveal({
        arenaState: state,
        participantId: "host-1",
        maxSlotRevealCountByDiscipline: { d1: 0, d2: 0 },
      });
      expect(state.slotRevealIndex).toBe(0);
    }
  });

  it("MIT DER ECHTEN ETAPPENZAHL: slotRevealIndex wächst je Weiterschalten, bis d1 aufgebraucht ist", () => {
    // d1 und d2 bewusst UNGLEICH (4 vs. 6) — genau der Fall, den die Aufgabe verlangt: beide Seiten
    // müssen echt und unabhängig ermittelt werden, nicht derselbe Wert für beide.
    const maxSlotRevealCountByDiscipline = { d1: 4, d2: 6 };
    let state = createRoomArenaState({ saveId: "save-fix-B3" });
    expect(state.activeDisciplinePhase).toBe("d1");

    for (let step = 1; step <= maxSlotRevealCountByDiscipline.d1; step += 1) {
      state = advanceRoomArenaReveal({
        arenaState: state,
        participantId: "host-1",
        maxSlotRevealCountByDiscipline,
      });
      expect(state.slotRevealIndex).toBe(step);
    }

    // d1 ist jetzt aufgebraucht (4/4) — die nächste Etappe verlässt die Slot-Phase von d1 statt
    // ein 5. Mal zu erhöhen. `slotRevealIndex` bleibt auf dem erreichten Maximum stehen, fällt
    // nicht zurück auf 0 (das wäre wieder die B3-Falle).
    state = advanceRoomArenaReveal({
      arenaState: state,
      participantId: "host-1",
      maxSlotRevealCountByDiscipline,
    });
    expect(state.slotRevealIndex).toBe(maxSlotRevealCountByDiscipline.d1);
    expect(state.revealedSlotCountByDiscipline.d1).toBe(maxSlotRevealCountByDiscipline.d1);
  });

  // Quellcode-Vertrag statt Verhaltenstest: die beiden Aufrufstellen des Effekts, in dem die
  // Zählgrenze gesendet wird, laufen in einem React-Effekt (`useEffect`, das den Sync-Start und
  // den Host-Advance ausloest). Das Projekt hat kein jsdom eingerichtet, kann diesen Effekt also
  // nicht rendern und die tatsaechlich GESENDETEN Werte nicht am laufenden Client abgreifen. Die
  // Textprüfung ist hier deshalb AUSNAHMSWEISE angemessen: sie prüft exakt die beiden Literale aus
  // dem Befund (B3), nicht irgendeinen Kommentar, der die alte Zahl nur zu Dokumentationszwecken
  // nennt (siehe der Kommentar bei `computeStageSlotCount`, der bewusst NICHT matcht).
  it("Quellcode-Vertrag: DisciplineStageArena.tsx sendet an keiner Aufrufstelle mehr { d1: 0, d2: 0 }", () => {
    const filePath = path.resolve(__dirname, "../app/foundation/discipline-stage/DisciplineStageArena.tsx");
    const source = readFileSync(filePath, "utf8");

    expect(source).not.toContain("maxSlotRevealCountByDiscipline: { d1: 0, d2: 0 }");
    expect(source).not.toContain("emitHostRoomArenaAdvance({ d1: 0, d2: 0 })");
  });
});

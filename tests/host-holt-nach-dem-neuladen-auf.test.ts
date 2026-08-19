import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { advanceRoomArenaReveal, createRoomArenaState } from "@/lib/room/arena-sync-state";

/**
 * DER HOST LAEDT MITTEN IN DER ENTHUELLUNG NEU (F5 im Browser).
 *
 * Nicht zu verwechseln mit dem SERVER-Neustart — den faengt `resumeRoomArenaAfterRestart` ab
 * (`tests/arena-ueberlebt-den-neustart.test.ts`). Hier laeuft der Server weiter und weiss noch
 * alles; nur die Seite des Hosts ist frisch und steht wieder auf Etappe 0.
 *
 * Die Komponente ist ohne jsdom nicht renderbar (`vitest.config.ts`: `environment: "node"`),
 * deshalb dieselbe Zweiteilung wie in `arena-optik-im-mehrspieler.test.ts`: der SCHADEN wird an
 * den reinen Raum-Funktionen durchgerechnet, die VERKABELUNG als begruendeter Quellcode-Vertrag
 * festgehalten.
 */
describe("Der Host holt nach dem Neuladen auf, statt den Raum weiterzuschieben", () => {
  it("SCHADEN: ein Host, der bei 0 wieder loslaeuft, schiebt den Raum ueber die Disziplin hinaus", () => {
    const max = { d1: 5, d2: 5 } as const;
    let state = createRoomArenaState({
      seasonId: "season-2",
      matchdayId: "matchday-1",
      disciplineSide: "d1",
      maxSlotRevealIndex: 5,
    });
    for (let i = 0; i < 5; i += 1) {
      state = advanceRoomArenaReveal({ arenaState: state, participantId: "host", maxSlotRevealCountByDiscipline: max });
    }
    // Stand vor dem Neuladen: Raum und Gast bei Etappe 5, die Disziplin ist damit durch.
    expect(state.slotRevealIndex).toBe(5);

    // Der Host laedt neu (lokal wieder Etappe 0) und klickt ▶. Ohne Nachholen meldet seine
    // Komponente daraufhin einen EIGENEN Schritt — der Raum ist aber schon am Ende der Etappen.
    const nachEinemKlick = advanceRoomArenaReveal({
      arenaState: state,
      participantId: "host",
      maxSlotRevealCountByDiscipline: max,
    });
    // Der Raum bleibt NICHT stehen: er verlaesst die Etappen-Phase und schiebt die Phasenkette
    // weiter — obwohl der Host gerade Etappe 1 anzeigt. Genau dieser Versatz bleibt dann bestehen.
    expect(nachEinemKlick.slotRevealIndex).toBe(5);
    expect(nachEinemKlick.phaseId).toBe("push");
    expect(nachEinemKlick.stepIndex).toBe(state.stepIndex + 1);
  });

  it("VERKABELUNG: das Nachholen des Hosts haengt nicht an `followsHost` und zieht den Melde-Zaehler mit", () => {
    const quelle = readFileSync(
      join(process.cwd(), "app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx"),
      "utf8",
    );

    // Es gibt einen Nachhol-Pfad, der ausdruecklich fuer den HOST gilt. Vor dieser Aenderung war
    // jeder Nachhol-Pfad auf `followsHost` verriegelt — und das ist fuer den Host per Definition
    // false, es gab also gar keinen.
    expect(quelle).toContain("hostHatNachgeholtRef");
    expect(quelle).toContain("if (!roomSync?.active || !roomSync.isHost) return;");

    // Er greift NUR, wenn der Host hinter dem Raum steht. Waehrend eines eigenen Schritts ist er
    // kurzzeitig davor (lokal weiter, Meldung noch unterwegs) — dort einzugreifen wuerde ihn bei
    // jedem eigenen Klick zurueckreissen.
    expect(quelle).toContain("if (roomSync.syncedRound <= round) return;");

    // Und er zieht `prevSyncRoundRef` mit, BEVOR gesprungen wird. Ohne das laese der Melde-Effekt
    // den Sprung (0 -> 5) als fuenf eigene Schritte und schoebe den Raum genau um den Rueckstand
    // weiter, den dieser Effekt gerade aufholt.
    const abDemMerker = quelle.slice(quelle.indexOf("hostHatNachgeholtRef.current = true;"));
    const bisZumSprung = abDemMerker.slice(0, abDemMerker.indexOf("jumpToRound(roomSync.syncedRound);"));
    expect(bisZumSprung).toContain("prevSyncRoundRef.current = roomSync.syncedRound;");
  });
});

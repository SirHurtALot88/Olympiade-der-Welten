import { describe, expect, it } from "vitest";

import {
  ARENA_STEP_DURATION_MS,
  computeArenaClockOffsetMs,
  estimateServerNowMs,
  resolveArenaCatchUpMode,
  resolveArenaDisplayState,
  resolveArenaEffectivePause,
  type ArenaStepSnapshot,
} from "@/lib/foundation/discipline-stage/arena-timeline";
import {
  advanceRoomArenaReveal,
  createRoomArenaState,
  quickSimRoomArenaReveal,
  resetRoomArenaReveal,
  setRoomArenaPaused,
} from "@/lib/room/arena-sync-state";

// Befund B4 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Stufe 3.2/3.3/3.4/3.6): der Ablauf existierte
// ausschliesslich als `setTimeout`-Kaskade im Browser. Es gab keine Funktion
// `Zustand(Schritt, verstrichene Zeit)`, aus der ein zweiter Browser denselben Augenblick
// herstellen konnte — zwei Clients mit unterschiedlicher Systemuhr sahen bestenfalls "gleiche
// Reihenfolge, anderer Moment". Diese Suite haelt die EIGENSCHAFT fest, nicht die Umsetzung: die
// reinen Funktionen aus `lib/foundation/discipline-stage/arena-timeline.ts` und
// `lib/room/arena-sync-state.ts` reichen aus, kein React, kein DOM, kein echtes `Date.now()`.

const BASE_ISO = "2026-08-15T10:00:00.000Z";
const BASE_MS = Date.parse(BASE_ISO);

describe("Gemeinsame Zeitbasis: zwei Uhren, ein Bild (Stufe 3.3)", () => {
  it("zwei Clients mit UNTERSCHIEDLICHEM Uhren-Versatz errechnen bei gleichem Raum-Zustand denselben Anzeigezustand", () => {
    const step: ArenaStepSnapshot = {
      stepIndex: 3,
      stepStartedAt: BASE_ISO,
      stepDurationMs: ARENA_STEP_DURATION_MS,
      paused: false,
    };

    // Client A: Systemuhr laeuft 2s VORAUS. Client B: Systemuhr laeuft 5s NACH. Beide empfangen
    // denselben Server-Zeitstempel (`updatedAt` des Raum-Zustands) im selben wahren Moment
    // (BASE_MS + 3000 — 3s nach Schrittbeginn) und rechnen daraus ihren eigenen Versatz aus.
    const receiptTrueMs = BASE_MS + 3000;
    const serverTimeAtReceiptIso = new Date(receiptTrueMs).toISOString();
    const clientANowAtReceiptMs = receiptTrueMs + 2000; // A's Uhr zeigt 2s mehr an
    const clientBNowAtReceiptMs = receiptTrueMs - 5000; // B's Uhr zeigt 5s weniger an

    const offsetA = computeArenaClockOffsetMs(serverTimeAtReceiptIso, clientANowAtReceiptMs);
    const offsetB = computeArenaClockOffsetMs(serverTimeAtReceiptIso, clientBNowAtReceiptMs);
    expect(offsetA).toBe(-2000);
    expect(offsetB).toBe(5000);

    // 3s spaeter (wahre Zeit) will jeder Client wissen, wie weit der Schritt fortgeschritten ist.
    // Beide Uhren ticken mit derselben Geschwindigkeit weiter (nur der Versatz bleibt konstant).
    const laterTrueMs = receiptTrueMs + 3000; // BASE_MS + 6000 — 6s nach Schrittbeginn
    const clientANowLaterMs = laterTrueMs + 2000;
    const clientBNowLaterMs = laterTrueMs - 5000;

    const displayA = resolveArenaDisplayState({
      step,
      serverNowMs: estimateServerNowMs(clientANowLaterMs, offsetA),
    });
    const displayB = resolveArenaDisplayState({
      step,
      serverNowMs: estimateServerNowMs(clientBNowLaterMs, offsetB),
    });

    expect(displayA).toEqual(displayB);
    expect(displayA.elapsedMs).toBe(6000);
    expect(displayA.progress).toBeCloseTo(0.6, 10);
    expect(displayA.isStepSettled).toBe(false);
  });

  it("GEGENPROBE: ohne Uhren-Versatz-Korrektur (rohe Client-Uhr statt geschaetzter Server-Zeit) fallen die beiden Clients auseinander", () => {
    // Derselbe Aufbau wie oben, aber diesmal wird NICHT `estimateServerNowMs` benutzt — jeder
    // Client haelt seine eigene rohe Uhrzeit faelschlich fuer die Server-Zeit. Das ist exakt das
    // Verhalten VOR Stufe 3.3 (der Client rechnete ab dem eigenen Empfangszeitpunkt statt ab
    // einem gemeinsamen Server-Nullpunkt). Der Test soll ZEIGEN, dass genau das auseinanderlaeuft
    // — die Korrektur oben ist also keine kosmetische Wahl, sondern die tragende Eigenschaft.
    const step: ArenaStepSnapshot = {
      stepIndex: 3,
      stepStartedAt: BASE_ISO,
      stepDurationMs: ARENA_STEP_DURATION_MS,
      paused: false,
    };
    const laterTrueMs = BASE_MS + 6000;
    const clientANowLaterMs = laterTrueMs + 2000; // A's Uhr 2s voraus
    const clientBNowLaterMs = laterTrueMs - 5000; // B's Uhr 5s nach

    const naiveDisplayA = resolveArenaDisplayState({ step, serverNowMs: clientANowLaterMs });
    const naiveDisplayB = resolveArenaDisplayState({ step, serverNowMs: clientBNowLaterMs });

    // OHNE Korrektur: 7 Sekunden Unterschied (2000 - (-5000)) zwischen den beiden Anzeigen —
    // die zentrale Zusage ("zwei Uhren, ein Bild") faellt hier um.
    expect(naiveDisplayA.elapsedMs).not.toBe(naiveDisplayB.elapsedMs);
    expect(naiveDisplayA.elapsedMs - naiveDisplayB.elapsedMs).toBe(7000);
    expect(naiveDisplayA.progress).not.toBeCloseTo(naiveDisplayB.progress, 5);
  });

  it("pausiert (`step.paused`), friert `elapsedMs` auf dem uebergebenen Wert ein, statt weiterzulaufen", () => {
    const step: ArenaStepSnapshot = {
      stepIndex: 1,
      stepStartedAt: BASE_ISO,
      stepDurationMs: ARENA_STEP_DURATION_MS,
      paused: true,
    };
    const frozen = resolveArenaDisplayState({
      step,
      serverNowMs: BASE_MS + 9000, // "jetzt" ist laengst weiter …
      frozenElapsedMs: 4200, // … aber die Pause haelt bei 4,2s
    });
    expect(frozen.elapsedMs).toBe(4200);
    expect(frozen.progress).toBeCloseTo(0.42, 10);
  });

  it("kappt `elapsedMs` auf `[0, stepDurationMs]` (kein Ueberlaufen, kein Negativwert)", () => {
    const step: ArenaStepSnapshot = { stepIndex: 0, stepStartedAt: BASE_ISO, stepDurationMs: 10_000, paused: false };
    const wayAfter = resolveArenaDisplayState({ step, serverNowMs: BASE_MS + 999_999 });
    expect(wayAfter.elapsedMs).toBe(10_000);
    expect(wayAfter.isStepSettled).toBe(true);

    const before = resolveArenaDisplayState({ step, serverNowMs: BASE_MS - 5000 });
    expect(before.elapsedMs).toBe(0);
    expect(before.progress).toBe(0);
  });
});

describe("Nachholen durch Ueberspringen, nicht durch Nachspielen (Stufe 3.4, Antwort auf Befund-Punkt 4)", () => {
  it("ein Gast, der spaet dazukommt (lokal 0, Host laengst weiter), springt statt jede Etappe nachzuspielen", () => {
    let host = createRoomArenaState({ saveId: "save-late-join" });
    for (let i = 0; i < 5; i += 1) {
      host = advanceRoomArenaReveal({ arenaState: host, participantId: "host-1", maxSlotRevealCountByDiscipline: { d1: 8, d2: 8 } });
    }
    expect(host.slotRevealIndex).toBe(5);

    const mode = resolveArenaCatchUpMode({ localStepIndex: 0, targetStepIndex: host.slotRevealIndex, localCascadeRunning: false });
    expect(mode).toBe("jump");
  });

  it("der normale Fall — Ziel genau einen Schritt weiter — bleibt die volle Kaskade (advance-one)", () => {
    const mode = resolveArenaCatchUpMode({ localStepIndex: 4, targetStepIndex: 5, localCascadeRunning: false });
    expect(mode).toBe("advance-one");
  });

  it("laeuft lokal schon eine Kaskade, wird nicht nachgelegt (hold) — sonst ueberholen sich zwei Kaskaden", () => {
    const mode = resolveArenaCatchUpMode({ localStepIndex: 2, targetStepIndex: 5, localCascadeRunning: true });
    expect(mode).toBe("hold");
  });

  it("Ziel und lokaler Stand sind gleich: nichts zu tun (in-sync)", () => {
    const mode = resolveArenaCatchUpMode({ localStepIndex: 5, targetStepIndex: 5, localCascadeRunning: false });
    expect(mode).toBe("in-sync");
  });

  it("ein Reset beim Host bringt den Gast ZURUECK — nicht nur vorwaerts (vorher kannte `syncedRound > round` nur eine Richtung)", () => {
    let host = createRoomArenaState({ saveId: "save-reset" });
    for (let i = 0; i < 4; i += 1) {
      host = advanceRoomArenaReveal({ arenaState: host, participantId: "host-1", maxSlotRevealCountByDiscipline: { d1: 8, d2: 8 } });
    }
    const guestLocalStepBeforeReset = host.slotRevealIndex;
    expect(guestLocalStepBeforeReset).toBe(4);

    const stepIndexBeforeReset = host.stepIndex;
    const reset = resetRoomArenaReveal({ arenaState: host, participantId: "host-1" });

    // Angezeigte Etappe faellt zurueck …
    expect(reset.slotRevealIndex).toBe(0);
    expect(reset.revealedSlotCountByDiscipline.d1).toBe(0);
    // … `stepIndex` waechst trotzdem WEITER (monoton, Stufe 3.2: ein Reset ist selbst ein
    // Schritt, nur mit rueckwaerts zeigendem Ziel — Reihenfolge/Frische bleibt eindeutig).
    expect(reset.stepIndex).toBeGreaterThan(stepIndexBeforeReset);
    expect(reset.version).toBeGreaterThan(host.version);

    // Alte Bedingung `syncedRound > round` haette hier NICHT ausgeloest (0 > 4 ist falsch) — der
    // Gast waere auf Etappe 4 stehen geblieben, obwohl sie beim Host nicht mehr existiert.
    const oldConditionWouldFire = reset.slotRevealIndex > guestLocalStepBeforeReset;
    expect(oldConditionWouldFire).toBe(false);

    // Die neue Eigenschaft erkennt den Rueckwaerts-Sprung und springt direkt zurueck.
    const mode = resolveArenaCatchUpMode({
      localStepIndex: guestLocalStepBeforeReset,
      targetStepIndex: reset.slotRevealIndex,
      localCascadeRunning: false,
    });
    expect(mode).toBe("jump");
  });

  it("Quick-Sim beim Host springt ans Ende der aktiven Seite — `stepIndex` waechst um mehr als einen Schritt", () => {
    const maxSlotRevealCountByDiscipline = { d1: 5, d2: 6 };
    const host = createRoomArenaState({ saveId: "save-quicksim" });

    const quickSimmed = quickSimRoomArenaReveal({ arenaState: host, participantId: "host-1", maxSlotRevealCountByDiscipline });

    // Quick-Sim vollendet NUR die aktive Seite (d1) — genau wie der lokale Quick-Sim-Knopf nur
    // die gerade gezeigte Disziplin sofort abschliesst, nicht das ganze Spieltagspaar.
    expect(quickSimmed.activeDisciplinePhase).not.toBe("d1");
    expect(quickSimmed.revealedSlotCountByDiscipline.d1).toBe(maxSlotRevealCountByDiscipline.d1);
    expect(quickSimmed.completedDisciplinePhases.d1).toBe(true);

    // `slotRevealIndex` selbst faengt bei einem Seitenwechsel legitim wieder bei 0 an (es zaehlt
    // NUR die aktive Seite, siehe `normalizeRoomArenaState`) — das entspricht in der echten
    // Anzeige einem Wechsel der DISZIPLIN (die Bühne mountet dafuer neu, `DisciplineStageArena.tsx`
    // mappt `activeDisciplinePhase` auf eine andere `disciplineId`). Innerhalb EINER
    // Buehnen-Instanz ist `stepIndex` das verlaessliche "wie viel ist passiert"-Mass: Quick-Sim
    // hat mehrere Schritte auf einmal verbraucht, nicht nur einen.
    expect(quickSimmed.stepIndex - host.stepIndex).toBeGreaterThan(1);
    const mode = resolveArenaCatchUpMode({ localStepIndex: host.stepIndex, targetStepIndex: quickSimmed.stepIndex, localCascadeRunning: false });
    expect(mode).toBe("jump");
  });
});

// Befund A1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Audit): `resolveArenaDisplayState` und
// `estimateServerNowMs` hatten NULL Aufrufer im Produktivcode — nur Tests. `roomSync.stepIndex`/
// `stepStartedAtMs`/`stepDurationMs`/`clockOffsetMs` kamen als Props bei `DisciplineStageNativeArena`
// an und wurden nirgends gelesen. Diese Suite haelt die EIGENSCHAFT fest, die jetzt tatsaechlich
// verdrahtet ist (`resolveArenaCatchUpMode`s neuer `targetStepClock`-Parameter, siehe die
// Guest-Catch-up-Stelle in `DisciplineStageNativeArena.tsx`): der "advance-one"-Normalfall bleibt
// unveraendert (Rueckwaertskompatibilitaet ohne die Uhr), aber eine STALE Meldung wird jetzt an der
// Uhr erkannt und als "jump" behandelt statt eine bereits ueberholte Kaskade zu starten.
describe("Der Gast benutzt jetzt tatsaechlich die Uhr, nicht nur die Schrittdifferenz (Befund A1)", () => {
  it("advance-one bleibt advance-one, wenn der Schritt laut Server-Uhr GERADE ERST begann (Normalfall)", () => {
    const mode = resolveArenaCatchUpMode({
      localStepIndex: 4,
      targetStepIndex: 5,
      localCascadeRunning: false,
      targetStepClock: {
        step: { stepIndex: 5, stepStartedAt: BASE_ISO, stepDurationMs: ARENA_STEP_DURATION_MS, paused: false },
        serverNowMs: BASE_MS + 50, // 50ms nach Schrittbeginn — reine Netzwerklatenz
      },
    });
    expect(mode).toBe("advance-one");
  });

  it("advance-one wird zu jump, wenn der Schritt laut Server-Uhr beim Empfang schon EINGESCHWUNGEN ist (spaete Meldung)", () => {
    // Genau der Fall, den A1 beschreibt: die Schrittdifferenz allein (delta === 1) sagt
    // "advance-one" — ohne Uhr wuerde der Gast jetzt eine frische ~10s-Kaskade fuer einen Moment
    // starten, den der Server laengst hinter sich hat, und dabei nur WEITER zurueckfallen.
    const mode = resolveArenaCatchUpMode({
      localStepIndex: 4,
      targetStepIndex: 5,
      localCascadeRunning: false,
      targetStepClock: {
        step: { stepIndex: 5, stepStartedAt: BASE_ISO, stepDurationMs: ARENA_STEP_DURATION_MS, paused: false },
        serverNowMs: BASE_MS + ARENA_STEP_DURATION_MS + 4000, // 4s NACH Schrittende beim Empfang
      },
    });
    expect(mode).toBe("jump");
  });

  it("ohne `targetStepClock` (Aufrufer liefert die Uhr noch nicht) bleibt das alte Verhalten exakt erhalten", () => {
    // Rueckwaertskompatibilitaet: kein bestehender Aufrufer/Test wird durch den neuen, optionalen
    // Parameter veraendert.
    const mode = resolveArenaCatchUpMode({ localStepIndex: 4, targetStepIndex: 5, localCascadeRunning: false });
    expect(mode).toBe("advance-one");
  });

  it("`localCascadeRunning` (hold) gewinnt weiterhin ueber die Uhr — laufende Kaskaden werden nie unterbrochen", () => {
    const mode = resolveArenaCatchUpMode({
      localStepIndex: 4,
      targetStepIndex: 5,
      localCascadeRunning: true,
      targetStepClock: {
        step: { stepIndex: 5, stepStartedAt: BASE_ISO, stepDurationMs: ARENA_STEP_DURATION_MS, paused: false },
        serverNowMs: BASE_MS + ARENA_STEP_DURATION_MS + 9999,
      },
    });
    expect(mode).toBe("hold");
  });
});

// Befund A3 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Audit): `resetRoomArenaReveal` behandelte
// `activeDisciplinePhase === "total"` wie `"d1"` — loeschte d1s Zaehler/Abschluss, liess die Phase
// aber auf "total" stehen. Der naechste Schritt hatte dadurch einen WIDERSPRUECHLICHEN Zustand vor
// sich (Phase sagt "beide Diszis fertig", Zaehler sagen "d1 bei 0, nicht abgeschlossen") und lief d1
// erneut ab, obwohl die sichtbare Buehne zu diesem Zeitpunkt d2 zeigt (die Phasenkette erreicht
// "total" nur ueber d2, nie direkt aus d1).
describe("Reset waehrend \"total\" (beide Diszis fertig) trifft d2, nicht d1 (Befund A3)", () => {
  it("setzt d2 zurueck und die Phase zurueck auf \"d2\" — d1 bleibt unangetastet abgeschlossen", () => {
    let state = createRoomArenaState({ saveId: "save-a3-total" });
    // d1 komplett durchlaufen + Seitenwechsel, dann d2 komplett durchlaufen + Seitenwechsel auf "total".
    for (let i = 0; i < 30; i += 1) {
      if (state.activeDisciplinePhase === "total") break;
      state = advanceRoomArenaReveal({ arenaState: state, participantId: "host-1", maxSlotRevealCountByDiscipline: { d1: 2, d2: 2 } });
    }
    expect(state.activeDisciplinePhase).toBe("total");
    expect(state.completedDisciplinePhases).toEqual({ d1: true, d2: true });
    const d1CountBeforeReset = state.revealedSlotCountByDiscipline.d1;
    expect(d1CountBeforeReset).toBe(2);

    const reset = resetRoomArenaReveal({ arenaState: state, participantId: "host-1" });

    // Die Phase ist wieder EINDEUTIG (nicht mehr "total" bei gleichzeitig zurueckgesetzten
    // Zaehlern) — und zeigt d2, weil d2 die sichtbare Buehne im Moment des Reset-Klicks ist.
    expect(reset.activeDisciplinePhase).toBe("d2");
    expect(reset.revealedSlotCountByDiscipline.d2).toBe(0);
    expect(reset.completedDisciplinePhases.d2).toBe(false);
    // d1 bleibt UNVERAENDERT — kein "d1 laeuft nochmal ab", obwohl die Phase vorher "total" war.
    expect(reset.revealedSlotCountByDiscipline.d1).toBe(d1CountBeforeReset);
    expect(reset.completedDisciplinePhases.d1).toBe(true);
    expect(reset.stepIndex).toBeGreaterThan(state.stepIndex);
  });
});

describe("Pause als geteilter Zustand (Stufe 3.6): pausiert der Host, pausiert es beim Gast", () => {
  it("der Raum-Zustand traegt die Pause explizit — der Gast muss sie nicht aus ausbleibenden Updates erschliessen", () => {
    const started = createRoomArenaState({ saveId: "save-pause" });
    expect(started.paused).toBe(false);
    expect(started.pausedBy).toBeNull();

    const paused = setRoomArenaPaused({ arenaState: started, participantId: "host-1", paused: true });
    expect(paused.paused).toBe(true);
    expect(paused.pausedBy).toBe("host-1");
    expect(paused.version).toBeGreaterThan(started.version);

    const resumed = setRoomArenaPaused({ arenaState: paused, participantId: "host-1", paused: false });
    expect(resumed.paused).toBe(false);
    expect(resumed.pausedBy).toBeNull();
  });

  it("ein No-op-Toggle (Wert unveraendert) bumpt die `version` NICHT — kein Broadcast-Rauschen", () => {
    const started = createRoomArenaState({ saveId: "save-pause-noop" });
    const same = setRoomArenaPaused({ arenaState: started, participantId: "host-1", paused: false });
    expect(same.version).toBe(started.version);
  });

  it("Host-Pause HAELT DEN GAST AN: der Gast hat keine eigene Pause-Autoritaet, er folgt immer dem Raum-Feld", () => {
    const guestEffectivePause = resolveArenaEffectivePause({
      roomActive: true,
      isHost: false,
      roomPaused: true, // der Host hat pausiert
      localPauseIntent: false, // der Gast selbst hat nichts gedrueckt
    });
    expect(guestEffectivePause).toBe(true);

    // Und umgekehrt: draengt der Gast lokal auf "pausiert", der Host aber nicht — der Gast bleibt
    // dem Raum treu (kein eigenmaechtiges Anhalten, das den Host nicht mitbekommt).
    const guestIgnoredOwnIntent = resolveArenaEffectivePause({
      roomActive: true,
      isHost: false,
      roomPaused: false,
      localPauseIntent: true,
    });
    expect(guestIgnoredOwnIntent).toBe(false);
  });

  it("der Host steuert ueber seine EIGENE Absicht (die er selbst ans Zimmer meldet), nicht ueber das Raum-Feld", () => {
    const hostEffectivePause = resolveArenaEffectivePause({
      roomActive: true,
      isHost: true,
      roomPaused: false,
      localPauseIntent: true,
    });
    expect(hostEffectivePause).toBe(true);
  });
});

describe("Solo bleibt unveraendert (Punkt 5 der Aufgabe)", () => {
  it("ohne Raum (`roomActive: false`) zaehlt NUR die eigene Pause-Absicht — das Raum-Feld ist wirkungslos", () => {
    expect(
      resolveArenaEffectivePause({ roomActive: false, isHost: false, roomPaused: true, localPauseIntent: false }),
    ).toBe(false);
    expect(
      resolveArenaEffectivePause({ roomActive: false, isHost: false, roomPaused: false, localPauseIntent: true }),
    ).toBe(true);
  });

  it("die Schrittdauer bleibt die bereits produktiv laufende Zahl (10s) — keine neu erfundene Konstante", () => {
    // `DisciplineStageNativeArena.tsx` exportiert `TRACK_ROUND_MS` jetzt als Alias auf genau
    // diesen Wert (EINE Quelle) — Solo aendert sich dadurch nichts, die Zahl ist dieselbe wie vor
    // Stufe 3.3.
    expect(ARENA_STEP_DURATION_MS).toBe(10_000);
  });

  it("ein frischer Raum-Zustand traegt trotzdem eine gueltige Zeitbasis (Rueckwaertskompatibilitaet fuer bestehende Aufrufer)", () => {
    const state = createRoomArenaState({ saveId: "save-solo-shape" });
    expect(typeof state.stepStartedAt).toBe("string");
    expect(Number.isFinite(Date.parse(state.stepStartedAt))).toBe(true);
    expect(state.stepDurationMs).toBe(ARENA_STEP_DURATION_MS);
    expect(state.paused).toBe(false);
  });
});

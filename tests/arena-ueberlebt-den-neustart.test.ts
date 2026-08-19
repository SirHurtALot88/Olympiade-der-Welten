/**
 * DIE ARENA UEBERLEBT EINEN SERVER-NEUSTART (Befund F8, Aufgabe #45).
 *
 * Der Auto-Deploy zieht `main` per Cron und startet neu — mitten in einem Spieltag ist das real,
 * nicht theoretisch. Seit Stufe 0.1 kommt der Raum danach zurueck, und mit ihm der
 * `arenaSyncState`: er liegt als Teil von `payload_json` in der `rooms`-Zeile. Genau das ist die
 * Falle. Er bringt seine Zeitbasis mit — `stepStartedAt`/`updatedAt` als minutenalte Zeitstempel —
 * und behauptet damit eine Vergangenheit, die kein Client miterlebt hat.
 *
 * Diese Suite pinnt die getroffene Entscheidung: an der ERREICHTEN Etappe neu ansetzen und
 * sichtbar anhalten. Sie prueft Eigenschaften des Ergebnisses, nicht die Mechanik dahinter.
 */
import { describe, expect, it } from "vitest";

import {
  resumeRoomArenaAfterRestart,
  startRoomArena,
  advanceRoomArenaReveal,
} from "@/lib/room/arena-sync-state";
import { createRoom, joinRoom, resetRuntimeRoomsForTests } from "@/lib/room/room-store";
import type { RoomArenaState } from "@/types/game";

const VOR_DEM_NEUSTART = "2026-08-16T10:00:00.000Z";
const NACH_DEM_NEUSTART = "2026-08-16T10:04:00.000Z";

/**
 * Ein ECHTER Raum als Unterbau, kein zusammengesteckter Zustand: `startRoomArena` liest die
 * geforderten Teilnehmer aus dem Raum (`getRoomArenaRequiredParticipantIds`). Ein erfundenes
 * Objekt haette hier nur eine Fassade geprueft.
 */
function raumMitZweiTeilnehmern(suffix: string) {
  resetRuntimeRoomsForTests();
  const created = createRoom(`f8-a-${suffix}`, {
    displayName: "Chris",
    saveId: `f8-save-${suffix}`,
    preset: "chris_4_franky_4_rest_ai",
  });
  const joined = joinRoom(created.room.roomCode, `f8-b-${suffix}`, { displayName: "Franky" });
  if (!joined.ok) {
    throw new Error("Franky konnte dem Raum nicht beitreten");
  }
  const chris = joined.room.state.roomParticipants.find((entry) => entry.displayName === "Chris")!;
  return { state: joined.room.state, chrisId: chris.participantId };
}

function bereitTor(suffix: string) {
  const { state, chrisId } = raumMitZweiTeilnehmern(suffix);
  const gestartet = startRoomArena({
    state,
    participantId: chrisId,
    seasonId: "season-1",
    matchdayId: "matchday-1",
    disciplineSide: "d1",
    maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
    now: VOR_DEM_NEUSTART,
  });
  return { gestartet, chrisId };
}

function laufendeEnthuellung(suffix: string): RoomArenaState {
  const { gestartet, chrisId } = bereitTor(suffix);
  const beideBereit: RoomArenaState = {
    ...gestartet,
    readyParticipantIds: [...gestartet.requiredParticipantIds],
    status: "revealing",
  };
  // Zwei echte Etappen, damit "die erreichte Etappe" nicht zufaellig die erste ist.
  const einsWeiter = advanceRoomArenaReveal({ arenaState: beideBereit, participantId: chrisId, now: VOR_DEM_NEUSTART });
  return advanceRoomArenaReveal({ arenaState: einsWeiter, participantId: chrisId, now: VOR_DEM_NEUSTART });
}

describe("Die Arena ueberlebt einen Server-Neustart (F8)", () => {
  it("setzt die gemeinsame Uhr neu an, ohne dass jemand eine Etappe vor- oder zurueckspringt", () => {
    const vorher = laufendeEnthuellung("uhr");
    const nachher = resumeRoomArenaAfterRestart({ arenaState: vorher, now: NACH_DEM_NEUSTART });

    // Der Nullpunkt ist wieder gueltig — sonst rechnet die Zeitbasis mit vier Minuten, die niemand
    // gesehen hat, und die Enthuellung rast beim Wiederanlauf durch.
    expect(nachher.stepStartedAt).toBe(NACH_DEM_NEUSTART);
    expect(nachher.updatedAt).toBe(NACH_DEM_NEUSTART);

    // Und niemand bewegt sich dabei: beide Seiten stehen weiter auf derselben Etappe.
    expect(nachher.slotRevealIndex).toBe(vorher.slotRevealIndex);
    expect(nachher.activeDisciplinePhase).toBe(vorher.activeDisciplinePhase);
    expect(
      nachher.stepIndex,
      "stepIndex darf NICHT wachsen — beim Gast kaeme das als eine Etappe Rueckstand an und truege ihn zu weit",
    ).toBe(vorher.stepIndex);
  });

  it("haelt sichtbar an, und die Pause hat keinen menschlichen Urheber", () => {
    const vorher = laufendeEnthuellung("pause");
    expect(vorher.paused, "Vorbedingung: die Enthuellung lief").toBe(false);

    const nachher = resumeRoomArenaAfterRestart({ arenaState: vorher, now: NACH_DEM_NEUSTART });

    expect(nachher.paused).toBe(true);
    expect(
      nachher.pausedBy,
      "Eine Pause ohne Urheber bindet auch den Host — sonst laeuft er weiter, waehrend der Gast einfriert",
    ).toBeNull();
  });

  it("laesst eine MENSCHLICHE Pause ihren Urheber behalten", () => {
    const laufend = laufendeEnthuellung("menschliche-pause");
    const menschlicherUrheber = laufend.requiredParticipantIds[0]!;
    const vorher = { ...laufend, paused: true, pausedBy: menschlicherUrheber };
    const nachher = resumeRoomArenaAfterRestart({ arenaState: vorher, now: NACH_DEM_NEUSTART });

    expect(nachher.paused).toBe(true);
    expect(
      nachher.pausedBy,
      "Chris' eigene Pause gilt weiter und hat weiter einen Urheber — nur eine vom Neustart erzeugte ist urheberlos",
    ).toBe(menschlicherUrheber);
  });

  it("GEGENPROBE: ein ruhender Raum kommt voellig unveraendert durch — ohne Versionssprung", () => {
    const { gestartet: ruhend } = bereitTor("ruhend");
    expect(ruhend.status, "Vorbedingung: der Raum steht im Bereit-Tor, nicht in der Enthuellung").toBe("ready_check");

    const nachher = resumeRoomArenaAfterRestart({ arenaState: ruhend, now: NACH_DEM_NEUSTART });

    // Ohne diese Grenze haengte jeder Neustart JEDEM ruhenden Raum eine Aenderung an, die es nicht
    // gab — und jeder verbundene Client bekaeme eine Aktualisierung ohne Inhalt.
    expect(nachher.version).toBe(ruhend.version);
    expect(nachher.updatedAt).toBe(ruhend.updatedAt);
    expect(nachher.paused).toBe(ruhend.paused);
  });

  it("zaehlt die Version genau einmal hoch, wenn er wirklich eingreift", () => {
    const vorher = laufendeEnthuellung("version");
    const nachher = resumeRoomArenaAfterRestart({ arenaState: vorher, now: NACH_DEM_NEUSTART });

    expect(nachher.version).toBe(vorher.version + 1);
  });
});

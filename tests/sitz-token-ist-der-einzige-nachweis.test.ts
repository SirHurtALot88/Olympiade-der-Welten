/**
 * BEFUND F12: DIE `participantId` IST EINE BEHAUPTUNG, KEIN NACHWEIS.
 *
 * `resolveParticipant` (lib/room/server-authoritative-write-guard.ts) nahm die `participantId`,
 * sobald sie anlag, und pruefte das Sitz-Token in diesem Fall gar nicht. Beides kommt aus Query
 * oder Body, ist also frei setzbar.
 *
 * WARUM DAS IM KOOP WIRKLICH WEHTUT, und warum es nicht nur ein theoretischer Angriff ist: die
 * `participantId` des Mitspielers ist kein Geheimnis. Sie steht im `roomState`, den JEDER
 * Teilnehmer voellig legitim per Broadcast bekommt (`roomParticipants`). Franky kann Chris'
 * `participantId` also schlicht ablesen und ab da unter dessen Identitaet schreiben — im selben
 * Spielstand, an denselben Teams. Dazu kommt der harmlose Unfall: wer eine Foundation-URL des
 * anderen oeffnet (Verlauf, Chat, alter Tab), schreibt ebenfalls unter dessen Namen.
 *
 * Stufe 0.3 wollte genau diese Luecke schliessen und hat nur die Solo-Haelfte erwischt
 * (`activeOwnerId`, Befund B2). Diese Suite pinnt die Koop-Haelfte.
 *
 * Die Eigenschaft, die hier gilt: NUR das Sitz-Token weist eine Identitaet nach. Eine
 * mitgeschickte `participantId` darf hoechstens bestaetigen, was das Token ohnehin sagt.
 */
import { describe, expect, it } from "vitest";

import { createRoom, joinRoom, resetRuntimeRoomsForTests } from "@/lib/room/room-store";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

function baueRaum(suffix: string) {
  resetRuntimeRoomsForTests();
  const saveId = `f12-nachweis-save-${suffix}`;
  const created = createRoom(`f12-a-${suffix}`, {
    displayName: "Chris",
    saveId,
    preset: "chris_4_franky_4_rest_ai",
  });
  const joined = joinRoom(created.room.roomCode, `f12-b-${suffix}`, { displayName: "Franky" });
  if (!joined.ok) {
    throw new Error("Franky konnte dem Raum nicht beitreten");
  }
  const chris = joined.room.state.roomParticipants.find((entry) => entry.displayName === "Chris")!;
  const franky = joined.room.state.roomParticipants.find((entry) => entry.displayName === "Franky")!;
  const chrisTeamId = joined.room.state.teamOwnership.find(
    (entry) => entry.controllerType === "human" && entry.participantId === chris.participantId,
  )?.teamId;
  const frankyTeamId = joined.room.state.teamOwnership.find(
    (entry) => entry.controllerType === "human" && entry.participantId === franky.participantId,
  )?.teamId;
  if (!chrisTeamId || !frankyTeamId) {
    throw new Error("Erwartet: beide Teilnehmer haben mindestens ein Team");
  }
  return {
    saveId,
    roomCode: created.room.roomCode,
    chris,
    franky,
    chrisSeatToken: created.seat.seatToken,
    frankySeatToken: joined.seat.seatToken,
    chrisTeamId,
    frankyTeamId,
  };
}

describe("Das Sitz-Token ist der einzige Identitaetsnachweis (F12)", () => {
  it("laesst Franky NICHT unter Chris' participantId schreiben, obwohl sein eigenes Token gueltig ist", () => {
    const raum = baueRaum("fremde-id");

    // Frankys echtes Token, aber Chris' abgelesene participantId — genau das, was der roomState
    // ihm frei Haus liefert. Vor dem Fix gewann die participantId und Franky schrieb als Chris.
    const ergebnis = authorizeServerRoomWrite({
      roomCode: raum.roomCode,
      participantId: raum.chris.participantId,
      seatToken: raum.frankySeatToken,
      userId: raum.chris.userId,
      saveId: raum.saveId,
      teamId: raum.chrisTeamId,
      action: "buy",
    });

    expect(ergebnis.allowed, "Eine fremde participantId darf keine Identitaet verleihen").toBe(false);
  });

  it("laesst eine participantId OHNE Sitz-Token gar nicht erst zu", () => {
    const raum = baueRaum("ohne-token");

    const ergebnis = authorizeServerRoomWrite({
      roomCode: raum.roomCode,
      participantId: raum.chris.participantId,
      userId: raum.chris.userId,
      saveId: raum.saveId,
      teamId: raum.chrisTeamId,
      action: "buy",
    });

    expect(ergebnis.allowed).toBe(false);
    expect(ergebnis.allowed === false ? ergebnis.reason : null).toBe("participant_missing");
  });

  it("GEGENPROBE: mit dem EIGENEN Token und dem EIGENEN Team geht es weiterhin — sonst waere der Riegel nur eine Blockade", () => {
    const raum = baueRaum("eigener-weg");

    const chrisSchreibt = authorizeServerRoomWrite({
      roomCode: raum.roomCode,
      participantId: raum.chris.participantId,
      seatToken: raum.chrisSeatToken,
      userId: raum.chris.userId,
      saveId: raum.saveId,
      teamId: raum.chrisTeamId,
      action: "buy",
    });
    const frankySchreibt = authorizeServerRoomWrite({
      roomCode: raum.roomCode,
      participantId: raum.franky.participantId,
      seatToken: raum.frankySeatToken,
      userId: raum.franky.userId,
      saveId: raum.saveId,
      teamId: raum.frankyTeamId,
      action: "buy",
    });

    expect(chrisSchreibt.allowed, "Chris muss sein eigenes Team weiter bespielen koennen").toBe(true);
    expect(frankySchreibt.allowed, "Franky muss sein eigenes Team weiter bespielen koennen").toBe(true);
  });

  it("GEGENPROBE: das Token allein genuegt — viele Aufrufer schicken gar keine participantId mit", () => {
    const raum = baueRaum("nur-token");

    const ergebnis = authorizeServerRoomWrite({
      roomCode: raum.roomCode,
      seatToken: raum.chrisSeatToken,
      userId: raum.chris.userId,
      saveId: raum.saveId,
      teamId: raum.chrisTeamId,
      action: "buy",
    });

    expect(ergebnis.allowed).toBe(true);
  });

  it("haelt die Besitzgrenze weiterhin: mit eigenem Token auf das Team des anderen geht nicht", () => {
    const raum = baueRaum("fremdes-team");

    const ergebnis = authorizeServerRoomWrite({
      roomCode: raum.roomCode,
      participantId: raum.franky.participantId,
      seatToken: raum.frankySeatToken,
      userId: raum.franky.userId,
      saveId: raum.saveId,
      teamId: raum.chrisTeamId,
      action: "buy",
    });

    expect(ergebnis.allowed).toBe(false);
  });
});

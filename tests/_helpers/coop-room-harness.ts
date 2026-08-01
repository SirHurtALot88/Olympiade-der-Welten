/**
 * ZWEI SITZUNGEN, EIN RAUM — der Aufbau fuer Coop-Routentests mit ECHTEM Guard.
 *
 * WARUM ES DAS BRAUCHT (Coop-Absicherungsplan, R2): `tests/api-write-route-guard-coverage.test.ts`
 * prueft per Textsuche, ob `authorizeServerRoomWrite` in einer Route STEHT. Ob der Aufruf richtig
 * verdrahtet ist — richtiges `teamId`, richtige `action`, und ob eine Ablehnung den Schreibvorgang
 * wirklich verhindert — sagt er nicht. Mehrere bestehende Routentests mocken den Guard sogar auf
 * "erlaubt immer"; fuer die Mehrheit der geschuetzten Routen ist die Verdrahtung damit unbewiesen.
 *
 * Wie real das ist, hat sich beim Absichern von `contracts/dissolution` gezeigt: der Guard war
 * eingebaut und der Abdeckungs-Scan gruen — aber die Oberflaeche schickte gar keinen Raum-Kontext
 * mit, also hielt der Guard jeden Aufruf fuer Solo und liess ihn durch. Ein Test, der den Guard
 * mockt, haette das nie gefunden.
 *
 * Dieser Aufbau baut deshalb einen ECHTEN Raum ueber `lib/room/room-store.ts` — dieselben
 * Funktionen, die auch das Spiel benutzt — mit zwei Teilnehmern und echter Team-Zuteilung.
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { createRoom, joinRoom, getRoom } from "@/lib/room/room-store";

export type CoopSitzung = {
  /** Anzeigename, nur fuer lesbare Fehlermeldungen. */
  name: string;
  participantId: string;
  seatToken: string;
  /** Teams, die dieser Sitzung gehoeren — die darf sie beschreiben. */
  eigeneTeams: string[];
};

export type CoopRaum = {
  roomCode: string;
  saveId: string;
  chris: CoopSitzung;
  franky: CoopSitzung;
  /** Ein Team, das FRANKY gehoert — aus Chris' Sicht das fremde Team. */
  frankysTeam: string;
  /** Ein Team, das CHRIS gehoert. */
  chrisTeam: string;
  /** Zahl der bisher aufgezeichneten Raum-Ereignisse — Ausgangspunkt fuer Broadcast-Pruefungen. */
  ereignisZahl: () => number;
};

/**
 * Legt einen Raum mit zwei menschlichen Sitzungen an.
 *
 * Der Standard-Aufbau des Raum-Speichers verteilt bei zwei Teilnehmern je vier Teams — genau die
 * Konstellation, die eine Besitzpruefung ueberhaupt pruefbar macht: es gibt ein eigenes UND ein
 * fremdes Team.
 */
export function erstelleCoopRaum(saveId: string): CoopRaum {
  const erstellt = createRoom("socket-chris", { displayName: "Chris", saveId });
  const beigetreten = joinRoom(erstellt.room.roomCode, "socket-franky", { displayName: "Franky" });
  if (!beigetreten.ok) {
    throw new Error("Franky konnte dem Raum nicht beitreten — Aufbau unbrauchbar.");
  }

  const roomCode = erstellt.room.roomCode;
  const zustand = beigetreten.room.state;

  const teamsVon = (anzeigename: string) =>
    zustand.teamOwnership
      .filter((eintrag) => eintrag.controllerType === "human" && eintrag.ownerDisplayName === anzeigename)
      .map((eintrag) => eintrag.teamId);

  const teilnehmer = (anzeigename: string) => {
    const gefunden = zustand.roomParticipants.find((eintrag) => eintrag.displayName === anzeigename);
    if (!gefunden) throw new Error(`Teilnehmer ${anzeigename} fehlt im Raum — Aufbau unbrauchbar.`);
    return gefunden.participantId;
  };

  const chris: CoopSitzung = {
    name: "Chris",
    participantId: teilnehmer("Chris"),
    seatToken: erstellt.seat.seatToken,
    eigeneTeams: teamsVon("Chris"),
  };
  const franky: CoopSitzung = {
    name: "Franky",
    participantId: teilnehmer("Franky"),
    seatToken: beigetreten.seat.seatToken,
    eigeneTeams: teamsVon("Franky"),
  };

  // Ohne beidseitigen Besitz ist der Aufbau wertlos: der Kern jedes Tests ist "eigenes Team ja,
  // fremdes nein". Lieber hier laut scheitern als spaeter mit einer irrefuehrenden Zusicherung.
  if (chris.eigeneTeams.length === 0 || franky.eigeneTeams.length === 0) {
    throw new Error(
      `Team-Zuteilung unbrauchbar (Chris: ${chris.eigeneTeams.length}, Franky: ${franky.eigeneTeams.length}).`,
    );
  }

  // Bevorzugt ein Team mit KADER: ein frischer Season-1-Save hat nur eines davon, und Routen, die
  // den Gegenstand des Schreibvorgangs vor dem Guard pruefen (`training` weist einen teamfremden
  // Spieler mit 404 ab), kaemen auf einem leeren Team nie am Guard an — der Test waere gruen,
  // ohne die Autorisierung je beruehrt zu haben.
  const teamsMitKader = new Set(
    (createPersistenceService().getSaveById(saveId)?.gameState.rosters ?? []).map((eintrag) => eintrag.teamId),
  );
  const mitKaderZuerst = (teams: string[]) => teams.find((teamId) => teamsMitKader.has(teamId)) ?? teams[0]!;

  return {
    roomCode,
    saveId,
    chris,
    franky,
    chrisTeam: mitKaderZuerst(chris.eigeneTeams),
    frankysTeam: mitKaderZuerst(franky.eigeneTeams),
    ereignisZahl: () => getRoom(roomCode)?.state.roomEvents.length ?? 0,
  };
}

/** Der Raum-Kontext, den die Oberflaeche an eine schreibende Route anhaengen muss. */
export function schreibKontext(raum: CoopRaum, sitzung: CoopSitzung) {
  return {
    roomCode: raum.roomCode,
    participantId: sitzung.participantId,
    seatToken: sitzung.seatToken,
  };
}

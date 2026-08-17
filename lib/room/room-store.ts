import { createActionLogEntry } from "@/lib/game/action-log";
import { createInitialRoomState } from "@/lib/game/create-room-state";
import { MAX_ACTIVE_PLAYERS } from "@/lib/game/constants";
import {
  advanceRoomArenaReveal,
  isRoomArenaReady,
  quickSimRoomArenaReveal as buildQuickSimmedRoomArenaState,
  resetRoomArenaReveal as buildResetRoomArenaState,
  resumeRoomArenaAfterRestart,
  setRoomArenaParticipantReady,
  setRoomArenaPaused as buildRoomArenaPausedState,
  startRoomArena as buildStartedRoomArenaState,
  syncRoomArenaParticipants,
} from "@/lib/room/arena-sync-state";
import { createRoomCode } from "@/lib/room/room-code";
// Befund F6 (Aufgabe #44): diese Texte standen zusaetzlich als handkopierte Zeichenketten in
// zwei Clients, die eingehende `roomError`-Meldungen zeichengenau dagegen vergleichen. Jetzt
// gibt es sie genau einmal — Begruendung steht in der Datei.
import {
  GESPEICHERTER_SITZPLATZ_UNGUELTIG_MELDUNG,
  RAUM_EXISTIERT_NICHT_MEHR_MELDUNG,
  RAUM_NICHT_GEFUNDEN_MELDUNG,
  RAUM_VOLL_MELDUNG,
  SITZPLATZ_UNGUELTIG_MELDUNG,
} from "@/lib/room/room-session-fehler";
import {
  applyExplicitTeamOwnershipToState,
  applyOwnershipPresetToState,
  appendRoomEvent,
  buildParticipant,
  buildTurnState,
  canParticipantControlTeam,
  isRoomMatchdayInProgress,
  resolveFrankyParticipant,
  syncParticipantControlledTeams,
} from "@/lib/room/online-room-model";
import {
  buildRoomFlowState,
  getNextRoomFlowStepId,
  isSandboxRoomSave,
  roomFlowSeasonContinues,
} from "@/lib/room/room-flow-controller";
import { findSeatByToken } from "@/lib/room/rejoin";
import { createSeatToken } from "@/lib/room/seat-tokens";
import { createRoomCoopSave } from "@/lib/game/new-game-setup-service";
import { kickoffLeagueSetupDraft } from "@/lib/game/league-setup-draft-service";
import { registerLiveRoomSaveId } from "@/lib/room/live-room-save-registry";
import {
  deletePersistedRoom,
  loadPersistedRuntimeRooms,
  persistRuntimeRoom,
  ROOM_EXPIRY_MS,
} from "@/lib/room/room-persistence";
import {
  applyGameModeOwnership,
  buildTeamControlSettingsMap,
  deriveChrisFrankyTeamIdsFromSettings,
} from "@/lib/foundation/team-control-settings";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import type { RoomOwnershipPreset } from "@/types/events";
import type { CoachRole, RoomRealtimeEventType } from "@/types/game";
import type { RoomSeat, RuntimeRoom } from "@/types/room";

declare global {
  /**
   * Prozessweit geteilter Runtime-Room-Store. WICHTIG: Der Socket-Server
   * (server.ts via tsx) und die Next.js-Route-Handler (separat gebuendelt) laden
   * sonst je eine EIGENE Modul-Instanz mit eigener Map. Dann findet ein
   * HTTP-Write im Raum (z. B. Spielerkauf/Aufstellung, die ueber /api/... mit
   * Room-Kontext laufen) den per Socket erstellten Raum nicht -> room_not_found,
   * und die Aenderung wird nie an den Mitspieler gebroadcastet. Gleiche Technik
   * wie global.__olyIo (siehe lib/socket/server.ts).
   */
  // eslint-disable-next-line no-var
  var __olyRuntimeRooms: Map<string, RuntimeRoom> | undefined;
}

const runtimeRooms: Map<string, RuntimeRoom> = (globalThis.__olyRuntimeRooms ??= new Map<string, RuntimeRoom>());

function getSeatCount(room: RuntimeRoom) {
  return Object.values(room.seats).filter(Boolean).length;
}

/**
 * KORREKTUR (16.08.2026, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, F1): Chris' ausdrueckliche Vorgabe
 * war "im multiplayer spielstand soll man auch nicht solo weiter spielen und franky darf den auch
 * nicht löschen" -- der urspruengliche Plan (ein Raum-Ende macht den Save wieder solo-spielbar)
 * ist damit AUSDRUECKLICH FALSCH. Die Notausfahrt aus einem verwaisten Raum heisst deshalb NICHT
 * "raus aus dem Mehrspieler", sondern "der Raum ist wieder BETRETBAR" -- siehe `createRoom` unten.
 *
 * Wie lange ein Raum VOLLSTAENDIG unverbunden sein muss (kein Sitz mit `connected: true`), bevor
 * ihn jemand OHNE Identitaetsnachweis (kein Login, oder keine passende `hostUserId`) ersetzen
 * darf. Bewusst kurz genug, dass ein wirklich verwaister Raum (Host-Laptop zu) noch am selben
 * Abend wieder bespielbar ist, und bewusst laenger als `pingTimeout` (lib/socket/server.ts, bis zu
 * 85s bis ein Verbindungsabbruch ueberhaupt erkannt wird), damit ein kurzer WLAN-Haenger den Raum
 * nicht sofort einem Dritten ueberlaesst. Keine erfundene Praezision -- wie bei `ROOM_EXPIRY_MS`
 * (room-persistence.ts) eine bewusste, grosszuegige Wahl, kein Messwert.
 */
export const ORPHANED_ROOM_REPLACE_GRACE_MS = 5 * 60 * 1000;

/** Kein Sitz im Raum ist gerade mit einem Socket verbunden -- Voraussetzung fuer's Ersetzen. */
function isRoomFullyDisconnected(room: RuntimeRoom): boolean {
  return (["A", "B"] as const).every((role) => !room.seats[role]?.connected);
}

/**
 * EINZIGE Stelle, die einen Raum aus der aktiven Menge nimmt (Prozess-Map + Ablage + Save-Schutz-
 * Registry). Befund F5 (Notausfahrt-Audit): `registerLiveRoomSaveId` wurde bislang NIE wieder
 * geloescht -- weder von `closeRoom` noch vom Sieben-Tage-Verfall (`evictRoomIfExpired`) -- die
 * Registry schuetzte damit auf ewig Saves toter Raeume vor der rollierenden Aufbewahrung
 * (save-retention.ts). Jeder Ausgang (Host beendet den Raum, Verfall, Ersetzen eines verwaisten
 * Raums beim Neu-Erstellen) laeuft jetzt durch DIESE eine Funktion, damit kein Pfad das Loeschen
 * der Registry-Zeile vergisst -- dieselbe "eine Stelle"-Regel wie bei `syncPlayers`/Persistenz.
 */
function removeRoomFromActiveSet(room: RuntimeRoom): void {
  runtimeRooms.delete(room.roomCode);
  deletePersistedRoom(room.roomCode);
  registerLiveRoomSaveId(room.roomCode, null);
}

function buildSeat(role: CoachRole, socketId: string, participantId: string): RoomSeat {
  return {
    role,
    participantId,
    seatToken: createSeatToken(),
    socketId,
    connected: true,
    joinedAt: new Date().toISOString(),
  };
}

function syncPlayers(room: RuntimeRoom) {
  const ownership = room.state.teamOwnership;
  const roomParticipants = syncParticipantControlledTeams(
    room.state.roomParticipants.map((participant) => ({
      ...participant,
      connectionStatus: Object.values(room.seats).some(
        (seat) => seat?.participantId === participant.participantId && seat.connected,
      )
        ? "online"
        : "offline",
    })),
    ownership,
  );
  const multiplayerRoom = {
    ...room.state.multiplayerRoom,
    status: getSeatCount(room) > 0 ? room.state.multiplayerRoom.status : "paused",
    updatedAt: new Date().toISOString(),
  };

  const turnState = buildTurnState({
    roomStatus: multiplayerRoom.status,
    participants: roomParticipants,
    ownership,
    currentStep: room.state.turnState.currentStep,
  });
  const systemControlledTeamIds = ownership.filter((entry) => entry.controllerType === "ai").map((entry) => entry.teamId);

  room.state = {
    ...room.state,
    status: getSeatCount(room) === MAX_ACTIVE_PLAYERS ? "active" : "waiting",
    multiplayerRoom,
    roomParticipants,
    systemControlledTeamIds,
    turnState,
    roomFlowState: buildRoomFlowState({
      state: {
        multiplayerRoom,
        roomParticipants,
        teamOwnership: ownership,
        systemControlledTeamIds,
        turnState,
      },
      currentStep: turnState.currentStep,
      aiAutoCompletedTeamIds: room.state.roomFlowState?.aiAutoCompletedTeamIds,
      // Wie `aiAutoCompletedTeamIds` aus dem Vorzustand uebernommen: dieser Rebuild laeuft bei
      // jedem Beitritt/Ready und hat den Spielstand nicht zur Hand. Ohne das Weiterreichen
      // wuerde die beim Weiterschalten ermittelte Auskunft "Saison laeuft noch" sofort wieder
      // auf null fallen und der Host-Knopf am Zyklus-Ende falsch beschriftet.
      seasonContinues: room.state.roomFlowState?.seasonContinues,
    }),
    arenaSyncState: syncRoomArenaParticipants({
      ...room.state,
      multiplayerRoom,
      roomParticipants,
      systemControlledTeamIds,
    }),
    players: {
      A: room.seats.A && {
        role: "A",
        connected: room.seats.A.connected,
        joinedAt: room.seats.A.joinedAt,
      },
      B: room.seats.B && {
        role: "B",
        connected: room.seats.B.connected,
        joinedAt: room.seats.B.joinedAt,
      },
    },
  };

  // Stufe 0.1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Befund B1): EINZIGE Stelle, an der jede
  // Raum-Mutation vorbeikommt, bevor sie zum Aufrufer zurueckgeht (createRoom, joinRoom,
  // rejoinRoom, markDisconnected, alle Room-Flow-/Arena-/Ownership-Aktionen unten rufen sie am
  // Ende auf) — deshalb hier und nur hier persistiert, statt an zwanzig Aufrufstellen zu
  // verstreuen. Synchron und pro Aufruf billig (better-sqlite3, kleine JSON-Blobs); der Server
  // fasst dafuer nach einem Neustart nie wieder eine leere Map an.
  persistRuntimeRoom(room);
}

/**
 * Welche Team-Zuordnung steht IM SPIELSTAND — und zwar ausdruecklich, nicht geraten?
 *
 * REGRESSION, DIE DIESE FUNKTION BEHEBT (CI-Lauf 1918, drei rote Pruefungen; auf `main` gruen).
 * Die Vorfassung stand direkt in `createRoom`, baute die Einstellungs-Karte ueber ALLE Teams des
 * Spielstands (`buildTeamControlSettingsMap` fuellt fuer jedes Team einen Default-Eintrag) und
 * verstand deshalb jedes menschlich gesteuerte Team ohne eigenen Eintrag als "gehoert Chris".
 * Bei einem Spielstand ohne jede Besitz-Angabe -- `teamControlSettings: {}` -- fielen damit ALLE
 * menschlichen Teams an den Host, inklusive der Teams, die Franky spielen soll. Zusammen mit dem
 * dabei gesetzten `ownershipAssignedByHost: true` war das dauerhaft: `joinRoom` haelt sich an
 * dieses Kennzeichen und verteilte die Teams beim Beitritt nicht mehr neu, Franky bekam also nie
 * welche. Messbar an drei Stellen -- Chris durfte auf Frankys Team schreiben (403 erwartet, 200
 * bekommen), Franky nicht mehr auf sein eigenes (200 erwartet, 403 bekommen), und Chris'
 * schreibbare Team-Menge enthielt Frankys Team.
 *
 * DIE REGEL DAHINTER ist die Hausregel "keine erfundenen Zahlen": ein Spielstand, der zum Besitz
 * NICHTS sagt, sagt eben nichts -- daraus "der Host besitzt alles" abzuleiten ist geraten, und in
 * einem Raum mit zwei Sitzen ist es nachweislich falsch geraten. Deshalb zaehlen hier nur Teams
 * mit einem ECHTEN Eintrag in `seasonState.teamControlSettings`; alle anderen bleiben offen und
 * werden von der normalen Zuteilung beim Beitritt (`joinRoom`) vergeben.
 *
 * `null`, wenn der Spielstand keine ausdrueckliche Zuordnung traegt -- der ehrliche Rueckfall.
 */
function leiteTeamZuordnungAusSaveAb(
  saveId: string,
  persistence?: PersistenceService,
): { chrisTeamIds: string[]; frankyTeamIds: string[] } | null {
  const service = persistence ?? createPersistenceService();
  const save = service.getSaveById(saveId);
  if (!save) {
    return null;
  }

  const roheEinstellungen = save.gameState.seasonState?.teamControlSettings ?? {};
  // NUR Teams, ueber die der Spielstand ausdruecklich etwas sagt (siehe Kommentar oben) -- daher
  // erst filtern, dann die Karte bauen. Andersherum haette `buildTeamControlSettingsMap` fuer
  // jedes Team einen Default erfunden, und genau daran ist die Vorfassung gescheitert.
  const benannteTeams = (save.gameState.teams ?? []).filter((team) => roheEinstellungen[team.teamId]);
  if (benannteTeams.length === 0) {
    return null;
  }

  const settingsMap = buildTeamControlSettingsMap(benannteTeams, roheEinstellungen);
  const { chrisTeamIds, frankyTeamIds } = deriveChrisFrankyTeamIdsFromSettings(benannteTeams, settingsMap);
  if (chrisTeamIds.length === 0 && frankyTeamIds.length === 0) {
    return null;
  }

  return { chrisTeamIds, frankyTeamIds };
}

export function createRoom(
  socketId: string,
  input?: {
    displayName?: string | null;
    saveId?: string | null;
    preset?: RoomOwnershipPreset | null;
  },
  // Phase-1-Login (nur bei OLY_AUTH_ENABLED=1 gesetzt): wenn eine Session
  // vorliegt, gewinnt die echte Identitaet gegenueber dem frei eingegebenen
  // Anzeigenamen und der zufaelligen userId. Bei deaktiviertem Login ist dieser
  // Parameter immer null/undefined und das Verhalten bleibt unveraendert.
  sessionUser?: { displayName: string; ownerId: string } | null,
  options?: { persistence?: PersistenceService },
) {
  const requestedSaveId = input?.saveId?.trim() || null;
  const isRealSaveId = Boolean(requestedSaveId) && !isSandboxRoomSave(requestedSaveId!);

  // NOTAUSFAHRT (F1, Korrektur 16.08.2026 -- docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): "der Raum ist
  // wieder betretbar", NICHT "raus aus dem Mehrspieler" (siehe Kommentar an
  // `ORPHANED_ROOM_REPLACE_GRACE_MS`). `createRoom` bekommt `saveId` bereits heute mit
  // (HomePageClient.tsx sendet beim Klick auf "Raum erstellen" den aktiven Save mit) -- das wird
  // hier genutzt: existiert fuer diesen Save schon ein aktiver Raum, entsteht NIE stumpf ein
  // zweiter, PARALLELER Raum fuer denselben Save (zwei Raeume koennten sonst gegeneinander in
  // denselben Spielstand schreiben -- dieselbe Fehlerklasse wie B1).
  if (isRealSaveId) {
    const existingRoom = getActiveRoomBySaveId(requestedSaveId!);
    if (existingRoom) {
      const hostSeat = existingRoom.seats.A;

      // Fall 1 -- Identitaetsnachweis: der Anrufer ist per Login als GENAU der urspruengliche
      // Host ausgewiesen (`sessionUser.ownerId` deckungsgleich mit `hostUserId`, gesetzt bei der
      // Raum-Anlage). NUR mit aktivem Login moeglich -- siehe Kommentar an `resolveSessionOwnerId`
      // (lib/auth/session.ts): ohne Login gibt es serverseitig KEINE ueber ein Geraet hinweg
      // stabile Identitaet (der Sitzplatz-Token im localStorage ist ja gerade verloren), dieser
      // Zweig greift dann nie und faellt auf Fall 2 durch. Sofortige, wartefreie Wiederherstellung
      // OHNE den bestehenden Raum anzutasten: der Host bekommt SEINEN Sitz A zurueck, der
      // Mitspieler bleibt drin, falls er noch verbunden ist -- ein neuer Raum wuerde ihn sonst
      // zurueck lassen.
      if (hostSeat && sessionUser?.ownerId && sessionUser.ownerId === existingRoom.state.multiplayerRoom.hostUserId) {
        const reclaimedSeat = buildSeat("A", socketId, hostSeat.participantId);
        existingRoom.seats.A = reclaimedSeat;
        existingRoom.state.roomParticipants = existingRoom.state.roomParticipants.map((participant) =>
          participant.participantId === reclaimedSeat.participantId
            ? { ...participant, connectionStatus: "online", lastSeenAt: new Date().toISOString() }
            : participant,
        );
        existingRoom.state.actionLog.push(
          createActionLogEntry({
            actorRole: "A",
            type: "player_rejoined",
            message: "Der Host hat seinen Sitzplatz ueber seine Anmeldung zurueckgeholt.",
          }),
        );
        existingRoom.state = appendRoomEvent(existingRoom.state, "room_state_updated", {
          source: "host_seat_reclaimed_by_identity",
        });
        syncPlayers(existingRoom);
        return { room: existingRoom, seat: reclaimedSeat };
      }

      // Fall 2 -- kein Identitaetsnachweis (kein Login, oder der Anrufer ist nicht der Host):
      // nur ein WIRKLICH verwaister Raum (niemand mehr verbunden, seit mindestens
      // `ORPHANED_ROOM_REPLACE_GRACE_MS` keine Aktivitaet -- `multiplayerRoom.updatedAt` faengt
      // jede Aktion, inklusive Disconnects, siehe `syncPlayers`) darf ersetzt werden. Bewusst KEIN
      // hartes Ablehnen fuer den "noch aktiv"-Fall: ein zweiter, ungenutzter Raum ist unschoen,
      // aber ungefaehrlich -- `authorizeServerRoomWrite` (server-authoritative-write-guard.ts)
      // lehnt einen Schreibvorgang, der auf dem "falschen" (nicht dem von `getActiveRoomBySaveId`
      // gefundenen) Raum landet, ohnehin mit `save_bound_to_different_room` (409) ab. Ein
      // freundlicher, blockierender Fehlertext haette hier den Rueckgabetyp dieser Funktion in
      // eine Union geaendert und damit jeden bestehenden Aufrufer (Tests wie Produktionscode) zum
      // Nachziehen gezwungen -- fuer eine Absicherung, die es bereits gibt, nicht der Aufwand wert.
      const orphanedSinceMs = Date.now() - new Date(existingRoom.state.multiplayerRoom.updatedAt).getTime();
      const isReplaceable = isRoomFullyDisconnected(existingRoom) && orphanedSinceMs >= ORPHANED_ROOM_REPLACE_GRACE_MS;
      if (isReplaceable) {
        // System-getriggertes Schliessen -- kein Sitzplatz-Token noetig, der Raum ist per
        // Definition (isReplaceable) ohne verbundenen Teilnehmer. WICHTIG: von hier bis zum
        // `runtimeRooms.set(...)` unten steht kein `await` -- better-sqlite3 ist synchron, es kann
        // also KEIN anderer Request dazwischen laufen, der den Save fuer diesen einen Tick
        // "ungebunden" sehen koennte. Chris' Vorgabe ("nie solo weiterspielbar") bleibt damit auch
        // beim Ersetzen lueckenlos gewahrt -- der Save ist vor, waehrend und nach diesem Aufruf
        // ununterbrochen an EINEN aktiven Raum gebunden.
        removeRoomFromActiveSet(existingRoom);
      }
    }
  }

  let roomCode = createRoomCode();

  while (runtimeRooms.has(roomCode)) {
    roomCode = createRoomCode();
  }

  const participantId = `participant-${crypto.randomUUID()}`;
  const room: RuntimeRoom = {
    roomCode,
    state: createInitialRoomState(roomCode, {
      saveId: input?.saveId,
      hostParticipantId: participantId,
      hostUserId: sessionUser?.ownerId || `user-${participantId}`,
      hostDisplayName: sessionUser?.displayName || input?.displayName?.trim() || "Chris",
    }),
    seats: {
      A: buildSeat("A", socketId, participantId),
    },
  };

  /**
   * REGEL SEIT DER ABLAGE (Stufe 0.1): `syncPlayers` ist die EINZIGE Stelle, an der ein Raum
   * gespeichert wird. Jede Änderung an `room.state` muss deshalb VOR dem letzten `syncPlayers`
   * dieser Funktion stehen — sonst liegt sie zwar im Arbeitsspeicher, aber nicht in der Ablage,
   * und ein Neustart verliert genau sie.
   *
   * Hier stand das Anlege-Ereignis ursprünglich HINTER dem letzten `syncPlayers`; der gespeicherte
   * Stand war damit bei jeder Raumanlage ein Ereignis hinterher. Wirkung im Alltag klein (das
   * Ereignisprotokoll ist eine Chronik, kein Zustand), die Regel bricht es trotzdem — und die
   * nächste Änderung an dieser Stelle wäre womöglich keine Chronik mehr.
   */
  if (input?.preset) {
    room.state = applyOwnershipPresetToState(room.state, input.preset);
    // Die Wahl MERKEN, nicht nur anwenden (Aufgabe #49): angewandt wirkt sie jetzt nur auf den
    // Host — Franky ist noch nicht da, und `buildExplicitTeamOwnership` laesst die Teams eines
    // abwesenden Teilnehmers bewusst offen. Beim Beitritt muss deshalb noch einmal verteilt werden,
    // und dort war diese Wahl bisher schlicht vergessen; es blieb ein fest verdrahtetes 4+4.
    // Bewusst NICHT `ownershipAssignedByHost` — siehe Kommentar am Feld (types/game.ts).
    room.state = {
      ...room.state,
      multiplayerRoom: { ...room.state.multiplayerRoom, createdWithPreset: input.preset },
    };
  }

  // NOTAUSFAHRT, Fortsetzung (F1): ein neu angelegter Raum fuer einen ECHTEN, bereits
  // existierenden Spielstand (der "Fall 2"-Ersatzraum oben, aber auch der ganz normale erste Raum
  // fuer einen schon laufenden Solo-/Koop-Save) soll die Team-Zuordnung, die im SAVE selbst steht
  // (`teamControlSettings`), uebernehmen statt bei "1 Team, Rest KI" zu starten. Ohne das wuerde
  // `startRoom`s "continue existing"-Zweig beim naechsten "Spiel starten" die Zuordnung AUS DEM
  // (leeren) RAUM in den Save schreiben und die bisherige Aufteilung stillschweigend ueberschreiben
  // -- der Save selbst bleibt bis dahin unangetastet, es geht also kein Fortschritt verloren, nur
  // die Lobby-Anzeige waere falsch. Nur der Host ist in diesem Moment im Raum -- Frankys Teams
  // bleiben bis zu seinem (Wieder-)Beitritt/der naechsten Host-Zuteilung KI-gefuehrt, wie in jedem
  // Raum ohne zweiten Teilnehmer (`buildExplicitTeamOwnership`).
  //
  // KEIN `ownershipAssignedByHost: true` MEHR (Regression aus CI-Lauf 1918, siehe
  // `leiteTeamZuordnungAusSaveAb`): das Kennzeichen bedeutet "der Host hat SELBST zugeteilt" und
  // ist genau deshalb die Bremse, die `joinRoom` davon abhaelt, die Zuteilung beim Beitritt neu zu
  // vergeben. Eine aus dem Spielstand ABGELEITETE Uebernahme ist aber keine Host-Handlung, sondern
  // ein Vorschlag des Systems -- sie hier als Host-Handlung auszugeben, hat Franky dauerhaft ohne
  // Teams dastehen lassen. Der Host setzt das Kennzeichen weiterhin ueber die Lobby
  // (`applyRoomOwnershipPreset`/`applyRoomTeamSelection`), und nur dort.
  // `!input?.preset`: hat der Host beim Anlegen ausdruecklich einen Modus mitgegeben, ist DAS seine
  // Ansage -- eine aus dem Spielstand abgeleitete Uebernahme darf sie nicht ueberschreiben. Genau
  // diese Reihenfolge fehlte und war an einem der beiden Fehlschlaege oben beteiligt.
  if (isRealSaveId && !input?.preset) {
    const uebernommen = leiteTeamZuordnungAusSaveAb(requestedSaveId!, options?.persistence);
    if (uebernommen) {
      const seeded = applyExplicitTeamOwnershipToState(room.state, uebernommen);
      if (seeded.ok) {
        room.state = seeded.state;
      }
    }
  }

  room.state = appendRoomEvent(room.state, "room_state_updated", { source: "room_created", preset: input?.preset ?? "default" });
  syncPlayers(room);
  runtimeRooms.set(roomCode, room);

  return {
    room,
    seat: room.seats.A!,
  };
}

export function joinRoom(
  roomCode: string,
  socketId: string,
  input?: { displayName?: string | null },
  // Phase-1-Login (nur bei OLY_AUTH_ENABLED=1 gesetzt), siehe createRoom() oben.
  sessionUser?: { displayName: string; ownerId: string } | null,
  // Wie bei createRoom() einspeisbar, damit Tests die Ablage ersetzen koennen — gebraucht fuer
  // Stufe 3 der Rangfolge unten (Aufteilung aus dem Spielstand).
  options?: { persistence?: PersistenceService },
) {
  const normalizedCode = roomCode.trim().toUpperCase();
  const room = runtimeRooms.get(normalizedCode);

  if (!room) {
    return { ok: false as const, error: RAUM_NICHT_GEFUNDEN_MELDUNG };
  }

  if (room.seats.B) {
    return { ok: false as const, error: RAUM_VOLL_MELDUNG };
  }

  const resolvedDisplayName = sessionUser?.displayName || input?.displayName?.trim() || "Franky";
  const participantId = `participant-${crypto.randomUUID()}`;
  room.seats.B = buildSeat("B", socketId, participantId);
  room.state.roomParticipants = [
    ...room.state.roomParticipants,
    buildParticipant({
      participantId,
      userId: sessionUser?.ownerId || `user-${participantId}`,
      displayName: resolvedDisplayName,
      role: "player",
    }),
  ];
  // Nebenbefund (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, "Beitritt loescht die Zuteilung des
  // Hosts"): frueher wurde HIER unbedingt ueberschrieben, egal was der Host vorher im Raum
  // (Lobby-Preset/Team-Picker) bereits zugewiesen hatte. Nur wenn `ownershipAssignedByHost` noch
  // false ist -- der Host hat im Raum selbst NOCH NICHTS zugewiesen, es steht nur der
  // System-Default aus `createInitialRoomState` -- greift der Auto-Default. Hat der Host schon
  // gehandelt, bleibt seine Wahl unangetastet.
  //
  // HIER GILT BEWUSST NUR DER 4+4-VORSCHLAG, NICHT die aus dem Spielstand abgeleitete Zuordnung --
  // und das ist eine Korrektur an meiner eigenen Arbeit, zweimal nachgemessen:
  //
  //  1. Erst liess ich die Save-Zuordnung hier gewinnen. Der Zwei-Browser-Test fiel um mit
  //     "Chris teams mismatch. Expected D-P, M-M, P-S, V-W, got M-M" -- ein Spielstand, der nur
  //     EIN Team nennt, stutzte Chris auf dieses eine Team und liess Franky ganz leer ausgehen.
  //  2. Dann liess ich sie nur gewinnen, wenn sie auch Teams des zweiten Spielers nennt. Der Test
  //     fiel identisch aus: `bootstrapSingleplayerSave()` liefert hier keinen frischen Stand,
  //     sondern einen VORHANDENEN -- der bereits eine Koop-Aufteilung trug und damit genau das
  //     Preset ueberstimmte, das der Host beim Anlegen ausdruecklich mitgegeben hatte.
  //
  // Die Lehre aus beiden: der Beitritt ist die EINZIGE Stelle, an der Franky ueberhaupt Teams
  // bekommt (beim Anlegen war er noch nicht da, und `buildExplicitTeamOwnership` laesst die Teams
  // eines abwesenden Teilnehmers bewusst offen). Diese eine Stelle mit einer abgeleiteten Quelle
  // zu ueberschreiben, hat ihn beide Male leer ausgehen lassen. Eine Ableitung darf die Zuteilung
  // vorschlagen, aber nicht den Mechanismus ersetzen, der sie ueberhaupt erst vergibt.
  //
  // BEKANNTE, BEWUSST OFFENE LUECKE (Aufgabe #49): wird ein Koop-Spielstand in einem NEUEN Raum
  // geoeffnet, verteilt dieser Vorschlag die Teams neu, statt die Aufteilung aus dem Spielstand
  // wiederherzustellen. Das ist unveraendert das Verhalten von `main` -- also keine Regression,
  // sondern eine Luecke, die es vorher schon gab -- und der Host haengt sie ueber den Team-Picker
  // um. Sie hier "nebenbei" mitzuloesen war genau der Versuch, der die zwei Fehlschlaege oben
  // erzeugt hat; sie gehoert in einen eigenen Schritt mit eigenem Test.
  //
  // AUFGABE #49, DER DRITTE ANLAUF — und diesmal mit der Entscheidung VORNEWEG statt hinterher:
  // bei Widerspruch zwischen Spielstand und Host gewinnt DER HOST. Wer beim Anlegen einen Modus
  // waehlt, trifft eine Wahl; eine abgeleitete Quelle darf sie nicht ueberstimmen. Genau daran ist
  // Anlauf 2 gescheitert (`bootstrapSingleplayerSave()` lieferte einen VORHANDENEN Stand, der eine
  // alte Koop-Aufteilung trug, und die schlug das ausdruecklich mitgegebene Preset).
  //
  // Die Rangfolge, jede Stufe eine echte Angabe — nichts davon geraten:
  //  1. Der Host hat IM RAUM zugeteilt -> unangetastet lassen (bestehend).
  //  2. Sonst: das Preset, mit dem der Raum ANGELEGT wurde — ABER nur, wenn es dem zweiten Sitz
  //     ueberhaupt Teams gibt. Ein Solo-Modus ("Chris 4, Rest KI") sagt ueber den zweiten Sitz
  //     nichts; ihn hier gewinnen zu lassen liesse den Gast, der gerade beigetreten IST, leer
  //     ausgehen — genau der Ausgang, den die Stufen darunter verhindern sollen. Gemessen statt
  //     hart auf einen Preset-Namen gepinnt: angewandt wird es nur, wenn dabei wirklich Teams beim
  //     zweiten Teilnehmer landen. So gilt die Regel auch fuer Modi, die es noch nicht gibt.
  //  3. Sonst: die Aufteilung aus dem Spielstand — aber NUR, wenn sie beide Seiten nennt. Ein
  //     Stand, der nur ein Team kennt, ist die Handschrift eines Solo-Standes und sagt ueber den
  //     zweiten Sitz nichts (Anlauf 1 stutzte Chris genau daran auf ein Team).
  //  4. Sonst: der bisherige 4+4-Vorschlag.
  if (!room.state.multiplayerRoom.ownershipAssignedByHost) {
    const angelegtMit = room.state.multiplayerRoom.createdWithPreset;
    const mitPreset = angelegtMit ? applyOwnershipPresetToState(room.state, angelegtMit) : null;
    const presetGibtDemGastTeams =
      mitPreset != null &&
      mitPreset.teamOwnership.some(
        (eintrag) => eintrag.controllerType === "human" && eintrag.participantId === participantId,
      );
    if (mitPreset && presetGibtDemGastTeams) {
      room.state = mitPreset;
    } else {
      const saveId = room.state.multiplayerRoom.saveId;
      const ausSave =
        saveId && !isSandboxRoomSave(saveId) ? leiteTeamZuordnungAusSaveAb(saveId, options?.persistence) : null;
      const beschreibtKoop = (ausSave?.frankyTeamIds.length ?? 0) > 0;
      const uebernommen = ausSave && beschreibtKoop ? applyExplicitTeamOwnershipToState(room.state, ausSave) : null;
      room.state =
        uebernommen?.ok === true
          ? uebernommen.state
          : applyOwnershipPresetToState(room.state, "chris_4_franky_4_rest_ai");
    }
  }
  room.state = appendRoomEvent(room.state, "participant_joined", { participantId, displayName: resolvedDisplayName });
  room.state.actionLog.push(
    createActionLogEntry({
      actorRole: "B",
      type: "player_joined",
      message: "Coach B ist dem Raum beigetreten.",
    }),
  );
  syncPlayers(room);

  return { ok: true as const, room, seat: room.seats.B };
}

export function rejoinRoom(roomCode: string, seatToken: string, socketId: string) {
  const normalizedCode = roomCode.trim().toUpperCase();
  const room = runtimeRooms.get(normalizedCode);

  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }

  const role = findSeatByToken(room, seatToken);
  if (!role) {
    return { ok: false as const, error: GESPEICHERTER_SITZPLATZ_UNGUELTIG_MELDUNG };
  }

  const seat = room.seats[role]!;
  seat.connected = true;
  seat.socketId = socketId;
  room.state.roomParticipants = room.state.roomParticipants.map((participant) =>
    participant.participantId === seat.participantId
      ? { ...participant, connectionStatus: "online", lastSeenAt: new Date().toISOString() }
      : participant,
  );
  room.state.actionLog.push(
    createActionLogEntry({
      actorRole: role,
      type: "player_rejoined",
      message: `Coach ${role} hat den Raum erneut verbunden.`,
    }),
  );
  room.state = appendRoomEvent(room.state, "room_state_updated", { source: "participant_rejoined", participantId: seat.participantId });
  syncPlayers(room);

  return { ok: true as const, room, seat };
}

/**
 * Meldet den Sitzplatz hinter `socketId` als offline — und gibt die betroffenen Raeume zurueck,
 * damit der Aufrufer den neuen Stand broadcasten kann.
 *
 * Der Rueckgabewert kam nachtraeglich dazu: `lib/socket/server.ts` rief das hier im
 * `disconnect`-Handler auf, ohne danach `roomState` zu senden. Der verbliebene Spieler sah
 * deshalb weiter "Warten auf <Name>" fuer jemanden, den der Server laengst nicht mehr als
 * bereit-pflichtig fuehrt (`getRequiredParticipants` filtert `connectionStatus === "offline"`
 * heraus) — bis irgendein anderes Ereignis zufaellig einen Broadcast ausloeste. Gefunden vom
 * Koop-Audit (scripts/audit-koop-spielbarkeit.ts, Fall D2a).
 */
export function markDisconnected(socketId: string) {
  const betroffeneRaeume: RuntimeRoom[] = [];
  for (const room of runtimeRooms.values()) {
    for (const role of ["A", "B"] as const) {
      const seat = room.seats[role];
      if (seat?.socketId === socketId) {
        seat.connected = false;
        seat.socketId = null;
        room.state.roomParticipants = room.state.roomParticipants.map((participant) =>
          participant.participantId === seat.participantId
            ? { ...participant, connectionStatus: "offline", lastSeenAt: new Date().toISOString() }
            : participant,
        );
        room.state = appendRoomEvent(room.state, "participant_left", { participantId: seat.participantId, connectionStatus: "offline" });
        syncPlayers(room);
        betroffeneRaeume.push(room);
      }
    }
  }
  return betroffeneRaeume;
}

/**
 * Heilt die Praesenz eines Teilnehmers, den der Server faelschlich als offline fuehrt, wenn ein
 * Schreibvorgang mit gueltigem Sitzplatz-Token hereinkommt.
 *
 * WARUM DAS KEIN SICHERHEITSPROBLEM IST: der Token ist DASSELBE Geheimnis, das `rejoinRoom` oben
 * akzeptiert, um genau diesen Sitzplatz online zu setzen. Trifft derselbe Token stattdessen an
 * einem Schreibvorgang ein, ist das kein schwaecheres Signal — nur ein anderer Kanal fuer
 * dieselbe Erkenntnis: "dieser Client ist noch da". Aufgerufen vom Server-Write-Guard
 * (`lib/room/server-authoritative-write-guard.ts`), wenn der Ping-Heartbeat waehrend einer
 * blockierten Event-Loop (Liga-Draft, Spieltagsaufloesung, grosse Kauf-Batches) ausgeblieben ist,
 * `markDisconnected` den Teilnehmer offline gemeldet hat, der Client selbst den Raum aber nie
 * verlassen hat.
 *
 * SICHERHEITSGRENZE — der eigentliche Grund, warum `participant_offline` ueberhaupt blockt: heilt
 * NUR, wenn der Token zum SELBEN Teilnehmer gehoert, der hier schreiben will
 * (`expectedParticipantId`). Ein Sitzplatz kann serverseitig nie an einen anderen Teilnehmer neu
 * vergeben werden (jeder Sitz bekommt seinen Token einmalig in `createRoom`/`joinRoom`, siehe
 * `buildSeat`) — dieser Zweig ist also aktuell nicht erreichbar. Er bleibt trotzdem als
 * Verteidigungslinie stehen: sollte sich das je aendern, heilt ein fremder/veralteter Token dann
 * weiterhin NICHTS, und der urspruenglich offline markierte Teilnehmer bleibt draussen — exakt
 * das Verhalten vor dieser Aenderung.
 *
 * Anders als `rejoinRoom`: kein neuer Socket wird gebunden — ein HTTP-Schreibvorgang hat keinen.
 * `seat.socketId` bleibt unveraendert; ein spaeterer echter Socket-Reconnect ueberschreibt ihn
 * ohnehin ueber `rejoinRoom`.
 *
 * Gibt `null` zurueck, wenn nichts geheilt wurde (ungueltiger/fremder Token, Sitz schon online) —
 * der Aufrufer bleibt dann beim bisherigen 403.
 */
export function healParticipantPresenceByToken(
  room: RuntimeRoom,
  seatToken: string,
  expectedParticipantId: string,
): RuntimeRoom | null {
  const role = findSeatByToken(room, seatToken);
  const seat = role ? room.seats[role] : null;
  if (!seat || seat.participantId !== expectedParticipantId || seat.connected) {
    return null;
  }

  seat.connected = true;
  room.state.roomParticipants = room.state.roomParticipants.map((participant) =>
    participant.participantId === seat.participantId
      ? { ...participant, connectionStatus: "online", lastSeenAt: new Date().toISOString() }
      : participant,
  );
  room.state.actionLog.push(
    createActionLogEntry({
      actorRole: role!,
      type: "player_rejoined",
      message: `Coach ${role} war offline gemeldet — ein Schreibvorgang mit gueltigem Sitzplatz-Token hat die Verbindung als weiter bestehend erkannt.`,
    }),
  );
  room.state = appendRoomEvent(room.state, "room_state_updated", {
    source: "participant_presence_healed_by_write_guard",
    participantId: seat.participantId,
  });
  syncPlayers(room);
  return room;
}

export function getRoom(roomCode: string) {
  return runtimeRooms.get(roomCode.trim().toUpperCase()) ?? null;
}

/**
 * BEFUND B2 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): `closeRoom` beendet einen Raum sauber, wird
 * aber nur aus Tests gerufen — niemand ruft es aus einem echten, abgebrochenen Spiel heraus. Und
 * der Sieben-Tage-Verfall (`ROOM_EXPIRY_MS`, room-persistence.ts) griff bislang NUR beim
 * Prozessstart (`loadPersistedRuntimeRooms` -> `sweepExpiredPersistedRooms`) — ein Raum, der lange
 * im Speicher bleibt, weil der Server zufaellig nicht neu startet, blieb fuer seinen gebundenen
 * Save fuer IMMER "aktiv" und sperrte jeden Nicht-Raum-Schreibvorgang dauerhaft
 * (`assertSaveNotRoomBound` -> `authorizeServerRoomWrite` -> 409).
 *
 * DER AUSGANG: hier, auf dem Lesepfad, den `assertSaveNotRoomBound` als ERSTE Quelle befragt.
 * Ein Raum, der laenger als `ROOM_EXPIRY_MS` nicht mehr angefasst wurde (kein Beitritt, kein
 * Schreibvorgang, kein Reconnect — jede dieser Aktionen laeuft durch `syncPlayers` und aktualisiert
 * `multiplayerRoom.updatedAt`), gilt als verwaist: er wird HIER, beim naechsten Blick darauf, aus
 * der Prozess-Map UND der Ablage entfernt (derselbe Ausgang wie `closeRoom`, nur automatisch statt
 * vom Host ausgeloest) und zaehlt fortan nicht mehr als "aktiv" — der Save ist danach wieder ein
 * normaler Solo-Save.
 *
 * WARUM DAS DEN SCHUTZ NICHT AUSHOEHLT: sieben Tage sind grosszuegig bemessen (siehe Kommentar an
 * `ROOM_EXPIRY_MS`) — ein Raum, in dem in dieser Zeit AUCH NUR EIN Schreibvorgang/Beitritt/Reconnect
 * passiert, bleibt vollstaendig gesperrt wie bisher. Nur ein Raum, den wirklich niemand mehr
 * anfasst, verliert seinen Riegel — genau das Verhalten, das der Sieben-Tage-Verfall fuer die
 * ABLAGE schon immer versprochen hat, hier nur unabhaengig von einem Prozess-Neustart nachgezogen.
 */
function evictRoomIfExpired(room: RuntimeRoom, nowMs: number): boolean {
  const updatedAtMs = new Date(room.state.multiplayerRoom.updatedAt).getTime();
  if (Number.isNaN(updatedAtMs) || nowMs - updatedAtMs < ROOM_EXPIRY_MS) {
    return false;
  }
  // F5: ueber `removeRoomFromActiveSet` statt der beiden Zeilen einzeln, damit der Verfall auch
  // den Save-Schutz in der Registry (live-room-save-registry.ts) raeumt -- vorher blieb der hier
  // fuer immer stehen, siehe Kommentar an `removeRoomFromActiveSet`.
  removeRoomFromActiveSet(room);
  return true;
}

export function getActiveRoomBySaveId(saveId: string) {
  const nowMs = Date.now();
  for (const room of runtimeRooms.values()) {
    if (room.state.multiplayerRoom.saveId !== saveId) {
      continue;
    }
    if (evictRoomIfExpired(room, nowMs)) {
      continue;
    }
    if (room.state.multiplayerRoom.status !== "completed" && room.state.multiplayerRoom.status !== "paused") {
      return room;
    }
  }
  return null;
}

export function recordRoomGameplayWrite(input: {
  roomCode: string;
  saveId: string;
  teamId?: string | null;
  participantId?: string | null;
  action: string;
  eventType: RoomRealtimeEventType;
  affectedViews?: string[];
}) {
  const room = getRoom(input.roomCode);
  if (!room || room.state.multiplayerRoom.saveId !== input.saveId) {
    return { ok: false as const, room: null };
  }

  const participantId = input.participantId ?? null;
  const shouldInvalidateReady = Boolean(
    participantId &&
      room.state.roomParticipants.some(
        (participant) => participant.participantId === participantId && participant.readyState === "ready",
      ),
  );

  room.state = {
    ...room.state,
    roomParticipants: room.state.roomParticipants.map((participant) =>
      participant.participantId === participantId
        ? { ...participant, readyState: "not_ready", lastSeenAt: new Date().toISOString() }
        : participant,
    ),
    arenaSyncState:
      input.eventType === "matchday_applied" || input.eventType === "arena_result_applied"
        ? {
            ...room.state.arenaSyncState,
            status: "result_applied",
            resultStatus: "applied",
            phaseId: "result",
            phaseIndex: 6,
            updatedAt: new Date().toISOString(),
            version: room.state.arenaSyncState.version + 1,
          }
        : room.state.arenaSyncState,
  };
  room.state = appendRoomEvent(room.state, input.eventType, {
    roomCode: room.roomCode,
    saveId: input.saveId,
    teamId: input.teamId ?? null,
    action: input.action,
    participantId,
    affectedViews: input.affectedViews ?? [],
    timestamp: new Date().toISOString(),
  });
  if (shouldInvalidateReady) {
    room.state = appendRoomEvent(room.state, "ready_invalidated", {
      roomCode: room.roomCode,
      saveId: input.saveId,
      teamId: input.teamId ?? null,
      action: input.action,
      participantId,
      affectedViews: input.affectedViews ?? [],
      timestamp: new Date().toISOString(),
    });
  }
  syncPlayers(room);
  return { ok: true as const, room };
}

function findRoomParticipantBySeatToken(room: RuntimeRoom, seatToken: string) {
  const role = findSeatByToken(room, seatToken);
  const participantId = role ? room.seats[role]?.participantId ?? null : null;
  const participant = participantId
    ? room.state.roomParticipants.find((entry) => entry.participantId === participantId) ?? null
    : null;
  return { role, participantId, participant };
}

export function startRoomArenaSync(
  roomCode: string,
  seatToken: string,
  input?: {
    seasonId?: string | null;
    matchdayId?: string | null;
    disciplineSide?: "d1" | "d2" | "overall" | null;
    maxSlotRevealIndex?: number | null;
    maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  },
) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const { role, participantId } = findRoomParticipantBySeatToken(room, seatToken);
  if (!role || !participantId) {
    return { ok: false as const, error: SITZPLATZ_UNGUELTIG_MELDUNG };
  }
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf die gemeinsame Arena starten." };
  }

  room.state = {
    ...room.state,
    roomFlowState: {
      ...room.state.roomFlowState,
      step: "arena",
    },
    arenaSyncState: buildStartedRoomArenaState({
      state: room.state,
      participantId,
      seasonId: input?.seasonId,
      matchdayId: input?.matchdayId,
      disciplineSide: input?.disciplineSide,
      maxSlotRevealIndex: input?.maxSlotRevealIndex,
      maxSlotRevealCountByDiscipline: input?.maxSlotRevealCountByDiscipline,
    }),
  };
  room.state = appendRoomEvent(room.state, "arena_started", {
    roomCode: room.roomCode,
    saveId: room.state.multiplayerRoom.saveId,
    seasonId: room.state.arenaSyncState.seasonId,
    matchdayId: room.state.arenaSyncState.matchdayId,
    disciplineSide: room.state.arenaSyncState.disciplineSide,
    participantId,
    affectedViews: ["arena", "matchday"],
  });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function setRoomArenaReadyState(roomCode: string, seatToken: string, ready: boolean) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const { participantId } = findRoomParticipantBySeatToken(room, seatToken);
  if (!participantId) {
    return { ok: false as const, error: SITZPLATZ_UNGUELTIG_MELDUNG };
  }

  room.state = {
    ...room.state,
    arenaSyncState: setRoomArenaParticipantReady({
      arenaState: room.state.arenaSyncState,
      participantId,
      ready,
    }),
  };
  room.state = appendRoomEvent(room.state, "arena_ready_changed", {
    roomCode: room.roomCode,
    saveId: room.state.multiplayerRoom.saveId,
    participantId,
    ready,
    readyParticipantIds: room.state.arenaSyncState.readyParticipantIds,
    requiredParticipantIds: room.state.arenaSyncState.requiredParticipantIds,
    affectedViews: ["arena"],
  });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function advanceRoomArenaStep(
  roomCode: string,
  seatToken: string,
  input?: {
    maxSlotRevealIndex?: number | null;
    maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
    force?: boolean | null;
  },
) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const { role, participantId } = findRoomParticipantBySeatToken(room, seatToken);
  if (!role || !participantId) {
    return { ok: false as const, error: SITZPLATZ_UNGUELTIG_MELDUNG };
  }
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf den gemeinsamen Arena-Step fortsetzen." };
  }
  if (!input?.force && room.state.arenaSyncState.status === "ready_check" && !isRoomArenaReady(room.state.arenaSyncState)) {
    return { ok: false as const, error: "Arena wartet noch auf Ready von allen aktiven Coaches." };
  }

  room.state = {
    ...room.state,
    arenaSyncState: advanceRoomArenaReveal({
      arenaState: room.state.arenaSyncState,
      participantId,
      maxSlotRevealIndex: input?.maxSlotRevealIndex,
      maxSlotRevealCountByDiscipline: input?.maxSlotRevealCountByDiscipline,
    }),
  };
  room.state = appendRoomEvent(room.state, "arena_step_changed", {
    roomCode: room.roomCode,
    saveId: room.state.multiplayerRoom.saveId,
    participantId,
    phaseId: room.state.arenaSyncState.phaseId,
    phaseIndex: room.state.arenaSyncState.phaseIndex,
    slotRevealIndex: room.state.arenaSyncState.slotRevealIndex,
    stepIndex: room.state.arenaSyncState.stepIndex,
    affectedViews: ["arena"],
  });
  syncPlayers(room);
  return { ok: true as const, room };
}

/**
 * PAUSE/WEITER ALS RAUM-AKTION (Stufe 3.6, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): reine Huelle um
 * die fertige, getestete `setRoomArenaPaused` aus `arena-sync-state.ts` — dieselbe
 * Sitzplatz-Pruefung (nur Host, Sitz "A") wie `startRoomArenaSync`/`advanceRoomArenaStep`. Die
 * Aenderung an `room.state` steht VOR dem letzten `syncPlayers(room)` (Regel siehe `createRoom`),
 * sonst ueberlebt die Pause keinen Neustart.
 */
export function setRoomArenaPausedState(roomCode: string, seatToken: string, paused: boolean) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const { role, participantId } = findRoomParticipantBySeatToken(room, seatToken);
  if (!role || !participantId) {
    return { ok: false as const, error: SITZPLATZ_UNGUELTIG_MELDUNG };
  }
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf die gemeinsame Arena pausieren." };
  }

  room.state = {
    ...room.state,
    arenaSyncState: buildRoomArenaPausedState({
      arenaState: room.state.arenaSyncState,
      participantId,
      paused,
    }),
  };
  syncPlayers(room);
  return { ok: true as const, room };
}

/**
 * "↻ NEU" ALS RAUM-AKTION (Stufe 3.6): reine Huelle um `resetRoomArenaReveal` aus
 * `arena-sync-state.ts`. Setzt nur die AKTIVE Disziplinseite zurueck (siehe Kommentar dort) —
 * diese Huelle entscheidet darueber nichts, sie prueft nur den Sitzplatz und speichert.
 */
export function resetRoomArenaRevealState(roomCode: string, seatToken: string) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const { role, participantId } = findRoomParticipantBySeatToken(room, seatToken);
  if (!role || !participantId) {
    return { ok: false as const, error: SITZPLATZ_UNGUELTIG_MELDUNG };
  }
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf die gemeinsame Arena zuruecksetzen." };
  }

  room.state = {
    ...room.state,
    arenaSyncState: buildResetRoomArenaState({
      arenaState: room.state.arenaSyncState,
      participantId,
    }),
  };
  syncPlayers(room);
  return { ok: true as const, room };
}

/**
 * QUICK-SIM ALS RAUM-AKTION (Stufe 3.6): reine Huelle um `quickSimRoomArenaReveal` aus
 * `arena-sync-state.ts` (die selbst nur ueber das bereits vorhandene `advanceRoomArenaReveal`
 * iteriert, siehe Kommentar dort — keine zweite Rechenstelle).
 */
export function quickSimRoomArenaRevealState(
  roomCode: string,
  seatToken: string,
  input?: { maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null },
) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const { role, participantId } = findRoomParticipantBySeatToken(room, seatToken);
  if (!role || !participantId) {
    return { ok: false as const, error: SITZPLATZ_UNGUELTIG_MELDUNG };
  }
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf die gemeinsame Arena vorspulen." };
  }

  room.state = {
    ...room.state,
    arenaSyncState: buildQuickSimmedRoomArenaState({
      arenaState: room.state.arenaSyncState,
      participantId,
      maxSlotRevealCountByDiscipline: input?.maxSlotRevealCountByDiscipline,
    }),
  };
  syncPlayers(room);
  return { ok: true as const, room };
}

/**
 * Spiegelt die aktuelle `teamOwnership` in den GEBUNDENEN Spielstand -- derselbe Schreibweg wie
 * beim Room-Start (`startRoom`s "continue existing"-Zweig), hier wiederverwendet fuer eine
 * SPAETERE Umverteilung (Stufe 1.3, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md: "Team-Zuordnung darf der
 * Host auch nach dem Start umverteilen"). `applyGameModeOwnership` ist die EINE Funktion, die
 * `teamControlSettings`/`humanControlled` aus einer Chris/Franky-Aufteilung ableitet -- kein
 * zweiter, abweichender Schreibpfad dafuer.
 *
 * No-op, solange noch kein echter (Nicht-Sandbox) Spielstand gebunden ist: in der Lobby gibt es
 * nichts zu synchronisieren, `startRoom` bindet den echten Save erst beim Spielstart -- die
 * Zuordnung dort uebernimmt `startRoom` selbst beim naechsten Start.
 */
function syncRoomOwnershipToBoundSave(room: RuntimeRoom, persistence?: PersistenceService) {
  if (room.state.multiplayerRoom.status === "lobby" || isSandboxRoomSave(room.state.multiplayerRoom.saveId)) {
    return;
  }
  const service = persistence ?? createPersistenceService();
  const save = service.getSaveById(room.state.multiplayerRoom.saveId);
  if (!save) {
    return;
  }
  const host = room.state.roomParticipants.find((participant) => participant.role === "host") ?? null;
  const franky = resolveFrankyParticipant(room.state.roomParticipants);
  const chrisTeamIds = host
    ? room.state.teamOwnership
        .filter((entry) => entry.controllerType === "human" && entry.participantId === host.participantId)
        .map((entry) => entry.teamId)
    : [];
  const frankyTeamIds = franky
    ? room.state.teamOwnership
        .filter((entry) => entry.controllerType === "human" && entry.participantId === franky.participantId)
        .map((entry) => entry.teamId)
    : [];
  const updatedGameState = applyGameModeOwnership(save.gameState, {
    saveMode: "online_4v4",
    chrisTeamIds,
    frankyTeamIds,
  });
  service.saveSingleplayerState(save.saveId, updatedGameState);
}

export function applyRoomOwnershipPreset(
  roomCode: string,
  seatToken: string,
  preset: RoomOwnershipPreset,
  options?: { persistence?: PersistenceService },
) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const role = findSeatByToken(room, seatToken);
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf Team-Presets setzen." };
  }
  // Stufe 1.3: "nur zwischen Spieltagen" -- siehe Kommentar an `isRoomMatchdayInProgress`. In der
  // Lobby ist niemals ein Spieltag aktiv, die Sperre greift dort also nie; unveraendertes
  // Verhalten fuer den bisherigen Lobby-Weg.
  if (isRoomMatchdayInProgress(room.state)) {
    return { ok: false as const, error: "Team-Zuordnung ist gesperrt, solange ein Spieltag laeuft. Wechsle zwischen zwei Spieltagen." };
  }

  room.state = applyOwnershipPresetToState(room.state, preset);
  // Erst eine explizite Lobby-/Raum-Aktion zaehlt als "Host hat zugeteilt" -- siehe Kommentar am
  // Feld (types/game.ts) und an `joinRoom` oben.
  room.state = { ...room.state, multiplayerRoom: { ...room.state.multiplayerRoom, ownershipAssignedByHost: true } };
  syncRoomOwnershipToBoundSave(room, options?.persistence);
  room.state = appendRoomEvent(room.state, "room_state_updated", { source: "ownership_preset_applied", preset });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function applyRoomTeamSelection(
  roomCode: string,
  seatToken: string,
  selection: { chrisTeamIds: string[]; frankyTeamIds: string[] },
  options?: { persistence?: PersistenceService },
) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const role = findSeatByToken(room, seatToken);
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf Teams zuweisen." };
  }
  // Stufe 1.3 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): Chris hat "spaeter wechseln" ausdruecklich
  // verlangt -- aber nicht, waehrend eine Aufstellung/Enthuellung mitten im Spieltag haengt.
  if (isRoomMatchdayInProgress(room.state)) {
    return { ok: false as const, error: "Team-Zuordnung ist gesperrt, solange ein Spieltag laeuft. Wechsle zwischen zwei Spieltagen." };
  }

  const result = applyExplicitTeamOwnershipToState(room.state, selection);
  if (!result.ok) {
    return { ok: false as const, error: result.message };
  }

  room.state = result.state;
  room.state = { ...room.state, multiplayerRoom: { ...room.state.multiplayerRoom, ownershipAssignedByHost: true } };
  syncRoomOwnershipToBoundSave(room, options?.persistence);
  room.state = appendRoomEvent(room.state, "room_state_updated", {
    source: "team_selection_applied",
    chrisTeamIds: selection.chrisTeamIds,
    frankyTeamIds: selection.frankyTeamIds,
  });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function setParticipantReadyState(roomCode: string, seatToken: string, ready: boolean) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const role = findSeatByToken(room, seatToken);
  if (!role) {
    return { ok: false as const, error: SITZPLATZ_UNGUELTIG_MELDUNG };
  }
  const participantId = room.seats[role]?.participantId;
  room.state.roomParticipants = room.state.roomParticipants.map((participant) =>
    participant.participantId === participantId
      ? { ...participant, readyState: ready ? "ready" : "not_ready", lastSeenAt: new Date().toISOString() }
      : participant,
  );
  room.state = appendRoomEvent(room.state, "team_ready_changed", { participantId, ready });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function startRoom(
  roomCode: string,
  seatToken: string,
  options?: { persistence?: PersistenceService },
) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const role = findSeatByToken(room, seatToken);
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf den Room starten." };
  }
  if (!room.state.turnState.canAdvance) {
    return { ok: false as const, error: "Nicht alle erforderlichen Teilnehmer sind bereit." };
  }

  // Create + bind the co-op savegame BEFORE the status/step transition. Idempotency guard: only
  // do this on the lobby -> season_active edge, so a repeated startRoom click can never mint a
  // second save. Server-authoritative: the split is read from server-owned teamOwnership, never
  // from a client-supplied saveId.
  if (room.state.multiplayerRoom.status === "lobby") {
    const persistence = options?.persistence ?? createPersistenceService();
    const host =
      room.state.roomParticipants.find((participant) => participant.role === "host") ??
      room.state.roomParticipants[0] ??
      null;
    const franky = resolveFrankyParticipant(room.state.roomParticipants);
    const chrisTeamIds = host
      ? room.state.teamOwnership
          .filter((entry) => entry.controllerType === "human" && entry.participantId === host.participantId)
          .map((entry) => entry.teamId)
      : [];
    const frankyTeamIds = franky
      ? room.state.teamOwnership
          .filter((entry) => entry.controllerType === "human" && entry.participantId === franky.participantId)
          .map((entry) => entry.teamId)
      : [];

    if (chrisTeamIds.length === 0) {
      return { ok: false as const, error: "Weise zuerst dir mindestens ein Team zu." };
    }

    const currentSaveId = room.state.multiplayerRoom.saveId;
    const existingSave = isSandboxRoomSave(currentSaveId) ? null : persistence.getSaveById(currentSaveId);

    let boundSaveId: string;
    if (existingSave) {
      // Continue existing: reuse the real save, re-applying the current lobby split so team
      // changes made in the lobby take effect without minting a fresh save.
      const updatedGameState = applyGameModeOwnership(existingSave.gameState, {
        saveMode: "online_4v4",
        chrisTeamIds,
        frankyTeamIds,
      });
      persistence.saveSingleplayerState(existingSave.saveId, updatedGameState);
      boundSaveId = existingSave.saveId;
    } else {
      boundSaveId = createRoomCoopSave(
        {
          chrisTeamIds,
          frankyTeamIds,
          roomCode: room.roomCode,
          // F3 (Notausfahrt-Korrektur, Chris: "franky darf den auch nicht löschen"): stempelt
          // `created_by` mit der Host-Identitaet (Sitzung, wenn Login aktiv ist, sonst derselbe
          // zufaellige, NICHT erratbare Platzhalter, den `multiplayerRoom.hostUserId` traegt --
          // siehe `createRoom` oben). `created_by` wird beim Anlegen EINMALIG festgeschrieben und
          // nie wieder veraendert (save-repository.ts) -- genau die Groesse, die
          // app/api/singleplayer-state/route.ts beim Loeschen gegen den Anrufer prueft.
          hostOwnerId: host?.userId ?? null,
        },
        persistence,
      ).saveId;
      // Genau wie ein frischer Solo-Save (fresh-season-1) und die "Neues Spiel"-Wizard-Route
      // startet ein frisch angelegter Koop-Save alle 32 Teams mit LEEREN Kadern — ohne diesen Lauf
      // ist im Room kein Spieltag aufloesbar (siehe league-setup-draft-service.ts Kopfkommentar).
      // Detached (kein `await`): `startRoom` ist synchron und darf den Room-Start nicht ~40s
      // blockieren. `excludeTeamIds` schliesst BEIDE menschlichen Teamsaetze aus (Host + ggf.
      // Gast) — sie draften ihren Grundkader wie im Solo-"Neues Spiel"-Assistenten NICHT
      // automatisch mit, sondern bekommen (aktuell) einen leeren Kader zum manuellen Aufbau. Das
      // ist eine bewusste Fortsetzung des bestehenden new-game-Verhaltens, kein neuer Unterschied
      // zu Solo — siehe Bericht zur verbleibenden Luecke "Gast-Erstkader" im Abschlussbericht der
      // Aufgabe.
      kickoffLeagueSetupDraft({
        persistence,
        saveId: boundSaveId,
        excludeTeamIds: [...chrisTeamIds, ...frankyTeamIds],
        logPrefix: "[room-start]",
      });
    }

    // Register the live co-op save so rolling save retention (see save-retention.ts) never
    // sweeps it out from under the room — it is created "archived" on purpose (see
    // createRoomCoopSave) so getActiveSave() never returns it, which otherwise leaves it
    // unprotected against the rolling limit for its retention bucket.
    registerLiveRoomSaveId(room.roomCode, boundSaveId);

    room.state = {
      ...room.state,
      multiplayerRoom: {
        ...room.state.multiplayerRoom,
        saveId: boundSaveId,
        updatedAt: new Date().toISOString(),
      },
    };
    room.state = appendRoomEvent(room.state, "save_updated", {
      source: existingSave ? "start_room_continue_existing" : "start_room_fresh_coop_save",
      saveId: boundSaveId,
    });
  }

  room.state = {
    ...room.state,
    multiplayerRoom: {
      ...room.state.multiplayerRoom,
      status: "season_active",
      updatedAt: new Date().toISOString(),
    },
    roomParticipants: room.state.roomParticipants.map((participant) => ({ ...participant, readyState: "not_ready" })),
    turnState: {
      ...room.state.turnState,
      currentStep: "training",
      readyParticipants: [],
      canAdvance: false,
    },
    roomFlowState: {
      ...room.state.roomFlowState,
      step: "training",
      completedParticipantIds: [],
      aiAutoCompletedTeamIds: [],
      canHostAdvance: false,
    },
  };
  room.state = appendRoomEvent(room.state, "flow_step_changed", { step: "training", source: "start_room" });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function runRoomAiAutoStep(roomCode: string, seatToken: string) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const role = findSeatByToken(room, seatToken);
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf AI-Teams vorbereiten." };
  }

  const aiTeamIds = room.state.teamOwnership.filter((entry) => entry.controllerType === "ai").map((entry) => entry.teamId);
  room.state = {
    ...room.state,
    roomFlowState: {
      ...room.state.roomFlowState,
      aiAutoCompletedTeamIds: aiTeamIds,
      warnings: [...room.state.roomFlowState.warnings.filter((warning) => warning !== "ai_auto_step_pending"), "source:sandbox_auto_ready"],
    },
  };
  room.state = appendRoomEvent(room.state, "save_updated", { source: "sandbox_ai_auto_step", aiTeamCount: aiTeamIds.length });
  syncPlayers(room);
  return { ok: true as const, room };
}

/**
 * Liest den gebundenen Spielstand, um den Room-Flow an der Realitaet auszurichten.
 *
 * Gibt `null` zurueck, wenn der Save nicht aufloesbar ist — der Aufrufer faellt dann auf das
 * lineare Verhalten zurueck, statt zu werfen. Ein nicht lesbarer Spielstand darf den Host
 * nicht daran hindern, den Flow ueberhaupt weiterzuschalten.
 */
function readRoomGameState(room: RuntimeRoom, persistence?: PersistenceService) {
  try {
    const service = persistence ?? createPersistenceService();
    return service.getSaveById(room.state.multiplayerRoom.saveId)?.gameState ?? null;
  } catch {
    return null;
  }
}

export function advanceRoomFlow(roomCode: string, seatToken: string, options?: { persistence?: PersistenceService }) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const role = findSeatByToken(room, seatToken);
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf den Room-Flow fortsetzen." };
  }
  if (!room.state.roomFlowState.canHostAdvance) {
    return { ok: false as const, error: "Room-Flow ist noch blockiert: Human- oder AI-Schritte sind offen." };
  }

  // Der Spieltag-Zyklus: nach dem Saisonstand geht es zurueck zur Einsatzliste, solange die
  // Saison noch einen Spieltag hergibt. Ohne das endete die Kette nach EINEM Spieltag im
  // Season Review und der Raum war eine Sackgasse — eine gemeinsame Saison war schlicht
  // nicht spielbar. Die Entscheidung kommt aus dem Spielstand, nicht aus einem Room-Zaehler.
  const gameState = readRoomGameState(room, options?.persistence);
  const seasonContinues = gameState ? roomFlowSeasonContinues(gameState) : null;

  /**
   * Der Saisonwechsel-Zyklus (E2, docs/MULTIPLAYER_SAISONWECHSEL_PLAN.md): "hat die neue Saison
   * begonnen" wird GELESEN, nicht gezaehlt -- genau wie `seasonContinues` oben.
   *
   * GELESEN WIRD AUSSCHLIESSLICH DER SPIELSTAND, nicht der Raum. Der erste Anlauf verglich die
   * Saison-ID des Spielstands gegen die, die der Raum noch kennt
   * (`multiplayerRoom.activeSeasonId`) -- und das war ein Selbstschuss, nachgemessen an einem
   * ganz normalen Ablauf: der Host schliesst den Saisonwechsel im Cockpit ab, BEVOR er das
   * Season Review wegklickt (nichts haelt ihn davon ab, der Assistent ist unabhaengig vom Raum).
   * Der Klick `season_review -> season_transition` zieht `activeSeasonId` unten mit -- ab da sind
   * beide IDs gleich, "hat gewechselt" ist fuer immer falsch, und der Raum steht dauerhaft auf
   * `season_transition`. Also dieselbe Sackgasse, nur eine Station weiter.
   *
   * `isSeasonEndPhase` (lib/season/season-transition-chain.ts) beantwortet die Frage ohne jedes
   * Raum-Gedaechtnis und ist DIESELBE Quelle wie die Kette selbst: die Menge wird aus
   * `SEASON_TRANSITION_STEPS` abgeleitet, nicht danebengeschrieben. Nachgemessen ueber alle zehn
   * Phasen: nur `season_active` ist keine Saisonende-Phase -- und die setzt genau eine Stelle,
   * naemlich der bestaetigte Pre-Season-Workflow (`preseason-workflow-service.ts:713-723`,
   * zusammen mit `season.id = nextSeasonId` und `currentMatchday: 1`).
   *
   * Verworfen wurde `roomFlowSeasonContinues` als Ersatz: `lineup_setup` ist eine STATION der
   * Saisonende-Kette (`season-transition-chain.ts`), in der `resolve_matchday` bereits erlaubt
   * ist -- der Raum waere mitten im Assistenten losgesprungen.
   */
  const seasonHasAdvanced = gameState ? !isSeasonEndPhase(gameState.gamePhase) : null;
  const nextStep = getNextRoomFlowStepId(room.state.roomFlowState.step, {
    ...(seasonContinues == null ? {} : { seasonContinues }),
    ...(seasonHasAdvanced == null ? {} : { seasonHasAdvanced }),
  });

  /**
   * BEI 0 WIRD ERKLAERT, NICHT VERSTECKT: bewegt sich der Schritt nicht, ist das Weiterschalten
   * nicht nur wirkungslos, sondern SCHAEDLICH -- der Rumpf unten setzt jeden Teilnehmer auf
   * `not_ready` zurueck. Ohne diesen Riegel raeumt ein Klick am Saisonwechsel-Gate beiden Coaches
   * die Bereitmeldung weg und laesst sonst alles, wie es war: es sieht aus wie ein Aussetzer.
   *
   * Der Riegel steht allgemein und nicht nur fuer `season_transition`: ein Vorschub auf denselben
   * Schritt hat nirgends einen Zweck, und jede kuenftige Selbstschleife saehe sonst genauso aus.
   * Der Grund wird dabei benannt, statt nur "geht nicht" zu sagen — die Meldung landet als
   * `roomError` beim Host und laesst dank `istRoomSitzungsFehler` (Befund F6) die Bedienleiste
   * stehen.
   */
  if (nextStep === room.state.roomFlowState.step) {
    return {
      ok: false as const,
      error:
        nextStep === "season_transition"
          ? "Die neue Saison hat noch nicht begonnen. Schließe den Saisonwechsel im Cockpit ab — danach geht es hier weiter."
          : "Der Room-Flow steht bereits auf diesem Schritt.",
    };
  }

  // `activeMatchday` stand seit der Raumerstellung fest auf 1 und wurde nie nachgezogen. Mit
  // dem Zyklus ist das nicht mehr nur kosmetisch: `syncRoomArenaParticipants` benutzt den Wert
  // als Rueckfall-`matchdayId` fuer den Arena-Sync, und der Room-Chip zeigt ihn an.
  const activeMatchday = gameState?.season.currentMatchday ?? room.state.multiplayerRoom.activeMatchday;
  const activeSeasonId = gameState?.season.id ?? room.state.multiplayerRoom.activeSeasonId;

  room.state = {
    ...room.state,
    multiplayerRoom: {
      ...room.state.multiplayerRoom,
      activeMatchday,
      activeSeasonId,
    },
    roomParticipants: room.state.roomParticipants.map((participant) => ({ ...participant, readyState: "not_ready" })),
    turnState: {
      ...room.state.turnState,
      currentStep: nextStep,
      readyParticipants: [],
      canAdvance: false,
    },
    roomFlowState: {
      ...room.state.roomFlowState,
      step: nextStep,
      completedParticipantIds: [],
      aiAutoCompletedTeamIds: [],
      canHostAdvance: false,
      seasonContinues,
      warnings: [],
    },
  };
  room.state = appendRoomEvent(room.state, "flow_step_changed", {
    step: nextStep,
    source: "advance_room_flow",
    activeMatchday,
  });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function canSeatControlTeam(roomCode: string, seatToken: string, teamId: string) {
  const room = getRoom(roomCode);
  if (!room) {
    return false;
  }
  const role = findSeatByToken(room, seatToken);
  const participantId = role ? room.seats[role]?.participantId : null;
  return participantId ? canParticipantControlTeam(room.state, participantId, teamId) : false;
}

/**
 * Beendet einen Raum endgueltig (Stufe 0.4, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): bislang gab es
 * kein `leaveRoom`, kein `closeRoom`, kein `delete` — die Map wuchs bis zum Prozessende, und
 * `status: "completed"` wurde nirgends gesetzt. Nur der Host darf schliessen, wie bei allen
 * anderen raumweiten Aktionen hier.
 *
 * KORREKTUR (16.08.2026, F1): diese Funktion bleibt bewusst OHNE Socket-Ereignis/Knopf im
 * Client -- Chris hat den urspruenglichen Plan ("ein Raum-Ende macht den Save wieder solo
 * spielbar") ausdruecklich verworfen ("darf auch nicht solo weiter spielen"). Ein "Raum
 * beenden"-Knopf haette genau das suggeriert, denn ihr Ausgang war und ist: der Save verlaesst
 * die aktive Menge -- und `assertSaveNotRoomBound` (lib/room/assert-save-not-room-bound.ts, ausser-
 * halb dieses Auftrags) faellt danach auf den Solo-Pfad zurueck. Die tatsaechliche Notausfahrt aus
 * einem VERWAISTEN Raum ist deshalb `createRoom(saveId)` oben (Fall 1/2: Sitz zurueckholen bzw.
 * verwaisten Raum ATOMAR ersetzen) -- die laesst den Save lueckenlos gebunden. `closeRoom` bleibt
 * als eigenstaendige, weiterhin nur aus Tests aufgerufene Funktion stehen (unveraendertes
 * Verhalten seit Stufe 0.4); sie wird intern NICHT mehr fuer die Notausfahrt benutzt (das erledigt
 * `removeRoomFromActiveSet` direkt).
 *
 * Setzt `multiplayerRoom.status` auf "completed" (damit ein letzter Broadcast durch den Aufrufer
 * den Abschluss noch zeigen kann), nimmt den Raum dann aber SOFORT aus der aktiven Menge, aus der
 * Ablage UND aus der Save-Schutz-Registry (`removeRoomFromActiveSet`) — bewusst OHNE
 * `syncPlayers()` (das wuerde den Raum ueber `persistRuntimeRoom` sofort wieder zurueckschreiben).
 * Der Raumcode ist danach frei: `createRoom()`s Eindeutigkeits-Schleife oben findet ihn nicht mehr
 * in `runtimeRooms`.
 */
export function closeRoom(roomCode: string, seatToken: string) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: RAUM_EXISTIERT_NICHT_MEHR_MELDUNG };
  }
  const role = findSeatByToken(room, seatToken);
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf den Raum beenden." };
  }

  room.state = {
    ...room.state,
    multiplayerRoom: {
      ...room.state.multiplayerRoom,
      status: "completed",
      updatedAt: new Date().toISOString(),
    },
  };
  room.state = appendRoomEvent(room.state, "room_state_updated", { source: "room_closed" });

  // BEFUND F17 (Notausfahrt-Audit): `getRoom()` normalisiert den Code (trim/toUpperCase), aber
  // vorher stand hier `runtimeRooms.delete(roomCode)`/`deletePersistedRoom(roomCode)` mit dem
  // ROHEN, unnormalisierten Parameter. Mit z. B. kleingeschriebenem Code fand die Suche oben den
  // Raum (normalisiert), aber das Loeschen traf einen Map-Key/eine Zeile, die es so nie gab —
  // `ok: true`, geloescht wurde nichts. `removeRoomFromActiveSet` nimmt bewusst das ROOM-OBJEKT
  // (dessen `.roomCode` der kanonische, bei der Anlage per `createRoomCode()` erzeugte und seitdem
  // nie mutierte Wert ist), nicht den String-Parameter — dieser Fehler kann so nicht wieder
  // auftreten, an keiner Aufrufstelle dieser Funktion.
  removeRoomFromActiveSet(room);

  return { ok: true as const, room };
}

/**
 * Laedt alle noch gueltigen Raeume aus der Ablage in die Prozess-Map — aufgerufen von `server.ts`
 * VOR `ensureSocketServer(httpServer)`, damit ein `rejoinRoom` unmittelbar nach dem Neustart schon
 * funktioniert, bevor der erste Client verbindet. `alreadyPresent` zaehlt Raeume, die (z. B. bei
 * einem Hot-Reload im Dev-Betrieb) schon im Speicher liegen — die werden nie ueberschrieben, ein
 * bereits laufender Raum im Speicher ist immer aktueller als sein zuletzt persistierter Stand.
 */
export function rehydrateRuntimeRoomsFromPersistence(): { restored: number; alreadyPresent: number } {
  const persistedRooms = loadPersistedRuntimeRooms();
  let restored = 0;
  let alreadyPresent = 0;
  for (const room of persistedRooms) {
    if (runtimeRooms.has(room.roomCode)) {
      alreadyPresent += 1;
      continue;
    }
    // BEFUND F8 (Aufgabe #45): eine Enthuellung, die der Neustart mitten im Lauf erwischt hat,
    // bringt ihre Zeitbasis (`stepStartedAt`/`updatedAt`) als minutenalte Zeitstempel zurueck — die
    // Etappe behauptet damit eine Vergangenheit, die kein Client miterlebt hat. Die Entscheidung,
    // was daraus wird, steht vollstaendig in `resumeRoomArenaAfterRestart` (arena-sync-state.ts,
    // dort auch die Messwerte); hier steht nur der Aufruf.
    //
    // Bewusst OHNE `syncPlayers(room)`: `server.ts` rehydriert VOR `ensureSocketServer`, es gibt
    // also noch niemanden zu benachrichtigen, und das Speichern erledigt die naechste echte
    // Raum-Aktion. Ein zweiter Neustart davor faende denselben Zustand vor und entschiede identisch.
    room.state = {
      ...room.state,
      arenaSyncState: resumeRoomArenaAfterRestart({ arenaState: room.state.arenaSyncState }),
    };
    runtimeRooms.set(room.roomCode, room);
    restored += 1;
    // BEFUND F5 (Notausfahrt-Audit): `registerLiveRoomSaveId` wird sonst NUR beim
    // Lobby->season_active-Uebergang in `startRoom` gerufen (einmalig, siehe Kommentar dort) --
    // ein Prozess-Neustart leert `globalThis.__olyLiveRoomSaveIds` genauso wie die Room-Map, aber
    // `startRoom` laeuft fuer einen laengst gestarteten Raum nie wieder. Ohne diese Zeile war der
    // Koop-Save nach JEDEM Deploy ungeschuetzt gegen die rollierende Aufbewahrung
    // (save-retention.ts) -- "Raum lebt, Schutz weg". Nur fuer NEU restaurierte Raeume noetig: ein
    // Raum, der schon in der Prozess-Map lag (`alreadyPresent`, z. B. Dev-Hot-Reload), lief in
    // DIESEM Prozess bereits durch `startRoom`/`syncPlayers` und hat seine Registrierung nie
    // verloren.
    registerLiveRoomSaveId(room.roomCode, room.state.multiplayerRoom.saveId);
  }
  return { restored, alreadyPresent };
}

/**
 * TEST-ONLY: leert die Prozess-Map, um einen Neustart zu simulieren (die Ablage bleibt
 * unangetastet — genau das, was ein echter Prozess-Neustart mit `globalThis.__olyRuntimeRooms`
 * tut). Gleiches Schutzmuster wie `resetDatabaseForTests()` in `lib/persistence/sqlite.ts`.
 */
export function resetRuntimeRoomsForTests(): void {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    throw new Error("resetRuntimeRoomsForTests darf nur in Tests laufen.");
  }
  runtimeRooms.clear();
}

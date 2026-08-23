import {
  advanceFoundationArenaReveal,
  getFoundationArenaActiveSide,
  getFoundationArenaDisplayPhase,
  mapFoundationPhaseToRoomDisciplineSide,
  mapRoomDisciplineSideToFoundationPhase,
  FOUNDATION_ARENA_REVEAL_LIMITS,
  type FoundationArenaRevealState,
} from "@/lib/foundation/matchday-arena-reveal-sync";
import { ARENA_STEP_DURATION_MS } from "@/lib/foundation/discipline-stage/arena-timeline";
import type { OlyRoomState, RoomArenaDisciplineSide, RoomArenaPhaseId, RoomArenaState } from "@/types/game";

export const ROOM_ARENA_PHASES: RoomArenaPhaseId[] = [
  "slots",
  "push",
  "form",
  "mutator",
  "captain",
  "final",
  "result",
];

/**
 * Wer ist "bereit-pflichtig" fuer das gemeinsame Reveal-Bereit-Tor?
 *
 * WER GETRENNT IST, FAELLT NICHT AUS DER PFLICHT. Entscheidung von Chris (18.08.): "host kann nur
 * weiter klicken in der arena wenn frankys teams auch alle ready sind."
 *
 * Hier stand vorher zusaetzlich `connectionStatus !== "offline"` — eine bewusste Entscheidung mit
 * umgekehrtem Vorzeichen (Audit-Punkt 5): ein Getrennter sollte das Tor nicht unbegrenzt
 * blockieren. Der Preis war, dass der Host an einem Mitspieler vorbeizog, der gerade rausgeflogen
 * war, ohne je bereit gewesen zu sein — dessen Teams gingen dann unfertig in die Enthuellung.
 *
 * WAS SICH DADURCH NICHT AENDERT: `markDisconnected` (room-store.ts) setzt nur `connectionStatus`,
 * NICHT `readyState`/`readyParticipantIds`. Wer bereit war und dann rausfliegt, BLEIBT bereit und
 * haelt niemanden auf. Nur die Lage "nicht bereit UND offline" blockiert jetzt — und genau die war
 * gemeint.
 *
 * DER RAUM KANN TROTZDEM NICHT EINFRIEREN: `advanceRoomArenaStep` nimmt `getrennteUeberspringen`
 * und prueft serverseitig, dass wirklich JEDER Blockierende offline und nicht bereit ist. Einen
 * ANWESENDEN Mitspieler kann der Host damit nicht uebergehen — das ist der Kern der Regel.
 */
export function getRoomArenaRequiredParticipantIds(state: Pick<OlyRoomState, "roomParticipants" | "teamOwnership">) {
  return state.roomParticipants
    .filter((participant) => participant.role !== "spectator" && participant.controlledTeamIds.length > 0)
    .map((participant) => participant.participantId);
}

/**
 * Wer haelt das Bereit-Tor auf, OHNE noch da zu sein?
 *
 * Genau diese Menge — bereit-pflichtig, nicht bereit, offline — darf der Notausgang uebergehen,
 * und keine andere. Sie wird an zwei Stellen gebraucht: der Server prueft mit ihr, ob er den
 * Notausgang ueberhaupt oeffnen darf, und die Oberflaeche schreibt die Namen daraus in den Knopf.
 * Eine gemeinsame Quelle, damit der Knopf nie etwas anderes verspricht als der Server zulaesst.
 */
export function getRoomArenaOfflineBlockerIds(
  state: Pick<OlyRoomState, "roomParticipants">,
  arenaState: Pick<RoomArenaState, "requiredParticipantIds" | "readyParticipantIds">,
): string[] {
  const bereit = new Set(arenaState.readyParticipantIds);
  const offline = new Set(
    state.roomParticipants
      .filter((participant) => participant.connectionStatus === "offline")
      .map((participant) => participant.participantId),
  );
  return arenaState.requiredParticipantIds.filter(
    (participantId) => !bereit.has(participantId) && offline.has(participantId),
  );
}

function defaultMaxSlotRevealCounts(maxSlotRevealIndex = 0) {
  const normalized = Math.max(0, maxSlotRevealIndex);
  return { d1: normalized, d2: normalized } as const;
}

/**
 * WIE HEISST DER SPIELTAG DIESES RAUMS — eine Quelle, drei ehemalige Schreibweisen.
 *
 * `matchesArenaScope` vergleicht `matchdayId` als exakte Zeichenkette, und der einzige Vergleichs-
 * partner, der im Browser wirklich anliegt, ist `gameState.matchdayState.matchdayId` — Format
 * "matchday-1" (lib/data/dataAdapter.ts). `startRoomArena` weiss das und schreibt es so; zwei
 * andere Stellen bauten daneben die NACKTE Nummer:
 *
 *   arenaSyncState.matchdayId       = "matchday-1"
 *   String(activeMatchday)          = "1"
 *   matchesArenaScope(...)          = false
 *
 * Nachgemessen an einem frisch gestarteten Raum. Fuer `isRoomMatchdayInProgress`
 * (online-room-model.ts) hiess das: die Haelfte der Sperre, die eine LAUFENDE Enthuellung erkennen
 * soll, konnte nie zutreffen — sie verglich immer "matchday-1" gegen "1". Steht der Flow-Schritt
 * dabei ausserhalb der Spieltags-Menge, meldete der Raum "kein Spieltag laeuft" und gab die
 * Team-Umverteilung frei, waehrend die Arena lief.
 *
 * Ein `String(...)` an der Aufrufstelle sieht dabei nicht falsch aus — genau deshalb steht das
 * Format jetzt an EINER Stelle und nicht dreimal nebeneinander.
 */
/**
 * IST DIESE DISZIPLINSEITE DURCH? Ein Kriterium, zwei Aufrufer.
 *
 * Gebraucht an zwei Stellen, die sonst getrennt raten wuerden: `switchRoomArenaDisciplinePhase`
 * (gilt die VERLASSENE Seite als gewertet?) und `quickSimRoomArenaReveal` (gilt die gerade
 * ans Ende gespulte Seite als gewertet?). Beide meinen dasselbe, und ein Auseinanderdriften waere
 * ein Widerspruch im selben Zustand.
 *
 * `maxCount === 0` zaehlt bewusst NICHT als "durch": eine Seite ohne Etappen ist keine
 * abgeschlossene Enthuellung, sondern eine, ueber die noch nichts bekannt ist (die Zaehlgrenzen
 * kommen erst mit dem ersten echten Aufruf aus der Buehne, siehe `maxSlotRevealCountByDiscipline`).
 */
export function istDisziplinseiteDurch(input: {
  seite: RoomArenaDisciplineSide;
  revealedSlotCountByDiscipline: { d1: number; d2: number };
  limits: { maxD1SlotRevealCount: number; maxD2SlotRevealCount: number };
}): boolean {
  const grenze = input.seite === "d1" ? input.limits.maxD1SlotRevealCount : input.limits.maxD2SlotRevealCount;
  return grenze > 0 && input.revealedSlotCountByDiscipline[input.seite] >= grenze;
}

export function roomMatchdayScopeId(activeMatchday: number | string | null | undefined): string {
  const wert = typeof activeMatchday === "string" ? activeMatchday.trim() : activeMatchday;
  if (wert == null || wert === "") {
    return "matchday-1";
  }
  /**
   * NUR EINE NACKTE NUMMER WIRD UMGESCHRIEBEN — alles andere ist schon eine Kennung.
   *
   * Der erste Anlauf fragte `startsWith("matchday-")` und haengte sonst das Praefix an. Das ging
   * schief, weil es mehr als eine gueltige Kennungsform gibt: ein saisonqualifiziertes
   * `"season-2-matchday-1"` traegt das Praefix nicht am ANFANG und wurde damit zu
   * `"matchday-season-2-matchday-1"` verstuemmelt (gefunden von `tests/room-store.test.ts`).
   *
   * Umzuschreiben ist ausschliesslich das, was diese Funktion ueberhaupt reparieren soll: die
   * nackte Spieltagsnummer aus `multiplayerRoom.activeMatchday`. Ein String, der irgendetwas
   * anderes enthaelt, ist eine fertige Kennung und wird durchgereicht.
   */
  const text = String(wert);
  return /^\d+$/.test(text) ? `matchday-${text}` : text;
}

export function normalizeRoomArenaState(state: RoomArenaState): RoomArenaState {
  const maxCounts = state.maxSlotRevealCountByDiscipline ?? defaultMaxSlotRevealCounts(state.maxSlotRevealIndex);
  const activeDisciplinePhase =
    state.activeDisciplinePhase ?? mapRoomDisciplineSideToFoundationPhase(state.disciplineSide);
  const activeSide = activeDisciplinePhase === "d2" ? "d2" : "d1";
  const revealedSlotCountByDiscipline = state.revealedSlotCountByDiscipline ?? {
    d1:
      activeDisciplinePhase === "d1" || activeDisciplinePhase === "total"
        ? Math.min(state.slotRevealIndex, maxCounts.d1)
        : maxCounts.d1,
    d2:
      activeDisciplinePhase === "d2" || activeDisciplinePhase === "total"
        ? Math.min(state.slotRevealIndex, maxCounts.d2)
        : 0,
  };
  const completedDisciplinePhases = state.completedDisciplinePhases ?? {
    d1: activeDisciplinePhase === "total" || (activeDisciplinePhase === "d2" && revealedSlotCountByDiscipline.d1 >= maxCounts.d1),
    d2: activeDisciplinePhase === "total",
  };

  return {
    ...state,
    activeDisciplinePhase,
    revealedSlotCountByDiscipline,
    completedDisciplinePhases,
    maxSlotRevealCountByDiscipline: maxCounts,
    phaseIndex: state.phaseIndex < 0 ? 0 : state.phaseIndex,
    phaseId: state.phaseId ?? getFoundationArenaDisplayPhase(state.phaseIndex < 0 ? 0 : state.phaseIndex),
    slotRevealIndex: revealedSlotCountByDiscipline[activeSide],
    maxSlotRevealIndex: Math.max(maxCounts.d1, maxCounts.d2),
    // Rueckfall fuer Alt-States vor Stufe 3.3 (kein `stepStartedAt`/`stepDurationMs` gespeichert):
    // `updatedAt` ist die naechstbeste bekannte Server-Zeit, `ARENA_STEP_DURATION_MS` der bereits
    // produktiv genutzte Wert (`TRACK_ROUND_MS`) — keine neu erfundene Zahl.
    stepStartedAt: state.stepStartedAt ?? state.updatedAt,
    stepDurationMs: state.stepDurationMs ?? ARENA_STEP_DURATION_MS,
    // ALT-ZUSTAENDE HEILEN HIER, nicht an jeder Lesestelle: ein Raum, der vor der
    // Vereinheitlichung angelegt (oder aus der Ablage rehydriert) wurde, traegt die nackte Nummer
    // ("1") statt "matchday-1" — und `matchesArenaScope` vergleicht exakt. Ohne diese Zeile bliebe
    // JEDER bestehende Raum bei der alten Schreibweise, und die Behebung wirkte nur fuer Raeume,
    // die es noch gar nicht gibt. `roomMatchdayScopeId` ist idempotent: eine bereits richtige
    // Kennung geht unveraendert durch.
    matchdayId: state.matchdayId ? roomMatchdayScopeId(state.matchdayId) : state.matchdayId,
    paused: state.paused ?? false,
    pausedBy: state.pausedBy ?? null,
  };
}

/**
 * Gehört dieser Sync-State zu der Arena, die gerade angezeigt wird?
 *
 * Der Arena-Sync-State eines Raums überlebt den Spieltagswechsel: `room-store.ts` setzt ihn beim
 * Anwenden eines Spieltags auf `result_applied` und NIE zurück auf `idle`, und sein `matchdayId`
 * zeigt weiter auf den alten Spieltag. Ohne diese Prüfung steuert dieser fremde, längst
 * abgeschlossene State ab dem zweiten Spieltag die Arena — der Host-Start-Guard sieht "nicht idle"
 * und sendet nie wieder `startRoomArena`, sodass der Guest dauerhaft ohne Reveal dasteht.
 *
 * Ein leeres `seasonId`/`matchdayId` im State gilt bewusst als "passt zu allem" (Alt-States vor
 * Einführung der Felder), ein abweichendes dagegen als Fremd-Scope.
 */
export function matchesArenaScope(
  arenaSync: Pick<RoomArenaState, "saveId" | "seasonId" | "matchdayId">,
  scope: { saveId: string | null | undefined; seasonId: string | null | undefined; matchdayId: string | null | undefined },
) {
  if (arenaSync.saveId !== scope.saveId) {
    return false;
  }
  if (arenaSync.seasonId && arenaSync.seasonId !== scope.seasonId) {
    return false;
  }
  if (arenaSync.matchdayId && arenaSync.matchdayId !== scope.matchdayId) {
    return false;
  }
  return true;
}

export function createRoomArenaState(input: {
  saveId: string;
  seasonId?: string | null;
  matchdayId?: string | null;
  requiredParticipantIds?: string[];
  now?: string;
}): RoomArenaState {
  const now = input.now ?? new Date().toISOString();
  return normalizeRoomArenaState({
    status: "idle",
    version: 0,
    saveId: input.saveId,
    seasonId: input.seasonId ?? null,
    matchdayId: input.matchdayId ?? null,
    disciplineSide: "d1",
    activeDisciplinePhase: "d1",
    phaseId: null,
    phaseIndex: 0,
    slotRevealIndex: 0,
    maxSlotRevealIndex: 0,
    revealedSlotCountByDiscipline: { d1: 0, d2: 0 },
    completedDisciplinePhases: { d1: false, d2: false },
    maxSlotRevealCountByDiscipline: { d1: 0, d2: 0 },
    stepIndex: 0,
    stepStartedAt: now,
    stepDurationMs: ARENA_STEP_DURATION_MS,
    paused: false,
    pausedBy: null,
    requiredParticipantIds: input.requiredParticipantIds ?? [],
    readyParticipantIds: [],
    autoReadyControllerTypes: ["ai", "passive"],
    resultStatus: "preview",
    lastActionByParticipantId: null,
    updatedAt: now,
    callout: null,
  });
}

export function syncRoomArenaParticipants(state: OlyRoomState): RoomArenaState {
  const requiredParticipantIds = getRoomArenaRequiredParticipantIds(state);
  const requiredSet = new Set(requiredParticipantIds);
  return normalizeRoomArenaState({
    ...(state.arenaSyncState ?? createRoomArenaState({ saveId: state.multiplayerRoom.saveId })),
    saveId: state.multiplayerRoom.saveId,
    seasonId: state.arenaSyncState?.seasonId ?? state.multiplayerRoom.activeSeasonId,
    matchdayId: state.arenaSyncState?.matchdayId ?? roomMatchdayScopeId(state.multiplayerRoom.activeMatchday),
    requiredParticipantIds,
    readyParticipantIds: (state.arenaSyncState?.readyParticipantIds ?? []).filter((participantId) =>
      requiredSet.has(participantId),
    ),
  });
}

export function isRoomArenaReady(arenaState: RoomArenaState) {
  const readySet = new Set(arenaState.readyParticipantIds);
  return arenaState.requiredParticipantIds.every((participantId) => readySet.has(participantId));
}

export function setRoomArenaParticipantReady(input: {
  arenaState: RoomArenaState;
  participantId: string;
  ready: boolean;
  now?: string;
}) {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  const readySet = new Set(arenaState.readyParticipantIds);
  if (input.ready) {
    readySet.add(input.participantId);
  } else {
    readySet.delete(input.participantId);
  }
  const nextReadyIds = arenaState.requiredParticipantIds.filter((participantId) => readySet.has(participantId));
  const alleBereit = isRoomArenaReady({ ...arenaState, readyParticipantIds: nextReadyIds });

  /**
   * EIN BEREIT-KLICK DARF EINE LAUFENDE ENTHUELLUNG NICHT ANHALTEN.
   *
   * Hier stand `alleBereit ? "revealing" : "ready_check"` — ohne Ruecksicht darauf, ob das Tor
   * ueberhaupt noch das ist, worauf gewartet wird. Das ging schief, weil `advanceRoomArenaReveal`
   * bei JEDEM Etappenschritt `readyParticipantIds` leert (und dabei zu Recht auf "revealing"
   * bleibt): mitten im Lauf ist die Bereit-Menge also regulaer leer, und dieser Ausdruck las das
   * als "noch nicht alle bereit".
   *
   * NACHGEMESSEN, zwei Menschen, 4 Etappen:
   *
   *   beide bereit:             status=revealing   ready=2
   *   nach 1 Etappe:            status=revealing   ready=0
   *   Gast klickt "Bereit":     status=ready_check ready=1/2
   *     Warteliste:             ["Chris"]
   *     Host will weiter:       abgelehnt — "Die Arena wartet noch auf: Chris (anwesend, noch
   *                             nicht bereit)."
   *
   * Der Host wurde also aufgefordert, auf SICH SELBST zu warten, und die Enthuellung stand. Ein
   * versehentlicher Klick des Mitspielers reichte dafuer.
   *
   * DIE REGEL IST JETZT: das Tor kann nur AUFGEHEN, nie zufallen. Aus "ready_check" wird
   * "revealing", sobald alle bereit sind — jeder andere Status bleibt, wie er ist. Das Tor selbst
   * bleibt damit unveraendert wirksam; es haelt nur nicht mehr ein zweites Mal, nachdem es einmal
   * geoeffnet wurde.
   *
   * WER DAS TOR WIRKLICH NEU STELLEN WILL, tut das ueber `startRoomArena` (neuer Spieltag, Status
   * "ready_check") — die eine Stelle, die einen Anpfiff bedeutet.
   */
  const status = arenaState.status === "ready_check" && alleBereit ? "revealing" : arenaState.status;

  return {
    ...arenaState,
    status,
    readyParticipantIds: nextReadyIds,
    version: arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: input.now ?? new Date().toISOString(),
  } satisfies RoomArenaState;
}

export function startRoomArena(input: {
  state: OlyRoomState;
  participantId: string;
  seasonId?: string | null;
  matchdayId?: string | null;
  disciplineSide?: "d1" | "d2" | "overall" | null;
  maxSlotRevealIndex?: number | null;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const requiredParticipantIds = getRoomArenaRequiredParticipantIds(input.state);
  const maxCounts = input.maxSlotRevealCountByDiscipline ?? defaultMaxSlotRevealCounts(input.maxSlotRevealIndex ?? 0);

  return normalizeRoomArenaState({
    status: "ready_check",
    version: (input.state.arenaSyncState?.version ?? 0) + 1,
    saveId: input.state.multiplayerRoom.saveId,
    seasonId: input.seasonId ?? input.state.multiplayerRoom.activeSeasonId,
    // Format muss exakt `matchdayState.matchdayId` treffen ("matchday-1", siehe
    // lib/data/dataAdapter.ts), NICHT die nackte Spieltagsnummer - `matchesArenaScope()`
    // vergleicht beide Strings exakt. Ein Aufruf ohne explizites matchdayId (Fallback hier)
    // erzeugte bisher "1" statt "matchday-1": der Sync lief serverseitig korrekt, aber JEDER
    // echte Client (DisciplineStageArena.tsx scoped auf gameState.matchdayState.matchdayId)
    // verwarf ihn lautlos als "falscher Spieltag" - das Ready-Gate blieb unsichtbar, obwohl der
    // Reveal serverseitig laengst lief. Gefunden beim Reparieren von
    // scripts/smoke-multiplayer-e2e.ts (dem einzigen Aufrufer, der bisher ohne matchdayId rief).
    matchdayId: input.matchdayId ?? roomMatchdayScopeId(input.state.multiplayerRoom.activeMatchday),
    disciplineSide: input.disciplineSide ?? "d1",
    activeDisciplinePhase: mapRoomDisciplineSideToFoundationPhase(input.disciplineSide ?? "d1"),
    phaseId: "slots",
    phaseIndex: 0,
    slotRevealIndex: 0,
    maxSlotRevealIndex: Math.max(maxCounts.d1, maxCounts.d2),
    revealedSlotCountByDiscipline: { d1: 0, d2: 0 },
    completedDisciplinePhases: { d1: false, d2: false },
    maxSlotRevealCountByDiscipline: maxCounts,
    stepIndex: 0,
    // Start ist der Nullpunkt der gemeinsamen Zeitbasis (Stufe 3.3): ab hier zaehlen beide Seiten
    // dieselbe Server-Zeit als Schrittbeginn.
    stepStartedAt: now,
    stepDurationMs: ARENA_STEP_DURATION_MS,
    paused: false,
    pausedBy: null,
    requiredParticipantIds,
    readyParticipantIds: [],
    autoReadyControllerTypes: ["ai", "passive"],
    resultStatus: "preview",
    lastActionByParticipantId: input.participantId,
    updatedAt: now,
    callout: "arena_started",
  });
}

export function roomArenaStateToFoundationReveal(state: RoomArenaState): FoundationArenaRevealState {
  const normalized = normalizeRoomArenaState(state);
  return {
    activeDisciplinePhase: normalized.activeDisciplinePhase,
    phaseIndex: normalized.phaseIndex,
    revealedSlotCountByDiscipline: { ...normalized.revealedSlotCountByDiscipline },
    completedDisciplinePhases: { ...normalized.completedDisciplinePhases },
  };
}

export function advanceRoomArenaReveal(input: {
  arenaState: RoomArenaState;
  participantId: string;
  maxSlotRevealIndex?: number | null;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  now?: string;
}) {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  const maxCounts = input.maxSlotRevealCountByDiscipline ?? arenaState.maxSlotRevealCountByDiscipline;
  const limits = {
    maxD1SlotRevealCount: Math.max(0, maxCounts.d1),
    maxD2SlotRevealCount: Math.max(0, maxCounts.d2),
  };
  if (input.maxSlotRevealCountByDiscipline) {
    limits.maxD1SlotRevealCount = Math.max(0, input.maxSlotRevealCountByDiscipline.d1);
    limits.maxD2SlotRevealCount = Math.max(0, input.maxSlotRevealCountByDiscipline.d2);
  }

  const nextFoundationState = advanceFoundationArenaReveal(roomArenaStateToFoundationReveal(arenaState), limits);
  if (!nextFoundationState) {
    return arenaState;
  }

  const phaseId = getFoundationArenaDisplayPhase(nextFoundationState.phaseIndex);
  const activeSide = getFoundationArenaActiveSide(nextFoundationState);

  return normalizeRoomArenaState({
    ...arenaState,
    status:
      phaseId === "result" && nextFoundationState.activeDisciplinePhase === "total" ? "result" : "revealing",
    activeDisciplinePhase: nextFoundationState.activeDisciplinePhase,
    disciplineSide: mapFoundationPhaseToRoomDisciplineSide(nextFoundationState.activeDisciplinePhase),
    phaseIndex: nextFoundationState.phaseIndex,
    phaseId,
    slotRevealIndex: nextFoundationState.revealedSlotCountByDiscipline[activeSide],
    revealedSlotCountByDiscipline: nextFoundationState.revealedSlotCountByDiscipline,
    completedDisciplinePhases: nextFoundationState.completedDisciplinePhases,
    maxSlotRevealCountByDiscipline: {
      d1: limits.maxD1SlotRevealCount,
      d2: limits.maxD2SlotRevealCount,
    },
    maxSlotRevealIndex: Math.max(limits.maxD1SlotRevealCount, limits.maxD2SlotRevealCount),
    stepIndex: arenaState.stepIndex + 1,
    // Jedes Weiterschalten oeffnet einen NEUEN Schritt-Zeitraum (Stufe 3.3): der Zeitpunkt hier
    // ist der Nullpunkt, ab dem BEIDE Seiten "verstrichene Zeit" fuer diesen Schritt messen.
    stepStartedAt: input.now ?? new Date().toISOString(),
    stepDurationMs: arenaState.stepDurationMs,
    readyParticipantIds: phaseId === "result" ? arenaState.readyParticipantIds : [],
    version: arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: input.now ?? new Date().toISOString(),
    callout: null,
  });
}

export function applyFoundationRevealToRoomArenaState(
  arenaState: RoomArenaState,
  reveal: FoundationArenaRevealState,
  limits: { maxD1SlotRevealCount: number; maxD2SlotRevealCount: number },
): RoomArenaState {
  const phaseId = getFoundationArenaDisplayPhase(reveal.phaseIndex);
  const activeSide = getFoundationArenaActiveSide(reveal);

  return normalizeRoomArenaState({
    ...arenaState,
    activeDisciplinePhase: reveal.activeDisciplinePhase,
    disciplineSide: mapFoundationPhaseToRoomDisciplineSide(reveal.activeDisciplinePhase),
    phaseIndex: reveal.phaseIndex,
    phaseId,
    slotRevealIndex: reveal.revealedSlotCountByDiscipline[activeSide],
    revealedSlotCountByDiscipline: reveal.revealedSlotCountByDiscipline,
    completedDisciplinePhases: reveal.completedDisciplinePhases,
    maxSlotRevealCountByDiscipline: {
      d1: limits.maxD1SlotRevealCount,
      d2: limits.maxD2SlotRevealCount,
    },
    maxSlotRevealIndex: Math.max(limits.maxD1SlotRevealCount, limits.maxD2SlotRevealCount),
  });
}

/**
 * PAUSE/WEITER ALS RAUM-ZUSTAND (Stufe 3.6): bislang war das rein lokal (`pauseRef`/
 * `manualPauseRef` in `DisciplineStageNativeArena.tsx`) — der Gast bemerkte eine Host-Pause nur
 * indirekt daran, dass keine neuen Schritte mehr eintrafen, nie explizit als eigenen Zustand.
 * Diese Funktion macht "der Host hat pausiert" zu einem Feld, das der Gast direkt lesen kann
 * (`RoomArenaState.paused`), statt es aus dem Ausbleiben von Updates zu erschliessen.
 *
 * Kein Versions-Sprung bei unveraendertem Wert (z.B. doppeltes Event) — sonst wuerde jeder
 * No-op-Toggle einen Broadcast ohne inhaltliche Aenderung ausloesen.
 */
export function setRoomArenaPaused(input: {
  arenaState: RoomArenaState;
  participantId: string;
  paused: boolean;
  now?: string;
}): RoomArenaState {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  if (arenaState.paused === input.paused) {
    return arenaState;
  }
  const now = input.now ?? new Date().toISOString();
  return normalizeRoomArenaState({
    ...arenaState,
    paused: input.paused,
    pausedBy: input.paused ? input.participantId : null,
    version: arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: now,
  });
}

/**
 * "↻ NEU" ALS RAUM-AKTION (Stufe 3.6): der Reset-Knopf in `DisciplineStageNativeArena.tsx` wirkte
 * bisher nur auf die lokale Kaskade des Kliekenden — ein Gast, der die Etappe schon weiter
 * gesehen hatte, stand danach auf einer Etappe, die es fuer den Host nicht mehr gibt (Befund-Punkt
 * 4: "Kein Rueckwaerts").
 *
 * Setzt NUR die AKTIVE Seite zurueck (d1 ODER d2, je nachdem, welche Seite gerade laeuft) — genau
 * wie der lokale Reset in der Komponente nur die dort gerade gezeigte Disziplin zuruecksetzt, nicht
 * eine laengst gewertete andere Seite. `stepIndex` waechst dabei WEITER (monoton, Stufe 3.2) — ein
 * Reset ist selbst ein Schritt wie jeder andere, nur mit einem "rueckwaerts" zeigenden Ziel; die
 * Monotonie von `stepIndex` beschreibt Reihenfolge/Frische der Uebertragung (wie `version`), nicht
 * die Richtung der ANGEZEIGTEN Etappe.
 *
 * A3 (Befund, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): welche Seite ist "die aktive", wenn
 * `activeDisciplinePhase === "total"` (BEIDE Diszis fertig, Gesamtstand-Bildschirm)? Der alte Code
 * behandelte "total" wie "d1" (`=== "d2" ? "d2" : "d1"`) — loeschte also d1s Zaehler/Abschluss,
 * liess `activeDisciplinePhase` selbst aber unveraendert auf "total" stehen (die Spread-Kopie oben
 * ueberschreibt das Feld nicht). Ergebnis: ein WIDERSPRUECHLICHER Zustand (Phase sagt "beide fertig",
 * Zaehler sagen "d1 bei Etappe 0, nicht abgeschlossen") — der naechste Schritt liest die Zaehler und
 * spielt d1 erneut ab, obwohl die Phase das gar nicht ausweist.
 *
 * RICHTIG ist "d2", nicht "d1": die Phasenkette erreicht "total" AUSSCHLIESSLICH ueber d2
 * (`advanceFoundationArenaReveal`: d1 → d2 → total, nie d1 → total direkt). Die zu diesem Zeitpunkt
 * tatsaechlich SICHTBARE `DisciplineStageNativeArena`-Instanz (die den Reset-Knopf ueberhaupt erst
 * ausloesen kann) zeigt deshalb noch d2 — `DisciplineStageArena.tsx` wechselt die lokale
 * `disciplineId` bei "total" bewusst NICHT (siehe `onApplyRevealSync`: `targetDiscId` bleibt `null`
 * fuer "total"). Ein Reset waehrend "total" meint also "d2 nochmal", nicht "d1 nochmal" — und
 * `activeDisciplinePhase` wird jetzt explizit auf `side` zurueckgesetzt, statt aus der Spread-Kopie
 * auf "total" haengen zu bleiben, damit Phase und Zaehler wieder dieselbe Wahrheit erzaehlen.
 */
export function resetRoomArenaReveal(input: {
  arenaState: RoomArenaState;
  participantId: string;
  now?: string;
}): RoomArenaState {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  const now = input.now ?? new Date().toISOString();
  const side: RoomArenaDisciplineSide = arenaState.activeDisciplinePhase === "d1" ? "d1" : "d2";

  return normalizeRoomArenaState({
    ...arenaState,
    status: "revealing",
    activeDisciplinePhase: side,
    phaseId: "slots",
    phaseIndex: 0,
    revealedSlotCountByDiscipline: { ...arenaState.revealedSlotCountByDiscipline, [side]: 0 },
    completedDisciplinePhases: { ...arenaState.completedDisciplinePhases, [side]: false },
    slotRevealIndex: 0,
    stepIndex: arenaState.stepIndex + 1,
    stepStartedAt: now,
    stepDurationMs: ARENA_STEP_DURATION_MS,
    paused: false,
    pausedBy: null,
    version: arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: now,
    callout: null,
  });
}

/**
 * DER NEUSTART MITTEN IN DER ENTHUELLUNG (Befund F8, Aufgabe #45).
 *
 * NACHGEMESSEN, NICHT VERMUTET (die Zahlen stehen in `tests/arena-ueberlebt-den-neustart.test.ts`):
 *
 * 1. `arenaSyncState` UEBERLEBT den Neustart bereits vollstaendig — er liegt als Teil von
 *    `OlyRoomState` im `payload_json` der `rooms`-Zeile (room-persistence.ts). Nach
 *    `rehydrateRuntimeRoomsFromPersistence()` sind `status`, `stepIndex`, `slotRevealIndex`,
 *    `phaseIndex` und `version` bitgleich. Die Arena steht danach NICHT auf "idle". Der Verdacht
 *    aus F8 ("nur der Raum ueberlebt") ist damit widerlegt.
 *
 * 2. WAS TATSAECHLICH KAPUTT IST, IST DIE ZEITBASIS. `stepStartedAt` UND `updatedAt` kommen
 *    unveraendert aus der Ablage — nach einem Auto-Deploy also Minuten alt, und zwar BEIDE mit
 *    demselben Zeitstempel (gemessen: `stepStartedAt === updatedAt` nach dem Rehydrieren, weil
 *    `advanceRoomArenaReveal` beide gemeinsam setzt). Genau diese Gleichheit ist die Falle:
 *    `useArenaRoomSync` schaetzt den Uhren-Versatz aus `updatedAt` (`computeArenaClockOffsetMs`),
 *    also aus demselben alten Zeitstempel. Bei 4 Minuten Ausfall ergibt das einen Versatz von
 *    -240.000 ms — und dieser Fehler hebt die Veraltung von `stepStartedAt` EXAKT auf:
 *      - mit vergiftetem Anker: `isStepSettled: false` → `resolveArenaCatchUpMode` = "advance-one"
 *      - mit ehrlicher Uhr:     `isStepSettled: true`  → `resolveArenaCatchUpMode` = "jump"
 *    Der Gast spielt also eine volle 10-Sekunden-Kaskade fuer eine Etappe nach, die der Server
 *    laengst hinter sich hat — genau der Rueckfall, den Befund A1 (`arena-timeline.ts`) schon
 *    einmal geschlossen hatte.
 *
 * 3. Ein "Vollgas durch alle Etappen" gibt es dagegen NICHT: Etappen ruecken ausschliesslich vor,
 *    wenn der Host sie meldet (`advanceRoomArenaStep`), und dessen Takt ist eine lokale
 *    Timer-Kaskade im Browser — die kennt die Server-Uhr gar nicht und kann deshalb nicht
 *    "aufholen". Nachgemessen, damit die Entscheidung unten nicht auf einer Vermutung steht.
 *
 * ENTSCHEIDUNG: an der ERREICHTEN Etappe NEU ANSETZEN UND SICHTBAR ANHALTEN.
 *
 * - NEU ANSETZEN heisst: `stepStartedAt`/`updatedAt` auf den Neustart-Zeitpunkt. Damit hat die
 *   gemeinsame Uhr wieder EINEN gueltigen Nullpunkt, statt eines Zeitstempels, der eine
 *   Vergangenheit behauptet, die kein Client miterlebt hat.
 * - `stepIndex`, `phaseIndex`, `slotRevealIndex` und die Etappen-Zaehler bleiben UNANGETASTET —
 *   niemand springt vor oder zurueck, beide Seiten stehen weiter auf derselben Etappe. Insbesondere
 *   waechst `stepIndex` hier NICHT (anders als bei `advanceRoomArenaReveal`/`resetRoomArenaReveal`):
 *   ein Hochzaehlen wuerde beim Gast als "eine Etappe Rueckstand" ankommen und ihn eine Etappe zu
 *   weit tragen.
 * - ANHALTEN heisst `paused: true`. Der Grund ist nicht Vorsicht, sondern eine Messung: nach dem
 *   Rehydrieren steht KEIN Sitz auf `connected` (room-persistence.ts setzt `connected: false`,
 *   nachgemessen). Es ist also im Moment des Wiederanlaufs nachweislich niemand am Bildschirm.
 *   Weiterlaufen hiesse, Etappen an einem Coach vorbeizuspielen, dessen Browser noch neu verbindet.
 *   Der Host setzt bewusst fort (Leertaste) — dann stehen beide messbar auf derselben Etappe.
 *
 * `pausedBy` BLEIBT `null`, wenn der Neustart die Pause ausgeloest hat: "pausiert, aber von keinem
 * Menschen". Das ist keine erfundene Zusatzinformation, sondern genau die Bedeutung, die
 * `RoomArenaState.pausedBy` schon traegt ("wer zuletzt pausiert hat"). `resolveArenaEffectivePause`
 * (`arena-timeline.ts`) liest sie: eine Pause ohne Urheber bindet auch den HOST. Ohne diese Regel
 * risse der Neustart die Seiten erst richtig auseinander — der Host haette nach einem Reload die
 * Vorgabe `localPauseIntent: false` und liefe weiter, waehrend der Gast dem Raum-Feld folgt und
 * einfriert (nachgemessen: Host `false`, Gast `true` aus DEMSELBEN Raum-Zustand).
 *
 * GEGENPROBE (der Fall, der NICHT greifen darf): greift AUSSCHLIESSLICH bei `status === "revealing"`
 * — nur dort treibt die gemeinsame Uhr ueberhaupt etwas. Ein Raum in der Lobby ("idle"), einer im
 * Bereit-Tor ("ready_check", der haelt sich selbst an) und ein fertiger Spieltag ("result"/
 * "result_applied") kommen unveraendert durch, OHNE Versionssprung — sonst wuerde jeder Neustart
 * jedem ruhenden Raum eine Aenderung anhaengen, die es nicht gab.
 */
export function resumeRoomArenaAfterRestart(input: { arenaState: RoomArenaState; now?: string }): RoomArenaState {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  if (arenaState.status !== "revealing") {
    return arenaState;
  }
  const now = input.now ?? new Date().toISOString();

  return normalizeRoomArenaState({
    ...arenaState,
    stepStartedAt: now,
    paused: true,
    // War der Host VOR dem Neustart schon in einer eigenen Pause, bleibt sein Name darauf stehen —
    // seine Pause gilt weiter und hat weiter einen Urheber. Nur eine Pause, die erst der Neustart
    // erzeugt hat, ist urheberlos.
    pausedBy: arenaState.paused ? arenaState.pausedBy : null,
    version: arenaState.version + 1,
    updatedAt: now,
  });
}

/**
 * DER WECHSEL AUF DISZIPLIN 2 ALS RAUM-AKTION.
 *
 * NACHGEMESSEN, NICHT VERMUTET (die Zahlen stehen als Testfall in
 * `tests/diszi-wechsel-ist-eine-raum-aktion.test.ts`): der Host meldet ueber
 * `advanceRoomArenaStep` NUR seine Etappen-Schritte (`round` in
 * `DisciplineStageNativeArena.tsx`, der Effekt "Co-op HOST: meldet jeden eigenen Reveal-Schritt").
 * Sein Klick auf "Weiter zu Disziplin 2" war dagegen rein lokal (`setDisciplineId`) — der Server
 * erfuhr davon nichts.
 *
 * Was daraus folgte, mit d1=5/d2=5 Etappen durchgezaehlt:
 *
 *   d1-Klick 1..5  -> phase=d1  phaseId=slots     slot=1..5   (richtig)
 *   d2-Klick 1     -> phase=d1  phaseId=push      slot=5
 *   d2-Klick 2     -> phase=d1  phaseId=form      slot=5
 *   d2-Klick 3     -> phase=d1  phaseId=mutator   slot=5
 *   d2-Klick 4     -> phase=d1  phaseId=captain   slot=5
 *   d2-Klick 5     -> phase=d1  phaseId=power     slot=5
 *
 * Sobald d1 ausgeschoepft ist, schiebt `advanceFoundationArenaReveal` naemlich die PHASENKETTE
 * weiter (slots -> push -> form -> mutator -> captain -> power -> final), und erst der Schritt
 * DANACH kippt auf d2. Die Etappen, die der Host in Disziplin 2 enthuellt, werden also von der
 * Phasenkette der ALTEN Disziplin aufgefressen: `slotRevealIndex` bleibt bei 5 stehen,
 * `activeDisciplinePhase` bleibt "d1". Der Gast liest genau diese beiden Felder
 * (`onApplyRevealSync` in `DisciplineStageArena.tsx`) — er bleibt in Disziplin 1 auf dem Endstand
 * kleben und sieht von Disziplin 2 nichts. Bei kurzen Disziplinen (5 Etappen < 6 Phasenschritte)
 * ueberhaupt nichts, bei langen den Rest um genau die Phasenkettenlaenge versetzt.
 *
 * DIE BEHEBUNG IST NICHT, DIE PHASENKETTE ANZUFASSEN: die ist fuer eine phasenweise Enthuellung
 * gebaut, die die native Arena gar nicht spielt (sie enthuellt nur Etappen). Behoben wird die
 * fehlende MELDUNG — der Wechsel wird ein eigener Raum-Schritt, und danach steht die Phasenkette
 * beim Wechsel wieder auf 0, statt weitergeschoben zu werden.
 *
 * Die Feldabbildung selbst macht `applyFoundationRevealToRoomArenaState` — dieselbe Funktion, die
 * `advanceRoomArenaReveal` benutzt, damit es fuer "so sieht ein Reveal-Zustand im Raum aus" keine
 * zweite Stelle gibt. Sie hatte bis hierher keinen Produktionsaufrufer.
 *
 * WAS ABSICHTLICH NICHT PASSIERT: das Bereit-Tor wird NICHT neu scharfgestellt
 * (`readyParticipantIds` bleibt, wie es ist) — genau wie bei `resetRoomArenaReveal`. Ein
 * Disziplinwechsel ist eine Anzeige-Umschaltung des Hosts, kein neuer Anpfiff; ein zweites Tor
 * mitten im Spieltag hat niemand bestellt.
 */
export function switchRoomArenaDisciplinePhase(input: {
  arenaState: RoomArenaState;
  participantId: string;
  phase: RoomArenaDisciplineSide;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  now?: string;
}): RoomArenaState {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  const now = input.now ?? new Date().toISOString();
  const maxCounts = input.maxSlotRevealCountByDiscipline ?? arenaState.maxSlotRevealCountByDiscipline;
  const limits = {
    maxD1SlotRevealCount: Math.max(0, maxCounts.d1),
    maxD2SlotRevealCount: Math.max(0, maxCounts.d2),
  };
  const ziel = input.phase;
  const andere: RoomArenaDisciplineSide = ziel === "d1" ? "d2" : "d1";

  /**
   * Die verlassene Seite gilt als abgeschlossen, wenn ihre Etappen wirklich durch sind — nicht
   * allein deshalb, weil der Host wegschaltet. Sonst behauptete ein Wechsel mitten in Disziplin 1
   * ("ich schau mal kurz die andere an"), sie sei gewertet.
   */
  const andereFertig =
    arenaState.completedDisciplinePhases[andere] ||
    istDisziplinseiteDurch({
      seite: andere,
      revealedSlotCountByDiscipline: arenaState.revealedSlotCountByDiscipline,
      limits,
    });

  const zielReveal: FoundationArenaRevealState = {
    activeDisciplinePhase: ziel,
    // Die Zielseite faengt bei der Etappen-Phase an — genau da, wo die lokale Arena des Hosts nach
    // `setDisciplineId` steht (frisch aufgebaute Buehne, `round` = 0).
    phaseIndex: FOUNDATION_ARENA_REVEAL_LIMITS.slotsPhaseIndex,
    revealedSlotCountByDiscipline: {
      ...arenaState.revealedSlotCountByDiscipline,
      [ziel]: 0,
    },
    completedDisciplinePhases: {
      ...arenaState.completedDisciplinePhases,
      [ziel]: false,
      [andere]: andereFertig,
    },
  };

  return normalizeRoomArenaState({
    ...applyFoundationRevealToRoomArenaState(arenaState, zielReveal, limits),
    status: "revealing",
    // Ein Wechsel IST ein Schritt: `stepIndex` waechst monoton weiter (wie beim Reset, siehe dort),
    // und er oeffnet einen neuen Schritt-Zeitraum fuer die gemeinsame Zeitbasis.
    stepIndex: arenaState.stepIndex + 1,
    stepStartedAt: now,
    stepDurationMs: arenaState.stepDurationMs,
    paused: false,
    pausedBy: null,
    version: arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: now,
    callout: null,
  });
}

/**
 * QUICK-SIM ALS RAUM-AKTION (Stufe 3.6): der "⏩"-Knopf in `DisciplineStageNativeArena.tsx`
 * springt lokal sofort auf den Endstand DER GERADE GEZEIGTEN Disziplinseite — dieselbe Grenze gilt
 * hier: die Schleife haelt an, sobald `activeDisciplinePhase` die Seite verlaesst, auf der sie
 * begann (die naechste Seite/das Gesamtergebnis ist NICHT Teil dieses Quick-Sims, genau wie lokal).
 *
 * Iteriert ueber das bereits vorhandene `advanceRoomArenaReveal` (keine zweite Rechenstelle fuer
 * "wie geht ein Schritt weiter") statt den Zielzustand selbst zu konstruieren. Der Deckel gegen
 * Endlosschleifen ist keine erfundene Zahl, sondern die Summe der real vorhandenen Obergrenzen
 * (Etappen beider Seiten + Laenge der Phasenkette).
 */
export function quickSimRoomArenaReveal(input: {
  arenaState: RoomArenaState;
  participantId: string;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  now?: string;
}): RoomArenaState {
  const now = input.now ?? new Date().toISOString();
  let state = normalizeRoomArenaState(input.arenaState);
  const startSide = state.activeDisciplinePhase === "d2" ? "d2" : "d1";
  const maxCounts = input.maxSlotRevealCountByDiscipline ?? state.maxSlotRevealCountByDiscipline;
  const guardLimit = Math.max(1, maxCounts.d1) + Math.max(1, maxCounts.d2) + ROOM_ARENA_PHASES.length + 2;

  for (let i = 0; i < guardLimit; i += 1) {
    const next = advanceRoomArenaReveal({
      arenaState: state,
      participantId: input.participantId,
      maxSlotRevealCountByDiscipline: maxCounts,
      now,
    });
    if (next.version === state.version) {
      break; // kein Fortschritt mehr moeglich (Endzustand dieser Seite erreicht)
    }
    /**
     * DIE GRENZE WIRD GEPRUEFT, BEVOR DER SCHRITT UEBERNOMMEN WIRD.
     *
     * Die Pruefung stand vorher am SCHLEIFENANFANG — also erst, nachdem der Schritt, der die Seite
     * verlaesst, laengst in `state` stand. Der Quick-Sim endete damit genau EINEN Schritt zu weit.
     * Nachgemessen mit d1 = 3 Etappen, Start auf d1:
     *
     *   Ergebnis: phase=d2  phaseId=slots  slot=0   (d1 fertig, d2 bei Etappe 0)
     *
     * Der Host wollte "diese Disziplin ans Ende spulen" — der Raum meldete stattdessen den ANFANG
     * der naechsten. Der Gast folgt `activeDisciplinePhase` und wurde damit in Disziplin 2
     * gezogen, waehrend der Host noch den Endstand der ersten anschaut. Genau das, was der
     * Kommentar oben ausschliessen wollte ("die naechste Seite ist NICHT Teil dieses Quick-Sims").
     */
    if (next.activeDisciplinePhase !== startSide) {
      break;
    }
    state = next;
  }

  /**
   * DER "DIESE SEITE IST DURCH"-VERMERK WIRD HIER GESETZT, nicht mehr nebenbei mitgenommen.
   *
   * Vorher trug ihn ausgerechnet der Schritt, der die Seite VERLAESST (`advanceFoundationArenaReveal`
   * setzt `completedDisciplinePhases.d1` im selben Zug, in dem er auf d2 kippt). Solange der
   * Quick-Sim einen Schritt zu weit lief, fiel das nicht auf — jetzt, wo er an der Grenze haelt,
   * waere der Vermerk sonst verloren: alle Etappen enthuellt, und die Seite gilt trotzdem als offen.
   *
   * Dasselbe Kriterium wie beim Disziplinwechsel (`istDisziplinseiteDurch`), damit die beiden
   * Wege zu "diese Seite ist gewertet" nicht auseinanderlaufen koennen.
   */
  if (
    istDisziplinseiteDurch({
      seite: startSide,
      revealedSlotCountByDiscipline: state.revealedSlotCountByDiscipline,
      limits: { maxD1SlotRevealCount: maxCounts.d1, maxD2SlotRevealCount: maxCounts.d2 },
    }) &&
    !state.completedDisciplinePhases[startSide]
  ) {
    state = normalizeRoomArenaState({
      ...state,
      completedDisciplinePhases: { ...state.completedDisciplinePhases, [startSide]: true },
    });
  }
  return state;
}

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { TeamControlSettings } from "@/lib/data/olyDataTypes";
import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { buildTeamRelationshipMap, type TeamRelationshipState } from "@/lib/foundation/team-relationship";
import { getRoomArenaRequiredParticipantIds } from "@/lib/room/arena-sync-state";
import {
  advanceRoomArenaStep,
  createRoom,
  getRoom,
  joinRoom,
  markDisconnected,
  resetRuntimeRoomsForTests,
  setRoomArenaReadyState,
  startRoomArenaSync,
} from "@/lib/room/room-store";
import type { OlyRoomState, RoomParticipant } from "@/types/game";

/**
 * Zweites Audit: sechs KAPUTTE Punkte in der Arena-Optik im Mehrspieler, plus ein billiger
 * Gewinn (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md). GRUNDREGEL: jede Änderung hängt an `roomContext`
 * bzw. `roomSync`, die im Alleinspiel `null` sind — Solo bleibt bitgleich. Wo die Komponente
 * ohne jsdom (`vitest.config.ts`: `environment: "node"`) nicht direkt renderbar ist, hält diese
 * Suite einen begründeten Quellcode-Vertrag fest (Muster wie `arena-finish-matchday-navigation.
 * test.ts`), statt so zu tun, als gäbe es hier keine Prüfung.
 */

const REPO_ROOT = process.cwd();
const ARENA = readFileSync(join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageArena.tsx"), "utf8");
const NATIVE = readFileSync(
  join(REPO_ROOT, "app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx"),
  "utf8",
);
const HOOK = readFileSync(join(REPO_ROOT, "lib/room/use-arena-room-sync.ts"), "utf8");

function makeManualControlSettings(teamId: string, ownerId: string): TeamControlSettings {
  return {
    teamId,
    controlMode: "manual",
    ownerId,
    ownerSlot: ownerId === DEFAULT_ACTIVE_OWNER_ID ? "user" : ownerId,
    displayLabel: teamId,
    aiLineupPreviewEnabled: false,
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: false,
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: false,
    aiSellAutoApplyEnabled: false,
    notes: null,
    strategyLock: null,
  } as TeamControlSettings;
}

function makeAiControlSettings(teamId: string): TeamControlSettings {
  return {
    teamId,
    controlMode: "ai",
    ownerId: null,
    ownerSlot: null,
    displayLabel: null,
    aiLineupPreviewEnabled: true,
    aiLineupApplyEnabled: true,
    aiLineupAutoApplyEnabled: true,
    aiTransferPreviewEnabled: true,
    aiTransferAutoApplyEnabled: true,
    aiSellPreviewEnabled: true,
    aiSellAutoApplyEnabled: true,
    notes: null,
    strategyLock: null,
  } as TeamControlSettings;
}

function makeTeam(teamId: string) {
  return { teamId, shortCode: teamId, name: teamId } as TeamRelationshipState["teams"][number];
}

function makeParticipant(overrides: Partial<RoomParticipant>): RoomParticipant {
  return {
    participantId: "participant-x",
    userId: "user-x",
    displayName: "X",
    connectionStatus: "online",
    role: "player",
    controlledTeamIds: [],
    readyState: "idle",
    lastSeenAt: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("Arena-Optik im Mehrspieler — Punkt 1: Gast haengt auf 'Vor dem Anpfiff' fest", () => {
  const callback = ARENA.slice(
    ARENA.indexOf("onApplyRevealSync: (normalized: RoomArenaState) => {"),
    ARENA.indexOf("},\n  });"),
  );

  it("onApplyRevealSync schliesst die Vorspiel-Tafel, sobald ein Sync fuer diese Arena eintrifft", () => {
    expect(callback.length).toBeGreaterThan(0);
    expect(callback).toContain("setPreMatchdayDismissed(true)");
  });

  it("GEGENPROBE: ohne roomContext registriert der Hook gar keine Socket-Listener — der Callback wird SOLO nie aufgerufen", () => {
    const effect = HOOK.slice(HOOK.indexOf("useEffect(() => {\n    if (!roomContext) {"));
    const guard = effect.slice(0, effect.indexOf("const socket = getClientSocket();"));
    expect(guard).toContain("if (!roomContext) {");
    expect(guard).toContain("return undefined;");
    // Die Socket-Listener (einzige Aufrufstellen von `applyRoomArenaSync` -> `onApplyRevealSync`)
    // stehen ERST nach diesem fruehen Ausstieg — solo laeuft die Funktion also nie durch bis dahin.
    expect(effect.indexOf("if (!roomContext)")).toBeLessThan(effect.indexOf('socket.on("roomJoined"'));
    expect(effect.indexOf("if (!roomContext)")).toBeLessThan(effect.indexOf('socket.on("roomState"'));
  });

  it("preMatchdayDismissed existiert weiterhin als reiner Komponentenzustand (kein Speichern im Save)", () => {
    expect(ARENA).toContain("const [preMatchdayDismissed, setPreMatchdayDismissed] = useState(false);");
  });
});

describe("Arena-Optik im Mehrspieler — Punkt 2: 'Mein Team' kann Frankys Arena Chris' Team zeigen", () => {
  it("ownTeamId zieht im Room auf den tatsaechlichen Besitz um, wenn die lokale Auswahl fremd ist", () => {
    expect(ARENA).toContain("if (!roomContext?.ownerId) {");
    expect(ARENA).toContain("return Boolean(settings) && getTeamOwner(settings) === roomContext.ownerId;");
    // NICHT gegen `userId` -- das ist ohne Login ein zufaelliger user-<uuid>-String, der mit
    // keinem gespeicherten ownerId uebereinstimmt (siehe foundation-room-context-client.ts).
    expect(ARENA).not.toContain("getTeamOwner(settings) === roomContext.userId");
    expect(ARENA).toContain("const ownedTeam = (gameState?.teams ?? []).find((team) => belongsToSelf(team.teamId));");
    expect(ARENA).toContain("return ownedTeam?.teamId ?? localTeamId;");
  });

  it("SOLO (kein roomContext) bleibt beim rein lokalen Wert -- exakt wie vorher", () => {
    const block = ARENA.slice(ARENA.indexOf("const ownTeamId = useMemo(() => {"), ARENA.indexOf("const ownTeamId = useMemo(() => {") + 700);
    expect(block).toContain("const localTeamId = activeManagerTeamId ?? selectedTeamId ?? null;");
    expect(block).toContain("if (!roomContext?.ownerId) {\n      return localTeamId;\n    }");
  });

  it("gehört die eigene Auswahl bereits demselben Besitzer, bleibt sie stehen (kein unnoetiges Umziehen)", () => {
    expect(ARENA).toContain("if (belongsToSelf(localTeamId)) {\n      return localTeamId;\n    }");
  });

  it("buildTeamRelationshipMap (dieselbe Datengrundlage) beweist die Eigenschaft: Besitz entscheidet, nicht die lokale Auswahl", () => {
    // Reproduziert die Kern-Eigenschaft hinter Punkt 2 auf der reinen Datenebene: Franky
    // (FRANKY_OWNER_ID) besitzt Team B -- fragt die Arena mit Team B als aktivem Team, ist B
    // "mine", nicht Chris' Team A.
    const state: TeamRelationshipState = {
      teams: [makeTeam("A"), makeTeam("B")],
      teamControlSettings: {
        A: makeManualControlSettings("A", DEFAULT_ACTIVE_OWNER_ID),
        B: makeManualControlSettings("B", FRANKY_OWNER_ID),
      },
    };
    const map = buildTeamRelationshipMap(state, "B");
    expect(map.get("B")).toBe("mine");
    expect(map.get("A")).not.toBe("mine");
  });
});

describe("Arena-Optik im Mehrspieler — Punkt 3: der ▶-Knopf sieht beim Gast klickbar aus", () => {
  const primaryStepStart = NATIVE.indexOf("const roomBlocksControl = Boolean(roomSync?.active && !roomSync.canControl);");
  const primaryStepEnd = NATIVE.indexOf("</button>", primaryStepStart);
  const primaryStepBlock = NATIVE.slice(primaryStepStart, primaryStepEnd);

  it("dimmt sich wie die Nachbarknoepfe (Opazitaet + cursor:default), sobald der Raum die Kontrolle verweigert", () => {
    expect(primaryStepBlock.length).toBeGreaterThan(0);
    expect(primaryStepBlock).toContain('cursor: done || busy ? "default" : roomBlocksControl ? "default" : "pointer"');
    expect(primaryStepBlock).toContain("opacity: busy && !done ? 0.7 : roomBlocksControl ? 0.5 : 1");
  });

  it("beschriftet den Knopf bei fehlender Kontrolle sinngemaess 'Der Host steuert'", () => {
    expect(primaryStepBlock).toContain("roomBlocksControl");
    expect(primaryStepBlock).toContain('"▶ Der Host steuert"');
    // Nicht die verwandte, aber verschiedene coop-Gate-Meldung -- eigens beschriftet.
    expect(primaryStepBlock).toContain(": roomBlocksControl\n                    ? \"▶ Der Host steuert\"");
  });
});

describe("Arena-Optik im Mehrspieler — Punkt 4: Disziplin-Auswahl und Spieltags-Abschluss sind beim Gast offen", () => {
  it("die Disziplin-Auswahl ist gesperrt, solange der Raum die Kontrolle verweigert (Dev-Modus ausgenommen)", () => {
    const testIdIndex = ARENA.indexOf('data-testid="arena-discipline-select"');
    const select = ARENA.slice(testIdIndex - 400, testIdIndex + 400);
    expect(ARENA).toContain("if (arenaGuestLocked && !devMode) return;");
    expect(select).toContain("disabled={arenaGuestLocked && !devMode}");
  });

  it("'Weiter zu Disziplin 2' ist fuer den Gast deaktiviert", () => {
    const block = ARENA.slice(ARENA.indexOf("if (guideToSecondDiscipline) {"), ARENA.indexOf("Weiter zu Disziplin 2: {secondName} →"));
    expect(block).toContain("const locked = arenaGuestLocked;");
    expect(block).toContain("disabled={locked}");
    expect(block).toContain("if (locked) return;");
  });

  it("'Spieltag abschließen' ist fuer den Gast deaktiviert", () => {
    const block = ARENA.slice(ARENA.indexOf("const finishLocked = arenaGuestLocked;"), ARENA.indexOf("{advancing ? \"schaltet weiter…\" : \"Spieltag abschließen\"}"));
    expect(block).toContain("disabled={advancing || finishLocked}");
    expect(block).toContain("if (finishLocked) return;");
  });

  it("SOLO (kein roomContext) ist arenaGuestLocked immer false -- keine Sperre entsteht", () => {
    expect(ARENA).toContain("const arenaGuestLocked = Boolean(roomContext) && !roomArenaSync.canControlArenaReveal;");
  });
});

describe("Arena-Optik im Mehrspieler — Punkt 5, umgedreht: ein Getrennter faellt NICHT aus der Bereit-Pflicht", () => {
  /**
   * DIESER BLOCK STAND VORHER GENAU ANDERSHERUM — und er hatte recht, bis Chris entschieden hat.
   *
   * Audit-Punkt 5 hatte den Filter `connectionStatus !== "offline"` eingezogen, damit ein
   * getrennter Mitspieler das Bereit-Tor nicht unbegrenzt blockiert. Der Preis war, dass der Host
   * an jemandem vorbeizog, der gerade rausgeflogen war, ohne je bereit gewesen zu sein — dessen
   * Teams gingen unfertig in die Enthuellung.
   *
   * CHRIS am 18.08.: "host kann nur weiter klicken in der arena wenn frankys teams auch alle ready
   * sind." Damit ist die Abwaegung neu entschieden, und die Pruefungen drehen mit — samt dem
   * Grund, aus dem sie frueher anders lauteten. Der Notausgang unten haelt die Sorge der alten
   * Fassung am Leben: einfrieren kann der Raum trotzdem nicht.
   */
  it("ein GETRENNTER Teilnehmer bleibt bereit-pflichtig", () => {
    const state: Pick<OlyRoomState, "roomParticipants" | "teamOwnership"> = {
      roomParticipants: [
        makeParticipant({ participantId: "p-host", role: "host", controlledTeamIds: ["A"], connectionStatus: "online" }),
        makeParticipant({ participantId: "p-guest", role: "player", controlledTeamIds: ["B"], connectionStatus: "offline" }),
      ],
      teamOwnership: [],
    };
    const required = getRoomArenaRequiredParticipantIds(state);
    expect(required).toContain("p-host");
    expect(required, "genau das war die Entscheidung: offline entbindet nicht").toContain("p-guest");
  });

  it("GEGENPROBE: wer keine Teams fuehrt, ist weiterhin nicht bereit-pflichtig", () => {
    // Die Pflicht haengt am Teambesitz, nicht an der Anwesenheit — daran aendert sich nichts.
    const state: Pick<OlyRoomState, "roomParticipants" | "teamOwnership"> = {
      roomParticipants: [
        makeParticipant({ participantId: "p-host", role: "host", controlledTeamIds: ["A"], connectionStatus: "online" }),
        makeParticipant({ participantId: "p-zuschauer", role: "player", controlledTeamIds: [], connectionStatus: "online" }),
      ],
      teamOwnership: [],
    };
    expect(getRoomArenaRequiredParticipantIds(state)).not.toContain("p-zuschauer");
  });

  it("end-to-end: der Host bleibt blockiert, AUCH nachdem der Mitspieler rausgeflogen ist", () => {
    const saveId = "arena-optik-mp-disconnect";
    const hostSocket = `socket-${saveId}-a`;
    const guestSocket = `socket-${saveId}-b`;
    const created = createRoom(hostSocket, { displayName: "Chris", preset: "chris_4_franky_4_rest_ai", saveId });
    const joined = joinRoom(created.room.roomCode, guestSocket, { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const started = startRoomArenaSync(created.room.roomCode, created.seat.seatToken, {
      seasonId: "season-2",
      matchdayId: "season-2-matchday-1",
      disciplineSide: "d1",
      maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
    });
    expect(started.ok).toBe(true);

    // Nur der Host ist bereit — Franky drueckt nie auf "Bereit".
    expect(setRoomArenaReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);

    const blockiertMitFranky = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken, {
      maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
    });
    expect(blockiertMitFranky.ok).toBe(false);

    markDisconnected(guestSocket);
    const guestParticipantId = joined.seat.participantId;
    expect(
      getRoom(created.room.roomCode)?.state.arenaSyncState.requiredParticipantIds.includes(guestParticipantId),
      "der Getrennte bleibt in der Pflicht",
    ).toBe(true);

    const blockiertOhneFranky = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken, {
      maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
    });
    expect(blockiertOhneFranky.ok, "derselbe Aufruf wie vorher — und er geht weiterhin nicht durch").toBe(false);
    expect(getRoom(created.room.roomCode)?.state.arenaSyncState.slotRevealIndex).toBe(0);
    if (!blockiertOhneFranky.ok) {
      // Die Meldung muss den Weg nennen, sonst sucht der Host ihn nicht.
      expect(blockiertOhneFranky.error).toContain("Franky");
      expect(blockiertOhneFranky.error).toMatch(/offline und nicht bereit/);
      expect(blockiertOhneFranky.error).toMatch(/uebergehen/);
    }

    resetRuntimeRoomsForTests();
  });

  it("der Notausgang oeffnet sich fuer einen Getrennten — und NUR fuer ihn", () => {
    const saveId = "arena-optik-mp-notausgang";
    const hostSocket = `socket-${saveId}-a`;
    const guestSocket = `socket-${saveId}-b`;
    const created = createRoom(hostSocket, { displayName: "Chris", preset: "chris_4_franky_4_rest_ai", saveId });
    const joined = joinRoom(created.room.roomCode, guestSocket, { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(
      startRoomArenaSync(created.room.roomCode, created.seat.seatToken, {
        seasonId: "season-2",
        matchdayId: "season-2-matchday-1",
        disciplineSide: "d1",
        maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
      }).ok,
    ).toBe(true);
    expect(setRoomArenaReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);

    // SOLANGE FRANKY DA IST, hilft der Notausgang nicht — das ist der Kern der Regel. Ein Knopf,
    // der auch einen Anwesenden uebergeht, waere genau das Verhalten, das abgeschafft werden soll.
    const mitAnwesendem = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken, {
      maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
      getrennteUeberspringen: true,
    });
    expect(mitAnwesendem.ok, "ein anwesender Mitspieler ist nicht uebergehbar").toBe(false);
    if (!mitAnwesendem.ok) {
      expect(mitAnwesendem.error).toMatch(/anwesend, noch nicht bereit/);
    }

    markDisconnected(guestSocket);
    const mitGetrenntem = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken, {
      maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
      getrennteUeberspringen: true,
    });
    expect(mitGetrenntem.ok, "jetzt darf der Host ausdruecklich vorbei").toBe(true);
    if (mitGetrenntem.ok) {
      expect(mitGetrenntem.room.state.arenaSyncState.slotRevealIndex).toBe(1);
    }

    resetRuntimeRoomsForTests();
  });

  it("GEGENPROBE: wer bereit war und DANN rausfliegt, haelt niemanden auf", () => {
    // `markDisconnected` fasst die Bereitmeldung nicht an. Ohne diese Eigenschaft waere die neue
    // Regel unzumutbar: jeder Verbindungsabriss mitten in der Enthuellung wuerde die Show anhalten,
    // obwohl der Mitspieler laengst zugestimmt hat.
    const saveId = "arena-optik-mp-bereit-dann-weg";
    const hostSocket = `socket-${saveId}-a`;
    const guestSocket = `socket-${saveId}-b`;
    const created = createRoom(hostSocket, { displayName: "Chris", preset: "chris_4_franky_4_rest_ai", saveId });
    const joined = joinRoom(created.room.roomCode, guestSocket, { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(
      startRoomArenaSync(created.room.roomCode, created.seat.seatToken, {
        seasonId: "season-2",
        matchdayId: "season-2-matchday-1",
        disciplineSide: "d1",
        maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
      }).ok,
    ).toBe(true);
    expect(setRoomArenaReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setRoomArenaReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

    markDisconnected(guestSocket);

    const ohneNotausgang = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken, {
      maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
    });
    expect(ohneNotausgang.ok, "bereit bleibt bereit — kein Notausgang noetig").toBe(true);

    resetRuntimeRoomsForTests();
  });

  it("der Hinweis auf einen Getrennten wird bis in die Arena durchgereicht", () => {
    expect(ARENA).toContain("const disconnectedCoopNames = roomArenaSync.roomSyncParticipants");
    expect(ARENA).toContain('participant.connectionStatus === "offline"');
    expect(ARENA).toContain("disconnectedNames: disconnectedCoopNames,");
    expect(NATIVE).toContain("disconnectedNames?: string[];");
    expect(NATIVE).toContain("roomSync.disconnectedNames && roomSync.disconnectedNames.length > 0");
  });
});

describe("Arena-Optik im Mehrspieler — Punkt 6: der Pausen-Chip luegt den Gast an", () => {
  it("zeigt dem Gast NICHT 'Leertaste', weil seine Leertaste wirkungslos ist", () => {
    const chip = NATIVE.slice(NATIVE.indexOf("{paused ? (\n            <span"), NATIVE.indexOf("{paused ? (\n            <span") + 400);
    expect(chip).toContain('roomSync?.followsHost ? "⏸ Host hat pausiert" : "⏸ Pausiert · Leertaste"');
  });
});

describe("Arena-Optik im Mehrspieler — Punkt 7 (billiger Gewinn): der Mitspieler ist im 32er-Feld nicht erkennbar", () => {
  it("TeamRelationshipKind kennt jetzt 'human' -- niedrigste Praezedenz (rival/ally gewinnen)", () => {
    const state: TeamRelationshipState = {
      teams: [makeTeam("mine"), makeTeam("human"), makeTeam("rival-human"), makeTeam("ai")],
      teamControlSettings: {
        mine: makeManualControlSettings("mine", DEFAULT_ACTIVE_OWNER_ID),
        human: makeManualControlSettings("human", FRANKY_OWNER_ID),
        "rival-human": makeManualControlSettings("rival-human", FRANKY_OWNER_ID),
        ai: makeAiControlSettings("ai"),
      },
    };
    const map = buildTeamRelationshipMap(state, "mine");
    expect(map.get("mine")).toBe("mine");
    expect(map.get("human")).toBe("human");
    // KI-Team hat keinen menschlichen Controller -> weder human noch irgendeine Einstufung.
    expect(map.get("ai")).toBeUndefined();
  });

  it("Rivale/Verbuendet schlagen 'human' (niedrigste Praezedenz)", () => {
    // Ohne echtes Rivalitaets-Sheet ist hier nur die SCHREIBREIHENFOLGE zu pruefen: der
    // human-Durchlauf steht vor ally/rival, kann also von ihnen ueberschrieben werden.
    const source = readFileSync(join(REPO_ROOT, "lib/foundation/team-relationship.ts"), "utf8");
    const humanLoopIndex = source.indexOf('relationshipByTeamId.set(team.teamId, "human");');
    const allyLoopIndex = source.indexOf('relationshipByTeamId.set(teamId, "ally");');
    const rivalLoopIndex = source.indexOf('relationshipByTeamId.set(teamId, "rival");');
    const mineLoopIndex = source.indexOf('relationshipByTeamId.set(teamId, "mine");');
    expect(humanLoopIndex).toBeGreaterThan(-1);
    expect(humanLoopIndex).toBeLessThan(allyLoopIndex);
    expect(allyLoopIndex).toBeLessThan(rivalLoopIndex);
    expect(rivalLoopIndex).toBeLessThan(mineLoopIndex);
  });

  it("hat einen Glyph und eine eigene Farbe, statt wie KI unmarkiert zu bleiben", () => {
    expect(NATIVE).toContain('const REL_GLYPH: Record<TeamRelationshipKind, string> = { mine: "★", ally: "🤝", rival: "⚔", human: "👤" };');
    const globals = readFileSync(join(REPO_ROOT, "app/globals.css"), "utf8");
    expect(globals).toContain("--nl-human: var(--nl-soc);");
  });

  it("der Titel-Text sagt fuer 'human' nicht mehr faelschlich 'Dein Team'", () => {
    const titleStart = NATIVE.indexOf('title={\n                      t.rel === "ally"');
    const titleBlock = NATIVE.slice(titleStart, NATIVE.indexOf("</span>", titleStart));
    expect(titleBlock.length).toBeGreaterThan(0);
    expect(titleBlock).toContain('"Mitspieler"');
    expect(titleBlock).toContain('"Dein Team"');
  });
});

describe("Arena-Optik im Mehrspieler — GRUNDREGEL: Solo bleibt in ALLEN Fällen bitgleich", () => {
  it("ein Solo-Save (keine Fremd-Teams mit controlMode 'manual') erzeugt NIE die Einstufung 'human'", () => {
    const state: TeamRelationshipState = {
      teams: [makeTeam("mine"), makeTeam("ai-1"), makeTeam("ai-2")],
      teamControlSettings: {
        mine: makeManualControlSettings("mine", DEFAULT_ACTIVE_OWNER_ID),
        "ai-1": makeAiControlSettings("ai-1"),
        "ai-2": makeAiControlSettings("ai-2"),
      },
    };
    const map = buildTeamRelationshipMap(state, "mine");
    expect([...map.values()]).not.toContain("human");
  });

  it("nativeRoomSync (und damit jede Sperre/jeder Hinweis dieser Suite) ist nur im Room gebaut, solo bleibt es null", () => {
    expect(ARENA).toContain("const nativeRoomSync = roomContext\n    ? {");
    expect(ARENA).toContain("    : null;");
  });

  it("die Native-Arena verhaelt sich ohne roomSync exakt wie vorher: alle neuen Zweige lesen nur roomSync?.* (optional)", () => {
    expect(NATIVE).toContain("Boolean(roomSync?.active && !roomSync.canControl)");
    expect(NATIVE).toContain("roomSync?.followsHost ? \"⏸ Host hat pausiert\"");
    expect(NATIVE).toContain("roomSync.disconnectedNames && roomSync.disconnectedNames.length > 0");
  });
});

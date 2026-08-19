/**
 * WER GETRENNT IST, FAELLT NICHT AUS DER BEREIT-PFLICHT — und der Raum friert trotzdem nicht ein.
 *
 * ENTSCHEIDUNG VON CHRIS (18.08.): "host kann nur weiter klicken in der arena wenn frankys teams
 * auch alle ready sind."
 *
 * Vorher fiel ein getrennter Mitspieler aus `requiredParticipantIds` heraus. Das war eine bewusste
 * Entscheidung mit umgekehrtem Vorzeichen (ein Getrennter sollte nicht unbegrenzt blockieren) — und
 * ihr Preis war, dass der Host an jemandem vorbeizog, der gerade rausgeflogen war, ohne je bereit
 * gewesen zu sein. Der Koop-Audit hat genau das gemessen: der Gast landete nach dem Rejoin
 * mehrere Stationen weiter, ohne je gefragt worden zu sein.
 *
 * Die Sorge der alten Fassung bleibt berechtigt, deshalb der benannte Notausgang. Drei
 * Eigenschaften halten ihn ehrlich, und jede haengt an einer Lage, in der das Falsche naheliegt:
 * einen Anwesenden mit uebergehen, den Notausgang stillschweigend automatisch nehmen, oder ihn
 * auch dann anbieten, wenn die KI-Vorbereitung blockiert.
 */
import { describe, expect, it } from "vitest";

import { buildRoomFlowState, getRoomFlowOfflineBlockerIds } from "@/lib/room/room-flow-controller";
import type { OlyRoomState, RoomParticipant, TeamOwnershipRecord } from "@/types/game";

function teilnehmer(input: Partial<RoomParticipant> & { participantId: string }): RoomParticipant {
  return {
    participantId: input.participantId,
    userId: `user-${input.participantId}`,
    displayName: input.displayName ?? input.participantId,
    role: input.role ?? "player",
    connectionStatus: input.connectionStatus ?? "online",
    readyState: input.readyState ?? "not_ready",
    controlledTeamIds: input.controlledTeamIds ?? [],
    lastSeenAt: new Date(0).toISOString(),
  } as RoomParticipant;
}

function baueZustand(input: {
  frankyOffline?: boolean;
  frankyBereit?: boolean;
  chrisBereit?: boolean;
}): Parameters<typeof buildRoomFlowState>[0]["state"] {
  const ownership: TeamOwnershipRecord[] = [
    { teamId: "P-S", controllerType: "human", participantId: "p-chris" } as TeamOwnershipRecord,
    { teamId: "M-S", controllerType: "human", participantId: "p-franky" } as TeamOwnershipRecord,
  ];
  return {
    multiplayerRoom: {
      roomId: "room-1",
      roomCode: "TEST-TEST",
      saveId: "save-1",
      status: "season_active",
      activeSeasonId: "season-1",
      activeMatchday: 1,
    },
    roomParticipants: [
      teilnehmer({
        participantId: "p-chris",
        displayName: "Chris",
        role: "host",
        controlledTeamIds: ["P-S"],
        readyState: input.chrisBereit === false ? "not_ready" : "ready",
      }),
      teilnehmer({
        participantId: "p-franky",
        displayName: "Franky",
        controlledTeamIds: ["M-S"],
        connectionStatus: input.frankyOffline ? "offline" : "online",
        readyState: input.frankyBereit ? "ready" : "not_ready",
      }),
    ],
    teamOwnership: ownership,
    systemControlledTeamIds: [],
    turnState: { currentStep: "lineup", readyParticipants: [], canAdvance: false },
  } as unknown as Parameters<typeof buildRoomFlowState>[0]["state"];
}

describe("Ein getrennter Mitspieler haelt das Tor", () => {
  it("bleibt bereit-pflichtig und blockiert den Host", () => {
    const flow = buildRoomFlowState({ state: baueZustand({ frankyOffline: true }) });

    expect(flow.requiredParticipantIds, "genau das war die Entscheidung").toContain("p-franky");
    expect(flow.canHostAdvance).toBe(false);
    expect(flow.offlineBlockingParticipantIds).toEqual(["p-franky"]);
    expect(flow.warnings).toContain("waiting_for_offline_human");
  });

  it("GEGENPROBE: wer bereit war und DANN rausfliegt, haelt niemanden auf", () => {
    // `markDisconnected` fasst `readyState` nicht an. Ohne diese Eigenschaft waere die Regel
    // unzumutbar — jeder Verbindungsabriss nach der Abgabe wuerde den Abend anhalten.
    const flow = buildRoomFlowState({ state: baueZustand({ frankyOffline: true, frankyBereit: true }) });

    expect(flow.canHostAdvance).toBe(true);
    expect(flow.offlineBlockingParticipantIds).toEqual([]);
    expect(flow.warnings).not.toContain("waiting_for_offline_human");
  });

  it("GEGENPROBE: ein ANWESENDER, der nicht bereit ist, blockiert wie bisher — aber nicht als 'getrennt'", () => {
    // Die zwei Lagen brauchen verschiedene Knoepfe: auf einen Anwesenden wartet man, einen
    // Getrennten darf der Host uebergehen. Waeren sie derselbe Warnhinweis, boete die Oberflaeche
    // den Notausgang auch dort an, wo der Server ihn ablehnt.
    const flow = buildRoomFlowState({ state: baueZustand({ frankyOffline: false }) });

    expect(flow.canHostAdvance).toBe(false);
    expect(flow.offlineBlockingParticipantIds).toEqual([]);
    expect(flow.warnings).toContain("waiting_for_human_ready");
    expect(flow.warnings).not.toContain("waiting_for_offline_human");
  });
});

describe("Wen der Notausgang uebergehen darf", () => {
  it("nur Bereit-pflichtige, die weder bereit noch verbunden sind", () => {
    const teilnehmende = [
      teilnehmer({ participantId: "p-chris", connectionStatus: "online" }),
      teilnehmer({ participantId: "p-franky", connectionStatus: "offline" }),
      teilnehmer({ participantId: "p-emil", connectionStatus: "offline" }),
    ];

    expect(getRoomFlowOfflineBlockerIds(teilnehmende, ["p-chris", "p-franky", "p-emil"], ["p-chris", "p-emil"])).toEqual([
      "p-franky",
    ]);
  });

  it("GEGENPROBE: ein Anwesender faellt nie darunter, egal wie lange er braucht", () => {
    const teilnehmende = [
      teilnehmer({ participantId: "p-chris", connectionStatus: "online" }),
      teilnehmer({ participantId: "p-franky", connectionStatus: "online" }),
    ];

    expect(getRoomFlowOfflineBlockerIds(teilnehmende, ["p-chris", "p-franky"], ["p-chris"])).toEqual([]);
  });
});

describe("Die Verdrahtung stimmt mit dem ueberein, was der Server zulaesst", () => {
  it("der Notausgang ist eine EIGENE Aktion, kein Zusatzhaken am normalen Weiter-Knopf", () => {
    // Den normalen Knopf drueckt man nebenbei; diesen soll man bewusst waehlen.
    const zuordnung = readFileSyncSafe("lib/room/room-flow-socket-actions.ts");
    expect(zuordnung).toContain('case "advance_flow_skipping_disconnected":');
    expect(zuordnung).toContain("getrennteUeberspringen: true");
    expect(zuordnung).toContain('socket.emit("advanceRoomFlow", { roomCode, seatToken });');
  });

  it("der Server prueft selbst nach — der Knopf allein reicht nicht", () => {
    // Sonst haenge die Regel an einem Client, den man austauschen kann.
    const store = readFileSyncSafe("lib/room/room-store.ts");
    expect(store).toContain("getrennteUeberspringen");
    expect(store).toMatch(/anwesendeIds\.length === 0/);
  });

  it("die Leiste bietet ihn NICHT an, solange die KI noch vorbereitet wird", () => {
    // Ein halb vorbereiteter Spieltag laesst sich nicht sinnvoll starten — und der Server lehnte
    // ihn ohnehin ab.
    const leiste = readFileSyncSafe("components/foundation/FoundationRoomFlowBar.tsx");
    expect(leiste).toContain('!flow.warnings.includes("ai_auto_step_pending")');
  });
});

function readFileSyncSafe(pfad: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { resolve } = require("node:path") as typeof import("node:path");
  return readFileSync(resolve(process.cwd(), pfad), "utf8");
}

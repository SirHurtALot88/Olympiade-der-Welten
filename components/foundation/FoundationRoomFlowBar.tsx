"use client";

import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { describeRoomFlowButton, getRoomFlowStep } from "@/lib/room/room-flow-controller";
import { emitRoomFlowButtonAction } from "@/lib/room/room-flow-socket-actions";
import type { OlyRoomState, RoomFlowButtonStatus, RoomParticipant } from "@/types/game";

export type FoundationRoomFlowBarProps = {
  roomContext: FoundationRoomContext;
  roomLiveState: OlyRoomState;
};

/**
 * Der Room-Flow (Ready melden, Host schaltet weiter, wer blockiert gerade) lebt bis hierher
 * NUR auf `/room/[roomCode]` — in der Foundation-Shell, wo tatsaechlich gespielt wird, war er
 * nur ein Tooltip am Room-Chip. Diese Leiste bringt den vollen Flow dorthin: Schritt-Anzeige,
 * der EINE Handlungsknopf (dessen Ziel `describeRoomFlowButton().action` bestimmt, siehe
 * `lib/room/room-flow-controller.ts`) und wer gerade blockiert.
 *
 * Nutzt bewusst KEIN eigenes Socket-Abo: `roomContext`/`roomLiveState` kommen von der Shell,
 * die bereits auf `roomJoined`/`roomState` hoert (`use-foundation-shell-router-body-scope.tsx`).
 * Ein Klick emittiert nur ueber `emitRoomFlowButtonAction` (Singleton-Socket, kein `.on()`).
 */
function statusToneClass(status: RoomFlowButtonStatus): string {
  if (status === "ready") return "is-ready";
  if (status === "blocked") return "is-blocked";
  // "waiting_for_player" / "host_only" / "applying" / "sandbox_override_available": alles,
  // worauf gerade gewartet wird, bekommt denselben Warn-Ton wie das Kontext-Banner.
  return "is-warning";
}

export function FoundationRoomFlowBar({ roomContext, roomLiveState }: FoundationRoomFlowBarProps) {
  const flow = roomLiveState.roomFlowState;
  const currentStep = getRoomFlowStep(flow.step);
  const button = describeRoomFlowButton({ state: roomLiveState, participantId: roomContext.participantId });
  const currentParticipant = roomLiveState.roomParticipants.find(
    (participant) => participant.participantId === roomContext.participantId,
  );

  // Teilnehmer mit eigenen Teams, je mit ihrem Bereit-Status — dieselbe Formulierung wie das
  // Warten-Panel auf der Room-Seite (`RoomPageClient.tsx`, Zeilen 389-421) und die Wartenamen
  // im Arena-Coop-Gate (`arenaCoopWaitingNames` in `lib/room/use-arena-room-sync.ts`).
  const teamRosterParticipants = roomLiveState.roomParticipants.filter(
    (participant: RoomParticipant) => participant.controlledTeamIds.length > 0,
  );
  const aiTeamCount = roomLiveState.teamOwnership.filter((entry) => entry.controllerType === "ai").length;
  const aiReadyCount = flow.aiAutoCompletedTeamIds.length;

  function handlePrimaryAction() {
    if (!button.canClick) {
      return;
    }
    emitRoomFlowButtonAction({
      action: button.action,
      roomCode: roomContext.roomCode,
      seatToken: roomContext.seatToken,
      toggleReadyTo: currentParticipant?.readyState !== "ready",
    });
  }

  return (
    <section
      className={`foundation-flow-controller ${statusToneClass(button.status)}`}
      data-testid="foundation-room-flow-bar"
      aria-label="Multiplayer-Room-Flow"
    >
      <div className="foundation-flow-copy">
        <strong>{currentStep.label}</strong>
        {teamRosterParticipants.length > 0 || aiTeamCount > 0 ? (
          <div className="foundation-room-flow-waiting" data-testid="foundation-room-flow-waiting">
            {teamRosterParticipants.map((participant) => {
              const ready = flow.completedParticipantIds.includes(participant.participantId);
              // BEFUND (Auftrag): ohne diesen Hinweis blieb die Leiste bei "0/4 bereit" stehen,
              // waehrend der Host laengst weiterklicken konnte -- `getRequiredParticipants`
              // (lib/room/room-flow-controller.ts) nimmt einen getrennten Teilnehmer NICHT mehr in
              // die Bereit-Pflicht auf, `flow.requiredParticipantIds` zeigt das hier direkt an.
              const isOffline = participant.connectionStatus === "offline";
              const isRequired = flow.requiredParticipantIds.includes(participant.participantId);
              const lastSeenLabel = new Date(participant.lastSeenAt).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <span
                  key={participant.participantId}
                  className={`pill${ready ? " is-ready" : " is-warning"}`}
                  data-testid="foundation-room-flow-participant-pill"
                >
                  {participant.displayName}: {ready ? participant.controlledTeamIds.length : 0}/
                  {participant.controlledTeamIds.length} Teams bereit
                  {isOffline
                    ? ` · getrennt (zuletzt ${lastSeenLabel})${
                        isRequired ? "" : " · zählt nicht mehr für „Weiter“"
                      }`
                    : ""}
                </span>
              );
            })}
            {aiTeamCount > 0 ? (
              <span className={`pill${aiReadyCount >= aiTeamCount ? " is-ready" : " is-warning"}`}>
                KI: {aiReadyCount}/{aiTeamCount} bereit
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="foundation-flow-actions">
        <button
          className="primary-button foundation-flow-button"
          type="button"
          disabled={!button.canClick}
          onClick={handlePrimaryAction}
          data-testid="foundation-room-flow-button"
        >
          {button.label}
        </button>
      </div>
    </section>
  );
}

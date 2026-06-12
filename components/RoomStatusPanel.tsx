import type { OlyRoomState } from "@/types/game";

type RoomStatusPanelProps = {
  roleLabel: string;
  state: OlyRoomState;
};

export function RoomStatusPanel({ roleLabel, state }: RoomStatusPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Raumstatus</h2>
      </div>
      <dl className="status-grid">
        <div>
          <dt>Raumcode</dt>
          <dd>{state.roomCode}</dd>
        </div>
        <div>
          <dt>Deine Rolle</dt>
          <dd>{roleLabel}</dd>
        </div>
        <div>
          <dt>Aktiver Coach</dt>
          <dd>Coach {state.activeRole}</dd>
        </div>
        <div>
          <dt>Turn</dt>
          <dd>{state.turnNumber}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{state.status}</dd>
        </div>
        <div>
          <dt>Online Phase</dt>
          <dd>{state.multiplayerRoom.status}</dd>
        </div>
        <div>
          <dt>Save</dt>
          <dd>{state.multiplayerRoom.saveId}</dd>
        </div>
        <div>
          <dt>Participants</dt>
          <dd>{state.roomParticipants.length}</dd>
        </div>
        <div>
          <dt>Advance</dt>
          <dd>{state.turnState.canAdvance ? "bereit" : "blockiert"}</dd>
        </div>
        <div>
          <dt>Client Writes</dt>
          <dd>{state.serverWritePolicy.clientMayWriteDirectly ? "erlaubt" : "verboten"}</dd>
        </div>
        <div>
          <dt>Move in diesem Turn</dt>
          <dd>{state.moveCommittedThisTurn ? "Ja" : "Nein"}</dd>
        </div>
      </dl>
    </section>
  );
}

"use client";

type TurnControlsProps = {
  canEndTurn: boolean;
  onEndTurn: () => void;
};

export function TurnControls({ canEndTurn, onEndTurn }: TurnControlsProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Zugsteuerung</h2>
      </div>
      <button className="primary-button" type="button" onClick={onEndTurn} disabled={!canEndTurn}>
        Zug beenden
      </button>
      <p className="muted">
        Ein Turn erlaubt genau einen erfolgreichen Move. Danach beendet der aktive Coach den Zug.
      </p>
    </section>
  );
}

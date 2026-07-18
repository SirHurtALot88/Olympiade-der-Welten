"use client";

import { Component, type ReactNode } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import DisciplineStageArena from "@/app/foundation/discipline-stage/DisciplineStageArena";

// Die Disziplin-Bühne wird — wie Spieler-Detail und Team-Profil — AUSSERHALB
// des (nirgends gemounteten) FoundationStateProvider gerendert. Deshalb kommt
// der volle GameState + die Team-Auswahl über Props aus dem Router-Body, statt
// über useFoundationState()/useFoundationGameState() (die hier immer werfen würden).
export type FoundationDisciplineStageHostProps = {
  gameState: GameState;
  selectedTeamId: string;
  activeManagerTeamId: string | null;
};

// Diagnose-Fehlergrenze: zeigt die ECHTE Fehlermeldung + Stack direkt im Tab an,
// statt dass die generische Shell-Karte den eigentlichen Fehler verschluckt.
class DisciplineStageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 20, color: "inherit" }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Disziplin-Bühne — Fehler (Diagnose)</div>
          <div style={{ fontSize: 13, color: "var(--nl-mut)", marginBottom: 10 }}>
            Bitte diese Meldung abfotografieren/kopieren — damit lässt sich die Ursache genau beheben.
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              lineHeight: 1.5,
              background: "color-mix(in srgb, var(--nl-risk) 12%, transparent)",
              border: "1px solid var(--nl-risk)",
              borderRadius: 8,
              padding: 12,
              maxHeight: 420,
              overflow: "auto",
            }}
          >
            {String(err?.message ?? err)}
            {"\n\n"}
            {err?.stack ?? ""}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function FoundationDisciplineStageHost(props: FoundationDisciplineStageHostProps) {
  return (
    <DisciplineStageErrorBoundary>
      <DisciplineStageArena {...props} />
    </DisciplineStageErrorBoundary>
  );
}

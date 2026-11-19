"use client";

/**
 * VERLÄNGERN ODER FREIGEBEN — NACHHOLEN (Chris 19.11.).
 *
 * Für Spielstände aus der Zeit vor der Saisonwechsel-Sperre: ein Vertrag, der schon in einer FRÜHEREN Saison auslief und über
 * den nie entschieden wurde, steht mitten in der laufenden Saison noch auf `renewal_pending` (Live-Abbild 19.11.: `hwz8fk`,
 * 12 Spieler von C-C). Das Saisonfinale ist dort nicht zu sehen — diese Karte auf der Startseite ist der Weg heraus. Dieselben
 * Knöpfe wie im Finale, dieselbe Quelle (`offeneVertragsentscheidungen`); die Vertragsroute lässt genau diese Fälle auch
 * außerhalb des Saisonende-Fensters zu (`istVertragsentscheidungNachzuholen`).
 */
import { useMemo } from "react";

import { offeneVertragsentscheidungen } from "@/lib/contracts/vertragsentscheidung";
import type { GameState } from "@/lib/data/olyDataTypes";

export type VertragsentscheidungNachholenProps = {
  gameState: GameState;
  activeTeamId: string | null;
  busy: boolean;
  readOnly: boolean;
  onRenewPlayer: (input: { playerId: string; playerName: string; contractLength: number | null }) => void;
  onReleasePlayer: (input: { playerId: string; playerName: string }) => void;
  vertragsFehler?: string | null;
};

function formatWert(wert: number | null | undefined): string {
  if (wert == null || !Number.isFinite(wert)) return "—";
  return Number.isInteger(wert) ? String(wert) : wert.toFixed(1);
}

export default function VertragsentscheidungNachholen(props: VertragsentscheidungNachholenProps) {
  const { gameState, activeTeamId, busy, readOnly, onRenewPlayer, onReleasePlayer, vertragsFehler } = props;
  const zeilen = useMemo(() => {
    if (!activeTeamId) return [];
    const spielerNachId = new Map(gameState.players.map((spieler) => [spieler.id, spieler] as const));
    return offeneVertragsentscheidungen(gameState, activeTeamId)
      .filter((eintrag) => eintrag.nachzuholen)
      .map((eintrag) => {
        const spieler = spielerNachId.get(eintrag.playerId);
        const roster = gameState.rosters.find((entry) => entry.id === eintrag.rosterId);
        return {
          ...eintrag,
          name: spieler?.name ?? eintrag.playerId,
          marktwert: spieler?.marketValue ?? null,
          gehalt: roster?.salary ?? null,
        };
      });
  }, [gameState, activeTeamId]);

  if (zeilen.length === 0) return null;
  return (
    <section className="nl-season-finale-steps nl-vertrag-nachholen" data-testid="vertragsentscheidung-nachholen" aria-label="Verträge nachholen">
      <ol>
        <li className="nl-season-finale-step">
          <div className="nl-season-finale-step-text">
            <strong>Verlängern oder freigeben ({zeilen.length} offen)</strong>
            <small>
              Diese Verträge sind schon zum Ende der letzten Saison ausgelaufen, die Entscheidung fehlt noch. Verlängern öffnet die
              Gehaltsverhandlung, Freigeben verkauft zum aktuellen Verkaufspreis.
            </small>
          </div>
          <ul className="nl-season-finale-vertraege">
            {zeilen.map((zeile) => (
              <li key={zeile.rosterId} data-player={zeile.playerId}>
                <span>
                  <strong>{zeile.name}</strong>
                  <small>
                    MW {formatWert(zeile.marktwert)} C · Gehalt {formatWert(zeile.gehalt)} C · Vertrag schon ausgelaufen
                  </small>
                </span>
                <button
                  type="button"
                  className="primary-button inline-button"
                  disabled={busy || readOnly}
                  onClick={() => onRenewPlayer({ playerId: zeile.playerId, playerName: zeile.name, contractLength: null })}
                  data-testid="vertrag-nachholen-verlaengern"
                >
                  Verlängern
                </button>
                <button
                  type="button"
                  className="inline-button"
                  disabled={busy || readOnly}
                  onClick={() => onReleasePlayer({ playerId: zeile.playerId, playerName: zeile.name })}
                  data-testid="vertrag-nachholen-freigeben"
                >
                  Freigeben
                </button>
              </li>
            ))}
          </ul>
          {vertragsFehler ? (
            <p className="nl-season-finale-vertraege-hinweis is-error" role="alert">
              {vertragsFehler}
            </p>
          ) : null}
        </li>
      </ol>
    </section>
  );
}

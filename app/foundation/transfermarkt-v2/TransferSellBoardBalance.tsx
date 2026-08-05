"use client";

import type { ReactNode } from "react";

import {
  classifySellReasonCategory,
  formatBoardTrustMoodLabel,
  formatBoardTrustPolicyLabel,
  formatDoctrinePersonaLabel,
} from "@/app/foundation/transfermarkt-v2/transfer-sell-view-labels";
import { NlCard } from "@/components/foundation/new-look";
import type { TransfermarktSellSummary } from "@/lib/foundation/tabs/use-market-sell-derivations";

/**
 * DIE BOARD-BILANZ — „Verkaufen X · Halten Y" samt Dafür/Dagegen.
 *
 * GEMELDET: „ich finde auch das verkaufsfenster sollte ggf als drawer oder so rein kommen schon
 * wenn man den spieler in der zeile anklickt, damit man auch bei spielern die man nicht verkaufen
 * will direkt sehen kann was das board dazu sagt!"
 *
 * Damit hat die Bilanz zwei Orte: die Verkaufsseite (wo entschieden wird) und den Drawer in der
 * Kaderliste (wo nur nachgesehen wird). Sie steht deshalb hier und nicht mehr inline im
 * Verkaufsdialog — zwei Abschriften derselben Karte wären genau die Sorte Dublette, die sich
 * beim nächsten Umbau auseinanderentwickelt.
 *
 * BEWUSST NICHT hier drin: die Risiko-Bestätigungs-Checkbox. Die gehört zum Verkaufen, nicht zum
 * Nachsehen, und ihre Sichtbarkeit hängt an der Sperrbedingung des Confirm-Buttons. Sie bleibt in
 * `FoundationMarketSellShellHost` und wird als `footer` hereingereicht.
 */
export type TransferSellBoardBalanceProps = {
  coaching: NonNullable<TransfermarktSellSummary["coaching"]>;
  /** Verkaufsflow-eigener Anhang (Risiko-Bestätigung); im Drawer leer. */
  footer?: ReactNode;
  className?: string;
};

export default function TransferSellBoardBalance({ coaching, footer, className }: TransferSellBoardBalanceProps) {
  const sellScore = coaching.sellIntentScore ?? null;
  const keepScore = coaching.keepIntentScore ?? null;
  const intentTotal = (sellScore ?? 0) + (keepScore ?? 0);
  const sellSharePct = intentTotal > 0 ? Math.round(((sellScore ?? 0) / intentTotal) * 1000) / 10 : 50;

  return (
    <NlCard
      className={["transfer-sell-board-card", className].filter(Boolean).join(" ")}
      eyebrow={
        coaching.doctrineHint
          ? `Doktrin: ${formatDoctrinePersonaLabel(coaching.doctrinePersona)} · ${coaching.doctrineHint}`
          : `Doktrin: ${formatDoctrinePersonaLabel(coaching.doctrinePersona)}`
      }
      title={
        <>
          Board-Bilanz
          <span className="transfer-sell-board-title-sub">
            {coaching.reasonsToSell.length} dafür · {coaching.reasonsToKeep.length} dagegen
            {coaching.sellPriority != null ? ` · Priorität ${coaching.sellPriority}` : ""}
          </span>
        </>
      }
      data-testid="transfer-sell-coaching-panel"
    >
      {sellScore != null || keepScore != null ? (
        <div className="transfer-sell-intent">
          <div
            className="transfer-sell-intent-bar"
            role="img"
            aria-label={`Verkaufs-Gewichtung ${sellScore ?? 0} zu ${keepScore ?? 0}`}
          >
            <span className="transfer-sell-intent-fill" style={{ width: `${sellSharePct}%` }} />
          </div>
          <div className="transfer-sell-intent-legend">
            <b>Verkaufen · {sellScore ?? 0}</b>
            <b>Halten · {keepScore ?? 0}</b>
          </div>
        </div>
      ) : null}

      <div className="transfer-sell-reasons">
        <div>
          <div className="transfer-sell-reason-col-head">
            <span>Dafür</span>
            <span>{coaching.reasonsToSell.length}</span>
          </div>
          {coaching.reasonsToSell.length ? (
            coaching.reasonsToSell.map((reason, index) => (
              <div className="transfer-sell-reason is-for" key={`sell-${index}-${reason}`}>
                <span className="transfer-sell-reason-dot" aria-hidden="true" />
                <span className="transfer-sell-reason-tag">{classifySellReasonCategory(reason)}</span>
                <span>{reason}</span>
              </div>
            ))
          ) : (
            <p className="transfer-sell-reason-empty">Keine Verkaufsgründe.</p>
          )}
        </div>
        <div>
          <div className="transfer-sell-reason-col-head">
            <span>Dagegen</span>
            <span>{coaching.reasonsToKeep.length}</span>
          </div>
          {/* Diese Spalte bleibt IMMER sichtbar, auch leer — bei wenigen,
              schweren Haltegründen trägt genau sie die Entscheidung. */}
          {coaching.reasonsToKeep.length ? (
            coaching.reasonsToKeep.map((reason, index) => (
              <div className="transfer-sell-reason is-keep" key={`keep-${index}-${reason}`}>
                <span className="transfer-sell-reason-dot" aria-hidden="true" />
                <span className="transfer-sell-reason-tag">{classifySellReasonCategory(reason)}</span>
                <span>{reason}</span>
              </div>
            ))
          ) : (
            <p className="transfer-sell-reason-empty">Keine Haltegründe.</p>
          )}
        </div>
      </div>

      <p className="transfer-sell-strategy nl-market-muted">{coaching.strategyFitSummary}</p>
      {coaching.boardTrustSmiley || coaching.boardTrustPolicy ? (
        <p className="nl-market-muted">
          Board-Stimmung {formatBoardTrustMoodLabel(coaching.boardTrustSmiley)} · Linie:{" "}
          {formatBoardTrustPolicyLabel(coaching.boardTrustPolicy)}
        </p>
      ) : null}
      {footer}
    </NlCard>
  );
}

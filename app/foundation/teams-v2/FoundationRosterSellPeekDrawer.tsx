"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import TransferSellBoardBalance from "@/app/foundation/transfermarkt-v2/TransferSellBoardBalance";
import {
  formatGmArchetypeLabel,
  formatGmPressureLabel,
} from "@/app/foundation/transfermarkt-v2/transfer-sell-view-labels";
import { StatChip, StatChipRow } from "@/components/foundation/new-look";
import { useFocusTrap } from "@/lib/foundation/use-focus-trap";
import type {
  TransfermarktSellPreviewSubject,
  TransfermarktSellSummary,
} from "@/lib/foundation/tabs/use-market-sell-derivations";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";

/**
 * KADER-DRAWER: „was sagt das Board zu dem hier?" — ohne den Verkauf anzufangen.
 *
 * GEMELDET: „ich finde auch das verkaufsfenster sollte ggf als drawer oder so rein kommen schon
 * wenn man den spieler in der zeile anklickt, damit man auch bei spielern die man nicht verkaufen
 * will direkt sehen kann was das board dazu sagt!"
 *
 * Bis hierher war die Board-Bilanz nur zu sehen, wenn man den Verkauf schon eingeleitet hatte —
 * also genau bei den Spielern, bei denen man ohnehin entschieden hat. Für die Frage „soll ich den
 * überhaupt abgeben?" war sie unerreichbar.
 *
 * WAS DER DRAWER NICHT TUT: rechnen. Er zeigt dieselbe Vorschau, die auch die Verkaufsseite liest
 * (`/api/transfermarkt/sell` mit `dryRun`), und rendert die Board-Bilanz mit derselben Komponente
 * (`TransferSellBoardBalance`). Zwei Wege zu denselben Zahlen wären die nächste Stelle, an der
 * zwei Ansichten verschiedene Antworten geben — davon hatte der Verkauf gerade genug.
 *
 * Overlay/ESC/Fokusfalle spiegeln `NlRankingDrawer` und `PlayerDetailDrawer`. Gerendert wird per
 * Portal in die Shell — warum weder an Ort und Stelle noch in `document.body`, steht unten am
 * Portal selbst.
 */
export type FoundationRosterSellPeekDrawerProps = {
  subject: TransfermarktSellPreviewSubject | null;
  preview: TransfermarktSellSummary | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  /** Übergang in den echten Verkauf — der Drawer schließt, die Verkaufsseite übernimmt. */
  onOpenSell: (subject: TransfermarktSellPreviewSubject) => void;
};

export default function FoundationRosterSellPeekDrawer({
  subject,
  preview,
  busy,
  error,
  onClose,
  onOpenSell,
}: FoundationRosterSellPeekDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const open = subject != null;
  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  /**
   * PORTAL IN DIE SHELL — nicht in `document.body`, und nicht an Ort und Stelle.
   *
   * An Ort und Stelle greift `position: fixed` nicht: der Drawer haengt tief in der
   * Kader-Ansicht, und ein Vorfahr dort baut mit `transform`/`filter` einen eigenen
   * Containing Block auf. Gemessen im Browser stand die Leiste dann nicht am Fensterrand,
   * sondern an der Tabelle — halb unter dem Bildschirmrand.
   *
   * Nach `document.body` kann er aber auch nicht: die `--nl-*`-Tokens haengen an
   * `.is-new-look`, und die Team-Farben stehen als Inline-`style` auf genau diesem <main>
   * (siehe FoundationShellRouterBody). Ausserhalb davon waere der Drawer farblos.
   *
   * Also in die Shell selbst — dort gilt beides, und `fixed` meint wieder das Fenster.
   */
  const [portalZiel, setPortalZiel] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    setPortalZiel(document.querySelector<HTMLElement>("main.foundation-shell") ?? document.body);
  }, []);

  if (!subject || !portalZiel) {
    return null;
  }

  const coaching = preview?.coaching ?? null;
  const marktwert = preview?.marketValueReference ?? null;
  const brutto = preview?.salePrice ?? null;
  const buyout = preview?.buyoutCost ?? null;
  const netto = preview?.netProceeds ?? null;
  // Wie im Verkaufsdialog: verglichen wird der BRUTTOPREIS mit dem Marktwert, nicht der Netto-
  // Erlös. Der Buyout hängt am Vertrag und sagt nichts über den Wert des Spielers.
  const aufschlag = brutto != null && marktwert != null ? brutto - marktwert : null;

  return createPortal(
    <div className="roster-sell-peek-backdrop" data-testid="roster-sell-peek" onClick={onClose}>
      <div
        className="roster-sell-peek-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Verkaufs-Einschätzung zu ${subject.playerName}`}
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="roster-sell-peek-head">
          <div>
            <span className="roster-sell-peek-eyebrow">Kader · Verkaufs-Einschätzung</span>
            <strong className="roster-sell-peek-name">{subject.playerName}</strong>
            <span className="roster-sell-peek-sub">
              {subject.className} · {subject.race}
            </span>
          </div>
          <button className="roster-sell-peek-close" type="button" onClick={onClose} aria-label="Schließen" title="Schließen (Esc)">
            ✕
          </button>
        </header>

        <div className="roster-sell-peek-body">
          {busy ? (
            <p className="muted" data-testid="roster-sell-peek-busy">
              Einschätzung wird geladen …
            </p>
          ) : null}

          {!busy && error ? (
            <p className="roster-sell-peek-error" data-testid="roster-sell-peek-error">
              {error}
            </p>
          ) : null}

          {!busy && !error && preview ? (
            <>
              <StatChipRow aria-label="Zahlen zum Verkauf">
                <StatChip label="VK brutto" value={formatTransfermarktCurrency(brutto)} sub="Marktwert × Verkaufsfaktor" />
                <StatChip
                  label="Buyout"
                  value={formatTransfermarktCurrency(buyout)}
                  sub={buyout != null && buyout > 0 ? "geht vom Brutto ab" : "keiner fällig"}
                  tone={buyout != null && buyout > 0 ? "warn" : "good"}
                />
                <StatChip label="Netto-Erlös" value={formatTransfermarktCurrency(netto)} sub="was ins Team-Cash geht" />
                <StatChip
                  label="vs. Marktwert"
                  value={aufschlag != null ? formatTransfermarktCurrency(aufschlag) : "—"}
                  sub={marktwert != null ? `MW ${formatTransfermarktCurrency(marktwert)}` : "kein Marktwert"}
                  tone={aufschlag == null ? "neutral" : aufschlag >= 0 ? "good" : "warn"}
                />
              </StatChipRow>

              {coaching ? (
                <TransferSellBoardBalance coaching={coaching} className="roster-sell-peek-board" />
              ) : (
                <p className="muted" data-testid="roster-sell-peek-no-coaching">
                  Für diesen Spieler liegt keine Board-Einschätzung vor.
                </p>
              )}

              {coaching?.gmName ? (
                <p className="muted roster-sell-peek-gm">
                  GM {coaching.gmName}
                  {coaching.gmArchetype ? ` · ${formatGmArchetypeLabel(coaching.gmArchetype)}` : ""} · Druck{" "}
                  {formatGmPressureLabel(coaching.gmPressureLevel)}
                  {coaching.gmWarning ? ` — ${coaching.gmWarning}` : ""}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className="roster-sell-peek-foot">
          <button className="secondary-button" type="button" onClick={onClose}>
            Schließen
          </button>
          {/* Der Drawer entscheidet nichts — der Verkauf passiert weiterhin auf der Verkaufsseite
              mit ihren Bestätigungen. Hier steht nur der Weg dorthin. */}
          <button
            className="primary-button"
            type="button"
            disabled={busy || preview?.canSell !== true}
            title={
              preview?.canSell === true
                ? "Öffnet die Verkaufsseite mit Bestätigung."
                : "Verkauf ist gerade nicht möglich — Grund steht in der Verkaufsseite."
            }
            onClick={() => onOpenSell(subject)}
            data-testid="roster-sell-peek-open-sell"
          >
            Zum Verkauf …
          </button>
        </footer>
      </div>
    </div>,
    portalZiel,
  );
}

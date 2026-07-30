"use client";

import { useState } from "react";

/**
 * Kleine rote Flagge oben rechts: ein Klick meldet einen Fehler FUER DIE SEITE, auf der man steht.
 *
 * Warum ein Freitextfeld dazwischen und nicht sofort senden: eine Meldung ohne einen Satz dazu ist
 * schwer zu deuten, und ein Fehlklick soll nicht als Meldung durchgehen. Der Satz ist aber optional —
 * das Wertvolle sammelt der Server selbst (Spielstand, Saison, Spieltag, aktives Team, Seite und
 * Melder; siehe lib/bug-report/bug-report-service.ts). Genau dieser Zustand hat in diesem Projekt bei
 * mehreren Fehlern gefehlt und die Diagnose auf Screenshots zurueckgeworfen.
 *
 * Absichtlich NICHT an den Login gebunden (anders als AuthStatusBadge): melden koennen soll man
 * immer, auch ohne Session und auch auf einer Seite, die gerade halb kaputt ist.
 */
export function BugReportFlag() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [sentInfo, setSentInfo] = useState<string | null>(null);

  async function send() {
    setState("sending");
    try {
      const response = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note,
          url: typeof window === "undefined" ? null : window.location.href,
          // Die Ansicht steht als Query-Parameter in der URL — praeziser als der Pfad allein.
          view: typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("view"),
          // Der Pfad zusaetzlich, weil die Seiten ausserhalb von /foundation (Login, Startseite,
          // Online-Raum) gar keinen `?view=`-Parameter haben — dort war die Ansicht bisher leer.
          path: typeof window === "undefined" ? null : window.location.pathname,
          tab: typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab"),
          viewport:
            typeof window === "undefined" ? null : { width: window.innerWidth, height: window.innerHeight },
          clientTime: new Date().toISOString(),
          // WER meldet, setzt der Server aus dem Session-Cookie — ein hier mitgeschickter Name waere
          // frei behauptbar und damit wertlos.
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            reportId?: string;
            game?: { saveName?: string | null; currentMatchday?: number | null } | null;
            page?: { label?: string | null; path?: string | null } | null;
            reporter?: { displayName?: string | null } | null;
          }
        | null;
      if (!response.ok || !payload?.ok) {
        setState("failed");
        return;
      }
      // Zeigen, WAS mitgegangen ist — sonst weiss niemand, ob die Meldung brauchbar war.
      const game = payload.game;
      const parts = [
        game?.saveName
          ? `${game.saveName}${game.currentMatchday != null ? ` · Spieltag ${game.currentMatchday}` : ""}`
          : "ohne Spielkontext",
        payload.page?.label ?? payload.page?.path ?? null,
        payload.reporter?.displayName ?? null,
      ];
      setSentInfo(parts.filter(Boolean).join(" · "));
      setState("sent");
      setNote("");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="oly-bug-report-flag">
      <button
        type="button"
        className="oly-bug-report-flag-button"
        aria-label="Fehler auf dieser Seite melden"
        title="Fehler auf dieser Seite melden"
        aria-expanded={open}
        onClick={() => {
          setOpen((previous) => !previous);
          if (state !== "idle") setState("idle");
        }}
      >
        {/* Flagge als Inline-SVG: kein Icon-Paket, keine Schriftabhaengigkeit, skaliert sauber. */}
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M3.2 1.2v13.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M4.4 2.1h8.2l-1.9 2.9 1.9 2.9H4.4z" fill="currentColor" />
        </svg>
      </button>

      {open ? (
        <div className="oly-bug-report-flag-panel" role="dialog" aria-label="Fehler melden">
          {state === "sent" ? (
            <>
              <strong>Gemeldet.</strong>
              <span className="oly-bug-report-flag-hint">Mitgeschickt: {sentInfo}</span>
              <button type="button" onClick={() => setOpen(false)}>
                Schließen
              </button>
            </>
          ) : (
            <>
              <label htmlFor="oly-bug-report-note">Was ist hier falsch?</label>
              <textarea
                id="oly-bug-report-note"
                rows={3}
                value={note}
                placeholder="Optional — Saison, Spieltag, Seite und dein Name gehen automatisch mit."
                onChange={(event) => setNote(event.target.value)}
              />
              {state === "failed" ? (
                <span className="oly-bug-report-flag-error">Senden fehlgeschlagen — nochmal versuchen?</span>
              ) : null}
              <div className="oly-bug-report-flag-actions">
                <button type="button" onClick={() => setOpen(false)}>
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="oly-bug-report-flag-send"
                  disabled={state === "sending"}
                  onClick={() => void send()}
                >
                  {state === "sending" ? "sendet…" : "Melden"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

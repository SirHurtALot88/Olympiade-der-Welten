"use client";

import { useEffect, useRef, useState } from "react";

export type FoundationMeldung = {
  id: string;
  title: string;
  detail?: string;
  severity: "critical" | "warning" | "info";
};

type FoundationMeldungenProps = {
  meldungen: FoundationMeldung[];
  /** In der Arena warten neue Meldungen; danach erscheinen sie gesammelt. */
  zurueckhalten?: boolean;
  onOpen?: () => void;
};

const ANZEIGE_MS = 6000;

/**
 * Bauchbinde unten rechts (18.11.): neu auftauchende Inbox-Meldungen erscheinen 6 s lang und sind klickbar.
 * Beim ersten Laden gilt alles Vorhandene als gesehen (kein Schwall). In der Arena (`zurueckhalten`) werden
 * Meldungen gesammelt und beim Verlassen als EINE Zeile gezeigt („3 neue Meldungen“).
 */
export default function FoundationMeldungen({ meldungen, zurueckhalten = false, onOpen }: FoundationMeldungenProps) {
  const gesehen = useRef<Set<string> | null>(null);
  const [wartend, setWartend] = useState<FoundationMeldung[]>([]);
  const [sichtbar, setSichtbar] = useState<{ text: string; detail?: string; severity: FoundationMeldung["severity"] } | null>(null);

  useEffect(() => {
    if (gesehen.current === null) {
      gesehen.current = new Set(meldungen.map((m) => m.id));
      return;
    }
    const neu = meldungen.filter((m) => !gesehen.current?.has(m.id));
    if (neu.length === 0) return;
    for (const m of neu) gesehen.current.add(m.id);
    setWartend((alt) => [...alt, ...neu]);
  }, [meldungen]);

  useEffect(() => {
    if (zurueckhalten || wartend.length === 0) return undefined;
    const erste = wartend[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Warteschlange wird in eine Anzeige überführt
    setSichtbar(
      wartend.length === 1
        ? { text: erste.title, detail: erste.detail, severity: erste.severity }
        : { text: `${wartend.length} neue Meldungen`, detail: wartend.map((m) => m.title).slice(0, 2).join(" · "), severity: erste.severity },
    );
    setWartend([]);
  }, [wartend, zurueckhalten]);

  useEffect(() => {
    if (!sichtbar) return undefined;
    const timer = setTimeout(() => setSichtbar(null), ANZEIGE_MS);
    return () => clearTimeout(timer);
  }, [sichtbar]);

  return (
    <>
      {zurueckhalten && wartend.length > 0 ? (
        <span className="fb-meldungen-punkt" data-testid="foundation-meldungen-wartend" aria-hidden="true" />
      ) : null}
      {sichtbar ? (
        <button
          type="button"
          className={`fb-bauchbinde is-${sichtbar.severity}`}
          data-testid="foundation-bauchbinde"
          role="status"
          onClick={() => {
            setSichtbar(null);
            onOpen?.();
          }}
        >
          <strong>{sichtbar.text}</strong>
          {sichtbar.detail ? <span>{sichtbar.detail}</span> : null}
        </button>
      ) : null}
    </>
  );
}

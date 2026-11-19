"use client";

/**
 * DRAFT-HINWEIS im App-Rahmen (19.11., Chris: „man sollte erst seine office sachen etc klären dürfen und sich zurecht finden
 * bevor man direkt in den draft rein geht“ und „wenn man beim draft woanders drauf geht muss klar sein wie man wieder zum draft
 * zurückkehrt“). Steht über jeder Ansicht, solange ein Draft läuft und die Draft-Seite nicht offen ist.
 *
 * Er fragt `GET /api/draft` selbst nach (alle 4 s) und zeigt: Pick-Stand, ob man dran ist — und, solange die Startwahl offen
 * ist, die zwei Knöpfe „Draft spielen“ (öffnet die Draft-Seite bei Pick 1) und „Selbst kaufen“ (die KI pickt sofort durch, danach
 * kauft man im Transfermarkt aus dem Rest). Der Draft-Zustand liegt im Spielstand: nichts davon geht beim Verlassen verloren.
 */
import { useCallback, useEffect, useState } from "react";

import type { LigaDraftAnsicht } from "@/lib/draft/liga-draft-ansicht";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { fehlerText } from "./draft-format";
import { baueDraftLeseParameter, baueDraftPostKoerper } from "./draft-protokoll";
import "./draft-hinweis.css";

export function DraftHinweis({
  saveId,
  teamId,
  roomContext,
  onOeffnen,
}: {
  saveId: string;
  teamId: string | null;
  roomContext: FoundationRoomContext | null | undefined;
  onOeffnen: () => void;
}) {
  const [ansicht, setAnsicht] = useState<LigaDraftAnsicht | null>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const lade = useCallback(async () => {
    try {
      const parameter = baueDraftLeseParameter({ saveId, teamId, roomContext, vorschau: 0, verlauf: 1 });
      const antwort = await fetch(`/api/draft?${parameter.toString()}`, { cache: "no-store" });
      if (!antwort.ok) return;
      const daten = (await antwort.json()) as { ansicht?: LigaDraftAnsicht | null };
      setAnsicht(daten.ansicht ?? null);
    } catch {
      /* nächster Takt */
    }
  }, [saveId, teamId, roomContext]);

  useEffect(() => {
    void lade();
    const id = window.setInterval(() => void lade(), 4000);
    return () => window.clearInterval(id);
  }, [lade]);

  const waehle = async (wahl: "spielen" | "selbst") => {
    if (!teamId || !ansicht) return;
    setBusy(true);
    setFehler(null);
    try {
      const antwort = await fetch("/api/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(baueDraftPostKoerper({ saveId, teamId, aktion: "startwahl", stand: ansicht.stand, roomContext, extra: { wahl } })),
      });
      const daten = (await antwort.json().catch(() => ({}))) as { success?: boolean; error?: string; ansicht?: LigaDraftAnsicht | null };
      if (!antwort.ok || daten.success === false) {
        setFehler(fehlerText(daten.error));
        return;
      }
      if (daten.ansicht) setAnsicht(daten.ansicht);
      if (wahl === "spielen") onOeffnen();
    } catch {
      setFehler("Netz weg — bitte noch einmal.");
    } finally {
      setBusy(false);
    }
  };

  if (!ansicht || ansicht.status === "fertig") return null;
  const mein = ansicht.mein;
  const offen = mein?.startWahl === "offen";
  const nr = ansicht.picks + 1;
  const dran = Boolean(mein?.amZug && !ansicht.wartetAufStart);
  const text = offen
    ? `Pick ${nr} von ${ansicht.teams.length} in Runde 1 (bis zu ${ansicht.regeln.maxRunden} Runden) — noch ist nichts gepickt. Richte erst dein Office ein, dann entscheidest du:`
    : ansicht.wartetAufStart
      ? "Du hast gewählt — der Draft startet, sobald alle Mitspieler gewählt haben."
      : mein?.status === "nachzug"
        ? "Die KI-Teams sind durch — du kaufst jetzt aus dem Rest."
        : dran
          ? `Du bist dran (Pick ${nr}). Kein Zeitlimit.`
          : mein?.picksBisZug != null
            ? `Pick ${nr} · noch ${mein.picksBisZug} Picks bis zu dir. Der Draft pausiert, solange du nicht auf der Draft-Seite bist.`
            : `Pick ${nr} läuft.`;

  return (
    <div className={`drf-hinweis${dran ? " dran" : ""}`} role="status" aria-live="polite" data-testid="draft-hinweis">
      <span className="drf-hinweis-ic" aria-hidden>◆</span>
      <div className="drf-hinweis-text">
        <strong>{offen ? "Draft wartet" : "Liga-Draft"}</strong>
        <span>{text}</span>
        {fehler ? <em>{fehler}</em> : null}
      </div>
      <div className="drf-hinweis-knoepfe">
        {offen ? (
          <>
            <button type="button" className="drf-hinweis-knopf haupt" disabled={busy} onClick={() => void waehle("spielen")} data-testid="draft-hinweis-spielen">Draft spielen</button>
            <button type="button" className="drf-hinweis-knopf" onClick={onOeffnen} title="Die Draft-Seite ansehen, ohne zu wählen" data-testid="draft-hinweis-zum-draft">Zum Draft</button>
            <button type="button" className="drf-hinweis-knopf" disabled={busy} onClick={() => void waehle("selbst")} title="Die KI pickt sofort durch, du kaufst danach selbst im Transfermarkt." data-testid="draft-hinweis-selbst">Selbst kaufen</button>
          </>
        ) : (
          <button type="button" className="drf-hinweis-knopf haupt" onClick={onOeffnen} data-testid="draft-hinweis-zum-draft">Zum Draft</button>
        )}
      </div>
    </div>
  );
}

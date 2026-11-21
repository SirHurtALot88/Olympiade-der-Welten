"use client";

/**
 * DRAFT-HINWEIS im App-Rahmen (19.11., Chris: „man sollte erst seine office sachen etc klären dürfen und sich zurecht finden
 * bevor man direkt in den draft rein geht“ und „wenn man beim draft woanders drauf geht muss klar sein wie man wieder zum draft
 * zurückkehrt“). Steht über jeder Ansicht, solange ein Draft läuft und die Draft-Seite nicht offen ist.
 *
 * Er fragt `GET /api/draft` selbst nach (alle 4 s) und zeigt: Pick-Stand, ob man dran ist — und, solange die Startwahl offen
 * ist, die zwei Knöpfe „Draft spielen“ (öffnet die Draft-Seite bei Pick 1) und „Selbst kaufen“ (die KI pickt sofort durch, danach
 * kauft man im Transfermarkt aus dem Rest). Der Draft-Zustand liegt im Spielstand: nichts davon geht beim Verlassen verloren.
 *
 * 21.11. (Chris hat die Wahl nicht gesehen): solange die Startwahl offen ist, legt sich ZUSÄTZLICH ein Dialog über die ganze
 * Seite (`StartWahlDialog`) — kurze Erklärung beider Wege, zwei große Knöpfe. „Erst Office ansehen“ schließt ihn nur bis zum
 * nächsten Laden der Seite; der Hinweis oben bleibt, und die Wahl bleibt offen, bis sie getroffen ist.
 */
import { useCallback, useEffect, useState } from "react";

import type { LigaDraftAnsicht } from "@/lib/draft/liga-draft-ansicht";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { fehlerText } from "./draft-format";
import { baueDraftLeseParameter, baueDraftPostKoerper } from "./draft-protokoll";
import "./draft-hinweis.css";

/** Dialog der Startwahl (21.11.): modal, unübersehbar, beide Wege in zwei Sätzen. Reine Anzeige; die Wahl trifft der Aufrufer. */
export function StartWahlDialog({
  nr,
  teams,
  maxRunden,
  busy,
  fehler,
  onWahl,
  onSpaeter,
}: {
  nr: number;
  teams: number;
  maxRunden: number;
  busy: boolean;
  fehler: string | null;
  onWahl: (wahl: "spielen" | "selbst") => void;
  onSpaeter: () => void;
}) {
  return (
    <div className="drf-wahl-schleier" role="dialog" aria-modal="true" aria-labelledby="drf-wahl-titel" data-testid="draft-startwahl-dialog">
      <div className="drf-wahl-karte">
        <small>Saisonstart · Kader aufbauen</small>
        <h2 id="drf-wahl-titel">Wie baust du deinen Kader auf?</h2>
        <p>
          Dein Team ist noch leer. Der Liga-Draft steht bei Pick {nr} von {teams} in Runde 1 (bis zu {maxRunden} Runden) — es ist noch
          nichts gepickt, und kein KI-Team pickt, bevor du gewählt hast.
        </p>
        <div className="drf-wahl-optionen">
          <button type="button" className="drf-wahl-opt haupt" disabled={busy} onClick={() => onWahl("spielen")} data-testid="draft-startwahl-spielen">
            <b>Draft spielen</b>
            <span>Reihum, Pick für Pick: Du siehst jeden KI-Pick und wählst bei deinem Zug einen Spieler. „Vor zu meinem Pick“ rechnet die KI bis zu dir durch.</span>
            <em>Für alle, die Spannung und Konkurrenz um die Besten wollen.</em>
          </button>
          <button type="button" className="drf-wahl-opt" disabled={busy} onClick={() => onWahl("selbst")} data-testid="draft-startwahl-selbst">
            <b>Selbst kaufen</b>
            <span>Die KI-Teams picken sofort durch. Danach kaufst du frei aus dem Rest im Transfermarkt — ohne Reihenfolge, mit Verhandlung.</span>
            <em>Für alle, die in Ruhe auswählen und verhandeln wollen.</em>
          </button>
        </div>
        {fehler ? <p className="drf-wahl-fehler" role="alert">{fehler}</p> : null}
        <button type="button" className="drf-wahl-spaeter" disabled={busy} onClick={onSpaeter} data-testid="draft-startwahl-spaeter">
          Erst das Office ansehen
        </button>
      </div>
    </div>
  );
}

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
  const [spaeter, setSpaeter] = useState(false);
  const [rechnet, setRechnet] = useState(false);

  const lade = useCallback(async () => {
    try {
      const parameter = baueDraftLeseParameter({ saveId, teamId, roomContext, vorschau: 0, verlauf: 1 });
      const antwort = await fetch(`/api/draft?${parameter.toString()}`, { cache: "no-store" });
      if (!antwort.ok) return;
      const daten = (await antwort.json()) as { ansicht?: LigaDraftAnsicht | null; hintergrundLaeuft?: boolean };
      setAnsicht(daten.ansicht ?? null);
      setRechnet(Boolean(daten.hintergrundLaeuft));
    } catch {
      /* nächster Takt */
    }
  }, [saveId, teamId, roomContext]);

  useEffect(() => {
    void lade();
    // Rechnet die KI gerade (nach „Selbst kaufen“), fragt der Hinweis öfter nach und verschwindet, sobald sie durch ist.
    const id = window.setInterval(() => void lade(), rechnet ? 700 : 4000);
    return () => window.clearInterval(id);
  }, [lade, rechnet]);

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
      if (wahl === "selbst") setRechnet(true);
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
  const text = rechnet && !offen
    ? "Die KI rechnet gerade alle Picks durch — gleich kaufst du aus dem Rest im Transfermarkt."
    : offen
    ? `Pick ${nr} von ${ansicht.teams.length} in Runde 1 (bis zu ${ansicht.regeln.maxRunden} Runden) — noch ist nichts gepickt. Richte erst dein Office ein, dann entscheidest du:`
    : ansicht.wartetAufStart
      ? "Du hast gewählt — der Draft startet, sobald alle Mitspieler gewählt haben."
      : mein?.status === "nachzug"
        ? "Die KI-Teams sind durch — du kaufst jetzt aus dem Rest."
        : dran
          ? `Du bist dran (Pick ${nr}). Kein Zeitlimit.`
          : `Pick ${nr} · der Draft pausiert, solange du nicht auf der Draft-Seite bist — dort geht er genau hier weiter.`;

  return (
    <>
    {offen && !spaeter ? (
      <StartWahlDialog
        nr={nr}
        teams={ansicht.teams.length}
        maxRunden={ansicht.regeln.maxRunden}
        busy={busy}
        fehler={fehler}
        onWahl={(wahl) => void waehle(wahl)}
        onSpaeter={() => setSpaeter(true)}
      />
    ) : null}
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
    </>
  );
}

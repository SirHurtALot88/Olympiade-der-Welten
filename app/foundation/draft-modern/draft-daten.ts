"use client";

/**
 * Daten und Takt der Draft-Seite (18.11.). Die Seite liest ausschließlich `GET /api/draft` und schreibt über
 * `POST /api/draft` (Schnittstelle: docs/design/draft-neubau-kern-18-11.md, Abschnitt 5). Gezeigt = gebucht: nichts hier
 * rechnet Picks oder Preise nach, jede Anzeige kommt aus der Antwort der Route.
 *
 * Tempo 1×/3× heißt: die Seite ruft im Takt `ki_schritt` (2,4 s bzw. 0,8 s). Für Menschen gibt es keine Uhr — der Takt
 * hält an, sobald ein Mensch ohne Auto-Pick am Zug ist, und die Seite fragt dann nur noch in Ruhe nach.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { LigaDraftAnsicht, LigaDraftZugAnsicht } from "@/lib/draft/liga-draft-ansicht";
import type { LigaDraftEintrag } from "@/lib/data/olyDataTypes";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { fehlerText, istStandKonflikt } from "./draft-format";
import { baueDraftLeseParameter, baueDraftPostKoerper, DRAFT_MAX_PICKS_JE_SCHRITT } from "./draft-protokoll";

export type DraftTempo = 0 | 1 | 3;
export type DraftMeldung = { id: number; art: "g" | "w" | ""; titel: string; text: string };
/** Der gerade aufgedeckte KI-Pick: das Team mit seinen Top 3 von VOR dem Pick und der gebuchte Eintrag. */
export type DraftZeig = { zug: LigaDraftZugAnsicht; eintrag: LigaDraftEintrag };

type PostAntwort = {
  success?: boolean;
  error?: string;
  ansicht?: LigaDraftAnsicht | null;
  eintraege?: LigaDraftEintrag[];
  halt?: "mensch_am_zug" | "max_picks" | "draft_vorbei";
};

const TAKT_MS: Record<1 | 3, number> = { 1: 2400, 3: 800 };
const NACHFRAGE_MS = 3000;
const VOR_MS = 120;

function neueSchluessel(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  } catch {
    return `draft-${Date.now()}`;
  }
}

export function useLigaDraft(input: {
  saveId: string;
  teamId: string | null;
  roomContext: FoundationRoomContext | null | undefined;
}) {
  const { saveId, teamId, roomContext } = input;
  const [ansicht, setAnsicht] = useState<LigaDraftAnsicht | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [hintergrund, setHintergrund] = useState(false);
  const [tempo, setTempo] = useState<DraftTempo>(1);
  const [vor, setVor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zeig, setZeig] = useState<DraftZeig | null>(null);
  const [meldungen, setMeldungen] = useState<DraftMeldung[]>([]);
  const ansichtRef = useRef<LigaDraftAnsicht | null>(null);
  const busyRef = useRef(false);
  const roomRef = useRef(roomContext ?? null);
  const zaehler = useRef(0);
  useEffect(() => {
    roomRef.current = roomContext ?? null;
    ansichtRef.current = ansicht;
  });

  const meldung = useCallback((art: DraftMeldung["art"], titel: string, text: string) => {
    const id = ++zaehler.current;
    setMeldungen((alt) => [...alt.slice(-2), { id, art, titel, text }]);
    window.setTimeout(() => setMeldungen((alt) => alt.filter((m) => m.id !== id)), 6000);
  }, []);

  const lade = useCallback(async () => {
    if (!saveId || saveId === "loading-save") return;
    try {
      const parameter = baueDraftLeseParameter({ saveId, teamId, roomContext: roomRef.current, vorschau: 6, verlauf: 0 });
      const antwort = await fetch(`/api/draft?${parameter.toString()}`, { cache: "no-store" });
      const daten = (await antwort.json()) as { ansicht?: LigaDraftAnsicht | null; hintergrundLaeuft?: boolean; error?: string };
      if (!antwort.ok) return;
      ansichtRef.current = daten.ansicht ?? null;
      setAnsicht(daten.ansicht ?? null);
      setHintergrund(Boolean(daten.hintergrundLaeuft));
      setGeladen(true);
    } catch {
      /* Netz weg: der nächste Takt versucht es wieder */
    }
  }, [saveId, teamId]);

  const sende = useCallback(
    async (aktion: string, extra: Record<string, unknown> = {}): Promise<PostAntwort> => {
      if (!saveId || !teamId) return { success: false, error: "team_nicht_im_draft" };
      busyRef.current = true;
      setBusy(true);
      try {
        const koerper = baueDraftPostKoerper({ saveId, teamId, aktion, stand: ansichtRef.current?.stand, roomContext: roomRef.current, extra });
        const antwort = await fetch("/api/draft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(koerper),
        });
        const daten = (await antwort.json().catch(() => ({}))) as PostAntwort;
        if (daten.ansicht) {
          // Sofort merken: der nächste Aufruf (z. B. `ki_hintergrund` nach `ueberspringen`) braucht den frischen Stand.
          ansichtRef.current = daten.ansicht;
          setAnsicht(daten.ansicht);
        }
        if (!antwort.ok || daten.success === false) {
          // Stand-Konflikt: still neu laden, die Sicht erscheint erneut — keine Fehlermeldung.
          if (istStandKonflikt(daten.error)) await lade();
          return { ...daten, success: false, error: daten.error ?? "draft_aktion_fehlgeschlagen" };
        }
        return { ...daten, success: true };
      } catch {
        return { success: false, error: "netz" };
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [saveId, teamId, lade],
  );

  // Erstes Laden, danach Nachfragen: wer nicht selbst Zug um Zug treibt, sieht so, was die anderen buchen.
  useEffect(() => {
    void lade();
  }, [lade]);

  const mein = ansicht?.mein ?? null;
  const kannTakten = Boolean(
    ansicht &&
      mein &&
      mein.art === "mensch" &&
      ansicht.status === "laeuft" &&
      ansicht.amZug?.automatisch &&
      !hintergrund,
  );
  const taktet = kannTakten && (vor || tempo > 0);

  useEffect(() => {
    if (!ansicht || ansicht.status === "fertig" || taktet) return undefined;
    const id = window.setInterval(() => {
      if (!busyRef.current) void lade();
    }, NACHFRAGE_MS);
    return () => window.clearInterval(id);
  }, [ansicht?.status, taktet, lade]); // eslint-disable-line react-hooks/exhaustive-deps

  const stand = ansicht?.stand ?? -1;
  const naechsterIndex = mein?.picksBisZug ?? null;
  useEffect(() => {
    if (!taktet || busy) return undefined;
    const warte = vor ? VOR_MS : TAKT_MS[tempo === 3 ? 3 : 1];
    const id = window.setTimeout(async () => {
      const vorher = ansichtRef.current?.amZug ?? null;
      const maxPicks = vor ? Math.max(1, Math.min(DRAFT_MAX_PICKS_JE_SCHRITT, naechsterIndex ?? 1)) : 1;
      const antwort = await sende("ki_schritt", { maxPicks });
      if (!antwort.success) {
        setVor(false);
        if (antwort.error && !istStandKonflikt(antwort.error)) meldung("w", "KI-Schritt", fehlerText(antwort.error));
        return;
      }
      if (antwort.halt === "mensch_am_zug" || antwort.halt === "draft_vorbei") setVor(false);
      const letzter = antwort.eintraege?.filter((e) => e.art === "pick").slice(-1)[0];
      if (!vor && letzter && vorher && vorher.top3) {
        setZeig({ zug: vorher, eintrag: letzter });
        window.setTimeout(() => setZeig((z) => (z && z.eintrag.nr === letzter.nr ? null : z)), Math.round(TAKT_MS[tempo === 3 ? 3 : 1] * 0.8));
      }
    }, warte);
    return () => window.clearTimeout(id);
  }, [taktet, busy, stand, vor, tempo, naechsterIndex, sende, meldung]);

  // Der Hintergrundlauf (Überspringen A, reine KI-Liga) kündigt sein Ende nur über GET an.
  useEffect(() => {
    if (!hintergrund) return undefined;
    const id = window.setInterval(() => void lade(), 1500);
    return () => window.clearInterval(id);
  }, [hintergrund, lade]);

  const aktionen = useMemo(
    () => ({
      pick: async (playerId: string, name: string) => {
        const antwort = await sende("pick", { playerId, idempotencyKey: neueSchluessel() });
        if (antwort.success) {
          setZeig(null);
          meldung("g", `${name} gepickt`, "Der Pick ist gebucht.");
        } else if (!istStandKonflikt(antwort.error)) meldung("w", "Pick nicht möglich", fehlerText(antwort.error));
        return Boolean(antwort.success);
      },
      auslassen: async () => {
        const antwort = await sende("auslassen");
        if (antwort.success) meldung("", "Pick ausgelassen", "Dein Team ist in dieser Runde übersprungen.");
        else if (!istStandKonflikt(antwort.error)) meldung("w", "Auslassen nicht möglich", fehlerText(antwort.error));
      },
      fertig: async () => {
        const antwort = await sende("fertig");
        if (antwort.success) meldung("g", "Du bist fertig", "Dein Team pickt nicht mehr.");
        else if (!istStandKonflikt(antwort.error)) meldung("w", "Fertig melden nicht möglich", fehlerText(antwort.error));
        return Boolean(antwort.success);
      },
      autoPick: async (an: boolean, zielTeamId?: string) => {
        const antwort = await sende("auto_pick", { an, ...(zielTeamId ? { zielTeamId } : {}) });
        if (!antwort.success && !istStandKonflikt(antwort.error)) meldung("w", "Auto-Pick", fehlerText(antwort.error));
      },
      ueberspringen: async (variante: "A" | "B") => {
        const antwort = await sende("ueberspringen", { variante });
        if (!antwort.success) {
          if (!istStandKonflikt(antwort.error)) meldung("w", "Überspringen nicht möglich", fehlerText(antwort.error));
          return false;
        }
        if (variante === "A") {
          const lauf = await sende("ki_hintergrund");
          if (lauf.success) {
            setHintergrund(true);
            meldung("g", "KI pickt fertig", "Danach wählst du ohne Reihenfolge aus dem Rest.");
          } else if (!istStandKonflikt(lauf.error)) meldung("w", "KI-Lauf", fehlerText(lauf.error));
        } else meldung("g", "Auto-Draft", "Dein GM pickt an deinem Platz in der Reihenfolge.");
        return true;
      },
      kiHintergrund: async (leise = false) => {
        const lauf = await sende("ki_hintergrund");
        if (lauf.success) setHintergrund(true);
        else if (!leise && !istStandKonflikt(lauf.error)) meldung("w", "KI-Lauf", fehlerText(lauf.error));
        return Boolean(lauf.success);
      },
      /** Nur Gastgeber (die Route prüft es): Draft → fertig, offene Teams „abgebrochen“. Danach zurück ins Spiel. */
      abbrechen: async () => {
        const antwort = await sende("abbrechen");
        if (antwort.success) meldung("", "Draft abgebrochen", "Teams unter 8 Spielern bekommen eine Warnung.");
        else if (!istStandKonflikt(antwort.error)) meldung("w", "Abbrechen nicht möglich", fehlerText(antwort.error));
        return Boolean(antwort.success);
      },
    }),
    [sende, meldung],
  );

  return {
    ansicht,
    geladen,
    hintergrund,
    tempo,
    setTempo,
    vor,
    setVor,
    busy,
    zeig,
    meldungen,
    meldung,
    lade,
    aktionen,
    taktet,
  };
}

"use client";

/**
 * TOR DER DRAFT-SEITE (18.11.): entscheidet, ob die Shell an der Stelle des Schildes „Liga wird erstellt …“ die neue
 * Draft-Seite zeigt. Ohne `OLY_LIGA_DRAFT_MODUS=einzelschritt` gibt es keinen Draft-Zustand im Spielstand; die Probe
 * antwortet dann `ansicht: null` und alles bleibt wie heute (Schild, normale Ansichten).
 */
import { useCallback, useEffect, useState } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";

type Urteil = { saveId: string; wert: "ja" | "nein" };

export function useLigaDraftTor(input: { gameState: GameState; saveId: string; leagueSetupStatus: string | null }) {
  const { gameState, saveId, leagueSetupStatus } = input;
  const lokal = gameState.seasonState.ligaDraft;
  const kandidat =
    Boolean(saveId) &&
    saveId !== "loading-save" &&
    (leagueSetupStatus === "in_progress" || (lokal != null && lokal.saisonId === gameState.season.id && lokal.status !== "fertig"));
  const [urteil, setUrteil] = useState<Urteil | null>(null);
  const [verlassen, setVerlassen] = useState<string | null>(null);

  useEffect(() => {
    if (!kandidat || (urteil && urteil.saveId === saveId)) return undefined;
    let abgebrochen = false;
    void (async () => {
      try {
        const antwort = await fetch(`/api/draft?${new URLSearchParams({ saveId, vorschau: "0", verlauf: "1" }).toString()}`, { cache: "no-store" });
        if (!antwort.ok) return;
        const daten = (await antwort.json()) as { ansicht?: unknown };
        if (!abgebrochen) setUrteil({ saveId, wert: daten.ansicht ? "ja" : "nein" });
      } catch {
        /* nächster Render versucht es nicht erneut; der Rückweg ist der alte Ablauf */
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [kandidat, saveId, urteil]);

  const aktiv = urteil?.saveId === saveId && urteil.wert === "ja" && verlassen !== saveId;
  const schliessen = useCallback(() => setVerlassen(saveId), [saveId]);
  return { aktiv, schliessen };
}

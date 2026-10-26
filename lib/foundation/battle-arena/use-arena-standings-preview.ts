"use client";

import { useEffect, useRef, useState } from "react";

import type { FoundationStandingsPreviewResponse } from "@/lib/foundation/tabs/foundation-page-types";

/**
 * Duenner, ON-DEMAND-Abruf der bereits bestehenden `/api/standings/preview`-Route
 * (`lib/standings/standings-preview-engine.ts`) fuer das "Tabelle"-Panel der Battle Arena. Bewusst
 * KEIN zweiter Cache/keine zweite Engine -- nur der Fetch, lazy (erst wenn `enabled`, also wenn das
 * Panel offen ist), damit das Oeffnen/Schliessen der Panels keine Dauerlast erzeugt, waehrend die
 * Arena selbst (die TEAM-AUSWAHL, kein echter Spielstand, s. Host-Dateikommentar) offen bleibt.
 */
export function useArenaStandingsPreview(input: {
  enabled: boolean;
  saveId: string | null | undefined;
  seasonId: string | null | undefined;
  matchdayId: string | null | undefined;
}) {
  const [preview, setPreview] = useState<FoundationStandingsPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);

  const saveId = input.saveId ?? "";
  const seasonId = input.seasonId ?? "";
  const matchdayId = input.matchdayId ?? "";
  const requestKey = `${saveId}:${seasonId}:${matchdayId}`;

  useEffect(() => {
    if (!input.enabled || !saveId || saveId === "loading-save" || !seasonId || !matchdayId) {
      return;
    }
    // Nicht neu laden, wenn genau dieser Spieltag bereits (oder gerade) geladen wird -- das
    // Oeffnen/Schliessen des Panels soll keinen neuen Request pro Klick ausloesen.
    if (requestKeyRef.current === requestKey) {
      return;
    }
    requestKeyRef.current = requestKey;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ saveId, seasonId, matchdayId, source: "sqlite" });
    fetch(`/api/standings/preview?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json() as Promise<FoundationStandingsPreviewResponse>)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setPreview(payload);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        // Ein fehlgeschlagener Preview-Abruf darf das Panel nie leer lassen -- `buildArenaStandingsPanel`
        // faellt ohne `preview` ohnehin auf den zuletzt gebuchten Stand zurueck (s. Dateikommentar dort).
        setError(cause instanceof Error ? cause.message : "standings_preview_failed");
        requestKeyRef.current = null;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [input.enabled, saveId, seasonId, matchdayId, requestKey]);

  return { preview, loading, error };
}

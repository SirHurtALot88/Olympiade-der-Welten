"use client";

import { useEffect } from "react";

/**
 * Route-Error-Boundary für den gesamten Foundation-Shell-Baum. Fängt Render-Fehler
 * einzelner Views (statt die ganze Seite auf die Browser-Fehlerseite "This page
 * couldn't load" fallen zu lassen) und bietet eine saubere In-App-Wiederherstellung.
 *
 * Stale-Deploy-Selbstheilung: Nach einem neuen Build zeigen bereits offene Tabs auf
 * alte Chunk-Hashes; ein lazy geladener View (z. B. Spieler-Tabelle) wirft dann einen
 * `ChunkLoadError`. Ein einmaliges hartes Neuladen holt die frischen Chunks — mit
 * Session-Guard gegen Reload-Schleifen.
 */

const CHUNK_ERROR_PATTERNS = [
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
];

function isChunkLoadError(error: (Error & { name?: string }) | null | undefined): boolean {
  if (!error) return false;
  const haystack = `${error.name ?? ""} ${error.message ?? ""}`;
  return CHUNK_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));
}

export default function FoundationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (typeof console !== "undefined") {
      console.error("[foundation] view crash", error);
    }
    if (!isChunkLoadError(error)) {
      return;
    }
    const RELOAD_KEY = "oly-chunk-reload-at";
    const now = Date.now();
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? "0");
    // Nur einmal je 10s automatisch neu laden — sonst Schleife bei echtem Chunk-404.
    if (!Number.isFinite(last) || now - last > 10_000) {
      window.sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    }
  }, [error]);

  const chunkStale = isChunkLoadError(error);

  return (
    <div className="foundation-error-boundary" role="alert" aria-live="assertive">
      <div className="foundation-error-card">
        <span className="foundation-error-icon" aria-hidden="true">
          ⚠
        </span>
        <h1 className="foundation-error-title">
          {chunkStale ? "Neue Version verfügbar" : "Diese Ansicht konnte nicht geladen werden"}
        </h1>
        <p className="foundation-error-copy">
          {chunkStale
            ? "Es wird gerade die aktuelle Version geladen. Falls nicht automatisch, bitte neu laden."
            : "Ein unerwarteter Fehler ist aufgetreten. Meist hilft schon ein erneuter Versuch."}
        </p>
        <div className="foundation-error-actions">
          <button type="button" className="foundation-error-btn is-primary" onClick={() => reset()}>
            Erneut versuchen
          </button>
          <button
            type="button"
            className="foundation-error-btn"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          >
            Seite neu laden
          </button>
        </div>
        {error?.digest ? <code className="foundation-error-digest">Ref: {error.digest}</code> : null}
      </div>
    </div>
  );
}

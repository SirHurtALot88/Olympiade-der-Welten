"use client";

import { useEffect, useRef, useState } from "react";
import type { ArticleSearchResult, OpenReviewItem } from "./types";

interface Props {
  item: OpenReviewItem;
  onResolved: (id: string) => void;
}

export function ReviewRow({ item, onResolved }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArticleSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/articles/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function resolve(targetArticleId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/review/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewItemId: item.id, targetArticleId }),
      });
      if (!res.ok) throw new Error("Zuordnung fehlgeschlagen.");
      onResolved(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setBusy(false);
    }
  }

  async function ignore() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/review/ignore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewItemId: item.id }),
      });
      if (!res.ok) throw new Error("Aktion fehlgeschlagen.");
      onResolved(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: "11px 12px",
        borderBottom: "1px solid var(--line)",
        opacity: busy ? 0.6 : 1,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className={`pill ${item.source === "billbee" ? "p-warn" : "p-mkt"}`} style={{ flex: "none" }}>
          {item.source}
        </span>
        <span
          style={{
            fontSize: 12.7,
            fontWeight: 600,
            minWidth: 0,
            flex: "1 1 260px",
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
          title={item.nameRaw}
        >
          {item.nameRaw}
        </span>
        {item.setCode && <span className="code">{item.setCode}</span>}
        <button
          type="button"
          className="chip"
          onClick={ignore}
          disabled={busy}
          title="Als Privatverkauf / kein Karten-Artikel markieren"
        >
          Ignorieren
        </button>
      </div>

      <div style={{ marginTop: 8, position: "relative" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Passendem Artikel zuordnen — Name oder Set-Code suchen …"
          disabled={busy}
          style={{
            width: "100%",
            background: "var(--panel2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            padding: "7px 10px",
            color: "var(--ink)",
            font: "inherit",
            fontSize: 12.5,
            outline: "none",
          }}
        />
        {open && results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              boxShadow: "var(--shadow)",
              zIndex: 20,
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => resolve(r.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: 0,
                  borderBottom: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--ink)",
                  font: "inherit",
                  fontSize: 12.5,
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontWeight: 600 }}>{r.nameRaw}</span>
                {r.setCode && <span className="code" style={{ marginLeft: 8 }}>{r.setCode}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--crit)" }}>{error}</div>
      )}
    </div>
  );
}
